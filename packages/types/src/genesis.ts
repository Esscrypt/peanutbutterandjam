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

import type { Hex } from '@pbnj/core'
import type { ValidatorPublicKeys } from './consensus'

import type { GlobalState } from './global-state'

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
 * Genesis Header (genesisheader)
 *
 * The initial block header that starts the chain.
 * All subsequent blocks reference this as the ultimate parent.
 */
export interface GenesisHeader {
  /** Always null for genesis - no parent */
  readonly parent: null
  /** Genesis state root */
  readonly priorStateRoot: Hex
  /** Empty extrinsics hash for genesis */
  readonly extrinsicHash: Hex
  /** Genesis timeslot (typically 0) */
  readonly timeslot: bigint
  /** Genesis epoch mark (if any) */
  readonly epochMark: GenesisEpochMark | null
  /** No winners mark in genesis */
  readonly winnersMark: null
  /** Genesis offenders (typically empty) */
  readonly offendersMark: readonly Hex[]
  /** Genesis author index */
  readonly authorIndex: bigint
  /** Genesis VRF signature */
  readonly vrfSig: Hex
  /** Genesis seal signature */
  readonly sealSig: Hex
}

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
  /** Chain name */
  readonly name: string
  /** Protocol version */
  readonly protocolVersion: string

  /** Genesis configuration */
  readonly genesis: ChainGenesisConfig

  /** Network configuration */
  readonly network: ChainNetworkConfig

  /** Bootstrap nodes */
  readonly bootnodes: readonly string[]
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
  readonly genesisHeader: GenesisHeader
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
  genesisHeader: GenesisHeader,
) => GenesisValidationResult

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Genesis state component initializer
 */
export interface GenesisInitializers {
  readonly authpool: (config: ChainGenesisConfig) => GenesisState['authpool']
  readonly recent: (config: ChainGenesisConfig) => GenesisState['recent']
  readonly lastaccout: (
    config: ChainGenesisConfig,
  ) => GenesisState['lastaccout']
  readonly safrole: (config: ChainGenesisConfig) => GenesisState['safrole']
  readonly accounts: (config: ChainGenesisConfig) => GenesisState['accounts']
  readonly entropy: (config: ChainGenesisConfig) => GenesisState['entropy']
  readonly stagingset: (
    config: ChainGenesisConfig,
  ) => GenesisState['stagingset']
  readonly activeset: (config: ChainGenesisConfig) => GenesisState['activeset']
  readonly previousset: (
    config: ChainGenesisConfig,
  ) => GenesisState['previousset']
  readonly reports: (config: ChainGenesisConfig) => GenesisState['reports']
  readonly thetime: (config: ChainGenesisConfig) => GenesisState['thetime']
  readonly authqueue: (config: ChainGenesisConfig) => GenesisState['authqueue']
  readonly privileges: (
    config: ChainGenesisConfig,
  ) => GenesisState['privileges']
  readonly disputes: (config: ChainGenesisConfig) => GenesisState['disputes']
  readonly activity: (config: ChainGenesisConfig) => GenesisState['activity']
  readonly ready: (config: ChainGenesisConfig) => GenesisState['ready']
  readonly accumulated: (
    config: ChainGenesisConfig,
  ) => GenesisState['accumulated']
}
