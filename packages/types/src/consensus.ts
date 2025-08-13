/**
 * Consensus Types for JAM Protocol
 *
 * Types for the Safrole consensus protocol as specified in Gray Paper Section 3
 * Reference: graypaper/text/safrole.tex
 */

import type { Hash, HashValue, HexString } from './core'

// Define ConsensusState interface
export interface ConsensusState {
  slot: number
  entropy: string[]
  pendingSet: ValidatorKey[]
  activeSet: ValidatorKey[]
  previousSet: ValidatorKey[]
  epochRoot: Hash
  sealTickets: string[]
  ticketAccumulator: Ticket[]
}

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
  /** Pending validator set (next epoch) - Gray Paper: pendingSet */
  pendingSet: ValidatorKey[]
  /** Epoch root (Bandersnatch ring root) - Gray Paper: epochRoot */
  epochRoot: HashValue
  /** Current epoch's seal tickets - Gray Paper: sealTickets */
  sealTickets: Ticket[] | ValidatorKey[]
  /** Ticket accumulator for next epoch - Gray Paper: ticketAccumulator */
  ticketAccumulator: Ticket[]

  // Note: activeSet, previousSet, and stagingSet are part of global state,
  // not internal Safrole state according to Gray Paper equation (50)
}

export interface SafroleInput {
  /** Block slot */
  slot: number
  /** Current entropy */
  entropy: HashValue
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
  bandersnatch: HexString
  /** Ed25519 key (next 32 Uint8Array) */
  ed25519: HexString
  /** BLS key (next 144 Uint8Array) */
  bls: HexString
  /** Metadata (last 128 Uint8Array) */
  metadata: HexString
}

/**
 * Epoch marker
 */
export interface EpochMarker {
  /** Epoch number */
  epoch: number
  /** Entropy accumulator */
  entropyAccumulator: HexString
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
