// /**
//  * Work Package Processor
//  *
//  * Processes work packages and generates work reports according to JAM Protocol
//  * Reference: Gray Paper work package specifications
//  */

// import {
//   blake2bHash,
//   concatBytes,
//   type Hex,
//   hexToBytes,
//   logger,
//   type Safe,
//   type SafePromise,
//   safeError,
//   safeResult,
//   zeroHash,
// } from '@pbnj/core'
// import type {
//   AvailabilitySpec,
//   ExtrinsicReference,
//   WorkError,
//   WorkItem,
//   WorkPackage,
//   WorkReport,
//   WorkResult,
// } from '@pbnj/types'
// import { BaseService } from '@pbnj/types'

// /**
//  * Work Package Processor
//  */
// export class WorkPackageProcessor extends BaseService {
//   /**
//    * Process work packages
//    */
//   async process(
//     packages: WorkPackage[],
//     _config: BlockAuthoringConfig,
//   ): SafePromise<WorkReport[]> {
//     const reports: WorkReport[] = []

//     for (const workPackage of packages) {
//       // Validate work package
//       const validationResult = this.validateWorkPackage(workPackage)

//       if (!validationResult.valid) {
//         logger.error('Work package validation failed', {
//           errors: validationResult.errors,
//         })
//         continue
//       }

//       // Process work package
//       const [reportError, report] = await this.processWorkPackage(
//         workPackage,
//         _config,
//       )
//       if (reportError) {
//         logger.error('Failed to process work package', {
//           error: reportError,
//         })
//         continue
//       }
//       reports.push(report)
//     }

//     return safeResult(reports)
//   }

//   /**
//    * Validate work package according to Gray Paper
//    */
//   private validateWorkPackage(workPackage: WorkPackage): {
//     valid: boolean
//     errors: string[]
//   } {
//     const errors: string[] = []

//     // Check work items count
//     if (
//       workPackage.workItems.length === 0 ||
//       workPackage.workItems.length > GRAY_PAPER_CONSTANTS.MAX_PACKAGE_ITEMS
//     ) {
//       errors.push(`Invalid work items count: ${workPackage.workItems.length}`)
//     }

//     // Check total exports
//     const totalExports = workPackage.workItems.reduce(
//       (sum, item) => sum + item.exportcount,
//       0n,
//     )
//     if (totalExports > GRAY_PAPER_CONSTANTS.MAX_PACKAGE_EXPORTS) {
//       errors.push(
//         `Total exports exceed limit: ${totalExports} > ${GRAY_PAPER_CONSTANTS.MAX_PACKAGE_EXPORTS}`,
//       )
//     }

//     // Check total imports
//     const totalImports = workPackage.workItems.reduce(
//       (sum, item) => sum + BigInt(item.importsegments.length),
//       0n,
//     )
//     if (totalImports > GRAY_PAPER_CONSTANTS.MAX_PACKAGE_IMPORTS) {
//       errors.push(
//         `Total imports exceed limit: ${totalImports} > ${GRAY_PAPER_CONSTANTS.MAX_PACKAGE_IMPORTS}`,
//       )
//     }

//     // Check total extrinsics
//     const totalExtrinsics = workPackage.workItems.reduce(
//       (sum, item) => sum + BigInt(item.extrinsics.length),
//       0n,
//     )
//     if (totalExtrinsics > GRAY_PAPER_CONSTANTS.MAX_PACKAGE_EXTRINSICS) {
//       errors.push(
//         `Total extrinsics exceed limit: ${totalExtrinsics} > ${GRAY_PAPER_CONSTANTS.MAX_PACKAGE_EXTRINSICS}`,
//       )
//     }

//     // Check bundle size
//     const bundleSize = this.calculateBundleSize(workPackage)
//     if (bundleSize > GRAY_PAPER_CONSTANTS.MAX_BUNDLE_SIZE) {
//       errors.push(
//         `Bundle size exceeds limit: ${bundleSize} > ${GRAY_PAPER_CONSTANTS.MAX_BUNDLE_SIZE}`,
//       )
//     }

//     // Check gas limits
//     const totalRefGas = workPackage.workItems.reduce(
//       (sum, item) => sum + item.refgaslimit,
//       0n,
//     )
//     if (totalRefGas > GRAY_PAPER_CONSTANTS.MAX_PACKAGE_REF_GAS) {
//       errors.push(
//         `Total ref gas exceeds limit: ${totalRefGas} > ${GRAY_PAPER_CONSTANTS.MAX_PACKAGE_REF_GAS}`,
//       )
//     }

