import type { HostFunctionResult } from '@pbnj/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import {
  type AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
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
  readonly functionId = ACCUMULATE_FUNCTIONS.YIELD
  readonly name = 'yield'
  readonly gasCost = 10n

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const { registers, ram, implications } = context
    // Extract parameters from registers
    const hashOffset = registers[7]

    // Read hash from memory (32 bytes)
    const [hashData, faultAddress] = ram.readOctets(hashOffset, 32n)
    if (faultAddress) {
      this.setAccumulateError(registers, 'WHAT')
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }
    if (!hashData) {
      this.setAccumulateError(registers, 'WHAT')
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Get the current implications context
    const [imX] = implications

    // Set the yield hash in the accumulation context
    // Gray Paper: imX.yield = h
    imX.yield = hashData

    // Set success result
    this.setAccumulateSuccess(registers)
    return {
      resultCode: null, // continue execution
    }
  }
}
