/**
 * Service Factory
 *
 * Shared factory functions for creating node services.
 * Used by MainService, fuzzer-target, tests, and RPC server.
 *
 * This provides a centralized way to create services with optional networking.
 */

import path from 'node:path'
import {
  IETFVRFVerifier,
  IETFVRFVerifierW3F,
  IETFVRFVerifierWasm,
  RingVRFProverW3F,
  RingVRFProverWasm,
  RingVRFVerifierW3F,
  RingVRFVerifierWasm,
} from '@pbnjam/bandersnatch-vrf'
import { bytesToHex, EventBusService, type Hex, logger } from '@pbnjam/core'
import type {
  BlockRequestProtocol,
  CE131TicketDistributionProtocol,
  CE132TicketDistributionProtocol,
  CE134WorkPackageSharingProtocol,
  NetworkingProtocol,
  PreimageRequestProtocol,
  ShardDistributionProtocol,
  StateRequestProtocol,
  WorkReportRequestProtocol,
} from '@pbnjam/networking'
import {
  AccumulateHostFunctionRegistry,
  HostFunctionRegistry,
} from '@pbnjam/pvm'
import { AccumulatePVM, RefinePVM } from '@pbnjam/pvm-invocations'
import type { StreamKind, ValidatorPublicKeys } from '@pbnjam/types'
import { safeResult } from '@pbnjam/types'

import { AccumulationService } from './accumulation-service'
import { AssuranceService } from './assurance-service'
import { AuthPoolService } from './auth-pool-service'
import { AuthQueueService } from './auth-queue-service'
import { BlockImporterService } from './block-importer-service'
import { ClockService } from './clock-service'
import { ConfigService } from './config-service'

/** Config service size options */
export type ConfigServiceSizeType =
  | 'tiny'
  | 'small'
  | 'medium'
  | 'large'
  | 'xlarge'
  | '2xlarge'
  | '3xlarge'
  | 'full'

import { ChainManagerService } from './chain-manager-service'
import { DisputesService } from './disputes-service'
import { EntropyService } from './entropy'
import { ErasureCodingService } from './erasure-coding-service'
import { NodeGenesisManager } from './genesis-manager'
import { GuarantorService } from './guarantor-service'
import {
  KeyPairService,
  type ValidatorKeyServiceConfig,
} from './keypair-service'
import { MetricsCollector } from './metrics-collector'
import { NetworkingService } from './networking-service'
import { PrivilegesService } from './privileges-service'
import { ReadyService } from './ready-service'
import { RecentHistoryService } from './recent-history-service'
import { SealKeyService } from './seal-key'
import { ServiceAccountService } from './service-account-service'
import { ShardService } from './shard-service'
import { StateService } from './state-service'
import { StatisticsService } from './statistics-service'
import { TicketService } from './ticket-service'
import { ValidatorSetManager } from './validator-set'
import { WorkReportService } from './work-report-service'

// Workspace root (relative to service-factory.ts location)
const WORKSPACE_ROOT = path.join(__dirname, '../../../')

/**
 * Options for creating services
 */
export interface ServiceFactoryOptions {
  /** Config service size (tiny, medium, full) */
  configSize?: ConfigServiceSizeType
  /** SRS file path for Ring VRF (defaults to workspace path) */
  srsFilePath?: string
  /** Enable networking */
  enableNetworking?: boolean
  /** Networking configuration (required if enableNetworking is true) */
  networking?: {
    listenAddress: string
    listenPort: number
    nodeType: 'validator' | 'full' | 'builder'
    isBuilder?: boolean
  }
  /** Key pair configuration (optional for validators) */
  keyPair?: {
    customSeed?: Hex
    enableDevAccounts?: boolean
    devAccountCount?: number
  }
  /** Genesis configuration */
  genesis?: {
    chainSpecPath?: string
    genesisJsonPath?: string
    genesisHeaderPath?: string
  }
  /** Use WASM for PVM */
  useWasm?: boolean
  /** Use Rust (native) for PVM */
  useRust?: boolean
  /** Use worker pool for accumulation service */
  useWorkerPool?: boolean
  /** Use WASM for Ring VRF (true = RingVRFProverWasm/RingVRFVerifierWasm, false = W3F) */
  useRingVrfWasm?: boolean

