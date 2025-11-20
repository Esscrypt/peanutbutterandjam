/**
 * PVM Register Instruction Tests
 * Tests for MOVE_REG and other register operations
 * 
 * Test Vectors: 1 test covering register operations
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadTestVectorsByPrefix, executeTestVector } from './test-vector-helper'

beforeAll(() => {
  logger.init()
})

describe('PVM Register Instructions', async () => {
  // Load all test vectors for register operations
  const moveTests = loadTestVectorsByPrefix('inst_move')
  
  logger.info(`Loaded ${moveTests.length} register test vectors`)

  for (const testVector of moveTests) {
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

