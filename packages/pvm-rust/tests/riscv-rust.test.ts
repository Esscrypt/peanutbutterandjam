/**
 * PVM Rust – RISC-V integration tests.
 * Migrated from pvm/src/instructions/__tests__/riscv.test.ts.
 * Uses loadTestVectorsByPrefix('riscv_') and executeTestVectorRust.
 */

import { describe, expect, test } from 'bun:test'
import {
  executeTestVectorRust,
  loadTestVectorsByPrefix,
  type PVMTestVector,
} from './test-vector-helper-rust'

const riscvVectors = loadTestVectorsByPrefix('riscv_')

describe('Rust PVM – RISC-V integration', () => {
  for (const testVector of riscvVectors) {
    test(`should execute: ${testVector.name}`, async () => {
      const result = await executeTestVectorRust(testVector)

      const regBuf = result.registers
      const registerView = new DataView(regBuf.buffer, regBuf.byteOffset, regBuf.byteLength)
      for (let i = 0; i < 13; i++) {
        expect(registerView.getBigUint64(i * 8, true)).toBe(
          BigInt(testVector['expected-regs'][i]),
        )
      }
      expect(result.gas).toBe(Number(testVector['expected-gas']))
      expect(result.pc).toBe(Number(testVector['expected-pc']))
      expect(result.status).toBe(testVector['expected-status'])
    })
  }
})
