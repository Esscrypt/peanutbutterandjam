/**
 * PVM Conditional Move Instruction Tests
 * Tests for CMOV_* operations
 * 
 * Test Vectors: 4 tests covering conditional moves
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadTestVectorsByPrefix, executeTestVector } from './test-vector-helper'

beforeAll(() => {
  logger.init()
})

describe('PVM Conditional Instructions', async () => {
  // Load all test vectors for conditional operations
  const cmovTests = loadTestVectorsByPrefix('inst_cmov')
  
  logger.info(`Loaded ${cmovTests.length} conditional test vectors`)

  for (const testVector of cmovTests) {
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

