/**
 * Tests for entropy state serialization
 */

import { describe, expect, it } from 'vitest'
import type { Hex } from '@pbnjam/core'
import { decodeEntropy, encodeEntropy, } from '../state/entropy'
import type { EntropyState } from '@pbnjam/types'

describe('Entropy State Serialization', () => {
  it('should encode and decode entropy state', () => {
    const entropy: EntropyState = {
      accumulator: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex,
      entropy1: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as Hex,
      entropy2: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba' as Hex,
      entropy3: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321' as Hex,
    }

    const [encodeError, encoded] = encodeEntropy(entropy)
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()
    expect(encoded!.length).toBe(128) // 4 hashes × 32 bytes = 128 bytes

    const [decodeError, decoded] = decodeEntropy(encoded!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value).toEqual(entropy)
  })

  it('should encode and decode entropy with zero hashes', () => {
    const entropy: EntropyState = {
      accumulator: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
      entropy1: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
      entropy2: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
      entropy3: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
    }

    const [encodeError, encoded] = encodeEntropy(entropy)
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()
    expect(encoded!.length).toBe(128) // 4 hashes × 32 bytes = 128 bytes

    const [decodeError, decoded] = decodeEntropy(encoded!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value).toEqual(entropy)
  })

  it('should maintain deterministic ordering', () => {
    const entropy: EntropyState = {
      accumulator: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' as Hex,
      entropy1: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex,
      entropy2: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Hex,
      entropy3: '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' as Hex,
    }

    const [encodeError1, encoded1] = encodeEntropy(entropy)
    expect(encodeError1).toBeUndefined()

    const [encodeError2, encoded2] = encodeEntropy(entropy)
    expect(encodeError2).toBeUndefined()

    // Multiple encodings should produce identical results
    expect(encoded1).toEqual(encoded2)
  })

  it('should handle entropy with mixed patterns', () => {
    const entropy: EntropyState = {
      accumulator: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
      entropy1: '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
      entropy2: '0x3333333333333333333333333333333333333333333333333333333333333333' as Hex,
      entropy3: '0x4444444444444444444444444444444444444444444444444444444444444444' as Hex,
    }

    const [encodeError, encoded] = encodeEntropy(entropy)
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()
    expect(encoded!.length).toBe(128)

    const [decodeError, decoded] = decodeEntropy(encoded!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value).toEqual(entropy)
  })

  it('should fail to decode insufficient data', () => {
    const insufficientData = new Uint8Array(32) // Only 1 hash, need 4

    const [decodeError, decoded] = decodeEntropy(insufficientData)
    expect(decodeError).toBeDefined()
    expect(decoded).toBeUndefined()
  })

  it('should decode exactly 4 hashes and leave remaining data', () => {
    const tooMuchData = new Uint8Array(160) // 5 hashes, need exactly 4
    tooMuchData.fill(0x42)

    const [decodeError, decoded] = decodeEntropy(tooMuchData)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value.accumulator).toBe('0x4242424242424242424242424242424242424242424242424242424242424242')
    expect(decoded!.remaining.length).toBe(32) // 1 extra hash remaining
  })

  it('should handle entropy with realistic values', () => {
    const entropy: EntropyState = {
      accumulator: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
      entropy1: '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
      entropy2: '0x3333333333333333333333333333333333333333333333333333333333333333' as Hex,
      entropy3: '0x4444444444444444444444444444444444444444444444444444444444444444' as Hex,
    }

    const [encodeError, encoded] = encodeEntropy(entropy)
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()

    const [decodeError, decoded] = decodeEntropy(encoded!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value).toEqual(entropy)
  })
})
