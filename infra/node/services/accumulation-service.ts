/**
 * Accumulation Service
 *
 * Orchestrates the complete accumulation process according to Gray Paper specifications.
 * This service coordinates the flow from ready work-reports to accumulated packages.
 *
 * Gray Paper Reference: accumulation.tex (Equations 37-88)
 * The accumulation process involves:
 * 1. Dependency resolution: Check if work-reports have fulfilled dependencies
 * 2. Work-report processing: Execute PVM accumulate invocations
 * 3. State updates: Update service accounts and accumulated history
 * 4. Queue management: Clean up processed work-reports from ready queue
 *
 * Based on analysis of accumulate_ready_queued_reports-1.json test vector:
 * - Pre-state: 1 work-report waiting for dependency in ready queue
 * - Post-state: 9 work-packages accumulated, ready queue empty
 * - Service account updated with new storage and metadata
 */

import { cpus } from 'node:os'
import {
  applyAccumulationResultsToState,
  applyPrivilegesWithRFunction,
  buildAndEditQueue,
  calculateAvailableGas,
  calculateServiceGasLimit,
  calculateTotalGasUsed,
  clonePartialState,
  collectAllReadyItems,
  collectDefxfersFromResults,
  convertWorkResultToExecutionResult,
  createPartialStateSnapshot,
  extractPackageHashes,
  filterReadyItemDependencies,
  finalizeSlot,
  findItemsWithinGasLimit,
  getAccumulatableItemsQ,
  groupItemsByServiceId,
  separateReportsIntoImmediateAndQueued,
  shiftStateForBlockTransition,
  trackAccumulationOutput,
  trackAccumulationStatistics,
  trackOnTransfersStatistics,
  validateWorkReportGasConstraints,
} from '@pbnjam/accumulate'
import { calculateWorkReportHash } from '@pbnjam/codec'
import { hexToBytes, logger } from '@pbnjam/core'
import type { AccumulatePVM } from '@pbnjam/pvm-invocations'
import type { IEntropyService } from '@pbnjam/types'
import {
  type Accumulated,
  type AccumulateInput,
  type AccumulateInvocationResult,
  BaseService,
  type DeferredTransfer,
  type PartialState,
  type Ready,
  type ReadyItem,
  type SafePromise,
  safeResult,
  type WorkReport,
} from '@pbnjam/types'
import type { Hex } from 'viem'
import type { AuthQueueService } from './auth-queue-service'
import type { ConfigService } from './config-service'

/** Result of one accumulation loop iteration: either done (break) or updated loop state. */
type AccumulationIterationResult =
  | { done: true }
  | {
      done: false
      processedImmediateHashes: Set<Hex>
      pendingDefxfers: DeferredTransfer[]
      totalGasUsed: bigint
      batchInvocationIndex: number
    }

/** Descriptor for a single accumulation invocation within a batch (Gray Paper accpar). */
type BatchInvocationDescriptor = {
  serviceId: bigint
  partialState: PartialState
  inputs: AccumulateInput[]
  gasLimit: bigint
  serviceWorkReports: WorkReport[]
  serviceIndexInBatch: number
  partialStateServiceIds: Set<bigint>
}

import type { PrivilegesService } from './privileges-service'
import type { ReadyService } from './ready-service'
import type { ServiceAccountService as ServiceAccountsService } from './service-account-service'
import type { StatisticsService } from './statistics-service'
import type { ValidatorSetManager } from './validator-set'
import { PVMWorkerPool } from './workers/pvm-worker-pool'

/**
 * Accumulation Service Implementation
 */
