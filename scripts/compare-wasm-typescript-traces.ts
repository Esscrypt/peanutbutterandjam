#!/usr/bin/env bun
/**
 * Compare WASM vs TypeScript vs reference PVM Trace Files (3-way comparison)
 *
 * Analyzes differences between WASM, TypeScript executor traces, and reference reference traces
 * for the same block, identifying where they diverge and why.
 *
 * Usage: bun scripts/compare-wasm-typescript-traces.ts [block_number] [--reference-block N] [--reference-dir path]
 *        bun scripts/compare-wasm-typescript-traces.ts --jam-conformance <trace_id> <slot> <ordered_index> <service_id>
 *
 * Examples:
 *   bun scripts/compare-wasm-typescript-traces.ts 2    # Compare block 2 traces (2-way)
 *   bun scripts/compare-wasm-typescript-traces.ts 2 --reference-block 4    # Compare our block 2 with reference trace 4
 *   bun scripts/compare-wasm-typescript-traces.ts 4    # Compare block 4 traces (3-way with reference, auto-detects)
 *   bun scripts/compare-wasm-typescript-traces.ts 4 --reference-dir submodules/reference/jam-test-vectors/0.7.1/preimages_light
 *   bun scripts/compare-wasm-typescript-traces.ts --jam-conformance 1767871405_3616 110 0 759414909
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

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

interface TraceLine {
  lineNumber: number
  raw: string
  type: 'instruction' | 'host_function' | 'comment' | 'empty'
  instruction?: string
  step?: number
  pc?: number
  gas?: number
  registers?: string[]
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

  // Comment or metadata line
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

  // Unknown format - treat as comment
  return { lineNumber, raw: line, type: 'comment' }
}

function parseTraceFile(filepath: string): TraceLine[] {
  const content = readFileSync(filepath, 'utf-8')
  const lines = content.split('\n')
  return lines.map((line, idx) => parseTraceLine(line, idx + 1))
}

interface ComparisonResult {
  blockNumber: number
  wasmFile: string
  typescriptFile: string
  referenceFile?: string
  wasmInstructionCount: number
  typescriptInstructionCount: number
  referenceInstructionCount?: number
  matchingInstructions: number
  matchingWithJamduna?: number
  firstDivergence: {
    step: number
    wasmLine?: TraceLine
    typescriptLine?: TraceLine
    referenceLine?: TraceLine
    reason: string
  } | null
  differences: Array<{
    step: number
    type:
      | 'instruction'
      | 'pc'
      | 'gas'
      | 'registers'
      | 'missing_wasm'
      | 'missing_typescript'
      | 'missing_reference'
    wasmValue?: string
    typescriptValue?: string
    referenceValue?: string
    details?: string
  }>
  wasmStoppedEarly: boolean
  typescriptStoppedEarly: boolean
  referenceStoppedEarly?: boolean
}

function compareTraces(
  wasmLines: TraceLine[],
  typescriptLines: TraceLine[],
  blockNumber: number,
  wasmFile: string,
  typescriptFile: string,
  referenceLines?: TraceLine[],
  referenceFile?: string,
): ComparisonResult {
  const wasmInstructions = wasmLines.filter(
    (l) => l.type === 'instruction' || l.type === 'host_function',
  )
  const typescriptInstructions = typescriptLines.filter(
    (l) => l.type === 'instruction' || l.type === 'host_function',
  )
  const referenceInstructions = referenceLines
    ? referenceLines.filter(
        (l) => l.type === 'instruction' || l.type === 'host_function',
      )
    : undefined

  const differences: ComparisonResult['differences'] = []
  let matchingInstructions = 0
  let matchingWithJamduna = 0
  let firstDivergence: ComparisonResult['firstDivergence'] = null

  const maxSteps = Math.max(
    wasmInstructions.length,
    typescriptInstructions.length,
    referenceInstructions?.length || 0,
  )

  for (let i = 0; i < maxSteps; i++) {
    const wasmLine = wasmInstructions[i]
    const typescriptLine = typescriptInstructions[i]
    const referenceLine = referenceInstructions?.[i]

    // Check if traces ended early
    if (!wasmLine && typescriptLine) {
      if (!firstDivergence) {
        firstDivergence = {
          step: i + 1,
          typescriptLine,
          referenceLine,
          reason: 'WASM trace ended early (stopped before TypeScript)',
        }
      }
      differences.push({
        step: i + 1,
        type: 'missing_wasm',
        typescriptValue: `${typescriptLine.instruction || typescriptLine.type} at step ${typescriptLine.step || i + 1}`,
        referenceValue: referenceLine
          ? `${referenceLine.instruction || referenceLine.type} at step ${referenceLine.step || i + 1}`
          : undefined,
        details: `WASM trace stopped at step ${wasmInstructions.length}, TypeScript continues`,
      })
      continue
    }

    if (wasmLine && !typescriptLine) {
      if (!firstDivergence) {
        firstDivergence = {
          step: i + 1,
          wasmLine,
          referenceLine,
          reason: 'TypeScript trace ended early (stopped before WASM)',
        }
      }
      differences.push({
        step: i + 1,
        type: 'missing_typescript',
        wasmValue: `${wasmLine.instruction || wasmLine.type} at step ${wasmLine.step || i + 1}`,
        referenceValue: referenceLine
          ? `${referenceLine.instruction || referenceLine.type} at step ${referenceLine.step || i + 1}`
          : undefined,
        details: `TypeScript trace stopped at step ${typescriptInstructions.length}, WASM continues`,
      })
      continue
    }

    if (referenceInstructions && !referenceLine && (wasmLine || typescriptLine)) {
      if (!firstDivergence) {
        firstDivergence = {
          step: i + 1,
          wasmLine,
          typescriptLine,
          reason: 'reference trace ended early',
        }
      }
      differences.push({
        step: i + 1,
        type: 'missing_reference',
        wasmValue: wasmLine
          ? `${wasmLine.instruction || wasmLine.type} at step ${wasmLine.step || i + 1}`
          : undefined,
        typescriptValue: typescriptLine
          ? `${typescriptLine.instruction || typescriptLine.type} at step ${typescriptLine.step || i + 1}`
          : undefined,
        details: `reference trace stopped at step ${referenceInstructions.length}`,
      })
      continue
    }

    if (!wasmLine || !typescriptLine) continue

    // Compare instruction lines
    if (
      wasmLine.type === 'instruction' &&
      typescriptLine.type === 'instruction'
    ) {
      let hasDiff = false
      let matchesJamduna = false

      // Check instruction name
      if (wasmLine.instruction !== typescriptLine.instruction) {
        differences.push({
          step: wasmLine.step || i + 1,
          type: 'instruction',
          wasmValue: wasmLine.instruction,
          typescriptValue: typescriptLine.instruction,
          referenceValue: referenceLine?.instruction,
          details: `Instruction mismatch at step ${wasmLine.step}`,
        })
        hasDiff = true
        if (!firstDivergence) {
          firstDivergence = {
            step: wasmLine.step || i + 1,
            wasmLine,
            typescriptLine,
            referenceLine,
            reason: `Different instructions: WASM=${wasmLine.instruction}, TypeScript=${typescriptLine.instruction}`,
          }
        }
      } else if (
        referenceLine &&
        referenceLine.type === 'instruction' &&
        referenceLine.instruction === wasmLine.instruction
      ) {
        matchesJamduna = true
      }

      // Check PC
      if (wasmLine.pc !== typescriptLine.pc) {
        differences.push({
          step: wasmLine.step || i + 1,
          type: 'pc',
          wasmValue: String(wasmLine.pc),
          typescriptValue: String(typescriptLine.pc),
          referenceValue: referenceLine?.pc ? String(referenceLine.pc) : undefined,
          details: `PC mismatch: WASM=${wasmLine.pc}, TypeScript=${typescriptLine.pc}`,
        })
        hasDiff = true
        if (!firstDivergence) {
          firstDivergence = {
            step: wasmLine.step || i + 1,
            wasmLine,
            typescriptLine,
            referenceLine,
            reason: `PC mismatch: WASM=${wasmLine.pc}, TypeScript=${typescriptLine.pc}`,
          }
        }
      }

      // Check gas
      if (wasmLine.gas !== typescriptLine.gas) {
        differences.push({
          step: wasmLine.step || i + 1,
          type: 'gas',
          wasmValue: String(wasmLine.gas),
          typescriptValue: String(typescriptLine.gas),
          referenceValue: referenceLine?.gas ? String(referenceLine.gas) : undefined,
          details: `Gas diff: ${wasmLine.gas! - typescriptLine.gas!} (WASM=${wasmLine.gas}, TypeScript=${typescriptLine.gas})`,
        })
        hasDiff = true
      }

      // Check registers
      if (wasmLine.registers && typescriptLine.registers) {
        const regDiffs: string[] = []
        const referenceRegDiffs: string[] = []
        for (
          let r = 0;
          r <
          Math.max(
            wasmLine.registers.length,
            typescriptLine.registers.length,
            referenceLine?.registers?.length || 0,
          );
          r++
        ) {
          const wasmReg = wasmLine.registers[r] || '0'
          const tsReg = typescriptLine.registers[r] || '0'
          const referenceReg = referenceLine?.registers?.[r] || '0'

          if (wasmReg !== tsReg) {
            regDiffs.push(`r${r}: WASM=${wasmReg} vs TS=${tsReg}`)
            if (
              referenceReg !== '0' &&
              referenceReg !== wasmReg &&
              referenceReg !== tsReg
            ) {
              referenceRegDiffs.push(`r${r}: reference=${referenceReg}`)
            }
          } else if (referenceReg !== '0' && referenceReg !== wasmReg) {
            referenceRegDiffs.push(
              `r${r}: WASM/TS=${wasmReg} vs reference=${referenceReg}`,
            )
          }
        }
        if (regDiffs.length > 0) {
          const details = `Register diffs: ${regDiffs.join('; ')}${referenceRegDiffs.length > 0 ? ` [reference: ${referenceRegDiffs.join('; ')}]` : ''}`
          differences.push({
            step: wasmLine.step || i + 1,
            type: 'registers',
            wasmValue: wasmLine.registers.join(', '),
            typescriptValue: typescriptLine.registers.join(', '),
            referenceValue: referenceLine?.registers?.join(', '),
            details,
          })
          hasDiff = true
          if (!firstDivergence) {
            firstDivergence = {
              step: wasmLine.step || i + 1,
              wasmLine,
              typescriptLine,
              referenceLine,
              reason: `Register mismatch: ${regDiffs[0]}`,
            }
          }
        }
      }

      if (!hasDiff) {
        matchingInstructions++
        if (
          matchesJamduna &&
          referenceLine &&
          referenceLine.type === 'instruction' &&
          referenceLine.pc === wasmLine.pc &&
          referenceLine.gas === wasmLine.gas
        ) {
          matchingWithJamduna++
        }
      }
    } else if (
      wasmLine.type === 'host_function' &&
      typescriptLine.type === 'host_function'
    ) {
      // Compare host function calls
      if (
        wasmLine.hostFunction?.name !== typescriptLine.hostFunction?.name ||
        wasmLine.hostFunction?.id !== typescriptLine.hostFunction?.id
      ) {
        differences.push({
          step: i + 1,
          type: 'instruction',
          wasmValue: `${wasmLine.hostFunction?.name} ${wasmLine.hostFunction?.id}`,
          typescriptValue: `${typescriptLine.hostFunction?.name} ${typescriptLine.hostFunction?.id}`,
          details: 'Host function mismatch',
        })
        if (!firstDivergence) {
          firstDivergence = {
            step: i + 1,
            wasmLine,
            typescriptLine,
            reason: `Host function mismatch: WASM=${wasmLine.hostFunction?.name}, TypeScript=${typescriptLine.hostFunction?.name}`,
          }
        }
      } else {
        matchingInstructions++
      }
    } else {
      // Different types
      differences.push({
        step: i + 1,
        type: 'instruction',
        wasmValue: wasmLine.type,
        typescriptValue: typescriptLine.type,
        details: `Type mismatch: WASM=${wasmLine.type}, TypeScript=${typescriptLine.type}`,
      })
      if (!firstDivergence) {
        firstDivergence = {
          step: i + 1,
          wasmLine,
          typescriptLine,
          reason: `Type mismatch: WASM=${wasmLine.type}, TypeScript=${typescriptLine.type}`,
        }
      }
    }
  }

  return {
    blockNumber,
    wasmFile,
    typescriptFile,
    referenceFile,
    wasmInstructionCount: wasmInstructions.length,
    typescriptInstructionCount: typescriptInstructions.length,
    referenceInstructionCount: referenceInstructions?.length,
    matchingInstructions,
    matchingWithJamduna: referenceInstructions ? matchingWithJamduna : undefined,
    firstDivergence,
    differences,
    wasmStoppedEarly: wasmInstructions.length < typescriptInstructions.length,
    typescriptStoppedEarly:
      typescriptInstructions.length < wasmInstructions.length,
    referenceStoppedEarly: referenceInstructions
      ? referenceInstructions.length <
        Math.max(wasmInstructions.length, typescriptInstructions.length)
      : undefined,
  }
}

function printComparison(result: ComparisonResult) {
  const is3Way = result.referenceFile !== undefined
  const title = is3Way
    ? `📊 WASM vs TypeScript vs reference Trace Comparison for Block ${result.blockNumber}`
    : `📊 WASM vs TypeScript Trace Comparison for Block ${result.blockNumber}`

  console.log(
    `${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`,
  )
  console.log(`${colors.bold}${title}${colors.reset}`)
  console.log(
    `${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`,
  )
  console.log()
  console.log(`${colors.cyan}WASM trace:${colors.reset} ${result.wasmFile}`)
  console.log(
    `${colors.cyan}TypeScript trace:${colors.reset} ${result.typescriptFile}`,
  )
  if (result.referenceFile) {
    console.log(
      `${colors.cyan}reference trace:${colors.reset} ${result.referenceFile}`,
    )
  }
  console.log()

  // Summary
  console.log(`${colors.bold}📈 Summary${colors.reset}`)
  console.log(`   WASM instructions:       ${result.wasmInstructionCount}`)
  console.log(
    `   TypeScript instructions: ${result.typescriptInstructionCount}`,
  )
  if (result.referenceInstructionCount !== undefined) {
    console.log(`   reference instructions:    ${result.referenceInstructionCount}`)
  }
  console.log(`   Matching (WASM/TS):     ${result.matchingInstructions}`)
  if (result.matchingWithJamduna !== undefined) {
    console.log(`   Matching (all 3):        ${result.matchingWithJamduna}`)
  }
  console.log(`   Differences:            ${result.differences.length}`)
  console.log()

  // Match percentage
  const matchPercent =
    result.typescriptInstructionCount > 0
      ? (
          (result.matchingInstructions /
            Math.min(
              result.wasmInstructionCount,
              result.typescriptInstructionCount,
            )) *
          100
        ).toFixed(2)
      : '0'
  const matchColor =
    Number.parseFloat(matchPercent) >= 99
      ? colors.green
      : Number.parseFloat(matchPercent) >= 90
        ? colors.yellow
        : colors.red
  console.log(`   ${matchColor}Match rate: ${matchPercent}%${colors.reset}`)
  console.log()

  // Early stop detection
  if (result.wasmStoppedEarly) {
    console.log(`${colors.red}⚠️  WASM trace stopped early${colors.reset}`)
    console.log(`   WASM stopped at step ${result.wasmInstructionCount}`)
    console.log(
      `   TypeScript continued to step ${result.typescriptInstructionCount}`,
    )
    console.log(
      `   Missing ${result.typescriptInstructionCount - result.wasmInstructionCount} instructions in WASM trace`,
    )
    console.log()
  }

  if (result.typescriptStoppedEarly) {
    console.log(
      `${colors.yellow}⚠️  TypeScript trace stopped early${colors.reset}`,
    )
    console.log(
      `   TypeScript stopped at step ${result.typescriptInstructionCount}`,
    )
    console.log(`   WASM continued to step ${result.wasmInstructionCount}`)
    console.log(
      `   Missing ${result.wasmInstructionCount - result.typescriptInstructionCount} instructions in TypeScript trace`,
    )
    console.log()
  }

  // First divergence
  if (result.firstDivergence) {
    console.log(`${colors.bold}🔍 First Divergence${colors.reset}`)
    console.log(`   Step: ${result.firstDivergence.step}`)
    console.log(
      `   Reason: ${colors.red}${result.firstDivergence.reason}${colors.reset}`,
    )
    console.log()

    if (result.firstDivergence.wasmLine) {
      console.log(
        `   ${colors.cyan}WASM:${colors.reset} ${result.firstDivergence.wasmLine.raw}`,
      )
    }
    if (result.firstDivergence.typescriptLine) {
      console.log(
        `   ${colors.cyan}TypeScript:${colors.reset} ${result.firstDivergence.typescriptLine.raw}`,
      )
    }
    if (result.firstDivergence.referenceLine) {
      console.log(
        `   ${colors.cyan}reference:${colors.reset} ${result.firstDivergence.referenceLine.raw}`,
      )
    }
    console.log()
  }

  // Show first 20 differences
  if (result.differences.length > 0) {
    console.log(
      `${colors.bold}📋 Differences (showing first 20 of ${result.differences.length})${colors.reset}`,
    )
    console.log()
    for (const diff of result.differences.slice(0, 20)) {
      const diffColor =
        diff.type === 'missing_wasm' ||
        diff.type === 'missing_typescript' ||
        diff.type === 'missing_reference'
          ? colors.red
          : colors.yellow
      console.log(
        `   ${diffColor}Step ${diff.step}: ${diff.type}${colors.reset}`,
      )
      if (diff.wasmValue) {
        console.log(`     WASM: ${diff.wasmValue}`)
      }
      if (diff.typescriptValue) {
        console.log(`     TypeScript: ${diff.typescriptValue}`)
      }
      if (diff.referenceValue) {
        console.log(`     reference: ${diff.referenceValue}`)
      }
      if (diff.details) {
        console.log(`     ${colors.dim}${diff.details}${colors.reset}`)
      }
      console.log()
    }

    if (result.differences.length > 20) {
      console.log(
        `   ${colors.dim}... and ${result.differences.length - 20} more differences${colors.reset}`,
      )
      console.log()
    }
  }

  console.log(
    `${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`,
  )
  console.log()
}

function findMatchingTraces(
  tracesDir: string,
  blockNumber?: number,
  referenceDir?: string,
  referenceBlockNumber?: number,
): Array<{
  block: number
  wasm: string
  typescript: string
  reference?: string
}> {
  const files = readdirSync(tracesDir).filter((f) => f.endsWith('.log'))
  const matches: Array<{
    block: number
    wasm: string
    typescript: string
    reference?: string
  }> = []

  if (blockNumber !== undefined) {
    // Look for specific block
    const wasmFile = files.find((f) => f.startsWith(`wasm-${blockNumber}.log`))
    const typescriptFile = files.find((f) =>
      f.startsWith(`typescript-${blockNumber}.log`),
    )

    let referenceFile: string | undefined
    if (referenceDir && existsSync(referenceDir)) {
      // Use referenceBlockNumber if provided, otherwise use blockNumber
      const referenceBlock =
        referenceBlockNumber !== undefined ? referenceBlockNumber : blockNumber
      // Look for reference trace: 00000004.log format (padded to 8 digits)
      const paddedBlock = String(referenceBlock).padStart(8, '0')
      const referencePath = join(referenceDir, `${paddedBlock}.log`)
      if (existsSync(referencePath)) {
        referenceFile = referencePath
      }
    }

    if (wasmFile && typescriptFile) {
      matches.push({
        block: blockNumber,
        wasm: join(tracesDir, wasmFile),
        typescript: join(tracesDir, typescriptFile),
        reference: referenceFile,
      })
    }
  } else {
    // Find all matching pairs
    const wasmFiles = files
      .filter((f) => f.startsWith('wasm-'))
      .map((f) => {
        const match = f.match(/wasm-(\d+)\.log/)
        return match ? { block: Number.parseInt(match[1], 10), file: f } : null
      })
      .filter((f): f is { block: number; file: string } => f !== null)

    for (const wasm of wasmFiles) {
      const typescriptFile = files.find(
        (f) => f === `typescript-${wasm.block}.log`,
      )
      if (typescriptFile) {
        let referenceFile: string | undefined
        if (referenceDir && existsSync(referenceDir)) {
          // Use referenceBlockNumber if provided, otherwise use wasm.block
          const referenceBlock =
            referenceBlockNumber !== undefined ? referenceBlockNumber : wasm.block
          const paddedBlock = String(referenceBlock).padStart(8, '0')
          const referencePath = join(referenceDir, `${paddedBlock}.log`)
          if (existsSync(referencePath)) {
            referenceFile = referencePath
          }
        }

        matches.push({
          block: wasm.block,
          wasm: join(tracesDir, wasm.file),
          typescript: join(tracesDir, typescriptFile),
          reference: referenceFile,
        })
      }
    }
  }

  return matches.sort((a, b) => a.block - b.block)
}

/**
 * Compare jam-conformance traces (TypeScript vs WASM for a specific service)
 */
