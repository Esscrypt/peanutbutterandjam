/**
 * PVM Shift Instruction Tests
 * Tests for logical/arithmetic left/right shifts
 * 
 * Test Vectors: 24 tests covering shift operations
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadTestVectorsByPrefix, executeTestVector } from './test-vector-helper'

beforeAll(() => {
  logger.init()
})

describe('PVM Shift Instructions', async () => {
  // Load all test vectors for shift operations
  const shiftTests = loadTestVectorsByPrefix('inst_shift')
  
  logger.info(`Loaded ${shiftTests.length} shift test vectors`)

  for (const testVector of shiftTests) {
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

      expect(result.pc).toBe(Number(testVector['expected-pc']))

      // Verify exit status
      
    })
  }
})

