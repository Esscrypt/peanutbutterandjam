/**
 * CE 144: Audit Announcement Protocol
 *
 * Implements the audit announcement protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for announcing audit requirements.
 */

import {
  verifyTranche0AuditSignature,
  verifyTrancheNAuditSignature,
} from '@pbnj/audit'
import {
  bytesToHex,
  concatBytes,
  type EventBusService,
  type Hex,
  hexToBytes,
  logger,
  type Safe,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/core'
import { decodeFixedLength, encodeFixedLength } from '@pbnj/serialization'
import type { AuditAnnouncement, WorkReport } from '@pbnj/types'
import { NetworkingProtocol } from './protocol'

/**
 * Audit announcement protocol handler
 */
// Tranche = u8
// Announcement = len++[Core Index ++ Work-Report Hash] ++ Ed25519 Signature

// Bandersnatch Signature = [u8; 96]
// First Tranche Evidence = Bandersnatch Signature (s_0 in GP)
// No-Show = Validator Index ++ Announcement (From the previous tranche)
// Subsequent Tranche Evidence = [Bandersnatch Signature (s_n(w) in GP) ++ len++[No-Show]] (One entry per announced work-report)
// Evidence = First Tranche Evidence (If tranche is 0) OR Subsequent Tranche Evidence (If tranche is not 0)

// Auditor -> Auditor

// --> Header Hash ++ Tranche ++ Announcement
// --> Evidence
// --> FIN
// <-- FIN
export class AuditAnnouncementProtocol extends NetworkingProtocol<
  AuditAnnouncement,
  void
> {
  // private eventBusService: EventBusService
  constructor(_eventBusService: EventBusService) {
    super()
    // this.eventBusService = eventBusService
  }

  async processRequest(announcement: AuditAnnouncement): SafePromise<void> {
    try {
      logger.debug('Processing audit announcement', {
        headerHash: announcement.headerHash,
        tranche: announcement.tranche.toString(),
        workReportsCount: announcement.announcement.workReports.length,
        evidenceLength: announcement.evidence.length,
      })

      // Step 1: Verify the Ed25519 announcement signature
      const [signatureError, signatureValid] =
        await this.verifyAnnouncementSignature(announcement)
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

      // Step 2: Verify the Bandersnatch VRF evidence
      const [vrfError, vrfValid] =
        await this.verifyBandersnatchVRFEvidence(announcement)
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
      const [selectionError, selectionValid] =
        await this.verifyWorkReportSelection(announcement)
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
        workReportsCount: announcement.announcement.workReports.length,
      })

      return safeResult(undefined)
    } catch (error) {
      logger.error('Failed to process audit announcement', {
        error: error instanceof Error ? error.message : String(error),
      })
      return safeError(
        new Error(`Failed to process audit announcement: ${error}`),
      )
    }
  }

  /**
   * Verify Ed25519 announcement signature according to Gray Paper Eq. 82
   *
   * Gray Paper Eq. 82:
   * S ≡ edsignature{activeset[v]_vk_ed}{Xannounce ∥ n ∥ x_n ∥ blake{H}}
   * where Xannounce = token("$jam_announce")
   */
  private async verifyAnnouncementSignature(
    _announcement: AuditAnnouncement,
  ): SafePromise<boolean> {
    try {
      // TODO: Implement Ed25519 signature verification
      // This requires:
      // 1. Getting the validator's Ed25519 public key from the announcement
      // 2. Building the message: Xannounce ∥ n ∥ x_n ∥ blake{H}
      // 3. Verifying the signature against the message

      logger.debug(
        'Ed25519 announcement signature verification not yet implemented',
      )

      // For now, return true (placeholder)
      // In a real implementation, this would verify:
      // - Xannounce = "$jam_announce" token
      // - n = tranche number
      // - x_n = encoded work report set
      // - blake{H} = Blake2b hash of block header

      return safeResult(true)
    } catch (error) {
      logger.error('Error verifying announcement signature', {
        error: error instanceof Error ? error.message : String(error),
      })
      return safeError(error as Error)
    }
  }

  /**
   * Verify Bandersnatch VRF evidence according to Gray Paper equations
   *
   * For tranche 0 (Gray Paper Eq. 54-62):
   * s_0 ∈ bssignature{activeset[v]_vk_bs}{Xaudit ∥ banderout{H_vrfsig}}{[]}
   *
   * For tranche N > 0 (Gray Paper Eq. 105):
   * s_n(w) ∈ bssignature{activeset[v]_vk_bs}{Xaudit ∥ banderout{H_vrfsig} ∥ blake{w} ∥ n}{[]}
   */
  private async verifyBandersnatchVRFEvidence(
    announcement: AuditAnnouncement,
  ): SafePromise<boolean> {
    try {
      // TODO: Get validator's Bandersnatch public key
      // This should come from the validator set manager or be extracted from the announcement
      const validatorBandersnatchPublicKey = new Uint8Array(32) // Placeholder

      // TODO: Extract banderout{H_vrfsig} from block header
      // This should come from the block header's VRF signature
      const blockHeaderVrfOutput = hexToBytes(announcement.headerHash)

      if (announcement.tranche === 0n) {
        // Verify tranche 0 evidence using our audit signature verification
        const [error, isValid] = verifyTranche0AuditSignature(
          validatorBandersnatchPublicKey,
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
        // check if we have the work report locally
        // For now, we'll use a placeholder work report
        const mockWorkReport: WorkReport = {
          package_spec: {
            hash: '0x000000000000000000000000 0000000000000000000000000000000000000000',
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
          validatorBandersnatchPublicKey,
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
      logger.error('Error verifying Bandersnatch VRF evidence', {
        error: error instanceof Error ? error.message : String(error),
      })
      return safeError(error as Error)
    }
  }

  /**
   * Verify work report selection is valid according to Gray Paper audit selection logic
   *
   * For tranche 0: Verify Fisher-Yates shuffle selection
   * For tranche N: Verify no-show based selection
   */
  private async verifyWorkReportSelection(
    announcement: AuditAnnouncement,
  ): SafePromise<boolean> {
    try {
      // TODO: Implement work report selection verification
      // This requires:
      // 1. Getting the available work reports for the block
      // 2. Verifying the selection algorithm (Fisher-Yates for tranche 0, no-show logic for tranche N)
      // 3. Checking that the announced work reports match the expected selection

      logger.debug('Work report selection verification not yet implemented', {
        tranche: announcement.tranche.toString(),
        workReportsCount: announcement.announcement.workReports.length,
      })

      // For now, return true (placeholder)
      // In a real implementation, this would verify:
      // - Tranche 0: Fisher-Yates shuffle with VRF output as seed
      // - Tranche N: No-show validator logic with bias factor

      return safeResult(true)
    } catch (error) {
      logger.error('Error verifying work report selection', {
        error: error instanceof Error ? error.message : String(error),
      })
      return safeError(error as Error)
    }
  }

  /**
   * Serialize audit announcement message
   */
  serializeRequest(announcement: AuditAnnouncement): Safe<Uint8Array> {
    const parts: Uint8Array[] = []

    // 1. Header hash (32 bytes)
    parts.push(hexToBytes(announcement.headerHash))

    // 2. Tranche (4 bytes, little-endian)
    const [trancheError, encodedTranche] = encodeFixedLength(
      announcement.tranche,
      4n,
    )
    if (trancheError) {
      return safeError(trancheError)
    }
    parts.push(encodedTranche)

    // 3. Number of work reports (4 bytes, little-endian)
    const [countError, encodedCount] = encodeFixedLength(
      BigInt(announcement.announcement.workReports.length),
      4n,
    )
    if (countError) {
      return safeError(countError)
    }
    parts.push(encodedCount)

    // 4. Work reports
    for (const workReport of announcement.announcement.workReports) {
      // Core index (4 bytes, little-endian)
      const [coreIndexError, encodedCoreIndex] = encodeFixedLength(
        workReport.coreIndex,
        4n,
      )
      if (coreIndexError) {
        return safeError(coreIndexError)
      }
      parts.push(encodedCoreIndex)

      // Work report hash (32 bytes)
      parts.push(hexToBytes(workReport.workReportHash))
    }

    // 5. Signature (64 bytes for Ed25519)
    parts.push(hexToBytes(announcement.announcement.signature))

    // 6. Evidence length (4 bytes, little-endian)
    const [evidenceLengthError, encodedEvidenceLength] = encodeFixedLength(
      BigInt(announcement.evidence.length),
      4n,
    )
    if (evidenceLengthError) {
      return safeError(evidenceLengthError)
    }
    parts.push(encodedEvidenceLength)

    // 7. Evidence data
    parts.push(announcement.evidence)

    return safeResult(concatBytes(parts))
  }

  /**
   * Deserialize audit announcement message
   */
  deserializeRequest(data: Uint8Array): Safe<AuditAnnouncement> {
    let currentData = data

    // 1. Read header hash (32 bytes)
    if (currentData.length < 32) {
      return safeError(new Error('Insufficient data for header hash'))
    }
    const headerHash = currentData.slice(0, 32)
    currentData = currentData.slice(32)

    // 2. Read tranche (4 bytes, little-endian)
    const [trancheError, trancheResult] = decodeFixedLength(currentData, 4n)
    if (trancheError) {
      return safeError(trancheError)
    }
    currentData = trancheResult.remaining
    const tranche = trancheResult.value

    // 3. Read number of work reports (4 bytes, little-endian)
    const [countError, countResult] = decodeFixedLength(currentData, 4n)
    if (countError) {
      return safeError(countError)
    }
    currentData = countResult.remaining
    const numWorkReports = Number(countResult.value)

    // 4. Read work reports
    const workReports: Array<{
      coreIndex: bigint
      workReportHash: Hex
    }> = []
    for (let i = 0; i < numWorkReports; i++) {
      // Read core index (4 bytes, little-endian)
      const [coreIndexError, coreIndexResult] = decodeFixedLength(
        currentData,
        4n,
      )
      if (coreIndexError) {
        return safeError(coreIndexError)
      }
      currentData = coreIndexResult.remaining
      const coreIndex = coreIndexResult.value

      // Read work report hash (32 bytes)
      if (currentData.length < 32) {
        return safeError(new Error('Insufficient data for work report hash'))
      }
      const workReportHash = currentData.slice(0, 32)
      currentData = currentData.slice(32)

      workReports.push({
        coreIndex,
        workReportHash: bytesToHex(workReportHash),
      })
    }

    // 5. Read signature (64 bytes for Ed25519)
    if (currentData.length < 64) {
      return safeError(new Error('Insufficient data for signature'))
    }
    const signature = currentData.slice(0, 64)
    currentData = currentData.slice(64)

    // 6. Read evidence length (4 bytes, little-endian)
    const [evidenceLengthError, evidenceLengthResult] = decodeFixedLength(
      currentData,
      4n,
    )
    if (evidenceLengthError) {
      return safeError(evidenceLengthError)
    }
    currentData = evidenceLengthResult.remaining
    const evidenceLength = Number(evidenceLengthResult.value)

    // 7. Read evidence data
    if (currentData.length < evidenceLength) {
      return safeError(new Error('Insufficient data for evidence'))
    }
    const evidence = currentData.slice(0, evidenceLength)

    return safeResult({
      headerHash: bytesToHex(headerHash),
      tranche,
      announcement: {
        workReports: workReports.map((wr) => ({
          coreIndex: wr.coreIndex,
          workReportHash: wr.workReportHash,
        })),
        signature: bytesToHex(signature),
      },
      evidence,
    })
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