export class AccumulationService extends BaseService {
  public accumulated: Accumulated
  private readonly configService: ConfigService
  private readonly serviceAccountsService: ServiceAccountsService
  private readonly privilegesService: PrivilegesService
  private readonly validatorSetManager: ValidatorSetManager
  private readonly accumulatePVM: AccumulatePVM
  private readonly authQueueService: AuthQueueService
  private readonly readyService: ReadyService
  private readonly statisticsService: StatisticsService
  private readonly useWorkerPool: boolean
  private readonly traceSubfolder: string | undefined
  /** When useWorkerPool, required so worker receives main-process entropy and gas matches in-process. */
  private readonly entropyService: IEntropyService | undefined
  private workerPool: PVMWorkerPool | null = null
  // Track the last processed slot (for determining shift delta)
  private lastProcessedSlot: bigint | null = null
  // Track local_fnservouts (accumulation output pairings) for the latest accumulation
  // Gray Paper equation 201-207: local_fnservouts ≡ { (s, b) : s ∈ s, b = acc(s).yield, b ≠ none }
  // Gray Paper: lastaccout' ∈ sequence{tuple{serviceid, hash}}
  private accumulationOutputs: [bigint, Hex][] = []
  // Track accumulation statistics per service: tuple{count, gas}
  // Gray Paper: accumulationstatistics[s] = tuple{N, gas}
  // This tracks the count and total gas used for accumulations per service
  private accumulationStatistics: Map<bigint, [number, number]> = new Map()
  // Track onTransfers statistics per service: tuple{count, gas}
  // This tracks the count of deferred transfers received and gas used processing them
  private onTransfersStatistics: Map<bigint, [number, number]> = new Map()
  // Track package hashes of new queued items for slot m (justbecameavailable^Q)
  // Used by finalizeSlot to ensure only new queued items remain in slot m
  private newQueuedItemsForSlotM: Set<Hex> = new Set()
  // Gray Paper equation 410-412: lastacc is updated AFTER all accumulation iterations complete
  // This set tracks services that were accumulated and need lastacc update at the end
  // We defer this update to avoid affecting partial state snapshots in subsequent iterations
  private accumulatedServicesForLastacc: Set<bigint> = new Set()
  constructor(options: {
    configService: ConfigService
    serviceAccountsService: ServiceAccountsService
    privilegesService: PrivilegesService
    validatorSetManager: ValidatorSetManager
    authQueueService: AuthQueueService
    accumulatePVM: AccumulatePVM
    readyService: ReadyService
    statisticsService: StatisticsService
    useWorkerPool: boolean
    traceSubfolder?: string
    entropyService?: IEntropyService
  }) {
    super('accumulation-service')
    this.accumulatePVM = options.accumulatePVM
    this.traceSubfolder = options.traceSubfolder
    this.accumulated = {
      packages: new Array(options.configService.epochDuration).fill(
        new Set<Hex>(),
      ),
    }
    this.serviceAccountsService = options.serviceAccountsService
    this.privilegesService = options.privilegesService
    this.validatorSetManager = options.validatorSetManager
    this.configService = options.configService
    this.authQueueService = options.authQueueService
    this.readyService = options.readyService
    this.statisticsService = options.statisticsService
    this.useWorkerPool = options.useWorkerPool
    this.entropyService = options.entropyService
    // Worker pool will be initialized in start() method if useWorkerPool is enabled
    if (this.useWorkerPool) {
      if (!this.entropyService) {
        throw new Error('entropyService is required when useWorkerPool is true')
      }
      logger.info(
        '[AccumulationService] constructed with useWorkerPool and entropyService',
      )
    }
  }

  /**
   * Start the accumulation service
   * Initializes the worker pool if useWorkerPool is enabled
   */
  async start(): SafePromise<boolean> {
    super.start()

    // Initialize worker pool if enabled
    if (this.useWorkerPool) {
      const workerPoolMaxWorkers = Math.min(8, cpus().length)
      this.workerPool = await PVMWorkerPool.create(
        {
          configMode: this.configService._mode,
          traceSubfolder: this.traceSubfolder,
        },
        workerPoolMaxWorkers,
      )
      logger.info('[AccumulationService] Worker pool initialized', {
        workerPoolMaxWorkers,
      })
    }

    return safeResult(true)
  }

  /**
   * Stop the accumulation service and shut down the worker pool when enabled
   */
  async stop(): SafePromise<boolean> {
    if (this.workerPool !== null) {
      await this.workerPool.shutdown()
      this.workerPool = null
    }
    super.stop()
    return safeResult(true)
  }

  /**
   * Get last accumulation outputs
   *
   * Gray Paper: local_fnservouts ≡ protoset{tuple{serviceid, hash}}
   * Returns the accumulation output pairings (lastaccout') from the most recent accumulation.
   *
   * @returns Map of serviceId -> hash from the latest accumulation
   *          Returns a default Map with zeroHash if no accumulation outputs exist
   */
  getLastAccumulationOutputs(): [bigint, Hex][] {
    // Gray Paper: lastaccout' ≡ ⟦(s, h) ∈ b⟧ where b is a SET
    // Sets are ordered by their key (service ID) in ascending order
    // So we must sort by service ID before returning
    return [...this.accumulationOutputs].sort((a, b) => {
      if (a[0] < b[0]) return -1
      if (a[0] > b[0]) return 1
      return 0
    })
  }

  /**
   * Get accumulation statistics per service
   *
   * Gray Paper: accumulationstatistics[s] = tuple{N, gas}
   * Returns the count and total gas used for accumulations per service.
   *
   * @returns Map of serviceId -> [count, gas] tuple
   */
  getAccumulationStatistics(): Map<bigint, [number, number]> {
    return new Map(this.accumulationStatistics) // Return copy to prevent mutation
  }

  /**
   * Clear accumulation outputs (for cleanup)
   */
  clearAccumulationOutputs(): void {
    this.accumulationOutputs = []
  }

