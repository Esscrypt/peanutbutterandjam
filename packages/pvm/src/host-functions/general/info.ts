import { encodeServiceAccount } from '@pbnj/serialization'
import type {
  HostFunctionContext,
  HostFunctionResult,
  RefineContextPVM,
  ServiceAccountCore,
} from '@pbnj/types'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  RESULT_CODES,
} from '../../config'
import { BaseHostFunction } from './base'

/**
 * INFO host function (Ω_I)
 *
 * Gets information about service accounts
 *
 * Gray Paper Specification:
 * - Function ID: 5 (info)
 * - Gas Cost: 10
 * - Uses registers[7] to specify service account (or self if 2^64-1)
 * - Uses registers[8:3] to specify output offset, from offset, length
 * - Returns encoded service account info (codehash, balance, gas limits, etc.)
 * - Writes result to memory at specified offset
 */
export class InfoHostFunction extends BaseHostFunction {
  readonly functionId = GENERAL_FUNCTIONS.INFO
  readonly name = 'info'
  readonly gasCost = 10n

  execute(
    context: HostFunctionContext,
    refineContext?: RefineContextPVM,
  ): HostFunctionResult {
    // Validate execution
    if (context.gasCounter < this.gasCost) {
      return {
        resultCode: RESULT_CODES.OOG,
      }
    }

    context.gasCounter -= this.gasCost

    const serviceId = context.registers[7]
    const outputOffset = context.registers[8]
    const fromOffset = context.registers[9]
    const length = context.registers[10]

    // Get service account
    const serviceAccount = this.getServiceAccount(refineContext!, serviceId)
    if (!serviceAccount) {
      // Return NONE (2^64 - 1) for not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return {
        resultCode: null, // continue execution
      }
    }

    const [error, info] = encodeServiceAccount(
      serviceAccount as ServiceAccountCore,
    )
    if (error) {
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Write info to memory
    const actualLength = Math.min(
      Number(length),
      info.length - Number(fromOffset),
    )
    const dataToWrite = info.slice(
      Number(fromOffset),
      Number(fromOffset) + actualLength,
    )

    context.ram.writeOctets(outputOffset, dataToWrite)

    // Return length of info
    context.registers[7] = BigInt(info.length)

    return {
      resultCode: null, // continue execution
    }
  }

  private getServiceAccount(
    refineContext: RefineContextPVM,
    serviceId: bigint,
  ): any | null {
    // Get service account from context
    // This is a placeholder implementation
    // In a real implementation, this would access the service account store
    return refineContext.accountsDictionary.get(serviceId) || null
  }
}
