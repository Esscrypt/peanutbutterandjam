import { drizzle } from 'drizzle-orm/postgres-js'
import * as coreSchema from './schema/core-schema'

export * from 'drizzle-orm'

export type * from './schema/core-schema'

function createCoreDb(databaseUrl: string) {
  return drizzle(databaseUrl, { schema: coreSchema })
}

type CoreDb = ReturnType<typeof createCoreDb>

export { coreSchema, createCoreDb, type CoreDb }

export { NetworkingStore } from './networking-store'
export { ServiceAccountStore } from './service-account-store'
export { ValidatorStore } from './validator-store'
