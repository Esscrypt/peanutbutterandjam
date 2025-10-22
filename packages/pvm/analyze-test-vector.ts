#!/usr/bin/env bun

/**
 * Test Vector Analyzer
 *
 * Takes a test vector JSON file and analyzes the program section,
 * replacing known opcodes with their instruction names.
 *
 * Usage: bun run analyze-test-vector.ts <input-file> [output-file]
 */

import fs from 'node:fs'
import { InstructionRegistry } from './src/instructions/registry'

interface TestVector {
  name: string
  'initial-regs': number[]
  'initial-pc': number
  'initial-page-map': any[]
  'initial-memory': any[]
  'initial-gas': number
  program: number[]
  'expected-status': string
  'expected-regs': number[]
  'expected-pc': number
  'expected-memory': any[]
  'expected-gas': number
}

interface AnalyzedInstruction {
  index: number
  opcode: number
  instructionName: string | null
  operandBytes: number[]
  operandLength: number
  isKnown: boolean
}

interface AnalyzedProgram {
  originalProgram: number[]
  instructions: AnalyzedInstruction[]
  summary: {
    totalBytes: number
    knownInstructions: number
    unknownBytes: number
    instructionCount: number
  }
}

/**
 * Analyze a program array and replace known opcodes with instruction names
 */
function analyzeProgram(
  program: number[],
  registry: InstructionRegistry,
): AnalyzedProgram {
  const instructions: AnalyzedInstruction[] = []
  let knownInstructions = 0
  let unknownBytes = 0

  let i = 0
  while (i < program.length) {
    const opcode = program[i]
    const handler = registry.getHandler(BigInt(opcode))
    const isKnown = handler !== null

    if (isKnown && handler) {
      // This is a known instruction
      const instructionName = handler.name || `OPCODE_${opcode}`

      // Get operand length using the instruction's method
      const operands = new Uint8Array(program.slice(i + 1))
      const operandLength = handler.getOperandLength(operands)

      // Extract operand bytes
      const operandBytes = program.slice(i + 1, i + 1 + operandLength)

      instructions.push({
        index: i,
        opcode,
        instructionName,
        operandBytes,
        operandLength,
        isKnown: true,
      })

      knownInstructions++
      i = i + 1 + operandLength // Move to next instruction
    } else {
      // This is an unknown byte (could be operand data)
      instructions.push({
        index: i,
        opcode,
        instructionName: null,
        operandBytes: [],
        operandLength: 0,
        isKnown: false,
      })

      unknownBytes++
      i++ // Move to next byte
    }
  }

  return {
    originalProgram: program,
    instructions,
    summary: {
      totalBytes: program.length,
      knownInstructions,
      unknownBytes,
      instructionCount: instructions.length,
    },
  }
}

/**
 * Format the analyzed program for output
 */
function formatAnalyzedProgram(analysis: AnalyzedProgram): string {
  let output = 'Program Analysis:\n'
  output += `${'='.repeat(50)}\n\n`

  output += `Summary:\n`
  output += `  Total bytes: ${analysis.summary.totalBytes}\n`
  output += `  Known instructions: ${analysis.summary.knownInstructions}\n`
  output += `  Unknown bytes: ${analysis.summary.unknownBytes}\n`
  output += `  Total instructions: ${analysis.summary.instructionCount}\n\n`

  output += `Instructions:\n`
  output += `Index | Opcode | Instruction Name | Operands | Length\n`
  output += `${`-`.repeat(60)}\n`

  for (const instruction of analysis.instructions) {
    const index = instruction.index.toString().padEnd(5)
    const opcode = `0x${instruction.opcode.toString(16).toUpperCase()}`.padEnd(
      6,
    )
    const name = (instruction.instructionName || 'UNKNOWN').padEnd(20)
    const operands =
      instruction.operandBytes.length > 0
        ? `[${instruction.operandBytes.map((b) => `0x${b.toString(16).toUpperCase()}`).join(', ')}]`
        : '[]'
    const length = instruction.operandLength.toString()

    output += `${index} | ${opcode} | ${name} | ${operands.padEnd(20)} | ${length}\n`
  }

  return output
}

/**
 * Create a JSON representation of the analyzed program
 */
function createAnalyzedJSON(
  testVector: TestVector,
  analysis: AnalyzedProgram,
): any {
  return {
    originalTestVector: testVector,
    analysis: {
      program: analysis.originalProgram,
      instructions: analysis.instructions.map((inst) => ({
        index: inst.index,
        opcode: inst.opcode,
        instructionName: inst.instructionName,
        operandBytes: inst.operandBytes,
        operandLength: inst.operandLength,
        isKnown: inst.isKnown,
      })),
      summary: analysis.summary,
    },
    formattedAnalysis: formatAnalyzedProgram(analysis),
  }
}

/**
 * Main function
 */
function main(): void {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error(
      'Usage: bun run analyze-test-vector.ts <input-file> [output-file]',
    )
    console.error(
      'Example: bun run analyze-test-vector.ts inst_branch_eq_ok.json analyzed.json',
    )
    process.exit(1)
  }

  const inputFile = args[0]
  const outputFile = args[1] || inputFile.replace('.json', '_analyzed.json')

  console.log('🔍 Initializing instruction registry...')
  const registry = new InstructionRegistry()
  console.log(`   Registered ${registry.handlers.size} instructions`)

  console.log(`\n📖 Reading test vector: ${inputFile}`)

  try {
    const content = fs.readFileSync(inputFile, 'utf8')
    const testVector: TestVector = JSON.parse(content)

    console.log(`   Test vector: ${testVector.name}`)
    console.log(`   Program length: ${testVector.program.length} bytes`)

    console.log('\n🔬 Analyzing program...')
    const analysis = analyzeProgram(testVector.program, registry)

    console.log(
      `   Found ${analysis.summary.knownInstructions} known instructions`,
    )
    console.log(`   Found ${analysis.summary.unknownBytes} unknown bytes`)

    console.log('\n📊 Analysis Results:')
    console.log(formatAnalyzedProgram(analysis))

    console.log(`\n💾 Writing analyzed data to: ${outputFile}`)
    const analyzedData = createAnalyzedJSON(testVector, analysis)
    fs.writeFileSync(outputFile, JSON.stringify(analyzedData, null, 2))

    console.log('✅ Analysis complete!')
  } catch (error) {
    console.error(`❌ Error: ${(error as Error).message}`)
    process.exit(1)
  }
}

// Run the analysis
main()
