import { HostFunctionResult } from '../accumulate/base'
import { HostFunctionContext, HostFunctionParams, LogParams } from './base'
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
    params: HostFunctionParams | null,
  ): HostFunctionResult {
    if (!params) {
      return new HostFunctionResult(255) // continue execution
    }
    const logParams = params as LogParams
    const level = i32(context.registers[7])
    const targetOffset = u64(context.registers[8])
    const targetLength = u64(context.registers[9])
    const messageOffset = u64(context.registers[10])
    const messageLength = u64(context.registers[11])

    // Read target from memory if both offset and length are non-zero
    let target: string | null = null
    if (targetOffset !== u64(0) && targetLength !== u64(0)) {
      const readResult_targetData = context.ram.readOctets(
        u32(targetOffset),
        u32(targetLength),
      )
      const targetData = readResult_targetData.data
      const targetFaultAddress = readResult_targetData.faultAddress
      if (targetData === null || targetFaultAddress !== 0) {
        // Invalid memory access - no side effects, continue execution
        return new HostFunctionResult(255)
      }
      // Decode target as UTF-8 string (simplified - AssemblyScript doesn't have TextDecoder)
      // For now, just use bytes as string representation
      target = this.bytesToString(targetData)
    }

    // Read message from memory
    const readResult_messageData = context.ram.readOctets(
      u32(messageOffset),
      u32(messageLength),
    )
    const messageData = readResult_messageData.data
    const messageFaultAddress = readResult_messageData.faultAddress
    if (messageData === null || messageFaultAddress !== 0) {
      // Invalid memory access - no side effects, continue execution
      return new HostFunctionResult(255)
    }

    // Decode message as UTF-8 string (simplified)
    const message = this.bytesToString(messageData)

    // Map level to log level and format message according to JIP-1
    // Format: <YYYY-MM-DD hh-mm-ss> <LEVEL>[@<CORE>]?[#<SERVICE_ID>]? [<TARGET>]? <MESSAGE>
    let levelString = 'INFO'
    if (level === 0) {
      levelString = 'FATAL'
    } else if (level === 1) {
      levelString = 'WARN'
    } else if (level === 2) {
      levelString = 'INFO'
    } else if (level === 3) {
      levelString = 'DEBUG'
    } else if (level === 4) {
      levelString = 'TRACE'
    }

    // Build formatted message (simplified - no timestamp, serviceId, or coreIndex in AssemblyScript)
    // Format: <LEVEL> [<TARGET>]? <MESSAGE>
    let formattedMessage = levelString
    if (target !== null) {
      formattedMessage = formattedMessage + ' [' + target + ']'
    }
    formattedMessage = formattedMessage + ' ' + message

    // Log according to level using AssemblyScript console
    if (level === 0) {
      // Fatal error
      console.error(formattedMessage)
    } else if (level === 1) {
      // Warning
      console.warn(formattedMessage)
    } else if (level === 2) {
      // Important information
      console.info(formattedMessage)
    } else if (level === 3 || level === 4) {
      // Helpful or pedantic information
      console.debug(formattedMessage)
    } else {
      // Default to info
      console.info(formattedMessage)
    }

    return new HostFunctionResult(255) // continue execution
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
