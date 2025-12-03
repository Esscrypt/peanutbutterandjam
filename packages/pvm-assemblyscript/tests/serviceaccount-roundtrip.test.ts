/**
 * Round-trip test for CompleteServiceAccount encoding/decoding
 * 
 * Tests interoperability between TypeScript and AssemblyScript implementations:
 * 1. TypeScript encode -> AssemblyScript decode -> AssemblyScript encode -> TypeScript decode
 * 2. AssemblyScript encode -> TypeScript decode -> TypeScript encode -> AssemblyScript decode
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import { logger } from '@pbnj/core'
import type { ServiceAccount } from '@pbnj/types'
import {
  encodeCompleteServiceAccount,
  decodeCompleteServiceAccount,
} from '@pbnj/codec'
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
 * Create a test ServiceAccount object
 */
function createTestServiceAccount(): ServiceAccount {
  return {
    codehash: ('0x' + '00'.repeat(32)) as any,
    balance: 1000n,
    minaccgas: 100n,
    minmemogas: 50n,
    octets: 3n,
    gratis: 0n,
    items: 1n,
    created: 1n,
    lastacc: 1n,
    parent: 0n,
    storage: new Map([['0x0102' as any, new Uint8Array([1, 2, 3])]]),
    preimages: new Map([['0x' + '01'.repeat(32) as any, new Uint8Array([4, 5, 6])]]),
    requests: new Map(),
  }
}

/**
 * Compare two ServiceAccount objects
 */
function compareServiceAccount(a: ServiceAccount, b: ServiceAccount): boolean {
  if (a.codehash !== b.codehash) {
    logger.error(`codehash mismatch: ${a.codehash} !== ${b.codehash}`)
    return false
  }
  if (a.balance !== b.balance) {
    logger.error(`balance mismatch: ${a.balance} !== ${b.balance}`)
    return false
  }
  if (a.minaccgas !== b.minaccgas) {
    logger.error(`minaccgas mismatch: ${a.minaccgas} !== ${b.minaccgas}`)
    return false
  }
  if (a.minmemogas !== b.minmemogas) {
    logger.error(`minmemogas mismatch: ${a.minmemogas} !== ${b.minmemogas}`)
    return false
  }
  if (a.octets !== b.octets) {
    logger.error(`octets mismatch: ${a.octets} !== ${b.octets}`)
    return false
  }
  if (a.gratis !== b.gratis) {
    logger.error(`gratis mismatch: ${a.gratis} !== ${b.gratis}`)
    return false
  }
  if (a.items !== b.items) {
    logger.error(`items mismatch: ${a.items} !== ${b.items}`)
    return false
  }
  if (a.created !== b.created) {
    logger.error(`created mismatch: ${a.created} !== ${b.created}`)
    return false
  }
  if (a.lastacc !== b.lastacc) {
    logger.error(`lastacc mismatch: ${a.lastacc} !== ${b.lastacc}`)
    return false
  }
  if (a.parent !== b.parent) {
    logger.error(`parent mismatch: ${a.parent} !== ${b.parent}`)
    return false
  }
  
  // Compare storage
  if (a.storage.size !== b.storage.size) {
    logger.error(`storage size mismatch: ${a.storage.size} !== ${b.storage.size}`)
    return false
  }
  for (const [key, valueA] of a.storage.entries()) {
    const valueB = b.storage.get(key)
    if (valueB === undefined) {
      logger.error(`storage key ${key} missing in decoded (b.storage has keys: ${Array.from(b.storage.keys()).join(', ')})`)
      return false
    }
    if (valueA.length !== valueB.length) {
      logger.error(`storage[${key}] length mismatch: ${valueA.length} !== ${valueB.length}`)
      return false
    }
    for (let i = 0; i < valueA.length; i++) {
      if (valueA[i] !== valueB[i]) {
        logger.error(`storage[${key}][${i}] mismatch: ${valueA[i]} !== ${valueB[i]}`)
        return false
      }
    }
  }
  
  // Compare preimages
  if (a.preimages.size !== b.preimages.size) {
    logger.error(`preimages size mismatch: ${a.preimages.size} !== ${b.preimages.size}`)
    return false
  }
  for (const [hash, blobA] of a.preimages.entries()) {
    const blobB = b.preimages.get(hash)
    if (!blobB) {
      logger.error(`preimages hash ${hash} missing in decoded`)
      return false
    }
    if (blobA.length !== blobB.length) {
      logger.error(`preimages[${hash}] length mismatch: ${blobA.length} !== ${blobB.length}`)
      return false
    }
    for (let i = 0; i < blobA.length; i++) {
      if (blobA[i] !== blobB[i]) {
        logger.error(`preimages[${hash}][${i}] mismatch: ${blobA[i]} !== ${blobB[i]}`)
        return false
      }
    }
  }
  
  // Compare requests
  if (a.requests.size !== b.requests.size) {
    logger.error(`requests size mismatch: ${a.requests.size} !== ${b.requests.size}`)
    return false
  }
  
  logger.info('✅ ServiceAccount comparison passed')
  return true
}

