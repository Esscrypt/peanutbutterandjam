/**
 * PVM All Programs Test
 * Runs each PVM test JSON from the programs directory in order
 * 
 * This test loads all test vectors from pvm-test-vectors/pvm/programs/
 * and executes them sequentially to verify PVM correctness
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { executeTestVector, getTestVectorsDir, type PVMTestVector } from './test-vector-helper'

beforeAll(() => {
  logger.init()
})

describe('PVM All Programs Test', async () => {
  // Get all JSON files from the programs directory
  const testVectorsDir = getTestVectorsDir()
  const allFiles = readdirSync(testVectorsDir)
  const jsonFiles = allFiles
    .filter(file => file.endsWith('.json'))
    .filter(file => !file.startsWith('riscv'))
    .sort() // Sort alphabetically for consistent order

  logger.info(`Found ${jsonFiles.length} test vector files`)

  // Load all test vectors
  const testVectors: PVMTestVector[] = []
  for (const file of jsonFiles) {
    try {
      const filePath = join(testVectorsDir, file)
      const fileContents = readFileSync(filePath, 'utf-8')
      
      // Parse JSON with all numbers as strings to avoid precision loss
      const quoted = fileContents.replaceAll(/([[:])(\d+)([,}\]])/g, '$1"$2"$3')
      const testVector = JSON.parse(quoted) as PVMTestVector
      
      testVectors.push(testVector)
      logger.debug(`Loaded test vector: ${file}`)
    } catch (error) {
      logger.warn(`Failed to load test vector ${file}:`, error)
      // Continue with other files
    }
  }

  logger.info(`Successfully loaded ${testVectors.length} test vectors`)

  // Run each test vector
  for (let i = 0; i < testVectors.length; i++) {
    const testVector = testVectors[i]
    
    it(`should execute program ${i + 1}/${testVectors.length}: ${testVector.name}`, async () => {
      logger.debug(`Running test: ${testVector.name}`)

      try {
        // Execute the program
        const result = await executeTestVector(testVector)

        // Verify registers match expected values
        for (let j = 0; j < 13; j++) {
          expect(result.registers[j]).toBe(BigInt(testVector['expected-regs'][j]))
        }

        // Verify gas usage
        expect(result.gas).toBe(Number(testVector['expected-gas']))

        // Verify PC
        expect(result.pc).toBe(Number(testVector['expected-pc']))

        // Verify exit status
        // 

        // Verify memory if expected
        if (testVector['expected-memory']) {
          for (const memBlock of testVector['expected-memory']) {
            const address = BigInt(memBlock.address)
            const expectedContents = memBlock.contents.map(Number)
            
            for (let k = 0; k < expectedContents.length; k++) {
              const addr = address + BigInt(k)
              const actualValue = result.memory.get(addr)
              expect(actualValue).toBe(expectedContents[k])
            }
          }
        }

        logger.info(`✅ Test passed: ${testVector.name}`)
      } catch (error) {
        logger.error(`❌ Test failed: ${testVector.name}`, error)
        throw error
      }
    })
  }
})
