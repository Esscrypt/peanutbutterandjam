/**
 * Isolated test for ServiceAccount requests encoding/decoding
 * 
 * Tests specifically the requests dictionary encoding/decoding to isolate issues
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import { logger } from '@pbnj/core'
import type { ServiceAccount, PreimageRequestStatus } from '@pbnj/types'
import {
  encodeCompleteServiceAccount,
  decodeCompleteServiceAccount,
} from '@pbnj/codec'
import { instantiate } from './wasmAsInit'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hexToBytes, type Hex } from '@pbnj/core'

let wasm: any = null

beforeAll(async () => {
  const wasmPath = join(__dirname, '../build/debug.wasm')
  const wasmBytes = readFileSync(wasmPath)
  wasm = await instantiate(wasmBytes)
})

/**
 * Create a test ServiceAccount with requests
 */
function createTestServiceAccountWithRequests(): ServiceAccount {
  return {
    codehash: '0x0101010101010101010101010101010101010101010101010101010101010101' as Hex,
    balance: 1000000n,
    minaccgas: 1000n,
    minmemogas: 100n,
    octets: 256n,
    gratis: 0n,
    items: 5n,
    created: 1n,
    lastacc: 10n,
    parent: 0n,
    storage: new Map<Hex, Uint8Array>([
      ['0x0000000000000000000000000000000000000000000000000000000000000001' as Hex, hexToBytes('0xdeadbeef' as Hex)],
    ]),
    preimages: new Map<Hex, Uint8Array>([
      ['0x1111111111111111111111111111111111111111111111111111111111111111' as Hex, hexToBytes('0x1234567890abcdef' as Hex)],
    ]),
    requests: new Map<Hex, Map<bigint, PreimageRequestStatus>>([
      ['0x2222222222222222222222222222222222222222222222222222222222222222' as Hex, new Map<bigint, PreimageRequestStatus>([
        [32n, [100n, 200n]], // [t0, t1] - was available from t0 until t1
        [64n, [150n]], // [t0] - available since t0
      ])],
      ['0x3333333333333333333333333333333333333333333333333333333333333333' as Hex, new Map<bigint, PreimageRequestStatus>([
        [128n, []], // [] - requested but not supplied
      ])],
    ]),
  }
}

/**
 * Compare two ServiceAccount objects, focusing on requests
 */
function compareServiceAccountRequests(a: ServiceAccount, b: ServiceAccount): boolean {
  // Compare requests
  if (a.requests.size !== b.requests.size) {
    logger.error(`requests size mismatch: ${a.requests.size} !== ${b.requests.size}`)
    return false
  }
  
  for (const [hash, lengthMapA] of a.requests) {
    const lengthMapB = b.requests.get(hash)
    if (!lengthMapB) {
      logger.error(`requests hash ${hash} missing in b`)
      return false
    }
    
    if (lengthMapA.size !== lengthMapB.size) {
      logger.error(`requests[${hash}] size mismatch: ${lengthMapA.size} !== ${lengthMapB.size}`)
      return false
    }
    
    for (const [length, statusA] of lengthMapA) {
      const statusB = lengthMapB.get(length)
      if (!statusB) {
        logger.error(`requests[${hash}][${length}] missing in b`)
        return false
      }
      
      if (statusA.length !== statusB.length) {
        logger.error(`requests[${hash}][${length}] status length mismatch: ${statusA.length} !== ${statusB.length}`)
        return false
      }
      
      for (let i = 0; i < statusA.length; i++) {
        if (statusA[i] !== statusB[i]) {
          logger.error(`requests[${hash}][${length}][${i}] mismatch: ${statusA[i]} !== ${statusB[i]}`)
          return false
        }
      }
    }
  }
  
  return true
}

