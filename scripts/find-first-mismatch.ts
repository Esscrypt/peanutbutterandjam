#!/usr/bin/env bun

/**
 * Find First Trace Mismatch
 *
 * Runs trace comparison for blocks and stops at the first mismatch
 *
 * Usage:
 *   bun scripts/find-first-mismatch.ts [--preimages-light|--preimages-all|--storage-light|--storage-all|--fuzzy|--fuzzy-light] [--wasm] [--start N] [--end N]
 *
 * Examples:
 *   bun scripts/find-first-mismatch.ts --preimages-light
 *   bun scripts/find-first-mismatch.ts --fuzzy-light
 *   bun scripts/find-first-mismatch.ts --fuzzy-light --start 50 --end 150
 *   bun scripts/find-first-mismatch.ts --storage-all --wasm
 */

import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Map comparison flags to subpath names
const FLAG_TO_SUBPATH: Record<string, string> = {
  '--preimages-light': 'preimages_light',
  '--preimages-all': 'preimages',
  '--storage-light': 'storage_light',
  '--storage-all': 'storage',
  '--preimages': 'preimages', // Alias for --preimages-all
  '--storage': 'storage', // Alias for --storage-all
  '--fuzzy': 'fuzzy',
  '--fuzzy-light': 'fuzzy_light',
  '--modular': 'fuzzy', // --modular uses fuzzy by default
}

// Subpaths that use the fuzzy directory structure (block/invocation/service)
const FUZZY_SUBPATHS = new Set(['fuzzy', 'fuzzy_light'])

function getSubpathFromFlag(flag: string): string | null {
  return FLAG_TO_SUBPATH[flag] || null
}

function isFuzzyFormat(subpath: string): boolean {
  return FUZZY_SUBPATHS.has(subpath)
}

interface TraceLocation {
  block: number
  invocationIndex: string
  serviceId: string
}

/**
 * Get all trace locations for a block in fuzzy format
 * Returns array of {invocationIndex, serviceId} pairs
 */
