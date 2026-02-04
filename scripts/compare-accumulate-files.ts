#!/usr/bin/env bun
/**
 * Compare Accumulate Files
 *
 * Compares accumulate_input, output, and err files between expected and actual trace directories
 *
 * Usage:
 *   bun scripts/compare-accumulate-files.ts <expected_dir> <actual_dir>
 *   bun scripts/compare-accumulate-files.ts --fuzzy <timeslot> <ordered_index> <service_id>
 *
 * Examples:
 *   bun scripts/compare-accumulate-files.ts submodules/reference/jam-test-vectors/0.7.2/fuzzy/00000030/0/1985398916 pvm-traces/fuzzy/modular/00000030/0/1985398916
 *   bun scripts/compare-accumulate-files.ts --fuzzy 30 0 1985398916
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { decodeAccumulateInput, decodeVariableSequence } from '@pbnjam/codec'
import type { AccumulateInput } from '@pbnjam/types'

// ANSI color codes
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

interface AccumulateInputComparison {
  expectedInputs: AccumulateInput[] | null
  actualInputs: AccumulateInput[] | null
  inputsMatch: boolean
  expectedCount: number
  actualCount: number
  differences: string[]
}

interface FileComparisonResult {
  accumulateInputs?: AccumulateInputComparison
  outputMatch: boolean
  errMatch: boolean
  expectedOutput: Uint8Array | null
  actualOutput: Uint8Array | null
  expectedErr: number | null
  actualErr: number | null
}

/**
 * Decode accumulate input sequence from binary file
 */
function decodeAccumulateInputSequence(
  data: Uint8Array,
): AccumulateInput[] | null {
  try {
    const [error, result] = decodeVariableSequence(
      data,
      (itemData: Uint8Array) => {
        return decodeAccumulateInput(itemData)
      },
    )

    if (error) {
      return null
    }

    // result.value is AccumulateInput[] (decodeVariableSequence extracts the value from each DecodingResult)
    return result.value
  } catch {
    return null
  }
}

/**
 * Compare accumulate inputs between expected and actual
 */
function compareAccumulateInputs(
  expectedData: Uint8Array | null,
  actualData: Uint8Array | null,
): AccumulateInputComparison {
  const expectedInputs = expectedData
    ? decodeAccumulateInputSequence(expectedData)
    : null
  const actualInputs = actualData
    ? decodeAccumulateInputSequence(actualData)
    : null

  const expectedCount = expectedInputs?.length ?? 0
  const actualCount = actualInputs?.length ?? 0

  const differences: string[] = []
  let inputsMatch = false

  if (expectedInputs === null && actualInputs === null) {
    inputsMatch = true // Both missing is a match
  } else if (expectedInputs === null || actualInputs === null) {
    differences.push(
      `One side missing: expected=${expectedCount}, actual=${actualCount}`,
    )
  } else if (expectedCount !== actualCount) {
    differences.push(
      `Count mismatch: expected=${expectedCount}, actual=${actualCount}`,
    )
  } else {
    // Compare each input
    let allMatch = true
    for (let i = 0; i < expectedCount; i++) {
      const expected = expectedInputs[i]
      const actual = actualInputs[i]

      if (!expected || !actual) {
        differences.push(`Input ${i}: missing on one side`)
        allMatch = false
        continue
      }

      // Compare type
      if (expected.type !== actual.type) {
        differences.push(
          `Input ${i}: type mismatch (expected=${expected.type}, actual=${actual.type})`,
        )
        allMatch = false
        continue
      }

      // Compare based on type
      if (expected.type === 0 && actual.type === 0) {
        // Operand tuple comparison
        const expOt = expected.value
        const actOt = actual.value
        if (
          expOt.packageHash !== actOt.packageHash ||
          expOt.segmentRoot !== actOt.segmentRoot ||
          expOt.authorizer !== actOt.authorizer ||
          expOt.payloadHash !== actOt.payloadHash ||
          expOt.gasLimit !== actOt.gasLimit ||
          expOt.result !== actOt.result
        ) {
          differences.push(`Input ${i}: operand tuple mismatch`)
          allMatch = false
        }
        // Compare authTrace (blob)
        if (
          expOt.authTrace.length !== actOt.authTrace.length ||
          !expOt.authTrace.every((byte, idx) => byte === actOt.authTrace[idx])
        ) {
          differences.push(`Input ${i}: operand tuple authTrace mismatch`)
          allMatch = false
        }
      } else if (expected.type === 1 && actual.type === 1) {
        // Deferred transfer comparison
        const expDt = expected.value
        const actDt = actual.value
        if (
          expDt.source !== actDt.source ||
          expDt.dest !== actDt.dest ||
          expDt.amount !== actDt.amount ||
          expDt.gasLimit !== actDt.gasLimit
        ) {
          differences.push(`Input ${i}: deferred transfer mismatch`)
          allMatch = false
        }
        // Compare memo (128 bytes)
        if (
          expDt.memo.length !== actDt.memo.length ||
          !expDt.memo.every((byte, idx) => byte === actDt.memo[idx])
        ) {
          differences.push(`Input ${i}: deferred transfer memo mismatch`)
          allMatch = false
        }
      } else {
        differences.push(
          `Input ${i}: type mismatch (expected=${expected.type}, actual=${actual.type})`,
        )
        allMatch = false
      }
    }
    inputsMatch = allMatch
  }

  return {
    expectedInputs,
    actualInputs,
    inputsMatch,
    expectedCount,
    actualCount,
    differences,
  }
}

