/**
 * Chain Spec Schema
 *
 * Zod schema for validating chain-spec.json files
 * Reference: JAM Protocol chain specification format
 */

import { type Safe, safeError, safeResult } from '@pbnjam/types'
import type { Hex } from 'viem'
import { z } from 'zod'

// ============================================================================
// Base Validators
// ============================================================================

/** Hex string validation */
const hexSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]*$/, 'Must be a valid hex string')
  .transform((val) => val as Hex)

/** 32-byte hex string (hash) */
const hex32Schema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Must be a 32-byte hex string')
  .transform((val) => val as Hex)

/** Variable-length hex string (for JIP-4 genesis_header) */
const variableHexSchema = z
  .string()
  .regex(/^(0x)?[a-fA-F0-9]+$/, 'Must be a valid hex string')
  .transform((val) => (val.startsWith('0x') ? val : `0x${val}`) as Hex)

/** 64-character hex string (no 0x prefix for validator keys) */
const hex64NoPrefix = z
  .string()
  .regex(
    /^[a-fA-F0-9]{64}$/,
    'Must be a 64-character hex string without 0x prefix',
  )

/** Ethereum address */
const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid Ethereum address')
  .transform((val) => val as Hex)

/** Bigint from string */
const bigintStringSchema = z
  .string()
  .regex(/^\d+$/, 'Must be a numeric string')
  .transform((val) => BigInt(val))

/** Positive integer from number or string */
const positiveIntSchema = z
  .union([z.number().int().min(0), z.string().regex(/^\d+$/).transform(Number)])
  .transform((val) => (typeof val === 'string' ? Number(val) : val))

// ============================================================================
// Genesis Validator Schema
// ============================================================================

export const genesisValidatorSchema = z.object({
  /** Libp2p peer ID */
  peer_id: z.string().min(1, 'Peer ID is required'),
  /** Bandersnatch public key (64 hex chars, no 0x prefix) */
  bandersnatch: hex64NoPrefix,
  /** Network address (IP:port) */
  net_addr: z.string().regex(/^[\d.]+:\d+$/, 'Must be in format IP:port'),
  /** Validator index */
  validator_index: positiveIntSchema,
  /** Validator stake amount */
  stake: bigintStringSchema,
})

// ============================================================================
// Genesis Account Schema
// ============================================================================

export const genesisAccountSchema = z.object({
  /** Account address */
  address: addressSchema,
  /** Account balance */
  balance: bigintStringSchema,
  /** Account nonce */
  nonce: positiveIntSchema,
  /** Whether this account is a validator */
  isValidator: z.boolean(),
  /** Validator key (if validator account) */
  validatorKey: hexSchema.optional(),
  /** Validator stake (if validator account) */
  stake: bigintStringSchema.optional(),
})

// ============================================================================
// Genesis Safrole Schema
// ============================================================================

export const genesisTicketSchema = z.object({
  /** Ticket ID */
  id: hexSchema,
  /** Entry index */
  entry_index: positiveIntSchema,
  /** Attempt (optional) */
  attempt: positiveIntSchema.optional(),
})

export const genesisSafroleSchema = z.object({
  /** Genesis epoch */
  epoch: positiveIntSchema,
  /** Genesis timeslot */
  timeslot: positiveIntSchema,
  /** Initial entropy */
  entropy: hex32Schema,
  /** Initial tickets */
  tickets: z.array(genesisTicketSchema),
  /** Epoch root (optional) */
  epoch_root: hex32Schema.optional(),
})

// ============================================================================
// Chain Spec Validator Schema (alternative format)
// ============================================================================

export const chainSpecValidatorSchema = z.object({
  /** Validator address */
  address: addressSchema,
  /** Validator public key (bandersnatch) */
  publicKey: hexSchema,
  /** Ed25519 key (optional) */
  ed25519: hexSchema.optional(),
  /** BLS key (optional) */
  bls: hexSchema.optional(),
  /** Metadata (optional) */
  metadata: hexSchema.optional(),
  /** Validator stake */
  stake: bigintStringSchema,
  /** Whether validator is active */
  isActive: z.boolean(),
  /** Alternative name */
  altname: z.string().optional(),
  /** Peer ID */
  peerId: z.string().optional(),
  /** Network address */
  address_net: z.string().optional(),
})

