import { describe, expect, it } from 'bun:test'
import { encodeValidatorSet, decodeValidatorSet } from '../state/validator-set'
import type { ValidatorPublicKeys } from '@pbnjam/types'
import { ConfigService } from '../../../../infra/node/services/config-service'

// Mock config service for testing
const mockConfigService = new ConfigService('tiny')

/** Zero-filled validator used to pad staging set to numValidators. */
const ZERO_VALIDATOR: ValidatorPublicKeys = {
  bandersnatch: '0x' + '0'.repeat(64) as `0x${string}`,
  ed25519: '0x' + '0'.repeat(64) as `0x${string}`,
  bls: '0x' + '0'.repeat(288) as `0x${string}`,
  metadata: '0x' + '0'.repeat(256) as `0x${string}`,
}

function padStagingSet(set: ValidatorPublicKeys[]): ValidatorPublicKeys[] {
  const padded = [...set]
  while (padded.length < mockConfigService.numValidators) {
    padded.push(ZERO_VALIDATOR)
  }
  return padded
}

describe('Staging Set Serialization', () => {
  const mockValidator: ValidatorPublicKeys = {
    bandersnatch: '0x' + 'a'.repeat(64) as `0x${string}`, // 32 bytes
    ed25519: '0x' + 'b'.repeat(64) as `0x${string}`, // 32 bytes
    bls: '0x' + 'c'.repeat(288) as `0x${string}`, // 144 bytes
    metadata: '0x' + 'd'.repeat(256) as `0x${string}`, // 128 bytes
  }

  const mockValidator2: ValidatorPublicKeys = {
    bandersnatch: '0x' + '1'.repeat(64) as `0x${string}`, // 32 bytes
    ed25519: '0x' + '2'.repeat(64) as `0x${string}`, // 32 bytes
    bls: '0x' + '3'.repeat(288) as `0x${string}`, // 144 bytes
    metadata: '0x' + '4'.repeat(256) as `0x${string}`, // 128 bytes
  }

  it('should encode and decode empty staging set', () => {
    const stagingSet = padStagingSet([])

    const [encodeError, encodedData] = encodeValidatorSet(stagingSet, mockConfigService)
    expect(encodeError).toBeUndefined()
    expect(encodedData).toBeDefined()

    const [decodeError, decoded] = decodeValidatorSet(encodedData!, mockConfigService)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    const expectedCount = mockConfigService.numValidators
    expect(decoded!.value).toHaveLength(expectedCount) // Padded to Cvalcount
    expect(decoded!.consumed).toBe(expectedCount * 336) // 336 bytes per validator
  })

  it('should encode and decode single validator', () => {
    const stagingSet = padStagingSet([mockValidator])

    const [encodeError, encodedData] = encodeValidatorSet(stagingSet, mockConfigService)
    expect(encodeError).toBeUndefined()
    expect(encodedData).toBeDefined()

    const [decodeError, decoded] = decodeValidatorSet(encodedData!, mockConfigService)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    const expectedCount = mockConfigService.numValidators
    expect(decoded!.value).toHaveLength(expectedCount)
    expect(decoded!.value[0]).toEqual(mockValidator)
    expect(decoded!.consumed).toBe(expectedCount * 336)
  })

  it('should encode and decode multiple validators', () => {
    const stagingSet = padStagingSet([mockValidator, mockValidator2])

    const [encodeError, encodedData] = encodeValidatorSet(stagingSet, mockConfigService)
    expect(encodeError).toBeUndefined()
    expect(encodedData).toBeDefined()

    const [decodeError, decoded] = decodeValidatorSet(encodedData!, mockConfigService)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    const expectedCount = mockConfigService.numValidators
    expect(decoded!.value).toHaveLength(expectedCount)
    expect(decoded!.value[0]).toEqual(mockValidator)
    expect(decoded!.value[1]).toEqual(mockValidator2)
    expect(decoded!.consumed).toBe(expectedCount * 336)
  })

  it('should handle round-trip with realistic validator data', () => {
    const realisticValidator: ValidatorPublicKeys = {
      bandersnatch: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      ed25519: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
      bls: '0x' + '0123456789abcdef'.repeat(18) as `0x${string}`, // 144 bytes
      metadata: '0x' + 'deadbeefcafebabe'.repeat(16) as `0x${string}`, // 128 bytes
    }

    const stagingSet = padStagingSet([realisticValidator])

    const [encodeError, encodedData] = encodeValidatorSet(stagingSet, mockConfigService)
    expect(encodeError).toBeUndefined()
    expect(encodedData).toBeDefined()

    const [decodeError, decoded] = decodeValidatorSet(encodedData!, mockConfigService)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value).toHaveLength(mockConfigService.numValidators)
    expect(decoded!.value[0]).toEqual(realisticValidator)
  })

  it('should fail with insufficient data', () => {
    const insufficientData = new Uint8Array([1]) // Length prefix only, no validator data

    const [decodeError, decoded] = decodeValidatorSet(insufficientData, mockConfigService)
    expect(decodeError).toBeDefined()
    expect(decoded).toBeUndefined()
  })

  it('should fail with incomplete length prefix', () => {
    const incompleteData = new Uint8Array([128]) // Incomplete length prefix

    const [decodeError, decoded] = decodeValidatorSet(incompleteData, mockConfigService)
    expect(decodeError).toBeDefined()
    expect(decoded).toBeUndefined()
  })

  it('should fail with wrong validator key size', () => {
    const wrongSizeValidator: ValidatorPublicKeys = {
      bandersnatch: '0x' + 'a'.repeat(62) as `0x${string}`, // 31 bytes (should be 32)
      ed25519: '0x' + 'b'.repeat(64) as `0x${string}`, // 32 bytes
      bls: '0x' + 'c'.repeat(288) as `0x${string}`, // 144 bytes
      metadata: '0x' + 'd'.repeat(256) as `0x${string}`, // 128 bytes
    }

    const [encodeError, encodedData] = encodeValidatorSet(
      padStagingSet([wrongSizeValidator]),
      mockConfigService,
    )
    expect(encodeError).toBeDefined()
    expect(encodedData).toBeUndefined()
  })

  it('should preserve remaining data after decoding', () => {
    const stagingSet = padStagingSet([mockValidator])
    const [encodeError, encodedData] = encodeValidatorSet(stagingSet, mockConfigService)
    expect(encodeError).toBeUndefined()

    // Add extra data after the encoded staging set
    const extraData = new Uint8Array([0x42, 0x43, 0x44])
    const combinedData = new Uint8Array(encodedData!.length + extraData.length)
    combinedData.set(encodedData!)
    combinedData.set(extraData, encodedData!.length)

    const [decodeError, decoded] = decodeValidatorSet(combinedData, mockConfigService)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value).toHaveLength(mockConfigService.numValidators)
    expect(decoded!.value[0]).toEqual(mockValidator)
    expect(decoded!.remaining).toEqual(extraData)
  })
})