  /** Use WASM for IETF VRF (true = IETFVRFVerifierWasm, false = IETFVRFVerifier) */
  useIetfVrfWasm?: boolean
  /** Use Rust (native) for IETF VRF (true = IETFVRFVerifierW3F, false = IETFVRFVerifier) */
  useIetfVrfW3F?: boolean
  /** Trace subfolder for debugging */
  traceSubfolder?: string
  /** Node ID for metrics (defaults to random) */
  nodeId?: string
  /** Initial validators for ValidatorSetManager */
  initialValidators?: ValidatorPublicKeys[]
  /** Validator index (optional, for getting connection endpoint from staging set) */
  validatorIndex?: number
  /** Networking protocols (optional, for advanced use) */
  protocols?: {
    ce131TicketDistributionProtocol?: CE131TicketDistributionProtocol | null
    ce132TicketDistributionProtocol?: CE132TicketDistributionProtocol | null
    ce134WorkPackageSharingProtocol?: CE134WorkPackageSharingProtocol | null
    ce136WorkReportRequestProtocol?: WorkReportRequestProtocol | null
    ce137ShardDistributionProtocol?: ShardDistributionProtocol | null
    ce143PreimageRequestProtocol?: PreimageRequestProtocol | null
  }
  /** Protocol registry for networking (optional, for advanced use) */
  protocolRegistry?: Map<StreamKind, NetworkingProtocol<unknown, unknown>>
  /** Block request protocol (optional, for advanced use) */
  blockRequestProtocol?: BlockRequestProtocol | null
  /** State request protocol (optional, for advanced use) */
  stateRequestProtocol?: StateRequestProtocol | null
}

/**
 * Service context containing all initialized services
 */
export interface ServiceContext {
  // Core services
  configService: ConfigService
  eventBusService: EventBusService
  clockService: ClockService
  entropyService: EntropyService

  // Consensus services
  ticketService: TicketService
  sealKeyService: SealKeyService
  validatorSetManager: ValidatorSetManager

  // Authorization services
  authQueueService: AuthQueueService
  authPoolService: AuthPoolService

  // State services
  disputesService: DisputesService
  readyService: ReadyService
  stateService: StateService

  // Work package services
  workReportService: WorkReportService
  guarantorService: GuarantorService
  assuranceService: AssuranceService

  // Accumulation services
  privilegesService: PrivilegesService
  serviceAccountService: ServiceAccountService
  statisticsService: StatisticsService
  accumulationService: AccumulationService
  recentHistoryService: RecentHistoryService

  // Block services
  blockImporterService: BlockImporterService
  chainManagerService: ChainManagerService
  genesisManagerService: NodeGenesisManager

  // Erasure coding services
  erasureCodingService: ErasureCodingService
  shardService: ShardService

  // Optional services (may be null depending on configuration)
  keyPairService: KeyPairService | null
  networkingService: NetworkingService | null
  metricsCollector: MetricsCollector | null

  // Ring VRF
  ringProver: RingVRFProverWasm | RingVRFProverW3F
  ringVerifier: RingVRFVerifierWasm | RingVRFVerifierW3F

  // Networking protocols (may be null)
  protocols: {
    ce131TicketDistributionProtocol: CE131TicketDistributionProtocol | null
    ce132TicketDistributionProtocol: CE132TicketDistributionProtocol | null
    ce134WorkPackageSharingProtocol: CE134WorkPackageSharingProtocol | null
    ce136WorkReportRequestProtocol: WorkReportRequestProtocol | null
    ce137ShardDistributionProtocol: ShardDistributionProtocol | null
    ce143PreimageRequestProtocol: PreimageRequestProtocol | null
  }

