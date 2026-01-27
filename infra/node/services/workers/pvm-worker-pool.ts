import { cpus } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { blake2bHash, logger } from '@pbnjam/core'
import type {
  AccumulateInput,
  AccumulateInvocationResult,
  PartialState,
  ResultCode,
  ServiceAccount,
  WorkError,
} from '@pbnjam/types'

export interface WorkerData {
  configMode:
    | 'tiny'
    | 'small'
    | 'medium'
    | 'large'
    | 'xlarge'
    | '2xlarge'
    | '3xlarge'
    | 'full'
  traceSubfolder?: string
}

/**
 * Worker pool for parallel PVM accumulation invocations
 *
 * Manages a pool of worker threads to execute accumulate invocations in parallel.
 * Uses a simple queue-based approach where tasks are assigned to available workers.
 */
export class PVMWorkerPool {
  private workers: Worker[] = []
  private availableWorkers: Worker[] = []
  private taskQueue: Array<{
    task: WorkerTask
    resolve: (result: AccumulateInvocationResult) => void
    reject: (error: Error) => void
  }> = []
  private readonly maxWorkers: number
  private readonly workerData: WorkerData
  private isShuttingDown = false
  private isInitialized = false

  // Performance metrics
  private taskStartTimes = new Map<string, number>()
  private totalTasksCompleted = 0
  private totalTasksFailed = 0
  private totalExecutionTimeMs = 0
  private lastMetricsLogTime = Date.now()
  private tasksCompletedSinceLastLog = 0
  private tasksFailedSinceLastLog = 0
  private readonly metricsLogIntervalMs = 10000 // Log aggregate metrics every 10 seconds

  /**
   * Create and initialize a new worker pool
   */
  static async create(
    workerData: WorkerData,
    maxWorkers = 4,
  ): Promise<PVMWorkerPool> {
    const pool = new PVMWorkerPool(workerData, maxWorkers)
    await pool.initializeWorkers()
    pool.isInitialized = true
    return pool
  }

  private constructor(workerData: WorkerData, maxWorkers = 4) {
    this.maxWorkers = Math.max(1, Math.min(maxWorkers, cpus().length))
    this.workerData = workerData
    logger.info('[PVMWorkerPool] Initializing worker pool', {
      maxWorkers: this.maxWorkers,
    })
  }

  /**
   * Initialize all workers upfront
   */
  private async initializeWorkers(): Promise<void> {
    const initStart = Date.now()
    logger.info('[PVMWorkerPool] Starting worker initialization', {
      maxWorkers: this.maxWorkers,
    })
    const workerPromises: Promise<Worker>[] = []
    for (let i = 0; i < this.maxWorkers; i++) {
      workerPromises.push(this.createWorker())
    }
    await Promise.all(workerPromises)
    const initTime = Date.now() - initStart
    logger.info('[PVMWorkerPool] All workers initialized', {
      workerCount: this.workers.length,
      initializationTimeMs: initTime,
    })
  }

  /**
   * Ensure the pool is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        'Worker pool is not initialized. Use PVMWorkerPool.create() to create a pool.',
      )
    }
  }

  /**
   * Execute an accumulate invocation in a worker thread
   * @param options.entropyAccumulator - Main process entropy (32 bytes). When provided, worker uses it so implications/gas match in-process.
   */
  async execute(
    partialState: PartialState,
    currentSlot: bigint,
    serviceId: bigint,
    gasLimit: bigint,
    inputs: AccumulateInput[],
    invocationIndex: number,
    options?: { entropyAccumulator?: Uint8Array },
  ): Promise<AccumulateInvocationResult> {
    this.ensureInitialized()
    if (this.isShuttingDown) {
      throw new Error('Worker pool is shutting down')
    }

    return new Promise((resolve, reject) => {
      const task: WorkerTask = {
        partialState: serializePartialState(partialState),
        currentSlot: currentSlot.toString(),
        serviceId: serviceId.toString(),
        gasLimit: gasLimit.toString(),
        inputs: serializeInputs(inputs),
        invocationIndex,
        entropyAccumulator: options?.entropyAccumulator
          ? { data: Array.from(options.entropyAccumulator) }
          : undefined,
      }

      // If we have available workers, execute immediately
      if (this.availableWorkers.length > 0) {
        const worker = this.availableWorkers.pop()
        if (worker) {
          this.executeTask(worker, task, resolve, reject)
        }
      } else {
        // All workers are busy, queue the task
        logger.debug('[PVMWorkerPool] Queueing task', {
          serviceId: task.serviceId,
          invocationIndex: task.invocationIndex,
          queueDepth: this.taskQueue.length + 1,
          activeWorkers: this.workers.length - this.availableWorkers.length,
        })
        this.taskQueue.push({ task, resolve, reject })
      }
    })
  }

