/**
 * Preimage Holder Service
 *
 * Manages preimage storage and retrieval according to Gray Paper specifications
 * Handles mapping from hash to preimage data and announcement tracking
 */

import {
  getServicePreimageValue,
  getServiceRequestValue,
  getServiceStorageKey,
  getServiceStorageValue,
  setServicePreimageValue,
  setServiceRequestValue,
  setServiceStorageValue,
} from '@pbnjam/codec'
import {
  blake2bHash,
  bytesToHex,
  checkPreimageAvailability,
  type EventBusService,
  type Hex,
  hexToBytes,
  logger,
  zeroHash,
} from '@pbnjam/core'
import type { PreimageRequestProtocol } from '@pbnjam/networking'
import {
  BaseService,
  type IServiceAccountService,
  type Preimage,
  type PreimageAnnouncement,
  type PreimageRequest,
  type PreimageRequestStatus,
  type Safe,
  type SafePromise,
  type ServiceAccount,
  type ServiceAccounts,
  safeError,
  safeResult,
} from '@pbnjam/types'
import type { ClockService } from './clock-service'
import type { NetworkingService } from './networking-service'

/**
 * Service Account Service
 *
 * Manages preimage storage according to Gray Paper specifications:
 * - Stores preimages with hash-to-data mapping
 * - Tracks preimage announcements
 * - Handles preimage requests and availability
 * - Manages preimage expiration (Cexpungeperiod = 19,200 timeslots)
 */
