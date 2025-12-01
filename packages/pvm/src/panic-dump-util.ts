/**
 * Trace Dump Utility
 *
 * Utility function for writing PVM execution traces in jamduna format.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { logger } from '@pbnj/core'
import { GENERAL_FUNCTIONS, ACCUMULATE_FUNCTIONS } from './config'

/**
 * Get host function name from function ID
 */
function getHostFunctionName(hostCallId: bigint): string {
  // Check general functions
  for (const [name, id] of Object.entries(GENERAL_FUNCTIONS)) {
    if (id === hostCallId) {
      return name
    }
  }
  
  // Check accumulate functions
  for (const [name, id] of Object.entries(ACCUMULATE_FUNCTIONS)) {
    if (id === hostCallId) {
      return name
    }
  }
  
  return `UNKNOWN_${hostCallId.toString()}`
}

/**
 * Generate jamduna-style filename from block number
 * Format: 00000004.log (8-digit zero-padded block number)
 */
export function generateTraceFilename(blockNumber?: number | bigint | string): string {
  if (blockNumber !== undefined) {
    const blockNum = typeof blockNumber === 'string' ? Number.parseInt(blockNumber, 10) : Number(blockNumber)
    return `${String(blockNum).padStart(8, '0')}.log`
  }
  return `trace-${Date.now()}.log`
}

/**
 * Write PVM execution trace in jamduna format
 * 
 * Format matches jamduna exactly:
 * - Instruction lines: <INSTRUCTION> <STEP> <PC> Gas: <GAS> Registers:[<REG0>, <REG1>, ...]
 * - Host function calls: Calling host function: <NAME> <ID> [gas used: <GAS_USED>, gas remaining: <GAS_REMAINING>] [service: <SERVICE_ID>]
 * 
 * @param executionLogs - Array of execution log entries
 * @param hostFunctionLogs - Optional array of host function call logs
 * @param outputDir - Optional output directory (defaults to 'pvm-traces' in process.cwd())
 * @param filename - Optional filename (defaults to timestamp-based name, or use blockNumber to generate jamduna-style name)
 * @param blockNumber - Optional block number for jamduna-style filename (e.g., 4 -> "00000004.log")
 * @returns The filepath where the trace was written, or undefined if writing failed
 */
export function writeTraceDump(
  executionLogs: Array<{
    step: number
    pc: bigint
    instructionName: string
    opcode: string
    gas: bigint
    registers: string[]
  }>,
  hostFunctionLogs?: Array<{
    step: number
    hostCallId: bigint
    gasBefore: bigint
    gasAfter: bigint
    serviceId?: bigint
  }>,
  outputDir?: string,
  filename?: string,
  blockNumber?: number | bigint | string,
): string | undefined {
  if (executionLogs.length === 0) {
    // No logs to write
    return undefined
  }

  const defaultDir = join(process.cwd(), 'pvm-traces')
  const targetDir = outputDir ?? defaultDir

  try {
    // Create directory if it doesn't exist
    mkdirSync(targetDir, { recursive: true })
    logger.debug(`[TraceDump] Writing trace to directory: ${targetDir}`)

    // Build combined trace lines
    const traceLines: string[] = []
    const hostLogsByStep = new Map<number, { step: number; hostCallId: bigint; gasBefore: bigint; gasAfter: bigint; serviceId?: bigint } | undefined>()
    
    if (hostFunctionLogs && hostFunctionLogs.length > 0) {
      for (const hostLog of hostFunctionLogs) {
        hostLogsByStep.set(hostLog.step, hostLog)
      }
    }

    // Format trace lines in jamduna format
    for (const log of executionLogs) {
      // Check if there's a host function call before this instruction
      const hostLog = hostLogsByStep.get(log.step)
      if (hostLog) {
        const hostFunctionName = getHostFunctionName(hostLog.hostCallId)
        const gasUsed = hostLog.gasBefore - hostLog.gasAfter
        const serviceId = hostLog.serviceId ?? 0n
        traceLines.push(
          `Calling host function: ${hostFunctionName} ${hostLog.hostCallId.toString()} [gas used: ${gasUsed.toString()}, gas remaining: ${hostLog.gasAfter.toString()}] [service: ${serviceId.toString()}]`
        )
      }
      
      // Format registers as comma-separated values (jamduna format)
      const registersStr = log.registers.join(', ')
      const gasValue = log.gas.toString()

      // Format: <INSTRUCTION> <STEP> <PC> Gas: <GAS> Registers:[<REG0>, <REG1>, ...]
      // Matches jamduna format exactly
      traceLines.push(
        `${log.instructionName} ${log.step} ${log.pc.toString()} Gas: ${gasValue} Registers:[${registersStr}]`
      )
    }

    // Create filename (use blockNumber if provided and filename not specified)
    const traceFilename = filename ?? generateTraceFilename(blockNumber)
    const filepath = join(targetDir, traceFilename)

    // Write to file
    writeFileSync(filepath, traceLines.join('\n') + '\n', 'utf-8')

    return filepath
  } catch (error) {
    logger.error('Failed to write trace dump', {
      error: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}
