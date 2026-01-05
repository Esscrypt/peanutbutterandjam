// /**
//  * Audit Service
//  *
//  * Implements audit announcement creation and management according to Gray Paper specifications.
//  * Handles audit triggering based on work reports becoming available and tranche timing.
//  *
//  * Gray Paper Reference: auditing.tex
//  * - Audits are triggered when work reports become available (justbecameavailable)
//  * - New tranches begin every Ctrancheseconds = 8 seconds
//  * - Additional audits triggered by negative judgments or insufficient judgments
//  */

// import {
//   generateAuditSignature,
//   selectAuditTranche0,
//   selectAuditTrancheN,
//   verifyAnnouncementSignature,
//   verifyBandersnatchVRFEvidence,
//   verifyTranche0AuditSignature,
//   verifyTrancheNAuditSignature,
//   verifyWorkReportSelection,
// } from '@pbnjam/audit'
// import {
//   type AuditTrancheEvent,
//   type EventBusService,
//   hexToBytes,
//   logger,
//   type Safe,
//   type SafePromise,
//   safeError,
//   safeResult,
// } from '@pbnjam/core'
// import type { AuditAnnouncement, Judgment, WorkReport } from '@pbnjam/types'
// import { BaseService } from '@pbnjam/types'
// import type { Hex } from 'viem'
// import type { ValidatorSetManager } from './validator-set'
// import type { WorkReportService } from './work-report-service'

// /**
//  * Audit Service
//  *
//  * Manages audit announcements and triggers audits according to Gray Paper specifications.
//  *
//  * Key responsibilities:
//  * - Create audit announcements for tranche 0 (Fisher-Yates shuffle)
//  * - Create audit announcements for tranche N (no-show based selection)
//  * - Trigger audits when work reports become available
//  * - Handle tranche timing (every 8 seconds)
//  * - Process negative judgments and insufficient judgment scenarios
//  */
// export class AuditService extends BaseService {
//   private readonly pendingAudits: Map<string, AuditAnnouncement> = new Map()
//   private readonly workReportsAvailable: Map<string, WorkReport[]> = new Map()
//   private readonly eventBusService: EventBusService
//   private readonly validatorSetManager: ValidatorSetManager
//   private readonly workReportService: WorkReportService
//   constructor(options: {
//     eventBusService: EventBusService
//     validatorSetManager: ValidatorSetManager
//     workReportService: WorkReportService
//   }) {
//     super('audit-service')
//     this.eventBusService = options.eventBusService
//     this.validatorSetManager = options.validatorSetManager
//     this.workReportService = options.workReportService
//     this.eventBusService.addAuditTrancheCallback(
//       this.handleAuditTranche.bind(this),
//     )
//     this.eventBusService.addWorkReportAvailableCallback(
//       this.handleWorkReportAvailable.bind(this),
//     )
//     this.eventBusService.addNegativeJudgmentReceivedCallback(
//       this.handleNegativeJudgmentReceived.bind(this),
//     )
//     this.eventBusService.addAuditAnnouncementReceivedCallback(
//       this.handleAuditAnnouncementReceived.bind(this),
//     )
//   }

//   override stop(): Safe<boolean> {
//     this.pendingAudits.clear()
//     this.workReportsAvailable.clear()

//     this.eventBusService.removeAuditTrancheCallback(
//       this.handleAuditTranche.bind(this),
//     )
//     this.eventBusService.removeWorkReportAvailableCallback(
//       this.handleWorkReportAvailable.bind(this),
//     )
//     this.eventBusService.removeNegativeJudgmentReceivedCallback(
//       this.handleNegativeJudgmentReceived.bind(this),
//     )
//     this.eventBusService.removeAuditAnnouncementReceivedCallback(
//       this.handleAuditAnnouncementReceived.bind(this),
//     )
//     return safeResult(true)
//   }

//   /**
//    * Handle work report available events
//    * Gray Paper: Audits triggered when work reports become available (justbecameavailable)
//    */
//   private readonly handleWorkReportAvailable = async (
//     workReport: WorkReport,
//     coreIndex: bigint,
//     blockHeaderHash: Hex,
//   ): SafePromise<void> => {
//     try {
//       logger.debug('Work report became available, triggering tranche 0 audit', {
//         coreIndex: coreIndex.toString(),
//         blockHeaderHash,
//         workReportHash: workReport.core_index.toString(),
//       })