  private async createWorker(): Promise<Worker> {
    // Use __dirname equivalent for worker path
    // Note: Worker file needs to be compiled to JS or use tsx/ts-node loader
    let workerPath: string
    try {
      // Try ESM path resolution
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = dirname(__filename)
      workerPath = join(__dirname, 'pvm-worker.js')
    } catch {
      // Fallback - this shouldn't happen in ESM, but handle gracefully
      throw new Error('Failed to resolve worker path')
    }

    const worker = new Worker(workerPath, {
      workerData: this.workerData,
    })

    // Wait for worker to be ready before returning
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        worker.removeListener('message', messageHandler)
        worker.removeListener('error', errorHandler)
        reject(new Error('Worker failed to send ready message within timeout'))
      }, 10000) // 10 second timeout

      const messageHandler = (message: WorkerMessage) => {
        if (message.type === 'ready') {
          clearTimeout(timeout)
          worker.removeListener('error', errorHandler)
          this.availableWorkers.push(worker)
          logger.debug('[PVMWorkerPool] Worker ready', {
            totalWorkers: this.workers.length,
            availableWorkers: this.availableWorkers.length,
          })
          resolve()
        }
      }

      const errorHandler = (error: Error) => {
        clearTimeout(timeout)
        worker.removeListener('message', messageHandler)
        reject(error)
      }

      worker.once('message', messageHandler)
      worker.once('error', errorHandler)
    })

    // Set up ongoing message handlers after ready
    worker.on('message', (message: WorkerMessage) => {
      if (message.type === 'result') {
        // Worker is done, make it available again
        this.availableWorkers.push(worker)
        this.processQueue()
      } else if (message.type === 'error') {
        // Worker encountered an error, remove it and create a new one
        this.removeWorker(worker)
        this.processQueue()
      }
    })

    worker.on('error', (error) => {
      logger.error('[PVMWorkerPool] Worker error', { error: error.message })
      this.removeWorker(worker)
      this.processQueue()
    })

    worker.on('exit', (code) => {
      if (code !== 0) {
        logger.warn('[PVMWorkerPool] Worker exited with code', { code })
      }
      this.removeWorker(worker)
    })

    this.workers.push(worker)
    return worker
  }

  private executeTask(
    worker: Worker,
    task: WorkerTask,
    resolve: (result: AccumulateInvocationResult) => void,
    reject: (error: Error) => void,
  ): void {
    const messageId = `${Date.now()}-${Math.random()}`
    const startTime = Date.now()
    this.taskStartTimes.set(messageId, startTime)

    logger.debug('[PVMWorkerPool] Executing task', {
      messageId,
      serviceId: task.serviceId,
      invocationIndex: task.invocationIndex,
      inputsCount: task.inputs.length,
      gasLimit: task.gasLimit,
      queueDepth: this.taskQueue.length,
      availableWorkers: this.availableWorkers.length,
    })

    const messageHandler = (message: WorkerMessage) => {
      if (message.type === 'result' && message.messageId === messageId) {
        worker.removeListener('message', messageHandler)
        const executionTime = Date.now() - startTime
        this.taskStartTimes.delete(messageId)
        this.totalExecutionTimeMs += executionTime

        // Log detailed metrics for each task
        if (message.metrics) {
          logger.info('[PVMWorkerPool] Task completed', {
            serviceId: message.metrics.serviceId,
            invocationIndex: message.metrics.invocationIndex,
            inputsCount: message.metrics.inputsCount,
            gasLimit: message.metrics.gasLimit,
            deserializeTimeMs: message.metrics.deserializeTimeMs,
            executeTimeMs: message.metrics.executeTimeMs,
            serializeTimeMs: message.metrics.serializeTimeMs,
            workerTotalTimeMs: message.metrics.totalTimeMs,
            poolOverheadMs: executionTime - message.metrics.totalTimeMs,
            totalTimeMs: executionTime,
          })
        } else {
          // Fallback if metrics not available
          logger.info('[PVMWorkerPool] Task completed (no metrics)', {
            executionTimeMs: executionTime,
          })
        }

        if (message.error) {
          this.totalTasksFailed++
          this.tasksFailedSinceLastLog++
          reject(new Error(message.error))
        } else if (message.result) {
          this.totalTasksCompleted++
          this.tasksCompletedSinceLastLog++
          this.logMetricsIfNeeded()
          resolve(deserializeResult(message.result))
        } else {
          this.totalTasksFailed++
          this.tasksFailedSinceLastLog++
          reject(new Error('Worker returned result without data'))
        }
      } else if (message.type === 'error' && message.messageId === messageId) {
        worker.removeListener('message', messageHandler)
        const executionTime = Date.now() - startTime
        this.taskStartTimes.delete(messageId)
        this.totalTasksFailed++
        this.tasksFailedSinceLastLog++
        this.totalExecutionTimeMs += executionTime
        this.logMetricsIfNeeded()
        reject(new Error(message.error || 'Unknown worker error'))
      }
    }

    worker.on('message', messageHandler)
    worker.postMessage({
      type: 'execute',
      messageId,
      task,
    })
  }

  /**
   * Log performance metrics periodically
   */
  private logMetricsIfNeeded(): void {
    const now = Date.now()
    const timeSinceLastLog = now - this.lastMetricsLogTime

    if (timeSinceLastLog >= this.metricsLogIntervalMs) {
      const totalTasks = this.totalTasksCompleted + this.totalTasksFailed
      const tasksInInterval =
        this.tasksCompletedSinceLastLog + this.tasksFailedSinceLastLog
      const avgExecutionTime =
        totalTasks > 0 ? this.totalExecutionTimeMs / totalTasks : 0
      const activeWorkers = this.workers.length - this.availableWorkers.length
      const utilization =
        this.workers.length > 0
          ? (activeWorkers / this.workers.length) * 100
          : 0
      const tasksPerSecond =
        timeSinceLastLog > 0 ? tasksInInterval / (timeSinceLastLog / 1000) : 0

      logger.info('[PVMWorkerPool] Aggregate performance metrics', {
        totalTasksCompleted: this.totalTasksCompleted,
        totalTasksFailed: this.totalTasksFailed,
        totalTasks: totalTasks,
        tasksCompletedInInterval: this.tasksCompletedSinceLastLog,
        tasksFailedInInterval: this.tasksFailedSinceLastLog,
        tasksInInterval,
        averageExecutionTimeMs: Math.round(avgExecutionTime),
        queueDepth: this.taskQueue.length,
        activeWorkers,
        availableWorkers: this.availableWorkers.length,
        totalWorkers: this.workers.length,
        utilizationPercent: Math.round(utilization * 100) / 100,
        tasksPerSecond: Math.round(tasksPerSecond * 100) / 100,
        pendingTasks: this.taskStartTimes.size,
        intervalDurationMs: timeSinceLastLog,
      })

      // Reset interval counters
      this.tasksCompletedSinceLastLog = 0
      this.tasksFailedSinceLastLog = 0
      this.lastMetricsLogTime = now
    }
  }

  private processQueue(): void {
    if (this.taskQueue.length === 0 || this.availableWorkers.length === 0) {
      return
    }

    const taskItem = this.taskQueue.shift()
    const worker = this.availableWorkers.pop()
    if (taskItem && worker) {
      this.executeTask(worker, taskItem.task, taskItem.resolve, taskItem.reject)
    }
  }

  private removeWorker(worker: Worker): void {
    const index = this.workers.indexOf(worker)
    if (index !== -1) {
      this.workers.splice(index, 1)
    }
    const availableIndex = this.availableWorkers.indexOf(worker)
    if (availableIndex !== -1) {
      this.availableWorkers.splice(availableIndex, 1)
    }
    worker.terminate().catch((err) => {
      logger.warn('[PVMWorkerPool] Error terminating worker', {
        error: err.message,
      })
    })
  }

  /**
   * Shutdown the worker pool gracefully
   */
  async shutdown(): Promise<void> {
    this.ensureInitialized()
    this.isShuttingDown = true
    logger.info('[PVMWorkerPool] Shutting down worker pool', {
      activeWorkers: this.workers.length,
      queuedTasks: this.taskQueue.length,
    })

    // Reject all queued tasks
    for (const { reject } of this.taskQueue) {
      reject(new Error('Worker pool is shutting down'))
    }
    this.taskQueue = []

    // Terminate all workers
    await Promise.all(
      this.workers.map((worker) => worker.terminate().catch(() => {})),
    )
    this.workers = []
    this.availableWorkers = []
  }
}

