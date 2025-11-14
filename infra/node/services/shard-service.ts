import {
  blake2bHash,
  bytesToHex,
  concatBytes,
  type EventBusService,
  generateWellBalancedProof,
  type Hex,
  hexToBytes,
  logger,
  merklizewb,
  reconstructRoot,
  verifyMerkleProof,
} from '@pbnj/core'
import type { ShardDistributionProtocol } from '@pbnj/networking'
import { encodeWorkPackage } from '@pbnj/codec'
import type {
  Safe,
  SafePromise,
  SegmentShardRequest,
  SegmentShardResponse,
  ShardDistributionRequest,
  ShardDistributionResponse,
  ShardWithIndex,
  WorkPackage,
} from '@pbnj/types'
import { BaseService, safeError, safeResult } from '@pbnj/types'
import type { ConfigService } from './config-service'
import type { ErasureCodingService } from './erasure-coding-service'
import type { NetworkingService } from './networking-service'

/**
 * Shard Service Implementation
 *
 * Implements CE 137: Shard Distribution Protocol
 * Handles shard generation, assignment, and distribution according to Gray Paper
 */
export class ShardService extends BaseService {
  private readonly configService: ConfigService
  private readonly erasureCodingService: ErasureCodingService
  private readonly eventBusService: EventBusService
  private readonly networkingService: NetworkingService | null
  private readonly shardDistributionProtocol: ShardDistributionProtocol | null

  /**
   * Storage for shards WE generate (as Guarantor/Assurer)
   *
   * Used to respond to shard distribution requests (CE 137, 138, 139/140)
   *
   * Structure per Gray Paper:
   * - bundleShards: Sorted array of work-package bundle shards (one per validator)
   * - segmentShards: Map of shard_index -> array of segment shards for that validator
   *
   * The erasure root is calculated as: M_B([(H(bundle_shard_i), M_B(segment_shards_i))])
   */
  private readonly shardStorage = new Map<
    string, // erasureRoot (hex)
    {
      bundleShards: Uint8Array[] // Sorted by validator index [0..V-1]
      segmentShards: Map<number, Uint8Array[]> // shard_index -> segment shards for that index
    }
  >()

  /**
   * Storage for segment shards WE receive (as Guarantor)
   *
   * Used when we're a guarantor requesting import segments via CE 139/140
   * to complete work-package bundles for guaranteeing.
   *
   * Structure:
   * - Outer map: erasureRoot -> segment data
   * - Inner map: segmentIndex -> received shard data
   *
   * Once we collect enough shards per segment, we can reconstruct the full segment
   */
  private readonly receivedSegmentShards = new Map<
    string, // erasureRoot (hex)
    Map<number, Uint8Array> // segmentIndex -> shard data
  >()

  // Track latest segment shard request for verification
  private latestSegmentRequest?: {
    erasureRoot: Uint8Array
    segmentIndices: number[]
    treeSize: number
  }

  constructor(options: {
    configService: ConfigService
    erasureCodingService: ErasureCodingService
    eventBusService: EventBusService
    networkingService: NetworkingService | null
    shardDistributionProtocol: ShardDistributionProtocol | null
  }) {
    super('shard-service')
    this.configService = options.configService
    this.erasureCodingService = options.erasureCodingService
    this.eventBusService = options.eventBusService
    this.networkingService = options.networkingService
    this.shardDistributionProtocol = options.shardDistributionProtocol

    this.eventBusService.addShardDistributionRequestCallback(
      this.handleShardDistributionRequest.bind(this),
    )
    this.eventBusService.addShardDistributionResponseCallback(
      this.handleShardDistributionResponse.bind(this),
    )

    // CE 139/140: Segment Shard Request handlers
    this.eventBusService.addSegmentShardRequestCallback(
      this.handleSegmentShardRequest.bind(this),
    )
    this.eventBusService.addSegmentShardResponseCallback(
      this.handleSegmentShardResponse.bind(this),
    )
  }