//       // Store the work report for potential future tranches
//       if (!this.workReportsAvailable.has(blockHeaderHash)) {
//         this.workReportsAvailable.set(blockHeaderHash, [])
//       }
//       this.workReportsAvailable.get(blockHeaderHash)!.push(workReport)

//       // TODO: Trigger tranche 0 audit announcement
//       // This would involve:
//       // 1. Getting core work reports for this block
//       // 2. Getting bandersnatch VRF output from block header
//       // 3. Creating audit announcement for tranche 0
//       // 4. Publishing the announcement

//       logger.debug('Tranche 0 audit announcement not yet implemented')

//       return safeResult(undefined)
//     } catch (error) {
//       logger.error('Error handling work report available for audit service', {
//         error: error instanceof Error ? error.message : String(error),
//         coreIndex: coreIndex.toString(),
//         blockHeaderHash,
//       })
//       return safeError(error as Error)
//     }
//   }

//   /**
//    * Handle negative judgment received events
//    * Gray Paper: Validator is always required to audit when negative judgment is received
//    */
//   private readonly handleNegativeJudgmentReceived = async (
//     _judgment: Judgment,
//     workReportHash: Hex,
//     validatorIndex: bigint,
//   ): SafePromise<void> => {
//     try {
//       logger.info('Negative judgment received, triggering immediate audit', {
//         workReportHash,
//         validatorIndex: validatorIndex.toString(),
//       })

//       // TODO: Trigger immediate audit for this work report
//       // This would involve:
//       // 1. Finding the work report that was judged negatively
//       // 2. Creating audit announcement for immediate audit
//       // 3. Publishing the announcement

//       logger.debug('Immediate audit for negative judgment not yet implemented')

//       return safeResult(undefined)
//     } catch (error) {
//       logger.error('Error handling negative judgment for audit service', {
//         error: error instanceof Error ? error.message : String(error),
//         workReportHash,
//         validatorIndex: validatorIndex.toString(),
//       })
//       return safeError(error as Error)
//     }
//   }

//   /**
//    * Handle audit tranche events
//   /**
//    * Handle audit tranche events
//    * Gray Paper: New tranches begin every Ctrancheseconds = 8 seconds
//    */
//   private readonly handleAuditTranche = async (
//     event: AuditTrancheEvent,
//   ): SafePromise<void> => {
//     const trancheNumber = event.trancheNumber

//     if (trancheNumber === 0) {
//       this.createAuditAnnouncementTranche0(
//         event.blockHeader.hash,
//         event.coreWorkReports,
//         event.blockHeader.bandersnatchVrfOutput,
//       )
//     } else {
//       this.createAuditAnnouncementTrancheN(
//         event.headerHash,
//         event.coreWorkReports,
//         event.bandersnatchVrfOutput,
//         trancheNumber,
//         event.previousTrancheAnnouncements,
//         event.negativeJudgments,
//       )
//     }
//   }
//   /**
//    * Handle audit announcement received events
//    * Gray Paper: Monitor announcements to detect insufficient judgments
//    */
//   private readonly handleAuditAnnouncementReceived = async (
//     announcement: AuditAnnouncement,
//     peerPublicKey: Hex,
//   ): SafePromise<void> => {
//     // get the validator index from the peer public key
//     const [announcerValidatorIndexError, announcerValidatorIndex] =
//       this.validatorSetManager.getValidatorIndex(peerPublicKey)
//     if (announcerValidatorIndexError) {
//       logger.error('Failed to get announcer validator index', {
//         error: announcerValidatorIndexError,
//       })
//       return safeError(announcerValidatorIndexError)
//     }

