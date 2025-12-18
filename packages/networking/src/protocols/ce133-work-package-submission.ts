/**
 * CE 133: Work Package Submission Protocol
 *
 * Gray Paper Reference: work_packages_and_reports.tex, Equations 92-117, 247
 * JAMNP-S Reference: CE 133
 *
 * Implements the work package submission protocol for JAMNP-S.
 * Builders submit work packages with extrinsic data to guarantors.
 *
 * Protocol Flow:
 * Message 1: Core Index (4 bytes) ++ Encoded Work-Package
 * Message 2: Concatenated Extrinsic Data Blobs
 * Message 3: FIN
 * Response: FIN
 *
 * Gray Paper Constants:
 * - C_maxpackagexts = 128 (max extrinsic count)
 * - C_maxbundlesize = 13,791,360 bytes (~13.6 MB)
 */

import {
  decodeFixedLength,
  decodeWorkPackage,
  encodeFixedLength,
  encodeWorkPackage,
} from '@pbnjam/codec'
import {
  blake2bHash,
  concatBytes,
  type EventBusService,
  type Hex,
} from '@pbnjam/core'
import type {
  Safe,
  SafePromise,
  WorkPackageSubmissionRequest,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { NetworkingProtocol } from './protocol'

/**
 * Gray Paper Constants (Equations 92, 116)
 */
const C_MAXPACKAGEXTS = 128n // Max total extrinsic count
const C_MAXBUNDLESIZE = 13_791_360n // ~13.6 MB max bundle size
const C_SEGMENTFOOTPRINT = 4136n // Segment footprint size

/**
 * Work package submission protocol handler
 */
export class WorkPackageSubmissionProtocol extends NetworkingProtocol<
  WorkPackageSubmissionRequest,
  void
> {
  private readonly eventBusService: EventBusService

  constructor(eventBusService: EventBusService) {
    super()
    this.eventBusService = eventBusService

    this.initializeEventHandlers()
  }

  /**
   * Process work package submission
   *
   * Gray Paper: Builder submits work-package to guarantor
   * Initial state: 'submitted'
   *
   * Validates:
   * 1. Extrinsic count ≤ C_maxpackagexts
   * 2. Bundle size ≤ C_maxbundlesize
   * 3. Extrinsic data size matches sum of lengths
   * 4. Each extrinsic hash matches blake{data}
   */
  async processRequest(
    submission: WorkPackageSubmissionRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    // Validate the submission
    const [validationError] = this.validateSubmission(submission)
    if (validationError) {
      return safeError(validationError)
    }

    // Emit event for guarantor service to process
    // The guarantor service will:
    // 1. Evaluate authorization
    // 2. Compute work-report
    // 3. Perform erasure coding
    // 4. Distribute chunks to validators
    this.eventBusService.emitWorkPackageReceived(submission, peerPublicKey)

    return safeResult(undefined)
  }

  /**
   * Validate work package submission according to Gray Paper constraints
   *
   * Gray Paper Equations:
   * - Eq 100: Σ len(wi_extrinsics) ≤ C_maxpackagexts (128)
   * - Eq 111: Bundle size ≤ C_maxbundlesize (13,791,360 bytes)
   * - Eq 247: extrinsicdata(wi) = [d | (blake{d}, len{d}) ∈ wi_extrinsics]
   */
  private validateSubmission(
    submission: WorkPackageSubmissionRequest,
  ): Safe<void> {
    const { workPackage, extrinsics } = submission

    // 1. Count total extrinsics across all work items
    let totalExtrinsicCount = 0n
    let expectedExtrinsicSize = 0n
    const extrinsicRefs: Array<{ hash: string; length: number }> = []

    for (const workItem of workPackage.workItems) {
      totalExtrinsicCount += BigInt(workItem.extrinsics.length)

      for (const extrinsicRef of workItem.extrinsics) {
        expectedExtrinsicSize += BigInt(extrinsicRef.length)
        extrinsicRefs.push({
          hash: extrinsicRef.hash,
          length: Number(extrinsicRef.length),
        })
      }
    }

    // Validate: Extrinsic count ≤ C_maxpackagexts (Equation 100)
    if (totalExtrinsicCount > C_MAXPACKAGEXTS) {
      return safeError(
        new Error(
          `Extrinsic count ${totalExtrinsicCount} exceeds limit ${C_MAXPACKAGEXTS}`,
        ),
      )
    }

    // Validate: Extrinsic data size matches expected size (Equation 247)
    if (BigInt(extrinsics.length) !== expectedExtrinsicSize) {
      return safeError(
        new Error(
          `Extrinsic data size ${extrinsics.length} does not match expected ${expectedExtrinsicSize}`,
        ),
      )
    }

    // 2. Validate each extrinsic blob hash
    let offset = 0
    for (const ref of extrinsicRefs) {
      const blobData = extrinsics.slice(offset, offset + ref.length)

      // Verify blake{data} == hash
      const [hashError, computedHash] = blake2bHash(blobData)
      if (hashError) {
        return safeError(
          new Error(`Failed to hash extrinsic at offset ${offset}`),
        )
      }

      if (computedHash !== ref.hash) {
        return safeError(
          new Error(
            `Extrinsic hash mismatch at offset ${offset}: expected ${ref.hash}, got ${computedHash}`,
          ),
        )
      }

      offset += ref.length
    }

    // 3. Validate bundle size ≤ C_maxbundlesize (Equation 111)
    // S(wi) = len(payload) + len(importsegments) * C_segmentfootprint + Σ(extrinsic_lengths)
    let bundleSize =
      BigInt(workPackage.authToken.length) +
      BigInt(workPackage.authConfig.length)

    for (const workItem of workPackage.workItems) {
      const payloadSize = BigInt(workItem.payload.length / 2 - 1) // Hex string to bytes
      const importSize =
        BigInt(workItem.importsegments.length) * C_SEGMENTFOOTPRINT

      let extrinsicSizeForItem = 0n
      for (const extrinsicRef of workItem.extrinsics) {
        extrinsicSizeForItem += BigInt(extrinsicRef.length)
      }

      bundleSize += payloadSize + importSize + extrinsicSizeForItem
    }

    if (bundleSize > C_MAXBUNDLESIZE) {
      return safeError(
        new Error(`Bundle size ${bundleSize} exceeds limit ${C_MAXBUNDLESIZE}`),
      )
    }

    return safeResult(undefined)
  }

  /**
   * Serialize work package submission message
   *
   * JAMNP-S CE 133 Format:
   * Message 1: encode[4]{coreIndex} ++ encode{workPackage}
   * Message 2: Raw concatenated extrinsic data blobs
   *
   * This method returns Message 1. Message 2 is just submission.extrinsics.
   */
  serializeRequest(submission: WorkPackageSubmissionRequest): Safe<Uint8Array> {
    const parts: Uint8Array[] = []

    // Core Index (4 bytes, fixed-length)
    const [error, encodedCoreIndex] = encodeFixedLength(
      submission.coreIndex,
      4n,
    )
    if (error) {
      return safeError(error)
    }
    parts.push(encodedCoreIndex)

    // Work Package (Gray Paper encoded)
    const [error2, encodedWorkPackage] = encodeWorkPackage(
      submission.workPackage,
    )
    if (error2) {
      return safeError(error2)
    }
    parts.push(encodedWorkPackage)

    // Extrinsic data blobs (raw, no encoding)
    parts.push(submission.extrinsics)

    return safeResult(concatBytes(parts))
  }

  /**
   * Deserialize work package submission message
   *
   * JAMNP-S CE 133 Format:
   * Input: encode[4]{coreIndex} ++ encode{workPackage} ++ extrinsic_data
   *
   * The remaining data after work package is the raw extrinsic blobs.
   */
  deserializeRequest(data: Uint8Array): Safe<WorkPackageSubmissionRequest> {
    let currentData = data

    // 1. Decode core index (4 bytes, fixed-length)
    const [error, coreIndexResult] = decodeFixedLength(currentData, 4n)
    if (error) {
      return safeError(error)
    }
    currentData = coreIndexResult.remaining
    const coreIndex = coreIndexResult.value

    // 2. Decode work package (Gray Paper encoded)
    const [error2, decodedWorkPackageResult] = decodeWorkPackage(currentData)
    if (error2) {
      return safeError(error2)
    }
    currentData = decodedWorkPackageResult.remaining
    const workPackage = decodedWorkPackageResult.value

    // 3. Remaining data is the raw extrinsic blobs
    const extrinsics = currentData

    const request: WorkPackageSubmissionRequest = {
      coreIndex,
      workPackage,
      extrinsics,
    }

    // 4. Validate the deserialized submission
    const [validationError] = this.validateSubmission(request)
    if (validationError) {
      return safeError(
        new Error(
          `Invalid work package submission: ${validationError.message}`,
        ),
      )
    }

    return safeResult(request)
  }

  serializeResponse(_response: undefined): Safe<Uint8Array> {
    return safeResult(new Uint8Array())
  }

  deserializeResponse(_data: Uint8Array): Safe<void> {
    return safeResult(undefined)
  }

  async processResponse(_response: undefined): SafePromise<void> {
    return safeResult(undefined)
  }
}
