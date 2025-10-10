/**
 * Consensus Types for JAM Protocol
 *
 * Types for the Safrole consensus protocol as specified in Gray Paper Section 3
 * Reference: graypaper/text/safrole.tex
 */

import type { Hex } from 'viem'
import type { SafroleTicket, SafroleTicketWithoutProof } from './serialization'

// Define ConsensusState interface
export interface ConsensusState {
  slot: number
  entropy: string[]
  pendingSet: ValidatorPublicKeys[]
  activeSet: ValidatorPublicKeys[]
  previousSet: ValidatorPublicKeys[]
  epochRoot: Hex
  sealTickets: string[]
  ticketAccumulator: SafroleTicket[]
}

export interface TicketProof {
  /** Entry index */
  entryIndex: bigint
  /** Ring proof signature */
  signature: Hex
}

/**
 * Gray Paper Compliant Safrole State Structure
 *
 * Gray Paper Equation 50 (label: eq:consensusstatecomposition): safrole ≡ (
 *   pendingset, epochroot, sealtickets, ticketaccumulator
 * )
 *
 * This represents the CANONICAL Safrole consensus state as defined in the Gray Paper.
 * Safrole manages the slot-sealing lottery system that determines which validators
 * can author blocks in each timeslot.
 *
 * Fields (Gray Paper terminology):
 * - pendingset: validator keys for the next epoch (ValidatorPublicKeys sequence)
 * - epochroot: Bandersnatch ring root composed from pendingset keys
 * - sealtickets: current epoch's slot-sealer sequence (union type)
 * - ticketaccumulator: highest-scoring tickets for next epoch
 *
 * SealTickets Union Type (Gray Paper Equation 67):
 * sealtickets ∈ sequence[C_epochlen]{safroleticket} ∪ sequence[C_epochlen]{bskey}
 *
 * Two modes:
 * 1. Regular Mode: sequence[C_epochlen]{safroleticket} - uses winning tickets
 * 2. Fallback Mode: sequence[C_epochlen]{bskey} - uses Bandersnatch keys directly
 *
 * SealTickets Generation (Gray Paper Equation 201):
 * sealtickets' ≡ {
 *   Z(ticketaccumulator)           when e' = e + 1 ∧ m ≥ C_epochtailstart ∧ |ticketaccumulator| = C_epochlen
 *   sealtickets                    when e' = e
 *   F(entropy'_2, activeset')      otherwise (fallback mode)
 * }
 *
 * Where:
 * - Z: outside-in sequencer function (ticket reordering)
 * - F: fallback key sequence function (Bandersnatch key selection)
 * - C_epochlen: 600 (epoch length in timeslots)
 * - C_epochtailstart: ticket submission cutoff
 *
 * Ticket Structure (Gray Paper Equation 74):
 * safroleticket ≡ (st_id, st_entryindex)
 * - st_id: hash (32 bytes) - ticket identifier from Ring VRF
 * - st_entryindex: natural number - entry index in ticket entries
 *
 * ✅ GRAY PAPER COMPLIANT:
 * - All 4 required fields present
 * - Correct field types and meanings
 * - Union type for sealTickets handles both modes
 * - ticketAccumulator uses proper ticket structure
 *
 * Usage: Core consensus state for Safrole protocol
 * Related: ValidatorPublicKeys, Ticket interfaces; entropy accumulation
 */
export interface SafroleState {
  /** Pending validator set (next epoch) - Gray Paper: pendingSet */
  pendingSet: ValidatorPublicKeys[]
  /** Epoch root (Bandersnatch ring root) - Gray Paper: epochRoot */
  epochRoot: Hex
  // /** Current epoch's seal tickets - Gray Paper: sealTickets */
  // // this could be a list of tickets of a list of bandersnatch keys in fallback mode
  sealTickets: (SafroleTicketWithoutProof | Uint8Array)[]
  // /** Ticket accumulator for next epoch - Gray Paper: ticketAccumulator */
  ticketAccumulator: SafroleTicketWithoutProof[]
  // /** Entropy accumulator for epoch transitions - Gray Paper: entropyaccumulator */
  // entropyAccumulator?: Hex

  // Note: activeSet, previousSet, and stagingSet are part of global state,
  // not internal Safrole state according to Gray Paper equation (50)
}

export interface SafroleInput {
  /** Block slot */
  slot: bigint
  /** Current entropy */
  entropy: Hex
  /** Ticket proofs in extrinsic */
  extrinsic: SafroleTicket[]
}

export interface SafroleOutput {
  /** Updated Safrole state */
  state: SafroleState
  /** Generated tickets */
  tickets: SafroleTicket[]
  /** Processing errors */
  errors: SafroleErrorCode[]
}

export interface SafroleError {
  code: number
  message: string
}

