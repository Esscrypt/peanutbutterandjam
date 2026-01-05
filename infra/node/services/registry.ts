import { logger } from '@pbnjam/core'
import type { Safe, SafePromise, Service } from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
/**
 * Service registry for managing all services
 */
export class ServiceRegistry {
  private services: Map<string, Service> = new Map()
  private mainService: Service | null = null

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
    return safeResult(undefined)
  }

  /**
   * Register the main service (entry point)
   */
  registerMain(service: Service): Safe<void> {
    this.mainService = service
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
  getMain(): Service | null {
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

    this.mainService?.start()

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

    await this.mainService?.stop()

    return safeResult(true)
  }
}