function compareJamConformanceTraces(
  traceId: string,
  slot: number,
  orderedIndex: number,
  serviceId: number,
) {
  const tracesDir = join(
    process.cwd(),
    'pvm-traces',
    'jam-conformance',
    '0.7.2',
    traceId,
  )

  if (!existsSync(tracesDir)) {
    console.error(
      `${colors.red}Error: Trace directory not found: ${tracesDir}${colors.reset}`,
    )
    process.exit(1)
  }

  const tsFile = join(
    tracesDir,
    `typescript-${slot}-${orderedIndex}-${serviceId}.log`,
  )
  const wasmFile = join(
    tracesDir,
    `wasm-${slot}-${orderedIndex}-${serviceId}.log`,
  )
  const tsOutputFile = join(
    tracesDir,
    `typescript-${slot}-${orderedIndex}-${serviceId}-output.bin`,
  )
  const wasmOutputFile = join(
    tracesDir,
    `wasm-${slot}-${orderedIndex}-${serviceId}-output.bin`,
  )
  const tsErrFile = join(
    tracesDir,
    `typescript-${slot}-${orderedIndex}-${serviceId}-err.bin`,
  )
  const wasmErrFile = join(
    tracesDir,
    `wasm-${slot}-${orderedIndex}-${serviceId}-err.bin`,
  )

  console.log(
    `${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`,
  )
  console.log(
    `${colors.bold}📊 JAM Conformance Trace Comparison${colors.reset}`,
  )
  console.log(
    `${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`,
  )
  console.log()
  console.log(`${colors.cyan}Trace ID:${colors.reset}       ${traceId}`)
  console.log(`${colors.cyan}Slot:${colors.reset}           ${slot}`)
  console.log(`${colors.cyan}Ordered Index:${colors.reset}  ${orderedIndex}`)
  console.log(`${colors.cyan}Service ID:${colors.reset}     ${serviceId}`)
  console.log()

  // Check if files exist
  const tsExists = existsSync(tsFile)
  const wasmExists = existsSync(wasmFile)

  if (!tsExists && !wasmExists) {
    console.error(
      `${colors.red}Error: Neither TypeScript nor WASM trace found${colors.reset}`,
    )
    console.error(`  TypeScript: ${tsFile}`)
    console.error(`  WASM: ${wasmFile}`)
    process.exit(1)
  }

  console.log(`${colors.cyan}TypeScript trace:${colors.reset} ${tsExists ? '✓' : '✗'} ${tsFile}`)
  console.log(`${colors.cyan}WASM trace:${colors.reset}       ${wasmExists ? '✓' : '✗'} ${wasmFile}`)
  console.log()

  // Compare output files
  console.log(`${colors.bold}📦 Output Comparison${colors.reset}`)
  const tsOutputExists = existsSync(tsOutputFile)
  const wasmOutputExists = existsSync(wasmOutputFile)
  const tsErrExists = existsSync(tsErrFile)
  const wasmErrExists = existsSync(wasmErrFile)

  if (tsOutputExists && wasmOutputExists) {
    const tsOutput = readFileSync(tsOutputFile)
    const wasmOutput = readFileSync(wasmOutputFile)
    const outputsMatch = tsOutput.equals(wasmOutput)
    console.log(
      `   Outputs: ${outputsMatch ? colors.green + '✓ IDENTICAL' : colors.red + '✗ DIFFERENT'}${colors.reset}`,
    )
    if (!outputsMatch) {
      console.log(`   TS output:   ${tsOutput.toString('hex').substring(0, 64)}...`)
      console.log(`   WASM output: ${wasmOutput.toString('hex').substring(0, 64)}...`)
    } else {
      console.log(`   Output (hex): ${tsOutput.toString('hex').substring(0, 64)}...`)
    }
  } else if (tsOutputExists || wasmOutputExists) {
    console.log(
      `   ${colors.yellow}⚠️  Only one output file exists${colors.reset}`,
    )
    if (tsOutputExists) console.log(`   TS output: ${tsOutputFile}`)
    if (wasmOutputExists) console.log(`   WASM output: ${wasmOutputFile}`)
  } else {
    console.log(`   ${colors.dim}(no output files)${colors.reset}`)
  }

  // Compare error files
  if (tsErrExists || wasmErrExists) {
    const tsErr = tsErrExists ? readFileSync(tsErrFile) : null
    const wasmErr = wasmErrExists ? readFileSync(wasmErrFile) : null

    if (tsErr && wasmErr) {
      const errsMatch = tsErr.equals(wasmErr)
      console.log(
        `   Errors:  ${errsMatch ? colors.green + '✓ IDENTICAL' : colors.red + '✗ DIFFERENT'}${colors.reset}`,
      )
      if (!errsMatch) {
        console.log(`   TS error:   0x${tsErr.toString('hex')}`)
        console.log(`   WASM error: 0x${wasmErr.toString('hex')}`)
      } else {
        console.log(`   Error code: 0x${tsErr.toString('hex')}`)
      }
    } else {
      console.log(
        `   ${colors.yellow}⚠️  Only one error file exists${colors.reset}`,
      )
      if (tsErr) console.log(`   TS error: 0x${tsErr.toString('hex')}`)
      if (wasmErr) console.log(`   WASM error: 0x${wasmErr.toString('hex')}`)
    }
  }
  console.log()

  // If both trace files exist, compare them
  if (tsExists && wasmExists) {
    const typescriptLines = parseTraceFile(tsFile)
    const wasmLines = parseTraceFile(wasmFile)

    const result = compareTraces(
      wasmLines,
      typescriptLines,
      slot,
      basename(wasmFile),
      basename(tsFile),
    )

    // Print summary
    console.log(`${colors.bold}📈 Trace Comparison${colors.reset}`)
    console.log(`   TypeScript instructions: ${result.typescriptInstructionCount}`)
    console.log(`   WASM instructions:       ${result.wasmInstructionCount}`)
    console.log(`   Matching:                ${result.matchingInstructions}`)
    console.log(`   Differences:             ${result.differences.length}`)
    console.log()

    // Match percentage
    const matchPercent =
      result.typescriptInstructionCount > 0
        ? (
            (result.matchingInstructions /
              Math.min(
                result.wasmInstructionCount,
                result.typescriptInstructionCount,
              )) *
            100
          ).toFixed(2)
        : '0'
    const matchColor =
      Number.parseFloat(matchPercent) >= 99
        ? colors.green
        : Number.parseFloat(matchPercent) >= 90
          ? colors.yellow
          : colors.red
    console.log(`   ${matchColor}Match rate: ${matchPercent}%${colors.reset}`)
    console.log()

    if (result.differences.length === 0) {
      console.log(
        `${colors.green}✓ Traces are IDENTICAL - PVM execution matches between TypeScript and WASM${colors.reset}`,
      )
      console.log()
      console.log(
        `${colors.yellow}💡 If there's a state mismatch, it's in the POST-ACCUMULATION state application layer,${colors.reset}`,
      )
      console.log(
        `${colors.yellow}   not in the PVM execution itself.${colors.reset}`,
      )
    } else {
      // Show first divergence
      if (result.firstDivergence) {
        console.log(`${colors.bold}🔍 First Divergence${colors.reset}`)
        console.log(`   Step: ${result.firstDivergence.step}`)
        console.log(
          `   Reason: ${colors.red}${result.firstDivergence.reason}${colors.reset}`,
        )
        console.log()
      }

      // Show first 20 differences
      console.log(
        `${colors.bold}📋 Differences (showing first 20 of ${result.differences.length})${colors.reset}`,
      )
      console.log()
      for (const diff of result.differences.slice(0, 20)) {
        const diffColor =
          diff.type === 'missing_wasm' || diff.type === 'missing_typescript'
            ? colors.red
            : colors.yellow
        console.log(
          `   ${diffColor}Step ${diff.step}: ${diff.type}${colors.reset}`,
        )
        if (diff.wasmValue) console.log(`     WASM: ${diff.wasmValue}`)
        if (diff.typescriptValue) console.log(`     TypeScript: ${diff.typescriptValue}`)
        if (diff.details) console.log(`     ${colors.dim}${diff.details}${colors.reset}`)
        console.log()
      }
    }
  }

  console.log(
    `${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`,
  )
}