type IChainSpecConstants = {
  NUM_VALIDATORS: number
  NUM_CORES: number
  SLOT_DURATION: number
  EPOCH_LENGTH: number
  CONTEST_DURATION: number
  TICKETS_PER_VALIDATOR: number
  PREIMAGE_EXPUNGE_PERIOD: number
  MAX_TICKETS_PER_EXTRINSIC: number
  ROTATION_PERIOD: number
  NUM_EC_PIECES_PER_SEGMENT: number
  MAX_BLOCK_GAS: number
  MAX_REFINE_GAS: number
}

export const TINY_SAFROLE_CONSTANTS: IChainSpecConstants = {
  /** Number of validators */
  NUM_VALIDATORS: 6,
  /** Number of cores */
  NUM_CORES: 2,
  /** Slot duration in milliseconds */
  SLOT_DURATION: 6000,
  /** Epoch length in slots */
  EPOCH_LENGTH: 12,
  /** Contest duration in slots */
  CONTEST_DURATION: 10, // same as epoch tail start
  /** Tickets per validator */
  TICKETS_PER_VALIDATOR: 3,
  /** Maximum tickets per extrinsic */
  MAX_TICKETS_PER_EXTRINSIC: 3,
  /** Rotation period in slots */
  ROTATION_PERIOD: 4,
  /** Number of erasure coding pieces per segment */
  NUM_EC_PIECES_PER_SEGMENT: 1026,
  /** Maximum block gas */
  MAX_BLOCK_GAS: 20000000,
  /** Maximum refine gas */
  MAX_REFINE_GAS: 1000000000,
  /** Preimage expunge period in slots */
  PREIMAGE_EXPUNGE_PERIOD: 32,
} as const

/**
 * Constants from Gray Paper
 */
export const FULL_SAFROLE_CONSTANTS: IChainSpecConstants = {
  NUM_VALIDATORS: 1023,
  NUM_CORES: 341,
  /** Slot duration in milliseconds */
  SLOT_DURATION: 6000,
  /** Epoch length in slots */
  EPOCH_LENGTH: 600,
  /** Contest duration in slots */
  CONTEST_DURATION: 500, // 5/6 of epoch length
  /** Tickets per validator */
  TICKETS_PER_VALIDATOR: 2,
  /** Maximum tickets per extrinsic */
  MAX_TICKETS_PER_EXTRINSIC: 16,
  /** Preimage expunge period in slots */
  PREIMAGE_EXPUNGE_PERIOD: 19200,
  /** Rotation period in slots */
  ROTATION_PERIOD: 10,
  /** Number of erasure coding pieces per segment */
  NUM_EC_PIECES_PER_SEGMENT: 6,
  /** Maximum block gas */
  MAX_BLOCK_GAS: 3500000000,
  /** Maximum refine gas */
  MAX_REFINE_GAS: 5000000000,
} as const

export const SMALL_SAFROLE_CONSTANTS: IChainSpecConstants = {
  NUM_VALIDATORS: 12,

  NUM_CORES: 4,
  /** Slot duration in milliseconds */
  SLOT_DURATION: 6000,
  /** Epoch length in slots */
  EPOCH_LENGTH: 36,
  /** Contest duration in slots */
  CONTEST_DURATION: 30,
  /** Tickets per validator */
  TICKETS_PER_VALIDATOR: 2,
  /** Maximum tickets per extrinsic */
  MAX_TICKETS_PER_EXTRINSIC: 3,

  NUM_EC_PIECES_PER_SEGMENT: 513,

  ROTATION_PERIOD: 4,
  /** Preimage expunge period in slots */
  PREIMAGE_EXPUNGE_PERIOD: 32,
  /** Maximum block gas */
  MAX_BLOCK_GAS: 20000000,
  /** Maximum refine gas */
  MAX_REFINE_GAS: 1000000000,
} as const

// export const MEDIUM_SAFROLE_CONSTANTS: IChainSpecConstants = {
//   /** Slot duration in milliseconds */
//   SLOT_DURATION: 6000,
//   /** Epoch length in slots */
//   EPOCH_LENGTH: 60,
//   /** Contest duration in slots */
//   CONTEST_DURATION: 50,
//   /** Tickets per validator */
//   TICKETS_PER_VALIDATOR: 2,
//   /** Maximum tickets per extrinsic */
//   MAX_TICKETS_PER_EXTRINSIC: 3,

//   NUM_EC_PIECES_PER_SEGMENT: 342,

//   /** Maximum block gas */
//   MAX_BLOCK_GAS: 20000000,
//   /** Maximum refine gas */
//   MAX_REFINE_GAS: 1000000000,
// }

