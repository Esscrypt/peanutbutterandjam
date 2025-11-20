import { HostFunctionResult } from '../accumulate/base'
import { HostFunctionContext, LogParams } from './base'
import { BaseHostFunction } from './base'

/**
 * LOG host function (JIP-1)
 *
 * Debug message host call for logging to the node operator
 *
 * JIP-1 Specification:
 * - Function ID: 100 (log)
 * - Gas Cost: 0
 * - Input registers: ω7, ω8, ω9, ω10, ω11
 *   - level = ω7
 *   - target = μ[ω8.+ω9] when ω8 ≠ 0 ∧ ω9 ≠ 0, otherwise ∅
 *   - message = μ[ω10.+ω11]
 * - Output registers: {}
 * - Side-effects: Log message to user-agent (no side-effects if memory access is invalid)
 */
export class LogHostFunction extends BaseHostFunction {
  functionId: u64 = u64(100) // LOG function ID (JIP-1)
  name: string = 'log'
  gasCost: u64 = u64(0)

  execute(
    context: HostFunctionContext,
    params: LogParams | null,
  ): HostFunctionResult {
    const level = i32(context.registers[7])
    const targetOffset = u64(context.registers[8])
    const targetLength = u64(context.registers[9])
    const messageOffset = u64(context.registers[10])
    const messageLength = u64(context.registers[11])

    // Read target from memory if both offset and length are non-zero
    let target: string | null = null
    if (targetOffset !== u64(0) || targetLength !== u64(0)) {
      const readResult_targetData = context.ram.readOctets(
        targetOffset,
        targetLength,
      )
      if (targetData === null || faultAddress !== null) {
        // Invalid memory access - no side effects, continue execution
        return new HostFunctionResult(null)
      }
      // Decode target as UTF-8 string (simplified - AssemblyScript doesn't have TextDecoder)
      // For now, just use bytes as string representation
      target = this.bytesToString(targetData)
    }

    // Read message from memory
    const readResult_messageData = context.ram.readOctets(
      messageOffset,
      messageLength,
    )
    if (messageData === null || faultAddress !== null) {
      // Invalid memory access - no side effects, continue execution
      return new HostFunctionResult(null)
    }

    // Decode message as UTF-8 string (simplified)
    const message = this.bytesToString(messageData)

    // Note: In AssemblyScript, logging would need to be handled externally
    // For now, this is a no-op that continues execution
    // The actual logging would be done by the host environment

    return new HostFunctionResult(null) // continue execution
  }

  bytesToString(bytes: Uint8Array): string {
    // Simplified UTF-8 decoding for AssemblyScript
    // Note: Full UTF-8 decoding would require more complex logic
    let result = ''
    for (let i: i32 = 0; i < bytes.length; i++) {
      const byte = bytes[i]
      if (byte >= 32 && byte < 127) {
        // Printable ASCII
        result += String.fromCharCode(byte)
      } else {
        // Non-printable or extended - use hex representation
        result += '\\x' + (byte < 16 ? '0' : '') + byte.toString(16)
      }
    }
    return result
  }
}
