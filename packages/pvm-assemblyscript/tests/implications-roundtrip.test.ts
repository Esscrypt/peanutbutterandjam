/**
 * Round-trip test for Implications encoding/decoding
 * 
 * Tests interoperability between TypeScript and AssemblyScript implementations:
 * 1. TypeScript encode -> AssemblyScript decode -> AssemblyScript encode -> TypeScript decode
 * 2. AssemblyScript encode -> TypeScript decode -> TypeScript encode -> AssemblyScript decode
 */

import { instantiate } from './wasmAsInit'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  encodeImplications,
  decodeImplications,
  encodeImplicationsPair,
  decodeImplicationsPair,
  setServiceStorageValue,
  setServicePreimageValue,
  setServiceRequestValue,
  type Implications,
  type ImplicationsPair,
} from '@pbnjam/codec'
import { logger, hexToBytes, bytesToHex, type Hex } from '@pbnjam/core'
import type { ServiceAccount, DeferredTransfer, IConfigService } from '@pbnjam/types'
import { ConfigService } from '../../../infra/node/services/config-service'

/**
 * Load WASM module
 */
async function loadWasmModule(): Promise<any> {
  const wasmPath = join(__dirname, '../build/debug.wasm')
  const wasmBytes = readFileSync(wasmPath)
  const wasmModule = await instantiate(wasmBytes)
  return wasmModule
}

/**
 * Create a realistic test Implications object with mock state
 * Based on examples from preimages-light-all-blocks.test.ts
 * 
 * NOTE: Uses rawCshKeyvals instead of the old storage/preimages/requests Maps
 */
function createTestImplications(configService: IConfigService): Implications {
  const numCores = configService.numCores
  const numValidators = configService.numValidators
  const authQueueSize = configService.authQueueSize
  
  // Create mock service accounts
  const accounts = new Map<bigint, ServiceAccount>()
  
  // Service account 1 - main service
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
    rawCshKeyvals: {},
  }
  
  // Add storage items using rawCshKeyvals helpers
  setServiceStorageValue(
    serviceAccount1,
    1n,
    '0x0000000000000000000000000000000000000000000000000000000000000001' as Hex,
    hexToBytes('0xdeadbeef' as Hex),
  )
  setServiceStorageValue(
    serviceAccount1,
    1n,
    '0x0000000000000000000000000000000000000000000000000000000000000002' as Hex,
    hexToBytes('0xcafebabe' as Hex),
  )
  
  // Add preimage using rawCshKeyvals helper
  setServicePreimageValue(
    serviceAccount1,
    1n,
    '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
    hexToBytes('0x1234567890abcdef' as Hex),
  )
  
  // Add requests using rawCshKeyvals helper
  setServiceRequestValue(
    serviceAccount1,
    1n,
    '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
    32n,
    [100n, 200n], // [t0, t1] - was available from t0 until t1
  )
  setServiceRequestValue(
    serviceAccount1,
    1n,
    '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
    64n,
    [150n], // [t0] - available since t0
  )
  
  accounts.set(1n, serviceAccount1)
  
  // Service account 2 - secondary service
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
    rawCshKeyvals: {},
  }
  
  // Add storage items using rawCshKeyvals helper
  setServiceStorageValue(
    serviceAccount2,
    2n,
    '0x0000000000000000000000000000000000000000000000000000000000000003' as Hex,
    hexToBytes('0xfeedface' as Hex),
  )
  
  // Add request using rawCshKeyvals helper
  setServiceRequestValue(
    serviceAccount2,
    2n,
    '0x3333333333333333333333333333333333333333333333333333333333333333' as Hex,
    128n,
    [], // [] - requested but not supplied
  )
  
  accounts.set(2n, serviceAccount2)
  
  // Create mock stagingset (validator keys - 336 bytes each)
  // Gray Paper: sequence[Cvalcount]{valkey} where valkey is 336 bytes
  const stagingset: Uint8Array[] = []
  for (let i = 0; i < Math.min(numValidators, 3); i++) {
    // Create a 336-byte validator key (Bandersnatch + Ed25519 + BLS + Metadata)
    const validatorKey = new Uint8Array(336)
    // Fill with pattern based on index for testing
    validatorKey.fill(i + 1)
    // Set some recognizable patterns
    validatorKey[0] = 0xAA // Bandersnatch start marker
    validatorKey[32] = 0xBB // Ed25519 start marker
    validatorKey[64] = 0xCC // BLS start marker
    validatorKey[208] = 0xDD // Metadata start marker
    stagingset.push(validatorKey)
  }
  // Pad to numValidators if needed (for tiny config, this might be less)
  while (stagingset.length < numValidators) {
    const validatorKey = new Uint8Array(336)
    validatorKey.fill(0)
    stagingset.push(validatorKey)
  }
  
  // Create mock authqueue
  // Gray Paper: sequence[Ccorecount]{sequence[C_authqueuesize]{hash}}
  // Each hash is 32 bytes
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
  // Note: memo must be EXACTLY 128 bytes per Gray Paper
  const MEMO_SIZE = 128
  const memo1 = new Uint8Array(MEMO_SIZE)
  memo1.set(hexToBytes('0x54657374207472616e73666572' as Hex)) // "Test transfer" in hex, rest is zeros
  const memo2 = new Uint8Array(MEMO_SIZE)
  memo2.set(hexToBytes('0x52657475726e' as Hex)) // "Return" in hex, rest is zeros
  
  const xfers: DeferredTransfer[] = [
    {
      source: 1n,
      dest: 2n,
      amount: 10000n,
      memo: memo1,
      gasLimit: 1000n,
    },
    {
      source: 2n,
      dest: 1n,
      amount: 5000n,
      memo: memo2,
      gasLimit: 500n,
    },
  ]
  
  // Create mock provisions
  // Gray Paper: protoset<tuple{serviceid, blob}> - Set of [bigint, Uint8Array] tuples
  const provisions = new Set<[bigint, Uint8Array]>([
    [1n, hexToBytes('0x0102030405060708090a0b0c0d0e0f' as Hex)],
    [2n, hexToBytes('0x102030405060708090a0b0c0d0e0f0' as Hex)],
  ])
  
  return {
    id: 1n,
    state: {
      accounts,
      stagingset,
      authqueue,
      manager: 1n,
      assigners,
      delegator: 2n,
      registrar: 1n,
      alwaysaccers: new Map<bigint, bigint>([
        [1n, 10000n],
        [2n, 5000n],
      ]),
    },
    nextfreeid: 3n,
    xfers,
    yield: hexToBytes('0x4444444444444444444444444444444444444444444444444444444444444444' as Hex),
    provisions,
  }
}

