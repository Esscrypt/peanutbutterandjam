import { z } from 'zod'

/**
 * Base environment variables schema
 * These are common across all services
 */
const baseEnvSchema = {
  NODE_ENV: z
    .enum(['development', 'production', 'test', 'local'])
    .default('development'),
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
} as const

/**
 * Creates a complete environment schema by merging base schema with additional schema
 * @param additionalSchema - Additional environment variables schema
 * @returns Merged Zod object schema
 */
export function createEnvSchema<T extends z.ZodRawShape>(
  additionalSchema: T,
): z.ZodObject<typeof baseEnvSchema & T> {
  return z.object({
    ...baseEnvSchema,
    ...additionalSchema,
  })
}

/**
 * Loads and validates environment variables against the provided schema
 * @param schema - Zod schema for environment variables
 * @returns Validated and parsed environment variables
 * @throws ZodError if validation fails
 */
export function loadEnvVariables<T extends z.ZodTypeAny>(
  schema: T,
): z.infer<T> {
  return schema.parse(process.env)
}
