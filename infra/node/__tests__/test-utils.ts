/**
 * Test Utilities
 *
 * Shared utility functions for test files
 */

import * as path from 'node:path'
import {
  RingVRFProverWasm,
  RingVRFVerifierWasm,
} from '@pbnjam/bandersnatch-vrf'
import {
  AccumulateHostFunctionRegistry,
  HostFunctionRegistry,
} from '@pbnjam/pvm'
import { AccumulatePVM } from '@pbnjam/pvm-invocations'
import { EventBusService, Hex, hexToBytes, logger } from '@pbnjam/core'
import { getTicketIdFromProof } from '@pbnjam/safrole'
import {
  DEFAULT_JAM_VERSION,
  type Block,
  type BlockBody,
  type BlockHeader,
  type JamVersion,
  safeResult,
  type ValidatorPublicKeys,
  type WorkReport,
} from '@pbnjam/types'
import { AccumulationService } from '../services/accumulation-service'
import { AssuranceService } from '../services/assurance-service'
import { AuthPoolService } from '../services/auth-pool-service'
import { AuthQueueService } from '../services/auth-queue-service'
import { BlockImporterService } from '../services/block-importer-service'
import { ClockService } from '../services/clock-service'
import { ConfigService } from '../services/config-service'
import { DisputesService } from '../services/disputes-service'
import { EntropyService } from '../services/entropy'
import { NodeGenesisManager } from '../services/genesis-manager'
import { GuarantorService } from '../services/guarantor-service'
import { PrivilegesService } from '../services/privileges-service'
import { ReadyService } from '../services/ready-service'
import { RecentHistoryService } from '../services/recent-history-service'
import { SealKeyService } from '../services/seal-key'
import { ServiceAccountService } from '../services/service-account-service'
import { StateService } from '../services/state-service'
import { StatisticsService } from '../services/statistics-service'
import { TicketService } from '../services/ticket-service'
import { ValidatorSetManager } from '../services/validator-set'
import { WorkReportService } from '../services/work-report-service'

// Workspace root (relative to test-utils.ts location)
const WORKSPACE_ROOT = path.join(__dirname, '../../../')

/**
 * Helper function to parse CLI arguments or environment variable for starting block
 * Usage: START_BLOCK=50 bun test ... OR bun test ... -- --start-block 50
 */
export function getStartBlock(): number {
  // Check environment variable first (most reliable with bun test)
  const envStartBlock = process.env.START_BLOCK
  if (envStartBlock) {
    const startBlock = Number.parseInt(envStartBlock, 10)
    if (!Number.isNaN(startBlock) && startBlock >= 1) {
      return startBlock
    }
  }
  
  // Fallback to CLI argument (requires -- separator with bun test)
  const args = process.argv.slice(2)
  const startBlockIndex = args.indexOf('--start-block')
  if (startBlockIndex !== -1 && startBlockIndex + 1 < args.length) {
    const startBlock = Number.parseInt(args[startBlockIndex + 1]!, 10)
    if (Number.isNaN(startBlock) || startBlock < 1) {
      throw new Error(`Invalid --start-block argument: ${args[startBlockIndex + 1]}. Must be a number >= 1`)
    }
    return startBlock
  }
  return 1 // Default to block 1 (genesis)
}

/**
 * Helper function to parse CLI arguments or environment variable for stopping block
 * Usage: STOP_BLOCK=50 bun test ... to stop after processing block 50
 */
export function getStopBlock(): number | undefined {
  // Check environment variable
  const envStopBlock = process.env.STOP_BLOCK
  if (envStopBlock) {
    const stopBlock = Number.parseInt(envStopBlock, 10)
    if (!Number.isNaN(stopBlock) && stopBlock >= 1) {
      return stopBlock
    }
  }
  return undefined // No stop block by default
}

/**
 * Helper function to parse JAM version from environment variable or string
 * Format: "0.7.0", "0.7.2", etc.
 */
