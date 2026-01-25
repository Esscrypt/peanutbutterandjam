import { logger } from '@pbnjam/core'
import type {
  ExpungeParams,
  HostFunctionContext,
  HostFunctionResult,
} from '@pbnjam/types'
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

  execute(
    context: HostFunctionContext,
    params: ExpungeParams,
  ): HostFunctionResult {
    const machineId = context.registers[7]

    const machines = params.refineContext.machines

    const serviceId = context.serviceId ?? 0n

    // Check if machine exists
    if (!machines.has(machineId)) {
      // Return WHO (2^64 - 4) if machine doesn't exist
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
      logger.info(`[host-calls] [${serviceId}] EXPUNGE(${machineId}) <- WHO`)
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Get machine's PC before removal
    const machine = machines.get(machineId)!
    const pc = machine.pvm.state.programCounter ?? 0n

    // Remove machine from context
    machines.delete(machineId)

    // Return machine's PC
    context.registers[7] = pc

    // Log in the requested format: [host-calls] [serviceId] EXPUNGE(machineId) <- OK: pc
    logger.info(
      `[host-calls] [${serviceId}] EXPUNGE(${machineId}) <- OK: ${pc}`,
    )

    return {
      resultCode: null,
    }
  }
}
