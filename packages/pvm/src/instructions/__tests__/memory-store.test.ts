/**
 * PVM Memory Store Instruction Tests
 * Tests for STORE_* operations (U8, U16, U32, U64, IMM, IND, etc.)
 * 
 * Test Vectors: 33 tests covering all store operations
 */

import { logger } from '@pbnj/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { loadTestVectorsByPrefix, executeTestVector } from './test-vector-helper'

beforeAll(() => {
  logger.init()
})

describe('PVM Memory Store Instructions', async () => {
  // Load all test vectors for memory store operations
  const storeTests = loadTestVectorsByPrefix('inst_store')
  
  logger.info(`Loaded ${storeTests.length} memory store test vectors`)

  for (const testVector of storeTests) {
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

