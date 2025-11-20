import { RESULT_CODE_PANIC } from '../../config'
import {
  ACCUMULATE_ERROR_WHAT,
  AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
  HostFunctionResult,
} from './base'

/**
 * YIELD accumulation host function (Ω_♉)
 *
 * Yields accumulation trie result
 *
 * Gray Paper Specification:
 * - Function ID: 25 (yield)
 * - Gas Cost: 10
 * - Parameters: registers[7] = o
 *   - o: hash offset in memory (32 bytes)
 * - Returns: registers[7] = OK or error code
 *
 * Gray Paper Logic:
 * 1. Read hash from memory (32 bytes)
 * 2. Set the yield hash in the accumulation context
 * 3. This hash represents the result of the accumulation trie
 * 4. The hash will be used by the system to verify the accumulation result
 */
export class YieldHostFunction extends BaseAccumulateHostFunction {
  functionId: u64 = u64(25)
  name: string = 'yield'

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const registers = context.registers
    const ram = context.ram
    const implications = context.implications
    // Extract parameters from registers
    const hashOffset = u64(registers[7])

    // Read hash from memory (32 bytes)
    const readResult_hashData = ram.readOctets(hashOffset, u64(32))
    if (faultAddress_readResult !== null || faultAddress !== null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    if (hashData === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // Get the current implications context
    const imX = implications.regular

    // Set the yield hash in the accumulation context
    imX.yield = hashData
    // Note: This would require extending the Implications class with a yield field
    // For now, this is a placeholder implementation

    // Set success result
    this.setAccumulateSuccess(registers)
    return new HostFunctionResult(null) // continue execution
  }
}
