import { RESULT_CODE_PANIC } from '../../config'
import { bytesToHex } from '../../types'
import {
  ACCUMULATE_ERROR_NONE,
  AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
  HostFunctionResult,
} from './base'

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
  functionId: u64 = u64(23) // QUERY function ID
  name: string = 'query'
  gasCost: u64 = u64(10)

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const registers = context.registers
    const ram = context.ram
    const implications = context.implications
    // Gray Paper line 204: Ω_F receives H_timeslot (block header's timeslot)
    // This is the current block's timeslot passed from the Accumulate invocation

    // Extract parameters from registers
    const preimageOffset = u64(registers[7])
    const preimageLength = u64(registers[8])

    // Read hash from memory (32 bytes)
    const readResult_hashData = ram.readOctets(
      preimageOffset,
      preimageLength,
    )
    if (faultAddress !== null || hashData === null) {
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // Get the current implications context
    const imX = implications.regular

    // Get current service account
    const serviceAccount = imX.state.accounts.get(imX.id)
    if (!serviceAccount) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_NONE)
      registers[8] = u64(0)
      return new HostFunctionResult(null) // continue execution
    }

    // Convert hash to hex and look up request
    const hashHex = bytesToHex(hashData)
    const requestMap = serviceAccount.requests.get(hashHex)

    if (!requestMap) {
      // Request doesn't exist
      this.setAccumulateError(registers, ACCUMULATE_ERROR_NONE)
      registers[8] = u64(0)
      return new HostFunctionResult(null) // continue execution
    }

    const request = requestMap.get(preimageLength)
    if (!request) {
      // Request doesn't exist for this size
      this.setAccumulateError(registers, ACCUMULATE_ERROR_NONE)
      registers[8] = u64(0)
      return new HostFunctionResult(null) // continue execution
    }

    // Return encoded status based on request length
    const TWO_TO_32: u64 = u64(4294967296) // 2^32
    if (request.length === 0) {
      // Empty request []
      registers[7] = u64(0)
      registers[8] = u64(0)
    } else if (request.length === 1) {
      // Single entry [x]
      const x = request[0]
      registers[7] = u64(1) + TWO_TO_32 * x
      registers[8] = u64(0)
    } else if (request.length === 2) {
      // Two entries [x, y]
      const x = request[0]
      const y = request[1]
      registers[7] = u64(2) + TWO_TO_32 * x
      registers[8] = y
    } else if (request.length === 3) {
      // Three entries [x, y, z]
      const x = request[0]
      const y = request[1]
      const z = request[2]
      registers[7] = u64(3) + TWO_TO_32 * x
      registers[8] = y + TWO_TO_32 * z
    } else {
      // Invalid request state
      this.setAccumulateError(registers, ACCUMULATE_ERROR_NONE)
      registers[8] = u64(0)
      return new HostFunctionResult(null) // continue execution
    }

    return new HostFunctionResult(null) // continue execution
  }
}
