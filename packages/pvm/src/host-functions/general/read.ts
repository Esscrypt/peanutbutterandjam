import { bytesToHex } from '@pbnjam/core'
import type {
  HostFunctionContext,
  HostFunctionResult,
  ReadParams,
} from '@pbnjam/types'
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

  execute(
    context: HostFunctionContext,
    params: ReadParams,
  ): HostFunctionResult {
    // Gray Paper equation 404-407: Determine service account
    // s^* = s when registers[7] = 2^64 - 1 (NONE), otherwise registers[7]
    const requestedServiceId =
      context.registers[7] === ACCUMULATE_ERROR_CODES.NONE
        ? params.serviceId
        : context.registers[7]

    // Gray Paper equation 408-412: Select service account
    // a = s when s^* = s, otherwise d[s^*] if s^* in keys(d), otherwise none
    const serviceAccount =
      requestedServiceId === params.serviceId
        ? params.serviceAccount
        : (params.accounts.get(requestedServiceId) ?? null)

    const keyOffset = context.registers[8]
    const keyLength = context.registers[9]
    const outputOffset = context.registers[10]
    const fromOffset = context.registers[11]
    const length = context.registers[12]

    // Read key from memory
    const [key, faultAddress] = context.ram.readOctets(keyOffset, keyLength)
    if (!key) {
      context.log('Read host function: Memory read fault', {
        keyOffset: keyOffset.toString(),
        keyLength: keyLength.toString(),
        faultAddress: faultAddress?.toString() ?? 'null',
      })
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

    // Gray Paper equation 423: Return NONE if service account not found
    if (!serviceAccount) {
      context.log('Read host function: Service account not found', {
        requestedServiceId: requestedServiceId.toString(),
      })
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return {
        resultCode: null, // continue execution
      }
    }

    // Gray Paper equation 414-418: Read storage value by key
    // v = a_storage[k] if a != none and k in keys(a_storage), otherwise none
    const value = serviceAccount.storage.get(bytesToHex(key)) || null
    if (!value) {
      // Gray Paper equation 423: Return NONE if storage key not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      context.log('Read host function: Storage key not found', {
        requestedServiceId: requestedServiceId.toString(),
        keyLength: key.length.toString(),
      })
      return {
        resultCode: null, // continue execution
      }
    }

    // Gray Paper equation 419-420: Calculate slice parameters
    // f = min(registers[11], len(v))
    // l = min(registers[12], len(v) - f)
    const f = Math.min(Number(fromOffset), value.length)
    const l = Math.min(Number(length), value.length - f)
    const dataToWrite = value.slice(f, f + l)

    // Gray Paper equation 421-425: Write to memory and return result
    // Write v[f:l] to memory at offset o (registers[10])
    const faultAddress2 = context.ram.writeOctets(outputOffset, dataToWrite)
    if (faultAddress2) {
      // Gray Paper equation 422: Return panic if memory not writable
      context.log('Read host function: Memory write fault', {
        outputOffset: outputOffset.toString(),
        faultAddress: faultAddress2.toString(),
      })
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_write',
          address: faultAddress2,
          details: 'Memory not writable',
        },
      }
    }

    // Gray Paper equation 424: Return len(v) in registers[7]
    context.registers[7] = BigInt(value.length)

    context.log('Read host function: Storage value read successfully', {
      requestedServiceId: requestedServiceId.toString(),
      valueLength: value.length.toString(),
      writtenLength: l.toString(),
    })

    return {
      resultCode: null, // continue execution
    }
  }
}
