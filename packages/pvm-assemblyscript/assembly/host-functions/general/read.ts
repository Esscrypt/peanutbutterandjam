import { RESULT_CODE_PANIC } from '../../config'
import { CompleteServiceAccount, getStorageValue } from '../../codec'
import {
  ACCUMULATE_ERROR_NONE,
  HostFunctionResult,
} from '../accumulate/base'
import { HostFunctionContext, HostFunctionParams, ReadParams } from './base'
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
  functionId: u64 = u64(3) // READ function ID
  name: string = 'read'
  gasCost: u64 = u64(10)

  execute(
    context: HostFunctionContext,
    params: HostFunctionParams | null,
  ): HostFunctionResult {
    if (!params) {
      context.registers[7] = ACCUMULATE_ERROR_NONE
      return new HostFunctionResult(255)
    }
    const readParams = params as ReadParams

    // Gray Paper equation 404-407: Determine service account
    // s^* = s when registers[7] = 2^64 - 1 (NONE), otherwise registers[7]
    const requestedServiceId =
      u64(context.registers[7]) === ACCUMULATE_ERROR_NONE
        ? readParams.serviceId
        : u64(context.registers[7])

    // Gray Paper equation 408-412: Select service account
    // a = s when s^* = s, otherwise d[s^*] if s^* in keys(d), otherwise none
    let serviceAccount: CompleteServiceAccount | null = null
    if (requestedServiceId === readParams.serviceId) {
      serviceAccount = readParams.serviceAccount
    } else if (readParams.accounts.has(requestedServiceId)) {
      serviceAccount = readParams.accounts.get(requestedServiceId)
    }

    const keyOffset = u64(context.registers[8])
    const keyLength = u64(context.registers[9])
    const outputOffset = u64(context.registers[10])
    const fromOffset = u64(context.registers[11])
    const length = u64(context.registers[12])

    // Read key from memory
    const readResult_key = context.ram.readOctets(u32(keyOffset), u32(keyLength))
    const key = readResult_key.data
    const faultAddress = readResult_key.faultAddress
    if (key === null || faultAddress !== 0) {
      // Gray Paper line 420: registers_7 remains UNCHANGED on panic
      // Do NOT set context.registers[7] - just return PANIC
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // Gray Paper equation 423: Return NONE if service account not found
    if (!serviceAccount) {
      context.registers[7] = ACCUMULATE_ERROR_NONE
      return new HostFunctionResult(255) // continue execution
    }

    // Gray Paper equation 414-418: Read storage value by key using rawCshKeyvals helper
    // v = a_storage[k] if a != none and k in keys(a_storage), otherwise none
    const value = getStorageValue(serviceAccount, u32(requestedServiceId), key!)
    if (!value) {
      // Gray Paper equation 423: Return NONE if storage key not found
      context.registers[7] = ACCUMULATE_ERROR_NONE
      return new HostFunctionResult(255) // continue execution
    }

    // Gray Paper equation 419-420: Calculate slice parameters
    // f = min(registers[11], len(v))
    // l = min(registers[12], len(v) - f)
    const f = min(i32(fromOffset), value.length)
    const l = min(i32(length), value.length - f)
    const dataToWrite = value.slice(f, f + l)

    // Gray Paper equation 421-425: Write to memory and return result
    // Write v[f:l] to memory at offset o (registers[10])
    const writeResult = context.ram.writeOctets(u32(outputOffset), dataToWrite)
    if (writeResult.hasFault) {
      // Gray Paper equation 422: Return panic if memory not writable
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // Gray Paper equation 424: Return len(v) in registers[7]
    context.registers[7] = u64(value.length)

    return new HostFunctionResult(255) // continue execution
  }
}
