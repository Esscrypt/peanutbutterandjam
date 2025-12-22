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

  console.log(`\nSuccessfully converted trace to modular format in: ${outputDir}`)
}

interface TraceFile {
  filename: string
  filepath: string
  executorType: 'typescript' | 'wasm'
  timeslot: string
  subfolder?: string
}

function discoverTraceFiles(tracesDir: string, subfolder?: string): TraceFile[] {
  if (!existsSync(tracesDir)) {
    console.warn(`Traces directory not found: ${tracesDir}`)
    return []
  }

  const traceFiles: TraceFile[] = []

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
        // Match patterns: typescript-{timeslot}.log, wasm-{timeslot}.log
        const tsMatch = entry.name.match(/^typescript-(\d+)\.log$/)
        const wasmMatch = entry.name.match(/^wasm-(\d+)\.log$/)

        if (tsMatch) {
          traceFiles.push({
            filename: entry.name,
            filepath: fullPath,
            executorType: 'typescript',
            timeslot: tsMatch[1]!,
            subfolder: currentSubfolder,
          })
        } else if (wasmMatch) {
          traceFiles.push({
            filename: entry.name,
            filepath: fullPath,
            executorType: 'wasm',
            timeslot: wasmMatch[1]!,
            subfolder: currentSubfolder,
          })
        }
      }
    }
  }

  // Start recursive search
  searchDirectory(tracesDir, subfolder)

  // Sort by subfolder, then timeslot, then executor type
  traceFiles.sort((a, b) => {
    const subfolderCompare = (a.subfolder || '').localeCompare(b.subfolder || '')
    if (subfolderCompare !== 0) return subfolderCompare
    const timeslotDiff = Number.parseInt(a.timeslot, 10) - Number.parseInt(b.timeslot, 10)
    if (timeslotDiff !== 0) return timeslotDiff
    return a.executorType.localeCompare(b.executorType)
  })

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
    console.log(`  - ${tf.filename} (${tf.executorType}, timeslot ${tf.timeslot}${subfolderInfo})`)
  }
  console.log()

  // Convert each trace file
  let successCount = 0
  let errorCount = 0

  for (const traceFile of traceFiles) {
    const inputFile = traceFile.filepath

    // Build output directory structure matching the subfolder structure
    // If trace is in pvm-traces/preimages_light/typescript-2.log,
    // output goes to pvm-traces/preimages_light/modular[-wasm]/00000002/0/0/
    const modularDir = traceFile.executorType === 'wasm' ? 'modular-wasm' : 'modular'
    const outputDirParts = [tracesDir]
    
    // Include subfolder in output path if present
    if (traceFile.subfolder) {
      outputDirParts.push(traceFile.subfolder)
    }
    
    outputDirParts.push(
      modularDir,
      traceFile.timeslot.padStart(8, '0'),
      '0', // orderedIndex
      '0', // serviceId
    )
    
    const outputDir = join(...outputDirParts)

    console.log('-'.repeat(60))
    console.log(`Converting: ${traceFile.filename}`)
    console.log(`  Output: ${outputDir}`)

    try {
      convertTraceToModular(inputFile, outputDir, compress)
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