describe('ServiceAccount Requests Round-Trip Tests', () => {
  it('should pass ServiceAccount with requests round-trip (TypeScript only)', async () => {
    logger.info('Testing ServiceAccount with requests round-trip (TypeScript)')
    const original = createTestServiceAccountWithRequests()

    // Encode with TypeScript
    const [encodeError, encoded] = encodeCompleteServiceAccount(original)
    if (encodeError) {
      logger.error('TypeScript encode error:', encodeError)
      expect(false).toBe(true)
      return
    }
    expect(encoded).not.toBeNull()
    logger.info(`TypeScript encoded ${encoded!.length} bytes`)
    logger.info(`Encoded bytes (first 100): ${Array.from(encoded!.slice(0, 100)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)

    // Decode with TypeScript
    const [decodeError, decoded] = decodeCompleteServiceAccount(encoded!)
    if (decodeError) {
      logger.error('TypeScript decode error:', decodeError)
      logger.error('Error details:', decodeError.message)
      expect(false).toBe(true)
      return
    }
    expect(decoded).not.toBeNull()

    // Compare requests
    const requestsMatch = compareServiceAccountRequests(original, decoded!.value)
    expect(requestsMatch).toBe(true)
    logger.info('✅ ServiceAccount with requests round-trip (TypeScript) passed')
  })

  it('should pass ServiceAccount with requests round-trip (TypeScript -> AssemblyScript -> TypeScript)', async () => {
    logger.info('Testing ServiceAccount with requests round-trip (TypeScript -> AssemblyScript -> TypeScript)')
    const original = createTestServiceAccountWithRequests()

    // Step 1: Encode with TypeScript
    const [encodeError, tsEncoded] = encodeCompleteServiceAccount(original)
    if (encodeError) {
      logger.error('TypeScript encode error:', encodeError)
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
      logger.error('TypeScript decode error:', decodeError)
      expect(false).toBe(true)
      return
    }

    // Step 4: Compare requests
    const requestsMatch = compareServiceAccountRequests(original, finalDecoded!.value)
    if (!requestsMatch) {
      logger.error('Requests do not match after round-trip')
      logger.error(`Original requests size: ${original.requests.size}`)
      logger.error(`Final requests size: ${finalDecoded!.value.requests.size}`)
      expect(false).toBe(true)
      return
    }
    
    logger.info('✅ ServiceAccount with requests round-trip (TypeScript -> AssemblyScript -> TypeScript) passed')
  })

  it('should compare ServiceAccount with requests encoding sizes (TypeScript vs AssemblyScript)', async () => {
    logger.info('Comparing ServiceAccount with requests encoding sizes')
    const original = createTestServiceAccountWithRequests()

    // Encode with TypeScript
    const [encodeError, tsEncoded] = encodeCompleteServiceAccount(original)
    if (encodeError) {
      logger.error('TypeScript encode error:', encodeError)
      expect(false).toBe(true)
      return
    }
    logger.info(`TypeScript encoded ${tsEncoded!.length} bytes`)

    // Round-trip with AssemblyScript
    const asEncoded = wasm.roundTripServiceAccount(tsEncoded!)
    if (!asEncoded || asEncoded.length === 0) {
      logger.error('AssemblyScript decode failed (returned empty array)')
      expect(false).toBe(true)
      return
    }
    logger.info(`AssemblyScript decoded and re-encoded ${asEncoded.length} bytes`)

    const sizeDiff = tsEncoded!.length - asEncoded.length
    logger.info(`Size difference: ${sizeDiff} bytes (TypeScript larger by ${sizeDiff})`)

    if (sizeDiff !== 0) {
      logger.error(`❌ Size mismatch detected! TypeScript: ${tsEncoded!.length}, AssemblyScript: ${asEncoded.length}, Diff: ${sizeDiff}`)
      
      // Decode both to see what's different
      const [tsDecodeError, tsDecoded] = decodeCompleteServiceAccount(tsEncoded!)
      const [asDecodeError, asDecoded] = decodeCompleteServiceAccount(asEncoded)
      
      if (!tsDecodeError && !asDecodeError) {
        logger.info(`TypeScript decoded: storage=${tsDecoded!.value.storage.size}, preimages=${tsDecoded!.value.preimages.size}, requests=${tsDecoded!.value.requests.size}`)
        logger.info(`AssemblyScript decoded: storage=${asDecoded!.value.storage.size}, preimages=${asDecoded!.value.preimages.size}, requests=${asDecoded!.value.requests.size}`)
      }
    } else {
      logger.info('✅ Size match!')
    }

    expect(tsEncoded!.length).toBeGreaterThan(0)
    expect(asEncoded.length).toBeGreaterThan(0)
  })
})

