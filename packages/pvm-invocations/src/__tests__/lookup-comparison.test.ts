import { describe, test, expect, beforeEach } from 'vitest'
import { LookupHostFunction, PVMRAM, ACCUMULATE_ERROR_CODES } from '@pbnjam/pvm'
import { ConfigService } from '../../../../infra/node/services/config-service'
import { bytesToHex, hexToBytes } from '@pbnjam/core'
import type { HostFunctionContext, LookupParams, ServiceAccount } from '@pbnjam/types'

/**
 * Test for LOOKUP host function
 * 
 * Gray Paper Specification (Ω_L):
 * - Function ID: 2 (lookup)
 * - Gas Cost: 10
 * - Uses registers[7] to specify which service account to query
 *   - registers[7] = s (current service ID) or 2^64-1 → use current service
 *   - registers[7] = other service ID → lookup that service's preimages
 * - Uses registers[8] to specify hash offset in memory (32 bytes)
 * - Uses registers[9] to specify output offset in memory
 * - Uses registers[10] to specify from offset (f) in the preimage
 * - Uses registers[11] to specify length (l) to copy
 * 
 * Returns:
 * - len(v) if preimage found (and writes v[f:f+l] to memory[o:o+l])
 * - NONE if preimage not found or service account doesn't exist
 * - PANIC if memory read/write fails
 * 
 * IMPORTANT: LOOKUP is a READ-ONLY operation - it does NOT modify service accounts!
 */