  /**
   * Generate and distribute shards for a work package bundle
   *
   * Gray Paper Reference: work_packages_and_reports.tex, Equation 108-117
   *
   * The auditable work-bundle contains:
   * - Work package (serialized)
   * - Extrinsic data blobs
   * - Imported segment data (from other work packages)
   * - All work item payloads
   * - Authorization configuration and token
   *
   * Shard assignment formula: i = (cR + v) mod V
   * Where:
   * - c = core index
   * - R = recovery threshold (342 for 1023 validators, 2 for 6 validators)
   * - v = validator index
   * - V = number of validators
   *
   * Note: Export segments are NOT included in the work-bundle as they represent
   * new data produced by execution, not data needed for auditing/execution.
   */
  async generateAndDistributeWorkPackageShards(
    workPackage: WorkPackage,
    extrinsicData: Uint8Array[],
    importedSegments: Uint8Array[],
    coreIndex: bigint,
  ): SafePromise<void> {
    // Step 1: Create the complete work-bundle according to Gray Paper
    const [encodedWorkPackageError, encodedWorkPackage] =
      encodeWorkPackage(workPackage)
    if (encodedWorkPackageError) {
      return safeError(encodedWorkPackageError)
    }

    // Concatenate all work-bundle constituents per Gray Paper Equation 108-117
    const workBundleData = concatBytes([
      encodedWorkPackage, // Work package (serialized)
      ...extrinsicData, // Extrinsic data blobs
      ...importedSegments, // Imported segment data
    ])

    // Step 2: Generate erasure-coded shards for the work-bundle
    const [bundleError, bundleEncodingResult] =
      await this.erasureCodingService.encodeData(workBundleData)
    if (bundleError) {
      return safeError(bundleError)
    }

    // Step 3: Calculate erasure root (merkle root of shard sequence)
    const [rootError, erasureRoot] = await this.calculateErasureRoot(
      bundleEncodingResult.shards,
    )
    if (rootError) {
      return safeError(rootError)
    }

    // Step 4: Store shards for later distribution
    // Sort shards by index to ensure deterministic ordering per Gray Paper
    const sortedShards = [...bundleEncodingResult.shards].sort(
      (a, b) => a.index - b.index,
    )
    this.shardStorage.set(erasureRoot, {
      bundleShards: sortedShards.map((shard) => shard.shard),
      segmentShards: new Map(), // No segment shards for work-bundle yet
    })

    // Step 5: Distribute shards to assigned validators
    const [distributeError] = await this.distributeShardsToValidators(
      erasureRoot,
      coreIndex,
    )
    if (distributeError) {
      return safeError(distributeError)
    }

    logger.info('Work package shards generated and distributed successfully', {
      erasureRoot,
      coreIndex: coreIndex.toString(),
      bundleShardCount: bundleEncodingResult.shards.length,
      workBundleSize: workBundleData.length,
    })

    return safeResult(undefined)
  }

  /**
   * Handle shard distribution request (CE 137)
   */
  private async handleShardDistributionRequest(
    request: ShardDistributionRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    if (!this.networkingService) {
      return safeError(new Error('Networking service not available'))
    }
    if (!this.shardDistributionProtocol) {
      return safeError(new Error('Shard distribution protocol not available'))
    }

    const shardData = this.shardStorage.get(request.erasureRoot)
    if (!shardData) {
      return safeError(
        new Error(`Shards not found for erasure root: ${request.erasureRoot}`),
      )
    }

    const shardIndex = Number(request.shardIndex)

    // Get bundle shard (shards are sorted by index)
    if (shardIndex < 0 || shardIndex >= shardData.bundleShards.length) {
      return safeError(
        new Error(
          `Bundle shard index ${shardIndex} out of range [0, ${shardData.bundleShards.length})`,
        ),
      )
    }
    const bundleShard = shardData.bundleShards[shardIndex]

    // Get segment shards for this index
    const segmentShards = shardData.segmentShards.get(shardIndex) || []

    // Build shard sequence (pairs of bundle hash + segment root) for justification
    const [seqError, shardSequence] = await this.buildShardSequence(
      shardData.bundleShards.map((shard, index) => ({ shard, index })),
      shardData.segmentShards,
    )
    if (seqError) {
      return safeError(seqError)
    }

    // Generate justification using Gray Paper T function
    const [justificationError, justification] = this.generateJustification(
      shardSequence,
      shardIndex,
    )
    if (justificationError) {
      return safeError(justificationError)
    }

    // Construct response
    const response: ShardDistributionResponse = {
      bundleShard: bytesToHex(bundleShard),
      segmentShards,
      justification,
    }

    // Serialize response using CE 137 protocol
    const [serializeError, serializedResponse] =
      this.shardDistributionProtocol.serializeResponse(response)
    if (serializeError) {
      return safeError(serializeError)
    }

    // Send response through networking service
    const [sendError] = await this.networkingService.sendMessageByPublicKey(
      peerPublicKey,
      137, // CE 137: Shard Distribution
      serializedResponse,
    )
    if (sendError) {
      logger.error('Failed to send shard distribution response', {
        error: sendError.message,
        peerPublicKey,
        erasureRoot: request.erasureRoot,
        shardIndex: request.shardIndex.toString(),
      })
      return safeError(sendError)
    }

    logger.info('Shard distribution response sent successfully', {
      peerPublicKey,
      erasureRoot: request.erasureRoot,
      shardIndex: request.shardIndex.toString(),
      bundleShardLength: bundleShard.length,
      segmentShardCount: segmentShards.length,
      justificationLength: justification.length,
    })

    return safeResult(undefined)
  }