/**
 * Format bytes as hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return (
    '0x' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  )
}

/**
 * Compare accumulate files between expected and actual directories
 */
function compareAccumulateFiles(
  expectedDir: string,
  actualDir: string,
): FileComparisonResult {
  // Try to read accumulate_input files
  const expectedAccumulateInputPath = join(expectedDir, 'accumulate_input')
  const actualAccumulateInputPath = join(actualDir, 'accumulate_input')

  let expectedAccumulateInput: Uint8Array | null = null
  let actualAccumulateInput: Uint8Array | null = null

  if (existsSync(expectedAccumulateInputPath)) {
    expectedAccumulateInput = new Uint8Array(
      readFileSync(expectedAccumulateInputPath),
    )
  }
  if (existsSync(actualAccumulateInputPath)) {
    actualAccumulateInput = new Uint8Array(
      readFileSync(actualAccumulateInputPath),
    )
  }

  // Try to read output files (yield hash - 32 bytes)
  const expectedOutputPath = join(expectedDir, 'output')
  const actualOutputPath = join(actualDir, 'output')

  let expectedOutput: Uint8Array | null = null
  let actualOutput: Uint8Array | null = null

  if (existsSync(expectedOutputPath)) {
    expectedOutput = new Uint8Array(readFileSync(expectedOutputPath))
  }
  if (existsSync(actualOutputPath)) {
    actualOutput = new Uint8Array(readFileSync(actualOutputPath))
  }

  // Try to read err files (error code - 1 byte)
  const expectedErrPath = join(expectedDir, 'err')
  const actualErrPath = join(actualDir, 'err')

  let expectedErr: number | null = null
  let actualErr: number | null = null

  if (existsSync(expectedErrPath)) {
    const errData = readFileSync(expectedErrPath)
    expectedErr = errData.length > 0 ? errData[0] : null
  }
  if (existsSync(actualErrPath)) {
    const errData = readFileSync(actualErrPath)
    actualErr = errData.length > 0 ? errData[0] : null
  }

  // Compare outputs
  let outputMatch = false
  if (expectedOutput === null && actualOutput === null) {
    outputMatch = true // Both missing is a match
  } else if (expectedOutput !== null && actualOutput !== null) {
    outputMatch =
      expectedOutput.length === actualOutput.length &&
      expectedOutput.every((byte, i) => byte === actualOutput[i])
  }

  // Compare errors
  const errMatch = expectedErr === actualErr

  // Compare accumulate inputs
  const accumulateInputs =
    expectedAccumulateInput || actualAccumulateInput
      ? compareAccumulateInputs(
          expectedAccumulateInput,
          actualAccumulateInput,
        )
      : undefined

  return {
    accumulateInputs,
    outputMatch,
    errMatch,
    expectedOutput,
    actualOutput,
    expectedErr,
    actualErr,
  }
}