//     // Step 1: Verify the Ed25519 announcement signature
//     const [signatureError, signatureValid] = verifyAnnouncementSignature(
//       announcement,
//       announcerValidatorIndex,
//       this.validatorSetManager,
//     )
//     if (signatureError) {
//       logger.error('Failed to verify announcement signature', {
//         error: signatureError,
//       })
//       return safeError(signatureError)
//     }
//     if (!signatureValid) {
//       logger.error('Invalid announcement signature')
//       return safeError(new Error('Invalid announcement signature'))
//     }

//     // for each work report in the announcement, get the work report from the work reports available map
//     const workReports = announcement.announcement.workReports.map(
//       (workReport) => {
//         return this.workReportService.getWorkReportByHash(
//           workReport.workReportHash,
//         )
//       },
//     )

//     // if someone tries to audit an unavailable work report, return an error

//     // Step 2: Verify the Bandersnatch VRF evidence
//     const [vrfError, vrfValid] = verifyBandersnatchVRFEvidence(
//       announcement,
//       hexToBytes(peerPublicKey),
//       workReports.map((workReport) => workReport?.workReport),
//     )
//     if (vrfError) {
//       logger.error('Failed to verify Bandersnatch VRF evidence', {
//         error: vrfError,
//       })
//       return safeError(vrfError)
//     }
//     if (!vrfValid) {
//       logger.error('Invalid Bandersnatch VRF evidence')
//       return safeError(new Error('Invalid Bandersnatch VRF evidence'))
//     }

//     // Step 3: Verify work report selection is valid
//     const [selectionError, selectionValid] = verifyWorkReportSelection(
//       announcement,
//       this.workReportsAvailable,
//       announcement.announcement.banderoutResult,
//       this.configService,
//       announcement.previousTrancheAnnouncements,
//     )
//   }

//   /**
//    * Create audit announcement for tranche 0
//    *
//    * Implements Gray Paper audit tranche selection with Fisher-Yates shuffle
//    * Gray Paper Eq. 64-68: Initial audit tranche selection
//    */
//   createAuditAnnouncementTranche0(
//     headerHash: Hex,
//     coreWorkReports: WorkReport[],
//     bandersnatchVrfOutput: Hex,
//   ): Safe<AuditAnnouncement> {
//     // get the core work reports from the work report service
//     const coreWorkReports = this.workReportService.get(coreWorkReports)
//     // Select cores for audit using Fisher-Yates shuffle
//     const selection = selectAuditTranche0(
//       coreWorkReports,
//       bandersnatchVrfOutput,
//     )

//     // Create work reports for selected cores
//     const workReports = selection.selectedCores.flatMap((core: any) =>
//       core.workReports.map((wr: any) => ({
//         coreIndex: core.coreIndex,
//         workReportHash: wr.workReportHash,
//       })),
//     )

//     // Generate audit signature evidence for tranche 0
//     const blockHeaderVrfOutput = hexToBytes(bandersnatchVrfOutput)
//     const [signatureError, auditSignature] = generateAuditSignature(
//       this.config.validatorSecretKey,
//       blockHeaderVrfOutput,
//       0n, // Tranche 0
//     )

//     if (signatureError) {
//       logger.error('Failed to generate audit signature for tranche 0', {
//         error: signatureError,
//       })
//       return safeError(signatureError)
//     }

//     // Generate Ed25519 announcement signature
//     const [signatureError, announcementSignature] =
//       generateAnnouncementSignature(
//         this.config.validatorSecretKey,
//         workReports,
//         0n,
//         headerHash,
//       )

//     if (signatureError) {
//       logger.error('Failed to generate announcement signature for tranche 0', {
//         error: signatureError,
//       })
//       return safeError(signatureError)
//     }

//     const announcement: AuditAnnouncement = {
//       headerHash,
//       tranche: 0n,
//       announcement: {
//         validatorIndex: this.config.validatorIndex,
//         workReports,
//         signature: announcementSignature,
//       },
//       evidence: auditSignature.signature,
//     }

//     // Store the announcement
//     const announcementKey = `${headerHash}-0`
//     this.pendingAudits.set(announcementKey, announcement)

//     return safeResult(announcement)
//   }