  /**
   * Get current ready state
   */
  getReady(): Ready {
    return this.readyService.getReady()
  }

  /**
   * Set ready state
   */
  setReady(ready: Ready): void {
    this.readyService.setReady(ready)
  }

  /**
   * Get accumulated state
   */
  getAccumulated(): Accumulated {
    // Ensure accumulated is properly initialized
    if (!this.accumulated || !this.accumulated.packages) {
      this.accumulated = {
        packages: new Array(this.configService.epochDuration)
          .fill(null)
          .map(() => new Set<Hex>()),
      }
    }

    return this.accumulated
  }

  /**
   * Set accumulated state
   */
  setAccumulated(accumulated: Accumulated): void {
    this.accumulated = accumulated
  }

  /**
   * Get last processed slot (the slot that the current accumulated/ready state represents)
   */
  getLastProcessedSlot(): bigint | null {
    return this.lastProcessedSlot
  }

  /**
   * Set last processed slot (the slot that the current accumulated/ready state represents)
   */
  setLastProcessedSlot(slot: bigint | null): void {
    this.lastProcessedSlot = slot
  }

  setLastAccumulationOutputs(lastAccumulationOutputs: [bigint, Hex][]): void {
    this.accumulationOutputs = [...lastAccumulationOutputs]
  }

  getReadyItem(workReportHash: Hex): ReadyItem | undefined {
    return this.readyService.getReadyItem(workReportHash)
  }

  /**
   * Remove a specific dependency from a ready item
   */
  removeDependency(workReportHash: Hex, dependencyHash: Hex): void {
    this.readyService.removeDependency(workReportHash, dependencyHash)
  }

  /**
   * Add a dependency to a ready item
   */
  addDependency(workReportHash: Hex, dependencyHash: Hex): void {
    this.readyService.addDependency(workReportHash, dependencyHash)
  }

  /**
   * Main accumulation processing method
   *
   * This method implements the complete accumulation flow as observed in the test vector:
   * 1. Calculate total gas limit (Gray Paper equation 350-353)
   * 2. Extract ready work-reports from current slot
   * 3. Resolve dependencies against accumulated history
   * 4. Process eligible work-reports through PVM (sequential, gas-limited)
   * 5. Update global state with results
   * 6. Clean up processed work-reports from ready queue
   */
  async processAccumulation(
    currentSlot: bigint,
    immediateItems: readonly ReadyItem[] = [], // Gray Paper justbecameavailable^! - prepended to ready queue items
  ): Promise<void> {
    // Gray Paper: E function removes dependencies that are in accumulatedcup
    filterReadyItemDependencies(
      this.readyService,
      this.accumulated,
      this.configService,
    )

    // Ensure accumulated.packages array is initialized
    this.ensureAccumulatedPackagesInitialized()

    // Track defxfers across iterations (Gray Paper equation 166: accseq recursively passes 𝐭*)
    // Start with defxfers from immediate accumulation
    let pendingDefxfers: DeferredTransfer[] = []

    // Track total gas used across all accumulations (Gray Paper: accseq tracks gas consumption)
    // Gray Paper equation 163: i = max prefix such that sum(gaslimit) ≤ g
    let totalGasUsed = 0n

    // Track which immediate items have been accumulated (prepend only unprocessed on each iteration).
    // Updated each iteration and passed into the next run.
    let processedImmediateHashes = new Set<Hex>()
    let batchInvocationIndex = 0

    // IMPORTANT: MAIN ACCUMULATION LOOP - DO NOT REMOVE THIS LOOP
    while (true) {
      const outcome = await this.runAccumulationIteration(
        currentSlot,
        immediateItems,
        processedImmediateHashes,
        pendingDefxfers,
        totalGasUsed,
        batchInvocationIndex,
      )
      if (outcome.done) break
      processedImmediateHashes = outcome.processedImmediateHashes
      pendingDefxfers = outcome.pendingDefxfers
      totalGasUsed = outcome.totalGasUsed
      batchInvocationIndex = outcome.batchInvocationIndex
    }
  }

