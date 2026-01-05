/**
 * Genesis State and Chain Specification Types
 *
 * Gray Paper compliant genesis state definition.
 * According to Gray Paper, genesis state (thestate^0) is simply the initial
 * instance of the complete JAM global state.
 *
 * Reference: graypaper/text/overview.tex - "genesis state thestate^0"
 * Reference: graypaper/text/header.tex - "genesis header genesisheader"
 */

import type { Hex } from 'viem'
import type { ValidatorPublicKeys } from './consensus'
import type { ChainSpecValidator } from './genesis-config'

import type { BlockHeader, GlobalState } from './global-state'
import type { SafroleTicket } from './serialization'

// ============================================================================
// Gray Paper Compliant Genesis State
// ============================================================================

/**
 * Genesis State (thestate^0)
 *
 * According to Gray Paper, the genesis state is simply the initial instance
 * of the complete JAM global state. It contains all 17 state components
 * initialized to their genesis values.
 *
 * This is NOT a separate structure - it IS the GlobalState at block 0.
 */
export type GenesisState = GlobalState

/**
 * Genesis epoch mark (if present)
 */
export interface GenesisEpochMark {
  readonly entropyAccumulator: Hex
  readonly entropy1: Hex
  readonly validators: readonly GenesisValidatorKeyPair[]
}

/**
 * Genesis validator key pair
 */
export interface GenesisValidatorKeyPair {
  readonly bandersnatch: Hex
  readonly ed25519: Hex
}

// ============================================================================
// Chain Specification Types (Implementation Specific)
// ============================================================================

/**
 * Chain Specification
 *
 * This is implementation-specific configuration used to generate
 * the Gray Paper compliant GenesisState and GenesisHeader.
 *
 * @remarks
 * This is NOT part of the Gray Paper specification - it's a practical
 * tool for configuring and generating the canonical genesis state.
 */
export interface ChainSpec {
  /** Chain identifier */
  readonly id: string

  /** Genesis configuration */
  readonly genesis_state: ChainGenesisState

  /** Bootstrap nodes */
  readonly bootnodes: readonly string[]
}

export interface ChainGenesisState {
  readonly accounts: Record<Hex, ChainSpecAccount>
  readonly validators: readonly ChainSpecValidator[]
  readonly safrole: GenesisSafroleFields
}

export interface GenesisSafroleFields {
  readonly epoch: bigint
  readonly timeslot: bigint
  readonly entropy: Hex
  readonly tickets: readonly SafroleTicket[]
}

export interface ChainSpecAccount {
  readonly balance: string | bigint
  readonly nonce: number | bigint
  readonly isValidator: boolean
  readonly validatorKey: Hex
  readonly stake: string | bigint
}

/**
 * Chain genesis configuration
 * Used to construct the Gray Paper compliant GenesisState
 */
export interface ChainGenesisConfig {
  /** Genesis timeslot (JAM Common Era start) */
  readonly genesisTime: bigint

  /** Initial validators */
  readonly validators: readonly GenesisValidatorSpec[]

  /** Initial service accounts */
  readonly services: readonly GenesisServiceSpec[]

  /** Initial entropy */
  readonly entropy: Hex

  /** Initial authorization assignments */
  readonly coreAssignments: ReadonlyMap<bigint, bigint>

  /** Special privileges assignment */
  readonly privileges: {
    readonly manager: bigint
    readonly assigners: readonly bigint[]
    readonly delegator: bigint
    readonly registrar: bigint
    readonly alwaysAccessors: readonly bigint[]
  }
}

/**
 * Genesis validator specification
 */
export interface GenesisValidatorSpec {
  /** Complete validator key (all 4 components) */
  readonly validatorKey: ValidatorPublicKeys
  /** Network peer ID */
  readonly peerId: string
  /** Network address */
  readonly address: string
  /** Validator index */
  readonly index: bigint
}

/**
 * Genesis service specification
 */
export interface GenesisServiceSpec {
  /** Service index */
  readonly index: bigint
  /** Initial balance */
  readonly balance: bigint
  /** Code hash (if service has code) */
  readonly codeHash?: Hex
  /** Initial storage */
  readonly storage: ReadonlyMap<Hex, Hex>
  /** Minimum balance requirement */
  readonly minBalance: bigint
}

/**
 * Chain network configuration
 */
export interface ChainNetworkConfig {
  /** Chain ID for network isolation */
  readonly chainId: string
  /** Slot duration in seconds */
  readonly slotDuration: bigint
  /** Epoch length in slots */
  readonly epochLength: bigint
  /** Maximum number of validators */
  readonly maxValidators: bigint
  /** Core count */
  readonly coreCount: bigint
}

// ============================================================================
// Genesis State Construction
// ============================================================================

/**
 * Genesis state builder result
 */
export interface GenesisResult {
  /** The canonical Gray Paper compliant genesis state */
  readonly genesisState: GenesisState
  /** The genesis header */
  readonly genesisHeader: BlockHeader
  /** Hash of the genesis header */
  readonly genesisHash: Hex
  /** Chain specification used */
  readonly chainSpec: ChainSpec
}

/**
 * Genesis state validation result
 */
export interface GenesisValidationResult {
  readonly isValid: boolean
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
}

/**
 * Genesis state builder function type
 * Converts chain spec configuration into Gray Paper compliant genesis state
 */
export type GenesisBuilder = (chainSpec: ChainSpec) => GenesisResult

/**
 * Genesis state validator function type
 */
export type GenesisValidator = (
  genesisState: GenesisState,
  genesisHeader: BlockHeader,
) => GenesisValidationResult

/**
 * Parsed bootnode information
 */
export interface ParsedBootnode {
  altname: string
  host: string
  port: number
  peerId: string
}
