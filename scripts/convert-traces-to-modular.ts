#!/usr/bin/env bun
/**
 * Convert text format PVM traces to JIP-6 modular binary format
 *
 * Converts all text format traces (typescript-{timeslot}.log, wasm-{timeslot}.log)
 * in the pvm-traces folder to the binary modular format used by jamduna for JIP-6 traces.
 *
 * Usage:
 *   bun scripts/convert-traces-to-modular.ts [--compress] [--folder <subfolder>]
 *
 * Options:
 *   --compress         Compress output files with gzip
 *   --folder <name>    Only convert traces in the specified subfolder (e.g., fuzzy_light)
 *
 * The script automatically discovers and converts all trace files in pvm-traces/
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { OPCODES } from '@pbnjam/pvm'

// Create opcode mapping from instruction names to opcodes from OPCODES
const OPCODE_MAP: Record<string, number> = {}
for (const [name, opcode] of Object.entries(OPCODES)) {
  OPCODE_MAP[name] = Number(opcode)
}

function getOpcode(instructionName: string): number {
  const opcode = OPCODE_MAP[instructionName]
  if (opcode === undefined) {
    console.warn(`Unknown instruction: ${instructionName}, using 0 (TRAP)`)
    return 0 // TRAP opcode
  }
  return opcode
}

// Write little-endian uint8
function writeUint8(buffer: Buffer, offset: number, value: number): void {
  buffer.writeUInt8(value, offset)
}

// Write little-endian uint64
function writeUint64(buffer: Buffer, offset: number, value: bigint): void {
  buffer.writeBigUInt64LE(value, offset)
}

// Write little-endian uint32
function writeUint32(buffer: Buffer, offset: number, value: number): void {
  buffer.writeUInt32LE(value, offset)
}

interface TraceLine {
  step: number
  pc: bigint
  opcode: number
  gas: bigint
  registers: bigint[]
  loadAddress?: number
  loadValue?: bigint
  storeAddress?: number
  storeValue?: bigint
}

function parseTraceLine(line: string, lineNumber: number): TraceLine | null {
  const trimmed = line.trim()
  if (!trimmed) {
    return null
  }

  // Skip host function calls (they're metadata, not instructions)
  if (trimmed.startsWith('Calling host function:')) {
    return null
  }

  // Parse instruction line: "INSTRUCTION STEP PC Gas: GAS Registers:[r0, r1, ...]"
  const match = trimmed.match(/^(\w+) (\d+) (\d+) Gas: (\d+) Registers:\[([^\]]+)\]/)
  if (!match) {
    console.warn(`Failed to parse line ${lineNumber}: ${trimmed}`)
    return null
  }

  const instructionName = match[1]!
  const step = Number.parseInt(match[2]!, 10)
  const pc = BigInt(match[3]!)
  const gas = BigInt(match[4]!)
  const registersStr = match[5]!

  // Parse registers (comma-separated)
  const registers = registersStr
    .split(',')
    .map((r) => r.trim())
    .map((r) => BigInt(r))

  // Ensure we have 13 registers (r0-r12)
  while (registers.length < 13) {
    registers.push(0n)
  }

  const opcode = getOpcode(instructionName)

  // TODO: Extract loads/stores from instruction if available
  // For now, we'll set them to 0 (no load/store occurred)
  // This would need to be enhanced based on your trace format

  return {
    step,
    pc,
    opcode,
    gas,
    registers,
  }
}

function convertTraceToModular(
  inputFile: string,
  outputDir: string,
  compress = false,
  accumulateInputPath?: string,
): void {
  if (!existsSync(inputFile)) {
    throw new Error(`Input file not found: ${inputFile}`)
  }

  console.log(`Reading trace from: ${inputFile}`)

  const content = readFileSync(inputFile, 'utf-8')
  const lines = content.split('\n')

  const traceLines: TraceLine[] = []
  for (let i = 0; i < lines.length; i++) {
    const parsed = parseTraceLine(lines[i]!, i + 1)
    if (parsed) {
      traceLines.push(parsed)
    }
  }

  console.log(`Parsed ${traceLines.length} instruction lines`)

  if (traceLines.length === 0) {
    throw new Error('No trace lines found in input file')
  }

  // Create output directory
  mkdirSync(outputDir, { recursive: true })

  // Allocate buffers for each stream
  const numSteps = traceLines.length
  const opcodeBuffer = Buffer.alloc(numSteps)
  const pcBuffer = Buffer.alloc(numSteps * 8)
  const gasBuffer = Buffer.alloc(numSteps * 8)
  const registerBuffers: Buffer[] = []
  for (let i = 0; i <= 12; i++) {
    registerBuffers.push(Buffer.alloc(numSteps * 8))
  }
  const loadsBuffer = Buffer.alloc(numSteps * 12) // uint32 address + uint64 value
  const storesBuffer = Buffer.alloc(numSteps * 12) // uint32 address + uint64 value

  // Write data to buffers
  for (let step = 0; step < numSteps; step++) {
    const trace = traceLines[step]!
    writeUint8(opcodeBuffer, step, trace.opcode)
    writeUint64(pcBuffer, step * 8, trace.pc)
    writeUint64(gasBuffer, step * 8, trace.gas)

    // Write registers
    for (let r = 0; r <= 12; r++) {
      const regValue = trace.registers[r] ?? 0n
      writeUint64(registerBuffers[r]!, step * 8, regValue)
    }

    // Write loads (address + value, 0 if no load)
    const loadAddr = trace.loadAddress ?? 0
    const loadVal = trace.loadValue ?? 0n
    writeUint32(loadsBuffer, step * 12, loadAddr)
    writeUint64(loadsBuffer, step * 12 + 4, loadVal)

    // Write stores (address + value, 0 if no store)
    const storeAddr = trace.storeAddress ?? 0
    const storeVal = trace.storeValue ?? 0n
    writeUint32(storesBuffer, step * 12, storeAddr)
    writeUint64(storesBuffer, step * 12 + 4, storeVal)
  }

  // Write files
  const writeStream = (filename: string, buffer: Buffer) => {
    const filepath = join(outputDir, filename)
    if (compress) {
      const compressed = gzipSync(buffer)
      writeFileSync(filepath, compressed)
      console.log(`  Wrote ${filename} (${compressed.length} bytes compressed, ${buffer.length} bytes uncompressed)`)
    } else {
      writeFileSync(filepath, buffer)
      console.log(`  Wrote ${filename} (${buffer.length} bytes)`)
    }
  }

  writeStream('opcode' + (compress ? '.gz' : ''), opcodeBuffer)
  writeStream('pc' + (compress ? '.gz' : ''), pcBuffer)
  writeStream('gas' + (compress ? '.gz' : ''), gasBuffer)
  for (let i = 0; i <= 12; i++) {
    writeStream(`r${i}` + (compress ? '.gz' : ''), registerBuffers[i]!)
  }
  writeStream('loads' + (compress ? '.gz' : ''), loadsBuffer)
  writeStream('stores' + (compress ? '.gz' : ''), storesBuffer)

  // Copy accumulate_input file if provided
  // This matches the jamduna format where accumulate_input is in the same directory
  if (accumulateInputPath && existsSync(accumulateInputPath)) {
    const accumulateInputOutputPath = join(outputDir, 'accumulate_input')
    copyFileSync(accumulateInputPath, accumulateInputOutputPath)
    const stats = readFileSync(accumulateInputPath)
    console.log(`  Copied accumulate_input (${stats.length} bytes)`)
  }

  console.log(`\nSuccessfully converted trace to modular format in: ${outputDir}`)
}

interface TraceFile {
  filename: string
  filepath: string
  executorType: 'typescript' | 'wasm'
  timeslot: string
  serviceId: string
  orderedIndex: number // Computed based on order within timeslot
  subfolder?: string
  accumulateInputPath?: string // Path to the accumulate_input binary file if present
}

function discoverTraceFiles(tracesDir: string, subfolder?: string): TraceFile[] {
  if (!existsSync(tracesDir)) {
    console.warn(`Traces directory not found: ${tracesDir}`)
    return []
  }

  // Temporary structure to collect files before computing orderedIndex
  interface RawTraceFile {
    filename: string
    filepath: string
    executorType: 'typescript' | 'wasm'
    timeslot: string
    serviceId: string
    invocationIndex?: number // Parsed from new filename format (if present)
    subfolder?: string
    accumulateInputPath?: string
  }

  const rawTraceFiles: RawTraceFile[] = []

  // Recursively search for trace files
  function searchDirectory(dir: string, currentSubfolder?: string): void {
    const entries = readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        // Recursively search subdirectories (but skip modular output directories)
        if (!entry.name.startsWith('modular')) {
          const newSubfolder = currentSubfolder
            ? join(currentSubfolder, entry.name)
            : entry.name
          searchDirectory(fullPath, newSubfolder)
        }
      } else if (entry.isFile()) {
        // Match patterns (jamduna-compatible format):
        // - typescript-{timeslot}-{invocationIndex}-{serviceId}.log (e.g., typescript-118-0-1985398916.log)
        // - wasm-{timeslot}-{invocationIndex}-{serviceId}.log
        // - typescript-{timeslot}-{serviceId}.log (legacy format, invocationIndex defaults to 0)
        // - wasm-{timeslot}-{serviceId}.log (legacy format, invocationIndex defaults to 0)
        // - typescript-{timeslot}.log (legacy format, serviceId and invocationIndex default to 0)
        // - wasm-{timeslot}.log (legacy format, serviceId and invocationIndex default to 0)
        const tsMatch = entry.name.match(/^typescript-(\d+)(?:-(\d+)(?:-(\d+))?)?\.log$/)
        const wasmMatch = entry.name.match(/^wasm-(\d+)(?:-(\d+)(?:-(\d+))?)?\.log$/)

        if (tsMatch) {
          const timeslot = tsMatch[1]!
          // New format: typescript-{timeslot}-{invocationIndex}-{serviceId}.log
          // Legacy format 1: typescript-{timeslot}-{serviceId}.log (invocationIndex defaults to computed)
          // Legacy format 2: typescript-{timeslot}.log (both default to 0)
          let invocationIndex: number | undefined
          let serviceId: string
          if (tsMatch[3] !== undefined) {
            // New format: group 2 = invocationIndex, group 3 = serviceId
            invocationIndex = Number.parseInt(tsMatch[2]!, 10)
            serviceId = tsMatch[3]
          } else {
            // Legacy format: group 2 = serviceId (or undefined)
            invocationIndex = undefined
            serviceId = tsMatch[2] ?? '0'
          }
          // Check for accompanying accumulate_input file
          // Pattern: typescript-{timeslot}-{invocationIndex}-{serviceId}-accumulate_input.bin or legacy
          const accumulateInputFilename = invocationIndex !== undefined
            ? `typescript-${timeslot}-${invocationIndex}-${serviceId}-accumulate_input.bin`
            : `typescript-${timeslot}-${serviceId}-accumulate_input.bin`
          const accumulateInputPath = join(dir, accumulateInputFilename)
          
          rawTraceFiles.push({
            filename: entry.name,
            filepath: fullPath,
            executorType: 'typescript',
            timeslot,
            serviceId,
            invocationIndex,
            subfolder: currentSubfolder,
            accumulateInputPath: existsSync(accumulateInputPath) ? accumulateInputPath : undefined,
          })
        } else if (wasmMatch) {
          const timeslot = wasmMatch[1]!
          let invocationIndex: number | undefined
          let serviceId: string
          if (wasmMatch[3] !== undefined) {
            invocationIndex = Number.parseInt(wasmMatch[2]!, 10)
            serviceId = wasmMatch[3]
          } else {
            invocationIndex = undefined
            serviceId = wasmMatch[2] ?? '0'
          }
          // Check for accompanying accumulate_input file
          const accumulateInputFilename = invocationIndex !== undefined
            ? `wasm-${timeslot}-${invocationIndex}-${serviceId}-accumulate_input.bin`
            : `wasm-${timeslot}-${serviceId}-accumulate_input.bin`
          const accumulateInputPath = join(dir, accumulateInputFilename)
          
          rawTraceFiles.push({
            filename: entry.name,
            filepath: fullPath,
            executorType: 'wasm',
            timeslot,
            serviceId,
            invocationIndex,
            subfolder: currentSubfolder,
            accumulateInputPath: existsSync(accumulateInputPath) ? accumulateInputPath : undefined,
          })
        }
      }
    }
  }

  // Start recursive search
  searchDirectory(tracesDir, subfolder)

  // Sort by subfolder, then timeslot, then invocationIndex (if present), then serviceId, then executor type
  rawTraceFiles.sort((a, b) => {
    const subfolderCompare = (a.subfolder || '').localeCompare(b.subfolder || '')
    if (subfolderCompare !== 0) return subfolderCompare
    const timeslotDiff = Number.parseInt(a.timeslot, 10) - Number.parseInt(b.timeslot, 10)
    if (timeslotDiff !== 0) return timeslotDiff
    // Sort by invocationIndex first (if present in both)
    const aInvIdx = a.invocationIndex ?? Number.MAX_SAFE_INTEGER
    const bInvIdx = b.invocationIndex ?? Number.MAX_SAFE_INTEGER
    const invIdxDiff = aInvIdx - bInvIdx
    if (invIdxDiff !== 0) return invIdxDiff
    // Then by serviceId numerically to establish consistent ordering
    const serviceIdDiff = Number.parseInt(a.serviceId, 10) - Number.parseInt(b.serviceId, 10)
    if (serviceIdDiff !== 0) return serviceIdDiff
    return a.executorType.localeCompare(b.executorType)
  })

  // Use parsed invocationIndex if available, otherwise compute based on position
  // jamduna structure: {timeslot}/{ordered_index}/{service_id}/
  // ordered_index is the invocation order within a timeslot (0, 1, 2, ...)
  const traceFiles: TraceFile[] = []
  const orderCounters = new Map<string, number>() // Key: "subfolder|timeslot|executorType" (for legacy files without invocationIndex)

  for (const raw of rawTraceFiles) {
    // If the file has a parsed invocationIndex, use it directly
    // Otherwise, compute based on position within the group (legacy behavior)
    let orderedIndex: number
    if (raw.invocationIndex !== undefined) {
      orderedIndex = raw.invocationIndex
    } else {
      const groupKey = `${raw.subfolder ?? ''}|${raw.timeslot}|${raw.executorType}`
      orderedIndex = orderCounters.get(groupKey) ?? 0
      orderCounters.set(groupKey, orderedIndex + 1)
    }

    traceFiles.push({
      filename: raw.filename,
      filepath: raw.filepath,
      executorType: raw.executorType,
      timeslot: raw.timeslot,
      serviceId: raw.serviceId,
      orderedIndex,
      subfolder: raw.subfolder,
      accumulateInputPath: raw.accumulateInputPath,
    })
  }

  return traceFiles
}

async function main() {
  const args = process.argv.slice(2)
  const compress = args.includes('--compress')
  
  // Parse --folder argument
  let targetFolder: string | undefined
  const folderIndex = args.indexOf('--folder')
  if (folderIndex !== -1 && args[folderIndex + 1]) {
    targetFolder = args[folderIndex + 1]
  }

  const workspaceRoot = join(__dirname, '..')
  const tracesDir = join(workspaceRoot, 'pvm-traces')

  console.log('='.repeat(60))
  console.log('PVM Trace Converter - Text to JIP-6 Modular Binary Format')
  console.log('='.repeat(60))
  console.log()
  console.log(`Traces directory: ${tracesDir}`)
  console.log(`Compression: ${compress ? 'enabled' : 'disabled'}`)
  if (targetFolder) {
    console.log(`Target folder: ${targetFolder}`)
  }
  console.log()

  // Discover trace files (optionally filtered by folder)
  let traceFiles = discoverTraceFiles(tracesDir)
  
  // Filter by target folder if specified
  if (targetFolder) {
    traceFiles = traceFiles.filter(tf => 
      tf.subfolder === targetFolder || tf.subfolder?.startsWith(targetFolder + '/')
    )
  }

  if (traceFiles.length === 0) {
    console.log('No trace files found in pvm-traces/')
    console.log('Expected files matching: typescript-{timeslot}.log or wasm-{timeslot}.log')
    console.log('Searches recursively in all subfolders (except modular output directories)')
    return
  }

  console.log(`Found ${traceFiles.length} trace file(s):`)
  for (const tf of traceFiles) {
    const subfolderInfo = tf.subfolder ? ` (subfolder: ${tf.subfolder})` : ''
    const accInputInfo = tf.accumulateInputPath ? ' +accumulate_input' : ''
    console.log(`  - ${tf.filename} (${tf.executorType}, timeslot ${tf.timeslot}, serviceId ${tf.serviceId}, orderedIndex ${tf.orderedIndex}${subfolderInfo}${accInputInfo})`)
  }
  console.log()

  // Convert each trace file
  let successCount = 0
  let errorCount = 0

  for (const traceFile of traceFiles) {
    const inputFile = traceFile.filepath

    // Build output directory structure matching jamduna exactly:
    // jamduna: {timeslot}/{ordered_index}/{service_id}/
    // e.g., 00000050/0/1985398916/
    // Our output: pvm-traces/{subfolder}/modular/{timeslot}/{ordered_index}/{service_id}/
    const modularDir = traceFile.executorType === 'wasm' ? 'modular-wasm' : 'modular'
    const outputDirParts = [tracesDir]
    
    // Include subfolder in output path if present
    if (traceFile.subfolder) {
      outputDirParts.push(traceFile.subfolder)
    }
    
    outputDirParts.push(
      modularDir,
      traceFile.timeslot.padStart(8, '0'),      // {timeslot} - 8-digit padded
      String(traceFile.orderedIndex),            // {ordered_index} - invocation order within timeslot
      traceFile.serviceId,                       // {service_id} - actual service ID from trace
    )
    
    const outputDir = join(...outputDirParts)

    console.log('-'.repeat(60))
    console.log(`Converting: ${traceFile.filename}`)
    console.log(`  Output: ${outputDir}`)
    if (traceFile.accumulateInputPath) {
      console.log(`  Accumulate input: ${traceFile.accumulateInputPath}`)
    }

    try {
      convertTraceToModular(inputFile, outputDir, compress, traceFile.accumulateInputPath)
      successCount++
    } catch (error) {
      console.error(`  ERROR: ${error instanceof Error ? error.message : String(error)}`)
      errorCount++
    }
  }

  console.log()
  console.log('='.repeat(60))
  console.log(`Conversion complete: ${successCount} succeeded, ${errorCount} failed`)
  console.log('='.repeat(60))

  if (errorCount > 0) {
    process.exit(1)
  }
}

main()

