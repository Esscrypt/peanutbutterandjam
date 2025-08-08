/**
 * Consensus Types for JAM Protocol
 *
 * Types for the Safrole consensus protocol as specified in Gray Paper Section 3
 * Reference: graypaper/text/safrole.tex
 */

import type { ValidatorKey } from './core'

export interface Ticket {
  /** Ticket identifier (hash) */
  id: string
  /** Entry index */
  entryIndex: number
  /** Ticket signature */
  signature: string
  /** Timestamp */
  timestamp: number
}

export interface TicketProof {
  /** Entry index */
  entryIndex: number
  /** Ring proof signature */
  signature: string
}

export interface SafroleState {
  /** Current slot index */
  slot: number
  /** Entropy accumulator and historical values */
  entropy: string[]
  /** Pending validator set (next epoch) */
  pendingSet: ValidatorKey[]
  /** Active validator set (current epoch) */
  activeSet: ValidatorKey[]
  /** Previous validator set */
  previousSet: ValidatorKey[]
  /** Epoch root (Bandersnatch ring root) */
  epochRoot: string
  /** Current epoch's seal tickets */
  sealTickets: string[]
  /** Ticket accumulator for next epoch */
  ticketAccumulator: Ticket[]
}

export interface SafroleInput {
  /** Block slot */
  slot: number
  /** Current entropy */
  entropy: string[]
  /** Ticket proofs in extrinsic */
  extrinsic: TicketProof[]
}

export interface SafroleOutput {
  /** Updated Safrole state */
  state: SafroleState
  /** Generated tickets */
  tickets: Ticket[]
  /** Processing errors */
  errors: string[]
}

export interface SafroleError {
  code: number
  message: string
}

/**
 * Constants from Gray Paper
 */
export const SAFROLE_CONSTANTS = {
  /** Epoch length in slots */
  EPOCH_LENGTH: 600,
  /** Epoch tail start (when ticket submission closes) */
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
 * Error codes as defined in Gray Paper Section 4.1
 * Reference: graypaper/text/safrole.tex
 */
export enum SafroleErrorCode {
  BAD_SLOT = 0, // Section 4.1.1
  UNEXPECTED_TICKET = 1, // Section 4.1.2
  BAD_TICKET_ORDER = 2, // Section 4.1.3
  BAD_TICKET_PROOF = 3, // Section 4.1.4
  BAD_TICKET_ATTEMPT = 4, // Section 4.1.5
  DUPLICATE_TICKET = 6, // Section 4.1.6
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
  /** Bandersnatch key (first 32 Uint8Array) */
  bandersnatch: string
  /** Ed25519 key (next 32 Uint8Array) */
  ed25519: string
  /** BLS key (next 144 Uint8Array) */
  bls: string
  /** Metadata (last 128 Uint8Array) */
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
