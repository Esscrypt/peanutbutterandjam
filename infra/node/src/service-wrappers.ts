/**
 * Service Wrappers
 *
 * Wraps existing classes to implement the Service interface
 * Provides compatibility with the service registry
 */

import { logger } from '@pbnj/core'
import { BlockSubmitter } from './block-submitter'
import { ExtrinsicValidator } from './extrinsic-validator'
import { GenesisManager } from './genesis-manager'
import { HeaderConstructor } from './header-constructor'
import { BaseService } from './service-interface'
import { StateManager } from './state-manager'
import type { GenesisConfig } from './types'
import { WorkPackageProcessor } from './work-package-processor'

/**
 * Block Submitter Service Wrapper
 */
export class BlockSubmitterService extends BaseService {
  private blockSubmitter: BlockSubmitter

  constructor() {
    super('block-submitter')
    this.blockSubmitter = new BlockSubmitter()
  }

  async init(): Promise<void> {
    try {
      logger.info('Initializing block submitter service...')
      this.setInitialized(true)
      logger.info('Block submitter service initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize block submitter service', { error })
      throw error
    }
  }

  async start(): Promise<boolean> {
    try {
      logger.info('Starting block submitter service...')
      this.setRunning(true)
      logger.info('Block submitter service started successfully')
      return true
    } catch (error) {
      logger.error('Failed to start block submitter service', { error })
      return false
    }
  }

  async stop(): Promise<void> {
    try {
      logger.info('Stopping block submitter service...')
      this.setRunning(false)
      logger.info('Block submitter service stopped successfully')
    } catch (error) {
      logger.error('Error stopping block submitter service', { error })
    }
  }

  getBlockSubmitter(): BlockSubmitter {
    return this.blockSubmitter
  }
}

/**
 * Extrinsic Validator Service Wrapper
 */
export class ExtrinsicValidatorService extends BaseService {
  private extrinsicValidator: ExtrinsicValidator

  constructor() {
    super('extrinsic-validator')
    this.extrinsicValidator = new ExtrinsicValidator()
  }

  async init(): Promise<void> {
    try {
      logger.info('Initializing extrinsic validator service...')
      this.setInitialized(true)
      logger.info('Extrinsic validator service initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize extrinsic validator service', {
        error,
      })
      throw error
    }
  }

  async start(): Promise<boolean> {
    try {
      logger.info('Starting extrinsic validator service...')
      this.setRunning(true)
      logger.info('Extrinsic validator service started successfully')
      return true
    } catch (error) {
      logger.error('Failed to start extrinsic validator service', { error })
      return false
    }
  }

  async stop(): Promise<void> {
    try {
      logger.info('Stopping extrinsic validator service...')
      this.setRunning(false)
      logger.info('Extrinsic validator service stopped successfully')
    } catch (error) {
      logger.error('Error stopping extrinsic validator service', { error })
    }
  }

  getExtrinsicValidator(): ExtrinsicValidator {
    return this.extrinsicValidator
  }
}

/**
 * Genesis Manager Service Wrapper
 */
export class GenesisManagerService extends BaseService {
  private genesisManager: GenesisManager

  constructor(genesisConfig: GenesisConfig) {
    super('genesis-manager')
    this.genesisManager = new GenesisManager(genesisConfig)
  }

  async init(): Promise<void> {
    try {
      logger.info('Initializing genesis manager service...')
      this.setInitialized(true)
      logger.info('Genesis manager service initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize genesis manager service', { error })
      throw error
    }
  }

  async start(): Promise<boolean> {
    try {
      logger.info('Starting genesis manager service...')
      this.setRunning(true)
      logger.info('Genesis manager service started successfully')
      return true
    } catch (error) {
      logger.error('Failed to start genesis manager service', { error })
      return false
    }
  }

  async stop(): Promise<void> {
    try {
      logger.info('Stopping genesis manager service...')
      this.setRunning(false)
      logger.info('Genesis manager service stopped successfully')
    } catch (error) {
      logger.error('Error stopping genesis manager service', { error })
    }
  }

  getGenesisManager(): GenesisManager {
    return this.genesisManager
  }
}

/**
 * Header Constructor Service Wrapper
 */
export class HeaderConstructorService extends BaseService {
  private headerConstructor: HeaderConstructor

  constructor() {
    super('header-constructor')
    this.headerConstructor = new HeaderConstructor()
  }

  async init(): Promise<void> {
    try {
      logger.info('Initializing header constructor service...')
      this.setInitialized(true)
      logger.info('Header constructor service initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize header constructor service', { error })
      throw error
    }
  }

  async start(): Promise<boolean> {
    try {
      logger.info('Starting header constructor service...')
      this.setRunning(true)
      logger.info('Header constructor service started successfully')
      return true
    } catch (error) {
      logger.error('Failed to start header constructor service', { error })
      return false
    }
  }

  async stop(): Promise<void> {
    try {
      logger.info('Stopping header constructor service...')
      this.setRunning(false)
      logger.info('Header constructor service stopped successfully')
    } catch (error) {
      logger.error('Error stopping header constructor service', { error })
    }
  }

  getHeaderConstructor(): HeaderConstructor {
    return this.headerConstructor
  }
}

/**
 * State Manager Service Wrapper
 */
export class StateManagerService extends BaseService {
  private stateManager: StateManager

  constructor() {
    super('state-manager')
    this.stateManager = new StateManager()
  }

  async init(): Promise<void> {
    try {
      logger.info('Initializing state manager service...')
      this.setInitialized(true)
      logger.info('State manager service initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize state manager service', { error })
      throw error
    }
  }

  async start(): Promise<boolean> {
    try {
      logger.info('Starting state manager service...')
      this.setRunning(true)
      logger.info('State manager service started successfully')
      return true
    } catch (error) {
      logger.error('Failed to start state manager service', { error })
      return false
    }
  }

  async stop(): Promise<void> {
    try {
      logger.info('Stopping state manager service...')
      this.setRunning(false)
      logger.info('State manager service stopped successfully')
    } catch (error) {
      logger.error('Error stopping state manager service', { error })
    }
  }

  getStateManager(): StateManager {
    return this.stateManager
  }
}

/**
 * Work Package Processor Service Wrapper
 */
export class WorkPackageProcessorService extends BaseService {
  private workPackageProcessor: WorkPackageProcessor

  constructor() {
    super('work-package-processor')
    this.workPackageProcessor = new WorkPackageProcessor()
  }

  async init(): Promise<void> {
    try {
      logger.info('Initializing work package processor service...')
      this.setInitialized(true)
      logger.info('Work package processor service initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize work package processor service', {
        error,
      })
      throw error
    }
  }

  async start(): Promise<boolean> {
    try {
      logger.info('Starting work package processor service...')
      this.setRunning(true)
      logger.info('Work package processor service started successfully')
      return true
    } catch (error) {
      logger.error('Failed to start work package processor service', { error })
      return false
    }
  }

  async stop(): Promise<void> {
    try {
      logger.info('Stopping work package processor service...')
      this.setRunning(false)
      logger.info('Work package processor service stopped successfully')
    } catch (error) {
      logger.error('Error stopping work package processor service', { error })
    }
  }

  getWorkPackageProcessor(): WorkPackageProcessor {
    return this.workPackageProcessor
  }
}
