/**
 * Fallback seal signature verification tests
 *
 * Gray Paper safrole.tex eq. 154: H_sealsig ∈ bssignature{H_authorbskey}{Xfallback ∥ entropy'_3}{encodeunsignedheader{H}}
 * Verifier must use same input/auxData order as prover: input = encodeunsignedheader{H}, auxData = Xfallback ∥ entropy'_3
 */

import { describe, expect, test } from 'bun:test'
import { generateBandersnatchKeyPairFromSeed } from '@pbnjam/core'
import {
  generateFallbackSealSignature,
  verifyFallbackSealSignature,
} from '../fallback-sealing'
import type { IConfigService, UnsignedBlockHeader } from '@pbnjam/types'

function createMockConfig(): IConfigService {
  return {
    numValidators: 6,
    numCores: 4,
    epochDuration: 100,
    validatorCount: 6,
  } as unknown as IConfigService
}

function createSampleUnsignedHeader(timeslot: bigint = 76n): UnsignedBlockHeader {
  return {
    parent:
      '0xc95ae38b6b174a0082b8760f77707bed0ef99d6c0f6e7844f213db57c11a9086' as `0x${string}`,
    priorStateRoot:
      '0xd1ba0a0cf357fb0557114a47020f663c7ca96353047cb4fbb78cef8dfebc6303' as `0x${string}`,
    extrinsicHash:
      '0x876e6e17a6ca30c1244e4a62a5a67395b86511d964b6664b7d5b63adb239ebb64' as `0x${string}`,
    timeslot,
    epochMark: null,
    winnersMark: null,
    offendersMark: [],
    authorIndex: 3n,
    vrfSig:
      '0x0746846d17469fb2f95ef365efcab9f4e22fa1feb53111c995376be8019981ccf30aa5444688b3cab47697b37d5cac5707bb3289e986b19b17db437206931a8d151e5c8fe2b9d8a606966a79edd2f9e5db47e83947ce368ccba53bf6ba20a40b8b8c5d436f92ecf605421e873a99ec528761eb52a88a2f9a057b3b3003e6f32a' as `0x${string}`,
  }
}

describe('Fallback seal signature verification', () => {
  const configService = createMockConfig()
  const [keyPairErr, keyPair] = generateBandersnatchKeyPairFromSeed(
    new Uint8Array(32).fill(1),
  )
  if (keyPairErr || !keyPair) throw new Error('Key pair generation failed')
  const entropy3 = new Uint8Array(32).fill(0x42)
  const unsignedHeader = createSampleUnsignedHeader()

  test('round-trip: generate then verify with same inputs passes', () => {
    const [genErr, genResult] = generateFallbackSealSignature(
      keyPair.privateKey,
      entropy3,
      unsignedHeader,
      configService,
    )
    expect(genErr).toBeUndefined()
    expect(genResult).toBeDefined()
    expect(genResult!.signature).toHaveLength(96)

    const [verifyErr, isValid] = verifyFallbackSealSignature(
      keyPair.publicKey,
      genResult!.signature,
      entropy3,
      unsignedHeader,
      configService,
    )
    expect(verifyErr).toBeUndefined()
    expect(isValid).toBe(true)
  })

  test('verify with wrong entropy_3 fails', () => {
    const [genErr, genResult] = generateFallbackSealSignature(
      keyPair.privateKey,
      entropy3,
      unsignedHeader,
      configService,
    )
    expect(genErr).toBeUndefined()
    expect(genResult).toBeDefined()

    const wrongEntropy3 = new Uint8Array(32).fill(0x99)
    const [verifyErr, isValid] = verifyFallbackSealSignature(
      keyPair.publicKey,
      genResult!.signature,
      wrongEntropy3,
      unsignedHeader,
      configService,
    )
    expect(verifyErr).toBeUndefined()
    expect(isValid).toBe(false)
  })

  test('verify with wrong unsigned header (different timeslot) fails', () => {
    const [genErr, genResult] = generateFallbackSealSignature(
      keyPair.privateKey,
      entropy3,
      unsignedHeader,
      configService,
    )
    expect(genErr).toBeUndefined()
    expect(genResult).toBeDefined()

    const otherHeader = createSampleUnsignedHeader(77n)
    const [verifyErr, isValid] = verifyFallbackSealSignature(
      keyPair.publicKey,
      genResult!.signature,
      entropy3,
      otherHeader,
      configService,
    )
    expect(verifyErr).toBeUndefined()
    expect(isValid).toBe(false)
  })

  test('verify with wrong public key fails', () => {
    const [genErr, genResult] = generateFallbackSealSignature(
      keyPair.privateKey,
      entropy3,
      unsignedHeader,
      configService,
    )
    expect(genErr).toBeUndefined()
    expect(genResult).toBeDefined()

    const [otherKeyErr, otherKeyPair] = generateBandersnatchKeyPairFromSeed(
      new Uint8Array(32).fill(2),
    )
    expect(otherKeyErr).toBeUndefined()
    expect(otherKeyPair).toBeDefined()
    const [verifyErr, isValid] = verifyFallbackSealSignature(
      otherKeyPair!.publicKey,
      genResult!.signature,
      entropy3,
      unsignedHeader,
      configService,
    )
    expect(verifyErr).toBeUndefined()
    expect(isValid).toBe(false)
  })

  test('permutation: swapped entropy vs context - wrong entropy fails verification', () => {
    const entropyA = new Uint8Array(32).fill(0x11)
    const entropyB = new Uint8Array(32).fill(0x22)
    const [genErr, genResult] = generateFallbackSealSignature(
      keyPair.privateKey,
      entropyA,
      unsignedHeader,
      configService,
    )
    expect(genErr).toBeUndefined()
    expect(genResult).toBeDefined()
    const [verifyErr, isValid] = verifyFallbackSealSignature(
      keyPair.publicKey,
      genResult!.signature,
      entropyB,
      unsignedHeader,
      configService,
    )
    expect(verifyErr).toBeUndefined()
    expect(isValid).toBe(false)
  })

  test('permutation: same entropy and header twice produces same signature', () => {
    const [gen1Err, gen1] = generateFallbackSealSignature(
      keyPair.privateKey,
      entropy3,
      unsignedHeader,
      configService,
    )
    const [gen2Err, gen2] = generateFallbackSealSignature(
      keyPair.privateKey,
      entropy3,
      unsignedHeader,
      configService,
    )
    expect(gen1Err).toBeUndefined()
    expect(gen2Err).toBeUndefined()
    expect(gen1!.signature).toEqual(gen2!.signature)
  })
})
