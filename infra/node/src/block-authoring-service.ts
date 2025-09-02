/**
 * Block Authoring Service Implementation
 *
 * Implements block creation, validation, and submission according to JAM Protocol
 * Reference: Gray Paper block authoring specifications
 */

import { randomBytes } from 'node:crypto'
import type { Safe } from '@pbnj/core'
import {
  bytesToHex,
  logger,
  numberToBytes,
  type SafePromise,
  safeError,
  safeResult,
  stringToBytes,
} from '@pbnj/core'
import type {
  BlockAuthoringBlock as Block,
  BlockAuthoringConfig,
  BlockAuthoringContext,
  BlockAuthoringMetrics,
  BlockAuthoringResult,
  BlockAuthoringService,
  SerializationBlockHeader as BlockHeader,
  Extrinsic,
  GenesisConfig,
  GenesisState,
  RuntimeWorkPackage,
  BlockAuthoringState as State,
  SubmissionResult,
  BlockAuthoringValidationResult as ValidationResult,
  BlockAuthoringWorkPackage as WorkPackage,
  WorkReport,
} from '@pbnj/types'
import { BlockSubmitter } from './block-submitter'
import { ExtrinsicValidator } from './extrinsic-validator'
import { GenesisManager } from './genesis-manager'
import { HeaderConstructor } from './header-constructor'
import { MetricsCollector } from './metrics-collector'
import { BaseService } from './service-interface'
import { StateManager } from './state-manager'
import type { TelemetryService } from './telemetry-service'
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
  private telemetryService: TelemetryService

  constructor(telemetryService: TelemetryService) {
    super('block-authoring-service')
    this.headerConstructor = new HeaderConstructor()
    this.workPackageProcessor = new WorkPackageProcessor()
    this.extrinsicValidator = new ExtrinsicValidator()
    this.stateManager = new StateManager()
    this.blockSubmitter = new BlockSubmitter()
    this.metricsCollector = new MetricsCollector(
      process.env['NODE_ID'] || 'default-node',
    )
    this.telemetryService = telemetryService
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
  ): SafePromise<BlockAuthoringResult> {
    const startTime = Date.now()

    // Emit telemetry event for block authoring start
    const parentHeaderHash = numberToBytes(context.parentHeader.slot)
    const fullParentHash = new Uint8Array(32)
    fullParentHash.set(parentHeaderHash)
    const [authoringEventIdError, authoringEventId] =
      await this.telemetryService.emitAuthoring(
        BigInt(context.parentHeader.slot) + 1n,
        fullParentHash,
      )
    if (authoringEventIdError) return safeError(authoringEventIdError)
    try {
      logger.info('Starting block creation', {
        parentBlock: context.parentHeader.slot,
        extrinsicsCount: context.extrinsics.length,
        workPackagesCount: context.workPackages.length,
        telemetryEventId: authoringEventId,
      })

      // Validate extrinsics
      const validationStart = Date.now()
      const [validationResultError, validationResult] =
        await this.validateExtrinsics(context.extrinsics)
      if (validationResultError) {
        return safeError(validationResultError)
      }
      const validationTime = Date.now() - validationStart

      if (!validationResult.valid) {
        // Emit telemetry event for authoring failure
        if (authoringEventId) {
          await this.telemetryService.emitAuthoringFailed(
            authoringEventId,
            'Extrinsic validation failed',
          )
        }
        return safeError(new Error('Extrinsic validation failed'))
      }

      // Process work packages
      const [workPackagesError, _workPackages] = await this.processWorkPackages(
        context.workPackages,
      )
      if (workPackagesError) {
        return safeError(workPackagesError)
      }

      // Construct block header
      const [error, header] = this.constructHeader(
        context.parentHeader,
        context.extrinsics,
      )
      if (error) {
        return safeError(error)
      }

      // Create block
      const block: Block = {
        header,
        body: context.extrinsics,
      }

      // Update state
      const [stateError, _state] = await this.updateState(block)
      if (stateError) {
        return safeError(stateError)
      }

      // Submit block
      const submissionStart = Date.now()
      const [submissionError, submissionResult] = await this.submitBlock(block)
      const submissionTime = Date.now() - submissionStart

      if (submissionError || !submissionResult) {
        // Emit telemetry event for authoring failure
        if (authoringEventId) {
          await this.telemetryService.emitAuthoringFailed(
            authoringEventId,
            'Block submission failed',
          )
        }
        return safeError(new Error('Block submission failed'))
      }

      const totalTime = Date.now() - startTime

      // Update metrics
      this.metricsCollector.updateMetrics({
        creationTime: BigInt(totalTime),
        validationTime: BigInt(validationTime),
        submissionTime: BigInt(submissionTime),
        memoryUsage: BigInt(process.memoryUsage().heapUsed),
        cpuUsage: 0n, // TODO: Implement CPU usage tracking
        extrinsicCount: BigInt(context.extrinsics.length),
        workPackageCount: BigInt(context.workPackages.length),
        blockSize: BigInt(JSON.stringify(block).length),
      })

      // Emit telemetry event for successful block authoring
      if (authoringEventId) {
        const headerHash = new TextEncoder()
          .encode(
            submissionResult.blockHash?.toString() || header.slot.toString(),
          )
          .slice(0, 32)
        const fullHeaderHash = new Uint8Array(32)
        fullHeaderHash.set(headerHash)

        const blockOutline = {
          sizeInBytes: BigInt(JSON.stringify(block).length),
          headerHash: fullHeaderHash,
          ticketCount: 0n,
          preimageCount: 0n,
          preimagesSizeInBytes: 0n,
          guaranteeCount: 0n,
          assuranceCount: 0n,
          disputeVerdictCount: 0n,
        }

        await this.telemetryService.emitAuthored(authoringEventId, blockOutline)
      }

      logger.info('Block created successfully', {
        blockSlot: header.slot,
        blockHash: submissionResult.blockHash,
        totalTime,
        telemetryEventId: authoringEventId,
      })

      return safeResult({
        success: true,
        block,
        metrics: this.metricsCollector.getMetrics(),
      })
    } catch (error) {
      // Emit telemetry event for authoring failure
      if (authoringEventId) {
        await this.telemetryService.emitAuthoringFailed(
          authoringEventId,
          `Block creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
      return safeError(
        new Error(
          `Block creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      )
    }
  }

  /**
   * Construct block header
   */
  constructHeader(
    parent: BlockHeader | null,
    extrinsics: Extrinsic[],
  ): Safe<BlockHeader> {
    return this.headerConstructor.construct(parent, extrinsics, this.config)
  }

  /**
   * Process work packages
   */
  async processWorkPackages(
    packages: WorkPackage[],
  ): SafePromise<WorkReport[]> {
    // TODO: Implement proper conversion between WorkPackage types
    const convertedPackages: RuntimeWorkPackage[] = packages.map((pkg) => ({
      ...pkg,
      id: bytesToHex(randomBytes(32)),
      authToken: pkg.authorization,
      authCodeHost: pkg.auth_code_host,
      authCodeHash: pkg.authorizer.code_hash,
      authConfig: pkg.authorizer.params,
      workItems: pkg.items,
      data: bytesToHex(randomBytes(32)), // Generate random data hash
      author: pkg.authorization, // Use authorization as author
      timestamp: BigInt(Date.now()), // Add current timestamp
    }))
    return this.workPackageProcessor.process(convertedPackages, this.config)
  }

  /**
   * Validate extrinsics
   */
  async validateExtrinsics(
    extrinsics: Extrinsic[],
  ): SafePromise<ValidationResult> {
    // Convert core extrinsics to extended extrinsics for validation
    const extendedExtrinsics = extrinsics.map((ext, index) => ({
      ...ext,
      id: bytesToHex(stringToBytes(`ext_${index}_${ext.hash}`)),
      author: `unknown`, // TODO: Extract author from signature
    }))
    return this.extrinsicValidator.validate(extendedExtrinsics, this.config)
  }

  /**
   * Update state
   */
  updateState(block: Block): Safe<State> {
    return this.stateManager.update(block, this.config)
  }

  /**
   * Submit block
   */
  async submitBlock(block: Block): SafePromise<SubmissionResult> {
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
}