  /**
   * One iteration of the accumulation loop: collect ready items, pick prefix within gas,
   * run batch invocations, update global state. Returns done: true when nothing to do
   * (loop should break); otherwise returns updated loop state for next iteration.
   */
  private async runAccumulationIteration(
    currentSlot: bigint,
    immediateItems: readonly ReadyItem[],
    processedImmediateHashes: Set<Hex>,
    pendingDefxfers: DeferredTransfer[],
    totalGasUsed: bigint,
    batchInvocationIndex: number,
  ): Promise<AccumulationIterationResult> {
    // Step 1: Collect all ready items from ALL slots (in rotated order: [m:] then [:m])
    // Gray Paper equation 89: q = E(concat{ready[m:]} concat concat{ready[:m]} concat justbecameavailable^Q, ...)
    // IMPORTANT: We must exclude justbecameavailable^Q (newQueuedItemsForSlotM) from the initial collection
    // because they are currently in ready[m] but must come AFTER all other ready items.
    const oldReadyItems = collectAllReadyItems(
      this.configService.epochDuration,
      currentSlot,
      this.readyService,
      this.newQueuedItemsForSlotM,
    )

    // Step 1b: Get justbecameavailable^Q items (new queued items for this slot)
    // These are in ready[m] but were excluded above. We need to append them at the end.
    const m = Number(currentSlot) % this.configService.epochDuration
    const slotMItems = this.readyService.getReadyItemsForSlot(BigInt(m))
    const newQueuedItems = slotMItems.filter((item) =>
      this.newQueuedItemsForSlotM.has(item.workReport.package_spec.hash),
    )

    // Combine: OldReady + NewQueued
    // This ensures correct order: Existing Ready Items -> New Queued Items
    const combinedQueue = [...oldReadyItems, ...newQueuedItems]

    // Step 2: Use Q function to get all currently accumulatable items from ready queue
    const readyQueueAccumulatable = getAccumulatableItemsQ(
      combinedQueue,
      this.accumulated,
    )

    // Step 3: Build justbecameavailable^* = unprocessed immediate^! concat Q(q)
    // Gray Paper equation 88: Immediate items are prepended to ready queue items.
    // Prepend only immediate items not yet accumulated, so each iteration gets [remaining immediate, ...ready].
    const unprocessedImmediate = immediateItems.filter((ii) => {
      const [hashErr, workReportHash] = calculateWorkReportHash(ii.workReport)
      return (
        !hashErr &&
        workReportHash &&
        !processedImmediateHashes.has(workReportHash)
      )
    })
    const accumulatableItems: ReadyItem[] = [
      ...unprocessedImmediate,
      ...readyQueueAccumulatable,
    ]

    if (accumulatableItems.length === 0 && pendingDefxfers.length === 0) {
      return { done: true }
    }

    // Step 3: Validate work-report gas constraints
    validateWorkReportGasConstraints(
      accumulatableItems,
      this.serviceAccountsService,
    )

    // Step 4: Find maximum prefix that fits within gas limit (Gray Paper equation 163, 167)
    const { availableGas } = calculateAvailableGas(
      BigInt(this.configService.maxBlockGas),
      pendingDefxfers,
      totalGasUsed,
    )

    const { prefixItems: batchItems } = findItemsWithinGasLimit(
      accumulatableItems,
      availableGas,
    )

    if (batchItems.length === 0 && pendingDefxfers.length === 0) {
      return { done: true }
    }

    // Step 5: Group prefix items by service ID
    const serviceToItems = groupItemsByServiceId(batchItems)

    const batchStartDefxfers = [...pendingDefxfers]
    const inputsByService = this.createAccumulateInputs(
      batchItems,
      batchStartDefxfers,
    )

    const batchPartialStateSnapshot = createPartialStateSnapshot(
      this.validatorSetManager,
      this.configService,
      this.serviceAccountsService,
      this.authQueueService,
      this.privilegesService,
    )

    const batchInvocations: BatchInvocationDescriptor[] = []
    let serviceIndexInBatch = 0
    for (const [serviceId, inputs] of inputsByService) {
      const serviceItems = serviceToItems.get(serviceId) || []
      const serviceWorkReports = serviceItems.map((item) => item.workReport)
      const partialState = clonePartialState(batchPartialStateSnapshot)
      const partialStateServiceIds = new Set<bigint>()
      for (const [sid] of partialState.accounts) {
        partialStateServiceIds.add(sid)
      }
      const gasLimit = calculateServiceGasLimit(
        serviceId,
        serviceItems,
        batchStartDefxfers,
        this.privilegesService,
      )
      batchInvocations.push({
        serviceId,
        partialState,
        inputs,
        gasLimit,
        serviceWorkReports,
        serviceIndexInBatch,
        partialStateServiceIds,
      })
      serviceIndexInBatch++
    }

    const {
      results,
      processedWorkReports,
      workReportsByService,
      partialStateAccountsPerInvocation,
      accumulatedServiceIds,
    } = await this.executeBatchInvocations(
      batchInvocations,
      currentSlot,
      batchInvocationIndex,
    )

    const iterationGasUsed = calculateTotalGasUsed(results)

    // Mark immediate items that were in this batch as processed (for next iteration's unprocessedImmediate)
    for (const wr of processedWorkReports) {
      const [hashErr, workReportHash] = calculateWorkReportHash(wr)
      if (hashErr || !workReportHash) continue
      const wasImmediate = immediateItems.some((ii) => {
        const [e, h] = calculateWorkReportHash(ii.workReport)
        return !e && h === workReportHash
      })
      if (wasImmediate) {
        processedImmediateHashes.add(workReportHash)
      }
    }

    this.updateGlobalState(
      results,
      processedWorkReports,
      workReportsByService,
      currentSlot,
      partialStateAccountsPerInvocation,
      accumulatedServiceIds,
    )

    return {
      done: false,
      processedImmediateHashes,
      pendingDefxfers: collectDefxfersFromResults(results),
      totalGasUsed: totalGasUsed + iterationGasUsed,
      batchInvocationIndex: batchInvocationIndex + 1,
    }
  }

