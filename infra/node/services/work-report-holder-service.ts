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
import { encodeWorkReport } from '@pbnj/serialization'
import type { WorkStore } from '@pbnj/state'
import { BaseService, type WorkReport } from '@pbnj/types'

/**
 * Preimage storage entry with metadata
 */
export interface WorkReportEntry {
  /** The actual preimage data */
  workReport: WorkReport
  /** When this preimage was announced */
  announcedAt: bigint
  /** When this preimage was stored */
  storedAt: bigint
  /** Whether this work report is available for requests */
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
export class WorkReportHolderService extends BaseService {
  /** Map from preimage hash to preimage data */
  private readonly workReportStore: Map<Hex, WorkReport> = new Map()

  /** Map from preimage hash to announcement metadata */
  // private readonly workReportToRequest: Map<Hex, WorkReportAnnouncement> = new Map()

  private readonly workStore: WorkStore

  constructor(workStore: WorkStore) {
    super('work-report-holder-service')
    this.workStore = workStore
  }

  /**
   * Store actual work report data
   *
   * @param workReport - The work report data to store
   * @returns Safe result indicating success
   */
  async storeWorkReport(workReport: WorkReport): SafePromise<Hex> {
    const [encodeError, encodedData] = encodeWorkReport(workReport)
    if (encodeError) {
      return safeError(encodeError)
    }

    const [hashError, hash] = blake2bHash(encodedData)
    if (hashError) {
      return safeError(hashError)
    }

    // Store the work report
    this.workReportStore.set(hash, workReport)
    const [error, result] = await this.workStore.storeWorkReport(workReport)
    if (error) {
      return safeError(error)
    }

    return safeResult(result.reportHash)
  }

  /**
   * Get work report data by hash
   *
   * @param hash - The preimage hash to retrieve
   * @returns Preimage entry or null if not found
   */
  getWorkReport(hash: Hex): WorkReport | null {
    const entry = this.workReportStore.get(hash)
    return entry ?? null
  }

  // storeWorkReportToRequest(announcement: WorkReportAnnouncement): void {
  //   this.workReportToRequest.set(announcement.hash, announcement)
  // }

  // getWorkReportsToRequest(): Hex[] {
  //   return Array.from(this.workReportToRequest.keys())
  // }

  // clearWorkReportToRequest(hash: Hex): void {
  //   this.workReportToRequest.delete(hash)
  // }

  /**
   * Remove work report (mark as unavailable)
   *
   * @param hash - The work report hash to remove
   * @returns True if work report was removed
   */
  removeWorkReport(hash: Hex): boolean {
    const entry = this.workReportStore.get(hash)
    if (!entry) {
      return false
    }

    logger.debug('Work report marked as unavailable', { hash })
    return true
  }
}
