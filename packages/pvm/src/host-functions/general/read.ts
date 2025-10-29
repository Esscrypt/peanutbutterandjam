import { bytesToHex } from '@pbnj/core'
import type {
  HostFunctionContext,
  HostFunctionResult,
  RefineInvocationContext,
  ServiceAccount,
} from '@pbnj/types'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  RESULT_CODES,
} from '../../config'
import { BaseHostFunction } from './base'

/**
 * READ host function (Ω_R)
 *
 * Reads storage data from service accounts
 *
 * Gray Paper Specification:
 * - Function ID: 3 (read)
 * - Gas Cost: 10 (plus cold read costs)
 * - Uses registers[7] to specify service account (or self if 2^64-1)
 * - Uses registers[8:3] to specify key offset, key length, and output offset
 * - Reads storage value by key from service account's storage
 * - Writes result to memory at specified offset
 * - Returns NONE if not found, length if found
 */
export class ReadHostFunction extends BaseHostFunction {
  readonly functionId = GENERAL_FUNCTIONS.READ
  readonly name = 'read'
  readonly gasCost = 10n

  execute(
    context: HostFunctionContext,
    refineContext: RefineInvocationContext | null,
  ): HostFunctionResult {

    const serviceId = context.registers[7]
    const keyOffset = context.registers[8]
    const keyLength = context.registers[9]
    const outputOffset = context.registers[10]
    const fromOffset = context.registers[11]
    const length = context.registers[12]

    // Read key from memory
    const [key, faultAddress] = context.ram.readOctets(keyOffset, keyLength)
    if (!key) {
      context.registers[7] = ACCUMULATE_ERROR_CODES.OOB
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_read',
          address: faultAddress ?? 0n,
          details: 'Memory not readable',
        },
      }
    }

    // Get service account
    const serviceAccount = this.getServiceAccount(refineContext!, serviceId)
    if (!serviceAccount) {
      // Return NONE (2^64 - 1) for not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return {
        resultCode: null, // continue execution
      }
    }

    // Read storage value by key
    const value = serviceAccount.storage.get(bytesToHex(key)) || null
    if (!value) {
      // Return NONE (2^64 - 1) for not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return {
        resultCode: null, // continue execution
      }
    }

    // Write value to memory
    const actualLength = Math.min(
      Number(length),
      value.length - Number(fromOffset),
    )
    const dataToWrite = value.slice(
      Number(fromOffset),
      Number(fromOffset) + actualLength,
    )

    const faultAddress2 = context.ram.writeOctets(outputOffset, dataToWrite)
    if (faultAddress2) {
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_write',
          address: faultAddress2,
          details: 'Memory not writable',
        },
      }
    }

    // Return length of value
    context.registers[7] = BigInt(value.length)

    return {
      resultCode: null, // continue execution
    }
  }

  private getServiceAccount(
    refineContext: RefineInvocationContext,
    serviceId: bigint,
  ): ServiceAccount | null {
    return refineContext.accountsDictionary.get(serviceId) || null
  }

}