// Serialization helpers
interface SerializedPartialState {
  accounts: [string, SerializedServiceAccount][]
  stagingset: { data: number[] }[]
  authqueue: { data: number[] }[][]
  manager: string
  assigners: string[]
  delegator: string
  registrar: string
  alwaysaccers: [string, string][]
}

interface SerializedServiceAccount {
  codehash: string
  balance: string
  minaccgas: string
  minmemogas: string
  octets: string
  gratis: string
  items: string
  created: string
  lastacc: string
  parent: string
  rawCshKeyvals: Record<string, string>
}

interface WorkerTask {
  partialState: SerializedPartialState
  currentSlot: string
  serviceId: string
  gasLimit: string
  inputs: SerializedAccumulateInput[]
  invocationIndex: number
  /** Main process entropy accumulator (32 bytes). When set, worker uses this for implications so gas matches in-process. */
  entropyAccumulator?: { data: number[] }
}

interface SerializedAccumulateInput {
  type: 0 | 1
  value: unknown
}

interface WorkerMessage {
  type: 'ready' | 'result' | 'error' | 'execute'
  messageId?: string
  task?: WorkerTask
  result?: SerializedAccumulateInvocationResult
  error?: string
  metrics?: {
    deserializeTimeMs: number
    executeTimeMs: number
    serializeTimeMs: number
    totalTimeMs: number
    serviceId: string
    invocationIndex: number
    inputsCount: number
    gasLimit: string
    /** Same hash as main process for round-trip comparison */
    inputsHash?: string
    /** First type-0 input: result byte length (WorkExecutionResult = Uint8Array) */
    resultByteLength?: number
    /** First type-0 input: authTrace byte length */
    authTraceByteLength?: number
  }
}

