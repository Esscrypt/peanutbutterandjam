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

    logger.info(`GAS host function executed`, {
      gasCounter: context.gasCounter.toString(),
    })

    // Return updated gas counter
    return {
      resultCode: null, // continue execution
    }
  }
}
