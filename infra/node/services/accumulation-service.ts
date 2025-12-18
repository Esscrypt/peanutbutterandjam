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
  calculateWorkReportHash,
  decodeWorkPackage,
  encodeValidatorPublicKeys,
} from '@pbnjam/codec'
import { bytesToHex, hexToBytes, logger } from '@pbnjam/core'
import { RESULT_CODES } from '@pbnjam/pvm'
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
  WORK_REPORT_CONSTANTS,
  type WorkExecResultValue,
  type WorkExecutionResult,
  type WorkItem,
  type WorkPackage,
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
  private readonly privilegesService: PrivilegesService | null
  private readonly validatorSetManager: ValidatorSetManager
  private readonly accumulatePVM: AccumulatePVM
  private readonly authQueueService: AuthQueueService
  private readonly readyService: ReadyService
  private readonly statisticsService: StatisticsService
  // Track the last processed slot (for determining shift delta)
  private lastProcessedSlot: bigint | null = null
  // Track local_fnservouts (accumulation output pairings) for the latest accumulation
  // Gray Paper equation 201-207: local_fnservouts ≡ { (s, b) : s ∈ s, b = acc(s).yield, b ≠ none }
  // Gray Paper: local_fnservouts ≡ protoset{tuple{serviceid, hash}}
  // Only includes services where yield is non-None (yield is the hash value)
  // This is used to construct lastaccout' for the accoutBelt
  // Only tracks the most recent accumulation (cleared at start of each processAccumulation)
  private accumulationOutputs: Map<bigint, Hex> = new Map()
  // Track accumulation statistics per service: tuple{count, gas}
  // Gray Paper: accumulationstatistics[s] = tuple{N, gas}
  // This tracks the count and total gas used for accumulations per service
  private accumulationStatistics: Map<bigint, [number, number]> = new Map()
  // private readonly entropyService: EntropyService | null
  constructor(options: {
    configService: ConfigService
    clockService: ClockService
    serviceAccountsService: ServiceAccountsService
    privilegesService: PrivilegesService | null
    validatorSetManager: ValidatorSetManager
    authQueueService: AuthQueueService
    accumulatePVM: AccumulatePVM
    readyService: ReadyService
    statisticsService: StatisticsService
    // entropyService: EntropyService | null
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
    // this.entropyService = options.entropyService
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
  getLastAccumulationOutputs(): Map<bigint, Hex> {
    // if (this.accumulationOutputs.size === 0) {
    //   // Return default Map with zeroHash when no accumulation outputs exist
    //   return new Map([[0n, zeroHash]])
    // }
    return new Map(this.accumulationOutputs) // Return copy to prevent mutation
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
    this.accumulationOutputs.clear()
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
   * Set last processed slot (the slot that the current accumulated/ready state represents)
   */
  setLastProcessedSlot(slot: bigint): void {
    this.lastProcessedSlot = slot
  }

  setLastAccumulationOutputs(lastAccumulationOutputs: Map<bigint, Hex>): void {
    this.accumulationOutputs = new Map(lastAccumulationOutputs)
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

    logger.debug('[AccumulationService] Calculated total gas limit', {
      maxBlockGas: totalGasLimit.toString(),
    })

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
  async processAccumulation(currentSlot: bigint): Promise<void> {
    logger.info('[AccumulationService] processAccumulation called', {
      slot: currentSlot.toString(),
      epochSlot: (
        Number(currentSlot) % this.configService.epochDuration
      ).toString(),
    })

    // Clear accumulation outputs at start to track only the latest accumulation
    this.accumulationOutputs.clear()

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
    let pendingDefxfers: DeferredTransfer[] = []

    // Track total gas used across all accumulations (Gray Paper: accseq tracks gas consumption)
    // Gray Paper equation 163: i = max prefix such that sum(gaslimit) ≤ g
    let totalGasUsed = 0n

    while (iterationCount < maxIterations) {
      iterationCount++

      // Step 1: Collect all ready items from ALL slots (in rotated order: [m:] then [:m])
      const allReadyItems = this.collectAllReadyItems(epochLength, currentSlot)

      if (allReadyItems.length === 0) {
        logger.info(
          '[AccumulationService] No ready items in any slot - breaking accumulation loop',
          {
            slot: currentSlot.toString(),
            iteration: iterationCount,
          },
        )
        break
      }

      logger.info(
        '[AccumulationService] Found ready items - proceeding with accumulation',
        {
          slot: currentSlot.toString(),
          readyItemsCount: allReadyItems.length,
          iteration: iterationCount,
        },
      )

      // Step 2: Use Q function to get all currently accumulatable items
      const accumulatableItems = this.getAccumulatableItemsQ(
        allReadyItems,
        this.accumulated,
      )

      if (accumulatableItems.length === 0) {
        logger.debug(
          '[AccumulationService] No items with satisfied dependencies (Q returned empty)',
          {
            slot: currentSlot.toString(),
            iteration: iterationCount,
            totalReady: allReadyItems.length,
          },
        )
        break
      }

      logger.info(
        '[AccumulationService] Found accumulatable items using Q function',
        {
          slot: currentSlot.toString(),
          iteration: iterationCount,
          totalReady: allReadyItems.length,
          accumulatableFromQ: accumulatableItems.length,
          pendingDefxfersCount: pendingDefxfers.length,
          eligiblePackages: accumulatableItems.map(
            (item) => item.workReport.package_spec.hash,
          ),
        },
      )

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
      const { prefixItems, prefixGasLimit } = this.findMaxPrefixWithinGasLimit(
        accumulatableItems,
        availableGas,
      )

      if (prefixItems.length === 0) {
        logger.debug(
          '[AccumulationService] No items fit within available gas limit',
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

      logger.info('[AccumulationService] Processing prefix within gas limit', {
        slot: currentSlot.toString(),
        iteration: iterationCount,
        prefixCount: prefixItems.length,
        totalAccumulatable: accumulatableItems.length,
        prefixGasLimit: prefixGasLimit.toString(),
        availableGas: availableGas.toString(),
        totalGasLimit: totalGasLimit.toString(),
        defxferGas: defxferGas.toString(),
        totalGasUsed: totalGasUsed.toString(),
      })

      // Step 5: Group prefix items by service ID
      const serviceToItems = this.groupItemsByServiceId(prefixItems)

      // Step 6: Execute PVM accumulate invocations sequentially
      const {
        results,
        processedWorkReports,
        workReportsByService,
        partialStateAccountsPerInvocation,
      } = await this.executeAccumulationInvocations(
        serviceToItems,
        currentSlot,
        pendingDefxfers,
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
      pendingDefxfers = this.collectDefxfersFromResults(
        results,
        pendingDefxfers,
      )

      // Step 6: Update global state with results
      this.updateGlobalState(
        results,
        processedWorkReports,
        workReportsByService,
        currentSlot,
        epochSlotIndex,
        partialStateAccountsPerInvocation,
      )
    }
  }

  /**
   * Find maximum prefix of work reports that fits within gas limit
   * Gray Paper equation 163: i = max prefix such that sum_{r in r[:i], d in r.digests}(d.gaslimit) ≤ g
   *
   * @param items - Ready items to process
   * @param remainingGas - Remaining gas available
   * @returns Prefix items and their total gas limit
   */
  private findMaxPrefixWithinGasLimit(
    items: ReadyItem[],
    remainingGas: bigint,
  ): { prefixItems: ReadyItem[]; prefixGasLimit: bigint } {
    const prefixItems: ReadyItem[] = []
    let cumulativeGasLimit = 0n

    for (const item of items) {
      // Calculate gas limit for this work report: sum of all work-digest gas limits
      const workReportGasLimit = item.workReport.results.reduce(
        (sum, result) => sum + BigInt(result.accumulate_gas),
        0n,
      )

      // Check if adding this item would exceed remaining gas
      if (cumulativeGasLimit + workReportGasLimit > remainingGas) {
        break
      }

      prefixItems.push(item)
      cumulativeGasLimit += workReportGasLimit
    }

    return { prefixItems, prefixGasLimit: cumulativeGasLimit }
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
    const currentEpochSlot = Number(currentSlot) % epochLength

    // Only process items from the current slot (when their slot comes around again after a full epoch)
    // This matches jamduna behavior where accumulation only happens when items have been in queue for a full epoch
    // Since we now process accumulation BEFORE adding new items, all items in the queue are from previous blocks
    const slotItems = this.readyService.getReadyItemsForSlot(
      BigInt(currentEpochSlot),
    )
    allReadyItems.push(...slotItems)

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
   */
  private async executeAccumulationInvocations(
    serviceToItems: Map<bigint, ReadyItem[]>,
    currentSlot: bigint,
    pendingDefxfers: DeferredTransfer[],
  ): Promise<{
    results: AccumulateInvocationResult[]
    processedWorkReports: WorkReport[]
    workReportsByService: Map<number, WorkReport[]> // Map service index to its work reports
    partialStateAccountsPerInvocation: Map<number, Set<bigint>>
  }> {
    const results: AccumulateInvocationResult[] = []
    const processedWorkReports: WorkReport[] = []
    const workReportsByService: Map<number, WorkReport[]> = new Map()
    const partialStateAccountsPerInvocation: Map<
      number,
      Set<bigint>
    > = new Map()

    // Pre-compute operand tuples (i^U) for all items once
    const allItems = Array.from(serviceToItems.values()).flat()
    const operandTuplesByService = this.createAccumulateInputs(
      allItems,
      [], // Start with empty defxfers - they'll be added dynamically
    )

    // Track defxfers within this iteration (for services in same iteration)
    const iterationDefxfers = [...pendingDefxfers]

    let invocationIndex = 0
    for (const [serviceId, serviceItems] of serviceToItems) {
      const result = await this.executeSingleServiceAccumulation(
        serviceId,
        serviceItems,
        currentSlot,
        iterationDefxfers, // Use iteration defxfers (includes defxfers from earlier services in this iteration)
        operandTuplesByService,
        invocationIndex,
        partialStateAccountsPerInvocation,
      )

      results.push(result.result)
      processedWorkReports.push(...result.serviceWorkReports)
      workReportsByService.set(invocationIndex, result.serviceWorkReports)

      // Update iteration defxfers for next service in same iteration
      if (result.result.ok) {
        iterationDefxfers.push(...result.result.value.defxfers)
      }

      invocationIndex++
    }

    return {
      results,
      processedWorkReports,
      workReportsByService,
      partialStateAccountsPerInvocation,
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
    const alwaysaccers =
      this.privilegesService?.getAlwaysAccers() ?? new Map<bigint, bigint>()
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

    logger.debug('[AccumulationService] Calculated service gas limit', {
      serviceId: serviceId.toString(),
      freeGas: freeGas.toString(),
      defxferGas: defxferGas.toString(),
      workDigestGas: workDigestGas.toString(),
      totalGasLimit: totalGasLimit.toString(),
    })

    return totalGasLimit
  }

  /**
   * Execute accumulation for a single service
   */
  private async executeSingleServiceAccumulation(
    serviceId: bigint,
    serviceItems: ReadyItem[],
    currentSlot: bigint,
    pendingDefxfers: DeferredTransfer[],
    operandTuplesByService: Map<bigint, AccumulateInput[]>,
    invocationIndex: number,
    partialStateAccountsPerInvocation: Map<number, Set<bigint>>,
  ): Promise<{
    result: AccumulateInvocationResult
    serviceWorkReports: WorkReport[]
  }> {
    logger.debug('[AccumulationService] Processing service', {
      slot: currentSlot.toString(),
      serviceId: serviceId.toString(),
      serviceItemsCount: serviceItems.length,
    })

    // Get pre-computed operand tuples (i^U) for this service
    const operandTuples = operandTuplesByService.get(serviceId) || []

    // Add defxfers (i^T) that have accumulated so far
    const defxfersForService = pendingDefxfers.filter(
      (d) => d.dest === serviceId,
    )

    // Combine inputs: i^T concat i^U (defxfers first, then operand tuples)
    const inputs: AccumulateInput[] = [
      ...defxfersForService.map((d) => ({
        type: 1 as const,
        value: d,
      })),
      ...operandTuples,
    ]

    const serviceWorkReports = serviceItems.map((item) => item.workReport)

    // Convert global state to partial state for PVM
    const partialState = this.createPartialState()

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
    const gasLimit = this.calculateServiceGasLimit(
      serviceId,
      serviceItems,
      pendingDefxfers,
    )

    // Extract workItems from serviceItems for FETCH host function
    // WorkItems are the original work items from the work packages that produced these work reports
    // We reconstruct them from WorkReport.results, even though we don't have the full payload
    const workItems = this.extractWorkItemsFromReadyItems(
      serviceItems,
      serviceId,
    )

    // Execute accumulate invocation
    const result = await this.executeAccumulateInvocation(
      partialState,
      currentSlot,
      serviceId,
      gasLimit,
      inputs,
      workItems,
    )

    // Track accumulation output and statistics
    if (result.ok) {
      this.trackAccumulationOutput(serviceId, result.value, currentSlot)
      this.trackAccumulationStatistics(serviceId, result.value, currentSlot)
    }

    return { result, serviceWorkReports }
    // TODO: temporary. should use real pvm execution in real case
    // For test vectors, return a non-null yield so packages are added to accumulated
    // Yield is a Uint8Array representing the accumulation result hash
    // Using empty array as placeholder - in real execution this would be the actual hash
    // return {
    //   result: {
    //     ok: true,
    //     value: {
    //       poststate: partialState,
    //       defxfers: [],
    //       yield: new Uint8Array(32),
    //       gasused: gasLimit,
    //       provisions: new Map(),
    //       resultCode: RESULT_CODES.HALT,
    //     },
    //   },
    //   serviceWorkReports,
    // }
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
      logger.debug(
        '[AccumulationService] Staging set has fewer than Cvalcount validators, padding with null validators',
        {
          currentCount: stagingset.length,
          requiredCount,
        },
      )

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

    return {
      accounts: this.serviceAccountsService.getServiceAccounts().accounts,
      stagingset,
      authqueue: this.authQueueService
        ? this.authQueueService
            .getAuthQueue()
            .map((queue) => queue.map((item) => hexToBytes(item)))
        : new Array(this.configService.numCores).fill([]),
      manager: this.privilegesService?.getManager() ?? 0n,
      assigners:
        this.privilegesService?.getAssigners() ??
        new Array(this.configService.numCores).fill(0n),
      delegator: this.privilegesService?.getDelegator() ?? 0n,
      registrar: this.privilegesService?.getRegistrar() ?? 0n,
      alwaysaccers:
        this.privilegesService?.getAlwaysAccers() ?? new Map<bigint, bigint>(),
    }
  }

  /**
   * Track accumulation output for local_fnservouts
   * Gray Paper: local_fnservouts ≡ protoset{tuple{serviceid, hash}}
   */
  private trackAccumulationOutput(
    serviceId: bigint,
    output: AccumulateOutput,
    currentSlot: bigint,
  ): void {
    const { yield: yieldHash } = output

    // Gray Paper: Only include in local_fnservouts if yield ≠ none
    if (yieldHash && yieldHash.length > 0) {
      this.accumulationOutputs.set(serviceId, bytesToHex(yieldHash))
      logger.debug('[AccumulationService] Added to local_fnservouts', {
        serviceId: serviceId.toString(),
        slot: currentSlot.toString(),
        yieldHash: bytesToHex(yieldHash),
      })
    } else {
      logger.debug(
        '[AccumulationService] Yield is None, not adding to local_fnservouts',
        // {
        //   serviceId: serviceId.toString(),
        //   slot: currentSlot.toString(),
        //   gasused: output.gasused.toString(),
        //   resultCode: output.resultCode.toString(),
        //   poststate: output.poststate,
        // },
      )
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
    currentSlot: bigint,
  ): void {
    const { gasused, resultCode } = output

    // Track statistics for ALL accumulations (including panics/OOG)
    // Gray Paper: gas used is always tracked regardless of result code
    const currentStats = this.accumulationStatistics.get(serviceId) || [0, 0]

    // Only increment count for successful (HALT) accumulations
    // Gray Paper equation 399-403: N(s) counts accumulated work-items (only successful ones)
    const countIncrement = resultCode === RESULT_CODES.HALT ? 1 : 0

    const newStats: [number, number] = [
      currentStats[0] + countIncrement, // Increment count only for HALT
      currentStats[1] + Number(gasused), // Always add gas used (even for panics/OOG)
    ]
    this.accumulationStatistics.set(serviceId, newStats)

    // Update serviceStats.accumulation in activity state
    if (this.statisticsService) {
      this.statisticsService.updateServiceAccumulationStats(serviceId, newStats)
    }

    logger.debug('[AccumulationService] Tracked accumulation statistics', {
      serviceId: serviceId.toString(),
      slot: currentSlot.toString(),
      resultCode,
      count: newStats[0],
      gas: newStats[1],
      gasUsed: gasused.toString(),
    })
  }

  /**
   * Collect defxfers from accumulation results
   */
  private collectDefxfersFromResults(
    results: AccumulateInvocationResult[],
    existingDefxfers: DeferredTransfer[],
  ): DeferredTransfer[] {
    const defxfers = [...existingDefxfers]
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

    // Gray Paper: i = i^T concat i^U (defxfers first, then operand tuples)
    // This is already the order since we added defxfers first, then operand tuples
    logger.debug('[AccumulationService] Created accumulate inputs by service', {
      servicesCount: inputsByService.size,
      inputsPerService: Array.from(inputsByService.entries()).map(
        ([serviceId, inputs]) => ({
          serviceId: serviceId.toString(),
          totalInputs: inputs.length,
          defxferCount: inputs.filter((i) => i.type === 1).length,
          operandTupleCount: inputs.filter((i) => i.type === 0).length,
        }),
      ),
      pendingDefxfersCount: pendingDefxfers.length,
    })

    return inputsByService
  }

  /**
   * Extract WorkItem[] from ReadyItem[] for a specific service
   *
   * Gray Paper pvm_invocations.tex line 148-150: Ψ_A signature is
   * (partialstate, timeslot, serviceid, gas, sequence{accinput}) → acconeout
   *
   * Work items are NOT part of the formal Ψ_A signature, BUT they ARE needed for
   * the FETCH host call (selector 14) which is called via the context mutator F.
   *
   * Gray Paper pvm_invocations.tex line 189: Context mutator F passes \mathbf{i} (work items sequence)
   * to FETCH host call: Ω_Y(..., \none, \entropyaccumulator', \none, \none, \none, \none, \mathbf{i}, \imXY)
   *
   * Gray Paper pvm_invocations.tex line 359: FETCH selector 14 returns encode(var{\mathbf{i}})
   * where \mathbf{i} is the work items sequence from work packages being accumulated.
   *
   * The \mathbf{i} in the context mutator is a free variable that must be provided by the
   * implementation when creating the context mutator F. It's not part of Ψ_A's signature.
   *
   * CAN WE DERIVE WORK ITEMS FROM WORK DIGESTS?
   *
   * NO - Work digests are a lossy transformation (Gray Paper equation 130-151, itemtodigest):
   * - wi_payload → wd_payloadhash (loses payload blob)
   * - wi_importsegments → wd_importcount (loses segments array)
   * - wi_extrinsics → wd_xtcount, wd_xtsize (loses extrinsics array)
   * - wi_refgaslimit → not in work digest (only accgaslimit is preserved)
   *
   * Therefore, we CANNOT fully reconstruct work items from work digests alone.
   *
   * HOW TO GET WORK ITEMS:
   *
   * 1. **Fetch from D³L** (Distributed, Decentralized, Data Lake):
   *    - Work packages are erasure-coded and distributed off-chain via D³L
   *    - Use package hash (from workReport.package_spec.hash) to fetch the work package
   *    - This is the standard way to retrieve work packages
   *
   * 2. **Check preimages** (if stored):
   *    - Work packages COULD be stored as preimages in service accounts (sa_preimages)
   *    - This is not standard but possible
   *    - We attempt this lookup first as a convenience
   *
   * 3. **Reconstruct incomplete** (fallback):
   *    - If work package not available, reconstruct from WorkReport.results
   *    - This is INCOMPLETE and missing:
   *      - payload: Empty (only have payload_hash)
   *      - importsegments: Empty array (only have importcount)
   *      - extrinsics: Empty array (only have xtcount, xtsize)
   *      - refgaslimit: Using refine_load.gas_used (actual consumed, not original limit)
   *
   * IMPORTANT: Work packages are NOT stored in blockchain state. They are:
   * - Submitted by builders and processed by guarantors
   * - Erasure coded and distributed off-chain via D³L
   * - Only work REPORTS (not packages) are stored on-chain in the reports state component
   *
   * @param readyItems - Ready items containing work reports
   * @param serviceId - Service ID to filter work items for
   * @returns Array of WorkItem structures (may be incomplete if work package not available)
   */
  private extractWorkItemsFromReadyItems(
    readyItems: ReadyItem[],
    serviceId: bigint,
  ): WorkItem[] {
    const workItems: WorkItem[] = []

    for (const readyItem of readyItems) {
      const workReport = readyItem.workReport
      const packageHash = workReport.package_spec.hash

      // Try to look up the original work package from preimages
      // Work packages are NOT stored in blockchain state - they're distributed off-chain via D³L
      // However, they COULD be stored as preimages in service accounts (sa_preimages)
      // We try to look it up, but in practice they're unlikely to be there
      let workPackage: WorkPackage | null = null

      // Try to get work package from preimages
      // Note: We don't know which service stored it, so we'd need to check all services
      // For now, we skip this lookup as work packages are typically not in preimages
      // TODO: If needed, iterate through all service accounts to find the preimage
      const [preimageError, preimage] =
        this.serviceAccountsService.getPreimage(packageHash)
      if (!preimageError && preimage) {
        // Try to decode as work package
        const [decodeError, decodeResult] = decodeWorkPackage(
          hexToBytes(preimage.blob),
        )
        if (!decodeError && decodeResult) {
          workPackage = decodeResult.value
        }
      }

      // Extract work items from work report results
      // Each result corresponds to one work item
      for (const workResult of workReport.results) {
        // Only include work items for the specified service
        if (workResult.service_id !== serviceId) {
          continue
        }

        let workItem: WorkItem

        if (workPackage) {
          // Found the original work package in preimages - use it!
          // Find the matching work item by service_id and code_hash
          const originalWorkItem = workPackage.workItems.find(
            (wi) =>
              wi.serviceindex === workResult.service_id &&
              wi.codehash === workResult.code_hash,
          )
          if (originalWorkItem) {
            workItem = originalWorkItem
          } else {
            // Fallback: reconstruct from WorkResult
            workItem = {
              serviceindex: workResult.service_id,
              codehash: workResult.code_hash,
              payload: new Uint8Array(0),
              refgaslimit: workResult.refine_load.gas_used,
              accgaslimit: workResult.accumulate_gas,
              exportcount: workResult.refine_load.exports,
              importsegments: [],
              extrinsics: [],
            }
          }
        } else {
          // Work package not found in preimages - reconstruct from WorkResult
          // NOTE: This is incomplete - we don't have access to the original work package
          // WorkResult only contains execution metadata, not the original work item structure
          workItem = {
            serviceindex: workResult.service_id,
            codehash: workResult.code_hash,
            payload: new Uint8Array(0), // Empty payload - we only have payload_hash
            refgaslimit: workResult.refine_load.gas_used, // WRONG: This is gas_used, not refgaslimit
            accgaslimit: workResult.accumulate_gas,
            exportcount: workResult.refine_load.exports,
            importsegments: [], // Not available in WorkResult
            extrinsics: [], // Not available in WorkResult
          }
        }

        workItems.push(workItem)
      }
    }

    return workItems
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
    workItems: WorkItem[] = [],
  ): Promise<AccumulateInvocationResult> {
    const result = await this.accumulatePVM.executeAccumulate(
      partialState,
      timeslot,
      serviceId,
      gas,
      inputs,
      workItems,
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
    const epochDuration = this.configService.epochDuration

    // Step 1: Separate new reports into immediate and queued
    const { immediateItems, queuedItems } =
      this.separateReportsIntoImmediateAndQueued(reports, slot)

    // Step 2: Shift accumulated packages history and ready queue if slot advanced
    // Gray Paper equations 417-418: Shift is part of the state transition from τ to τ'

    // Determine slot delta: if lastProcessedSlot is set, calculate delta; otherwise assume delta=1
    let slotDelta = 1
    if (this.lastProcessedSlot !== null) {
      slotDelta = Number(slot - this.lastProcessedSlot)
    }

    if (slotDelta > 0) {
      // Shift accumulated packages history (equation 417-418)
      // This is a non-wrapping left shift: old data falls off, new empty slots on right
      this.shiftAccumulatedPackagesHistory(slotDelta, epochDuration)

      // Shift ready queue - clear old slots (equation 419-424)
      const currentEpochSlot = Number(slot) % epochDuration
      this.shiftReadyQueue(slotDelta, epochDuration, currentEpochSlot)
    }

    // Step 3: Add immediate items to ready queue FIRST so they can be processed immediately
    // Gray Paper equation 39: justbecameavailable^! = reports with zero prerequisites AND empty segment_root_lookup
    // These should be accumulated immediately when they become available
    await this.processImmediateItems(immediateItems, slot)

    // Step 4: Build and edit queue, then process accumulation
    // Gray Paper equation 89: q = E(..., P(justbecameavailable^!))
    // The E function uses P(justbecameavailable^!) to edit dependencies in the existing queue
    const packagesFromImmediate = this.extractPackageHashesP(immediateItems)
    await this.buildAndEditQueue(queuedItems, packagesFromImmediate, slot)

    // Step 5: Process accumulation on items in the queue (including newly added immediate items)
    await this.processAccumulation(slot)

    // Update last processed slot to reflect that state now represents this slot
    this.lastProcessedSlot = slot

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
    slot: bigint,
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
      if (!hasPrerequisites && !hasSegmentRootLookup) {
        immediateItems.push({
          workReport: report,
          dependencies: new Set<Hex>(),
        })
      } else {
        // Gray Paper equation 40-44: D(r) = (r, set{prerequisites} ∪ keys{segment_root_lookup})
        // Gray Paper equation 45: justbecameavailable^Q = E(D(r) for r with dependencies, accumulatedcup)
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

        // If all dependencies are satisfied (filteredDependencies is empty), it becomes immediate
        if (filteredDependencies.size === 0) {
          immediateItems.push({
            workReport: report,
            dependencies: new Set<Hex>(),
          })
        } else {
          queuedItems.push({
            workReport: report,
            dependencies: filteredDependencies,
          })
        }
      }
    }

    logger.debug('[AccumulationService] Separated new reports', {
      slot: slot.toString(),
      immediateReportsCount: immediateItems.length,
      queuedReportsCount: queuedItems.length,
      immediatePackageHashes: immediateItems.map((item) =>
        item.workReport.package_spec.hash.slice(0, 40),
      ),
    })

    return { immediateItems, queuedItems }
  }

  /**
   * Process immediate items first (justbecameavailable^!)
   * Gray Paper equation 39: justbecameavailable^! = reports with zero prerequisites AND empty segment_root_lookup
   *
   * These items should be added to the ready queue immediately so they can be processed in the current block.
   */
  private async processImmediateItems(
    immediateItems: ReadyItem[],
    slot: bigint,
  ): Promise<void> {
    if (immediateItems.length === 0) {
      return
    }

    const epochDuration = this.configService.epochDuration
    const newReportsSlot = Number(slot) % epochDuration

    // Add immediate items to ready queue at current slot
    // They will be processed immediately when processAccumulation is called
    for (const item of immediateItems) {
      this.readyService.addReadyItemToSlot(BigInt(newReportsSlot), item)
    }
  }

  /**
   * Build queue q = E(rotated ready queue + queued items, P(justbecameavailable^!))
   * Gray Paper equation 89: q = E(concatall{ready[m:]} concat concatall{ready[:m]} concat justbecameavailable^Q, P(justbecameavailable^!))
   *
   * IMPORTANT: This is called AFTER processImmediateItems, so the ready queue already contains
   * the immediate items. The E function uses P(justbecameavailable^!) to edit dependencies in the
   * existing queue, removing dependencies that are satisfied by the newly accumulated immediate items.
   */
  private async buildAndEditQueue(
    queuedItems: ReadyItem[],
    accumulatedFromImmediate: Set<Hex>,
    slot: bigint,
  ): Promise<void> {
    const epochDuration = this.configService.epochDuration
    const m = Number(slot) % epochDuration

    // Gray Paper equation 89: q = E(concatall{ready[m:]} concat concatall{ready[:m]} concat justbecameavailable^Q, P(justbecameavailable^!))
    // Get current ready queue (which now includes immediate items added in processImmediateItems)
    const currentReady = this.readyService.getReady()

    // Apply E function to existing ready queue items to remove accumulated dependencies
    logger.debug('[AccumulationService] Applying E function to ready queue', {
      slot: m,
      accumulatedFromImmediateCount: accumulatedFromImmediate.size,
      accumulatedFromImmediate: Array.from(accumulatedFromImmediate).map((h) =>
        h.slice(0, 40),
      ),
    })

    const newReadySlots: ReadyItem[][] = new Array(epochDuration)
    for (let slotIdx = 0; slotIdx < epochDuration; slotIdx++) {
      const slotItems = currentReady.epochSlots[slotIdx] || []
      // Apply E function to remove dependencies that are satisfied by newly accumulated immediate items
      // BUT: Don't remove the immediate items themselves - they need to be accumulated first
      // The E function should only remove dependencies, not items whose package hash is in accumulatedFromImmediate
      // So we filter out immediate items first, apply E to the rest, then add immediate items back
      const immediateItemsInSlot: ReadyItem[] = []
      const otherItemsInSlot: ReadyItem[] = []

      for (const item of slotItems) {
        const packageHash = item.workReport.package_spec.hash
        if (accumulatedFromImmediate.has(packageHash)) {
          // This is an immediate item that was just added - keep it for accumulation
          immediateItemsInSlot.push(item)
        } else {
          // This is an existing item - apply E function to remove satisfied dependencies
          otherItemsInSlot.push(item)
        }
      }

      // Apply E function only to non-immediate items
      const editedOtherItems = this.applyQueueEditingFunctionE(
        otherItemsInSlot,
        accumulatedFromImmediate,
      )

      // Combine: immediate items (unchanged) + edited other items
      newReadySlots[slotIdx] = [...immediateItemsInSlot, ...editedOtherItems]
    }

    // Now add newly queued items to their appropriate slot (current slot m)
    // These are justbecameavailable^Q - items with dependencies that are being queued
    logger.debug('[AccumulationService] Adding queued items to slot', {
      slot: m,
      queuedItemsCount: queuedItems.length,
      queuedPackages: queuedItems.map((i) =>
        i.workReport.package_spec.hash.slice(0, 40),
      ),
    })

    // Add queued items to their slot
    // Since this is called AFTER processAccumulation, these items won't be processed until next epoch
    newReadySlots[m].push(...queuedItems)

    // Update ready queue once with the complete state
    this.readyService.setReady({ epochSlots: newReadySlots })
  }

  /**
   * Shift accumulated packages history by slotDelta (non-wrapping left shift)
   * Gray Paper equations 417-418: accumulated'[i] = accumulated[i + slotDelta]
   * This is a LINEAR shift, not cyclic - old data falls off the left, empty slots appear on the right
   */
  private shiftAccumulatedPackagesHistory(
    slotDelta: number,
    epochDuration: number,
  ): void {
    const newAccumulatedPackages: Set<Hex>[] = new Array(epochDuration)
      .fill(null)
      .map(() => new Set<Hex>())

    // Non-wrapping left shift: accumulated'[i] = accumulated[i + slotDelta]
    for (let i = 0; i < epochDuration; i++) {
      const oldIndex = i + slotDelta
      if (oldIndex < epochDuration) {
        // Copy from old position
        newAccumulatedPackages[i] = this.accumulated.packages[oldIndex]
      }
      // else: newAccumulatedPackages[i] remains empty (data fell off)
    }

    this.accumulated.packages = newAccumulatedPackages
  }

  /**
   * Shift ready queue according to Gray Paper equations 419-424
   * Simpler approach: clear slots that should be empty due to time advancement
   */
  private shiftReadyQueue(
    slotDelta: number,
    epochDuration: number,
    currentEpochSlot: number,
  ): void {
    // Gray Paper: When time advances, clear slots in the "past" range
    // For single slot advancement, clear the current slot
    // For multi-slot advancement, clear all slots in range [old_slot + 1, new_slot]

    const currentReady = this.readyService.getReady()
    const newReadySlots = [...currentReady.epochSlots]

    // Clear slots that should be empty: 1 ≤ i < thetime' - thetime
    for (let i = 1; i < Math.min(slotDelta, epochDuration); i++) {
      const slotToClear = (currentEpochSlot - i + epochDuration) % epochDuration
      newReadySlots[slotToClear] = []
    }

    this.readyService.setReady({ epochSlots: newReadySlots })

    logger.debug('[AccumulationService] Shifted ready queue - cleared slots', {
      slotDelta,
      currentEpochSlot,
      clearedCount: Math.min(slotDelta - 1, epochDuration - 1),
    })
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
    // Extract packages from successfully accumulated work reports
    // Use workReportsByService to map results to their work reports
    // Gray Paper: Only accumulate work reports whose dependencies are satisfied (empty dependency set)
    for (let serviceIdx = 0; serviceIdx < results.length; serviceIdx++) {
      const result = results[serviceIdx]
      const serviceWorkReports = workReportsByService.get(serviceIdx) || []

      logger.debug(
        '[AccumulationService] Processing service invocation result',
        {
          serviceIdx,
          resultOk: result?.ok,
          resultCode: result?.ok ? result.value?.resultCode : null,
          hasYield: result?.ok ? result.value?.yield !== null : false,
          workReportsCount: serviceWorkReports.length,
        },
      )

      // Gray Paper equation 417: accumulated'_{E-1} = P(justbecameavailable^*[:n])
      // Packages are added to accumulated for ALL successfully processed work reports,
      // regardless of whether they produce a yield. Yield is only for lastaccout'.
      if (result?.ok && result.value?.resultCode === RESULT_CODES.HALT) {
        // Service invocation succeeded - add all its work reports to accumulated
        for (const workReport of serviceWorkReports) {
          newPackages.add(workReport.package_spec.hash)
          logger.debug('[AccumulationService] Adding package to newPackages', {
            packageHash: workReport.package_spec.hash.slice(0, 40),
            serviceIdx,
            hasYield: result.value?.yield !== null,
          })
        }
      }
    }

    logger.debug('[AccumulationService] New packages to add to accumulated', {
      slot: currentSlot.toString(),
      newPackagesCount: newPackages.size,
      newPackages: Array.from(newPackages).map((h) => h.slice(0, 40)),
    })

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
    // Track services that were in partial state but ejected (removed from poststate)
    // Store initial account set before any updates to detect ejected services
    const initialAccounts = new Set<bigint>()
    for (const [serviceId] of this.serviceAccountsService.getServiceAccounts()
      .accounts) {
      initialAccounts.add(serviceId)
    }
    const ejectedServices = new Set<bigint>()
    // Track which accounts have been updated to prevent overwriting with stale data
    const updatedAccounts = new Set<bigint>()

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const workReport = processedWorkReports[i]
      const accumulatedServiceId = workReport.results[0]?.service_id || 0n

      // Update lastacc for ALL accumulated services, even if accumulation failed
      // Gray Paper: sa_lastacc = s when accumulated at slot s
      // This records that we attempted accumulation at this slot, regardless of success/failure
      const [accountError, existingAccount] =
        this.serviceAccountsService.getServiceAccount(accumulatedServiceId)
      if (!accountError && existingAccount) {
        existingAccount.lastacc = currentSlot
        this.serviceAccountsService.setServiceAccount(
          accumulatedServiceId,
          existingAccount,
        )
        logger.debug(
          '[AccumulationService] Updated lastacc for accumulated service',
          {
            serviceId: accumulatedServiceId.toString(),
            slot: currentSlot.toString(),
            accumulationSuccess: result.ok,
          },
        )
      }

      if (result.ok) {
        const { poststate } = result.value

        // Update service accounts with new state
        for (const [serviceId, account] of poststate.accounts) {
          // Only update accounts that:
          // 1. Are the accumulated service for this invocation (always update, even if updated before)
          // 2. Haven't been updated by an earlier invocation (to avoid overwriting with stale data)
          // This prevents overwriting accounts with stale data from partial state
          const isAccumulatedService = serviceId === accumulatedServiceId
          const notYetUpdated = !updatedAccounts.has(serviceId)

          if (isAccumulatedService || notYetUpdated) {
            // Update lastacc to current slot only for the accumulated service
            // Gray Paper: sa_lastacc = s when accumulated at slot s
            // Newly created services keep lastacc = 0 (they're created, not accumulated)
            if (isAccumulatedService) {
              account.lastacc = currentSlot
            }
            this.serviceAccountsService.setServiceAccount(serviceId, account)
            updatedAccounts.add(serviceId)
          } else {
            // Account was already updated by an earlier invocation, skip to avoid overwriting
            logger.debug(
              '[AccumulationService] Skipping account already updated by earlier invocation',
              {
                serviceId: serviceId.toString(),
                accumulatedServiceId: accumulatedServiceId.toString(),
                invocationIndex: i,
              },
            )
          }
        }

        // Special case: Detect and delete ejected services
        // If a service was in partial state but is not in poststate.accounts, it was ejected
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
        // (e.g., it was ejected during accumulation), we still need to update
        // its lastacc if it exists in the global service accounts
        // This handles "work_for_ejected_service" cases where a service may have
        // been ejected but still needs its lastacc updated
        if (!poststate.accounts.has(accumulatedServiceId)) {
          const [accountError, existingAccount] =
            this.serviceAccountsService.getServiceAccount(accumulatedServiceId)
          if (!accountError && existingAccount) {
            // Service exists but wasn't in poststate (may have been ejected)
            // Still update lastacc to record that accumulation was attempted
            existingAccount.lastacc = currentSlot
            this.serviceAccountsService.setServiceAccount(
              accumulatedServiceId,
              existingAccount,
            )
            logger.debug(
              '[AccumulationService] Updated lastacc for service not in poststate',
              {
                serviceId: accumulatedServiceId.toString(),
                slot: currentSlot.toString(),
              },
            )
          }
        }

        this.privilegesService.setManager(poststate.manager)
        this.privilegesService.setAssigners(poststate.assigners)
        this.privilegesService.setDelegator(poststate.delegator)
        this.privilegesService.setRegistrar(poststate.registrar)
        this.privilegesService.setAlwaysAccers(poststate.alwaysaccers)
      } else {
        logger.debug('[AccumulationService] Accumulation failed', {
          invocationIndex: i,
          accumulatedServiceId: accumulatedServiceId.toString(),
          resultCode: result.err,
        })
      }
    }

    // Additional check: Compare initial accounts with final state
    // If a service was in initial accounts but not in any poststate after all updates,
    // it was ejected (unless it was deleted between invocations, which shouldn't happen)
    const finalAccounts = new Set<bigint>()
    for (const [serviceId] of this.serviceAccountsService.getServiceAccounts()
      .accounts) {
      finalAccounts.add(serviceId)
    }
    // Collect all services that appeared in any poststate
    const allPoststateServices = new Set<bigint>()
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.ok) {
        for (const serviceId of result.value.poststate.accounts.keys()) {
          allPoststateServices.add(serviceId)
        }
      }
    }
    // Services in initial but not in any poststate were ejected
    for (const serviceId of initialAccounts) {
      if (
        !allPoststateServices.has(serviceId) &&
        finalAccounts.has(serviceId)
      ) {
        // Service was in initial state, not in any poststate, but still exists in final
        // This shouldn't happen normally, but if it does, treat as ejected
        ejectedServices.add(serviceId)
        logger.debug(
          '[AccumulationService] Detected ejected service (final check)',
          {
            serviceId: serviceId.toString(),
          },
        )
      }
    }

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

    // Step 3: Process deferred transfers (defxfers) globally
    // Gray Paper equation 208-212: Collect defxfers from all invocations and apply them
    // Transfers to ejected services should be ignored (not applied)
    const allDefxfers: DeferredTransfer[] = []
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.ok) {
        allDefxfers.push(...result.value.defxfers)
      }
    }

    if (allDefxfers.length > 0) {
      logger.debug('[AccumulationService] Processing deferred transfers', {
        defxferCount: allDefxfers.length,
        defxfers: allDefxfers.map((t) => ({
          source: t.source.toString(),
          dest: t.dest.toString(),
          amount: t.amount.toString(),
        })),
      })

      for (const transfer of allDefxfers) {
        // Skip transfers to ejected services
        if (ejectedServices.has(transfer.dest)) {
          logger.debug(
            '[AccumulationService] Skipping transfer to ejected service',
            {
              source: transfer.source.toString(),
              dest: transfer.dest.toString(),
              amount: transfer.amount.toString(),
            },
          )
          continue
        }

        // Apply transfer: add amount to destination service
        // Note: Source balance was already deducted in the PVM poststate
        const [destError, destAccount] =
          this.serviceAccountsService.getServiceAccount(transfer.dest)
        if (!destError && destAccount) {
          destAccount.balance += transfer.amount
          this.serviceAccountsService.setServiceAccount(
            transfer.dest,
            destAccount,
          )
          logger.debug('[AccumulationService] Applied deferred transfer', {
            source: transfer.source.toString(),
            dest: transfer.dest.toString(),
            amount: transfer.amount.toString(),
            newBalance: destAccount.balance.toString(),
          })
        } else {
          logger.warn(
            '[AccumulationService] Cannot apply transfer to non-existent service',
            {
              dest: transfer.dest.toString(),
              amount: transfer.amount.toString(),
            },
          )
        }
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
        logger.debug(
          '[AccumulationService] Removed accumulated work report from ready queue',
          {
            slot: currentSlot.toString(),
            workReportHash,
            packageHash: processedReport.package_spec.hash,
          },
        )
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
}
