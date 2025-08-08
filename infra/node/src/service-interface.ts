/**
 * Service Interface and Registry
 *
 * Defines a standardized interface for all services in the JAM node
 * Provides a registry for polymorphic service management
 */

import { logger } from '@pbnj/core'

/**
 * Standard service interface that all services must implement
 */
export interface Service {
  /** Service name for identification */
  readonly name: string
  
  /** Initialize the service (setup, configuration, etc.) */
  init(): Promise<void>
  
  /** Start the service (begin operation) */
  start(): Promise<boolean>
  
  /** Stop the service (clean shutdown) */
  stop(): Promise<void>
  
  /** Get service status */
  getStatus(): ServiceStatus
}

/**
 * Service status information
 */
export interface ServiceStatus {
  /** Service name */
  name: string
  /** Whether the service is initialized */
  initialized: boolean
  /** Whether the service is running */
  running: boolean
  /** Service-specific status details */
  details?: Record<string, unknown>
}

/**
 * Service registry for managing all services
 */
export class ServiceRegistry {
  private services: Map<string, Service> = new Map()
  private mainService?: MainService

  /**
   * Register a service with the registry
   */
  register(service: Service): void {
    if (this.services.has(service.name)) {
      throw new Error(`Service with name '${service.name}' is already registered`)
    }
    
    this.services.set(service.name, service)
    logger.info('Service registered', { name: service.name })
  }

  /**
   * Register the main service (entry point)
   */
  registerMain(service: MainService): void {
    this.mainService = service
    this.register(service)
  }

  /**
   * Get a service by name
   */
  get(name: string): Service | undefined {
    return this.services.get(name)
  }

  /**
   * Get all registered services
   */
  getAll(): Service[] {
    return Array.from(this.services.values())
  }

  /**
   * Get the main service
   */
  getMain(): MainService | undefined {
    return this.mainService
  }

  /**
   * Initialize all services
   */
  async initAll(): Promise<void> {
    logger.info('Initializing all services...')
    
    for (const service of this.services.values()) {
      try {
        logger.info('Initializing service', { name: service.name })
        await service.init()
        logger.info('Service initialized successfully', { name: service.name })
      } catch (error) {
        logger.error('Failed to initialize service', { 
          name: service.name, 
          error: error instanceof Error ? error.message : String(error) 
        })
        throw error
      }
    }
    
    logger.info('All services initialized successfully')
  }

  /**
   * Start all services
   */
  async startAll(): Promise<boolean> {
    logger.info('Starting all services...')
    
    const results: Array<{ name: string; success: boolean; error?: string }> = []
    
    for (const service of this.services.values()) {
      try {
        logger.info('Starting service', { name: service.name })
        const success = await service.start()
        results.push({ name: service.name, success })
        
        if (success) {
          logger.info('Service started successfully', { name: service.name })
        } else {
          logger.error('Service failed to start', { name: service.name })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Error starting service', { 
          name: service.name, 
          error: errorMessage 
        })
        results.push({ name: service.name, success: false, error: errorMessage })
      }
    }
    
    const allSuccessful = results.every(r => r.success)
    
    if (allSuccessful) {
      logger.info('All services started successfully')
    } else {
      logger.error('Some services failed to start', { results })
    }
    
    return allSuccessful
  }

  /**
   * Stop all services
   */
  async stopAll(): Promise<void> {
    logger.info('Stopping all services...')
    
    // Stop services in reverse order (dependencies first)
    const services = Array.from(this.services.values()).reverse()
    
    for (const service of services) {
      try {
        logger.info('Stopping service', { name: service.name })
        await service.stop()
        logger.info('Service stopped successfully', { name: service.name })
      } catch (error) {
        logger.error('Error stopping service', { 
          name: service.name, 
          error: error instanceof Error ? error.message : String(error) 
        })
      }
    }
    
    logger.info('All services stopped')
  }

  /**
   * Get status of all services
   */
  getAllStatus(): ServiceStatus[] {
    return Array.from(this.services.values()).map(service => service.getStatus())
  }

  /**
   * Check if all services are running
   */
  areAllRunning(): boolean {
    return Array.from(this.services.values()).every(service => {
      const status = service.getStatus()
      return status.running
    })
  }
}

/**
 * Main service interface that extends Service with entry point functionality
 */
export interface MainService extends Service {
  /** Entry point for the application */
  run(): Promise<void>
  
  /** Graceful shutdown */
  shutdown(): Promise<void>
}

/**
 * Base service class that provides common functionality
 */
export abstract class BaseService implements Service {
  protected initialized: boolean = false
  protected running: boolean = false

  constructor(public readonly name: string) {}

  abstract init(): Promise<void>
  abstract start(): Promise<boolean>
  abstract stop(): Promise<void>

  getStatus(): ServiceStatus {
    return {
      name: this.name,
      initialized: this.initialized,
      running: this.running,
    }
  }

  protected setInitialized(value: boolean): void {
    this.initialized = value
  }

  protected setRunning(value: boolean): void {
    this.running = value
  }
} 