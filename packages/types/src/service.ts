/**
 * Service Interface and Registry
 *
 * Defines a standardized interface for all services in the JAM node
 * Provides a registry for polymorphic service management
 */

import { type Safe, type SafePromise, safeResult } from './safe'

/**
 * Standard service interface that all services must implement
 */
export interface Service {
  /** Service name for identification */
  readonly name: string
  /** Whether the service is initialized */
  initialized: boolean
  /** Whether the service is running */
  running: boolean

  /** Initialize the service (setup, configuration, etc.) */
  init(): Safe<boolean> | SafePromise<boolean>

  /** Start the service (begin operation) */
  start(): Safe<boolean> | SafePromise<boolean>

  /** Stop the service (clean shutdown) */
  stop(): Safe<boolean> | SafePromise<boolean>
}

/**
 * Base service class that provides common functionality
 */
export abstract class BaseService implements Service {
  initialized = false
  running = false
  constructor(public readonly name: string) {}

  init(): Safe<boolean> | SafePromise<boolean> {
    this.initialized = true
    return safeResult(true)
  }
  start(): Safe<boolean> | SafePromise<boolean> {
    this.running = true
    return safeResult(true)
  }
  stop(): Safe<boolean> | SafePromise<boolean> {
    this.running = false
    return safeResult(true)
  }

  protected setInitialized(value: boolean): void {
    this.initialized = value
  }

  protected setRunning(value: boolean): void {
    this.running = value
  }
}
