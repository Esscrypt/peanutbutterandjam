/**
 * Consensus Types for JAM Protocol
 *
 * Consensus-related types and interfaces
 * Reference: Gray Paper Section 3 - Block Production and Chain Growth
 */

import type { Hash, Validator } from './common'

/**
 * Consensus state
 */
export interface ConsensusState {
  /** Current slot */
  slot: number
  /** Current epoch */
  epoch: number
  /** Active validator set */
  activeValidators: Validator[]
  /** Pending validator set */
  pendingValidators: Validator[]
  /** Previous validator set */
  previousValidators: Validator[]
  /** Epoch root */
  epochRoot: Hash
  /** Entropy accumulator */
  entropy: string[]
}

/**
 * Consensus input
 */
export interface ConsensusInput {
  /** Target slot */
  slot: number
  /** Current entropy */
  entropy: string[]
  /** Extrinsics to process */
  extrinsics: ConsensusExtrinsic[]
}

/**
 * Consensus extrinsic
 */
export interface ConsensusExtrinsic {
  /** Entry index */
  entryIndex: number
  /** Extrinsic signature */
  signature: string
  /** Extrinsic data */
  data?: Uint8Array
}

/**
 * Consensus output
 */
export interface ConsensusOutput {
  /** Updated consensus state */
  state: ConsensusState
  /** Generated tickets */
  tickets: ConsensusTicket[]
  /** Processing errors */
  errors: string[]
}

/**
 * Consensus ticket
 */
export interface ConsensusTicket {
  /** Ticket ID */
  id: string
  /** Entry index */
  entryIndex: number
  /** Ticket signature */
  signature: string
  /** Timestamp */
  timestamp: number
}

/**
 * Consensus constants
 */
export const CONSENSUS_CONSTANTS = {
  /** Epoch length in slots */
  EPOCH_LENGTH: 600,
  /** Epoch tail start */
  EPOCH_TAIL_START: 540,
  /** Maximum extrinsics per slot */
  MAX_EXTRINSICS_PER_SLOT: 10,
  /** Maximum ticket entries */
  MAX_TICKET_ENTRIES: 1000,
  /** Entropy size */
  ENTROPY_SIZE: 1,
  /** Maximum seal tickets */
  MAX_SEAL_TICKETS: 10,
} as const

/**
 * Consensus error codes
 */
export enum ConsensusErrorCode {
  BAD_SLOT = 0,
  UNEXPECTED_TICKET = 1,
  BAD_TICKET_ORDER = 2,
  BAD_TICKET_PROOF = 3,
  BAD_TICKET_ATTEMPT = 4,
  DUPLICATE_TICKET = 6,
}

/**
 * Consensus error
 */
export interface ConsensusError {
  /** Error code */
  code: ConsensusErrorCode
  /** Error message */
  message: string
  /** Error context */
  context?: Record<string, unknown>
}

/**
 * Validator key structure
 */
export interface ValidatorKey {
  /** Bandersnatch key (first 32 bytes) */
  bandersnatch: string
  /** Ed25519 key (next 32 bytes) */
  ed25519: string
  /** BLS key (next 144 bytes) */
  bls: string
  /** Metadata (last 128 bytes) */
  metadata: string
}

/**
 * Epoch marker
 */
export interface EpochMarker {
  /** Epoch number */
  epoch: number
  /** Entropy accumulator */
  entropyAccumulator: string
  /** Validator keys */
  validatorKeys: ValidatorKey[]
  /** Epoch root */
  epochRoot: Hash
}

/**
 * Winner marker
 */
export interface WinnerMarker {
  /** Slot number */
  slot: number
  /** Winner validator */
  winner: ValidatorKey
  /** Winner ticket */
  ticket: ConsensusTicket
}