//   /**
//    * Create audit announcement for tranche N (N > 0)
//    *
//    * Implements Gray Paper tranche N selection logic
//    * Gray Paper Eq. 105: Subsequent tranche evidence
//    */
//   createAuditAnnouncementTrancheN(
//     headerHash: Hex,
//     coreWorkReports: CoreWorkReport[],
//     bandersnatchVrfOutput: Hex,
//     tranche: number,
//     previousTrancheAnnouncements: PreviousTrancheAnnouncement[],
//     negativeJudgments: NegativeJudgment[],
//   ): Safe<AuditAnnouncement> {
//     try {
//       logger.debug('Creating audit announcement for tranche N', {
//         headerHash,
//         tranche,
//         coreWorkReportsCount: coreWorkReports.length,
//         previousAnnouncementsCount: previousTrancheAnnouncements.length,
//         negativeJudgmentsCount: negativeJudgments.length,
//       })

//       // Select cores for audit using advanced selection logic
//       const selection = selectAuditTrancheN(
//         coreWorkReports,
//         bandersnatchVrfOutput,
//         tranche,
//         previousTrancheAnnouncements,
//         negativeJudgments,
//       )

//       // Create work reports for selected cores
//       const workReports = selection.selectedCores.flatMap((core: any) =>
//         core.workReports.map((wr: any) => ({
//           coreIndex: core.coreIndex,
//           workReportHash: wr.workReportHash,
//         })),
//       )

//       // Generate Ed25519 announcement signature
//       const [signatureError, announcementSignature] =
//         generateAnnouncementSignature(
//           this.config.validatorSecretKey,
//           workReports,
//           BigInt(tranche),
//           headerHash,
//         )

//       if (signatureError) {
//         logger.error(
//           'Failed to generate announcement signature for tranche N',
//           {
//             error: signatureError,
//             tranche,
//           },
//         )
//         return safeError(signatureError)
//       }

//       // Generate audit signature evidence for tranche N
//       const blockHeaderVrfOutput = hexToBytes(bandersnatchVrfOutput)

//       if (workReports.length === 0) {
//         return safeError(new Error('No work reports selected for tranche N'))
//       }

//       // TODO: Get the actual work report from the core work reports
//       // For now, we'll use a placeholder work report
//       const mockWorkReport: WorkReport = {
//         package_spec: {
//           hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
//           length: 0n,
//           erasure_root:
//             '0x0000000000000000000000000000000000000000000000000000000000000000',
//           exports_root:
//             '0x0000000000000000000000000000000000000000000000000000000000000000',
//           exports_count: 0n,
//         },
//         context: {
//           anchor:
//             '0x0000000000000000000000000000000000000000000000000000000000000000',
//           state_root:
//             '0x0000000000000000000000000000000000000000000000000000000000000000',
//           beefy_root:
//             '0x0000000000000000000000000000000000000000000000000000000000000000',
//           lookup_anchor:
//             '0x0000000000000000000000000000000000000000000000000000000000000000',
//           lookup_anchor_slot: 0n,
//           prerequisites: [],
//         },
//         core_index: workReports[0].core_index,
//         authorizer_hash:
//           '0x0000000000000000000000000000000000000000000000000000000000000000',
//         auth_output:
//           '0x0000000000000000000000000000000000000000000000000000000000000000',
//         segment_root_lookup: [],
//         results: [],
//         auth_gas_used: 0n,
//       }

//       const [signatureError, auditSignature] = generateAuditSignature(
//         this.config.validatorSecretKey,
//         blockHeaderVrfOutput,
//         BigInt(tranche),
//         mockWorkReport,
//       )

//       if (signatureError) {
//         logger.error('Failed to generate audit signature for tranche N', {
//           error: signatureError,
//           tranche,
//         })
//         return safeError(signatureError)
//       }

//       const announcement: AuditAnnouncement = {
//         headerHash,
//         tranche: BigInt(tranche),
//         announcement: {
//           validatorIndex: this.config.validatorIndex,
//           workReports,
//           signature: announcementSignature,
//         },
//         evidence: auditSignature.signature,
//       }

//       // Store the announcement
//       const announcementKey = `${headerHash}-${tranche}`
//       this.pendingAudits.set(announcementKey, announcement)

