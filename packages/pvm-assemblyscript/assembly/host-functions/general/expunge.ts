import { RESULT_CODE_HALT } from '../../config'
import { ACCUMULATE_ERROR_WHO, HostFunctionResult } from '../accumulate/base'
import { ExpungeParams, HostFunctionContext } from './base'
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
    params: ExpungeParams | null,
  ): HostFunctionResult {
    const machineId = u64(context.registers[7])

    if (!params || !params.refineContext) {
      context.registers[7] = ACCUMULATE_ERROR_WHO
      return new HostFunctionResult(RESULT_CODE_HALT)
    }

    const machines = params.refineContext.machines

    // Check if machine exists
    if (!machines.has(machineId)) {
      // Return WHO (2^64 - 4) if machine doesn't exist
      context.registers[7] = ACCUMULATE_ERROR_WHO
      return new HostFunctionResult(RESULT_CODE_HALT)
    }

    // Get machine's PC before removal
    const machine = machines.get(machineId)!
    const pc = machine.pvm.programCounter

    // Remove machine from context
    machines.delete(machineId)

    // Return machine's PC
    context.registers[7] = pc

    return new HostFunctionResult(null)
  }
}
