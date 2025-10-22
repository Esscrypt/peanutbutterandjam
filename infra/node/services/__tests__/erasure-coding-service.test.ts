import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { logger } from '@pbnj/core'
import {
  decodeWorkPackage,
  encodeWorkPackage,
} from '@pbnj/serialization'
import type { ShardWithIndex } from '@pbnj/types'
import { ConfigService } from '../config-service'
import { ErasureCodingService } from '../erasure-coding-service'

describe('ErasureCodingService - Work Package Erasure Coding', () => {
  let erasureCodingService: ErasureCodingService
  let configService: ConfigService

  beforeAll(async () => {
    // Initialize config service with tiny edition parameters
    configService = new ConfigService('tiny')    
    
    // Initialize erasure coding service
    erasureCodingService = new ErasureCodingService(configService)
    
    // Start the service
    const [error, started] = await erasureCodingService.start()
    if (error) {
      throw error
    }
    expect(started).toBe(true)
  })

  it('should encode and decode work package with full shards', async () => {
    const testVectorsDir = '/Users/tanyageorgieva/Repos/peanutbutterandjam/submodules/jam-test-vectors/codec/tiny'

    // 1. Read the expected binary output
    const binaryPath = join(testVectorsDir, 'work_package.bin')
    const expectedBinaryData = readFileSync(binaryPath)

    // 2. Decode binary to WorkPackage structure
    const [decodeError, decodedPackageResult] =
      decodeWorkPackage(expectedBinaryData)
    if (decodeError) {
      throw decodeError
    }
    const workPackage = decodedPackageResult.value

    // 3. Encode the work package to binary using Gray Paper serialization
    const [encodeError, encodedWorkPackage] = encodeWorkPackage(workPackage)
    if (encodeError) {
      throw encodeError
    }

    logger.info('Work package encoded', {
      originalSize: encodedWorkPackage.length,
      k: configService.k,
      n: configService.n,
    })

    // 4. Encode the binary data using erasure coding
    const [erasureEncodeError, encodingResult] =
      await erasureCodingService.encodeData(encodedWorkPackage)
    if (erasureEncodeError) {
      throw erasureEncodeError
    }

    logger.info('Erasure coding complete', {
      shardCount: encodingResult.shards.length,
      originalLength: encodingResult.originalLength,
    })

    expect(encodingResult.shards.length).toBeGreaterThan(0)
    expect(encodingResult.originalLength).toBe(encodedWorkPackage.length)

    // 5. Decode from ALL shards (full recovery)
    const [decodeError2, decodedData] = await erasureCodingService.decode(
      encodingResult.shards,
      encodingResult.originalLength,
    )
    if (decodeError2) {
      throw decodeError2
    }

    // 6. Verify the decoded data matches the original encoded work package
    expect(decodedData.length).toBe(encodedWorkPackage.length)
    expect(decodedData).toEqual(encodedWorkPackage)

    // 7. Decode the work package from the reconstructed binary
    const [finalDecodeError, finalDecodedPackageResult] =
      decodeWorkPackage(decodedData)
    if (finalDecodeError) {
      throw finalDecodeError
    }

    const finalWorkPackage = finalDecodedPackageResult.value

    // 8. Verify the final work package matches the original
    expect(finalWorkPackage.authToken).toBe(workPackage.authToken)
    expect(finalWorkPackage.authCodeHost).toBe(workPackage.authCodeHost)
    expect(finalWorkPackage.authCodeHash).toBe(workPackage.authCodeHash)
    expect(finalWorkPackage.context.anchor).toBe(workPackage.context.anchor)
    expect(finalWorkPackage.workItems.length).toBe(workPackage.workItems.length)

    // 9. Encode final work package and verify it matches the original binary
    const [finalEncodeError, finalEncodedData] =
      encodeWorkPackage(finalWorkPackage)
    if (finalEncodeError) {
      throw finalEncodeError
    }

    expect(finalEncodedData).toEqual(expectedBinaryData)

    logger.info('✅ Full shard recovery test passed')
  })

  it('should decode work package from partial shards (erasure coding recovery)', async () => {
    const testVectorsDir = '/Users/tanyageorgieva/Repos/peanutbutterandjam/submodules/jam-test-vectors/codec/tiny'

    // 1. Read and decode the work package
    const binaryPath = join(testVectorsDir, 'work_package.bin')
    const expectedBinaryData = readFileSync(binaryPath)

    const [decodeError, decodedPackageResult] =
      decodeWorkPackage(expectedBinaryData)
    if (decodeError) {
      throw decodeError
    }
    const workPackage = decodedPackageResult.value

    // 2. Encode the work package
    const [encodeError, encodedWorkPackage] = encodeWorkPackage(workPackage)
    if (encodeError) {
      throw encodeError
    }

    // 3. Encode using erasure coding
    const [erasureEncodeError, encodingResult] =
      await erasureCodingService.encodeData(encodedWorkPackage)
    if (erasureEncodeError) {
      throw erasureEncodeError
    }

    const totalShards = encodingResult.shards.length
    const k = configService.k
    const n = configService.n

    logger.info('Testing partial shard recovery', {
      totalShards,
      k,
      n,
      requiredShards: k,
    })

    // 4. Test recovery with exactly k shards (minimum required)
    // Take the first k shards
    const minimalShards: ShardWithIndex[] = encodingResult.shards.slice(0, k)

    logger.info('Attempting recovery with minimal shards', {
      usedShards: minimalShards.length,
      requiredShards: k,
      shardIndices: minimalShards.map((s) => s.index),
    })

    // 5. Decode from minimal shards
    const [minimalDecodeError, minimalDecodedData] =
      await erasureCodingService.decode(
        minimalShards,
        encodingResult.originalLength,
      )
    if (minimalDecodeError) {
      throw minimalDecodeError
    }

    // 6. Verify the decoded data matches the original
    expect(minimalDecodedData.length).toBe(encodedWorkPackage.length)
    expect(minimalDecodedData).toEqual(encodedWorkPackage)

    // 7. Decode and verify the work package structure
    const [finalDecodeError, finalDecodedPackageResult] =
      decodeWorkPackage(minimalDecodedData)
    if (finalDecodeError) {
      throw finalDecodeError
    }

    const finalWorkPackage = finalDecodedPackageResult.value

    expect(finalWorkPackage.authToken).toBe(workPackage.authToken)
    expect(finalWorkPackage.authCodeHost).toBe(workPackage.authCodeHost)

    // 8. Test recovery with k+1 shards (some redundancy)
    if (totalShards > k) {
      const redundantShards: ShardWithIndex[] = encodingResult.shards.slice(
        0,
        k + 1,
      )

      logger.info('Testing recovery with redundant shards', {
        usedShards: redundantShards.length,
      })

      const [redundantDecodeError, redundantDecodedData] =
        await erasureCodingService.decode(
          redundantShards,
          encodingResult.originalLength,
        )
      if (redundantDecodeError) {
        throw redundantDecodeError
      }

      expect(redundantDecodedData).toEqual(encodedWorkPackage)
    }

    // 9. Test recovery with random subset of k shards (simulating lost shards)
    if (totalShards > k + 2) {
      // Take shards at indices: 0, 2, 4, 6, ... (skip every other shard)
      const randomShards: ShardWithIndex[] = []
      for (let i = 0; i < encodingResult.shards.length && randomShards.length < k; i += 2) {
        randomShards.push(encodingResult.shards[i])
      }

      logger.info('Testing recovery with non-sequential shards', {
        usedShards: randomShards.length,
        shardIndices: randomShards.map((s) => s.index),
      })

      const [randomDecodeError, randomDecodedData] =
        await erasureCodingService.decode(
          randomShards,
          encodingResult.originalLength,
        )
      if (randomDecodeError) {
        throw randomDecodeError
      }

      expect(randomDecodedData).toEqual(encodedWorkPackage)
    }

    logger.info('✅ Partial shard recovery test passed')
  })

  it('should handle erasure root calculation', async () => {
    const testVectorsDir = '/Users/tanyageorgieva/Repos/peanutbutterandjam/submodules/jam-test-vectors/codec/tiny'

    // Read and encode work package
    const binaryPath = join(testVectorsDir, 'work_package.bin')
    const binaryData = readFileSync(binaryPath)

    const [decodeError, decodedPackageResult] = decodeWorkPackage(binaryData)
    if (decodeError) {
      throw decodeError
    }

    const [encodeError, encodedWorkPackage] = encodeWorkPackage(
      decodedPackageResult.value,
    )
    if (encodeError) {
      throw encodeError
    }

    // Encode with erasure coding
    const [erasureEncodeError, encodingResult] =
      await erasureCodingService.encodeData(encodedWorkPackage)
    if (erasureEncodeError) {
      throw erasureEncodeError
    }

    // Note: Erasure root calculation using merklizewb will be added
    // when merklization integration is complete

    logger.info('Erasure coding metadata', {
      shardCount: encodingResult.shards.length,
      shardIndices: encodingResult.shards.map((s) => s.index),
      originalLength: encodingResult.originalLength,
    })

    expect(encodingResult.shards.length).toBeGreaterThan(0)
  })

  it('should handle multi-segment data with partial recovery', async () => {
    // Generate 10k random bytes (larger than single segment size of 4104)
    const randomData = new Uint8Array(10000)
    for (let i = 0; i < randomData.length; i++) {
      randomData[i] = Math.floor(Math.random() * 256)
    }

    logger.info('Testing multi-segment erasure coding', {
      dataSize: randomData.length,
      segmentSize: 4104,
      expectedSegments: Math.ceil(randomData.length / 4104),
    })

    // Encode the random data
    const [erasureEncodeError, encodingResult] =
      await erasureCodingService.encodeData(randomData)
    if (erasureEncodeError) {
      throw erasureEncodeError
    }

    logger.info('Multi-segment encoding complete', {
      shardCount: encodingResult.shards.length,
      originalLength: encodingResult.originalLength,
      shardIndices: encodingResult.shards.map((s) => s.index),
    })

    // For multi-segment data, we expect 6 shards per segment
    const expectedSegments = Math.ceil(randomData.length / 4104)
    const expectedShards = expectedSegments * 6
    expect(encodingResult.shards.length).toBe(expectedShards)
    expect(encodingResult.originalLength).toBe(randomData.length)

    // Test recovery with just 2 shards from each segment (indices 0 and 1)
    // For multi-segment data, we need shards from each segment
    const originalShards = encodingResult.shards.filter(
      (s, i) => i % 6 < 2, // First 2 shards from each segment (indices 0 and 1)
    )

    // For multi-segment data, we need at least 2 shards per segment
    // So we need 2 * numSegments shards total
    expect(originalShards.length).toBe(expectedSegments * 2)

    logger.info('Testing partial recovery with original shards', {
      usedShards: originalShards.length,
      shardIndices: originalShards.map((s) => s.index),
    })

    const [decodeError, decodedData] = await erasureCodingService.decode(
      originalShards,
      encodingResult.originalLength,
    )
    if (decodeError) {
      throw decodeError
    }

    // Verify the decoded data matches the original
    expect(decodedData.length).toBe(randomData.length)
    expect(decodedData).toEqual(randomData)

    // Test recovery with 2 recovery shards from each segment (indices 2 and 3)
    const recoveryShards = encodingResult.shards.filter(
      (s, i) => i % 6 >= 2 && i % 6 < 4, // Shards 2-3 from each segment (indices 2 and 3)
    )

    logger.info('Testing partial recovery with recovery shards', {
      usedShards: recoveryShards.length,
      shardIndices: recoveryShards.map((s) => s.index),
    })

    const [recoveryDecodeError, recoveryDecodedData] =
      await erasureCodingService.decode(
        recoveryShards,
        encodingResult.originalLength,
      )
    if (recoveryDecodeError) {
      throw recoveryDecodeError
    }

    // Verify the decoded data matches the original
    expect(recoveryDecodedData.length).toBe(randomData.length)
    expect(recoveryDecodedData).toEqual(randomData)

    // Test recovery with mixed shards from each segment (indices 0 and 3)
    const mixedShards = encodingResult.shards.filter(
      (s, i) => i % 6 === 0 || i % 6 === 3, // Shards 0 and 3 from each segment
    )

    logger.info('Testing partial recovery with mixed shards', {
      usedShards: mixedShards.length,
      shardIndices: mixedShards.map((s) => s.index),
    })

    const [mixedDecodeError, mixedDecodedData] =
      await erasureCodingService.decode(
        mixedShards,
        encodingResult.originalLength,
      )
    if (mixedDecodeError) {
      throw mixedDecodeError
    }

    // Verify the decoded data matches the original
    expect(mixedDecodedData.length).toBe(randomData.length)
    expect(mixedDecodedData).toEqual(randomData)

    logger.info('✅ Multi-segment partial recovery test passed')
  })

  it('should fail gracefully with insufficient shards', async () => {
    const testVectorsDir = '/Users/tanyageorgieva/Repos/peanutbutterandjam/submodules/jam-test-vectors/codec/tiny'

    const binaryPath = join(testVectorsDir, 'work_package.bin')
    const binaryData = readFileSync(binaryPath)

    const [decodeError, decodedPackageResult] = decodeWorkPackage(binaryData)
    if (decodeError) {
      throw decodeError
    }

    const [encodeError, encodedWorkPackage] = encodeWorkPackage(
      decodedPackageResult.value,
    )
    if (encodeError) {
      throw encodeError
    }

    const [erasureEncodeError, encodingResult] =
      await erasureCodingService.encodeData(encodedWorkPackage)
    if (erasureEncodeError) {
      throw erasureEncodeError
    }

    const k = configService.k

    // Try to decode with k-1 shards (insufficient)
    const insufficientShards: ShardWithIndex[] = encodingResult.shards.slice(
      0,
      k - 1,
    )

    logger.info('Testing insufficient shards', {
      providedShards: insufficientShards.length,
      requiredShards: k,
    })

    // This should fail
    const [insufficientDecodeError] = await erasureCodingService.decode(
      insufficientShards,
      encodingResult.originalLength,
    )

    expect(insufficientDecodeError).toBeDefined()
    logger.info('✅ Insufficient shards test passed (correctly failed)')
  })
})

