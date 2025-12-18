#!/usr/bin/env bun
/**
 * Test a single commit hash from jam-test-vectors
 *
 * Usage: bun scripts/test-single-commit.ts <commit_hash> [block_number]
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

const COMMIT = process.argv[2]
const BLOCK_NUMBER = Number.parseInt(process.argv[3] || '4', 10)

if (!COMMIT) {
  console.error(
    'Usage: bun scripts/test-single-commit.ts <commit_hash> [block_number]',
  )
  console.error('\nExample commits to test:')
  console.error('  431254fd  (v0.7.1 tag)')
  console.error('  72fd8338')
  console.error('  99bdf9f9')
  console.error('  ce6d36b2')
  process.exit(1)
}

function getCurrentVersion(): string {
  return execSync('git rev-parse HEAD', {
    cwd: JAM_TEST_VECTORS_DIR,
    encoding: 'utf-8',
  }).trim()
}

const currentVersion = getCurrentVersion()
console.log(`Current version: ${currentVersion.substring(0, 8)}`)
console.log(
  `Testing commit: ${COMMIT.substring(0, 8)} for block ${BLOCK_NUMBER}\n`,
)

// Checkout commit
console.log('1. Checking out commit...')
execSync(`git checkout ${COMMIT}`, {
  cwd: JAM_TEST_VECTORS_DIR,
  stdio: 'inherit',
})

// Clean traces
console.log('\n2. Cleaning old traces...')
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

// Build
console.log('\n3. Building packages...')
execSync('bun run build', {
  cwd: WORKSPACE_ROOT,
  stdio: 'inherit',
})

// Run test
console.log(`\n4. Running test for block ${BLOCK_NUMBER}...`)
console.log('   (This may take a few minutes)\n')
try {
  execSync(`timeout 300 bun test "${TEST_FILE}" || true`, {
    cwd: WORKSPACE_ROOT,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
    shell: '/bin/bash',
    stdio: 'inherit',
  })
} catch {
  // Continue even if test fails
}

// Wait for file
Bun.sleep(2000)

// Find trace
const traceFile = traceFiles.find((f) => existsSync(f)) || null

if (!traceFile) {
  console.log('\n❌ No trace file generated!')
  console.log('Restoring version...')
  execSync(`git checkout ${currentVersion}`, {
    cwd: JAM_TEST_VECTORS_DIR,
    stdio: 'inherit',
  })
  process.exit(1)
}

console.log(`\n✓ Trace file: ${traceFile}`)

// Run comparison
console.log('\n5. Running comparison...\n')
execSync(`bun run "${COMPARE_SCRIPT}" ${BLOCK_NUMBER} typescript`, {
  cwd: WORKSPACE_ROOT,
  stdio: 'inherit',
})

// Restore version
console.log(`\n6. Restoring version: ${currentVersion.substring(0, 8)}`)
execSync(`git checkout ${currentVersion}`, {
  cwd: JAM_TEST_VECTORS_DIR,
  stdio: 'inherit',
})

console.log('\n✅ Done!')