export function parseJamVersion(versionStr?: string): JamVersion {
  if (!versionStr) {
    return DEFAULT_JAM_VERSION
  }
  
  const parts = versionStr.split('.').map(s => Number.parseInt(s, 10))
  if (parts.length !== 3 || parts.some(isNaN)) {
    console.warn(`⚠️  Invalid JAM version format: "${versionStr}", using default ${DEFAULT_JAM_VERSION.major}.${DEFAULT_JAM_VERSION.minor}.${DEFAULT_JAM_VERSION.patch}`)
    return DEFAULT_JAM_VERSION
  }
  
  return {
    major: parts[0]!,
    minor: parts[1]!,
    patch: parts[2]!,
  }
}

/**
 * Setup JAM version and trace subfolder from environment variables
 * Sets the JAM version on the config service and returns the trace subfolder path
 * @param configService - Config service to set JAM version on
 * @param baseTraceFolder - Base trace folder name (e.g., 'fuzzy', 'fuzzy_light')
 * @returns Object with jamVersion and traceSubfolder
 */
export function setupJamVersionAndTraceSubfolder(
  configService: ConfigService,
  baseTraceFolder: string,
): { jamVersion: JamVersion; traceSubfolder: string | undefined } {
  // Set JAM version from environment variable (GP_VERSION) or default to 0.7.2
  const gpVersion = process.env.GP_VERSION || process.env.JAM_VERSION
  const jamVersion = parseJamVersion(gpVersion)
  configService.jamVersion = jamVersion
  console.log(`📋 Using JAM version: ${jamVersion.major}.${jamVersion.minor}.${jamVersion.patch}${gpVersion ? ` (from ${process.env.GP_VERSION ? 'GP_VERSION' : 'JAM_VERSION'})` : ' (default)'}`)

  // Construct traces subfolder path with version
  // v0.7.1 has only 'fuzzy' directory and does NOT use 'traces/' subdirectory
  // v0.7.2+ has both 'fuzzy' and 'fuzzy_light' directories and uses 'traces/' subdirectory
  // This test uses 'fuzzy_light' for v0.7.2+ and 'fuzzy' for 0.7.1
  const versionString = `v${jamVersion.major}.${jamVersion.minor}.${jamVersion.patch}`
  const shouldDumpTraces = process.env.DUMP_TRACES === 'true'
  const traceSubfolder = shouldDumpTraces ? `${baseTraceFolder}/${versionString}` : undefined

  return { jamVersion, traceSubfolder }
}

/**
 * Helper function to convert JSON work report to WorkReport type
 */
export function convertJsonReportToWorkReport(jsonReport: any): WorkReport {
  return {
    ...jsonReport,
    core_index: BigInt(jsonReport.core_index || 0),
    auth_gas_used: BigInt(jsonReport.auth_gas_used || 0),
    context: {
      ...jsonReport.context,
      lookup_anchor_slot: BigInt(jsonReport.context.lookup_anchor_slot || 0),
    },
    results: jsonReport.results.map((r: any) => ({
      ...r,
      service_id: BigInt(r.service_id || 0),
      accumulate_gas: BigInt(r.accumulate_gas || 0),
      refine_load: {
        ...r.refine_load,
        gas_used: BigInt(r.refine_load.gas_used || 0),
        imports: BigInt(r.refine_load.imports || 0),
        extrinsic_count: BigInt(r.refine_load.extrinsic_count || 0),
        extrinsic_size: BigInt(r.refine_load.extrinsic_size || 0),
        exports: BigInt(r.refine_load.exports || 0),
      },
    })),
  }
}

/**
 * Helper function to convert JSON block to Block type
 */
