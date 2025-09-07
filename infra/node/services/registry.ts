import {
  logger,
  type Safe,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { Service, ServiceStatus } from '../interfaces/service'

/**
 * Service registry for managing all services
 */
export class ServiceRegistry {
  private services: Map<string, Service> = new Map()
  private mainService?: Service

  /**
   * Register a service with the registry
   */
  register(service: Service): Safe<void> {
    if (this.services.has(service.name)) {
      return safeError(
        new Error(`Service with name '${service.name}' is already registered`),
      )
    }

    this.services.set(service.name, service)
    logger.info('Service registered', { name: service.name })
    return safeResult(undefined)
  }

  /**
   * Register the main service (entry point)
   */
  registerMain(service: Service): Safe<void> {
    this.mainService = service
    this.register(service)
    return safeResult(undefined)
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
  getMain(): Service | undefined {
    return this.mainService
  }

  /**
   * Initialize all services
   */
  async initAll(): SafePromise<boolean> {
    const errors: Error[] = []
    for (const service of this.services.values()) {
      const [initError, _] = await service.init()
      if (initError) {
        errors.push(initError)
      }
      // try {
      //   logger.info('Initializing service', { name: service.name })
      //   await service.init()
      //   logger.info('Service initialized successfully', { name: service.name })
      // } catch (error) {
      //   logger.error('Failed to initialize service', {
      //     name: service.name,
      //     error: error instanceof Error ? error.message : String(error),
      //   })
      //   throw error
      // }
    }

    for (const error of errors) {
      logger.error('Error initializing service', {
        name: error.name,
        error: error.message,
      })
    }

    return safeResult(true)
  }

  /**
   * Start all services
   */
  async startAll(): SafePromise<boolean> {
    const errors: Error[] = []

    for (const service of this.services.values()) {
      const [successError, _] = await service.start()
      if (successError) {
        errors.push(successError)
      }
    }

    for (const error of errors) {
      logger.error('Error starting service', {
        name: error.name,
        error: error.message,
      })
    }

    return safeResult(true)
  }

  /**
   * Stop all services
   */
  async stopAll(): SafePromise<boolean> {
    const errors: Error[] = []

    for (const service of this.services.values()) {
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

    return safeResult(true)
  }

  /**
   * Get status of all services
   */
  getAllStatus(): ServiceStatus[] {
    return Array.from(this.services.values()).map((service) =>
      service.getStatus(),
    )
  }

  /**
   * Check if all services are running
   */
  areAllRunning(): boolean {
    return Array.from(this.services.values()).every((service) => {
      const status = service.getStatus()
      return status.running
    })
  }
}
