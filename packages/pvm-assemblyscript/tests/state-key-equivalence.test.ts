/**
 * State Key Generation Equivalence Test
 * 
 * Tests that TypeScript and AssemblyScript implementations of state key
 * generation (createStorageKey, createPreimageKey, createRequestKey)
 * produce identical results for the same inputs.
 * 
 * This is critical for ensuring WASM and TypeScript PVM executors
 * produce the same state keys when accessing service account storage.
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import { bytesToHex, hexToBytes } from '@pbnjam/core'
import {
  createServiceStorageKey,
  createServicePreimageKey,
  createServiceRequestKey,
} from '@pbnjam/codec'
import { instantiate } from './wasmAsInit'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let wasm: any = null

beforeAll(async () => {
  const wasmPath = join(__dirname, '../build/debug.wasm')
  const wasmBytes = readFileSync(wasmPath)
  wasm = await instantiate(wasmBytes)
})

describe('State Key Generation Equivalence', () => {
  describe('Storage Keys', () => {
    it('should produce identical storage keys for simple key', () => {
      const serviceId = 0n
      const storageKey = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
      const storageKeyHex = bytesToHex(storageKey)

      // TypeScript
      const tsResult = createServiceStorageKey(serviceId, storageKeyHex)

      // AssemblyScript
      const asResult = wasm.testCreateStorageKey(Number(serviceId), storageKey)

      expect(asResult.length).toBe(31)
      expect(tsResult.length).toBe(31)
      expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
    })

    it('should produce identical storage keys for 32-byte key', () => {
      const serviceId = 42n
      const storageKey = new Uint8Array(32).fill(0xAB)
      const storageKeyHex = bytesToHex(storageKey)

      // TypeScript
      const tsResult = createServiceStorageKey(serviceId, storageKeyHex)

      // AssemblyScript
      const asResult = wasm.testCreateStorageKey(Number(serviceId), storageKey)

      expect(asResult.length).toBe(31)
      expect(tsResult.length).toBe(31)
      expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
    })

    it('should produce identical storage keys for empty key', () => {
      const serviceId = 1n
      const storageKey = new Uint8Array(0)
      const storageKeyHex = bytesToHex(storageKey)

      // TypeScript
      const tsResult = createServiceStorageKey(serviceId, storageKeyHex)

      // AssemblyScript
      const asResult = wasm.testCreateStorageKey(Number(serviceId), storageKey)

      expect(asResult.length).toBe(31)
      expect(tsResult.length).toBe(31)
      expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
    })

    it('should produce different keys for different service IDs', () => {
      const storageKey = new Uint8Array([1, 2, 3, 4])
      const storageKeyHex = bytesToHex(storageKey)

      const tsResult0 = createServiceStorageKey(0n, storageKeyHex)
      const tsResult1 = createServiceStorageKey(1n, storageKeyHex)
      const asResult0 = wasm.testCreateStorageKey(0, storageKey)
      const asResult1 = wasm.testCreateStorageKey(1, storageKey)

      // Same between TS and AS for same serviceId
      expect(bytesToHex(asResult0)).toBe(bytesToHex(tsResult0))
      expect(bytesToHex(asResult1)).toBe(bytesToHex(tsResult1))

      // Different for different serviceIds
      expect(bytesToHex(tsResult0)).not.toBe(bytesToHex(tsResult1))
    })
  })

  describe('Preimage Keys', () => {
    it('should produce identical preimage keys for 32-byte hash', () => {
      const serviceId = 0n
      const preimageHash = new Uint8Array(32).fill(0xCD)
      const preimageHashHex = bytesToHex(preimageHash)

      // TypeScript
      const tsResult = createServicePreimageKey(serviceId, preimageHashHex)

      // AssemblyScript
      const asResult = wasm.testCreatePreimageKey(Number(serviceId), preimageHash)

      expect(asResult.length).toBe(31)
      expect(tsResult.length).toBe(31)
      expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
    })

    it('should produce identical preimage keys for various service IDs', () => {
      const preimageHash = new Uint8Array(32)
      for (let i = 0; i < 32; i++) preimageHash[i] = i
      const preimageHashHex = bytesToHex(preimageHash)

      for (const serviceId of [0n, 1n, 255n, 65535n, 0xFFFFFFFFn]) {
        const tsResult = createServicePreimageKey(serviceId, preimageHashHex)
        const asResult = wasm.testCreatePreimageKey(Number(serviceId), preimageHash)

        expect(asResult.length).toBe(31)
        expect(tsResult.length).toBe(31)
        expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
      }
    })
  })

  describe('Request Keys', () => {
    it('should produce identical request keys for 32-byte hash and length', () => {
      const serviceId = 0n
      const requestHash = new Uint8Array(32).fill(0xEF)
      const requestHashHex = bytesToHex(requestHash)
      const length = 1024n

      // TypeScript
      const tsResult = createServiceRequestKey(serviceId, requestHashHex, length)

      // AssemblyScript
      const asResult = wasm.testCreateRequestKey(Number(serviceId), requestHash, length)

      console.log('Request key comparison:')
      console.log('  TypeScript:', bytesToHex(tsResult))
      console.log('  AssemblyScript:', bytesToHex(asResult))

      expect(asResult.length).toBe(31)
      expect(tsResult.length).toBe(31)
      expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
    })

    it('should produce identical request keys for various lengths', () => {
      const serviceId = 5n
      const requestHash = new Uint8Array(32)
      for (let i = 0; i < 32; i++) requestHash[i] = (i * 7) % 256
      const requestHashHex = bytesToHex(requestHash)

      for (const length of [0n, 1n, 74n, 255n, 1024n, 65535n]) {
        const tsResult = createServiceRequestKey(serviceId, requestHashHex, length)
        const asResult = wasm.testCreateRequestKey(Number(serviceId), requestHash, length)

        expect(asResult.length).toBe(31)
        expect(tsResult.length).toBe(31)
        expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
      }
    })

    it('should produce different keys for different lengths', () => {
      const serviceId = 0n
      const requestHash = new Uint8Array(32).fill(0x11)
      const requestHashHex = bytesToHex(requestHash)

      const tsResult74 = createServiceRequestKey(serviceId, requestHashHex, 74n)
      const tsResult75 = createServiceRequestKey(serviceId, requestHashHex, 75n)
      const asResult74 = wasm.testCreateRequestKey(0, requestHash, 74n)
      const asResult75 = wasm.testCreateRequestKey(0, requestHash, 75n)

      // Same between TS and AS for same length
      expect(bytesToHex(asResult74)).toBe(bytesToHex(tsResult74))
      expect(bytesToHex(asResult75)).toBe(bytesToHex(tsResult75))

      // Different for different lengths
      expect(bytesToHex(tsResult74)).not.toBe(bytesToHex(tsResult75))
    })

    it('should match exact test case from block 13 FORGET call', () => {
      // This is the exact scenario from the trace where FORGET diverges
      const serviceId = 0n
      const preimageLength = 74n

      // Generate a test hash (in real case this comes from RAM)
      const requestHash = new Uint8Array(32)
      for (let i = 0; i < 32; i++) {
        requestHash[i] = i
      }
      const requestHashHex = bytesToHex(requestHash)

      const tsResult = createServiceRequestKey(serviceId, requestHashHex, preimageLength)
      const asResult = wasm.testCreateRequestKey(Number(serviceId), requestHash, preimageLength)

      console.log('Block 13 FORGET test case:')
      console.log('  Service ID:', serviceId.toString())
      console.log('  Preimage Length:', preimageLength.toString())
      console.log('  Request Hash:', requestHashHex)
      console.log('  TS Key:', bytesToHex(tsResult))
      console.log('  AS Key:', bytesToHex(asResult))
      console.log('  Match:', bytesToHex(tsResult) === bytesToHex(asResult))

      expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
    })
  })

  describe('Fixed Length Encoding', () => {
    it('should produce identical 4-byte little-endian encodings', () => {
      for (const value of [0n, 1n, 74n, 255n, 256n, 1024n, 0xFFFFFFFFn]) {
        const asResult = wasm.testEncodeFixedLength(value, 4)

        // Manual TypeScript encoding for comparison
        const tsResult = new Uint8Array(4)
        const view = new DataView(tsResult.buffer)
        view.setUint32(0, Number(value), true) // little-endian

        expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
      }
    })

    it('should produce identical 8-byte little-endian encodings', () => {
      for (const value of [0n, 1n, 0x100000000n, 0xFFFFFFFFFFFFFFFFn]) {
        const asResult = wasm.testEncodeFixedLength(value, 8)

        // Manual TypeScript encoding for comparison
        const tsResult = new Uint8Array(8)
        const view = new DataView(tsResult.buffer)
        view.setBigUint64(0, value, true) // little-endian

        expect(bytesToHex(asResult)).toBe(bytesToHex(tsResult))
      }
    })
  })

  describe('Request Lookup Behavior (Block 13 Bug)', () => {
    it('should NOT find request when length differs by 1', () => {
      // This tests that a request for length=74 is NOT found when only length=73 exists
      const serviceId = 0n
      const requestHash = new Uint8Array(32).fill(0xAB)
      const requestHashHex = bytesToHex(requestHash)

      // Create key for length 73
      const key73 = createServiceRequestKey(serviceId, requestHashHex, 73n)
      const asKey73 = wasm.testCreateRequestKey(0, requestHash, 73n)

      // Create key for length 74
      const key74 = createServiceRequestKey(serviceId, requestHashHex, 74n)
      const asKey74 = wasm.testCreateRequestKey(0, requestHash, 74n)

      // Keys for different lengths must be different
      expect(bytesToHex(key73)).not.toBe(bytesToHex(key74))
      expect(bytesToHex(asKey73)).not.toBe(bytesToHex(asKey74))

      // TS and AS should generate same keys for same length
      expect(bytesToHex(asKey73)).toBe(bytesToHex(key73))
      expect(bytesToHex(asKey74)).toBe(bytesToHex(key74))

      console.log('Key for length 73:', bytesToHex(key73))
      console.log('Key for length 74:', bytesToHex(key74))
      console.log('Keys differ:', bytesToHex(key73) !== bytesToHex(key74))
    })
  })
})

