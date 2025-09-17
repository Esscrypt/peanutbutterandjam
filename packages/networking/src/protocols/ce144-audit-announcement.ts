/**
 * CE 144: Audit Announcement Protocol
 *
 * Implements the audit announcement protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for announcing audit requirements.
 */

import {
  bytesToHex,
  concatBytes,
  type Hex,
  hexToBytes,
  type Safe,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/core'
import { decodeFixedLength, encodeFixedLength } from '@pbnj/serialization'
import type { AuditAnnouncement } from '@pbnj/types'
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
  // private auditAnnouncements: Map<string, AuditAnnouncement> = new Map()

  /**
   * Process audit announcement
   */
  async processRequest(_announcement: AuditAnnouncement): SafePromise<void> {
    //TODO: verify the audit announcement signature
    return safeResult(undefined)
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
