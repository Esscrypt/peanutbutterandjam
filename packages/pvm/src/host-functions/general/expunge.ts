import type {
  HostFunctionContext,
  HostFunctionResult,
  RefineInvocationContext,
} from '@pbnj/types'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  RESULT_CODES,
} from '../../config'
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
  readonly functionId = GENERAL_FUNCTIONS.EXPUNGE
  readonly name = 'expunge'
  readonly gasCost = 10n

  execute(
    context: HostFunctionContext,
    refineContext: RefineInvocationContext | null,
  ): HostFunctionResult {
    const machineId = context.registers[7]

    // Check if refine context is available
    if (!refineContext) {
      // If no refine context available, return WHO
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO //a WHO
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    const machines = refineContext.machines

    // Check if machine exists
    if (!machines.has(machineId)) {
      // Return WHO (2^64 - 4) if machine doesn't exist
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Get machine's PC before removal
    const machine = machines.get(machineId)!
    const pc = machine.pvm.state.instructionPointer ?? 0n

    // Remove machine from context
    machines.delete(machineId)

    // Return machine's PC
    context.registers[7] = pc

    return {
      resultCode: null,
    }
  }
}
