/**
 * Block Store - Database Integration for JAM Blocks (Normalized Schema)
 *
 * Provides storage and retrieval of JAM blocks using fully normalized tables
 * No JSONB usage - all extrinsics stored in dedicated tables
 */

import {
  blake2bHash,
  bytesToHex,
  type Hex,
  type SafePromise,
  safeError,
  safeResult,
  safeTry,
} from '@pbnj/core'
import { encodePreimage } from '@pbnj/serialization'
import type { Preimage } from '@pbnj/types'
import { eq } from 'drizzle-orm'
import type { CoreDb, DbPreimage } from './index'
import { preimages } from './schema/core-schema'

export class PreimageStore {
  constructor(private db: CoreDb) {}

  async getPreimage(hash: Hex): SafePromise<DbPreimage> {
    const [err, result] = await safeTry(
      this.db.select().from(preimages).where(eq(preimages.hash, hash)).limit(1),
    )
    if (err) {
      return safeError(err)
    }
    return safeResult(result[0])
  }
  async storePreimage(
    preimage: Preimage,
    creationSlot: bigint,
  ): SafePromise<DbPreimage> {
    const [encodeError, encodedData] = encodePreimage(preimage)
    if (encodeError) {
      return safeError(encodeError)
    }
    const [err, hash] = blake2bHash(encodedData)
    if (err) {
      return safeError(err)
    }
    const [err2, result] = await safeTry(
      this.db
        .insert(preimages)
        .values({
          hash,
          serviceIndex: preimage.requester,
          data: bytesToHex(encodedData),
          creationSlot,
        })
        .onConflictDoUpdate({
          target: preimages.hash,
          set: {
            hash,
            data: bytesToHex(encodedData),
            serviceIndex: preimage.requester,
            creationSlot,
          },
        })
        .returning(),
    )
    if (err2) {
      return safeError(err2)
    }
    return safeResult(result[0])
  }

  async deletePreimage(hash: Hex): SafePromise<boolean> {
    const [err, result] = await safeTry(
      this.db.delete(preimages).where(eq(preimages.hash, hash)),
    )
    if (err) {
      return safeError(err)
    }
    return safeResult(result.length > 0)
  }

  async getAllPreimages(): SafePromise<DbPreimage[]> {
    const [err, result] = await safeTry(this.db.select().from(preimages))
    if (err) {
      return safeError(err)
    }
    return safeResult(result)
  }
}
