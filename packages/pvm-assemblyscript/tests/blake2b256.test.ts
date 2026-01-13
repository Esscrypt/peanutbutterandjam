/**
 * Blake2b-256 hash equivalence test
 * 
 * Tests that TypeScript and AssemblyScript implementations of blake2b256
 * produce identical results for the same inputs.
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import { bytesToHex } from '@pbnjam/core'
import { blake2b } from '@noble/hashes/blake2.js'
import { instantiate } from './wasmAsInit'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * TypeScript blake2b256 implementation using noble hashes
 */
function tsBlake2b256(data: Uint8Array): Uint8Array {
  return blake2b(data, { dkLen: 32 })
}

let wasm: any = null

beforeAll(async () => {
  const wasmPath = join(__dirname, '../build/debug.wasm')
  const wasmBytes = readFileSync(wasmPath)
  wasm = await instantiate(wasmBytes)
})

describe('Blake2b-256 Hash Equivalence', () => {
  it('should produce identical results for empty input', () => {
    const input = new Uint8Array(0)
    
    // TypeScript
    const tsResult = tsBlake2b256(input)
    
    // AssemblyScript
    const asResult = wasm.blake2b256(input)
    
    expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
  })

  it('should produce identical results for single byte input', () => {
    const input = new Uint8Array([0x42])
    
    // TypeScript
    const tsResult = tsBlake2b256(input)
    
    // AssemblyScript
    const asResult = wasm.blake2b256(input)
    
    expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
  })

  it('should produce identical results for "hello" input', () => {
    const input = new TextEncoder().encode('hello')
    
    // TypeScript
    const tsResult = tsBlake2b256(input)
    
    // AssemblyScript
    const asResult = wasm.blake2b256(input)
    
    expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
  })

  it('should produce identical results for 32-byte input', () => {
    const input = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      input[i] = i
    }
    
    // TypeScript
    const tsResult = tsBlake2b256(input)
    
    // AssemblyScript
    const asResult = wasm.blake2b256(input)
    
    expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
  })

  it('should produce identical results for 128-byte input (exactly one block)', () => {
    const input = new Uint8Array(128)
    for (let i = 0; i < 128; i++) {
      input[i] = i & 0xff
    }
    
    // TypeScript
    const tsResult = tsBlake2b256(input)
    
    // AssemblyScript
    const asResult = wasm.blake2b256(input)
    
    expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
  })

  it('should produce identical results for 256-byte input (multiple blocks)', () => {
    const input = new Uint8Array(256)
    for (let i = 0; i < 256; i++) {
      input[i] = i & 0xff
    }
    
    // TypeScript
    const tsResult = tsBlake2b256(input)
    
    // AssemblyScript
    const asResult = wasm.blake2b256(input)
    
    expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
  })

  it('should produce identical results for random data', () => {
    // Use a fixed "random" seed for reproducibility
    const input = new Uint8Array([
      0x7f, 0x3a, 0x20, 0x54, 0x0b, 0xe9, 0x8d, 0x0c,
      0xab, 0x5c, 0xbd, 0x7e, 0x82, 0xc9, 0x74, 0x4b,
      0xaf, 0x13, 0x79, 0x18, 0xfe, 0x8d, 0x08, 0x74,
      0x14, 0x76, 0xa3, 0x97, 0xe9, 0xdc, 0x28, 0x84,
    ])
    
    // TypeScript
    const tsResult = tsBlake2b256(input)
    
    // AssemblyScript
    const asResult = wasm.blake2b256(input)
    
    expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
  })

  it('should produce identical results for state key computation', () => {
    // This simulates the C(s, h) state key computation from codec
    // Test case: encode[4]{0xFFFFFFFF} || storage_key
    const prefix = new Uint8Array([0xff, 0xff, 0xff, 0xff])
    const storageKey = new Uint8Array([0x01, 0x02])
    const combined = new Uint8Array(prefix.length + storageKey.length)
    combined.set(prefix)
    combined.set(storageKey, prefix.length)
    
    // TypeScript
    const tsResult = tsBlake2b256(combined)
    
    // AssemblyScript
    const asResult = wasm.blake2b256(combined)
    
    expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
  })

  it('should produce identical results for preimage key computation', () => {
    // Test case: encode[4]{0xFFFFFFFE} || preimage_hash
    const prefix = new Uint8Array([0xfe, 0xff, 0xff, 0xff])
    const preimageHash = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      preimageHash[i] = i + 1
    }
    const combined = new Uint8Array(prefix.length + preimageHash.length)
    combined.set(prefix)
    combined.set(preimageHash, prefix.length)
    
    // TypeScript
    const tsResult = tsBlake2b256(combined)
    
    // AssemblyScript
    const asResult = wasm.blake2b256(combined)
    
    expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
  })

  it('should produce identical results for request key computation', () => {
    // Test case: encode[4]{length} || request_hash
    const length = 155  // Example length
    const prefix = new Uint8Array(4)
    prefix[0] = length & 0xff
    prefix[1] = (length >> 8) & 0xff
    prefix[2] = (length >> 16) & 0xff
    prefix[3] = (length >> 24) & 0xff
    
    const requestHash = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      requestHash[i] = 0x7f - i
    }
    
    const combined = new Uint8Array(prefix.length + requestHash.length)
    combined.set(prefix)
    combined.set(requestHash, prefix.length)
    
    // TypeScript
    const tsResult = tsBlake2b256(combined)
    
    // AssemblyScript
    const asResult = wasm.blake2b256(combined)
    
    expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
  })

  it('should produce correct known hash for empty input', () => {
    // Known Blake2b-256 hash for empty input
    const expectedHash = '0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    // Note: This is actually the SHA-256 hash of empty input
    // Blake2b-256 hash of empty input is:
    // 0x0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8
    const expectedBlake2b256 = '0x0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8'
    
    const input = new Uint8Array(0)
    
    // TypeScript
    const tsResult = tsBlake2b256(input)
    
    // AssemblyScript
    const asResult = wasm.blake2b256(input)
    
    // Both should produce identical results
    expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
    
    // And should match the known hash
    expect(bytesToHex(tsResult)).toBe(expectedBlake2b256)
  })
})

