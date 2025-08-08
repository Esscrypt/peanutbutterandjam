/**
 * Main Service - Entry Point for JAM Node
 *
 * Serves as the main entry point and orchestrates all other services
 * Manages the service registry and provides the application lifecycle
 */

import { logger } from '@pbnj/core'
import { BaseService, ServiceRegistry } from './service-interface'
import type { MainService, Service } from './service-interface'
import { BlockAuthoringServiceImpl } from './block-authoring-service'
import { NetworkingService } from './networking-service'
import { MetricsCollector } from './metrics-collector'
import {
  BlockSubmitterService,
  ExtrinsicValidatorService,
  GenesisManagerService,
  HeaderConstructorService,
  StateManagerService,
  WorkPackageProcessorService,
} from './service-wrappers'
import type { BlockAuthoringConfig, GenesisConfig } from './types'

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
}

/**
 * Main service implementation
 */
export class MainServiceImpl extends BaseService implements MainService {
  private config: MainServiceConfig
  private registry: ServiceRegistry
  private blockAuthoringService!: BlockAuthoringServiceImpl
  private networkingService!: NetworkingService
  private metricsCollector!: MetricsCollector
  private blockSubmitterService!: BlockSubmitterService
  private extrinsicValidatorService!: ExtrinsicValidatorService
  private genesisManagerService!: GenesisManagerService
  private headerConstructorService!: HeaderConstructorService
  private stateManagerService!: StateManagerService
  private workPackageProcessorService!: WorkPackageProcessorService

  constructor(config: MainServiceConfig) {
    super('main-service')
    this.config = config
    this.registry = new ServiceRegistry()
    
    // Initialize all services
    this.initializeServices()
  }

  /**
   * Initialize all services
   */
  private initializeServices(): void {
    // Create services
    this.blockAuthoringService = new BlockAuthoringServiceImpl()
    this.metricsCollector = new MetricsCollector(this.config.nodeId)
    this.blockSubmitterService = new BlockSubmitterService()
    this.extrinsicValidatorService = new ExtrinsicValidatorService()
    this.genesisManagerService = new GenesisManagerService(this.config.genesis)
    this.headerConstructorService = new HeaderConstructorService()
    this.stateManagerService = new StateManagerService()
    this.workPackageProcessorService = new WorkPackageProcessorService()
    
    // Create networking service with dependencies
    this.networkingService = new NetworkingService({
      validatorIndex: this.config.networking.validatorIndex,
      nodeType: this.config.networking.nodeType as any,
      listenAddress: this.config.networking.listenAddress,
      listenPort: this.config.networking.listenPort,
      chainHash: this.config.networking.chainHash,
      isBuilder: this.config.networking.isBuilder,
      blockAuthoringService: this.blockAuthoringService,
    })

    // Register all services with the registry
    this.registry.register(this.metricsCollector)
    this.registry.register(this.stateManagerService)
    this.registry.register(this.workPackageProcessorService)
    this.registry.register(this.headerConstructorService)
    this.registry.register(this.extrinsicValidatorService)
    this.registry.register(this.genesisManagerService)
    this.registry.register(this.blockSubmitterService)
    this.registry.register(this.blockAuthoringService)
    this.registry.register(this.networkingService)
    
    // Register this service as the main service
    this.registry.registerMain(this)
  }

  /**
   * Initialize the main service
   */
  async init(): Promise<void> {
    try {
      logger.info('Initializing main service...')
      
      // Configure block authoring service
      this.blockAuthoringService.configure(this.config.blockAuthoring)
      
      // Initialize all services
      await this.registry.initAll()
      
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
      logger.info('Starting main service...')
      
      // Start all services
      const success = await this.registry.startAll()
      
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
      
      // Stop all services
      await this.registry.stopAll()
      
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
    return {
      ...baseStatus,
      details: {
        totalServices: this.registry.getAll().length,
        servicesStatus: this.registry.getAllStatus(),
        allServicesRunning: this.registry.areAllRunning(),
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