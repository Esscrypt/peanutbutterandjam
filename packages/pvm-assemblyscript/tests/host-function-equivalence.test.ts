/**
 * Host Function Equivalence Tests
 *
 * Tests that the core logic of host functions in AssemblyScript
 * produce correct results matching the Gray Paper specification.
 *
 * This focuses on the state manipulation logic rather than the full PVM context,
 * making the tests simpler and more focused on the critical code paths.
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import { bytesToHex, calculateMinBalance } from '@pbnjam/core'
import {
  encodeCompleteServiceAccount,
  decodeCompleteServiceAccount,
  getServiceRequestValue,
  setServiceRequestValue,
  getServiceStorageValue,
  setServiceStorageValue,
  type ServiceAccount,
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

/**
 * Creates a minimal service account for testing
 * Uses correct Gray Paper field names
 */
function createTestServiceAccount(
  balance: bigint = 1000000n,
  items: bigint = 0n,
  octets: bigint = 0n,
  gratis: bigint = 0n,
): ServiceAccount {
  return {
    codehash: ('0x' + '00'.repeat(32)) as `0x${string}`,
    balance: BigInt(balance),
    minaccgas: 10000000n,   // Gray Paper: sa_minaccgas
    minmemogas: 10000000n,  // Gray Paper: sa_minmemogas
    octets: BigInt(octets),
    gratis: BigInt(gratis),
    items: BigInt(items),
    created: 0n,            // Gray Paper: sa_created
    lastacc: 0n,            // Gray Paper: sa_lastacc
    parent: 0n,             // Gray Paper: sa_parent
    rawCshKeyvals: {},
  }
}

/**
 * Encode service account safely for testing
 */
function safeEncodeServiceAccount(account: ServiceAccount): Uint8Array {
  const [err, encoded] = encodeCompleteServiceAccount(account)
  if (err || !encoded) {
    throw new Error(`Failed to encode service account: ${err?.message}`)
  }
  return encoded
}