/**
 * List all available services in a jam-conformance trace directory
 */
function listJamConformanceServices(traceId: string) {
  const tracesDir = join(
    process.cwd(),
    'pvm-traces',
    'jam-conformance',
    '0.7.2',
    traceId,
  )

  if (!existsSync(tracesDir)) {
    console.error(
      `${colors.red}Error: Trace directory not found: ${tracesDir}${colors.reset}`,
    )
    process.exit(1)
  }

  const files = readdirSync(tracesDir).filter((f) => f.endsWith('.log'))

  // Parse file names to extract slot-orderedIndex-serviceId
  const services = new Map<
    string,
    { ts: boolean; wasm: boolean; slot: number; idx: number; service: number }
  >()

  for (const file of files) {
    const match = file.match(/(typescript|wasm)-(\d+)-(\d+)-(\d+)\.log/)
    if (match) {
      const [, executor, slot, idx, service] = match
      const key = `${slot}-${idx}-${service}`
      if (!services.has(key)) {
        services.set(key, {
          ts: false,
          wasm: false,
          slot: Number.parseInt(slot, 10),
          idx: Number.parseInt(idx, 10),
          service: Number.parseInt(service, 10),
        })
      }
      const entry = services.get(key)!
      if (executor === 'typescript') entry.ts = true
      if (executor === 'wasm') entry.wasm = true
    }
  }

  console.log(
    `${colors.bold}Available traces in ${traceId}:${colors.reset}`,
  )
  console.log()
  console.log(`${'Slot'.padEnd(8)} ${'Idx'.padEnd(4)} ${'Service'.padEnd(12)} TS   WASM`)
  console.log('-'.repeat(40))

  const sortedEntries = Array.from(services.entries()).sort((a, b) => {
    if (a[1].slot !== b[1].slot) return a[1].slot - b[1].slot
    if (a[1].idx !== b[1].idx) return a[1].idx - b[1].idx
    return a[1].service - b[1].service
  })

  for (const [, entry] of sortedEntries) {
    console.log(
      `${String(entry.slot).padEnd(8)} ${String(entry.idx).padEnd(4)} ${String(entry.service).padEnd(12)} ${entry.ts ? colors.green + '✓' : colors.red + '✗'}${colors.reset}    ${entry.wasm ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`,
    )
  }
}