  /**
   * Filter deferred transfers (type 1) from accumulate inputs.
   * Gray Paper: i^T = defxfers where dest = s; AccumulateInput type 1 = DeferredTransfer.
   */
  private filterDefxfersFromInputs(
    inputs: AccumulateInput[],
  ): DeferredTransfer[] {
    return inputs
      .filter(
        (inp): inp is Extract<AccumulateInput, { type: 1 }> => inp.type === 1,
      )
      .map((inp) => inp.value)
  }

  /**
   * Run all batch invocations (in-process or via worker pool), then fill results,
   * processedWorkReports, workReportsByService, accumulatedServiceIds, and
   * partialStateAccountsPerInvocation from the outcomes.
   */
  private async executeBatchInvocations(
    batchInvocations: BatchInvocationDescriptor[],
    currentSlot: bigint,
    batchInvocationIndex: number,
  ): Promise<{
    results: AccumulateInvocationResult[]
    processedWorkReports: WorkReport[]
    workReportsByService: Map<number, WorkReport[]>
    accumulatedServiceIds: bigint[]
    partialStateAccountsPerInvocation: Map<number, Set<bigint>>
  }> {
    const batchResults = await Promise.all(
      batchInvocations.map(async (inv, idx) => {
        const transfers = this.filterDefxfersFromInputs(inv.inputs).length
        const operands = inv.inputs.filter((inp) => inp.type === 0).length
        logger.info(
          `[accumulate] Accumulating service ${inv.serviceId}, transfers: ${transfers} operands: ${operands} at slot: ${currentSlot}`,
        )

        const isFirstInvocationOfBatch = idx === 0
        const useWorker =
          this.useWorkerPool &&
          this.workerPool !== null &&
          !isFirstInvocationOfBatch

        if (!useWorker) {
          return this.executeAccumulateInvocation(
            inv.partialState,
            currentSlot,
            inv.serviceId,
            inv.gasLimit,
            inv.inputs,
            batchInvocationIndex,
          )
        }

        if (!this.entropyService && this.useWorkerPool) {
          logger.warn(
            '[AccumulationService] useWorkerPool but no entropyService – worker gas may diverge',
            {
              serviceId: inv.serviceId.toString(),
              batchInvocationIndex,
            },
          )
        }
        const entropySnapshot = this.entropyService
          ?.getEntropyAccumulator()
          ?.slice(0)

        return this.workerPool!.execute(
          inv.partialState,
          currentSlot,
          inv.serviceId,
          inv.gasLimit,
          inv.inputs,
          batchInvocationIndex,
          entropySnapshot ? { entropyAccumulator: entropySnapshot } : undefined,
        )
      }),
    )

    const results: AccumulateInvocationResult[] = []
    const processedWorkReports: WorkReport[] = []
    const workReportsByService: Map<number, WorkReport[]> = new Map()
    const partialStateAccountsPerInvocation: Map<
      number,
      Set<bigint>
    > = new Map()
    const accumulatedServiceIds: bigint[] = []

    for (let i = 0; i < batchInvocations.length; i++) {
      const inv = batchInvocations[i]!
      const result = batchResults[i]!
      partialStateAccountsPerInvocation.set(
        batchInvocationIndex,
        inv.partialStateServiceIds,
      )
      const defxfersForService = this.filterDefxfersFromInputs(inv.inputs)
      const workItemCount = inv.inputs.filter((inp) => inp.type === 0).length
      if (defxfersForService.length > 0) {
        const gasUsed = result.ok ? result.value.gasused : 0n
        trackOnTransfersStatistics(
          inv.serviceId,
          defxfersForService.length,
          gasUsed,
          this.onTransfersStatistics,
          this.statisticsService,
        )
      }
      if (result.ok) {
        trackAccumulationOutput(
          inv.serviceId,
          result.value,
          this.accumulationOutputs,
        )
        const gasUsed = result.value.gasused
        if (workItemCount > 0 || gasUsed > 0n) {
          trackAccumulationStatistics(
            inv.serviceId,
            result.value,
            workItemCount,
            this.accumulationStatistics,
            this.statisticsService,
          )
        }
      }
      results.push(result)
      processedWorkReports.push(...inv.serviceWorkReports)
      workReportsByService.set(inv.serviceIndexInBatch, inv.serviceWorkReports)
      accumulatedServiceIds.push(inv.serviceId)
    }

    return {
      results,
      processedWorkReports,
      workReportsByService,
      accumulatedServiceIds,
      partialStateAccountsPerInvocation,
    }
  }