  /**
   * Handle shard distribution response and verify merkle proof
   */
  private async handleShardDistributionResponse(
    response: ShardDistributionResponse,
    peerPublicKey: string,
  ): SafePromise<void> {
    try {
      // Reconstruct erasure root from shard data
      const [reconstructError, erasureRoot] =
        this.reconstructErasureRootFromResponse(response)
      if (reconstructError) {
        logger.error('Failed to reconstruct erasure root from response', {
          error: reconstructError.message,
          peerPublicKey,
        })
        return safeError(reconstructError)
      }

      // Find the corresponding shard data for verification
      const shardData = this.findShardDataByErasureRoot(erasureRoot)
      if (!shardData) {
        logger.error(
          'No matching shard data found for reconstructed erasure root',
          {
            peerPublicKey,
            erasureRoot,
          },
        )
        return safeError(new Error('No matching shard data found'))
      }

      // Verify the merkle proof
      const [verifyError, isValid] = await this.verifyShardJustification(
        response,
        shardData,
      )
      if (verifyError) {
        logger.error('Error verifying shard justification', {
          error: verifyError.message,
          peerPublicKey,
        })
        return safeError(verifyError)
      }

      if (!isValid) {
        logger.error('Invalid shard justification', {
          peerPublicKey,
          bundleShardLength: response.bundleShard.length,
          segmentShardCount: response.segmentShards.length,
        })
        return safeError(new Error('Invalid shard justification'))
      }

      // Store verified shards
      this.storeVerifiedShards(response, peerPublicKey)

      logger.info('Shard distribution response verified and stored', {
        peerPublicKey,
        bundleShardLength: response.bundleShard.length,
        segmentShardCount: response.segmentShards.length,
        justificationLength: response.justification.length,
      })

      return safeResult(undefined)
    } catch (error) {
      logger.error('Error handling shard distribution response', { error })
      return safeError(error as Error)
    }
  }

  /**
   * Calculate erasure root from bundle shards and segment shards
   *
   * Gray Paper CE 137: erasure_root = M_B(s) where s is a sequence of
   * (bundle shard hash, segment shard root) pairs
   */
  private async calculateErasureRoot(
    bundleShards: ShardWithIndex[],
    segmentShardsByIndex: Map<number, Uint8Array[]> = new Map(),
  ): SafePromise<Hex> {
    // Sort shards by index to ensure deterministic ordering per Gray Paper
    const sortedShards = [...bundleShards].sort((a, b) => a.index - b.index)

    // Build sequence of pairs
    const pairs: Uint8Array[] = []

    for (const shard of sortedShards) {
      // Calculate bundle shard hash
      const [hashError, bundleHash] = blake2bHash(shard.shard)
      if (hashError) {
        return safeError(hashError)
      }

      // Get segment shards for this index (or empty array if none)
      const segmentShards = segmentShardsByIndex.get(shard.index) || []

      // Calculate segment shard root
      let segmentRoot: Uint8Array
      if (segmentShards.length === 0) {
        // Empty segment root: hash of empty bytes
        const [emptyHashError, emptyHash] = blake2bHash(new Uint8Array(0))
        if (emptyHashError) {
          return safeError(emptyHashError)
        }
        segmentRoot = hexToBytes(emptyHash)
      } else {
        const [rootError, root] = merklizewb(segmentShards)
        if (rootError) {
          return safeError(rootError)
        }
        segmentRoot = root
      }

      // Create pair: (bundle shard hash, segment shard root)
      const pair = concatBytes([hexToBytes(bundleHash), segmentRoot])
      pairs.push(pair)
    }

    // Calculate erasure root
    const [rootError, merkleRoot] = merklizewb(pairs)
    if (rootError) {
      return safeError(rootError)
    }
    return safeResult(bytesToHex(merkleRoot))
  }

  /**
   * Build shard sequence for merklization (pairs of bundle hash + segment root)
   *
   * Gray Paper CE 137: sequence of (bundle shard hash, segment shard root) pairs
   */
  private async buildShardSequence(
    bundleShards: ShardWithIndex[],
    segmentShardsByIndex: Map<number, Uint8Array[]> = new Map(),
  ): SafePromise<Uint8Array[]> {
    // Sort shards by index to ensure deterministic ordering per Gray Paper
    const sortedShards = [...bundleShards].sort((a, b) => a.index - b.index)

    const pairs: Uint8Array[] = []

    for (const shard of sortedShards) {
      // Calculate bundle shard hash
      const [hashError, bundleHash] = blake2bHash(shard.shard)
      if (hashError) {
        return safeError(hashError)
      }

      // Get segment shards for this index (or empty array if none)
      const segmentShards = segmentShardsByIndex.get(shard.index) || []

      // Calculate segment shard root
      let segmentRoot: Uint8Array
      if (segmentShards.length === 0) {
        // Empty segment root: hash of empty bytes
        const [emptyHashError, emptyHash] = blake2bHash(new Uint8Array(0))
        if (emptyHashError) {
          return safeError(emptyHashError)
        }
        segmentRoot = hexToBytes(emptyHash)
      } else {
        const [rootError, root] = merklizewb(segmentShards)
        if (rootError) {
          return safeError(rootError)
        }
        segmentRoot = root
      }

      // Create pair: (bundle shard hash, segment shard root)
      const pair = concatBytes([hexToBytes(bundleHash), segmentRoot])
      pairs.push(pair)
    }

    return safeResult(pairs)
  }

