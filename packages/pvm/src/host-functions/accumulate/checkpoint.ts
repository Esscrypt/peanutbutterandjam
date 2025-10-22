import type {
  HostFunctionResult,
  Implications,
  ImplicationsPair,
  PartialState,
  RAM,
  RegisterState,
} from '@pbnj/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import { BaseAccumulateHostFunction } from './base'

export class CheckpointHostFunction extends BaseAccumulateHostFunction {
  readonly functionId = ACCUMULATE_FUNCTIONS.CHECKPOINT
  readonly name = 'checkpoint'
  readonly gasCost = 10n

  execute(
    gasCounter: bigint,
    registers: RegisterState,
    _ram: RAM,
    context: ImplicationsPair,
  ): HostFunctionResult {
    // Validate execution
    if (gasCounter < this.gasCost) {
      return {
        resultCode: RESULT_CODES.OOG,
      }
    }

    try {
      // 1. Copy regular dimension (imX) to exceptional dimension (imY)
      // This creates a rollback point
      const [imX] = context

      // Deep copy imX to imY to create the checkpoint
      const checkpointState: Implications = {
        id: imX.id,
        state: this.deepCopyPartialState(imX.state),
        nextfreeid: imX.nextfreeid,
        xfers: [...imX.xfers], // Copy array
        yield: imX.yield ? new Uint8Array(imX.yield) : null,
        provisions: new Map(imX.provisions), // Copy map
      }

      // Set the exceptional dimension to the checkpoint
      context[1] = checkpointState

      // 2. Set registers[7] to the remaining gas counter
      const remainingGas = gasCounter - this.gasCost
      this.setAccumulateSuccess(registers, remainingGas)

      return {
        resultCode: null, // continue execution
      }
    } catch (_error) {
      this.setAccumulateError(registers, 'WHAT')
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }
  }

  private deepCopyPartialState(state: PartialState): PartialState {
    return {
      accounts: new Map(state.accounts),
      authqueue: state.authqueue.map((queue) => [...queue]),
      assigners: [...state.assigners],
      stagingset: [...state.stagingset],
      manager: state.manager,
      registrar: state.registrar,
      delegator: state.delegator,
      alwaysaccers: new Map(state.alwaysaccers),
    }
  }
}
