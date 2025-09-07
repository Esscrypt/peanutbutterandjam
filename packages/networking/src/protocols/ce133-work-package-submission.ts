/**
 * CE 133: Work Package Submission Protocol
 *
 * Implements the work package submission protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for builders to submit work packages to guarantors.
 */

import {
  blake2b,
  concatBytes,
  type Hex,
  hexToBytes,
  type Safe,
  type SafePromise,
  safeError,
  safeResult,
  zeroHash,
} from '@pbnj/core'
import {
  calculateWorkPackageHash,
  decodeFixedLength,
  decodeWorkPackage,
  encodeFixedLength,
  encodeWorkPackage,
} from '@pbnj/serialization'
import type { WorkStore } from '@pbnj/state'
import type {
  Extrinsic,
  WorkPackage,
  WorkPackageSubmissionRequest,
} from '@pbnj/types'
import { NetworkingProtocol } from './protocol'

/**
 * Work package submission protocol handler
 */
// Work-Package = As in GP
// Extrinsic = [u8]

// Builder -> Guarantor

// --> Core Index ++ Work-Package
// --> [Extrinsic] (Message size should equal sum of extrinsic data lengths)
// --> FIN
// <-- FIN
export class WorkPackageSubmissionProtocol extends NetworkingProtocol<
  WorkPackageSubmissionRequest,
  void
