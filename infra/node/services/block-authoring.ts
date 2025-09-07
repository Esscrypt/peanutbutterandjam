/**
 * Block Authoring Service Implementation
 *
 * Implements block creation, validation, and submission according to JAM Protocol
 * Reference: Gray Paper block authoring specifications
 */

import type { Safe } from '@pbnj/core'
import {
  logger,
  numberToBytes,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/core'
import type {
  AuthorValidationResult,
  Block,
  BlockAuthoringConfig,
  BlockAuthoringContext,
  BlockAuthoringMetrics,
  BlockAuthoringResult,
  BlockHeader,
  Extrinsic,
  State,
  SubmissionResult,
  WorkPackage,
  WorkReport,
} from '@pbnj/types'
import { BaseService } from '../interfaces/service'
import type { BlockSubmitter } from './block-submitter'
import type { ExtrinsicValidator } from './extrinsic-validator'
import type { HeaderConstructor } from './header-constructor'
import type { MetricsCollector } from './metrics-collector'
import type { StateManager } from './state-manager'
import type { TelemetryService } from './telemetry-service'
import type { WorkPackageProcessor } from './work-package-processor'

/**
 * Block Authoring Service Implementation
 */
export class BlockAuthoringService extends BaseService {
  private config!: BlockAuthoringConfig
  private headerConstructor: HeaderConstructor
  private workPackageProcessor: WorkPackageProcessor
  private extrinsicValidator: ExtrinsicValidator
  private stateManager: StateManager
  private blockSubmitter: BlockSubmitter
  private metricsCollector: MetricsCollector
  private telemetryService: TelemetryService

  constructor(
    telemetryService: TelemetryService,
    headerConstructor: HeaderConstructor,
    workPackageProcessor: WorkPackageProcessor,
    extrinsicValidator: ExtrinsicValidator,
    stateManager: StateManager,
    blockSubmitter: BlockSubmitter,
    metricsCollector: MetricsCollector,
  ) {
    super('block-authoring-service')
    this.headerConstructor = headerConstructor
    this.workPackageProcessor = workPackageProcessor
    this.extrinsicValidator = extrinsicValidator
    this.stateManager = stateManager
    this.blockSubmitter = blockSubmitter
    this.metricsCollector = metricsCollector
    this.telemetryService = telemetryService
  }

  /**
   * Configure the block authoring service
   */
  configure(config: BlockAuthoringConfig): void {
    this.config = config
    logger.info('Block authoring service configured', { config })
  }

  /**
   * Create a new block
   */
  async createBlock(
    context: BlockAuthoringContext,
  ): SafePromise<BlockAuthoringResult> {
    const startTime = Date.now()

    // Emit telemetry event for block authoring start
    const parentHeaderHash = numberToBytes(context.parentHeader.timeslot)
    const fullParentHash = new Uint8Array(32)
    fullParentHash.set(parentHeaderHash)
    const [authoringEventIdError, authoringEventId] =
      await this.telemetryService.emitAuthoring(
        BigInt(context.parentHeader.timeslot) + 1n,
        fullParentHash,
      )
    if (authoringEventIdError) return safeError(authoringEventIdError)
    try {
      logger.info('Starting block creation', {
        parentBlock: context.parentHeader.timeslot,
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
        body: {
          tickets: [],
          preimages: [],
          guarantees: [],
          assurances: [],
          disputes: [],
        },
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
            submissionResult.blockHash?.toString() ||
              header.timeslot.toString(),
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
        blockSlot: header.timeslot,
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
    parent: BlockHeader,
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
    return this.workPackageProcessor.process(packages, this.config)
  }

  /**
   * Validate extrinsics
   */
  async validateExtrinsics(
    extrinsics: Extrinsic[],
  ): SafePromise<AuthorValidationResult> {
    return this.extrinsicValidator.validate(extrinsics, this.config)
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
  async start(): SafePromise<boolean> {
    super.start()
    await this.workPackageProcessor.start()
    await this.extrinsicValidator.start()
    await this.stateManager.start()
    await this.blockSubmitter.start()
    await this.metricsCollector.start()
    return safeResult(true)
  }

  /**
   * Stop all sub-services
   */
  async stop(): SafePromise<boolean> {
    super.stop()
    await this.workPackageProcessor.stop()
    await this.extrinsicValidator.stop()
    await this.stateManager.stop()
    await this.blockSubmitter.stop()
    await this.metricsCollector.stop()
    return safeResult(true)
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metricsCollector.reset()
  }
}