  // IETF VRF
  ietfVerifier: IETFVRFVerifier | IETFVRFVerifierWasm | IETFVRFVerifierW3F
}

/**
 * Get the default SRS file path
 */
export function getDefaultSrsFilePath(): string {
  return path.join(
    WORKSPACE_ROOT,
    'packages/bandersnatch-vrf/test-data/srs/zcash-srs-2-11-uncompressed.bin',
  )
}

/**
 * Initialize Ring VRF prover and verifier
 */
export async function initializeRingVrf(
  srsFilePath: string,
  timeoutMs = 30000,
): Promise<{ prover: RingVRFProverWasm; verifier: RingVRFVerifierWasm }> {
  logger.info('Loading SRS file...', { srsFilePath })

  // Check if file exists
  const fs = await import('node:fs/promises')
  try {
    await fs.access(srsFilePath)
  } catch {
    logger.error(`SRS file not found at ${srsFilePath}`)
    throw new Error(`SRS file not found: ${srsFilePath}`)
  }

  const prover = new RingVRFProverWasm(srsFilePath)
  const verifier = new RingVRFVerifierWasm(srsFilePath)

  // Initialize prover with timeout
  const initStartTime = Date.now()
  const proverPromise = prover.init()
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      const elapsed = Date.now() - initStartTime
      reject(new Error(`Ring prover initialization timeout after ${elapsed}ms`))
    }, timeoutMs)
  })
  await Promise.race([proverPromise, timeoutPromise])

  // Initialize verifier with timeout
  const verifierStartTime = Date.now()
  const verifierPromise = verifier.init()
  const verifierTimeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      const elapsed = Date.now() - verifierStartTime
      reject(
        new Error(`Ring verifier initialization timeout after ${elapsed}ms`),
      )
    }, timeoutMs)
  })
  await Promise.race([verifierPromise, verifierTimeoutPromise])

  logger.info('Ring VRF initialized successfully')

  return { prover, verifier }
}

/**
 * Create core services (all services, with optional networking)
 *
 * This is the main factory function that creates all services.
 * It can be used by:
 * - MainService (with networking enabled)
 * - Tests (without networking)
 * - RPC server (without networking, but with service access)
 * - Fuzzer target (without networking)
 */