> {
  private workPackages: Map<
    Hex,
    { workPackage: WorkPackage; extrinsic: Extrinsic }
  > = new Map()
  private pendingSubmissions: Map<
    Hex,
    { coreIndex: bigint; timestamp: bigint }
  > = new Map()
  private workStore: WorkStore

  constructor(workStore: WorkStore) {
    super()
    this.workStore = workStore
  }

  /**
   * Add work package to local store
   */
  addWorkPackage(
    workPackageHash: Hex,
    workPackage: WorkPackage,
    extrinsic: Extrinsic,
  ): void {
    this.workPackages.set(workPackageHash, {
      workPackage,
      extrinsic,
    })
  }

  /**
   * Get work package from local store
   */
  getWorkPackage(
    workPackageHash: Hex,
  ): { workPackage: WorkPackage; extrinsic: Extrinsic } | undefined {
    return this.workPackages.get(workPackageHash)
  }

  /**
   * Create work package submission message
   */
  createWorkPackageSubmission(
    coreIndex: bigint,
    workPackage: WorkPackage,
    extrinsic: Extrinsic,
  ): WorkPackageSubmissionRequest {
    return {
      coreIndex,
      workPackage,
      extrinsic,
    }
  }

  /**
   * Process work package submission
   */
  async processRequest(
    submission: WorkPackageSubmissionRequest,
  ): SafePromise<void> {
    // Validate work package
    // if (!this.validateWorkPackage(submission.workPackage)) {
    //   return safeError(new Error('Invalid work package'))
    // }

    // // Validate extrinsic data
    // if (!this.validateExtrinsic(submission.extrinsic)) {
    //   return safeError(new Error('Invalid extrinsic data'))
    // }

    // Calculate work package hash
    const [error, workPackageHash] = calculateWorkPackageHash(
      submission.workPackage,
    )
    if (error) {
      return safeError(new Error('Failed to calculate work package hash'))
    }

    // Store the work package locally
    this.addWorkPackage(
      workPackageHash,
      submission.workPackage,
      submission.extrinsic,
    )

    // Record pending submission locally
    this.pendingSubmissions.set(workPackageHash, {
      coreIndex: submission.coreIndex,
      timestamp: BigInt(Date.now()),
    })

    await this.workStore.storeWorkPackage(
      submission.workPackage,
      'pending',
      Number(submission.coreIndex),
    )

    return safeResult(undefined)
  }

  /**
   * Validate work package structure
   */
  // private validateWorkPackage(workPackage: WorkPackage): boolean {
  //   // Basic validation - check minimum size
  //   if (workPackage.workItems.length < 64) {
  //     return false
  //   }

  //   // Additional validation could be added here
  //   // For example, checking specific fields, signatures, etc.
  //   return true
  // }

  /**
   * Validate extrinsic data
   */
  // private validateExtrinsic(extrinsic: Extrinsic): boolean {
  //   // Basic validation - check minimum size
  //   if (extrinsic.data.length < 32) {
  //     return false
  //   }

  //   // Additional validation could be added here
  //   // For example, checking signatures, format, etc.
  //   return true
  // }

  /**
   * Get pending submissions for a specific core
   */
  getPendingSubmissions(
    coreIndex: bigint,
  ): Array<{ workPackageHash: Uint8Array; timestamp: bigint }> {
    const pending: Array<{ workPackageHash: Uint8Array; timestamp: bigint }> =
      []

    for (const [hash, submission] of this.pendingSubmissions.entries()) {
      if (submission.coreIndex === coreIndex) {
        pending.push({
          workPackageHash: hexToBytes(hash),
          timestamp: submission.timestamp,
        })
      }
    }

    return pending
  }

  /**
   * Remove pending submission (when processed)
   */
  async removePendingSubmission(workPackageHash: Hex): Promise<void> {
    this.pendingSubmissions.delete(workPackageHash)

    // Mark as processed in database if available
    if (this.workStore) {
      try {
        await this.workStore.updateWorkPackageStatus(
          workPackageHash,
          'completed',
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
  //   Work-Package = As in GP
  // Extrinsic = [u8]

  // Builder -> Guarantor

  // --> Core Index ++ Work-Package
  // --> [Extrinsic] (Message size should equal sum of extrinsic data lengths)
  // --> FIN
  // <-- FIN
  serializeRequest(submission: WorkPackageSubmissionRequest): Safe<Uint8Array> {
    // Serialize according to JAMNP-S specification
    const parts: Uint8Array[] = []

    const [error2, encodedCoreIndex] = encodeFixedLength(
      submission.coreIndex,
      4n,
    )
    if (error2) {
      return safeError(error2)
    }
    parts.push(encodedCoreIndex)

    const [error, encodedWorkPackage] = encodeWorkPackage(
      submission.workPackage,
    )
    if (error) {
      return safeError(error)
    }
    parts.push(encodedWorkPackage)

    const extrinsic = submission.extrinsic.data

    parts.push(extrinsic)

    return safeResult(concatBytes(parts))
    //
  }

  /**
   * Deserialize work package submission message
   */
  deserializeRequest(data: Uint8Array): Safe<WorkPackageSubmissionRequest> {
    let currentData = data
    const [error, coreIndexResult] = decodeFixedLength(data, 4n)
    if (error) {
      return safeError(error)
    }
    currentData = coreIndexResult.remaining
    const coreIndex = coreIndexResult.value

    const [error2, decodedWorkPackageResult] = decodeWorkPackage(currentData)
    if (error2) {
      return safeError(error2)
    }
    currentData = decodedWorkPackageResult.remaining
    const decodedWorkPackage = decodedWorkPackageResult.value
    // extrinsic is until the end of the data
    const extrinsicData = currentData

    const [error3, extrincisHash] = blake2b(extrinsicData)
    if (error3) {
      return safeError(error3)
    }

    return safeResult({
      coreIndex: coreIndex,
      workPackage: decodedWorkPackage,
      extrinsic: {
        hash: extrincisHash,
        data: extrinsicData,
        signature: hexToBytes(zeroHash), // TODO: check which signature is needed here
      },
    })
  }

  serializeResponse(_response: void): Safe<Uint8Array> {
    return safeResult(new Uint8Array())
  }

  deserializeResponse(_data: Uint8Array): Safe<void> {
    return safeResult(undefined)
  }

  async processResponse(_response: void): SafePromise<void> {
    return safeResult(undefined)
  }
}