  /**
   * Get recovery threshold for erasure coding
   */
  private getRecoveryThreshold(numValidators: number): number {
    // Gray Paper: R = floor(V * 1/3)
    // With 1023 validators, R = 342
    // With 6 validators, R = 2
    if (numValidators === 1023) {
      return 342
    } else if (numValidators === 6) {
      return 2
    }
    // Default calculation: R = floor(V * 1/3)
    return Math.floor(numValidators / 3)
  }

  /**
   * Generate justification using Gray Paper T function
   */
  private generateJustification(
    shardSequence: Uint8Array[],
    shardIndex: number,
  ): Safe<Uint8Array> {
    // Use generateWellBalancedProof from core (uses blake2b by default)
    const [proofError, proof] = generateWellBalancedProof(
      shardSequence,
      shardIndex,
    )
    if (proofError) {
      return safeError(proofError)
    }

    // Serialize justification according to JAMNP spec:
    // Justification = [0 ++ Hash OR 1 ++ Hash ++ Hash]
    return safeResult(this.serializeJustification(proof.path))
  }

  /**
   * Serialize justification according to JAMNP specification
   */
  private serializeJustification(trace: Uint8Array[]): Uint8Array {
    const parts: Uint8Array[] = []

    for (const hash of trace) {
      if (hash.length === 32) {
        // Single hash: [0 ++ Hash]
        parts.push(new Uint8Array([0]))
        parts.push(hash)
      } else {
        // Multiple hashes: [1 ++ Hash ++ Hash]
        parts.push(new Uint8Array([1]))
        parts.push(hash)
      }
    }

    return concatBytes(parts)
  }

  /**
   * Distribute shards to assigned validators
   */
  private async distributeShardsToValidators(
    erasureRoot: Hex,
    coreIndex: bigint,
  ): SafePromise<void> {
    if (!this.networkingService) {
      return safeError(new Error('Networking service not available'))
    }
    if (!this.shardDistributionProtocol) {
      return safeError(new Error('Shard distribution protocol not available'))
    }
    const numValidators = Number(this.configService.numValidators)
    const recoveryThreshold = this.getRecoveryThreshold(numValidators)

    // Calculate shard assignments for each validator
    for (
      let validatorIndex = 0;
      validatorIndex < numValidators;
      validatorIndex++
    ) {
      const assignedShardIndex = this.calculateShardAssignment(
        coreIndex,
        BigInt(validatorIndex),
        numValidators,
        recoveryThreshold,
      )

      // Send shard distribution request to validator
      const request: ShardDistributionRequest = {
        erasureRoot,
        shardIndex: assignedShardIndex,
      }

      // Serialize request using CE 137 protocol
      const [serializeError, serializedRequest] =
        this.shardDistributionProtocol.serializeRequest(request)
      if (serializeError) {
        logger.error('Failed to serialize shard distribution request', {
          error: serializeError.message,
          validatorIndex,
          erasureRoot,
          shardIndex: assignedShardIndex.toString(),
        })
        continue
      }

      // Send request through networking service
      const [sendError] = await this.networkingService.sendMessage(
        BigInt(validatorIndex),
        137, // CE 137: Shard Distribution
        serializedRequest,
      )
      if (sendError) {
        logger.error('Failed to send shard distribution request', {
          error: sendError.message,
          validatorIndex,
          erasureRoot,
          shardIndex: assignedShardIndex.toString(),
        })
        continue
      }

      logger.info('Shard distribution request sent', {
        validatorIndex,
        erasureRoot,
        shardIndex: assignedShardIndex.toString(),
      })
    }

    return safeResult(undefined)
  }

  /**
   * Calculate shard assignment using Gray Paper formula
   * i = (cR + v) mod V
   */
  private calculateShardAssignment(
    coreIndex: bigint,
    validatorIndex: bigint,
    numValidators: number,
    recoveryThreshold: number,
  ): bigint {
    const c = coreIndex
    const R = BigInt(recoveryThreshold)
    const v = validatorIndex
    const V = BigInt(numValidators)

    return (c * R + v) % V
  }

  /**
   * Reconstruct erasure root from shard distribution response
   *
   * Gray Paper CE 137: The erasure root is M_B(s) where s is a sequence of
   * (bundle shard hash, segment shard root) pairs
   */
  private reconstructErasureRootFromResponse(
    response: ShardDistributionResponse,
  ): Safe<Hex> {
    // Calculate bundle shard hash
    const [bundleHashError, bundleHash] = blake2bHash(
      hexToBytes(response.bundleShard),
    )
    if (bundleHashError) {
      return safeError(bundleHashError)
    }

    // Calculate segment shard root (merkle root of all segment shards)
    const [segmentRootError, segmentRoot] = merklizewb(response.segmentShards)
    if (segmentRootError) {
      return safeError(segmentRootError)
    }

    // Build the pair: (bundle shard hash, segment shard root)
    const pair = concatBytes([hexToBytes(bundleHash), segmentRoot])

    // Calculate erasure root as merkle root of the pair
    const [rootError, merkleRoot] = merklizewb([pair])
    if (rootError) {
      return safeError(rootError)
    }

    return safeResult(bytesToHex(merkleRoot))
  }
  private findShardDataByErasureRoot(erasureRoot: Hex): {
    bundleShards: Uint8Array[]
    segmentShards: Map<number, Uint8Array[]>
  } | null {
    const shardData = this.shardStorage.get(erasureRoot)
    if (!shardData) {
      return null
    }
    return shardData
  }

