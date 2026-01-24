/**
 * Main Service - Entry Point for JAM Node
 *
 * Serves as the main entry point and orchestrates all other services
 * Manages the service registry and provides the application lifecycle
 */

import path from 'node:path'
import {
  RingVRFProverWasm,
  RingVRFVerifierWasm,
} from '@pbnjam/bandersnatch-vrf'
import {
  bytesToHex,
  EventBusService,
  getEd25519KeyPairWithFallback,
  type Hex,
  hexToBytes,
  logger,
} from '@pbnjam/core'
import {
  AuditAnnouncementProtocol,
  AuditShardRequestProtocol,
  BlockAnnouncementProtocol,
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
} from '@pbnjam/networking'
import {
  AccumulateHostFunctionRegistry,
  FetchHostFunction,
  HostFunctionRegistry,
} from '@pbnjam/pvm'
import { AccumulatePVM, RefinePVM } from '@pbnjam/pvm-invocations'
import { TelemetryClient } from '@pbnjam/telemetry'
import type {
  NodeInfo,
  NodeType,
  StreamKind,
  TelemetryConfig,
  ValidatorPublicKeys,
} from '@pbnjam/types'
import {
  BaseService,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnjam/types'
import { AccumulationService } from './accumulation-service'
import { AssuranceService } from './assurance-service'
import { AuthPoolService } from './auth-pool-service'
import { AuthQueueService } from './auth-queue-service'
import { BlockAuthoringService } from './block-authoring'
import { BlockImporterService } from './block-importer-service'
import { ChainManagerService } from './chain-manager-service'
import { ClockService } from './clock-service'
import { ConfigService } from './config-service'
import { DisputesService } from './disputes-service'
import { EntropyService } from './entropy'
import { ErasureCodingService } from './erasure-coding-service'
import { NodeGenesisManager } from './genesis-manager'
import { GuarantorService } from './guarantor-service'
import { KeyPairService } from './keypair-service'
import { MetricsCollector } from './metrics-collector'
import { NetworkingService } from './networking-service'
import { PrivilegesService } from './privileges-service'
import { ReadyService } from './ready-service'
import { RecentHistoryService } from './recent-history-service'
import { ServiceRegistry } from './registry'
import { SealKeyService } from './seal-key'
import { ServiceAccountService } from './service-account-service'
import { ShardService } from './shard-service'
import { StateService } from './state-service'
import { StatisticsService } from './statistics-service'
import { StatusEmitterService } from './status-emitter-service'
import { TelemetryEventEmitterService } from './telemetry'
import { TicketService } from './ticket-service'
import { ValidatorSetManager } from './validator-set'
import { WorkReportService } from './work-report-service'
/**
 * Main service configuration
 */
export interface MainServiceConfig {
  /** Genesis configuration */
  genesis: {
    /** Path to chain-spec.json file (optional) */
    chainSpecPath?: string
    genesisJsonPath?: string
    genesisHeaderPath?: string
  }
  /** Networking configuration */
  networking: {
    nodeType: NodeType
    isBuilder?: boolean
  }
  /** Node ID for metrics */
  nodeId: string
  /** Telemetry configuration (optional) */
  telemetry?: TelemetryConfig
  /** Validator index to use from chainspec (optional, uses dev account key generation) */
  validatorIndex?: number
}

/**
 * Main service implementation
 */
export class MainService extends BaseService {
  private config: MainServiceConfig
  private readonly registry: ServiceRegistry
  private readonly eventBusService: EventBusService
  private readonly blockAuthoringService: BlockAuthoringService
  private readonly networkingService: NetworkingService
  private readonly metricsCollector: MetricsCollector
  private readonly genesisManagerService: NodeGenesisManager
  private readonly statisticsService: StatisticsService
  private readonly recentHistoryService: RecentHistoryService
  private readonly disputesService: DisputesService
  private readonly authQueueService: AuthQueueService
  private readonly authPoolService: AuthPoolService
  private readonly guarantorService: GuarantorService
  private isStopping = false
  private readonly readyService: ReadyService
  private readonly stateService: StateService
  private readonly blockImporterService: BlockImporterService
  private readonly chainManagerService: ChainManagerService
  private telemetryService: TelemetryEventEmitterService | null = null
  private readonly keyPairService: KeyPairService
  private readonly validatorSetManagerService: ValidatorSetManager
  private readonly clockService: ClockService
  private readonly sealKeyService: SealKeyService
  private readonly entropyService: EntropyService
  private readonly accumulateHostFunctionRegistry: AccumulateHostFunctionRegistry
  private readonly hostFunctionRegistry: HostFunctionRegistry
  private readonly accumulatePVM: AccumulatePVM
  private readonly refinePVM: RefinePVM

  private readonly ticketService: TicketService
  private readonly serviceAccountService: ServiceAccountService
  private stateRequestProtocol: StateRequestProtocol | null = null
  private blockAnnouncementProtocol: BlockAnnouncementProtocol | null = null
  private blockRequestProtocol: BlockRequestProtocol | null = null
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

  /**
   * Get JAM parameters for telemetry using fetch host function (selector 0)
   * Returns encoded system constants as per Gray Paper specification
   */
  private getJamParameters(): Uint8Array {
    const fetchHostFunction = new FetchHostFunction(this.configService)
    // Reuse the existing fetch host function implementation
    return fetchHostFunction.getSystemConstants()
  }

  // ============================================================================
  // Service Getters for RPC Server
  // ============================================================================

  /**
   * Get the configuration service
   * Exposed for RPC server and other external access
   */
  getConfigService(): ConfigService {
    return this.configService
  }

  /**
   * Get the recent history service
   * Exposed for RPC server block queries
   */
  getRecentHistoryService(): RecentHistoryService {
    return this.recentHistoryService
  }

  /**
   * Get the statistics service
   * Exposed for RPC server statistics queries
   */
  getStatisticsService(): StatisticsService {
    return this.statisticsService
  }

  /**
   * Get the service account service
   * Exposed for RPC server service-related queries
   */
  getServiceAccountService(): ServiceAccountService {
    return this.serviceAccountService
  }

  /**
   * Get the guarantor service
   * Exposed for RPC server work package submission
   */
  getGuarantorService(): GuarantorService {
    return this.guarantorService
  }

  /**
   * Get the clock service
   * Exposed for RPC server time queries
   */
  getClockService(): ClockService {
    return this.clockService
  }

  /**
   * Get the event bus service
   * Exposed for RPC server event emission
   */
  getEventBusService(): EventBusService {
    return this.eventBusService
  }

  private readonly shardService: ShardService
  private readonly erasureCodingService: ErasureCodingService
  private readonly workReportService: WorkReportService
  private readonly assuranceService: AssuranceService
  private readonly accumulationService: AccumulationService
  private readonly privilegesService: PrivilegesService
  private statusEmitterService: StatusEmitterService | null = null
  constructor(config: MainServiceConfig) {
    super('main-service')
    this.config = config

    this.configService = new ConfigService('tiny', this.config.validatorIndex)

    this.registry = new ServiceRegistry()
    const srsFilePath = path.join(
      __dirname,
      '../../../packages/bandersnatch-vrf/test-data/srs/zcash-srs-2-11-compressed.bin',
    )
    this.ringProver = new RingVRFProverWasm(srsFilePath)
    this.ringVerifier = new RingVRFVerifierWasm(srsFilePath)

    // Initialize event bus service first (required by networking protocols)
    this.eventBusService = new EventBusService()

    this.initNetworkingProtocols()
    this.initProtocolRegistry()

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
    })

    // Telemetry client and service will be initialized in init() after nodeInfo is populated

    this.metricsCollector = new MetricsCollector(this.config.nodeId)

    this.genesisManagerService = new NodeGenesisManager(this.configService, {
      chainSpecPath: this.config.genesis.chainSpecPath,
      genesisJsonPath: this.config.genesis.genesisJsonPath,
      genesisHeaderPath: this.config.genesis.genesisHeaderPath,
    })

    // Get chain hash if genesis files are provided, otherwise use default zero hash
    let chainHash: Hex
    const [chainHashError, chainHashResult] =
      this.genesisManagerService.getGenesisHeaderHash()
    if (chainHashError) {
      // If no genesis files provided, use default zero hash
      if (
        !this.config.genesis.chainSpecPath &&
        !this.config.genesis.genesisJsonPath &&
        !this.config.genesis.genesisHeaderPath
      ) {
        chainHash =
          '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex
      } else {
        throw new Error(`Failed to get chain hash: ${chainHashError.message}`)
      }
    } else {
      chainHash = chainHashResult
    }

    // Initialize statistics service
    this.statisticsService = new StatisticsService({
      eventBusService: this.eventBusService,
      configService: this.configService,
      clockService: this.clockService,
    })

    this.networkingService = new NetworkingService({
      chainHash: chainHash,
      protocolRegistry: this.protocolRegistry,
      configService: this.configService,
      keyPairService: this.keyPairService,
      validatorIndex: this.config.validatorIndex,
      eventBusService: this.eventBusService,
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

    // Get initial validators from genesis (JIP-4 format: prefer full keys from genesis_state)
    // Try to get full validator keys (including metadata) from genesis_state first
    let initialValidators: ValidatorPublicKeys[] | null = null
    const [fullValidatorsError, fullValidators] =
      this.genesisManagerService.getInitialValidatorsFromChainSpec()
    if (!fullValidatorsError && fullValidators) {
      // Use full validator keys from genesis_state (includes metadata)
      initialValidators = fullValidators.map((v) => ({
        bandersnatch: v.bandersnatch,
        ed25519: v.ed25519,
        bls: `0x${'00'.repeat(144)}` as Hex, // 144 bytes for BLS
        metadata: `0x${'00'.repeat(128)}` as Hex, // 128 bytes for metadata,
      }))
    } else {
      // Fallback to epoch mark validators (only bandersnatch + ed25519, no metadata)
      const [validatorsError, validators] =
        this.genesisManagerService.getInitialValidatorsFromBlockHeader()
      if (!validatorsError && validators) {
        // Convert ValidatorKeyPair[] to ValidatorPublicKeys[] by adding zero BLS and metadata
        // JIP-4 format epoch mark only contains bandersnatch + ed25519, not BLS/metadata
        const zeroBLS = `0x${'00'.repeat(144)}` as Hex // 144 bytes for BLS
        const zeroMetadata = `0x${'00'.repeat(128)}` as Hex // 128 bytes for metadata

        initialValidators = validators.map((v) => ({
          bandersnatch: v.bandersnatch,
          ed25519: v.ed25519,
          bls: zeroBLS,
          metadata: zeroMetadata,
        }))
      }
    }

    this.validatorSetManagerService = new ValidatorSetManager({
      eventBusService: this.eventBusService,
      sealKeyService: this.sealKeyService,
      ringProver: this.ringProver,
      ticketService: this.ticketService,
      configService: this.configService,
      initialValidators,
    })
    // SealKeyService epoch transition callback is registered in constructor
    // ValidatorSetManager should be constructed before SealKeyService to ensure
    // its handleEpochTransition runs first (updating activeSet' before seal key calculation)
    this.sealKeyService.setValidatorSetManager(this.validatorSetManagerService)
    this.ticketService.setValidatorSetManager(this.validatorSetManagerService)
    this.networkingService.setValidatorSetManager(
      this.validatorSetManagerService,
    )

    this.serviceAccountService = new ServiceAccountService({
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
      pvmOptions: { gasCounter: BigInt(this.configService.maxBlockGas) },
      useWasm: false,
    })
    this.refinePVM = new RefinePVM({
      hostFunctionRegistry: this.hostFunctionRegistry,
      accumulateHostFunctionRegistry: this.accumulateHostFunctionRegistry,
      serviceAccountService: this.serviceAccountService,
      configService: this.configService,
      pvmOptions: { gasCounter: BigInt(this.configService.maxRefineGas) },
      useWasm: false,
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
      refinePVM: this.refinePVM,
      hostFunctionRegistry: this.hostFunctionRegistry,
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
      workReportService: this.workReportService,
    })

    // Initialize chain manager service for fork handling and state snapshots
    // Now that stateService and blockImporterService are created, we can wire them up properly
    // Protocols are already created in initNetworkingProtocols()
    this.chainManagerService = new ChainManagerService(
      this.configService,
      this.blockImporterService,
      this.stateService,
      this.accumulationService,
      this.sealKeyService,
      this.eventBusService,
      this.stateRequestProtocol, // Already created in initNetworkingProtocols()
      this.blockRequestProtocol, // Already created in initNetworkingProtocols()
      this.networkingService,
    )

    // Initialize block authoring service (after all dependencies are created)
    this.blockAuthoringService = new BlockAuthoringService({
      eventBusService: this.eventBusService,
      entropyService: this.entropyService,
      keyPairService: this.keyPairService,
      sealKeyService: this.sealKeyService,
      clockService: this.clockService,
      configService: this.configService,
      validatorSetManagerService: this.validatorSetManagerService,
      recentHistoryService: this.recentHistoryService,
      stateService: this.stateService,
      ticketService: this.ticketService,
      serviceAccountService: this.serviceAccountService,
      guarantorService: this.guarantorService,
      workReportService: this.workReportService,
      assuranceService: this.assuranceService,
      disputesService: this.disputesService,
      networkingService: this.networkingService,
      genesisManagerService: this.genesisManagerService,
      chainManagerService: this.chainManagerService,
      blockAnnouncementProtocol: this.blockAnnouncementProtocol,
      blockRequestProtocol: this.blockRequestProtocol,
    })

    // Register created services with the registry
    // Note: KeyPairService must be registered before NetworkingService
    // because NetworkingService.init() requires the key pair to be generated
    this.registry.register(this.eventBusService)
    this.registry.register(this.entropyService)
    this.registry.register(this.clockService)
    this.registry.register(this.metricsCollector)
    this.registry.register(this.statisticsService)
    this.registry.register(this.recentHistoryService)
    this.registry.register(this.disputesService)
    this.registry.register(this.blockImporterService)
    this.registry.register(this.genesisManagerService)
    this.registry.register(this.sealKeyService)
    this.registry.register(this.blockAuthoringService)
    this.registry.register(this.keyPairService)
    this.registry.register(this.networkingService)
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

    // Set genesis state in StateService before other services start
    // This ensures all services have access to the correct genesis state
    logger.debug('[MainService.init] Setting genesis state in StateService')
    const [genesisStateError, genesisState] =
      this.genesisManagerService.getState()
    if (genesisStateError) {
      logger.warn(
        `[MainService.init] Failed to get genesis state: ${genesisStateError.message}. Starting with empty state.`,
      )
      const [setStateError] = this.stateService.setState([])
      if (setStateError) {
        logger.error(
          `[MainService.init] Failed to set empty state: ${setStateError.message}`,
        )
      }
    } else {
      const [setStateError] = this.stateService.setState(genesisState.keyvals)
      if (setStateError) {
        logger.error(
          `[MainService.init] Failed to set genesis state: ${setStateError.message}`,
        )
        return safeError(
          new Error(
            `Failed to set genesis state in StateService: ${setStateError.message}`,
          ),
        )
      }
      logger.info(
        `[MainService.init] Successfully set genesis state with ${genesisState.keyvals.length} keyvals`,
      )
    }

    // Get connection endpoint from staging set if validatorIndex is set
    // Connection endpoints are parsed and set in ValidatorSetManager setters
    if (this.config.validatorIndex !== undefined) {
      const activeValidators =
        this.validatorSetManagerService.getActiveValidators()
      if (
        activeValidators.length > this.config.validatorIndex &&
        activeValidators[this.config.validatorIndex]?.connectionEndpoint
      ) {
        const endpoint =
          activeValidators[this.config.validatorIndex].connectionEndpoint!
        logger.info(
          `[MainService.init] Using connection endpoint from staging set validator ${this.config.validatorIndex}: ${endpoint.host}:${endpoint.port}`,
        )
        // Note: NetworkingService would need to support updating listen address/port
        // For now, we log the extracted endpoint
      } else {
        logger.debug(
          `[MainService.init] Validator ${this.config.validatorIndex} in staging set does not have connection endpoint. Using defaults.`,
        )
      }
    }

    // Populate telemetry nodeInfo with actual values if telemetry is enabled
    if (this.config.telemetry?.enabled) {
      // Get chain hash (genesis header hash)
      const [chainHashError, chainHashResult] =
        this.genesisManagerService.getGenesisHeaderHash()
      const genesisHeaderHash = chainHashError
        ? new Uint8Array(32) // Fallback to zero hash
        : hexToBytes(chainHashResult)

      // Get Ed25519 public key (peer ID) using helper function
      const [keyPairError, ed25519KeyPair] = getEd25519KeyPairWithFallback(
        this.configService,
        this.keyPairService,
      )
      const peerId = keyPairError
        ? new Uint8Array(32) // Fallback to zero
        : ed25519KeyPair.publicKey

      // Get JAM parameters using fetch host function (selector 0)
      const jamParameters = this.getJamParameters()

      // Parse peer address from telemetry endpoint (format: HOST:PORT)
      if (!this.config.telemetry.endpoint) {
        throw new Error(
          'Telemetry endpoint is required when telemetry is enabled',
        )
      }
      const [host, portStr] = this.config.telemetry.endpoint.split(':')
      const port = Number.parseInt(portStr, 10)
      if (!host || Number.isNaN(port)) {
        throw new Error(
          `Invalid telemetry endpoint format: ${this.config.telemetry.endpoint}. Expected HOST:PORT`,
        )
      }

      // Create nodeInfo with actual values
      const nodeInfo: NodeInfo = {
        protocolVersion: 0n,
        jamParameters: jamParameters,
        genesisHeaderHash: genesisHeaderHash,
        peerId: peerId,
        peerAddress: { host, port },
        nodeFlags: 0n,
        implementationName: 'PeanutButterAndJam',
        implementationVersion: '0.1.0',
        grayPaperVersion: '0.7.2',
        additionalInfo: 'PeanutButterAndJam node CLI implementation',
      }

      // Initialize telemetry client and service with nodeInfo
      const telemetryClient = new TelemetryClient(
        this.config.telemetry!,
        nodeInfo,
      )
      this.telemetryService = new TelemetryEventEmitterService({
        client: telemetryClient,
        eventBusService: this.eventBusService,
      })

      // Register telemetry service with registry so it gets started
      this.registry.register(this.telemetryService)

      // Initialize status emitter service (emits JIP-3 status events every ~2 seconds)
      this.statusEmitterService = new StatusEmitterService({
        configService: this.configService,
        networkingService: this.networkingService,
        shardService: this.shardService,
        serviceAccountService: this.serviceAccountService,
        telemetryService: this.telemetryService,
        validatorSetManager: this.validatorSetManagerService,
        workReportService: this.workReportService,
        eventBusService: this.eventBusService,
      })

      // Register status emitter service with registry so it gets started
      this.registry.register(this.statusEmitterService)

      logger.info(
        '[MainService.init] Telemetry nodeInfo populated and service registered',
        {
          hasJamParameters: jamParameters.length > 0,
          genesisHeaderHash: bytesToHex(genesisHeaderHash),
          peerId: bytesToHex(peerId),
          peerAddress: this.config.telemetry.endpoint,
        },
      )
    }

    this.setInitialized(true)
    logger.info('Main service initialized successfully')

    return safeResult(true)
  }

  /**
   * Start the main service
   */
  async start(): SafePromise<boolean> {
    if (this.running) {
      logger.debug('Main service already running')
      return safeResult(true)
    }

    super.start()
    logger.info('Starting main service...')

    // Start all services except this main service (to avoid circular dependency)
    const [successError, _] = await this.registry.startAll()
    if (successError) {
      return safeError(successError)
    }

    logger.info('Main service started successfully')

    return safeResult(true)
  }

  initNetworkingProtocols(): void {
    this.ce131TicketDistributionProtocol = new CE131TicketDistributionProtocol(
      this.eventBusService,
      this.configService,
    )
    this.ce132TicketDistributionProtocol = new CE132TicketDistributionProtocol(
      this.eventBusService,
      this.configService,
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
    this.blockAnnouncementProtocol = new BlockAnnouncementProtocol(
      this.configService,
      this.eventBusService,
    )
    this.blockRequestProtocol = new BlockRequestProtocol(
      this.eventBusService,
      this.configService,
      this.chainManagerService,
    )
    this.stateRequestProtocol = new StateRequestProtocol(this.eventBusService)
  }

  initProtocolRegistry(): void {
    this.protocolRegistry.set(0, this.blockAnnouncementProtocol!)
    this.protocolRegistry.set(128, this.blockRequestProtocol!)
    this.protocolRegistry.set(129, this.stateRequestProtocol!)

    // Note: Chain manager protocols and state service will be set after stateService is created
    // See the setProtocolsAndServices call after StateService initialization
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
    // Prevent re-entry to avoid infinite loop
    if (this.isStopping) {
      return safeResult(true)
    }
    this.isStopping = true

    // Stop all services except the main service (to avoid recursion)
    const errors: Error[] = []
    for (const service of this.registry.getAll()) {
      // Skip stopping ourselves to avoid recursion
      if (service === this) {
        continue
      }
      const [successError, _] = await service.stop()
      if (successError) {
        errors.push(successError)
      }
    }

    for (const error of errors) {
      logger.error('Error stopping service', {
        name: error.name,
        error: error.message,
      })
    }

    super.stop()
    return safeResult(true)
  }
}

// Main entry point when run directly
if (import.meta.main) {
  const main = async () => {
    try {
      // Helper function to parse argument (supports both --key=value and --key value formats)
      const parseArg = (key: string): string | undefined => {
        // Try --key=value format first
        const equalsFormat = process.argv
          .find((arg) => arg.startsWith(`${key}=`))
          ?.split('=')[1]
        if (equalsFormat) return equalsFormat

        // Try --key value format
        const keyIndex = process.argv.findIndex((arg) => arg === key)
        if (keyIndex !== -1 && keyIndex + 1 < process.argv.length) {
          return process.argv[keyIndex + 1]
        }

        return undefined
      }

      // Parse command-line arguments or use environment variables
      const chainSpecPath =
        process.env['CHAIN_SPEC_PATH'] || parseArg('--chain')
      const genesisJsonPathRaw =
        process.env['GENESIS_JSON_PATH'] || parseArg('--genesis')
      // Resolve relative paths relative to project root
      const genesisJsonPath = genesisJsonPathRaw
        ? path.isAbsolute(genesisJsonPathRaw)
          ? genesisJsonPathRaw
          : path.join(process.cwd(), genesisJsonPathRaw)
        : undefined
      // Parse validator index from environment or arguments
      const validatorIndexArg = parseArg('--validator-index')
      const validatorIndexEnv = process.env['VALIDATOR_INDEX']
      const validatorIndex = validatorIndexArg
        ? Number.parseInt(validatorIndexArg, 10)
        : validatorIndexEnv
          ? Number.parseInt(validatorIndexEnv, 10)
          : undefined

      // Parse telemetry endpoint from environment or arguments
      const telemetryEndpoint =
        process.env['TELEMETRY_ENDPOINT'] ||
        parseArg('--telemetry') ||
        'localhost:9000'

      // Connection endpoint will be extracted from validator metadata in init()
      // listenAddress and listenPort are no longer needed as they come from validators
      const nodeId = process.env['NODE_ID'] || 'jam-node-direct'

      logger.info('Starting JAM node directly...', {
        chainSpecPath,
        genesisJsonPath,
        nodeId,
        validatorIndex,
        telemetryEndpoint,
      })

      // Create MainService instance
      const mainService = new MainService({
        genesis: {
          ...(chainSpecPath && { chainSpecPath }),
          ...(genesisJsonPath && { genesisJsonPath }),
        },
        networking: {
          nodeType: 'validator',
          isBuilder: false,
        },
        nodeId,
        ...(validatorIndex !== undefined && { validatorIndex }),
        telemetry: {
          endpoint: telemetryEndpoint,
          enabled: true,
        },
      })

      // Initialize and start the service
      const [initError] = await mainService.init()
      if (initError) {
        logger.error('Failed to initialize main service:', initError)
        process.exit(1)
      }

      const [startError] = await mainService.start()
      if (startError) {
        logger.error('Failed to start main service:', startError)
        process.exit(1)
      }

      // Set up graceful shutdown handlers
      let isShuttingDown = false
      const gracefulShutdown = async (signal: string) => {
        if (isShuttingDown) {
          return
        }
        isShuttingDown = true
        logger.info(`Received ${signal}, shutting down gracefully...`)
        await mainService.stop()
        process.exit(0)
      }

      process.on('SIGINT', () => gracefulShutdown('SIGINT'))
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

      // Keep the process alive (non-blocking)
      // Use a minimal interval to keep the event loop alive
      // The QUIC server should also keep handles alive, but this ensures the process stays running
      setInterval(() => {
        // Empty interval - just keeps the event loop alive
      }, 1000)
    } catch (error) {
      logger.error(
        'Failed to start node:',
        error instanceof Error ? error.message : String(error),
      )
      if (error instanceof Error && error.stack) {
        logger.error('Stack trace:', error.stack)
      }
      process.exit(1)
    }
  }

  main().catch((error) => {
    logger.error('Unhandled error:', error)
    process.exit(1)
  })
}
