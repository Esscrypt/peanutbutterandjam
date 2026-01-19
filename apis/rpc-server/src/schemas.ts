import { z } from 'zod'
import type { Blob, Hash } from './types'

/**
 * Zod schemas for RPC method validation
 * JIP-2: Hash and Blob are Base64-encoded strings per RFC 4648
 */

// Hash validation (Base64-encoded 32-byte data)
const hashSchema = z
  .string()
  .refine(
    (val) => {
      try {
        const decoded = Buffer.from(val, 'base64')
        return decoded.length === 32
      } catch {
        return false
      }
    },
    { message: 'Must be a valid Base64-encoded 32-byte hash' },
  )
  .transform((val) => val as Hash)

// Blob validation (Base64-encoded arbitrary-length data)
const blobSchema = z
  .string()
  .refine(
    (val) => {
      try {
        Buffer.from(val, 'base64')
        return true
      } catch {
        return false
      }
    },
    { message: 'Must be a valid Base64-encoded blob' },
  )
  .transform((val) => val as Blob)

// Service ID validation
const serviceIdSchema = z.number().int().positive()

// BigInt string validation (for serialization)
const bigintStringSchema = z
  .string()
  .regex(/^\d+$/, 'Must be a numeric string')
  .transform((val) => BigInt(val))

// Chain information methods
export const parametersSchema = z.object({}) // No parameters

export const bestBlockSchema = z.object({}) // No parameters

export const subscribeBestBlockSchema = z.object({}) // No parameters

export const finalizedBlockSchema = z.object({}) // No parameters

export const subscribeFinalizedBlockSchema = z.object({}) // No parameters

export const parentSchema = z.object({
  blockHash: hashSchema,
})

export const stateRootSchema = z.object({
  blockHash: hashSchema,
})

// Statistics methods
export const statisticsSchema = z.object({
  blockHash: hashSchema,
})

export const subscribeStatisticsSchema = z.object({
  finalized: z.boolean(),
})

// Service data methods
export const serviceDataSchema = z.object({
  blockHash: hashSchema,
  serviceId: serviceIdSchema,
})

export const subscribeServiceDataSchema = z.object({
  serviceId: serviceIdSchema,
  finalized: z.boolean(),
})

export const serviceValueSchema = z.object({
  blockHash: hashSchema,
  serviceId: serviceIdSchema,
  key: blobSchema,
})

export const subscribeServiceValueSchema = z.object({
  serviceId: serviceIdSchema,
  key: blobSchema,
  finalized: z.boolean(),
})

export const servicePreimageSchema = z.object({
  blockHash: hashSchema,
  serviceId: serviceIdSchema,
  hash: hashSchema,
})

export const subscribeServicePreimageSchema = z.object({
  serviceId: serviceIdSchema,
  hash: hashSchema,
  finalized: z.boolean(),
})

export const serviceRequestSchema = z.object({
  blockHash: hashSchema,
  serviceId: serviceIdSchema,
  hash: hashSchema,
  length: z.number().int().positive(),
})

export const subscribeServiceRequestSchema = z.object({
  serviceId: serviceIdSchema,
  hash: hashSchema,
  length: z.number().int().positive(),
  finalized: z.boolean(),
})

// BEEFY methods
export const beefyRootSchema = z.object({
  blockHash: hashSchema,
})

// Submission methods
export const submitWorkPackageSchema = z.object({
  coreIndex: bigintStringSchema,
  workPackage: blobSchema,
  extrinsics: z.array(blobSchema),
})

export const submitPreimageSchema = z.object({
  serviceId: bigintStringSchema,
  preimage: blobSchema,
  blockHash: hashSchema,
})

// Service listing
export const listServicesSchema = z.object({
  blockHash: hashSchema,
})

// JSON-RPC 2.0 base request schema
export const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  method: z.string(),
  params: z.array(z.unknown()).optional(),
})

// Method-specific parameter validation schemas (for params array)
export const parametersParamsSchema = z.tuple([]) // No parameters

export const bestBlockParamsSchema = z.tuple([]) // No parameters

export const finalizedBlockParamsSchema = z.tuple([]) // No parameters

export const parentParamsSchema = z.tuple([hashSchema])

export const stateRootParamsSchema = z.tuple([hashSchema])

export const statisticsParamsSchema = z.tuple([hashSchema])

export const serviceDataParamsSchema = z.tuple([hashSchema, serviceIdSchema])

export const serviceValueParamsSchema = z.tuple([
  hashSchema,
  serviceIdSchema,
  blobSchema,
])

export const servicePreimageParamsSchema = z.tuple([
  hashSchema,
  serviceIdSchema,
  hashSchema,
])

export const serviceRequestParamsSchema = z.tuple([
  hashSchema,
  serviceIdSchema,
  hashSchema,
  z.number().int().positive(),
])

export const beefyRootParamsSchema = z.tuple([hashSchema])

export const listServicesParamsSchema = z.tuple([hashSchema])

export const submitWorkPackageParamsSchema = z.tuple([
  bigintStringSchema,
  blobSchema,
  z.array(blobSchema),
])

export const submitPreimageParamsSchema = z.tuple([
  bigintStringSchema,
  blobSchema,
  hashSchema,
])
