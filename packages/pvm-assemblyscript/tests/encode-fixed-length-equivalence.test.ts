/**
 * encodeFixedLength TypeScript vs AssemblyScript equivalence test.
 *
 * Ensures the AssemblyScript fixed-length encoder matches the TypeScript
 * implementation from @pbnjam/codec for random u64 values and lengths
 * 1, 2, 4, 8, 16, 32 (including 32-byte code-hash style encoding).
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import { encodeFixedLength } from '@pbnjam/codec'
import { bytesToHex } from '@pbnjam/core'
import { instantiate } from './wasmAsInit'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const FIXED_LENGTHS = [1, 2, 4, 8, 16, 32] as const

function randomU64(): bigint {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return new DataView(bytes.buffer).getBigUint64(0, true)
}

let wasm: Awaited<ReturnType<typeof instantiate>> & { encodeFixedLength: (value: bigint, length: number) => Uint8Array } = null!

beforeAll(async () => {
  const wasmPath = join(__dirname, '../build/debug.wasm')
  const wasmBytes = readFileSync(wasmPath)
  wasm = await instantiate(wasmBytes) as typeof wasm
})

describe('encodeFixedLength TS vs AS equivalence', () => {
  it('should match TypeScript encodeFixedLength for random u64 values across all lengths', () => {
    const samples = 50
    for (let s = 0; s < samples; s++) {
      const value = randomU64()
      for (const length of FIXED_LENGTHS) {
        const [tsError, tsEncoded] = encodeFixedLength(value, BigInt(length) as 1n | 2n | 4n | 8n | 16n | 32n)
        if (tsError || !tsEncoded) {
          throw tsError ?? new Error('encodeFixedLength returned no result')
        }
        const asEncoded = wasm.encodeFixedLength(value, length)
        expect(asEncoded.length).toBe(length)
        expect(tsEncoded.length).toBe(length)
        expect(bytesToHex(asEncoded)).toBe(bytesToHex(tsEncoded))
      }
    }
  })

  it('should match for 32-byte encoding (eject code hash style) with random ids', () => {
    const samples = 100
    for (let s = 0; s < samples; s++) {
      const value = randomU64()
      const [tsError, tsEncoded] = encodeFixedLength(value, 32n)
      if (tsError || !tsEncoded) {
        throw tsError ?? new Error('encodeFixedLength(32) returned no result')
      }
      const asEncoded = wasm.encodeFixedLength(value, 32)
      expect(asEncoded.length).toBe(32)
      expect(bytesToHex(asEncoded)).toBe(bytesToHex(tsEncoded))
    }
  })

  it('should match for edge values: 0, 1, max u64', () => {
    const edgeValues = [0n, 1n, 0xffff_ffff_ffff_ffffn]
    for (const value of edgeValues) {
      for (const length of FIXED_LENGTHS) {
        const [tsError, tsEncoded] = encodeFixedLength(value, BigInt(length) as 1n | 2n | 4n | 8n | 16n | 32n)
        if (tsError || !tsEncoded) {
          throw tsError ?? new Error('encodeFixedLength returned no result')
        }
        const asEncoded = wasm.encodeFixedLength(value, length)
        expect(bytesToHex(asEncoded)).toBe(bytesToHex(tsEncoded))
      }
    }
  })
})
