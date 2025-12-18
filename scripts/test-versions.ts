#!/usr/bin/env bun
/**
 * Test different versions of jam-test-vectors and compare traces
 *
 * Usage: bun scripts/test-versions.ts [block_number]
 */

import { execSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const WORKSPACE_ROOT = join(__dirname, '..')
const JAM_TEST_VECTORS_DIR = join(WORKSPACE_ROOT, 'submodules/jam-test-vectors')
const TEST_FILE = join(
  WORKSPACE_ROOT,
  'infra/node/__tests__/traces/preimages-light-all-blocks.test.ts',
)
const COMPARE_SCRIPT = join(WORKSPACE_ROOT, 'scripts/compare-traces.ts')

const BLOCK_NUMBER = Number.parseInt(process.argv[2] || '4', 10)

interface VersionResult {
  version: string
  matchRate: number
  totalDiffs: number
  firstDiffStep: number | null
  traceFile: string | null
  error?: string
}

function getCurrentVersion(): string {
  try {
    return execSync('git describe --tags --exact-match HEAD', {
      cwd: JAM_TEST_VECTORS_DIR,
      encoding: 'utf-8',
    }).trim()
  } catch {
    return execSync('git rev-parse --short HEAD', {
      cwd: JAM_TEST_VECTORS_DIR,
      encoding: 'utf-8',
    }).trim()
  }
}

function checkoutVersion(version: string): void {
  console.log(`  Checking out ${version}...`)
  execSync(`git checkout ${version}`, {
    cwd: JAM_TEST_VECTORS_DIR,
    stdio: 'ignore',
  })
}

function cleanTraces(): void {
  const traceFiles = [
    join(WORKSPACE_ROOT, 'pvm-traces', `typescript-${BLOCK_NUMBER}.log`),
    join(
      WORKSPACE_ROOT,
      'infra/node/pvm-traces',
      `typescript-${BLOCK_NUMBER}.log`,
    ),
  ]

  for (const file of traceFiles) {
    if (existsSync(file)) {
      rmSync(file)
    }
  }
}

function runTest(): { success: boolean; output: string } {
  try {
    // Rebuild first to ensure latest code is used
    console.log(`  Building packages...`)
    execSync('bun run build', {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 120000, // 2 minutes
    })

    console.log(`  Running test for block ${BLOCK_NUMBER}...`)
    // Run test but don't fail on errors - we just need the trace file
    const output = execSync(`bun test "${TEST_FILE}" || true`, {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: 300000, // 5 minutes
      shell: '/bin/bash',
    })

    // Check if block was processed (even if test failed)
    const success =
      output.includes(`Block ${BLOCK_NUMBER}`) ||
      output.includes(`Processing Block ${BLOCK_NUMBER}`)
    return { success, output }
  } catch (error: any) {
    // Even if test fails, trace might have been written
    return {
      success: false,
      output: error.stdout?.toString() || error.message || String(error),
    }
  }
}

function findTraceFile(): string | null {
  const traceFiles = [
    join(WORKSPACE_ROOT, 'pvm-traces', `typescript-${BLOCK_NUMBER}.log`),
    join(
      WORKSPACE_ROOT,
      'infra/node/pvm-traces',
      `typescript-${BLOCK_NUMBER}.log`,
    ),
  ]

  for (const file of traceFiles) {
    if (existsSync(file)) {
      return file
    }
  }
  return null
}

function runComparison(): {
  matchRate: number
  totalDiffs: number
  firstDiffStep: number | null
  output: string
} {
  try {
    const output = execSync(
      `bun run "${COMPARE_SCRIPT}" ${BLOCK_NUMBER} typescript`,
      {
        cwd: WORKSPACE_ROOT,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      },
    )

    // Extract metrics
    const matchRateMatch = output.match(/Match rate:\s+([0-9.]+)%/)
    const diffsMatch = output.match(/Differences:\s+(\d+)/)
    const firstDiffMatch = output.match(/First Difference at Step (\d+)/)

    return {
      matchRate: matchRateMatch ? Number.parseFloat(matchRateMatch[1]) : 0,
      totalDiffs: diffsMatch ? Number.parseInt(diffsMatch[1], 10) : 0,
      firstDiffStep: firstDiffMatch
        ? Number.parseInt(firstDiffMatch[1], 10)
        : null,
      output,
    }
  } catch (error: any) {
    return {
      matchRate: 0,
      totalDiffs: 0,
      firstDiffStep: null,
      output: error.stdout?.toString() || error.message || String(error),
    }
  }
}

function testVersion(version: string): VersionResult {
  console.log(`\n${'='.repeat(50)}`)
  console.log(`Testing version: ${version}`)
  console.log('='.repeat(50))

  try {
    checkoutVersion(version)
    cleanTraces()

    const testResult = runTest()
    if (!testResult.success) {
      console.log(`  ⚠ Test may have issues, but continuing...`)
    }

    // Wait a moment for file writes and check multiple times
    for (let i = 0; i < 5; i++) {
      Bun.sleep(500)
      const trace = findTraceFile()
      if (trace) break
    }

    const traceFile = findTraceFile()
    if (!traceFile) {
      console.log(`  ❌ No trace file generated`)
      return {
        version,
        matchRate: 0,
        totalDiffs: 0,
        firstDiffStep: null,
        traceFile: null,
        error: 'No trace file generated',
      }
    }

    console.log(`  ✓ Trace file: ${traceFile}`)

    const comparison = runComparison()
    console.log(`  Match rate: ${comparison.matchRate.toFixed(2)}%`)
    console.log(`  Total differences: ${comparison.totalDiffs}`)
    console.log(
      `  First difference at step: ${comparison.firstDiffStep ?? 'N/A'}`,
    )

    return {
      version,
      matchRate: comparison.matchRate,
      totalDiffs: comparison.totalDiffs,
      firstDiffStep: comparison.firstDiffStep,
      traceFile,
    }
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`)
    return {
      version,
      matchRate: 0,
      totalDiffs: 0,
      firstDiffStep: null,
      traceFile: null,
      error: error.message,
    }
  }
}

function main() {
  const currentVersion = getCurrentVersion()
  console.log(`Current version: ${currentVersion}`)
  console.log(`Testing block ${BLOCK_NUMBER}`)
  console.log(`\nWill test versions: v0.7.0, v0.7.1, v0.7.2`)

  const versions = ['v0.7.0', 'v0.7.1', 'v0.7.2']
  const results: VersionResult[] = []

  for (const version of versions) {
    const result = testVersion(version)
    results.push(result)
  }

  // Restore original version
  console.log(`\n${'='.repeat(50)}`)
  console.log(`Restoring original version: ${currentVersion}`)
  console.log('='.repeat(50))
  checkoutVersion(currentVersion)

  // Print summary
  console.log(`\n${'='.repeat(50)}`)
  console.log('SUMMARY')
  console.log('='.repeat(50))
  console.log(
    `${'Version'.padEnd(12)} ${'Match Rate'.padEnd(12)} ${'Differences'.padEnd(15)} ${'First Diff'.padEnd(15)} ${'Status'.padEnd(20)}`,
  )
  console.log('-'.repeat(80))

  for (const result of results) {
    const status = result.error
      ? result.error.substring(0, 18)
      : result.traceFile
        ? 'OK'
        : 'NO_TRACE'
    console.log(
      `${result.version.padEnd(12)} ${result.matchRate.toFixed(2).padEnd(11)}% ${String(result.totalDiffs).padEnd(15)} ${String(result.firstDiffStep ?? 'N/A').padEnd(15)} ${status.padEnd(20)}`,
    )
  }

  // Find best match
  const bestMatch = results
    .filter((r) => r.traceFile && !r.error)
    .sort((a, b) => b.matchRate - a.matchRate)[0]

  if (bestMatch) {
    console.log(
      `\n🏆 Best match: ${bestMatch.version} (${bestMatch.matchRate.toFixed(2)}% match)`,
    )
    if (bestMatch.matchRate === 100) {
      console.log(`   ✅ Perfect match!`)
    } else if (bestMatch.matchRate >= 99) {
      console.log(`   ✅ Very close match!`)
    } else {
      console.log(`   ⚠️  Still has ${bestMatch.totalDiffs} differences`)
    }
  }

  console.log('')
}

main()
