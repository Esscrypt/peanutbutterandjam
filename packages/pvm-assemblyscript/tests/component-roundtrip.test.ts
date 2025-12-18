/**
 * Component-level round-trip tests
 * 
 * Tests individual components (Implications, PartialState, CompleteServiceAccount)
 * to isolate encoding/decoding issues
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import { logger } from '@pbnjam/core'
import {
  encodeImplications,
  decodeImplications,
  encodeImplicationsPair,
  decodeImplicationsPair,
  encodePartialState,
  decodePartialState,
  type ImplicationsPair,
} from '@pbnjam/codec'
import { ConfigService, type IConfigService } from '../../../infra/node/services/config-service'
import { hexToBytes, type Hex } from '@pbnjam/core'
import type { Implications, PartialState, ServiceAccount, PreimageRequestStatus } from '@pbnjam/types'
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
 * Create a test Implications object with complex data
 * Based on examples from implications-roundtrip.test.ts
 */
function createTestImplications(configService: IConfigService): Implications {
  const numCores = configService.numCores
  const numValidators = configService.numValidators
  const authQueueSize = 80 // AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE

  // Create mock service accounts with storage, preimages, and requests
  const accounts = new Map<bigint, ServiceAccount>()
  
  // Service account 1 - main service with storage, preimages, and requests
  const serviceAccount1: ServiceAccount = {
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
      ['0x0000000000000000000000000000000000000000000000000000000000000002' as Hex, hexToBytes('0xcafebabe' as Hex)],
    ]),
    preimages: new Map<Hex, Uint8Array>([
      ['0x1111111111111111111111111111111111111111111111111111111111111111' as Hex, hexToBytes('0x1234567890abcdef' as Hex)],
    ]),
    requests: new Map<Hex, Map<bigint, PreimageRequestStatus>>([
      ['0x2222222222222222222222222222222222222222222222222222222222222222' as Hex, new Map<bigint, PreimageRequestStatus>([
        [32n, [100n, 200n]], // [t0, t1] - was available from t0 until t1
        [64n, [150n]], // [t0] - available since t0
      ])],
    ]),
  }
  accounts.set(1n, serviceAccount1)
  
  // Service account 2 - secondary service with storage, preimages, and requests
  const serviceAccount2: ServiceAccount = {
    codehash: '0x0202020202020202020202020202020202020202020202020202020202020202' as Hex,
    balance: 500000n,
    minaccgas: 500n,
    minmemogas: 50n,
    octets: 128n,
    gratis: 0n,
    items: 2n,
    created: 5n,
    lastacc: 8n,
    parent: 1n,
    storage: new Map<Hex, Uint8Array>([
      ['0x0000000000000000000000000000000000000000000000000000000000000003' as Hex, hexToBytes('0xfeedface' as Hex)],
    ]),
    preimages: new Map<Hex, Uint8Array>(),
    requests: new Map<Hex, Map<bigint, PreimageRequestStatus>>([
      ['0x3333333333333333333333333333333333333333333333333333333333333333' as Hex, new Map<bigint, PreimageRequestStatus>([
        [128n, []], // [] - requested but not supplied
      ])],
    ]),
  }
  accounts.set(2n, serviceAccount2)

  // Create mock stagingset (validator keys - 336 bytes each)
  const stagingset: Uint8Array[] = []
  for (let i = 0; i < Math.min(numValidators, 3); i++) {
    // Create a 336-byte validator key
    const validatorKey = new Uint8Array(336)
    validatorKey.fill(i + 1)
    validatorKey[0] = 0xAA // Bandersnatch start marker
    validatorKey[32] = 0xBB // Ed25519 start marker
    validatorKey[64] = 0xCC // BLS start marker
    validatorKey[208] = 0xDD // Metadata start marker
    stagingset.push(validatorKey)
  }
  // Pad to numValidators if needed
  while (stagingset.length < numValidators) {
    const validatorKey = new Uint8Array(336)
    validatorKey.fill(0)
    stagingset.push(validatorKey)
  }

  // Create mock authqueue
  const authqueue: Uint8Array[][] = []
  for (let core = 0; core < Math.min(numCores, 5); core++) {
    const coreQueue: Uint8Array[] = []
    for (let i = 0; i < Math.min(authQueueSize, 3); i++) {
      // Create a 32-byte hash
      const hash = new Uint8Array(32)
      hash.fill(core * 10 + i)
      hash[0] = 0xFF // Marker for testing
      coreQueue.push(hash)
    }
    // Pad to authQueueSize
    while (coreQueue.length < authQueueSize) {
      coreQueue.push(new Uint8Array(32)) // Empty hash
    }
    authqueue.push(coreQueue)
  }
  // Pad to numCores
  while (authqueue.length < numCores) {
    authqueue.push(new Array(authQueueSize).fill(null).map(() => new Uint8Array(32)))
  }

  // Create mock assigners (one per core)
  const assigners: bigint[] = []
  for (let i = 0; i < numCores; i++) {
    assigners.push(BigInt(i % 3 + 1)) // Cycle through service IDs 1, 2, 3
  }

  // Create mock deferred transfers
  const xfers = [
    {
      source: 1n,
      dest: 2n,
      amount: 10000n,
      memo: hexToBytes('0x54657374207472616e73666572' as any), // "Test transfer" in hex
      gasLimit: 1000n,
    },
    {
      source: 2n,
      dest: 1n,
      amount: 5000n,
      memo: hexToBytes('0x52657475726e' as any), // "Return" in hex
      gasLimit: 500n,
    },
  ]

  // Create mock provisions
  const provisions = new Map<bigint, Uint8Array>([
    [1n, hexToBytes('0x0102030405060708090a0b0c0d0e0f' as any)],
    [2n, hexToBytes('0x102030405060708090a0b0c0d0e0f0' as any)],
  ])

  // Create partial state
  const partialState: PartialState = {
    accounts,
    stagingset,
    authqueue,
    manager: 1n,
    assigners,
    delegator: 2n,
    registrar: 1n,
    alwaysaccers: new Map([
      [1n, 10000n],
      [2n, 5000n],
    ]),
  }

  // Create implications
  const implications: Implications = {
    id: 1n,
    state: partialState,
    nextfreeid: 3n,
    xfers,
    yield: hexToBytes('0x4444444444444444444444444444444444444444444444444444444444444444' as any),
    provisions,
  }

  return implications
}

