// /**
//  * CE 134: Work Package Sharing Protocol
//  *
//  * Implements the work package sharing protocol for JAMNP-S
//  * This is a Common Ephemeral (CE) stream for guarantors to share work packages.
//  */

// import type { WorkStore } from '@pbnj/state'
// import type {
//   StreamInfo,
//   WorkPackage,
//   WorkPackageSharing,
//   WorkPackageSharingResponse,
// } from '@pbnj/types'
// import { NetworkingProtocol } from './protocol';
// import type { Hex } from 'viem';
// import type { SafePromise } from '@pbnj/core';

// /**
//  * Work package sharing protocol handler
//  */
// export class WorkPackageSharingProtocol extends NetworkingProtocol<
//   WorkPackageSharing,
//   WorkPackageSharingResponse
// > {
//   private workPackageBundles: Map<
//     Hex,
//     { bundle: WorkPackage; coreIndex: bigint; timestamp: bigint }
//   > = new Map()
//   private segmentsRootMappings: Map<Hex, Hex> = new Map()
//   private workStore: WorkStore

//   constructor(workStore: WorkStore) {
//     super()
//     this.workStore = workStore
//   }

//   /**
//    * Store work package bundle in local store and persist to database
//    */
//   async storeWorkPackageBundle(
//     bundleHash: Hex,
//     bundle: WorkPackage,
//     coreIndex: bigint,
//   ): Promise<void> {
//     this.workPackageBundles.set(bundleHash, {
//       bundle,
//       coreIndex,
//       timestamp: BigInt(Date.now()),
//     })

//     // Persist to database if available
//     await this.workStore.storeWorkPackage(bundle, 'pending', Number(coreIndex))
//   }

//   /**
//    * Store segments root mapping in local store and persist to database
//    */
//   async storeSegmentsRootMapping(
//     workPackageHash: Hex,
//     segmentsRoot: Hex,
//   ): Promise<void> {
//     this.segmentsRootMappings.set(workPackageHash, segmentsRoot)

//     // Persist to database if available
//     await this.workStore.storeSegmentsRootMapping(workPackageHash, segmentsRoot)
//   }

//   /**
//    * Get work package bundle from local store
//    */
//   getWorkPackageBundle(
//     bundleHash: Hex,
//   ): { bundle: WorkPackage; coreIndex: bigint; timestamp: bigint } | undefined {
//     return this.workPackageBundles.get(bundleHash)
//   }

//   /**
//    * Get segments root mapping from local store
//    */
//   getSegmentsRootMapping(workPackageHash: Hex): Hex | undefined {
//     return this.segmentsRootMappings.get(workPackageHash)
//   }

//   /**
//    * Process work package sharing
//    */
//   async processRequest(
//     sharing: WorkPackageSharing,
//   ): SafePromise<WorkPackageSharingResponse> {
//       // Store segments root mappings
//       for (const mapping of sharing.segmentsRootMappings) {
//         await this.storeSegmentsRootMapping(
//           mapping.workPackageHash,
//           mapping.segmentsRoot,
//         )
//       }

//       await this.storeWorkPackageBundle(
//         sharing.workPackageBundle,
//         sharing.coreIndex,
//       )

//       console.log(
//         `Processed work package sharing for core ${sharing.coreIndex}`,
//       )

//       // Create response (placeholder)
//       return {
//         workReportHash: Buffer.from('placeholder_work_report_hash'),
//         signature: Buffer.from('placeholder_signature'),
//       }
//   }

//   /**
//    * Create work package sharing message
//    */
//   createWorkPackageSharing(
//     coreIndex: bigint,
//     segmentsRootMappings: Array<{
//       workPackageHash: Uint8Array
//       segmentsRoot: Uint8Array
//     }>,
//     workPackageBundle: Uint8Array,
//   ): WorkPackageSharing {
//     return {
//       coreIndex,
//       segmentsRootMappings,
//       workPackageBundle,
//     }
//   }

//   /**
//    * Serialize work package sharing message
//    */
//   serializeWorkPackageSharing(sharing: WorkPackageSharing): Uint8Array {
//     // Calculate total size
//     let totalSize = 4 + 4 // coreIndex + number of mappings

//     // Size for segments root mappings
//     for (const _mapping of sharing.segmentsRootMappings) {
//       totalSize += 32 + 32 // workPackageHash + segmentsRoot
//     }

//     // Size for work package bundle
//     totalSize += 4 + sharing.workPackageBundle.length // bundle length + bundle data

//     const buffer = new ArrayBuffer(totalSize)
//     const view = new DataView(buffer)
//     let offset = 0

//     // Write core index (4 bytes, little-endian)
//     view.setUint32(offset, Number(sharing.coreIndex), true)
//     offset += 4

//     // Write number of segments root mappings (4 bytes, little-endian)
//     view.setUint32(offset, sharing.segmentsRootMappings.length, true)
//     offset += 4

//     // Write segments root mappings
//     for (const mapping of sharing.segmentsRootMappings) {
//       // Write work package hash (32 bytes)
//       new Uint8Array(buffer).set(mapping.workPackageHash, offset)
//       offset += 32

//       // Write segments root (32 bytes)
//       new Uint8Array(buffer).set(mapping.segmentsRoot, offset)
//       offset += 32
//     }

//     // Write work package bundle length (4 bytes, little-endian)
//     view.setUint32(offset, sharing.workPackageBundle.length, true)
//     offset += 4

//     // Write work package bundle data
//     new Uint8Array(buffer).set(sharing.workPackageBundle, offset)

//     return new Uint8Array(buffer)
//   }

//   /**
//    * Deserialize work package sharing message
//    */
//   deserializeWorkPackageSharing(data: Uint8Array): WorkPackageSharing {
//     const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
//     let offset = 0

//     // Read core index (4 bytes, little-endian)
//     const coreIndex = view.getUint32(offset, true)
//     offset += 4

//     // Read number of segments root mappings (4 bytes, little-endian)
//     const numMappings = view.getUint32(offset, true)
//     offset += 4

//     // Read segments root mappings
//     const segmentsRootMappings: Array<{
//       workPackageHash: Uint8Array
//       segmentsRoot: Uint8Array
//     }> = []
//     for (let i = 0; i < numMappings; i++) {
//       // Read work package hash (32 bytes)
//       const workPackageHash = data.slice(offset, offset + 32)
//       offset += 32

//       // Read segments root (32 bytes)
//       const segmentsRoot = data.slice(offset, offset + 32)
//       offset += 32

//       segmentsRootMappings.push({ workPackageHash, segmentsRoot })
//     }

//     // Read work package bundle length (4 bytes, little-endian)
//     const bundleLength = view.getUint32(offset, true)
//     offset += 4

//     // Read work package bundle data
//     const workPackageBundle = data.slice(offset, offset + bundleLength)

//     return {
//       coreIndex: BigInt(coreIndex),
//       segmentsRootMappings,
//       workPackageBundle,
//     }
//   }

//   /**
//    * Handle incoming stream data
//    */
//   async handleStreamData(
//     _stream: StreamInfo,
//     data: Uint8Array,
//   ): Promise<WorkPackageSharingResponse | null> {
//     try {
//       const sharing = this.deserializeWorkPackageSharing(data)
//       return await this.processWorkPackageSharing(sharing)
//     } catch (error) {
//       console.error('Failed to handle work package sharing stream data:', error)
//       return null
//     }
//   }
// }