// Main execution
const tracesDir = join(process.cwd(), 'pvm-traces')

// Parse command line arguments
let blockNumber: number | undefined
let referenceDir: string | undefined
let referenceBlockNumber: number | undefined

// Check for --jam-conformance mode
if (process.argv[2] === '--jam-conformance') {
  const traceId = process.argv[3]
  if (!traceId) {
    console.error(
      `${colors.red}Error: trace_id required for --jam-conformance${colors.reset}`,
    )
    console.log(
      `\nUsage: bun scripts/compare-wasm-typescript-traces.ts --jam-conformance <trace_id> [slot] [ordered_index] [service_id]`,
    )
    console.log(
      `       bun scripts/compare-wasm-typescript-traces.ts --jam-conformance <trace_id> --list`,
    )
    process.exit(1)
  }

  if (process.argv[4] === '--list') {
    listJamConformanceServices(traceId)
    process.exit(0)
  }

  const slot = process.argv[4] ? Number.parseInt(process.argv[4], 10) : undefined
  const orderedIndex = process.argv[5]
    ? Number.parseInt(process.argv[5], 10)
    : undefined
  const serviceId = process.argv[6]
    ? Number.parseInt(process.argv[6], 10)
    : undefined

  if (slot === undefined || orderedIndex === undefined || serviceId === undefined) {
    console.log(
      `${colors.yellow}Listing available services (use --list or provide slot, ordered_index, service_id):${colors.reset}`,
    )
    console.log()
    listJamConformanceServices(traceId)
    process.exit(0)
  }

  compareJamConformanceTraces(traceId, slot, orderedIndex, serviceId)
  process.exit(0)
}

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i]
  if (arg === '--reference-dir' && i + 1 < process.argv.length) {
    referenceDir = process.argv[++i]
  } else if (arg === '--reference-block' && i + 1 < process.argv.length) {
    const parsed = Number.parseInt(process.argv[++i], 10)
    if (!Number.isNaN(parsed)) {
      referenceBlockNumber = parsed
    }
  } else {
    const parsed = Number.parseInt(arg, 10)
    if (!Number.isNaN(parsed)) {
      blockNumber = parsed
    }
  }
}

