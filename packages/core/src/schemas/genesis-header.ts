/**
 * Genesis Header Schema
 *
 * Zod schema for validating genesis header JSON files
 * Reference: JAM Protocol genesis specifications
 */

import { type Safe, safeError, safeResult } from '@pbnjam/types'
import type { Hex } from 'viem'
import { z } from 'zod'

// Hex string validation for 32-byte hashes
const hex32Schema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Must be a 32-byte hex string')
  .transform((t) => t as Hex)

// Hex string validation for 96-byte signatures (more flexible for genesis)
const hex96Schema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{192}$/, 'Must be a 96-byte hex string')
  .transform((t) => t as Hex)

// Flexible hex string validation for variable length hex strings
const flexibleHexSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]*$/, 'Must be a valid hex string')
  .transform((t) => t as Hex)
// Validator schema
const validatorSchema = z.object({
  bandersnatch: hex32Schema,
  ed25519: hex32Schema,
})

// Epoch mark schema
const epochMarkSchema = z.object({
  entropy: hex32Schema,
  tickets_entropy: hex32Schema, // entropyAccumulator
  validators: z.array(validatorSchema),
})

// Genesis header schema (more flexible for genesis.json)
export const genesisHeaderSchema = z.object({
  parent: hex32Schema,
  parent_state_root: hex32Schema,
  extrinsic_hash: hex32Schema,
  slot: z.number().int().min(0),
  epoch_mark: epochMarkSchema,
  tickets_mark: z.any().nullable().optional(),
  offenders_mark: z.array(hex32Schema).optional().default([]),
  author_index: z.number().int(),
  entropy_source: hex96Schema,
  seal: hex96Schema,
})

// Genesis state schema
export const genesisHeaderStateSchema = z.object({
  state_root: hex32Schema,
  keyvals: z.array(
    z.object({
      key: flexibleHexSchema,
      value: flexibleHexSchema,
    }),
  ),
})

// Complete genesis.json schema
export const genesisJsonSchema = z.object({
  header: genesisHeaderSchema,
  state: genesisHeaderStateSchema,
})

// Type inference
export type GenesisHeader = z.infer<typeof genesisHeaderSchema>
export type GenesisHeaderState = z.infer<typeof genesisHeaderStateSchema>
export type GenesisJson = z.infer<typeof genesisJsonSchema>

/**
 * Validate genesis header data
 */
export function validateGenesisHeader(data: unknown): Safe<GenesisHeader> {
  const result = genesisHeaderSchema.safeParse(data)

  if (result.success) {
    return safeResult(result.data)
  }

  return safeError(new Error(result.error.message))
}

/**
 * Parse and validate genesis header from JSON string
 */
export function parseGenesisHeader(jsonString: string): Safe<GenesisHeader> {
  const parsed = JSON.parse(jsonString)
  return validateGenesisHeader(parsed)
}

/**
 * Validate complete genesis.json data
 */
export function validateGenesisJson(data: unknown): Safe<GenesisJson> {
  const result = genesisJsonSchema.safeParse(data)

  if (result.success) {
    return safeResult(result.data)
  }

  return safeError(new Error(result.error.message))
}

/**
 * Parse and validate complete genesis.json from JSON string
 */
export function parseGenesisJson(jsonString: string): Safe<GenesisJson> {
  const parsed = JSON.parse(jsonString)
  return validateGenesisJson(parsed)
}
