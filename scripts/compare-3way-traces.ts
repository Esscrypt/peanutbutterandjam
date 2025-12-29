#!/usr/bin/env bun
/**
 * 3-Way PVM Trace Comparison
 *
 * Compares three trace files: expected (jamduna), TypeScript executor, and WASM executor
 * Supports both text format and modular binary format (0.7.2+)
 *
 * Usage:
 *   bun scripts/compare-3way-traces.ts [block_number]
 *   bun scripts/compare-3way-traces.ts --modular <timeslot> [ordered_index] [service_id]
 *   bun scripts/compare-3way-traces.ts --modular-refine <work_package_hash> [work_item_index] [service_id]
 *   bun scripts/compare-3way-traces.ts --preimages-light <timeslot> [ordered_index] [service_id]
 *   bun scripts/compare-3way-traces.ts --preimages-all <timeslot> [ordered_index] [service_id]
 *   bun scripts/compare-3way-traces.ts --storage-light <timeslot> [ordered_index] [service_id]
 *   bun scripts/compare-3way-traces.ts --storage-all <timeslot> [ordered_index] [service_id]
 *   bun scripts/compare-3way-traces.ts --fuzzy <timeslot> [ordered_index] [service_id]
 *   bun scripts/compare-3way-traces.ts --fuzzy-light <timeslot> [ordered_index] [service_id]
 *   bun scripts/compare-3way-traces.ts --jam-conformance <trace_id> <block_number> [timeslot] [ordered_index] [service_id]
 *
 * Examples:
 *   bun scripts/compare-3way-traces.ts 2
 *   bun scripts/compare-3way-traces.ts --modular 151 0 0
 *   bun scripts/compare-3way-traces.ts --modular-refine 0xf1166dc1... 0 39711455
 *   bun scripts/compare-3way-traces.ts --preimages-light 2 0 0
 *   bun scripts/compare-3way-traces.ts --preimages-all 2 0 0
 *   bun scripts/compare-3way-traces.ts --storage-light 2 0 0
 *   bun scripts/compare-3way-traces.ts --storage-all 2 0 0
 *   bun scripts/compare-3way-traces.ts --fuzzy 2 0 0
 *   bun scripts/compare-3way-traces.ts --fuzzy-light 2 0 0
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { OPCODES } from '@pbnjam/pvm'

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
}

interface TraceLine {
  lineNumber: number
  raw: string
  type: 'instruction' | 'host_function' | 'comment' | 'empty' | 'status'
  instruction?: string
  step?: number
  pc?: number
  gas?: number
  registers?: string[]
  hostFunction?: {
    name: string
    id: number
    gasUsed?: number
    gasRemaining?: number
    serviceId?: number
  }
  status?: string
}

function parseOurTraceLine(line: string, lineNumber: number): TraceLine {
  const trimmed = line.trim()

  if (!trimmed) {
    return { lineNumber, raw: line, type: 'empty' }
  }

  // Host function call: "Calling host function: NAME ID [gas used: X, gas remaining: Y] [service: Z]"
  const hostFnMatch = trimmed.match(
    /Calling host function: (\w+) (\d+) \[gas used: (\d+), gas remaining: (\d+)\] \[service: (\d+)\]/,
  )
  if (hostFnMatch) {
    return {
      lineNumber,
      raw: line,
      type: 'host_function',
      hostFunction: {
        name: hostFnMatch[1],
        id: Number.parseInt(hostFnMatch[2], 10),
        gasUsed: Number.parseInt(hostFnMatch[3], 10),
        gasRemaining: Number.parseInt(hostFnMatch[4], 10),
        serviceId: Number.parseInt(hostFnMatch[5], 10),
      },
    }
  }

  // Instruction line: "INSTRUCTION STEP PC Gas: GAS Registers:[r0, r1, ...]"
  const instrMatch = trimmed.match(
    /^(\w+) (\d+) (\d+) Gas: (\d+) Registers:\[([^\]]+)\]/,
  )
  if (instrMatch) {
    const registers = instrMatch[5].split(',').map((r) => r.trim())
    return {
      lineNumber,
      raw: line,
      type: 'instruction',
      instruction: instrMatch[1],
      step: Number.parseInt(instrMatch[2], 10),
      pc: Number.parseInt(instrMatch[3], 10),
      gas: Number.parseInt(instrMatch[4], 10),
      registers,
    }
  }

  return { lineNumber, raw: line, type: 'comment' }
}

function parseExpectedTraceLine(line: string, lineNumber: number): TraceLine {
  const trimmed = line.trim()

  if (!trimmed) {
    return { lineNumber, raw: line, type: 'empty' }
  }

  // Host function call: "TRACE [host-calls] [0] NAME(...) <- ..."
  const hostFnMatch = trimmed.match(/TRACE \[host-calls\] \[(\d+)\] (\w+)\(/)
  if (hostFnMatch) {
    return {
      lineNumber,
      raw: line,
      type: 'host_function',
      hostFunction: {
        name: hostFnMatch[2],
        id: Number.parseInt(hostFnMatch[1], 10),
        serviceId: Number.parseInt(hostFnMatch[1], 10),
      },
    }
  }

  // Status line: "INSANE [pvm] [PC: X] Status: STATUS"
  const statusMatch = trimmed.match(/INSANE.*\[PC: (\d+)\] Status: (\w+)/)
  if (statusMatch) {
    return {
      lineNumber,
      raw: line,
      type: 'status',
      pc: Number.parseInt(statusMatch[1], 10),
      status: statusMatch[2],
    }
  }

  // Instruction line: "INSANE [pvm] [PC: X] INSTRUCTION"
  const instrMatch = trimmed.match(/INSANE.*\[PC: (\d+)\] (\w+)/)
  if (instrMatch) {
    return {
      lineNumber,
      raw: line,
      type: 'instruction',
      instruction: instrMatch[2],
      pc: Number.parseInt(instrMatch[1], 10),
    }
  }

  return { lineNumber, raw: line, type: 'comment' }
}

// Create reverse mapping from opcode number to instruction name from OPCODES
const OPCODE_NAMES: Record<number, string> = {}
for (const [name, opcode] of Object.entries(OPCODES)) {
  OPCODE_NAMES[Number(opcode)] = name
}

function getOpcodeName(opcode: number): string {
  return (
    OPCODE_NAMES[opcode] || `unknown_0x${opcode.toString(16).padStart(2, '0')}`
  )
}

// Read little-endian uint8
function readUint8(buffer: Buffer, offset: number): number {
  return buffer.readUInt8(offset)
}

// Read little-endian uint64
function readUint64(buffer: Buffer, offset: number): bigint {
  return buffer.readBigUInt64LE(offset)
}

// Read file, handling both compressed (.gz) and uncompressed formats
function readTraceFile(filepath: string): Buffer {
  const compressed = readFileSync(filepath)
  // Check if file is gzip compressed by checking magic bytes
  if (
    compressed.length >= 2 &&
    compressed[0] === 0x1f &&
    compressed[1] === 0x8b
  ) {
    return gunzipSync(compressed)
  }
  // Uncompressed file
  return compressed
}

// Read modular trace directory (accumulate format: timeslot/ordered_index/service_id)
async function readModularTraceDirectory(
  baseDir: string,
  timeslot?: string,
  orderedIndex?: number,
  serviceId?: number,
): Promise<TraceLine[]> {
  let traceDir = baseDir

  // Navigate to the specific trace directory
  if (timeslot !== undefined) {
    traceDir = join(traceDir, timeslot.padStart(8, '0'))
    if (orderedIndex !== undefined) {
      traceDir = join(traceDir, String(orderedIndex))
      if (serviceId !== undefined) {
        traceDir = join(traceDir, String(serviceId))
      } else {
        // If serviceId not specified, use the first available service
        const entries = await readdir(traceDir, { withFileTypes: true })
        const serviceDirs = entries
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
          .sort()
        if (serviceDirs.length === 0) {
          throw new Error(`No service directories found in ${traceDir}`)
        }
        traceDir = join(traceDir, serviceDirs[0]!)
        console.log(
          `${colors.yellow}Using first available service: ${serviceDirs[0]}${colors.reset}`,
        )
      }
    }
  }

  if (!existsSync(traceDir)) {
    throw new Error(`Trace directory not found: ${traceDir}`)
  }

  const stat = statSync(traceDir)
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${traceDir}`)
  }

  // Read all stream files (try both .gz and uncompressed)
  const opcodePathGz = join(traceDir, 'opcode.gz')
  const opcodePath = join(traceDir, 'opcode')
  const pcPathGz = join(traceDir, 'pc.gz')
  const pcPath = join(traceDir, 'pc')
  const gasPathGz = join(traceDir, 'gas.gz')
  const gasPath = join(traceDir, 'gas')

  const finalOpcodePath = existsSync(opcodePathGz) ? opcodePathGz : opcodePath
  const finalPcPath = existsSync(pcPathGz) ? pcPathGz : pcPath
  const finalGasPath = existsSync(gasPathGz)
    ? gasPathGz
    : existsSync(gasPath)
      ? gasPath
      : null

  if (!existsSync(finalOpcodePath) || !existsSync(finalPcPath)) {
    throw new Error(
      `Required trace files not found in ${traceDir}. Expected opcode.gz/opcode and pc.gz/pc`,
    )
  }

  const registerPaths: (string | null)[] = []
  for (let i = 0; i <= 12; i++) {
    const regPathGz = join(traceDir, `r${i}.gz`)
    const regPath = join(traceDir, `r${i}`)
    registerPaths.push(
      existsSync(regPathGz) ? regPathGz : existsSync(regPath) ? regPath : null,
    )
  }

  // Read all streams
  const opcodes = readTraceFile(finalOpcodePath)
  const pcs = readTraceFile(finalPcPath)
  const gas = finalGasPath ? readTraceFile(finalGasPath) : null
  const registers: (Buffer | null)[] = []
  for (const regPath of registerPaths) {
    registers.push(regPath ? readTraceFile(regPath) : null)
  }

  // Determine number of steps (opcode file size = number of steps)
  const numSteps = opcodes.length
  if (pcs.length < numSteps * 8) {
    throw new Error(
      `PC stream has insufficient data: expected ${numSteps * 8} bytes, got ${pcs.length}`,
    )
  }

  // Convert to TraceLine format
  const traceLines: TraceLine[] = []
  for (let step = 0; step < numSteps; step++) {
    const opcode = readUint8(opcodes, step)
    const pc = Number(readUint64(pcs, step * 8))
    const gasValue = gas ? Number(readUint64(gas, step * 8)) : undefined

    const regValues: string[] = []
    for (let r = 0; r <= 12; r++) {
      if (registers[r]) {
        const regValue = readUint64(registers[r]!, step * 8)
        regValues.push(regValue.toString())
      } else {
        regValues.push('0')
      }
    }

    const instruction = getOpcodeName(opcode)
    const raw = `${instruction} ${step + 1} ${pc} Gas: ${gasValue ?? 'N/A'} Registers:[${regValues.join(', ')}]`

    traceLines.push({
      lineNumber: step + 1,
      raw,
      type: 'instruction',
      instruction,
      step: step + 1,
      pc,
      gas: gasValue,
      registers: regValues,
    })
  }

  return traceLines
}

// Read modular trace directory (refine format: work_package_hash/work_item_index_service_id/child_n_m)
async function readModularRefineTraceDirectory(
  baseDir: string,
  workPackageHash: string,
  workItemIndex?: number,
  serviceId?: number,
  childSlot?: number,
  childInstance?: number,
): Promise<TraceLine[]> {
  let traceDir = baseDir

  // Navigate to work package hash directory
  if (workPackageHash.startsWith('0x')) {
    traceDir = join(traceDir, workPackageHash)
  } else {
    traceDir = join(traceDir, `0x${workPackageHash}`)
  }

  if (workItemIndex !== undefined && serviceId !== undefined) {
    traceDir = join(traceDir, `${workItemIndex}_${serviceId}`)
    if (childSlot !== undefined && childInstance !== undefined) {
      traceDir = join(traceDir, `child_${childSlot}_${childInstance}`)
    }
  } else {
    // Try to find auth directory first, then work items
    const entries = await readdir(traceDir, { withFileTypes: true })
    const authDir = entries.find((e) => e.isDirectory() && e.name === 'auth')
    if (authDir) {
      traceDir = join(traceDir, 'auth')
    } else {
      // Use first work item directory
      const workItemDirs = entries
        .filter((e) => e.isDirectory() && /^\d+_\d+$/.test(e.name))
        .map((e) => e.name)
        .sort()
      if (workItemDirs.length === 0) {
        throw new Error(`No work item directories found in ${traceDir}`)
      }
      traceDir = join(traceDir, workItemDirs[0]!)
      console.log(
        `${colors.yellow}Using first available work item: ${workItemDirs[0]}${colors.reset}`,
      )
    }
  }

  if (!existsSync(traceDir)) {
    throw new Error(`Trace directory not found: ${traceDir}`)
  }

  // Read all stream files from the trace directory (try both .gz and uncompressed)
  const opcodePathGz = join(traceDir, 'opcode.gz')
  const opcodePath = join(traceDir, 'opcode')
  const pcPathGz = join(traceDir, 'pc.gz')
  const pcPath = join(traceDir, 'pc')
  const gasPathGz = join(traceDir, 'gas.gz')
  const gasPath = join(traceDir, 'gas')

  const finalOpcodePath = existsSync(opcodePathGz) ? opcodePathGz : opcodePath
  const finalPcPath = existsSync(pcPathGz) ? pcPathGz : pcPath
  const finalGasPath = existsSync(gasPathGz)
    ? gasPathGz
    : existsSync(gasPath)
      ? gasPath
      : null

  if (!existsSync(finalOpcodePath) || !existsSync(finalPcPath)) {
    throw new Error(
      `Required trace files not found in ${traceDir}. Expected opcode.gz/opcode and pc.gz/pc`,
    )
  }

  const registerPaths: (string | null)[] = []
  for (let i = 0; i <= 12; i++) {
    const regPathGz = join(traceDir, `r${i}.gz`)
    const regPath = join(traceDir, `r${i}`)
    registerPaths.push(
      existsSync(regPathGz) ? regPathGz : existsSync(regPath) ? regPath : null,
    )
  }

  // Read all streams
  const opcodes = readTraceFile(finalOpcodePath)
  const pcs = readTraceFile(finalPcPath)
  const gas = finalGasPath ? readTraceFile(finalGasPath) : null
  const registers: (Buffer | null)[] = []
  for (const regPath of registerPaths) {
    registers.push(regPath ? readTraceFile(regPath) : null)
  }

  // Determine number of steps (opcode file size = number of steps)
  const numSteps = opcodes.length
  if (pcs.length < numSteps * 8) {
    throw new Error(
      `PC stream has insufficient data: expected ${numSteps * 8} bytes, got ${pcs.length}`,
    )
  }

  // Convert to TraceLine format
  const traceLines: TraceLine[] = []
  for (let step = 0; step < numSteps; step++) {
    const opcode = readUint8(opcodes, step)
    const pc = Number(readUint64(pcs, step * 8))
    const gasValue = gas ? Number(readUint64(gas, step * 8)) : undefined

    const regValues: string[] = []
    for (let r = 0; r <= 12; r++) {
      if (registers[r]) {
        const regValue = readUint64(registers[r]!, step * 8)
        regValues.push(regValue.toString())
      } else {
        regValues.push('0')
      }
    }

    const instruction = getOpcodeName(opcode)
    const raw = `${instruction} ${step + 1} ${pc} Gas: ${gasValue ?? 'N/A'} Registers:[${regValues.join(', ')}]`

    traceLines.push({
      lineNumber: step + 1,
      raw,
      type: 'instruction',
      instruction,
      step: step + 1,
      pc,
      gas: gasValue,
      registers: regValues,
    })
  }

  return traceLines
}

function parseTraceFile(filepath: string, isExpected: boolean): TraceLine[] {
  // Check if it's a directory (modular format) or file (text format)
  const stat = statSync(filepath)
  if (stat.isDirectory()) {
    throw new Error(
      `Directory path provided but no modular format specified. Use --modular or --modular-refine flags.`,
    )
  }

  const content = readFileSync(filepath, 'utf-8')
  const lines = content.split('\n')
  return lines.map((line, idx) =>
    isExpected
      ? parseExpectedTraceLine(line, idx + 1)
      : parseOurTraceLine(line, idx + 1),
  )
}

interface ComparisonResult {
  step: number
  type: 'instruction' | 'pc' | 'gas' | 'registers' | 'missing' | 'host_function'
  expected?: TraceLine
  typescript?: TraceLine
  wasm?: TraceLine
  details?: string
}

interface TwoWayComparisonResult {
  differences: ComparisonResult[]
  stats: {
    totalExpected: number
    totalActual: number
    matching: number
  }
}

interface OutputComparisonResult {
  expectedOutput: Uint8Array | null
  actualOutput: Uint8Array | null
  expectedErr: number | null
  actualErr: number | null
  outputMatch: boolean
  errMatch: boolean
}

/**
 * Construct the trace directory path for modular format
 * Mirrors the logic in readModularTraceDirectory
 */
