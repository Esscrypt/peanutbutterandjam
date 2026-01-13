import { z } from 'zod'
import { createEnvSchema, loadEnvVariables } from './utils/env'

// Define RPC server specific environment schema
const rpcServerAdditionalSchema = {
  RPC_PORT: z
    .string()
    .transform((val) => Number.parseInt(val, 10))
    .default('19800'),
  RPC_HOST: z.string().default('0.0.0.0'),
  RPC_CORS_ORIGIN: z.string().default('*'),
  RPC_MAX_PAYLOAD_SIZE: z
    .string()
    .transform((val) => Number.parseInt(val, 10))
    .default('10485760'), // 10MB
  RPC_RATE_LIMIT_WINDOW: z
    .string()
    .transform((val) => Number.parseInt(val, 10))
    .default('900000'), // 15 minutes
  RPC_RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .transform((val) => Number.parseInt(val, 10))
    .default('1000'),
} as const

// Create complete environment schema
const rpcServerEnvSchema = createEnvSchema(rpcServerAdditionalSchema)

// Load and validate environment variables
const env = loadEnvVariables(rpcServerEnvSchema)

export interface RpcServerConfig {
  port: number
  host: string
  corsOrigin: string
  maxPayloadSize: number
  rateLimitWindow: number
  rateLimitMaxRequests: number
  environment: string
  logLevel: string
}

export const config: RpcServerConfig = {
  port: env.RPC_PORT,
  host: env.RPC_HOST,
  corsOrigin: env.RPC_CORS_ORIGIN,
  maxPayloadSize: env.RPC_MAX_PAYLOAD_SIZE,
  rateLimitWindow: env.RPC_RATE_LIMIT_WINDOW,
  rateLimitMaxRequests: env.RPC_RATE_LIMIT_MAX_REQUESTS,
  environment: env.NODE_ENV,
  logLevel: env.LOG_LEVEL,
}
