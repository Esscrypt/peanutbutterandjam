import { bytesToHex } from '@pbnjam/core'
import type { HostFunctionResult } from '@pbnjam/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import {
  type AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
} from './base'
import { getServiceRequestValue } from '@pbnjam/codec'

/**
 * QUERY accumulation host function (Ω_Q)
 *
 * Queries preimage request status
 *
 * Gray Paper Specification:
 * - Function ID: 22 (query)
 * - Gas Cost: 10
 * - Parameters: registers[7-8] = o, z
 *   - o: hash offset in memory (32 bytes)
 *   - z: size of the preimage
 * - Returns: registers[7-8] = status and additional data
 *
 * Gray Paper Logic:
 * 1. Read hash from memory (32 bytes)
 * 2. Look up request status in current service's requests
 * 3. Return encoded status:
 *    - NONE: request doesn't exist
 *    - 0: request exists but is empty []
 *    - 1 + 2^32 * x: request has one entry [x]
 *    - 2 + 2^32 * x, y: request has two entries [x, y]
 *    - 3 + 2^32 * x, y + 2^32 * z: request has three entries [x, y, z]
 */
export class QueryHostFunction extends BaseAccumulateHostFunction {
  readonly functionId = ACCUMULATE_FUNCTIONS.QUERY
  readonly name = 'query'
  readonly gasCost = 10n

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const { registers, ram, implications } = context
    // Gray Paper line 204: Ω_F receives H_timeslot (block header's timeslot)
    // This is the current block's timeslot passed from the Accumulate invocation

    // Extract parameters from registers
    const [preimageOffset, preimageLength] = registers.slice(7, 9)

    // Log all input parameters
    context.log('QUERY host function invoked', {
      preimageOffset: preimageOffset.toString(),
      preimageLength: preimageLength.toString(),
      currentServiceId: implications[0].id.toString(),
    })

    // Read hash from memory (32 bytes)
    // Gray Paper: h = memory[o:32] - always reads 32 bytes (hash size)
    const [hashData, faultAddress] = ram.readOctets(preimageOffset, 32n)
    if (faultAddress || !hashData) {
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Get the current implications context
    const [imX] = implications

    // Get current service account
    const serviceAccount = imX.state.accounts.get(imX.id)
    if (!serviceAccount) {
      this.setAccumulateError(registers, 'NONE')
      registers[8] = 0n
      return {
        resultCode: null, // continue execution
      }
    }

    // Convert hash to hex and look up request
    const hashHex = bytesToHex(hashData)
    const requestValue = getServiceRequestValue(serviceAccount, imX.id, hashHex, preimageLength);

    if (!requestValue) {
      // Request doesn't exist
      this.setAccumulateError(registers, 'NONE')
      registers[8] = 0n
      return {
        resultCode: null, // continue execution
      }
    }


    // Return encoded status based on request length
    if (requestValue.length === 0) {
      // Empty request []
      registers[7] = 0n
      registers[8] = 0n
    } else if (requestValue.length === 1) {
      // Single entry [x]
      const [x] = requestValue
      registers[7] = 1n + 2n ** 32n * x
      registers[8] = 0n
    } else if (requestValue.length === 2) {
      // Two entries [x, y]
      const [x, y] = requestValue
      registers[7] = 2n + 2n ** 32n * x
      registers[8] = y
    } else if (requestValue.length === 3) {
      // Three entries [x, y, z]
      const [x, y, z] = requestValue
      registers[7] = 3n + 2n ** 32n * x
      registers[8] = y + 2n ** 32n * z
    } else {
      // Invalid request state
      this.setAccumulateError(registers, 'NONE')
      registers[8] = 0n
      return {
        resultCode: null, // continue execution
      }
    }

    return {
      resultCode: null, // continue execution
    }
  }
}
