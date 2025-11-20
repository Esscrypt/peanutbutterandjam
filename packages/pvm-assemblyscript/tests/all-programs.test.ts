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
  .filter(file => !file.startsWith('riscv'))
  .sort() // Sort alphabetically for consistent order

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

      // Verify registers match expected values (compare as bytes)
      // Registers are stored as 104 bytes (13 registers x 8 bytes each, little-endian)
      const expectedRegisters = new Uint8Array(104)
      const expectedRegisterView = new DataView(expectedRegisters.buffer)
      for (let j = 0; j < 13; j++) {
          const expectedValue = BigInt(String(testVector['expected-regs'][j]))
          expectedRegisterView.setBigUint64(j * 8, expectedValue, true) // little-endian
      }
      
      // Compare byte-by-byte
      // Ensure result.registers is a proper Uint8Array with a buffer
      if (!result.registers || !(result.registers instanceof Uint8Array)) {
        throw new Error(`Test failed: ${testVector.name} - registers is not a Uint8Array: ${typeof result.registers}`)
      }
      
      // Create a new Uint8Array copy to ensure we have a proper buffer
      // __liftTypedArray returns a sliced view which may have buffer issues
      const actualRegisters = new Uint8Array(result.registers)
      
      for (let i = 0; i < 104; i++) {
          if(actualRegisters[i] !== expectedRegisters[i]) {
              const registerIndex = Math.floor(i / 8)
              const byteOffset = i % 8
              const actualValue = new DataView(actualRegisters.buffer).getBigUint64(registerIndex * 8, true)
              const expectedValue = new DataView(expectedRegisters.buffer).getBigUint64(registerIndex * 8, true)
              console.error(`❌ Test failed: ${testVector.name}`, {
                  register: registerIndex,
                  byteOffset: byteOffset,
                  expectedByte: expectedRegisters[i],
                  actualByte: actualRegisters[i],
                  expectedValue: expectedValue.toString(),
                  actualValue: actualValue.toString(),
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

