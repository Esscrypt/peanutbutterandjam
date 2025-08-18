/**
 * Main Service - Entry Point for JAM Node
 *
 * Serves as the main entry point and orchestrates all other services
 * Manages the service registry and provides the application lifecycle
 */

import { logger } from '@pbnj/core'
import type { BlockAuthoringConfig, GenesisConfig } from '@pbnj/types'
import { BlockAuthoringServiceImpl } from './block-authoring-service'
import { MetricsCollector } from './metrics-collector'
import { NetworkingService } from './networking-service'
import type { MainService, Service } from './service-interface'
import { BaseService, ServiceRegistry } from './service-interface'
import {
  BlockSubmitterService,
  ExtrinsicValidatorService,
  GenesisManagerService,
  HeaderConstructorService,
  StateManagerService,
  WorkPackageProcessorService,
} from './service-wrappers'

/**
 * Main service configuration
 */
export interface MainServiceConfig {
  /** Block authoring configuration */
  blockAuthoring: BlockAuthoringConfig
  /** Genesis configuration */
  genesis: GenesisConfig
  /** Networking configuration */
  networking: {
    validatorIndex: number
    nodeType: string
    listenAddress: string
    listenPort: number
    chainHash: string
    isBuilder?: boolean
  }
  /** Node ID for metrics */
  nodeId: string
  /** Service enablement configuration */
  services?: {
    /** Enable block authoring service */
    blockAuthoring?: boolean
    /** Enable networking service */
    networking?: boolean
    /** Enable metrics collection */
    metrics?: boolean
    /** Enable block submitter */
    blockSubmitter?: boolean
    /** Enable extrinsic validator */
    extrinsicValidator?: boolean
    /** Enable genesis manager */
    genesisManager?: boolean
    /** Enable header constructor */
    headerConstructor?: boolean
    /** Enable state manager */
    stateManager?: boolean
    /** Enable work package processor */
    workPackageProcessor?: boolean
  }
  /** Test mode configuration for development */
  testMode?: {
    /** Enable test message sending */
    enableTestMessages?: boolean
    /** Test message interval (ms) */
    testMessageInterval?: number
    /** Maximum test messages to send */
    maxTestMessages?: number
  }
}

/**
 * Main service implementation
 */
export class MainServiceImpl extends BaseService implements MainService {
  private config: MainServiceConfig
  private registry: ServiceRegistry
  private blockAuthoringService?: BlockAuthoringServiceImpl
  private networkingService?: NetworkingService
  private metricsCollector?: MetricsCollector
  private blockSubmitterService?: BlockSubmitterService
  private extrinsicValidatorService?: ExtrinsicValidatorService
  private genesisManagerService?: GenesisManagerService
  private headerConstructorService?: HeaderConstructorService
  private stateManagerService?: StateManagerService
  private workPackageProcessorService?: WorkPackageProcessorService

  constructor(config: MainServiceConfig) {
    super('main-service')
    this.config = config
    this.registry = new ServiceRegistry()

    // Initialize all services
    this.initializeServices()
  }

