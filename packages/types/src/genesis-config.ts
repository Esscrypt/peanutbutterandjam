/**
 * Genesis Configuration and Chain Spec Management
 *
 * Handles importing chain-spec.json and building Gray Paper compliant GenesisState.
 * Separates chain configuration from the canonical consensus state.
 */

import type { Hex } from '@pbnjam/core'
import type { ValidatorPublicKeys } from './consensus'
import type { GenesisResult, GenesisState } from './genesis'

// ============================================================================
// Chain Spec JSON Format (as stored in chain-spec.json files)
// ============================================================================

/**
 * Chain specification JSON format
 * This matches the actual chain-spec.json file structure
 */
export interface ChainSpecJson {
  /** Chain identifier */
  readonly id: string
  /** Chain name */
  readonly name: string
  /** Bootstrap nodes */
  readonly bootnodes: readonly string[]
  /** Genesis header hash */
  readonly genesis_header: Hex
  /** Genesis state configuration */
  readonly genesis_state: ChainSpecGenesisState
  /** Protocol version (optional) */
  readonly protocol_version?: string
  /** Network configuration (optional) */
  readonly network?: ChainSpecNetwork
}

/**
 * Genesis state section from chain-spec.json
 */
export interface ChainSpecGenesisState {
  /** Service accounts */
  readonly accounts: Record<Hex, ChainSpecAccount>
  /** Validator specifications */
  readonly validators: readonly ChainSpecValidator[]
  /** Safrole initial state */
  readonly safrole: ChainSpecSafrole
  /** Core assignments (optional) */
  readonly core_assignments?: Record<string, bigint>
  /** Privileges configuration (optional) */
  readonly privileges?: ChainSpecPrivileges
  /** Initial entropy (optional) */
  readonly entropy?: Hex
  /** Genesis time slot (optional) */
  readonly genesis_time?: bigint
}

/**
 * Account specification in chain-spec.json
 */
export interface ChainSpecAccount {
  /** Account balance */
  readonly balance: string | bigint
  /** Account nonce */
  readonly nonce: number | bigint
  /** Whether this account is a validator */
  readonly isValidator?: boolean
  /** Validator key (if validator account) */
  readonly validatorKey?: Hex
  /** Validator stake (if validator account) */
  readonly stake?: string | bigint
  /** Service code hash (if service account) */
  readonly codeHash?: Hex
  /** Minimum balance requirement */
  readonly minBalance?: string | bigint
}

/**
 * Validator specification in chain-spec.json
 */
export interface ChainSpecValidator {
  /** Validator address */
  readonly address: Hex
  /** Validator public key (bandersnatch part) */
  readonly publicKey: Hex
  /** Ed25519 key (optional) */
  readonly ed25519?: Hex
  /** BLS key (optional) */
  readonly bls?: Hex
  /** Metadata (optional) */
  readonly metadata?: Hex
  /** Validator stake */
  readonly stake: string | bigint
  /** Whether validator is active */
  readonly isActive: boolean
  /** Alternative name */
  readonly altname?: string
  /** Peer ID */
  readonly peerId?: string
  /** Network address */
  readonly address_net?: string
}

/**
 * Safrole configuration in chain-spec.json
 */
export interface ChainSpecSafrole {
  /** Genesis epoch */
  readonly epoch: number | bigint
  /** Genesis timeslot */
  readonly timeslot: number | bigint
  /** Initial entropy */
  readonly entropy: Hex
  /** Initial tickets */
  readonly tickets: readonly ChainSpecTicket[]
  /** Epoch root (optional) */
  readonly epoch_root?: Hex
}

/**
 * Ticket specification in chain-spec.json
 */
export interface ChainSpecTicket {
  /** Ticket ID */
  readonly id: Hex
  /** Entry index */
  readonly entry_index: number | bigint
  /** Attempt (optional) */
  readonly attempt?: number | bigint
}

/**
 * Privileges configuration in chain-spec.json
 */
export interface ChainSpecPrivileges {
  /** Manager service */
  readonly manager: number | bigint
  /** Assigner services */
  readonly assigners: readonly (number | bigint)[]
  /** Delegator service */
  readonly delegator: number | bigint
  /** Registrar service */
  readonly registrar: number | bigint
  /** Always accessible services */
  readonly always_accessors: readonly (number | bigint)[]
}

/**
 * Network configuration in chain-spec.json
 */