/**
 * Print comparison results
 */
function printComparison(
  expectedDir: string,
  actualDir: string,
  result: FileComparisonResult,
) {
  console.log(
    `${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`,
  )
  console.log(
    `${colors.bold}📦 Accumulate Files Comparison${colors.reset}`,
  )
  console.log(
    `${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`,
  )
  console.log()
  console.log(
    `${colors.cyan}Expected:${colors.reset} ${expectedDir}`,
  )
  console.log(
    `${colors.cyan}Actual:${colors.reset}   ${actualDir}`,
  )
  console.log()

  // Accumulate inputs comparison
  if (result.accumulateInputs) {
    const inputs = result.accumulateInputs
    const inputsStatus = inputs.inputsMatch
      ? `${colors.green}✓ Match${colors.reset}`
      : `${colors.red}✗ Mismatch${colors.reset}`
    console.log(
      `${colors.bold}📥 Accumulate Inputs${colors.reset}`,
    )
    console.log(`   Status:        ${inputsStatus}`)
    console.log(
      `   Count:         Expected=${inputs.expectedCount}, Actual=${inputs.actualCount}`,
    )

    if (!inputs.inputsMatch && inputs.differences.length > 0) {
      console.log(`   Differences:`)
      for (const diff of inputs.differences) {
        console.log(`      ${colors.red}${diff}${colors.reset}`)
      }
    }

    // Show summary of input types
    if (inputs.expectedInputs && inputs.expectedInputs.length > 0) {
      const operandTuples = inputs.expectedInputs.filter((i) => i.type === 0)
        .length
      const deferredTransfers = inputs.expectedInputs.filter(
        (i) => i.type === 1,
      ).length
      console.log(
        `   Expected types: ${operandTuples} operand tuples, ${deferredTransfers} deferred transfers`,
      )
    }
    if (inputs.actualInputs && inputs.actualInputs.length > 0) {
      const operandTuples = inputs.actualInputs.filter((i) => i.type === 0)
        .length
      const deferredTransfers = inputs.actualInputs.filter(
        (i) => i.type === 1,
      ).length
      console.log(
        `   Actual types:   ${operandTuples} operand tuples, ${deferredTransfers} deferred transfers`,
      )
    }
    console.log()
  } else {
    console.log(
      `${colors.bold}📥 Accumulate Inputs${colors.reset}`,
    )
    console.log(
      `   ${colors.dim}(neither present)${colors.reset}`,
    )
    console.log()
  }

  // Output (yield hash) comparison
  console.log(
    `${colors.bold}📤 Output (Yield Hash)${colors.reset}`,
  )
  if (result.expectedOutput || result.actualOutput) {
    const outputStatus = result.outputMatch
      ? `${colors.green}✓ Match${colors.reset}`
      : `${colors.red}✗ Mismatch${colors.reset}`
    console.log(`   Status:        ${outputStatus}`)

    if (!result.outputMatch) {
      if (result.expectedOutput) {
        console.log(
          `   ${colors.green}Expected:${colors.reset} ${bytesToHex(result.expectedOutput)}`,
        )
      } else {
        console.log(
          `   ${colors.green}Expected:${colors.reset} (not present)`,
        )
      }
      if (result.actualOutput) {
        console.log(
          `   ${colors.blue}Actual:${colors.reset}   ${bytesToHex(result.actualOutput)}`,
        )
      } else {
        console.log(
          `   ${colors.blue}Actual:${colors.reset}   (not present)`,
        )
      }
    }
  } else {
    console.log(
      `   ${colors.dim}(neither present)${colors.reset}`,
    )
  }
  console.log()

  // Error comparison
  console.log(
    `${colors.bold}❌ Error Code${colors.reset}`,
  )
  if (
    result.expectedErr !== null ||
    result.actualErr !== null
  ) {
    const errStatus = result.errMatch
      ? `${colors.green}✓ Match${colors.reset}`
      : `${colors.red}✗ Mismatch${colors.reset}`
    console.log(`   Status:        ${errStatus}`)

    if (!result.errMatch) {
      console.log(
        `   ${colors.green}Expected:${colors.reset} ${result.expectedErr ?? '(not present)'}`,
      )
      console.log(
        `   ${colors.blue}Actual:${colors.reset}   ${result.actualErr ?? '(not present)'}`,
      )
    }
  } else {
    console.log(
      `   ${colors.dim}(neither present)${colors.reset}`,
    )
  }
  console.log()
}

