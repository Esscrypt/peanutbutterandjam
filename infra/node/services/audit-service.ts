/**
 * Audit Service
 *
 * Implements audit announcement creation and management according to Gray Paper specifications.
 * Handles audit triggering based on work reports becoming available and tranche timing.
 *
 * Gray Paper Reference: auditing.tex
 * - Audits are triggered when work reports become available (justbecameavailable)
 * - New tranches begin every Ctrancheseconds = 8 seconds
 * - Additional audits triggered by negative judgments or insufficient judgments
 */

import {
  generateAnnouncementSignature,
  generateAuditSignature,
  selectAuditTranche0,
  selectAuditTrancheN,
  verifyAnnouncementSignature,
  verifyBandersnatchVRFEvidence,
  verifyTranche0AuditSignature,
  verifyTrancheNAuditSignature,
  verifyWorkReportSelection,
} from '@pbnjam/audit'
import type {
  IETFVRFVerifier,
  IETFVRFVerifierWasm,
} from '@pbnjam/bandersnatch-vrf'
import {
  type AuditTrancheEvent,
  bytesToHex,
  type EventBusService,
  getValidatorCredentialsWithFallback,
  type Hex,
  hexToBytes,
  logger,
} from '@pbnjam/core'
import type { AuditAnnouncementProtocol } from '@pbnjam/networking'
import type {
  AuditAnnouncement,
  IConfigService,
  Judgment,
  Safe,
  SafePromise,
  StreamKind,
  WorkReport,
} from '@pbnjam/types'
import { BaseService, safeError, safeResult } from '@pbnjam/types'
import type { KeyPairService } from './keypair-service'
import type { NetworkingService } from './networking-service'
import type { ValidatorSetManager } from './validator-set'
import type { WorkReportService } from './work-report-service'

export class AuditService extends BaseService {
  private readonly pendingAudits: Map<string, AuditAnnouncement> = new Map()
  private readonly eventBusService: EventBusService
  private readonly validatorSetManager: ValidatorSetManager
  private readonly workReportService: WorkReportService
  private readonly networkingService: NetworkingService | null
  private readonly auditAnnouncementProtocol: AuditAnnouncementProtocol | null
  private readonly configService: IConfigService
  private readonly keyPairService: KeyPairService | null
  private readonly verifier: IETFVRFVerifier | IETFVRFVerifierWasm
  private currentTranche = 0

  constructor(options: {
    eventBusService: EventBusService
    validatorSetManager: ValidatorSetManager
    workReportService: WorkReportService
    networkingService?: NetworkingService | null
    auditAnnouncementProtocol?: AuditAnnouncementProtocol | null
    configService: IConfigService
    keyPairService?: KeyPairService | null
    verifier: IETFVRFVerifier | IETFVRFVerifierWasm
  }) {
    super('audit-service')
    this.eventBusService = options.eventBusService
    this.validatorSetManager = options.validatorSetManager
    this.workReportService = options.workReportService
    this.networkingService = options.networkingService ?? null
    this.auditAnnouncementProtocol = options.auditAnnouncementProtocol ?? null
    this.configService = options.configService
    this.keyPairService = options.keyPairService ?? null
    this.verifier = options.verifier
    this.eventBusService.addAuditTrancheCallback(
      this.handleAuditTranche.bind(this),
    )
    this.eventBusService.addWorkReportAvailableCallback(
      this.handleWorkReportAvailable.bind(this),
    )
    this.eventBusService.addNegativeJudgmentReceivedCallback(
      this.handleNegativeJudgmentReceived.bind(this),
    )
    this.eventBusService.addAuditAnnouncementReceivedCallback(
      this.handleAuditAnnouncementReceived.bind(this),
    )
  }

  override stop(): Safe<boolean> {
    this.pendingAudits.clear()
    // this.workReportsAvailable.clear()

    this.eventBusService.removeAuditTrancheCallback(
      this.handleAuditTranche.bind(this),
    )
    this.eventBusService.removeWorkReportAvailableCallback(
      this.handleWorkReportAvailable.bind(this),
    )
    this.eventBusService.removeNegativeJudgmentReceivedCallback(
      this.handleNegativeJudgmentReceived.bind(this),
    )
    this.eventBusService.removeAuditAnnouncementReceivedCallback(
      this.handleAuditAnnouncementReceived.bind(this),
    )
    return safeResult(true)
  }

