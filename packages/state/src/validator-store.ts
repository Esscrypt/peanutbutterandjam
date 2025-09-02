//TODO: move this to a separate package
import { bytesToHex } from '@pbnj/core'
import { and, eq } from 'drizzle-orm'
import type { CoreDb } from '.'
import {
  type NewValidator,
  type Validator,
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
    index: number
    publicKey: Uint8Array
    metadata: { endpoint: { host: string; port: number } }
    epoch: number
    isActive: boolean
  }): Promise<void> {
    const validatorData: NewValidator = {
      index: info.index,
      publicKey: bytesToHex(info.publicKey),
      metadataHost: info.metadata.endpoint.host,
      metadataPort: info.metadata.endpoint.port,
      epoch: info.epoch,
      isActive: info.isActive,
    }

    await this.db
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
  }

  /**
   * Get validator information by index
   */
  async getValidator(index: number): Promise<Validator | null> {
    const result = await this.db
      .select()
      .from(validators)
      .where(eq(validators.index, index))
      .limit(1)

    return result[0] || null
  }

  /**
   * Get all validators for a specific epoch
   */
  async getValidatorsForEpoch(epoch: number): Promise<Validator[]> {
    return await this.db
      .select()
      .from(validators)
      .where(and(eq(validators.epoch, epoch), eq(validators.isActive, true)))
      .orderBy(validators.index)
  }

  /**
   * Get all active validators
   */
  async getActiveValidators(): Promise<Validator[]> {
    return await this.db
      .select()
      .from(validators)
      .where(eq(validators.isActive, true))
      .orderBy(validators.index)
  }

  /**
   * Deactivate a validator
   */
  async deactivateValidator(index: number): Promise<void> {
    await this.db
      .update(validators)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(validators.index, index))
  }
}
