/**
 * PVM Rust – all programs test (non-RISC-V).
 * Migrated from pvm/src/instructions/__tests__/all-programs.test.ts.
 * Runs each test vector from pvm-test-vectors/pvm/programs/ that does not start with "riscv".
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

let testVectorsDir: string
let jsonFiles: string[] = []
try {
  testVectorsDir = getTestVectorsDir()
  const allFiles = readdirSync(testVectorsDir)
  jsonFiles = allFiles
    .filter((f) => f.endsWith('.json'))
    .filter((f) => !f.startsWith('riscv'))
    .sort()
} catch {
  // submodules may not exist
}

const testVectors: PVMTestVector[] = []
for (const file of jsonFiles) {
  try {
    const filePath = join(testVectorsDir, file)
    const contents = readFileSync(filePath, 'utf-8')
    const tv = parseJsonSafe(contents) as PVMTestVector
    tv.name = tv.name ?? file.replace('.json', '')
    testVectors.push(tv)
  } catch {
    continue
  }
}

describe('Rust PVM – all programs (non-RISC-V)', () => {
  test.serial('init + setRegisters + getRegisters round-trip', () => {
    const native = require('@pbnjam/pvm-rust-native/native')
    native.reset()
    native.init(native.getRamTypeSimpleRam())
    const initial = new Uint8Array(104)
    const view = new DataView(initial.buffer)
    view.setBigUint64(0, 1n, true)
    view.setBigUint64(8, 2n, true)
    native.setRegisters(Buffer.from(initial))
    const out = native.getRegisters()
    const outView = new DataView(out.buffer, out.byteOffset, out.byteLength)
    expect(outView.getBigUint64(0, true)).toBe(1n)
    expect(outView.getBigUint64(8, true)).toBe(2n)
  })

  for (let i = 0; i < testVectors.length; i++) {
    const testVector = testVectors[i]
    test.serial(testVector.name ?? `vector-${i}`, async () => {
      const trace =
        testVector.name === 'inst_jump_indirect_with_offset_ok' ||
        process.env.PVM_TRACE === '1'
      if (trace) {
        console.log(`\n--- trace: ${testVector.name} ---`)
      }
      const result = await executeTestVectorRust(testVector, { trace })

      const regBuf = result.registers
      const registerView = new DataView(regBuf.buffer, regBuf.byteOffset, regBuf.byteLength)
      for (let j = 0; j < 13; j++) {
        const actual = registerView.getBigUint64(j * 8, true)
        expect(actual).toBe(BigInt(testVector['expected-regs'][j]))
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