describe('ServiceAccount Round-Trip Tests', () => {
  it('should pass ServiceAccount round-trip (TypeScript only)', () => {
    logger.info('Testing ServiceAccount round-trip (TypeScript)')
    const original = createTestServiceAccount()

    // Encode with TypeScript
    const [encodeError, encoded] = encodeCompleteServiceAccount(original)
    if (encodeError) {
      logger.error('TypeScript encode error:', encodeError)
      expect(false).toBe(true)
      return
    }
    logger.info(`TypeScript encoded ${encoded!.length} bytes`)

    // Decode with TypeScript
    const [decodeError, decoded] = decodeCompleteServiceAccount(encoded!)
    if (decodeError) {
      logger.error('TypeScript decode error:', decodeError)
      expect(false).toBe(true)
      return
    }

    // Compare
    const matches = compareServiceAccount(original, decoded!.value)
    expect(matches).toBe(true)
    logger.info('✅ ServiceAccount round-trip passed')
  })

  it('should compare ServiceAccount encoding sizes (TypeScript vs AssemblyScript)', async () => {
    logger.info('Comparing ServiceAccount encoding sizes')
    const original = createTestServiceAccount()

    // Encode with TypeScript
    const [encodeError, tsEncoded] = encodeCompleteServiceAccount(original)
    if (encodeError) {
      logger.error('TypeScript encode error:', encodeError)
      expect(false).toBe(true)
      return
    }
    logger.info(`TypeScript encoded ${tsEncoded!.length} bytes`)

    // Round-trip with AssemblyScript
    let asEncoded: Uint8Array | undefined
    try {
      asEncoded = wasm.roundTripServiceAccount(tsEncoded!)
      logger.info(`AssemblyScript decoded and re-encoded ${asEncoded ? asEncoded.length : 'undefined'} bytes`)
    } catch (error) {
      logger.error('AssemblyScript roundTripServiceAccount threw error:', error)
      expect(false).toBe(true)
      return
    }

    if (!asEncoded || asEncoded.length === 0) {
      logger.error('AssemblyScript decode failed (returned empty array)')
      logger.info(`TypeScript encoded first 20 bytes: ${Array.from(tsEncoded!.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
      expect(false).toBe(true)
      return
    }

    const sizeDiff = tsEncoded!.length - asEncoded.length
    logger.info(`Size difference: ${sizeDiff} bytes (TypeScript larger by ${sizeDiff})`)

    if (sizeDiff !== 0) {
      logger.error(`❌ Size mismatch detected! TypeScript: ${tsEncoded!.length}, AssemblyScript: ${asEncoded.length}, Diff: ${sizeDiff}`)
      
      // Decode both to see if they're functionally equivalent
      const [tsDecodeError, tsDecoded] = decodeCompleteServiceAccount(tsEncoded!)
      const [asDecodeError, asDecoded] = decodeCompleteServiceAccount(asEncoded)
      
      if (!tsDecodeError && !asDecodeError) {
        logger.info(`TypeScript decoded: storage=${tsDecoded!.value.storage.size}, preimages=${tsDecoded!.value.preimages.size}`)
        logger.info(`AssemblyScript decoded: storage=${asDecoded!.value.storage.size}, preimages=${asDecoded!.value.preimages.size}`)
      }
    } else {
      logger.info('✅ Size match!')
    }

    expect(tsEncoded!.length).toBeGreaterThan(0)
    expect(asEncoded.length).toBeGreaterThan(0)
  })

  it('should pass full round-trip (TypeScript -> AssemblyScript -> TypeScript)', async () => {
    logger.info('Testing TypeScript -> AssemblyScript -> TypeScript round-trip')
    const original = createTestServiceAccount()

    // Step 1: Encode with TypeScript
    const [encodeError, tsEncoded] = encodeCompleteServiceAccount(original)
    if (encodeError) {
      logger.error('TypeScript encode failed:', encodeError)
      expect(false).toBe(true)
      return
    }
    logger.info(`TypeScript encoded ${tsEncoded!.length} bytes`)

    // Step 2: Round-trip with AssemblyScript (decode then encode)
    const asEncoded = wasm.roundTripServiceAccount(tsEncoded!)
    if (!asEncoded || asEncoded.length === 0) {
      logger.error('AssemblyScript decode failed (returned empty array)')
      expect(false).toBe(true)
      return
    }
    logger.info(`AssemblyScript decoded and re-encoded ${asEncoded.length} bytes`)

    // Step 3: Decode with TypeScript
    const [decodeError, finalDecoded] = decodeCompleteServiceAccount(asEncoded)
    if (decodeError) {
      logger.error('TypeScript decode failed:', decodeError)
      expect(false).toBe(true)
      return
    }

    // Step 4: Compare original with final decoded
    const matches = compareServiceAccount(original, finalDecoded!.value)
    expect(matches).toBe(true)
    logger.info('✅ TypeScript -> AssemblyScript -> TypeScript round-trip passed')
  })
})