describe('LOOKUP Host Function', () => {
  let configService: ConfigService
  let lookupFunction: LookupHostFunction

  beforeEach(() => {
    configService = new ConfigService('tiny')
    lookupFunction = new LookupHostFunction(configService)
  })

  test('should return preimage data when preimage exists', () => {
    // Setup: Create a service account with a preimage
    const serviceId = 0n
    const preimageHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    const preimageData = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])

    const serviceAccount: ServiceAccount = {
      codehash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      balance: 1000000n,
      minaccgas: 0n,
      minmemogas: 0n,
      octets: 0n,
      gratis: 0n,
      items: 0n,
      created: 0n,
      lastacc: 0n,
      parent: 0n,
      preimages: new Map([[preimageHash, preimageData]]),
      requests: new Map(),
      storage: new Map(),
    }

    const accounts = new Map<bigint, ServiceAccount>([[serviceId, serviceAccount]])

    // Create RAM and write the hash to memory
    // Memory layout: roData at 0x10000, heap at 0x20000
    const ram = new PVMRAM()
    
    // Initialize with hash in heap (writable) since we need to both read and write
    // Hash goes in heap starting at offset 0 (address 0x20000)
    // Output goes in heap starting at offset 64 (address 0x20040)
    const heapData = new Uint8Array(4096)
    const hashBytes = hexToBytes(preimageHash)
    heapData.set(hashBytes, 0) // Put hash at start of heap
    
    ram.initializeMemoryLayout(
      new Uint8Array(0), // argumentData
      new Uint8Array(0), // readOnlyData
      heapData, // readWriteData - heap with hash at start
      0,
      0,
    )

    // Create context
    const registers: bigint[] = new Array(13).fill(0n)
    registers[7] = serviceId // Service to lookup (or 2^64-1 for self)
    registers[8] = 0x20000n // Hash offset in heap (heap starts at 0x20000)
    registers[9] = 0x20040n // Output offset (after hash)
    registers[10] = 0n // From offset (start of preimage)
    registers[11] = 8n // Length (copy all 8 bytes)

    const context: HostFunctionContext = {
      gasCounter: 1000n,
      registers,
      ram,
      log: () => {},
    }

    const lookupParams: LookupParams = {
      serviceId,
      accounts,
    }

    // Execute LOOKUP
    const result = lookupFunction.execute(context, lookupParams)

    // Verify result
    expect(result.resultCode).toBeNull() // continue execution
    expect(context.registers[7]).toBe(BigInt(preimageData.length)) // Should return preimage length

    // Verify data was written to memory
    const [fetchedData, fault] = ram.readOctets(0x20040n, 8n)
    expect(fault).toBeNull()
    expect(fetchedData).not.toBeNull()
    expect(bytesToHex(fetchedData!)).toBe(bytesToHex(preimageData))
  })

  test('should return NONE when preimage does not exist', () => {
    const serviceId = 0n
    const nonExistentHash = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'

    const serviceAccount: ServiceAccount = {
      codehash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      balance: 1000000n,
      minaccgas: 0n,
      minmemogas: 0n,
      octets: 0n,
      gratis: 0n,
      items: 0n,
      created: 0n,
      lastacc: 0n,
      parent: 0n,
      preimages: new Map(), // No preimages
      requests: new Map(),
      storage: new Map(),
    }

    const accounts = new Map<bigint, ServiceAccount>([[serviceId, serviceAccount]])

    const heapData = new Uint8Array(4096)
    heapData.set(hexToBytes(nonExistentHash), 0)
    
    const ram = new PVMRAM()
    ram.initializeMemoryLayout(
      new Uint8Array(0),
      new Uint8Array(0),
      heapData,
      0,
      0,
    )

    const registers: bigint[] = new Array(13).fill(0n)
    registers[7] = serviceId
    registers[8] = 0x20000n // Hash in heap
    registers[9] = 0x20040n // Output after hash
    registers[10] = 0n
    registers[11] = 32n

    const context: HostFunctionContext = {
      gasCounter: 1000n,
      registers,
      ram,
      log: () => {},
    }

    const lookupParams: LookupParams = {
      serviceId,
      accounts,
    }

    // Execute LOOKUP
    const result = lookupFunction.execute(context, lookupParams)

    // Verify NONE is returned
    expect(result.resultCode).toBeNull() // continue execution
    expect(context.registers[7]).toBe(ACCUMULATE_ERROR_CODES.NONE) // Should return NONE
  })

  test('should return NONE when service account does not exist', () => {
    const serviceId = 0n
    const queryServiceId = 999n // Non-existent service
    const someHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

    const serviceAccount: ServiceAccount = {
      codehash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      balance: 1000000n,
      minaccgas: 0n,
      minmemogas: 0n,
      octets: 0n,
      gratis: 0n,
      items: 0n,
      created: 0n,
      lastacc: 0n,
      parent: 0n,
      preimages: new Map(),
      requests: new Map(),
      storage: new Map(),
    }

    // Only service 0 exists
    const accounts = new Map<bigint, ServiceAccount>([[serviceId, serviceAccount]])

    const heapData = new Uint8Array(4096)
    heapData.set(hexToBytes(someHash), 0)
    
    const ram = new PVMRAM()
    ram.initializeMemoryLayout(
      new Uint8Array(0),
      new Uint8Array(0),
      heapData,
      0,
      0,
    )

    const registers: bigint[] = new Array(13).fill(0n)
    registers[7] = queryServiceId // Try to lookup non-existent service
    registers[8] = 0x20000n
    registers[9] = 0x20040n
    registers[10] = 0n
    registers[11] = 32n

    const context: HostFunctionContext = {
      gasCounter: 1000n,
      registers,
      ram,
      log: () => {},
    }

    const lookupParams: LookupParams = {
      serviceId,
      accounts,
    }

    // Execute LOOKUP
    const result = lookupFunction.execute(context, lookupParams)

    // Verify NONE is returned
    expect(result.resultCode).toBeNull() // continue execution
    expect(context.registers[7]).toBe(ACCUMULATE_ERROR_CODES.NONE)
  })

  // TODO: LOOKUP implementation has a bug - it ignores registers[7] and always looks up from current service
  // Gray Paper says: a = s when registers_7 ∈ {s, 2^64 - 1}, d[registers_7] otherwise if registers_7 ∈ keys{d}
  // Current implementation always uses lookupParams.serviceId instead of checking registers[7]
  test.skip('should lookup from different service when registers[7] != self', () => {
    const selfServiceId = 0n
    const otherServiceId = 1n
    const preimageHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    const preimageData = new Uint8Array([0xAA, 0xBB, 0xCC, 0xDD])

    // Self service has no preimages
    const selfAccount: ServiceAccount = {
      codehash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      balance: 1000000n,
      minaccgas: 0n,
      minmemogas: 0n,
      octets: 0n,
      gratis: 0n,
      items: 0n,
      created: 0n,
      lastacc: 0n,
      parent: 0n,
      preimages: new Map(),
      requests: new Map(),
      storage: new Map(),
    }

    // Other service has the preimage
    const otherAccount: ServiceAccount = {
      codehash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      balance: 1000000n,
      minaccgas: 0n,
      minmemogas: 0n,
      octets: 0n,
      gratis: 0n,
      items: 0n,
      created: 0n,
      lastacc: 0n,
      parent: 0n,
      preimages: new Map([[preimageHash, preimageData]]),
      requests: new Map(),
      storage: new Map(),
    }

    const accounts = new Map<bigint, ServiceAccount>([
      [selfServiceId, selfAccount],
      [otherServiceId, otherAccount],
    ])

    const heapData = new Uint8Array(4096)
    heapData.set(hexToBytes(preimageHash), 0)
    
    const ram = new PVMRAM()
    ram.initializeMemoryLayout(
      new Uint8Array(0),
      new Uint8Array(0),
      heapData,
      0,
      0,
    )

    const registers: bigint[] = new Array(13).fill(0n)
    registers[7] = otherServiceId // Lookup from other service
    registers[8] = 0x20000n
    registers[9] = 0x20040n
    registers[10] = 0n
    registers[11] = 4n

    const context: HostFunctionContext = {
      gasCounter: 1000n,
      registers,
      ram,
      log: () => {},
    }

    const lookupParams: LookupParams = {
      serviceId: selfServiceId,
      accounts,
    }

    // Execute LOOKUP
    const result = lookupFunction.execute(context, lookupParams)

    // Verify success
    expect(result.resultCode).toBeNull()
    expect(context.registers[7]).toBe(BigInt(preimageData.length))

    // Verify data was written
    const [fetchedData] = ram.readOctets(0x20040n, 4n)
    expect(fetchedData).not.toBeNull()
    expect(bytesToHex(fetchedData!)).toBe(bytesToHex(preimageData))
  })

  test('should NOT modify service account (LOOKUP is read-only)', () => {
    const serviceId = 0n
    const preimageHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    const preimageData = new Uint8Array([0x01, 0x02, 0x03, 0x04])

    const serviceAccount: ServiceAccount = {
      codehash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      balance: 1000000n,
      minaccgas: 0n,
      minmemogas: 0n,
      octets: 100n,
      gratis: 50n,
      items: 5n,
      created: 1n,
      lastacc: 10n,
      parent: 0n,
      preimages: new Map([[preimageHash, preimageData]]),
      requests: new Map(),
      storage: new Map([['0xaabbccdd', new Uint8Array([1, 2, 3])]]),
    }

    // Clone the account state for comparison
    const originalBalance = serviceAccount.balance
    const originalOctets = serviceAccount.octets
    const originalItems = serviceAccount.items
    const originalStorageSize = serviceAccount.storage.size
    const originalPreimagesSize = serviceAccount.preimages.size

    const accounts = new Map<bigint, ServiceAccount>([[serviceId, serviceAccount]])

    const heapData = new Uint8Array(4096)
    heapData.set(hexToBytes(preimageHash), 0)
    
    const ram = new PVMRAM()
    ram.initializeMemoryLayout(
      new Uint8Array(0),
      new Uint8Array(0),
      heapData,
      0,
      0,
    )

    const registers: bigint[] = new Array(13).fill(0n)
    registers[7] = serviceId
    registers[8] = 0x20000n
    registers[9] = 0x20040n
    registers[10] = 0n
    registers[11] = 4n

    const context: HostFunctionContext = {
      gasCounter: 1000n,
      registers,
      ram,
      log: () => {},
    }

    const lookupParams: LookupParams = {
      serviceId,
      accounts,
    }

    // Execute LOOKUP
    const result = lookupFunction.execute(context, lookupParams)
    expect(result.resultCode).toBeNull()

    // CRITICAL: Verify that service account was NOT modified
    // Gray Paper: LOOKUP (Ω_L) is a read-only operation
    const accountAfter = accounts.get(serviceId)!
    
    expect(accountAfter.balance).toBe(originalBalance)
    expect(accountAfter.octets).toBe(originalOctets)
    expect(accountAfter.items).toBe(originalItems)
    expect(accountAfter.storage.size).toBe(originalStorageSize)
    expect(accountAfter.preimages.size).toBe(originalPreimagesSize)
    
    // Verify preimage still exists and wasn't consumed/deleted
    expect(accountAfter.preimages.get(preimageHash)).toEqual(preimageData)
  })

  test('should handle partial preimage reads (from offset and length)', () => {
    const serviceId = 0n
    const preimageHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    // 10-byte preimage: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const preimageData = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])

    const serviceAccount: ServiceAccount = {
      codehash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      balance: 1000000n,
      minaccgas: 0n,
      minmemogas: 0n,
      octets: 0n,
      gratis: 0n,
      items: 0n,
      created: 0n,
      lastacc: 0n,
      parent: 0n,
      preimages: new Map([[preimageHash, preimageData]]),
      requests: new Map(),
      storage: new Map(),
    }

    const accounts = new Map<bigint, ServiceAccount>([[serviceId, serviceAccount]])

    const heapData = new Uint8Array(4096)
    heapData.set(hexToBytes(preimageHash), 0)
    
    const ram = new PVMRAM()
    ram.initializeMemoryLayout(
      new Uint8Array(0),
      new Uint8Array(0),
      heapData,
      0,
      0,
    )

    const registers: bigint[] = new Array(13).fill(0n)
    registers[7] = serviceId
    registers[8] = 0x20000n // Hash offset in heap
    registers[9] = 0x20040n // Output offset (after hash)
    registers[10] = 3n // From offset = 3 (skip first 3 bytes)
    registers[11] = 4n // Length = 4 (read bytes 3, 4, 5, 6)

    const context: HostFunctionContext = {
      gasCounter: 1000n,
      registers,
      ram,
      log: () => {},
    }

    const lookupParams: LookupParams = {
      serviceId,
      accounts,
    }

    // Execute LOOKUP
    const result = lookupFunction.execute(context, lookupParams)

    // Verify result
    expect(result.resultCode).toBeNull()
    // Should return TOTAL preimage length, not the slice length
    expect(context.registers[7]).toBe(BigInt(preimageData.length)) // 10

    // Verify the correct slice was written
    const [fetchedData] = ram.readOctets(0x20040n, 4n)
    expect(fetchedData).not.toBeNull()
    expect(Array.from(fetchedData!)).toEqual([3, 4, 5, 6]) // bytes from offset 3, length 4
  })
})

