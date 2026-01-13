import type { Hex } from '@pbnjam/core'
import { z } from 'zod'

/**
 * Zod schemas for RPC method validation
 */

// Hex string validation (0x-prefixed, 64 hex chars for 32 bytes)
const hexSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Must be a valid 32-byte hex string')
  .transform((val) => val as Hex)

// Service ID validation
const serviceIdSchema = z.number().int().positive()

// BigInt string validation (for serialization)
const bigintStringSchema = z
  .string()
  .regex(/^\d+$/, 'Must be a numeric string')
  .transform((val) => BigInt(val))

// Uint8Array validation (accepts base64 or hex string)
const uint8ArraySchema = z
  .union([
    z.string().transform((val) => {
      // Try to parse as hex
      if (val.startsWith('0x')) {
        const hex = val.slice(2)
        if (hex.length % 2 !== 0) {
          throw new Error('Invalid hex string length')
        }
        return new Uint8Array(
          hex.match(/.{1,2}/g)!.map((byte) => Number.parseInt(byte, 16)),
        )
      }
      // Try to parse as base64
      return new Uint8Array(Buffer.from(val, 'base64'))
    }),
    z.instanceof(Uint8Array),
  ])
  .transform((val) => (val instanceof Uint8Array ? val : val))

// Chain information methods
export const parametersSchema = z.object({}) // No parameters

export const bestBlockSchema = z.object({}) // No parameters

export const subscribeBestBlockSchema = z.object({}) // No parameters

export const finalizedBlockSchema = z.object({}) // No parameters

export const subscribeFinalizedBlockSchema = z.object({}) // No parameters

export const parentSchema = z.object({
  blockHash: hexSchema,
})

export const stateRootSchema = z.object({
  blockHash: hexSchema,
})

// Statistics methods
export const statisticsSchema = z.object({
  blockHash: hexSchema,
})

export const subscribeStatisticsSchema = z.object({
  finalized: z.boolean(),
})

// Service data methods
export const serviceDataSchema = z.object({
  blockHash: hexSchema,
  serviceId: serviceIdSchema,
})

export const subscribeServiceDataSchema = z.object({
  serviceId: serviceIdSchema,
  finalized: z.boolean(),
})

export const serviceValueSchema = z.object({
  blockHash: hexSchema,
  serviceId: serviceIdSchema,
  key: uint8ArraySchema,
})

export const subscribeServiceValueSchema = z.object({
  serviceId: serviceIdSchema,
  key: uint8ArraySchema,
  finalized: z.boolean(),
})

export const servicePreimageSchema = z.object({
  blockHash: hexSchema,
  serviceId: serviceIdSchema,
  hash: hexSchema,
})

export const subscribeServicePreimageSchema = z.object({
  serviceId: serviceIdSchema,
  hash: hexSchema,
  finalized: z.boolean(),
})

export const serviceRequestSchema = z.object({
  blockHash: hexSchema,
  serviceId: serviceIdSchema,
  hash: hexSchema,
  length: z.number().int().positive(),
})

export const subscribeServiceRequestSchema = z.object({
  serviceId: serviceIdSchema,
  hash: hexSchema,
  length: z.number().int().positive(),
  finalized: z.boolean(),
})

// BEEFY methods
export const beefyRootSchema = z.object({
  blockHash: hexSchema,
})

// Submission methods
export const submitWorkPackageSchema = z.object({
  coreIndex: bigintStringSchema,
  workPackage: uint8ArraySchema,
  extrinsics: z.array(uint8ArraySchema),
})

export const submitPreimageSchema = z.object({
  serviceId: bigintStringSchema,
  preimage: uint8ArraySchema,
  blockHash: hexSchema,
})

// Service listing
export const listServicesSchema = z.object({
  blockHash: hexSchema,
})