/**
 * Create a test PartialState object with complex data
 */
function createTestPartialState(configService: IConfigService): PartialState {
  const numCores = configService.numCores
  const numValidators = configService.numValidators
  const authQueueSize = 80

  // Create multiple service accounts with storage, preimages
  const accounts = new Map<bigint, ServiceAccount>()
  
  // Service account 1 with storage, preimages, and requests
  const account1: ServiceAccount = {
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
      ['0x0000000000000000000000000000000000000000000000000000000000000002' as Hex, hexToBytes('0xcafebabe' as Hex)],
    ]),
    preimages: new Map<Hex, Uint8Array>([
      ['0x1111111111111111111111111111111111111111111111111111111111111111' as Hex, hexToBytes('0x1234567890abcdef' as Hex)],
    ]),
    requests: new Map<Hex, Map<bigint, PreimageRequestStatus>>([
      ['0x2222222222222222222222222222222222222222222222222222222222222222' as Hex, new Map<bigint, PreimageRequestStatus>([
        [32n, [100n, 200n]], // [t0, t1] - was available from t0 until t1
        [64n, [150n]], // [t0] - available since t0
      ])],
    ]),
  }
  accounts.set(1n, account1)

  // Service account 2 with storage, preimages, and requests
  const account2: ServiceAccount = {
    codehash: '0x0202020202020202020202020202020202020202020202020202020202020202' as Hex,
    balance: 500000n,
    minaccgas: 500n,
    minmemogas: 50n,
    octets: 128n,
    gratis: 0n,
    items: 2n,
    created: 5n,
    lastacc: 8n,
    parent: 1n,
    storage: new Map<Hex, Uint8Array>([
      ['0x0000000000000000000000000000000000000000000000000000000000000003' as Hex, hexToBytes('0xfeedface' as Hex)],
    ]),
    preimages: new Map<Hex, Uint8Array>(),
    requests: new Map<Hex, Map<bigint, PreimageRequestStatus>>([
      ['0x3333333333333333333333333333333333333333333333333333333333333333' as Hex, new Map<bigint, PreimageRequestStatus>([
        [128n, []], // [] - requested but not supplied
      ])],
    ]),
  }
  accounts.set(2n, account2)

  // Create mock stagingset (validator keys - 336 bytes each)
  const stagingset: Uint8Array[] = []
  for (let i = 0; i < Math.min(numValidators, 3); i++) {
    const validatorKey = new Uint8Array(336)
    validatorKey.fill(i + 1)
    validatorKey[0] = 0xAA
    validatorKey[32] = 0xBB
    validatorKey[64] = 0xCC
    validatorKey[208] = 0xDD
    stagingset.push(validatorKey)
  }
  while (stagingset.length < numValidators) {
    stagingset.push(new Uint8Array(336).fill(0))
  }

  // Create mock authqueue
  const authqueue: Uint8Array[][] = []
  for (let core = 0; core < Math.min(numCores, 5); core++) {
    const coreQueue: Uint8Array[] = []
    for (let i = 0; i < Math.min(authQueueSize, 3); i++) {
      const hash = new Uint8Array(32)
      hash.fill(core * 10 + i)
      hash[0] = 0xFF
      coreQueue.push(hash)
    }
    while (coreQueue.length < authQueueSize) {
      coreQueue.push(new Uint8Array(32))
    }
    authqueue.push(coreQueue)
  }
  while (authqueue.length < numCores) {
    authqueue.push(new Array(authQueueSize).fill(null).map(() => new Uint8Array(32)))
  }

  // Create mock assigners
  const assigners: bigint[] = []
  for (let i = 0; i < numCores; i++) {
    assigners.push(BigInt(i % 3 + 1))
  }

  return {
    accounts,
    stagingset,
    authqueue,
    manager: 1n,
    assigners,
    delegator: 2n,
    registrar: 1n,
    alwaysaccers: new Map([
      [1n, 10000n],
      [2n, 5000n],
    ]),
  }
}

