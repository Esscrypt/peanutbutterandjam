/**
 * Unit test for deriving expected storage key for service initialization
 * 
 * This test demonstrates how to derive the storage key needed to create
 * the expected C(s, h) state key for service 3953987607.
 */

import { describe, test, expect } from 'bun:test'
import { bytesToHex, hexToBytes } from '@pbnjam/core'
import { createServiceStorageKey } from '@pbnjam/codec'

describe('NEW Host Function - Storage Key Derivation', () => {
  const serviceId = 3953987607n
  const expectedStateKey = '0x172c10ffad30eb44aa84f31be60f9d7ed87eaef9dbb83ab9b4db18c1148396'

  test('should derive storage key that produces expected state key', () => {
    // Extract the 27-byte Blake hash from the expected state key
    // C(s, h) = ⟨n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆⟩
    // where n = encode[4](s), a = blake(h)
    const stateKeyBytes = hexToBytes(expectedStateKey)
    
    // Extract Blake hash bytes: a₀, a₁, a₂, a₃, a₄...a₂₆
    const blakeHashBytes = new Uint8Array(27)
    blakeHashBytes[0] = stateKeyBytes[1] // a₀
    blakeHashBytes[1] = stateKeyBytes[3] // a₁
    blakeHashBytes[2] = stateKeyBytes[5] // a₂
    blakeHashBytes[3] = stateKeyBytes[7] // a₃
    blakeHashBytes.set(stateKeyBytes.slice(8, 31), 4) // a₄...a₂₆
    
    const blakeHashHex = bytesToHex(blakeHashBytes)
    
    // Verify service ID extraction
    const serviceIdBytes = new Uint8Array(4)
    serviceIdBytes[0] = stateKeyBytes[0] // n₀
    serviceIdBytes[1] = stateKeyBytes[2] // n₁
    serviceIdBytes[2] = stateKeyBytes[4] // n₂
    serviceIdBytes[3] = stateKeyBytes[6] // n₃
    const view = new DataView(serviceIdBytes.buffer)
    const extractedServiceId = BigInt(view.getUint32(0, true)) // little-endian
    
    expect(extractedServiceId).toBe(serviceId)
    
    // Test 1: Use the 27-byte Blake hash directly as storage key
    // This is what we do when loading from state
    const stateKeyFromHash = createServiceStorageKey(serviceId, blakeHashHex)
    const stateKeyFromHashHex = bytesToHex(stateKeyFromHash)
    
    expect(stateKeyFromHashHex).toBe(expectedStateKey)
    
    // Test 2: Try empty storage key '0x' to see if it produces the same hash
    // This would be the original storage key before hashing
    const stateKeyFromEmpty = createServiceStorageKey(serviceId, '0x')
    const stateKeyFromEmptyHex = bytesToHex(stateKeyFromEmpty)
    
    // Log the results for debugging
    console.log('Expected state key:', expectedStateKey)
    console.log('State key from Blake hash (27 bytes):', stateKeyFromHashHex)
    console.log('State key from empty key (0x):', stateKeyFromEmptyHex)
    console.log('Blake hash (27 bytes):', blakeHashHex)
    console.log('Blake hash length:', blakeHashBytes.length, 'bytes')
    
    // The state key from the Blake hash should match
    expect(stateKeyFromHashHex).toBe(expectedStateKey)
    
    // If the empty key also matches, that's the original storage key we need
    if (stateKeyFromEmptyHex === expectedStateKey) {
      console.log('✓ Empty storage key (0x) produces the expected state key')
      console.log('  Use: createServiceStorageKey(serviceId, "0x")')
    } else {
      console.log('✗ Empty storage key does not match')
      console.log('  Need to use the 27-byte Blake hash as storage key')
      console.log('  Use: createServiceStorageKey(serviceId, blakeHashHex)')
    }
  })

  test('should show what storage key value to pass to createServiceStorageKey', () => {
    // Extract the 27-byte Blake hash from the expected state key
    const stateKeyBytes = hexToBytes(expectedStateKey)
    const blakeHashBytes = new Uint8Array(27)
    blakeHashBytes[0] = stateKeyBytes[1]
    blakeHashBytes[1] = stateKeyBytes[3]
    blakeHashBytes[2] = stateKeyBytes[5]
    blakeHashBytes[3] = stateKeyBytes[7]
    blakeHashBytes.set(stateKeyBytes.slice(8, 31), 4)
    const blakeHashHex = bytesToHex(blakeHashBytes)
    
    // Test with empty storage key
    const emptyKeyStateKey = createServiceStorageKey(serviceId, '0x')
    const emptyKeyStateKeyHex = bytesToHex(emptyKeyStateKey)
    
    // Determine which storage key produces the expected state key
    let storageKeyToUse: string
    let storageKeyType: string
    
    if (emptyKeyStateKeyHex === expectedStateKey) {
      storageKeyToUse = '0x'
      storageKeyType = 'empty storage key'
    } else {
      storageKeyToUse = blakeHashHex
      storageKeyType = '27-byte Blake hash'
    }
    
    // Verify the chosen storage key produces the expected state key
    const finalStateKey = createServiceStorageKey(serviceId, storageKeyToUse as `0x${string}`)
    const finalStateKeyHex = bytesToHex(finalStateKey)
    
    expect(finalStateKeyHex).toBe(expectedStateKey)
    
    // Output the answer
    console.log('\n=== Storage Key Derivation Result ===')
    console.log(`Service ID: ${serviceId}`)
    console.log(`Storage key to use: ${storageKeyToUse}`)
    console.log(`Storage key type: ${storageKeyType}`)
    console.log(`Expected state key: ${expectedStateKey}`)
    console.log(`Generated state key: ${finalStateKeyHex}`)
    console.log(`Match: ${finalStateKeyHex === expectedStateKey ? '✓' : '✗'}`)
    console.log('\nCorrect Usage:')
    console.log(`  // setServiceStorageValue expects the ORIGINAL storage key, not the state key`)
    console.log(`  // It will internally call createServiceStorageKey to create the state key`)
    console.log(`  setServiceStorageValue(serviceAccount, ${serviceId}n, '${storageKeyToUse}', new Uint8Array([0]))`)
    console.log('\nWhat NOT to do:')
    console.log(`  // Don't pass the state key to setServiceStorageValue - it expects the storage key!`)
    console.log(`  const stateKey = createServiceStorageKey(${serviceId}n, '${storageKeyToUse}')`)
    console.log(`  setServiceStorageValue(serviceAccount, ${serviceId}n, bytesToHex(stateKey), ...) // WRONG!`)
  })
})

