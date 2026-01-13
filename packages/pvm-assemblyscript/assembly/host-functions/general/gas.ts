import { HostFunctionResult } from '../accumulate/base'
import { HostFunctionContext, HostFunctionParams } from './base'
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
  functionId: u64 = u64(0) // GAS function ID
  name: string = 'gas'

  execute(context: HostFunctionContext, params: HostFunctionParams | null): HostFunctionResult {
    // Set registers[7] = gascounter (remaining gas)
    // Explicit cast to u64 since gasCounter is u32 and registers are u64
    context.registers[7] = u64(context.gasCounter)

    // Return updated gas counter
    return new HostFunctionResult(255)
  }
}