  /**
   * Handle work report available events
   * Gray Paper: Audits triggered when work reports become available (justbecameavailable)
   */
  private readonly handleWorkReportAvailable = async (
    workReport: WorkReport,
    coreIndex: bigint,
    blockHeaderHash: Hex,
  ): SafePromise<void> => {
    logger.debug('Work report became available, triggering tranche 0 audit', {
      coreIndex: coreIndex.toString(),
      blockHeaderHash,
      workReportHash: workReport.core_index.toString(),
    })

    // Store the work report for potential future tranches
    //   if (!this.workReportsAvailable.has(blockHeaderHash)) {
    //     this.workReportsAvailable.set(blockHeaderHash, [])
    //   }
    //   this.workReportsAvailable.get(blockHeaderHash)!.push(workReport)

    // TODO: Trigger tranche 0 audit announcement
    // This would involve:
    // 1. Getting core work reports for this block
    // 2. Getting bandersnatch VRF output from block header
    // 3. Creating audit announcement for tranche 0
    // 4. Publishing the announcement

    return safeResult(undefined)
  }

  /**
   * Handle negative judgment received events
   * Gray Paper: Validator is always required to audit when negative judgment is received
   */
  private readonly handleNegativeJudgmentReceived = async (
    _judgment: Judgment,
    workReportHash: Hex,
    validatorIndex: bigint,
  ): SafePromise<void> => {
    try {
      logger.info('Negative judgment received, triggering immediate audit', {
        workReportHash,
        validatorIndex: validatorIndex.toString(),
      })

      // TODO: Trigger immediate audit for this work report
      // This would involve:
      // 1. Finding the work report that was judged negatively
      // 2. Creating audit announcement for immediate audit
      // 3. Publishing the announcement

      logger.debug('Immediate audit for negative judgment not yet implemented')

      return safeResult(undefined)
    } catch (error) {
      logger.error('Error handling negative judgment for audit service', {
        error: error instanceof Error ? error.message : String(error),
        workReportHash,
        validatorIndex: validatorIndex.toString(),
      })
      return safeError(error as Error)
    }
  }

