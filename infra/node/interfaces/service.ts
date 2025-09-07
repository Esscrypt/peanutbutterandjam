/**
 * Service Interface and Registry
 *
 * Defines a standardized interface for all services in the JAM node
 * Provides a registry for polymorphic service management
 */

import { type SafePromise, safeResult } from '@pbnj/core'

/**
 * Standard service interface that all services must implement
 */
export interface Service {
  /** Service name for identification */
  readonly name: string

  /** Initialize the service (setup, configuration, etc.) */
  init(): SafePromise<boolean>

  /** Start the service (begin operation) */
  start(): SafePromise<boolean>

  /** Stop the service (clean shutdown) */
  stop(): SafePromise<boolean>

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
 * Main service interface that extends Service with entry point functionality
 */
// export interface MainService extends Service {
//   /** Entry point for the application */
//   run(): SafePromise<void>

//   /** Graceful shutdown */
//   shutdown(): SafePromise<void>
// }

/**
 * Base service class that provides common functionality
 */
export abstract class BaseService implements Service {
  protected initialized = false
  protected running = false

  constructor(public readonly name: string) {}

  async init(): SafePromise<boolean> {
    this.initialized = true
    return safeResult(true)
  }
  async start(): SafePromise<boolean> {
    this.running = true
    return safeResult(true)
  }
  async stop(): SafePromise<boolean> {
    this.running = false
    return safeResult(true)
  }

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
