/**
 * Panic Dump Utility
 *
 * Utility functions for creating and writing panic dump files when PVM execution panics.
 * This helps with debugging by capturing the complete execution state.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { logger } from '@pbnj/core'
import type { RAM } from '@pbnj/types'
import { RESULT_CODES } from '../config'
import type { InstructionRegistry } from '../instructions/registry'

export interface PanicDumpData {
  timestamp: string
  serviceId: string
  gasConsumed: string
  postState: {
    pc: string
    resultCode: number
    gasCounter: string
    registers: Record<string, string>
    faultAddress: string | null
  }
  lastInstruction: {
    opcode: string
    name: string
    pc: string
    operands: number[]
    decodedRegisters?: {
      registerA?: number
      registerB?: number
      registerD?: number
    }
    calculatedAddress?: string
    panicReason?: string
  } | null
  pageMap?: unknown
  addressInteractionHistory: Array<{
    address: string
    interactionHistory: Array<{
      instructionPC: string
      instructionOpcode: string
      instructionName: string
      instructionType: string
      region: string
      accessedAddress: string
      register?: string
      value?: string
      operands?: number[]
    }>
  }>
  executionLogs: Array<{
    pc: string
    instructionName: string
    opcode: string
    message: string
    data?: Record<string, unknown>
    timestamp: number
  }>
  hostFunctionLogs: Array<{
    functionName: string
    functionId: string
    message: string
    data?: Record<string, unknown>
    timestamp: number
    pc: string | null
  }>
}

/**
 * Create and write a panic dump file
 *
 * @param data - The panic dump data to write
 * @param outputDir - Optional output directory (defaults to 'panic-dumps' in process.cwd())
 * @returns The filepath where the dump was written, or undefined if writing failed
 */
export function writePanicDump(
  data: PanicDumpData,
  outputDir?: string,
): string | undefined {
  try {
    // Create panic dump directory
    const panicDumpDir = outputDir || join(process.cwd(), 'panic-dumps')
    mkdirSync(panicDumpDir, { recursive: true })

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `panic-${timestamp}.json`
    const filepath = join(panicDumpDir, filename)

    // Write to file with pretty formatting
    // Use a replacer function to handle BigInt serialization
    writeFileSync(
      filepath,
      JSON.stringify(
        data,
        (_key, value) => {
          // Convert BigInt to string for JSON serialization
          if (typeof value === 'bigint') {
            return value.toString()
          }
          return value
        },
        2,
      ),
      'utf-8',
    )

    return filepath
  } catch (_error) {
    // Return undefined on error - caller should handle logging
    return undefined
  }
}

/**
 * Build panic dump data from PVM execution state
 *
 * @param params - Parameters for building the panic dump
 * @returns Panic dump data object
 */