  /**
   * Handle audit tranche events
  /**
   * Handle audit tranche events
   * Gray Paper: New tranches begin every Ctrancheseconds = 8 seconds
   */
  private readonly handleAuditTranche = async (
    event: AuditTrancheEvent,
  ): SafePromise<void> => {
    const trancheNumber = event.trancheNumber

    // TODO: Get actual block header, core work reports, and VRF output from event or state
    // For now, this is a placeholder - the actual implementation needs to get this data
    // from the block importer or state service
    logger.debug('Audit tranche event received', {
      trancheNumber,
      slot: event.slot.toString(),
    })

    // TODO: Implement actual audit announcement creation when event data is available
    // This requires:
    // 1. Getting the current block header hash
    // 2. Getting core work reports for the block
    // 3. Getting bandersnatch VRF output from block header
    // 4. For tranche N > 0: getting previous tranche announcements and negative judgments

    return safeResult(undefined)
  }
  /**
   * Handle audit announcement received events
   * Gray Paper: Monitor announcements to detect insufficient judgments
   */
  private readonly handleAuditAnnouncementReceived = async (
    announcement: AuditAnnouncement,
    peerPublicKey: Hex,
  ): SafePromise<void> => {
    // get the validator index from the peer public key
    const [announcerValidatorIndexError, announcerValidatorIndex] =
      this.validatorSetManager.getValidatorIndex(peerPublicKey)
    if (announcerValidatorIndexError) {
      logger.error('Failed to get announcer validator index', {
        error: announcerValidatorIndexError,
      })
      return safeError(announcerValidatorIndexError)
    }

    // Step 1: Verify the Ed25519 announcement signature
    const [signatureError, signatureValid] = verifyAnnouncementSignature(
      announcement,
      announcerValidatorIndex,
      this.validatorSetManager,
    )
    if (signatureError) {
      logger.error('Failed to verify announcement signature', {
        error: signatureError,
      })
      return safeError(signatureError)
    }
    if (!signatureValid) {
      logger.error('Invalid announcement signature')
      return safeError(new Error('Invalid announcement signature'))
    }

    // For each work report in the announcement, get the work report from the work report service
    const workReports: (WorkReport | null)[] = []
    const availableCoreWorkReports = new Map<bigint, WorkReport[]>()

    for (const workReportRef of announcement.announcement.workReports) {
      const workReport = this.workReportService.getWorkReportByHash(
        workReportRef.workReportHash,
      )

      if (!workReport) {
        logger.error('Work report not available for audit', {
          workReportHash: workReportRef.workReportHash,
          coreIndex: workReportRef.coreIndex.toString(),
        })
        return safeError(
          new Error(
            `Work report ${workReportRef.workReportHash} is not available`,
          ),
        )
      }

      workReports.push(workReport)

      // Build availableCoreWorkReports map for verification
      const coreIndex = workReport.core_index
      if (!availableCoreWorkReports.has(coreIndex)) {
        availableCoreWorkReports.set(coreIndex, [])
      }
      availableCoreWorkReports.get(coreIndex)!.push(workReport)
    }

    // Step 2: Verify the Bandersnatch VRF evidence
    // Note: verifyBandersnatchVRFEvidence takes a single work report, so we verify the first one
    if (workReports.length === 0 || workReports[0] === null) {
      return safeError(
        new Error('No work reports available for VRF verification'),
      )
    }

    const [vrfError, vrfValid] = verifyBandersnatchVRFEvidence(
      announcement,
      hexToBytes(peerPublicKey),
      workReports[0],
      this.verifier,
    )
    if (vrfError) {
      logger.error('Failed to verify Bandersnatch VRF evidence', {
        error: vrfError,
      })
      return safeError(vrfError)
    }
    if (!vrfValid) {
      logger.error('Invalid Bandersnatch VRF evidence')
      return safeError(new Error('Invalid Bandersnatch VRF evidence'))
    }

    // Step 3: Verify work report selection is valid
    // Note: bandersnatchVrfOutput should come from block header
    // TODO: Get actual bandersnatch VRF output from block header using headerHash
    const bandersnatchVrfOutput =
      '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex
    const [selectionError, selectionValid] = verifyWorkReportSelection(
      announcement,
      availableCoreWorkReports,
      bandersnatchVrfOutput,
      this.configService,
      [], // previousTrancheAnnouncements - TODO: get from state/event
    )

    if (selectionError) {
      logger.error('Failed to verify work report selection', {
        error: selectionError,
      })
      return safeError(selectionError)
    }
    if (!selectionValid) {
      logger.error('Invalid work report selection')
      return safeError(new Error('Invalid work report selection'))
    }

    logger.info('Audit announcement verified successfully', {
      headerHash: announcement.headerHash,
      tranche: announcement.tranche.toString(),
      workReportsCount: workReports.length,
    })

    return safeResult(undefined)
  }

  /**
   * Create audit announcement for tranche 0
   *
   * Implements Gray Paper audit tranche selection with Fisher-Yates shuffle
   * Gray Paper Eq. 64-68: Initial audit tranche selection
   */
  createAuditAnnouncementTranche0(
    headerHash: Hex,
    _coreWorkReports: WorkReport[],
    bandersnatchVrfOutput: Hex,
  ): Safe<AuditAnnouncement> {
    // Get validator credentials with fallback (needed for generating local_seed_0)
    const [credentialsError, validatorCredentials] =
      getValidatorCredentialsWithFallback(
        this.configService,
        this.keyPairService ?? undefined,
      )
    if (credentialsError || !validatorCredentials) {
      return safeError(
        credentialsError || new Error('Failed to get validator credentials'),
      )
    }

    // Select cores for audit using Fisher-Yates shuffle
    // Gray Paper: Uses banderout{local_seed_0} as entropy, which is generated from
    // local_seed_0 = bssignature{validatorSecretKey}{Xaudit ∥ banderout{H_vrfsig}}{∅}
    const selection = selectAuditTranche0(
      this.workReportService,
      validatorCredentials.bandersnatchKeyPair.privateKey,
      hexToBytes(bandersnatchVrfOutput),
      this.configService,
    )

    // Create work reports for selected cores
    const workReports = selection.selectedCores.flatMap(
      (core: {
        coreIndex: bigint
        workReports: Array<{ workReportHash: Hex }>
      }) =>
        core.workReports.map((wr: { workReportHash: Hex }) => ({
          coreIndex: core.coreIndex,
          workReportHash: wr.workReportHash,
        })),
    )

    const ed25519KeyPair = validatorCredentials.ed25519KeyPair
    const ed25519PublicKeyHex = bytesToHex(ed25519KeyPair.publicKey)

    const [validatorIndexError] =
      this.validatorSetManager.getValidatorIndex(ed25519PublicKeyHex)
    if (validatorIndexError) {
      return safeError(validatorIndexError)
    }

    // Generate audit signature evidence for tranche 0
    const blockHeaderVrfOutput = hexToBytes(bandersnatchVrfOutput)
    const [signatureError, auditSignature] = generateAuditSignature(
      ed25519KeyPair.privateKey,
      blockHeaderVrfOutput,
      0n, // Tranche 0
    )

    if (signatureError) {
      logger.error('Failed to generate audit signature for tranche 0', {
        error: signatureError,
      })
      return safeError(signatureError)
    }

    // Generate Ed25519 announcement signature
    const [announcementSignatureError, announcementSignature] =
      generateAnnouncementSignature(
        ed25519KeyPair.privateKey,
        workReports,
        0n,
        headerHash,
      )

    if (announcementSignatureError) {
      logger.error('Failed to generate announcement signature for tranche 0', {
        error: announcementSignatureError,
      })
      return safeError(announcementSignatureError)
    }

    const announcement: AuditAnnouncement = {
      headerHash,
      tranche: 0n,
      announcement: {
        workReports,
        signature: announcementSignature,
      },
      evidence: auditSignature.signature,
    }

    // Store the announcement
    const announcementKey = `${headerHash}-0`
    this.pendingAudits.set(announcementKey, announcement)

    // Send announcement to other validators (async, don't await)
    this.broadcastAuditAnnouncement(announcement).catch((error) => {
      logger.warn('Failed to broadcast audit announcement', {
        error: error instanceof Error ? error.message : String(error),
        headerHash,
      })
    })

    return safeResult(announcement)
  }

