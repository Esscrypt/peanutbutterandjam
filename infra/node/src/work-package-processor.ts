/**
 * Work Package Processor
 *
 * Processes work packages and generates work reports according to JAM Protocol
 * Reference: Gray Paper work package specifications
 */

import { blake2bHash, logger } from '@pbnj/core'
import type {
  AvailabilitySpec,
  BlockAuthoringConfig,
  WorkDigest,
  WorkItem,
  WorkPackage,
  WorkReport,
} from './types'
import { WorkError } from './types'

// Gray Paper constants
const GRAY_PAPER_CONSTANTS = {
  // Work package limits
  MAX_PACKAGE_ITEMS: 100,
  MAX_PACKAGE_EXPORTS: 3072,
  MAX_PACKAGE_IMPORTS: 3072,
  MAX_PACKAGE_EXTRINSICS: 128,
  MAX_BUNDLE_SIZE: 13794305, // 13.6MB

  // Segment constants
  SEGMENT_SIZE: 4104,
  EC_PIECE_SIZE: 684,

  // Gas limits
  MAX_PACKAGE_REF_GAS: 1000000,
  MAX_REPORT_ACC_GAS: 1000000,

  // Report limits
  MAX_REPORT_VAR_SIZE: 1024 * 1024, // 1MB

  // Epoch constants
  EPOCH_LENGTH: 600,
  MAX_LOOKUP_ANCHOR_AGE: 8 * 600, // 8 epochs
} as const

/**
 * Work item result
 */
export interface WorkItemResult {
  result: Uint8Array | WorkError
  gasUsed: number
  exports: Uint8Array[]
}

/**
 * Work Package Processor
 */
export class WorkPackageProcessor {
  /**
   * Process work packages
   */
  async process(
    packages: WorkPackage[],
    _config: BlockAuthoringConfig,
  ): Promise<WorkReport[]> {
    logger.debug('Processing work packages', {
      packageCount: packages.length,
    })

    const reports: WorkReport[] = []

    for (const workPackage of packages) {
      try {
        // Validate work package
        const validationResult = this.validateWorkPackage(workPackage)
        if (!validationResult.valid) {
          logger.error('Work package validation failed', {
            workPackageId: workPackage.id,
            errors: validationResult.errors,
          })
          continue
        }

        // Process work package
        const report = await this.processWorkPackage(workPackage, _config)
        reports.push(report)
      } catch (error) {
        logger.error('Failed to process work package', {
          workPackageId: workPackage.id,
          error,
        })
      }
    }

    logger.debug('Work packages processed', {
      processedCount: reports.length,
      totalCount: packages.length,
    })

    return reports
  }

