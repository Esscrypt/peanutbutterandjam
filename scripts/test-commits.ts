#!/usr/bin/env bun
/**
 * Test specific commit hashes from jam-test-vectors to find which matches jamduna traces
 *
 * Usage: bun scripts/test-commits.ts [block_number]
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

// Commits from git log (newest to oldest)
const COMMITS = [
  '431254fd3ac260165cf846216abdde42c47cedd6', // v0.7.1 tag
  '72fd8338401fc454626d03882b9064fe8fc82657',
  '99bdf9f9afc7c165efc5dad61a3a3ee1360269ab',
  'ce6d36b2be69d05a8c8c61582e6b4a21d2806b0f',
]

interface CommitResult {
  commit: string
  shortCommit: string
  matchRate: number
  totalDiffs: number
  firstDiffStep: number | null
  traceFile: string | null
  error?: string
  firstDiffDetails?: string
}

function getCurrentVersion(): string {
  try {
    return execSync('git describe --tags --exact-match HEAD', {
      cwd: JAM_TEST_VECTORS_DIR,
      encoding: 'utf-8',
    }).trim()
  } catch {
    return execSync('git rev-parse HEAD', {
      cwd: JAM_TEST_VECTORS_DIR,
      encoding: 'utf-8',
    }).trim()
  }
}

function checkoutCommit(commit: string): void {
  console.log(`  Checking out ${commit.substring(0, 8)}...`)
  execSync(`git checkout ${commit}`, {
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
    console.log(`  Running test for block ${BLOCK_NUMBER}...`)
    const output = execSync(`bun test "${TEST_FILE}" || true`, {
      cwd: WORKSPACE_ROOT,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 300000,
      shell: '/bin/bash',
    })

    const success =
      output.includes(`Block ${BLOCK_NUMBER}`) ||
      output.includes(`Processing Block ${BLOCK_NUMBER}`)
    return { success, output }
  } catch (error: any) {
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
  firstDiffDetails: string
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

    const matchRateMatch = output.match(/Match rate:\s+([0-9.]+)%/)
    const diffsMatch = output.match(/Differences:\s+(\d+)/)
    const firstDiffMatch = output.match(/First Difference at Step (\d+)/)

    // Extract first difference details
    let firstDiffDetails = ''
    const firstDiffSection = output.match(
      /First Difference at Step \d+[\s\S]*?(?=\n\n|\n📋|$)/,
    )
    if (firstDiffSection) {
      firstDiffDetails = firstDiffSection[0].substring(0, 200) // First 200 chars
    }

    return {
      matchRate: matchRateMatch ? Number.parseFloat(matchRateMatch[1]) : 0,
      totalDiffs: diffsMatch ? Number.parseInt(diffsMatch[1], 10) : 0,
      firstDiffStep: firstDiffMatch
        ? Number.parseInt(firstDiffMatch[1], 10)
        : null,
      firstDiffDetails,
      output,
    }
  } catch (error: any) {
    return {
      matchRate: 0,
      totalDiffs: 0,
      firstDiffStep: null,
      firstDiffDetails: '',
      output: error.stdout?.toString() || error.message || String(error),
    }
  }
}

function testCommit(commit: string): CommitResult {
  const shortCommit = commit.substring(0, 8)
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Testing commit: ${shortCommit}`)
  console.log('='.repeat(60))

  try {
    checkoutCommit(commit)
    cleanTraces()

    // Build first
    console.log(`  Building packages...`)
    try {
      execSync('bun run build', {
        cwd: WORKSPACE_ROOT,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 120000,
      })
    } catch {
      // Build might have warnings, continue
    }

    const testResult = runTest()
    if (!testResult.success) {
      console.log(
        `  ⚠ Test output doesn't show block ${BLOCK_NUMBER}, but continuing...`,
      )
    }

    // Wait for file writes
    for (let i = 0; i < 5; i++) {
      Bun.sleep(500)
      const trace = findTraceFile()
      if (trace) break
    }

    const traceFile = findTraceFile()
    if (!traceFile) {
      console.log(`  ❌ No trace file generated`)
      return {
        commit,
        shortCommit,
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

    if (comparison.firstDiffStep === 1) {
      console.log(`  ⚠️  First difference at step 1 (initial state)`)
    } else if (comparison.firstDiffStep === 2) {
      console.log(`  ⚠️  First difference at step 2 (after JUMP)`)
    }

    return {
      commit,
      shortCommit,
      matchRate: comparison.matchRate,
      totalDiffs: comparison.totalDiffs,
      firstDiffStep: comparison.firstDiffStep,
      traceFile,
      firstDiffDetails: comparison.firstDiffDetails,
    }
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`)
    return {
      commit,
      shortCommit,
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
  console.log(`Current version: ${currentVersion.substring(0, 8)}`)
  console.log(`Testing block ${BLOCK_NUMBER}`)
  console.log(`\nWill test ${COMMITS.length} commits:\n`)
  COMMITS.forEach((commit, i) => {
    const short = commit.substring(0, 8)
    const isTag = i === 0 ? ' (v0.7.1 tag)' : ''
    console.log(`  ${i + 1}. ${short}${isTag}`)
  })

  const results: CommitResult[] = []

  for (const commit of COMMITS) {
    const result = testCommit(commit)
    results.push(result)
  }

  // Restore original version
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Restoring original version: ${currentVersion.substring(0, 8)}`)
  console.log('='.repeat(60))
  checkoutCommit(currentVersion)

  // Print summary
  console.log(`\n${'='.repeat(60)}`)
  console.log('SUMMARY')
  console.log('='.repeat(60))
  console.log(
    `${'Commit'.padEnd(12)} ${'Match Rate'.padEnd(12)} ${'Differences'.padEnd(15)} ${'First Diff'.padEnd(15)} ${'Status'.padEnd(20)}`,
  )
  console.log('-'.repeat(80))

  for (const result of results) {
    const status = result.error
      ? result.error.substring(0, 18)
      : result.traceFile
        ? 'OK'
        : 'NO_TRACE'
    const tag = result.commit === COMMITS[0] ? ' (v0.7.1)' : ''
    console.log(
      `${result.shortCommit.padEnd(12)} ${result.matchRate.toFixed(2).padEnd(11)}% ${String(result.totalDiffs).padEnd(15)} ${String(result.firstDiffStep ?? 'N/A').padEnd(15)} ${status.padEnd(20)}${tag}`,
    )
  }

  // Find best match
  const validResults = results.filter((r) => r.traceFile && !r.error)
  if (validResults.length > 0) {
    const bestMatch = validResults.sort((a, b) => b.matchRate - a.matchRate)[0]
    console.log(
      `\n🏆 Best match: ${bestMatch.shortCommit} (${bestMatch.matchRate.toFixed(2)}% match)`,
    )

    if (bestMatch.matchRate === 100) {
      console.log(`   ✅ Perfect match!`)
    } else if (bestMatch.matchRate >= 99) {
      console.log(`   ✅ Very close match!`)
    } else if (bestMatch.firstDiffStep === 2) {
      console.log(`   ⚠️  First difference at step 2 (PC mismatch after JUMP)`)
      console.log(
        `   This suggests different code blob, but same encoding format`,
      )
    } else if (bestMatch.firstDiffStep === 1) {
      console.log(`   ⚠️  First difference at step 1 (initial state mismatch)`)
      console.log(
        `   This suggests different argument encoding or register initialization`,
      )
    } else {
      console.log(`   ⚠️  Still has ${bestMatch.totalDiffs} differences`)
    }

    // Show first difference details for best match
    if (bestMatch.firstDiffDetails) {
      console.log(`\n   First difference details:`)
      console.log(`   ${bestMatch.firstDiffDetails.substring(0, 150)}...`)
    }
  }

  console.log('')
}

main()