  /**
   * Create audit announcement for tranche N (N > 0)
   *
   * Implements Gray Paper tranche N selection logic
   * Gray Paper Eq. 105: Subsequent tranche evidence
   */
  createAuditAnnouncementTrancheN(
    headerHash: Hex,
    coreWorkReports: WorkReport[],
    bandersnatchVrfOutput: Hex,
    tranche: number,
    previousTrancheAnnouncements: AuditAnnouncement[],
    negativeJudgments: Judgment[],
  ): Safe<AuditAnnouncement> {
    logger.debug('Creating audit announcement for tranche N', {
      headerHash,
      tranche,
      coreWorkReportsCount: coreWorkReports.length,
      previousAnnouncementsCount: previousTrancheAnnouncements.length,
      negativeJudgmentsCount: negativeJudgments.length,
    })

    // Get validator credentials with fallback (needed for generating local_seed_n)
    const [credentialsError, validatorCredentials] =
      getValidatorCredentialsWithFallback(
        this.configService,
        this.keyPairService ?? undefined,
      )
    if (credentialsError || !validatorCredentials) {
      return safeError(
        credentialsError || new Error('Failed to get validator credentials'),
      )
    }

    // Convert AuditAnnouncement[] to format expected by selectAuditTrancheN
    const previousAnnouncementsFormatted = previousTrancheAnnouncements.map(
      (announcement) => ({
        validatorIndex: undefined as bigint | undefined, // TODO: Extract from announcement if available
        announcement: announcement.announcement,
      }),
    )

    // Convert Judgment[] to format expected by selectAuditTrancheN
    // Note: Judgment doesn't have coreIndex, so we need to extract it from work reports
    // For now, we'll create an empty array as negativeJudgments should come from a different source
    const negativeJudgmentsFormatted: Array<{
      coreIndex: bigint
      workReportHash?: Hex
    }> = []
    // TODO: Convert Judgment[] to NegativeJudgment[] format if needed

    // Select cores for audit using advanced selection logic
    // Gray Paper: Uses banderout{local_seed_n(wr)} for each work report
    // local_seed_n(wr) = bssignature{validatorSecretKey}{Xaudit ∥ banderout{H_vrfsig} ∥ blake{w} ∥ n}{∅}
    const selection = selectAuditTrancheN(
      this.workReportService,
      validatorCredentials.bandersnatchKeyPair.privateKey,
      hexToBytes(bandersnatchVrfOutput),
      this.configService,
      tranche,
      previousAnnouncementsFormatted,
      negativeJudgmentsFormatted,
    )

    // Create work reports for selected cores
    const workReports = selection.selectedCores.flatMap(
      (core: {
        coreIndex: bigint
        workReports: Array<{ workReportHash: Hex }>
      }) =>
        core.workReports.map((wr: { workReportHash: Hex }) => ({
          coreIndex: core.coreIndex,
          workReportHash: wr.workReportHash,
        })),
    )

    const ed25519KeyPair = validatorCredentials.ed25519KeyPair
    const ed25519PublicKeyHex = bytesToHex(ed25519KeyPair.publicKey)

    const [validatorIndexError] =
      this.validatorSetManager.getValidatorIndex(ed25519PublicKeyHex)
    if (validatorIndexError) {
      return safeError(validatorIndexError)
    }

    // Generate Ed25519 announcement signature
    const [announcementSignatureError, announcementSignature] =
      generateAnnouncementSignature(
        ed25519KeyPair.privateKey,
        workReports,
        BigInt(tranche),
        headerHash,
      )

    if (announcementSignatureError) {
      logger.error('Failed to generate announcement signature for tranche N', {
        error: announcementSignatureError,
        tranche,
      })
      return safeError(announcementSignatureError)
    }

    // Generate audit signature evidence for tranche N
    const blockHeaderVrfOutput = hexToBytes(bandersnatchVrfOutput)

    if (workReports.length === 0) {
      return safeError(new Error('No work reports selected for tranche N'))
    }

    // Get the actual work report from the work report service
    const firstWorkReportHash = workReports[0].workReportHash
    const firstWorkReport =
      this.workReportService.getWorkReportByHash(firstWorkReportHash)

    if (!firstWorkReport) {
      return safeError(
        new Error(
          `Work report ${firstWorkReportHash} not found for tranche N signature`,
        ),
      )
    }

    const [auditSignatureError, auditSignature] = generateAuditSignature(
      ed25519KeyPair.privateKey,
      blockHeaderVrfOutput,
      BigInt(tranche),
      firstWorkReport,
    )

    if (auditSignatureError) {
      logger.error('Failed to generate audit signature for tranche N', {
        error: auditSignatureError,
        tranche,
      })
      return safeError(auditSignatureError)
    }

    const announcement: AuditAnnouncement = {
      headerHash,
      tranche: BigInt(tranche),
      announcement: {
        workReports,
        signature: announcementSignature,
      },
      evidence: auditSignature.signature,
    }

    // Store the announcement
    const announcementKey = `${headerHash}-${tranche}`
    this.pendingAudits.set(announcementKey, announcement)

    // Send announcement to other validators (async, don't await)
    this.broadcastAuditAnnouncement(announcement).catch((error) => {
      logger.warn('Failed to broadcast audit announcement', {
        error: error instanceof Error ? error.message : String(error),
        headerHash,
        tranche,
      })
    })

    logger.info('Created audit announcement for tranche N', {
      headerHash,
      tranche,
      workReportsCount: workReports.length,
      evidenceLength: auditSignature.signature.length,
    })

    return safeResult(announcement)
  }