//     const totalAccGas = workPackage.workItems.reduce(
//       (sum, item) => sum + item.accgaslimit,
//       0n,
//     )
//     if (totalAccGas > GRAY_PAPER_CONSTANTS.MAX_REPORT_ACC_GAS) {
//       errors.push(
//         `Total acc gas exceeds limit: ${totalAccGas} > ${GRAY_PAPER_CONSTANTS.MAX_REPORT_ACC_GAS}`,
//       )
//     }

//     return {
//       valid: errors.length === 0,
//       errors,
//     }
//   }

//   /**
//    * Calculate bundle size according to Gray Paper equation
//    */
//   private calculateBundleSize(workPackage: WorkPackage): bigint {
//     let size =
//       BigInt(workPackage.authToken.length) +
//       BigInt(workPackage.authConfig.length)

//     for (const item of workPackage.workItems) {
//       size += BigInt(item.payload.length)
//       size +=
//         BigInt(item.importsegments.length) * GRAY_PAPER_CONSTANTS.SEGMENT_SIZE
//       size += item.extrinsics.reduce((sum, ref) => sum + BigInt(ref.length), 0n)
//     }

//     return size
//   }

//   /**
//    * Process a single work package
//    */
//   private processWorkPackage(
//     workPackage: WorkPackage,
//     _config: BlockAuthoringConfig,
//   ): Safe<WorkReport> {
//     // Calculate authorizer hash
//     const [authorizerHashError, authorizerHash] =
//       this.calculateAuthorizerHash(workPackage)
//     if (authorizerHashError) {
//       return safeError(authorizerHashError)
//     }

//     // Process each work item
//     const workDigests: WorkDigest[] = []
//     const allExports: Uint8Array[] = []

//     for (let i = 0; i < workPackage.workItems.length; i++) {
//       const workItem = workPackage.workItems[i]

//       let shouldCreateErrorDigest = false

//       // Execute work item
//       const [resultError, result] = this.executeWorkItem(
//         workItem,
//         workPackage,
//         i,
//       )
//       if (resultError) {
//         shouldCreateErrorDigest = true
//       }

//       if (result) {
//         // Create work digest
//         const [digestError, digest] = this.createWorkDigest(workItem, result)
//         if (digestError) {
//           shouldCreateErrorDigest = true
//         }
//         if (digest) {
//           workDigests.push(digest)
//         }

//         // Add exports
//         allExports.push(result as Uint8Array)
//       }

//       if (!shouldCreateErrorDigest) {
//         continue
//       }
//       // Create error digest
//       const [errorDigestError, errorDigest] = this.createErrorDigest(
//         workItem,
//         'BAD',
//       )
//       if (errorDigestError) {
//         return safeError(errorDigestError)
//       }
//       workDigests.push(errorDigest)

//       // Add zero exports
//       const zeroExports = new Array(Number(workItem.exportcount)).fill(
//         new Uint8Array(Number(GRAY_PAPER_CONSTANTS.SEGMENT_SIZE)),
//       )
//       allExports.push(...zeroExports)
//     }

//     // Create availability specification
//     const [availabilitySpecError, availabilitySpec] =
//       this.createAvailabilitySpec(workPackage, allExports)
//     if (availabilitySpecError) {
//       return safeError(availabilitySpecError)
//     }

//     // Create work report
//     const report: WorkReport = {
//       availabilitySpec,
//       context: workPackage.context,
//       coreIndex: 0n, // TODO: Get from context
//       authorizer: authorizerHash,
//       authTrace: new Uint8Array(), // TODO: Implement authorization trace
//       srLookup: new Map(), // TODO: Implement segment root lookup
//       digests: workDigests,
//       authGasUsed: 0n, // TODO: Track authorization gas
//     }

//     return safeResult(report)
//   }

//   /**
//    * Calculate authorizer hash according to Gray Paper
//    */
//   private calculateAuthorizerHash(workPackage: WorkPackage): Safe<Hex> {
//     const authCodeHash = workPackage.authCodeHash
//     const authConfig = workPackage.authConfig

//     // Convert authCodeHash string to Uint8Array
//     const authCodeHashBytes = hexToBytes(authCodeHash)

//     // Convert authConfig string to Uint8Array
//     const authConfigBytes = hexToBytes(authConfig)

//     // Concatenate auth code hash and config
//     const combined = new Uint8Array(
//       authCodeHashBytes.length + authConfigBytes.length,
//     )
//     combined.set(authCodeHashBytes)
//     combined.set(authConfigBytes, authCodeHashBytes.length)

//     // Calculate Blake2b hash
//     return blake2bHash(combined)
//   }

