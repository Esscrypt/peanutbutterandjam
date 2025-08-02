import { config as dotenvConfig } from 'dotenv'
import { z } from 'zod'

// Base environment schema with common variables
export const baseEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error'])
    .default('info'),
  PORT: z
    .string()
    .transform((val) => Number.parseInt(val, 10))
    .default('3000'),
  HOST: z.string().default('localhost'),
})

export type BaseEnv = z.infer<typeof baseEnvSchema>

/**
 * Load and validate environment variables
 * @param schema - Zod schema to validate against
 * @param envPath - Optional path to .env file
 * @returns Validated environment variables
 */
export function loadEnvVariables<T extends z.ZodType>(
  schema: T,
  envPath?: string,
): z.infer<T> {
  // Load environment variables from .env file
  dotenvConfig({ path: envPath })

  // Validate and parse environment variables
  return schema.parse(process.env)
}

/**
 * Load base environment variables
 * @param envPath - Optional path to .env file
 * @returns Validated base environment variables
 */
export function loadBaseEnv(envPath?: string): BaseEnv {
  return loadEnvVariables(baseEnvSchema, envPath)
}

/**
 * Create a complete environment schema by extending the base schema
 * @param additionalSchema - Additional schema to extend the base schema with
 * @returns Combined schema
 */
export function createEnvSchema<T extends z.ZodRawShape>(additionalSchema: T) {
  return baseEnvSchema.extend(additionalSchema)
}