export class ServiceAccountService
  extends BaseService
  implements IServiceAccountService
{
  /** Map from preimage hash to preimage data */
  private readonly coreServiceAccounts: Map<bigint, ServiceAccount>

  /** Pending preimages that have been received but not yet applied to service account through accumulation */
  private readonly pendingPreimages: Map<string, Preimage> = new Map()

  private readonly eventBusService: EventBusService
  //   private readonly clockService: ClockService
  private readonly networkingService: NetworkingService | null
  private readonly preimageRequestProtocol: PreimageRequestProtocol | null

  constructor(options: {
    eventBusService: EventBusService
    clockService: ClockService
    networkingService: NetworkingService | null
    preimageRequestProtocol: PreimageRequestProtocol | null
  }) {
    super('preimage-holder-service')
    this.networkingService = options.networkingService
    this.eventBusService = options.eventBusService
    //     this.clockService = options.clockService
    this.preimageRequestProtocol = options.preimageRequestProtocol

    this.coreServiceAccounts = new Map<bigint, ServiceAccount>()

    this.eventBusService.addPreimageAnnouncementCallback(
      this.handlePreimageAnnouncement.bind(this),
    )
    this.eventBusService.addPreimageRequestedCallback(
      this.handlePreimageRequested.bind(this),
    )
    this.eventBusService.addPreimageReceivedCallback(
      this.handlePreimageReceived.bind(this),
    )
    // this.eventBusService.addSlotChangeCallback(
    //   this.handleSlotChanged.bind(this),
    // )
  }

  async start(): SafePromise<boolean> {
    return safeResult(true)
  }

  async stop(): SafePromise<boolean> {
    this.eventBusService.removePreimageAnnouncementCallback(
      this.handlePreimageAnnouncement.bind(this),
    )
    this.eventBusService.removePreimageRequestedCallback(
      this.handlePreimageRequested.bind(this),
    )
    this.eventBusService.removePreimageReceivedCallback(
      this.handlePreimageReceived.bind(this),
    )
    // this.eventBusService.removeSlotChangeCallback(
    //   this.handleSlotChanged.bind(this),
    // )

    return safeResult(true)
  }

  async handlePreimageRequested(
    request: PreimageRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    if (!this.preimageRequestProtocol) {
      return safeError(new Error('Preimage request protocol not found'))
    }

    if (!this.networkingService) {
      return safeError(new Error('Networking service not found'))
    }

    let foundPreimage: Hex | undefined
    let foundServiceId: bigint | undefined
    // try to find the preimage from known service accounts
    for (const [
      serviceId,
      serviceAccount,
    ] of this.coreServiceAccounts.entries()) {
      const preimage = getServicePreimageValue(
        serviceAccount,
        serviceId,
        request.hash,
      )
      if (preimage) {
        foundPreimage = bytesToHex(preimage)
        foundServiceId = serviceId
        break
      }
    }

    if (!foundPreimage || !foundServiceId) {
      return safeError(new Error('Preimage not found'))
    }

    const [serializeError, serializedPreimageMessage] =
      this.preimageRequestProtocol.serializeResponse({
        requester: foundServiceId,
        blob: foundPreimage,
      })
    if (serializeError) {
      return safeError(serializeError)
    }
    // send a message back through the networking service with the preimage response
    this.networkingService.sendMessageByPublicKey(
      peerPublicKey,
      143,
      serializedPreimageMessage,
    )
    return safeResult(undefined)
  }

  handlePreimageReceived(preimage: Preimage, _peerPublicKey: Hex): void {
    // Add to pending preimages - these will be applied during accumulation
    const [hashError, preimageHash] = blake2bHash(hexToBytes(preimage.blob))
    if (!hashError && preimageHash) {
      const key = `${preimage.requester}:${preimageHash}:${BigInt(hexToBytes(preimage.blob).length)}`
      this.pendingPreimages.set(key, preimage)
    }
  }

  handlePreimageAnnouncement(
    announcement: PreimageAnnouncement,
    peerPublicKey: Hex,
  ): Safe<void> {
    // Announcement of possession of a requested preimage. This should be used by non-validator nodes to introduce preimages, and by validators to gossip these preimages to other validators.
    // The recipient of the announcement is expected to follow up by requesting the preimage using protocol 143, provided the preimage has been requested on chain by the given service and the recipient is not already in possession of it. In the case where the sender of the announcement is a non-validator node, it is expected to keep the connection open for a reasonable time (eg 10 seconds) to allow this request to be made; if the connection is closed before the request can be made, the recipient is not expected to reopen it.
    // Once a validator has obtained a requested preimage, it should announce possession to its neighbours in the grid structure.

    // Check if we already have this preimage stored in service account
    let alreadyHavePreimage = false
    for (const [
      serviceId,
      serviceAccount,
    ] of this.coreServiceAccounts.entries()) {
      const preimage = getServicePreimageValue(
        serviceAccount,
        serviceId,
        announcement.hash,
      )
      if (preimage) {
        alreadyHavePreimage = true
        break
      }
    }

    // Check if we already have it in pending preimages
    const pendingKey = `${announcement.serviceId}:${announcement.hash}:${announcement.preimageLength}`
    const alreadyPending = this.pendingPreimages.has(pendingKey)

    if (!this.preimageRequestProtocol) {
      return safeError(new Error('Preimage request protocol not found'))
    }

    if (!this.networkingService) {
      return safeError(new Error('Networking service not found'))
    }

    // Only request if we don't already have it stored or pending
    if (!alreadyHavePreimage && !alreadyPending) {
      const [error, preimageRequestMessage] =
        this.preimageRequestProtocol.serializeRequest({
          hash: announcement.hash,
        })
      if (error) {
        return safeError(error)
      }
      this.networkingService.sendMessageByPublicKey(
        peerPublicKey,
        143,
        preimageRequestMessage,
      )
    }
    return safeResult(undefined)
  }

  /**
   * Store actual preimage data (validates then stores).
   * For batch apply after block-importer validation, use applyPreimages with preimages
   * already validated via validatePreimages.
   *
   * @param preimage - The preimage data to store
   * @returns Safe result indicating success
   */
  storePreimage(preimage: Preimage, creationSlot: bigint): Safe<void> {
    // Gray Paper accumulation.tex fnprovide: "Preimage provisions into services which
    // no longer exist or whose relevant request is dropped are disregarded."
    const [validationError] = this.validatePreimageRequest(
      preimage,
      creationSlot,
    )
    if (validationError) {
      return safeError(validationError)
    }
    return this.storePreimageOnly(preimage, creationSlot)
  }

  /**
   * Store preimage without validation. Caller must have validated via validatePreimages.
   */
  private storePreimageOnly(
    preimage: Preimage,
    creationSlot: bigint,
  ): Safe<void> {
    const blobBytes = hexToBytes(preimage.blob)
    const [hashError, hash] = blake2bHash(blobBytes)
    if (hashError) {
      return safeError(hashError)
    }

    const blobLength = BigInt(blobBytes.length)

    const serviceAccount = this.coreServiceAccounts.get(preimage.requester)
    if (!serviceAccount) {
      return safeError(new Error('Service account not found'))
    }
    const serviceId = preimage.requester
    setServicePreimageValue(serviceAccount, serviceId, hash, blobBytes)
    setServiceRequestValue(serviceAccount, serviceId, hash, blobLength, [
      creationSlot,
    ])
    return safeResult(undefined)
  }

  /**
   * Validate a preimage against current state without mutating it
   */
  private validatePreimageRequest(
    preimage: Preimage,
    currentTimeslot: bigint,
  ): Safe<void> {
    // Compute hash over blob only
    const [hashError, hash] = blake2bHash(hexToBytes(preimage.blob))
    if (hashError) {
      return safeError(hashError)
    }

    const serviceAccount = this.coreServiceAccounts.get(preimage.requester)
    if (!serviceAccount) {
      return safeError(new Error('Service account not found'))
    }
    // Already present for this service -> unneeded
    const existing = getServicePreimageValue(
      serviceAccount,
      preimage.requester,
      hash,
    )
    if (existing) {
      logger.debug('Preimage already present', {
        serviceId: preimage.requester.toString(),
        hash: hash.slice(0, 18),
        blobLength: hexToBytes(preimage.blob).length,
      })
      return safeError(new Error('preimage_unneeded'))
    }

    // Must be requested for this service and exact byte length
    const blobLength = BigInt(hexToBytes(preimage.blob).length)

    const requestStatus = getServiceRequestValue(
      serviceAccount,
      preimage.requester,
      hash,
      blobLength,
    )

    if (!requestStatus) {
      logger.debug('Preimage not needed', {
        serviceId: preimage.requester.toString(),
        hash: hash.slice(0, 18),
        blobLength: blobLength.toString(),
      })
      return safeError(new Error('preimage_unneeded'))
    }
    if (requestStatus.length === 2 && requestStatus[1] < currentTimeslot) {
      logger.debug('Preimage not needed', {
        serviceId: preimage.requester.toString(),
        hash: hash.slice(0, 18),
        blobLength: blobLength.toString(),
      })
      return safeResult(undefined)
    }

    return safeResult(undefined)
  }

  /**
   * Validate preimages without modifying state
   * This should be called BEFORE applyPreimages to check for errors
   * that should cause the entire block to be skipped (no state changes).
   *
   * @param preimages - Preimages to validate
   * @returns Safe result with error if validation fails, or validated preimages if successful
   */
  validatePreimages(
    preimages: Preimage[],
    currentTimeslot: bigint,
  ): Safe<Preimage[]> {
    // Validate sorted by requester asc, then blob asc; and unique
    for (let i = 1; i < preimages.length; i++) {
      const a = preimages[i - 1]
      const b = preimages[i]
      if (a.requester > b.requester) {
        return safeError(new Error('preimages_not_sorted_unique'))
      }
      if (a.requester === b.requester && a.blob > b.blob) {
        return safeError(new Error('preimages_not_sorted_unique'))
      }
      if (a.requester === b.requester && a.blob === b.blob) {
        return safeError(new Error('preimages_not_sorted_unique'))
      }
    }

    // Pre-validate all items atomically; reject whole batch on first failure
    for (const p of preimages) {
      const [validationError] = this.validatePreimageRequest(p, currentTimeslot)
      if (validationError) {
        return safeError(validationError)
      }
    }

    return safeResult(preimages)
  }

  /**
   * Apply a batch of preimages for a given slot. Runs the same validation as
   * validatePreimageRequest per preimage; invalid preimages are skipped (no error).
   * Caller must call validatePreimages before accumulation; after accumulation
   * state may have changed (e.g. FORGET removed a request), so we re-check and skip.
   *
   * @param preimages - Preimages validated by validatePreimages before accumulation
   * @param creationSlot - Slot when preimages are created
   * @returns Safe result indicating success
   */
  applyPreimages(preimages: Preimage[], creationSlot: bigint): Safe<void> {
    for (const p of preimages) {
      const [validationError] = this.validatePreimageRequest(p, creationSlot)
      if (validationError) {
        continue
      }
      const [storeError] = this.storePreimageOnly(p, creationSlot)
      if (storeError) {
        return safeError(storeError)
      }
    }
    return safeResult(undefined)
  }

  /**
   * Clean up expired preimages
   *
   * @param currentTimeslot - Current timeslot for expiration calculation
   * @returns Number of preimages cleaned up
   */
  // async handleSlotChanged(slotChangeEvent: SlotChangeEvent): SafePromise<void> {
  //   const CEXPUNGE_PERIOD = BigInt(this.configService.preimageExpungePeriod) // Gray Paper constant

  //   // update all requests (per service)
  //   for (const [_, hashMap] of this.stateService.getServiceRequests().entries()) {
  //     for (const [hash, lengthMap] of hashMap.entries()) {
  //       for (const [_blobLength, requestStatus] of lengthMap.entries()) {
  //         const lastChangeSlot = requestStatus[requestStatus.length - 1]
  //         if (slotChangeEvent.slot > lastChangeSlot - CEXPUNGE_PERIOD) {
  //           requestStatus.push(slotChangeEvent.slot) // just became unavailable
  //           this.preimageCache.delete(hash)
  //         }
  //       }
  //     }
  //   }

  //   return safeResult(undefined)
  // }

  /**
   * Gray Paper histlookup function
   *
   * Gray Paper equation 115-127:
   * histlookup(a, t, h) ≡ a.sa_preimages[h] when h ∈ keys(a.sa_preimages) ∧ I(a.sa_requests[h, len(a.sa_preimages[h])], t)
   *
   * @param serviceAccount - Service account containing preimages and requests
   * @param hash - Hash to lookup
   * @param timeslot - Timeslot for historical lookup
   * @returns Preimage blob or null if not found/not available
   */
  histLookupServiceAccount(
    serviceId: bigint,
    serviceAccount: ServiceAccount,
    hash: Hex,
    timeslot: bigint,
  ): Safe<Uint8Array | null> {
    // check that hash belongs to known preimage
    // first check validity based on the timeslot:

    // Get the request map for this hash
    const preimage = getServicePreimageValue(serviceAccount, serviceId, hash)
    if (!preimage) {
      logger.debug('Hash does not belong to a preimage', { hash })
      return safeResult(null)
    }

    const requestStatus = getServiceRequestValue(
      serviceAccount,
      serviceId,
      hash,
      BigInt(preimage.length),
    )
    if (!requestStatus) {
      logger.debug('No request map found for hash', { hash })
      return safeResult(null)
    }

    // Apply the Gray Paper histlookup logic using I(l, t) function
    const isValid = this.checkRequestValidity(requestStatus, timeslot)

    if (!isValid) {
      logger.debug('Preimage not available at requested timeslot', {
        hash,
        timeslot: timeslot.toString(),
        requestStatus: requestStatus.map((t) => t.toString()),
      })
      return safeResult(null)
    }

    return safeResult(preimage)
  }

  /**
   * Check if a request is available at a given time using Gray Paper function I(l, t)
   *
   * Gray Paper equation 120-125:
   * I(l, t) = false when [] = l
   * I(l, t) = x ≤ t when [x] = l
   * I(l, t) = x ≤ t < y when [x, y] = l
   * I(l, t) = x ≤ t < y ∨ z ≤ t when [x, y, z] = l
   *
   * @param requestStatus - Request status sequence (up to 3 timeslots)
   * @param timeslot - Timeslot to check availability
   * @returns True if preimage is available at the given timeslot
   */
  private checkRequestValidity(
    requestStatus: PreimageRequestStatus,
    timeslot: bigint,
  ): boolean {
    switch (requestStatus.length) {
      case 0:
        // Empty request - not available
        return false

      case 1:
        // [x] - available from x onwards
        return requestStatus[0] <= timeslot

      case 2:
        // [x, y] - available from x to y (exclusive)
        return requestStatus[0] <= timeslot && timeslot < requestStatus[1]

      case 3:
        // [x, y, z] - available from x to y OR from z onwards
        return (
          (requestStatus[0] <= timeslot && timeslot < requestStatus[1]) ||
          requestStatus[2] <= timeslot
        )

      default:
        // Invalid request format - not available
        logger.warn('Invalid request status format', {
          length: requestStatus.length,
          requestStatus: requestStatus.map((t) => t.toString()),
        })
        return false
    }
  }

  /**
   * Get current service accounts state
   *
   * Gray Paper: accounts ∈ dictionary{serviceid}{serviceaccount}
   */

  getServiceAccounts(): ServiceAccounts {
    const accounts = new Map<bigint, ServiceAccount>()

    for (const [
      serviceId,
      serviceAccount,
    ] of this.coreServiceAccounts.entries()) {
      // Deep copy rawCshKeyvals to prevent mutations
      const rawCshKeyvalsCopy: Record<Hex, Hex> = JSON.parse(
        JSON.stringify(serviceAccount.rawCshKeyvals),
      )

      const serviceAccountCopy: ServiceAccount = {
        ...serviceAccount,
        rawCshKeyvals: rawCshKeyvalsCopy,
      }

      accounts.set(serviceId, serviceAccountCopy)
    }

    return { accounts }
  }

  /**
   * Set service account
   */
  setServiceAccount(
    serviceId: bigint,
    serviceAccount: ServiceAccount,
  ): Safe<void> {
    // Clone the core properties to prevent external mutations from affecting stored state
    // This is critical because JavaScript objects are passed by reference
    // Deep copy rawCshKeyvals to prevent mutations
    const rawCshKeyvalsCopy: Record<Hex, Hex> = JSON.parse(
      JSON.stringify(serviceAccount.rawCshKeyvals),
    )

    const clonedCore: ServiceAccount = {
      codehash: serviceAccount.codehash,
      balance: serviceAccount.balance,
      minaccgas: serviceAccount.minaccgas,
      minmemogas: serviceAccount.minmemogas,
      octets: serviceAccount.octets,
      gratis: serviceAccount.gratis,
      items: serviceAccount.items,
      created: serviceAccount.created,
      lastacc: serviceAccount.lastacc,
      parent: serviceAccount.parent,
      rawCshKeyvals: rawCshKeyvalsCopy, // DEEP COPY - prevents mutations
    }

    this.coreServiceAccounts.set(serviceId, clonedCore)

    return safeResult(undefined)
  }

  setServiceAccountKeyvals(
    serviceId: bigint,
    keyvals: Record<Hex, Hex>,
  ): Safe<void> {
    let serviceAccount = this.coreServiceAccounts.get(serviceId)
    if (!serviceAccount) {
      const newServiceAccount: ServiceAccount = {
        codehash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        balance: 0n,
        minaccgas: 0n,
        minmemogas: 0n,
        octets: 0n,
        gratis: 0n,
        items: 0n,
        created: 0n,
        lastacc: 0n,
        parent: 0n,
        rawCshKeyvals: {},
      }
      // Store the newly created service account in the map
      this.coreServiceAccounts.set(serviceId, newServiceAccount)
      serviceAccount = newServiceAccount
    }

    // Merge new keyvals with existing rawCshKeyvals
    // Deep copy existing values to prevent mutations from affecting stored state
    // Then merge in new keyvals (new values overwrite existing ones for the same key)
    const newRawCshKeyvals: Record<Hex, Hex> = JSON.parse(
      JSON.stringify(serviceAccount.rawCshKeyvals),
    )
    // Merge: add new keyvals, overwriting existing ones if the same key appears
    for (const key in keyvals) {
      newRawCshKeyvals[key as Hex] = keyvals[key as Hex]
    }

    serviceAccount.rawCshKeyvals = newRawCshKeyvals

    return safeResult(undefined)
  }

  setServiceAccountCore(
    serviceId: bigint,
    serviceAccountCore: ServiceAccount,
  ): Safe<void> {
    // CRITICAL: Merge rawCshKeyvals instead of overwriting
    // If an existing account has rawCshKeyvals, preserve them and merge with new ones
    const existingAccount = this.coreServiceAccounts.get(serviceId)
    const existingRawCshKeyvalsCount = existingAccount
      ? Object.keys(existingAccount.rawCshKeyvals).length
      : 0

    if (existingAccount && existingRawCshKeyvalsCount > 0) {
      // Merge existing rawCshKeyvals with new ones (new values overwrite existing ones)
      const mergedRawCshKeyvals: Record<Hex, Hex> = JSON.parse(
        JSON.stringify(existingAccount.rawCshKeyvals),
      )
      for (const key in serviceAccountCore.rawCshKeyvals) {
        mergedRawCshKeyvals[key as Hex] =
          serviceAccountCore.rawCshKeyvals[key as Hex]
      }
      serviceAccountCore.rawCshKeyvals = mergedRawCshKeyvals
    }

    this.coreServiceAccounts.set(serviceId, serviceAccountCore)

    return safeResult(undefined)
  }

  setStorage(serviceId: bigint, key: Hex, value: Uint8Array): Safe<void> {
    const serviceAccount = this.coreServiceAccounts.get(serviceId)
    if (!serviceAccount) {
      return safeError(new Error('Service account not found'))
    }
    setServiceStorageValue(serviceAccount, serviceId, key, value)

    return safeResult(undefined)
  }

  setPreimage(
    serviceId: bigint,
    preimageHash: Hex,
    blob: Uint8Array,
  ): Safe<void> {
    const serviceAccount = this.coreServiceAccounts.get(serviceId)
    if (!serviceAccount) {
      return safeError(new Error('Service account not found'))
    }
    setServicePreimageValue(serviceAccount, serviceId, preimageHash, blob)
    return safeResult(undefined)
  }

  /**
   * Get service account storage
   */
  getServiceAccountStorage(
    serviceId: bigint,
    key: Hex,
  ): Uint8Array | undefined {
    const serviceAccount = this.coreServiceAccounts.get(serviceId)
    if (!serviceAccount) {
      return undefined
    }
    return getServiceStorageValue(serviceAccount, serviceId, key)
  }

  setServiceAccountStorage(
    serviceId: bigint,
    key: Hex,
    value: Uint8Array,
  ): Safe<void> {
    const serviceAccount = this.coreServiceAccounts.get(serviceId)
    if (!serviceAccount) {
      return safeError(new Error('Service account not found'))
    }
    setServiceStorageValue(serviceAccount, serviceId, key, value)
    return safeResult(undefined)
  }

  /**
   * Get service account by ID
   *
   * Gray Paper: accounts ∈ dictionary{serviceid}{serviceaccount}
   */
  getServiceAccount(serviceId: bigint): Safe<ServiceAccount> {
    const accountCore = this.coreServiceAccounts.get(serviceId)
    if (!accountCore) {
      return safeError(new Error('Service account not found'))
    }
    return safeResult(accountCore)
  }

  getServiceAccountCore(serviceId: bigint): Safe<ServiceAccount> {
    const accountCore = this.coreServiceAccounts.get(serviceId)
    if (!accountCore) {
      return safeError(new Error('Service account not found'))
    }
    return safeResult(accountCore)
  }

  getServiceAccountKeyvals(serviceId: bigint): Record<Hex, Hex> {
    const accountCore = this.coreServiceAccounts.get(serviceId)
    if (!accountCore) {
      return {}
    }
    // Deep clone rawCshKeyvals to prevent mutations from affecting stored state
    const rawCshKeyvalsCopy: Record<Hex, Hex> = JSON.parse(
      JSON.stringify(accountCore.rawCshKeyvals),
    )
    return rawCshKeyvalsCopy
  }

  getServiceAccountRequest(
    serviceId: bigint,
    hash: Hex,
    blobLength: bigint,
  ): PreimageRequestStatus | undefined {
    const serviceAccount = this.coreServiceAccounts.get(serviceId)
    if (!serviceAccount) {
      return undefined
    }
    return getServiceRequestValue(serviceAccount, serviceId, hash, blobLength)
  }

  setServiceAccountRequest(
    serviceId: bigint,
    hash: Hex,
    blobLength: bigint,
    timeslots: bigint[],
  ): Safe<void> {
    const serviceAccount = this.coreServiceAccounts.get(serviceId)
    if (!serviceAccount) {
      return safeError(new Error('Service account not found'))
    }
    setServiceRequestValue(
      serviceAccount,
      serviceId,
      hash,
      blobLength,
      timeslots,
    )
    return safeResult(undefined)
  }

  /**
   * Delete service account
   */
  deleteServiceAccount(serviceId: bigint): Safe<void> {
    this.coreServiceAccounts.delete(serviceId)
    return safeResult(undefined)
  }

  /**
   * Clear keyvals and mark account as ejected (do not delete).
   * Gray Paper: Ejected services retain a chapter 255 entry; storage/preimages/requests are removed.
   * Mutates existing account in place. Errors if account does not exist.
   */
  clearKeyvalsAndMarkEjected(serviceId: bigint): Safe<void> {
    const existing = this.coreServiceAccounts.get(serviceId)
    if (!existing) {
      return safeError(
        new Error(
          `Service account ${serviceId} not found; cannot clear keyvals and mark ejected`,
        ),
      )
    }
    existing.rawCshKeyvals = {}
    existing.codehash = zeroHash
    existing.minaccgas = 0n
    existing.minmemogas = 0n
    existing.gratis = 0n
    this.coreServiceAccounts.set(serviceId, existing)
    return safeResult(undefined)
  }

  /**
   * Clear all service accounts
   *
   * Used when switching between forks or resetting state for tests.
   * According to Gray Paper, when switching to a different fork,
   * the entire state must be reset, not merged.
   */
  clearAllServiceAccounts(): void {
    this.coreServiceAccounts.clear()
  }

  /**
   * Get storage value for service
   *
   * Gray Paper: sa_storage ∈ dictionary{blob}{blob}
   */
  getStorageValue(serviceId: bigint, key: Hex): Uint8Array | undefined {
    const serviceAccount = this.coreServiceAccounts.get(serviceId)
    if (!serviceAccount) {
      return undefined
    }
    const storage = getServiceStorageValue(serviceAccount, serviceId, key)
    return storage
  }

  /**
   * Delete storage value for service
   */
  deleteStorageValue(serviceId: bigint, key: Hex): void {
    const serviceAccount = this.coreServiceAccounts.get(serviceId)
    if (!serviceAccount) {
      return
    }
    const storageKey = getServiceStorageKey(serviceId, key)

    delete serviceAccount.rawCshKeyvals[storageKey]
  }

  /**
   * List all service IDs
   */
  listServiceIds(): bigint[] {
    return Array.from(this.coreServiceAccounts.keys())
  }

  /**
   * Get preimage request status for a given service, hash, and length
   *
   * Gray Paper: sa_requests[(hash, length)] -> sequence[:3]{timeslot}
   * Returns the timeslot array indicating request status:
   * - [] = requested but not yet supplied
   * - [t0] = available since timeslot t0
   * - [t0, t1] = was available from t0 until t1 (now unavailable)
   * - [t0, t1, t2] = was available t0-t1, now available again since t2
   *
   * @param serviceId - Service account ID
   * @param hash - Preimage hash
   * @param length - Expected preimage length
   * @returns Request status (array of timeslots) or undefined if not found
   */
  getPreimageRequestStatus(
    serviceId: bigint,
    hash: Hex,
    length: bigint,
  ): bigint[] | undefined {
    const serviceAccount = this.coreServiceAccounts.get(serviceId)
    if (!serviceAccount) {
      return undefined
    }
    return getServiceRequestValue(serviceAccount, serviceId, hash, length)
  }

  /**
   * Get pending preimages that have been received but not yet applied to service account through accumulation
   *
   * @returns Array of pending preimages
   */
  getPendingPreimages(): Preimage[] {
    return Array.from(this.pendingPreimages.values())
  }

  /**
   * Remove preimage from pending state when it's been applied to service account through accumulation
   *
   * @param preimage - The preimage that was applied
   */
  removePendingPreimage(preimage: Preimage): void {
    const [hashError, preimageHash] = blake2bHash(hexToBytes(preimage.blob))
    if (!hashError && preimageHash) {
      const key = `${preimage.requester}:${preimageHash}:${BigInt(hexToBytes(preimage.blob).length)}`
      this.pendingPreimages.delete(key)
    }
  }

  /**
   * Get pending preimages that are requested on-chain but not yet in state
   *
   * Returns pending preimages that:
   * - Have been received (are in pending preimages)
   * - Are requested on-chain (have a request status)
   * - Are available at the given slot (using Gray Paper function I(l, t))
   *
   * @param slot - Current slot to check availability
   * @returns Array of pending preimages that are requested and available
   */
  getRequestedPendingPreimages(slot: bigint): Preimage[] {
    const requestedPending: Preimage[] = []

    for (const preimage of this.pendingPreimages.values()) {
      const blobLength = BigInt(hexToBytes(preimage.blob).length)

      // Calculate hash from blob to check request status
      const [hashError, preimageHash] = blake2bHash(hexToBytes(preimage.blob))
      if (hashError) {
        continue
      }

      // Check if this preimage is requested on-chain
      const requestStatus = this.getPreimageRequestStatus(
        preimage.requester,
        preimageHash,
        blobLength,
      )

      // A preimage is ready if it exists and has a request status with entries
      if (requestStatus !== undefined && requestStatus.length > 0) {
        // Check if preimage is available at this slot using Gray Paper function I(l, t)
        const isAvailable = checkPreimageAvailability(requestStatus, slot)
        if (isAvailable) {
          requestedPending.push(preimage)
        }
      }
    }

    return requestedPending
  }
}
