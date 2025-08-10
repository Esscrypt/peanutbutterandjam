/**
 * Genesis Header Schema
 *
 * Zod schema for validating genesis header JSON files
 * Reference: JAM Protocol genesis specifications
 */

import { z } from 'zod'

// Hex string validation for 32-byte hashes
const hex32Schema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Must be a 32-byte hex string')

// Hex string validation for 96-byte signatures
const hex96Schema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{192}$/, 'Must be a 96-byte hex string')

// Validator schema
const validatorSchema = z.object({
  bandersnatch: hex32Schema,
  ed25519: hex32Schema,
})

// Epoch mark schema
const epochMarkSchema = z.object({
  entropy: hex32Schema,
  tickets_entropy: hex32Schema,
  validators: z.array(validatorSchema),
})

// Genesis header schema
export const genesisHeaderSchema = z.object({
  parent: hex32Schema,
  parent_state_root: hex32Schema,
  extrinsic_hash: hex32Schema,
  slot: z.number().int().min(0),
  epoch_mark: epochMarkSchema,
  tickets_mark: z.any().nullable(),
  offenders_mark: z.array(z.any()),
  author_index: z.number().int(),
  entropy_source: hex96Schema,
  seal: hex96Schema,
})

// Genesis state schema
export const genesisStateSchema = z.object({
  state_root: hex32Schema,
  keyvals: z.array(
    z.object({
      key: z.string().regex(/^0x[a-fA-F0-9]*$/),
      value: z.string().regex(/^0x[a-fA-F0-9]*$/),
    }),
  ),
})

// Complete genesis.json schema
export const genesisJsonSchema = z.object({
  header: genesisHeaderSchema,
  state: genesisStateSchema,
})

// Type inference
export type GenesisHeader = z.infer<typeof genesisHeaderSchema>
export type GenesisState = z.infer<typeof genesisStateSchema>
export type GenesisJson = z.infer<typeof genesisJsonSchema>

/**
 * Validate genesis header data
 */
export function validateGenesisHeader(
  data: unknown,
): { success: true; data: GenesisHeader } | { success: false; error: string } {
  const result = genesisHeaderSchema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  return {
    success: false,
    error: `Genesis header validation failed: ${result.error.message}`,
  }
}

/**
 * Parse and validate genesis header from JSON string
 */
export function parseGenesisHeader(
  jsonString: string,
): { success: true; data: GenesisHeader } | { success: false; error: string } {
  try {
    const parsed = JSON.parse(jsonString)
    return validateGenesisHeader(parsed)
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Validate complete genesis.json data
 */
export function validateGenesisJson(
  data: unknown,
): { success: true; data: GenesisJson } | { success: false; error: string } {
  const result = genesisJsonSchema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  }

  return {
    success: false,
    error: `Genesis JSON validation failed: ${result.error.message}`,
  }
}

/**
 * Parse and validate complete genesis.json from JSON string
 */
export function parseGenesisJson(
  jsonString: string,
): { success: true; data: GenesisJson } | { success: false; error: string } {
  try {
    const parsed = JSON.parse(jsonString)
    return validateGenesisJson(parsed)
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}