export interface ChainSpecNetwork {
  /** Chain ID */
  readonly chain_id: string
  /** Slot duration in seconds */
  readonly slot_duration: number | bigint
  /** Epoch length in slots */
  readonly epoch_length: number | bigint
  /** Maximum validators */
  readonly max_validators: number | bigint
  /** Core count */
  readonly core_count: number | bigint
}

// ============================================================================
// Genesis Configuration (Normalized from Chain Spec)
// ============================================================================

/**
 * Chain metadata
 */
export interface ChainMetadata {
  readonly id: string
  readonly name: string
  readonly protocolVersion: string
  readonly bootnodes: readonly string[]
}

/**
 * Genesis time configuration
 */
export interface GenesisTimeConfig {
  /** Genesis timeslot (JAM Common Era start) */
  readonly genesisTime: bigint
  /** Slot duration in seconds */
  readonly slotDuration: bigint
  /** Epoch length in slots */
  readonly epochLength: bigint
}

/**
 * Genesis validator configuration
 */
export interface GenesisValidatorConfig {
  /** All validator specifications */
  readonly validators: readonly NormalizedValidatorSpec[]
  /** Maximum number of validators */
  readonly maxValidators: bigint
}

/**
 * Normalized validator specification
 */
export interface NormalizedValidatorSpec {
  /** Complete validator key (all 4 components) */
  readonly validatorKey: ValidatorPublicKeys
  /** Validator address */
  readonly address: Hex
  /** Validator index */
  readonly index: bigint
  /** Alternative name */
  readonly name?: string
  /** Network information */
  readonly network?: {
    readonly peerId: string
    readonly address: string
  }
}

/**
 * Genesis accounts configuration
 */
export interface GenesisAccountsConfig {
  /** Service account specifications */
  readonly services: readonly NormalizedServiceSpec[]
}

/**
 * Normalized service specification
 */
export interface NormalizedServiceSpec {
  /** Service index */
  readonly index: bigint
  /** Service address */
  readonly address: Hex
  /** Initial balance */
  readonly balance: bigint
  /** Code hash (if service has code) */
  readonly codeHash?: Hex
  /** Minimum balance requirement */
  readonly minBalance: bigint
  /** Initial nonce */
  readonly nonce: bigint
}

/**
 * Genesis Safrole configuration
 */
export interface GenesisSafroleConfig {
  /** Initial entropy */
  readonly entropy: Hex
  /** Epoch root */
  readonly epochRoot: Hex
  /** Initial ticket accumulator */
  readonly ticketAccumulator: readonly NormalizedTicketSpec[]
  /** Pending set (initial validators) */
  readonly pendingSet: readonly ValidatorPublicKeys[]
}

/**
 * Normalized ticket specification
 */
export interface NormalizedTicketSpec {
  readonly id: Hex
  readonly entryIndex: bigint
}

/**
 * Genesis system configuration
 */
export interface GenesisSystemConfig {
  /** Core count */
  readonly coreCount: bigint
  /** Initial core assignments */
  readonly coreAssignments: ReadonlyMap<bigint, bigint>
  /** System privileges */
  readonly privileges: {
    readonly manager: bigint
    readonly assigners: readonly bigint[]
    readonly delegator: bigint
    readonly registrar: bigint
    readonly alwaysAccessors: readonly bigint[]
  }
}

// ============================================================================
// Genesis Manager Interface
// ============================================================================

/**
 * Genesis construction error
 */
export interface GenesisError {
  readonly code: string
  readonly message: string
  readonly details?: unknown
}

/**
 * Genesis manager interface
 */
export interface IGenesisManager {
  /**
   * Load and parse chain-spec.json file
   */
  loadChainSpec(filePath: string): Promise<ChainSpecJson>

  /**
   * Normalize chain spec to internal config format
   */
  // normalizeChainSpec(chainSpec: ChainSpecJson): ChainGenesisConfig

  /**
   * Build Gray Paper compliant genesis state from config
   */
  // buildGenesisState(config: ChainGenesisConfig): GenesisState

  /**
   * Complete genesis construction from chain-spec.json
   */
  constructGenesis(filePath: string): Promise<GenesisResult>

  /**
   * Validate genesis state
   */
  validateGenesis(genesisState: GenesisState): readonly GenesisError[]
}

// ============================================================================
// Utility Types
// ============================================================================
