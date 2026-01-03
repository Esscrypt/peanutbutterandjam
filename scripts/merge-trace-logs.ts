#!/usr/bin/env bun
/**
 * Merge Trace Logs
 *
 * Merges multiple trace log files for the same block into a single file,
 * matching the format used in jam-test-vectors.
 *
 * Our format: typescript-{block}-{service}-{invocation}.log
 * Output format: {block padded to 8 digits}.log
 *
 * Usage: bun scripts/merge-trace-logs.ts [--input-dir <dir>] [--output-dir <dir>] [--block <number>]
 *
 * Example:
 *   bun scripts/merge-trace-logs.ts --input-dir pvm-traces/fuzzy/v0.7.1 --output-dir pvm-traces/fuzzy/v0.7.1/merged --block 8
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// ANSI color codes for terminal output
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

interface TraceFileInfo {
  filename: string
  block: number
  service: number
  invocation: number
  fullPath: string
}

/**
 * Parse trace filename to extract block, service, and invocation
 * Format: typescript-{block}-{service}-{invocation}.log
 */
function parseTraceFilename(filename: string): TraceFileInfo | null {
  // Match pattern: typescript-{block}-{service}-{invocation}.log
  const match = filename.match(/^typescript-(\d+)-(\d+)-(\d+)\.log$/)
  if (!match) {
    return null
  }

  return {
    filename,
    block: Number.parseInt(match[1], 10),
    service: Number.parseInt(match[2], 10),
    invocation: Number.parseInt(match[3], 10),
    fullPath: '', // Will be set later
  }
}

/**
 * Sort trace files by service ID, then by invocation index
 */
function sortTraceFiles(files: TraceFileInfo[]): TraceFileInfo[] {
  return files.sort((a, b) => {
    // First sort by service ID
    if (a.service !== b.service) {
      return a.service - b.service
    }
    // Then by invocation index
    return a.invocation - b.invocation
  })
}

/**
 * Merge trace logs for a single block
 */
function mergeBlockLogs(
  inputDir: string,
  outputDir: string,
  blockNumber: number,
): void {
  console.log(
    `${colors.bold}Merging logs for block ${blockNumber}...${colors.reset}`,
  )

  // Read all files in input directory
  const allFiles = readdirSync(inputDir).filter((f) => f.endsWith('.log'))

  // Parse and filter files for this block
  const blockFiles: TraceFileInfo[] = []
  for (const filename of allFiles) {
    const parsed = parseTraceFilename(filename)
    if (parsed && parsed.block === blockNumber) {
      parsed.fullPath = join(inputDir, filename)
      blockFiles.push(parsed)
    }
  }

  if (blockFiles.length === 0) {
    console.log(
      `${colors.yellow}⚠️  No trace files found for block ${blockNumber}${colors.reset}`,
    )
    return
  }

  // Sort by service ID, then by invocation index
  const sortedFiles = sortTraceFiles(blockFiles)

  console.log(
    `${colors.dim}Found ${sortedFiles.length} trace files for block ${blockNumber}:${colors.reset}`,
  )
  for (const file of sortedFiles) {
    console.log(
      `${colors.dim}  - Service ${file.service}, Invocation ${file.invocation}: ${file.filename}${colors.reset}`,
    )
  }

  // Merge the log files
  const mergedLines: string[] = []
  let lineNumber = 1

  for (const file of sortedFiles) {
    const content = readFileSync(file.fullPath, 'utf-8')
    const lines = content.split('\n')

    // Add a comment separator between different services/invocations (optional, for readability)
    if (mergedLines.length > 0) {
      mergedLines.push('')
    }

    // Add all lines from this file
    for (const line of lines) {
      mergedLines.push(line)
    }
  }

  // Write merged log to output file
  const outputFilename = blockNumber.toString().padStart(8, '0') + '.log'
  const outputPath = join(outputDir, outputFilename)

  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true })

  writeFileSync(outputPath, mergedLines.join('\n'), 'utf-8')

  console.log(
    `${colors.green}✅ Merged ${sortedFiles.length} files into ${outputFilename}${colors.reset}`,
  )
  console.log(
    `${colors.dim}   Total lines: ${mergedLines.length}${colors.reset}`,
  )
}

