/**
 * Preimages Service Tests
 *
 * Loads all JAM preimages test vectors (tiny/full) and validates
 * ServiceAccountService behavior against expected post_state.
 */

import { describe, it, expect } from 'bun:test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { EventBusService, hexToBytes, type Hex } from '@pbnjam/core'
import type { PreimagesTestVector } from '@pbnjam/types'
import { ServiceAccountService } from '../services/service-account-service'
import { ConfigService } from '../services/config-service'
import { ClockService } from '../services/clock-service'
import {
  setServicePreimageValue,
  setServiceRequestValue,
  getAllServicePreimages,
  getServiceRequestValue,
} from '@pbnjam/codec'

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
              eventBusService,
              clockService,
              networkingService: null,
              preimageRequestProtocol: null,
            })
            // 1) Initialize pre-state accounts
            for (const acct of vector.pre_state.accounts) {
              const serviceId = BigInt(acct.id)

              // Minimal core fields for test setup
              const serviceAccount = {
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
                rawCshKeyvals: {},
              }

              // Set preimages using setServicePreimageValue
              for (const p of acct.data.preimage_blobs) {
                const preimageHash = p.hash as Hex
                const preimageValue = hexToBytes(p.blob as Hex)
                setServicePreimageValue(serviceAccount, serviceId, preimageHash, preimageValue)
              }

              // Set requests using setServiceRequestValue
              for (const entry of acct.data.preimage_requests) {
                const hash = entry.key.hash as Hex
                const len = BigInt(entry.key.length)
                const seq = entry.value.map(BigInt)
                setServiceRequestValue(serviceAccount, serviceId, hash, len, seq)
              }

              service.setServiceAccount(serviceId, serviceAccount)
            }

            // 2) Validate preimages first, then apply
            const slot = BigInt(vector.input.slot)
            const batch = vector.input.preimages.map((pi) => ({
              requester: BigInt(pi.requester),
              blob: pi.blob as Hex,
            }))
            
            // PRE-VALIDATE preimages BEFORE applying them
            // This checks for errors that should cause the entire batch to be skipped
            const [validateError, validatedPreimages] = service.validatePreimages(batch)
            if (validateError) {
              // Check if this validation error is expected in the test vector
              if (vector.output && 'err' in vector.output && vector.output.err) {
                // Expected error case - verify error message matches
                expect(validateError.message).toBe(vector.output.err)
                // When validation fails, skip applyPreimages and post_state validation
                return
              } else {
                // Unexpected validation error - throw it
                throw validateError
              }
            }
            
            if (!validatedPreimages) {
              throw new Error('validatePreimages returned null')
            }
            
            // Apply validated preimages
            const [applyErr] = service.applyPreimages(validatedPreimages, slot)
            if (vector.output && 'err' in vector.output && vector.output.err) {
              // expect an error from apply (shouldn't happen if validation passed)
              expect(applyErr?.message).toBe(vector.output.err)
            } else {
              expect(applyErr).toBeUndefined()
            }

            // 3) Validate post_state against service state
            for (const acct of vector.post_state.accounts) {
              const serviceId = BigInt(acct.id)
              const [err, actual] = service.getServiceAccount(serviceId)
              if (err) throw err

              // Compare preimages using getAllServicePreimages
              const expectedPre = new Map<Hex, Hex>()
              for (const p of acct.data.preimage_blobs) {
                expectedPre.set(p.hash as Hex, p.blob as Hex)
              }
              
              const actualPreimages = getAllServicePreimages(actual)
              // Build a map of hash to blob for comparison
              const actualPreMap = new Map<Hex, Uint8Array>()
              for (const [, preimageData] of actualPreimages) {
                actualPreMap.set(preimageData.preimageHash, preimageData.blob)
              }
              
              expect(actualPreMap.size).toBe(expectedPre.size)
              for (const [h, expBlobHex] of expectedPre.entries()) {
                const actualBlob = actualPreMap.get(h)
                expect(actualBlob).toBeDefined()
                expect(actualBlob).toEqual(hexToBytes(expBlobHex))
              }

              // Compare requests (preimage_requests) using getServiceRequestValue
              const expectedReq = new Map<Hex, Map<bigint, bigint[]>>()
              for (const entry of acct.data.preimage_requests) {
                const hash = entry.key.hash as Hex
                const len = BigInt(entry.key.length)
                const seq = entry.value.map(BigInt)
                const byLen = expectedReq.get(hash) ?? new Map<bigint, bigint[]>()
                byLen.set(len, seq)
                expectedReq.set(hash, byLen)
              }

              // Build actual requests map by querying each expected request
              const actualReq = new Map<Hex, Map<bigint, bigint[]>>()
              for (const [hash, expectedByLen] of expectedReq.entries()) {
                const actualByLen = new Map<bigint, bigint[]>()
                for (const [len, expectedSeq] of expectedByLen.entries()) {
                  const actualSeq = getServiceRequestValue(actual, serviceId, hash, len)
                  if (actualSeq) {
                    actualByLen.set(len, actualSeq)
                  }
                }
                if (actualByLen.size > 0) {
                  actualReq.set(hash, actualByLen)
                }
              }

              expect(actualReq.size).toBe(expectedReq.size)
              for (const [hash, expectedByLen] of expectedReq.entries()) {
                const actualByLen = actualReq.get(hash)
                expect(actualByLen).toBeDefined()
                expect(actualByLen!.size).toBe(expectedByLen.size)
                for (const [len, expectedSeq] of expectedByLen.entries()) {
                  const actualSeq = actualByLen!.get(len)
                  expect(actualSeq).toBeDefined()
                  expect(actualSeq).toEqual(expectedSeq)
                }
              }
            }
          })
        })
      }
    })
  }
})


