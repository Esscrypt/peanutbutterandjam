/**
 * PVM Memory Load Instruction Tests
 * Tests for LOAD_* operations (U8, U16, U32, U64, I8, I16, I32, IMM, etc.)
 * 
 * Test Vectors: 34 tests covering all load operations
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadTestVectorsByPrefix, executeTestVector } from './test-vector-helper'

beforeAll(() => {
  logger.init()
})

describe('PVM Memory Load Instructions', async () => {
  // Load all test vectors for memory load operations
  const loadTests = loadTestVectorsByPrefix('inst_load')
  
  logger.info(`Loaded ${loadTests.length} memory load test vectors`)

  for (const testVector of loadTests) {
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
      

      // Verify expected memory state if specified
      if (testVector['expected-memory']) {
        for (const memBlock of testVector['expected-memory']) {
          const address = BigInt(memBlock.address)
          const expectedContents = memBlock.contents.map(v => Number(v))
          
          for (let i = 0; i < expectedContents.length; i++) {
            const addr = address + BigInt(i)
            const actualValue = result.memory.get(addr)
            expect(actualValue).toBe(expectedContents[i])
          }
        }
      }
    })
  }
})