  /**
   * Verify audit announcement
   *
   * Uses the audit signature verification functions from audit package
   */
  async verifyAuditAnnouncement(
    announcement: AuditAnnouncement,
    blockHeaderVrfOutput: Uint8Array,
    validatorIndex: number,
  ): SafePromise<boolean> {
    try {
      logger.debug('Verifying audit announcement', {
        headerHash: announcement.headerHash,
        tranche: announcement.tranche.toString(),
        evidenceLength: announcement.evidence.length,
        validatorIndex,
      })

      // Get validator public key for verification
      const [announcerKeyError, announcerKey] =
        this.validatorSetManager.getValidatorAtIndex(validatorIndex)
      if (announcerKeyError || !announcerKey) {
        return safeError(
          announcerKeyError ||
            new Error('Failed to get announcer validator key'),
        )
      }

      if (announcement.tranche === 0n) {
        // Verify tranche 0 evidence using our audit signature verification
        const [error, isValid] = verifyTranche0AuditSignature(
          hexToBytes(announcerKey.ed25519),
          announcement.evidence,
          blockHeaderVrfOutput,
          this.verifier,
        )

        if (error) {
          logger.error('Error verifying tranche 0 audit signature', { error })
          return safeError(error)
        }

        return safeResult(isValid)
      } else {
        // For tranche N, we need to verify against the first work report
        if (announcement.announcement.workReports.length === 0) {
          return safeError(
            new Error('No work reports in announcement for tranche N'),
          )
        }

        const firstWorkReportHash =
          announcement.announcement.workReports[0].workReportHash
        const firstWorkReport =
          this.workReportService.getWorkReportByHash(firstWorkReportHash)

        if (!firstWorkReport) {
          return safeError(
            new Error(
              `Work report ${firstWorkReportHash} not found for verification`,
            ),
          )
        }

        // Verify tranche N evidence using our audit signature verification
        const [error, isValid] = verifyTrancheNAuditSignature(
          hexToBytes(announcerKey.ed25519),
          announcement.evidence,
          blockHeaderVrfOutput,
          firstWorkReport,
          announcement.tranche,
          this.verifier,
        )

        if (error) {
          logger.error('Error verifying tranche N audit signature', { error })
          return safeError(error)
        }

        return safeResult(isValid)
      }
    } catch (error) {
      logger.error('Error verifying audit announcement', {
        error: error instanceof Error ? error.message : String(error),
        headerHash: announcement.headerHash,
        tranche: announcement.tranche.toString(),
      })
      return safeError(error as Error)
    }
  }

