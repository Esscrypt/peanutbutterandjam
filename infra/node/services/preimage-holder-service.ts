/**
 * Preimage Holder Service
 *
 * Manages preimage storage and retrieval according to Gray Paper specifications
 * Handles mapping from hash to preimage data and announcement tracking
 */

import {
  blake2bHash,
  type EventBusService,
  type Hex,
  hexToBytes,
  logger,
  type Safe,
  type SafePromise,
  type SlotChangeEvent,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { PreimageRequestProtocol } from '@pbnj/networking'
import { encodePreimage } from '@pbnj/serialization'
import type { PreimageStore } from '@pbnj/state'
import {
  BaseService,
  type IPreimageHolderService,
  type Preimage,
  type PreimageAnnouncement,
  type PreimageRequest,
  type PreimageRequestStatus,
} from '@pbnj/types'
import type { ClockService } from './clock-service'
import type { ConfigService } from './config-service'
import type { NetworkingService } from './networking-service'

/**
 * Preimage Holder Service
 *
 * Manages preimage storage according to Gray Paper specifications:
 * - Stores preimages with hash-to-data mapping
 * - Tracks preimage announcements
 * - Handles preimage requests and availability
 * - Manages preimage expiration (Cexpungeperiod = 19,200 timeslots)
 */
export class PreimageHolderService
  extends BaseService
  implements IPreimageHolderService
{
  /** Map from preimage hash to preimage data */
  private readonly preimageCache: Map<Hex, Preimage> = new Map()

  /** Map from preimage hash to announcement metadata */
  private readonly preimageToRequest: Map<Hex, PreimageAnnouncement> = new Map()

  // used to determine if a preimage is available as of a timeslot or not
  private readonly preimageRequests: Map<Hex, PreimageRequestStatus> = new Map()

  private readonly preimageStore: PreimageStore
  private readonly configService: ConfigService
  private readonly eventBusService: EventBusService
  private readonly clockService: ClockService
  private readonly networkingService: NetworkingService
  private readonly preimageRequestProtocol: PreimageRequestProtocol

  constructor(options: {
    preimageStore: PreimageStore
    configService: ConfigService
    eventBusService: EventBusService
    clockService: ClockService
    networkingService: NetworkingService
    preimageRequestProtocol: PreimageRequestProtocol
  }) {
    super('preimage-holder-service')
    this.networkingService = options.networkingService
    this.preimageStore = options.preimageStore
    this.configService = options.configService
    this.eventBusService = options.eventBusService
    this.clockService = options.clockService
    this.preimageRequestProtocol = options.preimageRequestProtocol

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

  stop(): Safe<boolean> {
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

  async handlePreimageRequested(
    request: PreimageRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    const [error2, preimage] = await this.getPreimage(request.hash)
    if (error2) {
      return safeError(error2)
    }
    if (!preimage) {
      return safeError(new Error('Preimage not found'))
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

  handlePreimageReceived(preimage: Preimage, peerPublicKey: Hex): void {
    this.storePreimage(preimage, this.clockService.getCurrentSlot())
  }

  handlePreimageAnnouncement(
    announcement: PreimageAnnouncement,
    peerPublicKey: Hex,
  ): Safe<void> {
    // Announcement of possession of a requested preimage. This should be used by non-validator nodes to introduce preimages, and by validators to gossip these preimages to other validators.
    // The recipient of the announcement is expected to follow up by requesting the preimage using protocol 143, provided the preimage has been requested on chain by the given service and the recipient is not already in possession of it. In the case where the sender of the announcement is a non-validator node, it is expected to keep the connection open for a reasonable time (eg 10 seconds) to allow this request to be made; if the connection is closed before the request can be made, the recipient is not expected to reopen it.
    // Once a validator has obtained a requested preimage, it should announce possession to its neighbours in the grid structure.
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
  async storePreimage(
    preimage: Preimage,
    creationSlot: bigint,
  ): SafePromise<Hex> {
    const [encodeError, encodedPreimage] = encodePreimage(preimage)
    if (encodeError) {
      return safeError(encodeError)
    }

    const [hashError, hash] = blake2bHash(encodedPreimage)
    if (hashError) {
      return safeError(hashError)
    }

    // Store the preimage
    this.preimageCache.set(hash, preimage)

    const [error, _result] = await this.preimageStore.storePreimage(
      encodedPreimage,
      preimage.requester,
      hash,
      creationSlot,
    )
    if (error) {
      return safeError(error)
    }

    return safeResult(hash)
  }

  /**
   * Get preimage data by hash
   *
   * @param hash - The preimage hash to retrieve
   * @returns Preimage entry or null if not found
   */
  async getPreimage(hash: Hex): SafePromise<Preimage | null> {
    const entry = this.preimageCache.get(hash)
    if (entry) {
      return safeResult(entry)
    }
    const [error, result] = await this.preimageStore.getPreimage(hash)
    if (error) {
      return safeError(error)
    }
    if (result) {
      return safeResult({
        requester: result.serviceIndex,
        blob: result.data,
      })
    }
    return safeResult(null)
  }

  storePreimageToRequest(announcement: PreimageAnnouncement): void {
    this.preimageToRequest.set(announcement.hash, announcement)
  }

  getPreimagesToRequest(): Hex[] {
    return Array.from(this.preimageToRequest.keys())
  }

  clearPreimageToRequest(hash: Hex): void {
    this.preimageToRequest.delete(hash)
  }

  /**
   * Remove preimage (mark as unavailable)
   *
   * @param hash - The preimage hash to remove
   * @returns True if preimage was removed
   */
  async removePreimage(hash: Hex): SafePromise<boolean> {
    const entry = this.preimageCache.get(hash)
    if (!entry) {
      return safeResult(false)
    }
    const [error, result] = await this.preimageStore.deletePreimage(hash)
    if (error) {
      return safeError(error)
    }
    if (result) {
      this.preimageCache.delete(hash)
      return safeResult(true)
    }
    return safeResult(false)
  }

  /**
   * Clean up expired preimages
   *
   * @param currentTimeslot - Current timeslot for expiration calculation
   * @returns Number of preimages cleaned up
   */
  async handleSlotChanged(slotChangeEvent: SlotChangeEvent): SafePromise<void> {
    const CEXPUNGE_PERIOD = BigInt(this.configService.preimageExpungePeriod) // Gray Paper constant

    const [error, result] = await this.preimageStore.getAllPreimages()
    if (error) {
      return safeError(error)
    }
    if (!result) {
      return safeError(new Error('No preimages found'))
    }

    for (const entry of result) {
      // Calculate expiration timeslot

      const expirationSlot = entry.creationSlot + CEXPUNGE_PERIOD

      if (slotChangeEvent.slot > expirationSlot) {
        await this.removePreimage(entry.hash)
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
   * @param timeslot - Timeslot for historical lookup
   * @param hash - Hash to lookup
   * @returns Preimage blob or null if not found/not available
   */
  async histlookup(
    timeslot: bigint,
    hash: Hex,
  ): SafePromise<Uint8Array | null> {
    // first check validity based on the timeslot:
    // Get the request map for this hash
    const requestStatus = this.preimageRequests.get(hash)
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

    // Check if preimage exists in service account
    const [preimageError, preimage] = await this.getPreimage(hash)
    if (preimageError) {
      return safeError(preimageError)
    }
    if (!preimage) {
      logger.debug('Preimage not found', { hash })
      return safeResult(null)
    }

    logger.debug('Historical lookup successful', {
      hash,
      timeslot: timeslot.toString(),
      preimageLength: preimage.blob.length,
    })

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
}
