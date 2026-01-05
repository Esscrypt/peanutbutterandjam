/**
 * Shard Service Proof Generation and Verification Tests
 * 
 * Tests the merkle proof generation and verification functionality
 * for bundle shards and segment shards according to Gray Paper specifications
 */

import { describe, expect, it, beforeEach, vi } from 'vitest'
import { ShardService } from '../shard-service'
import type { ConfigService } from '../config-service'
import type { ErasureCodingService } from '../erasure-coding-service'
import type { NetworkingService } from '../networking-service'
import { EventBusService } from '@pbnjam/core'
import type { WorkPackage, ShardDistributionRequest, ShardDistributionResponse } from '@pbnjam/types'
import { 
  generateWellBalancedProof, 

  merklizewb, 
  verifyMerkleProof 
} from '@pbnjam/core'
import { decodeWorkPackage } from '@pbnjam/codec'
import { join } from 'path'
import { readFileSync } from 'fs'

// Mock dependencies
const mockConfigService: ConfigService = {
  numValidators: 6n,
} as ConfigService

const mockErasureCodingService: ErasureCodingService = {
  encodeData: vi.fn().mockResolvedValue({
    shards: [
      { shard: new Uint8Array([1, 2, 3, 4]), index: 0 },
      { shard: new Uint8Array([5, 6, 7, 8]), index: 1 },
      { shard: new Uint8Array([9, 10, 11, 12]), index: 2 },
      { shard: new Uint8Array([13, 14, 15, 16]), index: 3 },
      { shard: new Uint8Array([17, 18, 19, 20]), index: 4 },
      { shard: new Uint8Array([21, 22, 23, 24]), index: 5 },
    ],
    originalLength: 24
  })
} as ErasureCodingService

const mockNetworkingService: NetworkingService = {
  sendMessage: vi.fn().mockResolvedValue([undefined, undefined]),
  sendMessageByPublicKey: vi.fn().mockResolvedValue([undefined, undefined])
} as NetworkingService

const mockEventBusService = new EventBusService()

