/**
 * PVM Comparison/Set Instruction Tests
 * Tests for SET_LT, SET_GT operations
 * 
 * Test Vectors: 12 tests covering comparison operations
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadTestVectorsByPrefix, executeTestVector } from './test-vector-helper'

beforeAll(() => {
  logger.init()
})

describe('PVM Comparison Instructions', async () => {
  // Load all test vectors for comparison operations
  const setTests = loadTestVectorsByPrefix('inst_set')
  
  logger.info(`Loaded ${setTests.length} comparison test vectors`)

  for (const testVector of setTests) {
    it(`should execute: ${testVector.name}`, async () => {
      logger.debug(`Running test: ${testVector.name}`)

      // Execute the program
      const result = await executeTestVector(testVector)

      // Verify registers match expected values
      for (let i = 0; i < 13; i++) {
        expect(result.registers[i]).toBe(BigInt(testVector['expected-regs'][i]))
      }

      // Verify gas usage
      expect(result.gas).toBe(Number(testVector['expected-gas']))

      // Verify PC
      expect(result.pc).toBe(Number(testVector['expected-pc']))

      // Verify exit status
      
    })
  }
})

