import type { HostFunctionContext, HostFunctionResult } from '@pbnj/types'
import { GENERAL_FUNCTIONS, RESULT_CODES } from '../../config'
import { BaseHostFunction } from './base'

/**
 * GAS host function (Ω_G)
 *
 * Returns the current gas counter value
 *
 * Gray Paper Specification:
 * - Function ID: 0 (gas)
 * - Gas Cost: 10
 * - Sets registers[7] = gascounter (remaining gas)
 * - Returns gascounter - 10 (gas consumed)
 */
export class GasHostFunction extends BaseHostFunction {
  readonly functionId = GENERAL_FUNCTIONS.GAS
  readonly name = 'gas'
  readonly gasCost = 10n

  execute(context: HostFunctionContext): HostFunctionResult {
    // Validate execution
    if (context.gasCounter < this.gasCost) {
      return {
        resultCode: RESULT_CODES.OOG,
      }
    }

    context.gasCounter -= this.gasCost

    // Set registers[7] = gascounter (remaining gas)
    context.registers[7] = context.gasCounter

    // Return updated gas counter
    return {
      resultCode: null, // continue execution
    }
  }
}
