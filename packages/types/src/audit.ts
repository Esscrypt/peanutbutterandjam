import type { Hex } from '@pbnj/core'

/**
 * Previous tranche announcement data
 */
export interface PreviousTrancheAnnouncement {
  validatorIndex: bigint
  announcement: {
    workReports: Array<{
      coreIndex: bigint
      workReportHash: Hex
    }>
    signature: Hex
  }
}

/**
 * Negative judgment data
 */
export interface NegativeJudgment {
  workReportHash: Hex
  coreIndex: bigint
}
/**type Hexviem
 * Core work report information for audit selection
 */
export interface CoreWorkReport {
  /** Core index */
  coreIndex: bigint
  /** Work reports for this core */
  workReports: Array<{
    /** Work report hash */
    workReportHash: Hex
    /** Additional metadata */
    metadata?: Uint8Array
  }>
}

/**
 * Audit tranche selection result
 */
export interface AuditTrancheSelection {
  /** Selected cores for auditing (first 10 non-empty) */
  selectedCores: Array<{
    coreIndex: bigint
    workReports: Array<{
      workReportHash: Hex
      metadata?: Uint8Array
    }>
  }>
  /** Shuffled core sequence (for verification) */
  shuffledSequence: Array<{
    coreIndex: bigint
    workReports: Array<{
      workReportHash: Hex
      metadata?: Uint8Array
    }>
  }>
  /** Bandersnatch VRF output used for entropy */
  vrfOutput: Hex
  /** Tranche number */
  tranche: number
}
