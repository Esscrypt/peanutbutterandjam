/**
 * Preimage Holder Service
 *
 * Manages preimage storage and retrieval according to Gray Paper specifications
 * Handles mapping from hash to preimage data and announcement tracking
 */

import {
  blake2bHash,
  bytesToHex,
  type EventBusService,
  type Hex,
  hexToBytes,
  logger,
  type SlotChangeEvent,
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
  type ServiceAccountCore,
  type ServiceAccounts,
  safeError,
  safeResult,
} from '@pbnjam/types'
import type { ClockService } from './clock-service'
import type { ConfigService } from './config-service'
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
  private readonly preimageCache: Map<Hex, Preimage> = new Map()

  private readonly serviceStorage: Map<bigint, Map<Hex, Uint8Array>>
  private readonly coreServiceAccounts: Map<bigint, ServiceAccountCore>
  // per-service preimages mapping to avoid cross-service overwrite
  private readonly servicePreimages: Map<bigint, Map<Hex, Uint8Array>> =
    new Map()

  // used to determine if a preimage is available as of a timeslot or not
  // serviceId -> preimage hash -> blob length -> request status
  private readonly serviceRequests: Map<
    bigint,
    Map<Hex, Map<bigint, PreimageRequestStatus>>
  > = new Map()

  private readonly configService: ConfigService
  private readonly eventBusService: EventBusService
  private readonly clockService: ClockService
  private readonly networkingService: NetworkingService | null
  private readonly preimageRequestProtocol: PreimageRequestProtocol | null

  constructor(options: {
    configService: ConfigService
    eventBusService: EventBusService
    clockService: ClockService
    networkingService: NetworkingService | null
    preimageRequestProtocol: PreimageRequestProtocol | null
  }) {
    super('preimage-holder-service')
    this.networkingService = options.networkingService
    this.configService = options.configService
    this.eventBusService = options.eventBusService
    this.clockService = options.clockService
    this.preimageRequestProtocol = options.preimageRequestProtocol

    this.serviceStorage = new Map<bigint, Map<Hex, Uint8Array>>()
    this.coreServiceAccounts = new Map<bigint, ServiceAccountCore>()

    this.eventBusService.addPreimageAnnouncementCallback(
      this.handlePreimageAnnouncement.bind(this),
    )
    this.eventBusService.addPreimageRequestedCallback(
      this.handlePreimageRequested.bind(this),
    )
    this.eventBusService.addPreimageReceivedCallback(
      this.handlePreimageReceived.bind(this),
    )
    this.eventBusService.addSlotChangeCallback(
      this.handleSlotChanged.bind(this),
    )
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
    this.eventBusService.removeSlotChangeCallback(
      this.handleSlotChanged.bind(this),
    )

    return safeResult(true)
  }

  getPreimageCreationSlot(
    serviceId: bigint,
    hash: Hex,
    blobLength: bigint,
  ): Safe<bigint | null> {
    const requestStatus = this.serviceRequests
      .get(serviceId)
      ?.get(hash)
      ?.get(blobLength)
    if (!requestStatus) {
      return safeResult(null)
    }
    if (requestStatus.length === 3) {
      return safeResult(requestStatus[2])
    }
    return safeResult(requestStatus[0])
  }

  async handlePreimageRequested(
    request: PreimageRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    const [error2, preimage] = this.getPreimage(request.hash)
    if (error2) {
      return safeError(error2)
    }
    if (!preimage) {
      return safeError(new Error('Preimage not found'))
    }

    if (!this.preimageRequestProtocol) {
      return safeError(new Error('Preimage request protocol not found'))
    }

    if (!this.networkingService) {
      return safeError(new Error('Networking service not found'))
    }

    const [serializeError, serializedPreimageMessage] =
      this.preimageRequestProtocol.serializeResponse(preimage)
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
    this.storePreimage(preimage, this.clockService.getCurrentSlot())
  }

  handlePreimageAnnouncement(
    announcement: PreimageAnnouncement,
    peerPublicKey: Hex,
  ): Safe<void> {
    // Announcement of possession of a requested preimage. This should be used by non-validator nodes to introduce preimages, and by validators to gossip these preimages to other validators.
    // The recipient of the announcement is expected to follow up by requesting the preimage using protocol 143, provided the preimage has been requested on chain by the given service and the recipient is not already in possession of it. In the case where the sender of the announcement is a non-validator node, it is expected to keep the connection open for a reasonable time (eg 10 seconds) to allow this request to be made; if the connection is closed before the request can be made, the recipient is not expected to reopen it.
    // Once a validator has obtained a requested preimage, it should announce possession to its neighbours in the grid structure.
    if (!this.preimageRequestProtocol) {
      return safeError(new Error('Preimage request protocol not found'))
    }

    if (!this.networkingService) {
      return safeError(new Error('Networking service not found'))
    }

    const [error, preimageRequestMessage] =
      this.preimageRequestProtocol.serializeRequest({ hash: announcement.hash })
    if (error) {
      return safeError(error)
    }
    this.networkingService.sendMessageByPublicKey(
      peerPublicKey,
      143,
      preimageRequestMessage,
    )
    return safeResult(undefined)
  }

  /**
   * Store actual preimage data
   *
   * @param preimage - The preimage data to store
   * @returns Safe result indicating success
   */
  storePreimage(preimage: Preimage, creationSlot: bigint): Safe<Hex> {
    // Validate first (no state changes on failure)
    const [validationError] = this.validatePreimageRequest(preimage)
    if (validationError) {
      return safeError(validationError)
    }

    // Gray Paper: preimage hash is computed over the blob only
    const blobBytes = hexToBytes(preimage.blob)
    const [hashError, hash] = blake2bHash(blobBytes)
    if (hashError) {
      return safeError(hashError)
    }

    const blobLength = BigInt(blobBytes.length)
    const serviceBucket = this.serviceRequests.get(preimage.requester)!

    // Store the preimage
    this.preimageCache.set(hash, preimage)
    const perServiceBucket =
      this.servicePreimages.get(preimage.requester) ??
      new Map<Hex, Uint8Array>()
    perServiceBucket.set(hash, blobBytes)
    this.servicePreimages.set(preimage.requester, perServiceBucket)

    // fill/update the preimage request status for this service
    const hashToBlobLength = serviceBucket!.get(hash)!
    const requestStatus = hashToBlobLength.get(blobLength)
    if (requestStatus) {
      requestStatus.push(creationSlot)
    } else {
      hashToBlobLength.set(blobLength, [creationSlot])
    }

    return safeResult(hash)
  }

  /**
   * Validate a preimage against current state without mutating it
   */
  private validatePreimageRequest(preimage: Preimage): Safe<void> {
    // Compute hash over blob only
    const [hashError, hash] = blake2bHash(hexToBytes(preimage.blob))
    if (hashError) {
      return safeError(hashError)
    }

    // Already present for this service -> unneeded
    const existing = this.preimageCache.get(hash)
    if (existing && existing.requester === preimage.requester) {
      return safeError(new Error('preimage_unneeded'))
    }

    // Must be requested for this service and exact byte length
    const blobLength = BigInt(hexToBytes(preimage.blob).length)
    const serviceBucket = this.serviceRequests.get(preimage.requester)
    const lengthMap = serviceBucket?.get(hash)
    if (!lengthMap || !lengthMap.has(blobLength)) {
      return safeError(new Error('preimage_unneeded'))
    }

    return safeResult(undefined)
  }

  /**
   * Apply a batch of preimages for a given slot with ordering/uniqueness validation
   * Returns error 'preimages_not_sorted_unique' when inputs violate sorting/uniqueness
   */
  applyPreimages(preimages: Preimage[], creationSlot: bigint): Safe<void> {
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
      const [validationError] = this.validatePreimageRequest(p)
      if (validationError) {
        return safeError(validationError)
      }
    }

    // Apply each preimage
    for (const p of preimages) {
      const [err] = this.storePreimage(p, creationSlot)
      if (err) return safeError(err)
    }
    return safeResult(undefined)
  }

  /**
   * Get preimage data by hash
   *
   * @param hash - The preimage hash to retrieve
   * @returns Preimage entry or null if not found
   */
  getPreimage(hash: Hex): Safe<Preimage | null> {
    const entry = this.preimageCache.get(hash)
    if (entry) {
      return safeResult(entry)
    }
    return safeResult(null)
  }

  getPreimageByServiceId(serviceId: bigint) {
    return Array.from(this.preimageCache.values()).filter(
      (preimage) => preimage.requester === serviceId,
    )
  }

  /**
   * Remove preimage (mark as unavailable)
   *
   * @param hash - The preimage hash to remove
   * @returns True if preimage was removed
   */
  async removePreimage(hash: Hex): SafePromise<boolean> {
    this.preimageCache.delete(hash)
    return safeResult(true)
  }

  /**
   * Clean up expired preimages
   *
   * @param currentTimeslot - Current timeslot for expiration calculation
   * @returns Number of preimages cleaned up
   */
  async handleSlotChanged(slotChangeEvent: SlotChangeEvent): SafePromise<void> {
    const CEXPUNGE_PERIOD = BigInt(this.configService.preimageExpungePeriod) // Gray Paper constant

    // update all requests (per service)
    for (const [_, hashMap] of this.serviceRequests.entries()) {
      for (const [hash, lengthMap] of hashMap.entries()) {
        for (const [_blobLength, requestStatus] of lengthMap.entries()) {
          const lastChangeSlot = requestStatus[requestStatus.length - 1]
          if (slotChangeEvent.slot > lastChangeSlot - CEXPUNGE_PERIOD) {
            requestStatus.push(slotChangeEvent.slot) // just became unavailable
            this.preimageCache.delete(hash)
          }
        }
      }
    }

    return safeResult(undefined)
  }

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
    serviceAccount: ServiceAccount,
    hash: Hex,
    timeslot: bigint,
  ): Safe<Uint8Array | null> {
    // check that hash belongs to known preimage
    // first check validity based on the timeslot:

    // Get the request map for this hash
    const preimage = serviceAccount.preimages.get(hash)
    if (!preimage) {
      logger.debug('Hash does not belong to a preimage', { hash })
      return safeResult(null)
    }

    const length = preimage.length

    const lengthMap = serviceAccount.requests.get(hash)
    if (!lengthMap) {
      logger.debug('No request map found for hash', { hash })
      return safeResult(null)
    }
    const requestStatus = lengthMap.get(BigInt(length))
    if (!requestStatus) {
      logger.debug('No request status found for length', { length })
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
   * Gray Paper histlookup by service id
   * Looks up availability using internal per-service requests map
   */
  histLookupForService(
    serviceId: bigint,
    hash: Hex,
    timeslot: bigint,
  ): Safe<Uint8Array | null> {
    // resolve preimage bytes for this service
    const preimage = this.preimageCache.get(hash)
    if (!preimage || preimage.requester !== serviceId) {
      logger.debug('Hash does not belong to a preimage for service', {
        hash,
        serviceId: serviceId.toString(),
      })
      return safeResult(null)
    }

    const length = BigInt(hexToBytes(preimage.blob).length)
    const lengthMap = this.serviceRequests.get(serviceId)?.get(hash)
    if (!lengthMap) {
      logger.debug('No request map found for hash', { hash })
      return safeResult(null)
    }
    const requestStatus = lengthMap.get(length)
    if (!requestStatus) {
      logger.debug('No request status found for length', {
        length: length.toString(),
      })
      return safeResult(null)
    }

    const isValid = this.checkRequestValidity(requestStatus, timeslot)
    if (!isValid) {
      logger.debug('Preimage not available at requested timeslot', {
        hash,
        timeslot: timeslot.toString(),
        requestStatus: requestStatus.map((t) => t.toString()),
      })
      return safeResult(null)
    }

    return safeResult(hexToBytes(preimage.blob))
  }

  histLookup(hash: Hex, timeslot: bigint): Safe<Uint8Array | null> {
    // Get the request map for this hash
    const preimage = this.preimageCache.get(hash)
    if (!preimage) {
      logger.debug('Hash does not belong to a preimage', { hash })
      return safeResult(null)
    }

    const length = hexToBytes(preimage.blob).length

    const lengthMap = this.serviceRequests.get(preimage.requester)?.get(hash)
    if (!lengthMap) {
      logger.debug('No request map found for hash', { hash })
      return safeResult(null)
    }
    const requestStatus = lengthMap.get(BigInt(length))
    if (!requestStatus) {
      logger.debug('No request status found for length', { length })
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

    return safeResult(hexToBytes(preimage.blob))
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

    // Iterate through all core service accounts
    for (const [serviceId, accountCore] of this.coreServiceAccounts.entries()) {
      const storage =
        this.serviceStorage.get(serviceId) ?? new Map<Hex, Uint8Array>()

      // Get preimages for this service (empty map for now - needs database queries)
      const preimages =
        this.servicePreimages.get(serviceId) ?? new Map<Hex, Uint8Array>()

      // Get requests for this service directly from per-service map
      const requests = new Map<Hex, Map<bigint, PreimageRequestStatus>>()
      const bucket = this.serviceRequests.get(serviceId)
      if (bucket) {
        for (const [hash, byLen] of bucket.entries()) {
          requests.set(hash, byLen)
        }
      }

      const serviceAccount: ServiceAccount = {
        ...accountCore,
        storage,
        preimages,
        requests,
      }

      accounts.set(serviceId, serviceAccount)
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
    const clonedCore: ServiceAccountCore = {
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
    }
    this.coreServiceAccounts.set(serviceId, clonedCore)
    this.serviceStorage.set(serviceId, serviceAccount.storage)

    // REPLACE preimages bucket with the complete state from PVM
    // Note: The PVM returns the complete service account for modified accounts.
    // Preimages not in the partial state were not in the accumulation context,
    // but the poststate.accounts should include all preimages for the service.
    const preimageBucket = new Map<Hex, Uint8Array>()
    for (const [hash, preimage] of serviceAccount.preimages.entries()) {
      preimageBucket.set(hash, preimage)
      this.preimageCache.set(hash, {
        requester: serviceId,
        blob: bytesToHex(preimage),
      })
    }
    this.servicePreimages.set(serviceId, preimageBucket)

    // REPLACE requests bucket with the complete state from PVM
    const bucket = new Map<Hex, Map<bigint, PreimageRequestStatus>>()
    for (const [
      hash,
      requestStatusByLen,
    ] of serviceAccount.requests.entries()) {
      bucket.set(hash, requestStatusByLen)
    }
    this.serviceRequests.set(serviceId, bucket)

    return safeResult(undefined)
  }

  setServiceAccountCore(
    serviceId: bigint,
    serviceAccountCore: ServiceAccountCore,
  ): Safe<void> {
    this.coreServiceAccounts.set(serviceId, serviceAccountCore)
    this.serviceStorage.set(serviceId, new Map<Hex, Uint8Array>())
    this.servicePreimages.set(serviceId, new Map<Hex, Uint8Array>())
    this.serviceRequests.set(
      serviceId,
      new Map<Hex, Map<bigint, PreimageRequestStatus>>(),
    )
    return safeResult(undefined)
  }

  setStorage(serviceId: bigint, key: Hex, value: Uint8Array): Safe<void> {
    const storage = this.serviceStorage.get(serviceId)
    if (!storage) {
      return safeError(new Error('Storage not found'))
    }
    storage.set(key, value)
    return safeResult(undefined)
  }

  setPreimage(
    serviceId: bigint,
    preimageHash: Hex,
    blob: Uint8Array,
  ): Safe<void> {
    const preimage = this.servicePreimages.get(serviceId)
    if (!preimage) {
      return safeError(new Error('Preimage not found'))
    }
    preimage.set(preimageHash, blob)
    return safeResult(undefined)
  }

  setPreimageRequest(
    serviceId: bigint,
    preimageHash: Hex,
    timeslots: bigint[],
  ): Safe<void> {
    // Ensure preimages map exists
    if (!this.servicePreimages.has(serviceId)) {
      this.servicePreimages.set(serviceId, new Map<Hex, Uint8Array>())
    }
    // Ensure requests map exists
    if (!this.serviceRequests.has(serviceId)) {
      this.serviceRequests.set(
        serviceId,
        new Map<Hex, Map<bigint, PreimageRequestStatus>>(),
      )
    }

    // get blob length from preimage hash
    const preimage = this.servicePreimages.get(serviceId)?.get(preimageHash)
    if (!preimage) {
      // If preimage doesn't exist, we can't determine the blob length
      // This is a limitation when decoding from test vectors
      // For now, use 0 as a placeholder length
      const blobLength = 0n
      const requestMap = this.serviceRequests.get(serviceId)!
      if (!requestMap.has(preimageHash)) {
        requestMap.set(preimageHash, new Map<bigint, PreimageRequestStatus>())
      }
      const request = requestMap.get(preimageHash)!
      request.set(blobLength, timeslots)
      return safeResult(undefined)
    }
    const blobLength = BigInt(preimage.length)
    const requestMap = this.serviceRequests.get(serviceId)!
    if (!requestMap.has(preimageHash)) {
      requestMap.set(preimageHash, new Map<bigint, PreimageRequestStatus>())
    }
    const request = requestMap.get(preimageHash)!
    request.set(blobLength, timeslots)
    return safeResult(undefined)
  }
  /**
   * Update service account
   */
  updateServiceAccount(
    serviceId: bigint,
    serviceAccount: ServiceAccount,
  ): Safe<void> {
    return this.setServiceAccount(serviceId, serviceAccount)
  }

  /**
   * Get service account storage
   */
  getServiceAccountStorage(serviceId: bigint): Safe<Map<Hex, Uint8Array>> {
    const storage = this.serviceStorage.get(serviceId)
    if (!storage) {
      return safeError(new Error('Storage not found'))
    }
    return safeResult(storage)
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
    const storage =
      this.serviceStorage.get(serviceId) ?? new Map<Hex, Uint8Array>()
    const preimages =
      this.servicePreimages.get(serviceId) ?? new Map<Hex, Uint8Array>()
    const requests = new Map<Hex, Map<bigint, PreimageRequestStatus>>()
    const bucket = this.serviceRequests.get(serviceId)
    if (bucket) {
      for (const [hash, byLen] of bucket.entries()) {
        requests.set(hash, byLen)
      }
    }
    return safeResult({ ...accountCore, storage, preimages, requests })
  }

  getServiceAccountCore(serviceId: bigint): Safe<ServiceAccountCore> {
    const accountCore = this.coreServiceAccounts.get(serviceId)
    if (!accountCore) {
      return safeError(new Error('Service account not found'))
    }
    return safeResult(accountCore)
  }

  /**
   * Create new service account
   *
   * Gray Paper: accounts ∈ dictionary{serviceid}{serviceaccount}
   */
  createServiceAccount(
    serviceId: bigint,
    accountCore: ServiceAccountCore,
  ): void {
    this.coreServiceAccounts.set(serviceId, accountCore)
    this.serviceStorage.set(serviceId, new Map<Hex, Uint8Array>())
    // Initialize preimages and requests maps if they don't exist
    if (!this.servicePreimages.has(serviceId)) {
      this.servicePreimages.set(serviceId, new Map<Hex, Uint8Array>())
    }
    if (!this.serviceRequests.has(serviceId)) {
      this.serviceRequests.set(
        serviceId,
        new Map<Hex, Map<bigint, PreimageRequestStatus>>(),
      )
    }
  }

  /**
   * Delete service account
   */
  deleteServiceAccount(serviceId: bigint): Safe<void> {
    this.coreServiceAccounts.delete(serviceId)
    this.serviceStorage.delete(serviceId)
    return safeResult(undefined)
  }

  /**
   * Update service account core fields
   *
   * Gray Paper: accounts ∈ dictionary{serviceid}{serviceaccount}
   */
  updateServiceAccountCore(
    serviceId: bigint,
    accountCore: ServiceAccountCore,
  ): void {
    const existingAccount = this.coreServiceAccounts.get(serviceId)
    if (existingAccount) {
      this.coreServiceAccounts.set(serviceId, accountCore)
    }
  }

  /**
   * Get storage value for service
   *
   * Gray Paper: sa_storage ∈ dictionary{blob}{blob}
   */
  getStorageValue(serviceId: bigint, key: Hex): Uint8Array | undefined {
    const storage = this.serviceStorage.get(serviceId)
    if (!storage) {
      return undefined
    }
    return storage.get(key)
  }

  /**
   * Set storage value for service
   *
   * Gray Paper: sa_storage ∈ dictionary{blob}{blob}
   */
  setStorageValue(serviceId: bigint, key: Hex, value: Uint8Array): void {
    const storage = this.serviceStorage.get(serviceId)
    if (!storage) {
      return
    }
    storage.set(key, value)
  }

  /**
   * Delete storage value for service
   */
  deleteStorageValue(serviceId: bigint, key: Hex): void {
    const storage = this.serviceStorage.get(serviceId)
    if (!storage) {
      return
    }
    storage.delete(key)
  }

  /**
   * Get all storage keys for service
   */
  getStorageKeys(serviceId: bigint): Hex[] {
    const storage = this.serviceStorage.get(serviceId)
    if (!storage) {
      return []
    }
    return storage.keys().toArray()
  }

  /**
   * Get balance for service
   *
   * Gray Paper: sa_balance ∈ balance
   */
  getBalance(serviceId: bigint): bigint | undefined {
    const accountCore = this.coreServiceAccounts.get(serviceId)
    return accountCore?.balance
  }

  /**
   * Set balance for service
   *
   * Gray Paper: sa_balance ∈ balance
   */
  setBalance(serviceId: bigint, balance: bigint): void {
    const accountCore = this.coreServiceAccounts.get(serviceId)
    if (accountCore) {
      accountCore.balance = balance
    }
  }

  /**
   * Transfer balance between services
   */
  transferBalance(
    fromServiceId: bigint,
    toServiceId: bigint,
    amount: bigint,
  ): boolean {
    const fromAccount = this.coreServiceAccounts.get(fromServiceId)
    const toAccount = this.coreServiceAccounts.get(toServiceId)

    if (!fromAccount || !toAccount) {
      return false
    }

    if (fromAccount.balance < amount) {
      return false
    }

    fromAccount.balance -= amount
    toAccount.balance += amount

    return true
  }
}
