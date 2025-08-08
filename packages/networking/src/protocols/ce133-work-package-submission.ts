/**
 * CE 133: Work Package Submission Protocol
 *
 * Implements the work package submission protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for builders to submit work packages to guarantors.
 */

import type { 
  Bytes, 
  WorkPackageSubmission,
  StreamInfo
} from '@pbnj/types'
import { blake2bHash } from '@pbnj/core'
import type { NetworkingDatabaseIntegration } from '../db-integration'

/**
 * Work package submission protocol handler
 */
export class WorkPackageSubmissionProtocol {
  private workPackages: Map<string, { workPackage: Bytes; extrinsic: Bytes }> = new Map()
  private pendingSubmissions: Map<string, { coreIndex: number; timestamp: number }> = new Map()
  private dbIntegration: NetworkingDatabaseIntegration | null = null

  constructor(dbIntegration?: NetworkingDatabaseIntegration) {
    this.dbIntegration = dbIntegration || null
  }

  /**
   * Set database integration for persistent storage
   */
  setDatabaseIntegration(dbIntegration: NetworkingDatabaseIntegration): void {
    this.dbIntegration = dbIntegration
  }

  /**
   * Load state from database
   */
  async loadState(): Promise<void> {
    if (!this.dbIntegration) return

    try {
      // Load pending work packages from database
      const pendingWorkPackages = await this.dbIntegration.getPendingWorkPackages()
      
      for (const pending of pendingWorkPackages) {
        const workPackageData = await this.dbIntegration.getWorkPackage(pending.workPackageHash)
        if (workPackageData) {
          this.workPackages.set(pending.workPackageHash.toString(), {
            workPackage: workPackageData.workPackage,
            extrinsic: workPackageData.extrinsic
          })
          
          this.pendingSubmissions.set(pending.workPackageHash.toString(), {
            coreIndex: workPackageData.coreIndex,
            timestamp: workPackageData.timestamp
          })
        }
      }

      console.log(`Loaded state: ${this.workPackages.size} work packages, ${this.pendingSubmissions.size} pending submissions`)
    } catch (error) {
      console.error('Failed to load state from database:', error)
    }
  }

  /**
   * Add work package to local store
   */
  addWorkPackage(
    workPackageHash: Bytes,
    workPackage: Bytes,
    extrinsic: Bytes
  ): void {
    this.workPackages.set(workPackageHash.toString(), { workPackage, extrinsic })
  }

  /**
   * Get work package from local store
   */
  getWorkPackage(workPackageHash: Bytes): { workPackage: Bytes; extrinsic: Bytes } | undefined {
    return this.workPackages.get(workPackageHash.toString())
  }

  /**
   * Create work package submission message
   */
  createWorkPackageSubmission(
    coreIndex: number,
    workPackage: Bytes,
    extrinsic: Bytes
  ): WorkPackageSubmission {
    return {
      coreIndex,
      workPackage,
      extrinsic
    }
  }

  /**
   * Process work package submission
   */
  async processWorkPackageSubmission(submission: WorkPackageSubmission): Promise<boolean> {
    try {
      // Validate work package
      if (!this.validateWorkPackage(submission.workPackage)) {
        console.error('Invalid work package')
        return false
      }

      // Validate extrinsic data
      if (!this.validateExtrinsic(submission.extrinsic)) {
        console.error('Invalid extrinsic data')
        return false
      }

      // Calculate work package hash
      const workPackageHash = blake2bHash(submission.workPackage)
      const workPackageHashBytes = Buffer.from(workPackageHash.replace('0x', ''), 'hex')

      // Store the work package locally
      this.addWorkPackage(workPackageHashBytes, submission.workPackage, submission.extrinsic)

      // Record pending submission locally
      this.pendingSubmissions.set(workPackageHash, {
        coreIndex: submission.coreIndex,
        timestamp: Date.now()
      })

      // Persist to database if available
      if (this.dbIntegration) {
        try {
          await this.dbIntegration.storeWorkPackage(
            workPackageHashBytes,
            submission.workPackage,
            submission.extrinsic,
            submission.coreIndex
          )
        } catch (error) {
          console.error('Failed to persist work package to database:', error)
        }
      }

      console.log(`Work package submitted for core ${submission.coreIndex}`)
      return true
    } catch (error) {
      console.error('Failed to process work package submission:', error)
      return false
    }
  }

  /**
   * Validate work package structure
   */
  private validateWorkPackage(workPackage: Bytes): boolean {
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
  private validateExtrinsic(extrinsic: Bytes): boolean {
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
  getPendingSubmissions(coreIndex: number): Array<{ workPackageHash: Bytes; timestamp: number }> {
    const pending: Array<{ workPackageHash: Bytes; timestamp: number }> = []
    
    for (const [hash, submission] of this.pendingSubmissions.entries()) {
      if (submission.coreIndex === coreIndex) {
        pending.push({
          workPackageHash: Buffer.from(hash.replace('0x', ''), 'hex'),
          timestamp: submission.timestamp
        })
      }
    }
    
    return pending
  }

  /**
   * Remove pending submission (when processed)
   */
  async removePendingSubmission(workPackageHash: Bytes): Promise<void> {
    const hashString = workPackageHash.toString()
    this.pendingSubmissions.delete(hashString)
    
    // Mark as processed in database if available
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.markWorkPackageProcessed(workPackageHash)
      } catch (error) {
        console.error('Failed to mark work package as processed in database:', error)
      }
    }
  }

  /**
   * Serialize work package submission message
   */
  serializeWorkPackageSubmission(submission: WorkPackageSubmission): Bytes {
    // Serialize according to JAMNP-S specification
    const buffer = new ArrayBuffer(4 + submission.workPackage.length + submission.extrinsic.length)
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
  deserializeWorkPackageSubmission(data: Bytes): WorkPackageSubmission {
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
      extrinsic
    }
  }

  /**
   * Handle incoming stream data
   */
  async handleStreamData(stream: StreamInfo, data: Bytes): Promise<boolean> {
    try {
      const submission = this.deserializeWorkPackageSubmission(data)
      return await this.processWorkPackageSubmission(submission)
    } catch (error) {
      console.error('Failed to handle stream data:', error)
      return false
    }
  }
} 