function getFuzzyTraceLocations(block: number, subpath: string): TraceLocation[] {
  const blockStr = block.toString().padStart(8, '0')
  const blockDir = join(
    process.cwd(),
    'submodules',
    'jamduna',
    'jam-test-vectors',
    '0.7.2',
    subpath,
    blockStr,
  )

  if (!existsSync(blockDir)) {
    return []
  }

  const locations: TraceLocation[] = []

  try {
    // Read invocation directories (0, 1, etc.)
    const invocationDirs = readdirSync(blockDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .sort((a, b) => Number.parseInt(a) - Number.parseInt(b))

    for (const invocationIndex of invocationDirs) {
      const invocationDir = join(blockDir, invocationIndex)
      
      // Read service directories within each invocation
      const serviceDirs = readdirSync(invocationDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .sort((a, b) => Number.parseInt(a) - Number.parseInt(b))

      for (const serviceId of serviceDirs) {
        locations.push({ block, invocationIndex, serviceId })
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return locations
}

function traceExists(block: number, subpath: string): boolean {
  if (isFuzzyFormat(subpath)) {
    // For fuzzy formats, check if the block directory exists and has any traces
    return getFuzzyTraceLocations(block, subpath).length > 0
  }

  // For other formats, check the standard path
  const blockStr = block.toString().padStart(8, '0')
  const traceDir = join(
    process.cwd(),
    'submodules',
    'jamduna',
    'jam-test-vectors',
    '0.7.2',
    subpath,
    blockStr,
    '0',
    '0',
  )
  return existsSync(traceDir)
}

async function runComparison(
  block: number,
  formatFlag: string,
  executorType: 'typescript' | 'wasm',
  invocationIndex = '0',
  serviceId = '0',
): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    const args = [
      'scripts/compare-3way-traces.ts',
      '--2way',
      `--${executorType}`,
      formatFlag,
      block.toString(),
      invocationIndex,
      serviceId,
    ]

    const proc = spawn('bun', args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      const output = stdout + stderr
      
      // Check for missing trace directory error
      if (output.includes('Trace directory not found')) {
        resolve({
          success: true, // Skip blocks without traces
          output,
          error: 'no_trace',
        })
        return
      }
      
      // Check if there are differences in the output
      // The comparison script prints "Differences: X" where X > 0 means mismatch
      const diffMatch = output.match(/Differences:\s+(\d+)/)
      const hasDifferences = diffMatch && Number.parseInt(diffMatch[1]) > 0
      const success = code === 0 && !hasDifferences
      resolve({
        success,
        output,
      })
    })
  })
}

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  let formatFlag: string | null = null
  let executorType: 'typescript' | 'wasm' = 'typescript'
  let startBlock = 1
  let endBlock = 200

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--wasm') {
      executorType = 'wasm'
    } else if (arg === '--start' && args[i + 1]) {
      startBlock = Number.parseInt(args[i + 1]!)
      i++
    } else if (arg === '--end' && args[i + 1]) {
      endBlock = Number.parseInt(args[i + 1]!)
      i++
    } else if (arg?.startsWith('--') && FLAG_TO_SUBPATH[arg]) {
      formatFlag = arg
    }
  }

  // Default to --fuzzy-light if no flag specified
  if (!formatFlag) {
    formatFlag = '--fuzzy-light'
    console.log('No format flag specified, defaulting to --fuzzy-light\n')
  }

  const subpath = getSubpathFromFlag(formatFlag)
  if (!subpath) {
    console.error(`Error: Invalid format flag: ${formatFlag}`)
    console.error(`Supported flags: ${Object.keys(FLAG_TO_SUBPATH).join(', ')}`)
    process.exit(1)
  }

  const isFuzzy = isFuzzyFormat(subpath)

  console.log(`🔍 Searching for first trace mismatch in blocks ${startBlock}-${endBlock}...`)
  console.log(`   Format: ${formatFlag}`)
  console.log(`   Executor: ${executorType}`)
  console.log(`   Subpath: ${subpath}`)
  console.log(`   Mode: ${isFuzzy ? 'fuzzy (per invocation/service)' : 'standard'}\n`)

  let checkedCount = 0
  let skippedCount = 0
  let traceCount = 0

  for (let block = startBlock; block <= endBlock; block++) {
    // Check if trace exists before running comparison
    if (!traceExists(block, subpath)) {
      skippedCount++
      continue
    }

    if (isFuzzy) {
      // For fuzzy formats, get all trace locations and compare each
      const locations = getFuzzyTraceLocations(block, subpath)
      
      if (locations.length === 0) {
        skippedCount++
        continue
      }

      process.stdout.write(`Checking Block ${block} (${locations.length} traces)... `)
      checkedCount++

      let blockSuccess = true
      let failedLocation: TraceLocation | null = null
      let failedOutput = ''

      for (const loc of locations) {
        traceCount++
        const { success, output, error } = await runComparison(
          block,
          formatFlag,
          executorType,
          loc.invocationIndex,
          loc.serviceId,
        )

        if (error === 'no_trace') {
          continue
        }

        if (!success) {
          blockSuccess = false
          failedLocation = loc
          failedOutput = output
          break
        }
      }

      if (blockSuccess) {
        console.log('✅ Match')
      } else if (failedLocation) {
        console.log(`❌ MISMATCH at invocation ${failedLocation.invocationIndex}, service ${failedLocation.serviceId}\n`)
        console.log('='.repeat(80))
        console.log(`First mismatch at Block ${block}`)
        console.log(`Invocation: ${failedLocation.invocationIndex}, Service: ${failedLocation.serviceId}`)
        console.log(`Format: ${formatFlag}, Executor: ${executorType}`)
        console.log('='.repeat(80))
        console.log('\nComparison output:')
        console.log(failedOutput)
        process.exit(1)
      }
    } else {
      // Standard format comparison
      process.stdout.write(`Checking Block ${block}... `)
      checkedCount++
      traceCount++

      const { success, output, error } = await runComparison(block, formatFlag, executorType)

      if (error === 'no_trace') {
        console.log('⏭️  No trace (skipped)')
        skippedCount++
      } else if (success) {
        console.log('✅ Match')
      } else {
        console.log('❌ MISMATCH FOUND!\n')
        console.log('='.repeat(80))
        console.log(`First mismatch at Block ${block}`)
        console.log(`Format: ${formatFlag}, Executor: ${executorType}`)
        console.log('='.repeat(80))
        console.log('\nComparison output:')
        console.log(output)
        process.exit(1)
      }
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log(`✅ Checked ${checkedCount} blocks, ${traceCount} traces, skipped ${skippedCount} blocks (no traces)`)
  console.log('✅ All checked blocks match!')
  console.log('='.repeat(80))
  process.exit(0)
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