function getModularTraceDir(
  baseDir: string,
  timeslot?: string,
  orderedIndex?: number,
  serviceId?: number,
): string {
  let traceDir = baseDir

  if (timeslot !== undefined) {
    traceDir = join(traceDir, timeslot.padStart(8, '0'))
    if (orderedIndex !== undefined) {
      traceDir = join(traceDir, String(orderedIndex))
      if (serviceId !== undefined) {
        traceDir = join(traceDir, String(serviceId))
      }
    }
  }

  return traceDir
}

/**
 * Compare output and err files between expected and actual trace directories
 */
function compareOutputFiles(
  expectedDir: string,
  actualDir: string,
): OutputComparisonResult {
  // Try to read output files (yield hash - 32 bytes)
  const expectedOutputPath = join(expectedDir, 'output')
  const actualOutputPath = join(actualDir, 'output')

  let expectedOutput: Uint8Array | null = null
  let actualOutput: Uint8Array | null = null

  if (existsSync(expectedOutputPath)) {
    expectedOutput = new Uint8Array(readFileSync(expectedOutputPath))
  }
  if (existsSync(actualOutputPath)) {
    actualOutput = new Uint8Array(readFileSync(actualOutputPath))
  }

  // Try to read err files (error code - 1 byte)
  const expectedErrPath = join(expectedDir, 'err')
  const actualErrPath = join(actualDir, 'err')

  let expectedErr: number | null = null
  let actualErr: number | null = null

  if (existsSync(expectedErrPath)) {
    const errData = readFileSync(expectedErrPath)
    expectedErr = errData.length > 0 ? errData[0] : null
  }
  if (existsSync(actualErrPath)) {
    const errData = readFileSync(actualErrPath)
    actualErr = errData.length > 0 ? errData[0] : null
  }

  // Compare outputs
  let outputMatch = false
  if (expectedOutput === null && actualOutput === null) {
    outputMatch = true // Both missing is a match
  } else if (expectedOutput !== null && actualOutput !== null) {
    outputMatch =
      expectedOutput.length === actualOutput.length &&
      expectedOutput.every((byte, i) => byte === actualOutput[i])
  }

  // Compare errors
  const errMatch = expectedErr === actualErr

  return {
    expectedOutput,
    actualOutput,
    expectedErr,
    actualErr,
    outputMatch,
    errMatch,
  }
}

/**
 * Format bytes as hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return (
    '0x' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  )
}

function compareTwoTraces(
  expectedLines: TraceLine[],
  actualLines: TraceLine[],
): TwoWayComparisonResult {
  const differences: ComparisonResult[] = []

  // Filter to only instruction and host function lines
  const expectedInstrs = expectedLines.filter(
    (l) => l.type === 'instruction' || l.type === 'host_function',
  )
  const actualInstrs = actualLines.filter(
    (l) => l.type === 'instruction' || l.type === 'host_function',
  )

  const maxSteps = Math.max(expectedInstrs.length, actualInstrs.length)
  let matching = 0

  for (let i = 0; i < maxSteps; i++) {
    const expected = expectedInstrs[i]
    const actual = actualInstrs[i]

    // Check if both are present
    if (!expected || !actual) {
      differences.push({
        step: i + 1,
        type: 'missing',
        expected,
        typescript: actual,
        details: `Missing in: ${!expected ? 'expected ' : ''}${!actual ? 'actual' : ''}`,
      })
      continue
    }

    // Compare instruction names
    if (expected.type === 'instruction' && actual.type === 'instruction') {
      const instrMatch = expected.instruction === actual.instruction

      if (!instrMatch) {
        differences.push({
          step: i + 1,
          type: 'instruction',
          expected,
          typescript: actual,
          details: `Expected: ${expected.instruction}, Actual: ${actual.instruction}`,
        })
        continue
      }

      // Compare PC
      if (expected.pc !== actual.pc) {
        differences.push({
          step: i + 1,
          type: 'pc',
          expected,
          typescript: actual,
          details: `Expected PC: ${expected.pc}, Actual PC: ${actual.pc}`,
        })
        continue
      }

      // Compare gas (if available)
      if (expected.gas !== undefined && actual.gas !== undefined) {
        if (expected.gas !== actual.gas) {
          differences.push({
            step: i + 1,
            type: 'gas',
            expected,
            typescript: actual,
            details: `Expected gas: ${expected.gas}, Actual gas: ${actual.gas}, diff: ${expected.gas - actual.gas}`,
          })
          continue
        }
      }

      // Compare registers (if available)
      if (expected.registers && actual.registers) {
        const regDiffs: string[] = []
        for (
          let r = 0;
          r < Math.max(expected.registers.length, actual.registers.length);
          r++
        ) {
          const expReg = expected.registers[r] || '0'
          const actReg = actual.registers[r] || '0'
          if (expReg !== actReg) {
            regDiffs.push(`r${r}: Expected=${expReg}, Actual=${actReg}`)
          }
        }
        if (regDiffs.length > 0) {
          differences.push({
            step: i + 1,
            type: 'registers',
            expected,
            typescript: actual,
            details: `Register diffs: ${regDiffs.join('; ')}`,
          })
          continue
        }
      }

      matching++
    }

    // Compare host function calls
    if (expected.type === 'host_function' && actual.type === 'host_function') {
      const nameMatch =
        expected.hostFunction?.name === actual.hostFunction?.name
      const idMatch = expected.hostFunction?.id === actual.hostFunction?.id

      if (!nameMatch || !idMatch) {
        differences.push({
          step: i + 1,
          type: 'host_function',
          expected,
          typescript: actual,
          details: `Expected: ${expected.hostFunction?.name} ${expected.hostFunction?.id}, Actual: ${actual.hostFunction?.name} ${actual.hostFunction?.id}`,
        })
        continue
      }

      matching++
    }
  }

  return {
    differences,
    stats: {
      totalExpected: expectedInstrs.length,
      totalActual: actualInstrs.length,
      matching,
    },
  }
}

function compareThreeTraces(
  expectedLines: TraceLine[],
  typescriptLines: TraceLine[],
  wasmLines: TraceLine[],
): {
  differences: ComparisonResult[]
  stats: {
    totalExpected: number
    totalTypescript: number
    totalWasm: number
    matching: number
  }
} {
  const differences: ComparisonResult[] = []

  // Filter to only instruction and host function lines
  const expectedInstrs = expectedLines.filter(
    (l) => l.type === 'instruction' || l.type === 'host_function',
  )
  const typescriptInstrs = typescriptLines.filter(
    (l) => l.type === 'instruction' || l.type === 'host_function',
  )
  const wasmInstrs = wasmLines.filter(
    (l) => l.type === 'instruction' || l.type === 'host_function',
  )

  const maxSteps = Math.max(
    expectedInstrs.length,
    typescriptInstrs.length,
    wasmInstrs.length,
  )

  let matching = 0

  for (let i = 0; i < maxSteps; i++) {
    const expected = expectedInstrs[i]
    const typescript = typescriptInstrs[i]
    const wasm = wasmInstrs[i]

    // Check if all three are present
    if (!expected && !typescript && !wasm) continue

    // Check for missing traces
    if (!expected || !typescript || !wasm) {
      differences.push({
        step: i + 1,
        type: 'missing',
        expected,
        typescript,
        wasm,
        details: `Missing in: ${!expected ? 'expected ' : ''}${!typescript ? 'typescript ' : ''}${!wasm ? 'wasm' : ''}`,
      })
      continue
    }

    // Compare instruction names
    if (
      expected.type === 'instruction' &&
      typescript.type === 'instruction' &&
      wasm.type === 'instruction'
    ) {
      const instrMatch =
        expected.instruction === typescript.instruction &&
        typescript.instruction === wasm.instruction

      if (!instrMatch) {
        differences.push({
          step: i + 1,
          type: 'instruction',
          expected,
          typescript,
          wasm,
          details: `Expected: ${expected.instruction}, TS: ${typescript.instruction}, WASM: ${wasm.instruction}`,
        })
        continue
      }

      // Compare PC
      if (expected.pc !== typescript.pc || typescript.pc !== wasm.pc) {
        differences.push({
          step: i + 1,
          type: 'pc',
          expected,
          typescript,
          wasm,
          details: `Expected PC: ${expected.pc}, TS PC: ${typescript.pc}, WASM PC: ${wasm.pc}`,
        })
        continue
      }

      // Compare gas (if available)
      if (typescript.gas !== undefined && wasm.gas !== undefined) {
        if (typescript.gas !== wasm.gas) {
          differences.push({
            step: i + 1,
            type: 'gas',
            expected,
            typescript,
            wasm,
            details: `TS gas: ${typescript.gas}, WASM gas: ${wasm.gas}, diff: ${typescript.gas - wasm.gas}`,
          })
          continue
        }
      }

      // Compare registers (if available)
      if (typescript.registers && wasm.registers) {
        const regDiffs: string[] = []
        for (
          let r = 0;
          r < Math.max(typescript.registers.length, wasm.registers.length);
          r++
        ) {
          const tsReg = typescript.registers[r] || '0'
          const wasmReg = wasm.registers[r] || '0'
          if (tsReg !== wasmReg) {
            regDiffs.push(`r${r}: TS=${tsReg}, WASM=${wasmReg}`)
          }
        }
        if (regDiffs.length > 0) {
          differences.push({
            step: i + 1,
            type: 'registers',
            expected,
            typescript,
            wasm,
            details: `Register diffs: ${regDiffs.join('; ')}`,
          })
          continue
        }
      }

      matching++
    }

    // Compare host function calls
    if (
      expected.type === 'host_function' &&
      typescript.type === 'host_function' &&
      wasm.type === 'host_function'
    ) {
      const nameMatch =
        expected.hostFunction?.name === typescript.hostFunction?.name &&
        typescript.hostFunction?.name === wasm.hostFunction?.name
      const idMatch =
        expected.hostFunction?.id === typescript.hostFunction?.id &&
        typescript.hostFunction?.id === wasm.hostFunction?.id

      if (!nameMatch || !idMatch) {
        differences.push({
          step: i + 1,
          type: 'host_function',
          expected,
          typescript,
          wasm,
          details: `Expected: ${expected.hostFunction?.name} ${expected.hostFunction?.id}, TS: ${typescript.hostFunction?.name} ${typescript.hostFunction?.id}, WASM: ${wasm.hostFunction?.name} ${wasm.hostFunction?.id}`,
        })
        continue
      }

      matching++
    }
  }

  return {
    differences,
    stats: {
      totalExpected: expectedInstrs.length,
      totalTypescript: typescriptInstrs.length,
      totalWasm: wasmInstrs.length,
      matching,
    },
  }
}

function printTwoWayComparison(
  label: string | number,
  expectedPath: string,
  actualPath: string,
  executorType: 'typescript' | 'wasm',
  result: TwoWayComparisonResult,
  expectedDir?: string,
  actualDir?: string,
) {
  console.log(
    `${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`,
  )
  console.log(
    `${colors.bold}📊 2-Way Trace Comparison: ${label} (${executorType})${colors.reset}`,
  )
  console.log(
    `${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`,
  )
  console.log()
  console.log(
    `${colors.cyan}Expected (jamduna):${colors.reset} ${expectedPath}`,
  )
  console.log(
    `${colors.cyan}${executorType === 'typescript' ? 'TypeScript' : 'WASM'}:${colors.reset}        ${actualPath}`,
  )
  console.log()

  // Compare output/err files if directories are provided
  let outputComparison: OutputComparisonResult | null = null
  if (expectedDir && actualDir) {
    outputComparison = compareOutputFiles(expectedDir, actualDir)
  }

  // Summary
  console.log(`${colors.bold}📈 Summary${colors.reset}`)
  console.log(`   Expected instructions:  ${result.stats.totalExpected}`)
  console.log(
    `   ${executorType === 'typescript' ? 'TypeScript' : 'WASM'} instructions: ${result.stats.totalActual}`,
  )
  console.log(`   Matching:                ${result.stats.matching}`)
  console.log(`   Differences:              ${result.differences.length}`)

  // Show output/err comparison if available
  if (outputComparison) {
    console.log()
    console.log(
      `${colors.bold}📦 Accumulation Output Comparison${colors.reset}`,
    )

    // Output (yield hash) comparison
    if (outputComparison.expectedOutput || outputComparison.actualOutput) {
      const outputStatus = outputComparison.outputMatch
        ? `${colors.green}✓ Match${colors.reset}`
        : `${colors.red}✗ Mismatch${colors.reset}`
      console.log(`   Output (yield): ${outputStatus}`)

      if (!outputComparison.outputMatch) {
        if (outputComparison.expectedOutput) {
          console.log(
            `      ${colors.green}Expected:${colors.reset} ${bytesToHex(outputComparison.expectedOutput)}`,
          )
        } else {
          console.log(
            `      ${colors.green}Expected:${colors.reset} (not present)`,
          )
        }
        if (outputComparison.actualOutput) {
          console.log(
            `      ${colors.blue}Actual:${colors.reset}   ${bytesToHex(outputComparison.actualOutput)}`,
          )
        } else {
          console.log(
            `      ${colors.blue}Actual:${colors.reset}   (not present)`,
          )
        }
      }
    } else {
      console.log(
        `   Output (yield): ${colors.dim}(neither present)${colors.reset}`,
      )
    }

    // Error comparison
    if (
      outputComparison.expectedErr !== null ||
      outputComparison.actualErr !== null
    ) {
      const errStatus = outputComparison.errMatch
        ? `${colors.green}✓ Match${colors.reset}`
        : `${colors.red}✗ Mismatch${colors.reset}`
      console.log(`   Error code:     ${errStatus}`)

      if (!outputComparison.errMatch) {
        console.log(
          `      ${colors.green}Expected:${colors.reset} ${outputComparison.expectedErr ?? '(not present)'}`,
        )
        console.log(
          `      ${colors.blue}Actual:${colors.reset}   ${outputComparison.actualErr ?? '(not present)'}`,
        )
      }
    } else {
      console.log(
        `   Error code:     ${colors.dim}(neither present)${colors.reset}`,
      )
    }
  }

  console.log()

  // Match percentage
  const matchPercent =
    result.stats.totalExpected > 0
      ? ((result.stats.matching / result.stats.totalExpected) * 100).toFixed(2)
      : '0'
  const matchColor =
    Number.parseFloat(matchPercent) >= 99
      ? colors.green
      : Number.parseFloat(matchPercent) >= 90
        ? colors.yellow
        : colors.red
  console.log(`   ${matchColor}Match rate: ${matchPercent}%${colors.reset}`)
  console.log()

  // Show first N differences
  const maxDiffsToShow = 20
  if (result.differences.length > 0) {
    console.log(
      `${colors.bold}📋 First ${Math.min(maxDiffsToShow, result.differences.length)} Differences${colors.reset}`,
    )
    console.log()

    for (
      let i = 0;
      i < Math.min(maxDiffsToShow, result.differences.length);
      i++
    ) {
      const diff = result.differences[i]
      const typeIcon = {
        instruction: '🔀',
        pc: '📍',
        gas: '⛽',
        registers: '📊',
        missing: '❌',
        host_function: '📞',
      }[diff.type]

      console.log(`   ${typeIcon} Step ${diff.step}: ${diff.type}`)
      if (diff.details) {
        console.log(`      ${colors.dim}${diff.details}${colors.reset}`)
      }

      if (diff.expected) {
        console.log(
          `      ${colors.green}Expected:${colors.reset} ${diff.expected.raw.substring(0, 100)}`,
        )
      }
      if (diff.typescript) {
        const label = executorType === 'typescript' ? 'TypeScript' : 'WASM'
        const color =
          executorType === 'typescript' ? colors.blue : colors.magenta
        console.log(
          `      ${color}${label}:${colors.reset} ${diff.typescript.raw.substring(0, 100)}`,
        )
      }
      console.log()
    }

    if (result.differences.length > maxDiffsToShow) {
      console.log(
        `   ${colors.dim}... and ${result.differences.length - maxDiffsToShow} more differences${colors.reset}`,
      )
      console.log()
    }
  }

  // Analyze termination points
  const missingDiffs = result.differences.filter((d) => d.type === 'missing')
  if (missingDiffs.length > 0) {
    console.log(`${colors.bold}🔍 Termination Analysis${colors.reset}`)
    console.log()

    const expectedOnly = missingDiffs.filter((d) => d.expected && !d.typescript)
    const actualOnly = missingDiffs.filter((d) => d.typescript && !d.expected)

    if (expectedOnly.length > 0) {
      console.log(
        `${colors.yellow}⚠️  Expected trace continues beyond ${executorType} trace${colors.reset}`,
      )
      console.log(
        `   ${expectedOnly.length} instructions in expected but not in ${executorType}`,
      )
      if (expectedOnly[0]?.expected) {
        console.log(
          `   Last expected instruction: ${expectedOnly[0].expected.instruction} at PC ${expectedOnly[0].expected.pc}`,
        )
      }
    }

    if (actualOnly.length > 0) {
      console.log(
        `${executorType === 'typescript' ? colors.blue : colors.magenta}ℹ️  ${executorType === 'typescript' ? 'TypeScript' : 'WASM'} trace has ${actualOnly.length} extra instructions${colors.reset}`,
      )
    }

    // Find where traces diverge
    const firstMissing = missingDiffs[0]
    if (firstMissing) {
      console.log()
      console.log(
        `${colors.bold}📍 First divergence at step ${firstMissing.step}${colors.reset}`,
      )
      if (firstMissing.expected) {
        console.log(
          `   Expected: ${firstMissing.expected.instruction || 'host_function'} at PC ${firstMissing.expected.pc}`,
        )
      }
      if (firstMissing.typescript) {
        console.log(
          `   ${executorType === 'typescript' ? 'TypeScript' : 'WASM'}: ${firstMissing.typescript.instruction || 'host_function'} at PC ${firstMissing.typescript.pc}`,
        )
      }
    }
    console.log()
  }
}

/**
 * Print comparison of TypeScript vs WASM traces (without expected/jamduna trace)
 */
