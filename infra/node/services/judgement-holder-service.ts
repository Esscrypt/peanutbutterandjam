/**
 * Ticket Holder Service
 *
 * Handles ticket accumulation and clearing according to Gray Paper Eq. 321-329
 */

import type { Hex } from '@pbnj/core'
import type { JudgmentStore } from '@pbnj/state'
import {
  BaseService,
  type Judgment,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/types'

export class JudgementHolderService extends BaseService {
  private judgements: Judgment[] = []
  private judgmentStore: JudgmentStore
  constructor(judgmentStore: JudgmentStore) {
    super('judgement-holder-service')
    this.judgmentStore = judgmentStore
  }

  getJudgements(): Judgment[] {
    return this.judgements
  }

  async addJudgement(
    judgement: Judgment,
    epochIndex: bigint,
    workReportHash: Hex,
  ): SafePromise<void> {
    this.judgements.push(judgement)

    const [error, _result] = await this.judgmentStore.storeJudgment(
      judgement,
      epochIndex,
      workReportHash,
    )
    if (error) {
      return safeError(error)
    }
    return safeResult(undefined)
  }
}