export function buildPanicDumpData(params: {
  serviceId: bigint
  gasConsumed: bigint
  postState: {
    instructionPointer: bigint
    resultCode: number
    gasCounter: bigint
    registerState: bigint[]
    faultAddress: bigint | null
  }
  lastInstruction: {
    opcode: string
    name: string
    pc: string
    operands: number[]
    decodedRegisters?: {
      registerA?: number
      registerB?: number
      registerD?: number
    }
    calculatedAddress?: string
    panicReason?: string
  } | null
  ram: RAM
  executionLogs: Array<{
    pc: bigint
    instructionName: string
    opcode: string
    message: string
    data?: Record<string, unknown>
    timestamp: number
  }>
  hostFunctionLogs?: Array<{
    functionName: string
    functionId: bigint
    message: string
    data?: Record<string, unknown>
    timestamp: number
    pc: bigint | null
  }>
}): PanicDumpData {
  const { serviceId, gasConsumed, postState, lastInstruction, ram, executionLogs, hostFunctionLogs } =
    params

  // Get address interaction history
  const addressInteractionHistory = Array.from(
    ram.getAddressInteractionHistory().entries(),
  )
    .map(([address, interactions]) => ({
      address: address.toString(),
      interactionHistory: interactions.map((interaction) => ({
        instructionPC: interaction.pc.toString(),
        instructionOpcode: `0x${interaction.opcode.toString(16)}`,
        instructionName: interaction.name,
        instructionType: interaction.type,
        region: interaction.region,
        accessedAddress: interaction.address.toString(),
        ...(interaction.register !== undefined && {
          register: `r${interaction.register}`,
        }),
        ...(interaction.value !== undefined && {
          value: interaction.value.toString(),
        }),
        ...(interaction.operands !== undefined && {
          operands: interaction.operands,
        }),
      })),
    }))
    .sort((a, b) => {
      const addrA = BigInt(a.address)
      const addrB = BigInt(b.address)
      if (addrA < addrB) return -1
      if (addrA > addrB) return 1
      return 0
    })

  // Get page map if available (only for panic)
  const pageMap =
    postState.resultCode === RESULT_CODES.PANIC
      ? ram.getPageMapWithContentsJSON()
      : undefined

  // Serialize execution logs, converting bigints to strings
  const serializedExecutionLogs = executionLogs.map((log) => {
    // Serialize data object, converting bigints to strings
    const serializedData = log.data
      ? Object.fromEntries(
          Object.entries(log.data).map(([key, value]) => [
            key,
            typeof value === 'bigint' ? value.toString() : value,
          ]),
        )
      : undefined

    return {
      pc: log.pc.toString(),
      instructionName: log.instructionName,
      opcode: log.opcode,
      message: log.message,
      data: serializedData,
      timestamp: log.timestamp,
    }
  })

  // Serialize host function logs
  const serializedHostFunctionLogs = (hostFunctionLogs || []).map((log) => {
    // Serialize data object, converting bigints to strings
    const serializedData = log.data
      ? Object.fromEntries(
          Object.entries(log.data).map(([key, value]) => [
            key,
            typeof value === 'bigint' ? value.toString() : value,
          ]),
        )
      : undefined

    return {
      functionName: log.functionName,
      functionId: log.functionId.toString(),
      message: log.message,
      data: serializedData,
      timestamp: log.timestamp,
      pc: log.pc?.toString() ?? null,
    }
  })

  // Build panic dump object
  const panicDump: PanicDumpData = {
    timestamp: new Date().toISOString(),
    serviceId: serviceId.toString(),
    gasConsumed: gasConsumed.toString(),
    postState: {
      pc: postState.instructionPointer.toString(),
      resultCode: postState.resultCode,
      gasCounter: postState.gasCounter.toString(),
      registers: postState.registerState.reduce(
        (acc, r, i) => {
          acc[`r${i}`] = r.toString()
          return acc
        },
        {} as Record<string, string>,
      ),
      faultAddress: postState.faultAddress?.toString() ?? null,
    },
    lastInstruction,
    ...(pageMap && { pageMap }),
    addressInteractionHistory,
    executionLogs: serializedExecutionLogs,
    hostFunctionLogs: serializedHostFunctionLogs,
  }

  return panicDump
}

/**
 * Write host function logs to a separate file
 *
 * @param serviceId - Service ID for the execution
 * @param hostFunctionLogs - Array of host function log entries
 * @param outputDir - Optional output directory (defaults to 'host-function-logs' in process.cwd())
 * @returns The filepath where the logs were written, or undefined if writing failed
 */
