/**
 * PVM Arithmetic Instruction Tests
 * Tests for ADD, SUB, MUL, and related operations
 * 
 * Test Vectors: 20 tests covering ADD, SUB, MUL operations
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadTestVectorsByPrefix, executeTestVector } from './test-vector-helper'

beforeAll(() => {
  logger.init()
})

describe('PVM Arithmetic Instructions', () => {
  // Load all test vectors for arithmetic operations
  const addTests = loadTestVectorsByPrefix('inst_add')
  const subTests = loadTestVectorsByPrefix('inst_sub')
  const mulTests = loadTestVectorsByPrefix('inst_mul')
  const negateTests = loadTestVectorsByPrefix('inst_negate')
  
  const arithmeticTests = [
    ...addTests,
    ...subTests,
    ...mulTests,
    ...negateTests,
  ]

  logger.info(`Loaded ${arithmeticTests.length} arithmetic test vectors`)

  for (const testVector of arithmeticTests) {
    it(`should execute: ${testVector.name}`, async () => {
      logger.debug(`Running test: ${testVector.name}`)

      // Execute the program
      const result = await executeTestVector(testVector)

      // Verify registers match expected values
      for (let i = 0; i < 13; i++) {
        const rawValue = testVector['expected-regs'][i]
        const expectedValue = typeof rawValue === 'string' 
          ? BigInt(rawValue)
          : BigInt(rawValue)
        
        if (i === 9) {
          console.log(`Register 9: raw=${rawValue}, type=${typeof rawValue}, expected=${expectedValue}, actual=${result.registers[i]}`)
        }
        
        expect(result.registers[i]).toBe(expectedValue)
      }

      // Verify gas usage
      expect(result.gas).toBe(Number(testVector['expected-gas']))

      // Verify PC
      expect(result.pc).toBe(Number(testVector['expected-pc']))

      // Verify exit status
      //expect(result.status).toBe(testVector['expected-status'])
    })
  }

})