//   /**
//    * Execute a work item using PVM
//    */
//   private executeWorkItem(
//     workItem: WorkItem,
//     _workPackage: WorkPackage,
//     itemIndex: number,
//   ): Safe<WorkResult> {
//     logger.debug('Executing work item', {
//       itemIndex,
//       serviceIndex: workItem.serviceindex,
//     })

//     // TODO: Implement PVM execution
//     // This would involve:
//     // 1. Loading the service code
//     // 2. Setting up PVM state
//     // 3. Executing the Refine function
//     // 4. Collecting results and exports

//     // Placeholder implementation
//     //TODO: Implement proper PVM execution
//     const result: WorkResult = new Uint8Array(Number(workItem.exportcount))

//     return safeResult(result)
//   }

//   /**
//    * Create work digest according to Gray Paper item-to-digest function
//    */
//   private createWorkDigest(
//     workItem: WorkItem,
//     result: WorkResult | WorkError,
//   ): Safe<WorkDigest> {
//     // Calculate payload hash
//     const [payloadHashError, payloadHash] = blake2bHash(
//       hexToBytes(workItem.payload),
//     )
//     if (payloadHashError) {
//       return safeError(payloadHashError)
//     }

//     // Calculate extrinsic size
//     const extrinsicSize = workItem.extrinsics.reduce(
//       (sum: bigint, ref: ExtrinsicReference) => sum + BigInt(ref.length),
//       0n,
//     )

//     return safeResult({
//       serviceIndex: workItem.serviceindex,
//       codeHash: workItem.codehash,
//       payloadHash,
//       gasLimit: workItem.accgaslimit,
//       result: result as WorkResult,
//       gasUsed: 0n, // TODO
//       importCount: BigInt(workItem.importsegments.length),
//       exportCount: workItem.exportcount,
//       extrinsicCount: BigInt(workItem.extrinsics.length),
//       extrinsicSize: BigInt(extrinsicSize),
//     })
//   }

//   /**
//    * Create error digest for failed work items
//    */
//   private createErrorDigest(
//     workItem: WorkItem,
//     error: WorkError,
//   ): Safe<WorkDigest> {
//     const [payloadHashError, payloadHash] = blake2bHash(
//       hexToBytes(workItem.payload),
//     )
//     if (payloadHashError) {
//       return safeError(payloadHashError)
//     }
//     return safeResult({
//       serviceIndex: workItem.serviceindex,
//       codeHash: workItem.codehash,
//       payloadHash,
//       gasLimit: workItem.accgaslimit,
//       result: error,
//       gasUsed: 0n,
//       importCount: BigInt(workItem.importsegments.length),
//       exportCount: workItem.exportcount,
//       extrinsicCount: BigInt(workItem.extrinsics.length),
//       extrinsicSize: workItem.extrinsics.reduce(
//         (sum: bigint, ref: ExtrinsicReference) => sum + BigInt(ref.length),
//         0n,
//       ),
//     })
//   }

//   /**
//    * Create availability specification according to Gray Paper
//    */
//   private createAvailabilitySpec(
//     workPackage: WorkPackage,
//     exports: Uint8Array[],
//   ): Safe<AvailabilitySpec> {
//     // Calculate package hash
//     const [packageHashError, packageHash] = blake2bHash(
//       hexToBytes(workPackage.authToken),
//     )
//     if (packageHashError) {
//       return safeError(packageHashError)
//     }

//     // Create bundle (work package + extrinsic data + import segments)
//     const bundle = this.createBundle(workPackage)
//     const bundleLength = BigInt(bundle.length)

//     // Calculate erasure root
//     const [erasureRootError, erasureRoot] = this.calculateErasureRoot(
//       bundle,
//       exports,
//     )
//     if (erasureRootError) {
//       return safeError(erasureRootError)
//     }

//     // Calculate segment root
//     const [segmentRootError, segmentRoot] = this.calculateSegmentRoot(exports)
//     if (segmentRootError) {
//       return safeError(segmentRootError)
//     }

//     return safeResult({
//       packageHash,
//       bundleLength,
//       erasureRoot,
//       segmentRoot,
//       segmentCount: BigInt(exports.length),
//     })
//   }

//   /**
//    * Create bundle according to Gray Paper
//    */
//   private createBundle(workPackage: WorkPackage): Uint8Array {
//     // According to Gray Paper, the bundle should contain:
//     // - Work package
//     // - Extrinsic data
//     // - Import segments
//     // - Justification data

//     const bundleParts: Uint8Array[] = []

//     // 1. Work package data
//     const workPackageData = hexToBytes(workPackage.authToken)
//     bundleParts.push(workPackageData)

//     // 2. Extrinsic data for all work items
//     for (const workItem of workPackage.workItems) {
//       for (const extRef of workItem.extrinsics) {
//         // TODO: Fetch actual extrinsic data from hash
//         // For now, create placeholder data
//         const extrinsicData = new Uint8Array(Number(extRef.length))
//         bundleParts.push(extrinsicData)
//       }
//     }

