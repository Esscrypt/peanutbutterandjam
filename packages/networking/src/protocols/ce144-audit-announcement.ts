// /**
//  * CE 144: Audit Announcement Protocol
//  *
//  * Implements the audit announcement protocol for JAMNP-S
//  * This is a Common Ephemeral (CE) stream for announcing audit requirements.
//  */

// import type { NetworkingStore } from '@pbnj/state'
// import type { AuditAnnouncement, StreamInfo } from '@pbnj/types'

// /**
//  * Audit announcement protocol handler
//  */
// export class AuditAnnouncementProtocol {
//   private auditAnnouncements: Map<
//     string,
//     {
//       headerHash: Uint8Array
//       tranche: bigint
//       announcement: {
//         workReports: Array<{ coreIndex: bigint; workReportHash: Uint8Array }>
//         signature: Uint8Array
//       }
//       evidence: Uint8Array
//       timestamp: number
//     }
//   > = new Map()
//   private dbIntegration: NetworkingStore | null = null

//   constructor(dbIntegration?: NetworkingStore) {
//     this.dbIntegration = dbIntegration || null
//   }

//   /**
//    * Set database integration for persistent storage
//    */
//   setDatabaseIntegration(dbIntegration: NetworkingStore): void {
//     this.dbIntegration = dbIntegration
//   }

//   /**
//    * Load state from database
//    */
//   async loadState(): Promise<void> {
//     if (!this.dbIntegration) return

//     try {
//       // Load audit announcements from database (service ID 13 for audit announcements)
//       console.log(
//         'Audit announcement state loading - protocol not yet fully implemented',
//       )
//     } catch (error) {
//       console.error(
//         'Failed to load audit announcement state from database:',
//         error,
//       )
//     }
//   }

//   /**
//    * Store audit announcement in local store and persist to database
//    */
//   async storeAuditAnnouncement(
//     headerHash: Uint8Array,
//     tranche: bigint,
//     announcement: {
//       workReports: Array<{ coreIndex: bigint; workReportHash: Uint8Array }>
//       signature: Uint8Array
//     },
//     evidence: Uint8Array,
//   ): Promise<void> {
//     const hashString = headerHash.toString()
//     this.auditAnnouncements.set(hashString, {
//       headerHash,
//       tranche,
//       announcement,
//       evidence,
//       timestamp: Date.now(),
//     })

//     // Persist to database if available
//     if (this.dbIntegration) {
//       try {
//         // Store audit announcement data
//         const announcementData = {
//           headerHash: Buffer.from(headerHash).toString('hex'),
//           tranche,
//           announcement: {
//             workReports: announcement.workReports.map((wr) => ({
//               coreIndex: wr.coreIndex,
//               workReportHash: Buffer.from(wr.workReportHash).toString('hex'),
//             })),
//             signature: Buffer.from(announcement.signature).toString('hex'),
//           },
//           evidence: Buffer.from(evidence).toString('hex'),
//           timestamp: Date.now(),
//         }

//         await this.dbIntegration.setServiceStorage(
//           `audit_announcement_${hashString}`,
//           Buffer.from(JSON.stringify(announcementData), 'utf8'),
//         )
//       } catch (error) {
//         console.error(
//           'Failed to persist audit announcement to database:',
//           error,
//         )
//       }
//     }
//   }

//   /**
//    * Get audit announcement from local store
//    */
//   getAuditAnnouncement(headerHash: Uint8Array):
//     | {
//         headerHash: Uint8Array
//         tranche: bigint
//         announcement: {
//           workReports: Array<{ coreIndex: bigint; workReportHash: Uint8Array }>
//           signature: Uint8Array
//         }
//         evidence: Uint8Array
//         timestamp: number
//       }
//     | undefined {
//     return this.auditAnnouncements.get(headerHash.toString())
//   }

//   /**
//    * Get audit announcement from database if not in local store
//    */
//   async getAuditAnnouncementFromDatabase(headerHash: Uint8Array): Promise<{
//     headerHash: Uint8Array
//     tranche: bigint
//     announcement: {
//       workReports: Array<{ coreIndex: bigint; workReportHash: Uint8Array }>
//       signature: Uint8Array
//     }
//     evidence: Uint8Array
//     timestamp: number
//   } | null> {
//     if (this.getAuditAnnouncement(headerHash)) {
//       return this.getAuditAnnouncement(headerHash) || null
//     }

//     if (!this.dbIntegration) return null

//     try {
//       const hashString = headerHash.toString()
//       const announcementData = await this.dbIntegration.getServiceStorage(
//         `audit_announcement_${hashString}`,
//       )

//       if (announcementData) {
//         const parsedData = JSON.parse(announcementData.toString())
//         const announcement = {
//           headerHash: Buffer.from(parsedData.headerHash, 'hex'),
//           tranche: parsedData.tranche,
//           announcement: {
//             workReports: parsedData.announcement.workReports.map(
//               (wr: { coreIndex: bigint; workReportHash: string }) => ({
//                 coreIndex: wr.coreIndex,
//                 workReportHash: Buffer.from(wr.workReportHash, 'hex'),
//               }),
//             ),
//             signature: Buffer.from(parsedData.announcement.signature, 'hex'),
//           },
//           evidence: Buffer.from(parsedData.evidence, 'hex'),
//           timestamp: parsedData.timestamp,
//         }

