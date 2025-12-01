import { HostFunctionResult } from '../accumulate/base'
import { HostFunctionContext, HostFunctionParams, LookupParams } from './base'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  RESULT_CODES,
} from '../../config'
import { BaseHostFunction } from './base'

/**
 * LOOKUP host function (Ω_L)
 *
 * Looks up preimages from service account storage
 *
 * Gray Paper Specification:
 * - Function ID: 2 (lookup)
 * - Gas Cost: 10
 * - Uses registers[7] to specify which service account to query
 * - Uses registers[8:2] to specify hash and output offset in memory
 * - Uses registers[10:2] to specify from offset and length
 * - Looks up preimage by hash from service account's preimages
 * - Writes result to memory at specified offset
 * - Returns NONE if not found, length if found
 *
 * Gray Paper Logic:
 * a = service account (self if registers[7] = s or NONE, otherwise accounts[registers[7]])
 * h = memory[registers[8]:32] (hash)
 * o = registers[9] (output offset)
 * f = registers[10] (from offset)
 * l = registers[11] (length)
 * v = a.preimages[h] if exists, NONE otherwise
 * if v != NONE: write v[f:f+l] to memory[o:o+l], return len(v)
 * else: return NONE
 */

export class LookupHostFunction extends BaseHostFunction {
  functionId: u64 = GENERAL_FUNCTIONS.LOOKUP
  name: string = 'lookup'

  execute(
    context: HostFunctionContext,
    params: HostFunctionParams | null,
  ): HostFunctionResult {
    if (!params) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }
    const lookupParams = params as LookupParams
    const serviceId = context.registers[7]
    const hashOffset = context.registers[8]
    const outputOffset = context.registers[9]
    const fromOffset = context.registers[10]
    const length = context.registers[11]

    // Get service account
    const serviceAccount = lookupParams.accounts.get(lookupParams.serviceId)
    if (!serviceAccount) {
      // Return NONE (2^64 - 1) for not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return new HostFunctionResult(255) // continue execution
    }

    // Read hash from memory (32 bytes)
    const readResult_hashData = context.ram.readOctets(u32(hashOffset), 32)
    const hashData = readResult_hashData.data
    const hashFaultAddress = readResult_hashData.faultAddress
    if (hashData === null || hashFaultAddress !== 0) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }

    // Look up preimage by hash
    const preimage = serviceAccount.preimages.get(hashData)
    if (!preimage) {
      // Return NONE (2^64 - 1) for not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return new HostFunctionResult(255) // continue execution
    }

    // Calculate slice parameters
    const f = i32(fromOffset)
    const l = i32(length)
    const preimageLength = preimage.length

    // Calculate actual slice length
    const actualLength = min(l, preimageLength - f)

    if (actualLength <= 0) {
      // Return NONE if no data to copy
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return new HostFunctionResult(255) // continue execution
    }

    // Extract data slice
    const dataToWrite = preimage.slice(f, f + actualLength)

    // Write preimage slice to memory
    const writeResult = context.ram.writeOctets(u32(outputOffset), dataToWrite)
    if (writeResult.hasFault) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }

    // Return length of preimage
    context.registers[7] = u64(preimageLength)

    return new HostFunctionResult(255) // continue execution
  }
}