/**
 * Merge all blocks found in the input directory
 */
function mergeAllBlocks(inputDir: string, outputDir: string): void {
  console.log(
    `${colors.bold}Merging all blocks in ${inputDir}...${colors.reset}`,
  )

  // Read all files in input directory
  const allFiles = readdirSync(inputDir).filter((f) => f.endsWith('.log'))

  // Collect all unique block numbers
  const blockNumbers = new Set<number>()
  for (const filename of allFiles) {
    const parsed = parseTraceFilename(filename)
    if (parsed) {
      blockNumbers.add(parsed.block)
    }
  }

  if (blockNumbers.size === 0) {
    console.log(
      `${colors.yellow}⚠️  No trace files found in ${inputDir}${colors.reset}`,
    )
    return
  }

  const sortedBlocks = Array.from(blockNumbers).sort((a, b) => a - b)

  console.log(
    `${colors.dim}Found ${sortedBlocks.length} blocks to merge: ${sortedBlocks.join(', ')}${colors.reset}`,
  )

  for (const blockNumber of sortedBlocks) {
    mergeBlockLogs(inputDir, outputDir, blockNumber)
  }

  console.log(
    `${colors.green}${colors.bold}✅ Merged all blocks successfully!${colors.reset}`,
  )
}

async function main() {
  const args = process.argv.slice(2)
  let inputDir = 'pvm-traces/fuzzy/v0.7.1'
  let outputDir = 'pvm-traces/fuzzy/v0.7.1/merged'
  let blockNumber: number | undefined

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input-dir') {
      inputDir = args[++i]
    } else if (args[i] === '--output-dir') {
      outputDir = args[++i]
    } else if (args[i] === '--block') {
      blockNumber = Number.parseInt(args[++i], 10)
      if (Number.isNaN(blockNumber)) {
        console.error(
          `${colors.red}Error: --block must be a number.${colors.reset}`,
        )
        process.exit(1)
      }
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
${colors.bold}Merge Trace Logs${colors.reset}

Merges multiple trace log files for the same block into a single file,
matching the format used in jam-test-vectors.

${colors.bold}Usage:${colors.reset}
  bun scripts/merge-trace-logs.ts [options]

${colors.bold}Options:${colors.reset}
  --input-dir <dir>     Input directory containing trace files (default: pvm-traces/fuzzy/v0.7.1)
  --output-dir <dir>    Output directory for merged files (default: pvm-traces/fuzzy/v0.7.1/merged)
  --block <number>      Merge only a specific block (optional, merges all blocks if not specified)
  --help, -h             Show this help message

${colors.bold}Examples:${colors.reset}
  # Merge all blocks
  bun scripts/merge-trace-logs.ts

  # Merge only block 8
  bun scripts/merge-trace-logs.ts --block 8

  # Custom input/output directories
  bun scripts/merge-trace-logs.ts --input-dir my-traces --output-dir merged-traces
`)
      process.exit(0)
    }
  }

  // Validate input directory exists
  if (!existsSync(inputDir)) {
    console.error(
      `${colors.red}${colors.bold}❌ Error: Input directory does not exist: ${inputDir}${colors.reset}`,
    )
    process.exit(1)
  }

  try {
    if (blockNumber !== undefined) {
      mergeBlockLogs(inputDir, outputDir, blockNumber)
    } else {
      mergeAllBlocks(inputDir, outputDir)
    }
  } catch (error) {
    console.error(
      `${colors.red}${colors.bold}❌ Error:${colors.reset}`,
      error instanceof Error ? error.message : String(error),
    )
    if (error instanceof Error && error.stack) {
      console.error(`${colors.dim}${error.stack}${colors.reset}`)
    }
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(`${colors.red}Error:`, error, colors.reset)
  process.exit(1)
})