  /**
   * Verify shard justification using merkle proof
   *
   * Gray Paper CE 137: Verify the justification T(s, i, H) where s is the sequence
   * of (bundle shard hash, segment shard root) pairs
   */
  private async verifyShardJustification(
    response: ShardDistributionResponse,
    shardData: {
      bundleShards: Uint8Array[]
      segmentShards: Map<number, Uint8Array[]>
    },
  ): SafePromise<boolean> {
    // Build shard sequence from stored data
    const [seqError, shardSequence] = await this.buildShardSequence(
      shardData.bundleShards.map((shard, index) => ({ shard, index })),
      shardData.segmentShards,
    )
    if (seqError) {
      return safeError(seqError)
    }

    // Deserialize justification
    const [deserializeError, proofPath] = this.deserializeJustification(
      response.justification,
    )
    if (deserializeError) {
      return safeError(deserializeError)
    }

    // Calculate bundle shard hash
    const bundleShardBytes = hexToBytes(response.bundleShard)
    const [hashError, bundleShardHash] = blake2bHash(bundleShardBytes)
    if (hashError) {
      return safeError(hashError)
    }

    // Calculate segment shard root (merkle root of all segment shards)
    const [segmentRootError, segmentRoot] = merklizewb(response.segmentShards)
    if (segmentRootError) {
      return safeError(segmentRootError)
    }

    // Build the pair: (bundle shard hash, segment shard root)
    const pair = concatBytes([hexToBytes(bundleShardHash), segmentRoot])

    // Find the pair index in the sequence
    const shardIndex = shardSequence.findIndex((existingPair: Uint8Array) =>
      existingPair.every((byte, i) => byte === pair[i]),
    )

    if (shardIndex === -1) {
      return safeError(new Error('Shard pair not found in sequence'))
    }

    // Calculate expected erasure root
    const [rootError, expectedRoot] = merklizewb(shardSequence)
    if (rootError) {
      return safeError(rootError)
    }

    // Verify merkle proof using core package
    const [verifyError, isValid] = verifyMerkleProof(
      pair,
      {
        path: proofPath,
        leafIndex: shardIndex,
        treeSize: shardSequence.length,
      },
      expectedRoot,
    )
    if (verifyError) {
      return safeError(verifyError)
    }

    return safeResult(isValid)
  }

  /**
   * Deserialize justification according to JAMNP specification
   */
  private deserializeJustification(
    justification: Uint8Array,
  ): Safe<Uint8Array[]> {
    try {
      const proofPath: Uint8Array[] = []
      let offset = 0

      while (offset < justification.length) {
        const discriminator = justification[offset]
        offset += 1

        if (discriminator === 0) {
          // Single hash: [0 ++ Hash]
          if (offset + 32 > justification.length) {
            return safeError(new Error('Invalid justification format'))
          }
          proofPath.push(justification.slice(offset, offset + 32))
          offset += 32
        } else if (discriminator === 1) {
          // Multiple hashes: [1 ++ Hash ++ Hash]
          if (offset + 64 > justification.length) {
            return safeError(new Error('Invalid justification format'))
          }
          proofPath.push(justification.slice(offset, offset + 32))
          proofPath.push(justification.slice(offset + 32, offset + 64))
          offset += 64
        } else {
          return safeError(new Error('Invalid justification discriminator'))
        }
      }

      return safeResult(proofPath)
    } catch (error) {
      return safeError(error as Error)
    }
  }

  /**
   * Store verified shards
   */
  private storeVerifiedShards(
    response: ShardDistributionResponse,
    peerPublicKey: string,
  ): void {
    // Store verified shards for later use
    // This could be implemented as needed for the specific use case
    logger.info('Storing verified shards', {
      peerPublicKey,
      bundleShardLength: response.bundleShard.length,
      segmentShardCount: response.segmentShards.length,
    })
  }