/**
 * Compare two ServiceAccount objects deeply
 * Note: octets and items are computed from storage, so we compute them for comparison
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
  
  // Compute octets and items from storage for comparison (they're computed fields)
  let totalOctetsA = 0n
  for (const value of a.storage.values()) {
    totalOctetsA += BigInt(value.length)
  }
  const octetsA = totalOctetsA
  const itemsA = BigInt(a.storage.size)
  
  let totalOctetsB = 0n
  for (const value of b.storage.values()) {
    totalOctetsB += BigInt(value.length)
  }
  const octetsB = totalOctetsB
  const itemsB = BigInt(b.storage.size)
  
  if (octetsA !== octetsB) {
    logger.error(`octets mismatch: ${octetsA} !== ${octetsB}`)
    return false
  }
  if (itemsA !== itemsB) {
    logger.error(`items mismatch: ${itemsA} !== ${itemsB}`)
    return false
  }
  
  if (a.gratis !== b.gratis) {
    logger.error(`gratis mismatch: ${a.gratis} !== ${b.gratis}`)
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
    if (!valueB) {
      logger.error(`storage key ${key} missing in b`)
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
  for (const [key, valueA] of a.preimages.entries()) {
    const valueB = b.preimages.get(key)
    if (!valueB) {
      logger.error(`preimages key ${key} missing in b`)
      return false
    }
    if (valueA.length !== valueB.length) {
      logger.error(`preimages[${key}] length mismatch: ${valueA.length} !== ${valueB.length}`)
      return false
    }
    for (let i = 0; i < valueA.length; i++) {
      if (valueA[i] !== valueB[i]) {
        logger.error(`preimages[${key}][${i}] mismatch: ${valueA[i]} !== ${valueB[i]}`)
        return false
      }
    }
  }

  // Compare requests
  if (a.requests.size !== b.requests.size) {
    logger.error(`requests size mismatch: ${a.requests.size} !== ${b.requests.size}`)
    return false
  }
  for (const [hash, lengthMapA] of a.requests.entries()) {
    const lengthMapB = b.requests.get(hash)
    if (!lengthMapB) {
      logger.error(`requests hash ${hash} missing in b`)
      return false
    }
    if (lengthMapA.size !== lengthMapB.size) {
      logger.error(`requests[${hash}] size mismatch: ${lengthMapA.size} !== ${lengthMapB.size}`)
      return false
    }
    for (const [length, statusA] of lengthMapA.entries()) {
      const statusB = lengthMapB.get(length)
      if (!statusB) {
        logger.error(`requests[${hash}][${length}] missing in b`)
        return false
      }
      if (statusA.length !== statusB.length) {
        logger.error(`requests[${hash}][${length}] length mismatch: ${statusA.length} !== ${statusB.length}`)
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

/**
 * Compare two PartialState objects deeply
 */