export async function createCoreServices(
  options: ServiceFactoryOptions,
): Promise<ServiceContext> {
  const srsFilePath = options.srsFilePath ?? getDefaultSrsFilePath()
  const useRingVrfWasm = options.useRingVrfWasm ?? true

  let ringProver: RingVRFProverWasm | RingVRFProverW3F
  let ringVerifier: RingVRFVerifierWasm | RingVRFVerifierW3F
  let ietfVerifier: IETFVRFVerifier | IETFVRFVerifierWasm | IETFVRFVerifierW3F
  if (useRingVrfWasm) {
    const result = await initializeRingVrf(srsFilePath)
    ringProver = result.prover
    ringVerifier = result.verifier
  } else {
    logger.info('Loading Ring VRF W3F (Rust)...', { srsFilePath })
    const fs = await import('node:fs/promises')
    try {
      await fs.access(srsFilePath)
    } catch {
      logger.error(`SRS file not found at ${srsFilePath}`)
      throw new Error(`SRS file not found: ${srsFilePath}`)
    }
    ringProver = new RingVRFProverW3F(srsFilePath)
    ringVerifier = new RingVRFVerifierW3F(srsFilePath)
    await ringProver.init()
    await ringVerifier.init()
    logger.info('Ring VRF W3F initialized successfully')
  }

  if (options.useIetfVrfWasm) {
    ietfVerifier = new IETFVRFVerifierWasm()
  } else if (options.useIetfVrfW3F) {
    ietfVerifier = new IETFVRFVerifierW3F()
  } else {
    ietfVerifier = new IETFVRFVerifier()
  }

  const configService = new ConfigService(options.configSize ?? 'tiny')
  const eventBusService = new EventBusService()
  const clockService = new ClockService({
    configService,
    eventBusService,
  })

  const entropyService = new EntropyService(eventBusService)

  // Create KeyPairService if configuration is provided
  let keyPairService: KeyPairService | null = null
  if (options.keyPair || options.enableNetworking) {
    const keyPairConfig: ValidatorKeyServiceConfig = {
      customSeed:
        options.keyPair?.customSeed ??
        bytesToHex(crypto.getRandomValues(new Uint8Array(32))),
      enableDevAccounts: options.keyPair?.enableDevAccounts ?? true,
      devAccountCount: options.keyPair?.devAccountCount ?? 6,
    }
    keyPairService = new KeyPairService(keyPairConfig)
  }

  // Protocol placeholders (null unless networking is enabled)
  const protocols = {
    ce131TicketDistributionProtocol:
      options.protocols?.ce131TicketDistributionProtocol ?? null,
    ce132TicketDistributionProtocol:
      options.protocols?.ce132TicketDistributionProtocol ?? null,
    ce134WorkPackageSharingProtocol:
      options.protocols?.ce134WorkPackageSharingProtocol ?? null,
    ce136WorkReportRequestProtocol:
      options.protocols?.ce136WorkReportRequestProtocol ?? null,
    ce137ShardDistributionProtocol:
      options.protocols?.ce137ShardDistributionProtocol ?? null,
    ce143PreimageRequestProtocol:
      options.protocols?.ce143PreimageRequestProtocol ?? null,
  }

  // Create NetworkingService if enabled
  let networkingService: NetworkingService | null = null
  if (options.enableNetworking && keyPairService && options.networking) {
    // Create genesis manager to get chain hash
    const genesisManagerForChainHash = new NodeGenesisManager(
      configService,
      options.genesis ?? {},
    )
    const [chainHashError, chainHash] =
      genesisManagerForChainHash.getGenesisHeaderHash()
    if (chainHashError) {
      throw new Error('Failed to get chain hash for networking')
    }

    networkingService = new NetworkingService({
      configService,
      keyPairService,
      chainHash,
      protocolRegistry: options.protocolRegistry ?? new Map(),
      validatorIndex: options.validatorIndex,
      eventBusService,
    })
  }

  const ticketService = new TicketService({
    configService,
    eventBusService,
    keyPairService,
    entropyService,
    networkingService,
    ce131TicketDistributionProtocol: protocols.ce131TicketDistributionProtocol,
    ce132TicketDistributionProtocol: protocols.ce132TicketDistributionProtocol,
    clockService,
    prover: ringProver,
    ringVerifier,
    validatorSetManager: null, // Will be set later
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
    initialValidators: options.initialValidators ?? [],
  })

  // Wire up circular dependencies
  ticketService.setValidatorSetManager(validatorSetManager)
  sealKeyService.setValidatorSetManager(validatorSetManager)
  // TicketService epoch callbacks registered after SealKeyService so SealKeyService can use accumulator first (Gray Paper Eq. 202-207)
  const [ticketInitError] = ticketService.init()
  if (ticketInitError) {
    throw ticketInitError
  }
  if (networkingService) {
    networkingService.setValidatorSetManager(validatorSetManager)
  }

  const authQueueService = new AuthQueueService({ configService })

  const disputesService = new DisputesService({
    eventBusService,
    configService,
    validatorSetManagerService: validatorSetManager,
  })

  const readyService = new ReadyService({ configService })

  const workReportService = new WorkReportService({
    eventBus: eventBusService,
    networkingService,
    ce136WorkReportRequestProtocol: protocols.ce136WorkReportRequestProtocol,
    validatorSetManager,
    configService,
    entropyService,
    clockService,
  })

  const authPoolService = new AuthPoolService({
    configService,
    eventBusService,
    workReportService,
    authQueueService,
  })

  const privilegesService = new PrivilegesService({ configService })

  const serviceAccountService = new ServiceAccountService({
    eventBusService,
    clockService,
    networkingService,
    preimageRequestProtocol: protocols.ce143PreimageRequestProtocol,
  })

  const hostFunctionRegistry = new HostFunctionRegistry(
    serviceAccountService,
    configService,
  )
  const accumulateHostFunctionRegistry = new AccumulateHostFunctionRegistry(
    configService,
  )

  const accumulatePVM = new AccumulatePVM({
    hostFunctionRegistry,
    accumulateHostFunctionRegistry,
    configService,
    entropyService,
    pvmOptions: { gasCounter: BigInt(configService.maxBlockGas) },
    useWasm: options.useWasm ?? false,
    useRust: options.useRust ?? false,
    traceSubfolder: options.traceSubfolder,
  })

  // Create RefinePVM for work package processing
  const refinePVM = new RefinePVM({
    hostFunctionRegistry,
    accumulateHostFunctionRegistry,
    serviceAccountService,
    configService,
    useWasm: options.useWasm ?? false,
    traceSubfolder: options.traceSubfolder,
  })

  const statisticsService = new StatisticsService({
    eventBusService,
    configService,
    clockService,
  })

  const accumulationService = new AccumulationService({
    configService,
    serviceAccountsService: serviceAccountService,
    privilegesService,
    validatorSetManager,
    authQueueService,
    accumulatePVM,
    readyService,
    statisticsService,
    useWorkerPool: options.useWorkerPool ?? false,
    traceSubfolder: options.traceSubfolder,
    // When useWorkerPool, worker must receive main-process entropy so gas matches. Always pass when we have it.
    entropyService,
  })

  const recentHistoryService = new RecentHistoryService({
    eventBusService,
    configService,
    accumulationService,
  })

  // Create genesis manager
  const genesisManagerService = new NodeGenesisManager(
    configService,
    options.genesis ?? {},
  )

  // For non-networking mode without genesis files, override getState to return empty state
  if (!options.enableNetworking && !options.genesis?.chainSpecPath) {
    genesisManagerService.getState = () => {
      return safeResult({
        state_root:
          '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
        keyvals: [],
      })
    }
  }

  // Wire up clock service with validator set manager
  clockService.setValidatorSetManager(validatorSetManager)

  const stateService = new StateService({
    configService,
    genesisManagerService,
    validatorSetManager,
    entropyService,
    ticketService,
    authQueueService,
    authPoolService,
    statisticsService,
    disputesService,
    readyService,
    accumulationService,
    workReportService,
    privilegesService,
    serviceAccountsService: serviceAccountService,
    recentHistoryService,
    sealKeyService,
    clockService,
  })

  const assuranceService = new AssuranceService({
    configService,
    workReportService,
    validatorSetManager,
    eventBusService,
    sealKeyService,
    recentHistoryService,
  })

  // Erasure coding and shard services
  const erasureCodingService = new ErasureCodingService({
    configService,
  })

  const shardService = new ShardService({
    configService,
    erasureCodingService,
    eventBusService,
    networkingService,
    shardDistributionProtocol: protocols.ce137ShardDistributionProtocol,
  })

  const guarantorService = new GuarantorService({
    configService,
    clockService,
    entropyService,
    accumulationService,
    authPoolService,
    networkService: networkingService,
    ce134WorkPackageSharingProtocol: protocols.ce134WorkPackageSharingProtocol,
    keyPairService,
    workReportService,
    eventBusService,
    validatorSetManager,
    recentHistoryService,
    serviceAccountService,
    statisticsService,
    stateService,
    refinePVM,
    hostFunctionRegistry,
  })

  const blockImporterService = new BlockImporterService({
    configService,
    eventBusService,
    clockService,
    recentHistoryService,
    stateService,
    serviceAccountService,
    disputesService,
    validatorSetManagerService: validatorSetManager,
    entropyService,
    sealKeyService,
    assuranceService,
    guarantorService,
    ticketService,
    statisticsService,
    authPoolService,
    accumulationService,
    workReportService,
    ietfVerifier,
  })

  // ChainManagerService for fork handling and state snapshots
  // Chain manager always has block importer and coordinates imports
  // Get protocols from options or protocol registry
  const stateRequestProtocolFromRegistry = options.protocolRegistry?.get(129) as
    | StateRequestProtocol
    | undefined
  const blockRequestProtocolFromRegistry = options.protocolRegistry?.get(128) as
    | BlockRequestProtocol
    | undefined

  const stateRequestProtocol =
    options.stateRequestProtocol ?? stateRequestProtocolFromRegistry ?? null
  const blockRequestProtocol =
    options.blockRequestProtocol ?? blockRequestProtocolFromRegistry ?? null

  const chainManagerService = new ChainManagerService(
    configService,
    blockImporterService,
    stateService,
    accumulationService,
    sealKeyService,
    eventBusService,
    stateRequestProtocol,
    blockRequestProtocol,
    networkingService,
  )

  let metricsCollector: MetricsCollector | null = null
  if (options.nodeId) {
    metricsCollector = new MetricsCollector(options.nodeId)
  }

  return {
    configService,
    eventBusService,
    clockService,
    entropyService,
    ticketService,
    sealKeyService,
    validatorSetManager,
    authQueueService,
    authPoolService,
    disputesService,
    readyService,
    workReportService,
    privilegesService,
    serviceAccountService,
    statisticsService,
    accumulationService,
    recentHistoryService,
    stateService,
    assuranceService,
    guarantorService,
    blockImporterService,
    chainManagerService,
    genesisManagerService,
    erasureCodingService,
    shardService,
    keyPairService,
    networkingService,
    metricsCollector,
    ringProver,
    ringVerifier,
    ietfVerifier,
    protocols,
  }
}