describe('Host Function Equivalence', () => {
  describe('calculateMinBalance', () => {
    it('should produce identical min balance calculations', () => {
      const testCases = [
        { items: 0n, octets: 0n, gratis: 0n },
        { items: 1n, octets: 100n, gratis: 0n },
        { items: 10n, octets: 1000n, gratis: 0n },
        { items: 5n, octets: 500n, gratis: 200n },
        { items: 0n, octets: 0n, gratis: 200n }, // gratis > deposit
      ]

      for (const { items, octets, gratis } of testCases) {
        const tsResult = calculateMinBalance(items, octets, gratis)
        const asResult = wasm.testCalculateMinBalance(items, octets, gratis)

        expect(asResult).toBe(tsResult)
      }
    })
  })

  describe('Request Timeslot Encoding/Decoding', () => {
    it('should encode empty timeslots correctly', () => {
      const asResult = wasm.testEncodeRequestTimeslots([])
      // Empty sequence: var{seq{}} = 0-length prefix
      expect(asResult[0]).toBe(0)
    })

    it('should decode timeslots correctly', () => {
      // Test decoding various timeslot arrays
      const testCases = [
        { encoded: new Uint8Array([0]), expected: [] },
        { encoded: new Uint8Array([1, 0x0A, 0x00, 0x00, 0x00]), expected: [10] },
        { encoded: new Uint8Array([2, 0x0A, 0x00, 0x00, 0x00, 0x14, 0x00, 0x00, 0x00]), expected: [10, 20] },
      ]

      for (const { encoded, expected } of testCases) {
        const asResult = wasm.testDecodeRequestTimeslots(encoded)
        expect(asResult).toEqual(expected)
      }
    })

    it('should round-trip encode/decode timeslots', () => {
      const testCases = [
        [],
        [10],
        [10, 20],
        [10, 20, 30],
        [1000, 2000, 3000],
      ]

      for (const timeslots of testCases) {
        const encoded = wasm.testEncodeRequestTimeslots(timeslots)
        const decoded = wasm.testDecodeRequestTimeslots(encoded)
        expect(decoded).toEqual(timeslots)
      }
    })
  })

  describe('WRITE Host Function Logic', () => {
    it('should add new storage entry successfully', () => {
      const account = createTestServiceAccount(1000000n, 0n, 0n)
      const tsEncoded = safeEncodeServiceAccount(account)

      const serviceId = 0
      const key = new TextEncoder().encode('test-key')
      const value = new TextEncoder().encode('test-value')

      const asResult = wasm.testWriteLogic(tsEncoded, serviceId, key, value)

      // Result should be NONE (-9) since key didn't exist before
      expect(asResult.resultCode).toBe(-9n)
      expect(asResult.encodedAccount.length).toBeGreaterThan(0)

      // Verify the value was stored (AS returns Hex, compare as hex)
      const decodedResult = decodeCompleteServiceAccount(asResult.encodedAccount)
      expect(decodedResult[1]).not.toBeNull()
      const storedValue = getServiceStorageValue(decodedResult[1]!.value, 0n, bytesToHex(key))
      // Handle both Uint8Array and Hex string returns
      const storedHex = storedValue instanceof Uint8Array ? bytesToHex(storedValue) : storedValue
      expect(storedHex).toBe(bytesToHex(value))
    })

    it('should update existing storage entry', () => {
      // First, add an entry using AS WRITE
      const account = createTestServiceAccount(1000000n, 0n, 0n)
      const tsEncoded = safeEncodeServiceAccount(account)

      const key = new TextEncoder().encode('test-key')
      const oldValue = new TextEncoder().encode('old-value')

      // First write to create entry
      const asResult1 = wasm.testWriteLogic(tsEncoded, 0, key, oldValue)
      expect(asResult1.resultCode).toBe(-9n) // NONE (new entry)

      // Now update with new value
      const newValue = new TextEncoder().encode('new-value-longer')
      const asResult2 = wasm.testWriteLogic(asResult1.encodedAccount, 0, key, newValue)

      // Result should be previous length
      expect(asResult2.resultCode).toBe(BigInt(oldValue.length))

      // Verify the new value was stored
      const decodedResult = decodeCompleteServiceAccount(asResult2.encodedAccount)
      expect(decodedResult[1]).not.toBeNull()
      const storedValue = getServiceStorageValue(decodedResult[1]!.value, 0n, bytesToHex(key))
      const storedHex = storedValue instanceof Uint8Array ? bytesToHex(storedValue) : storedValue
      expect(storedHex).toBe(bytesToHex(newValue))
    })

    it('should delete storage entry', () => {
      // First, add an entry using AS WRITE
      const account = createTestServiceAccount(1000000n, 0n, 0n)
      const tsEncoded = safeEncodeServiceAccount(account)

      const key = new TextEncoder().encode('test-key')
      const existingValue = new TextEncoder().encode('existing')

      // First write to create entry
      const asResult1 = wasm.testWriteLogic(tsEncoded, 0, key, existingValue)
      expect(asResult1.resultCode).toBe(-9n) // NONE (new entry)

      // Delete (value length = 0)
      const emptyValue = new Uint8Array(0)
      const asResult = wasm.testWriteLogic(asResult1.encodedAccount, 0, key, emptyValue)

      // Should return previous length
      expect(asResult.resultCode).toBe(BigInt(existingValue.length))

      // Verify the key was deleted
      const decodedResult = decodeCompleteServiceAccount(asResult.encodedAccount)
      expect(decodedResult[1]).not.toBeNull()
      const storedValue = getServiceStorageValue(decodedResult[1]!.value, 0n, bytesToHex(key))
      expect(storedValue).toBeUndefined()
    })
  })

  describe('READ Host Function Logic', () => {
    it('should return NONE for non-existent key', () => {
      const account = createTestServiceAccount(1000000n)
      const tsEncoded = safeEncodeServiceAccount(account)

      const key = new TextEncoder().encode('non-existent')
      const asResult = wasm.testReadLogic(tsEncoded, 0, key, 0, 100)

      expect(asResult.resultCode).toBe(-9n) // NONE
    })

    it('should read existing storage value correctly', () => {
      // First, add an entry using AS WRITE
      const account = createTestServiceAccount(1000000n, 0n, 0n)
      const tsEncoded = safeEncodeServiceAccount(account)

      const key = new TextEncoder().encode('test-key')
      const value = new TextEncoder().encode('test-value-123')

      // First write to create entry
      const writeResult = wasm.testWriteLogic(tsEncoded, 0, key, value)
      expect(writeResult.resultCode).toBe(-9n) // NONE (new entry)

      // Now read it back
      const asResult = wasm.testReadLogic(writeResult.encodedAccount, 0, key, 0, 100)

      expect(asResult.resultCode).toBe(BigInt(value.length))
      expect(bytesToHex(asResult.encodedAccount)).toBe(bytesToHex(value))
    })

    it('should handle offset and length correctly', () => {
      // First, add an entry using AS WRITE
      const account = createTestServiceAccount(1000000n, 0n, 0n)
      const tsEncoded = safeEncodeServiceAccount(account)

      const key = new TextEncoder().encode('key')
      const value = new TextEncoder().encode('HELLO-WORLD')

      // First write to create entry
      const writeResult = wasm.testWriteLogic(tsEncoded, 0, key, value)
      expect(writeResult.resultCode).toBe(-9n) // NONE (new entry)

      // Read from offset 6, length 5 -> "WORLD"
      const asResult = wasm.testReadLogic(writeResult.encodedAccount, 0, key, 6, 5)

      expect(asResult.resultCode).toBe(BigInt(value.length))
      expect(asResult.returnValue).toBe(5n)
      expect(new TextDecoder().decode(asResult.encodedAccount)).toBe('WORLD')
    })
  })

  describe('SOLICIT Host Function Logic', () => {
    it('should create new request for non-existent request', () => {
      const account = createTestServiceAccount(1000000n)
      const tsEncoded = safeEncodeServiceAccount(account)

      const requestHash = new Uint8Array(32).fill(0xAB)
      const preimageLength = 100n
      const timeslot = 1000n

      const asResult = wasm.testSolicitLogic(tsEncoded, 0, requestHash, preimageLength, timeslot)

      expect(asResult.resultCode).toBe(0n) // OK
      expect(asResult.encodedAccount.length).toBeGreaterThan(0)

      // Verify request was created with empty timeslots []
      const decodedResult = decodeCompleteServiceAccount(asResult.encodedAccount)
      expect(decodedResult[1]).not.toBeNull()
      const request = getServiceRequestValue(decodedResult[1]!.value, 0n, bytesToHex(requestHash), preimageLength)
      expect(request).toEqual([])
    })

    it('should return HUH for request with single timeslot', () => {
      const account = createTestServiceAccount(1000000n, 2n, 181n)
      const requestHash = new Uint8Array(32).fill(0xCD)

      // Pre-create request with 1 timeslot [x] (invalid for SOLICIT)
      setServiceRequestValue(account, 0n, bytesToHex(requestHash), 100n, [500n])
      const tsEncoded = safeEncodeServiceAccount(account)

      const asResult = wasm.testSolicitLogic(tsEncoded, 0, requestHash, 100n, 1000n)

      expect(asResult.resultCode).toBe(-9n) // HUH
    })

    it('should append timeslot to [x, y] request', () => {
      const account = createTestServiceAccount(1000000n, 2n, 181n)
      const requestHash = new Uint8Array(32).fill(0xEF)

      // Pre-create request with 2 timeslots [x, y]
      setServiceRequestValue(account, 0n, bytesToHex(requestHash), 100n, [500n, 600n])
      const tsEncoded = safeEncodeServiceAccount(account)

      const asResult = wasm.testSolicitLogic(tsEncoded, 0, requestHash, 100n, 1000n)

      expect(asResult.resultCode).toBe(0n) // OK

      // Verify the request now has 3 timeslots
      const decodedResult = decodeCompleteServiceAccount(asResult.encodedAccount)
      expect(decodedResult[1]).not.toBeNull()
      const updatedRequest = getServiceRequestValue(decodedResult[1]!.value, 0n, bytesToHex(requestHash), 100n)
      expect(updatedRequest).toEqual([500n, 600n, 1000n])
    })
  })

  describe('FORGET Host Function Logic', () => {
    it('should return HUH for non-existent request', () => {
      const account = createTestServiceAccount(1000000n)
      const tsEncoded = safeEncodeServiceAccount(account)

      const requestHash = new Uint8Array(32).fill(0x11)
      const asResult = wasm.testForgetLogic(tsEncoded, 0, requestHash, 100n, 1000n, 19200n)

      expect(asResult.resultCode).toBe(-9n) // HUH
    })

    it('should update [x] to [x, t]', () => {
      const account = createTestServiceAccount(1000000n, 2n, 181n)
      const requestHash = new Uint8Array(32).fill(0x22)

      // Pre-create request with 1 timeslot [x]
      setServiceRequestValue(account, 0n, bytesToHex(requestHash), 100n, [500n])
      const tsEncoded = safeEncodeServiceAccount(account)

      const asResult = wasm.testForgetLogic(tsEncoded, 0, requestHash, 100n, 1000n, 19200n)

      expect(asResult.resultCode).toBe(0n) // OK

      // Verify the request now has 2 timeslots [x, t]
      const decodedResult = decodeCompleteServiceAccount(asResult.encodedAccount)
      expect(decodedResult[1]).not.toBeNull()
      const updatedRequest = getServiceRequestValue(decodedResult[1]!.value, 0n, bytesToHex(requestHash), 100n)
      expect(updatedRequest).toEqual([500n, 1000n])
    })

    it('should return HUH for [x, y] when y >= t - expungePeriod', () => {
      const account = createTestServiceAccount(1000000n, 2n, 181n)
      const requestHash = new Uint8Array(32).fill(0x33)

      // Pre-create request with 2 timeslots [x, y] where y is recent
      // For y >= t - expungePeriod to fail, we need:
      // y >= 30000 - 19200 = 10800
      // So set y = 20000 (recent, >= 10800)
      setServiceRequestValue(account, 0n, bytesToHex(requestHash), 100n, [5000n, 20000n])
      const tsEncoded = safeEncodeServiceAccount(account)

      // Current timeslot 30000, expungePeriod 19200 -> y (20000) >= 30000 - 19200 = 10800
      const asResult = wasm.testForgetLogic(tsEncoded, 0, requestHash, 100n, 30000n, 19200n)

      expect(asResult.resultCode).toBe(-9n) // HUH
    })

    it('should delete request for [x, y] when y < t - expungePeriod', () => {
      const account = createTestServiceAccount(1000000n, 2n, 181n)
      const requestHash = new Uint8Array(32).fill(0x44)

      // Pre-create request with 2 timeslots [x, y] where y is old
      setServiceRequestValue(account, 0n, bytesToHex(requestHash), 100n, [100n, 200n])
      const tsEncoded = safeEncodeServiceAccount(account)

      // Current timeslot 25000, expungePeriod 19200 -> y (200) < 25000 - 19200 = 5800
      const asResult = wasm.testForgetLogic(tsEncoded, 0, requestHash, 100n, 25000n, 19200n)

      expect(asResult.resultCode).toBe(0n) // OK

      // Verify the request is deleted
      const decodedResult = decodeCompleteServiceAccount(asResult.encodedAccount)
      expect(decodedResult[1]).not.toBeNull()
      const deletedRequest = getServiceRequestValue(decodedResult[1]!.value, 0n, bytesToHex(requestHash), 100n)
      expect(deletedRequest).toBeUndefined()
    })
  })

  describe('QUERY Host Function Logic', () => {
    it('should return NONE for non-existent request', () => {
      const account = createTestServiceAccount(1000000n)
      const tsEncoded = safeEncodeServiceAccount(account)

      const requestHash = new Uint8Array(32).fill(0x55)
      const asResult = wasm.testQueryLogic(tsEncoded, 0, requestHash, 100n)

      expect(asResult.resultCode).toBe(-9n) // NONE
    })

    it('should return correct status for empty request []', () => {
      const account = createTestServiceAccount(1000000n, 2n, 181n)
      const requestHash = new Uint8Array(32).fill(0x66)

      // Pre-create request with 0 timeslots []
      setServiceRequestValue(account, 0n, bytesToHex(requestHash), 100n, [])
      const tsEncoded = safeEncodeServiceAccount(account)

      const asResult = wasm.testQueryLogic(tsEncoded, 0, requestHash, 100n)

      expect(asResult.resultCode).toBe(0n)
      expect(asResult.returnValue).toBe(0n)
    })

    it('should return correct status for [x] request', () => {
      const account = createTestServiceAccount(1000000n, 2n, 181n)
      const requestHash = new Uint8Array(32).fill(0x77)

      // Pre-create request with 1 timeslot [x=500]
      setServiceRequestValue(account, 0n, bytesToHex(requestHash), 100n, [500n])
      const tsEncoded = safeEncodeServiceAccount(account)

      const asResult = wasm.testQueryLogic(tsEncoded, 0, requestHash, 100n)

      // reg7 = 1 + 2^32 * x = 1 + 4294967296 * 500 = 2147483648001
      const expected = 1n + 4294967296n * 500n
      expect(asResult.resultCode).toBe(expected)
      expect(asResult.returnValue).toBe(0n)
    })

    it('should return correct status for [x, y] request', () => {
      const account = createTestServiceAccount(1000000n, 2n, 181n)
      const requestHash = new Uint8Array(32).fill(0x88)

      // Pre-create request with 2 timeslots [x=500, y=600]
      setServiceRequestValue(account, 0n, bytesToHex(requestHash), 100n, [500n, 600n])
      const tsEncoded = safeEncodeServiceAccount(account)

      const asResult = wasm.testQueryLogic(tsEncoded, 0, requestHash, 100n)

      // reg7 = 2 + 2^32 * x = 2 + 4294967296 * 500
      // reg8 = y = 600
      const expectedReg7 = 2n + 4294967296n * 500n
      expect(asResult.resultCode).toBe(expectedReg7)
      expect(asResult.returnValue).toBe(600n)
    })
  })
})