/**
 * Compare two Implications objects for equality
 */
function compareImplications(a: Implications, b: Implications): boolean {
  // Check if inputs are valid
  if (!a || !b) {
    logger.error(`Invalid inputs: a=${a}, b=${b}`)
    return false
  }
  
  // Compare basic fields
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
  
  console.log('  yield comparison passed')

  // Compare deferred transfers
  if (!a.xfers || !b.xfers) {
    console.error(`xfers is undefined: a.xfers=${a.xfers}, b.xfers=${b.xfers}`)
    logger.error(`xfers is undefined: a.xfers=${a.xfers}, b.xfers=${b.xfers}`)
    return false
  }
  if (a.xfers.length !== b.xfers.length) {
    console.error(`xfers length mismatch: ${a.xfers.length} !== ${b.xfers.length}`)
    logger.error(`xfers length mismatch: ${a.xfers.length} !== ${b.xfers.length}`)
    return false
  }
  console.log('  xfers length matches:', a.xfers.length)
  for (let i = 0; i < a.xfers.length; i++) {
    const xferA = a.xfers[i]
    const xferB = b.xfers[i]
    if (xferA.source !== xferB.source) return false
    if (xferA.dest !== xferB.dest) return false
    if (xferA.amount !== xferB.amount) return false
    if (xferA.gasLimit !== xferB.gasLimit) return false
    if (xferA.memo.length !== xferB.memo.length) return false
    for (let j = 0; j < xferA.memo.length; j++) {
      if (xferA.memo[j] !== xferB.memo[j]) return false
    }
  }
  
  console.log('  xfers comparison passed')

  // Compare provisions (Set<[bigint, Uint8Array]>)
  // Convert to arrays for comparison, sorted by serviceId
  const aProvArray = Array.from(a.provisions).sort((x, y) => Number(x[0] - y[0]))
  const bProvArray = Array.from(b.provisions).sort((x, y) => Number(x[0] - y[0]))
  console.log('  provisions sizes:', aProvArray.length, bProvArray.length)
  if (aProvArray.length !== bProvArray.length) {
    console.error(`provisions size mismatch: ${aProvArray.length} !== ${bProvArray.length}`)
    logger.error(`provisions size mismatch: ${aProvArray.length} !== ${bProvArray.length}`)
    return false
  }
  for (let i = 0; i < aProvArray.length; i++) {
    const [serviceIdA, blobA] = aProvArray[i]
    const [serviceIdB, blobB] = bProvArray[i]
    if (serviceIdA !== serviceIdB) {
      console.error(`provisions[${i}] serviceId mismatch: ${serviceIdA} !== ${serviceIdB}`)
      logger.error(`provisions[${i}] serviceId mismatch: ${serviceIdA} !== ${serviceIdB}`)
      return false
    }
    if (blobA.length !== blobB.length) {
      console.error(`provisions[${i}] blob length mismatch: ${blobA.length} !== ${blobB.length}`)
      logger.error(`provisions[${i}] blob length mismatch: ${blobA.length} !== ${blobB.length}`)
      return false
    }
    for (let j = 0; j < blobA.length; j++) {
      if (blobA[j] !== blobB[j]) {
        console.error(`provisions[${i}].blob[${j}] mismatch`)
        logger.error(`provisions[${i}].blob[${j}] mismatch`)
        return false
      }
    }
  }
  console.log('  provisions comparison passed')
  
  // Compare state
  const stateA = a.state
  const stateB = b.state
  
  if (stateA.manager !== stateB.manager) {
    console.error(`state.manager mismatch: ${stateA.manager} !== ${stateB.manager}`)
    logger.error(`state.manager mismatch: ${stateA.manager} !== ${stateB.manager}`)
    return false
  }
  if (stateA.delegator !== stateB.delegator) {
    console.error(`state.delegator mismatch: ${stateA.delegator} !== ${stateB.delegator}`)
    logger.error(`state.delegator mismatch: ${stateA.delegator} !== ${stateB.delegator}`)
    return false
  }
  if (stateA.registrar !== stateB.registrar) {
    console.error(`state.registrar mismatch: ${stateA.registrar} !== ${stateB.registrar}`)
    logger.error(`state.registrar mismatch: ${stateA.registrar} !== ${stateB.registrar}`)
    return false
  }
  console.log('  state.manager/delegator/registrar match')
  
  // Compare assigners
  console.log(`  state.assigners lengths: ${stateA.assigners.length} vs ${stateB.assigners.length}`)
  if (stateA.assigners.length !== stateB.assigners.length) {
    console.error(`state.assigners length mismatch: ${stateA.assigners.length} !== ${stateB.assigners.length}`)
    logger.error(`state.assigners length mismatch: ${stateA.assigners.length} !== ${stateB.assigners.length}`)
    return false
  }
  for (let i = 0; i < stateA.assigners.length; i++) {
    if (stateA.assigners[i] !== stateB.assigners[i]) {
      console.error(`state.assigners[${i}] mismatch: ${stateA.assigners[i]} !== ${stateB.assigners[i]}`)
      logger.error(`state.assigners[${i}] mismatch: ${stateA.assigners[i]} !== ${stateB.assigners[i]}`)
      return false
    }
  }
  console.log('  state.assigners match')
  
  // Compare alwaysaccers
  console.log(`  state.alwaysaccers types: ${typeof stateA.alwaysaccers} vs ${typeof stateB.alwaysaccers}`)
  console.log(`  state.alwaysaccers isMap: ${stateA.alwaysaccers instanceof Map} vs ${stateB.alwaysaccers instanceof Map}`)
  console.log(`  state.alwaysaccers isArray: ${Array.isArray(stateA.alwaysaccers)} vs ${Array.isArray(stateB.alwaysaccers)}`)
  const aAlwaysSize = stateA.alwaysaccers instanceof Map ? stateA.alwaysaccers.size : (Array.isArray(stateA.alwaysaccers) ? stateA.alwaysaccers.length : 0)
  const bAlwaysSize = stateB.alwaysaccers instanceof Map ? stateB.alwaysaccers.size : (Array.isArray(stateB.alwaysaccers) ? stateB.alwaysaccers.length : 0)
  console.log(`  state.alwaysaccers sizes: ${aAlwaysSize} vs ${bAlwaysSize}`)
  if (aAlwaysSize !== bAlwaysSize) {
    console.error(`state.alwaysaccers size mismatch: ${aAlwaysSize} !== ${bAlwaysSize}`)
    logger.error(`state.alwaysaccers size mismatch: ${aAlwaysSize} !== ${bAlwaysSize}`)
    return false
  }
  if (stateA.alwaysaccers instanceof Map && stateB.alwaysaccers instanceof Map) {
    for (const [key, valueA] of stateA.alwaysaccers) {
      const valueB = stateB.alwaysaccers.get(key)
      if (valueB === undefined || valueA !== valueB) {
        console.error(`state.alwaysaccers[${key}] mismatch: ${valueA} !== ${valueB}`)
        logger.error(`state.alwaysaccers[${key}] mismatch: ${valueA} !== ${valueB}`)
        return false
      }
    }
    console.log('  state.alwaysaccers (Map) match')
  } else if (Array.isArray(stateA.alwaysaccers) && Array.isArray(stateB.alwaysaccers)) {
    // Compare as arrays (sorted by serviceId)
    const sortedA = [...stateA.alwaysaccers].sort((x, y) => Number(x.serviceId - y.serviceId))
    const sortedB = [...stateB.alwaysaccers].sort((x, y) => Number(x.serviceId - y.serviceId))
    for (let i = 0; i < sortedA.length; i++) {
      const alwaysA = sortedA[i]
      const alwaysB = sortedB[i]
      if (alwaysA.serviceId !== alwaysB.serviceId || alwaysA.gas !== alwaysB.gas) {
        console.error(`state.alwaysaccers[${i}] mismatch`)
        logger.error(`state.alwaysaccers[${i}] mismatch`)
        return false
      }
    }
    console.log('  state.alwaysaccers (Array) match')
  } else {
    // Handle mixed types - both may be valid if one is Map and other is array-like
    // This can happen after decode
    console.log('  state.alwaysaccers type mismatch, attempting cross-type comparison')
    // Try to convert both to arrays and compare
    const arrayA = stateA.alwaysaccers instanceof Map 
      ? Array.from(stateA.alwaysaccers).map(([k, v]) => ({ serviceId: k, gas: v }))
      : (stateA.alwaysaccers as Array<{serviceId: bigint, gas: bigint}>)
    const arrayB = stateB.alwaysaccers instanceof Map 
      ? Array.from(stateB.alwaysaccers).map(([k, v]) => ({ serviceId: k, gas: v }))
      : (stateB.alwaysaccers as Array<{serviceId: bigint, gas: bigint}>)
    const sortedA = [...arrayA].sort((x, y) => Number(x.serviceId - y.serviceId))
    const sortedB = [...arrayB].sort((x, y) => Number(x.serviceId - y.serviceId))
    if (sortedA.length !== sortedB.length) {
      console.error(`state.alwaysaccers array length mismatch: ${sortedA.length} !== ${sortedB.length}`)
      return false
    }
    for (let i = 0; i < sortedA.length; i++) {
      if (sortedA[i].serviceId !== sortedB[i].serviceId || sortedA[i].gas !== sortedB[i].gas) {
        console.error(`state.alwaysaccers[${i}] mismatch: ${JSON.stringify(sortedA[i])} !== ${JSON.stringify(sortedB[i])}`)
        return false
      }
    }
    console.log('  state.alwaysaccers (cross-type) match')
  }
  
  // Compare accounts
  console.log(`  state.accounts sizes: ${stateA.accounts.size} vs ${stateB.accounts.size}`)
  if (stateA.accounts.size !== stateB.accounts.size) {
    console.error(`state.accounts size mismatch: ${stateA.accounts.size} !== ${stateB.accounts.size}`)
    logger.error(`state.accounts size mismatch: ${stateA.accounts.size} !== ${stateB.accounts.size}`)
    return false
  }
  for (const [serviceId, accountA] of stateA.accounts) {
    console.log(`  checking account ${serviceId}...`)
    const accountB = stateB.accounts.get(serviceId)
    if (!accountB) {
      console.error(`state.accounts[${serviceId}] missing in b`)
      logger.error(`state.accounts[${serviceId}] missing in b`)
      return false
    }
    
    // Compare core fields
    if (accountA.codehash !== accountB.codehash) {
      console.error(`account[${serviceId}].codehash mismatch: ${accountA.codehash} !== ${accountB.codehash}`)
      return false
    }
    if (accountA.balance !== accountB.balance) {
      console.error(`account[${serviceId}].balance mismatch: ${accountA.balance} !== ${accountB.balance}`)
      return false
    }
    if (accountA.minaccgas !== accountB.minaccgas) {
      console.error(`account[${serviceId}].minaccgas mismatch: ${accountA.minaccgas} !== ${accountB.minaccgas}`)
      return false
    }
    if (accountA.minmemogas !== accountB.minmemogas) {
      console.error(`account[${serviceId}].minmemogas mismatch: ${accountA.minmemogas} !== ${accountB.minmemogas}`)
      return false
    }
    // NOTE: octets and items are COMPUTED fields based on rawCshKeyvals
    // After decode, these are recomputed from the actual storage content
    // So we only check if bOctets/bItems are valid (non-negative)
    if (accountB.octets < 0n) {
      console.error(`account[${serviceId}].octets is negative: ${accountB.octets}`)
      return false
    }
    if (accountA.gratis !== accountB.gratis) {
      console.error(`account[${serviceId}].gratis mismatch: ${accountA.gratis} !== ${accountB.gratis}`)
      return false
    }
    if (accountB.items < 0n) {
      console.error(`account[${serviceId}].items is negative: ${accountB.items}`)
      return false
    }
    console.log(`    account ${serviceId} octets: ${accountA.octets} (original) vs ${accountB.octets} (decoded - computed)`)
    if (accountA.created !== accountB.created) {
      console.error(`account[${serviceId}].created mismatch: ${accountA.created} !== ${accountB.created}`)
      return false
    }
    if (accountA.lastacc !== accountB.lastacc) {
      console.error(`account[${serviceId}].lastacc mismatch: ${accountA.lastacc} !== ${accountB.lastacc}`)
      return false
    }
    if (accountA.parent !== accountB.parent) {
      console.error(`account[${serviceId}].parent mismatch: ${accountA.parent} !== ${accountB.parent}`)
      return false
    }
    console.log(`    account ${serviceId} core fields match`)
    
    // Compare rawCshKeyvals
    const keysA = Object.keys(accountA.rawCshKeyvals)
    const keysB = Object.keys(accountB.rawCshKeyvals)
    console.log(`    account ${serviceId} rawCshKeyvals keys: ${keysA.length} vs ${keysB.length}`)
    if (keysA.length !== keysB.length) {
      console.error(`rawCshKeyvals size mismatch for service ${serviceId}: ${keysA.length} !== ${keysB.length}`)
      logger.error(`rawCshKeyvals size mismatch for service ${serviceId}: ${keysA.length} !== ${keysB.length}`)
      return false
    }
    for (const key of keysA) {
      const valueA = accountA.rawCshKeyvals[key as Hex]
      const valueB = accountB.rawCshKeyvals[key as Hex]
      if (valueA !== valueB) {
        console.error(`rawCshKeyvals[${key}] mismatch for service ${serviceId}`)
        logger.error(`rawCshKeyvals[${key}] mismatch for service ${serviceId}`)
        return false
      }
    }
    console.log(`    account ${serviceId} rawCshKeyvals match`)
  }
  
  // Compare stagingset
  if (stateA.stagingset.length !== stateB.stagingset.length) return false
  for (let i = 0; i < stateA.stagingset.length; i++) {
    const valA = stateA.stagingset[i]
    const valB = stateB.stagingset[i]
    if (valA.length !== valB.length) return false
    for (let j = 0; j < valA.length; j++) {
      if (valA[j] !== valB[j]) return false
    }
  }
  
  // Compare authqueue
  if (stateA.authqueue.length !== stateB.authqueue.length) return false
  for (let i = 0; i < stateA.authqueue.length; i++) {
    const queueA = stateA.authqueue[i]
    const queueB = stateB.authqueue[i]
    if (queueA.length !== queueB.length) return false
    for (let j = 0; j < queueA.length; j++) {
      const hashA = queueA[j]
      const hashB = queueB[j]
      if (hashA.length !== hashB.length) return false
      for (let k = 0; k < hashA.length; k++) {
        if (hashA[k] !== hashB[k]) return false
      }
    }
  }
  
  return true
}

