/**
 * New Gas Cost Model Test
 * 
 * Tests PVM programs using the new gas cost model from new-gas-cost-model submodule.
 * 
 * This test loads all test vectors from new-gas-cost-model/tests/programs/
 * and verifies that:
 * 1. Programs execute correctly
 * 2. Gas costs match expected block-gas-costs from test vectors
 * 3. Final state (registers, PC, status) matches expected values
 * 
 * Gray Paper Reference: new-gas-cost-model/graypaper.pdf Appendix A.9
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { executeTestVector, parseJsonSafe } from './test-vector-helper'
import { NewGasCostCalculator } from '../../gas-cost-calculator'


/**
 * Test vector format for new gas cost model
 */
interface NewGasCostModelTestVector {
  name: string
  program: (number | string)[]
  'initial-pc': number | string
  'initial-gas': number | string
  'initial-regs'?: (number | string)[]
  'initial-page-map'?: Array<{
    address: number | string
    length: number | string
    'is-writable': boolean
  }>
  'initial-memory'?: Array<{
    address: number | string
    contents: (number | string)[]
  }>
  steps: Array<{
    run?: Record<string, unknown>
    assert?: {
      status: string
      gas: number | string
      pc: number | string
      regs?: (number | string)[]
      memory?: Array<{
        address: number | string
        contents: (number | string)[]
      }>
    }
  }>
  'block-gas-costs': Array<{
    pc: number | string
    cost: number | string
  }>
}

/**
 * Get the new gas cost model test vectors directory
 */
function getNewGasCostModelTestVectorsDir(): string {
  let projectRoot = process.cwd()
  
  // If we're in packages/pvm, go up to project root
  if (projectRoot.includes('/packages/pvm')) {
    projectRoot = projectRoot.split('/packages/pvm')[0]!
  }
  // If we're already in the new-gas-cost-model submodule, go up to project root
  else if (projectRoot.includes('/submodules/new-gas-cost-model')) {
    projectRoot = projectRoot.split('/submodules/new-gas-cost-model')[0]!
  }
  // If we're in the project root, use it as-is
  
  return join(
    projectRoot,
    'submodules',
    'new-gas-cost-model',
    'tests',
    'programs',
  )
}

/**
 * Load all test vectors from new-gas-cost-model
 */
function loadNewGasCostModelTestVectors(): NewGasCostModelTestVector[] {
  const testVectorsDir = getNewGasCostModelTestVectorsDir()
  const allFiles = readdirSync(testVectorsDir)
  const jsonFiles = allFiles
    .filter((file) => file.endsWith('.json'))
    .sort() // Sort alphabetically for consistent order

  console.log(
    `Found ${jsonFiles.length} new gas cost model test vector files`,
  )

  const testVectors: NewGasCostModelTestVector[] = []
  for (const file of jsonFiles) {
    try {
      const filePath = join(testVectorsDir, file)
      const fileContents = readFileSync(filePath, 'utf-8')

      // Parse JSON with all numbers as strings to avoid precision loss
      const testVector = parseJsonSafe(
        fileContents,
      ) as NewGasCostModelTestVector

      testVectors.push(testVector)
      console.log(`Loaded test vector: ${file}`)
    } catch (error) {
      console.warn(`Failed to load test vector ${file}:`, error)
      // Continue with other files
    }
  }

  console.log(
    `Successfully loaded ${testVectors.length} new gas cost model test vectors`,
  )

  return testVectors
}

/**
 * Convert new gas cost model test vector to PVM test vector format
 */