// ============================================================================
// Chain Spec Account Schema (alternative format)
// ============================================================================

export const chainSpecAccountSchema = z.object({
  /** Account balance */
  balance: bigintStringSchema,
  /** Account nonce */
  nonce: positiveIntSchema,
  /** Whether this account is a validator */
  isValidator: z.boolean().optional(),
  /** Validator key (if validator account) */
  validatorKey: hexSchema.optional(),
  /** Validator stake (if validator account) */
  stake: bigintStringSchema.optional(),
  /** Service code hash (if service account) */
  codeHash: hexSchema.optional(),
  /** Minimum balance requirement */
  minBalance: bigintStringSchema.optional(),
})

// ============================================================================
// Genesis State Schema
// ============================================================================

export const genesisStateSchema = z.object({
  /** Service accounts mapping */
  accounts: z.record(addressSchema, chainSpecAccountSchema).optional(),
  /** Validator specifications */
  validators: z.array(chainSpecValidatorSchema).optional(),
  /** Safrole initial state */
  safrole: genesisSafroleSchema,
  /** Core assignments (optional) */
  core_assignments: z.record(z.string(), positiveIntSchema).optional(),
  /** Privileges configuration (optional) */
  privileges: z
    .object({
      manager: positiveIntSchema,
      assigners: z.array(positiveIntSchema),
      delegator: positiveIntSchema,
      registrar: positiveIntSchema,
      always_accessors: z.array(positiveIntSchema),
    })
    .optional(),
  /** Initial entropy (optional) */
  entropy: hex32Schema.optional(),
  /** Genesis time slot (optional) */
  genesis_time: positiveIntSchema.optional(),
})

// ============================================================================
// Network Configuration Schema
// ============================================================================

export const chainSpecNetworkSchema = z.object({
  /** Chain ID */
  chain_id: z.string().optional(),
  /** Slot duration in seconds */
  slot_duration: positiveIntSchema.optional(),
  /** Epoch length in slots */
  epoch_length: positiveIntSchema.optional(),
  /** Maximum validators */
  max_validators: positiveIntSchema.optional(),
  /** Core count */
  core_count: positiveIntSchema.optional(),
})

// ============================================================================
// Complete Chain Spec Schema
// ============================================================================

/**
 * Chain specification JSON schema for format with genesis_validators
 */
export const chainSpecConfigSchema = z.object({
  /** Chain identifier */
  id: z.string().min(1, 'Chain ID is required'),
  /** Chain name */
  name: z.string().optional(),
  /** Bootstrap nodes */
  bootnodes: z.array(z.string()).optional(),
  /** Genesis validators (input format) - required to distinguish from JSON format */
  genesis_validators: z.array(genesisValidatorSchema),
  /** Accounts (input format) */
  accounts: z.array(genesisAccountSchema).optional(),
})

/**
 * State trie schema (JIP-4 format)
 * Keys are 62-character hex strings (31 bytes, no 0x prefix in JIP-4), normalized to Hex with 0x prefix
 * Values are arbitrary hex strings (with or without 0x), normalized to Hex with 0x prefix
 * Reference: JIP-4 - https://github.com/polkadot-fellows/JIPs/blob/main/JIP-4.md
 */
const stateTrieSchema = z
  .record(
    z
      .string()
      .regex(
        /^[a-fA-F0-9]{62}$/,
        'State key must be 62-character hex string (31 bytes)',
      ),
    z
      .string()
      .regex(/^(0x)?[a-fA-F0-9]+$/, 'State value must be a valid hex string')
      .transform((val) => (val.startsWith('0x') ? val : `0x${val}`) as Hex),
  )
  .transform((record) => {
    // Normalize keys to Hex format (add 0x prefix) to match StateTrie type
    const normalized: Record<Hex, Hex> = {}
    for (const [key, value] of Object.entries(record)) {
      const normalizedKey = key.startsWith('0x') ? key : `0x${key}`
      normalized[normalizedKey as Hex] = value
    }
    return normalized
  })

