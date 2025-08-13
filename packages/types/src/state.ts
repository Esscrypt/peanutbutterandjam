/**
 * State Types for JAM Protocol
 *
 * Types for state management and database operations
 */

import type { ConsensusTicket } from './consensus'
import type { Bytes, HashValue, Natural, ValidatorKey } from './core'

/**
 * Core account structure
 */
export interface CoreAccount {
  balance: Natural
  nonce: Natural
}

/**
 * Validator account structure
 */
export interface ValidatorAccount {
  publicKey: Bytes
  stake: Natural
  active: boolean
}

/**
 * Safrole state structure
 */
export interface SafroleState {
  currentslot: number
  pendingset: ValidatorKey[]
  sealtickets: ConsensusTicket[]
  entropy: HashValue
}

/**
 * Core time state structure
 */
export interface CoreTimeState {
  currentSlot: number
  epochLength: number
}

/**
 * Core state structure
 */
export interface CoreState {
  accounts: Record<string, CoreAccount>
  validators: Record<string, ValidatorAccount>
}

/**
 * Pending report structure
 */
export interface PendingReport {
  workReport: Bytes
  timestamp: number
}

/**
 * Authorizer pool structure
 */
export interface AuthorizerPool {
  authorizers: Bytes[]
  nextIndex: number
}

/**
 * Privileges state structure
 */
export interface PrivilegesState {
  manager: HashValue
  assigners: HashValue[]
  delegator: HashValue
  registrar: HashValue
  alwaysaccers: HashValue[]
}

/**
 * Judgments state structure
 */
export interface JudgmentsState {
  disputes: unknown[]
  resolutions: unknown[]
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  /** Database URL */
  url: string
  /** Database name */
  database: string
  /** Connection pool size */
  poolSize: number
  /** Connection timeout */
  timeout: number
}

/**
 * Validator information
 */
export interface ValidatorInfo {
  /** Validator ID */
  id: string
  /** Validator public key */
  publicKey: Uint8Array
  /** Validator address */
  address: string
  /** Validator metadata */
  metadata: Record<string, unknown>
}