//     // 3. Import segments for all work items
//     for (const workItem of workPackage.workItems) {
//       for (const _importSeg of workItem.importsegments) {
//         // TODO: Fetch actual import segment data from hash
//         // For now, create placeholder data
//         const segmentData = new Uint8Array(
//           Number(GRAY_PAPER_CONSTANTS.SEGMENT_SIZE),
//         )
//         bundleParts.push(segmentData)
//       }
//     }

//     // 4. Justification data (Merkle proofs for import segments)
//     for (const workItem of workPackage.workItems) {
//       for (const _importSeg of workItem.importsegments) {
//         // TODO: Generate actual Merkle proofs
//         // For now, create placeholder proof data
//         const proofData = new Uint8Array(256) // Typical Merkle proof size
//         bundleParts.push(proofData)
//       }
//     }

//     // Concatenate all parts
//     const totalSize = bundleParts.reduce((sum, part) => sum + part.length, 0)
//     const bundle = new Uint8Array(totalSize)

//     let offset = 0
//     for (const part of bundleParts) {
//       bundle.set(part, offset)
//       offset += part.length
//     }

//     return bundle
//   }

//   /**
//    * Calculate erasure root according to Gray Paper
//    */
//   private calculateErasureRoot(
//     bundle: Uint8Array,
//     exports: Uint8Array[],
//   ): Safe<Hex> {
//     // According to Gray Paper, the erasure root is calculated as:
//     // merklize_wb(concat_all(transpose([bundle_erasure_coded, exports_erasure_coded])))

//     // 1. Erasure code the bundle
//     const bundleErasureCoded = this.erasureCode(bundle)

//     // 2. Erasure code the exports
//     const exportsErasureCoded = this.erasureCodeExports(exports)

//     // 3. Transpose the erasure-coded data
//     const transposed = this.transposeErasureCoded(
//       bundleErasureCoded,
//       exportsErasureCoded,
//     )

//     // 4. Concatenate all parts
//     const concatenated = concatBytes(transposed.flat())

//     // 5. Calculate Merkle root with wide binary tree
//     return this.merklizeWideBinary(concatenated)
//   }

//   /**
//    * Erasure code data according to Gray Paper
//    */
//   private erasureCode(data: Uint8Array): Uint8Array[] {
//     // TODO: Implement proper erasure coding
//     // This should use the erasure coding function from Gray Paper
//     // For now, return the original data as a single piece

//     return [data]
//   }

//   /**
//    * Erasure code exports according to Gray Paper
//    */
//   private erasureCodeExports(exports: Uint8Array[]): Uint8Array[] {
//     // TODO: Implement proper erasure coding for exports
//     // This should use the erasure coding function with paged proofs
//     // For now, return the original exports

//     return exports
//   }

//   /**
//    * Transpose erasure-coded data
//    */
//   private transposeErasureCoded(
//     bundleCoded: Uint8Array[],
//     exportsCoded: Uint8Array[],
//   ): Uint8Array[][] {
//     // TODO: Implement proper transposition
//     // For now, return a simple structure
//     return [bundleCoded, exportsCoded]
//   }

//   /**
//    * Calculate Merkle root with wide binary tree
//    */
//   private merklizeWideBinary(data: Uint8Array): Safe<Hex> {
//     // TODO: Implement proper wide binary Merkle tree
//     // For now, use simple hash
//     return blake2bHash(data)
//   }

//   /**
//    * Calculate segment root according to Gray Paper
//    */
//   private calculateSegmentRoot(exports: Uint8Array[]): Safe<Hex> {
//     // According to Gray Paper, the segment root is calculated as:
//     // merklize_cd(exports) - constant depth Merkle tree

//     if (exports.length === 0) {
//       return safeResult(zeroHash)
//     }

//     return this.merklizeConstantDepth(exports)
//   }

//   /**
//    * Calculate constant depth Merkle root
//    */
//   private merklizeConstantDepth(segments: Uint8Array[]): Safe<Hex> {
//     // Simple Merkle root calculation (for now, just hash all hashes together)
//     if (segments.length === 0) {
//       return safeResult(zeroHash)
//     }

//     const hashResults = segments.map((segment) => blake2bHash(segment))
//     const hashes: Hex[] = []
//     for (const [error, hash] of hashResults) {
//       if (error) {
//         return safeError(error)
//       }
//       hashes.push(hash)
//     }
//     // return merklize(hashes)
//     //TODO: Fix this
//     return safeResult(hashes[0])
//   }
// }
