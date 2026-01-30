import { logger } from '@pbnjam/core'
import type { HostFunctionContext, HostFunctionResult } from '@pbnjam/types'
import { GENERAL_FUNCTIONS } from '../../config'
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

  execute(context: HostFunctionContext): HostFunctionResult {
    context.registers[7] = context.gasCounter

    // Log in the requested format: [host-calls] [serviceId] GAS <- gasValue
    const serviceId = context.serviceId ?? 0n
    logger.info(`[host-calls] [${serviceId}] GAS <- ${context.gasCounter}`)

    // Return updated gas counter
    return {
      resultCode: null, // continue execution
    }
  }
}
