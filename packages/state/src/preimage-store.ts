/**
 * Block Store - Database Integration for JAM Blocks (Normalized Schema)
 *
 * Provides storage and retrieval of JAM blocks using fully normalized tables
 * No JSONB usage - all extrinsics stored in dedicated tables
 */

import {
  blake2bHash,
  type Hex,
  hexToBytes,
  type SafePromise,
  safeError,
  safeResult,
  safeTry,
} from '@pbnj/core'
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
    blockHash: Hex,
    serviceIndex: bigint,
  ): SafePromise<DbPreimage> {
    const data = hexToBytes(preimage.data)
    const [err, hash] = blake2bHash(data)
    if (err) {
      return safeError(err)
    }
    const [err2, result] = await safeTry(
      this.db
        .insert(preimages)
        .values({ blockHash, hash, serviceIndex, data: preimage.data })
        .onConflictDoUpdate({
          target: preimages.hash,
          set: { hash, data: preimage.data, serviceIndex },
        })
        .returning(),
    )
    if (err2) {
      return safeError(err2)
    }
    return safeResult(result[0])
  }
}
