#!/usr/bin/env bun

/**
 * Find First Trace Mismatch
 *
 * Runs trace comparison for blocks 1-100 and stops at the first mismatch
 *
 * Usage:
 *   bun scripts/find-first-mismatch.ts [--preimages-light|--preimages-all|--storage-light|--storage-all|--modular] [--wasm]
 *
 * Examples:
 *   bun scripts/find-first-mismatch.ts --preimages-light
 *   bun scripts/find-first-mismatch.ts --preimages-all
 *   bun scripts/find-first-mismatch.ts --storage-light
 *   bun scripts/find-first-mismatch.ts --storage-all
 *   bun scripts/find-first-mismatch.ts --storage-all --wasm
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
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

function getSubpathFromFlag(flag: string): string | null {
  return FLAG_TO_SUBPATH[flag] || null
}


function traceExists(block: number, subpath: string): boolean {
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
): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    const args = [
      'scripts/compare-3way-traces.ts',
      '--2way',
      `--${executorType}`,
      formatFlag,
      block.toString(),
      '0',
      '0',
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

  // Parse format flag (required)
  let formatFlag: string | null = null
  let executorType: 'typescript' | 'wasm' = 'typescript'

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--wasm') {
      executorType = 'wasm'
    } else if (arg?.startsWith('--') && FLAG_TO_SUBPATH[arg]) {
      formatFlag = arg
    }
  }

  // Default to --preimages-light if no flag specified
  if (!formatFlag) {
    formatFlag = '--preimages-light'
    console.log('No format flag specified, defaulting to --preimages-light\n')
  }

  const subpath = getSubpathFromFlag(formatFlag)
  if (!subpath) {
    console.error(`Error: Invalid format flag: ${formatFlag}`)
    console.error(`Supported flags: ${Object.keys(FLAG_TO_SUBPATH).join(', ')}`)
    process.exit(1)
  }

  console.log(`🔍 Searching for first trace mismatch in blocks 1-100...`)
  console.log(`   Format: ${formatFlag}`)
  console.log(`   Executor: ${executorType}`)
  console.log(`   Subpath: ${subpath}\n`)

  let checkedCount = 0
  let skippedCount = 0

  for (let block = 1; block <= 100; block++) {
    // Check if trace exists before running comparison
    if (!traceExists(block, subpath)) {
      skippedCount++
      continue
    }

    process.stdout.write(`Checking Block ${block}... `)
    checkedCount++

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

  console.log('\n' + '='.repeat(80))
  console.log(`✅ Checked ${checkedCount} blocks, skipped ${skippedCount} blocks (no traces)`)
  console.log('✅ All checked blocks match!')
  console.log('='.repeat(80))
  process.exit(0)
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})

