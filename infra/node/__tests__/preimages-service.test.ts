/**
 * Preimages Service Tests
 *
 * Loads all JAM preimages test vectors (tiny/full) and validates
 * ServiceAccountService behavior against expected post_state.
 */

import { describe, it, expect } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { EventBusService, hexToBytes, type Hex } from '@pbnj/core'
import type { PreimagesTestVector } from '@pbnj/types'
import { ServiceAccountService } from '../services/service-account-service'
import { ConfigService } from '../services/config-service'
import { ClockService } from '../services/clock-service'

// Root to workspace
const WORKSPACE_ROOT = path.join(__dirname, '../../../')

function loadTestVectors(config: 'tiny' | 'full'): Array<{ name: string; vector: PreimagesTestVector }> {
  const testVectorsDir = path.join(
    WORKSPACE_ROOT,
    `submodules/jam-test-vectors/stf/preimages/${config}`,
  )

  const files = fs.readdirSync(testVectorsDir)
  const jsonFiles = files.filter((file) => file.endsWith('.json'))

  return jsonFiles.map((file) => {
    const filePath = path.join(testVectorsDir, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const vector = JSON.parse(content) as PreimagesTestVector
    return { name: file.replace('.json', ''), vector }
  })
}

// ordering/uniqueness is enforced inside the service via applyPreimages

describe('ServiceAccountService - JAM Preimages Test Vectors', () => {
  for (const configType of ['tiny', 'full'] as const) {
    describe(`Configuration: ${configType}`, () => {
      const vectors = loadTestVectors(configType)

      it('should load test vectors', () => {
        expect(vectors.length).toBeGreaterThan(0)
      })

      for (const { name, vector } of vectors) {
        describe(`Test Vector: ${name}`, () => {
          it('should process preimages according to Gray Paper rules', () => {
            // Fresh services per test to avoid state bleed between vectors
            const configService = new ConfigService(configType)
            const eventBusService = new EventBusService()
            const clockService = new ClockService({ eventBusService, configService })
            const service = new ServiceAccountService({
              configService,
              eventBusService,
              clockService,
              networkingService: null,
              preimageRequestProtocol: null,
            })
            // 1) Initialize pre-state accounts
            for (const acct of vector.pre_state.accounts) {
              const serviceId = BigInt(acct.id)

              // Minimal core fields for test setup
              const core = {
                codehash:
                  '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
                balance: 0n,
                minaccgas: 0n,
                minmemogas: 0n,
                octets: 0n,
                gratis: 0n,
                items: 0n,
                created: 0n,
                lastacc: 0n,
                parent: 0n,
              }

              const preimages = new Map<Hex, Uint8Array>()
              for (const p of acct.data.preimages) {
                preimages.set(p.hash as Hex, hexToBytes(p.blob as Hex))
              }

              const requests = new Map<Hex, Map<bigint, bigint[]>>()
              for (const entry of acct.data.lookup_meta) {
                const hash = entry.key.hash as Hex
                const len = BigInt(entry.key.length)
                const seq = entry.value.map(BigInt)
                const byLen = requests.get(hash) ?? new Map<bigint, bigint[]>()
                byLen.set(len, seq)
                requests.set(hash, byLen)
              }

              service.setServiceAccount(serviceId, {
                ...core,
                storage: new Map<Hex, Uint8Array>(),
                preimages,
                requests,
              })
            }

            // 2) Apply input via service (which enforces sorted/unique and needed checks)
            const slot = BigInt(vector.input.slot)
            const batch = vector.input.preimages.map((pi) => ({
              requester: BigInt(pi.requester),
              blob: pi.blob as Hex,
            }))
            const [applyErr] = service.applyPreimages(batch, slot)
            if (vector.output && 'err' in vector.output && vector.output.err) {
              // expect an error
              expect(applyErr?.message).toBe(vector.output.err)
            } else {
              expect(applyErr).toBeUndefined()
            }

            // 3) Validate post_state against service state
            for (const acct of vector.post_state.accounts) {
              const serviceId = BigInt(acct.id)
              const [err, actual] = service.getServiceAccount(serviceId)
              if (err) throw err

              // Compare preimages
              const expectedPre = new Map<Hex, Hex>()
              for (const p of acct.data.preimages) {
                expectedPre.set(p.hash as Hex, p.blob as Hex)
              }
              expect(actual.preimages.size).toBe(expectedPre.size)
              for (const [h, bytes] of actual.preimages.entries()) {
                const expBlob = expectedPre.get(h)
                expect(expBlob).toBeDefined()
                expect(bytes).toEqual(hexToBytes(expBlob as Hex))
              }

              // Compare requests (lookup_meta)
              const expectedReq = new Map<Hex, Map<bigint, bigint[]>>()
              for (const entry of acct.data.lookup_meta) {
                const hash = entry.key.hash as Hex
                const len = BigInt(entry.key.length)
                const seq = entry.value.map(BigInt)
                const byLen = expectedReq.get(hash) ?? new Map<bigint, bigint[]>()
                byLen.set(len, seq)
                expectedReq.set(hash, byLen)
              }

              expect(actual.requests.size).toBe(expectedReq.size)
              for (const [hash, byLen] of actual.requests.entries()) {
                const expByLen = expectedReq.get(hash)
                expect(expByLen).toBeDefined()
                expect(byLen.size).toBe(expByLen!.size)
                for (const [len, seq] of byLen.entries()) {
                  const expSeq = expByLen!.get(len)
                  expect(expSeq).toBeDefined()
                  expect(seq).toEqual(expSeq as bigint[])
                }
              }
            }
          })
        })
      }
    })
  }
})