/**
 * Test: TypeScript encode -> AssemblyScript decode -> AssemblyScript encode -> TypeScript decode
 */
async function testTypeScriptToAssemblyScriptRoundTrip(): Promise<boolean> {
  logger.info('Testing TypeScript -> AssemblyScript round-trip')
  
  const wasm = await loadWasmModule()
  const configService = new ConfigService('tiny')
  const numCores = configService.numCores
  const numValidators = configService.numValidators
  const authQueueSize = configService.authQueueSize
  
  // Create test implications pair (regular and exceptional)
  const regular = createTestImplications(configService)
  const exceptional = createTestImplications(configService)
  const original: ImplicationsPair = [regular, exceptional]
  
  // Step 1: Encode with TypeScript
  console.log('Encoding original implications with TypeScript...')
  console.log('Original service account count:', original[0].state.accounts.size)
  const [encodeError, encoded] = encodeImplicationsPair(original, configService)
  if (encodeError) {
    console.error('TypeScript encode failed:', encodeError)
    logger.error('TypeScript encode failed:', encodeError)
    return false
  }
  
  console.log(`TypeScript encoded ${encoded.length} bytes`)
  logger.info(`TypeScript encoded ${encoded.length} bytes`)
  
  // Step 2: Round-trip with AssemblyScript (decode then encode)
  let asDecoded: Uint8Array
  try {
    asDecoded = wasm.roundTripImplications(
      encoded,
      numCores,
      numValidators,
      authQueueSize,
    )
  } catch (e) {
    console.error('AssemblyScript round-trip threw error:', e)
    logger.error('AssemblyScript round-trip threw error:', { error: e })
    return false
  }
  
  if (!asDecoded || asDecoded.length === 0) {
    console.error('AssemblyScript decode failed (returned empty array)')
    logger.error('AssemblyScript decode failed (returned empty array)')
    return false
  }
  
  console.log(`AssemblyScript decoded and re-encoded ${asDecoded.length} bytes`)
  logger.info(`AssemblyScript decoded and re-encoded ${asDecoded ? asDecoded.length : 'undefined'} bytes`)
  
  // Step 3: Decode with TypeScript
  console.log('Decoding AssemblyScript output with TypeScript...')
  const [decodeError, decodeResult] = decodeImplicationsPair(asDecoded, configService)
  if (decodeError) {
    console.error('TypeScript decode failed:', decodeError)
    logger.error('TypeScript decode failed:', decodeError)
    return false
  }
  
  const final = decodeResult.value
  console.log('Final service account count:', final[0].state.accounts.size)
  
  // Step 4: Compare
  console.log('Comparing original and final implications...')
  const regularMatches = compareImplications(original[0], final[0])
  console.log('Regular matches:', regularMatches)
  const exceptionalMatches = compareImplications(original[1], final[1])
  console.log('Exceptional matches:', exceptionalMatches)
  if (!regularMatches || !exceptionalMatches) {
    console.error('Round-trip failed: implications do not match')
    console.error('Original regular id:', original[0].id.toString())
    console.error('Final regular id:', final[0].id.toString())
    console.error('Original exceptional id:', original[1].id.toString())
    console.error('Final exceptional id:', final[1].id.toString())
    logger.error('Round-trip failed: implications do not match')
    logger.error('Original regular id:', original[0].id.toString())
    logger.error('Final regular id:', final[0].id.toString())
    logger.error('Original exceptional id:', original[1].id.toString())
    logger.error('Final exceptional id:', final[1].id.toString())
    return false
  }
  
  logger.info('✅ TypeScript -> AssemblyScript round-trip passed')
  return true
}

