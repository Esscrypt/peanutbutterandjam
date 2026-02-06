#!/usr/bin/env bun
/**
 * Compare Trace Log Files
 *
 * Compares trace log files between our traces and jamduna reference traces.
 * Finds the first mismatch and identifies the last host function call before it.
 *
 * Usage:
 *   bun scripts/compare-trace-logs.ts [--our-dir <path>] [--ref-dir <path>] [--timeslot <n>]
 *
 * Options:
 *   --our-dir <path>    Path to our traces directory (default: pvm-traces/fuzzy/v0.7.1)
 *   --ref-dir <path>    Path to jamduna reference traces (default: submodules/jamduna/jam-test-vectors/0.7.1/fuzzy)
 *   --timeslot <n>      Only compare traces for specific timeslot (optional)
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

interface TraceLine {
  lineNumber: number
  raw: string
  type: 'instruction' | 'host_function' | 'comment' | 'empty'
  instruction?: string
  step?: number
  pc?: number
  gas?: number
  registers?: string
  hostFunction?: {
    name: string
    id: number
    gasUsed: number
    gasRemaining: number
    serviceId: number
  }
}

function parseTraceLine(line: string, lineNumber: number): TraceLine {
  const trimmed = line.trim()

  // Empty line
  if (!trimmed) {
    return { lineNumber, raw: line, type: 'empty' }
  }

  // Comment or metadata line (starts with # or ld:)
  if (trimmed.startsWith('#') || trimmed.startsWith('ld:')) {
    return { lineNumber, raw: line, type: 'comment' }
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
        name: hostFnMatch[1]!,
        id: Number.parseInt(hostFnMatch[2]!, 10),
        gasUsed: Number.parseInt(hostFnMatch[3]!, 10),
        gasRemaining: Number.parseInt(hostFnMatch[4]!, 10),
        serviceId: Number.parseInt(hostFnMatch[5]!, 10),
      },
    }
  }

  // Instruction line: "INSTRUCTION STEP PC Gas: GAS Registers:[r0, r1, ...] Load:[ADDR,VALUE] Store:[ADDR,VALUE]"
  // or legacy: "INSTRUCTION STEP PC Gas: GAS Registers:[r0, r1, ...]"
  const instrMatch = trimmed.match(
    /^(\w+)\s+(\d+)\s+(\d+)\s+Gas:\s+(\d+)\s+Registers:\[([^\]]+)\](?:\s+Load:\[(\d+),(\d+)\]\s+Store:\[(\d+),(\d+)\])?/,
  )
  if (instrMatch) {
    return {
      lineNumber,
      raw: line,
      type: 'instruction',
      instruction: instrMatch[1],
      step: Number.parseInt(instrMatch[2]!, 10),
      pc: Number.parseInt(instrMatch[3]!, 10),
      gas: Number.parseInt(instrMatch[4]!, 10),
      registers: instrMatch[5],
    }
  }

  // Unknown format - treat as comment
  return { lineNumber, raw: line, type: 'comment' }
}

function normalizeInstructionLine(line: TraceLine): string {
  if (line.type !== 'instruction') {
    return line.raw.trim()
  }

  // Normalize: remove Load/Store info for comparison (jamduna might not have it)
  // Compare: INSTRUCTION STEP PC Gas: GAS Registers:[...]
  const match = line.raw.trim().match(/^(\w+)\s+(\d+)\s+(\d+)\s+Gas:\s+(\d+)\s+Registers:\[([^\]]+)\]/)
  if (match) {
    return `${match[1]} ${match[2]} ${match[3]} Gas: ${match[4]} Registers:[${match[5]}]`
  }

  return line.raw.trim()
}

interface TraceFile {
  filename: string
  filepath: string
  timeslot: string
  serviceId: string
}

function discoverTraceFiles(dir: string): TraceFile[] {
  if (!existsSync(dir)) {
    console.warn(`Directory not found: ${dir}`)
    return []
  }

  const files: TraceFile[] = []
  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.log')) {
      const filename = entry.name

      // Our format: typescript-{timeslot}-{invocationIndex}-{serviceId}.log
      // or: typescript-{timeslot}-{serviceId}.log
      // or: typescript-{timeslot}.log
      const ourMatch = filename.match(/^typescript-(\d+)(?:-(\d+)(?:-(\d+))?)?\.log$/)
      if (ourMatch) {
        const timeslot = ourMatch[1]!
        const serviceId = ourMatch[3] ?? ourMatch[2] ?? '0'
        files.push({
          filename,
          filepath: join(dir, filename),
          timeslot,
          serviceId,
        })
        continue
      }

      // Jamduna format: {timeslot}.log (8-digit padded)
      const jamdunaMatch = filename.match(/^(\d{8})\.log$/)
      if (jamdunaMatch) {
        const timeslot = Number.parseInt(jamdunaMatch[1]!, 10).toString()
        files.push({
          filename,
          filepath: join(dir, filename),
          timeslot,
          serviceId: '0', // Jamduna format doesn't include serviceId in filename
        })
        continue
      }
    }
  }

  return files
}

function compareTraces(
  ourFile: string,
  refFile: string,
): {
  match: boolean
  firstMismatchLine?: number
  lastHostCallBeforeMismatch?: TraceLine
  ourLine?: string
  refLine?: string
} {
  const ourContent = readFileSync(ourFile, 'utf-8')
  const refContent = readFileSync(refFile, 'utf-8')

  const ourLines = ourContent.split('\n')
  const refLines = refContent.split('\n')

  // Parse all lines
  const ourParsed: TraceLine[] = []
  const refParsed: TraceLine[] = []

  for (let i = 0; i < ourLines.length; i++) {
    ourParsed.push(parseTraceLine(ourLines[i]!, i + 1))
  }

  for (let i = 0; i < refLines.length; i++) {
    refParsed.push(parseTraceLine(refLines[i]!, i + 1))
  }

  // Filter out comments and empty lines for comparison
  const ourInstructions = ourParsed.filter(
    (l) => l.type === 'instruction' || l.type === 'host_function',
  )
  const refInstructions = refParsed.filter(
    (l) => l.type === 'instruction' || l.type === 'host_function',
  )

  // Track last host function call
  let lastHostCall: TraceLine | undefined

  // Compare instruction by instruction
  const minLength = Math.min(ourInstructions.length, refInstructions.length)

  for (let i = 0; i < minLength; i++) {
    const ourLine = ourInstructions[i]!
    const refLine = refInstructions[i]!

    // Track host function calls
    if (ourLine.type === 'host_function') {
      lastHostCall = ourLine
    }

    // Compare normalized instruction lines
    if (ourLine.type === 'instruction' && refLine.type === 'instruction') {
      const ourNormalized = normalizeInstructionLine(ourLine)
      const refNormalized = normalizeInstructionLine(refLine)

      if (ourNormalized !== refNormalized) {
        return {
          match: false,
          firstMismatchLine: i + 1,
          lastHostCallBeforeMismatch: lastHostCall,
          ourLine: ourLine.raw,
          refLine: refLine.raw,
        }
      }
    } else if (ourLine.type !== refLine.type) {
      // Different line types
      return {
        match: false,
        firstMismatchLine: i + 1,
        lastHostCallBeforeMismatch: lastHostCall,
        ourLine: ourLine.raw,
        refLine: refLine.raw,
      }
    }
  }

  // Check if one trace is longer than the other
  if (ourInstructions.length !== refInstructions.length) {
    return {
      match: false,
      firstMismatchLine: minLength + 1,
      lastHostCallBeforeMismatch: lastHostCall,
      ourLine:
        ourInstructions.length > minLength
          ? ourInstructions[minLength]!.raw
          : undefined,
      refLine:
        refInstructions.length > minLength
          ? refInstructions[minLength]!.raw
          : undefined,
    }
  }

  return { match: true }
}

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  let ourDir = 'pvm-traces/fuzzy/v0.7.1'
  let refDir = 'submodules/jamduna/jam-test-vectors/0.7.1/fuzzy'
  let targetTimeslot: string | undefined

  const ourDirIndex = args.indexOf('--our-dir')
  if (ourDirIndex !== -1 && args[ourDirIndex + 1]) {
    ourDir = args[ourDirIndex + 1]!
  }

  const refDirIndex = args.indexOf('--ref-dir')
  if (refDirIndex !== -1 && args[refDirIndex + 1]) {
    refDir = args[refDirIndex + 1]!
  }

  const timeslotIndex = args.indexOf('--timeslot')
  if (timeslotIndex !== -1 && args[timeslotIndex + 1]) {
    targetTimeslot = args[timeslotIndex + 1]
  }

  const workspaceRoot = join(__dirname, '..')
  const ourDirPath = join(workspaceRoot, ourDir)
  const refDirPath = join(workspaceRoot, refDir)

  console.log('='.repeat(80))
  console.log('Trace Log Comparison Tool')
  console.log('='.repeat(80))
  console.log()
  console.log(`Our traces: ${ourDirPath}`)
  console.log(`Reference traces: ${refDirPath}`)
  if (targetTimeslot) {
    console.log(`Target timeslot: ${targetTimeslot}`)
  }
  console.log()

  // Discover trace files
  const ourFiles = discoverTraceFiles(ourDirPath)
  const refFiles = discoverTraceFiles(refDirPath)

  console.log(`Found ${ourFiles.length} trace file(s) in our directory`)
  console.log(`Found ${refFiles.length} trace file(s) in reference directory`)
  console.log()

  if (ourFiles.length === 0) {
    console.error('No trace files found in our directory')
    process.exit(1)
  }

  if (refFiles.length === 0) {
    console.error('No trace files found in reference directory')
    process.exit(1)
  }

  // Match files by timeslot
  const matches: Array<{
    ourFile: TraceFile
    refFile: TraceFile
    timeslot: string
  }> = []

  for (const ourFile of ourFiles) {
    if (targetTimeslot && ourFile.timeslot !== targetTimeslot) {
      continue
    }

    // Find matching reference file by timeslot
    // For jamduna format, we need to match the 8-digit padded timeslot
    const paddedTimeslot = ourFile.timeslot.padStart(8, '0')
    const refFile = refFiles.find(
      (f) => f.timeslot === ourFile.timeslot || f.filename === `${paddedTimeslot}.log`,
    )

    if (refFile) {
      matches.push({
        ourFile,
        refFile,
        timeslot: ourFile.timeslot,
      })
    } else {
      console.warn(
        `⚠️  No matching reference file for ${ourFile.filename} (timeslot: ${ourFile.timeslot})`,
      )
    }
  }

  if (matches.length === 0) {
    console.error('No matching trace files found')
    process.exit(1)
  }

  console.log(`Comparing ${matches.length} trace file pair(s):`)
  console.log()

  // Compare each pair
  let matchCount = 0
  let mismatchCount = 0

  for (const match of matches) {
    console.log('-'.repeat(80))
    console.log(
      `Comparing: ${match.ourFile.filename} (timeslot ${match.timeslot}) vs ${match.refFile.filename}`,
    )

    const result = compareTraces(match.ourFile.filepath, match.refFile.filepath)

    if (result.match) {
      console.log('✅ Traces match')
      matchCount++
    } else {
      console.log('❌ Traces differ')
      mismatchCount++

      if (result.firstMismatchLine) {
        console.log(`   First mismatch at instruction line ${result.firstMismatchLine}`)
      }

      if (result.lastHostCallBeforeMismatch) {
        const hf = result.lastHostCallBeforeMismatch.hostFunction!
        console.log()
        console.log('   Last host function call before mismatch:')
        console.log(
          `   Line ${result.lastHostCallBeforeMismatch.lineNumber}: ${result.lastHostCallBeforeMismatch.raw}`,
        )
        console.log(`   Host function: ${hf.name} (ID: ${hf.id})`)
        console.log(`   Service ID: ${hf.serviceId}`)
        console.log(`   Gas used: ${hf.gasUsed}, Gas remaining: ${hf.gasRemaining}`)
      }

      if (result.ourLine && result.refLine) {
        console.log()
        console.log('   Our line:')
        console.log(`   ${result.ourLine}`)
        console.log('   Reference line:')
        console.log(`   ${result.refLine}`)
      } else if (result.ourLine) {
        console.log()
        console.log('   Our line (reference ended earlier):')
        console.log(`   ${result.ourLine}`)
      } else if (result.refLine) {
        console.log()
        console.log('   Reference line (our trace ended earlier):')
        console.log(`   ${result.refLine}`)
      }
    }

    console.log()
  }

  console.log('='.repeat(80))
  console.log(`Comparison complete: ${matchCount} matched, ${mismatchCount} mismatched`)
  console.log('='.repeat(80))

  if (mismatchCount > 0) {
    process.exit(1)
  }
}

main()


