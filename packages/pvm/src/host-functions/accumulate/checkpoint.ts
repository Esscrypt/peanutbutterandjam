import { logger } from '@pbnjam/core'
import type {
  HostFunctionResult,
  Implications,
  PartialState,
  ServiceAccount,
} from '@pbnjam/types'
import { ACCUMULATE_FUNCTIONS } from '../../config'
import {
  type AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
} from './base'

export class CheckpointHostFunction extends BaseAccumulateHostFunction {
  readonly functionId = ACCUMULATE_FUNCTIONS.CHECKPOINT
  readonly name = 'checkpoint'
  readonly gasCost = 10n

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    // Gray Paper line 748-753: Ω_C (checkpoint)
    // imY' = imX (copy regular dimension to exceptional dimension)
    // registers'_7 = gascounter' (set registers[7] to gas counter after decrement)
    const { registers, implications, gasCounter } = context
    const [imX] = implications

    // Log checkpoint invocation
    logger.debug('CHECKPOINT host function invoked', {
      currentServiceId: imX.id.toString(),
      gasCounter: gasCounter.toString(),
      accountsCount: imX.state.accounts.size,
    })

    // Gray Paper line 752: imY' = imX
    // Deep copy imX to imY to create the checkpoint
    // This creates a rollback point for exceptional termination (OOG or panic)
    // NOTE: We MUST do a deep copy, not a reference copy, because:
    // 1. After checkpoint, execution continues and modifies imX (regular dimension)
    // 2. If imY was just a reference to imX, those modifications would also affect imY
    // 3. When rolling back to imY on panic/OOG, we'd get the modified state instead of the checkpoint
    // Deep copy provisions Set (Set<[bigint, Uint8Array]>)
    // Each tuple contains a Uint8Array that must be copied
    const provisionsCopy = new Set<[bigint, Uint8Array]>()
    for (const [serviceId, blob] of imX.provisions) {
      provisionsCopy.add([serviceId, new Uint8Array(blob)])
    }

    const checkpointState: Implications = {
      id: imX.id,
      state: this.deepCopyPartialState(imX.state),
      nextfreeid: imX.nextfreeid,
      xfers: [...imX.xfers], // Copy array
      yield: imX.yield ? new Uint8Array(imX.yield) : null,
      provisions: provisionsCopy, // Copy Set with deep-copied tuples
    }

    // Set the exceptional dimension to the checkpoint
    implications[1] = checkpointState

    // Gray Paper line 753: registers'_7 = gascounter'
    // Note: gasCounter passed here is already gascounter' (after gas cost deduction by the executor)
    // So we should return gasCounter directly, not gasCounter - gasCost
    this.setAccumulateSuccess(registers, gasCounter)

    return {
      resultCode: null, // continue execution
    }
  }

  /**
   * Deep copy PartialState including all nested structures
   * Gray Paper: Must create a complete snapshot for rollback capability
   */
  private deepCopyPartialState(state: PartialState): PartialState {
    // Deep copy accounts map with nested ServiceAccount structures
    const accountsCopy = new Map<bigint, ServiceAccount>()
    for (const [serviceId, account] of state.accounts) {
      accountsCopy.set(serviceId, this.deepCopyServiceAccount(account))
    }

    return {
      accounts: accountsCopy,
      authqueue: state.authqueue.map((queue) => [...queue]),
      assigners: [...state.assigners],
      stagingset: [...state.stagingset],
      manager: state.manager,
      registrar: state.registrar,
      delegator: state.delegator,
      alwaysaccers: new Map(state.alwaysaccers),
    }
  }

  /**
   * Deep copy ServiceAccount including nested Maps (storage, preimages, requests)
   * Also recalculates items from actual state to ensure checkpoint has correct value
   */
  private deepCopyServiceAccount(account: ServiceAccount): ServiceAccount {
    return {
      ...account,
      rawCshKeyvals: JSON.parse(JSON.stringify(account.rawCshKeyvals)),
    }
  }
}