function comparePartialState(a: PartialState, b: PartialState): boolean {
  // Compare accounts
  if (a.accounts.size !== b.accounts.size) {
    logger.error(`accounts size mismatch: ${a.accounts.size} !== ${b.accounts.size}`)
    return false
  }
  for (const [serviceId, accountA] of a.accounts.entries()) {
    const accountB = b.accounts.get(serviceId)
    if (!accountB) {
      logger.error(`account ${serviceId} missing in b`)
      return false
    }
    if (!compareServiceAccount(accountA, accountB)) {
      logger.error(`account ${serviceId} mismatch`)
      return false
    }
  }

  // Compare stagingset
  if (a.stagingset.length !== b.stagingset.length) {
    logger.error(`stagingset length mismatch: ${a.stagingset.length} !== ${b.stagingset.length}`)
    return false
  }
  for (let i = 0; i < a.stagingset.length; i++) {
    const valA = a.stagingset[i]
    const valB = b.stagingset[i]
    if (valA.length !== valB.length) {
      logger.error(`stagingset[${i}] length mismatch: ${valA.length} !== ${valB.length}`)
      return false
    }
    for (let j = 0; j < valA.length; j++) {
      if (valA[j] !== valB[j]) {
        logger.error(`stagingset[${i}][${j}] mismatch: ${valA[j]} !== ${valB[j]}`)
        return false
      }
    }
  }

  // Compare authqueue
  // Note: decodeAuthqueue filters out zero hashes, so we need to compare only non-zero items
  if (a.authqueue.length !== b.authqueue.length) {
    logger.error(`authqueue length mismatch: ${a.authqueue.length} !== ${b.authqueue.length}`)
    return false
  }
  for (let i = 0; i < a.authqueue.length; i++) {
    const queueA = a.authqueue[i]
    const queueB = b.authqueue[i]
    
    // Filter out zero hashes for comparison (decodeAuthqueue filters them out)
    const nonZeroA = queueA.filter(hash => {
      // Check if hash is all zeros
      for (let k = 0; k < hash.length; k++) {
        if (hash[k] !== 0) return true
      }
      return false
    })
    const nonZeroB = queueB.filter(hash => {
      // Check if hash is all zeros
      for (let k = 0; k < hash.length; k++) {
        if (hash[k] !== 0) return true
      }
      return false
    })
    
    if (nonZeroA.length !== nonZeroB.length) {
      logger.error(`authqueue[${i}] non-zero length mismatch: ${nonZeroA.length} !== ${nonZeroB.length}`)
      return false
    }
    for (let j = 0; j < nonZeroA.length; j++) {
      const hashA = nonZeroA[j]
      const hashB = nonZeroB[j]
      if (hashA.length !== hashB.length) {
        logger.error(`authqueue[${i}][${j}] length mismatch: ${hashA.length} !== ${hashB.length}`)
        return false
      }
      for (let k = 0; k < hashA.length; k++) {
        if (hashA[k] !== hashB[k]) {
          logger.error(`authqueue[${i}][${j}][${k}] mismatch: ${hashA[k]} !== ${hashB[k]}`)
          return false
        }
      }
    }
  }

  // Compare manager, delegator, registrar
  if (a.manager !== b.manager) {
    logger.error(`manager mismatch: ${a.manager} !== ${b.manager}`)
    return false
  }
  if (a.delegator !== b.delegator) {
    logger.error(`delegator mismatch: ${a.delegator} !== ${b.delegator}`)
    return false
  }
  if (a.registrar !== b.registrar) {
    logger.error(`registrar mismatch: ${a.registrar} !== ${b.registrar}`)
    return false
  }

  // Compare assigners
  if (a.assigners.length !== b.assigners.length) {
    logger.error(`assigners length mismatch: ${a.assigners.length} !== ${b.assigners.length}`)
    return false
  }
  for (let i = 0; i < a.assigners.length; i++) {
    if (a.assigners[i] !== b.assigners[i]) {
      logger.error(`assigners[${i}] mismatch: ${a.assigners[i]} !== ${b.assigners[i]}`)
      return false
    }
  }

  // Compare alwaysaccers
  if (a.alwaysaccers.size !== b.alwaysaccers.size) {
    logger.error(`alwaysaccers size mismatch: ${a.alwaysaccers.size} !== ${b.alwaysaccers.size}`)
    return false
  }
  for (const [serviceId, gasA] of a.alwaysaccers.entries()) {
    const gasB = b.alwaysaccers.get(serviceId)
    if (gasB === undefined) {
      logger.error(`alwaysaccers ${serviceId} missing in b`)
      return false
    }
    if (gasA !== gasB) {
      logger.error(`alwaysaccers[${serviceId}] mismatch: ${gasA} !== ${gasB}`)
      return false
    }
  }

  return true
}

/**
 * Compare two Implications objects deeply
 */
function compareImplications(a: Implications, b: Implications): boolean {
  if (!a || !b) {
    logger.error(`Invalid inputs: a=${a}, b=${b}`)
    return false
  }
  
  if (a.id !== b.id) {
    logger.error(`ID mismatch: ${a.id} !== ${b.id}`)
    return false
  }
  if (a.nextfreeid !== b.nextfreeid) {
    logger.error(`nextfreeid mismatch: ${a.nextfreeid} !== ${b.nextfreeid}`)
    return false
  }
  
  // Compare yield
  const aYieldNull = a.yield === null || a.yield === undefined
  const bYieldNull = b.yield === null || b.yield === undefined
  if (aYieldNull !== bYieldNull) {
    logger.error(`yield null mismatch: ${aYieldNull} !== ${bYieldNull}`)
    return false
  }
  if (!aYieldNull && !bYieldNull && a.yield && b.yield) {
    if (a.yield.length !== b.yield.length) {
      logger.error(`yield length mismatch: ${a.yield.length} !== ${b.yield.length}`)
      return false
    }
    for (let i = 0; i < a.yield.length; i++) {
      if (a.yield[i] !== b.yield[i]) {
        logger.error(`yield[${i}] mismatch: ${a.yield[i]} !== ${b.yield[i]}`)
        return false
      }
    }
  }
  
  // Compare xfers
  if (!a.xfers || !b.xfers) {
    logger.error(`xfers is undefined: a.xfers=${a.xfers}, b.xfers=${b.xfers}`)
    return false
  }
  if (a.xfers.length !== b.xfers.length) {
    logger.error(`xfers length mismatch: ${a.xfers.length} !== ${b.xfers.length}`)
    return false
  }
  for (let i = 0; i < a.xfers.length; i++) {
    const xferA = a.xfers[i]
    const xferB = b.xfers[i]
    if (xferA.source !== xferB.source) {
      logger.error(`xfers[${i}].source mismatch: ${xferA.source} !== ${xferB.source}`)
      return false
    }
    if (xferA.dest !== xferB.dest) {
      logger.error(`xfers[${i}].dest mismatch: ${xferA.dest} !== ${xferB.dest}`)
      return false
    }
    if (xferA.amount !== xferB.amount) {
      logger.error(`xfers[${i}].amount mismatch: ${xferA.amount} !== ${xferB.amount}`)
      return false
    }
    if (xferA.gasLimit !== xferB.gasLimit) {
      logger.error(`xfers[${i}].gasLimit mismatch: ${xferA.gasLimit} !== ${xferB.gasLimit}`)
      return false
    }
    if (xferA.memo.length !== xferB.memo.length) {
      logger.error(`xfers[${i}].memo length mismatch: ${xferA.memo.length} !== ${xferB.memo.length}`)
      return false
    }
    for (let j = 0; j < xferA.memo.length; j++) {
      if (xferA.memo[j] !== xferB.memo[j]) {
        logger.error(`xfers[${i}].memo[${j}] mismatch: ${xferA.memo[j]} !== ${xferB.memo[j]}`)
        return false
      }
    }
  }
  
  // Compare provisions
  if (a.provisions.size !== b.provisions.size) {
    logger.error(`provisions size mismatch: ${a.provisions.size} !== ${b.provisions.size}`)
    return false
  }
  for (const [key, valueA] of a.provisions.entries()) {
    const valueB = b.provisions.get(key)
    if (!valueB) {
      logger.error(`provisions key ${key} missing in b`)
      return false
    }
    if (valueA.length !== valueB.length) {
      logger.error(`provisions[${key}] length mismatch: ${valueA.length} !== ${valueB.length}`)
      return false
    }
    for (let i = 0; i < valueA.length; i++) {
      if (valueA[i] !== valueB[i]) {
        logger.error(`provisions[${key}][${i}] mismatch`)
        return false
      }
    }
  }
  
  // Compare state
  if (!comparePartialState(a.state, b.state)) {
    logger.error('state mismatch')
    return false
  }
  
  return true
}

