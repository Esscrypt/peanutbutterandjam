/**
 * PVM Branching Instruction Tests
 * Tests for BRANCH_* operations (EQ, NE, LT, LE, GE, GT)
 * 
 * Test Vectors: 32 tests covering all branch conditions
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadTestVectorsByPrefix, executeTestVector } from './test-vector-helper'

beforeAll(() => {
  logger.init()
})

describe('PVM Branching Instructions', async () => {
  // Load all test vectors for branching operations
  const branchTests = loadTestVectorsByPrefix('inst_branch')
  
  logger.info(`Loaded ${branchTests.length} branching test vectors`)

  for (const testVector of branchTests) {
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

