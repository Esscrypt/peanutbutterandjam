import { describe, expect, it } from 'vitest'
import { encodeServiceAccount, decodeServiceAccount } from '../state/service-account'
import type { ServiceAccountCore } from '@pbnjam/types'

describe('Service Account Serialization', () => {
  const mockServiceAccount: ServiceAccountCore = {
    codehash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    balance: 1000000n,
    minaccgas: 1000n,
    minmemogas: 500n,
    octets: 1024n,
    gratis: 100n,
    items: 5n,
    created: 1000n,
    lastacc: 2000n,
    parent: 0n,
  }

  const mockServiceAccountEmpty: ServiceAccountCore = {
    codehash: '0x0000000000000000000000000000000000000000000000000000000000000000',
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

  it('should encode and decode service account with all fields', () => {
    const [encodeError, encodedData] = encodeServiceAccount(mockServiceAccount)
    expect(encodeError).toBeUndefined()
    expect(encodedData).toBeDefined()

    const [decodeError, decoded] = decodeServiceAccount(encodedData!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value.codehash).toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
    expect(decoded!.value.balance).toBe(1000000n)
    expect(decoded!.value.minaccgas).toBe(1000n)
    expect(decoded!.value.minmemogas).toBe(500n)
    expect(decoded!.value.octets).toBe(1024n)
    expect(decoded!.value.gratis).toBe(100n)
    expect(decoded!.value.items).toBe(5n)
    expect(decoded!.value.created).toBe(1000n)
    expect(decoded!.value.lastacc).toBe(2000n)
    expect(decoded!.value.parent).toBe(0n)
  })

  it('should encode and decode empty service account', () => {
    const [encodeError, encodedData] = encodeServiceAccount(mockServiceAccountEmpty)
    expect(encodeError).toBeUndefined()
    expect(encodedData).toBeDefined()

    const [decodeError, decoded] = decodeServiceAccount(encodedData!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value.codehash).toBe('0x0000000000000000000000000000000000000000000000000000000000000000')
    expect(decoded!.value.balance).toBe(0n)
    expect(decoded!.value.minaccgas).toBe(0n)
    expect(decoded!.value.minmemogas).toBe(0n)
    expect(decoded!.value.octets).toBe(0n)
    expect(decoded!.value.gratis).toBe(0n)
    expect(decoded!.value.items).toBe(0n)
    expect(decoded!.value.created).toBe(0n)
    expect(decoded!.value.lastacc).toBe(0n)
    expect(decoded!.value.parent).toBe(0n)
  })

  it('should handle round-trip with realistic service account values', () => {
    const realisticAccount: ServiceAccountCore = {
      codehash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      balance: 5000000000000000000n, // 5 ETH equivalent
      minaccgas: 21000n, // Standard gas limit
      minmemogas: 10000n,
      octets: 65536n, // 64KB storage
      gratis: 1000n,
      items: 100n,
      created: 1234567890n,
      lastacc: 1234567891n,
      parent: 42n,
    }

    const [encodeError, encodedData] = encodeServiceAccount(realisticAccount)
    expect(encodeError).toBeUndefined()
    expect(encodedData).toBeDefined()

    const [decodeError, decoded] = decodeServiceAccount(encodedData!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value.codehash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
    expect(decoded!.value.balance).toBe(5000000000000000000n)
    expect(decoded!.value.minaccgas).toBe(21000n)
    expect(decoded!.value.minmemogas).toBe(10000n)
    expect(decoded!.value.octets).toBe(65536n)
    expect(decoded!.value.gratis).toBe(1000n)
    expect(decoded!.value.items).toBe(100n)
    expect(decoded!.value.created).toBe(1234567890n)
    expect(decoded!.value.lastacc).toBe(1234567891n)
    expect(decoded!.value.parent).toBe(42n)
  })

  it('should fail with insufficient data for discriminator', () => {
    const insufficientData = new Uint8Array([])

    const [decodeError, decoded] = decodeServiceAccount(insufficientData)
    expect(decodeError).toBeDefined()
    expect(decoded).toBeUndefined()
  })

  it('should fail with insufficient data for codehash', () => {
    // Create data with discriminator but insufficient codehash
    const discriminator = new Uint8Array([0]) // Natural number 0
    const insufficientCodehash = new Uint8Array([1, 2, 3]) // Only 3 bytes, need 32
    const data = new Uint8Array([...discriminator, ...insufficientCodehash])

    const [decodeError, decoded] = decodeServiceAccount(data)
    expect(decodeError).toBeDefined()
    expect(decoded).toBeUndefined()
  })

  it('should fail with insufficient data for account fields', () => {
    // Create data with discriminator and codehash but insufficient account fields
    const discriminator = new Uint8Array([0])
    const codehash = new Uint8Array(32).fill(0x42) // 32-byte codehash
    const insufficientAccountFields = new Uint8Array([1, 2, 3]) // Only 3 bytes, need 40
    const data = new Uint8Array([...discriminator, ...codehash, ...insufficientAccountFields])

    const [decodeError, decoded] = decodeServiceAccount(data)
    expect(decodeError).toBeDefined()
    expect(decoded).toBeUndefined()
  })

  it('should fail with insufficient data for metadata fields', () => {
    // Create data with discriminator, codehash, and account fields but insufficient metadata
    const discriminator = new Uint8Array([0])
    const codehash = new Uint8Array(32).fill(0x42) // 32-byte codehash
    const accountFields = new Uint8Array(40).fill(0x42) // 40-byte account fields
    const insufficientMetadata = new Uint8Array([1, 2, 3]) // Only 3 bytes, need 16
    const data = new Uint8Array([...discriminator, ...codehash, ...accountFields, ...insufficientMetadata])

    const [decodeError, decoded] = decodeServiceAccount(data)
    expect(decodeError).toBeDefined()
    expect(decoded).toBeUndefined()
  })

  it('should preserve remaining data after decoding', () => {
    const [encodeError, encodedData] = encodeServiceAccount(mockServiceAccount)
    expect(encodeError).toBeUndefined()

    // Add extra data after the encoded service account
    const extraData = new Uint8Array([0x42, 0x43, 0x44])
    const combinedData = new Uint8Array(encodedData!.length + extraData.length)
    combinedData.set(encodedData!)
    combinedData.set(extraData, encodedData!.length)

    const [decodeError, decoded] = decodeServiceAccount(combinedData)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value.codehash).toBe('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')
    expect(decoded!.remaining).toEqual(extraData)
  })

  it('should handle large values correctly', () => {
    const largeAccount: ServiceAccountCore = {
      codehash: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      balance: 18446744073709551615n, // Max 64-bit value
      minaccgas: 18446744073709551615n,
      minmemogas: 18446744073709551615n,
      octets: 18446744073709551615n,
      gratis: 18446744073709551615n,
      items: 4294967295n, // Max 32-bit value
      created: 4294967295n,
      lastacc: 4294967295n,
      parent: 4294967295n,
    }

    const [encodeError, encodedData] = encodeServiceAccount(largeAccount)
    expect(encodeError).toBeUndefined()
    expect(encodedData).toBeDefined()

    const [decodeError, decoded] = decodeServiceAccount(encodedData!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()
    expect(decoded!.value.codehash).toBe('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    expect(decoded!.value.balance).toBe(18446744073709551615n)
    expect(decoded!.value.minaccgas).toBe(18446744073709551615n)
    expect(decoded!.value.minmemogas).toBe(18446744073709551615n)
    expect(decoded!.value.octets).toBe(18446744073709551615n)
    expect(decoded!.value.gratis).toBe(18446744073709551615n)
    expect(decoded!.value.items).toBe(4294967295n)
    expect(decoded!.value.created).toBe(4294967295n)
    expect(decoded!.value.lastacc).toBe(4294967295n)
    expect(decoded!.value.parent).toBe(4294967295n)
  })

  it('should handle different codehash patterns', () => {
    const patterns = [
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0x1111111111111111111111111111111111111111111111111111111111111111',
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    ]

    for (const codehash of patterns) {
      const account: ServiceAccountCore = {
        ...mockServiceAccountEmpty,
        codehash: codehash as `0x${string}`,
      }

      const [encodeError, encodedData] = encodeServiceAccount(account)
      expect(encodeError).toBeUndefined()
      expect(encodedData).toBeDefined()

      const [decodeError, decoded] = decodeServiceAccount(encodedData!)
      expect(decodeError).toBeUndefined()
      expect(decoded).toBeDefined()
      expect(decoded!.value.codehash).toBe(codehash)
    }
  })
})