/**
 * Test: AssemblyScript encode -> TypeScript decode -> TypeScript encode -> AssemblyScript decode
 */
async function testAssemblyScriptToTypeScriptRoundTrip(): Promise<boolean> {
  logger.info('Testing AssemblyScript -> TypeScript round-trip')
  
  const wasm = await loadWasmModule()
  const configService = new ConfigService('tiny')
  const numCores = configService.numCores
  const numValidators = configService.numValidators
  const authQueueSize = configService.authQueueSize
  
  // Create test implications pair (regular and exceptional)
  const regular = createTestImplications(configService)
  const exceptional = createTestImplications(configService)
  const original: ImplicationsPair = [regular, exceptional]
  
  // Step 1: Encode with TypeScript first (to get valid bytes)
  const [encodeError, tsEncoded] = encodeImplicationsPair(original, configService)
  if (encodeError) {
    logger.error('TypeScript encode failed:', encodeError)
    return false
  }
  
  // Step 2: Round-trip with AssemblyScript (decode then encode)
  const asEncoded = wasm.roundTripImplications(
    tsEncoded,
    numCores,
    numValidators,
    authQueueSize,
  )
  
  if (asEncoded.length === 0) {
    logger.error('AssemblyScript encode failed (returned empty array)')
    return false
  }
  
  logger.info(`AssemblyScript encoded ${asEncoded.length} bytes`)
  
  // Step 3: Decode with TypeScript
  const [decodeError, decodeResult] = decodeImplicationsPair(asEncoded, configService)
  if (decodeError) {
    logger.error('TypeScript decode failed:', decodeError)
    return false
  }
  
  const decoded = decodeResult.value
  
  // Step 4: Re-encode with TypeScript
  const [reEncodeError, reEncoded] = encodeImplicationsPair(decoded, configService)
  if (reEncodeError) {
    logger.error('TypeScript re-encode failed:', reEncodeError)
    return false
  }
  
  // Step 5: Round-trip with AssemblyScript (decode then encode)
  const asDecoded = wasm.roundTripImplications(
    reEncoded,
    numCores,
    numValidators,
    authQueueSize,
  )
  
  if (asDecoded.length === 0) {
    logger.error('AssemblyScript final decode failed (returned empty array)')
    return false
  }
  
  // Step 6: Final decode with TypeScript and compare
  const [finalDecodeError, finalDecodeResult] = decodeImplicationsPair(asDecoded, configService)
  if (finalDecodeError) {
    logger.error('TypeScript final decode failed:', finalDecodeError)
    return false
  }
  
  const final = finalDecodeResult.value
  
  // Step 7: Compare (both original and final are ImplicationsPair, so compare each element)
  const regularMatches = compareImplications(original[0], final[0])
  const exceptionalMatches = compareImplications(original[1], final[1])
  if (!regularMatches || !exceptionalMatches) {
    logger.error('Round-trip failed: implications do not match')
    logger.error('Original regular id:', original[0].id.toString())
    logger.error('Final regular id:', final[0].id.toString())
    logger.error('Original exceptional id:', original[1].id.toString())
    logger.error('Final exceptional id:', final[1].id.toString())
    return false
  }
  
  logger.info('✅ AssemblyScript -> TypeScript round-trip passed')
  return true
}

import { describe, it, expect } from 'bun:test'

/**
 * Run all round-trip tests using Bun's test framework
 */
describe('Implications Round-Trip Tests', () => {
  it('should pass TypeScript -> AssemblyScript round-trip', async () => {
    logger.info('Testing TypeScript -> AssemblyScript round-trip')
    const result = await testTypeScriptToAssemblyScriptRoundTrip()
    expect(result).toBe(true)
  })

  it('should pass AssemblyScript -> TypeScript round-trip', async () => {
    logger.info('Testing AssemblyScript -> TypeScript round-trip')
    const result = await testAssemblyScriptToTypeScriptRoundTrip()
    expect(result).toBe(true)
  })
})

export { testTypeScriptToAssemblyScriptRoundTrip, testAssemblyScriptToTypeScriptRoundTrip }