function printTwoWayComparisonTsVsWasm(
  label: string,
  typescriptPath: string,
  wasmPath: string,
  result: TwoWayComparisonResult,
) {
  console.log()
  console.log(
    `${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`,
  )
  console.log(
    `${colors.bold}📊 TypeScript vs WASM Comparison: ${label}${colors.reset}`,
  )
  console.log(
    `${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`,
  )
  console.log()
  console.log(`${colors.blue}TypeScript:${colors.reset} ${typescriptPath}`)
  console.log(`${colors.magenta}WASM:${colors.reset}       ${wasmPath}`)
  console.log()

  // Summary
  console.log(`${colors.bold}📈 Summary${colors.reset}`)
  console.log(`   TypeScript instructions: ${result.stats.totalExpected}`)
  console.log(`   WASM instructions:       ${result.stats.totalActual}`)
  console.log(`   Matching:                ${result.stats.matching}`)
  console.log(`   Differences:             ${result.differences.length}`)
  console.log()

  // Match percentage
  const maxInstructions = Math.max(
    result.stats.totalExpected,
    result.stats.totalActual,
  )
  const matchPercent =
    maxInstructions > 0
      ? ((result.stats.matching / maxInstructions) * 100).toFixed(2)
      : '0'
  const matchColor =
    Number.parseFloat(matchPercent) >= 99
      ? colors.green
      : Number.parseFloat(matchPercent) >= 90
        ? colors.yellow
        : colors.red
  console.log(`   ${matchColor}Match rate: ${matchPercent}%${colors.reset}`)
  console.log()

  // Show first N differences
  const maxDiffsToShow = 30
  if (result.differences.length > 0) {
    console.log(
      `${colors.bold}🔍 First ${Math.min(result.differences.length, maxDiffsToShow)} Differences${colors.reset}`,
    )
    console.log()

    for (
      let i = 0;
      i < Math.min(result.differences.length, maxDiffsToShow);
      i++
    ) {
      const diff = result.differences[i]!
      const stepLabel = `Step ${diff.step}`.padEnd(12)

      if (diff.type === 'instruction_mismatch') {
        console.log(
          `   ${colors.red}${stepLabel} Instruction mismatch:${colors.reset}`,
        )
        console.log(
          `      ${colors.blue}TS:   ${diff.expected?.instruction?.padEnd(20) ?? 'N/A'} PC: ${diff.expected?.pc?.toString().padEnd(8) ?? 'N/A'} Gas: ${diff.expected?.gas ?? 'N/A'}${colors.reset}`,
        )
        console.log(
          `      ${colors.magenta}WASM: ${diff.typescript?.instruction?.padEnd(20) ?? 'N/A'} PC: ${diff.typescript?.pc?.toString().padEnd(8) ?? 'N/A'} Gas: ${diff.typescript?.gas ?? 'N/A'}${colors.reset}`,
        )
      } else if (diff.type === 'pc_mismatch') {
        console.log(
          `   ${colors.yellow}${stepLabel} PC mismatch: TS=${diff.expected?.pc}, WASM=${diff.typescript?.pc}${colors.reset}`,
        )
      } else if (diff.type === 'gas_mismatch') {
        console.log(
          `   ${colors.cyan}${stepLabel} Gas mismatch: TS=${diff.expected?.gas}, WASM=${diff.typescript?.gas}${colors.reset}`,
        )
      } else if (diff.type === 'missing') {
        if (diff.expected && !diff.typescript) {
          console.log(
            `   ${colors.blue}${stepLabel} Only in TS: ${diff.expected.instruction} at PC ${diff.expected.pc}${colors.reset}`,
          )
        } else if (diff.typescript && !diff.expected) {
          console.log(
            `   ${colors.magenta}${stepLabel} Only in WASM: ${diff.typescript.instruction} at PC ${diff.typescript.pc}${colors.reset}`,
          )
        }
      }
    }

    if (result.differences.length > maxDiffsToShow) {
      console.log(
        `   ${colors.dim}... and ${result.differences.length - maxDiffsToShow} more differences${colors.reset}`,
      )
    }
    console.log()
  } else {
    console.log(`${colors.green}✅ Traces match perfectly!${colors.reset}`)
    console.log()
  }

  // Termination analysis
  const missingDiffs = result.differences.filter((d) => d.type === 'missing')
  if (missingDiffs.length > 0) {
    console.log(`${colors.bold}🔍 Termination Analysis${colors.reset}`)
    console.log()

    const tsOnly = missingDiffs.filter((d) => d.expected && !d.typescript)
    const wasmOnly = missingDiffs.filter((d) => d.typescript && !d.expected)

    if (tsOnly.length > 0) {
      console.log(
        `${colors.blue}ℹ️  TypeScript has ${tsOnly.length} more instructions than WASM${colors.reset}`,
      )
      const lastTsInstr = tsOnly[tsOnly.length - 1]?.expected
      if (lastTsInstr) {
        console.log(
          `   Last TS-only instruction: ${lastTsInstr.instruction} at PC ${lastTsInstr.pc} (step ${lastTsInstr.step})`,
        )
      }
    }

    if (wasmOnly.length > 0) {
      console.log(
        `${colors.magenta}ℹ️  WASM has ${wasmOnly.length} more instructions than TypeScript${colors.reset}`,
      )
      const lastWasmInstr = wasmOnly[wasmOnly.length - 1]?.typescript
      if (lastWasmInstr) {
        console.log(
          `   Last WASM-only instruction: ${lastWasmInstr.instruction} at PC ${lastWasmInstr.pc} (step ${lastWasmInstr.step})`,
        )
      }
    }

    // Find first divergence
    const firstMissing = missingDiffs[0]
    if (firstMissing) {
      console.log()
      console.log(
        `${colors.bold}📍 First divergence at step ${firstMissing.step}${colors.reset}`,
      )
      if (firstMissing.expected) {
        console.log(
          `   TypeScript: ${firstMissing.expected.instruction || 'host_function'} at PC ${firstMissing.expected.pc}`,
        )
      }
      if (firstMissing.typescript) {
        console.log(
          `   WASM: ${firstMissing.typescript.instruction || 'host_function'} at PC ${firstMissing.typescript.pc}`,
        )
      }
    }
    console.log()
  }
}

