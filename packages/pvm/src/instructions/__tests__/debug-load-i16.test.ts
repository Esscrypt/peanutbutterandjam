/**
 * Debug test for inst_load_i16
 * Loads and executes the test vector, logging all instructions and execution details
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { executeTestVector, getTestVectorsDir, parseJsonSafe, type PVMTestVector } from './test-vector-helper'

describe('Debug inst_load_i16', () => {
  it('should load and execute inst_load_i16 with detailed logging', async () => {
    const testVectorsDir = getTestVectorsDir()
    const filePath = join(testVectorsDir, 'inst_load_i16.json')
    const fileContents = readFileSync(filePath, 'utf-8')
    const testVector = parseJsonSafe(fileContents) as PVMTestVector

    console.log('\n=== Test Vector: inst_load_i16 ===')
    console.log('Program bytes:', testVector.program)
    console.log('Initial PC:', testVector['initial-pc'])
    console.log('Initial registers:', testVector['initial-regs'])
    console.log('Initial gas:', testVector['initial-gas'])
    console.log('Initial memory:', testVector['initial-memory'])
    console.log('Expected status:', testVector['expected-status'])
    console.log('Expected registers:', testVector['expected-regs'])
    console.log('Expected PC:', testVector['expected-pc'])
    console.log('Expected gas:', testVector['expected-gas'])

    // Execute the program
    const result = await executeTestVector(testVector)

    console.log('\n=== Execution Result ===')
    console.log('Final registers:', result.registers.map(r => r.toString()))
    console.log('Final PC:', result.pc)
    console.log('Final gas:', result.gas)
    console.log('Final status:', result.status)
    console.log('Fault address:', result.faultAddress?.toString() || 'null')

    console.log('\n=== Parsed Instructions ===')
    console.log('Number of instructions:', result.parseResult.instructions.length)
    result.parseResult.instructions.forEach((inst, idx) => {
      console.log(`  [${idx}] PC ${inst.pc}: opcode ${inst.opcode} (0x${inst.opcode.toString(16)}), operands: [${Array.from(inst.operands).join(', ')}], fskip: ${inst.fskip}`)
    })

    console.log('\n=== Bitmask ===')
    console.log('Bitmask:', Array.from(result.parseResult.bitmask).slice(0, 20).join(', '))

    console.log('\n=== Jump Table ===')
    console.log('Jump table:', result.parseResult.jumpTable)

    // Verify results
    console.log('\n=== Verification ===')
    for (let j = 0; j < 13; j++) {
      const expected = BigInt(testVector['expected-regs'][j])
      const actual = result.registers[j]
      if (actual !== expected) {
        console.log(`  ❌ Register ${j}: expected ${expected.toString()}, got ${actual.toString()}`)
      } else {
        console.log(`  ✅ Register ${j}: ${actual.toString()}`)
      }
    }

    expect(result.pc).toBe(Number(testVector['expected-pc']))
    expect(result.status).toBe(testVector['expected-status'])
    expect(result.gas).toBe(Number(testVector['expected-gas']))
  })
})

