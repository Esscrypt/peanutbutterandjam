import { RESULT_CODES } from '../../config'
import { ACCUMULATE_ERROR_WHO, HostFunctionResult } from '../accumulate/base'
import { ExpungeParams, HostFunctionContext, HostFunctionParams } from './base'
import { BaseHostFunction } from './base'

/**
 * EXPUNGE host function (Ω_X)
 *
 * Removes a PVM machine instance
 *
 * Gray Paper Specification:
 * - Function ID: 13 (expunge)
 * - Gas Cost: 10
 * - Uses registers[7] to specify machine ID
 * - Removes machine from context
 * - Returns WHO if machine doesn't exist, machine's PC otherwise
 *
 * Gray Paper Logic:
 * n = registers[7]
 * if n not in keys(machines):
 *   registers[7] = WHO
 * else:
 *   pc = machines[n].pc
 *   machines = machines \ {n}
 *   registers[7] = pc
 */
export class ExpungeHostFunction extends BaseHostFunction {
  functionId: u64 = u64(13) // EXPUNGE function ID
  name: string = 'expunge'
  gasCost: u64 = u64(10)

  execute(
    context: HostFunctionContext,
    params: HostFunctionParams | null,
  ): HostFunctionResult {
    if (!params) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }
    const expungeParams = params as ExpungeParams
    if (!expungeParams.refineContext) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }
    
    const machineId = u64(context.registers[7])
    const refineContext = expungeParams.refineContext!
    const machines = refineContext.machines

    // Check if machine exists
    if (!machines.has(machineId)) {
      // Return WHO (2^64 - 4) if machine doesn't exist
      context.registers[7] = ACCUMULATE_ERROR_WHO
      return new HostFunctionResult(RESULT_CODES.HALT)
    }

    // Get machine's PC before removal
    const machine = machines.get(machineId)!
    const pvm = machine.pvm
    const pc = pvm.state.programCounter

    // Remove machine from context
    machines.delete(machineId)

    // Return machine's PC
    context.registers[7] = pc

    return new HostFunctionResult(255)
  }
}
