/**
 * PVM All Programs Test
 * Runs each PVM test JSON from the programs directory in order
 * 
 * This test loads all test vectors from pvm-test-vectors/pvm/programs/
 * and executes them sequentially to verify PVM correctness
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { executeTestVector, getTestVectorsDir, parseJsonSafe, type PVMTestVector } from './test-vector-helper'


const testVectorsDir = getTestVectorsDir()
const allFiles = readdirSync(testVectorsDir)
const jsonFiles = allFiles
  .filter(file => file.endsWith('.json'))
  .filter(file => file.startsWith('riscv'))
  // .filter(file => !file.startsWith('riscv_rv64um_divw')) // filter out passing tests
  // .filter(file => !file.startsWith('riscv_rv64ua_amomaxu_w')) // filter out passing tests
  // .filter(file => !file.startsWith('riscv_rv64ui_sh')) // does not pass, because STORE_IND_U16 should sign extend according to GP, but not in this riscv variation
  // .filter(file => !file.startsWith('riscv_rv64ui_sd')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64ui_slli')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64ui_lh')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64ui_ld')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64ua_amomin_d')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64ua_amomaxu_d')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64ui_lw')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64ua_amoxor_w')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64uc_rvc')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64ua_amoor_w')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64ua_amoor_d')) // does not pass, deal with it late

  // r
  // .sort() // Sort alphabetically for consistent order

console.log(`Found ${jsonFiles.length} test vector files`)

// Load all test vectors
const testVectors: PVMTestVector[] = []
for (const file of jsonFiles) {
  try {
    const filePath = join(testVectorsDir, file)
    const fileContents = readFileSync(filePath, 'utf-8')
    
    // Parse JSON with all numbers as strings to avoid precision loss
    const testVector = parseJsonSafe(fileContents) as PVMTestVector
    
    testVectors.push(testVector)
    console.log(`Loaded test vector: ${file}`)
  } catch (error) {
    console.warn(`Failed to load test vector ${file}:`, error)
    // Continue with other files
  }
}

console.log(`Successfully loaded ${testVectors.length} test vectors`)

// Run each test vector
for (let i = 0; i < testVectors.length; i++) {
  const testVector = testVectors[i]
  
  try {
      // Execute the program
      const result = await executeTestVector(testVector)

      // Verify registers match expected values
      for (let j = 0; j < 13; j++) {
          if(result.registers[j] !== BigInt(testVector['expected-regs'][j])) {
              console.error(`❌ Test failed: ${testVector.name}`, {
                  expected: `${testVector['expected-regs'][j]} at register ${j}`,
                  actual: `${result.registers[j]} at register ${j}`,
              })
              throw new Error(`Test failed: ${testVector.name}`)
          }
      }

      // Verify gas usage
      if(result.status !== 'page-fault') {
        if(result.gas !== Number(testVector['expected-gas'])) {
            console.error(`❌ Test failed: ${testVector.name}`, {
                expected: testVector['expected-gas'],
                actual: result.gas,
            })
            throw new Error(`Test failed: ${testVector.name}`)
        }
    }

      // Verify PC
      if(result.pc !== Number(testVector['expected-pc'])) {
          console.error(`❌ Test failed: ${testVector.name}`, {
              expected: testVector['expected-pc'],
              actual: result.pc,
          })
          throw new Error(`Test failed: ${testVector.name}`)
      }

      // Verify exit status
      if(testVector['expected-status'] !== result.status) {
        console.error(`❌ Test failed: ${testVector.name}`, {
          expected: testVector['expected-status'],
          actual: result.status,
        })
        throw new Error(`Test failed: ${testVector.name}`)
      }

      // Verify page fault address
      if(testVector['expected-page-fault-address'] && result.faultAddress !== BigInt(testVector['expected-page-fault-address'])) {
        console.error(`❌ Test failed: ${testVector.name}`, {
          expected: testVector['expected-page-fault-address'],
          actual: result.faultAddress,
        })
        throw new Error(`Test failed: ${testVector.name}`)
      }

      // Verify memory if expected
      if (testVector['expected-memory']) {
        for (const memBlock of testVector['expected-memory']) {
          const address = BigInt(memBlock.address)
          const expectedContents = memBlock.contents.map(Number)
          
          for (let k = 0; k < expectedContents.length; k++) {
            const addr = address + BigInt(k)
            const actualValue = result.memory.get(addr)
            if(actualValue !== expectedContents[k]) {
              console.error(`❌ Test failed: ${testVector.name}`, {
                  expected: expectedContents[k],
                  actual: actualValue,
              })
              throw new Error(`Test failed: ${testVector.name}`)
            }
          }
        }
      }

      console.log(`✅ Test passed: ${testVector.name}`)
    } catch (error) {
      console.error(`❌ Test failed: ${testVector.name}`, error)
      
      
      throw error
    }
  }

