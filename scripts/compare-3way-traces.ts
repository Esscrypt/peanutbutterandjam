#!/usr/bin/env bun
/**
 * 3-Way PVM Trace Comparison
 *
 * Compares three trace files: expected (jamduna), TypeScript executor, and WASM executor
 *
 * Usage: bun scripts/compare-3way-traces.ts [block_number]
 *
 * Example:
 *   bun scripts/compare-3way-traces.ts 2
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

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

interface TraceLine {
  lineNumber: number
  raw: string
  type: 'instruction' | 'host_function' | 'comment' | 'empty' | 'status'
  instruction?: string
  step?: number
  pc?: number
  gas?: number
  registers?: string[]
  hostFunction?: {
    name: string
    id: number
    gasUsed?: number
    gasRemaining?: number
    serviceId?: number
  }
  status?: string
}

function parseOurTraceLine(line: string, lineNumber: number): TraceLine {
  const trimmed = line.trim()

  if (!trimmed) {
    return { lineNumber, raw: line, type: 'empty' }
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
        name: hostFnMatch[1],
        id: Number.parseInt(hostFnMatch[2], 10),
        gasUsed: Number.parseInt(hostFnMatch[3], 10),
        gasRemaining: Number.parseInt(hostFnMatch[4], 10),
        serviceId: Number.parseInt(hostFnMatch[5], 10),
      },
    }
  }

  // Instruction line: "INSTRUCTION STEP PC Gas: GAS Registers:[r0, r1, ...]"
  const instrMatch = trimmed.match(
    /^(\w+) (\d+) (\d+) Gas: (\d+) Registers:\[([^\]]+)\]/,
  )
  if (instrMatch) {
    const registers = instrMatch[5].split(',').map((r) => r.trim())
    return {
      lineNumber,
      raw: line,
      type: 'instruction',
      instruction: instrMatch[1],
      step: Number.parseInt(instrMatch[2], 10),
      pc: Number.parseInt(instrMatch[3], 10),
      gas: Number.parseInt(instrMatch[4], 10),
      registers,
    }
  }

  return { lineNumber, raw: line, type: 'comment' }
}

function parseExpectedTraceLine(line: string, lineNumber: number): TraceLine {
  const trimmed = line.trim()

  if (!trimmed) {
    return { lineNumber, raw: line, type: 'empty' }
  }

  // Host function call: "TRACE [host-calls] [0] NAME(...) <- ..."
  const hostFnMatch = trimmed.match(/TRACE \[host-calls\] \[(\d+)\] (\w+)\(/)
  if (hostFnMatch) {
    return {
      lineNumber,
      raw: line,
      type: 'host_function',
      hostFunction: {
        name: hostFnMatch[2],
        id: Number.parseInt(hostFnMatch[1], 10),
        serviceId: Number.parseInt(hostFnMatch[1], 10),
      },
    }
  }

  // Status line: "INSANE [pvm] [PC: X] Status: STATUS"
  const statusMatch = trimmed.match(/INSANE.*\[PC: (\d+)\] Status: (\w+)/)
  if (statusMatch) {
    return {
      lineNumber,
      raw: line,
      type: 'status',
      pc: Number.parseInt(statusMatch[1], 10),
      status: statusMatch[2],
    }
  }

  // Instruction line: "INSANE [pvm] [PC: X] INSTRUCTION"
  const instrMatch = trimmed.match(/INSANE.*\[PC: (\d+)\] (\w+)/)
  if (instrMatch) {
    return {
      lineNumber,
      raw: line,
      type: 'instruction',
      instruction: instrMatch[2],
      pc: Number.parseInt(instrMatch[1], 10),
    }
  }

  return { lineNumber, raw: line, type: 'comment' }
}

function parseTraceFile(filepath: string, isExpected: boolean): TraceLine[] {
  const content = readFileSync(filepath, 'utf-8')
  const lines = content.split('\n')
  return lines.map((line, idx) =>
    isExpected
      ? parseExpectedTraceLine(line, idx + 1)
      : parseOurTraceLine(line, idx + 1),
  )
}

interface ComparisonResult {
  step: number
  type: 'instruction' | 'pc' | 'gas' | 'registers' | 'missing' | 'host_function'
  expected?: TraceLine
  typescript?: TraceLine
  wasm?: TraceLine
  details?: string
}

function compareThreeTraces(
  expectedLines: TraceLine[],
  typescriptLines: TraceLine[],
  wasmLines: TraceLine[],
): {
  differences: ComparisonResult[]
  stats: {
    totalExpected: number
    totalTypescript: number
    totalWasm: number
    matching: number
  }
} {
  const differences: ComparisonResult[] = []

  // Filter to only instruction and host function lines
  const expectedInstrs = expectedLines.filter(
    (l) => l.type === 'instruction' || l.type === 'host_function',
  )
  const typescriptInstrs = typescriptLines.filter(
    (l) => l.type === 'instruction' || l.type === 'host_function',
  )
  const wasmInstrs = wasmLines.filter(
    (l) => l.type === 'instruction' || l.type === 'host_function',
  )

  const maxSteps = Math.max(
    expectedInstrs.length,
    typescriptInstrs.length,
    wasmInstrs.length,
  )

  let matching = 0

  for (let i = 0; i < maxSteps; i++) {
    const expected = expectedInstrs[i]
    const typescript = typescriptInstrs[i]
    const wasm = wasmInstrs[i]

    // Check if all three are present
    if (!expected && !typescript && !wasm) continue

    // Check for missing traces
    if (!expected || !typescript || !wasm) {
      differences.push({
        step: i + 1,
        type: 'missing',
        expected,
        typescript,
        wasm,
        details: `Missing in: ${!expected ? 'expected ' : ''}${!typescript ? 'typescript ' : ''}${!wasm ? 'wasm' : ''}`,
      })
      continue
    }

    // Compare instruction names
    if (
      expected.type === 'instruction' &&
      typescript.type === 'instruction' &&
      wasm.type === 'instruction'
    ) {
      const instrMatch =
        expected.instruction === typescript.instruction &&
        typescript.instruction === wasm.instruction

      if (!instrMatch) {
        differences.push({
          step: i + 1,
          type: 'instruction',
          expected,
          typescript,
          wasm,
          details: `Expected: ${expected.instruction}, TS: ${typescript.instruction}, WASM: ${wasm.instruction}`,
        })
        continue
      }

      // Compare PC
      if (expected.pc !== typescript.pc || typescript.pc !== wasm.pc) {
        differences.push({
          step: i + 1,
          type: 'pc',
          expected,
          typescript,
          wasm,
          details: `Expected PC: ${expected.pc}, TS PC: ${typescript.pc}, WASM PC: ${wasm.pc}`,
        })
        continue
      }

      // Compare gas (if available)
      if (typescript.gas !== undefined && wasm.gas !== undefined) {
        if (typescript.gas !== wasm.gas) {
          differences.push({
            step: i + 1,
            type: 'gas',
            expected,
            typescript,
            wasm,
            details: `TS gas: ${typescript.gas}, WASM gas: ${wasm.gas}, diff: ${typescript.gas - wasm.gas}`,
          })
          continue
        }
      }

      // Compare registers (if available)
      if (typescript.registers && wasm.registers) {
        const regDiffs: string[] = []
        for (
          let r = 0;
          r < Math.max(typescript.registers.length, wasm.registers.length);
          r++
        ) {
          const tsReg = typescript.registers[r] || '0'
          const wasmReg = wasm.registers[r] || '0'
          if (tsReg !== wasmReg) {
            regDiffs.push(`r${r}: TS=${tsReg}, WASM=${wasmReg}`)
          }
        }
        if (regDiffs.length > 0) {
          differences.push({
            step: i + 1,
            type: 'registers',
            expected,
            typescript,
            wasm,
            details: `Register diffs: ${regDiffs.join('; ')}`,
          })
          continue
        }
      }

      matching++
    }

    // Compare host function calls
    if (
      expected.type === 'host_function' &&
      typescript.type === 'host_function' &&
      wasm.type === 'host_function'
    ) {
      const nameMatch =
        expected.hostFunction?.name === typescript.hostFunction?.name &&
        typescript.hostFunction?.name === wasm.hostFunction?.name
      const idMatch =
        expected.hostFunction?.id === typescript.hostFunction?.id &&
        typescript.hostFunction?.id === wasm.hostFunction?.id

      if (!nameMatch || !idMatch) {
        differences.push({
          step: i + 1,
          type: 'host_function',
          expected,
          typescript,
          wasm,
          details: `Expected: ${expected.hostFunction?.name} ${expected.hostFunction?.id}, TS: ${typescript.hostFunction?.name} ${typescript.hostFunction?.id}, WASM: ${wasm.hostFunction?.name} ${wasm.hostFunction?.id}`,
        })
        continue
      }

      matching++
    }
  }

  return {
    differences,
    stats: {
      totalExpected: expectedInstrs.length,
      totalTypescript: typescriptInstrs.length,
      totalWasm: wasmInstrs.length,
      matching,
    },
  }
}

function printComparison(
  blockNumber: number,
  expectedPath: string,
  typescriptPath: string,
  wasmPath: string,
  result: ReturnType<typeof compareThreeTraces>,
) {
  console.log(
    `${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`,
  )
  console.log(
    `${colors.bold}📊 3-Way Trace Comparison for Block ${blockNumber}${colors.reset}`,
  )
  console.log(
    `${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`,
  )
  console.log()
  console.log(
    `${colors.cyan}Expected (jamduna):${colors.reset} ${expectedPath}`,
  )
  console.log(
    `${colors.cyan}TypeScript:${colors.reset}        ${typescriptPath}`,
  )
  console.log(`${colors.cyan}WASM:${colors.reset}             ${wasmPath}`)
  console.log()

  // Summary
  console.log(`${colors.bold}📈 Summary${colors.reset}`)
  console.log(`   Expected instructions:  ${result.stats.totalExpected}`)
  console.log(`   TypeScript instructions: ${result.stats.totalTypescript}`)
  console.log(`   WASM instructions:       ${result.stats.totalWasm}`)
  console.log(`   Matching:                ${result.stats.matching}`)
  console.log(`   Differences:              ${result.differences.length}`)
  console.log()

  // Match percentage
  const matchPercent =
    result.stats.totalExpected > 0
      ? ((result.stats.matching / result.stats.totalExpected) * 100).toFixed(2)
      : '0'
  const matchColor =
    Number.parseFloat(matchPercent) >= 99
      ? colors.green
      : Number.parseFloat(matchPercent) >= 90
        ? colors.yellow
        : colors.red
  console.log(`   ${matchColor}Match rate: ${matchPercent}%${colors.reset}`)
  console.log()

  // Show first N differences
  const maxDiffsToShow = 20
  if (result.differences.length > 0) {
    console.log(
      `${colors.bold}📋 First ${Math.min(maxDiffsToShow, result.differences.length)} Differences${colors.reset}`,
    )
    console.log()

    for (
      let i = 0;
      i < Math.min(maxDiffsToShow, result.differences.length);
      i++
    ) {
      const diff = result.differences[i]
      const typeIcon = {
        instruction: '🔀',
        pc: '📍',
        gas: '⛽',
        registers: '📊',
        missing: '❌',
        host_function: '📞',
      }[diff.type]

      console.log(`   ${typeIcon} Step ${diff.step}: ${diff.type}`)
      if (diff.details) {
        console.log(`      ${colors.dim}${diff.details}${colors.reset}`)
      }

      if (diff.expected) {
        console.log(
          `      ${colors.green}Expected:${colors.reset} ${diff.expected.raw.substring(0, 100)}`,
        )
      }
      if (diff.typescript) {
        console.log(
          `      ${colors.blue}TypeScript:${colors.reset} ${diff.typescript.raw.substring(0, 100)}`,
        )
      }
      if (diff.wasm) {
        console.log(
          `      ${colors.magenta}WASM:${colors.reset} ${diff.wasm.raw.substring(0, 100)}`,
        )
      }
      console.log()
    }

    if (result.differences.length > maxDiffsToShow) {
      console.log(
        `   ${colors.dim}... and ${result.differences.length - maxDiffsToShow} more differences${colors.reset}`,
      )
      console.log()
    }
  }

  // Analyze termination points
  const missingDiffs = result.differences.filter((d) => d.type === 'missing')
  if (missingDiffs.length > 0) {
    console.log(`${colors.bold}🔍 Termination Analysis${colors.reset}`)
    console.log()

    const expectedOnly = missingDiffs.filter(
      (d) => d.expected && !d.typescript && !d.wasm,
    )
    const tsOnly = missingDiffs.filter(
      (d) => d.typescript && !d.expected && !d.wasm,
    )
    const wasmOnly = missingDiffs.filter(
      (d) => d.wasm && !d.expected && !d.typescript,
    )

    if (expectedOnly.length > 0) {
      console.log(
        `${colors.yellow}⚠️  Expected trace continues beyond our traces${colors.reset}`,
      )
      console.log(
        `   ${expectedOnly.length} instructions in expected but not in ours`,
      )
      if (expectedOnly[0].expected) {
        console.log(
          `   Last expected instruction: ${expectedOnly[0].expected.instruction} at PC ${expectedOnly[0].expected.pc}`,
        )
      }
    }

    if (tsOnly.length > 0) {
      console.log(
        `${colors.blue}ℹ️  TypeScript trace has ${tsOnly.length} extra instructions${colors.reset}`,
      )
    }

    if (wasmOnly.length > 0) {
      console.log(
        `${colors.magenta}ℹ️  WASM trace has ${wasmOnly.length} extra instructions${colors.reset}`,
      )
    }

    // Find where traces diverge
    const firstMissing = missingDiffs[0]
    if (firstMissing) {
      console.log()
      console.log(
        `${colors.bold}📍 First divergence at step ${firstMissing.step}${colors.reset}`,
      )
      if (firstMissing.expected) {
        console.log(
          `   Expected: ${firstMissing.expected.instruction || 'host_function'} at PC ${firstMissing.expected.pc}`,
        )
      }
      if (firstMissing.typescript) {
        console.log(
          `   TypeScript: ${firstMissing.typescript.instruction || 'host_function'} at PC ${firstMissing.typescript.pc}`,
        )
      }
      if (firstMissing.wasm) {
        console.log(
          `   WASM: ${firstMissing.wasm.instruction || 'host_function'} at PC ${firstMissing.wasm.pc}`,
        )
      }
    }
    console.log()
  }
}

function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log(`${colors.bold}3-Way PVM Trace Comparison Tool${colors.reset}`)
    console.log()
    console.log('Usage: bun scripts/compare-3way-traces.ts [block_number]')
    console.log()
    console.log('Example:')
    console.log('  bun scripts/compare-3way-traces.ts 2')
    return
  }

  const blockNumber = Number.parseInt(args[0], 10)

  if (Number.isNaN(blockNumber)) {
    console.error(
      `${colors.red}Error: Invalid block number: ${args[0]}${colors.reset}`,
    )
    process.exit(1)
  }

  const workspaceRoot = join(__dirname, '..')

  const expectedPath = join(
    workspaceRoot,
    'pvm-expected',
    `expected-${blockNumber}.log`,
  )
  const typescriptPath = join(
    workspaceRoot,
    'pvm-traces',
    `typescript-${blockNumber}.log`,
  )
  const wasmPath = join(workspaceRoot, 'pvm-traces', `wasm-${blockNumber}.log`)

  if (!existsSync(expectedPath)) {
    console.error(
      `${colors.red}Error: Expected trace not found: ${expectedPath}${colors.reset}`,
    )
    process.exit(1)
  }

  if (!existsSync(typescriptPath)) {
    console.error(
      `${colors.red}Error: TypeScript trace not found: ${typescriptPath}${colors.reset}`,
    )
    process.exit(1)
  }

  if (!existsSync(wasmPath)) {
    console.error(
      `${colors.red}Error: WASM trace not found: ${wasmPath}${colors.reset}`,
    )
    process.exit(1)
  }

  // Parse traces
  const expectedLines = parseTraceFile(expectedPath, true)
  const typescriptLines = parseTraceFile(typescriptPath, false)
  const wasmLines = parseTraceFile(wasmPath, false)

  // Compare
  const result = compareThreeTraces(expectedLines, typescriptLines, wasmLines)

  // Print results
  printComparison(blockNumber, expectedPath, typescriptPath, wasmPath, result)
}

main()