/**
 * Chain specification JSON schema for JIP-4 format
 * Reference: JIP-4 - https://github.com/polkadot-fellows/JIPs/blob/main/JIP-4.md
 *
 * JIP-4 format specification:
 * - id: machine-readable identifier (required)
 * - bootnodes: optional list of nodes in format "name@ip:port"
 * - genesis_header: hex string containing JAM-serialized genesis block header
 * - genesis_state: object with 62-char hex keys (31 bytes) and hex values
 * - protocol_parameters: hex string containing JAM-serialized protocol parameters (optional)
 */
export const chainSpecJsonSchema = z.object({
  /** Chain identifier - machine-readable identifier for the network */
  id: z.string().min(1, 'Chain ID is required'),
  /** Bootstrap nodes - optional list of nodes accepting connections in format "name@ip:port" */
  bootnodes: z.array(z.string()).optional(),
  /** Genesis header - hex string containing JAM-serialized genesis block header */
  genesis_header: variableHexSchema,
  /** Genesis state - object with 62-character hex keys (31 bytes) and arbitrary hex values */
  genesis_state: stateTrieSchema,
  /** Protocol parameters - hex string containing JAM-serialized protocol parameters (optional) */
  protocol_parameters: variableHexSchema.optional(),
})

// ============================================================================
// Type Exports
// ============================================================================

export type GenesisValidator = z.infer<typeof genesisValidatorSchema>
export type GenesisAccount = z.infer<typeof genesisAccountSchema>
export type GenesisTicket = z.infer<typeof genesisTicketSchema>
export type GenesisSafrole = z.infer<typeof genesisSafroleSchema>
export type ChainSpecValidator = z.infer<typeof chainSpecValidatorSchema>
export type ChainSpecAccount = z.infer<typeof chainSpecAccountSchema>
export type GenesisState = z.infer<typeof genesisStateSchema>
export type ChainSpecNetwork = z.infer<typeof chainSpecNetworkSchema>
export type ChainSpecConfig = z.infer<typeof chainSpecConfigSchema>
export type ChainSpecJson = z.infer<typeof chainSpecJsonSchema>

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate chain spec data
 */
export function validateChainSpec(data: unknown): Safe<ChainSpecJson> {
  const result = chainSpecJsonSchema.safeParse(data)

  if (result.success) {
    return safeResult(result.data)
  }

  return safeError(new Error(result.error.message))
}

/**
 * Parse and validate chain spec from JSON string
 */
export function parseChainSpec(jsonString: string): Safe<ChainSpecJson> {
  try {
    const parsed = JSON.parse(jsonString)
    return validateChainSpec(parsed)
  } catch (error) {
    return safeError(
      new Error(
        `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ),
    )
  }
}

/**
 * Check if chain spec is in config format (has genesis_validators)
 */
export function isChainSpecConfig(
  // biome-ignore lint/suspicious/noExplicitAny: type guard function accepts unknown input
  chainSpec: any,
): chainSpec is ChainSpecConfig {
  return 'genesis_validators' in chainSpec
}

/**
 * Check if chain spec is in JIP-4 format (binary state trie)
 * JIP-4 format has genesis_state as a Record<string, string> with hex keys (62 chars) and hex values
 * Reference: JIP-4 - https://github.com/polkadot-fellows/JIPs/blob/main/JIP-4.md
 */
// biome-ignore lint/suspicious/noExplicitAny: type guard function accepts unknown input
export function isJIP4Format(chainSpec: any): boolean {
  if (
    !chainSpec ||
    typeof chainSpec !== 'object' ||
    !('genesis_state' in chainSpec)
  ) {
    return false
  }
  const genesisState = chainSpec.genesis_state
  if (!genesisState || typeof genesisState !== 'object') {
    return false
  }
  // Check if it's a binary state trie (all keys are 62-char hex strings)
  const keys = Object.keys(genesisState)
  if (keys.length === 0) {
    return false
  }
  // JIP-4 format: keys are 62-character hex strings (31 bytes), not structured objects
  return keys.every((key) => /^[a-fA-F0-9]{62}$/.test(key))
}

/**
 * Check if chain spec is in full JSON format (has genesis_state)
 * All chain specs now use JIP-4 format, so this is equivalent to checking for genesis_state
 */
// biome-ignore lint/suspicious/noExplicitAny: type guard function accepts unknown input
export function isChainSpecJson(chainSpec: any): chainSpec is ChainSpecJson {
  return 'genesis_state' in chainSpec && isJIP4Format(chainSpec)
}