export function convertJsonBlockToBlock(jsonBlock: any): Block {
  const jsonHeader = jsonBlock.header
  const jsonExtrinsic = jsonBlock.extrinsic

  const blockHeader: BlockHeader = {
    parent: jsonHeader.parent,
    priorStateRoot: jsonHeader.parent_state_root,
    extrinsicHash: jsonHeader.extrinsic_hash,
    timeslot: BigInt(jsonHeader.slot),
    epochMark: jsonHeader.epoch_mark
      ? {
          entropyAccumulator: jsonHeader.epoch_mark.entropy,
          entropy1: jsonHeader.epoch_mark.tickets_entropy,
          validators: jsonHeader.epoch_mark.validators.map((validator: any) => ({
            bandersnatch: validator.bandersnatch,
            ed25519: validator.ed25519,
          })),
        }
      : null,
    winnersMark: jsonHeader.tickets_mark
      ? jsonHeader.tickets_mark.map((ticket: any) => ({
          id: ticket.id,
          entryIndex: BigInt(ticket.attempt),
        }))
      : null,
    offendersMark: jsonHeader.offenders_mark || [],
    authorIndex: BigInt(jsonHeader.author_index),
    vrfSig: jsonHeader.entropy_source,
    sealSig: jsonHeader.seal,
  }

  const blockBody: BlockBody = {
    tickets: jsonExtrinsic.tickets.map((ticket: any) => ({
      entryIndex: BigInt(ticket.attempt),
      proof: ticket.signature as Hex,
      id: getTicketIdFromProof(hexToBytes(ticket.signature as Hex)),
    })),
    preimages: (jsonExtrinsic.preimages || []).map((preimage: any) => ({
      requester: BigInt(preimage.requester),
      blob: preimage.blob,
    })),
    guarantees: (jsonExtrinsic.guarantees || []).map((guarantee: any) => ({
      report: convertJsonReportToWorkReport(guarantee.report),
      slot: BigInt(guarantee.slot),
      signatures: guarantee.signatures,
    })),
    assurances: jsonExtrinsic.assurances || [],
    disputes: jsonExtrinsic.disputes
      ? [
          {
            verdicts: jsonExtrinsic.disputes.verdicts.map((verdict: any) => ({
              target: verdict.target,
              age: BigInt(verdict.age),
              votes: verdict.votes.map((vote: any) => ({
                vote: vote.vote,
                index: BigInt(vote.index),
                signature: vote.signature,
              })),
            })),
            culprits: jsonExtrinsic.disputes.culprits,
            faults: jsonExtrinsic.disputes.faults,
          },
        ]
      : [
          {
            verdicts: [],
            culprits: [],
            faults: [],
          },
        ],
  }

  return {
    header: blockHeader,
    body: blockBody,
  }
}

/**
 * Services context returned by initializeServices
 */
export interface FuzzerTargetServices {
  stateService: StateService
  blockImporterService: BlockImporterService
  recentHistoryService: RecentHistoryService
  configService: ConfigService
  validatorSetManager: ValidatorSetManager
}

/**
 * Initialize services for fuzzer target tests
 * This is the same implementation as in fuzzer-target.ts, but returns services instead of storing them in module variables
 * @param spec - Chain spec to use ('tiny' or 'full')
 * @param traceSubfolder - Optional trace subfolder for AccumulatePVM (e.g., 'fuzzy/v0.7.2', 'fuzzer-target')
 * @param genesisManager - Optional genesis manager (if not provided, creates a minimal one that returns empty state)
 * @param genesisManager - Optional genesis manager (if not provided, creates a minimal one that returns empty state)
 * @param initialValidators - Optional initial validators for ValidatorSetManager (defaults to empty array)
 */