// Formally, we define the time in terms of seconds passed
// since the beginning of the Jam Common Era, 1200 utc on
// January 1, 2025.8 Midday utc is selected to ensure that
// all major timezones are on the same date at any exact
// 24-hour multiple from the beginning of the common era.
// Formally, this value is denoted T .
// export const JAM_COMMON_ERA_START_TIME = new Date('2025-01-01T12:00:00Z').getTime()
export const JAM_COMMON_ERA_START_TIME = 1735732800000
/**
 * Safrole Error Code Type
 *
 * Comprehensive error code system for Safrole State Transition Function
 * Based on Gray Paper specifications and test vector error codes
 *
 * Reference:
 * - graypaper/text/safrole.tex
 * - submodules/jamtestvectors/stf/safrole/safrole.asn
 */
export type SafroleErrorCode =
  // Slot progression errors
  | 'bad_slot'
  | 'invalid_slot_progression'
  | 'slot_too_old'
  | 'slot_too_far_ahead'

  // Ticket validation errors
  | 'bad_ticket_attempt'
  | 'bad_ticket_order'
  | 'bad_ticket_proof'
  | 'duplicate_ticket'
  | 'unexpected_ticket'
  | 'invalid_ticket_entry_index'
  | 'invalid_ticket_signature'
  | 'ticket_signature_too_short'
  | 'ticket_signature_too_long'
  | 'ticket_signature_invalid_format'
  | 'ticket_signature_all_zeros'

  // Entropy validation errors
  | 'invalid_entropy_format'
  | 'invalid_entropy_size'
  | 'invalid_entropy_all_zeros'

  // Extrinsic validation errors
  | 'too_many_extrinsics'
  | 'invalid_extrinsic_count'
  | 'extrinsic_empty_when_required'

  // State validation errors
  | 'invalid_pending_set'
  | 'invalid_epoch_root'
  | 'invalid_seal_tickets'
  | 'invalid_ticket_accumulator'

  // Epoch transition errors
  | 'invalid_epoch_transition'
  | 'missing_epoch_mark'
  | 'invalid_epoch_mark'

  // Ticket accumulation errors
  | 'ticket_accumulator_overflow'
  | 'ticket_accumulator_underflow'
  | 'invalid_ticket_accumulator_size'

  // VRF and cryptographic errors
  | 'vrf_proof_invalid'
  | 'vrf_proof_generation_failed'
  | 'ring_proof_invalid'
  | 'bandersnatch_signature_invalid'

  // Validator set errors
  | 'invalid_validator_set'
  | 'validator_set_empty'
  | 'validator_key_invalid'
  | 'validator_metadata_invalid'

  // Timing and epoch errors
  | 'epoch_tail_violation'
  | 'invalid_epoch_length'
  | 'invalid_slot_phase'

  // Memory and resource errors
  | 'memory_allocation_failed'
  | 'resource_exhausted'
  | 'buffer_overflow'

  // Internal implementation errors
  | 'internal_error' // Unexpected internal error
  | 'validation_failed' // General validation failure

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
  entryIndex: bigint
  /** Extrinsic signature */
  signature: Hex
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
  entryIndex: bigint
  /** Ticket signature */
  signature: Hex
  /** Timestamp */
  timestamp: bigint
}

/**
 * Consensus constants
 */
export const CONSENSUS_CONSTANTS = {
  /** Maximum extrinsics per slot */
  MAX_EXTRINSICS_PER_SLOT: 10n,
  /** Maximum ticket entries per validator (Gray Paper: Cticketentries = 2) */
  MAX_TICKET_ENTRIES: 2n,
  /** Maximum tickets per block/extrinsic (Gray Paper: Cmaxblocktickets = 16) */
  MAX_BLOCK_TICKETS: 16n,
  /** Entropy size */
  ENTROPY_SIZE: 1n,
  /** Maximum seal tickets */
  MAX_SEAL_TICKETS: 10n,
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
 * @param bandersnatch - Bandersnatch public key (32 bytes)
 * @param ed25519 - Ed25519 public key (32 bytes)
 * @param bls - BLS public key (144 bytes)
 * @param metadata - Metadata (128 bytes)
 *   The validators' IP-layer endpoints are given as IPv6/port combinations,
 *   to be found in the first 18 bytes of validator metadata,
 *   with the first 16 bytes being the IPv6 address
 *   and the latter 2 being a little endian representation of the port.
 */
export interface ValidatorPublicKeys {
  /** Bandersnatch key (first 32 Uint8Array) */
  bandersnatch: Hex
  /** Ed25519 key (next 32 Uint8Array) */
  ed25519: Hex
  /** BLS key (next 144 Uint8Array) */
  bls: Hex
  /** Metadata (last 128 Uint8Array) */
  metadata: Hex
}

/**
 * Winner marker
 */
export interface WinnerMarker {
  /** Slot number */
  slot: number
  /** Winner validator */
  winner: ValidatorPublicKeys
  /** Winner ticket */
  ticket: ConsensusTicket
}
