//TODO: move this to a separate package
import { bytesToHex } from '@pbnj/core'
import type { SafePromise } from '@pbnj/types'
import { safeError, safeResult, safeTry } from '@pbnj/types'
import { and, eq } from 'drizzle-orm'
import type { CoreDb } from '.'
import {
  type DbNewValidator,
  type DbValidator,
  validators,
} from './schema/core-schema'

/**
 * Validator store implementation
 */
export class ValidatorStore {
  private db: CoreDb

  constructor(db: CoreDb) {
    this.db = db
  }

  /**
   * Store or update validator information
   */
  async upsertValidator(info: {
    index: bigint
    publicKey: Uint8Array
    metadata: { endpoint: { host: string; port: number } }
    epoch: bigint
    isActive: boolean
  }): SafePromise<DbValidator> {
    const validatorData: DbNewValidator = {
      index: info.index,
      publicKey: bytesToHex(info.publicKey),
      metadataHost: info.metadata.endpoint.host,
      metadataPort: info.metadata.endpoint.port,
      epoch: info.epoch,
      isActive: info.isActive,
    }

    const [err, result] = await safeTry(
      this.db
        .insert(validators)
        .values(validatorData)
        .onConflictDoUpdate({
          target: validators.index,
          set: {
            publicKey: validatorData.publicKey,
            metadataHost: validatorData.metadataHost,
            metadataPort: validatorData.metadataPort,
            epoch: validatorData.epoch,
            isActive: validatorData.isActive,
            updatedAt: new Date(),
          },
        })
        .returning(),
    )

    if (err) {
      return safeError(err)
    }

    return safeResult(result[0])
  }

  /**
   * Get validator information by index
   */
  async getValidator(index: bigint): SafePromise<DbValidator | null> {
    const [err, result] = await safeTry(
      this.db
        .select()
        .from(validators)
        .where(eq(validators.index, index))
        .limit(1),
    )

    if (err) {
      return safeError(err)
    }

    return safeResult(result[0] || null)
  }

  /**
   * Get all validators for a specific epoch
   */
  async getValidatorsForEpoch(epoch: bigint): SafePromise<DbValidator[]> {
    const [err, result] = await safeTry(
      this.db
        .select()
        .from(validators)
        .where(and(eq(validators.epoch, epoch), eq(validators.isActive, true)))
        .orderBy(validators.index),
    )

    if (err) {
      return safeError(err)
    }

    return safeResult(result)
  }

  /**
   * Get all active validators
   */
  async getActiveValidators(): SafePromise<DbValidator[]> {
    const [err, result] = await safeTry(
      this.db
        .select()
        .from(validators)
        .where(eq(validators.isActive, true))
        .orderBy(validators.index),
    )

    if (err) {
      return safeError(err)
    }

    return safeResult(result)
  }

  /**
   * Deactivate a validator
   */
  async deactivateValidator(index: bigint): SafePromise<DbValidator> {
    const [err, result] = await safeTry(
      this.db
        .update(validators)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(validators.index, index))
        .returning(),
    )

    if (err) {
      return safeError(err)
    }

    return safeResult(result[0])
  }
}
