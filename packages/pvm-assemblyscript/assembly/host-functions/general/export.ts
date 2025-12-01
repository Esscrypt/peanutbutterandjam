import { HostFunctionResult } from '../accumulate/base'
import { HostFunctionContext, HostFunctionParams, ExportParams } from './base'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  MAX_PACKAGE_EXPORTS,
  RESULT_CODES,
  SEGMENT_SIZE,
} from '../../config'
import { BaseHostFunction } from './base'

/**
 * EXPORT host function (Ω_E)
 *
 * Gray Paper Specification (pvm_invocations.tex, lines 529-544):
 * - Function ID: 7 (export)
 * - Gas Cost: 10
 * - Uses registers[7] for memory offset (p)
 * - Uses registers[8] for length, capped at Csegmentsize (4104)
 * - Creates zero-padded segment of exactly Csegmentsize
 * - Appends segment to export sequence
 * - Returns FULL if segoff + len(𝐞) >= Cmaxpackageexports (3072)
 * - Otherwise returns segoff + len(𝐞)
 */

export class ExportHostFunction extends BaseHostFunction {
  functionId: u64 = GENERAL_FUNCTIONS.EXPORT
  name: string = 'export'

  execute(
    context: HostFunctionContext,
    params: HostFunctionParams | null,
  ): HostFunctionResult {
    if (!params) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }
    const exportParams = params as ExportParams
    if (!exportParams.refineContext) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }

    // Gray Paper: p = registers[7]
    const memoryOffset = u32(context.registers[7])
    // Gray Paper: z = min(registers[8], Csegmentsize)
    const rawLength = u32(context.registers[8])
    const cappedLength =
      rawLength < SEGMENT_SIZE
        ? rawLength
        : SEGMENT_SIZE

    // Gray Paper: Check if Nrange[p][z] ⊆ readable[memory]
    const readableResult = context.ram.isReadableWithFault(
      memoryOffset,
      cappedLength,
    )
    const readable = readableResult.success
    const readableFaultAddress = readableResult.faultAddress
    if (!readable) {
      // Gray Paper: Return PANIC if memory not readable
      context.registers[7] = u64(0)
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }

    // Gray Paper: Read data from memory
    const readResult = context.ram.readOctets(
      memoryOffset,
      cappedLength,
    )
    const data = readResult.data
    const readFaultAddress = readResult.faultAddress
    if (data === null || readFaultAddress !== 0) {
      context.registers[7] = u64(0)
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }

    // Gray Paper: Create zero-padded segment of Csegmentsize
    const segment = this.createZeroPaddedSegment(data)

    // Gray Paper: Append to export sequence and check limits
    const result = this.appendToExports(exportParams, segment)

    if (result === -1) {
      // Gray Paper: Return FULL (2^64 - 5)
      context.registers[7] = ACCUMULATE_ERROR_CODES.FULL
    } else {
      // Gray Paper: Return segoff + len(𝐞)
      context.registers[7] = u64(result)
    }

    return new HostFunctionResult(255) // Continue execution
  }

  /**
   * Gray Paper: Create zero-padded segment of exactly Csegmentsize
   * zeropad{Csegmentsize}{mem[p:p+z]}
   */
  createZeroPaddedSegment(data: Uint8Array): Uint8Array {
    const segment = new Uint8Array(SEGMENT_SIZE)
    segment.set(data, 0)
    // Remaining bytes are already zero (Uint8Array initialization)
    return segment
  }

  /**
   * Gray Paper: Append segment to export sequence (𝐞)
   * Check if segoff + len(𝐞) >= Cmaxpackageexports
   * Return FULL if limit exceeded, otherwise return segoff + len(𝐞)
   */
  appendToExports(
    params: ExportParams,
    segment: Uint8Array,
  ): i64 {
    if (!params.refineContext) {
      return -1 // FULL indicator
    }
    const exportSegments = params.refineContext!.exportSegments
    const segoff = params.segmentOffset

    // Gray Paper: Check if segoff + len(𝐞) >= Cmaxpackageexports
    const currentLength = i64(exportSegments.length)
    if (segoff + currentLength >= i64(MAX_PACKAGE_EXPORTS)) {
      return -1 // FULL indicator
    }

    // Gray Paper: Append segment
    exportSegments.push(segment)

    // Gray Paper: Return segoff + len(𝐞)
    return segoff + currentLength
  }
}
