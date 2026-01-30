import { bytesToHex, logger } from '@pbnjam/core'
import type { HostFunctionResult } from '@pbnjam/types'
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

    // Get the current implications context
    const [imX] = implications

    // Read hash from memory (32 bytes)
    // Gray Paper pvm_invocations.tex lines 953-956:
    // h = memory[o:32] when Nrange(o,32) ⊆ readable(memory), error otherwise
    const [hashData, faultAddress] = ram.readOctets(hashOffset, 32n)
    // Gray Paper line 958: (panic, registers_7, ...) when h = error
    // Gray Paper: registers'_7 = registers_7 (unchanged) when c = panic
    if (faultAddress || !hashData) {
      // DO NOT modify registers[7] - it must remain unchanged on panic
      logger.info(`[host-calls] [${imX.id}] YIELD(${hashOffset}) <- PANIC`)
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Set the yield hash in the accumulation context
    // Gray Paper: imX.yield = h
    imX.yield = hashData

    // Set success result
    this.setAccumulateSuccess(registers)

    // Log in the requested format: [host-calls] [serviceId] YIELD(0xhash) <- OK
    const hashHex = bytesToHex(hashData)
    logger.info(`[host-calls] [${imX.id}] YIELD(${hashHex}) <- OK`)

    return {
      resultCode: null, // continue execution
    }
  }
}