  /**
   * Handle segment shard request (CE 139/140)
   *
   * Gray Paper: CE 139/140 Segment Shard Request Protocol
   * Used by guarantors to request import segment shards from assurers
   *
   * Protocol Flow:
   * - CE 139: Return segment shards without justification
   * - CE 140: Return segment shards with justification j⌢[b]⌢T(s,i,H)
   */
  private async handleSegmentShardRequest(
    request: SegmentShardRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    try {
      logger.info('Handling segment shard request', {
        peerPublicKey,
        requestCount: request.requests.length,
      })

      const segmentShards: Hex[] = []
      const justifications: Uint8Array[] = []
      let totalSegmentCount = 0

      // Validate request size limit (Gray Paper: 2WM, WM = 3072)
      const maxSegmentShards = 2 * 3072 // 6144

      // Process each request
      for (const req of request.requests) {
        const shardData = this.shardStorage.get(req.erasureRoot)
        if (!shardData) {
          logger.error('Shard data not found for erasure root', {
            erasureRoot: req.erasureRoot,
            peerPublicKey,
          })
          continue
        }

        // Build shard sequence once per erasure root for justification
        const [seqError, shardSequence] = await this.buildShardSequence(
          shardData.bundleShards.map((shard, index) => ({ shard, index })),
          shardData.segmentShards,
        )
        if (seqError) {
          logger.error('Failed to build shard sequence', {
            error: seqError.message,
            erasureRoot: req.erasureRoot,
          })
          continue
        }

        // Get segment shards for the requested indices
        const segmentShardData =
          shardData.segmentShards.get(Number(req.shardIndex)) || []

        for (const segmentIndex of req.segmentIndices) {
          if (totalSegmentCount >= maxSegmentShards) {
            logger.warn('Segment shard request exceeds limit', {
              maxSegmentShards,
              peerPublicKey,
            })
            break
          }

          if (segmentIndex < segmentShardData.length) {
            const segmentShard = segmentShardData[segmentIndex]
            segmentShards.push(bytesToHex(segmentShard))
            totalSegmentCount++

            const [ce137Error, ce137Justification] = this.generateJustification(
              shardSequence,
              Number(req.shardIndex),
            )
            if (ce137Error) {
              logger.error('Failed to generate CE 137 justification', {
                error: ce137Error.message,
                erasureRoot: req.erasureRoot,
                shardIndex: req.shardIndex,
              })
              continue
            }

            const bundleShardIndex = Number(req.shardIndex)
            if (
              bundleShardIndex < 0 ||
              bundleShardIndex >= shardData.bundleShards.length
            ) {
              logger.error('Bundle shard index out of range', {
                bundleShardIndex,
                availableShards: shardData.bundleShards.length,
                erasureRoot: req.erasureRoot,
              })
              continue
            }

            const bundleShard = shardData.bundleShards[bundleShardIndex]
            const [bundleHashError, bundleHashHex] = blake2bHash(bundleShard)
            if (bundleHashError) {
              logger.error('Failed to hash bundle shard', {
                error: bundleHashError.message,
                erasureRoot: req.erasureRoot,
                shardIndex: req.shardIndex,
              })
              continue
            }
            const bundleShardHash = hexToBytes(bundleHashHex)

            const [justificationError, justification] =
              this.generateSegmentShardJustification(
                ce137Justification,
                bundleShardHash,
                segmentShardData,
                segmentIndex,
              )
            if (justificationError) {
              logger.error('Failed to generate segment shard justification', {
                error: justificationError.message,
                erasureRoot: req.erasureRoot,
                shardIndex: req.shardIndex,
                segmentIndex,
              })
              continue
            }
            justifications.push(justification)
          } else {
            logger.warn('Segment index out of range', {
              segmentIndex,
              availableSegments: segmentShardData.length,
              erasureRoot: req.erasureRoot,
              shardIndex: req.shardIndex,
            })
          }
        }
      }

      // Construct response
      const response: SegmentShardResponse = {
        segmentShards,
        justifications: justifications.length > 0 ? justifications : undefined,
      }

      // Emit response event
      await this.eventBusService.emitSegmentShardResponse(
        response,
        peerPublicKey,
      )

      logger.info('Segment shard request processed', {
        peerPublicKey,
        segmentShardCount: segmentShards.length,
        justificationCount: justifications.length,
        hasJustifications: !!response.justifications,
      })

      return safeResult(undefined)
    } catch (error) {
      logger.error('Error handling segment shard request', {
        error: (error as Error).message,
        peerPublicKey,
      })
      return safeError(error as Error)
    }
  }

  /**
   * Handle segment shard response (CE 139/140)
   *
   * Used by guarantors to process received segment shards
   *
   * Protocol Flow:
   * - CE 139: Accept segment shards without justification
   * - CE 140: Verify segment shards with merkle proof justification
   *
   * Gray Paper CE 140 Justification Format:
   * j⌢[b]⌢T(s,i,H) where:
   * - j = CE 137 justification (merkle proof from bundle to erasure root)
   * - b = bundle shard hash
   * - T(s,i,H) = merkle proof from segment shard to segment root
   */
  private async handleSegmentShardResponse(
    response: SegmentShardResponse,
  ): SafePromise<void> {
    if (!this.latestSegmentRequest) {
      return safeError(
        new Error('No pending segment request to verify against'),
      )
    }

    const { erasureRoot, segmentIndices, treeSize } = this.latestSegmentRequest
    const erasureRootHex = bytesToHex(erasureRoot)

    if (response.justifications) {
      if (response.segmentShards.length !== response.justifications.length) {
        return safeError(
          new Error('Mismatch between segment shards and justifications count'),
        )
      }

      for (let i = 0; i < response.segmentShards.length; i++) {
        const segmentShard = hexToBytes(response.segmentShards[i])
        const justification = response.justifications[i]
        const segmentIndex = segmentIndices[i]

        const [parseError, parsed] =
          this.parseSegmentJustification(justification)
        if (parseError) {
          return safeError(parseError)
        }

        const [verifyError] = this.verifyFullJustificationChainWithCore(
          segmentShard,
          parsed,
          segmentIndex,
          treeSize,
          erasureRoot,
        )
        if (verifyError) {
          return safeError(verifyError)
        }
      }
    }

    const [storeError] = this.storeReceivedSegmentShards(
      erasureRootHex,
      segmentIndices,
      response.segmentShards,
    )
    if (storeError) {
      return safeError(storeError)
    }

    this.latestSegmentRequest = undefined

    return safeResult(undefined)
  }

