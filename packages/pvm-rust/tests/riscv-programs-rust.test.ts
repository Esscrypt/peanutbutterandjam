/**
 * PVM Rust – RISC-V programs test
 *
 * Copied from pvm-assemblyscript/tests/riscv-programs.test.ts.
 * Uses executeTestVectorRust (native binding) instead of WASM.
 *
 * Instruction trace: set PVM_TRACE=1 to log each executed instruction per test.
 * Run with: bun test packages/pvm-rust/tests/riscv-programs-rust.test.ts
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import {
  executeTestVectorRust,
  getTestVectorsDir,
  parseJsonSafe,
  type PVMTestVector,
} from './test-vector-helper-rust'

const testVectorsDir = getTestVectorsDir()
let allFiles: string[] = []
try {
  allFiles = readdirSync(testVectorsDir)
} catch {
  // submodules/pvm-test-vectors may not exist
}
const jsonFiles = allFiles
  .filter((f) => f.endsWith('.json'))
  .filter((f) => f.startsWith('riscv'))

const testVectors: PVMTestVector[] = []
for (const file of jsonFiles) {
  try {
    const filePath = join(testVectorsDir, file)
    const fileContents = readFileSync(filePath, 'utf-8')
    const testVector = parseJsonSafe(fileContents) as PVMTestVector
    testVector.name = testVector.name ?? file.replace('.json', '')
    testVectors.push(testVector)
  } catch {
    continue
  }
}

describe('Rust PVM – riscv programs', () => {
  for (let i = 0; i < testVectors.length; i++) {
    const testVector = testVectors[i]
    test.serial(testVector.name ?? `vector-${i}`, async () => {
      const trace = process.env.PVM_TRACE === '1'
      if (trace) {
        console.log(`\n--- trace: ${testVector.name} ---`)
      }
      const result = await executeTestVectorRust(testVector, { trace })

      const regBuf = result.registers
      const registerView = new DataView(regBuf.buffer, regBuf.byteOffset, regBuf.byteLength)
      const decodedRegisters: bigint[] = []
      for (let j = 0; j < 13; j++) {
        decodedRegisters[j] = registerView.getBigUint64(j * 8, true)
      }

      for (let j = 0; j < 13; j++) {
        expect(decodedRegisters[j]).toBe(BigInt(testVector['expected-regs'][j]))
      }

      if (result.status !== 'page-fault') {
        expect(result.gas).toBe(Number(testVector['expected-gas']))
      }
      expect(result.pc).toBe(Number(testVector['expected-pc']))
      expect(result.status).toBe(testVector['expected-status'])

      if (testVector['expected-page-fault-address'] != null && result.faultAddress != null) {
        expect(result.faultAddress).toBe(BigInt(testVector['expected-page-fault-address']))
      }

      if (testVector['expected-memory']) {
        for (const memBlock of testVector['expected-memory']) {
          const address = BigInt(memBlock.address)
          const expectedContents = memBlock.contents.map(Number)
          for (let k = 0; k < expectedContents.length; k++) {
            const actualValue = result.memory.get(address + BigInt(k))
            expect(actualValue).toBe(expectedContents[k])
          }
        }
      }
    })
  }
})
