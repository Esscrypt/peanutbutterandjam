/**
 * PVM System Instruction Tests
 * Tests for TRAP, FALLTHROUGH operations
 * 
 * Test Vectors: 2 tests covering system operations
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadTestVectorsByPrefix, executeTestVector } from './test-vector-helper'

beforeAll(() => {
  logger.init()
})

describe('PVM System Instructions', async () => {
  // Load all test vectors for system operations
  const trapTests = loadTestVectorsByPrefix('inst_trap')
  const fallthroughTests = loadTestVectorsByPrefix('inst_fallthrough')
  
  const systemTests = [
    ...trapTests,
    ...fallthroughTests,
  ]

  logger.info(`Loaded ${systemTests.length} system test vectors`)

  for (const testVector of systemTests) {
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