  /**
   * Store received segment shards for later reconstruction
   */
  private storeReceivedSegmentShards(
    erasureRootHex: Hex,
    segmentIndices: number[],
    segmentShards: Hex[],
  ): Safe<void> {
    let shardMap = this.receivedSegmentShards.get(erasureRootHex)
    if (!shardMap) {
      shardMap = new Map()
      this.receivedSegmentShards.set(erasureRootHex, shardMap)
    }

    for (let i = 0; i < segmentIndices.length; i++) {
      const segmentIndex = segmentIndices[i]
      const segmentShard = hexToBytes(segmentShards[i])
      shardMap.set(segmentIndex, segmentShard)
    }

    return safeResult(undefined)
  }

  /**
   * Get received segment shards for an erasure root
   */
  public getReceivedSegmentShards(
    erasureRootHex: Hex,
  ): Map<number, Uint8Array> | undefined {
    return this.receivedSegmentShards.get(erasureRootHex)
  }

  /**
   * Verify full justification chain using core package methods
   */
  private verifyFullJustificationChainWithCore(
    segmentShard: Uint8Array,
    parsed: { j: Uint8Array; bundleShardHash: Uint8Array; T: Uint8Array },
    segmentIndex: number,
    segmentTreeSize: number,
    erasureRoot: Uint8Array,
  ): Safe<void> {
    const [segmentRootError, segmentRoot] =
      this.verifyAndReconstructSegmentRoot(
        parsed.T,
        segmentShard,
        segmentIndex,
        segmentTreeSize,
      )
    if (segmentRootError) {
      return safeError(segmentRootError)
    }

    const bundlePair = concatBytes([parsed.bundleShardHash, segmentRoot])

    const [erasureError] = this.verifyBundlePairAgainstErasureRoot(
      parsed.j,
      bundlePair,
      erasureRoot,
    )
    if (erasureError) {
      return safeError(erasureError)
    }

    return safeResult(undefined)
  }

  /**
   * Verify T component using core verifyMerkleProof and reconstruct segment root
   */
  private verifyAndReconstructSegmentRoot(
    T: Uint8Array,
    segmentShard: Uint8Array,
    segmentIndex: number,
    treeSize: number,
  ): Safe<Uint8Array> {
    const discriminator = T[0]
    const tData = T.slice(1)

    if (discriminator === 0) {
      if (tData.length !== 32) {
        return safeError(
          new Error(`Invalid T type 0: expected 32 bytes, got ${tData.length}`),
        )
      }
      // Type 0: Single-element tree, the hash IS the root
      // No verification needed, just return it
      return safeResult(tData)
    }

    const proofPath: Uint8Array[] = []

    if (discriminator === 1) {
      if (tData.length !== 64) {
        return safeError(
          new Error(`Invalid T type 1: expected 64 bytes, got ${tData.length}`),
        )
      }
      const leftHash = tData.slice(0, 32)
      const rightHash = tData.slice(32, 64)
      const isLeftChild = segmentIndex < Math.ceil(treeSize / 2)
      proofPath.push(isLeftChild ? rightHash : leftHash)
    } else if (discriminator === 2) {
      if (tData.length % 32 !== 0) {
        return safeError(
          new Error(`Invalid T type 2: length not multiple of 32`),
        )
      }
      for (let offset = 0; offset < tData.length; offset += 32) {
        proofPath.push(tData.slice(offset, offset + 32))
      }
    } else {
      return safeError(new Error(`Invalid T discriminator: ${discriminator}`))
    }

    // Use core reconstructRoot for Type 1 & 2
    return reconstructRoot(segmentShard, proofPath, segmentIndex, treeSize)
  }