//       logger.info('Created audit announcement for tranche N', {
//         headerHash,
//         tranche,
//         workReportsCount: workReports.length,
//         evidenceLength: auditSignature.signature.length,
//       })

//       return safeResult(announcement)
//     } catch (error) {
//       logger.error('Failed to create audit announcement for tranche N', {
//         error: error instanceof Error ? error.message : String(error),
//         headerHash,
//         tranche,
//       })
//       return safeError(
//         new Error(`Failed to create audit announcement: ${error}`),
//       )
//     }
//   }

//   /**
//    * Verify audit announcement
//    *
//    * Uses the audit signature verification functions from audit package
//    */
//   async verifyAuditAnnouncement(
//     announcement: AuditAnnouncement,
//     blockHeaderVrfOutput: Uint8Array,
//   ): SafePromise<boolean> {
//     try {
//       logger.debug('Verifying audit announcement', {
//         headerHash: announcement.headerHash,
//         tranche: announcement.tranche.toString(),
//         evidenceLength: announcement.evidence.length,
//       })

//       if (announcement.tranche === 0n) {
//         // Verify tranche 0 evidence using our audit signature verification
//         const [error, isValid] = verifyTranche0AuditSignature(
//           this.config.validatorPublicKey,
//           announcement.evidence,
//           blockHeaderVrfOutput,
//         )

//         if (error) {
//           logger.error('Error verifying tranche 0 audit signature', { error })
//           return safeError(error)
//         }

//         return safeResult(isValid)
//       } else {
//         // For tranche N, we need to verify against each work report
//         // TODO: Get the actual work reports from the announcement
//         // For now, we'll use a placeholder work report
//         const mockWorkReport: WorkReport = {
//           package_spec: {
//             hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
//             length: 0n,
//             erasure_root:
//               '0x0000000000000000000000000000000000000000000000000000000000000000',
//             exports_root:
//               '0x0000000000000000000000000000000000000000000000000000000000000000',
//             exports_count: 0n,
//           },
//           context: {
//             anchor:
//               '0x0000000000000000000000000000000000000000000000000000000000000000',
//             state_root:
//               '0x0000000000000000000000000000000000000000000000000000000000000000',
//             beefy_root:
//               '0x0000000000000000000000000000000000000000000000000000000000000000',
//             lookup_anchor:
//               '0x0000000000000000000000000000000000000000000000000000000000000000',
//             lookup_anchor_slot: 0n,
//             prerequisites: [],
//           },
//           core_index: 0n,
//           authorizer_hash:
//             '0x0000000000000000000000000000000000000000000000000000000000000000',
//           auth_output:
//             '0x0000000000000000000000000000000000000000000000000000000000000000',
//           segment_root_lookup: [],
//           results: [],
//           auth_gas_used: 0n,
//         }

//         // Verify tranche N evidence using our audit signature verification
//         const [error, isValid] = verifyTrancheNAuditSignature(
//           this.config.validatorPublicKey,
//           announcement.evidence,
//           blockHeaderVrfOutput,
//           mockWorkReport,
//           announcement.tranche,
//         )

//         if (error) {
//           logger.error('Error verifying tranche N audit signature', { error })
//           return safeError(error)
//         }

//         return safeResult(isValid)
//       }
//     } catch (error) {
//       logger.error('Error verifying audit announcement', {
//         error: error instanceof Error ? error.message : String(error),
//         headerHash: announcement.headerHash,
//         tranche: announcement.tranche.toString(),
//       })
//       return safeError(error as Error)
//     }
//   }

//   /**
//    * Get current tranche number
//    */
//   getCurrentTranche(): number {
//     return this.currentTranche
//   }

//   /**
//    * Get pending audits
//    */
//   getPendingAudits(): Map<string, AuditAnnouncement> {
//     return this.pendingAudits
//   }

//   /**
//    * Clear completed audits
//    */
//   clearCompletedAudits(completedKeys: string[]): void {
//     for (const key of completedKeys) {
//       this.pendingAudits.delete(key)
//     }

//     logger.debug('Cleared completed audits', {
//       clearedCount: completedKeys.length,
//       remainingCount: this.pendingAudits.size,
//     })
//   }
// }
