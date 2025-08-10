/**
 * Block Authoring Service Implementation
 *
 * Implements block creation, validation, and submission according to JAM Protocol
 * Reference: Gray Paper block authoring specifications
 */

import { logger } from '@pbnj/core'
import { BlockSubmitter } from './block-submitter'
import { ExtrinsicValidator } from './extrinsic-validator'
import { GenesisManager } from './genesis-manager'
import { HeaderConstructor } from './header-constructor'
import { MetricsCollector } from './metrics-collector'
import { BaseService } from './service-interface'
import { StateManager } from './state-manager'
import type {
  Block,
  BlockAuthoringConfig,
  BlockAuthoringContext,
  BlockAuthoringError,
  BlockAuthoringErrorType,
  BlockAuthoringMetrics,
  BlockAuthoringResult,
  BlockAuthoringService,
  BlockHeader,
  Extrinsic,
  GenesisConfig,
  GenesisState,
  State,
  SubmissionResult,
  ValidationResult,
  WorkPackage,
  WorkReport,
} from './types'
import { WorkPackageProcessor } from './work-package-processor'

/**
 * Block Authoring Service Implementation
 */
export class BlockAuthoringServiceImpl
  extends BaseService
  implements BlockAuthoringService
{
  private config!: BlockAuthoringConfig
  private genesisManager?: GenesisManager
  private genesisState?: GenesisState
  private headerConstructor: HeaderConstructor
  private workPackageProcessor: WorkPackageProcessor
  private extrinsicValidator: ExtrinsicValidator
  private stateManager: StateManager
  private blockSubmitter: BlockSubmitter
  private metricsCollector: MetricsCollector

  constructor() {
    super('block-authoring-service')
    this.headerConstructor = new HeaderConstructor()
    this.workPackageProcessor = new WorkPackageProcessor()
    this.extrinsicValidator = new ExtrinsicValidator()
    this.stateManager = new StateManager()
    this.blockSubmitter = new BlockSubmitter()
    this.metricsCollector = new MetricsCollector(
      process.env['NODE_ID'] || 'default-node',
    )
  }

  async init(): Promise<void> {
    try {
      logger.info('Initializing block authoring service...')
      this.setInitialized(true)
      logger.info('Block authoring service initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize block authoring service', { error })
      throw error
    }
  }

  /**
   * Configure the block authoring service
   */
  configure(config: BlockAuthoringConfig): void {
    this.config = config
    logger.info('Block authoring service configured', { config })
  }

  /**
   * Initialize genesis state
   */
  async initializeGenesis(genesisConfig: GenesisConfig): Promise<boolean> {
    try {
      logger.info('Initializing genesis state', { genesisConfig })

      // Create genesis manager
      this.genesisManager = new GenesisManager(genesisConfig)

      // Load genesis
      this.genesisState = await this.genesisManager.loadGenesis()

      // Store genesis state

      logger.info('Genesis initialized successfully', {
        accountsCount: this.genesisState.state.accounts.size,
        validatorsCount: this.genesisState.state.validators.length,
        warnings: [],
      })

      return true
    } catch (error) {
      logger.error('Failed to initialize genesis', { error })
      return false
    }
  }

  /**
   * Get genesis state
   */
  getGenesisState(): GenesisState | undefined {
    return this.genesisState
  }

  /**
   * Create a new block
   */
  async createBlock(
    context: BlockAuthoringContext,
  ): Promise<BlockAuthoringResult> {
    const startTime = Date.now()

    try {
      logger.info('Starting block creation', {
        parentBlock: context.parentHeader.number,
        extrinsicsCount: context.extrinsics.length,
        workPackagesCount: context.workPackages.length,
      })

      // Validate extrinsics
      const validationStart = Date.now()
      const validationResult = await this.validateExtrinsics(context.extrinsics)
      const validationTime = Date.now() - validationStart

      if (!validationResult.valid) {
        return this.createErrorResult(
          'INVALID_EXTRINSICS',
          'Extrinsic validation failed',
          { errors: validationResult.errors },
          false,
        )
      }

      // Process work packages
      await this.processWorkPackages(context.workPackages)

      // Construct block header
      const header = await this.constructHeader(
        context.parentHeader,
        context.extrinsics,
      )

      // Create block
      const block: Block = {
        header,
        body: context.extrinsics,
      }

      // Update state
      await this.updateState(block)

      // Submit block
      const submissionStart = Date.now()
      const submissionResult = await this.submitBlock(block)
      const submissionTime = Date.now() - submissionStart

      if (!submissionResult.success) {
        return this.createErrorResult(
          'SUBMISSION_FAILED',
          'Block submission failed',
          { error: submissionResult.error },
          true,
        )
      }

      const totalTime = Date.now() - startTime

      // Update metrics
      this.metricsCollector.updateMetrics({
        creationTime: totalTime,
        validationTime,
        submissionTime,
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUsage: 0, // TODO: Implement CPU usage tracking
        extrinsicCount: context.extrinsics.length,
        workPackageCount: context.workPackages.length,
        blockSize: JSON.stringify(block).length,
      })

      logger.info('Block created successfully', {
        blockNumber: header.number,
        blockHash: submissionResult.blockHash,
        totalTime,
      })

      return {
        success: true,
        block,
        metrics: this.metricsCollector.getMetrics(),
      }
    } catch (error) {
      logger.error('Block creation failed', { error })
      return this.createErrorResult(
        'CREATION_FAILED',
        'Block creation failed',
        { error: error instanceof Error ? error.message : String(error) },
        true,
      )
    }
  }

  /**
   * Construct block header
   */
  async constructHeader(
    parent: BlockHeader | null,
    extrinsics: Extrinsic[],
  ): Promise<BlockHeader> {
    return this.headerConstructor.construct(parent, extrinsics, this.config)
  }

  /**
   * Process work packages
   */
  async processWorkPackages(packages: WorkPackage[]): Promise<WorkReport[]> {
    return this.workPackageProcessor.process(packages, this.config)
  }

  /**
   * Validate extrinsics
   */
  async validateExtrinsics(extrinsics: Extrinsic[]): Promise<ValidationResult> {
    return this.extrinsicValidator.validate(extrinsics, this.config)
  }

  /**
   * Update state
   */
  async updateState(block: Block): Promise<State> {
    return this.stateManager.update(block, this.config)
  }

  /**
   * Submit block
   */
  async submitBlock(block: Block): Promise<SubmissionResult> {
    return this.blockSubmitter.submit(block, this.config)
  }

  /**
   * Get metrics
   */
  getMetrics(): BlockAuthoringMetrics {
    return this.metricsCollector.getMetrics()
  }

  /**
   * Start all sub-services
   */
  async start(): Promise<boolean> {
    try {
      logger.info('Starting block authoring service...')

      // Start networking service (if implemented)
      logger.info('Starting networking service...')
      // TODO: Initialize and start networking service
      // await this.networkingService.start()

      // Start block submission service
      logger.info('Starting block submission service...')
      // TODO: Initialize and start block submission service
      // await this.blockSubmitter.start()

      // Start metrics collection
      logger.info('Starting metrics collection...')
      // TODO: Start metrics collection if needed
      // this.metricsCollector.start()

      logger.info('Block authoring service started successfully')
      return true
    } catch (error) {
      logger.error('Failed to start block authoring service', { error })
      return false
    }
  }

  /**
   * Stop all sub-services
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping block authoring service...')

      // Stop networking service
      logger.info('Stopping networking service...')
      // TODO: Stop networking service
      // await this.networkingService.stop()

      // Stop block submission service
      logger.info('Stopping block submission service...')
      // TODO: Stop block submission service
      // await this.blockSubmitter.stop()

      // Stop metrics collection
      logger.info('Stopping metrics collection...')
      // TODO: Stop metrics collection if needed
      // this.metricsCollector.stop()

      logger.info('Block authoring service stopped successfully')
    } catch (error) {
      logger.error('Error stopping block authoring service', { error })
    }
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metricsCollector.reset()
  }

  /**
   * Create error result
   */
  private createErrorResult(
    type: string,
    message: string,
    details?: Record<string, unknown>,
    recoverable = false,
  ): BlockAuthoringResult {
    const error: BlockAuthoringError = {
      type: type as BlockAuthoringErrorType, // TODO: Fix type casting
      message,
      details,
      recoverable,
    }

    return {
      success: false,
      error,
      metrics: this.metricsCollector.getMetrics(),
    }
  }
}