  /**
   * Verify j component against erasure root
   */
  private verifyBundlePairAgainstErasureRoot(
    j: Uint8Array,
    bundlePair: Uint8Array,
    erasureRoot: Uint8Array,
  ): Safe<void> {
    const discriminator = j[0]
    const jData = j.slice(1)

    if (discriminator === 0) {
      if (jData.length !== 32) {
        return safeError(
          new Error(`Invalid j type 0: expected 32 bytes, got ${jData.length}`),
        )
      }
      const [verifyError, isValid] = verifyMerkleProof(
        bundlePair,
        { path: [], leafIndex: 0, treeSize: 1 },
        erasureRoot,
      )
      if (verifyError) {
        return safeError(verifyError)
      }
      if (!isValid) {
        return safeError(new Error('j type 0: verification failed'))
      }
      return safeResult(undefined)
    }

    if (discriminator === 1) {
      if (jData.length !== 64) {
        return safeError(
          new Error(`Invalid j type 1: expected 64 bytes, got ${jData.length}`),
        )
      }

      const [pairHashError, pairHash] = blake2bHash(bundlePair)
      if (pairHashError) {
        return safeError(pairHashError)
      }
      const pairHashBytes = hexToBytes(pairHash)

      const [verifyLeftError, isValidLeft] = verifyMerkleProof(
        pairHashBytes,
        { path: [jData.slice(32, 64)], leafIndex: 0, treeSize: 2 },
        erasureRoot,
      )
      if (verifyLeftError) {
        return safeError(verifyLeftError)
      }

      const [verifyRightError, isValidRight] = verifyMerkleProof(
        pairHashBytes,
        { path: [jData.slice(0, 32)], leafIndex: 1, treeSize: 2 },
        erasureRoot,
      )
      if (verifyRightError) {
        return safeError(verifyRightError)
      }

      if (!isValidLeft && !isValidRight) {
        return safeError(
          new Error('j type 1: neither position matches erasure root'),
        )
      }
      return safeResult(undefined)
    }

    return safeError(new Error(`Invalid j discriminator: ${discriminator}`))
  }

  private parseSegmentJustification(justification: Uint8Array): Safe<{
    j: Uint8Array
    bundleShardHash: Uint8Array
    T: Uint8Array
  }> {
    if (justification.length < 1) {
      return safeError(new Error('Justification too short'))
    }

    let offset = 0

    const jDiscriminator = justification[offset]
    const jSize = jDiscriminator === 0 ? 33 : jDiscriminator === 1 ? 65 : 0

    if (jSize === 0) {
      return safeError(new Error(`Invalid j discriminator: ${jDiscriminator}`))
    }

    if (justification.length < offset + jSize) {
      return safeError(new Error('Justification too short for j component'))
    }

    const j = justification.slice(offset, offset + jSize)
    offset += jSize

    if (justification.length < offset + 32) {
      return safeError(
        new Error('Justification too short for bundle shard hash'),
      )
    }

    const bundleShardHash = justification.slice(offset, offset + 32)
    offset += 32

    const T = justification.slice(offset)

    if (T.length < 1) {
      return safeError(new Error('Justification missing T component'))
    }

    return safeResult({ j, bundleShardHash, T })
  }

  /**
   * Generate segment shard justification according to Gray Paper formula
   *
   * Gray Paper: j⌢[b]⌢T(s,i,H)
   * Where:
   * - j is the relevant justification from CE 137 (format: [0 ++ Hash OR 1 ++ Hash ++ Hash])
   * - b is the work-package bundle shard hash (32 bytes)
   * - s is the full sequence of segment shards with the given shard index
   * - i is the segment index
   * - H is Blake 2b hash function
   * - T is the merkle trace function (format: [0 ++ Hash OR 1 ++ Hash ++ Hash OR 2 ++ path])
   */
  private generateSegmentShardJustification(
    ce137Justification: Uint8Array,
    bundleShardHash: Uint8Array,
    segmentShards: Uint8Array[],
    segmentIndex: number,
  ): Safe<Uint8Array> {
    const [traceError, trace] = generateWellBalancedProof(
      segmentShards,
      segmentIndex,
    )
    if (traceError) {
      return safeError(traceError)
    }

    const tComponent = this.formatTraceComponent(trace)

    const justification = concatBytes([
      ce137Justification,
      bundleShardHash,
      tComponent,
    ])

    return safeResult(justification)
  }

  /**
   * Format trace component with discriminator
   * Returns: [discriminator ++ data]
   * - Type 0: [0 ++ Hash] for single-element tree
   * - Type 1: [1 ++ Hash ++ Hash] for 2-element tree
   * - Type 2: [2 ++ Hash₁ ++ Hash₂ ++ ...] for larger trees
   */
  private formatTraceComponent(trace: {
    path: Uint8Array[]
    leafIndex: number
    treeSize: number
  }): Uint8Array {
    if (trace.treeSize === 1) {
      const discriminator = new Uint8Array([0])
      const hash = trace.path.length > 0 ? trace.path[0] : new Uint8Array(32)
      return concatBytes([discriminator, hash])
    }

    if (trace.treeSize === 2 && trace.path.length === 1) {
      const discriminator = new Uint8Array([1])
      const isLeftChild = trace.leafIndex === 0
      const sibling = trace.path[0]

      if (isLeftChild) {
        const leftHash = new Uint8Array(32)
        return concatBytes([discriminator, leftHash, sibling])
      }
      const rightHash = new Uint8Array(32)
      return concatBytes([discriminator, sibling, rightHash])
    }

    const discriminator = new Uint8Array([2])
    return concatBytes([discriminator, ...trace.path])
  }
}
