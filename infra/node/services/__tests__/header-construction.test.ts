/**
 * Unit tests for header construction and validation
 *
 * Tests that headers constructed using constructHeader can be validated
 * using validateBlockHeader from @pbnjam/block-importer
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import { constructHeader } from '@pbnjam/block-authoring'
import { validateBlockHeader, validatePreStateRoot } from '@pbnjam/block-importer'
import { calculateExtrinsicHash } from '@pbnjam/codec'
import { zeroHash } from '@pbnjam/core'
import type { BlockBody, BlockHeader } from '@pbnjam/types'
import { initializeServices, type FuzzerTargetServices } from '../../__tests__/test-utils'
import { BlockImporterService } from '../block-importer-service'

describe('Header Construction and Validation', () => {
  let services: FuzzerTargetServices
  let configService: FuzzerTargetServices['configService']
  let clockService: FuzzerTargetServices['fullContext']['clockService']
  let entropyService: FuzzerTargetServices['fullContext']['entropyService']
  let keyPairService: FuzzerTargetServices['fullContext']['keyPairService']
  let validatorSetManagerService: FuzzerTargetServices['validatorSetManager']
  let genesisManagerService: FuzzerTargetServices['fullContext']['genesisManagerService']
  let recentHistoryService: FuzzerTargetServices['recentHistoryService']
  let stateService: FuzzerTargetServices['stateService']
  let sealKeyService: FuzzerTargetServices['fullContext']['sealKeyService']
  let ticketService: FuzzerTargetServices['fullContext']['ticketService']
  let blockImporterService: BlockImporterService

  beforeAll(async () => {
    // Initialize services using the same function as fuzzer tests
    services = await initializeServices({ spec: 'tiny' })

    // Extract services from the returned object
    configService = services.configService
    recentHistoryService = services.recentHistoryService
    stateService = services.stateService
    validatorSetManagerService = services.validatorSetManager

    // Extract additional services from fullContext
    const context = services.fullContext
    clockService = context.clockService
    entropyService = context.entropyService
    keyPairService = context.keyPairService
    genesisManagerService = context.genesisManagerService
    sealKeyService = context.sealKeyService
    ticketService = context.ticketService

    // Manually set genesis block in recent history for parent lookup
    const [genesisHashError, genesisHash] =
      genesisManagerService.getGenesisHeaderHash()
    expect(genesisHashError).toBeNull()
    expect(genesisHash).toBeDefined()

    recentHistoryService.addBlockWithSuperPeak(
      {
        headerHash: genesisHash!,
        stateRoot: zeroHash,
        reportedPackageHashes: new Map(),
      },
      zeroHash,
    )

    // Initialize block importer service for validation
    blockImporterService = services.blockImporterService
  })

  it('should construct and validate a header', async () => {
    // Get genesis header as parent
    const [genesisHeaderError, genesisHeader] =
      genesisManagerService.getGenesisHeader()
    expect(genesisHeaderError).toBeNull()
    expect(genesisHeader).toBeDefined()
    if (!genesisHeader) {
      throw new Error('Genesis header not available')
    }

    // Construct a new header with empty block body
    const blockBody: BlockBody = {
      tickets: [],
      preimages: [],
      guarantees: [],
      assurances: [],
      disputes: [],
    }
    const slot = genesisHeader.timeslot + 1n
    const [constructError, completeHeader] = await constructHeader(
      slot,
      blockBody,
      configService,
      recentHistoryService,
      genesisManagerService,
      stateService,
      clockService,
      entropyService,
      validatorSetManagerService,
      ticketService,
      keyPairService,
      sealKeyService,
    )

    expect(constructError).toBeNull()
    expect(completeHeader).toBeDefined()
    expect(completeHeader?.timeslot).toBe(slot)
    expect(completeHeader?.parent).toBeDefined()
    expect(completeHeader?.extrinsicHash).toBeDefined()
    expect(completeHeader?.sealSig).toBeDefined()
    expect(completeHeader?.vrfSig).toBeDefined()

    if (!completeHeader) {
      throw new Error('Failed to construct header')
    }

    // Update clock to the new slot
    clockService.setLatestReportedBlockTimeslot(completeHeader.timeslot - 1n)

    // Validate pre-state root (same as block-importer-service.ts line 212)
    validatePreStateRoot(completeHeader, stateService)

    // Validate the header using the same validation as block-importer-service.ts
    // This uses validateBlockHeader which is called in importBlockInternal
    const [validateError] = await validateBlockHeader(
      completeHeader,
      clockService,
      configService,
      stateService,
      recentHistoryService,
      validatorSetManagerService,
      sealKeyService,
      entropyService,
    )

    // Validate extrinsic hash matches the block body (same as block-importer-service.ts lines 419-428)
    const [extrinsicHashError, computedExtrinsicHash] = calculateExtrinsicHash(
      blockBody,
      configService,
    )
    expect(extrinsicHashError).toBeNull()
    expect(computedExtrinsicHash).toBeDefined()
    expect(computedExtrinsicHash).toBe(completeHeader.extrinsicHash)

    // Header validation should pass since constructHeader now generates proper signatures
    expect(validateError).toBeNull()
  })

  it('should construct header with block body', async () => {
    // Get genesis header as parent
    const [genesisHeaderError, genesisHeader] =
      genesisManagerService.getGenesisHeader()
    expect(genesisHeaderError).toBeNull()
    expect(genesisHeader).toBeDefined()
    if (!genesisHeader) {
      throw new Error('Genesis header not available')
    }

    // Construct a header with block body containing preimages
    const blockBody: BlockBody = {
      tickets: [],
      preimages: [
      {
          requester: 1n,
          blob: '0x0102030405' as `0x${string}`,
      },
      {
          requester: 1n,
          blob: '0x060708090a' as `0x${string}`,
        },
      ],
      guarantees: [],
      assurances: [],
      disputes: [],
    }

    const slot = genesisHeader.timeslot + 1n
    const [constructError, completeHeader] = await constructHeader(
      slot,
      blockBody,
      configService,
      recentHistoryService,
      genesisManagerService,
      stateService,
      clockService,
      entropyService,
      validatorSetManagerService,
      ticketService,
      keyPairService,
      sealKeyService,
    )

    expect(constructError).toBeNull()
    expect(completeHeader).toBeDefined()
    expect(completeHeader?.extrinsicHash).not.toBe(zeroHash)
    expect(completeHeader?.extrinsicHash).toBeDefined()
    expect(completeHeader?.sealSig).toBeDefined()
    expect(completeHeader?.vrfSig).toBeDefined()

    if (!completeHeader) {
      throw new Error('Failed to construct header')
    }

    // Update clock to the new slot
    clockService.setLatestReportedBlockTimeslot(completeHeader.timeslot - 1n)

    // Validate pre-state root (same as block-importer-service.ts line 212)
    validatePreStateRoot(completeHeader, stateService)

    // Validate using the same helper as block-importer-service.ts
    const [validateError] = await validateBlockHeader(
      completeHeader,
      clockService,
      configService,
      stateService,
      recentHistoryService,
      validatorSetManagerService,
      sealKeyService,
      entropyService,
    )

    // Validate extrinsic hash matches the block body (same as block-importer-service.ts lines 419-428)
    const [extrinsicHashError, computedExtrinsicHash] = calculateExtrinsicHash(
      blockBody,
      configService,
    )
    expect(extrinsicHashError).toBeNull()
    expect(computedExtrinsicHash).toBeDefined()
    expect(computedExtrinsicHash).toBe(completeHeader.extrinsicHash)

    // Header validation should pass since constructHeader now generates proper signatures
    expect(validateError).toBeNull()
  })

  it('should construct header with genesis as parent', async () => {
    // Get genesis header as parent
    const [genesisHeaderError, genesisHeader] =
      genesisManagerService.getGenesisHeader()
    expect(genesisHeaderError).toBeNull()
    expect(genesisHeader).toBeDefined()
    if (!genesisHeader) {
      throw new Error('Genesis header not available')
    }

    // Get genesis hash for comparison
    const [genesisHashError, genesisHash] =
      genesisManagerService.getGenesisHeaderHash()
    expect(genesisHashError).toBeNull()
    expect(genesisHash).toBeDefined()

    // Construct a header with genesis as parent
    const blockBody: BlockBody = {
      tickets: [],
      preimages: [],
      guarantees: [],
      assurances: [],
      disputes: [],
    }

    const slot = genesisHeader.timeslot + 1n
    const [constructError, completeHeader] = await constructHeader(
      slot,
      blockBody,
      configService,
      recentHistoryService,
      genesisManagerService,
      stateService,
      clockService,
      entropyService,
      validatorSetManagerService,
      ticketService,
      keyPairService,
      sealKeyService,
    )

    expect(constructError).toBeNull()
    expect(completeHeader).toBeDefined()
    expect(completeHeader?.parent).toBeDefined()
    expect(completeHeader?.parent).toBe(genesisHash)
    expect(completeHeader?.sealSig).toBeDefined()
    expect(completeHeader?.vrfSig).toBeDefined()

    if (!completeHeader) {
      throw new Error('Failed to construct header')
    }

    // Update clock to the new slot
    clockService.setLatestReportedBlockTimeslot(completeHeader.timeslot - 1n)

    // Validate pre-state root (same as block-importer-service.ts line 212)
    validatePreStateRoot(completeHeader, stateService)

    // Validate using the same helper as block-importer-service.ts
    const [validateError] = await validateBlockHeader(
      completeHeader,
      clockService,
      configService,
      stateService,
      recentHistoryService,
      validatorSetManagerService,
      sealKeyService,
      entropyService,
    )

    // Validate extrinsic hash matches the block body (same as block-importer-service.ts lines 419-428)
    const [extrinsicHashError, computedExtrinsicHash] = calculateExtrinsicHash(
      blockBody,
      configService,
    )
    expect(extrinsicHashError).toBeNull()
    expect(computedExtrinsicHash).toBeDefined()
    expect(computedExtrinsicHash).toBe(completeHeader.extrinsicHash)

    // Header validation should pass since constructHeader now generates proper signatures
    expect(validateError).toBeNull()
  })
})
