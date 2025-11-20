/**
 * PVM Bitwise Instruction Tests
 * Tests for AND, OR, XOR operations
 * 
 * Test Vectors: 6 tests covering bitwise operations
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadTestVectorsByPrefix, executeTestVector } from './test-vector-helper'

beforeAll(() => {
  logger.init()
})

describe('PVM Bitwise Instructions', () => {
  // Load all test vectors for bitwise operations
  const andTests = loadTestVectorsByPrefix('inst_and')
  const orTests = loadTestVectorsByPrefix('inst_or')
  const xorTests = loadTestVectorsByPrefix('inst_xor')
  
  const bitwiseTests = [
    ...andTests,
    ...orTests,
    ...xorTests,
  ]

  logger.info(`Loaded ${bitwiseTests.length} bitwise test vectors`)

  for (const testVector of bitwiseTests) {
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

      // verify pc
      expect(result.pc).toBe(Number(testVector['expected-pc']))

      // Verify exit status
      // 
    })
  }
})