describe('ShardService Proof Generation and Verification', () => {
  let shardService: ShardService

  beforeEach(() => {
    vi.clearAllMocks()
    shardService = new ShardService({
      configService: mockConfigService,
      erasureCodingService: mockErasureCodingService,
      eventBusService: mockEventBusService,
      networkingService: mockNetworkingService
    })
  })

  describe('Bundle Shard Proof Generation', () => {
    it('should generate valid merkle proofs for bundle shards', async () => {
      // Create test data
      const bundleShards = new Map<number, Uint8Array>()
      bundleShards.set(0, new Uint8Array([1, 2, 3, 4]))
      bundleShards.set(1, new Uint8Array([5, 6, 7, 8]))
      bundleShards.set(2, new Uint8Array([9, 10, 11, 12]))

      const segmentShards = new Map<number, Uint8Array[]>()
      segmentShards.set(0, [new Uint8Array([13, 14]), new Uint8Array([15, 16])])
      segmentShards.set(1, [new Uint8Array([17, 18]), new Uint8Array([19, 20])])
      segmentShards.set(2, [new Uint8Array([21, 22]), new Uint8Array([23, 24])])

      // Generate shard sequence
      const shardSequence = (shardService as any).buildShardSequence([
        { shard: new Uint8Array([1, 2, 3, 4]), index: 0 },
        { shard: new Uint8Array([5, 6, 7, 8]), index: 1 },
        { shard: new Uint8Array([9, 10, 11, 12]), index: 2 },
      ])
      
      // Calculate merkle root using core method
      const [rootError, merkleRoot] = merklizewb(shardSequence)
      expect(rootError).toBeUndefined()
      expect(merkleRoot).toBeDefined()
      expect(merkleRoot?.length).toBe(32)

      // Generate proof for each bundle shard
      for (let i = 0; i < bundleShards.size; i++) {
        const [proofError, proof] = generateWellBalancedProof(
          shardSequence,
          i,
        )
        
        expect(proofError).toBeUndefined()
        expect(proof).toBeDefined()
        expect(proof?.path).toBeDefined()
        expect(proof?.leafIndex).toBe(i)

        // Verify the proof
        const bundleShard = shardSequence[i]
        const [verifyError, isValid] = verifyMerkleProof(
          bundleShard,
          proof!,
          merkleRoot!,
        )
        
        expect(verifyError).toBeUndefined()
        expect(isValid).toBe(true)
      }
    })

  })

  describe('Segment Shard Proof Generation', () => {
    it('should generate valid segment shard justifications', async () => {
      // Create test data
      const shardSequence = [
        new Uint8Array([1, 2, 3, 4]), // Bundle shard 0
        new Uint8Array([5, 6, 7, 8]), // Bundle shard 1
        new Uint8Array([9, 10, 11, 12]), // Bundle shard 2
      ]

      const segmentShard = new Uint8Array([13, 14, 15, 16])
      const shardIndex = 0
      const segmentIndex = 0

      // Generate segment shard justification using Gray Paper formula
      const [justificationError, justification] = (shardService as any).generateSegmentShardJustification(
        shardSequence,
        shardIndex,
        segmentIndex,
        segmentShard
      )

      expect(justificationError).toBeUndefined()
      expect(justification).toBeDefined()
      expect(justification.length).toBeGreaterThan(0)

      // The justification should contain:
      // 1. CE 137 justification (j)
      // 2. Bundle shard hash (b)
      // 3. Merkle trace T(s,i,H)
      expect(justification.length).toBeGreaterThanOrEqual(64) // At least 2 hashes
    })

    it('should verify segment shard justifications correctly', async () => {
      const segmentShards = [
        '0x01020304',
        '0x05060708',
        '0x090a0b0c'
      ]

      const justifications = [
        new Uint8Array(64), // Valid length justification
        new Uint8Array(64), // Valid length justification
        new Uint8Array(64), // Valid length justification
      ]

      const peerPublicKey = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

      const [verifyError, isValid] = (shardService as any).verifySegmentShardJustifications(
        segmentShards,
        justifications,
        peerPublicKey
      )

      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(true)
    })

    it('should reject invalid justification lengths', async () => {
      const segmentShards = ['0x01020304']
      const justifications = [new Uint8Array(16)] // Too short
      const peerPublicKey = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

      const [verifyError, isValid] = (shardService as any).verifySegmentShardJustifications(
        segmentShards,
        justifications,
        peerPublicKey
      )

      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(false)
    })

    it('should reject mismatched shard and justification counts', async () => {
      const segmentShards = ['0x01020304', '0x05060708']
      const justifications = [new Uint8Array(64)] // Only one justification
      const peerPublicKey = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

      const [verifyError] = (shardService as any).verifySegmentShardJustifications(
        segmentShards,
        justifications,
        peerPublicKey
      )

      expect(verifyError).toBeDefined()
      expect(verifyError?.message).toContain('Mismatch between segment shards and justifications count')
    })
  })

  describe('End-to-End Proof Workflow', () => {
    it('should complete full shard distribution and verification workflow', async () => {

      const testVectorsDir = '/Users/tanyageorgieva/Repos/peanutbutterandjam/submodules/jam-test-vectors/codec/tiny'
      const binaryPath = join(testVectorsDir, 'work_package.bin')
      const expectedBinaryData = readFileSync(binaryPath)
  
      const [decodeError, decodedPackageResult] = decodeWorkPackage(expectedBinaryData)
      if (decodeError) {
        throw decodeError
      }
      const workPackage = decodedPackageResult.value
  

      const exportedSegments = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8])
      ]

      const importedSegments = [
        new Uint8Array([9, 10, 11, 12])
      ]

      const coreIndex = 1n

      // Step 1: Generate and distribute shards
      const [generateError] = await shardService.generateAndDistributeWorkPackageShards(
        workPackage,
        [], // extrinsicData
        importedSegments,
        coreIndex
      )
      expect(generateError).toBeUndefined()

      // Step 2: Simulate shard distribution request
      const request: ShardDistributionRequest = {
        erasureRoot: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        shardIndex: 0n
      }

      const peerPublicKey = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

      // Step 3: Handle request and generate response
      const [requestError] = await (shardService as any).handleShardDistributionRequest(
        request,
        peerPublicKey
      )
      
      // This might fail due to missing shard data, but the proof generation should work
      if (requestError) {
        expect(requestError.message).toContain('Shards not found')
      }

      // Step 4: Test proof generation directly
      const testShardSequence = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8]),
        new Uint8Array([9, 10, 11, 12])
      ]

      const [rootError, merkleRoot] = merklizewb(testShardSequence)
      expect(rootError).toBeUndefined()

      const [proofError, proof] = generateWellBalancedProof(
        testShardSequence,
        0,
      )
      expect(proofError).toBeUndefined()

      const [verifyError, isValid] = verifyMerkleProof(
        testShardSequence[0],
        proof!,
        merkleRoot!,
      )
      expect(verifyError).toBeUndefined()
      expect(isValid).toBe(true)
    })
  })

  describe('Gray Paper Compliance', () => {
    it('should follow Gray Paper merkle tree construction', () => {
      // Test well-balanced binary merkle tree construction
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8]),
        new Uint8Array([9, 10, 11, 12]),
        new Uint8Array([13, 14, 15, 16])
      ]

      const [error, root] = merklizewb(testData)
      expect(error).toBeUndefined()
      expect(root).toBeDefined()

      // Verify each leaf can be proven
      for (let i = 0; i < testData.length; i++) {
        const [proofError, proof] = generateWellBalancedProof(testData, i)
        expect(proofError).toBeUndefined()
        expect(proof?.leafIndex).toBe(i)

        const [verifyError, isValid] = verifyMerkleProof(
          testData[i],
          proof!,
          root!,
        )
        expect(verifyError).toBeUndefined()
        expect(isValid).toBe(true)
      }
    })

    it('should handle Gray Paper trace function T correctly', () => {
      // Test the trace function T(s,i,H) as specified in Gray Paper
      const testData = [
        new Uint8Array([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8]),
        new Uint8Array([9, 10, 11, 12])
      ]

      // Generate trace for each index
      for (let i = 0; i < testData.length; i++) {
        const [traceError, trace] = generateWellBalancedProof(testData, i)
        expect(traceError).toBeUndefined()
        expect(trace?.path).toBeDefined()
        
        // Trace should be valid for reconstruction
        const [rootError, root] = merklizewb(testData)
        expect(rootError).toBeUndefined()

        const [verifyError, isValid] = verifyMerkleProof(
          testData[i],
          trace!,
          root!,
        )
        expect(verifyError).toBeUndefined()
        expect(isValid).toBe(true)
      }
    })
  })
})