function printComparison(
  label: string | number,
  expectedPath: string,
  typescriptPath: string,
  wasmPath: string,
  result: ReturnType<typeof compareThreeTraces>,
) {
  console.log(
    `${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`,
  )
  console.log(
    `${colors.bold}📊 3-Way Trace Comparison: ${label}${colors.reset}`,
  )
  console.log(
    `${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`,
  )
  console.log()
  console.log(
    `${colors.cyan}Expected (jamduna):${colors.reset} ${expectedPath}`,
  )
  console.log(
    `${colors.cyan}TypeScript:${colors.reset}        ${typescriptPath}`,
  )
  console.log(`${colors.cyan}WASM:${colors.reset}             ${wasmPath}`)
  console.log()

  // Summary
  console.log(`${colors.bold}📈 Summary${colors.reset}`)
  console.log(`   Expected instructions:  ${result.stats.totalExpected}`)
  console.log(`   TypeScript instructions: ${result.stats.totalTypescript}`)
  console.log(`   WASM instructions:       ${result.stats.totalWasm}`)
  console.log(`   Matching:                ${result.stats.matching}`)
  console.log(`   Differences:              ${result.differences.length}`)
  console.log()

  // Match percentage
  const matchPercent =
    result.stats.totalExpected > 0
      ? ((result.stats.matching / result.stats.totalExpected) * 100).toFixed(2)
      : '0'
  const matchColor =
    Number.parseFloat(matchPercent) >= 99
      ? colors.green
      : Number.parseFloat(matchPercent) >= 90
        ? colors.yellow
        : colors.red
  console.log(`   ${matchColor}Match rate: ${matchPercent}%${colors.reset}`)
  console.log()

  // Show first N differences
  const maxDiffsToShow = 20
  if (result.differences.length > 0) {
    console.log(
      `${colors.bold}📋 First ${Math.min(maxDiffsToShow, result.differences.length)} Differences${colors.reset}`,
    )
    console.log()

    for (
      let i = 0;
      i < Math.min(maxDiffsToShow, result.differences.length);
      i++
    ) {
      const diff = result.differences[i]
      const typeIcon = {
        instruction: '🔀',
        pc: '📍',
        gas: '⛽',
        registers: '📊',
        missing: '❌',
        host_function: '📞',
      }[diff.type]

      console.log(`   ${typeIcon} Step ${diff.step}: ${diff.type}`)
      if (diff.details) {
        console.log(`      ${colors.dim}${diff.details}${colors.reset}`)
      }

      if (diff.expected) {
        console.log(
          `      ${colors.green}Expected:${colors.reset} ${diff.expected.raw.substring(0, 100)}`,
        )
      }
      if (diff.typescript) {
        console.log(
          `      ${colors.blue}TypeScript:${colors.reset} ${diff.typescript.raw.substring(0, 100)}`,
        )
      }
      if (diff.wasm) {
        console.log(
          `      ${colors.magenta}WASM:${colors.reset} ${diff.wasm.raw.substring(0, 100)}`,
        )
      }
      console.log()
    }

    if (result.differences.length > maxDiffsToShow) {
      console.log(
        `   ${colors.dim}... and ${result.differences.length - maxDiffsToShow} more differences${colors.reset}`,
      )
      console.log()
    }
  }

  // Analyze termination points
  const missingDiffs = result.differences.filter((d) => d.type === 'missing')
  if (missingDiffs.length > 0) {
    console.log(`${colors.bold}🔍 Termination Analysis${colors.reset}`)
    console.log()

    const expectedOnly = missingDiffs.filter(
      (d) => d.expected && !d.typescript && !d.wasm,
    )
    const tsOnly = missingDiffs.filter(
      (d) => d.typescript && !d.expected && !d.wasm,
    )
    const wasmOnly = missingDiffs.filter(
      (d) => d.wasm && !d.expected && !d.typescript,
    )

    if (expectedOnly.length > 0) {
      console.log(
        `${colors.yellow}⚠️  Expected trace continues beyond our traces${colors.reset}`,
      )
      console.log(
        `   ${expectedOnly.length} instructions in expected but not in ours`,
      )
      if (expectedOnly[0].expected) {
        console.log(
          `   Last expected instruction: ${expectedOnly[0].expected.instruction} at PC ${expectedOnly[0].expected.pc}`,
        )
      }
    }

    if (tsOnly.length > 0) {
      console.log(
        `${colors.blue}ℹ️  TypeScript trace has ${tsOnly.length} extra instructions${colors.reset}`,
      )
    }

    if (wasmOnly.length > 0) {
      console.log(
        `${colors.magenta}ℹ️  WASM trace has ${wasmOnly.length} extra instructions${colors.reset}`,
      )
    }

    // Find where traces diverge
    const firstMissing = missingDiffs[0]
    if (firstMissing) {
      console.log()
      console.log(
        `${colors.bold}📍 First divergence at step ${firstMissing.step}${colors.reset}`,
      )
      if (firstMissing.expected) {
        console.log(
          `   Expected: ${firstMissing.expected.instruction || 'host_function'} at PC ${firstMissing.expected.pc}`,
        )
      }
      if (firstMissing.typescript) {
        console.log(
          `   TypeScript: ${firstMissing.typescript.instruction || 'host_function'} at PC ${firstMissing.typescript.pc}`,
        )
      }
      if (firstMissing.wasm) {
        console.log(
          `   WASM: ${firstMissing.wasm.instruction || 'host_function'} at PC ${firstMissing.wasm.pc}`,
        )
      }
    }
    console.log()
  }
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log(`${colors.bold}PVM Trace Comparison Tool${colors.reset}`)
    console.log()
    console.log('Usage (2-way comparison):')
    console.log(
      '  bun scripts/compare-3way-traces.ts --2way [--typescript|--wasm] [block_number]',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --2way [--typescript|--wasm] --modular <timeslot> [ordered_index] [service_id]',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --2way [--typescript|--wasm] --preimages-light <timeslot> [ordered_index] [service_id]',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --2way [--typescript|--wasm] --preimages-all <timeslot> [ordered_index] [service_id]',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --2way [--typescript|--wasm] --storage-light <timeslot> [ordered_index] [service_id]',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --2way [--typescript|--wasm] --storage-all <timeslot> [ordered_index] [service_id]',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --2way [--typescript|--wasm] --fuzzy <timeslot> [ordered_index] [service_id]',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --2way [--typescript|--wasm] --fuzzy-light <timeslot> [ordered_index] [service_id]',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --2way [--typescript|--wasm] --jam-conformance <trace_id> <block_number> [timeslot] [ordered_index] [service_id]',
    )
    console.log()
    console.log('Usage (3-way comparison):')
    console.log('  bun scripts/compare-3way-traces.ts [block_number]')
    console.log(
      '  bun scripts/compare-3way-traces.ts --modular <timeslot> [ordered_index] [service_id]',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --modular-refine <work_package_hash> [work_item_index] [service_id]',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --preimages-light <timeslot> [ordered_index] [service_id]',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --preimages-all <timeslot> [ordered_index] [service_id]',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --storage-light <timeslot> [ordered_index] [service_id]',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --storage-all <timeslot> [ordered_index] [service_id]',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --fuzzy <timeslot> [ordered_index] [service_id]',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --fuzzy-light <timeslot> [ordered_index] [service_id]',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --jam-conformance <trace_id> <block_number> [timeslot] [ordered_index] [service_id]',
    )
    console.log()
    console.log('Examples:')
    console.log(
      '  bun scripts/compare-3way-traces.ts --2way --typescript --preimages-light 2 0 0',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --2way --wasm --preimages-light 2 0 0',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --2way --typescript --storage-light 2 0 0',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --2way --typescript --preimages-all 2 0 0',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --2way --typescript --storage-all 2 0 0',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --2way --typescript --fuzzy 2 0 0',
    )
    console.log(
      '  bun scripts/compare-3way-traces.ts --2way --typescript --fuzzy-light 2 0 0',
    )
    console.log('  bun scripts/compare-3way-traces.ts 2')
    console.log('  bun scripts/compare-3way-traces.ts --modular 151 0 0')
    console.log(
      '  bun scripts/compare-3way-traces.ts --modular-refine 0xf1166dc1... 0 39711455',
    )
    console.log('  bun scripts/compare-3way-traces.ts --preimages-light 2 0 0')
    console.log('  bun scripts/compare-3way-traces.ts --preimages-all 2 0 0')
    console.log('  bun scripts/compare-3way-traces.ts --storage-light 2 0 0')
    console.log('  bun scripts/compare-3way-traces.ts --storage-all 2 0 0')
    console.log('  bun scripts/compare-3way-traces.ts --fuzzy 2 0 0')
    console.log('  bun scripts/compare-3way-traces.ts --fuzzy-light 2 0 0')
    console.log(
      '  bun scripts/compare-3way-traces.ts --jam-conformance 1766243315_8065 00000035 11 0 0',
    )
    return
  }

  const workspaceRoot = join(__dirname, '..')
  let expectedLines: TraceLine[]
  let typescriptLines: TraceLine[] = []
  let wasmLines: TraceLine[] = []
  let expectedPath: string
  let typescriptPath: string
  let wasmPath: string
  let comparisonLabel: string

  // Track modular trace directories for output/err comparison
  let modularExpectedDir: string | undefined
  let modularActualDir: string | undefined

  // Check for 2-way comparison mode
  const isTwoWay = args[0] === '--2way'
  let executorType: 'typescript' | 'wasm' | undefined
  let formatArgs: string[] = args

  if (isTwoWay) {
    // Parse executor type
    if (args[1] === '--typescript') {
      executorType = 'typescript'
      formatArgs = args.slice(2)
    } else if (args[1] === '--wasm') {
      executorType = 'wasm'
      formatArgs = args.slice(2)
    } else {
      // Default to typescript if not specified
      executorType = 'typescript'
      formatArgs = args.slice(1)
      console.log(
        `${colors.yellow}No executor type specified, defaulting to --typescript${colors.reset}`,
      )
    }

    if (formatArgs.length === 0) {
      console.error(
        `${colors.red}Error: Format and arguments required after --2way [--typescript|--wasm]${colors.reset}`,
      )
      process.exit(1)
    }
  }

  // Check for modular format flags (use formatArgs if in 2-way mode)
  const formatFlag = isTwoWay ? formatArgs[0] : args[0]
  if (formatFlag === '--modular') {
    // Modular accumulate format
    const timeslot = isTwoWay ? formatArgs[1] : args[1]
    const orderedIndex = isTwoWay
      ? formatArgs[2]
        ? Number.parseInt(formatArgs[2], 10)
        : undefined
      : args[2]
        ? Number.parseInt(args[2], 10)
        : undefined
    const serviceId = isTwoWay
      ? formatArgs[3]
        ? Number.parseInt(formatArgs[3], 10)
        : undefined
      : args[3]
        ? Number.parseInt(args[3], 10)
        : undefined

    if (!timeslot) {
      console.error(
        `${colors.red}Error: Timeslot required for --modular format${colors.reset}`,
      )
      process.exit(1)
    }

    const testVectorsDir = join(
      workspaceRoot,
      'submodules',
      'jamduna',
      'jam-test-vectors',
      '0.7.2',
      'fuzzy',
    )

    expectedPath = testVectorsDir
    typescriptPath = join(workspaceRoot, 'pvm-traces', 'modular')
    wasmPath = join(workspaceRoot, 'pvm-traces', 'modular-wasm')

    comparisonLabel = `Timeslot ${timeslot}${orderedIndex !== undefined ? `, Index ${orderedIndex}` : ''}${serviceId !== undefined ? `, Service ${serviceId}` : ''}`

    console.log(
      `${colors.cyan}Reading modular traces (accumulate format)...${colors.reset}`,
    )

    expectedLines = await readModularTraceDirectory(
      expectedPath,
      timeslot,
      orderedIndex,
      serviceId,
    )

    // In 2-way mode, only load the selected executor
    if (isTwoWay && executorType) {
      const actualPath =
        executorType === 'typescript' ? typescriptPath : wasmPath
      if (existsSync(actualPath)) {
        try {
          const actualLines = await readModularTraceDirectory(
            actualPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          if (executorType === 'typescript') {
            typescriptLines = actualLines
          } else {
            wasmLines = actualLines
          }
        } catch {
          console.log(
            `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} modular trace not found, skipping...${colors.reset}`,
          )
          if (executorType === 'typescript') {
            typescriptLines = []
          } else {
            wasmLines = []
          }
        }
      } else {
        if (executorType === 'typescript') {
          typescriptLines = []
        } else {
          wasmLines = []
        }
      }
    } else {
      // 3-way mode: load both TypeScript and WASM
      // For now, TypeScript and WASM traces in modular format would need to be generated
      // Fall back to text format if modular doesn't exist
      if (existsSync(typescriptPath)) {
        try {
          typescriptLines = await readModularTraceDirectory(
            typescriptPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
        } catch {
          console.log(
            `${colors.yellow}TypeScript modular trace not found, skipping...${colors.reset}`,
          )
          typescriptLines = []
        }
      } else {
        typescriptLines = []
      }

      if (existsSync(wasmPath)) {
        try {
          wasmLines = await readModularTraceDirectory(
            wasmPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
        } catch {
          console.log(
            `${colors.yellow}WASM modular trace not found, skipping...${colors.reset}`,
          )
          wasmLines = []
        }
      } else {
        wasmLines = []
      }
    }
  } else if (formatFlag === '--preimages-light') {
    // Preimages light format (uncompressed binary files in preimages_light directory)
    const timeslot = isTwoWay ? formatArgs[1] : args[1]
    const orderedIndex = isTwoWay
      ? formatArgs[2]
        ? Number.parseInt(formatArgs[2], 10)
        : undefined
      : args[2]
        ? Number.parseInt(args[2], 10)
        : undefined
    const serviceId = isTwoWay
      ? formatArgs[3]
        ? Number.parseInt(formatArgs[3], 10)
        : undefined
      : args[3]
        ? Number.parseInt(args[3], 10)
        : undefined

    if (!timeslot) {
      console.error(
        `${colors.red}Error: Timeslot required for --preimages-light format${colors.reset}`,
      )
      process.exit(1)
    }

    const testVectorsDir = join(
      workspaceRoot,
      'submodules',
      'jamduna',
      'jam-test-vectors',
      '0.7.2',
      'preimages_light',
    )

    expectedPath = testVectorsDir
    typescriptPath = join(
      workspaceRoot,
      'pvm-traces',
      'preimages_light',
      'modular',
    )
    wasmPath = join(
      workspaceRoot,
      'pvm-traces',
      'preimages_light',
      'modular-wasm',
    )

    comparisonLabel = `Preimages Light Timeslot ${timeslot}${orderedIndex !== undefined ? `, Index ${orderedIndex}` : ''}${serviceId !== undefined ? `, Service ${serviceId}` : ''}`

    console.log(
      `${colors.cyan}Reading preimages_light traces (accumulate format)...${colors.reset}`,
    )

    expectedLines = await readModularTraceDirectory(
      expectedPath,
      timeslot,
      orderedIndex,
      serviceId,
    )

    // In 2-way mode, only load the selected executor
    if (isTwoWay && executorType) {
      const actualPath =
        executorType === 'typescript' ? typescriptPath : wasmPath
      if (existsSync(actualPath)) {
        try {
          const actualLines = await readModularTraceDirectory(
            actualPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          if (executorType === 'typescript') {
            typescriptLines = actualLines
            typescriptPath = join(
              actualPath,
              timeslot.padStart(8, '0'),
              String(orderedIndex ?? 0),
              String(serviceId ?? 0),
            )
          } else {
            wasmLines = actualLines
            wasmPath = join(
              actualPath,
              timeslot.padStart(8, '0'),
              String(orderedIndex ?? 0),
              String(serviceId ?? 0),
            )
          }
        } catch {
          // Fall back to text format
          const textPath = join(
            workspaceRoot,
            'pvm-traces',
            'preimages_light',
            `${executorType}-${timeslot}.log`,
          )
          if (existsSync(textPath)) {
            console.log(
              `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} modular trace not found, using text format: ${textPath}${colors.reset}`,
            )
            const actualLines = parseTraceFile(textPath, false)
            if (executorType === 'typescript') {
              typescriptLines = actualLines
              typescriptPath = textPath
            } else {
              wasmLines = actualLines
              wasmPath = textPath
            }
          } else {
            console.log(
              `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            if (executorType === 'typescript') {
              typescriptLines = []
            } else {
              wasmLines = []
            }
          }
        }
      } else {
        // Try text format directly
        const textPath = join(
          workspaceRoot,
          'pvm-traces',
          'preimages_light',
          `${executorType}-${timeslot}.log`,
        )
        if (existsSync(textPath)) {
          console.log(
            `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} modular directory not found, using text format: ${textPath}${colors.reset}`,
          )
          const actualLines = parseTraceFile(textPath, false)
          if (executorType === 'typescript') {
            typescriptLines = actualLines
            typescriptPath = textPath
          } else {
            wasmLines = actualLines
            wasmPath = textPath
          }
        } else {
          if (executorType === 'typescript') {
            typescriptLines = []
          } else {
            wasmLines = []
          }
        }
      }
    } else {
      // 3-way mode: load both TypeScript and WASM
      // Try modular format first, then fall back to text format
      if (existsSync(typescriptPath)) {
        try {
          typescriptLines = await readModularTraceDirectory(
            typescriptPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          typescriptPath = join(
            typescriptPath,
            timeslot.padStart(8, '0'),
            String(orderedIndex ?? 0),
            String(serviceId ?? 0),
          )
        } catch {
          // Fall back to text format
          const textPath = join(
            workspaceRoot,
            'pvm-traces',
            'preimages_light',
            `typescript-${timeslot}.log`,
          )
          if (existsSync(textPath)) {
            console.log(
              `${colors.yellow}TypeScript modular trace not found, using text format: ${textPath}${colors.reset}`,
            )
            typescriptLines = parseTraceFile(textPath, false)
            typescriptPath = textPath
          } else {
            console.log(
              `${colors.yellow}TypeScript trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            typescriptLines = []
          }
        }
      } else {
        // Try text format directly
        const textPath = join(
          workspaceRoot,
          'pvm-traces',
          'preimages_light',
          `typescript-${timeslot}.log`,
        )
        if (existsSync(textPath)) {
          console.log(
            `${colors.yellow}TypeScript modular directory not found, using text format: ${textPath}${colors.reset}`,
          )
          typescriptLines = parseTraceFile(textPath, false)
          typescriptPath = textPath
        } else {
          typescriptLines = []
        }
      }

      if (existsSync(wasmPath)) {
        try {
          wasmLines = await readModularTraceDirectory(
            wasmPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          wasmPath = join(
            wasmPath,
            timeslot.padStart(8, '0'),
            String(orderedIndex ?? 0),
            String(serviceId ?? 0),
          )
        } catch {
          // Fall back to text format
          const textPath = join(
            workspaceRoot,
            'pvm-traces',
            'preimages_light',
            `wasm-${timeslot}.log`,
          )
          if (existsSync(textPath)) {
            console.log(
              `${colors.yellow}WASM modular trace not found, using text format: ${textPath}${colors.reset}`,
            )
            wasmLines = parseTraceFile(textPath, false)
            wasmPath = textPath
          } else {
            console.log(
              `${colors.yellow}WASM trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            wasmLines = []
          }
        }
      } else {
        // Try text format directly
        const textPath = join(
          workspaceRoot,
          'pvm-traces',
          'preimages_light',
          `wasm-${timeslot}.log`,
        )
        if (existsSync(textPath)) {
          console.log(
            `${colors.yellow}WASM modular directory not found, using text format: ${textPath}${colors.reset}`,
          )
          wasmLines = parseTraceFile(textPath, false)
          wasmPath = textPath
        } else {
          wasmLines = []
        }
      }
    }
  } else if (formatFlag === '--storage-light') {
    // Storage light format (uncompressed binary files in storage_light directory)
    const timeslot = isTwoWay ? formatArgs[1] : args[1]
    const orderedIndex = isTwoWay
      ? formatArgs[2]
        ? Number.parseInt(formatArgs[2], 10)
        : undefined
      : args[2]
        ? Number.parseInt(args[2], 10)
        : undefined
    const serviceId = isTwoWay
      ? formatArgs[3]
        ? Number.parseInt(formatArgs[3], 10)
        : undefined
      : args[3]
        ? Number.parseInt(args[3], 10)
        : undefined

    if (!timeslot) {
      console.error(
        `${colors.red}Error: Timeslot required for --storage-light format${colors.reset}`,
      )
      process.exit(1)
    }

    const testVectorsDir = join(
      workspaceRoot,
      'submodules',
      'jamduna',
      'jam-test-vectors',
      '0.7.2',
      'storage_light',
    )

    expectedPath = testVectorsDir
    typescriptPath = join(
      workspaceRoot,
      'pvm-traces',
      'storage_light',
      'modular',
    )
    wasmPath = join(
      workspaceRoot,
      'pvm-traces',
      'storage_light',
      'modular-wasm',
    )

    comparisonLabel = `Storage Light Timeslot ${timeslot}${orderedIndex !== undefined ? `, Index ${orderedIndex}` : ''}${serviceId !== undefined ? `, Service ${serviceId}` : ''}`

    console.log(
      `${colors.cyan}Reading storage_light traces (accumulate format)...${colors.reset}`,
    )

    expectedLines = await readModularTraceDirectory(
      expectedPath,
      timeslot,
      orderedIndex,
      serviceId,
    )

    // In 2-way mode, only load the selected executor
    if (isTwoWay && executorType) {
      const actualPath =
        executorType === 'typescript' ? typescriptPath : wasmPath
      if (existsSync(actualPath)) {
        try {
          const actualLines = await readModularTraceDirectory(
            actualPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          if (executorType === 'typescript') {
            typescriptLines = actualLines
            typescriptPath = join(
              actualPath,
              timeslot.padStart(8, '0'),
              String(orderedIndex ?? 0),
              String(serviceId ?? 0),
            )
          } else {
            wasmLines = actualLines
            wasmPath = join(
              actualPath,
              timeslot.padStart(8, '0'),
              String(orderedIndex ?? 0),
              String(serviceId ?? 0),
            )
          }
        } catch {
          // Fall back to text format
          const textPath = join(
            workspaceRoot,
            'pvm-traces',
            'storage_light',
            `${executorType}-${timeslot}.log`,
          )
          if (existsSync(textPath)) {
            console.log(
              `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} modular trace not found, using text format: ${textPath}${colors.reset}`,
            )
            const actualLines = parseTraceFile(textPath, false)
            if (executorType === 'typescript') {
              typescriptLines = actualLines
              typescriptPath = textPath
            } else {
              wasmLines = actualLines
              wasmPath = textPath
            }
          } else {
            console.log(
              `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            if (executorType === 'typescript') {
              typescriptLines = []
            } else {
              wasmLines = []
            }
          }
        }
      } else {
        // Try text format directly
        const textPath = join(
          workspaceRoot,
          'pvm-traces',
          'storage_light',
          `${executorType}-${timeslot}.log`,
        )
        if (existsSync(textPath)) {
          console.log(
            `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} modular directory not found, using text format: ${textPath}${colors.reset}`,
          )
          const actualLines = parseTraceFile(textPath, false)
          if (executorType === 'typescript') {
            typescriptLines = actualLines
            typescriptPath = textPath
          } else {
            wasmLines = actualLines
            wasmPath = textPath
          }
        } else {
          if (executorType === 'typescript') {
            typescriptLines = []
          } else {
            wasmLines = []
          }
        }
      }
    } else {
      // 3-way mode: load both TypeScript and WASM
      // Try modular format first, then fall back to text format
      if (existsSync(typescriptPath)) {
        try {
          typescriptLines = await readModularTraceDirectory(
            typescriptPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          typescriptPath = join(
            typescriptPath,
            timeslot.padStart(8, '0'),
            String(orderedIndex ?? 0),
            String(serviceId ?? 0),
          )
        } catch {
          // Fall back to text format
          const textPath = join(
            workspaceRoot,
            'pvm-traces',
            'storage_light',
            `typescript-${timeslot}.log`,
          )
          if (existsSync(textPath)) {
            console.log(
              `${colors.yellow}TypeScript modular trace not found, using text format: ${textPath}${colors.reset}`,
            )
            typescriptLines = parseTraceFile(textPath, false)
            typescriptPath = textPath
          } else {
            console.log(
              `${colors.yellow}TypeScript trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            typescriptLines = []
          }
        }
      } else {
        // Try text format directly
        const textPath = join(
          workspaceRoot,
          'pvm-traces',
          'storage_light',
          `typescript-${timeslot}.log`,
        )
        if (existsSync(textPath)) {
          console.log(
            `${colors.yellow}TypeScript modular directory not found, using text format: ${textPath}${colors.reset}`,
          )
          typescriptLines = parseTraceFile(textPath, false)
          typescriptPath = textPath
        } else {
          typescriptLines = []
        }
      }

      if (existsSync(wasmPath)) {
        try {
          wasmLines = await readModularTraceDirectory(
            wasmPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          wasmPath = join(
            wasmPath,
            timeslot.padStart(8, '0'),
            String(orderedIndex ?? 0),
            String(serviceId ?? 0),
          )
        } catch {
          // Fall back to text format
          const textPath = join(
            workspaceRoot,
            'pvm-traces',
            'storage_light',
            `wasm-${timeslot}.log`,
          )
          if (existsSync(textPath)) {
            console.log(
              `${colors.yellow}WASM modular trace not found, using text format: ${textPath}${colors.reset}`,
            )
            wasmLines = parseTraceFile(textPath, false)
            wasmPath = textPath
          } else {
            console.log(
              `${colors.yellow}WASM trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            wasmLines = []
          }
        }
      } else {
        // Try text format directly
        const textPath = join(
          workspaceRoot,
          'pvm-traces',
          'storage_light',
          `wasm-${timeslot}.log`,
        )
        if (existsSync(textPath)) {
          console.log(
            `${colors.yellow}WASM modular directory not found, using text format: ${textPath}${colors.reset}`,
          )
          wasmLines = parseTraceFile(textPath, false)
          wasmPath = textPath
        } else {
          wasmLines = []
        }
      }
    }
  } else if (formatFlag === '--preimages-all') {
    // Preimages format (uncompressed binary files in preimages directory)
    const timeslot = isTwoWay ? formatArgs[1] : args[1]
    const orderedIndex = isTwoWay
      ? formatArgs[2]
        ? Number.parseInt(formatArgs[2], 10)
        : undefined
      : args[2]
        ? Number.parseInt(args[2], 10)
        : undefined
    const serviceId = isTwoWay
      ? formatArgs[3]
        ? Number.parseInt(formatArgs[3], 10)
        : undefined
      : args[3]
        ? Number.parseInt(args[3], 10)
        : undefined

    if (!timeslot) {
      console.error(
        `${colors.red}Error: Timeslot required for --preimages-all format${colors.reset}`,
      )
      process.exit(1)
    }

    const testVectorsDir = join(
      workspaceRoot,
      'submodules',
      'jamduna',
      'jam-test-vectors',
      '0.7.2',
      'preimages',
    )

    expectedPath = testVectorsDir
    typescriptPath = join(workspaceRoot, 'pvm-traces', 'preimages', 'modular')
    wasmPath = join(workspaceRoot, 'pvm-traces', 'preimages', 'modular-wasm')

    comparisonLabel = `Preimages Timeslot ${timeslot}${orderedIndex !== undefined ? `, Index ${orderedIndex}` : ''}${serviceId !== undefined ? `, Service ${serviceId}` : ''}`

    console.log(
      `${colors.cyan}Reading preimages traces (accumulate format)...${colors.reset}`,
    )

    expectedLines = await readModularTraceDirectory(
      expectedPath,
      timeslot,
      orderedIndex,
      serviceId,
    )

    // In 2-way mode, only load the selected executor
    if (isTwoWay && executorType) {
      const actualPath =
        executorType === 'typescript' ? typescriptPath : wasmPath
      if (existsSync(actualPath)) {
        try {
          const actualLines = await readModularTraceDirectory(
            actualPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          if (executorType === 'typescript') {
            typescriptLines = actualLines
            typescriptPath = join(
              actualPath,
              timeslot.padStart(8, '0'),
              String(orderedIndex ?? 0),
              String(serviceId ?? 0),
            )
          } else {
            wasmLines = actualLines
            wasmPath = join(
              actualPath,
              timeslot.padStart(8, '0'),
              String(orderedIndex ?? 0),
              String(serviceId ?? 0),
            )
          }
        } catch {
          // Fall back to text format
          const textPath = join(
            workspaceRoot,
            'pvm-traces',
            'preimages',
            `${executorType}-${timeslot}.log`,
          )
          if (existsSync(textPath)) {
            console.log(
              `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} modular trace not found, using text format: ${textPath}${colors.reset}`,
            )
            const actualLines = parseTraceFile(textPath, false)
            if (executorType === 'typescript') {
              typescriptLines = actualLines
              typescriptPath = textPath
            } else {
              wasmLines = actualLines
              wasmPath = textPath
            }
          } else {
            console.log(
              `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            if (executorType === 'typescript') {
              typescriptLines = []
            } else {
              wasmLines = []
            }
          }
        }
      } else {
        // Try text format directly
        const textPath = join(
          workspaceRoot,
          'pvm-traces',
          'preimages',
          `${executorType}-${timeslot}.log`,
        )
        if (existsSync(textPath)) {
          console.log(
            `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} modular directory not found, using text format: ${textPath}${colors.reset}`,
          )
          const actualLines = parseTraceFile(textPath, false)
          if (executorType === 'typescript') {
            typescriptLines = actualLines
            typescriptPath = textPath
          } else {
            wasmLines = actualLines
            wasmPath = textPath
          }
        } else {
          if (executorType === 'typescript') {
            typescriptLines = []
          } else {
            wasmLines = []
          }
        }
      }
    } else {
      // 3-way mode: load both TypeScript and WASM
      // Try modular format first, then fall back to text format
      if (existsSync(typescriptPath)) {
        try {
          typescriptLines = await readModularTraceDirectory(
            typescriptPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          typescriptPath = join(
            typescriptPath,
            timeslot.padStart(8, '0'),
            String(orderedIndex ?? 0),
            String(serviceId ?? 0),
          )
        } catch {
          // Fall back to text format
          const textPath = join(
            workspaceRoot,
            'pvm-traces',
            'preimages',
            `typescript-${timeslot}.log`,
          )
          if (existsSync(textPath)) {
            console.log(
              `${colors.yellow}TypeScript modular trace not found, using text format: ${textPath}${colors.reset}`,
            )
            typescriptLines = parseTraceFile(textPath, false)
            typescriptPath = textPath
          } else {
            console.log(
              `${colors.yellow}TypeScript trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            typescriptLines = []
          }
        }
      } else {
        // Try text format directly
        const textPath = join(
          workspaceRoot,
          'pvm-traces',
          'preimages',
          `typescript-${timeslot}.log`,
        )
        if (existsSync(textPath)) {
          console.log(
            `${colors.yellow}TypeScript modular directory not found, using text format: ${textPath}${colors.reset}`,
          )
          typescriptLines = parseTraceFile(textPath, false)
          typescriptPath = textPath
        } else {
          typescriptLines = []
        }
      }

      if (existsSync(wasmPath)) {
        try {
          wasmLines = await readModularTraceDirectory(
            wasmPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          wasmPath = join(
            wasmPath,
            timeslot.padStart(8, '0'),
            String(orderedIndex ?? 0),
            String(serviceId ?? 0),
          )
        } catch {
          // Fall back to text format
          const textPath = join(
            workspaceRoot,
            'pvm-traces',
            'preimages',
            `wasm-${timeslot}.log`,
          )
          if (existsSync(textPath)) {
            console.log(
              `${colors.yellow}WASM modular trace not found, using text format: ${textPath}${colors.reset}`,
            )
            wasmLines = parseTraceFile(textPath, false)
            wasmPath = textPath
          } else {
            console.log(
              `${colors.yellow}WASM trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            wasmLines = []
          }
        }
      } else {
        // Try text format directly
        const textPath = join(
          workspaceRoot,
          'pvm-traces',
          'preimages',
          `wasm-${timeslot}.log`,
        )
        if (existsSync(textPath)) {
          console.log(
            `${colors.yellow}WASM modular directory not found, using text format: ${textPath}${colors.reset}`,
          )
          wasmLines = parseTraceFile(textPath, false)
          wasmPath = textPath
        } else {
          wasmLines = []
        }
      }
    }
  } else if (formatFlag === '--storage-all') {
    // Storage format (uncompressed binary files in storage directory)
    const timeslot = isTwoWay ? formatArgs[1] : args[1]
    const orderedIndex = isTwoWay
      ? formatArgs[2]
        ? Number.parseInt(formatArgs[2], 10)
        : undefined
      : args[2]
        ? Number.parseInt(args[2], 10)
        : undefined
    const serviceId = isTwoWay
      ? formatArgs[3]
        ? Number.parseInt(formatArgs[3], 10)
        : undefined
      : args[3]
        ? Number.parseInt(args[3], 10)
        : undefined

    if (!timeslot) {
      console.error(
        `${colors.red}Error: Timeslot required for --storage-all format${colors.reset}`,
      )
      process.exit(1)
    }

    const testVectorsDir = join(
      workspaceRoot,
      'submodules',
      'jamduna',
      'jam-test-vectors',
      '0.7.2',
      'storage',
    )

    expectedPath = testVectorsDir
    typescriptPath = join(workspaceRoot, 'pvm-traces', 'storage', 'modular')
    wasmPath = join(workspaceRoot, 'pvm-traces', 'storage', 'modular-wasm')

    comparisonLabel = `Storage Timeslot ${timeslot}${orderedIndex !== undefined ? `, Index ${orderedIndex}` : ''}${serviceId !== undefined ? `, Service ${serviceId}` : ''}`

    console.log(
      `${colors.cyan}Reading storage traces (accumulate format)...${colors.reset}`,
    )

    expectedLines = await readModularTraceDirectory(
      expectedPath,
      timeslot,
      orderedIndex,
      serviceId,
    )

    // In 2-way mode, only load the selected executor
    if (isTwoWay && executorType) {
      const actualPath =
        executorType === 'typescript' ? typescriptPath : wasmPath
      if (existsSync(actualPath)) {
        try {
          const actualLines = await readModularTraceDirectory(
            actualPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          if (executorType === 'typescript') {
            typescriptLines = actualLines
            typescriptPath = join(
              actualPath,
              timeslot.padStart(8, '0'),
              String(orderedIndex ?? 0),
              String(serviceId ?? 0),
            )
          } else {
            wasmLines = actualLines
            wasmPath = join(
              actualPath,
              timeslot.padStart(8, '0'),
              String(orderedIndex ?? 0),
              String(serviceId ?? 0),
            )
          }
        } catch {
          // Fall back to text format
          const textPath = join(
            workspaceRoot,
            'pvm-traces',
            'storage',
            `${executorType}-${timeslot}.log`,
          )
          if (existsSync(textPath)) {
            console.log(
              `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} modular trace not found, using text format: ${textPath}${colors.reset}`,
            )
            const actualLines = parseTraceFile(textPath, false)
            if (executorType === 'typescript') {
              typescriptLines = actualLines
              typescriptPath = textPath
            } else {
              wasmLines = actualLines
              wasmPath = textPath
            }
          } else {
            console.log(
              `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            if (executorType === 'typescript') {
              typescriptLines = []
            } else {
              wasmLines = []
            }
          }
        }
      } else {
        // Try text format directly
        const textPath = join(
          workspaceRoot,
          'pvm-traces',
          'storage',
          `${executorType}-${timeslot}.log`,
        )
        if (existsSync(textPath)) {
          console.log(
            `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} modular directory not found, using text format: ${textPath}${colors.reset}`,
          )
          const actualLines = parseTraceFile(textPath, false)
          if (executorType === 'typescript') {
            typescriptLines = actualLines
            typescriptPath = textPath
          } else {
            wasmLines = actualLines
            wasmPath = textPath
          }
        } else {
          if (executorType === 'typescript') {
            typescriptLines = []
          } else {
            wasmLines = []
          }
        }
      }
    } else {
      // 3-way mode: load both TypeScript and WASM
      // Try modular format first, then fall back to text format
      if (existsSync(typescriptPath)) {
        try {
          typescriptLines = await readModularTraceDirectory(
            typescriptPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          typescriptPath = join(
            typescriptPath,
            timeslot.padStart(8, '0'),
            String(orderedIndex ?? 0),
            String(serviceId ?? 0),
          )
        } catch {
          // Fall back to text format
          const textPath = join(
            workspaceRoot,
            'pvm-traces',
            'storage',
            `typescript-${timeslot}.log`,
          )
          if (existsSync(textPath)) {
            console.log(
              `${colors.yellow}TypeScript modular trace not found, using text format: ${textPath}${colors.reset}`,
            )
            typescriptLines = parseTraceFile(textPath, false)
            typescriptPath = textPath
          } else {
            console.log(
              `${colors.yellow}TypeScript trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            typescriptLines = []
          }
        }
      } else {
        // Try text format directly
        const textPath = join(
          workspaceRoot,
          'pvm-traces',
          'storage',
          `typescript-${timeslot}.log`,
        )
        if (existsSync(textPath)) {
          console.log(
            `${colors.yellow}TypeScript modular directory not found, using text format: ${textPath}${colors.reset}`,
          )
          typescriptLines = parseTraceFile(textPath, false)
          typescriptPath = textPath
        } else {
          typescriptLines = []
        }
      }

      if (existsSync(wasmPath)) {
        try {
          wasmLines = await readModularTraceDirectory(
            wasmPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          wasmPath = join(
            wasmPath,
            timeslot.padStart(8, '0'),
            String(orderedIndex ?? 0),
            String(serviceId ?? 0),
          )
        } catch {
          // Fall back to text format
          const textPath = join(
            workspaceRoot,
            'pvm-traces',
            'storage',
            `wasm-${timeslot}.log`,
          )
          if (existsSync(textPath)) {
            console.log(
              `${colors.yellow}WASM modular trace not found, using text format: ${textPath}${colors.reset}`,
            )
            wasmLines = parseTraceFile(textPath, false)
            wasmPath = textPath
          } else {
            console.log(
              `${colors.yellow}WASM trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            wasmLines = []
          }
        }
      } else {
        // Try text format directly
        const textPath = join(
          workspaceRoot,
          'pvm-traces',
          'storage',
          `wasm-${timeslot}.log`,
        )
        if (existsSync(textPath)) {
          console.log(
            `${colors.yellow}WASM modular directory not found, using text format: ${textPath}${colors.reset}`,
          )
          wasmLines = parseTraceFile(textPath, false)
          wasmPath = textPath
        } else {
          wasmLines = []
        }
      }
    }
  } else if (formatFlag === '--fuzzy') {
    // Fuzzy format (uncompressed binary files in fuzzy directory)
    const timeslot = isTwoWay ? formatArgs[1] : args[1]
    const orderedIndex = isTwoWay
      ? formatArgs[2]
        ? Number.parseInt(formatArgs[2], 10)
        : undefined
      : args[2]
        ? Number.parseInt(args[2], 10)
        : undefined
    const serviceId = isTwoWay
      ? formatArgs[3]
        ? Number.parseInt(formatArgs[3], 10)
        : undefined
      : args[3]
        ? Number.parseInt(args[3], 10)
        : undefined

    if (!timeslot) {
      console.error(
        `${colors.red}Error: Timeslot required for --fuzzy format${colors.reset}`,
      )
      process.exit(1)
    }

    const testVectorsDir = join(
      workspaceRoot,
      'submodules',
      'jamduna',
      'jam-test-vectors',
      '0.7.2',
      'fuzzy',
    )

    expectedPath = testVectorsDir
    typescriptPath = join(workspaceRoot, 'pvm-traces', 'fuzzy', 'modular')
    wasmPath = join(workspaceRoot, 'pvm-traces', 'fuzzy', 'modular-wasm')

    comparisonLabel = `Fuzzy Timeslot ${timeslot}${orderedIndex !== undefined ? `, Index ${orderedIndex}` : ''}${serviceId !== undefined ? `, Service ${serviceId}` : ''}`

    console.log(
      `${colors.cyan}Reading fuzzy traces (accumulate format)...${colors.reset}`,
    )

    expectedLines = await readModularTraceDirectory(
      expectedPath,
      timeslot,
      orderedIndex,
      serviceId,
    )

    // Set expected directory for output/err comparison
    modularExpectedDir = getModularTraceDir(
      expectedPath,
      timeslot,
      orderedIndex,
      serviceId,
    )

    // In 2-way mode, only load the selected executor
    if (isTwoWay && executorType) {
      const actualPath =
        executorType === 'typescript' ? typescriptPath : wasmPath
      if (existsSync(actualPath)) {
        try {
          const actualLines = await readModularTraceDirectory(
            actualPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          if (executorType === 'typescript') {
            typescriptLines = actualLines
            typescriptPath = join(
              actualPath,
              timeslot.padStart(8, '0'),
              String(orderedIndex ?? 0),
              String(serviceId ?? 0),
            )
            modularActualDir = typescriptPath
          } else {
            wasmLines = actualLines
            wasmPath = join(
              actualPath,
              timeslot.padStart(8, '0'),
              String(orderedIndex ?? 0),
              String(serviceId ?? 0),
            )
            modularActualDir = wasmPath
          }
        } catch {
          // Fall back to text format
          const textPath = join(
            workspaceRoot,
            'pvm-traces',
            'fuzzy',
            `${executorType}-${timeslot}.log`,
          )
          if (existsSync(textPath)) {
            console.log(
              `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} modular trace not found, using text format: ${textPath}${colors.reset}`,
            )
            const actualLines = parseTraceFile(textPath, false)
            if (executorType === 'typescript') {
              typescriptLines = actualLines
              typescriptPath = textPath
            } else {
              wasmLines = actualLines
              wasmPath = textPath
            }
          } else {
            console.log(
              `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            if (executorType === 'typescript') {
              typescriptLines = []
            } else {
              wasmLines = []
            }
          }
        }
      } else {
        // Try text format directly
        const textPath = join(
          workspaceRoot,
          'pvm-traces',
          'fuzzy',
          `${executorType}-${timeslot}.log`,
        )
        if (existsSync(textPath)) {
          console.log(
            `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} modular directory not found, using text format: ${textPath}${colors.reset}`,
          )
          const actualLines = parseTraceFile(textPath, false)
          if (executorType === 'typescript') {
            typescriptLines = actualLines
            typescriptPath = textPath
          } else {
            wasmLines = actualLines
            wasmPath = textPath
          }
        } else {
          if (executorType === 'typescript') {
            typescriptLines = []
          } else {
            wasmLines = []
          }
        }
      }
    } else {
      // 3-way mode: load both TypeScript and WASM
      // Try modular format first, then fall back to text format
      if (existsSync(typescriptPath)) {
        try {
          typescriptLines = await readModularTraceDirectory(
            typescriptPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          typescriptPath = join(
            typescriptPath,
            timeslot.padStart(8, '0'),
            String(orderedIndex ?? 0),
            String(serviceId ?? 0),
          )
        } catch {
          // Fall back to text format
          const textPath = join(
            workspaceRoot,
            'pvm-traces',
            'fuzzy',
            `typescript-${timeslot}.log`,
          )
          if (existsSync(textPath)) {
            console.log(
              `${colors.yellow}TypeScript modular trace not found, using text format: ${textPath}${colors.reset}`,
            )
            typescriptLines = parseTraceFile(textPath, false)
            typescriptPath = textPath
          } else {
            console.log(
              `${colors.yellow}TypeScript trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            typescriptLines = []
          }
        }
      } else {
        // Try text format directly
        const textPath = join(
          workspaceRoot,
          'pvm-traces',
          'fuzzy',
          `typescript-${timeslot}.log`,
        )
        if (existsSync(textPath)) {
          console.log(
            `${colors.yellow}TypeScript modular directory not found, using text format: ${textPath}${colors.reset}`,
          )
          typescriptLines = parseTraceFile(textPath, false)
          typescriptPath = textPath
        } else {
          typescriptLines = []
        }
      }

      if (existsSync(wasmPath)) {
        try {
          wasmLines = await readModularTraceDirectory(
            wasmPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          wasmPath = join(
            wasmPath,
            timeslot.padStart(8, '0'),
            String(orderedIndex ?? 0),
            String(serviceId ?? 0),
          )
        } catch {
          // Fall back to text format
          const textPath = join(
            workspaceRoot,
            'pvm-traces',
            'fuzzy',
            `wasm-${timeslot}.log`,
          )
          if (existsSync(textPath)) {
            console.log(
              `${colors.yellow}WASM modular trace not found, using text format: ${textPath}${colors.reset}`,
            )
            wasmLines = parseTraceFile(textPath, false)
            wasmPath = textPath
          } else {
            console.log(
              `${colors.yellow}WASM trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            wasmLines = []
          }
        }
      } else {
        // Try text format directly
        const textPath = join(
          workspaceRoot,
          'pvm-traces',
          'fuzzy',
          `wasm-${timeslot}.log`,
        )
        if (existsSync(textPath)) {
          console.log(
            `${colors.yellow}WASM modular directory not found, using text format: ${textPath}${colors.reset}`,
          )
          wasmLines = parseTraceFile(textPath, false)
          wasmPath = textPath
        } else {
          wasmLines = []
        }
      }
    }
  } else if (formatFlag === '--fuzzy-light') {
    // Fuzzy light format (uncompressed binary files in fuzzy_light directory)
    const timeslot = isTwoWay ? formatArgs[1] : args[1]
    const orderedIndex = isTwoWay
      ? formatArgs[2]
        ? Number.parseInt(formatArgs[2], 10)
        : undefined
      : args[2]
        ? Number.parseInt(args[2], 10)
        : undefined
    const serviceId = isTwoWay
      ? formatArgs[3]
        ? Number.parseInt(formatArgs[3], 10)
        : undefined
      : args[3]
        ? Number.parseInt(args[3], 10)
        : undefined

    if (!timeslot) {
      console.error(
        `${colors.red}Error: Timeslot required for --fuzzy-light format${colors.reset}`,
      )
      process.exit(1)
    }

    const testVectorsDir = join(
      workspaceRoot,
      'submodules',
      'jamduna',
      'jam-test-vectors',
      '0.7.2',
      'fuzzy_light',
    )

    expectedPath = testVectorsDir
    typescriptPath = join(workspaceRoot, 'pvm-traces', 'fuzzy_light', 'modular')
    wasmPath = join(workspaceRoot, 'pvm-traces', 'fuzzy_light', 'modular-wasm')

    comparisonLabel = `Fuzzy Light Timeslot ${timeslot}${orderedIndex !== undefined ? `, Index ${orderedIndex}` : ''}${serviceId !== undefined ? `, Service ${serviceId}` : ''}`

    console.log(
      `${colors.cyan}Reading fuzzy_light traces (accumulate format)...${colors.reset}`,
    )

    expectedLines = await readModularTraceDirectory(
      expectedPath,
      timeslot,
      orderedIndex,
      serviceId,
    )

    // Set expected directory for output/err comparison
    modularExpectedDir = getModularTraceDir(
      expectedPath,
      timeslot,
      orderedIndex,
      serviceId,
    )

    // In 2-way mode, only load the selected executor
    if (isTwoWay && executorType) {
      const actualPath =
        executorType === 'typescript' ? typescriptPath : wasmPath
      if (existsSync(actualPath)) {
        try {
          const actualLines = await readModularTraceDirectory(
            actualPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          if (executorType === 'typescript') {
            typescriptLines = actualLines
            typescriptPath = join(
              actualPath,
              timeslot.padStart(8, '0'),
              String(orderedIndex ?? 0),
              String(serviceId ?? 0),
            )
            modularActualDir = typescriptPath
          } else {
            wasmLines = actualLines
            wasmPath = join(
              actualPath,
              timeslot.padStart(8, '0'),
              String(orderedIndex ?? 0),
              String(serviceId ?? 0),
            )
            modularActualDir = wasmPath
          }
        } catch {
          // Fall back to text format
          const textPath = join(
            workspaceRoot,
            'pvm-traces',
            'fuzzy_light',
            `${executorType}-${timeslot}.log`,
          )
          if (existsSync(textPath)) {
            console.log(
              `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} modular trace not found, using text format: ${textPath}${colors.reset}`,
            )
            const actualLines = parseTraceFile(textPath, false)
            if (executorType === 'typescript') {
              typescriptLines = actualLines
              typescriptPath = textPath
            } else {
              wasmLines = actualLines
              wasmPath = textPath
            }
          } else {
            console.log(
              `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            if (executorType === 'typescript') {
              typescriptLines = []
            } else {
              wasmLines = []
            }
          }
        }
      } else {
        // Try text format directly
        const textPath = join(
          workspaceRoot,
          'pvm-traces',
          'fuzzy_light',
          `${executorType}-${timeslot}.log`,
        )
        if (existsSync(textPath)) {
          console.log(
            `${colors.yellow}${executorType === 'typescript' ? 'TypeScript' : 'WASM'} modular directory not found, using text format: ${textPath}${colors.reset}`,
          )
          const actualLines = parseTraceFile(textPath, false)
          if (executorType === 'typescript') {
            typescriptLines = actualLines
            typescriptPath = textPath
          } else {
            wasmLines = actualLines
            wasmPath = textPath
          }
        } else {
          if (executorType === 'typescript') {
            typescriptLines = []
          } else {
            wasmLines = []
          }
        }
      }
    } else {
      // 3-way mode: load both TypeScript and WASM
      // Try modular format first, then fall back to text format
      if (existsSync(typescriptPath)) {
        try {
          typescriptLines = await readModularTraceDirectory(
            typescriptPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          typescriptPath = join(
            typescriptPath,
            timeslot.padStart(8, '0'),
            String(orderedIndex ?? 0),
            String(serviceId ?? 0),
          )
        } catch {
          // Fall back to text format
          const textPath = join(
            workspaceRoot,
            'pvm-traces',
            'fuzzy_light',
            `typescript-${timeslot}.log`,
          )
          if (existsSync(textPath)) {
            console.log(
              `${colors.yellow}TypeScript modular trace not found, using text format: ${textPath}${colors.reset}`,
            )
            typescriptLines = parseTraceFile(textPath, false)
            typescriptPath = textPath
          } else {
            console.log(
              `${colors.yellow}TypeScript trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            typescriptLines = []
          }
        }
      } else {
        // Try text format directly
        const textPath = join(
          workspaceRoot,
          'pvm-traces',
          'fuzzy_light',
          `typescript-${timeslot}.log`,
        )
        if (existsSync(textPath)) {
          console.log(
            `${colors.yellow}TypeScript modular directory not found, using text format: ${textPath}${colors.reset}`,
          )
          typescriptLines = parseTraceFile(textPath, false)
          typescriptPath = textPath
        } else {
          typescriptLines = []
        }
      }

      if (existsSync(wasmPath)) {
        try {
          wasmLines = await readModularTraceDirectory(
            wasmPath,
            timeslot,
            orderedIndex,
            serviceId,
          )
          wasmPath = join(
            wasmPath,
            timeslot.padStart(8, '0'),
            String(orderedIndex ?? 0),
            String(serviceId ?? 0),
          )
        } catch {
          // Fall back to text format
          const textPath = join(
            workspaceRoot,
            'pvm-traces',
            'fuzzy_light',
            `wasm-${timeslot}.log`,
          )
          if (existsSync(textPath)) {
            console.log(
              `${colors.yellow}WASM modular trace not found, using text format: ${textPath}${colors.reset}`,
            )
            wasmLines = parseTraceFile(textPath, false)
            wasmPath = textPath
          } else {
            console.log(
              `${colors.yellow}WASM trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            wasmLines = []
          }
        }
      } else {
        // Try text format directly
        const textPath = join(
          workspaceRoot,
          'pvm-traces',
          'fuzzy_light',
          `wasm-${timeslot}.log`,
        )
        if (existsSync(textPath)) {
          console.log(
            `${colors.yellow}WASM modular directory not found, using text format: ${textPath}${colors.reset}`,
          )
          wasmLines = parseTraceFile(textPath, false)
          wasmPath = textPath
        } else {
          wasmLines = []
        }
      }
    }
  } else if (formatFlag === '--jam-conformance') {
    // Jam-conformance format
    // Structure: pvm-traces/jam-conformance/{version}/{trace_id}/{block_number}/typescript-{timeslot}-{ordered_index}-{service_id}.log
    // Expected: submodules/jamduna/jam-conformance/{version}/{trace_id}/{block_number}.log (or modular format)
    // Get version from environment variable, default to 0.7.2
    const jamConformanceVersion = process.env.JAM_CONFORMANCE_VERSION || '0.7.2'

    const traceId = isTwoWay ? formatArgs[1] : args[1]
    const blockNumber = isTwoWay ? formatArgs[2] : args[2]
    const timeslot = isTwoWay
      ? formatArgs[3]
        ? formatArgs[3]
        : undefined
      : args[3]
        ? args[3]
        : undefined
    const orderedIndex = isTwoWay
      ? formatArgs[4]
        ? Number.parseInt(formatArgs[4], 10)
        : undefined
      : args[4]
        ? Number.parseInt(args[4], 10)
        : undefined
    const serviceId = isTwoWay
      ? formatArgs[5]
        ? Number.parseInt(formatArgs[5], 10)
        : undefined
      : args[5]
        ? Number.parseInt(args[5], 10)
        : undefined

    if (!traceId || !blockNumber) {
      console.error(
        `${colors.red}Error: trace_id and block_number required for --jam-conformance format${colors.reset}`,
      )
      console.error(
        `${colors.yellow}Usage: --jam-conformance <trace_id> <block_number> [timeslot] [ordered_index] [service_id]${colors.reset}`,
      )
      console.error(
        `${colors.yellow}Version: Set JAM_CONFORMANCE_VERSION env var (default: 0.7.2)${colors.reset}`,
      )
      process.exit(1)
    }

    const expectedBaseDir = join(
      workspaceRoot,
      'submodules',
      'jamduna',
      'jam-conformance',
      jamConformanceVersion,
    )
    const ourBaseDir = join(
      workspaceRoot,
      'pvm-traces',
      'jam-conformance',
      jamConformanceVersion,
    )

    // Try to find expected trace (could be modular or text format)
    const expectedModularDir = timeslot
      ? join(
          expectedBaseDir,
          traceId,
          blockNumber,
          'modular',
          timeslot.padStart(8, '0'),
          String(orderedIndex ?? 0),
          String(serviceId ?? 0),
        )
      : undefined
    const expectedTextPath = join(
      expectedBaseDir,
      traceId,
      `${blockNumber}.log`,
    )

    // Our traces path
    const ourTraceDir = join(ourBaseDir, traceId, blockNumber)
    const ourModularDir = timeslot
      ? join(
          ourBaseDir,
          traceId,
          blockNumber,
          'modular',
          timeslot.padStart(8, '0'),
          String(orderedIndex ?? 0),
          String(serviceId ?? 0),
        )
      : undefined
    const ourTextPath = timeslot
      ? join(
          ourTraceDir,
          `typescript-${timeslot}-${orderedIndex ?? 0}-${serviceId ?? 0}.log`,
        )
      : undefined

    // Initialize paths
    typescriptPath = ourTextPath || ourModularDir || ''
    wasmPath = ''

    comparisonLabel = `Jam-Conformance ${jamConformanceVersion} ${traceId}/${blockNumber}${timeslot ? ` (timeslot ${timeslot}, index ${orderedIndex ?? 0}, service ${serviceId ?? 0})` : ''}`

    console.log(
      `${colors.cyan}Reading jam-conformance traces (version ${jamConformanceVersion})...${colors.reset}`,
    )

    // Try to load expected trace (prefer modular, fall back to text)
    if (expectedModularDir && existsSync(expectedModularDir)) {
      try {
        expectedLines = await readModularTraceDirectory(
          join(expectedBaseDir, traceId, blockNumber, 'modular'),
          timeslot,
          orderedIndex,
          serviceId,
        )
        expectedPath = expectedModularDir
        modularExpectedDir = expectedModularDir
      } catch (error) {
        console.log(
          `${colors.yellow}Expected modular trace not found, trying text format...${colors.reset}`,
        )
        if (existsSync(expectedTextPath)) {
          expectedLines = parseTraceFile(expectedTextPath, true)
          expectedPath = expectedTextPath
        } else {
          console.log(
            `${colors.yellow}Expected trace not found: ${expectedTextPath}${colors.reset}`,
          )
          expectedLines = []
          expectedPath = expectedTextPath
        }
      }
    } else if (existsSync(expectedTextPath)) {
      expectedLines = parseTraceFile(expectedTextPath, true)
      expectedPath = expectedTextPath
    } else {
      console.log(
        `${colors.yellow}Expected trace not found: ${expectedTextPath}${colors.reset}`,
      )
      expectedLines = []
      expectedPath = expectedTextPath
    }

    // In 2-way mode, only load the selected executor
    if (isTwoWay && executorType) {
      const wasmModularPath = timeslot
        ? join(
            ourBaseDir,
            traceId,
            blockNumber,
            'modular-wasm',
            timeslot.padStart(8, '0'),
            String(orderedIndex ?? 0),
            String(serviceId ?? 0),
          )
        : undefined
      const wasmTextPath = timeslot
        ? join(
            ourTraceDir,
            `wasm-${timeslot}-${orderedIndex ?? 0}-${serviceId ?? 0}.log`,
          )
        : undefined

      if (
        executorType === 'typescript' &&
        ourModularDir &&
        existsSync(ourModularDir)
      ) {
        try {
          const actualLines = await readModularTraceDirectory(
            join(ourBaseDir, traceId, blockNumber, 'modular'),
            timeslot,
            orderedIndex,
            serviceId,
          )
          typescriptLines = actualLines
          typescriptPath = ourModularDir
          modularActualDir = ourModularDir
        } catch {
          // Fall back to text format
          if (ourTextPath && existsSync(ourTextPath)) {
            console.log(
              `${colors.yellow}TypeScript modular trace not found, using text format: ${ourTextPath}${colors.reset}`,
            )
            const actualLines = parseTraceFile(ourTextPath, false)
            typescriptLines = actualLines
            typescriptPath = ourTextPath
          } else {
            console.log(
              `${colors.yellow}TypeScript trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            typescriptLines = []
          }
        }
      } else if (
        executorType === 'wasm' &&
        wasmModularPath &&
        existsSync(wasmModularPath)
      ) {
        try {
          const actualLines = await readModularTraceDirectory(
            join(ourBaseDir, traceId, blockNumber, 'modular-wasm'),
            timeslot,
            orderedIndex,
            serviceId,
          )
          wasmLines = actualLines
          wasmPath = wasmModularPath
          modularActualDir = wasmModularPath
        } catch {
          // Fall back to text format
          if (wasmTextPath && existsSync(wasmTextPath)) {
            console.log(
              `${colors.yellow}WASM modular trace not found, using text format: ${wasmTextPath}${colors.reset}`,
            )
            const actualLines = parseTraceFile(wasmTextPath, false)
            wasmLines = actualLines
            wasmPath = wasmTextPath
          } else {
            console.log(
              `${colors.yellow}WASM trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            wasmLines = []
          }
        }
      } else if (
        executorType === 'typescript' &&
        ourTextPath &&
        existsSync(ourTextPath)
      ) {
        console.log(
          `${colors.yellow}TypeScript modular directory not found, using text format: ${ourTextPath}${colors.reset}`,
        )
        const actualLines = parseTraceFile(ourTextPath, false)
        typescriptLines = actualLines
        typescriptPath = ourTextPath
      } else if (
        executorType === 'wasm' &&
        wasmTextPath &&
        existsSync(wasmTextPath)
      ) {
        console.log(
          `${colors.yellow}WASM modular directory not found, using text format: ${wasmTextPath}${colors.reset}`,
        )
        const actualLines = parseTraceFile(wasmTextPath, false)
        wasmLines = actualLines
        wasmPath = wasmTextPath
      } else {
        if (executorType === 'typescript') {
          typescriptLines = []
        } else {
          wasmLines = []
        }
      }
    } else {
      // 3-way mode: load both TypeScript and WASM
      // Try modular format first, then fall back to text format
      if (ourModularDir && existsSync(ourModularDir)) {
        try {
          typescriptLines = await readModularTraceDirectory(
            join(ourBaseDir, traceId, blockNumber, 'modular'),
            timeslot,
            orderedIndex,
            serviceId,
          )
          typescriptPath = ourModularDir
        } catch {
          // Fall back to text format
          if (ourTextPath && existsSync(ourTextPath)) {
            console.log(
              `${colors.yellow}TypeScript modular trace not found, using text format: ${ourTextPath}${colors.reset}`,
            )
            typescriptLines = parseTraceFile(ourTextPath, false)
            typescriptPath = ourTextPath
          } else {
            console.log(
              `${colors.yellow}TypeScript trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            typescriptLines = []
          }
        }
      } else if (ourTextPath && existsSync(ourTextPath)) {
        console.log(
          `${colors.yellow}TypeScript modular directory not found, using text format: ${ourTextPath}${colors.reset}`,
        )
        typescriptLines = parseTraceFile(ourTextPath, false)
        typescriptPath = ourTextPath
      } else {
        typescriptLines = []
      }

      const wasmModularDir = timeslot
        ? join(
            ourBaseDir,
            traceId,
            blockNumber,
            'modular-wasm',
            timeslot.padStart(8, '0'),
            String(orderedIndex ?? 0),
            String(serviceId ?? 0),
          )
        : undefined
      const wasmTextPath = timeslot
        ? join(
            ourTraceDir,
            `wasm-${timeslot}-${orderedIndex ?? 0}-${serviceId ?? 0}.log`,
          )
        : undefined

      if (wasmModularDir && existsSync(wasmModularDir)) {
        try {
          wasmLines = await readModularTraceDirectory(
            join(ourBaseDir, traceId, blockNumber, 'modular-wasm'),
            timeslot,
            orderedIndex,
            serviceId,
          )
          wasmPath = wasmModularDir
        } catch {
          // Fall back to text format
          if (wasmTextPath && existsSync(wasmTextPath)) {
            console.log(
              `${colors.yellow}WASM modular trace not found, using text format: ${wasmTextPath}${colors.reset}`,
            )
            wasmLines = parseTraceFile(wasmTextPath, false)
            wasmPath = wasmTextPath
          } else {
            console.log(
              `${colors.yellow}WASM trace not found (tried modular and text format), skipping...${colors.reset}`,
            )
            wasmLines = []
          }
        }
      } else if (wasmTextPath && existsSync(wasmTextPath)) {
        console.log(
          `${colors.yellow}WASM modular directory not found, using text format: ${wasmTextPath}${colors.reset}`,
        )
        wasmLines = parseTraceFile(wasmTextPath, false)
        wasmPath = wasmTextPath
      } else {
        wasmLines = []
      }
    }
  } else if (formatFlag === '--accumulate-stf') {
    // Accumulate STF test vector format
    // Usage: --accumulate-stf <config> <test_vector_name> <slot> <service_id>
    // Example: --accumulate-stf full transfer_for_ejected_service-1 19211 0
    const config = isTwoWay ? formatArgs[1] : args[1]
    const testVectorName = isTwoWay ? formatArgs[2] : args[2]
    const slot = isTwoWay ? formatArgs[3] : args[3]
    const serviceId = isTwoWay ? formatArgs[4] : args[4]

    if (!config || !testVectorName || !slot || !serviceId) {
      console.error(
        `${colors.red}Error: --accumulate-stf requires <config> <test_vector_name> <slot> <service_id>${colors.reset}`,
      )
      console.error(
        `${colors.yellow}Example: --accumulate-stf full transfer_for_ejected_service-1 19211 0${colors.reset}`,
      )
      process.exit(1)
    }

    const traceDir = join(
      workspaceRoot,
      'pvm-traces',
      'accumulate-stf',
      config,
      testVectorName,
    )

    if (!existsSync(traceDir)) {
      console.error(
        `${colors.red}Error: Trace directory not found: ${traceDir}${colors.reset}`,
      )
      process.exit(1)
    }

    typescriptPath = join(traceDir, `typescript-${slot}-${serviceId}.log`)
    wasmPath = join(traceDir, `wasm-${slot}-${serviceId}.log`)
    comparisonLabel = `Accumulate STF: ${config}/${testVectorName} slot=${slot} service=${serviceId}`

    console.log(
      `${colors.cyan}Comparing accumulate-stf traces (TypeScript vs WASM)...${colors.reset}`,
    )
    console.log(`  ${colors.dim}TypeScript: ${typescriptPath}${colors.reset}`)
    console.log(`  ${colors.dim}WASM: ${wasmPath}${colors.reset}`)

    // For accumulate-stf, we don't have expected traces (from jamduna)
    // So we'll do a TypeScript vs WASM comparison (2-way without expected)
    expectedLines = []
    expectedPath = ''

    if (existsSync(typescriptPath)) {
      typescriptLines = parseTraceFile(typescriptPath, false)
      console.log(
        `  ${colors.green}TypeScript trace: ${typescriptLines.length} lines${colors.reset}`,
      )
    } else {
      console.log(
        `${colors.yellow}TypeScript trace not found: ${typescriptPath}${colors.reset}`,
      )
      typescriptLines = []
    }

    if (existsSync(wasmPath)) {
      wasmLines = parseTraceFile(wasmPath, false)
      console.log(
        `  ${colors.green}WASM trace: ${wasmLines.length} lines${colors.reset}`,
      )
    } else {
      console.log(
        `${colors.yellow}WASM trace not found: ${wasmPath}${colors.reset}`,
      )
      wasmLines = []
    }

    // Special handling: compare TypeScript vs WASM directly
    if (typescriptLines.length > 0 && wasmLines.length > 0) {
      const result = compareTwoTraces(typescriptLines, wasmLines)
      printTwoWayComparisonTsVsWasm(
        comparisonLabel,
        typescriptPath,
        wasmPath,
        result,
      )
      return
    } else if (typescriptLines.length === 0 && wasmLines.length === 0) {
      console.error(
        `${colors.red}Error: Both traces are empty or not found${colors.reset}`,
      )
      process.exit(1)
    } else {
      // One trace exists, show summary
      const availableLines =
        typescriptLines.length > 0 ? typescriptLines : wasmLines
      const availablePath =
        typescriptLines.length > 0 ? typescriptPath : wasmPath
      const executorName = typescriptLines.length > 0 ? 'TypeScript' : 'WASM'
      console.log(
        `\n${colors.bold}${executorName} Trace Summary (${availableLines.length} lines):${colors.reset}`,
      )
      console.log(`  Path: ${availablePath}`)
      const instructions = availableLines.filter(
        (l) => l.type === 'instruction',
      )
      const hostCalls = availableLines.filter((l) => l.type === 'host_function')
      console.log(`  Instructions: ${instructions.length}`)
      console.log(`  Host calls: ${hostCalls.length}`)
      if (instructions.length > 0) {
        const lastInstr = instructions[instructions.length - 1]
        console.log(
          `  Last instruction: ${lastInstr?.instruction} at PC ${lastInstr?.pc} (step ${lastInstr?.step})`,
        )
        console.log(`  Final gas: ${lastInstr?.gas}`)
      }
      return
    }
  } else if (args[0] === '--modular-refine') {
    // Modular refine format
    const workPackageHash = args[1]
    const workItemIndex = args[2] ? Number.parseInt(args[2], 10) : undefined
    const serviceId = args[3] ? Number.parseInt(args[3], 10) : undefined
    const childSlot = args[4] ? Number.parseInt(args[4], 10) : undefined
    const childInstance = args[5] ? Number.parseInt(args[5], 10) : undefined

    if (!workPackageHash) {
      console.error(
        `${colors.red}Error: Work package hash required for --modular-refine format${colors.reset}`,
      )
      process.exit(1)
    }

    const testVectorsDir = join(
      workspaceRoot,
      'submodules',
      'jamduna',
      'jam-test-vectors',
      '0.7.2',
      'storage',
    )

    expectedPath = testVectorsDir
    typescriptPath = join(workspaceRoot, 'pvm-traces', 'modular-refine')
    wasmPath = join(workspaceRoot, 'pvm-traces', 'modular-refine-wasm')

    comparisonLabel = `Work Package ${workPackageHash.substring(0, 16)}...`

    console.log(
      `${colors.cyan}Reading modular traces (refine format)...${colors.reset}`,
    )

    expectedLines = await readModularRefineTraceDirectory(
      expectedPath,
      workPackageHash,
      workItemIndex,
      serviceId,
      childSlot,
      childInstance,
    )

    if (existsSync(typescriptPath)) {
      try {
        typescriptLines = await readModularRefineTraceDirectory(
          typescriptPath,
          workPackageHash,
          workItemIndex,
          serviceId,
          childSlot,
          childInstance,
        )
      } catch {
        console.log(
          `${colors.yellow}TypeScript modular trace not found, skipping...${colors.reset}`,
        )
        typescriptLines = []
      }
    } else {
      typescriptLines = []
    }

    if (existsSync(wasmPath)) {
      try {
        wasmLines = await readModularRefineTraceDirectory(
          wasmPath,
          workPackageHash,
          workItemIndex,
          serviceId,
          childSlot,
          childInstance,
        )
      } catch {
        console.log(
          `${colors.yellow}WASM modular trace not found, skipping...${colors.reset}`,
        )
        wasmLines = []
      }
    } else {
      wasmLines = []
    }
  } else {
    // Legacy text format
    const blockNumberArg = isTwoWay ? formatArgs[0] : args[0]
    const blockNumber = Number.parseInt(blockNumberArg, 10)

    if (Number.isNaN(blockNumber)) {
      console.error(
        `${colors.red}Error: Invalid block number: ${blockNumberArg}${colors.reset}`,
      )
      process.exit(1)
    }

    expectedPath = join(
      workspaceRoot,
      'pvm-expected',
      `expected-${blockNumber}.log`,
    )
    typescriptPath = join(
      workspaceRoot,
      'pvm-traces',
      `typescript-${blockNumber}.log`,
    )
    wasmPath = join(workspaceRoot, 'pvm-traces', `wasm-${blockNumber}.log`)
    comparisonLabel = `Block ${blockNumber}`

    if (!existsSync(expectedPath)) {
      console.error(
        `${colors.red}Error: Expected trace not found: ${expectedPath}${colors.reset}`,
      )
      process.exit(1)
    }

    // In 2-way mode, only check and load the selected executor
    if (isTwoWay && executorType) {
      const actualPath =
        executorType === 'typescript' ? typescriptPath : wasmPath
      if (!existsSync(actualPath)) {
        console.error(
          `${colors.red}Error: ${executorType === 'typescript' ? 'TypeScript' : 'WASM'} trace not found: ${actualPath}${colors.reset}`,
        )
        process.exit(1)
      }

      // Parse traces
      expectedLines = parseTraceFile(expectedPath, true)
      const actualLines = parseTraceFile(actualPath, false)
      if (executorType === 'typescript') {
        typescriptLines = actualLines
      } else {
        wasmLines = actualLines
      }
    } else {
      // 3-way mode: check and load both
      if (!existsSync(typescriptPath)) {
        console.error(
          `${colors.red}Error: TypeScript trace not found: ${typescriptPath}${colors.reset}`,
        )
        process.exit(1)
      }

      if (!existsSync(wasmPath)) {
        console.error(
          `${colors.red}Error: WASM trace not found: ${wasmPath}${colors.reset}`,
        )
        process.exit(1)
      }

      // Parse traces
      expectedLines = parseTraceFile(expectedPath, true)
      typescriptLines = parseTraceFile(typescriptPath, false)
      wasmLines = parseTraceFile(wasmPath, false)
    }
  }

  // Compare and print results
  if (isTwoWay && executorType) {
    // 2-way comparison
    const actualLines =
      executorType === 'typescript' ? typescriptLines : wasmLines
    const actualPath = executorType === 'typescript' ? typescriptPath : wasmPath
    const result = compareTwoTraces(expectedLines, actualLines)

    // Extract directories for output/err comparison
    // For modular format, we use the tracked directories or check if paths are directories
    let expectedDir: string | undefined = modularExpectedDir
    let actualDir: string | undefined = modularActualDir

    // If not set, check if paths themselves are directories (fallback)
    if (
      !expectedDir &&
      existsSync(expectedPath) &&
      statSync(expectedPath).isDirectory()
    ) {
      expectedDir = expectedPath
    }
    if (
      !actualDir &&
      existsSync(actualPath) &&
      statSync(actualPath).isDirectory()
    ) {
      actualDir = actualPath
    }

    printTwoWayComparison(
      comparisonLabel,
      expectedPath,
      actualPath,
      executorType,
      result,
      expectedDir,
      actualDir,
    )
  } else {
    // 3-way comparison
    const result = compareThreeTraces(expectedLines, typescriptLines, wasmLines)
    printComparison(
      comparisonLabel,
      expectedPath,
      typescriptPath,
      wasmPath,
      result,
    )
  }
}

main()