/**
 * Construct the trace directory path for modular format
 */
function getModularTraceDir(
  baseDir: string,
  timeslot: string,
  orderedIndex: number,
  serviceId: number,
): string {
  return join(
    baseDir,
    timeslot.padStart(8, '0'),
    String(orderedIndex),
    String(serviceId),
  )
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log(`${colors.bold}Accumulate Files Comparison Tool${colors.reset}`)
    console.log()
    console.log('Usage:')
    console.log(
      '  bun scripts/compare-accumulate-files.ts <expected_dir> <actual_dir>',
    )
    console.log(
      '  bun scripts/compare-accumulate-files.ts --fuzzy <timeslot> <ordered_index> <service_id>',
    )
    console.log()
    console.log('Examples:')
    console.log(
      '  bun scripts/compare-accumulate-files.ts submodules/reference/jam-test-vectors/0.7.2/fuzzy/00000030/0/1985398916 pvm-traces/fuzzy/modular/00000030/0/1985398916',
    )
    console.log(
      '  bun scripts/compare-accumulate-files.ts --fuzzy 30 0 1985398916',
    )
    return
  }

  const workspaceRoot = join(__dirname, '..')
  let expectedDir: string
  let actualDir: string

  if (args[0] === '--fuzzy') {
    // Fuzzy format: construct paths automatically
    const timeslot = args[1]
    const orderedIndex = args[2] ? Number.parseInt(args[2], 10) : 0
    const serviceId = args[3] ? Number.parseInt(args[3], 10) : 0

    if (!timeslot) {
      console.error(
        `${colors.red}Error: Timeslot required for --fuzzy format${colors.reset}`,
      )
      process.exit(1)
    }

    const expectedBaseDir = join(
      workspaceRoot,
      'submodules',
      'reference',
      'jam-test-vectors',
      '0.7.2',
      'fuzzy',
    )
    const actualBaseDir = join(
      workspaceRoot,
      'pvm-traces',
      'fuzzy',
      'modular',
    )

    expectedDir = getModularTraceDir(
      expectedBaseDir,
      timeslot,
      orderedIndex,
      serviceId,
    )
    actualDir = getModularTraceDir(
      actualBaseDir,
      timeslot,
      orderedIndex,
      serviceId,
    )
  } else {
    // Direct directory paths
    expectedDir = args[0]
    actualDir = args[1]

    if (!expectedDir || !actualDir) {
      console.error(
        `${colors.red}Error: Both expected and actual directories are required${colors.reset}`,
      )
      process.exit(1)
    }
  }

  // Check if directories exist
  if (!existsSync(expectedDir)) {
    console.error(
      `${colors.red}Error: Expected directory not found: ${expectedDir}${colors.reset}`,
    )
    process.exit(1)
  }

  if (!existsSync(actualDir)) {
    console.error(
      `${colors.red}Error: Actual directory not found: ${actualDir}${colors.reset}`,
    )
    process.exit(1)
  }

  const expectedStat = statSync(expectedDir)
  const actualStat = statSync(actualDir)

  if (!expectedStat.isDirectory()) {
    console.error(
      `${colors.red}Error: Expected path is not a directory: ${expectedDir}${colors.reset}`,
    )
    process.exit(1)
  }

  if (!actualStat.isDirectory()) {
    console.error(
      `${colors.red}Error: Actual path is not a directory: ${actualDir}${colors.reset}`,
    )
    process.exit(1)
  }

  // Compare files
  const result = compareAccumulateFiles(expectedDir, actualDir)

  // Print results
  printComparison(expectedDir, actualDir, result)
}

main()

