/**
 * Block Store - Database Integration for JAM Blocks (Normalized Schema)
 *
 * Provides storage and retrieval of JAM blocks using fully normalized tables
 * No JSONB usage - all extrinsics stored in dedicated tables
 */

import {
  type Hex,
  type SafePromise,
  safeError,
  safeResult,
  safeTry,
} from '@pbnj/core'
import type { Judgment } from '@pbnj/types'
import { and, eq } from 'drizzle-orm'
import type { CoreDb, DbJudgment } from './index'
import { judgments, validityDisputes } from './schema/core-schema'

export class JudgmentStore {
  constructor(private db: CoreDb) {}

  async getJudgment(
    epochIndex: bigint,
    reportHash: Hex,
  ): SafePromise<DbJudgment> {
    const [err, result] = await safeTry(
      this.db
        .select()
        .from(judgments)
        .innerJoin(
          validityDisputes,
          eq(judgments.validityDisputeId, validityDisputes.id),
        )
        .where(
          and(
            eq(validityDisputes.epochIndex, epochIndex),
            eq(validityDisputes.reportHash, reportHash),
          ),
        )
        .limit(1),
    )
    if (err) {
      return safeError(err)
    }
    return safeResult(result[0].judgments)
  }
  async storeJudgment(
    judgment: Judgment,
    epochIndex: bigint,
    reportHash: Hex,
  ): SafePromise<DbJudgment> {
    //get the validity dispute id for the given epoch index
    const [validityDisputeIdError, validityDisputeId] =
      await this.getValidityDisputeId(epochIndex, reportHash)
    if (validityDisputeIdError) {
      return safeError(validityDisputeIdError)
    }

    const [err, result] = await safeTry(
      this.db
        .insert(judgments)
        .values({
          signature: judgment.signature,
          validityDisputeId,
          validity: judgment.vote,
          judgeIndex: judgment.index,
        })
        .onConflictDoUpdate({
          target: judgments.signature,
          set: {
            validityDisputeId,
            validity: judgment.vote,
            judgeIndex: judgment.index,
          },
        })
        .returning(),
    )
    if (err) {
      return safeError(err)
    }
    return safeResult(result[0])
  }

  async getValidityDisputeId(
    epochIndex: bigint,
    reportHash: Hex,
  ): SafePromise<number> {
    const [err, result] = await safeTry(
      this.db
        .select({ id: validityDisputes.id })
        .from(validityDisputes)
        .where(
          and(
            eq(validityDisputes.epochIndex, epochIndex),
            eq(validityDisputes.reportHash, reportHash),
          ),
        )
        .limit(1),
    )
    if (err) {
      return safeError(err)
    }
    return safeResult(result[0].id)
  }
}
