/**
 * Test Utilities
 *
 * Shared utility functions for test files
 * Uses the service factory for consistent service initialization
 */

import { hexToBytes, type Hex, EventBusService } from '@pbnjam/core'
import { getTicketIdFromProof } from '@pbnjam/safrole'
import {
  AuditAnnouncementProtocol,
  AuditShardRequestProtocol,
  BlockAnnouncementProtocol,
  BlockRequestProtocol,
  CE131TicketDistributionProtocol,
  CE132TicketDistributionProtocol,
  CE134WorkPackageSharingProtocol,
  PreimageAnnouncementProtocol,
  PreimageRequestProtocol,
  SegmentShardRequestProtocol,
  ShardDistributionProtocol,
  StateRequestProtocol,
  WorkPackageSubmissionProtocol,
  WorkReportDistributionProtocol,
  WorkReportRequestProtocol,
  type NetworkingProtocol,
} from '@pbnjam/networking'
import {
  DEFAULT_JAM_VERSION,
  type Block,
  type BlockBody,
  type BlockHeader,
  type IChainManagerService,
  type IConfigService,
  type JamVersion,
  type StreamKind,
  type ValidatorPublicKeys,
  type WorkReport,
} from '@pbnjam/types'
import {
  createCoreServices,
  startCoreServices,
  type ServiceContext,
  type ConfigServiceSizeType,
} from '../services/service-factory'
import { NodeGenesisManager } from '../services/genesis-manager'
import type { ConfigService } from '../services/config-service'
import { NetworkingService } from '../services/networking-service'

/**
 * Helper function to parse CLI arguments or environment variable for starting block
 * Usage: START_BLOCK=50 bun test ... OR bun test ... -- --start-block 50
 */
