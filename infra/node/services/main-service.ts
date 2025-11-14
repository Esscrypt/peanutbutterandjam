/**
 * Main Service - Entry Point for JAM Node
 *
 * Serves as the main entry point and orchestrates all other services
 * Manages the service registry and provides the application lifecycle
 */
import { RingVRFProverWasm, RingVRFVerifierWasm } from '@pbnj/bandersnatch-vrf'
import { bytesToHex, EventBusService, type Hex, logger } from '@pbnj/core'
import {
  AuditAnnouncementProtocol,
  AuditShardRequestProtocol,
  BlockRequestProtocol,
  CE131TicketDistributionProtocol,
  CE132TicketDistributionProtocol,
  CE134WorkPackageSharingProtocol,
  type NetworkingProtocol,
  PreimageAnnouncementProtocol,
  PreimageRequestProtocol,
  SegmentShardRequestProtocol,
  ShardDistributionProtocol,
  StateRequestProtocol,
  WorkPackageSubmissionProtocol,
  WorkReportDistributionProtocol,
  WorkReportRequestProtocol,
} from '@pbnj/networking'
import {
  AccumulateHostFunctionRegistry,
  AccumulatePVM,
  HostFunctionRegistry,
} from '@pbnj/pvm'
// import { TelemetryClient } from '@pbnj/telemetry'
import type { NodeType, StreamKind, TelemetryConfig } from '@pbnj/types'
import {
  BaseService,
  PVM_CONSTANTS,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/types'
// import { WorkPackageProcessor } from './work-package-processor'
import { AccumulationService } from './accumulation-service'
import { AssuranceService } from './assurance-service'
import { AuthPoolService } from './auth-pool-service'
import { AuthQueueService } from './auth-queue-service'
import { BlockImporterService } from './block-importer-service'
// import { BlockAuthoringService } from './block-authoring'
import { ClockService } from './clock-service'
import { ConfigService } from './config-service'
import { DisputesService } from './disputes-service'
// import { ConnectionManagerService } from './connection-manager'
import { EntropyService } from './entropy'
import { ErasureCodingService } from './erasure-coding-service'
// import { ExtrinsicValidator } from './extrinsic-validator'
import { NodeGenesisManager } from './genesis-manager'
import { GuarantorService } from './guarantor-service'
import { HeaderConstructor } from './header-constructor'
import { KeyPairService } from './keypair-service'
import { MetricsCollector } from './metrics-collector'
import { NetworkingService } from './networking-service'
import { PrivilegesService } from './privileges-service'
import { ReadyService } from './ready-service'
import { RecentHistoryService } from './recent-history-service'
import { ServiceRegistry } from './registry'
// import { SafroleConsensusService } from './safrole-consensus-service'
import { SealKeyService } from './seal-key'
import { ServiceAccountService } from './service-account-service'
import { ShardService } from './shard-service'
import { StateService } from './state-service'
import { StatisticsService } from './statistics-service'
// import { TelemetryEventEmitterService } from './telemetry'
import { TicketService } from './ticket-service'
import { ValidatorSetManager } from './validator-set'
import { WorkReportService } from './work-report-service'
import path from 'node:path'
/**
 * Main service configuration
 */
export interface MainServiceConfig {
  /** Genesis configuration */
  genesis: {
    /** Path to chain-spec.json file */
    chainSpecPath: string
    genesisJsonPath?: string
    genesisHeaderPath?: string
  }
  /** Networking configuration */
  networking: {
    nodeType: NodeType
    listenAddress: string
    listenPort: bigint
    isBuilder?: boolean
  }
  /** Node ID for metrics */
  nodeId: string
  /** Telemetry configuration */
  telemetry: TelemetryConfig
}

/**
 * Main service implementation
 */
export class MainService extends BaseService {
  private config: MainServiceConfig
  private readonly registry: ServiceRegistry
  private readonly eventBusService: EventBusService
  // private blockAuthoringService: BlockAuthoringService
  private readonly networkingService: NetworkingService
  private readonly metricsCollector: MetricsCollector
  // private readonly extrinsicValidatorService: ExtrinsicValidator
  private readonly genesisManagerService: NodeGenesisManager
  private readonly headerConstructorService: HeaderConstructor
  private readonly statisticsService: StatisticsService
  private readonly recentHistoryService: RecentHistoryService
  private readonly disputesService: DisputesService
  private readonly authQueueService: AuthQueueService
  private readonly authPoolService: AuthPoolService
  private readonly guarantorService: GuarantorService
  private readonly readyService: ReadyService
  private readonly stateService: StateService
  private readonly blockImporterService: BlockImporterService
  // private readonly workPackageProcessorService: WorkPackageProcessor
  // private readonly telemetryService: TelemetryEventEmitterService
  private readonly keyPairService: KeyPairService
  // private safroleConsensusService: SafroleConsensusService
  // private connectionManagerService: ConnectionManagerService
  private readonly validatorSetManagerService: ValidatorSetManager
  private readonly clockService: ClockService
  private readonly sealKeyService: SealKeyService
  private readonly entropyService: EntropyService
  private readonly accumulateHostFunctionRegistry: AccumulateHostFunctionRegistry
  private readonly hostFunctionRegistry: HostFunctionRegistry
  private readonly accumulatePVM: AccumulatePVM

  private readonly ticketService: TicketService
  private readonly serviceAccountService: ServiceAccountService

  private ce131TicketDistributionProtocol: CE131TicketDistributionProtocol | null =
    null
  private ce132TicketDistributionProtocol: CE132TicketDistributionProtocol | null =
    null
  private ce134WorkPackageSharingProtocol: CE134WorkPackageSharingProtocol | null =
    null
  private ce136WorkReportRequestProtocol: WorkReportRequestProtocol | null =
    null
  private ce137ShardDistributionProtocol: ShardDistributionProtocol | null =
    null
  private ce143PreimageRequestProtocol: PreimageRequestProtocol | null = null

  private readonly ringProver: RingVRFProverWasm
  private readonly ringVerifier: RingVRFVerifierWasm
  private readonly protocolRegistry: Map<
    StreamKind,
    NetworkingProtocol<unknown, unknown>
  > = new Map()

  private readonly configService: ConfigService
  private readonly shardService: ShardService
  private readonly erasureCodingService: ErasureCodingService
  private readonly workReportService: WorkReportService
  private readonly assuranceService: AssuranceService
  private readonly accumulationService: AccumulationService
  private readonly privilegesService: PrivilegesService
  constructor(config: MainServiceConfig) {
    super('main-service')
    this.config = config

    this.configService = new ConfigService('tiny')

    this.registry = new ServiceRegistry()
    const srsFilePath = path.join(
      __dirname,
      '../../../packages/bandersnatch-vrf/test-data/srs/zcash-srs-2-11-compressed.bin',
    )
    this.ringProver = new RingVRFProverWasm(srsFilePath)
    this.ringVerifier = new RingVRFVerifierWasm(srsFilePath)
    
    this.initNetworkingProtocols()
    this.initProtocolRegistry()

    // Initialize event bus service first
    this.eventBusService = new EventBusService()

    this.clockService = new ClockService({
      eventBusService: this.eventBusService,
      configService: this.configService,
    })

    // Initialize entropy service
    this.entropyService = new EntropyService(this.eventBusService)

    this.keyPairService = new KeyPairService({
      customSeed:
        (process.env['VALIDATOR_SEED'] as Hex) ||
        bytesToHex(crypto.getRandomValues(new Uint8Array(32))),
      enableDevAccounts: true,
      devAccountCount: 6,
      connectionEndpoint: {
        host: this.config.networking.listenAddress,
        port: Number(this.config.networking.listenPort),
        publicKey: new Uint8Array(32), // Will be set after key generation
      },
    })

    // const telemetryClient = new TelemetryClient(this.config.telemetry)
    // this.telemetryService = new TelemetryEventEmitterService({
    //   client: telemetryClient,
    //   eventBusService: this.eventBusService,
    // })

    this.metricsCollector = new MetricsCollector(this.config.nodeId)

    // this.extrinsicValidatorService = new ExtrinsicValidator(
    //   'extrinsic-validator',
    // )

    this.genesisManagerService = new NodeGenesisManager(this.configService, {
      chainSpecPath: this.config.genesis.chainSpecPath,
      genesisJsonPath: this.config.genesis.genesisJsonPath,
      genesisHeaderPath: this.config.genesis.genesisHeaderPath,
    })

    const [chainHashError, chainHash] =
      this.genesisManagerService.getGenesisHeaderHash()
    if (chainHashError) {
      throw new Error('Failed to get chain hash')
    }

    // Initialize statistics service
    this.statisticsService = new StatisticsService({
      eventBusService: this.eventBusService,
      configService: this.configService,
      clockService: this.clockService,
    })

    this.networkingService = new NetworkingService({
      listenAddress: this.config.networking.listenAddress,
      listenPort: Number(this.config.networking.listenPort),
      keyPairService: this.keyPairService,
      chainHash: chainHash,
      protocolRegistry: this.protocolRegistry,
    })

    // this.workPackageProcessorService = new WorkPackageProcessor(
    //   'work-package-processor',
    // )

    this.ticketService = new TicketService({
      configService: this.configService,
      eventBusService: this.eventBusService,
      keyPairService: this.keyPairService,
      entropyService: this.entropyService,
      networkingService: this.networkingService,
      ce131TicketDistributionProtocol: this.ce131TicketDistributionProtocol!,
      ce132TicketDistributionProtocol: this.ce132TicketDistributionProtocol!,
      clockService: this.clockService,
      prover: this.ringProver,
      ringVerifier: this.ringVerifier,
      validatorSetManager: null, // will be set later
    })

    this.sealKeyService = new SealKeyService({
      eventBusService: this.eventBusService,
      entropyService: this.entropyService,
      ticketService: this.ticketService,
      configService: this.configService,
    })

    // const [initialValidatorsError, initialValidators] =
    //   this.genesisManagerService.getInitialValidatorsFromChainSpec()
    // if (initialValidatorsError) {
    //   throw new Error('Failed to get initial validators')
    // }

    this.validatorSetManagerService = new ValidatorSetManager({
      eventBusService: this.eventBusService,
      sealKeyService: this.sealKeyService,
      ringProver: this.ringProver,
      ticketService: this.ticketService,
      configService: this.configService,
      initialValidators: null,
    })
    // Register SealKeyService epoch transition callback AFTER ValidatorSetManager
    // This ensures ValidatorSetManager.handleEpochTransition runs first, updating activeSet'
    // before SealKeyService calculates the new seal key sequence
    this.sealKeyService.registerEpochTransitionCallback()
    this.sealKeyService.setValidatorSetManager(this.validatorSetManagerService)
    this.ticketService.setValidatorSetManager(this.validatorSetManagerService)
    this.networkingService.setValidatorSetManager(
      this.validatorSetManagerService,
    )

    this.serviceAccountService = new ServiceAccountService({
      configService: this.configService,
      eventBusService: this.eventBusService,
      clockService: this.clockService,
      networkingService: this.networkingService,
      preimageRequestProtocol: this.ce143PreimageRequestProtocol!,
    })

    this.readyService = new ReadyService({
      configService: this.configService,
    })
    this.authQueueService = new AuthQueueService({
      configService: this.configService,
    })
    this.accumulateHostFunctionRegistry = new AccumulateHostFunctionRegistry(
      this.configService,
    )
    this.hostFunctionRegistry = new HostFunctionRegistry(
      this.serviceAccountService,
      this.configService,
    )
    this.accumulatePVM = new AccumulatePVM({
      hostFunctionRegistry: this.hostFunctionRegistry,
      accumulateHostFunctionRegistry: this.accumulateHostFunctionRegistry,
      configService: this.configService,
      entropyService: this.entropyService,
      pvmOptions: { gasCounter: PVM_CONSTANTS.DEFAULT_GAS_LIMIT },
    })
    this.privilegesService = new PrivilegesService({
      configService: this.configService,
    })
    this.accumulationService = new AccumulationService({
      configService: this.configService,
      clockService: this.clockService,
      serviceAccountsService: this.serviceAccountService,
      privilegesService: this.privilegesService,
      validatorSetManager: this.validatorSetManagerService,
      authQueueService: this.authQueueService,
      accumulatePVM: this.accumulatePVM,
      readyService: this.readyService,
      statisticsService: this.statisticsService,
      // entropyService: this.entropyService,
    })

    // Initialize recent history service
    // Note: accumulationService is created later, so we'll update it after initialization
    this.recentHistoryService = new RecentHistoryService({
      eventBusService: this.eventBusService,
      configService: this.configService,
      accumulationService: this.accumulationService, // Will be set after accumulationService is created
    })

    this.disputesService = new DisputesService({
      eventBusService: this.eventBusService,
      validatorSetManagerService: this.validatorSetManagerService,
      configService: this.configService,
    })

    this.sealKeyService.setValidatorSetManager(this.validatorSetManagerService)
    this.clockService.setValidatorSetManager(this.validatorSetManagerService)

    this.headerConstructorService = new HeaderConstructor({
      keyPairService: this.keyPairService,
      validatorSetManagerService: this.validatorSetManagerService,
      genesisManagerService: this.genesisManagerService,
    })

    // this.connectionManagerService = new ConnectionManagerService({
    //   validatorSetManager: this.validatorSetManagerService,
    //   peerDiscoveryManager: this.peerDiscoveryManagerService,
    //   gridStructureManager: this.gridStructureManagerService,
    //   eventBusService: this.eventBusService,
    // })

    // this.safroleConsensusService = new SafroleConsensusService(
    //   {
    //     initialState: this.config.safroleConsensus.initialState,
    //   },
    //   this.eventBusService,
    //   this.keyPairService,
    //   this.sealKeyService,
    //   this.validatorSetManagerService,
    //   this.blockStore,
    // )

    // this.blockAuthoringService = new BlockAuthoringService({
    //   config: this.config.blockAuthoring,
    //   eventBusService: this.eventBusService,
    //   headerConstructor: this.headerConstructorService,
    //   workPackageProcessor: this.workPackageProcessorService,
    //   extrinsicValidator: this.extrinsicValidatorService,
    //   stateManager: this.stateManagerService,
    //   metricsCollector: this.metricsCollector,
    //   entropyService: this.entropyService,
    //   keyPairService: this.keyPairService,
    // sealKeyService: this.sealKeyService,
    // })

    // const networkingStore = new NetworkingStore(db)

    // Initialize shard service with config service
    // Shard size is fixed at 2 octet pairs (4 octets) per Gray Paper
    this.erasureCodingService = new ErasureCodingService({
      configService: this.configService,
    })
    this.shardService = new ShardService({
      configService: this.configService,
      erasureCodingService: this.erasureCodingService,
      eventBusService: this.eventBusService,
      networkingService: this.networkingService,
      shardDistributionProtocol: this.ce137ShardDistributionProtocol!,
    })

    this.workReportService = new WorkReportService({
      configService: this.configService,
      eventBus: this.eventBusService,
      networkingService: this.networkingService,
      ce136WorkReportRequestProtocol: this.ce136WorkReportRequestProtocol!,
      validatorSetManager: this.validatorSetManagerService,
      entropyService: this.entropyService,
      clockService: this.clockService,
    })

    this.assuranceService = new AssuranceService({
      configService: this.configService,
      workReportService: this.workReportService,
      validatorSetManager: this.validatorSetManagerService,
      eventBusService: this.eventBusService,
      sealKeyService: this.sealKeyService,
      recentHistoryService: this.recentHistoryService,
    })

    this.authPoolService = new AuthPoolService({
      configService: this.configService,
      workReportService: this.workReportService,
      eventBusService: this.eventBusService,
      authQueueService: this.authQueueService,
    })

    this.erasureCodingService = new ErasureCodingService({
      configService: this.configService,
    })
    this.shardService = new ShardService({
      networkingService: this.networkingService,
      shardDistributionProtocol: this.ce137ShardDistributionProtocol!,
      eventBusService: this.eventBusService,
      configService: this.configService,
      erasureCodingService: this.erasureCodingService,
    })

    this.guarantorService = new GuarantorService({
      eventBusService: this.eventBusService,
      configService: this.configService,
      clockService: this.clockService,
      entropyService: this.entropyService,
      authPoolService: this.authPoolService,
      networkService: this.networkingService,
      ce134WorkPackageSharingProtocol: this.ce134WorkPackageSharingProtocol,
      keyPairService: this.keyPairService,
      workReportService: this.workReportService,
      validatorSetManager: this.validatorSetManagerService,
      recentHistoryService: this.recentHistoryService,
      serviceAccountService: this.serviceAccountService,
      statisticsService: this.statisticsService,
      // erasureCodingService: this.erasureCodingService,
      // shardService: this.shardService,
      accumulationService: this.accumulationService,
    })

    this.stateService = new StateService({
      configService: this.configService,
      genesisManagerService: this.genesisManagerService,
      validatorSetManager: this.validatorSetManagerService,
      entropyService: this.entropyService,
      ticketService: this.ticketService,
      authQueueService: this.authQueueService,
      authPoolService: this.authPoolService,
      statisticsService: this.statisticsService,
      disputesService: this.disputesService,
      readyService: this.readyService,
      accumulationService: this.accumulationService,
      workReportService: this.workReportService,
      privilegesService: this.privilegesService,
      serviceAccountsService: this.serviceAccountService,
      recentHistoryService: this.recentHistoryService,
      sealKeyService: this.sealKeyService,
      clockService: this.clockService,
    })

    // Initialize block importer service
    this.blockImporterService = new BlockImporterService({
      eventBusService: this.eventBusService,
      clockService: this.clockService,
      recentHistoryService: this.recentHistoryService,
      stateService: this.stateService,
      configService: this.configService,
      validatorSetManagerService: this.validatorSetManagerService,
      entropyService: this.entropyService,
      sealKeyService: this.sealKeyService,
      assuranceService: this.assuranceService,
      guarantorService: this.guarantorService,
      disputesService: this.disputesService,
      serviceAccountService: this.serviceAccountService,
      ticketService: this.ticketService,
      statisticsService: this.statisticsService,
      authPoolService: this.authPoolService,
      accumulationService: this.accumulationService,
    })

    // Register created services with the registry
    this.registry.register(this.eventBusService)
    this.registry.register(this.entropyService)
    this.registry.register(this.clockService)
    this.registry.register(this.metricsCollector)
    this.registry.register(this.statisticsService)
    this.registry.register(this.recentHistoryService)
    this.registry.register(this.disputesService)
    this.registry.register(this.blockImporterService)
    // this.registry.register(this.workPackageProcessorService)
    this.registry.register(this.headerConstructorService)
    // this.registry.register(this.extrinsicValidatorService)
    this.registry.register(this.genesisManagerService)
    this.registry.register(this.sealKeyService)
    // this.registry.register(this.blockAuthoringService)
    this.registry.register(this.networkingService)
    // this.registry.register(this.telemetryService)
    this.registry.register(this.keyPairService)
    // this.registry.register(this.safroleConsensusService)
    this.registry.register(this.ticketService)
    this.registry.register(this.shardService)
    this.registry.register(this.workReportService)
    this.registry.register(this.assuranceService)
    this.registry.register(this.serviceAccountService)
    this.registry.register(this.authQueueService)
    this.registry.register(this.authPoolService)
    this.registry.register(this.guarantorService)
    this.registry.register(this.privilegesService)
    // Register this service as the main service
    this.registry.registerMain(this)
  }

  /**
   * Initialize the main service
   */
  async init(): SafePromise<boolean> {
    await this.ringProver.init()
    await this.ringVerifier.init()
    
    logger.info('Initializing main service...')

    // Block authoring service is already configured in constructor

    // Initialize all services except this main service (to avoid circular dependency)
    const [successError, _] = await this.registry.initAll()
    if (successError) {
      return safeError(successError)
    }

    this.setInitialized(true)
    logger.info('Main service initialized successfully')

    return safeResult(true)
  }

  /**
   * Start the main service
   */
  async start(): SafePromise<boolean> {
    super.start()
    if (this.running) {
      logger.debug('Main service already running')
      return safeResult(true)
    }

    logger.info('Starting main service...')

    // Start all services except this main service (to avoid circular dependency)
    const [successError, _] = await this.registry.startAll()
    if (successError) {
      return safeError(successError)
    }

    this.setRunning(true)
    logger.info('Main service started successfully')

    // Keep the process alive
    await this.keepAlive()

    return safeResult(true)
  }


  initNetworkingProtocols(): void {
    this.ce131TicketDistributionProtocol = new CE131TicketDistributionProtocol(
      this.eventBusService,
    )
    this.ce132TicketDistributionProtocol = new CE132TicketDistributionProtocol(
      this.eventBusService,
    )
    this.ce134WorkPackageSharingProtocol = new CE134WorkPackageSharingProtocol(
      this.eventBusService,
    )
    this.ce136WorkReportRequestProtocol = new WorkReportRequestProtocol(
      this.eventBusService,
    )
    this.ce137ShardDistributionProtocol = new ShardDistributionProtocol(
      this.eventBusService,
    )
    this.ce143PreimageRequestProtocol = new PreimageRequestProtocol(
      this.eventBusService,
    )
  }

  initProtocolRegistry(): void {
    // this.protocolRegistry.set(0, new BlockAnnouncementProtocol(options.blockStore))
    this.protocolRegistry.set(
      128,
      new BlockRequestProtocol(this.eventBusService, this.configService),
    )
    this.protocolRegistry.set(
      129,
      new StateRequestProtocol(this.eventBusService),
    )
    this.protocolRegistry.set(131, this.ce131TicketDistributionProtocol!)
    this.protocolRegistry.set(132, this.ce132TicketDistributionProtocol!)
    this.protocolRegistry.set(
      133,
      new WorkPackageSubmissionProtocol(this.eventBusService),
    )
    this.protocolRegistry.set(
      134,
      new CE134WorkPackageSharingProtocol(this.eventBusService),
    )
    this.protocolRegistry.set(
      135,
      new WorkReportDistributionProtocol(this.eventBusService),
    )
    this.protocolRegistry.set(136, this.ce136WorkReportRequestProtocol!)
    this.protocolRegistry.set(
      137,
      new ShardDistributionProtocol(this.eventBusService),
    )
    this.protocolRegistry.set(
      138,
      new AuditShardRequestProtocol(this.eventBusService),
    )
    this.protocolRegistry.set(
      139,
      new SegmentShardRequestProtocol(this.eventBusService),
    )
    this.protocolRegistry.set(
      140,
      new SegmentShardRequestProtocol(this.eventBusService),
    )
    // this.protocolRegistry.set(141, new AssuranceDistributionProtocol(blockStore))
    this.protocolRegistry.set(
      142,
      new PreimageAnnouncementProtocol(this.eventBusService),
    )
    this.protocolRegistry.set(143, this.ce143PreimageRequestProtocol!)
    this.protocolRegistry.set(
      144,
      new AuditAnnouncementProtocol(this.eventBusService),
    )
  }
  /**
   * Stop the main service
   */
  async stop(): SafePromise<boolean> {
    const [successError, _] = await this.registry.stopAll()
    if (successError) {
      return safeError(successError)
    }

    super.stop()
    return safeResult(true)
  }

  /**
   * Keep the service alive
   */
  private async keepAlive(): SafePromise<void> {
    return new Promise((resolve) => {
      // Set up signal handlers for graceful shutdown
      const shutdown = async (signal: string) => {
        logger.info(`Received ${signal}, shutting down gracefully...`)
        await this.stop()
        resolve(safeResult(undefined))
      }

      process.on('SIGINT', () => shutdown('SIGINT'))
      process.on('SIGTERM', () => shutdown('SIGTERM'))

      // Keep the process alive
      // In a real implementation, this might be replaced with actual work loops
      setInterval(() => {
        // Check if all services are still running
        if (!this.registry.getAll().every((service) => service.running)) {
          logger.error('Some services have stopped running')
          shutdown('service-failure')
        }
      }, 5000) // Check every 5 seconds
    })
  }
}
