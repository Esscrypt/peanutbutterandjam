/**
 * PVM Control Flow Instruction Tests
 * Tests for JUMP, RET operations
 * 
 * Test Vectors: 8 tests covering control flow
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadTestVectorsByPrefix, executeTestVector } from './test-vector-helper'

beforeAll(() => {
  logger.init()
})

describe('PVM Control Flow Instructions', async () => {
  // Load all test vectors for control flow operations
  const jumpTests = loadTestVectorsByPrefix('inst_jump')
  const retTests = loadTestVectorsByPrefix('inst_ret')
  
  const controlFlowTests = [
    ...jumpTests,
    ...retTests,
  ]

  logger.info(`Loaded ${controlFlowTests.length} control flow test vectors`)

  for (const testVector of controlFlowTests) {
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