export function writeHostFunctionLogs(
  serviceId: bigint,
  hostFunctionLogs: Array<{
    functionName: string
    functionId: bigint
    message: string
    data?: Record<string, unknown>
    timestamp: number
    pc: bigint | null
  }>,
  outputDir?: string,
): string | undefined {
  if (hostFunctionLogs.length === 0) {
    // No logs to write
    return undefined
  }

  const defaultDir = join(process.cwd(), 'host-function-logs')
  const targetDir = outputDir ?? defaultDir

  try {
    // Create directory if it doesn't exist
    mkdirSync(targetDir, { recursive: true })

    // Serialize host function logs
    const serializedLogs = hostFunctionLogs.map((log) => {
      const serializedData = log.data
        ? Object.fromEntries(
            Object.entries(log.data).map(([key, value]) => [
              key,
              typeof value === 'bigint' ? value.toString() : value,
            ]),
          )
        : undefined

      return {
        functionName: log.functionName,
        functionId: log.functionId.toString(),
        message: log.message,
        data: serializedData,
        timestamp: log.timestamp,
        pc: log.pc?.toString() ?? null,
      }
    })

    const logData = {
      timestamp: new Date().toISOString(),
      serviceId: serviceId.toString(),
      totalHostCalls: hostFunctionLogs.length,
      hostFunctionLogs: serializedLogs,
    }

    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `host-logs-service-${serviceId}-${timestamp}.json`
    const filepath = join(targetDir, filename)

    // Write to file
    writeFileSync(filepath, JSON.stringify(logData, null, 2))

    return filepath
  } catch (error) {
    logger.error('Failed to write host function logs', {
      error: error instanceof Error ? error.message : String(error),
      serviceId: serviceId.toString(),
    })
    return undefined
  }
}

/**
 * Decode last instruction details for panic analysis
 *
 * @param params - Parameters for decoding the last instruction
 * @returns Decoded instruction details or null if not available
 */