// Default reference directory for preimages_light
if (!referenceDir && blockNumber !== undefined) {
  const defaultJamdunaPath = join(
    process.cwd(),
    'submodules',
    'reference',
    'jam-test-vectors',
    '0.7.1',
    'preimages_light',
  )
  if (existsSync(defaultJamdunaPath)) {
    referenceDir = defaultJamdunaPath
  }
}

if (!existsSync(tracesDir)) {
  console.error(
    `${colors.red}Error: pvm-traces directory not found${colors.reset}`,
  )
  process.exit(1)
}

const matches = findMatchingTraces(
  tracesDir,
  blockNumber,
  referenceDir,
  referenceBlockNumber,
)

if (matches.length === 0) {
  if (blockNumber !== undefined) {
    console.error(
      `${colors.red}Error: No matching traces found for block ${blockNumber}${colors.reset}`,
    )
  } else {
    console.error(
      `${colors.red}Error: No matching WASM/TypeScript trace pairs found${colors.reset}`,
    )
  }
  process.exit(1)
}

const hasJamduna = matches.some((m) => m.reference !== undefined)
console.log(
  `${colors.bold}Found ${matches.length} matching trace pair(s)${hasJamduna ? ' (with reference)' : ''}${colors.reset}\n`,
)

for (const match of matches) {
  const wasmLines = parseTraceFile(match.wasm)
  const typescriptLines = parseTraceFile(match.typescript)
  const referenceLines = match.reference ? parseTraceFile(match.reference) : undefined

  const result = compareTraces(
    wasmLines,
    typescriptLines,
    match.block,
    basename(match.wasm),
    basename(match.typescript),
    referenceLines,
    match.reference ? basename(match.reference) : undefined,
  )

  printComparison(result)
}
