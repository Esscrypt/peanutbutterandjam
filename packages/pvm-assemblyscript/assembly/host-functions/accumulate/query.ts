import { RESULT_CODE_PANIC } from '../../config'
import { getRequestValue, decodeRequestTimeslots } from '../../codec'
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
  functionId: u64 = u64(22) // QUERY function ID (Gray Paper: query = 22)
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
    // Gray Paper: h = memory[o:32] - always reads 32 bytes (hash size)
    const readResult_hash = ram.readOctets(u32(preimageOffset), 32)
    if (readResult_hash.faultAddress !== 0) {
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    if (readResult_hash.data === null) {
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    const hashData = readResult_hash.data!

    // Get the current implications context
    const imX = implications.regular

    // Get current service account
    const accountEntry = this.findAccountEntry(imX.state.accounts, imX.id)
    if (accountEntry === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_NONE)
      registers[8] = u64(0)
      return new HostFunctionResult(255) // continue execution
    }
    const serviceAccount = accountEntry.account

    // Look up request using rawCshKeyvals helper
    const requestValue = getRequestValue(serviceAccount, u32(imX.id), hashData, preimageLength)

    if (requestValue === null) {
      // Request doesn't exist
      this.setAccumulateError(registers, ACCUMULATE_ERROR_NONE)
      registers[8] = u64(0)
      return new HostFunctionResult(255) // continue execution
    }

    // Decode the request timeslots
    const timeslots = decodeRequestTimeslots(requestValue)
    if (timeslots === null) {
      // Invalid request value
      this.setAccumulateError(registers, ACCUMULATE_ERROR_NONE)
      registers[8] = u64(0)
      return new HostFunctionResult(255) // continue execution
    }

    // Return encoded status based on request length
    const TWO_TO_32: u64 = u64(4294967296) // 2^32
    if (timeslots.length === 0) {
      // Empty request []
      registers[7] = u64(0)
      registers[8] = u64(0)
    } else if (timeslots.length === 1) {
      // Single entry [x]
      const x = u64(timeslots[0])
      registers[7] = u64(1) + TWO_TO_32 * x
      registers[8] = u64(0)
    } else if (timeslots.length === 2) {
      // Two entries [x, y]
      const x = u64(timeslots[0])
      const y = u64(timeslots[1])
      registers[7] = u64(2) + TWO_TO_32 * x
      registers[8] = y
    } else if (timeslots.length === 3) {
      // Three entries [x, y, z]
      const x = u64(timeslots[0])
      const y = u64(timeslots[1])
      const z = u64(timeslots[2])
      registers[7] = u64(3) + TWO_TO_32 * x
      registers[8] = y + TWO_TO_32 * z
    } else {
      // Invalid request state
      this.setAccumulateError(registers, ACCUMULATE_ERROR_NONE)
      registers[8] = u64(0)
      return new HostFunctionResult(255) // continue execution
    }

    return new HostFunctionResult(255) // continue execution
  }
}
