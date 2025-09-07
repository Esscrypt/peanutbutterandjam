/**
 * State Types for JAM Protocol
 *
 * Types for state management and database operations
 */

/**
 * Core account structure
 */
export interface CoreAccount {
  balance: bigint
  nonce: bigint
}

/**
 * Validator account structure
 */
export interface ValidatorAccount {
  publicKey: Uint8Array
  stake: bigint
  active: boolean
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
 * Authorizer pool structure
 */
export interface AuthorizerPool {
  authorizers: Uint8Array[]
  nextIndex: number
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
