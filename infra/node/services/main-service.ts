/**
 * Main Service - Entry Point for JAM Node
 *
 * Serves as the main entry point and orchestrates all other services
 * Manages the service registry and provides the application lifecycle
 */
import { RingVRFProver } from '@pbnj/bandersnatch-vrf'
import {
  bytesToHex,
  EventBusService,
  type Hex,
  logger,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/core'
import {
  AuditAnnouncementProtocol,
  BlockRequestProtocol,
  CE131TicketDistributionProtocol,
  CE132TicketDistributionProtocol,
  type NetworkingProtocol,
  PreimageAnnouncementProtocol,
  PreimageRequestProtocol,
  StateRequestProtocol,
  WorkPackageSubmissionProtocol,
  WorkReportDistributionProtocol,
  WorkReportRequestProtocol,
} from '@pbnj/networking'
import { BlockStore, PreimageStore, TicketStore, WorkStore } from '@pbnj/state'
import { TelemetryClient } from '@pbnj/telemetry'
import type { NodeType, StreamKind, TelemetryConfig } from '@pbnj/types'
import { BaseService } from '@pbnj/types'
import { db } from '../db'
import { BlockImporterService } from './block-importer-service'
// import { BlockAuthoringService } from './block-authoring'
import { ClockService } from './clock-service'
import { ConfigService } from './config-service'
import { DisputesService } from './disputes-service'
// import { ConnectionManagerService } from './connection-manager'
import { EntropyService } from './entropy'
// import { ExtrinsicValidator } from './extrinsic-validator'
import { NodeGenesisManager } from './genesis-manager'
import { HeaderConstructor } from './header-constructor'
import { KeyPairService } from './keypair-service'
import { MetricsCollector } from './metrics-collector'
import { NetworkingService } from './networking-service'
import { PreimageHolderService } from './preimage-holder-service'
import { RecentHistoryService } from './recent-history-service'
import { ServiceRegistry } from './registry'
// import { SafroleConsensusService } from './safrole-consensus-service'
import { SealKeyService } from './seal-key'
import { ShardService } from './shard-service'
import { StatisticsService } from './statistics-service'
import { TelemetryEventEmitterService } from './telemetry'
import { TicketDistributionService } from './ticket-distribution-service'
import { TicketHolderService } from './ticket-holder-service'
import { ValidatorSetManager } from './validator-set'
// import { WorkPackageProcessor } from './work-package-processor'
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
  private readonly blockImporterService: BlockImporterService
  // private readonly workPackageProcessorService: WorkPackageProcessor
  private readonly telemetryService: TelemetryEventEmitterService
  private readonly keyPairService: KeyPairService
  // private safroleConsensusService: SafroleConsensusService
  // private connectionManagerService: ConnectionManagerService
  private readonly validatorSetManagerService: ValidatorSetManager
  private readonly clockService: ClockService
  private readonly sealKeyService: SealKeyService
  private readonly entropyService: EntropyService

  private blockStore: BlockStore | null = null
  private workStore: WorkStore | null = null
  private preimageStore: PreimageStore | null = null
  private ticketStore: TicketStore | null = null

  private readonly ticketHolderService: TicketHolderService
  private readonly preimageHolderService: PreimageHolderService

  private ce131TicketDistributionProtocol: CE131TicketDistributionProtocol | null =
    null
  private ce132TicketDistributionProtocol: CE132TicketDistributionProtocol | null =
    null

  private readonly ringProver: RingVRFProver
  private readonly protocolRegistry: Map<
    StreamKind,
    NetworkingProtocol<unknown, unknown>
  > = new Map()

  private readonly ticketDistributionService: TicketDistributionService
  private readonly configService: ConfigService
  private readonly shardService: ShardService

  constructor(config: MainServiceConfig) {
    super('main-service')
    this.config = config

    this.configService = new ConfigService('tiny')

    this.registry = new ServiceRegistry()
    this.ringProver = new RingVRFProver()

    this.initStores()
    this.initNetworkingProtocols()
    this.initProtocolRegistry()

    // Initialize event bus service first
    this.eventBusService = new EventBusService()

    this.ticketHolderService = new TicketHolderService({
      configService: this.configService,
    })
    this.preimageHolderService = new PreimageHolderService(
      this.preimageStore!,
      this.configService,
    )
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

    const telemetryClient = new TelemetryClient(this.config.telemetry)
    this.telemetryService = new TelemetryEventEmitterService({
      client: telemetryClient,
      eventBusService: this.eventBusService,
    })

    this.metricsCollector = new MetricsCollector(this.config.nodeId)

    // this.extrinsicValidatorService = new ExtrinsicValidator(
    //   'extrinsic-validator',
    // )

    this.genesisManagerService = new NodeGenesisManager(
      this.configService,
      this.config.genesis.chainSpecPath,
      {
        genesisJsonPath: this.config.genesis.genesisJsonPath,
        genesisHeaderPath: this.config.genesis.genesisHeaderPath,
      },
    )

    // Initialize statistics service
    this.statisticsService = new StatisticsService(this.eventBusService)

    // Initialize recent history service
    this.recentHistoryService = new RecentHistoryService(
      this.eventBusService,
      this.configService,
    )

    this.clockService = new ClockService({
      eventBusService: this.eventBusService,
      configService: this.configService,
    })
    // this.workPackageProcessorService = new WorkPackageProcessor(
    //   'work-package-processor',
    // )

    this.sealKeyService = new SealKeyService(
      this.eventBusService,
      this.entropyService,
      this.ticketHolderService,
      this.configService,
    )

    // const [initialValidatorsError, initialValidators] =
    //   this.genesisManagerService.getInitialValidatorsFromChainSpec()
    // if (initialValidatorsError) {
    //   throw new Error('Failed to get initial validators')
    // }

    this.validatorSetManagerService = new ValidatorSetManager({
      eventBusService: this.eventBusService,
      sealKeyService: this.sealKeyService,
      ringProver: this.ringProver,
      ticketHolderService: this.ticketHolderService,
      keyPairService: this.keyPairService,
      configService: this.configService,
      // initialValidators: initialValidators
      //   .filter((v) => v.publicKey && v.ed25519)
      //   .map((v, i) => ({
      //     index: i,
      //     keys: {
      //       bandersnatch: v.publicKey!,
      //       ed25519: v.ed25519!,
      //     },
      //   })),
    })

    this.disputesService = new DisputesService(
      this.eventBusService,
      this.validatorSetManagerService,
    )

    this.sealKeyService.setValidatorSetManager(this.validatorSetManagerService)
    this.clockService.setValidatorSetManager(this.validatorSetManagerService)

    this.headerConstructorService = new HeaderConstructor({
      keyPairService: this.keyPairService,
      validatorSetManagerService: this.validatorSetManagerService,
      genesisManagerService: this.genesisManagerService,
    })

    const [chainHashError, chainHash] =
      this.genesisManagerService.getGenesisHeaderHash()
    if (chainHashError) {
      throw new Error('Failed to get chain hash')
    }

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

    this.networkingService = new NetworkingService({
      listenAddress: this.config.networking.listenAddress,
      listenPort: Number(this.config.networking.listenPort),
      validatorSetManagerService: this.validatorSetManagerService,
      keyPairService: this.keyPairService,
      chainHash: chainHash,
      protocolRegistry: this.protocolRegistry,
    })

    this.ticketDistributionService = new TicketDistributionService({
      eventBusService: this.eventBusService,
      validatorSetManager: this.validatorSetManagerService,
      networkingService: this.networkingService,
      ce131TicketDistributionProtocol: this.ce131TicketDistributionProtocol!,
      ticketHolderService: this.ticketHolderService,
      ce132TicketDistributionProtocol: this.ce132TicketDistributionProtocol!,
    })

    // Initialize shard service with config service
    // Shard size is fixed at 2 octet pairs (4 octets) per Gray Paper
    this.shardService = new ShardService(
      this.configService,
      this.eventBusService,
    )

    // Initialize block importer service
    this.blockImporterService = new BlockImporterService({
      eventBusService: this.eventBusService,
      clockService: this.clockService,
      recentHistoryService: this.recentHistoryService,
      configService: this.configService,
      validatorSetManagerService: this.validatorSetManagerService,
      entropyService: this.entropyService,
      sealKeyService: this.sealKeyService,
      blockStore: this.blockStore!,
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
    this.registry.register(this.telemetryService)
    this.registry.register(this.keyPairService)
    // this.registry.register(this.safroleConsensusService)
    this.registry.register(this.ticketHolderService)
    this.registry.register(this.ticketDistributionService)
    this.registry.register(this.shardService)
    // Register this service as the main service
    this.registry.registerMain(this)
  }

  /**
   * Initialize the main service
   */
  async init(): SafePromise<boolean> {
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

  initStores(): void {
    this.blockStore = new BlockStore(db, this.configService)
    this.workStore = new WorkStore(db)
    this.preimageStore = new PreimageStore(db)
    this.ticketStore = new TicketStore(db)
  }

  initNetworkingProtocols(): void {
    this.ce131TicketDistributionProtocol = new CE131TicketDistributionProtocol(
      this.ticketStore!,
      this.ticketHolderService,
      this.keyPairService,
      this.entropyService,
      this.validatorSetManagerService,
    )
    this.ce132TicketDistributionProtocol = new CE132TicketDistributionProtocol(
      this.ticketStore!,
      this.ticketHolderService,
    )
  }

  initProtocolRegistry(): void {
    // this.protocolRegistry.set(0, new BlockAnnouncementProtocol(options.blockStore))
    this.protocolRegistry.set(
      128,
      new BlockRequestProtocol(this.blockStore!, this.configService),
    )
    this.protocolRegistry.set(129, new StateRequestProtocol(this.blockStore!))
    this.protocolRegistry.set(131, this.ce131TicketDistributionProtocol!)
    this.protocolRegistry.set(132, this.ce132TicketDistributionProtocol!)
    this.protocolRegistry.set(
      133,
      new WorkPackageSubmissionProtocol(this.workStore!),
    )
    // this.protocolRegistry.set(
    //   134,
    //   new WorkPackageSharingProtocol(options.workStore),
    // )
    this.protocolRegistry.set(
      135,
      new WorkReportDistributionProtocol(this.workStore!),
    )
    this.protocolRegistry.set(
      136,
      new WorkReportRequestProtocol(this.workStore!),
    )
    // this.protocolRegistry.set(137, new ShardDistributionProtocol(options.workStore))
    // this.protocolRegistry.set(138, new AuditShardRequestProtocol(options.workStore))
    // this.protocolRegistry.set(139, new SegmentShardRequestNoJustificationProtocol(workStore))
    // this.protocolRegistry.set(140, new SegmentShardRequestWithJustificationProtocol(blockStore))
    // this.protocolRegistry.set(141, new AssuranceDistributionProtocol(blockStore))
    this.protocolRegistry.set(
      142,
      new PreimageAnnouncementProtocol(this.preimageHolderService),
    )
    this.protocolRegistry.set(
      143,
      new PreimageRequestProtocol(
        this.preimageHolderService,
        this.clockService,
      ),
    )
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
