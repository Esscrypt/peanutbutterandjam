import type {
  HostFunctionResult,
  Implications,
  PartialState,
  ServiceAccount,
} from '@pbnj/types'
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

    // Gray Paper line 752: imY' = imX
    // Deep copy imX to imY to create the checkpoint
    // This creates a rollback point for exceptional termination (OOG or panic)
    // NOTE: We MUST do a deep copy, not a reference copy, because:
    // 1. After checkpoint, execution continues and modifies imX (regular dimension)
    // 2. If imY was just a reference to imX, those modifications would also affect imY
    // 3. When rolling back to imY on panic/OOG, we'd get the modified state instead of the checkpoint
    const checkpointState: Implications = {
      id: imX.id,
      state: this.deepCopyPartialState(imX.state),
      nextfreeid: imX.nextfreeid,
      xfers: [...imX.xfers], // Copy array
      yield: imX.yield ? new Uint8Array(imX.yield) : null,
      provisions: new Map(imX.provisions), // Copy map
    }

    // Set the exceptional dimension to the checkpoint
    implications[1] = checkpointState

    // Gray Paper line 753: registers'_7 = gascounter'
    // Note: gascounter' = gascounter - 10 (gas cost already deducted by context mutator)
    // Since we don't have access to gas counter in the signature, we set it to OK
    // The context mutator should handle setting registers[7] to the actual gas counter
    this.setAccumulateSuccess(registers, gasCounter - this.gasCost)

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
   */
  private deepCopyServiceAccount(account: ServiceAccount): ServiceAccount {
    // Deep copy requests map (Map<Hex, Map<bigint, PreimageRequestStatus>>)
    const requestsCopy = new Map(
      Array.from(account.requests.entries()).map(([hash, requestMap]) => [
        hash,
        new Map(
          Array.from(requestMap.entries()).map(([length, request]) => [
            length,
            [...request], // Copy array
          ]),
        ),
      ]),
    )

    // Deep copy preimages map (Map<Hex, Uint8Array>)
    const preimagesCopy = new Map(
      Array.from(account.preimages.entries()).map(([hash, preimage]) => [
        hash,
        new Uint8Array(preimage), // Copy Uint8Array
      ]),
    )

    // Deep copy storage map (Map<Hex, Uint8Array>)
    const storageCopy = new Map(
      Array.from(account.storage.entries()).map(([key, value]) => [
        key,
        new Uint8Array(value), // Copy Uint8Array
      ]),
    )

    return {
      ...account,
      requests: requestsCopy,
      preimages: preimagesCopy,
      storage: storageCopy,
    }
  }
}