export function decodeLastInstruction(params: {
  lastPC: bigint
  postState: {
    code: Uint8Array
    bitmask: Uint8Array
    registerState: bigint[]
  }
  registry: InstructionRegistry
  skip: (instructionIndex: number, opcodeBitmask: Uint8Array) => number
}): {
  opcode: string
  name: string
  pc: string
  operands: number[]
  decodedRegisters?: {
    registerA?: number
    registerB?: number
    registerD?: number
  }
  calculatedAddress?: string
  panicReason?: string
} | null {
  const { lastPC, postState, registry, skip } = params
  const lastInstructionIndex = Number(lastPC)

  if (
    lastInstructionIndex >= 0 &&
    lastInstructionIndex < postState.code.length &&
    lastInstructionIndex < postState.bitmask.length &&
    postState.bitmask[lastInstructionIndex] === 1
  ) {
    const opcode = postState.code[lastInstructionIndex]
    const handler = registry.getHandler(BigInt(opcode))
    if (handler) {
      const fskip = skip(lastInstructionIndex, postState.bitmask)
      const operands = Array.from(
        postState.code.slice(
          lastInstructionIndex + 1,
          lastInstructionIndex + 1 + fskip,
        ),
      )

      // Decode instruction details for panic analysis
      const decodedInfo: {
        registerA?: number
        registerB?: number
        registerD?: number
        calculatedAddress?: string
        panicReason?: string
      } = {}

      // Try to decode registers and calculate address for memory instructions
      if (operands.length > 0) {
        try {
          // Decode register A (low 4 bits of first operand)
          const registerA = Math.min(12, operands[0] & 0x0f)
          decodedInfo.registerA = registerA

          // Decode register B (high 4 bits of first operand, shifted right by 4)
          const registerB = Math.min(12, Math.floor(operands[0] / 16))
          if (registerB <= 12) {
            decodedInfo.registerB = registerB
          }

          // For memory instructions, try to calculate address
          const instructionName = handler.name
          if (
            instructionName.includes('LOAD_IND') ||
            instructionName.includes('STORE_IND') ||
            instructionName.includes('STORE_IMM_IND')
          ) {
            // These use registerB + immediateX
            // Format: l_X = min(4, max(0, fskip - 1))
            // immed_X = sext{l_X}(decode[l_X](instructions[ι+2:l_X]))
            if (decodedInfo.registerB !== undefined && operands.length > 1) {
              const registerBValue =
                postState.registerState[decodedInfo.registerB] || 0n

              // Parse immediate according to Gray Paper format
              const lengthX = Math.min(4, Math.max(0, fskip - 1))
              let immediateX = 0n

              if (lengthX > 0 && operands.length >= 1 + lengthX) {
                // Decode little-endian bytes
                for (let i = 0; i < lengthX; i++) {
                  immediateX |= BigInt(operands[1 + i]) << BigInt(i * 8)
                }

                // Sign extend if needed (check sign bit)
                if (lengthX > 0) {
                  const signBit = 1n << BigInt(lengthX * 8 - 1)
                  if (immediateX & signBit) {
                    // Sign extend: fill upper bits with 1s
                    const mask = (1n << BigInt(lengthX * 8)) - 1n
                    immediateX = immediateX | (~mask)
                  }
                }
              } else {
                // Fallback: use first byte if length calculation fails
                immediateX = BigInt(operands[1] || 0)
              }

              const address = (registerBValue + immediateX) & 0xffffffffn
              decodedInfo.calculatedAddress = address.toString()

              // Determine panic reason
              if (address < 65536n) {
                decodedInfo.panicReason = `Address ${address.toString()} (r${decodedInfo.registerB}=${registerBValue.toString()} + ${immediateX.toString()}) is below 2^16 (65536) threshold - invalid memory access per Gray Paper pvm.tex line 137`
              }
            }
          } else if (
            instructionName.includes('LOAD_') ||
            instructionName.includes('STORE_') ||
            instructionName.includes('STORE_IMM_')
          ) {
            // Direct memory instructions use immediate as address
            // Format varies by instruction type, try to parse
            if (operands.length > 1) {
              // For most direct memory instructions, immediate starts at operands[1]
              // Length depends on fskip, but simplified parsing
              const lengthX = Math.min(4, Math.max(0, fskip - 1))
              let immediateX = 0n

              if (lengthX > 0 && operands.length >= 1 + lengthX) {
                // Decode little-endian bytes
                for (let i = 0; i < lengthX; i++) {
                  immediateX |= BigInt(operands[1 + i]) << BigInt(i * 8)
                }

                // Sign extend if needed
                if (lengthX > 0) {
                  const signBit = 1n << BigInt(lengthX * 8 - 1)
                  if (immediateX & signBit) {
                    const mask = (1n << BigInt(lengthX * 8)) - 1n
                    immediateX = immediateX | (~mask)
                  }
                }
              } else {
                immediateX = BigInt(operands[1] || 0)
              }

              decodedInfo.calculatedAddress = immediateX.toString()

              if (immediateX < 65536n) {
                decodedInfo.panicReason = `Address ${immediateX.toString()} is below 2^16 (65536) threshold - invalid memory access per Gray Paper pvm.tex line 137`
              }
            }
          }
        } catch (error) {
          // If decoding fails, continue without decoded info
          logger.debug('[PanicDumpUtil] Failed to decode instruction operands', {
            error,
            opcode: opcode.toString(16),
            operands,
          })
        }
      }

      return {
        opcode: `0x${opcode.toString(16)}`,
        name: handler.name,
        pc: lastPC.toString(),
        operands,
        ...(Object.keys(decodedInfo).length > 0 && {
          decodedRegisters: {
            ...(decodedInfo.registerA !== undefined && {
              registerA: decodedInfo.registerA,
            }),
            ...(decodedInfo.registerB !== undefined && {
              registerB: decodedInfo.registerB,
            }),
            ...(decodedInfo.registerD !== undefined && {
              registerD: decodedInfo.registerD,
            }),
          },
          ...(decodedInfo.calculatedAddress && {
            calculatedAddress: decodedInfo.calculatedAddress,
          }),
          ...(decodedInfo.panicReason && {
            panicReason: decodedInfo.panicReason,
          }),
        }),
      }
    }
  }

  return null
}

