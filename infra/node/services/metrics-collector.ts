/**
 * Metrics Collector with OpenTelemetry
 *
 * Collects and manages block authoring performance metrics using OpenTelemetry
 * Provides integration with Prometheus, Grafana, and other observability tools
 */

// OpenTelemetry imports
import {
  type Meter,
  metrics,
  SpanStatusCode,
  type Tracer,
  trace,
} from '@opentelemetry/api'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import type { SafePromise } from '@pbnj/core'
import { logger, safeError, safeResult } from '@pbnj/core'
import {
  createTelemetrySystem,
  type TelemetryEventEmitter,
} from '@pbnj/telemetry'
import type { BlockAuthoringMetrics, TelemetryConfig } from '@pbnj/types'
import { BaseService } from '../interfaces/service'

/**
 * Metrics Collector with OpenTelemetry
 */
export class MetricsCollector extends BaseService {
  private metrics: BlockAuthoringMetrics = {
    creationTime: 0n,
    validationTime: 0n,
    submissionTime: 0n,
    memoryUsage: 0n,
    cpuUsage: 0n,
    extrinsicCount: 0n,
    workPackageCount: 0n,
    blockSize: 0n,
  }

  private meter = metrics.getMeter('pbnj-node')
  private tracer = trace.getTracer('pbnj-node')

  // OpenTelemetry metrics
  // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  private blockCreationTimeHistogram: any
  // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  private blockValidationTimeHistogram: any
  // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  private blockSubmissionTimeHistogram: any
  // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  private memoryUsageGauge: any
  // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  private cpuUsageGauge: any
  // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  private extrinsicCountCounter: any
  // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  private workPackageCountCounter: any
  // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  private blockSizeHistogram: any
  // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  private blocksCreatedCounter: any
  // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  private blocksSubmittedCounter: any
  // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  private blocksFailedCounter: any

  // JIP-3 Telemetry
  private telemetrySystem?: ReturnType<typeof createTelemetrySystem>
  private telemetryEvents?: TelemetryEventEmitter

  constructor(
    private nodeId: string,
    private serviceName = 'pbnj-node',
    private telemetryConfig?: TelemetryConfig,
  ) {
    super('metrics-collector')
    this.initializeOpenTelemetry()
    this.initializeMetrics()
    this.initializeTelemetry()
  }

  async init(): SafePromise<boolean> {
    logger.info('Initializing metrics collector...')
    // OpenTelemetry is already initialized in constructor

    // Initialize telemetry if configured
    if (this.telemetrySystem) {
      await this.telemetrySystem.start()
      logger.info('JIP-3 telemetry initialized successfully')
    }

    this.setInitialized(true)

    return safeResult(true)
  }

  async start(): SafePromise<boolean> {
    logger.info('Starting metrics collector...')
    this.setRunning(true)
    logger.info('Metrics collector started successfully')
    return safeResult(true)
  }

  async stop(): SafePromise<boolean> {
    logger.info('Stopping metrics collector...')

    // Stop telemetry if initialized
    if (this.telemetrySystem) {
      await this.telemetrySystem.stop()
    }

    this.setRunning(false)
    return safeResult(true)
  }

  /**
   * Initialize OpenTelemetry SDK
   */
  private initializeOpenTelemetry(): void {
    try {
      const sdk = new NodeSDK({
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: this.serviceName,
          [SemanticResourceAttributes.SERVICE_VERSION]: '0.0.1',
          'node.id': this.nodeId,
          'service.instance.id': this.nodeId,
        }),
        traceExporter: new OTLPTraceExporter({
          url:
            process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ||
            'http://localhost:4318/v1/traces',
        }),
        instrumentations: [getNodeAutoInstrumentations()],
      })

