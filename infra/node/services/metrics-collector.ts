/**
 * Metrics Collector with OpenTelemetry
 *
 * Collects and manages block authoring performance metrics using OpenTelemetry
 * Provides integration with Prometheus, Grafana, and other observability tools
 */

// OpenTelemetry imports
// import {
//   metrics,
//   // trace,
// } from '@opentelemetry/api'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import type { BlockAuthoringMetrics, Safe } from '@pbnjam/types'
import { BaseService, safeResult } from '@pbnjam/types'

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

  // private meter = metrics.getMeter('pbnj-node')
  // private tracer = trace.getTracer('pbnj-node')

  // OpenTelemetry metrics
  // private blockCreationTimeHistogram: any
  // // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  // private blockValidationTimeHistogram: any
  // // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  // private blockSubmissionTimeHistogram: any
  // // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  // private memoryUsageGauge: any
  // // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  // private cpuUsageGauge: any
  // // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  // private extrinsicCountCounter: any
  // // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  // private workPackageCountCounter: any
  // // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  // private blockSizeHistogram: any
  // // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  // private blocksCreatedCounter: any
  // // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  // private blocksSubmittedCounter: any
  // // biome-ignore lint/suspicious/noExplicitAny: OpenTelemetry metrics have complex types
  // private blocksFailedCounter: any

  constructor(private nodeId: string) {
    super('metrics-collector')
  }

  override start(): Safe<boolean> {
    const sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'metrics-collector',
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

    // this.initializeMetrics()
    return safeResult(true)
  }

  /**
   * Initialize OpenTelemetry metrics
   */
  // private initializeMetrics(): void {
  //   try {
  //       // Histograms for timing metrics
  //       this.blockCreationTimeHistogram = this.meter.createHistogram(
  //         'block_creation_time_ms',
  //         {
  //           description: 'Time taken to create a block in milliseconds',
  //           unit: 'ms',
  //         },
  //     )

  //     this.blockValidationTimeHistogram = this.meter.createHistogram(
  //       'block_validation_time_ms',
  //       {
  //         description: 'Time taken to validate a block in milliseconds',
  //         unit: 'ms',
  //       },
  //     )

  //     this.blockSubmissionTimeHistogram = this.meter.createHistogram(
  //       'block_submission_time_ms',
  //       {
  //         description: 'Time taken to submit a block in milliseconds',
  //         unit: 'ms',
  //       },
  //     )

  //     this.blockSizeHistogram = this.meter.createHistogram('block_size_bytes', {
  //       description: 'Size of created blocks in bytes',
  //       unit: 'bytes',
  //     })

  //     // Gauges for current values
  //     this.memoryUsageGauge = this.meter.createUpDownCounter(
  //       'memory_usage_bytes',
  //       {
  //         description: 'Current memory usage in bytes',
  //         unit: 'bytes',
  //       },
  //     )

  //     this.cpuUsageGauge = this.meter.createUpDownCounter('cpu_usage_percent', {
  //       description: 'Current CPU usage percentage',
  //       unit: 'percent',
  //     })

  //     // Counters for cumulative values
  //     this.extrinsicCountCounter = this.meter.createCounter(
  //       'extrinsics_processed_total',
  //       {
  //         description: 'Total number of extrinsics processed',
  //       },
  //     )

  //     this.workPackageCountCounter = this.meter.createCounter(
  //       'work_packages_processed_total',
  //       {
  //         description: 'Total number of work packages processed',
  //       },
  //     )

  //     this.blocksCreatedCounter = this.meter.createCounter(
  //       'blocks_created_total',
  //       {
  //         description: 'Total number of blocks created',
  //       },
  //     )

  //     this.blocksSubmittedCounter = this.meter.createCounter(
  //       'blocks_submitted_total',
  //       {
  //         description: 'Total number of blocks submitted',
  //       },
  //     )

  //     this.blocksFailedCounter = this.meter.createCounter(
  //       'blocks_failed_total',
  //       {
  //         description: 'Total number of blocks that failed',
  //       },
  //     )

  //     logger.info('OpenTelemetry metrics initialized', { nodeId: this.nodeId })
  //   } catch (error) {
  //     logger.warn(
  //       'Failed to initialize OpenTelemetry metrics, continuing without metrics',
  //       {
  //         nodeId: this.nodeId,
  //         error: error instanceof Error ? error.message : String(error),
  //       },
  //     )
  //   }
  // }

  /**
   * Update metrics with OpenTelemetry recording
   */
  // TODO: update on event handler (or diff of 2 events)
  // updateMetrics(newMetrics: Partial<BlockAuthoringMetrics>): void {
  //   this.metrics = {
  //     ...this.metrics,
  //     ...newMetrics,
  //   }

  //   // Record metrics in OpenTelemetry
  //   try {
  //     if (
  //       newMetrics.creationTime !== undefined &&
  //       this.blockCreationTimeHistogram
  //     ) {
  //       this.blockCreationTimeHistogram.record(newMetrics.creationTime, {
  //         node_id: this.nodeId,
  //         metric_type: 'creation_time',
  //       })
  //     }

  //     if (
  //       newMetrics.validationTime !== undefined &&
  //       this.blockValidationTimeHistogram
  //     ) {
  //       this.blockValidationTimeHistogram.record(newMetrics.validationTime, {
  //         node_id: this.nodeId,
  //         metric_type: 'validation_time',
  //       })
  //     }

  //     if (
  //       newMetrics.submissionTime !== undefined &&
  //       this.blockSubmissionTimeHistogram
  //     ) {
  //       this.blockSubmissionTimeHistogram.record(newMetrics.submissionTime, {
  //         node_id: this.nodeId,
  //         metric_type: 'submission_time',
  //       })
  //     }

  //     if (newMetrics.memoryUsage !== undefined && this.memoryUsageGauge) {
  //       this.memoryUsageGauge.add(newMetrics.memoryUsage, {
  //         node_id: this.nodeId,
  //         metric_type: 'memory_usage',
  //       })
  //     }

  //     if (newMetrics.cpuUsage !== undefined && this.cpuUsageGauge) {
  //       this.cpuUsageGauge.add(newMetrics.cpuUsage, {
  //         node_id: this.nodeId,
  //         metric_type: 'cpu_usage',
  //       })
  //     }

  //     if (
  //       newMetrics.extrinsicCount !== undefined &&
  //       this.extrinsicCountCounter
  //     ) {
  //       this.extrinsicCountCounter.add(newMetrics.extrinsicCount, {
  //         node_id: this.nodeId,
  //         metric_type: 'extrinsic_count',
  //       })
  //     }

  //     if (
  //       newMetrics.workPackageCount !== undefined &&
  //       this.workPackageCountCounter
  //     ) {
  //       this.workPackageCountCounter.add(newMetrics.workPackageCount, {
  //         node_id: this.nodeId,
  //         metric_type: 'work_package_count',
  //       })
  //     }

  //     if (newMetrics.blockSize !== undefined && this.blockSizeHistogram) {
  //       this.blockSizeHistogram.record(newMetrics.blockSize, {
  //         node_id: this.nodeId,
  //         metric_type: 'block_size',
  //       })
  //     }
  //   } catch (error) {
  //     logger.warn('Failed to record metrics', {
  //       nodeId: this.nodeId,
  //       error: error instanceof Error ? error.message : String(error),
  //     })
  //   }
  // }

  /**
   * Record block creation with tracing and telemetry
   */
  // recordBlockCreation(
  //   blockNumber: number,
  //   metrics: Partial<BlockAuthoringMetrics>,
  //   headerHash?: Uint8Array,
  //   parentHeaderHash?: Uint8Array,
  // ): void {
  //   try {
  //     const span = this.tracer.startSpan('block_creation', {
  //       attributes: {
  //         'block.number': blockNumber,
  //         'node.id': this.nodeId,
  //       },
  //     })

  //     try {
  //       this.updateMetrics(metrics)
  //       if (this.blocksCreatedCounter) {
  //         this.blocksCreatedCounter.add(1, {
  //           node_id: this.nodeId,
  //           block_number: blockNumber.toString(),
  //         })
  //       }

  //       span.setStatus({ code: SpanStatusCode.OK })
  //       span.setAttributes({
  //         'block.creation_time_ms': Number(metrics.creationTime) || 0,
  //         'block.size_bytes': Number(metrics.blockSize) || 0,
  //         'block.extrinsic_count': Number(metrics.extrinsicCount) || 0,
  //       })

  //       logger.info('Block creation recorded', {
  //         nodeId: this.nodeId,
  //         blockNumber,
  //         metrics,
  //       })
  //     } catch (error) {
  //       span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) })
  //       span.recordException(error as Error)
  //       throw error
  //     } finally {
  //       span.end()
  //     }
  //   } catch (error) {
  //     logger.warn('Failed to record block creation trace', {
  //       nodeId: this.nodeId,
  //       blockNumber,
  //       error: error instanceof Error ? error.message : String(error),
  //     })
  //     // Fallback to just updating metrics without tracing
  //     this.updateMetrics(metrics)
  //   }
  // }

  // /**
  //  * Record block submission with tracing
  //  */
  // recordBlockSubmission(
  //   blockNumber: number,
  //   success: boolean,
  //   metrics: Partial<BlockAuthoringMetrics>,
  // ): void {
  //   try {
  //     const span = this.tracer.startSpan('block_submission', {
  //       attributes: {
  //         'block.number': blockNumber,
  //         'node.id': this.nodeId,
  //         'submission.success': success,
  //       },
  //     })

  //     try {
  //       this.updateMetrics(metrics)

  //       if (success && this.blocksSubmittedCounter) {
  //         this.blocksSubmittedCounter.add(1, {
  //           node_id: this.nodeId,
  //           block_number: blockNumber.toString(),
  //         })
  //       } else if (!success && this.blocksFailedCounter) {
  //         this.blocksFailedCounter.add(1, {
  //           node_id: this.nodeId,
  //           block_number: blockNumber.toString(),
  //         })
  //       }

  //       span.setStatus({
  //         code: success ? SpanStatusCode.OK : SpanStatusCode.ERROR,
  //       })
  //       span.setAttributes({
  //         'block.submission_time_ms': Number(metrics.submissionTime) || 0,
  //       })

  //       logger.info('Block submission recorded', {
  //         nodeId: this.nodeId,
  //         blockNumber,
  //         success,
  //         metrics,
  //       })
  //     } catch (error) {
  //       span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) })
  //       span.recordException(error as Error)
  //       throw error
  //     } finally {
  //       span.end()
  //     }
  //   } catch (error) {
  //     logger.warn('Failed to record block submission trace', {
  //       nodeId: this.nodeId,
  //       blockNumber,
  //       success,
  //       error: error instanceof Error ? error.message : String(error),
  //     })
  //     // Fallback to just updating metrics without tracing
  //     this.updateMetrics(metrics)
  //   }
  // }

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
}
