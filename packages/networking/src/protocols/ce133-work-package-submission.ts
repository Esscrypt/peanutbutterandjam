/**
 * CE 133: Work Package Submission Protocol
 *
 * Implements the work package submission protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for builders to submit work packages to guarantors.
 */

import {
  blake2bHash,
  hexToBytes,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { NetworkingStore } from '@pbnj/state'
import type { StreamInfo, WorkPackageSubmission } from '@pbnj/types'

/**
 * Work package submission protocol handler
 */
export class WorkPackageSubmissionProtocol {
  private workPackages: Map<
    string,
    { workPackage: Uint8Array; extrinsic: Uint8Array }
  > = new Map()
  private pendingSubmissions: Map<
    string,
    { coreIndex: number; timestamp: number }
  > = new Map()
  private dbIntegration: NetworkingStore | null = null

  constructor(dbIntegration?: NetworkingStore) {
    this.dbIntegration = dbIntegration || null
  }

  /**
   * Set database integration for persistent storage
   */
  setDatabaseIntegration(dbIntegration: NetworkingStore): void {
    this.dbIntegration = dbIntegration
  }

  /**
   * Load state from database
   */
  async loadState(): Promise<void> {
    if (!this.dbIntegration) return

    try {
      // Load pending work packages from database
      const pendingWorkPackages =
        await this.dbIntegration.getPendingWorkPackages()

      for (const pendingHash of pendingWorkPackages) {
        const hashString = Buffer.from(pendingHash).toString('hex')
        const workPackageData =
          await this.dbIntegration.getWorkPackage(hashString)

        if (workPackageData) {
          // Store the work package data
          this.workPackages.set(hashString, {
            workPackage: workPackageData,
            extrinsic: new Uint8Array(), // placeholder
          })

          this.pendingSubmissions.set(hashString, {
            coreIndex: 0, // placeholder
            timestamp: Date.now(),
          })
        }
      }

      console.log(
        `Loaded state: ${this.workPackages.size} work packages, ${this.pendingSubmissions.size} pending submissions`,
      )
    } catch (error) {
      console.error('Failed to load state from database:', error)
    }
  }

  /**
   * Add work package to local store
   */
  addWorkPackage(
    workPackageHash: Uint8Array,
    workPackage: Uint8Array,
    extrinsic: Uint8Array,
  ): void {
    this.workPackages.set(workPackageHash.toString(), {
      workPackage,
      extrinsic,
    })
  }

  /**
   * Get work package from local store
   */
  getWorkPackage(
    workPackageHash: Uint8Array,
  ): { workPackage: Uint8Array; extrinsic: Uint8Array } | undefined {
    return this.workPackages.get(workPackageHash.toString())
  }

  /**
   * Create work package submission message
   */
  createWorkPackageSubmission(
    coreIndex: number,
    workPackage: Uint8Array,
    extrinsic: Uint8Array,
  ): WorkPackageSubmission {
    return {
      coreIndex,
      workPackage,
      extrinsic,
    }
  }

  /**
   * Process work package submission
   */
  async processWorkPackageSubmission(
    submission: WorkPackageSubmission,
  ): SafePromise<boolean> {
    // Validate work package
    if (!this.validateWorkPackage(submission.workPackage)) {
      return safeError(new Error('Invalid work package'))
    }

    // Validate extrinsic data
    if (!this.validateExtrinsic(submission.extrinsic)) {
      return safeError(new Error('Invalid extrinsic data'))
    }

    // Calculate work package hash
    const [error, workPackageHash] = blake2bHash(submission.workPackage)
    if (error) {
      return safeError(new Error('Failed to calculate work package hash'))
    }
    const workPackageHashBytes = hexToBytes(workPackageHash)

    // Store the work package locally
    this.addWorkPackage(
      workPackageHashBytes,
      submission.workPackage,
      submission.extrinsic,
    )

    // Record pending submission locally
    this.pendingSubmissions.set(workPackageHash, {
      coreIndex: submission.coreIndex,
      timestamp: Date.now(),
    })

    // Persist to database if available
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.storeWorkPackage(
          workPackageHashBytes.toString(),
          submission.workPackage,
        )
      } catch (error) {
        console.error('Failed to persist work package to database:', error)
      }
    }

    console.log(`Work package submitted for core ${submission.coreIndex}`)
    return safeResult(true)
  }

  /**
   * Validate work package structure
   */
  private validateWorkPackage(workPackage: Uint8Array): boolean {
    // Basic validation - check minimum size
    if (workPackage.length < 64) {
      return false
    }

    // Additional validation could be added here
    // For example, checking specific fields, signatures, etc.
    return true
  }

  /**
   * Validate extrinsic data
   */
  private validateExtrinsic(extrinsic: Uint8Array): boolean {
    // Basic validation - check minimum size
    if (extrinsic.length < 32) {
      return false
    }

    // Additional validation could be added here
    // For example, checking signatures, format, etc.
    return true
  }

  /**
   * Get pending submissions for a specific core
   */
  getPendingSubmissions(
    coreIndex: number,
  ): Array<{ workPackageHash: Uint8Array; timestamp: number }> {
    const pending: Array<{ workPackageHash: Uint8Array; timestamp: number }> =
      []

    for (const [hash, submission] of this.pendingSubmissions.entries()) {
      if (submission.coreIndex === coreIndex) {
        pending.push({
          workPackageHash: Buffer.from(hash.replace('0x', ''), 'hex'),
          timestamp: submission.timestamp,
        })
      }
    }

    return pending
  }

  /**
   * Remove pending submission (when processed)
   */
  async removePendingSubmission(workPackageHash: Uint8Array): Promise<void> {
    const hashString = workPackageHash.toString()
    this.pendingSubmissions.delete(hashString)

    // Mark as processed in database if available
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.markWorkPackageProcessed(
          new Uint8Array(Buffer.from(workPackageHash)),
        )
      } catch (error) {
        console.error(
          'Failed to mark work package as processed in database:',
          error,
        )
      }
    }
  }

  /**
   * Serialize work package submission message
   */
  serializeWorkPackageSubmission(
    submission: WorkPackageSubmission,
  ): Uint8Array {
    // Serialize according to JAMNP-S specification
    const buffer = new ArrayBuffer(
      4 + submission.workPackage.length + submission.extrinsic.length,
    )
    const view = new DataView(buffer)
    let offset = 0

    // Write core index (4 bytes, little-endian)
    view.setUint32(offset, submission.coreIndex, true)
    offset += 4

    // Write work package length (4 bytes, little-endian)
    view.setUint32(offset, submission.workPackage.length, true)
    offset += 4

    // Write work package data
    new Uint8Array(buffer).set(submission.workPackage, offset)
    offset += submission.workPackage.length

    // Write extrinsic length (4 bytes, little-endian)
    view.setUint32(offset, submission.extrinsic.length, true)
    offset += 4

    // Write extrinsic data
    new Uint8Array(buffer).set(submission.extrinsic, offset)

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize work package submission message
   */
  deserializeWorkPackageSubmission(data: Uint8Array): WorkPackageSubmission {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read core index (4 bytes, little-endian)
    const coreIndex = view.getUint32(offset, true)
    offset += 4

    // Read work package length (4 bytes, little-endian)
    const workPackageLength = view.getUint32(offset, true)
    offset += 4

    // Read work package data
    const workPackage = data.slice(offset, offset + workPackageLength)
    offset += workPackageLength

    // Read extrinsic length (4 bytes, little-endian)
    const extrinsicLength = view.getUint32(offset, true)
    offset += 4

    // Read extrinsic data
    const extrinsic = data.slice(offset, offset + extrinsicLength)

    return {
      coreIndex,
      workPackage,
      extrinsic,
    }
  }

  /**
   * Handle incoming stream data
   */
  async handleStreamData(
    _stream: StreamInfo,
    data: Uint8Array,
  ): SafePromise<boolean> {
    const submission = this.deserializeWorkPackageSubmission(data)
    return await this.processWorkPackageSubmission(submission)
  }

  /**
   * Start work package submission protocol
   * JIP-5 compliant startup method
   */
  async start(): Promise<void> {
    console.log(
      'Starting work package submission protocol for JIP-5 compliance',
    )
    // TODO: Initialize work package submission streams
  }

  /**
   * Stop work package submission protocol
   * JIP-5 compliant shutdown method
   */
  async stop(): Promise<void> {
    console.log('Stopping work package submission protocol')
    // TODO: Close all submission streams
  }
}
