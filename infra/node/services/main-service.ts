/**
 * Main Service - Entry Point for JAM Node
 *
 * Serves as the main entry point and orchestrates all other services
 * Manages the service registry and provides the application lifecycle
 */

import { logger, type SafePromise, safeError, safeResult } from '@pbnj/core'
// import { NetworkingStore } from '@pbnj/state'
import { TelemetryClient } from '@pbnj/telemetry'
import type {
  BlockAuthoringConfig,
  NodeType,
  TelemetryConfig,
} from '@pbnj/types'
// import { db } from '../db'
import type { Service } from '../interfaces/service'
import { BaseService } from '../interfaces/service'
import { BlockAuthoringService } from './block-authoring'
import { BlockSubmitter } from './block-submitter'
import { ExtrinsicValidator } from './extrinsic-validator'
import { NodeGenesisManager } from './genesis-manager'
import { HeaderConstructor } from './header-constructor'
import { MetricsCollector } from './metrics-collector'
import { NetworkingService } from './networking-service'
import { ServiceRegistry } from './registry'
import { StateManager } from './state-manager'
import { TelemetryService } from './telemetry-service'
import { WorkPackageProcessor } from './work-package-processor'
/**
 * Main service configuration
 */
export interface MainServiceConfig {
  /** Block authoring configuration */
  blockAuthoring: BlockAuthoringConfig
  /** Genesis configuration */
  genesis: {
    /** Path to chain-spec.json file */
    chainSpecPath: string
  }
  /** Networking configuration */
  networking: {
    validatorIndex: bigint
    nodeType: NodeType
    listenAddress: string
    listenPort: bigint
    chainHash: string
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
  private registry: ServiceRegistry
  private blockAuthoringService: BlockAuthoringService | null = null
  private networkingService: NetworkingService | null = null
  private metricsCollector: MetricsCollector | null = null
  private blockSubmitterService: BlockSubmitter | null = null
  private extrinsicValidatorService: ExtrinsicValidator | null = null
  private genesisManagerService: NodeGenesisManager | null = null
  private headerConstructorService: HeaderConstructor | null = null
  private stateManagerService: StateManager | null = null
  private workPackageProcessorService: WorkPackageProcessor | null = null
  private telemetryService: TelemetryService | null = null

  constructor(config: MainServiceConfig) {
    super('main-service')
    this.config = config
    this.registry = new ServiceRegistry()
    const telemetryClient = new TelemetryClient(this.config.telemetry)
    this.telemetryService = new TelemetryService(telemetryClient)

    this.metricsCollector = new MetricsCollector(this.config.nodeId)

    this.blockSubmitterService = new BlockSubmitter('block-submitter')

    this.extrinsicValidatorService = new ExtrinsicValidator(
      'extrinsic-validator',
    )

    this.genesisManagerService = new NodeGenesisManager({
      chainSpecPath: this.config.genesis.chainSpecPath,
    })

    this.headerConstructorService = new HeaderConstructor('header-constructor')

    this.stateManagerService = new StateManager('state-manager')

    this.workPackageProcessorService = new WorkPackageProcessor(
      'work-package-processor',
    )

    this.blockAuthoringService = new BlockAuthoringService(
      this.telemetryService,
      this.headerConstructorService,
      this.workPackageProcessorService,
      this.extrinsicValidatorService,
      this.stateManagerService,
      this.blockSubmitterService,
      this.metricsCollector,
    )

    // const networkingStore = new NetworkingStore(db)

    this.networkingService = new NetworkingService(
      {
        validatorIndex: this.config.networking.validatorIndex,
        nodeType: this.config.networking.nodeType,
        listenAddress: this.config.networking.listenAddress,
        listenPort: this.config.networking.listenPort,
        chainHash: this.config.networking.chainHash,
        isBuilder: this.config.networking.isBuilder,
        blockAuthoringService: this.blockAuthoringService || null,
      },
      // networkingStore,
      this.telemetryService,
    )

    // Register created services with the registry
    this.registry.register(this.metricsCollector)
    this.registry.register(this.stateManagerService)
    this.registry.register(this.workPackageProcessorService)
    this.registry.register(this.workPackageProcessorService)
    this.registry.register(this.headerConstructorService)
    this.registry.register(this.extrinsicValidatorService)
    this.registry.register(this.genesisManagerService)
    this.registry.register(this.blockSubmitterService)
    this.registry.register(this.blockAuthoringService)
    this.registry.register(this.networkingService)
    this.registry.register(this.telemetryService)

    // Register this service as the main service
    this.registry.registerMain(this)
  }

  /**
   * Initialize the main service
   */
  async init(): SafePromise<boolean> {
    logger.info('Initializing main service...')

    // Configure block authoring service if it exists
    if (this.blockAuthoringService) {
      this.blockAuthoringService.configure(this.config.blockAuthoring)
    }

    // Initialize all services except this main service (to avoid circular dependency)
    const allServices = this.registry.getAll()
    for (const service of allServices) {
      if (service !== this && !service.getStatus().initialized) {
        const [initError, _] = await service.init()
        if (initError) {
          return safeError(initError)
        }
      }
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
    const allServices = this.registry.getAll()
    let success = true
    for (const service of allServices) {
      if (service !== this && !service.getStatus().running) {
        const started = await service.start()
        if (!started) {
          success = false
          logger.error(`Failed to start service: ${service.constructor.name}`)
        }
      }
    }

    if (success) {
      this.setRunning(true)
      logger.info('Main service started successfully')
    } else {
      logger.error('Main service failed to start - some services failed')
    }

    // Keep the process alive
    await this.keepAlive()

    return safeResult(success)
  }
  /**
   * Stop the main service
   */
  async stop(): SafePromise<boolean> {
    logger.info('Stopping man service...')

    const errors: Error[] = []

    // Stop all services except this main service (to avoid circular dependency)
    const allServices = this.registry.getAll()
    for (const service of allServices.reverse()) {
      if (service !== this && service.getStatus().running) {
        const [stoppedError, _] = await service.stop()
        if (stoppedError) {
          errors.push(stoppedError)
        }
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
        if (!this.registry.areAllRunning()) {
          logger.error('Some services have stopped running')
          shutdown('service-failure')
        }
      }, 5000) // Check every 5 seconds
    })
  }

  /**
   * Get service status with additional details
   */
  getStatus() {
    const baseStatus = super.getStatus()

    // Get status of other services (excluding this main service to avoid circular reference)
    const otherServices = this.registry
      .getAll()
      .filter((service) => service !== this)
    const servicesStatus = otherServices.map((service) => service.getStatus())

    return {
      ...baseStatus,
      details: {
        totalServices: this.registry.getAll().length,
        servicesStatus,
        allServicesRunning: otherServices.every(
          (service) => service.getStatus().running,
        ),
      },
    }
  }

  /**
   * Get the service registry
   */
  getRegistry(): ServiceRegistry {
    return this.registry
  }

  /**
   * Get a specific service by name
   */
  getService<T extends Service>(name: string): T | undefined {
    return this.registry.get(name) as T | undefined
  }
}
