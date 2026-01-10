/**
 * PVM RISC-V Integration Tests
 * Tests complete RISC-V programs compiled to PVM bytecode
 * 
 * Test Vectors: 106 RISC-V tests covering:
 * - rv64ua: Atomic operations
 * - rv64uc: Compressed instructions
 * - rv64ui: Integer operations
 * - rv64um: Multiplication/division operations
 * - rv64uf: Floating-point operations
 * - rv64ud: Double-precision floating-point
 * - rv64si: System instructions
 */

import { logger } from '@pbnjam/core'
import { beforeAll, describe, expect, it } from 'bun:test'
import { loadTestVectorsByPrefix, executeTestVector } from './test-vector-helper'

beforeAll(() => {
  logger.init()
})

describe('PVM RISC-V Integration Tests', () => {
  // Load all RISC-V test vectors
  const riscvTests = loadTestVectorsByPrefix('riscv_')
  
  logger.info(`Loaded ${riscvTests.length} RISC-V test vectors`)

  for (const testVector of riscvTests) {
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

      // Verify PC
      expect(result.pc).toBe(Number(testVector['expected-pc']))

      // Verify exit status
      
    })
  }
})