export async function initializeServices(
  spec: 'tiny' | 'full' = 'tiny',
  traceSubfolder?: string,
  genesisManager?: NodeGenesisManager,
  initialValidators: ValidatorPublicKeys[] = [],
): Promise<FuzzerTargetServices> {
  let ringProver: RingVRFProverWasm
  let ringVerifier: RingVRFVerifierWasm

  const configService = new ConfigService(spec)

  try {
    logger.info('Loading SRS file...')
    const srsFilePath = path.join(
      WORKSPACE_ROOT,
      'packages/bandersnatch-vrf/test-data/srs/zcash-srs-2-11-uncompressed.bin',
    )
    logger.info(`SRS file path: ${srsFilePath}`)

    // Check if file exists
    const fs = await import('node:fs/promises')
    try {
      await fs.access(srsFilePath)
    } catch {
      logger.error(`SRS file not found at ${srsFilePath}`)
      throw new Error(`SRS file not found: ${srsFilePath}`)
    }

    ringProver = new RingVRFProverWasm(srsFilePath)
    ringVerifier = new RingVRFVerifierWasm(srsFilePath)

    try {
      // Add timeout to prevent hanging - WASM initialization can take time but shouldn't hang indefinitely
      const initStartTime = Date.now()
      const initPromise = ringProver.init()
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const elapsed = Date.now() - initStartTime
          reject(
            new Error(
              `Ring prover initialization timeout after ${elapsed}ms (30 second limit)`,
            ),
          )
        }, 30000)
      })
      await Promise.race([initPromise, timeoutPromise])
    } catch (initError) {
      logger.error('Failed to initialize ring prover:', initError)
      if (initError instanceof Error) {
        logger.error('Init error message:', initError.message)
        logger.error('Init error stack:', initError.stack)
      }
      throw initError
    }

    try {
      // Add timeout to prevent hanging
      const initStartTime = Date.now()
      const initPromise = ringVerifier.init()
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const elapsed = Date.now() - initStartTime
          reject(
            new Error(
              `Ring verifier initialization timeout after ${elapsed}ms (30 second limit)`,
            ),
          )
        }, 30000)
      })
      await Promise.race([initPromise, timeoutPromise])
    } catch (initError) {
      logger.error('Failed to initialize ring verifier:', initError)
      if (initError instanceof Error) {
        logger.error('Init error message:', initError.message)
        logger.error('Init error stack:', initError.stack)
      }
      throw initError
    }
  } catch (error) {
    logger.error('Failed to initialize Ring VRF:', error)
    if (error instanceof Error) {
      logger.error('Error message:', error.message)
      logger.error('Error stack:', error.stack)
    }
    throw error
  }

  try {
    const eventBusService = new EventBusService()
    const clockService = new ClockService({
      configService: configService,
      eventBusService: eventBusService,
    })
    const entropyService = new EntropyService(eventBusService)
    const ticketService = new TicketService({
      configService: configService,
      eventBusService: eventBusService,
      keyPairService: null,
      entropyService: entropyService,
      networkingService: null,
      ce131TicketDistributionProtocol: null,
      ce132TicketDistributionProtocol: null,
      clockService: clockService,
      prover: ringProver,
      ringVerifier: ringVerifier,
      validatorSetManager: null,
    })
    const sealKeyService = new SealKeyService({
      configService,
      eventBusService,
      entropyService,
      ticketService,
    })

    const validatorSetManager = new ValidatorSetManager({
      eventBusService,
      sealKeyService,
      ringProver,
      ticketService,
      configService,
      initialValidators: initialValidators,
    })

    ticketService.setValidatorSetManager(validatorSetManager)

    const authQueueService = new AuthQueueService({
      configService,
    })

    const disputesService = new DisputesService({
      eventBusService: eventBusService,
      configService: configService,
      validatorSetManagerService: validatorSetManager,
    })
    const readyService = new ReadyService({
      configService: configService,
    })

    const workReportService = new WorkReportService({
      eventBus: eventBusService,
      networkingService: null,
      ce136WorkReportRequestProtocol: null,
      validatorSetManager: validatorSetManager,
      configService: configService,
      entropyService: entropyService,
      clockService: clockService,
    })

    const authPoolService = new AuthPoolService({
      configService,
      eventBusService: eventBusService,
      workReportService: workReportService,
      authQueueService: authQueueService,
    })

    const privilegesService = new PrivilegesService({
      configService,
    })

    const serviceAccountsService = new ServiceAccountService({
      eventBusService,
      clockService,
      networkingService: null,
      preimageRequestProtocol: null,
    })

    const hostFunctionRegistry = new HostFunctionRegistry(
      serviceAccountsService,
      configService,
    )
    const accumulateHostFunctionRegistry = new AccumulateHostFunctionRegistry(
      configService,
    )
    const accumulatePVM = new AccumulatePVM({
      hostFunctionRegistry,
      accumulateHostFunctionRegistry,
      configService: configService,
      entropyService: entropyService,
      pvmOptions: { gasCounter: BigInt(configService.maxBlockGas) },
      useWasm: false,
      traceSubfolder: traceSubfolder,
    })

    const statisticsService = new StatisticsService({
      eventBusService: eventBusService,
      configService: configService,
      clockService: clockService,
    })

    const accumulatedService = new AccumulationService({
      configService: configService,
      clockService: clockService,
      serviceAccountsService: serviceAccountsService,
      privilegesService: privilegesService,
      validatorSetManager: validatorSetManager,
      authQueueService: authQueueService,
      accumulatePVM: accumulatePVM,
      readyService: readyService,
      statisticsService: statisticsService,
    })

    const recentHistoryService = new RecentHistoryService({
      eventBusService: eventBusService,
      configService: configService,
      accumulationService: accumulatedService,
    })
    recentHistoryService.start()

    // Use provided genesis manager or undefined (no genesis manager)
    // The state will be set via Initialize message or trace pre-state
    const stateService = new StateService({
      configService,
      genesisManagerService: genesisManager,
      validatorSetManager: validatorSetManager,
      entropyService: entropyService,
      ticketService: ticketService,
      authQueueService: authQueueService,
      authPoolService: authPoolService,
      statisticsService: statisticsService,
      disputesService: disputesService,
      readyService: readyService,
      accumulationService: accumulatedService,
      workReportService: workReportService,
      privilegesService: privilegesService,
      serviceAccountsService: serviceAccountsService,
      recentHistoryService: recentHistoryService,
      sealKeyService: sealKeyService,
      clockService: clockService,
    })

    const assuranceService = new AssuranceService({
      configService: configService,
      workReportService: workReportService,
      validatorSetManager: validatorSetManager,
      eventBusService: eventBusService,
      sealKeyService: sealKeyService,
      recentHistoryService: recentHistoryService,
    })

    const guarantorService = new GuarantorService({
      configService: configService,
      clockService: clockService,
      entropyService: entropyService,
      accumulationService: accumulatedService,
      authPoolService: authPoolService,
      networkService: null,
      ce134WorkPackageSharingProtocol: null,
      keyPairService: null,
      workReportService: workReportService,
      eventBusService: eventBusService,
      validatorSetManager: validatorSetManager,
      recentHistoryService: recentHistoryService,
      serviceAccountService: serviceAccountsService,
      statisticsService: statisticsService,
      stateService: stateService,
    })

    const blockImporterService = new BlockImporterService({
      configService: configService,
      eventBusService: eventBusService,
      clockService: clockService,
      recentHistoryService: recentHistoryService,
      stateService: stateService,
      serviceAccountService: serviceAccountsService,
      disputesService: disputesService,
      validatorSetManagerService: validatorSetManager,
      entropyService: entropyService,
      sealKeyService: sealKeyService,
      assuranceService: assuranceService,
      guarantorService: guarantorService,
      ticketService: ticketService,
      statisticsService: statisticsService,
      authPoolService: authPoolService,
      accumulationService: accumulatedService,
      workReportService: workReportService,
    })

    sealKeyService.setValidatorSetManager(validatorSetManager)

    logger.info('Starting entropy service...')
    const [entropyStartError] = await entropyService.start()
    if (entropyStartError) {
      logger.error('Failed to start entropy service:', entropyStartError)
      throw entropyStartError
    }

    logger.info('Starting validator set manager...')
    const [validatorSetStartError] = await validatorSetManager.start()
    if (validatorSetStartError) {
      logger.error(
        'Failed to start validator set manager:',
        validatorSetStartError,
      )
      throw validatorSetStartError
    }

    logger.info('Starting block importer service...')
    const [startError] = await blockImporterService.start()
    if (startError) {
      logger.error('Failed to start block importer service:', startError)
      throw startError
    }
    logger.info('All services started successfully')

    return {
      stateService,
      blockImporterService,
      recentHistoryService,
      configService,
      validatorSetManager,
    }
  } catch (error) {
    logger.error('Failed to start services:', error)
    throw error
  }
}