  /**
   * Validate work package according to Gray Paper
   */
  private validateWorkPackage(workPackage: WorkPackage): {
    valid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // Check work items count
    if (
      workPackage.workItems.length === 0 ||
      workPackage.workItems.length > GRAY_PAPER_CONSTANTS.MAX_PACKAGE_ITEMS
    ) {
      errors.push(`Invalid work items count: ${workPackage.workItems.length}`)
    }

    // Check total exports
    const totalExports = workPackage.workItems.reduce(
      (sum, item) => sum + item.exportCount,
      0,
    )
    if (totalExports > GRAY_PAPER_CONSTANTS.MAX_PACKAGE_EXPORTS) {
      errors.push(
        `Total exports exceed limit: ${totalExports} > ${GRAY_PAPER_CONSTANTS.MAX_PACKAGE_EXPORTS}`,
      )
    }

    // Check total imports
    const totalImports = workPackage.workItems.reduce(
      (sum, item) => sum + item.importSegments.length,
      0,
    )
    if (totalImports > GRAY_PAPER_CONSTANTS.MAX_PACKAGE_IMPORTS) {
      errors.push(
        `Total imports exceed limit: ${totalImports} > ${GRAY_PAPER_CONSTANTS.MAX_PACKAGE_IMPORTS}`,
      )
    }

    // Check total extrinsics
    const totalExtrinsics = workPackage.workItems.reduce(
      (sum, item) => sum + item.extrinsics.length,
      0,
    )
    if (totalExtrinsics > GRAY_PAPER_CONSTANTS.MAX_PACKAGE_EXTRINSICS) {
      errors.push(
        `Total extrinsics exceed limit: ${totalExtrinsics} > ${GRAY_PAPER_CONSTANTS.MAX_PACKAGE_EXTRINSICS}`,
      )
    }

    // Check bundle size
    const bundleSize = this.calculateBundleSize(workPackage)
    if (bundleSize > GRAY_PAPER_CONSTANTS.MAX_BUNDLE_SIZE) {
      errors.push(
        `Bundle size exceeds limit: ${bundleSize} > ${GRAY_PAPER_CONSTANTS.MAX_BUNDLE_SIZE}`,
      )
    }

    // Check gas limits
    const totalRefGas = workPackage.workItems.reduce(
      (sum, item) => sum + item.refGasLimit,
      0,
    )
    if (totalRefGas > GRAY_PAPER_CONSTANTS.MAX_PACKAGE_REF_GAS) {
      errors.push(
        `Total ref gas exceeds limit: ${totalRefGas} > ${GRAY_PAPER_CONSTANTS.MAX_PACKAGE_REF_GAS}`,
      )
    }

    const totalAccGas = workPackage.workItems.reduce(
      (sum, item) => sum + item.accGasLimit,
      0,
    )
    if (totalAccGas > GRAY_PAPER_CONSTANTS.MAX_REPORT_ACC_GAS) {
      errors.push(
        `Total acc gas exceeds limit: ${totalAccGas} > ${GRAY_PAPER_CONSTANTS.MAX_REPORT_ACC_GAS}`,
      )
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Calculate bundle size according to Gray Paper equation
   */
  private calculateBundleSize(workPackage: WorkPackage): number {
    let size = workPackage.authToken.length + workPackage.authConfig.length

    for (const item of workPackage.workItems) {
      size += item.payload.length
      size += item.importSegments.length * GRAY_PAPER_CONSTANTS.SEGMENT_SIZE
      size += item.extrinsics.reduce((sum, [_, length]) => sum + length, 0)
    }

    return size
  }

  /**
   * Process a single work package
   */
  private async processWorkPackage(
    workPackage: WorkPackage,
    _config: BlockAuthoringConfig,
  ): Promise<WorkReport> {
    logger.debug('Processing work package', {
      workPackageId: workPackage.id,
      workItemsCount: workPackage.workItems.length,
    })

    // Calculate authorizer hash
    const authorizerHash = this.calculateAuthorizerHash(workPackage)

    // Process each work item
    const workDigests: WorkDigest[] = []
    const allExports: Uint8Array[] = []

    for (let i = 0; i < workPackage.workItems.length; i++) {
      const workItem = workPackage.workItems[i]

      try {
        // Execute work item
        const result = await this.executeWorkItem(workItem, workPackage, i)

        // Create work digest
        const digest = this.createWorkDigest(workItem, result)
        workDigests.push(digest)

        // Add exports
        allExports.push(...result.exports)
      } catch (error) {
        logger.error('Work item execution failed', {
          workItemIndex: i,
          error,
        })

        // Create error digest
        const errorDigest = this.createErrorDigest(
          workItem,
          WorkError.INVALID_RESULT,
        )
        workDigests.push(errorDigest)

        // Add zero exports
        const zeroExports = new Array(workItem.exportCount).fill(
          new Uint8Array(GRAY_PAPER_CONSTANTS.SEGMENT_SIZE),
        )
        allExports.push(...zeroExports)
      }
    }

    // Create availability specification
    const availabilitySpec = this.createAvailabilitySpec(
      workPackage,
      allExports,
    )

    // Create work report
    const report: WorkReport = {
      id: `report_${workPackage.id}`,
      workPackageId: workPackage.id,
      availabilitySpec,
      context: workPackage.context,
      coreIndex: 0, // TODO: Get from context
      authorizer: authorizerHash,
      authTrace: new Uint8Array(), // TODO: Implement authorization trace
      srLookup: new Map(), // TODO: Implement segment root lookup
      digests: workDigests,
      authGasUsed: 0, // TODO: Track authorization gas
      timestamp: Date.now(),
      author: workPackage.author,
    }

    logger.debug('Work package processed successfully', {
      workPackageId: workPackage.id,
      digestsCount: workDigests.length,
      exportsCount: allExports.length,
    })

    return report
  }

  /**
   * Calculate authorizer hash according to Gray Paper
   */
  private calculateAuthorizerHash(workPackage: WorkPackage): string {
    const authCodeHash = workPackage.authCodeHash
    const authConfig = workPackage.authConfig

    // Convert authCodeHash string to bytes
    const authCodeHashBytes = Buffer.from(authCodeHash.replace('0x', ''), 'hex')

    // Concatenate auth code hash and config
    const combined = new Uint8Array(
      authCodeHashBytes.length + authConfig.length,
    )
    combined.set(authCodeHashBytes)
    combined.set(authConfig, authCodeHashBytes.length)

    // Calculate Blake2b hash
    return blake2bHash(combined)
  }

  /**
   * Execute a work item using PVM
   */
  private async executeWorkItem(
    workItem: WorkItem,
    _workPackage: WorkPackage,
    itemIndex: number,
  ): Promise<WorkItemResult> {
    logger.debug('Executing work item', {
      itemIndex,
      serviceIndex: workItem.serviceIndex,
    })

    // TODO: Implement PVM execution
    // This would involve:
    // 1. Loading the service code
    // 2. Setting up PVM state
    // 3. Executing the Refine function
    // 4. Collecting results and exports

    // Placeholder implementation
    const result: WorkItemResult = {
      result: new Uint8Array([1, 2, 3, 4]), // Placeholder result
      gasUsed: Math.floor(Math.random() * workItem.accGasLimit),
      exports: new Array(workItem.exportCount).fill(
        new Uint8Array(GRAY_PAPER_CONSTANTS.SEGMENT_SIZE),
      ),
    }

    return result
  }

  /**
   * Create work digest according to Gray Paper item-to-digest function
   */
  private createWorkDigest(
    workItem: WorkItem,
    result: WorkItemResult,
  ): WorkDigest {
    // Calculate payload hash
    const payloadHash = this.calculateHash(workItem.payload)

    // Calculate extrinsic size
    const extrinsicSize = workItem.extrinsics.reduce(
      (sum: number, [_, length]: [string, number]) => sum + length,
      0,
    )

    return {
      serviceIndex: workItem.serviceIndex,
      codeHash: workItem.codeHash,
      payloadHash,
      gasLimit: workItem.accGasLimit,
      result: result.result,
      gasUsed: result.gasUsed,
      importCount: workItem.importSegments.length,
      exportCount: workItem.exportCount,
      extrinsicCount: workItem.extrinsics.length,
      extrinsicSize,
    }
  }

  /**
   * Create error digest for failed work items
   */
  private createErrorDigest(workItem: WorkItem, error: WorkError): WorkDigest {
    return {
      serviceIndex: workItem.serviceIndex,
      codeHash: workItem.codeHash,
      payloadHash: this.calculateHash(workItem.payload),
      gasLimit: workItem.accGasLimit,
      result: error,
      gasUsed: 0,
      importCount: workItem.importSegments.length,
      exportCount: workItem.exportCount,
      extrinsicCount: workItem.extrinsics.length,
      extrinsicSize: workItem.extrinsics.reduce(
        (sum: number, [_, length]: [string, number]) => sum + length,
        0,
      ),
    }
  }

  /**
   * Create availability specification according to Gray Paper
   */
  private createAvailabilitySpec(
    workPackage: WorkPackage,
    exports: Uint8Array[],
  ): AvailabilitySpec {
    // Calculate package hash
    const packageHash = this.calculateHash(workPackage.data)

    // Create bundle (work package + extrinsic data + import segments)
    const bundle = this.createBundle(workPackage)
    const bundleLength = bundle.length

    // Calculate erasure root
    const erasureRoot = this.calculateErasureRoot(bundle, exports)

    // Calculate segment root
    const segmentRoot = this.calculateSegmentRoot(exports)

    return {
      packageHash,
      bundleLength,
      erasureRoot,
      segmentRoot,
      segmentCount: exports.length,
    }
  }

  /**
   * Create bundle according to Gray Paper
   */
  private createBundle(workPackage: WorkPackage): Uint8Array {
    // According to Gray Paper, the bundle should contain:
    // - Work package
    // - Extrinsic data
    // - Import segments
    // - Justification data

    const bundleParts: Uint8Array[] = []

    // 1. Work package data
    bundleParts.push(workPackage.data)

    // 2. Extrinsic data for all work items
    for (const workItem of workPackage.workItems) {
      for (const [_hash, length] of workItem.extrinsics) {
        // TODO: Fetch actual extrinsic data from hash
        // For now, create placeholder data
        const extrinsicData = new Uint8Array(length)
        bundleParts.push(extrinsicData)
      }
    }

    // 3. Import segments for all work items
    for (const workItem of workPackage.workItems) {
      for (const [_hash, _index] of workItem.importSegments) {
        // TODO: Fetch actual import segment data from hash
        // For now, create placeholder data
        const segmentData = new Uint8Array(GRAY_PAPER_CONSTANTS.SEGMENT_SIZE)
        bundleParts.push(segmentData)
      }
    }

    // 4. Justification data (Merkle proofs for import segments)
    for (const workItem of workPackage.workItems) {
      for (const [_hash, _index] of workItem.importSegments) {
        // TODO: Generate actual Merkle proofs
        // For now, create placeholder proof data
        const proofData = new Uint8Array(256) // Typical Merkle proof size
        bundleParts.push(proofData)
      }
    }

    // Concatenate all parts
    const totalSize = bundleParts.reduce((sum, part) => sum + part.length, 0)
    const bundle = new Uint8Array(totalSize)

    let offset = 0
    for (const part of bundleParts) {
      bundle.set(part, offset)
      offset += part.length
    }

    return bundle
  }

  /**
   * Calculate erasure root according to Gray Paper
   */
  private calculateErasureRoot(
    bundle: Uint8Array,
    exports: Uint8Array[],
  ): string {
    // According to Gray Paper, the erasure root is calculated as:
    // merklize_wb(concat_all(transpose([bundle_erasure_coded, exports_erasure_coded])))

    // 1. Erasure code the bundle
    const bundleErasureCoded = this.erasureCode(bundle)

    // 2. Erasure code the exports
    const exportsErasureCoded = this.erasureCodeExports(exports)

    // 3. Transpose the erasure-coded data
    const transposed = this.transposeErasureCoded(
      bundleErasureCoded,
      exportsErasureCoded,
    )

    // 4. Concatenate all parts
    const concatenated = this.concatenateAll(transposed)

    // 5. Calculate Merkle root with wide binary tree
    return this.merklizeWideBinary(concatenated)
  }

  /**
   * Erasure code data according to Gray Paper
   */
  private erasureCode(data: Uint8Array): Uint8Array[] {
    // TODO: Implement proper erasure coding
    // This should use the erasure coding function from Gray Paper
    // For now, return the original data as a single piece

    return [data]
  }

  /**
   * Erasure code exports according to Gray Paper
   */
  private erasureCodeExports(exports: Uint8Array[]): Uint8Array[] {
    // TODO: Implement proper erasure coding for exports
    // This should use the erasure coding function with paged proofs
    // For now, return the original exports

    return exports
  }

  /**
   * Transpose erasure-coded data
   */
  private transposeErasureCoded(
    bundleCoded: Uint8Array[],
    exportsCoded: Uint8Array[],
  ): Uint8Array[][] {
    // TODO: Implement proper transposition
    // For now, return a simple structure
    return [bundleCoded, exportsCoded]
  }

  /**
   * Concatenate all parts
   */
  private concatenateAll(parts: Uint8Array[][]): Uint8Array {
    const allParts: Uint8Array[] = []

    for (const partArray of parts) {
      for (const part of partArray) {
        allParts.push(part)
      }
    }

    const totalSize = allParts.reduce((sum, part) => sum + part.length, 0)
    const result = new Uint8Array(totalSize)

    let offset = 0
    for (const part of allParts) {
      result.set(part, offset)
      offset += part.length
    }

    return result
  }

  /**
   * Calculate Merkle root with wide binary tree
   */
  private merklizeWideBinary(data: Uint8Array): string {
    // TODO: Implement proper wide binary Merkle tree
    // For now, use simple hash
    return blake2bHash(data)
  }

  /**
   * Calculate segment root according to Gray Paper
   */
  private calculateSegmentRoot(exports: Uint8Array[]): string {
    // According to Gray Paper, the segment root is calculated as:
    // merklize_cd(exports) - constant depth Merkle tree

    if (exports.length === 0) {
      return '0x0000000000000000000000000000000000000000000000000000000000000000'
    }

    return this.merklizeConstantDepth(exports)
  }

  /**
   * Calculate constant depth Merkle root
   */
  private merklizeConstantDepth(segments: Uint8Array[]): string {
    // Simple Merkle root calculation (for now, just hash all hashes together)
    if (segments.length === 0) {
      return '0x0000000000000000000000000000000000000000000000000000000000000000'
    }

    const hashes = segments.map((segment) => blake2bHash(segment))
    // For simplicity, just hash all hashes together
    const combinedHashes = new TextEncoder().encode(hashes.join(''))
    return blake2bHash(combinedHashes)
  }

  /**
   * Calculate hash using Blake2b
   */
  private calculateHash(data: Uint8Array): string {
    return blake2bHash(data)
  }
}
