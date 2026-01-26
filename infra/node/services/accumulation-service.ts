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
  filterReadyItemDependencies,
  findItemsWithinGasLimit,
  groupItemsByServiceId,
  shiftStateForBlockTransition,
} from '@pbnjam/accumulate'
import {
  calculateWorkReportHash,
  decodeValidatorPublicKeys,
  encodeValidatorPublicKeys,
  setServicePreimageValue,
  setServiceRequestValue,
} from '@pbnjam/codec'
import { blake2bHash, bytesToHex, hexToBytes, logger } from '@pbnjam/core'
import type { AccumulatePVM } from '@pbnjam/pvm-invocations'
import {
  type Accumulated,
  type AccumulateInput,
  type AccumulateInvocationResult,
  type AccumulateOutput,
  BaseService,
  type DeferredTransfer,
  type PartialState,
  type Ready,
  type ReadyItem,
  type ServiceAccount,
  type ValidatorPublicKeys,
  WORK_REPORT_CONSTANTS,
  type WorkExecResultValue,
  type WorkExecutionResult,
  type WorkReport,
} from '@pbnjam/types'

import type { Hex } from 'viem'
import type { AuthQueueService } from './auth-queue-service'
import type { ClockService } from './clock-service'
import type { ConfigService } from './config-service'
// import type { EntropyService } from './entropy'
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

  private readonly clockService: ClockService
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
  // Track global invocation index for trace file naming (resets each slot)
  private globalInvocationIndex = 0
  // Track local_fnservouts (accumulation output pairings) for the latest accumulation
  // Gray Paper equation 201-207: local_fnservouts ≡ { (s, b) : s ∈ s, b = acc(s).yield, b ≠ none }
  // Gray Paper: lastaccout' ∈ sequence{tuple{serviceid, hash}}
  // CRITICAL: This is a SEQUENCE (ordered list), not a set! Same service can appear multiple times
  // if it accumulates in multiple invocations with different yields.
  // Only includes services where yield is non-None (yield is the hash value)
  // This is used to construct lastaccout' for the accoutBelt
  // Only tracks the current block's accumulation (cleared at start of each applyTransition)
  private accumulationOutputs: [bigint, Hex][] = []
  // Track accumulation statistics per service: tuple{count, gas}
  // Gray Paper: accumulationstatistics[s] = tuple{N, gas}
  // This tracks the count and total gas used for accumulations per service
  private accumulationStatistics: Map<bigint, [number, number]> = new Map()
  // Track onTransfers statistics per service: tuple{count, gas}
  // This tracks the count of deferred transfers received and gas used processing them
  private onTransfersStatistics: Map<bigint, [number, number]> = new Map()
  // Track immediate items for current transition to ensure their packages are added to accumulated
  private currentImmediateItems: ReadyItem[] = []
  // Track package hashes of new queued items for slot m (justbecameavailable^Q)
  // Used by finalizeSlotM to ensure only new queued items remain in slot m
  private newQueuedItemsForSlotM: Set<Hex> = new Set()
  // Gray Paper equation 410-412: lastacc is updated AFTER all accumulation iterations complete
  // This set tracks services that were accumulated and need lastacc update at the end
  // We defer this update to avoid affecting partial state snapshots in subsequent iterations
  private accumulatedServicesForLastacc: Set<bigint> = new Set()
  constructor(options: {
    configService: ConfigService
    clockService: ClockService
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
    this.clockService = options.clockService
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
    if (!this.readyService) {
      throw new Error('Ready service not initialized')
    }
    return this.readyService.getReady()
  }

  /**
   * Set ready state
   */
  setReady(ready: Ready): void {
    if (!this.readyService) {
      throw new Error('Ready service not initialized')
    }
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
    if (!this.readyService) {
      throw new Error('Ready service not initialized')
    }
    return this.readyService.getReadyItem(workReportHash)
  }

  /**
   * Remove a specific dependency from a ready item
   */
  removeDependency(workReportHash: Hex, dependencyHash: Hex): void {
    if (!this.readyService) {
      throw new Error('Ready service not initialized')
    }
    this.readyService.removeDependency(workReportHash, dependencyHash)
  }

  /**
   * Add a dependency to a ready item
   */
  addDependency(workReportHash: Hex, dependencyHash: Hex): void {
    if (!this.readyService) {
      throw new Error('Ready service not initialized')
    }
    this.readyService.addDependency(workReportHash, dependencyHash)
  }

  /**
   * Calculate total gas limit for accumulation
   * Uses configService.maxBlockGas as the total gas limit for accumulation
   *
   * @returns Total gas limit for accumulation
   */
  private calculateTotalGasLimit(): bigint {
    const totalGasLimit = BigInt(this.configService.maxBlockGas)

    return totalGasLimit
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
    initialDefxfers: DeferredTransfer[] = [], // Defxfers from previous blocks
    startingInvocationIndex = 0, // Starting invocation index
    immediateItems: ReadyItem[] = [], // Gray Paper justbecameavailable^! - prepended to ready queue items
  ): Promise<void> {
    // NOTE: accumulationOutputs and accumulationStatistics are now cleared in applyTransition
    // to preserve statistics from immediate items accumulated before this method is called

    // CRITICAL: Filter dependencies for all ready items against the accumulated set
    // When loading from pre_state, ready items may have stale dependencies that have since been accumulated
    // Gray Paper: E function removes dependencies that are in accumulatedcup
    filterReadyItemDependencies(
      this.readyService,
      this.accumulated,
      this.configService,
    )

    // Gray Paper equation 350-353: Calculate total gas limit
    const totalGasLimit = this.calculateTotalGasLimit()

    // Convert absolute slot to epoch slot index
    const epochSlotIndex = BigInt(
      Number(currentSlot) % this.configService.epochDuration,
    )

    // Ensure accumulated.packages array is initialized
    this.ensureAccumulatedPackagesInitialized()

    // Use Q function iteratively to process all accumulatable items
    // Gray Paper equation 63-73: Q recursively finds all items with satisfied dependencies
    let iterationCount = 0
    const maxIterations = 10 // Safety limit - Gray Paper uses gas as bound, this is just for safety
    const epochLength = this.configService.epochDuration

    // Track defxfers across iterations (Gray Paper equation 166: accseq recursively passes 𝐭*)
    // Start with defxfers from immediate accumulation
    let pendingDefxfers: DeferredTransfer[] = [...initialDefxfers]
    logger.debug(
      '[AccumulationService] Starting processAccumulation with initial defxfers',
      {
        slot: currentSlot.toString(),
        initialDefxfersCount: initialDefxfers.length,
        defxfers: initialDefxfers.map((d) => ({
          source: d.source.toString(),
          dest: d.dest.toString(),
          amount: d.amount.toString(),
        })),
      },
    )

    // Track total gas used across all accumulations (Gray Paper: accseq tracks gas consumption)
    // Gray Paper equation 163: i = max prefix such that sum(gaslimit) ≤ g
    let totalGasUsed = 0n

    // Track if we've already prepended immediate items (only on first iteration)
    let immediateItemsPrepended = false

    while (iterationCount < maxIterations) {
      iterationCount++

      // Step 1: Collect all ready items from ALL slots (in rotated order: [m:] then [:m])
      const allReadyItems = this.collectAllReadyItems(epochLength, currentSlot)

      // Step 2: Use Q function to get all currently accumulatable items from ready queue
      const readyQueueAccumulatable = this.getAccumulatableItemsQ(
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
        logger.debug(
          '[AccumulationService] No items with satisfied dependencies and no pending defxfers',
          {
            slot: currentSlot.toString(),
            iteration: iterationCount,
            totalReady: allReadyItems.length,
          },
        )
        break
      }

      // Step 3: Validate work-report gas constraints
      this.validateWorkReportGasConstraints(accumulatableItems)

      // Step 4: Find maximum prefix that fits within gas limit (Gray Paper equation 163, 167)
      // Gray Paper equation 167: g* = g + sum_{t in t}(t.gas)
      // Available gas includes deferred transfer gas
      const defxferGas = pendingDefxfers.reduce(
        (sum, d) => sum + d.gasLimit,
        0n,
      )
      const availableGas = totalGasLimit + defxferGas - totalGasUsed

      // Gray Paper equation 163: i = max prefix such that sum_{r in r[:i], d in r.digests}(d.gaslimit) ≤ g*
      // Note: Prefix calculation only considers work-digest gas limits, not defxfer gas
      // Defxfer gas is added to each service's gas limit when executing
      const { prefixItems } = findItemsWithinGasLimit(
        accumulatableItems,
        availableGas,
      )

      if (prefixItems.length === 0 && pendingDefxfers.length === 0) {
        // No items fit in gas AND no pending transfers - nothing to do
        logger.debug(
          '[AccumulationService] No items fit within available gas limit and no pending defxfers',
          {
            slot: currentSlot.toString(),
            iteration: iterationCount,
            availableGas: availableGas.toString(),
            totalGasLimit: totalGasLimit.toString(),
            defxferGas: defxferGas.toString(),
            totalGasUsed: totalGasUsed.toString(),
            totalAccumulatable: accumulatableItems.length,
          },
        )
        break
      }

      // Step 5: Group prefix items by service ID
      const serviceToItems = groupItemsByServiceId(prefixItems)

      // Step 6: Execute PVM accumulate invocations sequentially
      // Gray Paper: The invocation index corresponds to accseq iteration (0-based)
      // Add startingInvocationIndex to account for immediate items already processed
      const batchInvocationIndex = startingInvocationIndex + iterationCount - 1 // iterationCount starts at 1
      const {
        results,
        processedWorkReports,
        workReportsByService,
        partialStateAccountsPerInvocation,
        accumulatedServiceIds,
      } = await this.executeAccumulationInvocations(
        serviceToItems,
        currentSlot,
        pendingDefxfers,
        batchInvocationIndex,
      )

      // Step 7: Track actual gas used from results (Gray Paper: accseq tracks actual gas consumed)
      const iterationGasUsed = results.reduce((sum, result) => {
        if (result.ok) {
          return sum + result.value.gasused
        }
        return sum
      }, 0n)
      totalGasUsed += iterationGasUsed

      // Collect defxfers from this iteration for next iteration
      const collectedDefxfers = this.collectDefxfersFromResults(
        results,
        pendingDefxfers,
      )

      pendingDefxfers = collectedDefxfers

      // Step 6: Update global state with results
      this.updateGlobalState(
        results,
        processedWorkReports,
        workReportsByService,
        currentSlot,
        epochSlotIndex,
        partialStateAccountsPerInvocation,
        this.currentImmediateItems, // Pass immediate items to ensure their packages are added
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
   * Collect all ready items from all epoch slots
   *
   * Gray Paper equation 89: q = E(concatall{ready[m:]} concat concatall{ready[:m]} ...)
   * This processes items from ALL slots, but only those with satisfied dependencies (via Q function).
   *
   * However, according to equation 419-423, items expire when their slot is cleared after time advancement.
   * Items should only be processed when their slot comes around again (after a full epoch rotation).
   *
   * According to jamduna reference implementation, accumulation only happens when items have been in the queue
   * for a full epoch (when their slot comes around again). So we should only process items from the current slot.
   *
   * FIX: Only process items from the current epoch slot to match jamduna behavior.
   */
  private collectAllReadyItems(
    epochLength: number,
    currentSlot: bigint,
  ): ReadyItem[] {
    const allReadyItems: ReadyItem[] = []
    const m = Number(currentSlot) % epochLength

    // Gray Paper equation 89: q = E(concat{ready[m:]} concat concat{ready[:m]} concat justbecameavailable^Q, ...)
    // We must collect items from ALL slots in rotated order: [m:] then [:m]
    // This ensures items that have been waiting get processed in the correct order
    // Use a single loop with modulo arithmetic to iterate through slots in rotated order
    for (let i = 0; i < epochLength; i++) {
      const slotIdx = (m + i) % epochLength
      const slotItems = this.readyService.getReadyItemsForSlot(BigInt(slotIdx))
      allReadyItems.push(...slotItems)
    }

    return allReadyItems
  }

  /**
   * Validate work-report gas constraints
   * Gray Paper reporting_assurance.tex lines 303-306:
   * ∀ wrX ∈ incomingreports:
   *   sum(work-digest gaslimit) ≤ Creportaccgas
   *   ∧ each work-digest gaslimit ≥ service minaccgas
   */
  private validateWorkReportGasConstraints(items: ReadyItem[]): void {
    for (const item of items) {
      const workReport = item.workReport
      let totalGasLimit = 0n

      for (const result of workReport.results) {
        const gasLimit = BigInt(result.accumulate_gas)
        totalGasLimit += gasLimit

        // Verify each work-digest gaslimit ≥ service minaccgas
        const serviceId = result.service_id
        const [serviceAccountError, serviceAccount] =
          this.serviceAccountsService.getServiceAccount(serviceId)

        // Skip validation for ejected services (service account not found)
        // Gray Paper: Work reports for ejected services are processed but don't affect state
        if (serviceAccountError || !serviceAccount) {
          continue
        }

        const minAccGas = BigInt(serviceAccount.minaccgas)
        if (gasLimit < minAccGas) {
          throw new Error(
            `Work-report gas limit ${gasLimit} for service ${serviceId} is less than minimum ${minAccGas}`,
          )
        }
      }

      // Verify sum ≤ Creportaccgas
      if (totalGasLimit > WORK_REPORT_CONSTANTS.C_REPORTACCGAS) {
        throw new Error(
          `Work-report total gas limit ${totalGasLimit} exceeds Creportaccgas ${WORK_REPORT_CONSTANTS.C_REPORTACCGAS}`,
        )
      }
    }
  }

  /**
   * Group items by service ID
   * Gray Paper: accumulate each service once with all its inputs
   * NOTE: A work report can have multiple results with different service_ids
   */
  private groupItemsByServiceId(items: ReadyItem[]): Map<bigint, ReadyItem[]> {
    const serviceToItems = new Map<bigint, ReadyItem[]>()
    const serviceIdsInItems = new Set<bigint>()

    // First pass: collect all unique service IDs from all results
    for (const item of items) {
      for (const result of item.workReport.results) {
        serviceIdsInItems.add(result.service_id)
      }
    }

    // Second pass: group items by service ID
    for (const serviceId of serviceIdsInItems) {
      serviceToItems.set(serviceId, [])
      for (const item of items) {
        // Include this item if it has at least one result for this service
        if (item.workReport.results.some((r) => r.service_id === serviceId)) {
          serviceToItems.get(serviceId)!.push(item)
        }
      }
    }

    return serviceToItems
  }

  /**
   * Execute PVM accumulate invocations sequentially for all services
   * Gray Paper: process services sequentially, defxfers from earlier services
   * are available to later ones in the same iteration
   *
   * NOTE: All services in the same batch (accpar call) share the same invocation index.
   * The invocation index corresponds to the accseq iteration, not individual service processing.
   */
  private async executeAccumulationInvocations(
    serviceToItems: Map<bigint, ReadyItem[]>,
    currentSlot: bigint,
    pendingDefxfers: DeferredTransfer[],
    batchInvocationIndex: number, // The iteration number from accseq - same for all services in this batch
  ): Promise<{
    results: AccumulateInvocationResult[]
    processedWorkReports: WorkReport[]
    workReportsByService: Map<number, WorkReport[]> // Map service index to its work reports
    partialStateAccountsPerInvocation: Map<number, Set<bigint>>
    accumulatedServiceIds: bigint[] // Service ID for each invocation
  }> {
    const results: AccumulateInvocationResult[] = []
    const processedWorkReports: WorkReport[] = []
    const workReportsByService: Map<number, WorkReport[]> = new Map()
    const partialStateAccountsPerInvocation: Map<
      number,
      Set<bigint>
    > = new Map()
    const accumulatedServiceIds: bigint[] = []

    // Pre-compute operand tuples (i^U) for all items once
    // NOTE: We pass all items here, but createAccumulateInputs filters by serviceId
    // This is more efficient than calling it once per service
    // IMPORTANT: Deduplicate items to avoid processing the same work report multiple times
    // When a work report has results for multiple services, it appears in multiple serviceToItems entries
    const allItemsWithDuplicates = Array.from(serviceToItems.values()).flat()
    const seenPackageHashes = new Set<string>()
    const allItems: ReadyItem[] = []
    for (const item of allItemsWithDuplicates) {
      const packageHash = item.workReport.package_spec.hash
      if (!seenPackageHashes.has(packageHash)) {
        seenPackageHashes.add(packageHash)
        allItems.push(item)
      }
    }

    const operandTuplesByService = this.createAccumulateInputs(
      allItems,
      [], // Start with empty defxfers - they'll be added dynamically
    )

    // Gray Paper accpar: Gas calculation uses the SAME t (deferred transfers) for ALL services
    // in the batch - specifically, the defxfers passed to accpar at the start.
    // We store these separately from iterationDefxfers which grows as services run.
    const batchStartDefxfers = [...pendingDefxfers] // Used for gas calculation - never modified

    // Track defxfers within this iteration (for accumulate inputs iT sequence)
    // This grows as each service runs and creates new defxfers
    const iterationDefxfers = [...pendingDefxfers]

    // Gray Paper accpar: All services in the same batch see the state from the START of the batch.
    // Take a snapshot of the partial state BEFORE processing any services in this batch.
    // Each service will receive a deep clone of this snapshot to prevent modifications
    // from one service affecting another service in the same batch.
    const batchPartialStateSnapshot = this.createPartialStateSnapshot()

    // Gray Paper accumulation.tex equation 199-200:
    // s = {d.serviceindex for r in r, d in r.digests} ∪ keys(f) ∪ {t.dest for t in t}
    // We need to include services that are:
    // 1. Work digest destinations (already in serviceToItems)
    // 2. Transfer destinations (from pendingDefxfers)
    // 3. Free accumulation services (from alwaysaccers) - TODO if needed

    // Add transfer destination services that aren't already in serviceToItems
    const extendedServiceToItems = new Map(serviceToItems)
    for (const defxfer of pendingDefxfers) {
      if (!extendedServiceToItems.has(defxfer.dest)) {
        // Service only receives transfer, no work items
        extendedServiceToItems.set(defxfer.dest, [])
        logger.debug(
          '[AccumulationService] Added transfer-only service to accumulation',
          {
            serviceId: defxfer.dest.toString(),
            transferAmount: defxfer.amount.toString(),
            transferGas: defxfer.gasLimit.toString(),
          },
        )
      }
    }

    // Gray Paper accumulation.tex equation 199-211: Process services in order (s \orderedin \mathbf{s})
    // Sort services by service ID in ascending order for deterministic processing
    // This ensures defxfers from earlier services (lower IDs) are available to later ones (higher IDs)
    const sortedServices = Array.from(extendedServiceToItems.entries()).sort(
      (a, b) => {
        if (a[0] < b[0]) return -1
        if (a[0] > b[0]) return 1
        return 0
      },
    )

    // Gray Paper: All services in the same accpar batch share the same invocation index
    // The invocation index corresponds to accseq iterations, not individual services
    let serviceIndexInBatch = 0
    for (const [serviceId, serviceItems] of sortedServices) {
      const result = await this.executeSingleServiceAccumulation(
        serviceId,
        serviceItems,
        currentSlot,
        batchStartDefxfers, // Gray Paper: For BOTH gas calculation AND inputs - uses defxfers from start of batch only
        operandTuplesByService,
        batchInvocationIndex, // Use the batch invocation index (same for all services in this accpar call)
        partialStateAccountsPerInvocation,
        batchPartialStateSnapshot, // Pass the batch snapshot - each service gets a clone
      )

      results.push(result.result)
      processedWorkReports.push(...result.serviceWorkReports)
      workReportsByService.set(serviceIndexInBatch, result.serviceWorkReports)
      accumulatedServiceIds.push(serviceId)

      // Update iteration defxfers for next service in same iteration
      // Gray Paper: defxfers from earlier services in the same iteration are available to later ones
      // NOTE: State changes are NOT visible between services within the same accpar batch.
      // Each service sees the state from the start of the batch, only defxfers are shared.
      if (result.result.ok) {
        const newDefxfers = result.result.value.defxfers
        iterationDefxfers.push(...newDefxfers)
      } else {
        logger.debug(
          '[AccumulationService] Service accumulation failed, no defxfers to add',
          {
            serviceId: serviceId.toString(),
            batchInvocationIndex,
            serviceIndexInBatch,
            error: result.result.err,
          },
        )
      }

      serviceIndexInBatch++
    }

    return {
      results,
      processedWorkReports,
      workReportsByService,
      partialStateAccountsPerInvocation,
      accumulatedServiceIds,
    }
  }

  /**
   * Calculate gas limit for a single service accumulation
   * Gray Paper equation 315-317:
   * g = subifnone(f[s], 0) + sum_{t in t, t.dest = s}(t.gas) + sum_{r in r, d in r.digests, d.serviceindex = s}(d.gaslimit)
   *
   * @param serviceId - Service ID
   * @param serviceItems - Work reports for this service
   * @param pendingDefxfers - Deferred transfers
   * @returns Gas limit for this service accumulation
   */
  private calculateServiceGasLimit(
    serviceId: bigint,
    serviceItems: ReadyItem[],
    pendingDefxfers: DeferredTransfer[],
  ): bigint {
    // Get free gas from alwaysaccers (if privileged)
    const alwaysaccers = this.privilegesService.getAlwaysAccers()
    const freeGas = alwaysaccers.get(serviceId) ?? 0n

    // Sum gas from deferred transfers to this service
    const defxferGas = pendingDefxfers
      .filter((d) => d.dest === serviceId)
      .reduce((sum, d) => sum + d.gasLimit, 0n)

    // Sum gas limits from work digests for this service
    const workDigestGas = serviceItems.reduce((sum, item) => {
      return (
        sum +
        item.workReport.results
          .filter((result) => result.service_id === serviceId)
          .reduce((s, r) => s + BigInt(r.accumulate_gas), 0n)
      )
    }, 0n)

    // Gray Paper: g = freeGas + defxferGas + workDigestGas
    const totalGasLimit = freeGas + defxferGas + workDigestGas

    return totalGasLimit
  }

  /**
   * Execute accumulation for a single service
   */
  private async executeSingleServiceAccumulation(
    serviceId: bigint,
    serviceItems: ReadyItem[],
    currentSlot: bigint,
    batchStartDefxfers: DeferredTransfer[], // Gray Paper: For BOTH gas calculation AND inputs (iT) - uses only defxfers from start of batch
    operandTuplesByService: Map<bigint, AccumulateInput[]>,
    invocationIndex: number,
    partialStateAccountsPerInvocation: Map<number, Set<bigint>>,
    batchPartialStateSnapshot: PartialState, // Snapshot from the start of the batch
  ): Promise<{
    result: AccumulateInvocationResult
    serviceWorkReports: WorkReport[]
  }> {
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
    const partialState = this.clonePartialState(batchPartialStateSnapshot)

    // Track which services were in partial state before this invocation
    const partialStateServiceIds = new Set<bigint>()
    for (const [sid] of partialState.accounts) {
      partialStateServiceIds.add(sid)
    }
    partialStateAccountsPerInvocation.set(
      invocationIndex,
      partialStateServiceIds,
    )

    // Calculate gas limit for this service (Gray Paper equation 315-317)
    // Use batchStartDefxfers - gas calculation uses ONLY defxfers from the start of the batch
    const gasLimit = this.calculateServiceGasLimit(
      serviceId,
      serviceItems,
      batchStartDefxfers,
    )

    // Execute accumulate invocation
    // AccumulateInputs (inputs) contain all the data needed for FETCH selectors 14/15
    // Gray Paper pvm_invocations.tex: selector 14 returns encode(i) where i is the AccumulateInput sequence
    const result = await this.executeAccumulateInvocation(
      partialState,
      currentSlot,
      serviceId,
      gasLimit,
      inputs,
      invocationIndex, // Pass the batch invocation index (accseq iteration) for trace naming
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
      this.trackOnTransfersStatistics(
        serviceId,
        defxfersForService.length,
        gasUsed,
      )
    }

    if (result.ok) {
      this.trackAccumulationOutput(serviceId, result.value, currentSlot)

      // Gray Paper accumulation.tex equation 390-393:
      // accumulationstatistics ≡ { kv{s}{tup{G(s), N(s)}} | G(s) + N(s) ≠ 0 }
      // where N(s) = count of work-DIGESTS (not deferred transfers)
      //       G(s) = sum of gas used from ALL invocations for service s
      //
      // Key insight from Gray Paper equation:
      // G(s) ≡ ∑_{(s, u) ∈ u}(u) - sum of gas from ALL invocations for service s
      //
      // This means:
      // Gray Paper: accumulationstatistics includes services where G(s) + N(s) ≠ 0
      // - N(s) = count of work-digests
      // - G(s) = total gas used by all invocations for service s
      //
      // Track statistics if:
      // 1. Has work items (N(s) > 0), OR
      // 2. Used gas (G(s) > 0) - e.g., transfer destinations WITH code
      //
      // Don't track if service has no work items AND used no gas
      // (e.g., transfer destinations without code that just receive balance)
      const gasUsed = result.value.gasused
      if (workItemCount > 0 || gasUsed > 0n) {
        this.trackAccumulationStatistics(
          serviceId,
          result.value,
          currentSlot,
          workItemCount,
        )
      }

      // NOTE: Privileges are NOT applied immediately after each invocation.
      // Gray Paper accumulation.tex equation 178-238 (accpar) defines that privileges are
      // computed from the FINAL state of all services after the entire batch is processed.
      // The manager service's poststate determines the final privileges.
      // This is handled in updateGlobalState after all invocations complete.
    }

    return { result, serviceWorkReports }
  }

  /**
   * Create partial state for PVM invocation
   */
  /**
   * Create partial state for PVM invocation
   *
   * Gray Paper accumulation.tex equation 134 (eq:partialstate):
   * partialstate ≡ tuple{
   *   ps_accounts: dictionary{serviceid}{serviceaccount},
   *   ps_stagingset: sequence[Cvalcount]{valkey},  // MUST have exactly Cvalcount validators
   *   ps_authqueue: sequence[Ccorecount]{sequence[Cauthqueuesize]{hash}},
   *   ps_manager: serviceid,
   *   ps_assigners: sequence[Ccorecount]{serviceid},
   *   ps_delegator: serviceid,
   *   ps_registrar: serviceid,
   *   ps_alwaysaccers: dictionary{serviceid}{gas}
   * }
   *
   * The staging set MUST be a fixed-length sequence of exactly Cvalcount validators.
   * If not initialized, we pad with null validators (all zeros) to meet the requirement.
   */
  private createPartialState(): PartialState {
    // Get staging validators - MUST have exactly Cvalcount elements
    let stagingset: Uint8Array[] = []

    const stagingValidatorsMap = this.validatorSetManager.getStagingValidators()
    const stagingValidatorsArray = Array.from(stagingValidatorsMap.values())

    // Convert to Uint8Array format
    stagingset = stagingValidatorsArray.map(encodeValidatorPublicKeys)

    // Gray Paper requires exactly Cvalcount validators in the staging set
    // If we have fewer (or zero), pad with null validators
    const requiredCount = this.configService.numValidators
    if (stagingset.length < requiredCount) {
      // Create null validators using ValidatorSetManager's method
      // Gray Paper: null keys replace blacklisted validators (equation 122-123)
      const nullValidators = this.validatorSetManager.createNullValidatorSet(
        requiredCount - stagingset.length,
      )

      // Encode null validators to Uint8Array format and append
      const nullValidatorsEncoded = nullValidators.map(
        encodeValidatorPublicKeys,
      )
      stagingset = [...stagingset, ...nullValidatorsEncoded]
    } else if (stagingset.length > requiredCount) {
      // Truncate if somehow we have more than required (shouldn't happen, but be safe)
      logger.warn(
        '[AccumulationService] Staging set has more than Cvalcount validators, truncating',
        {
          currentCount: stagingset.length,
          requiredCount,
        },
      )
      stagingset = stagingset.slice(0, requiredCount)
    }

    const accounts = this.serviceAccountsService.getServiceAccounts().accounts

    return {
      accounts,
      stagingset,
      authqueue: this.authQueueService
        ? this.authQueueService
            .getAuthQueue()
            .map((queue) => queue.map((item) => hexToBytes(item)))
        : new Array(this.configService.numCores).fill([]),
      manager: this.privilegesService.getManager(),
      assigners: this.privilegesService.getAssigners(),
      delegator: this.privilegesService.getDelegator(),
      registrar: this.privilegesService.getRegistrar(),
      alwaysaccers: this.privilegesService.getAlwaysAccers(),
    }
  }

  /**
   * Create a SNAPSHOT of the partial state with deep-cloned accounts.
   * Gray Paper accpar: All services in the same batch see the state from the START of the batch.
   * This method clones all storage/preimages/requests maps to prevent modifications
   * from one service affecting another service in the same batch.
   */
  private createPartialStateSnapshot(): PartialState {
    return this.clonePartialState(this.createPartialState())
  }

  /**
   * Deep clone a partial state to prevent modifications from affecting the original.
   * Used to give each invocation in a batch its own copy of the state.
   */
  private clonePartialState(originalState: PartialState): PartialState {
    // Deep clone accounts to prevent modifications from affecting other services
    const clonedAccounts = new Map<bigint, ServiceAccount>()
    for (const [serviceId, account] of originalState.accounts) {
      const clonedAccount: ServiceAccount = {
        ...account,
        rawCshKeyvals: JSON.parse(JSON.stringify(account.rawCshKeyvals)),
      }
      clonedAccounts.set(serviceId, clonedAccount)
    }

    // Deep clone authqueue (2D array) - assign host function modifies this
    const clonedAuthqueue: Uint8Array[][] = originalState.authqueue.map(
      (coreQueue) => coreQueue.map((entry) => new Uint8Array(entry)),
    )

    // Deep clone assigners array - assign host function modifies this
    const clonedAssigners = [...originalState.assigners]

    // Clone alwaysaccers map - bless host function modifies this
    const clonedAlwaysaccers = new Map(originalState.alwaysaccers)

    // Deep clone stagingset array (though it's not modified by host functions)
    const clonedStagingset = originalState.stagingset.map(
      (entry) => new Uint8Array(entry),
    )

    return {
      ...originalState,
      accounts: clonedAccounts,
      authqueue: clonedAuthqueue, // Deep cloned - assign modifies this
      assigners: clonedAssigners, // Deep cloned - assign modifies this
      alwaysaccers: clonedAlwaysaccers, // Deep cloned - bless modifies this
      stagingset: clonedStagingset, // Deep cloned for consistency
      // manager, delegator, registrar are primitives (bigint), so they're copied by value
    }
  }

  /**
   * Track accumulation output for local_fnservouts
   * Gray Paper: local_fnservouts ≡ protoset{tuple{serviceid, hash}}
   */
  private trackAccumulationOutput(
    serviceId: bigint,
    output: AccumulateOutput,
    _currentSlot: bigint,
  ): void {
    const { yield: yieldHash } = output

    if (yieldHash && yieldHash.length > 0) {
      const yieldHex = bytesToHex(yieldHash)
      this.accumulationOutputs.push([serviceId, yieldHex])
    }
  }

  /**
   * Track accumulation statistics for all accumulations (including panics/OOG)
   * Gray Paper equation 390-404: accumulationstatistics[s] = tuple{G(s), N(s)}
   * where G(s) = sum of gas used from all accumulations (including panics)
   * and N(s) = count of work-items accumulated
   *
   * Gray Paper equation 217-241: C function always returns ao_gasused regardless of result
   * Gray Paper equation 196-200: u includes gas from all accone calls
   */
  private trackAccumulationStatistics(
    serviceId: bigint,
    output: AccumulateOutput,
    _currentSlot: bigint,
    workItemCount: number,
  ): void {
    const { gasused } = output

    // Track statistics for ALL accumulations (including panics/OOG)
    // Gray Paper equation 397-403:
    // - G(s) = sum of gas used from all accumulations (regardless of result)
    // - N(s) = count of work-digests in input (regardless of result)
    // N(s) counts work-digests in the INPUT, not successful results!
    const currentStats = this.accumulationStatistics.get(serviceId) || [0, 0]

    const newStats: [number, number] = [
      currentStats[0] + workItemCount, // N(s): count work-digests in input (regardless of result)
      currentStats[1] + Number(gasused), // G(s): always add gas used (even for panics/OOG)
    ]
    this.accumulationStatistics.set(serviceId, newStats)

    // Update serviceStats.accumulation in activity state
    if (this.statisticsService) {
      this.statisticsService.updateServiceAccumulationStats(serviceId, newStats)
    }
  }

  /**
   * Track onTransfers statistics for a service
   * Tracks the count of deferred transfers received and gas used processing them
   * Only tracked for JAM versions < 0.7.1
   *
   * @param serviceId - Service ID that received the transfers
   * @param transferCount - Number of deferred transfers received
   * @param gasUsed - Gas used processing the transfers
   */
  private trackOnTransfersStatistics(
    serviceId: bigint,
    transferCount: number,
    gasUsed: bigint,
  ): void {
    const currentStats = this.onTransfersStatistics.get(serviceId) || [0, 0]

    const newStats: [number, number] = [
      currentStats[0] + transferCount, // Count of deferred transfers received
      currentStats[1] + Number(gasUsed), // Total gas used processing transfers
    ]
    this.onTransfersStatistics.set(serviceId, newStats)

    // DEBUG: Log onTransfers statistics tracking
    logger.debug('[AccumulationService] trackOnTransfersStatistics', {
      serviceId: serviceId.toString(),
      transferCount,
      gasUsed: gasUsed.toString(),
      prevStats: currentStats,
      newStats,
    })

    // Update serviceStats.onTransfersCount and onTransfersGasUsed in activity state
    // Only for versions < 0.7.1 (checked inside updateServiceOnTransfersStats)
    if (this.statisticsService) {
      this.statisticsService.updateServiceOnTransfersStats(serviceId, newStats)
    }
  }

  /**
   * Collect defxfers from accumulation results
   * Gray Paper equation 206: t' = concat(accone(s).defxfers for s in s)
   * Only includes NEW defxfers generated in this iteration, NOT existing ones (which were consumed)
   */
  private collectDefxfersFromResults(
    results: AccumulateInvocationResult[],
    _existingDefxfers: DeferredTransfer[], // Existing defxfers are consumed, not carried forward
  ): DeferredTransfer[] {
    const defxfers: DeferredTransfer[] = []
    for (const result of results) {
      if (result.ok) {
        defxfers.push(...result.value.defxfers)
      }
    }
    return defxfers
  }

  /**
   * Queue editing function E
   *
   * Gray Paper equation 50-60: E removes items whose package hash is in the accumulated set,
   * and removes any dependencies which appear in said set.
   *
   * Formally: E(𝐫, 𝐱) = items from 𝐫 where:
   * - Package hash is not in 𝐱 (not already accumulated)
   * - Dependencies are filtered to remove those in 𝐱 (satisfied dependencies)
   *
   * @param items - Sequence of ready items (work report, dependency set) pairs
   * @param accumulatedPackages - Set of accumulated work-package hashes
   * @returns Edited sequence with accumulated items removed and satisfied dependencies filtered
   */
  private applyQueueEditingFunctionE(
    items: ReadyItem[],
    accumulatedPackages: Set<Hex>,
  ): ReadyItem[] {
    const edited: ReadyItem[] = []
    for (const item of items) {
      const packageHash = item.workReport.package_spec.hash
      // Remove if package was already accumulated
      if (accumulatedPackages.has(packageHash)) {
        continue
      }
      // Remove satisfied dependencies
      const remainingDeps = new Set<Hex>()
      for (const dep of item.dependencies) {
        if (!accumulatedPackages.has(dep)) {
          remainingDeps.add(dep)
        }
      }
      edited.push({
        workReport: item.workReport,
        dependencies: remainingDeps,
      })
    }
    return edited
  }

  /**
   * Extract work-package hashes function P (local¬fnsrmap)
   *
   * Gray Paper equation 77-83: P extracts package hashes from work-reports
   * P: protoset{workreport} → protoset{hash}
   * P(r) = {(r_avspec)_packagehash : r ∈ r}
   *
   * @param items - Sequence of ready items
   * @returns Set of work-package hashes
   */
  private extractPackageHashesP(items: ReadyItem[]): Set<Hex> {
    return new Set<Hex>(items.map((item) => item.workReport.package_spec.hash))
  }

  /**
   * Accumulation priority queue function Q
   *
   * Gray Paper equation 63-73: Q provides the sequence of work-reports which are able
   * to be accumulated given a set of not-yet-accumulated work-reports and their dependencies.
   *
   * Formally: Q(𝐫) = {
   *   [] if g = []
   *   g concat Q(E(𝐫, P(g))) otherwise
   *   where g = items with empty dependencies
   * }
   *
   * This is implemented iteratively (not recursively) for efficiency.
   * The function processes all items with satisfied dependencies in one conceptual pass.
   *
   * @param items - Sequence of ready items (work report, dependency set) pairs
   * @param accumulated - Current accumulated packages history
   * @returns Sequence of work-reports that can be accumulated (items with empty dependencies)
   */
  private getAccumulatableItemsQ(
    items: ReadyItem[],
    accumulated: Accumulated,
    accumulatedSoFar?: Set<Hex>,
  ): ReadyItem[] {
    // Build set of all accumulated packages from history
    const allAccumulatedPackages = new Set<Hex>()
    for (const packageSet of accumulated.packages) {
      if (packageSet) {
        for (const hash of packageSet) {
          allAccumulatedPackages.add(hash)
        }
      }
    }

    // Include packages accumulated in previous recursive calls
    if (accumulatedSoFar) {
      for (const hash of accumulatedSoFar) {
        allAccumulatedPackages.add(hash)
      }
    }

    // Find items with empty dependencies (g in Gray Paper)
    // Gray Paper: Self-referential items (depending on themselves) will never have empty dependencies
    const itemsWithEmptyDeps = items.filter(
      (item) => item.dependencies.size === 0,
    )

    // Debug: Check for self-referential items
    for (const item of items) {
      const packageHash = item.workReport.package_spec.hash
      if (item.dependencies.has(packageHash)) {
        logger.debug('[AccumulationService] Self-referential item detected', {
          packageHash: packageHash.slice(0, 40),
          dependenciesCount: item.dependencies.size,
          willNeverBeAccumulated: true,
        })
      }
    }

    if (itemsWithEmptyDeps.length === 0) {
      logger.debug('[AccumulationService] No items with empty dependencies', {
        totalItems: items.length,
      })
      return []
    }

    // Extract package hashes from items with empty deps (P(g) in Gray Paper)
    const packageHashes = this.extractPackageHashesP(itemsWithEmptyDeps)

    // Union with all accumulated packages for E function
    // E should remove dependencies that are in accumulatedcup ∪ P(g)
    const accumulatedcup = new Set<Hex>([
      ...allAccumulatedPackages,
      ...packageHashes,
    ])

    // Apply queue editing E(𝐫, accumulatedcup ∪ P(g)) to get remaining items
    const remainingItems = this.applyQueueEditingFunctionE(
      items,
      accumulatedcup,
    )

    // Recursively process remaining items: Q(E(𝐫, accumulatedcup ∪ P(g)))
    // Pass accumulatedcup to include all packages found so far
    const recursivelyAccumulatable = this.getAccumulatableItemsQ(
      remainingItems,
      accumulated,
      accumulatedcup,
    )

    // Return g concat Q(E(𝐫, accumulatedcup ∪ P(g)))
    return [...itemsWithEmptyDeps, ...recursivelyAccumulatable]
  }

  /**
   * Resolve dependencies for ready work-reports
   *
   * This method checks if work-reports have fulfilled dependencies by comparing
   * their prerequisites against the accumulated packages history.
   *
   * Based on test vector analysis:
   * - Prerequisite: "0xf5983aaa6fe1e7428902ace29d14be81a664a65f6dfca1138ccb99136547324e"
   * - Found in accumulated history at epoch index 11
   * - Therefore dependency was fulfilled and work-report became eligible
   */
  resolveDependencies(
    readyItems: ReadyItem[],
    accumulated: Accumulated,
  ): ReadyItem[] {
    const eligibleItems: ReadyItem[] = []

    for (const item of readyItems) {
      const prerequisites = Array.from(item.dependencies)
      const accumulatedHashSets = accumulated.packages

      // If there are no prerequisites, the item is immediately eligible
      if (prerequisites.length === 0) {
        eligibleItems.push(item)
        continue
      }

      // Check if all prerequisites are fulfilled
      // For each dependency, check if it exists in ANY accumulatedHashSet
      const satisfiedDependencies = new Set<Hex>()
      for (const dependency of prerequisites) {
        for (const accumulatedHashSet of accumulatedHashSets) {
          if (accumulatedHashSet.has(dependency)) {
            satisfiedDependencies.add(dependency)
            break // Found in this slot, no need to check other slots
          }
        }
      }

      // All prerequisites must be satisfied
      const allSatisfied = satisfiedDependencies.size === prerequisites.length

      if (allSatisfied) {
        eligibleItems.push(item)
      }
    }

    return eligibleItems
  }

  /**
   * Convert WorkExecResultValue to WorkExecutionResult
   *
   * WorkExecResultValue can be:
   * - Hex string or { ok: Hex } → Uint8Array
   * - { panic: null } → 'PANIC'
   * - Error strings → WorkError
   */
  private convertWorkResultToExecutionResult(
    value: WorkExecResultValue,
  ): WorkExecutionResult {
    if (typeof value === 'string') {
      if (value.startsWith('0x')) {
        // Hex string: convert to Uint8Array
        return hexToBytes(value as Hex)
      } else {
        // Error string: map to WorkExecutionResult string literals
        const errorMap: Record<string, WorkExecutionResult> = {
          out_of_gas: 'OOG',
          bad_exports: 'BADEXPORTS',
          oversize: 'OVERSIZE',
          bad_code: 'BAD',
          code_oversize: 'BIG',
        }
        return errorMap[value] || 'BAD'
      }
    } else if (typeof value === 'object' && value !== null) {
      if (
        'ok' in value &&
        typeof value.ok === 'string' &&
        value.ok.startsWith('0x')
      ) {
        // { ok: Hex } → Uint8Array
        return hexToBytes(value.ok)
      } else if ('panic' in value) {
        // { panic: null } → 'PANIC'
        return 'PANIC'
      }
    }
    // Fallback to BAD error
    return 'BAD'
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
        const executionResult = this.convertWorkResultToExecutionResult(
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
    invocationIndex?: number, // The batch invocation index (accseq iteration) - same for all services in a batch
  ): Promise<AccumulateInvocationResult> {
    // Use provided invocation index, or fall back to global counter for backward compatibility
    const orderedIndex = invocationIndex ?? this.globalInvocationIndex
    if (invocationIndex === undefined) {
      // Only increment if using fallback (backward compatibility)
      this.globalInvocationIndex++
    }

    const result = await this.accumulatePVM.executeAccumulate(
      partialState,
      timeslot,
      serviceId,
      gas,
      inputs,
      orderedIndex, // Pass ordered index for trace file naming
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

    // Reset global invocation index for this slot (used for trace file naming)
    this.globalInvocationIndex = 0

    // Clear accumulation outputs and statistics at start of the block (before any accumulation)
    // Gray Paper: accumulationstatistics is per-block, not cumulative across blocks
    // IMPORTANT: This must be done here, not in processAccumulation, because immediate items
    // are accumulated before processAccumulation and their statistics must be preserved
    this.accumulationOutputs = []
    this.accumulationStatistics.clear()
    // Clear onTransfers statistics at start of each block (per-block, not cumulative)
    this.onTransfersStatistics.clear()
    // Clear accumulated services for lastacc tracking (Gray Paper eq 410-412)
    this.accumulatedServicesForLastacc.clear()

    // Step 1: Separate new reports into immediate and queued
    const { immediateItems, queuedItems } =
      this.separateReportsIntoImmediateAndQueued(reports, slot)

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
    const packagesFromImmediate = this.extractPackageHashesP(immediateItems)
    await this.buildAndEditQueue(queuedItems, packagesFromImmediate, slot)

    // Store immediate items so their packages can be added to accumulated
    this.currentImmediateItems = immediateItems

    // Step 4: Build justbecameavailable^* = justbecameavailable^! concat Q(q)
    // Gray Paper equation 88: Combine immediate items with ready queue items into a SINGLE sequence
    // This combined sequence is then processed by accseq which batches based on gas limits
    // NOTE: Both immediate items AND ready queue items can be in the SAME batch if gas allows!
    await this.processAccumulation(slot, [], 0, immediateItems)

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
    // Slot m should only contain items from justbecameavailable^Q (new queued items)
    // Items from the pre-state ready queue that were in slot m have been processed above
    this.finalizeSlotM(slot)

    // Update last processed slot to reflect that state now represents this slot
    this.lastProcessedSlot = slot

    // Clear immediate items after processing
    this.currentImmediateItems = []

    const totalTime = performance.now() - transitionStartTime
    logger.info(
      `[AccumulationService] applyTransition completed in ${totalTime.toFixed(2)}ms`,
    )

    return { ok: true }
  }

  /**
   * Separate new reports into justbecameavailable^! and justbecameavailable^Q
   * Gray Paper equation 39-40:
   * - justbecameavailable^! = reports with zero prerequisites AND empty segment_root_lookup (accumulated immediately)
   * - justbecameavailable^Q = E(sq{D(r) | r in justbecameavailable, ...}, accumulatedcup)
   *   where D(r) = (r, set{prerequisites} ∪ keys{segment_root_lookup})
   *
   * IMPORTANT: The E function removes dependencies that are already in accumulatedcup.
   * This means if a prerequisite is already accumulated, it should be removed from dependencies.
   */
  private separateReportsIntoImmediateAndQueued(
    reports: WorkReport[],
    _slot: bigint, // Prefix with underscore to indicate intentionally unused
  ): { immediateItems: ReadyItem[]; queuedItems: ReadyItem[] } {
    const immediateItems: ReadyItem[] = []
    const queuedItems: ReadyItem[] = []

    // Get accumulatedcup (union of all accumulated packages) for E function
    // Gray Paper: accumulatedcup is the union of all accumulated packages (before processing new reports)
    const accumulatedcup = new Set<Hex>()
    for (const packageSet of this.accumulated.packages) {
      if (packageSet) {
        for (const hash of packageSet) {
          accumulatedcup.add(hash)
        }
      }
    }

    for (const report of reports) {
      const prerequisites = report.context.prerequisites || []
      const hasPrerequisites = prerequisites.length > 0
      const hasSegmentRootLookup =
        report.segment_root_lookup && report.segment_root_lookup.length > 0

      // Gray Paper equation 39: justbecameavailable^! = reports with zero prerequisites AND empty segment_root_lookup
      // Track if originally had prerequisites for ordering
      if (!hasPrerequisites && !hasSegmentRootLookup) {
        // Store with flag for sorting - true immediate items come first
        immediateItems.push({
          workReport: report,
          dependencies: new Set<Hex>(),
          _originallyImmediate: true, // Internal flag for ordering
        } as ReadyItem & { _originallyImmediate: boolean })
      } else {
        // Gray Paper equation 40-44: D(r) = (r, set{prerequisites} ∪ keys{segment_root_lookup})
        // Gray Paper equation 45: justbecameavailable^Q = E(D(r) for r with dependencies, accumulatedcup)
        //
        // IMPORTANT: Reports that ORIGINALLY had prerequisites ALWAYS go to queuedItems (justbecameavailable^Q),
        // even if dependencies are now satisfied after E function filtering.
        // The Q function will extract them from the queue when their dependencies are empty.
        // This ensures ordering: justbecameavailable^! items come first, then Q(q) items.
        const dependencies = new Set<Hex>(prerequisites)
        if (report.segment_root_lookup) {
          for (const lookupItem of report.segment_root_lookup) {
            dependencies.add(lookupItem.work_package_hash)
          }
        }

        // Apply E function: remove dependencies that are already accumulated
        // Gray Paper equation 50-60: E removes dependencies that appear in accumulatedcup
        const filteredDependencies = new Set<Hex>()
        for (const dep of dependencies) {
          if (!accumulatedcup.has(dep)) {
            filteredDependencies.add(dep)
          }
        }

        // If all dependencies are satisfied (filtered to empty), treat as immediate
        // Gray Paper: Items with no remaining dependencies can be accumulated immediately
        // This ensures work items for the same service are combined into a single invocation
        if (filteredDependencies.size === 0) {
          // Items that originally had prerequisites should come AFTER true immediate items
          immediateItems.push({
            workReport: report,
            dependencies: new Set<Hex>(),
            _originallyImmediate: false, // Was originally queued, now immediate
          } as ReadyItem & { _originallyImmediate: boolean })
        } else {
          // Queue items that still have unsatisfied dependencies
          queuedItems.push({
            workReport: report,
            dependencies: filteredDependencies,
          })
        }
      }
    }

    // Sort immediate items: true immediate (no original prerequisites) first,
    // then items that were originally queued but now have empty dependencies
    // This ensures correct ordering for accumulate inputs
    const sortedImmediateItems = immediateItems.sort((a, b) => {
      const aOrigImmediate =
        (a as ReadyItem & { _originallyImmediate?: boolean })
          ._originallyImmediate ?? false
      const bOrigImmediate =
        (b as ReadyItem & { _originallyImmediate?: boolean })
          ._originallyImmediate ?? false
      if (aOrigImmediate && !bOrigImmediate) return -1
      if (!aOrigImmediate && bOrigImmediate) return 1
      // Within same category, sort by core index for determinism
      return Number(a.workReport.core_index - b.workReport.core_index)
    })

    return { immediateItems: sortedImmediateItems, queuedItems }
  }

  // NOTE: accumulateImmediateItems removed - immediate items are now combined with ready queue
  // items in processAccumulation per Gray Paper equation 88:
  // justbecameavailable^* = justbecameavailable^! concat Q(q)
  // This allows immediate items and ready queue items to be in the SAME batch if gas allows.

  /**
   * Build queue q = E(rotated ready queue + queued items, P(justbecameavailable^!))
   * Gray Paper equation 89: q = E(concatall{ready[m:]} concat concatall{ready[:m]} concat justbecameavailable^Q, P(justbecameavailable^!))
   *
   * IMPORTANT: This is called AFTER accumulateImmediateItems, so immediate items are already accumulated
   * and NOT in the ready queue. The E function uses P(justbecameavailable^!) to edit dependencies in the
   * existing queue, removing dependencies that are satisfied by the newly accumulated immediate items.
   */
  private async buildAndEditQueue(
    queuedItems: ReadyItem[],
    accumulatedFromImmediate: Set<Hex>,
    slot: bigint,
  ): Promise<void> {
    const epochDuration = this.configService.epochDuration
    const m = Number(slot) % epochDuration

    // Gray Paper equation 89: q = E(concat{ready[m:]} ∥ concat{ready[:m]} ∥ justbecameavailable^Q, P(justbecameavailable^!))
    // IMPORTANT: q is computed from the PRE-state ready queue (including slot m).
    // The items currently in slot m need to be collected for Q(q) processing.
    // We apply E function to update dependencies based on newly accumulated immediate items.

    // Apply E function to ALL slots (including m) to update dependencies
    // This removes items whose package hash is in accumulatedFromImmediate
    // and removes dependencies that are in accumulatedFromImmediate
    for (let slotIdx = 0; slotIdx < epochDuration; slotIdx++) {
      this.readyService.applyQueueEditingFunctionEToSlot(
        BigInt(slotIdx),
        accumulatedFromImmediate,
      )
    }

    // Apply E function to new queued items using accumulatedFromImmediate
    // Gray Paper equation 89: q = E(... ∥ justbecameavailable^Q, P(justbecameavailable^!))
    const editedQueuedItems = this.applyQueueEditingFunctionE(
      queuedItems,
      accumulatedFromImmediate,
    )

    // Store the package hashes of new queued items for later filtering
    // Gray Paper equation 420: ready'[m] = E(justbecameavailable^Q, accumulated'[E-1]) when i = 0
    // After processAccumulation, slot m should ONLY contain items from justbecameavailable^Q
    this.newQueuedItemsForSlotM = new Set<Hex>(
      editedQueuedItems.map((item) => item.workReport.package_spec.hash),
    )

    // Add edited queued items to slot m
    // Items with empty dependencies will be picked up by getAccumulatableItemsQ in processAccumulation
    // Note: Old items in slot m are preserved for now - they'll be collected by processAccumulation
    // After processing, finalizeSlotM will ensure only new queued items remain
    for (const item of editedQueuedItems) {
      this.readyService.addReadyItemToSlot(BigInt(m), item)
    }
  }

  /**
   * Finalize slot m after accumulation processing
   * Gray Paper equation 420: ready'[m] = E(justbecameavailable^Q, accumulated'[E-1]) when i = 0
   * Slot m should ONLY contain items that came from justbecameavailable^Q (new queued items)
   */
  private finalizeSlotM(slot: bigint): void {
    const epochDuration = this.configService.epochDuration
    const m = Number(slot) % epochDuration

    const slotItems = this.readyService.getReadyItemsForSlot(BigInt(m))
    const itemsToKeep: ReadyItem[] = []

    for (const item of slotItems) {
      const packageHash = item.workReport.package_spec.hash
      // Only keep items that came from justbecameavailable^Q (new queued items)
      if (this.newQueuedItemsForSlotM.has(packageHash)) {
        itemsToKeep.push(item)
      }
    }

    // Replace slot m with only the items from justbecameavailable^Q
    this.readyService.clearSlot(BigInt(m))
    for (const item of itemsToKeep) {
      this.readyService.addReadyItemToSlot(BigInt(m), item)
    }

    // Clear the tracking set
    this.newQueuedItemsForSlotM.clear()
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
    _epochSlotIndex: bigint,
    partialStateAccountsPerInvocation?: Map<number, Set<bigint>>,
    immediateItems?: ReadyItem[], // Add immediate items to ensure their packages are added
    accumulatedServiceIds?: bigint[], // Service ID for each invocation (needed for transfer-only)
  ): void {
    if (!this.serviceAccountsService) {
      throw new Error('Service accounts service not initialized')
    }
    if (!this.privilegesService) {
      throw new Error('Privileges service not initialized')
    }
    if (!this.clockService) {
      throw new Error('Clock service not initialized')
    }

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
    // Step 1: Update accumulated packages
    // Gray Paper equations 417-418:
    // accumulated'_{C_epochlen - 1} = P(justbecameavailable^*[..n])
    // ∀i ∈ [0, C_epochlen - 1): accumulated'_i = accumulated_{i + 1}
    //
    // Where P extracts package hashes from work-reports (equation 77-83):
    // P: protoset{workreport} → protoset{hash}
    // P(r) = {(r_avspec)_packagehash : r ∈ r}

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
        logger.debug(
          '[AccumulationService] No service ID for invocation - skipping',
          {
            invocationIndex: i,
          },
        )
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
        // The DESIGNATE host function updates imX.state.stagingset, which becomes poststate.stagingset
        // We need to apply this to the global ValidatorSetManager
        // Only update if the current service is the delegator (DESIGNATE host function checks this)
        // Gray Paper: Only apply staging set if the service was the delegator in the ORIGINAL
        // snapshot (before any services ran). A service can only successfully call DESIGNATE
        // if it is the delegator when it runs. If a service changes the delegator via BLESS,
        // then later services that become delegator cannot call DESIGNATE successfully
        // (they'll get HUH because they're not the delegator in their snapshot).
        //
        // Check against the ORIGINAL delegator (initialPrivileges.delegator), not poststate.delegator.
        // This ensures we apply the staging set from the service that was ORIGINALLY the delegator
        // and could have successfully called DESIGNATE.
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
        logger.debug('[AccumulationService] Accumulation failed', {
          invocationIndex: i,
          accumulatedServiceId: accumulatedServiceId.toString(),
          resultCode: result.err,
        })

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

    // Ejected services are already detected above using partialStateAccountsPerInvocation
    // No need for additional check - the ejectedServices set is already populated

    // Step 3: Process deferred transfers (defxfers) globally
    // Gray Paper equation 208-212: Collect defxfers from all invocations and apply them
    // IMPORTANT: Apply transfers BEFORE deleting ejected services
    // This ensures transfers are applied even if the destination service was ejected
    // (though ejected services will be deleted immediately after)
    const allDefxfers: DeferredTransfer[] = []
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.ok) {
        allDefxfers.push(...result.value.defxfers)
      }
    }

    // Gray Paper: Deferred transfer credits are applied via calculatePostTransferState
    // when the destination service is accumulated (including on_transfer callbacks).
    // However, the poststate from accumulation already includes these credits, so we
    // don't need to apply them again here.
    //
    // The flow is:
    // 1. TRANSFER host function deducts from source balance (in poststate)
    // 2. Defxfer is collected and passed to next iteration
    // 3. Destination service is accumulated with defxfer as input
    // 4. calculatePostTransferState credits destination balance before execution
    // 5. Destination's poststate (with credit) is persisted in updateGlobalState
    //
    // So credits are already in the poststate - no need to apply them here.
    if (allDefxfers.length > 0) {
      logger.debug(
        '[AccumulationService] Deferred transfers will be processed in next iteration',
        {
          defxferCount: allDefxfers.length,
          defxfers: allDefxfers.map((t) => ({
            source: t.source.toString(),
            dest: t.dest.toString(),
            amount: t.amount.toString(),
          })),
        },
      )
    }

    // Step 4: Delete ejected services (after applying transfers)
    // This ensures any transfers to ejected services are attempted before deletion
    for (const ejectedServiceId of ejectedServices) {
      const [deleteError] =
        this.serviceAccountsService.deleteServiceAccount(ejectedServiceId)
      if (deleteError) {
        logger.warn('[AccumulationService] Failed to delete ejected service', {
          serviceId: ejectedServiceId.toString(),
          error: deleteError.message,
        })
      } else {
        logger.info('[AccumulationService] Deleted ejected service', {
          serviceId: ejectedServiceId.toString(),
        })
      }
    }

    // Step 3: Apply queue-editing function E (Gray Paper equation 48-61)
    // E removes entries whose package hash is accumulated, and removes satisfied
    // dependencies from remaining entries

    // Use newPackages (successfully accumulated) for queue editing
    // Only successfully accumulated packages go into the accumulated history for dependency tracking
    const accumulatedPackageHashes = newPackages

    // Remove ALL processed work reports from ready queue, regardless of success/failure
    // Gray Paper: A work report is "processed" once accumulation is attempted, even if it fails
    // Failed work reports (PANIC/OOG) should NOT be re-processed - they are consumed by the attempt
    for (const processedReport of processedWorkReports) {
      // Log whether this was successfully accumulated (for debugging)
      const wasSuccessful = accumulatedPackageHashes.has(
        processedReport.package_spec.hash,
      )
      if (!wasSuccessful) {
        logger.debug(
          '[AccumulationService] Removing failed work report from queue',
          {
            packageHash: processedReport.package_spec.hash.slice(0, 40),
          },
        )
      }

      const [hashError, workReportHash] =
        calculateWorkReportHash(processedReport)
      if (hashError) {
        logger.error(
          '[AccumulationService] Failed to calculate work report hash',
          {
            packageHash: processedReport.package_spec.hash,
            error: hashError.message,
          },
        )
      } else {
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
        if (hashError) {
          continue
        }

        // Remove dependencies that are now accumulated
        let removedDepsCount = 0
        for (const dep of accumulatedPackageHashes) {
          if (item.dependencies.has(dep)) {
            this.readyService.removeDependency(workReportHash, dep)
            removedDepsCount++
          }
        }

        if (removedDepsCount > 0) {
          logger.debug(
            '[AccumulationService] Removed satisfied dependencies from ready item',
            {
              slot: currentSlot.toString(),
              slotIndex: slotIdx,
              workReportHash,
              removedDepsCount,
              remainingDepsCount: item.dependencies.size,
            },
          )
        }
      }
    }

    // Step 4: Update timeslot
    this.clockService.getCurrentSlot()
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
