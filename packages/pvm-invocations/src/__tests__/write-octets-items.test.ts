/**
 * Unit test for WRITE host function octets and items calculation
 *
 * This test verifies that calculateServiceAccountItems and calculateServiceAccountOctets
 * correctly calculate values when adding and deleting storage items.
 *
 * Gray Paper accounts.tex:
 * - items = 2 * len(requests) + len(storage)
 * - octets = sum((81 + z) for (h, z) in keys(requests)) + sum((34 + len(y) + len(x)) for (x, y) in storage)
 * where x is the original storage key blob, y is the storage value blob
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { WriteHostFunction, PVMRAM } from '@pbnjam/pvm'
import {
  bytesToHex,
  calculateServiceAccountItems,
  calculateServiceAccountOctets,
} from '@pbnjam/core'
import type {
  HostFunctionContext,
  ServiceAccount,
  WriteParams,
} from '@pbnjam/types'

describe('WRITE Host Function Octets and Items Calculation', () => {
  let writeHostFunction: WriteHostFunction

  beforeEach(() => {
    writeHostFunction = new WriteHostFunction()
  })

  /**
   * Helper function to create a test service account
   */
  function createTestServiceAccount(initialStorage?: Map<string, Uint8Array>): ServiceAccount {
    return {
      codehash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      balance: 1000000n, // Large balance to avoid FULL errors
      minaccgas: 10n,
      minmemogas: 10n,
      octets: 0n,
      gratis: 0n,
      items: 0n,
      created: 0n,
      lastacc: 0n,
      parent: 0n,
      storage: initialStorage ?? new Map(),
      preimages: new Map(),
      requests: new Map(),
    }
  }

  /**
   * Helper function to set up RAM with key and value data
   */
  function setupRAM(
    key: Uint8Array,
    value: Uint8Array,
  ): { ram: PVMRAM; keyOffset: bigint; valueOffset: bigint } {
    const ram = new PVMRAM()
    const minHeapSize = 4096
    ram.initializeMemoryLayout(
      new Uint8Array(0), // argumentData
      new Uint8Array(0), // readOnlyData
      new Uint8Array(minHeapSize).fill(0), // readWriteData
      0, // stackSize
      0, // heapZeroPaddingSize
    )

    // Write key and value to heap memory
    const keyOffset = 0x20000n
    const valueOffset = 0x20100n

    // Write key to memory
    ram.writeOctets(keyOffset, key)
    // Write value to memory
    ram.writeOctets(valueOffset, value)

    return { ram, keyOffset, valueOffset }
  }

  /**
   * Helper function to create host function context
   */
  function createContext(
    ram: PVMRAM,
    keyOffset: bigint,
    keyLength: bigint,
    valueOffset: bigint,
    valueLength: bigint,
  ): HostFunctionContext {
    const registers: bigint[] = new Array(13).fill(0n)
    registers[7] = keyOffset // keyOffset
    registers[8] = keyLength // keyLength
    registers[9] = valueOffset // valueOffset
    registers[10] = valueLength // valueLength

    return {
      gasCounter: 1000n,
      registers,
      ram,
      log: () => {}, // No-op logger
    }
  }

  test('should correctly calculate items and octets when adding a new storage item', () => {
    const serviceId = 0n
    const serviceAccount = createTestServiceAccount()

    // Initial state: no storage, no requests
    const initialItems = calculateServiceAccountItems(serviceAccount)
    const initialOctets = calculateServiceAccountOctets(serviceAccount)

    expect(initialItems).toBe(0n)
    expect(initialOctets).toBe(0n)

    // Prepare to add a storage item
    // Key: 27-byte blob (typical storage key size)
    const key = new Uint8Array(27).fill(0x42)
    const value = new Uint8Array(100).fill(0xaa) // 100-byte value

    const { ram, keyOffset, valueOffset } = setupRAM(key, value)
    const context = createContext(
      ram,
      keyOffset,
      BigInt(key.length),
      valueOffset,
      BigInt(value.length),
    )

    // Calculate expected values before write
    // Gray Paper: items = 2 * len(requests) + len(storage)
    // After adding: items = 2 * 0 + 1 = 1
    const expectedItemsAfter = calculateServiceAccountItems(serviceAccount, {
      writeKey: key,
      isDelete: false,
    })

    // Gray Paper: octets = sum((81 + z) for requests) + sum((34 + len(y) + len(x)) for storage)
    // After adding: octets = 0 + (34 + 27 + 100) = 161
    const expectedOctetsAfter = calculateServiceAccountOctets(serviceAccount, {
      writeKey: key,
      writeValue: value,
      isDelete: false,
    })

    expect(expectedItemsAfter).toBe(1n)
    expect(expectedOctetsAfter).toBe(161n) // 34 + 27 + 100

    // Execute write
    const writeParams: WriteParams = {
      serviceAccount,
      serviceId,
    }

    const result = writeHostFunction.execute(context, writeParams)

    // Verify execution succeeded
    expect(result.resultCode).toBeNull()

    // Verify the storage was added
    const keyHex = bytesToHex(key)
    expect(serviceAccount.storage.has(keyHex)).toBe(true)
    expect(serviceAccount.storage.get(keyHex)).toEqual(value)

    // Verify items and octets were updated
    expect(serviceAccount.items).toBe(expectedItemsAfter)
    expect(serviceAccount.octets).toBe(expectedOctetsAfter)
  })

  test('should correctly calculate items and octets when updating an existing storage item', () => {
    const serviceId = 0n

    // Create service account with existing storage
    const key = new Uint8Array(27).fill(0x42)
    const keyHex = bytesToHex(key)
    const oldValue = new Uint8Array(50).fill(0x11) // 50-byte old value
    const initialStorage = new Map([[keyHex, oldValue]])
    const serviceAccount = createTestServiceAccount(initialStorage)

    // Initial state: 1 storage item
    const initialItems = calculateServiceAccountItems(serviceAccount)
    const initialOctets = calculateServiceAccountOctets(serviceAccount)

    expect(initialItems).toBe(1n)
    expect(initialOctets).toBe(111n) // 34 + 27 + 50

    // Prepare to update with new value
    const newValue = new Uint8Array(150).fill(0xaa) // 150-byte new value

    const { ram, keyOffset, valueOffset } = setupRAM(key, newValue)
    const context = createContext(
      ram,
      keyOffset,
      BigInt(key.length),
      valueOffset,
      BigInt(newValue.length),
    )

    // Calculate expected values after update
    // items should remain 1 (updating, not adding)
    const expectedItemsAfter = calculateServiceAccountItems(serviceAccount, {
      writeKey: key,
      isDelete: false,
    })

    // octets should change: 34 + 27 + 150 = 211
    const expectedOctetsAfter = calculateServiceAccountOctets(serviceAccount, {
      writeKey: key,
      writeValue: newValue,
      isDelete: false,
    })

    expect(expectedItemsAfter).toBe(1n) // Still 1 item
    expect(expectedOctetsAfter).toBe(211n) // 34 + 27 + 150

    // Execute write
    const writeParams: WriteParams = {
      serviceAccount,
      serviceId,
    }

    const result = writeHostFunction.execute(context, writeParams)

    // Verify execution succeeded
    expect(result.resultCode).toBeNull()

    // Verify the storage was updated
    expect(serviceAccount.storage.get(keyHex)).toEqual(newValue)

    // Verify items and octets were updated
    expect(serviceAccount.items).toBe(expectedItemsAfter)
    expect(serviceAccount.octets).toBe(expectedOctetsAfter)
  })

  test('should correctly calculate items and octets when deleting a storage item', () => {
    const serviceId = 0n

    // Create service account with existing storage
    const key1 = new Uint8Array(27).fill(0x42)
    const key1Hex = bytesToHex(key1)
    const value1 = new Uint8Array(100).fill(0xaa)

    const key2 = new Uint8Array(27).fill(0x43)
    const key2Hex = bytesToHex(key2)
    const value2 = new Uint8Array(50).fill(0xbb)

    const initialStorage = new Map([
      [key1Hex, value1],
      [key2Hex, value2],
    ])
    const serviceAccount = createTestServiceAccount(initialStorage)

    // Initial state: 2 storage items
    const initialItems = calculateServiceAccountItems(serviceAccount)
    const initialOctets = calculateServiceAccountOctets(serviceAccount)

    expect(initialItems).toBe(2n)
    // octets = (34 + 27 + 100) + (34 + 27 + 50) = 161 + 111 = 272
    expect(initialOctets).toBe(272n)

    // Prepare to delete key1
    const { ram, keyOffset } = setupRAM(key1, new Uint8Array(0))
    const context = createContext(
      ram,
      keyOffset,
      BigInt(key1.length),
      0n, // valueOffset (not used for delete)
      0n, // valueLength = 0 means delete
    )

    // Calculate expected values after deletion
    // items should decrease by 1: 2 - 1 = 1
    const expectedItemsAfter = calculateServiceAccountItems(serviceAccount, {
      writeKey: key1,
      isDelete: true,
    })

    // octets should decrease by (34 + 27 + 100) = 161: 272 - 161 = 111
    const expectedOctetsAfter = calculateServiceAccountOctets(serviceAccount, {
      writeKey: key1,
      writeValue: new Uint8Array(0),
      isDelete: true,
    })

    expect(expectedItemsAfter).toBe(1n)
    expect(expectedOctetsAfter).toBe(111n) // Only key2 remains: 34 + 27 + 50

    // Execute write (delete)
    const writeParams: WriteParams = {
      serviceAccount,
      serviceId,
    }

    const result = writeHostFunction.execute(context, writeParams)

    // Verify execution succeeded
    expect(result.resultCode).toBeNull()

    // Verify the storage was deleted
    expect(serviceAccount.storage.has(key1Hex)).toBe(false)
    expect(serviceAccount.storage.has(key2Hex)).toBe(true) // key2 should still exist

    // Verify items and octets were updated
    expect(serviceAccount.items).toBe(expectedItemsAfter)
    expect(serviceAccount.octets).toBe(expectedOctetsAfter)
  })

  test('should correctly calculate items and octets with requests included', () => {
    const serviceId = 0n
    const serviceAccount = createTestServiceAccount()

    // Add a request: (hash, length) -> status
    const requestHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    const requestLength = 200n
    const requestStatus: bigint[] = []
    serviceAccount.requests.set(requestHash, new Map([[requestLength, requestStatus]]))

    // Initial state: 1 request, 0 storage
    const initialItems = calculateServiceAccountItems(serviceAccount)
    const initialOctets = calculateServiceAccountOctets(serviceAccount)

    // items = 2 * 1 + 0 = 2
    expect(initialItems).toBe(2n)
    // octets = (81 + 200) + 0 = 281
    expect(initialOctets).toBe(281n)

    // Add a storage item
    const key = new Uint8Array(27).fill(0x42)
    const value = new Uint8Array(100).fill(0xaa)

    const { ram, keyOffset, valueOffset } = setupRAM(key, value)
    const context = createContext(
      ram,
      keyOffset,
      BigInt(key.length),
      valueOffset,
      BigInt(value.length),
    )

    // Calculate expected values after adding storage
    // items = 2 * 1 + 1 = 3
    const expectedItemsAfter = calculateServiceAccountItems(serviceAccount, {
      writeKey: key,
      isDelete: false,
    })

    // octets = (81 + 200) + (34 + 27 + 100) = 281 + 161 = 442
    const expectedOctetsAfter = calculateServiceAccountOctets(serviceAccount, {
      writeKey: key,
      writeValue: value,
      isDelete: false,
    })

    expect(expectedItemsAfter).toBe(3n)
    expect(expectedOctetsAfter).toBe(442n)

    // Execute write
    const writeParams: WriteParams = {
      serviceAccount,
      serviceId,
    }

    const result = writeHostFunction.execute(context, writeParams)

    // Verify execution succeeded
    expect(result.resultCode).toBeNull()

    // Verify items and octets were updated correctly
    expect(serviceAccount.items).toBe(expectedItemsAfter)
    expect(serviceAccount.octets).toBe(expectedOctetsAfter)
  })

  test('should correctly calculate octets for multiple storage items with different key sizes', () => {
    const serviceId = 0n
    const serviceAccount = createTestServiceAccount()

    // Add storage items with different key sizes
    const key1 = new Uint8Array(27).fill(0x01) // 27 bytes
    const key1Hex = bytesToHex(key1)
    const value1 = new Uint8Array(10).fill(0xaa)

    const key2 = new Uint8Array(20).fill(0x02) // 20 bytes (smaller)
    const value2 = new Uint8Array(200).fill(0xbb)

    // Add first item
    serviceAccount.storage.set(key1Hex, value1)
    serviceAccount.items = calculateServiceAccountItems(serviceAccount)
    serviceAccount.octets = calculateServiceAccountOctets(serviceAccount)

    // After first item: items = 1, octets = 34 + 27 + 10 = 71
    expect(serviceAccount.items).toBe(1n)
    expect(serviceAccount.octets).toBe(71n)

    // Add second item
    const { ram, keyOffset, valueOffset } = setupRAM(key2, value2)
    const context = createContext(
      ram,
      keyOffset,
      BigInt(key2.length),
      valueOffset,
      BigInt(value2.length),
    )

    const expectedItemsAfter = calculateServiceAccountItems(serviceAccount, {
      writeKey: key2,
      isDelete: false,
    })

    const expectedOctetsAfter = calculateServiceAccountOctets(serviceAccount, {
      writeKey: key2,
      writeValue: value2,
      isDelete: false,
    })

    // items = 2
    expect(expectedItemsAfter).toBe(2n)
    // octets = 71 + (34 + 20 + 200) = 71 + 254 = 325
    expect(expectedOctetsAfter).toBe(325n)

    // Execute write
    const writeParams: WriteParams = {
      serviceAccount,
      serviceId,
    }

    const result = writeHostFunction.execute(context, writeParams)

    // Verify execution succeeded
    expect(result.resultCode).toBeNull()

    // Verify final state
    expect(serviceAccount.items).toBe(expectedItemsAfter)
    expect(serviceAccount.octets).toBe(expectedOctetsAfter)
  })
})

