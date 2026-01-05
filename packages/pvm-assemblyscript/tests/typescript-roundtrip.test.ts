/**
 * Simple test to verify TypeScript encode/decode round-trip works
 */

import { describe, it, expect } from 'bun:test'
import {
  encodeImplicationsPair,
  decodeImplicationsPair,
  type ImplicationsPair,
} from '@pbnjam/codec'
import { ConfigService } from '../../../infra/node/services/config-service'
import type { IConfigService, Implications } from '@pbnjam/types'
import { hexToBytes, type Hex } from '@pbnjam/core'
import type { ServiceAccount, DeferredTransfer, PreimageRequestStatus } from '@pbnjam/types'

// Copy createTestImplications from implications-roundtrip.test.ts
function createTestImplications(configService: IConfigService): Implications {
  const numCores = configService.numCores
  const numValidators = configService.numValidators
  const authQueueSize = configService.authQueueSize
  
  const accounts = new Map<bigint, ServiceAccount>()
  
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
    ]),
    preimages: new Map<Hex, Uint8Array>(),
    requests: new Map<Hex, Map<bigint, PreimageRequestStatus>>(),
  }
  accounts.set(1n, serviceAccount1)
  
  const stagingset: Uint8Array[] = []
  for (let i = 0; i < numValidators; i++) {
    const validatorKey = new Uint8Array(336)
    validatorKey.fill(i + 1)
    stagingset.push(validatorKey)
  }
  
  const authqueue: Uint8Array[][] = []
  for (let core = 0; core < numCores; core++) {
    const coreQueue: Uint8Array[] = []
    for (let i = 0; i < authQueueSize; i++) {
      const hash = new Uint8Array(32)
      hash.fill(core * 10 + i)
      coreQueue.push(hash)
    }
    authqueue.push(coreQueue)
  }
  
  const assigners: bigint[] = []
  for (let i = 0; i < numCores; i++) {
    assigners.push(BigInt(i % 3 + 1))
  }
  
  const xfers: DeferredTransfer[] = [
    {
      source: 1n,
      dest: 2n,
      amount: 10000n,
      memo: hexToBytes('0x54657374' as Hex),
      gasLimit: 1000n,
    },
  ]
  
  const provisions = new Map<bigint, Uint8Array>([
    [1n, hexToBytes('0x01020304' as Hex)],
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
      ]),
    },
    nextfreeid: 3n,
    xfers,
    yield: hexToBytes('0x4444444444444444444444444444444444444444444444444444444444444444' as Hex),
    provisions,
  }
}

describe('TypeScript Round-Trip Test', () => {
  it('should pass TypeScript encode -> decode round-trip', () => {
    const configService = new ConfigService('tiny')
    
    // Create test implications pair
    const regular = createTestImplications(configService)
    const exceptional = createTestImplications(configService)
    const original: ImplicationsPair = [regular, exceptional]
    
    // Encode
    const [encodeError, encoded] = encodeImplicationsPair(original, configService)
    expect(encodeError).toBeFalsy() // null or undefined means success
    expect(encoded).toBeDefined()
    expect(encoded.length).toBeGreaterThan(0)
    
    console.log(`TypeScript encoded ${encoded.length} bytes`)
    
    // Decode
    const [decodeError, decodeResult] = decodeImplicationsPair(encoded, configService)
    expect(decodeError).toBeFalsy() // null or undefined means success
    expect(decodeResult).toBeDefined()
    
    const decoded = decodeResult.value
    
    // Verify basic structure
    expect(decoded).toHaveLength(2)
    expect(decoded[0].id).toBe(original[0].id)
    expect(decoded[1].id).toBe(original[1].id)
    
    console.log('✅ TypeScript round-trip works!')
  })
})