  /**
   * Get current tranche number
   */
  getCurrentTranche(): number {
    return this.currentTranche
  }

  /**
   * Get pending audits
   */
  getPendingAudits(): Map<string, AuditAnnouncement> {
    return this.pendingAudits
  }

  /**
   * Clear completed audits
   */
  clearCompletedAudits(completedKeys: string[]): void {
    for (const key of completedKeys) {
      this.pendingAudits.delete(key)
    }

    logger.debug('Cleared completed audits', {
      clearedCount: completedKeys.length,
      remainingCount: this.pendingAudits.size,
    })
  }

  /**
   * Send audit announcement to a specific validator
   */
  async sendAuditAnnouncement(
    announcement: AuditAnnouncement,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    if (!this.networkingService || !this.auditAnnouncementProtocol) {
      return safeError(
        new Error(
          'Networking service or audit announcement protocol not available',
        ),
      )
    }

    const [serializeError, serializedMessage] =
      this.auditAnnouncementProtocol.serializeRequest(announcement)
    if (serializeError) {
      logger.error('Failed to serialize audit announcement', {
        error: serializeError.message,
      })
      return safeError(serializeError)
    }

    const [sendError] = await this.networkingService.sendMessageByPublicKey(
      peerPublicKey,
      144 as StreamKind, // CE144: Audit Announcement
      serializedMessage,
    )

    if (sendError) {
      logger.error('Failed to send audit announcement', {
        error: sendError.message,
        peerPublicKey: `${peerPublicKey.substring(0, 20)}...`,
      })
      return safeError(sendError)
    }

    logger.debug('Sent audit announcement', {
      headerHash: announcement.headerHash,
      tranche: announcement.tranche.toString(),
      peerPublicKey: `${peerPublicKey.substring(0, 20)}...`,
    })

    return safeResult(undefined)
  }

  /**
   * Broadcast audit announcement to all validators
   */
  async broadcastAuditAnnouncement(
    announcement: AuditAnnouncement,
  ): SafePromise<void> {
    if (!this.networkingService || !this.auditAnnouncementProtocol) {
      return safeError(
        new Error(
          'Networking service or audit announcement protocol not available',
        ),
      )
    }

    // Get all active validators
    const validators = this.validatorSetManager.getActiveValidators()
    if (validators.length === 0) {
      logger.warn('No active validators to broadcast to')
      return safeResult(undefined)
    }

    // Send to all validators (excluding self)
    let selfPublicKey: Hex | null = null
    const [credentialsError, validatorCredentials] =
      getValidatorCredentialsWithFallback(
        this.configService,
        this.keyPairService ?? undefined,
      )
    if (!credentialsError && validatorCredentials) {
      selfPublicKey = bytesToHex(validatorCredentials.ed25519KeyPair.publicKey)
    }

    let successCount = 0
    let errorCount = 0

    for (const validator of validators) {
      // Skip self
      if (selfPublicKey && validator.ed25519 === selfPublicKey) {
        continue
      }

      const [sendError] = await this.sendAuditAnnouncement(
        announcement,
        validator.ed25519,
      )

      if (sendError) {
        errorCount++
        logger.debug('Failed to send audit announcement to validator', {
          error: sendError.message,
        })
      } else {
        successCount++
      }
    }

    logger.info('Broadcast audit announcement', {
      headerHash: announcement.headerHash,
      tranche: announcement.tranche.toString(),
      totalValidators: validators.length,
      successCount,
      errorCount,
    })

    // Return success even if some sends failed (non-critical)
    return safeResult(undefined)
  }
}
