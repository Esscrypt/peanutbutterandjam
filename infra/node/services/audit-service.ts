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
  generateAuditSignature,
  selectAuditTranche0,
  selectAuditTrancheN,
  verifyTranche0AuditSignature,
  verifyTrancheNAuditSignature,
} from '@pbnj/audit'
import {
  type EventBusService,
  hexToBytes,
  logger,
  type Safe,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/core'
import type {
  AuditAnnouncement,
  CoreWorkReport,
  Judgment,
  NegativeJudgment,
  PreviousTrancheAnnouncement,
  WorkReport,
} from '@pbnj/types'
import { BaseService } from '@pbnj/types'
import type { Hex } from 'viem'

/**
 * Audit service configuration
 */
export interface AuditServiceConfig {
  eventBusService: EventBusService
  validatorSecretKey: Uint8Array
  validatorPublicKey: Uint8Array
}

/**
 * Audit tranche timing configuration
 * Gray Paper: Ctrancheseconds = 8 seconds
 */
const TRANCHE_SECONDS = 8

/**
 * Audit Service
 *
 * Manages audit announcements and triggers audits according to Gray Paper specifications.
 *
 * Key responsibilities:
 * - Create audit announcements for tranche 0 (Fisher-Yates shuffle)
 * - Create audit announcements for tranche N (no-show based selection)
 * - Trigger audits when work reports become available
 * - Handle tranche timing (every 8 seconds)
 * - Process negative judgments and insufficient judgment scenarios
 */
export class AuditService extends BaseService {
  private readonly config: AuditServiceConfig
  private currentTranche = 0
  private trancheStartTime = 0
  private readonly pendingAudits: Map<string, AuditAnnouncement> = new Map()
  private readonly workReportsAvailable: Map<string, WorkReport[]> = new Map()

  constructor(config: AuditServiceConfig) {
    super('audit-service')
    this.config = config
  }

  override start(): Safe<boolean> {
    try {
      logger.info('Starting audit service')

      // Bind to slot change events for tranche timing
      this.config.eventBusService.onSlotChange(this.handleSlotChange)

      // Bind to work report events for audit triggering
      this.config.eventBusService.addWorkReportAvailableCallback(
        this.handleWorkReportAvailable,
      )

      // Bind to judgment events for audit triggering
      this.config.eventBusService.addNegativeJudgmentReceivedCallback(
        this.handleNegativeJudgmentReceived,
      )

      // Bind to audit announcement events for monitoring
      this.config.eventBusService.addAuditAnnouncementReceivedCallback(
        this.handleAuditAnnouncementReceived,
      )

      logger.info('Audit service started successfully')
      return safeResult(true)
    } catch (error) {
      logger.error('Failed to start audit service', {
        error: error instanceof Error ? error.message : String(error),
      })
      return safeError(error as Error)
    }
  }

  override stop(): Safe<boolean> {
    try {
      logger.info('Stopping audit service')

      // Clear pending audits
      this.pendingAudits.clear()
      this.workReportsAvailable.clear()

      logger.info('Audit service stopped successfully')
      return safeResult(true)
    } catch (error) {
      logger.error('Failed to stop audit service', {
        error: error instanceof Error ? error.message : String(error),
      })
      return safeError(error as Error)
    }
  }

  /**
   * Handle slot change events for tranche timing
   * Gray Paper: New tranches begin every Ctrancheseconds = 8 seconds
   */
  private readonly handleSlotChange = async (event: {
    timestamp: number
    slot: bigint
    epoch: bigint
    phase: bigint
    previousSlot: bigint
    isEpochTransition: boolean
  }): SafePromise<void> => {
    try {
      const currentTime = event.timestamp

      // Check if we need to start a new tranche
      if (this.shouldStartNewTranche(currentTime)) {
        await this.startNewTranche(event.slot)
      }

      return safeResult(undefined)
    } catch (error) {
      logger.error('Error handling slot change for audit service', {
        error: error instanceof Error ? error.message : String(error),
        slot: event.slot.toString(),
      })
      return safeError(error as Error)
    }
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
    try {
      logger.debug('Work report became available, triggering tranche 0 audit', {
        coreIndex: coreIndex.toString(),
        blockHeaderHash,
        workReportHash: workReport.core_index.toString(),
      })

      // Store the work report for potential future tranches
      if (!this.workReportsAvailable.has(blockHeaderHash)) {
        this.workReportsAvailable.set(blockHeaderHash, [])
      }
      this.workReportsAvailable.get(blockHeaderHash)!.push(workReport)

      // TODO: Trigger tranche 0 audit announcement
      // This would involve:
      // 1. Getting core work reports for this block
      // 2. Getting bandersnatch VRF output from block header
      // 3. Creating audit announcement for tranche 0
      // 4. Publishing the announcement

      logger.debug('Tranche 0 audit announcement not yet implemented')

      return safeResult(undefined)
    } catch (error) {
      logger.error('Error handling work report available for audit service', {
        error: error instanceof Error ? error.message : String(error),
        coreIndex: coreIndex.toString(),
        blockHeaderHash,
      })
      return safeError(error as Error)
    }
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
   * Handle audit announcement received events
   * Gray Paper: Monitor announcements to detect insufficient judgments
   */
  private readonly handleAuditAnnouncementReceived = async (
    announcement: any,
    validatorIndex: bigint,
  ): SafePromise<void> => {
    try {
      logger.debug('Audit announcement received', {
        headerHash: announcement.headerHash,
        tranche: announcement.tranche.toString(),
        validatorIndex: validatorIndex.toString(),
      })

      // TODO: Track announcements and judgments to detect insufficient judgments
      // This would involve:
      // 1. Storing the announcement
      // 2. Monitoring for corresponding judgments
      // 3. Triggering additional audits if judgments are insufficient

      logger.debug('Announcement tracking not yet implemented')

      return safeResult(undefined)
    } catch (error) {
      logger.error('Error handling audit announcement for audit service', {
        error: error instanceof Error ? error.message : String(error),
        headerHash: announcement.headerHash,
        validatorIndex: validatorIndex.toString(),
      })
      return safeError(error as Error)
    }
  }

  /**
   * Check if we should start a new tranche based on timing
   * Gray Paper: Every Ctrancheseconds = 8 seconds
   */
  private shouldStartNewTranche(currentTime: number): boolean {
    if (this.trancheStartTime === 0) {
      this.trancheStartTime = currentTime
      return false
    }

    const timeSinceLastTranche = currentTime - this.trancheStartTime
    return timeSinceLastTranche >= TRANCHE_SECONDS * 1000 // Convert to milliseconds
  }

  /**
   * Start a new audit tranche
   */
  private async startNewTranche(slot: bigint): Promise<void> {
    try {
      this.currentTranche++
      this.trancheStartTime = Date.now()

      logger.info('Starting new audit tranche', {
        tranche: this.currentTranche,
        slot: slot.toString(),
      })

      // TODO: Implement tranche N logic
      // This would involve:
      // 1. Checking for negative judgments from previous tranches
      // 2. Checking for insufficient judgments from previous tranches
      // 3. Creating audit announcements for tranche N if needed

      logger.debug('Tranche N implementation not yet complete')
    } catch (error) {
      logger.error('Error starting new audit tranche', {
        error: error instanceof Error ? error.message : String(error),
        tranche: this.currentTranche,
        slot: slot.toString(),
      })
    }
  }

  /**
   * Create audit announcement for tranche 0
   *
   * Implements Gray Paper audit tranche selection with Fisher-Yates shuffle
   * Gray Paper Eq. 64-68: Initial audit tranche selection
   */
  createAuditAnnouncementTranche0(
    headerHash: Hex,
    coreWorkReports: CoreWorkReport[],
    bandersnatchVrfOutput: Hex,
  ): Safe<AuditAnnouncement> {
    try {
      logger.debug('Creating audit announcement for tranche 0', {
        headerHash,
        coreWorkReportsCount: coreWorkReports.length,
      })

      // Select cores for audit using Fisher-Yates shuffle
      const selection = selectAuditTranche0(
        coreWorkReports,
        bandersnatchVrfOutput,
      )

      // Create work reports for selected cores
      const workReports = selection.selectedCores.flatMap((core: any) =>
        core.workReports.map((wr: any) => ({
          coreIndex: core.coreIndex,
          workReportHash: wr.workReportHash,
        })),
      )

      // TODO: Sign the announcement with validator private key
      const signature = `0x${'0'.repeat(128)}` as Hex // Placeholder signature

      // Generate audit signature evidence for tranche 0
      const blockHeaderVrfOutput = hexToBytes(bandersnatchVrfOutput)
      const [signatureError, auditSignature] = generateAuditSignature(
        this.config.validatorSecretKey,
        blockHeaderVrfOutput,
        0n, // Tranche 0
      )

      if (signatureError) {
        logger.error('Failed to generate audit signature for tranche 0', {
          error: signatureError,
        })
        return safeError(signatureError)
      }

      const announcement: AuditAnnouncement = {
        headerHash,
        tranche: 0n,
        announcement: {
          workReports,
          signature,
        },
        evidence: auditSignature.signature, // Use the generated signature as evidence
      }

      // Store the announcement
      const announcementKey = `${headerHash}-0`
      this.pendingAudits.set(announcementKey, announcement)

      logger.info('Created audit announcement for tranche 0', {
        headerHash,
        workReportsCount: workReports.length,
        evidenceLength: auditSignature.signature.length,
      })

      return safeResult(announcement)
    } catch (error) {
      logger.error('Failed to create audit announcement for tranche 0', {
        error: error instanceof Error ? error.message : String(error),
        headerHash,
      })
      return safeError(
        new Error(`Failed to create audit announcement: ${error}`),
      )
    }
  }

  /**
   * Create audit announcement for tranche N (N > 0)
   *
   * Implements Gray Paper tranche N selection logic
   * Gray Paper Eq. 105: Subsequent tranche evidence
   */
  createAuditAnnouncementTrancheN(
    headerHash: Hex,
    coreWorkReports: CoreWorkReport[],
    bandersnatchVrfOutput: Hex,
    tranche: number,
    previousTrancheAnnouncements: PreviousTrancheAnnouncement[],
    negativeJudgments: NegativeJudgment[],
  ): Safe<AuditAnnouncement> {
    try {
      logger.debug('Creating audit announcement for tranche N', {
        headerHash,
        tranche,
        coreWorkReportsCount: coreWorkReports.length,
        previousAnnouncementsCount: previousTrancheAnnouncements.length,
        negativeJudgmentsCount: negativeJudgments.length,
      })

      // Select cores for audit using advanced selection logic
      const selection = selectAuditTrancheN(
        coreWorkReports,
        bandersnatchVrfOutput,
        tranche,
        previousTrancheAnnouncements,
        negativeJudgments,
      )

      // Create work reports for selected cores
      const workReports = selection.selectedCores.flatMap((core: any) =>
        core.workReports.map((wr: any) => ({
          coreIndex: core.coreIndex,
          workReportHash: wr.workReportHash,
        })),
      )

      // TODO: Sign the announcement with validator private key
      const signature = `0x${'0'.repeat(128)}` as Hex // Placeholder signature

      // Generate audit signature evidence for tranche N
      const blockHeaderVrfOutput = hexToBytes(bandersnatchVrfOutput)

      if (workReports.length === 0) {
        return safeError(new Error('No work reports selected for tranche N'))
      }

      // TODO: Get the actual work report from the core work reports
      // For now, we'll use a placeholder work report
      const mockWorkReport: WorkReport = {
        package_spec: {
          hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
          length: 0n,
          erasure_root:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          exports_root:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          exports_count: 0n,
        },
        context: {
          anchor:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          state_root:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          beefy_root:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          lookup_anchor:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          lookup_anchor_slot: 0n,
          prerequisites: [],
        },
        core_index: workReports[0].core_index,
        authorizer_hash:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        auth_output:
          '0x0000000000000000000000000000000000000000000000000000000000000000',
        segment_root_lookup: [],
        results: [],
        auth_gas_used: 0n,
      }

      const [signatureError, auditSignature] = generateAuditSignature(
        this.config.validatorSecretKey,
        blockHeaderVrfOutput,
        BigInt(tranche),
        mockWorkReport,
      )

      if (signatureError) {
        logger.error('Failed to generate audit signature for tranche N', {
          error: signatureError,
          tranche,
        })
        return safeError(signatureError)
      }

      const announcement: AuditAnnouncement = {
        headerHash,
        tranche: BigInt(tranche),
        announcement: {
          workReports,
          signature,
        },
        evidence: auditSignature.signature, // Use the generated signature as evidence
      }

      // Store the announcement
      const announcementKey = `${headerHash}-${tranche}`
      this.pendingAudits.set(announcementKey, announcement)

      logger.info('Created audit announcement for tranche N', {
        headerHash,
        tranche,
        workReportsCount: workReports.length,
        evidenceLength: auditSignature.signature.length,
      })

      return safeResult(announcement)
    } catch (error) {
      logger.error('Failed to create audit announcement for tranche N', {
        error: error instanceof Error ? error.message : String(error),
        headerHash,
        tranche,
      })
      return safeError(
        new Error(`Failed to create audit announcement: ${error}`),
      )
    }
  }

  /**
   * Verify audit announcement
   *
   * Uses the audit signature verification functions from audit package
   */
  async verifyAuditAnnouncement(
    announcement: AuditAnnouncement,
    blockHeaderVrfOutput: Uint8Array,
  ): SafePromise<boolean> {
    try {
      logger.debug('Verifying audit announcement', {
        headerHash: announcement.headerHash,
        tranche: announcement.tranche.toString(),
        evidenceLength: announcement.evidence.length,
      })

      if (announcement.tranche === 0n) {
        // Verify tranche 0 evidence using our audit signature verification
        const [error, isValid] = verifyTranche0AuditSignature(
          this.config.validatorPublicKey,
          announcement.evidence,
          blockHeaderVrfOutput,
        )

        if (error) {
          logger.error('Error verifying tranche 0 audit signature', { error })
          return safeError(error)
        }

        return safeResult(isValid)
      } else {
        // For tranche N, we need to verify against each work report
        // TODO: Get the actual work reports from the announcement
        // For now, we'll use a placeholder work report
        const mockWorkReport: WorkReport = {
          package_spec: {
            hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
            length: 0n,
            erasure_root:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            exports_root:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            exports_count: 0n,
          },
          context: {
            anchor:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            state_root:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            beefy_root:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            lookup_anchor:
              '0x0000000000000000000000000000000000000000000000000000000000000000',
            lookup_anchor_slot: 0n,
            prerequisites: [],
          },
          core_index: 0n,
          authorizer_hash:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          auth_output:
            '0x0000000000000000000000000000000000000000000000000000000000000000',
          segment_root_lookup: [],
          results: [],
          auth_gas_used: 0n,
        }

        // Verify tranche N evidence using our audit signature verification
        const [error, isValid] = verifyTrancheNAuditSignature(
          this.config.validatorPublicKey,
          announcement.evidence,
          blockHeaderVrfOutput,
          mockWorkReport,
          announcement.tranche,
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
}