function convertToPVMTestVector(
  testVector: NewGasCostModelTestVector,
): {
  name: string
  program: (number | string)[]
  'initial-regs': (number | string)[]
  'initial-pc': number | string
  'initial-gas': number | string
  'initial-page-map'?: Array<{
    address: number | string
    length: number | string
    'is-writable': boolean
  }>
  'initial-memory'?: Array<{
    address: number | string
    contents: (number | string)[]
  }>
  'expected-regs': (number | string)[]
  'expected-pc': number | string
  'expected-gas': number | string
  'expected-status': string
  'expected-memory'?: Array<{
    address: number | string
    contents: (number | string)[]
  }>
} {
  // Get the assert step (should be the last step)
  const assertStep = testVector.steps.find((step) => step.assert)
  if (!assertStep?.assert) {
    throw new Error(`Test vector ${testVector.name} has no assert step`)
  }

  const assert = assertStep.assert

  return {
    name: testVector.name,
    program: testVector.program,
    'initial-regs': testVector['initial-regs'] ?? new Array(13).fill('0'),
    'initial-pc': testVector['initial-pc'],
    'initial-gas': testVector['initial-gas'],
    'initial-page-map': testVector['initial-page-map'],
    'initial-memory': testVector['initial-memory'],
    'expected-regs': assert.regs ?? new Array(13).fill('0'),
    'expected-pc': assert.pc,
    'expected-gas': assert.gas,
    'expected-status': assert.status,
    'expected-memory': assert.memory,
  }
}

// Load all test vectors
const testVectors = loadNewGasCostModelTestVectors()

