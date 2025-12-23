/**
 * Trace Dump Utility
 *
 * Utility function for writing PVM execution traces in jamduna format.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { logger } from '@pbnjam/core'
import { ACCUMULATE_FUNCTIONS, GENERAL_FUNCTIONS } from './config'

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
 * Generate trace filename
 *
 * Priority:
 * 1. If both executorType and blockNumber are provided: {executorType}-{blockNumber}.log (e.g., wasm-4.log)
 * 2. If only executorType is provided: {executorType}-{timestamp}.log
 * 3. If only blockNumber is provided: jamduna format 00000004.log
 * 4. Otherwise: trace-{timestamp}.log
 */
export function generateTraceFilename(
  blockNumber?: number | bigint | string,
  executorType?: 'wasm' | 'typescript',
  serviceId?: number | bigint | string,
  invocationIndex?: number, // The accseq iteration index (0-based) - determines directory structure in jamduna format
): string {
  // If executor type is provided with block number, use {executorType}-{blockNumber}-{invocationIndex}-{serviceId}.log
  // This format enables the converter to group services by invocation index (accseq iteration)
  // jamduna structure: {timeslot}/{invocation_index}/{service_id}/
  if (executorType !== undefined && blockNumber !== undefined) {
    const blockNum =
      typeof blockNumber === 'string'
        ? Number.parseInt(blockNumber, 10)
        : Number(blockNumber)
    if (serviceId !== undefined) {
      const svcId =
        typeof serviceId === 'string'
          ? Number.parseInt(serviceId, 10)
          : Number(serviceId)
      const invIdx = invocationIndex ?? 0
      return `${executorType}-${blockNum}-${invIdx}-${svcId}.log`
    }
    return `${executorType}-${blockNum}.log`
  }

  // If only executor type is provided, use {executorType}-{timestamp}.log
  if (executorType !== undefined) {
    const timestamp = Date.now()
    return `${executorType}-${timestamp}.log`
  }

  // If only blockNumber is provided (and executorType is not), use jamduna format
  if (blockNumber !== undefined) {
    const blockNum =
      typeof blockNumber === 'string'
        ? Number.parseInt(blockNumber, 10)
        : Number(blockNumber)
    return `${String(blockNum).padStart(8, '0')}.log`
  }

  // Default: timestamp-based
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
 * @param filename - Optional filename (overrides all other filename generation options)
 * @param blockNumber - Optional block number for jamduna-style filename (e.g., 4 -> "00000004.log")
 * @param executorType - Optional executor type ('wasm' or 'ts') for trace-style filename
 * @param serviceId - Optional service ID to include in trace-style filename
 * @param accumulateInput - Optional accumulate input bytes (encoded args) to write alongside trace
 * @param invocationIndex - Optional invocation index (accseq iteration) for jamduna directory structure
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
  executorType?: 'wasm' | 'typescript',
  serviceId?: number | bigint | string,
  accumulateInput?: Uint8Array,
  invocationIndex?: number,
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
    const hostLogsByStep = new Map<
      number,
      | {
          step: number
          hostCallId: bigint
          gasBefore: bigint
          gasAfter: bigint
          serviceId?: bigint
        }
      | undefined
    >()

    if (hostFunctionLogs && hostFunctionLogs.length > 0) {
      for (const hostLog of hostFunctionLogs) {
        hostLogsByStep.set(hostLog.step, hostLog)
      }
    }

    // Track which steps have execution logs to ensure host function logs appear
    const executionLogSteps = new Set(executionLogs.map(log => log.step))

    // Format trace lines in jamduna format
    for (const log of executionLogs) {
      // Check if there's a host function call before this instruction
      const hostLog = hostLogsByStep.get(log.step)
      if (hostLog) {
        const hostFunctionName = getHostFunctionName(hostLog.hostCallId)
        const gasUsed = hostLog.gasBefore - hostLog.gasAfter
        const serviceId = hostLog.serviceId ?? 0n
        traceLines.push(
          `Calling host function: ${hostFunctionName} ${hostLog.hostCallId.toString()} [gas used: ${gasUsed.toString()}, gas remaining: ${hostLog.gasAfter.toString()}] [service: ${serviceId.toString()}]`,
        )
        // Remove from map so we don't duplicate it
        hostLogsByStep.delete(log.step)
      }

      // Format registers as comma-separated values (jamduna format)
      const registersStr = log.registers.join(', ')
      const gasValue = log.gas.toString()

      // Format: <INSTRUCTION> <STEP> <PC> Gas: <GAS> Registers:[<REG0>, <REG1>, ...]
      // Matches jamduna format exactly
      traceLines.push(
        `${log.instructionName} ${log.step} ${log.pc.toString()} Gas: ${gasValue} Registers:[${registersStr}]`,
      )
    }

    // Add any remaining host function logs that don't have corresponding instruction logs
    // This can happen if execution stops immediately after a host function panic
    // Iterate through remaining entries in hostLogsByStep (those not matched to instruction logs)
    for (const hostLog of hostLogsByStep.values()) {
      if (hostLog && !executionLogSteps.has(hostLog.step)) {
        const hostFunctionName = getHostFunctionName(hostLog.hostCallId)
        const gasUsed = hostLog.gasBefore - hostLog.gasAfter
        const serviceId = hostLog.serviceId ?? 0n
        traceLines.push(
          `Calling host function: ${hostFunctionName} ${hostLog.hostCallId.toString()} [gas used: ${gasUsed.toString()}, gas remaining: ${hostLog.gasAfter.toString()}] [service: ${serviceId.toString()}]`,
        )
      }
    }

    // Create filename (use provided filename, or generate based on parameters)
    const traceFilename =
      filename ?? generateTraceFilename(blockNumber, executorType, serviceId, invocationIndex)
    const filepath = join(targetDir, traceFilename)

    // Write to file
    writeFileSync(filepath, traceLines.join('\n') + '\n', 'utf-8')

    // Write accumulate_input file if provided
    // This matches the jamduna format where accumulate_input is a binary file
    // alongside the trace log with the same naming pattern
    if (accumulateInput && accumulateInput.length > 0) {
      // Generate accumulate_input filename based on trace filename
      // e.g., typescript-2-0.log -> typescript-2-0-accumulate_input.bin
      const accumulateInputFilename = traceFilename.replace('.log', '-accumulate_input.bin')
      const accumulateInputPath = join(targetDir, accumulateInputFilename)
      writeFileSync(accumulateInputPath, accumulateInput)
      logger.debug(`[TraceDump] Wrote accumulate_input to: ${accumulateInputPath}`)
    }

    return filepath
  } catch (error) {
    logger.error('Failed to write trace dump', {
      error: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}