/**
 * Start core services in the correct order
 */
export async function startCoreServices(
  context: ServiceContext,
): Promise<void> {
  logger.info('Starting entropy service...')
  const [entropyStartError] = await context.entropyService.start()
  if (entropyStartError) {
    throw entropyStartError
  }

  logger.info('Starting validator set manager...')
  const [validatorSetStartError] = await context.validatorSetManager.start()
  if (validatorSetStartError) {
    throw validatorSetStartError
  }

  logger.info('Starting recent history service...')
  context.recentHistoryService.start()

  logger.info('Starting block importer service...')
  const [startError] = await context.blockImporterService.start()
  if (startError) {
    throw startError
  }

  // Start optional services
  if (context.keyPairService) {
    logger.info('Starting key pair service...')
    const [keyPairStartError] = context.keyPairService.start()
    if (keyPairStartError) {
      throw keyPairStartError
    }
  }

  if (context.networkingService) {
    logger.info('Starting networking service...')
    const [networkingInitError] = await context.networkingService.init()
    if (networkingInitError) {
      throw networkingInitError
    }
    const [networkingStartError] = await context.networkingService.start()
    if (networkingStartError) {
      throw networkingStartError
    }
  }

  if (context.metricsCollector) {
    logger.info('Starting metrics collector...')
    const [metricsStartError] = context.metricsCollector.start()
    if (metricsStartError) {
      throw metricsStartError
    }
  }

  logger.info('Starting accumulation service...')
  const [accumulationStartError] = await context.accumulationService.start()
  if (accumulationStartError) {
    throw accumulationStartError
  }

  logger.info('Starting chain manager service...')
  const [chainManagerStartError] = await context.chainManagerService.start()
  if (chainManagerStartError) {
    throw chainManagerStartError
  }

  logger.info('All core services started successfully')
}

/**
 * Stop all services gracefully
 */
export async function stopCoreServices(context: ServiceContext): Promise<void> {
  logger.info('Stopping core services...')

  // Stop in reverse order of startup
  if (context.metricsCollector) {
    await context.metricsCollector.stop()
  }

  if (context.networkingService) {
    await context.networkingService.stop()
  }

  if (context.keyPairService) {
    context.keyPairService.stop()
  }

  await context.blockImporterService.stop()
  await context.accumulationService.stop()
  context.recentHistoryService.stop()
  await context.validatorSetManager.stop()
  await context.entropyService.stop()

  logger.info('All core services stopped')
}
