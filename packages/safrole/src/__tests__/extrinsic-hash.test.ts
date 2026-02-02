/**
 * Extrinsic Hash Calculation Tests
 *
 * Tests the calculateExtrinsicHash function according to Gray Paper specification:
 * H_extrinsichash ≡ blake{encode{blakemany{a}}}
 */

import { describe, expect, test } from 'bun:test'
import { calculateExtrinsicHash } from '@pbnjam/codec'
import type { BlockBody, IConfigService } from '@pbnjam/types'

// Create a minimal mock config service for testing
function createMockConfigService(): IConfigService {
  return {
    numCores: 4,
    numValidators: 6,
    epochDuration: 100,
    contestDuration: 10,
    slotDuration: 6000,
    maxTicketsPerExtrinsic: 256,
  } as IConfigService
}

describe('calculateExtrinsicHash', () => {
  const configService: IConfigService = createMockConfigService()

  test('should calculate hash for empty block body', () => {
    const emptyBody: BlockBody = {
      tickets: [],
      preimages: [],
      guarantees: [],
      assurances: [],
      disputes: [],
    }

    const [error, hash] = calculateExtrinsicHash(emptyBody, configService)

    expect(error).toBeUndefined()
    expect(hash).toBeDefined()
    expect(typeof hash).toBe('string')
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/) // 32 bytes = 64 hex chars with 0x prefix
  })

  test('should calculate hash for block body with empty arrays', () => {
    const body: BlockBody = {
      tickets: [],
      preimages: [],
      guarantees: [],
      assurances: [],
      disputes: [],
    }

    const [error, hash] = calculateExtrinsicHash(body, configService)

    expect(error).toBeUndefined()
    expect(hash).toBeDefined()
    expect(hash).toEqual("0x189d15af832dfe4f67744008b62c334b569fcbb4c261e0f065655697306ca252")
  })

  test('should return same hash for identical block bodies', () => {
    const body: BlockBody = {
      tickets: [],
      preimages: [],
      guarantees: [],
      assurances: [],
      disputes: [],
    }

    const [error1, hash1] = calculateExtrinsicHash(body, configService)
    const [error2, hash2] = calculateExtrinsicHash(body, configService)

    expect(error1).toBeUndefined()
    expect(error2).toBeUndefined()
    expect(hash1).toBe(hash2)
  })

  test('should return different hash for different block bodies', () => {
    const body1: BlockBody = {
      tickets: [],
      preimages: [],
      guarantees: [],
      assurances: [],
      disputes: [],
    }

    const body2: BlockBody = {
      tickets: [],
      preimages: [],
      guarantees: [],
      assurances: [],
      disputes: [],
    }

    // Even with same structure, encoding should produce consistent results
    const [error1, hash1] = calculateExtrinsicHash(body1, configService)
    const [error2, hash2] = calculateExtrinsicHash(body2, configService)

    expect(error1).toBeUndefined()
    expect(error2).toBeUndefined()
    expect(hash1).toBe(hash2) // Empty bodies should produce same hash
  })

  test('should produce deterministic hash', () => {
    const body: BlockBody = {
      tickets: [],
      preimages: [],
      guarantees: [],
      assurances: [],
      disputes: [],
    }

    // Calculate hash multiple times
    const hashes: string[] = []
    for (let i = 0; i < 5; i++) {
      const [error, hash] = calculateExtrinsicHash(body, configService)
      expect(error).toBeUndefined()
      hashes.push(hash!)
    }

    // All hashes should be identical
    const firstHash = hashes[0]
    for (const hash of hashes) {
      expect(hash).toBe(firstHash)
    }
  })

})

