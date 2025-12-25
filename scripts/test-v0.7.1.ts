#!/usr/bin/env bun
/**
 * Test v0.7.1 of jam-test-vectors and show detailed comparison
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
const BLOCK_NUMBER = 4

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

const currentVersion = getCurrentVersion()
console.log(`Current version: ${currentVersion}`)
console.log(`Testing v0.7.1 for block ${BLOCK_NUMBER}\n`)

// Checkout v0.7.1
console.log('1. Checking out v0.7.1...')
execSync('git checkout v0.7.1', {
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

// Run test (with timeout, allow it to fail)
console.log(`\n4. Running test for block ${BLOCK_NUMBER}...`)
console.log(
  '   (This may take a few minutes, test will continue even if it fails)\n',
)
try {
  execSync(`timeout 300 bun test "${TEST_FILE}" || true`, {
    cwd: WORKSPACE_ROOT,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
    shell: '/bin/bash',
    stdio: 'inherit',
  })
} catch {
  // Ignore - trace might still be written
}

// Wait for file
Bun.sleep(2000)

// Find trace
const traceFile = traceFiles.find((f) => existsSync(f)) || null

if (!traceFile) {
  console.log('\n❌ No trace file generated!')
  process.exit(1)
}

console.log(`\n✓ Trace file generated: ${traceFile}`)

// Run comparison
console.log('\n5. Running comparison...\n')
execSync(`bun run "${COMPARE_SCRIPT}" ${BLOCK_NUMBER} typescript`, {
  cwd: WORKSPACE_ROOT,
  stdio: 'inherit',
})

// Restore version
console.log(`\n6. Restoring version: ${currentVersion}`)
execSync(`git checkout ${currentVersion}`, {
  cwd: JAM_TEST_VECTORS_DIR,
  stdio: 'inherit',
})

console.log('\n✅ Done!')

