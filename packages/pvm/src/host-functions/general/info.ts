import { encodeServiceAccount } from '@pbnj/codec'
import type {
  HostFunctionContext,
  HostFunctionResult,
  IServiceAccountService,
  RefineInvocationContext,
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

  private readonly serviceAccountService: IServiceAccountService
  constructor(serviceAccountService: IServiceAccountService) {
    super()
    this.serviceAccountService = serviceAccountService
  }

  execute(
    context: HostFunctionContext,
    _refineContext: RefineInvocationContext | null,
  ): HostFunctionResult {
    const serviceId = context.registers[7]
    const outputOffset = context.registers[8]
    const fromOffset = context.registers[9]
    const length = context.registers[10]

    // Get service account
    const [serviceAccountError, serviceAccount] =
      this.serviceAccountService.getServiceAccount(serviceId)
    if (serviceAccountError) {
      context.log('Info host function: Service account error', {
        serviceId: serviceId.toString(),
        error: serviceAccountError.message,
      })
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'basic_block',
          address: serviceId,
          details: 'Service account not found',
        },
      }
    }
    if (!serviceAccount) {
      // Return NONE (2^64 - 1) for not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      context.log('Info host function: Service account not found', {
        serviceId: serviceId.toString(),
      })
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

    const faultAddress = context.ram.writeOctets(outputOffset, dataToWrite)
    if (faultAddress) {
      context.log('Info host function: Memory write fault', {
        outputOffset: outputOffset.toString(),
        faultAddress: faultAddress.toString(),
      })
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_write',
          address: faultAddress,
          details: 'Memory not writable',
        },
      }
    }

    // Return length of info
    context.registers[7] = BigInt(info.length)

    context.log('Info host function: Service account info returned', {
      serviceId: serviceId.toString(),
      infoLength: info.length.toString(),
      actualLength: actualLength.toString(),
    })

    return {
      resultCode: null, // continue execution
    }
  }
}
