import { logger } from '@pbnj/core'
import type {
  HostFunctionContext,
  HostFunctionResult,
  RefineInvocationContext,
} from '@pbnj/types'
import { GENERAL_FUNCTIONS } from '../../config'
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
 *   - target = μ[ω8..+ω9] when ω8 ≠ 0 ∧ ω9 ≠ 0, otherwise ∅
 *   - message = μ[ω10..+ω11]
 * - Output registers: {}
 * - Side-effects: Log message to user-agent (no side-effects if memory access is invalid)
 */
export class LogHostFunction extends BaseHostFunction {
  readonly functionId = GENERAL_FUNCTIONS.LOG
  readonly name = 'log'
  readonly gasCost = 0n

  execute(
    context: HostFunctionContext,
    refineContext: RefineInvocationContext | null,
  ): HostFunctionResult {
    const level = context.registers[7]
    const targetOffset = context.registers[8]
    const targetLength = context.registers[9]
    const messageOffset = context.registers[10]
    const messageLength = context.registers[11]

    // Read target from memory if both offset and length are non-zero
    let target: string | null = null
    if (targetOffset !== 0n || targetLength !== 0n) {
      const [targetData, faultAddress] = context.ram.readOctets(
        targetOffset,
        targetLength,
      )
      if (targetData === null || faultAddress !== null) {
        // Invalid memory access - no side effects, continue execution
        return {
          resultCode: null,
        }
      }
      // Decode target as UTF-8 string
      try {
        target = new TextDecoder('utf-8', { fatal: false }).decode(targetData)
      } catch {
        // Invalid UTF-8 - no side effects, continue execution
        return {
          resultCode: null,
        }
      }
    }

    // Read message from memory
    const [messageData, faultAddress] = context.ram.readOctets(
      messageOffset,
      messageLength,
    )
    if (messageData === null || faultAddress !== null) {
      // Invalid memory access - no side effects, continue execution
      return {
        resultCode: null,
      }
    }

    // Decode message as UTF-8 string
    let message: string
    try {
      message = new TextDecoder('utf-8', { fatal: false }).decode(messageData)
    } catch {
      // Invalid UTF-8 - no side effects, continue execution
      return {
        resultCode: null,
      }
    }

    // Get service ID and core index from refine context if available
    const serviceId = refineContext?.currentServiceId ?? null
    const coreIndex = refineContext?.coreIndex ?? null

    // Map level to log level string
    const levelMap: Record<number, string> = {
      0: 'FATAL',
      1: 'WARN',
      2: 'INFO',
      3: 'DEBUG',
      4: 'TRACE',
    }
    const levelString = levelMap[Number(level)] || 'INFO'

    // Format timestamp
    const now = new Date()
    const timestamp = now.toISOString().replace('T', ' ').slice(0, 19)

    // Format console log message: <YYYY-MM-DD hh-mm-ss> <LEVEL>[@<CORE>]?[#<SERVICE_ID>]? [<TARGET>]? <MESSAGE>
    const corePart = coreIndex === null ? '' : `@${coreIndex}`
    const servicePart = serviceId === null ? '' : `#${serviceId}`
    const targetPart = target === null ? '' : ` [${target}]`

    const consoleMessage = `${timestamp} ${levelString}${corePart}${servicePart}${targetPart} ${message}`

    // Log according to level
    const levelNum = Number(level)
    switch (levelNum) {
      case 0: // Fatal error
        logger.error(consoleMessage)
        break
      case 1: // Warning
        logger.warn(consoleMessage)
        break
      case 2: // Important information
        logger.info(consoleMessage)
        break
      case 3: // Helpful information
        logger.debug(consoleMessage)
        break
      case 4: // Pedantic information
        logger.debug(consoleMessage)
        break
      default:
        logger.info(consoleMessage)
    }

    // Also log structured JSON format for programmatic access
    const jsonLog = {
      time: timestamp,
      level: levelString,
      message,
      target: target ?? null,
      service: serviceId === null ? null : serviceId.toString(),
      core: coreIndex === null ? null : coreIndex.toString(),
    }
    logger.debug('PVM Log (JSON)', jsonLog)

    return {
      resultCode: null, // continue execution
    }
  }
}