/** Round-trip summary for inputs (result/authTrace lengths of first type-0 input). */
export interface InputsRoundTripSummary {
  inputsHash: string
  resultByteLength: number | undefined
  authTraceByteLength: number | undefined
}

interface SerializedAccumulateInvocationResult {
  ok: boolean
  value?: {
    poststate: SerializedPartialState
    gasused: string
    defxfers: SerializedDeferredTransfer[]
    yield?: { data: number[] } | null
    provisions: [string, { data: number[] }][]
    resultCode: string
  }
  err?: string
}

interface SerializedDeferredTransfer {
  source: string
  dest: string
  amount: string
  memo: { data: number[] }
  gasLimit: string
}

export function serializePartialState(
  state: PartialState,
): SerializedPartialState {
  return {
    accounts: Array.from(state.accounts.entries()).map(([id, account]) => [
      id.toString(),
      {
        codehash: account.codehash,
        balance: account.balance.toString(),
        minaccgas: account.minaccgas.toString(),
        minmemogas: account.minmemogas.toString(),
        octets: account.octets.toString(),
        gratis: account.gratis.toString(),
        items: account.items.toString(),
        created: account.created.toString(),
        lastacc: account.lastacc.toString(),
        parent: account.parent.toString(),
        rawCshKeyvals: account.rawCshKeyvals,
      },
    ]),
    stagingset: state.stagingset.map((arr) => ({ data: Array.from(arr) })),
    authqueue: state.authqueue.map((queue) =>
      queue.map((item) => ({ data: Array.from(item) })),
    ),
    manager: state.manager.toString(),
    assigners: state.assigners.map((id) => id.toString()),
    delegator: state.delegator.toString(),
    registrar: state.registrar.toString(),
    alwaysaccers: Array.from(state.alwaysaccers.entries()).map(([id, gas]) => [
      id.toString(),
      gas.toString(),
    ]),
  }
}

/**
 * Hash inputs for round-trip comparison (main vs worker). Same formula as accumulation-service mismatch log.
 */
export function computeInputsHash(inputs: AccumulateInput[]): string {
  if (inputs.length === 0) return 'no-inputs'
  const payload = inputs.map((i) =>
    i.type === 0
      ? [
          i.type,
          i.value.packageHash,
          i.value.gasLimit.toString(),
          (i.value as { result?: Uint8Array }).result?.length ?? 0,
        ]
      : [
          i.type,
          i.value.source.toString(),
          i.value.dest.toString(),
          i.value.amount.toString(),
        ],
  )
  const [err, hash] = blake2bHash(
    new TextEncoder().encode(JSON.stringify(payload)),
  )
  return err ? 'hash-failed' : (hash as string)
}