  /**
   * Ensure accumulated.packages array is initialized
   */
  private ensureAccumulatedPackagesInitialized(): void {
    if (!this.accumulated.packages) {
      this.accumulated.packages = new Array(this.configService.epochDuration)
        .fill(null)
        .map(() => new Set<Hex>())
    }
  }

  /**
   * Create accumulate inputs from ready items and pending defxfers
   *
   * Gray Paper equation 311-322:
   * - i^T = sequence of defxfers from t where dest = s (service being accumulated)
   * - i^U = sequence of operand tuples from work reports where service_id = s
   * - i = i^T concat i^U (defxfers first, then operand tuples)
   *
   * This method transforms work-reports into the format expected by the PVM
   * accumulate invocation according to Gray Paper specifications.
   *
   * @param readyItems - Work reports to process
   * @param pendingDefxfers - Defxfers from previous accumulations (Gray Paper: t)
   * @returns Map from serviceId to AccumulateInput[] (i^T concat i^U for each service), with keys in ascending order for deterministic iteration
   */
  createAccumulateInputs(
    readyItems: ReadyItem[],
    pendingDefxfers: DeferredTransfer[] = [],
  ): Map<bigint, AccumulateInput[]> {
    // Group inputs by service ID (Gray Paper: inputs per service s)
    const inputsByService = new Map<bigint, AccumulateInput[]>()

    // Step 1: Add defxfers (i^T) - Gray Paper equation 318-322
    // i^T = sequence of defxfers where dest = s
    for (const defxfer of pendingDefxfers) {
      const serviceId = defxfer.dest
      if (!inputsByService.has(serviceId)) {
        inputsByService.set(serviceId, [])
      }
      inputsByService.get(serviceId)!.push({
        type: 1, // DeferredTransfer type
        value: defxfer,
      })
    }

    // Step 2: Add operand tuples (i^U) - Gray Paper equation 323-338
    // i^U = sequence of operand tuples from work reports where service_id = s
    // IMPORTANT: A work report can have multiple results (one per work item)
    // Each result may have a different service_id and accumulate_gas
    // We must iterate through ALL results, not just the first one
    for (const item of readyItems) {
      const workReport = item.workReport
      if (!workReport.results || workReport.results.length === 0) {
        throw new Error('No results found for work report')
      }

      // Iterate through ALL results in the work report
      // Each result corresponds to one work item and may have different service_id
      for (const workResult of workReport.results) {
        const serviceId = workResult.service_id

        // Convert WorkExecResultValue to WorkExecutionResult
        const executionResult = convertWorkResultToExecutionResult(
          workResult.result,
        )

        // Create OperandTuple from work result
        // Gray Paper equation 323-338: i^U = sequence of operand tuples
        // ot_result = d_wd_result (from work digest)
        // ot_gaslimit = d_wd_gaslimit (from work digest)
        // ot_payloadhash = d_wd_payloadhash (from work digest)
        // ot_authtrace = r_wr_authtrace (from work report)
        // ot_segroot = (r_wr_avspec)_as_segroot (from work report's availability spec)
        // ot_packagehash = (r_wr_avspec)_as_packagehash (from work report's availability spec)
        // ot_authorizer = r_wr_authorizer (from work report)
        //
        // IMPORTANT: Gray Paper equation 329 specifies ot_segroot = (r_wr_avspec)_as_segroot
        // This is the segment root (exports_root), NOT the erasure root (erasure_root)
        const operandTuple = {
          packageHash: workReport.package_spec.hash, // (r_wr_avspec)_as_packagehash
          segmentRoot: workReport.package_spec.exports_root, // (r_wr_avspec)_as_segroot (FIXED: was erasure_root)
          authorizer: workReport.authorizer_hash, // r_wr_authorizer
          payloadHash: workResult.payload_hash, // d_wd_payloadhash
          gasLimit: workResult.accumulate_gas, // d_wd_gaslimit
          result: executionResult, // d_wd_result
          authTrace: hexToBytes(workReport.auth_output), // r_wr_authtrace
        }

        if (!inputsByService.has(serviceId)) {
          inputsByService.set(serviceId, [])
        }
        inputsByService.get(serviceId)!.push({
          type: 0, // OperandTuple type
          value: operandTuple,
        })
      }
    }

    return new Map(
      [...inputsByService.entries()].sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0,
      ),
    )
  }

  /**
   * Execute PVM accumulate invocation
   *
   * This method calls the PVM's executeAccumulate method with the provided
   * parameters. The PVM handles the actual instruction execution and state
   * transitions according to the Gray Paper specifications.
   */
  async executeAccumulateInvocation(
    partialState: PartialState,
    timeslot: bigint,
    serviceId: bigint,
    gas: bigint,
    inputs: AccumulateInput[],
    invocationIndex: number, // The batch invocation index (accseq iteration) - same for all services in a batch
    entropyOverride?: Uint8Array, // When provided (e.g. dual-run with worker), use so in-process and worker see same entropy
  ): Promise<AccumulateInvocationResult> {
    const result = await this.accumulatePVM.executeAccumulate(
      partialState,
      timeslot,
      serviceId,
      gas,
      inputs,
      invocationIndex,
      entropyOverride,
    )

    return result
  }

  /**
   * Apply accumulation state transition
   *
   * This method implements the accumulation state transition function:
   * 1. Enqueue new work reports to the ready queue with their dependencies
   * 2. Process accumulation for the given slot
   *
   * @param slot - The current slot to process
   * @param reports - Work reports to enqueue
   * @returns Safe<void> indicating success or error
   */
  async applyTransition(
    slot: bigint,
    reports: WorkReport[],
  ): Promise<{ ok: true } | { ok: false; err: Error }> {
    const transitionStartTime = performance.now()

    this.accumulationOutputs = []
    this.accumulationStatistics.clear()
    // Clear onTransfers statistics at start of each block (per-block, not cumulative)
    this.onTransfersStatistics.clear()
    // Clear accumulated services for lastacc tracking (Gray Paper eq 410-412)
    this.accumulatedServicesForLastacc.clear()

    // Step 1: Separate new reports into immediate and queued
    const { immediateItems, queuedItems } =
      separateReportsIntoImmediateAndQueued(reports, this.accumulated)

    // Step 1b: Update DA load statistics from all available reports
    // Gray Paper equation (134-140): D(c) = sum of (bundlelen + C_SEGMENTSIZE * ceil(segcount * 65/64))
    // This must be done for all reports that just became available
    this.statisticsService.updateDaLoadFromAvailableReports(reports)

    // Step 2: Shift accumulated packages history and ready queue if slot advanced
    // Gray Paper equations 417-418: Shift is part of the state transition from τ to τ'
    shiftStateForBlockTransition(
      slot,
      this.readyService,
      this.configService,
      this.lastProcessedSlot,
      this.accumulated,
    )

    // Step 3: Build and edit queue
    // Gray Paper equation 89: q = E(ready[m:] concat ready[:m] concat justbecameavailable^Q, P(justbecameavailable^!))
    // The E function uses P(justbecameavailable^!) to edit dependencies in the existing queue
    const packagesFromImmediate = extractPackageHashes(immediateItems)
    await buildAndEditQueue(
      queuedItems,
      packagesFromImmediate,
      slot,
      this.readyService,
      this.configService,
      this.newQueuedItemsForSlotM,
    )

    // Step 4: Build justbecameavailable^* = justbecameavailable^! concat Q(q)
    // Gray Paper equation 88: Combine immediate items with ready queue items into a SINGLE sequence
    // This combined sequence is then processed by accseq which batches based on gas limits
    // NOTE: Both immediate items AND ready queue items can be in the SAME batch if gas allows!
    await this.processAccumulation(slot, immediateItems)

    // Step 5: Update lastacc for all accumulated services (Gray Paper equation 410-412)
    for (const serviceId of this.accumulatedServicesForLastacc) {
      const [accountError, account] =
        this.serviceAccountsService.getServiceAccount(serviceId)
      if (!accountError && account) {
        account.lastacc = slot
        this.serviceAccountsService.setServiceAccount(serviceId, account)
      }
    }

    // Step 6: Finalize slot m
    // Gray Paper equation 420: ready'[m] = E(justbecameavailable^Q, accumulated'[E-1]) when i = 0
    finalizeSlot(
      slot,
      this.readyService,
      this.configService,
      this.newQueuedItemsForSlotM,
    )

    // Update last processed slot to reflect that state now represents this slot
    this.lastProcessedSlot = slot

    const totalTime = performance.now() - transitionStartTime
    logger.info(
      `[AccumulationService] applyTransition completed in ${totalTime.toFixed(2)}ms`,
    )

    return { ok: true }
  }

  /**
   * Update global state with accumulation results
   *
   * This method applies the changes from successful accumulation invocations
   * to the global state. Based on the test vector analysis:
   *
   * 1. Update accumulated packages history (9 new packages added)
   * 2. Update service accounts (storage, bytes, items, last_accumulation_slot)
   * 3. Remove processed work-reports from ready queue
   * 4. Shift accumulated history (epoch rotation)
   */
  updateGlobalState(
    results: AccumulateInvocationResult[],
    processedWorkReports: WorkReport[],
    workReportsByService: Map<number, WorkReport[]>,
    currentSlot: bigint,
    partialStateAccountsPerInvocation?: Map<number, Set<bigint>>,
    accumulatedServiceIds?: bigint[], // Service ID for each invocation (needed for transfer-only)
  ): void {
    // Collect poststates from all services for privilege computation
    // Gray Paper accpar equation 220-238: privileges use R function which needs manager and holder poststates
    // We only need the privilege-related fields for R function computation
    const servicePoststates = new Map<
      bigint,
      {
        manager: bigint
        assigners: bigint[]
        delegator: bigint
        registrar: bigint
        alwaysaccers: Map<bigint, bigint>
      }
    >()

    // means that all work reports containing work items with this package hash have been processed
    const fullyProcessedPackageHashes = new Set<Hex>()

    // CRITICAL FIX: Do NOT add immediateItems unconditionally.
    // Only add packages from work reports that were ACTUALLY processed (in processedWorkReports).
    // processedWorkReports contains ALL processed reports (both immediate and queued).

    for (let serviceIdx = 0; serviceIdx < results.length; serviceIdx++) {
      const serviceWorkReports = workReportsByService.get(serviceIdx) || []

      for (const workReport of serviceWorkReports) {
        fullyProcessedPackageHashes.add(workReport.package_spec.hash)
      }
    }

    // Add new packages to the rightmost slot (Gray Paper equation 417)
    // The shift happens in applyTransition, so we just add packages here
    // Multiple iterations add to the same slot
    const rightmostSlot = this.configService.epochDuration - 1
    for (const pkg of fullyProcessedPackageHashes) {
      this.accumulated.packages[rightmostSlot].add(pkg)
    }

    // Step 2: Update service accounts
    // Gray Paper: When a service is accumulated at slot s, update its lastacc to s
    // Track which accounts have been updated to prevent overwriting with stale data
    const updatedAccounts = new Set<bigint>()
    const ejectedServices = new Set<bigint>()

    applyAccumulationResultsToState(
      results,
      accumulatedServiceIds,
      currentSlot,
      partialStateAccountsPerInvocation,
      this.privilegesService.getDelegator(),
      servicePoststates,
      updatedAccounts,
      ejectedServices,
      this.accumulationStatistics,
      this.accumulatedServicesForLastacc,
      this.serviceAccountsService,
      this.validatorSetManager,
    )

    // Step 2b: Compute final privileges using Gray Paper R function
    // Gray Paper accpar equations 220-238: privileges are NOT "last BLESS wins"
    // Instead: R(original, manager_poststate, holder_poststate)
    // R(o, a, b) = b when a = o (manager didn't change), else a (manager changed)
    applyPrivilegesWithRFunction(servicePoststates, this.privilegesService)

    // Step 4: Delete ejected services (after applying transfers)
    // This ensures any transfers to ejected services are attempted before deletion
    for (const ejectedServiceId of ejectedServices) {
      this.serviceAccountsService.deleteServiceAccount(ejectedServiceId)
    }

    // Remove ALL processed work reports from ready queue, regardless of success/failure
    // Gray Paper: A work report is "processed" once accumulation is attempted, even if it fails
    // Failed work reports (PANIC/OOG) should NOT be re-processed - they are consumed by the attempt
    for (const processedReport of processedWorkReports) {
      // Log whether this was successfully accumulated (for debugging)
      const [hashError, workReportHash] =
        calculateWorkReportHash(processedReport)
      if (!hashError && workReportHash) {
        // Remove from any slot (items may be in different slots)
        this.readyService.removeReadyItem(workReportHash)
      }
    }

    // Second, remove satisfied dependencies from ALL remaining ready items
    // Gray Paper equation 48-61: E(r, x) removes dependencies that appear in x
    // Note: Items whose dependencies become satisfied will be processed in the next
    // iteration of processAccumulation - we just remove the dependencies here
    for (
      let slotIdx = 0;
      slotIdx < this.configService.epochDuration;
      slotIdx++
    ) {
      const slotItems = this.readyService.getReadyItemsForSlot(BigInt(slotIdx))
      for (const item of slotItems) {
        const [hashError, workReportHash] = calculateWorkReportHash(
          item.workReport,
        )
        if (hashError || !workReportHash) {
          continue
        }

        // Remove dependencies that are now accumulated
        for (const dep of fullyProcessedPackageHashes) {
          if (item.dependencies.has(dep)) {
            this.readyService.removeDependency(workReportHash, dep)
          }
        }
      }
    }
  }
}