      sdk.start()
      logger.info('OpenTelemetry SDK initialized', { nodeId: this.nodeId })
    } catch (error) {
      logger.warn(
        'Failed to initialize OpenTelemetry SDK, continuing without observability',
        {
          nodeId: this.nodeId,
          error: error instanceof Error ? error.message : String(error),
        },
      )
    }
  }

  /**
   * Initialize JIP-3 Telemetry
   */
  private initializeTelemetry(): void {
    if (!this.telemetryConfig) {
      logger.debug(
        'No telemetry configuration provided, skipping JIP-3 telemetry',
      )
      return
    }

    try {
      this.telemetrySystem = createTelemetrySystem(this.telemetryConfig)
      this.telemetryEvents = this.telemetrySystem.events
      logger.info('JIP-3 telemetry system created', {
        enabled: this.telemetryConfig.enabled,
        endpoint: this.telemetryConfig.endpoint,
      })
    } catch (error) {
      logger.warn(
        'Failed to initialize JIP-3 telemetry, continuing without telemetry',
        {
          error: error instanceof Error ? error.message : String(error),
        },
      )
    }
  }

  /**
   * Initialize OpenTelemetry metrics
   */
  private initializeMetrics(): void {
    try {
      // Histograms for timing metrics
      this.blockCreationTimeHistogram = this.meter.createHistogram(
        'block_creation_time_ms',
        {
          description: 'Time taken to create a block in milliseconds',
          unit: 'ms',
        },
      )

      this.blockValidationTimeHistogram = this.meter.createHistogram(
        'block_validation_time_ms',
        {
          description: 'Time taken to validate a block in milliseconds',
          unit: 'ms',
        },
      )

      this.blockSubmissionTimeHistogram = this.meter.createHistogram(
        'block_submission_time_ms',
        {
          description: 'Time taken to submit a block in milliseconds',
          unit: 'ms',
        },
      )

      this.blockSizeHistogram = this.meter.createHistogram('block_size_bytes', {
        description: 'Size of created blocks in bytes',
        unit: 'bytes',
      })

      // Gauges for current values
      this.memoryUsageGauge = this.meter.createUpDownCounter(
        'memory_usage_bytes',
        {
          description: 'Current memory usage in bytes',
          unit: 'bytes',
        },
      )

      this.cpuUsageGauge = this.meter.createUpDownCounter('cpu_usage_percent', {
        description: 'Current CPU usage percentage',
        unit: 'percent',
      })

      // Counters for cumulative values
      this.extrinsicCountCounter = this.meter.createCounter(
        'extrinsics_processed_total',
        {
          description: 'Total number of extrinsics processed',
        },
      )

      this.workPackageCountCounter = this.meter.createCounter(
        'work_packages_processed_total',
        {
          description: 'Total number of work packages processed',
        },
      )

      this.blocksCreatedCounter = this.meter.createCounter(
        'blocks_created_total',
        {
          description: 'Total number of blocks created',
        },
      )

      this.blocksSubmittedCounter = this.meter.createCounter(
        'blocks_submitted_total',
        {
          description: 'Total number of blocks submitted',
        },
      )

      this.blocksFailedCounter = this.meter.createCounter(
        'blocks_failed_total',
        {
          description: 'Total number of blocks that failed',
        },
      )

      logger.info('OpenTelemetry metrics initialized', { nodeId: this.nodeId })
    } catch (error) {
      logger.warn(
        'Failed to initialize OpenTelemetry metrics, continuing without metrics',
        {
          nodeId: this.nodeId,
          error: error instanceof Error ? error.message : String(error),
        },
      )
    }
  }

  /**
   * Update metrics with OpenTelemetry recording
   */
  updateMetrics(newMetrics: Partial<BlockAuthoringMetrics>): void {
    this.metrics = {
      ...this.metrics,
      ...newMetrics,
    }

    // Record metrics in OpenTelemetry
    try {
      if (
        newMetrics.creationTime !== undefined &&
        this.blockCreationTimeHistogram
      ) {
        this.blockCreationTimeHistogram.record(newMetrics.creationTime, {
          node_id: this.nodeId,
          metric_type: 'creation_time',
        })
      }

      if (
        newMetrics.validationTime !== undefined &&
        this.blockValidationTimeHistogram
      ) {
        this.blockValidationTimeHistogram.record(newMetrics.validationTime, {
          node_id: this.nodeId,
          metric_type: 'validation_time',
        })
      }

      if (
        newMetrics.submissionTime !== undefined &&
        this.blockSubmissionTimeHistogram
      ) {
        this.blockSubmissionTimeHistogram.record(newMetrics.submissionTime, {
          node_id: this.nodeId,
          metric_type: 'submission_time',
        })
      }

      if (newMetrics.memoryUsage !== undefined && this.memoryUsageGauge) {
        this.memoryUsageGauge.add(newMetrics.memoryUsage, {
          node_id: this.nodeId,
          metric_type: 'memory_usage',
        })
      }

      if (newMetrics.cpuUsage !== undefined && this.cpuUsageGauge) {
        this.cpuUsageGauge.add(newMetrics.cpuUsage, {
          node_id: this.nodeId,
          metric_type: 'cpu_usage',
        })
      }

      if (
        newMetrics.extrinsicCount !== undefined &&
        this.extrinsicCountCounter
      ) {
        this.extrinsicCountCounter.add(newMetrics.extrinsicCount, {
          node_id: this.nodeId,
          metric_type: 'extrinsic_count',
        })
      }

      if (
        newMetrics.workPackageCount !== undefined &&
        this.workPackageCountCounter
      ) {
        this.workPackageCountCounter.add(newMetrics.workPackageCount, {
          node_id: this.nodeId,
          metric_type: 'work_package_count',
        })
      }

      if (newMetrics.blockSize !== undefined && this.blockSizeHistogram) {
        this.blockSizeHistogram.record(newMetrics.blockSize, {
          node_id: this.nodeId,
          metric_type: 'block_size',
        })
      }
    } catch (error) {
      logger.warn('Failed to record metrics', {
        nodeId: this.nodeId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Record block creation with tracing and telemetry
   */
  recordBlockCreation(
    blockNumber: number,
    metrics: Partial<BlockAuthoringMetrics>,
    headerHash?: Uint8Array,
    parentHeaderHash?: Uint8Array,
  ): void {
    try {
      const span = this.tracer.startSpan('block_creation', {
        attributes: {
          'block.number': blockNumber,
          'node.id': this.nodeId,
        },
      })

      try {
        this.updateMetrics(metrics)
        if (this.blocksCreatedCounter) {
          this.blocksCreatedCounter.add(1, {
            node_id: this.nodeId,
            block_number: blockNumber.toString(),
          })
        }

        // Emit JIP-3 telemetry events
        if (this.telemetryEvents && headerHash && parentHeaderHash) {
          this.emitBlockAuthoringEvents(
            BigInt(blockNumber),
            metrics,
            headerHash,
            parentHeaderHash,
          ).catch((error) => {
            logger.warn('Failed to emit telemetry events for block creation', {
              error,
            })
          })
        }

        span.setStatus({ code: SpanStatusCode.OK })
        span.setAttributes({
          'block.creation_time_ms': Number(metrics.creationTime) || 0,
          'block.size_bytes': Number(metrics.blockSize) || 0,
          'block.extrinsic_count': Number(metrics.extrinsicCount) || 0,
        })

        logger.info('Block creation recorded', {
          nodeId: this.nodeId,
          blockNumber,
          metrics,
        })
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) })
        span.recordException(error as Error)
        throw error
      } finally {
        span.end()
      }
    } catch (error) {
      logger.warn('Failed to record block creation trace', {
        nodeId: this.nodeId,
        blockNumber,
        error: error instanceof Error ? error.message : String(error),
      })
      // Fallback to just updating metrics without tracing
      this.updateMetrics(metrics)
    }
  }

  /**
   * Record block submission with tracing
   */
  recordBlockSubmission(
    blockNumber: number,
    success: boolean,
    metrics: Partial<BlockAuthoringMetrics>,
  ): void {
    try {
      const span = this.tracer.startSpan('block_submission', {
        attributes: {
          'block.number': blockNumber,
          'node.id': this.nodeId,
          'submission.success': success,
        },
      })

      try {
        this.updateMetrics(metrics)

        if (success && this.blocksSubmittedCounter) {
          this.blocksSubmittedCounter.add(1, {
            node_id: this.nodeId,
            block_number: blockNumber.toString(),
          })
        } else if (!success && this.blocksFailedCounter) {
          this.blocksFailedCounter.add(1, {
            node_id: this.nodeId,
            block_number: blockNumber.toString(),
          })
        }

        span.setStatus({
          code: success ? SpanStatusCode.OK : SpanStatusCode.ERROR,
        })
        span.setAttributes({
          'block.submission_time_ms': Number(metrics.submissionTime) || 0,
        })

        logger.info('Block submission recorded', {
          nodeId: this.nodeId,
          blockNumber,
          success,
          metrics,
        })
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) })
        span.recordException(error as Error)
        throw error
      } finally {
        span.end()
      }
    } catch (error) {
      logger.warn('Failed to record block submission trace', {
        nodeId: this.nodeId,
        blockNumber,
        success,
        error: error instanceof Error ? error.message : String(error),
      })
      // Fallback to just updating metrics without tracing
      this.updateMetrics(metrics)
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): BlockAuthoringMetrics {
    return { ...this.metrics }
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = {
      creationTime: 0n,
      validationTime: 0n,
      submissionTime: 0n,
      memoryUsage: 0n,
      cpuUsage: 0n,
      extrinsicCount: 0n,
      workPackageCount: 0n,
      blockSize: 0n,
    }
  }

  /**
   * Get average metrics over time
   */
  getAverageMetrics(): BlockAuthoringMetrics {
    // TODO: Implement rolling average calculation
    return this.getMetrics()
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    averageCreationTime: number
    averageValidationTime: number
    averageSubmissionTime: number
    totalBlocks: number
    successRate: number
  } {
    // TODO: Implement performance summary calculation
    return {
      averageCreationTime: Number(this.metrics.creationTime),
      averageValidationTime: Number(this.metrics.validationTime),
      averageSubmissionTime: Number(this.metrics.submissionTime),
      totalBlocks: 1, // TODO: Track total blocks
      successRate: 1.0, // TODO: Track success rate
    }
  }

  /**
   * Get OpenTelemetry metrics
   */
  getOpenTelemetryMetrics(): {
    meter: Meter
    tracer: Tracer
    nodeId: string
  } {
    return {
      meter: this.meter,
      tracer: this.tracer,
      nodeId: this.nodeId,
    }
  }

  /**
   * Get telemetry system
   */
  getTelemetrySystem(): ReturnType<typeof createTelemetrySystem> | undefined {
    return this.telemetrySystem
  }

  /**
   * Get telemetry events emitter
   */
  getTelemetryEvents(): TelemetryEventEmitter | undefined {
    return this.telemetryEvents
  }

  /**
   * Emit periodic status telemetry
   */
  async emitStatusTelemetry(status: {
    totalPeerCount: bigint
    validatorPeerCount: bigint
    blockAnnouncementStreamPeerCount: bigint
    guaranteesByCore: Uint8Array
    shardCount: bigint
    shardTotalSizeBytes: bigint
    readyPreimageCount: bigint
    readyPreimageTotalSizeBytes: bigint
  }): SafePromise<void> {
    if (!this.telemetryEvents)
      return safeError(new Error('Telemetry emitter not initialized'))

    return this.telemetryEvents.emitStatus(status)
  }

  /**
   * Emit best block changed telemetry
   */
  async emitBestBlockChanged(
    slot: bigint,
    headerHash: Uint8Array,
  ): Promise<void> {
    if (!this.telemetryEvents) return

    try {
      await this.telemetryEvents.emitBestBlockChanged(slot, headerHash)
    } catch (error) {
      logger.warn('Failed to emit best block changed telemetry', { error })
    }
  }

  /**
   * Emit finalized block changed telemetry
   */
  async emitFinalizedBlockChanged(
    slot: bigint,
    headerHash: Uint8Array,
  ): Promise<void> {
    if (!this.telemetryEvents) return

    try {
      await this.telemetryEvents.emitFinalizedBlockChanged(slot, headerHash)
    } catch (error) {
      logger.warn('Failed to emit finalized block changed telemetry', { error })
    }
  }

  /**
   * Emit sync status changed telemetry
   */
  async emitSyncStatusChanged(isSynced: boolean): Promise<void> {
    if (!this.telemetryEvents) return

    try {
      await this.telemetryEvents.emitSyncStatusChanged(isSynced)
    } catch (error) {
      logger.warn('Failed to emit sync status changed telemetry', { error })
    }
  }

  /**
   * Helper method to emit block authoring telemetry events
   */
  private async emitBlockAuthoringEvents(
    blockNumber: bigint,
    metrics: Partial<BlockAuthoringMetrics>,
    headerHash: Uint8Array,
    parentHeaderHash: Uint8Array,
  ): SafePromise<void> {
    if (!this.telemetryEvents)
      return safeError(new Error('Telemetry emitter not initialized'))

    // Emit authoring event
    const [authoringEventIdError, authoringEventId] =
      await this.telemetryEvents.emitAuthoring(
        BigInt(blockNumber), // Using block number as slot for now
        parentHeaderHash,
      )
    if (authoringEventIdError) return safeError(authoringEventIdError)

    // Create block outline from metrics
    const blockOutline = {
      sizeInBytes: metrics.blockSize || 0n,
      headerHash,
      ticketCount: 0n, // Would need actual ticket data
      preimageCount: 0n, // Would need actual preimage data
      preimagesSizeInBytes: 0n,
      guaranteeCount: 0n, // Would need actual guarantee data
      assuranceCount: 0n, // Would need actual assurance data
      disputeVerdictCount: 0n,
    }

    // Emit authored event
    return await this.telemetryEvents.emitAuthored(
      authoringEventId,
      blockOutline,
    )
  }
}