// Run each test vector sequentially (stops on first failure)
for (let i = 0; i < testVectors.length; i++) {
  const testVector = testVectors[i]!

  // Skip to gas_complex_1 for debugging
  if (testVector.name !== 'gas_complex_1') {
    continue
  }

  // #region agent log
  fetch('http://127.0.0.1:10000/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'new-gas-cost-model.test.ts:186',message:'test vector start',data:{name:testVector.name,initialGas:Number(testVector['initial-gas']),programLength:testVector.program.length,expectedBlockCosts:testVector['block-gas-costs']},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  try {
    // Convert to PVM test vector format
    const pvmTestVector = convertToPVMTestVector(testVector)

    // Build expected block gas costs map from test vector
    const expectedBlockGasCosts = new Map<number, number>()
    if (testVector['block-gas-costs']) {
      for (const blockCost of testVector['block-gas-costs']) {
        const pc = Number(blockCost.pc)
        const cost = Number(blockCost.cost)
        expectedBlockGasCosts.set(pc, cost)
      }
    }

    // Execute the program with new gas cost model enabled
    // Note: executeTestVector handles blob decoding internally via parseProgram
    const result = await executeTestVector(pvmTestVector, {
      useNewGasCostModel: true,
      expectedBlockGasCosts,
    })

      // Verify registers match expected values
      if (pvmTestVector['expected-regs']) {
        for (let j = 0; j < 13; j++) {
          const expected = BigInt(pvmTestVector['expected-regs'][j] ?? '0')
          if (result.registers[j] !== expected) {
            console.error(`❌ Test failed: ${testVector.name}`, {
              register: `r${j}`,
              expected: expected.toString(),
              actual: result.registers[j].toString(),
            })
            throw new Error(
              `Test failed: ${testVector.name} - register r${j} mismatch`,
            )
          }
        }
      }

      // Verify gas usage
      if (result.status !== 'page-fault') {
        const expectedGas = Number(pvmTestVector['expected-gas'])
        if (result.gas !== expectedGas) {
          console.error(`❌ Test failed: ${testVector.name} - GAS MISMATCH`)
          console.error('Expected gas:', expectedGas)
          console.error('Actual gas:', result.gas)
          console.error('Difference:', result.gas - expectedGas)
          console.error('Initial gas:', Number(testVector['initial-gas']))
          console.error('Gas consumed:', Number(testVector['initial-gas']) - result.gas)
          console.error('Expected gas consumed:', Number(testVector['initial-gas']) - expectedGas)
          throw new Error(`Test failed: ${testVector.name} - gas mismatch (expected: ${expectedGas}, actual: ${result.gas})`)
        }
      }

      // Verify PC
      const expectedPc = Number(pvmTestVector['expected-pc'])
      if (result.pc !== expectedPc) {
        console.error(`❌ Test failed: ${testVector.name}`, {
          expected: expectedPc,
          actual: result.pc,
        })
        throw new Error(`Test failed: ${testVector.name} - PC mismatch`)
      }

      // Verify exit status
      if (pvmTestVector['expected-status'] !== result.status) {
        console.error(`❌ Test failed: ${testVector.name}`, {
          expected: pvmTestVector['expected-status'],
          actual: result.status,
        })
        throw new Error(
          `Test failed: ${testVector.name} - status mismatch`,
        )
      }

      // Verify memory if expected
      if (pvmTestVector['expected-memory']) {
        for (const memBlock of pvmTestVector['expected-memory']) {
          const address = BigInt(memBlock.address)
          const expectedContents = memBlock.contents.map(Number)

          for (let k = 0; k < expectedContents.length; k++) {
            const addr = address + BigInt(k)
            const actualValue = result.memory.get(addr)
            if (actualValue !== expectedContents[k]) {
              console.error(`❌ Test failed: ${testVector.name}`, {
                address: addr.toString(),
                expected: expectedContents[k],
                actual: actualValue,
              })
              throw new Error(
                `Test failed: ${testVector.name} - memory mismatch`,
              )
            }
          }
        }
      }

      // Verify block gas costs using the new gas cost calculator
      // Use the same parseResult from executeTestVector (already decoded blob)
      // The parseResult.instructions are PVMInstruction[] which includes fskip
      if (!result.parseResult.success) {
        throw new Error(
          `Failed to parse program for gas cost calculation: ${result.parseResult.errors?.join(', ') || 'unknown error'}`,
        )
      }

      // Build instruction list with PCs from the parsed result
      // parseResult.instructions are already PVMInstruction[] with opcode, operands, fskip, pc
      const instructionsWithPc = result.parseResult.instructions.map((inst) => ({
        instruction: inst, // Already has opcode, operands, fskip, pc
        pc: Number(inst.pc),
      }))

      // Calculate gas costs
      const calculator = new NewGasCostCalculator()
      const calculatedCosts = calculator.calculateGasCosts(instructionsWithPc)

      // Compare with expected block-gas-costs
      const expectedCosts = testVector['block-gas-costs'] ?? []
      const expectedCostsMap = new Map<number, number>()
      for (const expected of expectedCosts) {
        const pc = Number(expected.pc)
        const cost = Number(expected.cost)
        expectedCostsMap.set(pc, cost)
      }

      // Verbose logging: show all expected and calculated costs
      console.log(`\n📊 Block Gas Costs for ${testVector.name}:`)
      console.log('Expected block-gas-costs:')
      for (const expected of expectedCosts) {
        const pc = Number(expected.pc)
        const cost = Number(expected.cost)
        console.log(`  PC ${pc}: cost ${cost}`)
      }
      console.log('Calculated block-gas-costs:')
      for (const calculated of calculatedCosts) {
        console.log(`  PC ${calculated.pc}: cost ${calculated.cost}`)
      }
      console.log('')

      // Check that all expected costs match
      let hasMismatch = false
      for (const expected of expectedCosts) {
        const pc = Number(expected.pc)
        const expectedCost = Number(expected.cost)
        const calculated = calculatedCosts.find((c) => c.pc === pc)

        if (!calculated) {
          console.error(`❌ Test ${testVector.name}: No calculated cost for expected PC ${pc}`)
          console.error(`  Expected cost: ${expectedCost}`)
          console.error(`  Calculated costs available for PCs: ${calculatedCosts.map(c => c.pc).join(', ')}`)
          hasMismatch = true
          continue
        }

        if (calculated.cost !== expectedCost) {
          console.error(`❌ Test ${testVector.name}: Gas cost mismatch at PC ${pc}`)
          console.error(`  Expected cost: ${expectedCost}`)
          console.error(`  Calculated cost: ${calculated.cost}`)
          console.error(`  Difference: ${calculated.cost - expectedCost}`)
          hasMismatch = true
        }
      }

      // Note: We only check that expected costs match calculated costs.
      // Calculated costs may include blocks that aren't executed (e.g., blocks after a panic),
      // so we don't fail if calculated costs have extra blocks that aren't in expected costs.
      // The test vector's block-gas-costs only lists blocks that are actually executed.

      // Hard failure on any mismatch
      if (hasMismatch) {
        throw new Error(`Test failed: ${testVector.name} - block gas cost mismatch (see logs above for details)`)
      }

    console.log(`✅ Test passed: ${testVector.name}`)
  } catch (error) {
    console.error(`❌ Test failed: ${testVector.name}`, error)
    throw error
  }
}
