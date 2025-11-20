import { HostFunctionResult } from '../accumulate/base'
import { HostFunctionContext } from './base'
import { BaseHostFunction } from './base'
import { GENERAL_FUNCTIONS } from '../../config'

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
  functionId: u64 = GENERAL_FUNCTIONS.GAS
  name: string = 'gas'

  execute(context: HostFunctionContext, params: null): HostFunctionResult {
    // Set registers[7] = gascounter (remaining gas)
    context.registers[7] = context.gasCounter

    // Return updated gas counter
    return new HostFunctionResult(null) // continue execution
  }
}