export function getStartBlock(): number {
  // Check environment variable first (most reliable with bun test)
  const envStartBlock = process.env['START_BLOCK']
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
  const envStopBlock = process.env['STOP_BLOCK']
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
  const gpVersion = process.env['GP_VERSION'] || process.env['JAM_VERSION']
  const jamVersion = parseJamVersion(gpVersion)
  configService.jamVersion = jamVersion
  console.log(`📋 Using JAM version: ${jamVersion.major}.${jamVersion.minor}.${jamVersion.patch}${gpVersion ? ` (from ${process.env['GP_VERSION'] ? 'GP_VERSION' : 'JAM_VERSION'})` : ' (default)'}`)

  // Construct traces subfolder path with version
  // v0.7.1 has only 'fuzzy' directory and does NOT use 'traces/' subdirectory
  // v0.7.2+ has both 'fuzzy' and 'fuzzy_light' directories and uses 'traces/' subdirectory
  // This test uses 'fuzzy_light' for v0.7.2+ and 'fuzzy' for 0.7.1
  const versionString = `v${jamVersion.major}.${jamVersion.minor}.${jamVersion.patch}`
  const shouldDumpTraces = process.env['DUMP_TRACES'] === 'true'
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
 * Networking protocols created by createProtocols
 */
export interface NetworkingProtocols {
  ce131TicketDistributionProtocol: CE131TicketDistributionProtocol
  ce132TicketDistributionProtocol: CE132TicketDistributionProtocol
  ce134WorkPackageSharingProtocol: CE134WorkPackageSharingProtocol
  ce136WorkReportRequestProtocol: WorkReportRequestProtocol
  ce137ShardDistributionProtocol: ShardDistributionProtocol
  ce143PreimageRequestProtocol: PreimageRequestProtocol
  blockAnnouncementProtocol: BlockAnnouncementProtocol
  blockRequestProtocol: BlockRequestProtocol
  stateRequestProtocol: StateRequestProtocol
  auditAnnouncementProtocol: AuditAnnouncementProtocol
  protocolRegistry: Map<StreamKind, NetworkingProtocol<unknown, unknown>>
}

/**
 * Services context returned by initializeServices
 * This is a subset of ServiceContext for backward compatibility
 */
export interface FuzzerTargetServices {
  stateService: ServiceContext['stateService']
  blockImporterService: ServiceContext['blockImporterService']
  chainManagerService: ServiceContext['chainManagerService']
  recentHistoryService: ServiceContext['recentHistoryService']
  configService: ServiceContext['configService']
  validatorSetManager: ServiceContext['validatorSetManager']
  // Networking services (optional)
  networkingService?: NetworkingService | null
  protocols?: NetworkingProtocols
  // Full context for advanced use cases
  fullContext: ServiceContext
}

/**
 * Create networking protocols
 *
 * Creates all networking protocols used by the node.
 * Based on MainService.initNetworkingProtocols() and initProtocolRegistry()
 *
 * @param eventBusService - Event bus service for protocol events
 * @param configService - Config service for protocol configuration
 * @param chainManagerService - Chain manager service (optional, for block request protocol)
 * @returns Object containing all protocols and the protocol registry
 */
export function createProtocols(
  eventBusService: EventBusService,
  configService: IConfigService,
  chainManagerService?: IChainManagerService,
): NetworkingProtocols {
  const ce131TicketDistributionProtocol = new CE131TicketDistributionProtocol(
    eventBusService,
    configService,
  )
  const ce132TicketDistributionProtocol = new CE132TicketDistributionProtocol(
    eventBusService,
    configService,
  )
  const ce134WorkPackageSharingProtocol = new CE134WorkPackageSharingProtocol(
    eventBusService,
  )
  const ce136WorkReportRequestProtocol = new WorkReportRequestProtocol(
    eventBusService,
  )
  const ce137ShardDistributionProtocol = new ShardDistributionProtocol(
    eventBusService,
  )
  const ce143PreimageRequestProtocol = new PreimageRequestProtocol(
    eventBusService,
  )
  const blockAnnouncementProtocol = new BlockAnnouncementProtocol(
    configService,
    eventBusService,
  )
  const blockRequestProtocol = chainManagerService
    ? new BlockRequestProtocol(
        eventBusService,
        configService,
        chainManagerService,
      )
    : (null as unknown as BlockRequestProtocol) // Will be created later if needed
  const stateRequestProtocol = new StateRequestProtocol(eventBusService)
  const auditAnnouncementProtocol = new AuditAnnouncementProtocol(
    eventBusService,
  )

  // Create protocol registry
  const protocolRegistry = new Map<StreamKind, NetworkingProtocol<unknown, unknown>>()
  protocolRegistry.set(0, blockAnnouncementProtocol)
  if (blockRequestProtocol) {
    protocolRegistry.set(128, blockRequestProtocol)
  }
  protocolRegistry.set(129, stateRequestProtocol)
  protocolRegistry.set(131, ce131TicketDistributionProtocol)
  protocolRegistry.set(132, ce132TicketDistributionProtocol)
  protocolRegistry.set(
    133,
    new WorkPackageSubmissionProtocol(eventBusService),
  )
  protocolRegistry.set(134, ce134WorkPackageSharingProtocol)
  protocolRegistry.set(
    135,
    new WorkReportDistributionProtocol(eventBusService),
  )
  protocolRegistry.set(136, ce136WorkReportRequestProtocol)
  protocolRegistry.set(137, ce137ShardDistributionProtocol)
  protocolRegistry.set(138, new AuditShardRequestProtocol(eventBusService))
  protocolRegistry.set(139, new SegmentShardRequestProtocol(eventBusService))
  protocolRegistry.set(140, new SegmentShardRequestProtocol(eventBusService))
  protocolRegistry.set(
    142,
    new PreimageAnnouncementProtocol(eventBusService),
  )
  protocolRegistry.set(143, ce143PreimageRequestProtocol)
  protocolRegistry.set(144, auditAnnouncementProtocol)

  return {
    ce131TicketDistributionProtocol,
    ce132TicketDistributionProtocol,
    ce134WorkPackageSharingProtocol,
    ce136WorkReportRequestProtocol,
    ce137ShardDistributionProtocol,
    ce143PreimageRequestProtocol,
    blockAnnouncementProtocol,
    blockRequestProtocol,
    stateRequestProtocol,
    auditAnnouncementProtocol,
    protocolRegistry,
  }
}

/**
 * Initialize services for fuzzer target tests
 *
 * Uses the shared service factory for consistent service initialization.
 *
 * @param options - Configuration options
 * @param options.spec - Chain spec to use ('tiny' or 'full')
 * @param options.traceSubfolder - Optional trace subfolder for AccumulatePVM (e.g., 'fuzzy/v0.7.2', 'fuzzer-target')
 * @param options.genesisManager - Optional genesis manager (if not provided, uses empty state)
 * @param options.initialValidators - Optional initial validators for ValidatorSetManager (defaults to empty array)
 * @param options.useWasm - Whether to use WebAssembly PVM implementation (default: false)
 * @param options.enableNetworking - Whether to enable networking and protocols (default: false)
 * @param options.networking - Networking configuration (required if enableNetworking is true)
 */
export async function initializeServices(options?: {
  spec?: ConfigServiceSizeType
  traceSubfolder?: string
  genesisManager?: NodeGenesisManager
  initialValidators?: ValidatorPublicKeys[]
  useWasm?: boolean
  enableNetworking?: boolean
  networking?: {
    listenAddress: string
    listenPort: number
    nodeType: 'validator' | 'full' | 'builder'
    isBuilder?: boolean
  }
}): Promise<FuzzerTargetServices> {
  const {
    spec = 'tiny',
    traceSubfolder,
    genesisManager,
    initialValidators = [],
    useWasm = false,
    enableNetworking = false,
    networking,
  } = options || {}

  // Create services using the factory
  const context = await createCoreServices({
    configSize: spec,
    traceSubfolder,
    useWasm,
    initialValidators,
    enableNetworking,
    networking,
    // If a genesis manager is provided, we'll override it after creation
    genesis: genesisManager ? undefined : undefined,
  })

  // If a custom genesis manager is provided, use it in the state service
  // The factory creates its own, but we can override if needed
  if (genesisManager) {
    // Access the internal genesisManagerService and replace with provided one
    // Note: This is a workaround; ideally the factory would accept a genesis manager
    Object.assign(context, { genesisManagerService: genesisManager })
  }

  // Start the services
  await startCoreServices(context)

  // Create protocols and networking service if enabled
  let protocols: NetworkingProtocols | undefined
  if (enableNetworking && context.eventBusService && context.configService) {
    protocols = createProtocols(
      context.eventBusService,
      context.configService,
      context.chainManagerService,
    )

    // If networking service wasn't created by factory, create it now with protocols
    if (!context.networkingService && context.keyPairService && networking) {
      const genesisManagerForChainHash = genesisManager
        ? genesisManager
        : new NodeGenesisManager(context.configService, {})
      const [chainHashError, chainHash] =
        genesisManagerForChainHash.getGenesisHeaderHash()
      if (chainHashError) {
        throw new Error('Failed to get chain hash for networking')
      }

      context.networkingService = new NetworkingService({
        configService: context.configService,
        keyPairService: context.keyPairService,
        chainHash,
        protocolRegistry: protocols.protocolRegistry,
        validatorIndex: undefined,
        eventBusService: context.eventBusService,
      })
    }
  }

  return {
    stateService: context.stateService,
    blockImporterService: context.blockImporterService,
    chainManagerService: context.chainManagerService,
    recentHistoryService: context.recentHistoryService,
    configService: context.configService,
    validatorSetManager: context.validatorSetManager,
    networkingService: context.networkingService ?? null,
    protocols,
    fullContext: context,
  }
}