//         // Cache in local store
//         this.auditAnnouncements.set(hashString, announcement)
//         return announcement
//       }

//       return null
//     } catch (error) {
//       console.error('Failed to get audit announcement from database:', error)
//       return null
//     }
//   }

//   /**
//    * Process audit announcement
//    */
//   async processAuditAnnouncement(
//     announcement: AuditAnnouncement,
//   ): Promise<void> {
//     try {
//       // Store the audit announcement
//       await this.storeAuditAnnouncement(
//         announcement.headerHash,
//         announcement.tranche,
//         announcement.announcement,
//         announcement.evidence,
//       )

//       console.log(
//         `Processed audit announcement for header hash: ${announcement.headerHash.toString().substring(0, 16)}..., tranche: ${announcement.tranche}`,
//       )
//     } catch (error) {
//       console.error('Failed to process audit announcement:', error)
//     }
//   }

//   /**
//    * Create audit announcement message
//    */
//   createAuditAnnouncement(
//     headerHash: Uint8Array,
//     tranche: bigint,
//     announcement: {
//       workReports: Array<{ coreIndex: bigint; workReportHash: Uint8Array }>
//       signature: Uint8Array
//     },
//     evidence: Uint8Array,
//   ): AuditAnnouncement {
//     return {
//       headerHash,
//       tranche,
//       announcement,
//       evidence,
//     }
//   }

//   /**
//    * Serialize audit announcement message
//    */
//   serializeAuditAnnouncement(announcement: AuditAnnouncement): Uint8Array {
//     // Calculate total size
//     let totalSize = 32 + 4 + 4 // headerHash + tranche + number of work reports

//     // Size for work reports
//     for (const _workReport of announcement.announcement.workReports) {
//       totalSize += 4 + 32 // coreIndex + workReportHash
//     }

//     // Size for signature and evidence
//     totalSize += 64 + 4 + announcement.evidence.length // signature + evidence length + evidence

//     const buffer = new ArrayBuffer(totalSize)
//     const view = new DataView(buffer)
//     let offset = 0

//     // Write header hash (32 bytes)
//     new Uint8Array(buffer).set(announcement.headerHash, offset)
//     offset += 32

//     // Write tranche (4 bytes, little-endian)
//     view.setUint32(offset, Number(announcement.tranche), true)
//     offset += 4

//     // Write number of work reports (4 bytes, little-endian)
//     view.setUint32(offset, announcement.announcement.workReports.length, true)
//     offset += 4

//     // Write work reports
//     for (const workReport of announcement.announcement.workReports) {
//       // Write core index (4 bytes, little-endian)
//       view.setUint32(offset, Number(workReport.coreIndex), true)
//       offset += 4

//       // Write work report hash (32 bytes)
//       new Uint8Array(buffer).set(workReport.workReportHash, offset)
//       offset += 32
//     }

//     // Write signature (64 bytes for Ed25519)
//     new Uint8Array(buffer).set(announcement.announcement.signature, offset)
//     offset += 64

//     // Write evidence length (4 bytes, little-endian)
//     view.setUint32(offset, announcement.evidence.length, true)
//     offset += 4

//     // Write evidence data
//     new Uint8Array(buffer).set(announcement.evidence, offset)

//     return new Uint8Array(buffer)
//   }

//   /**
//    * Deserialize audit announcement message
//    */
//   deserializeAuditAnnouncement(data: Uint8Array): AuditAnnouncement {
//     const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
//     let offset = 0

//     // Read header hash (32 bytes)
//     const headerHash = data.slice(offset, offset + 32)
//     offset += 32

//     // Read tranche (4 bytes, little-endian)
//     const tranche = view.getUint32(offset, true)
//     offset += 4

//     // Read number of work reports (4 bytes, little-endian)
//     const numWorkReports = view.getUint32(offset, true)
//     offset += 4

//     // Read work reports
//     const workReports: Array<{
//       coreIndex: bigint
//       workReportHash: Uint8Array
//     }> = []
//     for (let i = 0; i < numWorkReports; i++) {
//       // Read core index (4 bytes, little-endian)
//       const coreIndex = BigInt(view.getUint32(offset, true))
//       offset += 4

//       // Read work report hash (32 bytes)
//       const workReportHash = data.slice(offset, offset + 32)
//       offset += 32

//       workReports.push({ coreIndex: BigInt(coreIndex), workReportHash })
//     }

//     // Read signature (64 bytes for Ed25519)
//     const signature = data.slice(offset, offset + 64)
//     offset += 64

//     // Read evidence length (4 bytes, little-endian)
//     const evidenceLength = view.getUint32(offset, true)
//     offset += 4

//     // Read evidence data
//     const evidence = data.slice(offset, offset + evidenceLength)

//     return {
//       headerHash,
//       tranche: BigInt(tranche),
//       announcement: {
//         workReports,
//         signature,
//       },
//       evidence,
//     }
//   }

//   /**
//    * Handle incoming stream data
//    */
//   async handleStreamData(_stream: StreamInfo, data: Uint8Array): Promise<void> {
//     try {
//       const announcement = this.deserializeAuditAnnouncement(data)
//       await this.processAuditAnnouncement(announcement)
//     } catch (error) {
//       console.error('Failed to handle audit announcement stream data:', error)
//     }
//   }
// }
