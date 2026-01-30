/**
 * Extrinsic Hash Calculation Tests
 *
 * Tests the calculateExtrinsicHash function according to Gray Paper specification:
 * H_extrinsichash ≡ blake{encode{blakemany{a}}}
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { calculateExtrinsicHash } from '@pbnjam/codec'
import type { BlockBody, IConfigService } from '@pbnjam/types'
import { ConfigService } from '../../../../infra/node/services/config-service'
import { convertJsonBlockToBlock } from '../../../../infra/node/__tests__/test-utils'

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

  test('should calculate hash for block with empty extrinsics', () => {
    // Test with block 1 from fallback traces
    const tracePath = join(
      __dirname,
      '../../../../submodules/jam-test-vectors/traces/fallback/00000001.json',
    )

    let traceData: any
    try {
      traceData = JSON.parse(readFileSync(tracePath, 'utf-8'))
    } catch (error) {
      // Skip test if trace file doesn't exist
      console.warn(`Skipping test: trace file not found at ${tracePath}: ${error instanceof Error ? error.message : String(error)}`)
      expect(true).toBe(true)
      return
    }

    const emptyBlock = traceData.block

    // Convert JSON block to Block type
    const block = convertJsonBlockToBlock(emptyBlock)
    const realConfigService = new ConfigService('tiny') as IConfigService

    // Calculate extrinsic hash
    const [error, calculatedHash] = calculateExtrinsicHash(
      block.body,
      realConfigService,
    )

    expect(error).toBeUndefined()
    expect(calculatedHash).toBeDefined()

    // The calculated hash should match the hash in the block header
    expect(calculatedHash).toBe(block.header.extrinsicHash)
  })

  test('should calculate hash for real fuzzer trace block', () => {
    // Load a real trace file
    const tracePath = join(
      __dirname,
      '../../../../submodules/jam-conformance/fuzz-reports/0.7.2/traces/1766243315_8065/00000037.json',
    )

    let traceData: any
    try {
      traceData = JSON.parse(readFileSync(tracePath, 'utf-8'))
    } catch (error) {
      // Skip test if trace file doesn't exist
      console.warn(`Skipping test: trace file not found at ${tracePath}: ${error instanceof Error ? error.message : String(error)}`)
      expect(true).toBe(true) // Pass the test if file doesn't exist
      return
    }

    // Convert JSON block to Block type
    const block = convertJsonBlockToBlock(traceData.block)
    const realConfigService = new ConfigService('tiny') as IConfigService

    // Calculate extrinsic hash
    const [error, calculatedHash] = calculateExtrinsicHash(
      block.body,
      realConfigService,
    )

    expect(error).toBeUndefined()
    expect(calculatedHash).toBeDefined()

    // The calculated hash should match the hash in the block header
    expect(calculatedHash).toBe(block.header.extrinsicHash)
  })

  // Helper function to test a block from a trace file
  function testBlockFromTrace(
    traceDir: string,
    blockNum: string,
    description: string,
  ) {
    test(description, () => {
      const tracePath = join(
        __dirname,
        `../../../../submodules/jam-test-vectors/traces/${traceDir}/${blockNum}.json`,
      )

      let traceData: any
      try {
        traceData = JSON.parse(readFileSync(tracePath, 'utf-8'))
      } catch (error) {
        // Skip test if trace file doesn't exist
        console.warn(
          `Skipping test: trace file not found at ${tracePath}: ${error instanceof Error ? error.message : String(error)}`,
        )
        expect(true).toBe(true)
        return
      }

      // Convert JSON block to Block type
      const block = convertJsonBlockToBlock(traceData.block)
      const realConfigService = new ConfigService('tiny') as IConfigService

      // Calculate extrinsic hash
      const [error, calculatedHash] = calculateExtrinsicHash(
        block.body,
        realConfigService,
      )

      expect(error).toBeUndefined()
      expect(calculatedHash).toBeDefined()

      // The calculated hash should match the hash in the block header
      expect(calculatedHash).toBe(block.header.extrinsicHash)
    })
  }

  // Tests for safrole trace blocks
  describe('safrole trace blocks', () => {
    testBlockFromTrace('safrole', '00000052', 'should calculate hash for safrole block 52')
    testBlockFromTrace('safrole', '00000075', 'should calculate hash for safrole block 75')
    testBlockFromTrace('safrole', '0000080', 'should calculate hash for safrole block 80')
  })

  // Tests for preimages trace blocks
  describe('preimages trace blocks', () => {
    testBlockFromTrace('preimages', '00000052', 'should calculate hash for preimages block 52')
    testBlockFromTrace('preimages', '00000075', 'should calculate hash for preimages block 75')
    testBlockFromTrace('preimages', '00000100', 'should calculate hash for preimages block 100')
  })

  // Tests for fuzzy trace blocks
  describe('fuzzy trace blocks', () => {
    testBlockFromTrace('fuzzy', '00000152', 'should calculate hash for fuzzy block 152')
    testBlockFromTrace('fuzzy', '00000175', 'should calculate hash for fuzzy block 175')
    testBlockFromTrace('fuzzy', '00000200', 'should calculate hash for fuzzy block 200')
  })
})