/**
 * Round-trip summary for first type-0 input: result and authTrace byte lengths.
 */
export function computeInputsRoundTripSummary(
  inputs: AccumulateInput[],
): InputsRoundTripSummary {
  const firstType0 = inputs.find((i) => i.type === 0)
  const resultByteLength =
    firstType0 && firstType0.type === 0
      ? ((firstType0.value as { result?: Uint8Array }).result?.length ??
        undefined)
      : undefined
  const authTraceByteLength =
    firstType0 && firstType0.type === 0
      ? ((firstType0.value as { authTrace: Uint8Array }).authTrace?.length ??
        undefined)
      : undefined
  return {
    inputsHash: computeInputsHash(inputs),
    resultByteLength,
    authTraceByteLength,
  }
}

export function serializeInputs(
  inputs: AccumulateInput[],
): SerializedAccumulateInput[] {
  return inputs.map((input) => {
    if (input.type === 0) {
      // OperandTuple
      return {
        type: 0,
        value: {
          packageHash: input.value.packageHash,
          segmentRoot: input.value.segmentRoot,
          authorizer: input.value.authorizer,
          payloadHash: input.value.payloadHash,
          gasLimit: input.value.gasLimit.toString(),
          result: input.value.result,
          authTrace: { data: Array.from(input.value.authTrace) },
        },
      }
    } else {
      // DeferredTransfer
      return {
        type: 1,
        value: {
          source: input.value.source.toString(),
          dest: input.value.dest.toString(),
          amount: input.value.amount.toString(),
          memo: { data: Array.from(input.value.memo) },
          gasLimit: input.value.gasLimit.toString(),
        },
      }
    }
  })
}

export function deserializeResult(
  serialized: SerializedAccumulateInvocationResult,
): AccumulateInvocationResult {
  if (!serialized.ok) {
    return {
      ok: false,
      err: (serialized.err as WorkError) || 'PANIC',
    }
  }

  if (!serialized.value) {
    throw new Error('Serialized result missing value')
  }

  // Deserialize poststate
  const poststate = deserializePartialState(serialized.value.poststate)

  return {
    ok: true,
    value: {
      poststate,
      gasused: BigInt(serialized.value.gasused),
      defxfers: serialized.value.defxfers.map((d) => ({
        source: BigInt(d.source),
        dest: BigInt(d.dest),
        amount: BigInt(d.amount),
        memo: new Uint8Array(d.memo.data),
        gasLimit: BigInt(d.gasLimit),
      })),
      yield: serialized.value.yield
        ? new Uint8Array(serialized.value.yield.data)
        : null,
      provisions: new Set(
        serialized.value.provisions.map(([sid, blob]) => [
          BigInt(sid),
          new Uint8Array(blob.data),
        ]),
      ),
      resultCode: Number.parseInt(
        serialized.value.resultCode,
        10,
      ) as ResultCode,
    },
  }
}

export function deserializePartialState(
  serialized: SerializedPartialState,
): PartialState {
  return {
    accounts: new Map(
      serialized.accounts.map(([id, account]) => [
        BigInt(id),
        {
          codehash: account.codehash,
          balance: BigInt(account.balance),
          minaccgas: BigInt(account.minaccgas),
          minmemogas: BigInt(account.minmemogas),
          octets: BigInt(account.octets),
          gratis: BigInt(account.gratis),
          items: BigInt(account.items),
          created: BigInt(account.created),
          lastacc: BigInt(account.lastacc),
          parent: BigInt(account.parent),
          rawCshKeyvals: account.rawCshKeyvals,
        } as ServiceAccount,
      ]),
    ),
    stagingset: serialized.stagingset.map((arr) => new Uint8Array(arr.data)),
    authqueue: serialized.authqueue.map((queue) =>
      queue.map((item) => new Uint8Array(item.data)),
    ),
    manager: BigInt(serialized.manager),
    assigners: serialized.assigners.map((id) => BigInt(id)),
    delegator: BigInt(serialized.delegator),
    registrar: BigInt(serialized.registrar),
    alwaysaccers: new Map(
      serialized.alwaysaccers.map(([id, gas]) => [BigInt(id), BigInt(gas)]),
    ),
  }
}