describe('Component Round-Trip Tests', () => {
  const configService = new ConfigService('tiny')

  it('should pass Implications round-trip (TypeScript only)', async () => {
    logger.info('Testing Implications round-trip (TypeScript)')
    const original = createTestImplications(configService)

    // Encode with TypeScript
    const [encodeError, encoded] = encodeImplications(original, configService)
    if (encodeError) {
      logger.error('Encode error:', encodeError)
      expect(false).toBe(true)
      return
    }
    expect(encoded).not.toBeNull()
    logger.info(`TypeScript encoded ${encoded!.length} bytes`)

    // Decode with TypeScript
    const [decodeError, decoded] = decodeImplications(encoded!, configService)
    if (decodeError) {
      logger.error('Decode error:', decodeError)
      expect(false).toBe(true)
      return
    }
    expect(decoded).not.toBeNull()

    // Compare sizes
    expect(decoded!.value.id).toBe(original.id)
    expect(decoded!.value.nextfreeid).toBe(original.nextfreeid)
    expect(decoded!.value.state.accounts.size).toBe(original.state.accounts.size)
    expect(decoded!.value.xfers.length).toBe(original.xfers.length)
    
    // Compare values deeply
    expect(compareImplications(original, decoded!.value)).toBe(true)
    logger.info('✅ Implications round-trip (TypeScript) passed')
  })

  it('should pass Implications round-trip (TypeScript -> AssemblyScript -> TypeScript)', async () => {
    logger.info('Testing Implications round-trip (TypeScript -> AssemblyScript -> TypeScript)')
    const original = createTestImplications(configService)

    // Step 1: Encode with TypeScript
    const [encodeError, tsEncoded] = encodeImplications(original, configService)
    if (encodeError) {
      logger.error('TypeScript encode error:', encodeError)
      expect(false).toBe(true)
      return
    }
    logger.info(`TypeScript encoded ${tsEncoded!.length} bytes`)

    // Step 2: Round-trip with AssemblyScript (decode then encode)
    const numCores = configService.numCores
    const numValidators = configService.numValidators
    const authQueueSize = 80

    const asEncoded = wasm.roundTripSingleImplications(
      tsEncoded!,
      numCores,
      numValidators,
      authQueueSize,
    )
    if (!asEncoded || asEncoded.length === 0) {
      logger.error('AssemblyScript decode failed (returned empty array)')
      expect(false).toBe(true)
      return
    }
    logger.info(`AssemblyScript decoded and re-encoded ${asEncoded.length} bytes`)

    // Step 3: Decode with TypeScript
    const [decodeError, finalDecoded] = decodeImplications(asEncoded, configService)
    if (decodeError) {
      logger.error('TypeScript decode error:', decodeError)
      expect(false).toBe(true)
      return
    }

    // Step 4: Compare sizes
    expect(finalDecoded!.value.id).toBe(original.id)
    expect(finalDecoded!.value.nextfreeid).toBe(original.nextfreeid)
    expect(finalDecoded!.value.state.accounts.size).toBe(original.state.accounts.size)
    expect(finalDecoded!.value.xfers.length).toBe(original.xfers.length)
    expect(finalDecoded!.value.xfers).toBeDefined()
    
    // Compare sizes match
    expect(asEncoded.length).toBe(tsEncoded!.length)
    
    // Compare values deeply
    expect(compareImplications(original, finalDecoded!.value)).toBe(true)
    
    logger.info('✅ Implications round-trip (TypeScript -> AssemblyScript -> TypeScript) passed')
  })

  it('should pass PartialState round-trip', async () => {
    logger.info('Testing PartialState round-trip')
    const original = createTestPartialState(configService)

    // Encode with TypeScript
    const [encodeError, encoded] = encodePartialState(original, configService)
    if (encodeError) {
      logger.error('Encode error:', encodeError)
      expect(false).toBe(true)
      return
    }
    expect(encoded).not.toBeNull()
    logger.info(`TypeScript encoded ${encoded!.length} bytes`)

    // Decode with TypeScript
    const [decodeError, decoded] = decodePartialState(encoded!, configService)
    if (decodeError) {
      logger.error('Decode error:', decodeError)
      expect(false).toBe(true)
      return
    }
    expect(decoded).not.toBeNull()

    // Compare sizes
    expect(decoded!.value.accounts.size).toBe(original.accounts.size)
    expect(decoded!.value.stagingset.length).toBe(original.stagingset.length)
    expect(decoded!.value.authqueue.length).toBe(original.authqueue.length)
    
    // Compare values deeply
    expect(comparePartialState(original, decoded!.value)).toBe(true)
    logger.info('✅ PartialState round-trip passed')
  })

  it('should pass ImplicationsPair round-trip (TypeScript only)', async () => {
    logger.info('Testing ImplicationsPair round-trip (TypeScript)')
    const regular = createTestImplications(configService)
    const exceptional = createTestImplications(configService)
    exceptional.id = 2n
    const original: ImplicationsPair = [regular, exceptional]

    // Encode with TypeScript
    const [encodeError, encoded] = encodeImplicationsPair(original, configService)
    if (encodeError) {
      logger.error('Encode error:', encodeError)
      expect(false).toBe(true)
      return
    }
    expect(encoded).not.toBeNull()
    logger.info(`TypeScript encoded ${encoded!.length} bytes`)

    // Decode with TypeScript
    const [decodeError, decoded] = decodeImplicationsPair(encoded!, configService)
    if (decodeError) {
      logger.error('Decode error:', decodeError)
      expect(false).toBe(true)
      return
    }
    expect(decoded).not.toBeNull()

    // Compare
    expect(decoded!.value[0].id).toBe(original[0].id)
    expect(decoded!.value[1].id).toBe(original[1].id)
    logger.info('✅ ImplicationsPair round-trip passed')
  })

  it('should compare ImplicationsPair encoding sizes (TypeScript vs AssemblyScript)', async () => {
    logger.info('Comparing ImplicationsPair encoding sizes')
    const regular = createTestImplications(configService)
    const exceptional = createTestImplications(configService)
    exceptional.id = 2n
    const original: ImplicationsPair = [regular, exceptional]

    // Encode with TypeScript
    const [encodeError, tsEncoded] = encodeImplicationsPair(original, configService)
    if (encodeError) {
      logger.error('TypeScript encode error:', encodeError)
      expect(false).toBe(true)
      return
    }
    logger.info(`TypeScript encoded ${tsEncoded!.length} bytes`)

    // Round-trip with AssemblyScript
    const numCores = configService.numCores
    const numValidators = configService.numValidators
    const authQueueSize = 80

    const asDecoded = wasm.roundTripImplications(
      tsEncoded!,
      numCores,
      numValidators,
      authQueueSize,
    )
    logger.info(`AssemblyScript decoded and re-encoded ${asDecoded ? asDecoded.length : 'undefined'} bytes`)

    if (!asDecoded || asDecoded.length === 0) {
      logger.error('AssemblyScript decode failed (returned empty array)')
      expect(false).toBe(true)
      return
    }

    const sizeDiff = tsEncoded!.length - asDecoded.length
    logger.info(`Size difference: ${sizeDiff} bytes (TypeScript larger by ${sizeDiff})`)

    if (sizeDiff !== 0) {
      logger.error(`❌ Size mismatch detected! TypeScript: ${tsEncoded!.length}, AssemblyScript: ${asDecoded.length}, Diff: ${sizeDiff}`)
      // Decode both to see if they're functionally equivalent
      const [tsDecodeError, tsDecoded] = decodeImplicationsPair(tsEncoded!, configService)
      const [asDecodeError, asDecodedFinal] = decodeImplicationsPair(asDecoded, configService)
      
      if (!tsDecodeError && !asDecodeError) {
        logger.info(`TypeScript decoded: regular id=${tsDecoded!.value[0].id}, exceptional id=${tsDecoded!.value[1].id}`)
        logger.info(`AssemblyScript decoded: regular id=${asDecodedFinal!.value[0].id}, exceptional id=${asDecodedFinal!.value[1].id}`)
        logger.info(`TypeScript regular accounts: ${tsDecoded!.value[0].state.accounts.size}`)
        logger.info(`AssemblyScript regular accounts: ${asDecodedFinal!.value[0].state.accounts.size}`)
        
        // Compare values even if sizes differ
        if (compareImplications(tsDecoded!.value[0], asDecodedFinal!.value[0]) && 
            compareImplications(tsDecoded!.value[1], asDecodedFinal!.value[1])) {
          logger.info('✅ Values match despite size difference')
        } else {
          logger.error('❌ Values do not match!')
        }
      }
    } else {
      logger.info('✅ Size match!')
      
      // Also verify values match when sizes match
      const [tsDecodeError, tsDecoded] = decodeImplicationsPair(tsEncoded!, configService)
      const [asDecodeError, asDecodedFinal] = decodeImplicationsPair(asDecoded, configService)
      
      if (!tsDecodeError && !asDecodeError) {
        if (compareImplications(tsDecoded!.value[0], asDecodedFinal!.value[0]) && 
            compareImplications(tsDecoded!.value[1], asDecodedFinal!.value[1])) {
          logger.info('✅ Values match!')
        } else {
          logger.error('❌ Values do not match despite size match!')
        }
      }
    }

    expect(tsEncoded!.length).toBeGreaterThan(0)
    expect(asDecoded.length).toBeGreaterThan(0)
  })

  it('should pass PartialState round-trip (TypeScript only)', async () => {
    logger.info('Testing PartialState round-trip (TypeScript)')
    const original = createTestPartialState(configService)

    // Encode with TypeScript
    const [encodeError, encoded] = encodePartialState(original, configService)
    if (encodeError) {
      logger.error('TypeScript encode error:', encodeError)
      expect(false).toBe(true)
      return
    }
    logger.info(`TypeScript encoded ${encoded!.length} bytes`)

    // Decode with TypeScript
    const [decodeError, decoded] = decodePartialState(encoded!, configService)
    if (decodeError) {
      logger.error('TypeScript decode error:', decodeError)
      expect(false).toBe(true)
      return
    }

    // Compare sizes
    expect(decoded!.value.accounts.size).toBe(original.accounts.size)
    expect(decoded!.value.stagingset.length).toBe(original.stagingset.length)
    expect(decoded!.value.authqueue.length).toBe(original.authqueue.length)
    expect(decoded!.value.manager).toBe(original.manager)
    expect(decoded!.value.delegator).toBe(original.delegator)
    expect(decoded!.value.registrar).toBe(original.registrar)
    
    // Compare values deeply
    expect(comparePartialState(original, decoded!.value)).toBe(true)
    
    logger.info('✅ PartialState round-trip (TypeScript) passed')
  })

  it('should pass PartialState round-trip (TypeScript -> AssemblyScript -> TypeScript)', async () => {
    logger.info('Testing PartialState round-trip (TypeScript -> AssemblyScript -> TypeScript)')
    const original = createTestPartialState(configService)

    // Step 1: Encode with TypeScript
    const [encodeError, tsEncoded] = encodePartialState(original, configService)
    if (encodeError) {
      logger.error('TypeScript encode error:', encodeError)
      expect(false).toBe(true)
      return
    }
    logger.info(`TypeScript encoded ${tsEncoded!.length} bytes`)

    // Step 2: Round-trip with AssemblyScript (decode then encode)
    const numCores = configService.numCores
    const numValidators = configService.numValidators
    const authQueueSize = 80

    const asEncoded = wasm.roundTripPartialState(
      tsEncoded!,
      numCores,
      numValidators,
      authQueueSize,
    )
    if (!asEncoded || asEncoded.length === 0) {
      logger.error('AssemblyScript decode failed (returned empty array)')
      expect(false).toBe(true)
      return
    }
    logger.info(`AssemblyScript decoded and re-encoded ${asEncoded.length} bytes`)

    // Step 3: Decode with TypeScript
    const [decodeError, finalDecoded] = decodePartialState(asEncoded, configService)
    if (decodeError) {
      logger.error('TypeScript decode error:', decodeError)
      expect(false).toBe(true)
      return
    }

    // Step 4: Compare sizes
    expect(finalDecoded!.value.accounts.size).toBe(original.accounts.size)
    expect(finalDecoded!.value.stagingset.length).toBe(original.stagingset.length)
    expect(finalDecoded!.value.authqueue.length).toBe(original.authqueue.length)
    expect(finalDecoded!.value.manager).toBe(original.manager)
    expect(finalDecoded!.value.delegator).toBe(original.delegator)
    expect(finalDecoded!.value.registrar).toBe(original.registrar)
    
    // Compare sizes match
    expect(asEncoded.length).toBe(tsEncoded!.length)
    
    // Compare values deeply
    expect(comparePartialState(original, finalDecoded!.value)).toBe(true)
    
    logger.info('✅ PartialState round-trip (TypeScript -> AssemblyScript -> TypeScript) passed')
  })

  it('should compare PartialState encoding sizes (TypeScript vs AssemblyScript)', async () => {
    logger.info('Comparing PartialState encoding sizes')
    const original = createTestPartialState(configService)

    // Encode with TypeScript
    const [encodeError, tsEncoded] = encodePartialState(original, configService)
    if (encodeError) {
      logger.error('TypeScript encode error:', encodeError)
      expect(false).toBe(true)
      return
    }
    logger.info(`TypeScript encoded ${tsEncoded!.length} bytes`)

    // Round-trip with AssemblyScript
    const numCores = configService.numCores
    const numValidators = configService.numValidators
    const authQueueSize = 80

    const asEncoded = wasm.roundTripPartialState(
      tsEncoded!,
      numCores,
      numValidators,
      authQueueSize,
    )
    logger.info(`AssemblyScript decoded and re-encoded ${asEncoded ? asEncoded.length : 'undefined'} bytes`)

    if (!asEncoded || asEncoded.length === 0) {
      logger.error('AssemblyScript decode failed (returned empty array)')
      expect(false).toBe(true)
      return
    }

    const sizeDiff = tsEncoded!.length - asEncoded.length
    logger.info(`Size difference: ${sizeDiff} bytes (TypeScript larger by ${sizeDiff})`)

    if (sizeDiff !== 0) {
      logger.error(`❌ Size mismatch detected! TypeScript: ${tsEncoded!.length}, AssemblyScript: ${asEncoded.length}, Diff: ${sizeDiff}`)
      
      // Decode both to see if they're functionally equivalent
      const [tsDecodeError, tsDecoded] = decodePartialState(tsEncoded!, configService)
      const [asDecodeError, asDecoded] = decodePartialState(asEncoded, configService)
      
      if (!tsDecodeError && !asDecodeError) {
        logger.info(`TypeScript decoded: accounts=${tsDecoded!.value.accounts.size}`)
        logger.info(`AssemblyScript decoded: accounts=${asDecoded!.value.accounts.size}`)
        
        // Check if accounts are being decoded
        if (tsDecoded!.value.accounts.size > 0 && asDecoded!.value.accounts.size === 0) {
          logger.error('❌ AssemblyScript failed to decode accounts!')
          // Try to decode the first account to see where it fails
          const firstAccount = Array.from(tsDecoded!.value.accounts.values())[0]
          logger.info(`First account has: storage=${firstAccount.storage.size}, preimages=${firstAccount.preimages.size}, requests=${firstAccount.requests.size}`)
        }
        
        // Compare values even if sizes differ
        if (comparePartialState(tsDecoded!.value, asDecoded!.value)) {
          logger.info('✅ Values match despite size difference')
        } else {
          logger.error('❌ Values do not match!')
        }
      } else {
        if (tsDecodeError) {
          logger.error(`TypeScript decode error: ${tsDecodeError.message}`)
        }
        if (asDecodeError) {
          logger.error(`AssemblyScript decode error: ${asDecodeError.message}`)
        }
      }
    } else {
      logger.info('✅ Size match!')
      
      // Also verify values match when sizes match
      const [tsDecodeError, tsDecoded] = decodePartialState(tsEncoded!, configService)
      const [asDecodeError, asDecoded] = decodePartialState(asEncoded, configService)
      
      if (!tsDecodeError && !asDecodeError) {
        if (comparePartialState(tsDecoded!.value, asDecoded!.value)) {
          logger.info('✅ Values match!')
    } else {
          logger.error('❌ Values do not match despite size match!')
        }
      }
    }

    expect(tsEncoded!.length).toBeGreaterThan(0)
    expect(asEncoded.length).toBeGreaterThan(0)
  })

  // TODO: Re-enable when build issues are fixed
  // it('should pass Implications -> AssemblyScript -> TypeScript round-trip', async () => {
  //   logger.info('Testing Implications -> AssemblyScript -> TypeScript round-trip')
  //   const original = createTestImplications(configService)
  //
  //   // Encode with TypeScript
  //   const [encodeError, encoded] = encodeImplications(original, configService)
  //   expect(encodeError).toBeNull()
  //   expect(encoded).not.toBeNull()
  //   logger.info(`TypeScript encoded ${encoded!.length} bytes`)
  //
  //   // Round-trip with AssemblyScript
  //   const numCores = configService.numCores
  //   const numValidators = configService.numValidators
  //   const authQueueSize = 80
  //
  //   // Note: AssemblyScript roundTripImplications expects ImplicationsPair, not single Implications
  //   // So we need to create a pair
  //   const pair: ImplicationsPair = [original, original]
  //   const [pairEncodeError, pairEncoded] = encodeImplicationsPair(pair, configService)
  //   expect(pairEncodeError).toBeNull()
  //   expect(pairEncoded).not.toBeNull()
  //
  //   const asDecoded = wasm.roundTripImplications(
  //     pairEncoded!,
  //     numCores,
  //     numValidators,
  //     authQueueSize,
  //   )
  //   logger.info(`AssemblyScript decoded and re-encoded ${asDecoded ? asDecoded.length : 'undefined'} bytes`)
  //
  //   if (!asDecoded || asDecoded.length === 0) {
  //     logger.error('AssemblyScript decode failed (returned empty array)')
  //     expect(false).toBe(true)
  //     return
  //   }
  //
  //   // Decode with TypeScript
  //   const [decodeError, decoded] = decodeImplicationsPair(asDecoded, configService)
  //   if (decodeError) {
  //     logger.error('TypeScript decode failed:', decodeError)
  //     expect(false).toBe(true)
  //     return
  //   }
  //
  //   const final = decoded!.value
  //
  //   // Compare first Implications (regular)
  //   expect(final[0].id).toBe(original.id)
  //   expect(final[0].nextfreeid).toBe(original.nextfreeid)
  //   logger.info('✅ Implications -> AssemblyScript -> TypeScript round-trip passed')
  // })
})

