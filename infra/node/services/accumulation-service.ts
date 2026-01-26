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

import {
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
import {
  calculateWorkReportHash,
  decodeValidatorPublicKeys,
  setServicePreimageValue,
  setServiceRequestValue,
} from '@pbnjam/codec'
import { blake2bHash, hexToBytes, logger } from '@pbnjam/core'
import type { AccumulatePVM } from '@pbnjam/pvm-invocations'
import {
  type Accumulated,
  type AccumulateInput,
  type AccumulateInvocationResult,
  BaseService,
  type DeferredTransfer,
  type PartialState,
  type Ready,
  type ReadyItem,
  type ValidatorPublicKeys,
  type WorkReport,
} from '@pbnjam/types'

import type { Hex } from 'viem'
import type { AuthQueueService } from './auth-queue-service'
import type { ConfigService } from './config-service'
import type { PrivilegesService } from './privileges-service'
import type { ReadyService } from './ready-service'
import type { ServiceAccountService as ServiceAccountsService } from './service-account-service'
import type { StatisticsService } from './statistics-service'
import type { ValidatorSetManager } from './validator-set'

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
  }) {
    super('accumulation-service')
    this.accumulatePVM = options.accumulatePVM
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

    // Gray Paper equation 350-353: Calculate total gas limit
    const totalGasLimit = this.configService.maxBlockGas

    // Ensure accumulated.packages array is initialized
    this.ensureAccumulatedPackagesInitialized()

    // Use Q function iteratively to process all accumulatable items
    // Gray Paper equation 63-73: Q recursively finds all items with satisfied dependencies
    const epochLength = this.configService.epochDuration

    // Track defxfers across iterations (Gray Paper equation 166: accseq recursively passes 𝐭*)
    // Start with defxfers from immediate accumulation
    let pendingDefxfers: DeferredTransfer[] = []

    // Track total gas used across all accumulations (Gray Paper: accseq tracks gas consumption)
    // Gray Paper equation 163: i = max prefix such that sum(gaslimit) ≤ g
    let totalGasUsed = 0n

    // Track if we've already prepended immediate items (only on first iteration)
    let immediateItemsPrepended = false
    let batchInvocationIndex = 0

    // IMPORTANT: MAIN ACCUMULATION LOOP - DO NOT REMOVE THIS LOOP
    while (true) {
      // Step 1: Collect all ready items from ALL slots (in rotated order: [m:] then [:m])
      const allReadyItems = collectAllReadyItems(
        epochLength,
        currentSlot,
        this.readyService,
      )

      // Step 2: Use Q function to get all currently accumulatable items from ready queue
      const readyQueueAccumulatable = getAccumulatableItemsQ(
        allReadyItems,
        this.accumulated,
      )

      // Step 3: Build justbecameavailable^* = justbecameavailable^! concat Q(q)
      // Gray Paper equation 88: Immediate items are prepended to ready queue items
      // Only prepend on the FIRST iteration (immediate items don't go through Q)
      let accumulatableItems: ReadyItem[]
      if (!immediateItemsPrepended && immediateItems.length > 0) {
        // Prepend immediate items to ready queue items
        accumulatableItems = [...immediateItems, ...readyQueueAccumulatable]
        immediateItemsPrepended = true
      } else {
        accumulatableItems = readyQueueAccumulatable
      }

      if (accumulatableItems.length === 0 && pendingDefxfers.length === 0) {
        // No accumulatable items AND no pending transfers - nothing to do
        break
      }

      // Step 3: Validate work-report gas constraints
      validateWorkReportGasConstraints(
        accumulatableItems,
        this.serviceAccountsService,
      )

      // Step 4: Find maximum prefix that fits within gas limit (Gray Paper equation 163, 167)
      // Gray Paper equation 167: g* = g + sum_{t in t}(t.gas)
      // Available gas includes deferred transfer gas
      const { availableGas } = calculateAvailableGas(
        BigInt(totalGasLimit),
        pendingDefxfers,
        totalGasUsed,
      )

      // Gray Paper equation 163: i = max prefix such that sum_{r in r[:i], d in r.digests}(d.gaslimit) ≤ g*
      // Note: Prefix calculation only considers work-digest gas limits, not defxfer gas
      // Defxfer gas is added to each service's gas limit when executing
      const { prefixItems: batchItems } = findItemsWithinGasLimit(
        accumulatableItems,
        availableGas,
      )

      if (batchItems.length === 0 && pendingDefxfers.length === 0) {
        break
      }

      // Step 5: Group prefix items by service ID
      const serviceToItems = groupItemsByServiceId(batchItems)

      // Step 6: Execute PVM accumulate invocations
      // TODO: parallelize this
      const results: AccumulateInvocationResult[] = []
      const processedWorkReports: WorkReport[] = []
      const workReportsByService: Map<number, WorkReport[]> = new Map()
      const partialStateAccountsPerInvocation: Map<
        number,
        Set<bigint>
      > = new Map()
      const accumulatedServiceIds: bigint[] = []

      const operandTuplesByService = this.createAccumulateInputs(
        batchItems,
        [], // Start with empty defxfers - they'll be added dynamically
      )

      // Gray Paper accpar: Gas calculation uses the SAME t (deferred transfers) for ALL services
      // in the batch - specifically, the defxfers passed to accpar at the start.
      const batchStartDefxfers = [...pendingDefxfers] // Used for gas calculation - never modified

      // Gray Paper accpar: All services in the same batch see the state from the START of the batch.
      // Take a snapshot of the partial state BEFORE processing any services in this batch.
      // Each service will receive a deep clone of this snapshot to prevent modifications
      // from one service affecting another service in the same batch.
      const batchPartialStateSnapshot = createPartialStateSnapshot(
        this.validatorSetManager,
        this.configService,
        this.serviceAccountsService,
        this.authQueueService,
        this.privilegesService,
      )

      // Gray Paper accumulation.tex equation 199-200:
      // s = {d.serviceindex for r in r, d in r.digests} ∪ keys(f) ∪ {t.dest for t in t}
      // We need to include services that are:
      // 1. Work digest destinations (from operandTuplesByService)
      // 2. Transfer destinations (from batchStartDefxfers)
      // 3. Free accumulation services (from alwaysaccers) - TODO if needed

      // Derive set of services to process: work item services + defxfer destination services
      const servicesToProcess = new Set<bigint>([
        ...operandTuplesByService.keys(),
        ...batchStartDefxfers.map((d) => d.dest),
      ])

      // Gray Paper accumulation.tex equation 199-211: Process services in order (s \orderedin \mathbf{s})
      // Sort services by service ID in ascending order for deterministic processing
      // This ensures defxfers from earlier services (lower IDs) are available to later ones (higher IDs)
      const sortedServiceIds = Array.from(servicesToProcess).sort((a, b) => {
        if (a < b) return -1
        if (a > b) return 1
        return 0
      })

      // Gray Paper: All services in the same accpar batch share the same invocation index
      // The invocation index corresponds to accseq iterations, not individual services
      let serviceIndexInBatch = 0
      for (const serviceId of sortedServiceIds) {
        const serviceItems = serviceToItems.get(serviceId) || []
        // Get pre-computed operand tuples (i^U) for this service
        const operandTuples = operandTuplesByService.get(serviceId) || []

        // Add defxfers (i^T) from batch start defxfers ONLY
        // Gray Paper accumulation.tex equation 318-322: i^T = sequence of defxfers from t where dest = s
        // Gray Paper accpar line 192: all services use the same t (defxfers from start of batch)
        // Defxfers created DURING the batch are NOT included in iT - they're for the NEXT iteration
        const defxfersForService = batchStartDefxfers.filter(
          (d) => d.dest === serviceId,
        )

        // Combine inputs: i^T concat i^U (defxfers first, then operand tuples)
        // Gray Paper accumulation.tex equation 311: i = i^T concat i^U
        // IMPORTANT: Defxfers (i^T) come FIRST, then operand tuples (i^U)
        const inputs: AccumulateInput[] = [
          ...defxfersForService.map((d) => ({
            type: 1 as const, // DeferredTransfer type
            value: d,
          })),
          ...operandTuples, // OperandTuple type (type 0)
        ]

        const serviceWorkReports = serviceItems.map((item) => item.workReport)

        // Gray Paper accpar: Each service gets a DEEP CLONE of the batch snapshot.
        // This ensures modifications from one service don't affect other services in the same batch.
        // Only defxfers are shared between services in the same batch.
        const partialState = clonePartialState(batchPartialStateSnapshot)

        // Track which services were in partial state before this invocation
        const partialStateServiceIds = new Set<bigint>()
        for (const [sid] of partialState.accounts) {
          partialStateServiceIds.add(sid)
        }
        partialStateAccountsPerInvocation.set(
          batchInvocationIndex,
          partialStateServiceIds,
        )

        // Calculate gas limit for this service (Gray Paper equation 315-317)
        // Use batchStartDefxfers - gas calculation uses ONLY defxfers from the start of the batch
        const gasLimit = calculateServiceGasLimit(
          serviceId,
          serviceItems,
          batchStartDefxfers,
          this.privilegesService,
        )

        // Execute accumulate invocation
        // AccumulateInputs (inputs) contain all the data needed for FETCH selectors 14/15
        // Gray Paper pvm_invocations.tex: selector 14 returns encode(i) where i is the AccumulateInput sequence
        // TODO: parallelize this with web workers
        const result = await this.executeAccumulateInvocation(
          partialState,
          currentSlot,
          serviceId,
          gasLimit,
          inputs,
          batchInvocationIndex, // Pass the batch invocation index (accseq iteration) for trace naming
        )

        // Track accumulation output and statistics
        // Gray Paper equation 399-403: N(s) counts the number of work-digests (operand tuples) accumulated
        const workItemCount = operandTuples.filter(
          (input) => input.type === 0,
        ).length

        // Track onTransfers statistics if service received deferred transfers
        // Track even if result failed, since transfers were still received
        // onTransfersCount and onTransfersGasUsed are only tracked for versions < 0.7.1
        if (defxfersForService.length > 0) {
          const gasUsed = result.ok ? result.value.gasused : 0n
          trackOnTransfersStatistics(
            serviceId,
            defxfersForService.length,
            gasUsed,
            this.onTransfersStatistics,
            this.statisticsService,
          )
        }

        if (result.ok) {
          trackAccumulationOutput(
            serviceId,
            result.value,
            this.accumulationOutputs,
          )

          const gasUsed = result.value.gasused
          if (workItemCount > 0 || gasUsed > 0n) {
            trackAccumulationStatistics(
              serviceId,
              result.value,
              workItemCount,
              this.accumulationStatistics,
              this.statisticsService,
            )
          }
        }

        results.push(result)
        processedWorkReports.push(...serviceWorkReports)
        workReportsByService.set(serviceIndexInBatch, serviceWorkReports)
        accumulatedServiceIds.push(serviceId)

        serviceIndexInBatch++
      }

      // Increment batch invocation index for next iteration
      batchInvocationIndex++

      // Step 7: Track actual gas used from results (Gray Paper: accseq tracks actual gas consumed)
      const iterationGasUsed = calculateTotalGasUsed(results)
      totalGasUsed += iterationGasUsed

      // Collect defxfers from this iteration for next iteration
      pendingDefxfers = collectDefxfersFromResults(results)

      // Step 6: Update global state with results
      this.updateGlobalState(
        results,
        processedWorkReports,
        workReportsByService,
        currentSlot,
        partialStateAccountsPerInvocation,
        immediateItems, // Pass immediate items to ensure their packages are added
        accumulatedServiceIds, // Pass service IDs for transfer-only invocations
      )
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
   * @returns Map from serviceId to AccumulateInput[] (i^T concat i^U for each service)
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

    return inputsByService
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
  ): Promise<AccumulateInvocationResult> {
    const result = await this.accumulatePVM.executeAccumulate(
      partialState,
      timeslot,
      serviceId,
      gas,
      inputs,
      invocationIndex,
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
    // Gray Paper: accountspostxfer ≡ { (s, a') : (s, a) ∈ accountspostacc }
    //   where a' = a except a'.lastacc = time' when s ∈ keys(accumulationstatistics)
    // This MUST be done AFTER all accumulation iterations complete, not during each iteration,
    // to ensure partial state snapshots in subsequent iterations see the original lastacc values.
    // NOTE: This applies to ALL accumulated services, including newly created ones.
    // If a service is created AND accumulated in the same slot, lastacc should still be updated.
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
    immediateItems?: readonly ReadyItem[], // Add immediate items to ensure their packages are added
    accumulatedServiceIds?: bigint[], // Service ID for each invocation (needed for transfer-only)
  ): void {
    // Capture initial privileges state before processing any results
    // Gray Paper accpar: privileges are computed using R function based on manager and current holder
    const initialPrivileges = {
      manager: this.privilegesService.getManager(),
      assigners: [...this.privilegesService.getAssigners()],
      delegator: this.privilegesService.getDelegator(),
      registrar: this.privilegesService.getRegistrar(),
      alwaysaccers: new Map(this.privilegesService.getAlwaysAccers()),
    }

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

    // Get the epoch duration (C_epochlen)
    const epochLength = this.configService.epochDuration

    const newPackages = new Set<Hex>()

    // First, add packages from immediate items (justbecameavailable^!)
    // Gray Paper equation 417: accumulated'_{E-1} = P(justbecameavailable^*[:n])
    // Immediate items should be accumulated immediately, so their packages must be added
    // even if processing fails (e.g., service doesn't exist)
    if (immediateItems) {
      for (const item of immediateItems) {
        newPackages.add(item.workReport.package_spec.hash)
      }
    }

    // Extract packages from processed work reports
    // Use workReportsByService to map results to their work reports
    // Gray Paper: Only accumulate work reports whose dependencies are satisfied (empty dependency set)
    for (let serviceIdx = 0; serviceIdx < results.length; serviceIdx++) {
      const serviceWorkReports = workReportsByService.get(serviceIdx) || []

      // Gray Paper equation 417: accumulated'_{E-1} = P(justbecameavailable^*[:n])
      // P extracts package hashes from ALL processed work reports (justbecameavailable^*[:n])
      // regardless of success/failure. The packages were processed (attempted), so they're recorded.
      // Note: result.ok being false means an internal error, not a PVM panic.
      // PVM panics still have result.ok = true with resultCode != HALT
      for (const workReport of serviceWorkReports) {
        newPackages.add(workReport.package_spec.hash)
      }
    }

    // Ensure accumulated.packages is properly sized
    if (this.accumulated.packages.length !== epochLength) {
      this.accumulated.packages = new Array(epochLength)
        .fill(null)
        .map(() => new Set<Hex>())
    }

    // Add new packages to the rightmost slot (Gray Paper equation 417)
    // The shift happens in applyTransition, so we just add packages here
    // Multiple iterations add to the same slot
    const rightmostSlot = epochLength - 1
    for (const pkg of newPackages) {
      this.accumulated.packages[rightmostSlot].add(pkg)
    }

    // Step 2: Update service accounts
    // Gray Paper: When a service is accumulated at slot s, update its lastacc to s
    // Track which accounts have been updated to prevent overwriting with stale data
    const updatedAccounts = new Set<bigint>()
    const ejectedServices = new Set<bigint>()

    for (let i = 0; i < results.length; i++) {
      const result = results[i]

      // CRITICAL FIX: Always use accumulatedServiceIds as the source of truth for which service was accumulated
      // The work report's results[0].service_id may not match the actual accumulated service
      // (e.g., when a work report has multiple results for different services)
      if (!accumulatedServiceIds || accumulatedServiceIds[i] === undefined) {
        continue
      }

      const accumulatedServiceId = accumulatedServiceIds[i]

      if (result.ok) {
        const { poststate } = result.value

        // Only update the accumulated service account directly
        // Other accounts in poststate are from partial state and shouldn't be updated
        // (except newly created services, which are handled below)
        const accumulatedAccount = poststate.accounts.get(accumulatedServiceId)
        if (accumulatedAccount) {
          // Gray Paper equation 410-412: lastacc is updated AFTER all accumulation iterations complete
          // ONLY if service is in accumulationStatistics (i.e., had work items or used gas)
          // Services that only receive transfers without executing code should NOT have lastacc updated
          if (this.accumulationStatistics.has(accumulatedServiceId)) {
            this.accumulatedServicesForLastacc.add(accumulatedServiceId)
          }

          // Update the service account (without modifying lastacc - that's done later)
          this.serviceAccountsService.setServiceAccount(
            accumulatedServiceId,
            accumulatedAccount,
          )
          updatedAccounts.add(accumulatedServiceId)
        }

        // Handle newly created services (services in poststate but not in updatedAccounts)
        // These are services created during accumulation (e.g., via NEW host function)
        for (const [serviceId, account] of poststate.accounts) {
          if (
            serviceId !== accumulatedServiceId &&
            !updatedAccounts.has(serviceId)
          ) {
            // Newly created service - keep lastacc = 0 (they're created, not accumulated)
            // Gray Paper: New services have lastacc = 0
            this.serviceAccountsService.setServiceAccount(serviceId, account)
            updatedAccounts.add(serviceId)
          }
        }

        // Gray Paper line 213-216: Apply provisions from accumulation output
        // local_fnprovide: For each (serviceId, preimageData) in provisions:
        //   - Set preimages[blake(preimageData)] = preimageData
        //   - Set requests[(blake(preimageData), len(preimageData))] = [currentSlot]
        const { provisions } = result.value

        for (const [provisionServiceId, preimageData] of provisions) {
          const [hashError, preimageHash] = blake2bHash(preimageData)
          if (hashError || !preimageHash) {
            logger.warn(
              '[AccumulationService] Failed to hash provision preimage',
              {
                serviceId: provisionServiceId.toString(),
                error: hashError?.message,
              },
            )
            continue
          }

          // Get the service account (may have been updated above)
          const [accountError, account] =
            this.serviceAccountsService.getServiceAccount(provisionServiceId)
          if (accountError || !account) {
            logger.debug(
              '[AccumulationService] Provision target service not found (may have been ejected)',
              {
                serviceId: provisionServiceId.toString(),
              },
            )
            continue
          }

          // Check if provision is still providable (request exists and is not already provided)
          const preimageLength = BigInt(preimageData.length)
          const request = this.serviceAccountsService.getServiceAccountRequest(
            provisionServiceId,
            preimageHash,
            preimageLength,
          )
          // const requestMap = account.requests.get(preimageHash)
          if (!request) {
            logger.debug(
              '[AccumulationService] Provision not providable - request not found',
              {
                serviceId: provisionServiceId.toString(),
                hash: preimageHash.slice(0, 20),
                length: preimageLength.toString(),
              },
            )
            continue
          }

          // Apply the provision
          // Gray Paper line 275-276: set preimages[blake(i)] = i, requests[(blake(i), len(i))] = [thetime']
          // Use helper functions to set preimage and request values in rawCshKeyvals
          setServicePreimageValue(
            account,
            provisionServiceId,
            preimageHash,
            preimageData,
          )
          setServiceRequestValue(
            account,
            provisionServiceId,
            preimageHash,
            preimageLength,
            [currentSlot],
          )

          logger.info('[AccumulationService] Applied provision', {
            serviceId: provisionServiceId.toString(),
            hash: preimageHash,
            length: preimageLength.toString(),
            slot: currentSlot.toString(),
            preimageDataHex: Buffer.from(preimageData)
              .toString('hex')
              .slice(0, 100),
          })

          // Save the updated account
          this.serviceAccountsService.setServiceAccount(
            provisionServiceId,
            account,
          )
          updatedAccounts.add(provisionServiceId)
        }

        // Detect ejected services: If a service was in partial state but is not in poststate.accounts, it was ejected
        // Gray Paper: EJECT host function removes services from accounts
        // Use the tracked partial state accounts for this specific invocation
        const partialStateServicesForThisInvocation =
          partialStateAccountsPerInvocation?.get(i)
        if (partialStateServicesForThisInvocation) {
          for (const serviceId of partialStateServicesForThisInvocation) {
            if (!poststate.accounts.has(serviceId)) {
              ejectedServices.add(serviceId)
              logger.debug('[AccumulationService] Detected ejected service', {
                invocationIndex: i,
                serviceId: serviceId.toString(),
              })
            }
          }
        }

        // Special case: If the accumulated service is not in poststate.accounts
        // (e.g., it was ejected during accumulation), we still need to track it
        // for lastacc update at the end of all accumulation iterations
        // ONLY if service is in accumulationStatistics
        if (!poststate.accounts.has(accumulatedServiceId)) {
          if (this.accumulationStatistics.has(accumulatedServiceId)) {
            this.accumulatedServicesForLastacc.add(accumulatedServiceId)
          }
        }

        // Collect this service's poststate privileges for later R function computation
        // Gray Paper accpar: privileges are computed using R function based on manager and current holder
        servicePoststates.set(accumulatedServiceId, {
          manager: poststate.manager,
          assigners: [...poststate.assigners],
          delegator: poststate.delegator,
          registrar: poststate.registrar,
          alwaysaccers: new Map(poststate.alwaysaccers),
        })

        // Gray Paper: Apply staging set update if the delegator service called DESIGNATE
        if (
          accumulatedServiceId === initialPrivileges.delegator &&
          poststate.stagingset &&
          poststate.stagingset.length > 0
        ) {
          // Convert Uint8Array[] back to ValidatorPublicKeys[]
          const updatedStagingSet: ValidatorPublicKeys[] = []
          for (let i = 0; i < poststate.stagingset.length; i++) {
            const encoded = poststate.stagingset[i]
            const [decodeError, decoded] = decodeValidatorPublicKeys(encoded)
            if (decodeError || !decoded) {
              logger.warn(
                '[AccumulationService] Failed to decode staging set validator',
                { error: decodeError?.message },
              )
              continue
            }
            updatedStagingSet.push(decoded.value)
          }
          if (updatedStagingSet.length > 0) {
            this.validatorSetManager.setStagingSet(updatedStagingSet)
            logger.info(
              '[AccumulationService] Applied staging set update from DESIGNATE',
              {
                serviceId: accumulatedServiceId.toString(),
                validatorCount: updatedStagingSet.length,
              },
            )
          }
        }
      } else {
        // Track for deferred lastacc update even on failure (Gray Paper eq 410-412)
        // sa_lastacc = s when s ∈ keys(accumulationstatistics), regardless of success/failure
        // ONLY if service is in accumulationStatistics
        if (this.accumulationStatistics.has(accumulatedServiceId)) {
          this.accumulatedServicesForLastacc.add(accumulatedServiceId)
        }
      }
    }

    // Step 2b: Compute final privileges using Gray Paper R function
    // Gray Paper accpar equations 220-238: privileges are NOT "last BLESS wins"
    // Instead: R(original, manager_poststate, holder_poststate)
    // R(o, a, b) = b when a = o (manager didn't change), else a (manager changed)
    this.applyPrivilegesWithRFunction(initialPrivileges, servicePoststates)

    // Step 4: Delete ejected services (after applying transfers)
    // This ensures any transfers to ejected services are attempted before deletion
    for (const ejectedServiceId of ejectedServices) {
      this.serviceAccountsService.deleteServiceAccount(ejectedServiceId)
    }

    // Use newPackages (successfully accumulated) for queue editing
    // Only successfully accumulated packages go into the accumulated history for dependency tracking
    const accumulatedPackageHashes = newPackages

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
    for (let slotIdx = 0; slotIdx < epochLength; slotIdx++) {
      const slotItems = this.readyService.getReadyItemsForSlot(BigInt(slotIdx))
      for (const item of slotItems) {
        const [hashError, workReportHash] = calculateWorkReportHash(
          item.workReport,
        )
        if (hashError || !workReportHash) {
          continue
        }

        // Remove dependencies that are now accumulated
        for (const dep of accumulatedPackageHashes) {
          if (item.dependencies.has(dep)) {
            this.readyService.removeDependency(workReportHash, dep)
          }
        }
      }
    }
  }

  /**
   * Apply privileges using Gray Paper R function
   * Gray Paper accpar equations 220-238:
   * - manager and alwaysaccers come directly from manager's poststate
   * - delegator, registrar, assigners use R(original, manager_poststate, holder_poststate)
   * - R(o, a, b) = b when a = o (manager didn't change), else a (manager changed)
   */
  private applyPrivilegesWithRFunction(
    initialPrivileges: {
      manager: bigint
      assigners: bigint[]
      delegator: bigint
      registrar: bigint
      alwaysaccers: Map<bigint, bigint>
    },
    servicePoststates: Map<
      bigint,
      {
        manager: bigint
        assigners: bigint[]
        delegator: bigint
        registrar: bigint
        alwaysaccers: Map<bigint, bigint>
      }
    >,
  ): void {
    // Get current (initial) privilege holders
    const currentManager = initialPrivileges.manager
    const currentDelegator = initialPrivileges.delegator
    const currentRegistrar = initialPrivileges.registrar

    // Get manager's poststate (if manager was accumulated)
    // If manager wasn't accumulated, treat as if manager didn't change any privileges
    const managerPoststate = servicePoststates.get(currentManager)

    // Gray Paper R function: R(o, a, b) = b when a = o, else a
    // o = original value, a = manager's poststate, b = current holder's poststate
    // If manager wasn't accumulated, a = o (manager didn't change), so result = b (holder's value)
    const R = <T>(
      original: T,
      managerValue: T | undefined,
      holderValue: T,
    ): T => {
      // If manager didn't change (managerValue === original or manager not accumulated), use holder's value
      // Otherwise, use manager's value (manager takes priority)
      const effectiveManagerValue = managerValue ?? original // If manager not accumulated, treat as unchanged
      return effectiveManagerValue === original
        ? holderValue
        : effectiveManagerValue
    }

    // Gray Paper equation 221-222: manager and alwaysaccers come from manager's poststate
    // If manager wasn't accumulated, keep current values
    if (managerPoststate) {
      this.privilegesService.setManager(managerPoststate.manager)
      this.privilegesService.setAlwaysAccers(managerPoststate.alwaysaccers)
    }

    // Gray Paper equation 229-233: delegator' = R(delegator, managerPoststate.delegator, delegatorService.poststate.delegator)
    const delegatorPoststate = servicePoststates.get(currentDelegator)
    const newDelegator = R(
      currentDelegator,
      managerPoststate?.delegator,
      delegatorPoststate?.delegator ?? currentDelegator,
    )
    this.privilegesService.setDelegator(newDelegator)

    // Gray Paper equation 234-238: registrar' = R(registrar, managerPoststate.registrar, registrarService.poststate.registrar)
    const registrarPoststate = servicePoststates.get(currentRegistrar)
    const newRegistrar = R(
      currentRegistrar,
      managerPoststate?.registrar,
      registrarPoststate?.registrar ?? currentRegistrar,
    )
    this.privilegesService.setRegistrar(newRegistrar)

    // Gray Paper equation 223-228: assigners[c] = R(assigners[c], managerPoststate.assigners[c], assignerService.poststate.assigners[c])
    const newAssigners: bigint[] = []
    for (let c = 0; c < initialPrivileges.assigners.length; c++) {
      const currentAssigner = initialPrivileges.assigners[c] ?? 0n
      const assignerPoststate = servicePoststates.get(currentAssigner)
      const newAssigner = R(
        currentAssigner,
        managerPoststate?.assigners[c],
        assignerPoststate?.assigners[c] ?? currentAssigner,
      )
      newAssigners.push(newAssigner)
    }
    this.privilegesService.setAssigners(newAssigners)
  }
}
