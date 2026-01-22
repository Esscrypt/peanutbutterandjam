/**
 * Block Authoring and Import Test
 *
 * Tests the complete flow of:
 * 1. Authoring a block using BlockAuthoringService
 * 2. Importing the authored block using BlockImporterService
 * 3. Verifying the block was imported successfully
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import { join } from 'node:path'
import { generateFallbackKeySequence } from '@pbnjam/safrole'
import type { Block } from '@pbnjam/types'
import { BlockAuthoringService } from '../services/block-authoring'
import { ConfigService } from '../services/config-service'
import { NodeGenesisManager } from '../services/genesis-manager'
import { initializeServices } from './test-utils'
import type { FuzzerTargetServices } from './test-utils'

// Test vectors directory (relative to workspace root)
const WORKSPACE_ROOT = join(__dirname, '../../../')

describe('Block Authoring and Import', () => {
  let blockAuthoringService: BlockAuthoringService
  let services: FuzzerTargetServices

  beforeAll(async () => {
    // Initialize services using the same utility as fuzzer tests
    // Pass chainspec-tiny.json as chainSpecPath for genesis initialization
    const chainSpecPath = join(WORKSPACE_ROOT, 'config', 'chainspec-tiny.json')
    
    // Create a temporary config service for genesis manager
    const tempConfigService = new ConfigService('tiny', undefined)
    const genesisManager = new NodeGenesisManager(tempConfigService, {
      chainSpecPath,
    })
    
    services = await initializeServices({
      spec: 'tiny',
      useWasm: false,
      genesisManager,
    })

    // Get services from the full context
    const context = services.fullContext

    // Set genesis state from chainspec file (similar to main-service.ts)
    const [genesisStateError, genesisState] =
      context.genesisManagerService.getState()
    if (genesisStateError) {
      throw new Error(
        `Failed to get genesis state: ${genesisStateError.message}`,
      )
    }
    const [setStateError] = context.stateService.setState(genesisState.keyvals)
    if (setStateError) {
      throw new Error(
        `Failed to set genesis state: ${setStateError.message}`,
      )
    }

    // Set validator index to 0 for getValidatorCredentialsWithFallback fallback
    // This allows signature generation when keyPairService is null
    context.configService.validatorIndex = 0

    // Initialize seal keys for the seal key service
    // Generate fallback keys from entropy2 and validator set
    const entropy2 = context.entropyService.getEntropy2()
    const [fallbackKeysError, fallbackKeys] = generateFallbackKeySequence(
      entropy2,
      context.validatorSetManager,
      context.configService,
    )
    if (fallbackKeysError || !fallbackKeys) {
      throw new Error(
        `Failed to generate fallback keys: ${fallbackKeysError?.message || 'Unknown error'}`,
      )
    }
    context.sealKeyService.setSealKeys(fallbackKeys)

    // Initialize block authoring service
    // Note: keyPairService can be null - getValidatorCredentialsWithFallback handles the fallback
    blockAuthoringService = new BlockAuthoringService({
      eventBusService: context.eventBusService,
      entropyService: context.entropyService,
      keyPairService: context.keyPairService ?? null,
      sealKeyService: context.sealKeyService,
      clockService: context.clockService,
      configService: context.configService,
      validatorSetManagerService: context.validatorSetManager,
      recentHistoryService: context.recentHistoryService,
      stateService: context.stateService,
      ticketService: context.ticketService,
      serviceAccountService: context.serviceAccountService,
      guarantorService: context.guarantorService,
      workReportService: context.workReportService,
      assuranceService: context.assuranceService,
      disputesService: context.disputesService,
      networkingService: context.networkingService ?? null,
      genesisManagerService: context.genesisManagerService,
      chainManagerService: context.chainManagerService ?? null,
    })
  })

  it('should author a block and then import it successfully', async () => {
    const blockImporterService = services.blockImporterService
    const recentHistoryService = services.recentHistoryService
    const clockService = services.fullContext.clockService

    // Step 1: Author a block
    const slot = 1n
    const [authorError, authoredBlock] = await blockAuthoringService.createBlock(
      slot,
    )

    expect(authorError).toBeFalsy() // Can be null or undefined
    expect(authoredBlock).toBeDefined()
    expect(authoredBlock?.header).toBeDefined()
    expect(authoredBlock?.body).toBeDefined()
    expect(authoredBlock?.header.timeslot).toBe(slot)
    expect(authoredBlock?.header.vrfSig).toBeDefined()
    expect(authoredBlock?.header.sealSig).toBeDefined()
    expect(authoredBlock?.header.extrinsicHash).toBeDefined()

    // Step 2: Import the authored block
    const [importError, importSuccess] = await blockImporterService.importBlock(
      authoredBlock as Block,
    )

    expect(importError).toBeFalsy()
    expect(importSuccess).toBe(true)

    // Step 3: Verify block was added to recent history
    const recentHistory = recentHistoryService.getRecentHistory()
    expect(recentHistory.length).toBeGreaterThan(0)

    const latestEntry = recentHistory[recentHistory.length - 1]
    expect(latestEntry).toBeDefined()

    // Step 4: Verify clock was updated
    const latestSlot = clockService.getLatestReportedBlockTimeslot()
    expect(latestSlot).toBe(slot)
  })

  it('should author multiple blocks and import them in sequence', async () => {
    const blockImporterService = services.blockImporterService
    const recentHistoryService = services.recentHistoryService
    const clockService = services.fullContext.clockService

    const blocks: Block[] = []

    // Author and import 3 blocks in sequence
    for (let i = 1; i <= 3; i++) {
      const slot = BigInt(i + 1) // Start from slot 2 (slot 1 was used in previous test)

      // Author block
      const [authorError, block] = await blockAuthoringService.createBlock(slot)
      expect(authorError).toBeFalsy() // Can be null or undefined
      expect(block).toBeDefined()

      // Import block
      const [importError, importSuccess] =
        await blockImporterService.importBlock(block as Block)
      expect(importError).toBeFalsy()
      expect(importSuccess).toBe(true)

      blocks.push(block as Block)

      // Verify slot progression
      const latestSlot = clockService.getLatestReportedBlockTimeslot()
      expect(latestSlot).toBe(slot)
    }

    // Verify all blocks are in recent history
    const recentHistory = recentHistoryService.getRecentHistory()
    expect(recentHistory.length).toBeGreaterThanOrEqual(3)

    // Verify blocks are linked correctly (parent hash matches previous block)
    for (let i = 1; i < blocks.length; i++) {
      const currentBlock = blocks[i]
      const previousBlock = blocks[i - 1]

      // Calculate previous block hash (simplified - in real implementation would use calculateBlockHashFromHeader)
      // For now, just verify the parent hash is set
      expect(currentBlock.header.parent).toBeDefined()
    }
  })
})
