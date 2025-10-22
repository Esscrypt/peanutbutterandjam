/**
 * PVM Division & Remainder Instruction Tests
 * Tests for DIV and REM operations (signed/unsigned, 32/64-bit)
 * 
 * Test Vectors: 22 tests covering division and remainder
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadTestVectorsByPrefix, executeTestVector } from './test-vector-helper'

beforeAll(() => {
  logger.init()
})

describe('PVM Division & Remainder Instructions', async () => {
  // Load all test vectors for division and remainder operations
  const divTests = loadTestVectorsByPrefix('inst_div')
  const remTests = loadTestVectorsByPrefix('inst_rem')
  
  const divisionTests = [
    ...divTests,
    ...remTests,
  ]

  logger.info(`Loaded ${divisionTests.length} division/remainder test vectors`)

  for (const testVector of divisionTests) {
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

