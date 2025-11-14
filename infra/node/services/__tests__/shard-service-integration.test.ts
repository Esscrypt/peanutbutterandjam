/**
 * Shard Service Integration Test
 * 
 * Reuses ErasureCodingService test patterns to properly test shard generation and distribution
 * with real work package erasure coding
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { logger, hexToBytes, bytesToHex } from '@pbnj/core'
import {
  decodeWorkPackage,
  encodeWorkPackage,
} from '@pbnj/codec'
import type { WorkPackage, ShardDistributionRequest, ShardDistributionResponse } from '@pbnj/types'
import { ConfigService } from '../config-service'
import { ErasureCodingService } from '../erasure-coding-service'
import { ShardService } from '../shard-service'
import { EventBusService } from '@pbnj/core'
import { ShardDistributionProtocol } from '@pbnj/networking'

// Mock networking service that captures sent messages
class MockNetworkingService {
  private sentMessages: Array<{
    validatorIndex: bigint
    protocolId: number
    data: Uint8Array
  }> = []

  private sentMessagesByPublicKey: Array<{
    peerPublicKey: string
    protocolId: number
    data: Uint8Array
  }> = []

  async sendMessage(
    validatorIndex: bigint,
    protocolId: number,
    data: Uint8Array,
  ): Promise<[Error | undefined, undefined]> {
    this.sentMessages.push({ validatorIndex, protocolId, data })
    return [undefined, undefined]
  }

  async sendMessageByPublicKey(
    peerPublicKey: string,
    protocolId: number,
    data: Uint8Array,
  ): Promise<[Error | undefined, undefined]> {
    this.sentMessagesByPublicKey.push({ peerPublicKey, protocolId, data })
    return [undefined, undefined]
  }

  getSentMessages() {
    return this.sentMessages
  }

  getSentMessagesByPublicKey() {
    return this.sentMessagesByPublicKey
  }

  clearMessages() {
    this.sentMessages = []
    this.sentMessagesByPublicKey = []
  }
}

describe('Shard Service - Work Package Distribution', () => {
  let configService: ConfigService
  let erasureCodingService: ErasureCodingService
  let shardService: ShardService
  let eventBusService: EventBusService
  let mockNetworkingService: MockNetworkingService
  let shardDistributionProtocol: ShardDistributionProtocol

  beforeAll(async () => {
    // Initialize real instances (same as erasure-coding-service.test.ts)
    configService = new ConfigService('tiny')
    erasureCodingService = new ErasureCodingService(configService)
    eventBusService = new EventBusService()
    mockNetworkingService = new MockNetworkingService()
    shardDistributionProtocol = new ShardDistributionProtocol(eventBusService)

    // Start erasure coding service
    const [startError, started] = await erasureCodingService.start()
    if (startError) {
      throw startError
    }
    expect(started).toBe(true)

    // Initialize shard service
    shardService = new ShardService({
      configService,
      erasureCodingService,
      eventBusService,
      networkingService: mockNetworkingService as any,
    })
  })

  it('should properly erasure code work package and distribute shards', async () => {
    // Clear messages from previous tests
    mockNetworkingService.clearMessages()

    // Step 1: Load real work package from test vectors (same as erasure-coding-service.test.ts)
    const testVectorsDir = '/Users/tanyageorgieva/Repos/peanutbutterandjam/submodules/jam-test-vectors/codec/tiny'
    const binaryPath = join(testVectorsDir, 'work_package.bin')
    const expectedBinaryData = readFileSync(binaryPath)

    // Step 2: Decode binary to WorkPackage structure
    const [decodeError, decodedPackageResult] = decodeWorkPackage(expectedBinaryData)
    if (decodeError) {
      throw decodeError
    }
    const workPackage = decodedPackageResult.value
   

    const coreIndex = 1n

    // Step 5: Generate and distribute shards using ShardService
    const [generateError] = await shardService.generateAndDistributeShards(
      workPackage,
      [],
      coreIndex
    )
    expect(generateError).toBeUndefined()

    // Step 6: Verify that distribution messages were sent to all validators
    const sentMessages = mockNetworkingService.getSentMessages()
    expect(sentMessages.length).toBe(6) // Should send to all 6 validators in tiny mode
    expect(sentMessages.every(msg => msg.protocolId === 137)).toBe(true) // CE 137: Shard Distribution
    expect(sentMessages.every(msg => msg.validatorIndex >= 0n && msg.validatorIndex < 6n)).toBe(true)

    // Step 7: Verify shard storage by erasure root
    const shardStorage = (shardService as any).shardStorage
    const erasureRoots = Array.from(shardStorage.keys())
    expect(erasureRoots.length).toBeGreaterThan(0)
    
    const erasureRoot = erasureRoots[0]
    const storedShardData = shardStorage.get(erasureRoot)
    expect(storedShardData).toBeDefined()
    expect(storedShardData.bundleShards.size).toBeGreaterThan(0) // Should have bundle shards
    expect(storedShardData.segmentShards.size).toBeGreaterThan(0)
    expect(storedShardData.shardSequence.length).toBeGreaterThan(0)

    logger.info('Shard distribution completed', {
      erasureRoot,
      bundleShardCount: storedShardData.bundleShards.size,
      segmentShardGroupCount: storedShardData.segmentShards.size,
      shardSequenceLength: storedShardData.shardSequence.length,
      messagesSent: sentMessages.length,
    })

    // Step 8: Test shard distribution request handling directly
    const request: ShardDistributionRequest = {
      erasureRoot: erasureRoot as `0x${string}`,
      shardIndex: 0n
    }

    const peerPublicKey = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    
    // Step 9: Handle shard distribution request directly
    const [requestError] = await (shardService as any).handleShardDistributionRequest(
      request,
      peerPublicKey
    )
    
    expect(requestError).toBeUndefined()

    // Step 10: Test shard distribution response handling directly
    // Create a mock response using the stored shard data
    const bundleShard = storedShardData.bundleShards.get(0)
    const segmentShards = Array.from(storedShardData.segmentShards.values()).flat()
    
    expect(bundleShard).toBeDefined()
    expect(segmentShards.length).toBeGreaterThan(0)

    const mockResponse: ShardDistributionResponse = {
      bundleShard: bytesToHex(bundleShard!),
      segmentShards: segmentShards,
      justification: new Uint8Array(64) // Mock justification for now
    }

    // Step 11: Handle shard distribution response directly
    const [responseError] = await (shardService as any).handleShardDistributionResponse(
      mockResponse,
      peerPublicKey
    )
    
    expect(responseError).toBeUndefined()

    logger.info('✅ Work package shard distribution test passed', {
      workPackageSize: encodedWorkPackage.length,
      erasureRoot,
      distributedToValidators: sentMessages.length,
      bundleShardSize: bundleShard!.length,
      segmentShardCount: segmentShards.length,
    })
  })

  it('should verify erasure root reconstruction from real shard data', async () => {
    // Clear messages from previous tests
    mockNetworkingService.clearMessages()

    // Load real work package
    const testVectorsDir = '/Users/tanyageorgieva/Repos/peanutbutterandjam/submodules/jam-test-vectors/codec/tiny'
    const binaryPath = join(testVectorsDir, 'work_package.bin')
    const expectedBinaryData = readFileSync(binaryPath)

    const [decodeError, decodedPackageResult] = decodeWorkPackage(expectedBinaryData)
    if (decodeError) {
      throw decodeError
    }
    const workPackage = decodedPackageResult.value

    const [encodeError, encodedWorkPackage] = encodeWorkPackage(workPackage)
    if (encodeError) {
      throw encodeError
    }

    // Generate exported segments using real erasure coding
    const segmentData1 = new Uint8Array(500)
    const segmentData2 = new Uint8Array(750)
    
    // Fill with test data
    for (let i = 0; i < segmentData1.length; i++) {
      segmentData1[i] = (i % 256)
    }
    for (let i = 0; i < segmentData2.length; i++) {
      segmentData2[i] = ((i + 50) % 256)
    }

    // Encode segments using erasure coding
    const [encodeError1, encodedSegment1] = await erasureCodingService.encodeData(segmentData1)
    if (encodeError1) {
      throw encodeError1
    }
    const [encodeError2, encodedSegment2] = await erasureCodingService.encodeData(segmentData2)
    if (encodeError2) {
      throw encodeError2
    }

    // Extract first shard from each encoded segment
    const exportedSegments = [
      encodedSegment1.shards[0].shard,
      encodedSegment2.shards[0].shard
    ]

    const [generateError] = await shardService.generateAndDistributeShards(
      workPackage,
      exportedSegments,
      1n
    )
    expect(generateError).toBeUndefined()

    // Get the stored shard data
    const shardStorage = (shardService as any).shardStorage
    const erasureRoots = Array.from(shardStorage.keys())
    const erasureRoot = erasureRoots[0]
    const storedShardData = shardStorage.get(erasureRoot)

    // Create a mock response using real shard data
    const bundleShard = storedShardData.bundleShards.get(0)
    const segmentShards = Array.from(storedShardData.segmentShards.values()).flat()
    
    expect(bundleShard).toBeDefined()
    expect(segmentShards.length).toBeGreaterThan(0)

    const mockResponse: ShardDistributionResponse = {
      bundleShard: bytesToHex(bundleShard!),
      segmentShards: segmentShards,
      justification: new Uint8Array(64) // Mock justification
    }

    // Test erasure root reconstruction directly
    const [reconstructError, reconstructedRoot] = (shardService as any).reconstructErasureRootFromResponse(mockResponse)
    
    expect(reconstructError).toBeUndefined()
    expect(reconstructedRoot).toBeDefined()
    expect(reconstructedRoot).toMatch(/^0x[a-f0-9]{64}$/) // Should be a valid hex hash
    expect(reconstructedRoot.length).toBe(66) // 0x + 64 hex chars

    // The reconstructed root should match the stored erasure root
    expect(reconstructedRoot).toBe(erasureRoot)

    // Test handleShardDistributionResponse directly
    const peerPublicKey = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    const [responseError] = await (shardService as any).handleShardDistributionResponse(
      mockResponse,
      peerPublicKey
    )
    
    expect(responseError).toBeUndefined()

    logger.info('✅ Erasure root reconstruction verified', {
      originalErasureRoot: erasureRoot,
      reconstructedRoot,
      match: reconstructedRoot === erasureRoot,
      bundleShardSize: bundleShard!.length,
      segmentShardCount: segmentShards.length,
    })
  })

  it('should verify shard assignment formula with real validator counts', () => {
    const coreIndex = 1n
    const numValidators = configService.n
    const recoveryThreshold = configService.k

    logger.info('Testing shard assignment formula', {
      coreIndex: coreIndex.toString(),
      numValidators,
      recoveryThreshold,
    })

    // Test assignment for each validator
    for (let validatorIndex = 0; validatorIndex < numValidators; validatorIndex++) {
      const assignedShardIndex = (shardService as any).calculateShardAssignment(
        coreIndex,
        BigInt(validatorIndex),
        numValidators,
        recoveryThreshold
      )

      // Verify Gray Paper formula: i = (cR + v) mod V
      const expected = (coreIndex * BigInt(recoveryThreshold) + BigInt(validatorIndex)) % BigInt(numValidators)
      expect(assignedShardIndex).toBe(expected)

      logger.info(`Validator ${validatorIndex} assigned to shard ${assignedShardIndex}`)
    }

    logger.info('✅ Shard assignment formula verified for all validators')
  })

  it('should handle multi-segment work package distribution', async () => {
    // Clear messages from previous tests
    mockNetworkingService.clearMessages()

    // Create a larger work package that will span multiple segments
    const largeWorkPackage: WorkPackage = {
      authToken: new Uint8Array(1000), // Large auth token
      authCodeHost: 1n,
      authCodeHash: new Uint8Array(32),
      authConfig: new Uint8Array(2000), // Large auth config
      context: {
        anchor: new Uint8Array(32),
        stateRoot: new Uint8Array(32),
        beefyRoot: new Uint8Array(32),
        timestamp: 1234567890n
      },
      workItems: []
    }

    // Fill with random data
    for (let i = 0; i < largeWorkPackage.authToken.length; i++) {
      largeWorkPackage.authToken[i] = Math.floor(Math.random() * 256)
    }
    for (let i = 0; i < largeWorkPackage.authConfig.length; i++) {
      largeWorkPackage.authConfig[i] = Math.floor(Math.random() * 256)
    }

    // Generate exported segments using real erasure coding
    const segmentData1 = new Uint8Array(5000) // Large segment
    const segmentData2 = new Uint8Array(3000) // Medium segment
    
    // Fill segments with random data
    for (let i = 0; i < segmentData1.length; i++) {
      segmentData1[i] = Math.floor(Math.random() * 256)
    }
    for (let i = 0; i < segmentData2.length; i++) {
      segmentData2[i] = Math.floor(Math.random() * 256)
    }

    // Encode segments using erasure coding
    const [encodeError1, encodedSegment1] = await erasureCodingService.encodeData(segmentData1)
    if (encodeError1) {
      throw encodeError1
    }
    const [encodeError2, encodedSegment2] = await erasureCodingService.encodeData(segmentData2)
    if (encodeError2) {
      throw encodeError2
    }

    // Extract first shard from each encoded segment
    const exportedSegments = [
      encodedSegment1.shards[0].shard,
      encodedSegment2.shards[0].shard
    ]

    logger.info('Testing multi-segment work package distribution', {
      authTokenSize: largeWorkPackage.authToken.length,
      authConfigSize: largeWorkPackage.authConfig.length,
      segmentSizes: exportedSegments.map(s => s.length),
    })

    // Generate and distribute shards
    const [generateError] = await shardService.generateAndDistributeShards(
      largeWorkPackage,
      exportedSegments,
      2n
    )
    expect(generateError).toBeUndefined()

    // Verify distribution
    const sentMessages = mockNetworkingService.getSentMessages()
    expect(sentMessages.length).toBe(6) // Should send to all validators

    // Verify shard storage
    const shardStorage = (shardService as any).shardStorage
    const erasureRoots = Array.from(shardStorage.keys())
    expect(erasureRoots.length).toBeGreaterThan(0)

    const erasureRoot = erasureRoots[0]
    const storedShardData = shardStorage.get(erasureRoot)
    expect(storedShardData).toBeDefined()
    expect(storedShardData.bundleShards.size).toBeGreaterThan(0)
    expect(storedShardData.segmentShards.size).toBeGreaterThan(0)

    // Test direct method calls
    const request: ShardDistributionRequest = {
      erasureRoot,
      shardIndex: 0n
    }

    const peerPublicKey = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    
    // Test handleShardDistributionRequest directly
    const [requestError] = await (shardService as any).handleShardDistributionRequest(
      request,
      peerPublicKey
    )
    expect(requestError).toBeUndefined()

    // Test handleShardDistributionResponse directly
    const bundleShard = storedShardData.bundleShards.get(0)
    const segmentShards = Array.from(storedShardData.segmentShards.values()).flat()
    
    const mockResponse: ShardDistributionResponse = {
      bundleShard: bytesToHex(bundleShard!),
      segmentShards: segmentShards,
      justification: new Uint8Array(64)
    }

    const [responseError] = await (shardService as any).handleShardDistributionResponse(
      mockResponse,
      peerPublicKey
    )
    expect(responseError).toBeUndefined()

    logger.info('✅ Multi-segment work package distribution completed', {
      erasureRoot,
      bundleShardCount: storedShardData.bundleShards.size,
      segmentShardGroupCount: storedShardData.segmentShards.size,
      totalMessagesSent: sentMessages.length,
      bundleShardSize: bundleShard!.length,
      segmentShardCount: segmentShards.length,
    })
  })

  it('should verify erasure coding integration with shard service', async () => {
    // Clear messages from previous tests
    mockNetworkingService.clearMessages()

    // This test verifies that the shard service properly integrates with the erasure coding service
    // by using the same work package that the erasure coding service test uses

    const testVectorsDir = '/Users/tanyageorgieva/Repos/peanutbutterandjam/submodules/jam-test-vectors/codec/tiny'
    const binaryPath = join(testVectorsDir, 'work_package.bin')
    const expectedBinaryData = readFileSync(binaryPath)

    const [decodeError, decodedPackageResult] = decodeWorkPackage(expectedBinaryData)
    if (decodeError) {
      throw decodeError
    }
    const workPackage = decodedPackageResult.value

    const [encodeError, encodedWorkPackage] = encodeWorkPackage(workPackage)
    if (encodeError) {
      throw encodeError
    }

    // Generate exported segments using real erasure coding
    const segmentData = new Uint8Array(200)
    
    // Fill with test data
    for (let i = 0; i < segmentData.length; i++) {
      segmentData[i] = (i % 256)
    }

    // Encode segment using erasure coding
    const [segmentEncodeError, encodedSegment] = await erasureCodingService.encodeData(segmentData)
    if (segmentEncodeError) {
      throw segmentEncodeError
    }

    // Extract first shard as exported segment
    const exportedSegments = [encodedSegment.shards[0].shard]

    const [generateError] = await shardService.generateAndDistributeShards(
      workPackage,
      exportedSegments,
      0n
    )
    expect(generateError).toBeUndefined()

    // Verify that the erasure coding was performed correctly
    const shardStorage = (shardService as any).shardStorage
    const erasureRoots = Array.from(shardStorage.keys())
    const erasureRoot = erasureRoots[0]
    const storedShardData = shardStorage.get(erasureRoot)

    // The bundle shards should be properly erasure coded
    expect(storedShardData.bundleShards.size).toBe(configService.n) // Should have n shards
    expect(storedShardData.segmentShards.size).toBeGreaterThan(0) // Should have segment shards

    // Verify that we can recover the original data from the shards
    const bundleShards = Array.from(storedShardData.bundleShards.values()).map((shard, index) => ({
      shard,
      index
    }))

    // Test recovery with minimum required shards
    const k = configService.k
    const minimalShards = bundleShards.slice(0, k)

    const [recoveryError, recoveredData] = await erasureCodingService.decode(
      minimalShards,
      encodedWorkPackage.length
    )

    expect(recoveryError).toBeUndefined()
    expect(recoveredData).toEqual(encodedWorkPackage)

    // Test direct method calls
    const request: ShardDistributionRequest = {
      erasureRoot,
      shardIndex: 0n
    }

    const peerPublicKey = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    
    // Test handleShardDistributionRequest directly
    const [requestError] = await (shardService as any).handleShardDistributionRequest(
      request,
      peerPublicKey
    )
    expect(requestError).toBeUndefined()

    // Test handleShardDistributionResponse directly
    const bundleShard = storedShardData.bundleShards.get(0)
    const segmentShards = Array.from(storedShardData.segmentShards.values()).flat()
    
    // Create a proper justification for the mock response
    // We need to generate a real justification using the stored shard sequence
    const shardSequence = storedShardData.shardSequence
    const [justificationError, justification] = (shardService as any).generateJustification(
      shardSequence,
      0 // shard index
    )
    
    if (justificationError) {
      throw justificationError
    }
    
    const mockResponse: ShardDistributionResponse = {
      bundleShard: bytesToHex(bundleShard!),
      segmentShards: segmentShards,
      justification: justification
    }

    const [responseError] = await (shardService as any).handleShardDistributionResponse(
      mockResponse,
      peerPublicKey
    )
    expect(responseError).toBeUndefined()

    logger.info('✅ Erasure coding integration verified', {
      originalSize: encodedWorkPackage.length,
      recoveredSize: recoveredData.length,
      shardCount: bundleShards.length,
      usedShards: minimalShards.length,
      erasureRoot,
      bundleShardSize: bundleShard!.length,
      segmentShardCount: segmentShards.length,
    })
  })
})
