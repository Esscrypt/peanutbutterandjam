/**
 * State Types for JAM Protocol
 *
 * Types for state management and database operations
 */

import type { Bytes } from './core'

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
  publicKey: Bytes
  /** Validator address */
  address: string
  /** Validator metadata */
  metadata: Record<string, unknown>
} 