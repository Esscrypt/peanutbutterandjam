import {
  HostFunctionContext,
  HostFunctionResult,
  LookupParams,
} from '../../pbnj-types-compat'
import { bytesToHex } from '../../types'
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
    lookupParams: LookupParams,
  ): HostFunctionResult {

    const serviceId = context.registers[7]
    const hashOffset = context.registers[8]
    const outputOffset = context.registers[9]
    const fromOffset = context.registers[10]
    const length = context.registers[11]

    // Get service account
    const serviceAccount = lookupParams.accounts.get(lookupParams.serviceId)
    if (!serviceAccount) {
      context.log('Lookup host function: Service account error', {
        serviceId: lookupParams.serviceId.toString(),
      })
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return {
        resultCode: null, // continue execution
      }
    }
    if (!serviceAccount) {
      // Return NONE (2^64 - 1) for not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      context.log('Lookup host function: Service account not found', {
        serviceId: serviceId.toString(),
      })
      return {
        resultCode: null, // continue execution
      }
    }

    // Read hash from memory (32 bytes)
    const readResult_hashData = context.ram.readOctets(hashOffset, 32)
    if (!hashData) {
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Look up preimage by hash
    const preimage = serviceAccount.preimages.get(bytesToHex(hashData))
    if (!preimage) {
      // Return NONE (2^64 - 1) for not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return {
        resultCode: null, // continue execution
      }
    }

    // Calculate slice parameters
    const f = Number(fromOffset)
    const l = Number(length)
    const preimageLength = preimage.length

    // Calculate actual slice length
    const actualLength = Math.min(l, preimageLength - f)

    if (actualLength <= 0) {
      // Return NONE if no data to copy
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return {
        resultCode: null, // continue execution
      }
    }

    // Extract data slice
    const dataToWrite = preimage.subarray(f, f + actualLength)

    // Write preimage slice to memory
    const faultAddress = context.ram.writeOctets(outputOffset, dataToWrite)
    if (faultAddress) {
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_write',
          address: faultAddress,
          details: 'Memory not writable',
        },
      }
    }

    // Return length of preimage
    context.registers[7] = BigInt(preimageLength)

    return {
      resultCode: null, // continue execution
    }
  }
}