  /**
   * Initialize all services based on configuration
   */
  private initializeServices(): void {
    // Default to enabling all services if not specified
    const services = this.config.services || {
      blockAuthoring: true,
      networking: true,
      metrics: true,
      blockSubmitter: true,
      extrinsicValidator: true,
      genesisManager: true,
      headerConstructor: true,
      stateManager: true,
      workPackageProcessor: true,
    }

    logger.info('Initializing services based on configuration', { services })

    // Create services conditionally
    if (services.blockAuthoring) {
      this.blockAuthoringService = new BlockAuthoringServiceImpl()
      logger.debug('Block authoring service created')
    }

    if (services.metrics) {
      this.metricsCollector = new MetricsCollector(this.config.nodeId)
      logger.debug('Metrics collector created')
    }

    if (services.blockSubmitter) {
      this.blockSubmitterService = new BlockSubmitterService()
      logger.debug('Block submitter service created')
    }

    if (services.extrinsicValidator) {
      this.extrinsicValidatorService = new ExtrinsicValidatorService()
      logger.debug('Extrinsic validator service created')
    }

    if (services.genesisManager) {
      this.genesisManagerService = new GenesisManagerService(
        this.config.genesis,
      )
      logger.debug('Genesis manager service created')
    }

    if (services.headerConstructor) {
      this.headerConstructorService = new HeaderConstructorService()
      logger.debug('Header constructor service created')
    }

    if (services.stateManager) {
      this.stateManagerService = new StateManagerService()
      logger.debug('State manager service created')
    }

    if (services.workPackageProcessor) {
      this.workPackageProcessorService = new WorkPackageProcessorService()
      logger.debug('Work package processor service created')
    }

    // Create networking service with dependencies (if enabled)
    if (services.networking) {
      this.networkingService = new NetworkingService({
        validatorIndex: this.config.networking.validatorIndex,
        nodeType: this.config.networking.nodeType as any,
        listenAddress: this.config.networking.listenAddress,
        listenPort: this.config.networking.listenPort,
        chainHash: this.config.networking.chainHash,
        isBuilder: this.config.networking.isBuilder,
        blockAuthoringService: this.blockAuthoringService || null,
        testMode: this.config.testMode,
      })
      logger.debug('Networking service created')
    }

    // Register created services with the registry
    if (this.metricsCollector) this.registry.register(this.metricsCollector)
    if (this.stateManagerService)
      this.registry.register(this.stateManagerService)
    if (this.workPackageProcessorService)
      this.registry.register(this.workPackageProcessorService)
    if (this.headerConstructorService)
      this.registry.register(this.headerConstructorService)
    if (this.extrinsicValidatorService)
      this.registry.register(this.extrinsicValidatorService)
    if (this.genesisManagerService)
      this.registry.register(this.genesisManagerService)
    if (this.blockSubmitterService)
      this.registry.register(this.blockSubmitterService)
    if (this.blockAuthoringService)
      this.registry.register(this.blockAuthoringService)
    if (this.networkingService) this.registry.register(this.networkingService)

    // Register this service as the main service
    this.registry.registerMain(this)

    logger.info('Service initialization completed', {
      totalServices: this.registry.getAll().length,
      enabledServices: Object.entries(services)
        .filter(([_, enabled]) => enabled)
        .map(([name]) => name),
    })
  }

  /**
   * Initialize the main service
   */
  async init(): Promise<void> {
    try {
      if (this.initialized) {
        logger.debug('Main service already initialized')
        return
      }

      logger.info('Initializing main service...')

      // Configure block authoring service if it exists
      if (this.blockAuthoringService) {
        this.blockAuthoringService.configure(this.config.blockAuthoring)
      }

      // Initialize all services except this main service (to avoid circular dependency)
      const allServices = this.registry.getAll()
      for (const service of allServices) {
        if (service !== this && !service.getStatus().initialized) {
          await service.init()
        }
      }

      this.setInitialized(true)
      logger.info('Main service initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize main service', { error })
      throw error
    }
  }

  /**
   * Start the main service
   */
  async start(): Promise<boolean> {
    try {
      if (this.running) {
        logger.debug('Main service already running')
        return true
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

      return success
    } catch (error) {
      logger.error('Error starting main service', { error })
      return false
    }
  }

  /**
   * Stop the main service
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping main service...')

      // Stop all services except this main service (to avoid circular dependency)
      const allServices = this.registry.getAll()
      for (const service of allServices.reverse()) {
        if (service !== this && service.getStatus().running) {
          try {
            logger.info('Stopping service', { name: service.name })
            await service.stop()
            logger.info('Service stopped successfully', { name: service.name })
          } catch (error) {
            logger.error('Error stopping service', {
              name: service.name,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }
      }

      this.setRunning(false)
      logger.info('Main service stopped successfully')
    } catch (error) {
      logger.error('Error stopping main service', { error })
    }
  }

  /**
   * Main entry point for the application
   */
  async run(): Promise<void> {
    try {
      logger.info('Starting JAM node...')

      // Initialize and start the service
      await this.init()
      const started = await this.start()

      if (!started) {
        throw new Error('Failed to start main service')
      }

      logger.info('JAM node is running')

      // Keep the process alive
      // In a real implementation, this might involve event loops, timers, etc.
      await this.keepAlive()
    } catch (error) {
      logger.error('Error in main service run', { error })
      await this.shutdown()
      throw error
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down JAM node...')

      await this.stop()

      logger.info('JAM node shutdown complete')
    } catch (error) {
      logger.error('Error during shutdown', { error })
    }
  }

  /**
   * Keep the service alive
   */
  private async keepAlive(): Promise<void> {
    return new Promise((resolve) => {
      // Set up signal handlers for graceful shutdown
      const shutdown = async (signal: string) => {
        logger.info(`Received ${signal}, shutting down gracefully...`)
        await this.shutdown()
        resolve()
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
