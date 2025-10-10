/**
 * Preimage Holder Service
 *
 * Manages preimage storage and retrieval according to Gray Paper specifications
 * Handles mapping from hash to preimage data and announcement tracking
 */

import {
  blake2bHash,
  type Hex,
  logger,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/core'
import { encodePreimage } from '@pbnj/serialization'
import type { PreimageStore } from '@pbnj/state'
import {
  BaseService,
  type IPreimageHolderService,
  type Preimage,
  type PreimageAnnouncement,
} from '@pbnj/types'
import type { ConfigService } from './config-service'

/**
 * Preimage storage entry with metadata
 */
export interface PreimageEntry {
  /** The actual preimage data */
  preimage: Preimage
  /** When this preimage was announced */
  announcedAt: bigint
  /** When this preimage was stored */
  storedAt: bigint
  /** Whether this preimage is available for requests */
  isAvailable: boolean
  /** Service that announced this preimage */
  announcingServiceId: bigint
}

/**
 * Preimage announcement tracking
 */
export interface PreimageAnnouncementEntry {
  /** Service ID that announced */
  serviceId: bigint
  /** Preimage hash */
  hash: Hex
  /** Expected preimage length */
  preimageLength: bigint
  /** When announcement was received */
  timestamp: bigint
  /** Whether the actual preimage has been received */
  preimageReceived: boolean
}

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

  private readonly preimageStore: PreimageStore
  private readonly configService: ConfigService
  constructor(preimageStore: PreimageStore, configService: ConfigService) {
    super('preimage-holder-service')
    this.preimageStore = preimageStore
    this.configService = configService
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
    logger.debug('Storing preimage data', {
      requester: preimage.requester.toString(),
      dataLength: preimage.blob.length,
    })

    const [encodeError, encodedData] = encodePreimage(preimage)
    if (encodeError) {
      return safeError(encodeError)
    }

    const [hashError, hash] = blake2bHash(encodedData)
    if (hashError) {
      return safeError(hashError)
    }

    // Store the preimage
    this.preimageCache.set(hash, preimage)
    const [error, _result] = await this.preimageStore.storePreimage(
      preimage,
      creationSlot,
    )
    if (error) {
      return safeError(error)
    }

    logger.debug('Preimage stored successfully', {
      hash,
      totalPreimages: this.preimageCache.size,
    })

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

  /**
   * Check if preimage is available (stored and not expired)
   *
   * @param hash - The preimage hash to check
   * @returns True if preimage is available
   */
  //   isPreimageAvailable(hash: Hex): boolean {
  //     const entry = this.preimageStore.get(hash)
  //     if (!entry) {
  //       return false
  //     }

  //     // Check if preimage is marked as available
  //     if (!entry.isAvailable) {
  //       return false
  //     }

  //     // Check expiration (Cexpungeperiod = 19,200 timeslots)
  //     const CEXPUNGE_PERIOD = BigInt(19200) // Gray Paper constant
  //     const expirationTimeslot = entry.storedAt + CEXPUNGE_PERIOD
  //     const currentTimeslot = BigInt(Date.now()) // TODO: Use actual timeslot from clock service

  //     if (currentTimeslot > expirationTimeslot) {
  //       return false
  //     }
  //     return true
  //   }

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
   * Get all available preimages
   *
   * @returns Map of hash to preimage entry for all available preimages
   */
  async getAllAvailablePreimages(): SafePromise<Map<Hex, Preimage>> {
    const [error, result] = await this.preimageStore.getAllPreimages()
    if (error) {
      return safeError(error)
    }
    if (!result) {
      return safeError(new Error('No preimages found'))
    }
    const map = new Map<Hex, Preimage>(
      result.map((preimage) => [
        preimage.hash,
        {
          requester: preimage.serviceIndex,
          blob: preimage.data,
        },
      ]),
    )
    return safeResult(map)
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
  async cleanupExpiredPreimages(currentTimeslot: bigint): SafePromise<number> {
    const CEXPUNGE_PERIOD = BigInt(this.configService.preimageExpungePeriod) // Gray Paper constant

    let cleanedCount = 0

    const [error, result] = await this.preimageStore.getAllPreimages()
    if (error) {
      return safeError(error)
    }
    if (!result) {
      return safeError(new Error('No preimages found'))
    }

    for (const entry of result) {
      // Calculate expiration timeslot

      const expirationTime = entry.creationSlot + CEXPUNGE_PERIOD

      if (currentTimeslot > expirationTime) {
        const [error, success] = await this.preimageStore.deletePreimage(
          entry.hash,
        )
        if (error) {
          return safeError(error)
        }
        if (success) {
          cleanedCount++
        }
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired preimages', { count: cleanedCount })
    }

    return safeResult(cleanedCount)
  }
}
