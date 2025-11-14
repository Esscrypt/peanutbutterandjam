/**
 * Ticket Holder Service
 *
 * Handles ticket accumulation and clearing according to Gray Paper Eq. 321-329
 */

import type { Hex } from '@pbnj/core'
import {
  BaseService,
  type Judgment,
  type SafePromise,
  safeResult,
} from '@pbnj/types'

export class JudgementHolderService extends BaseService {
  private judgements: Judgment[] = []

  getJudgements(): Judgment[] {
    return this.judgements
  }

  async addJudgement(
    judgement: Judgment,
    _epochIndex: bigint,
    _workReportHash: Hex,
  ): SafePromise<void> {
    this.judgements.push(judgement)

    return safeResult(undefined)
  }
}
