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

import { hexToBytes, logger } from '@pbnj/core'
import type { AccumulatePVM } from '@pbnj/pvm'
import {
  calculateWorkReportHash,
  encodeValidatorPublicKeys,
} from '@pbnj/serialization'
import {
  type Accumulated,
  type AccumulateInput,
  type AccumulateInvocationResult,
  BaseService,
  type DeferredTransfer,
  type PartialState,
  type Ready,
  type ReadyItem,
  type WorkError,
  type WorkExecResultValue,
  type WorkExecutionResult,
  type WorkReport,
} from '@pbnj/types'
import type { Hex } from 'viem'
import type { AuthQueueService } from './auth-queue-service'
import type { ClockService } from './clock-service'
import type { ConfigService } from './config-service'
// import type { EntropyService } from './entropy'
import type { PrivilegesService } from './privileges-service'
import type { ReadyService } from './ready-service'
import type { ServiceAccountService as ServiceAccountsService } from './service-account-service'
// import type { StatisticsService } from './statistics-service'
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
  private readonly accumulatePVM: AccumulatePVM | null
  private readonly authQueueService: AuthQueueService
  private readonly readyService: ReadyService | null
  // Track which slot we've shifted for (only shift once per slot)
  private lastShiftedSlot: bigint | null = null
  // Track last processed slot for ready queue shifting
  private lastProcessedSlot: bigint | null = null
  // private readonly statisticsService: StatisticsService | null
  // private readonly entropyService: EntropyService | null
  constructor(options: {
    configService: ConfigService
    clockService: ClockService
    serviceAccountsService: ServiceAccountsService
    privilegesService: PrivilegesService | null
    validatorSetManager: ValidatorSetManager
    authQueueService: AuthQueueService
    accumulatePVM: AccumulatePVM | null
    readyService: ReadyService | null
    // statisticsService: StatisticsService | null
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
    // this.statisticsService = options.statisticsService
    // this.entropyService = options.entropyService
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
    const totalItems = ready.epochSlots.reduce(
      (sum, items) => sum + items.length,
      0,
    )
    const itemsPerSlot = new Map<number, number>()
    for (let i = 0; i < ready.epochSlots.length; i++) {
      if (ready.epochSlots[i].length > 0) {
        itemsPerSlot.set(i, ready.epochSlots[i].length)
      }
    }
    logger.info('Ready state updated', {
      totalSlots: ready.epochSlots.length,
      totalItems,
      itemsPerSlot: Object.fromEntries(itemsPerSlot),
    })
  }

  /**
   * Get accumulated state
   */
  getAccumulated(): Accumulated {
    return this.accumulated
  }

  /**
   * Set accumulated state
   */
  setAccumulated(accumulated: Accumulated): void {
    this.accumulated = accumulated
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
   * Main accumulation processing method
   *
   * This method implements the complete accumulation flow as observed in the test vector:
   * 1. Extract ready work-reports from current slot
   * 2. Resolve dependencies against accumulated history
   * 3. Process eligible work-reports through PVM
   * 4. Update global state with results
   * 5. Clean up processed work-reports from ready queue
   */
  async processAccumulation(currentSlot: bigint): Promise<void> {
    if (!this.readyService) {
      throw new Error('Ready service not initialized')
    }
    // Convert absolute slot to epoch slot index
    // Gray Paper: ready ∈ sequence[C_epochlen]{sequence{⟨workreport, protoset{hash}⟩}}
    // The ready queue uses epoch slot indices (0 to C_epochlen-1), not absolute slot numbers
    const epochSlotIndex = BigInt(
      Number(currentSlot) % this.configService.epochDuration,
    )

    console.info('Starting accumulation process', {
      slot: currentSlot.toString(),
      epochSlotIndex: epochSlotIndex.toString(),
      accumulatedCount:
        this.accumulated.packages[Number(epochSlotIndex)]?.size ?? 0,
    })

    // Iteratively process items until no more become eligible
    // This breaks dependency chains: as items are processed and accumulated,
    // their dependents become eligible and are processed in the next iteration
    let iterationCount = 0
    const maxIterations = 100 // Safety limit to prevent infinite loops
    let foundNewItems = true

    while (foundNewItems && iterationCount < maxIterations) {
      iterationCount++
      foundNewItems = false

      // Step 1: Collect all ready items from ALL slots
      const epochLength = this.configService.epochDuration
      const allReadyItems: ReadyItem[] = []
      const slotCounts = new Map<number, number>()

      for (let slotIdx = 0; slotIdx < epochLength; slotIdx++) {
        const slotItems = this.readyService.getReadyItemsForSlot(
          BigInt(slotIdx),
        )
        if (slotItems.length > 0) {
          slotCounts.set(slotIdx, slotItems.length)
        }
        allReadyItems.push(...slotItems)
      }

      logger.debug(
        '[AccumulationService] Collected ready items from all slots',
        {
          slot: currentSlot.toString(),
          iteration: iterationCount,
          totalItems: allReadyItems.length,
          itemsPerSlot: Object.fromEntries(slotCounts),
          itemPackages: allReadyItems.map((item) => ({
            package: item.workReport.package_spec.hash.slice(0, 40),
            deps: Array.from(item.dependencies).map((d) => d.slice(0, 20)),
          })),
        },
      )

      if (allReadyItems.length === 0) {
        logger.debug('[AccumulationService] No ready items in any slot', {
          slot: currentSlot.toString(),
          iteration: iterationCount,
        })
        break
      }

      // Step 2: Resolve dependencies - find work-reports that can be processed
      logger.debug('[AccumulationService] Resolving dependencies', {
        slot: currentSlot.toString(),
        iteration: iterationCount,
        readyItemsCount: allReadyItems.length,
        readyItems: allReadyItems.map((item) => ({
          packageHash: item.workReport.package_spec.hash,
          dependenciesCount: item.dependencies.size,
          dependencies: Array.from(item.dependencies),
        })),
        accumulatedPackagesCount: this.accumulated.packages.reduce(
          (sum, pkgSet) => sum + pkgSet.size,
          0,
        ),
      })

      // Filter to only items whose dependencies are satisfied
      const eligibleItems = this.resolveDependencies(
        allReadyItems,
        this.accumulated,
      )

      if (eligibleItems.length === 0) {
        logger.debug(
          '[AccumulationService] No items with satisfied dependencies',
          {
            slot: currentSlot.toString(),
            iteration: iterationCount,
          },
        )
        break
      }

      // Detect and filter out circular dependencies
      const itemsToProcess = this.filterCircularDependencies(eligibleItems)

      if (itemsToProcess.length === 0) {
        logger.warn(
          '[AccumulationService] All eligible items have circular dependencies',
          {
            slot: currentSlot.toString(),
            iteration: iterationCount,
            eligibleCount: eligibleItems.length,
          },
        )
        break
      }

      if (itemsToProcess.length < eligibleItems.length) {
        logger.warn(
          '[AccumulationService] Filtered out items with circular dependencies',
          {
            slot: currentSlot.toString(),
            iteration: iterationCount,
            eligibleCount: eligibleItems.length,
            processedCount: itemsToProcess.length,
            filteredCount: eligibleItems.length - itemsToProcess.length,
          },
        )
      }

      foundNewItems = true // We found items to process

      logger.info('[AccumulationService] Found eligible items for processing', {
        slot: currentSlot.toString(),
        iteration: iterationCount,
        totalReady: allReadyItems.length,
        eligibleForProcessing: itemsToProcess.length,
        eligiblePackages: itemsToProcess.map(
          (item) => item.workReport.package_spec.hash,
        ),
      })

      // Step 3: Track defxfers from previous accumulations
      // Gray Paper: defxfers from earlier services/iterations are available
      // TODO: Track defxfers from previous slots/iterations for cross-slot transfers
      // For now, start with empty (within-iteration defxfers handled below)
      const pendingDefxfers: DeferredTransfer[] = []

      // Step 4: Group items by service ID
      // Gray Paper: accumulate each service once with all its inputs
      const serviceToItems = new Map<bigint, ReadyItem[]>()
      for (const item of itemsToProcess) {
        const serviceId = item.workReport.results[0]?.service_id || 0n
        if (!serviceToItems.has(serviceId)) {
          serviceToItems.set(serviceId, [])
        }
        serviceToItems.get(serviceId)!.push(item)
      }

      // Step 5: Execute PVM accumulate invocations sequentially
      // Gray Paper: process services sequentially, defxfers from earlier services
      // are available to later ones in the same iteration
      const results: AccumulateInvocationResult[] = []
      const processedWorkReports: WorkReport[] = []
      const partialStateAccountsPerInvocation: Map<
        number,
        Set<bigint>
      > = new Map()

      let invocationIndex = 0
      // Process each service with all its inputs
      for (const [serviceId, serviceItems] of serviceToItems) {
        // Create inputs for this service (defxfers + operand tuples)
        // Gray Paper equation 311-322: i = i^T concat i^U
        const inputs =
          this.createAccumulateInputs(serviceItems, pendingDefxfers).get(
            serviceId,
          ) || []
        // Get work reports for this service (for tracking)
        const serviceWorkReports = serviceItems.map((item) => item.workReport)

        // Use the first work report's gas limit (or combine them according to Gray Paper)
        // Gray Paper equation 315-317: gas = f[s] + sum(defxfer gas) + sum(work report gas)
        const firstWorkReport = serviceWorkReports[0]
        const baseGasLimit =
          firstWorkReport?.results[0]?.accumulate_gas || 100000n
        // Calculate total gas: base + sum of defxfer gas for this service
        const defxferGas = inputs
          .filter((i) => i.type === 1n)
          .reduce(
            (sum, i) => sum + ((i.value as DeferredTransfer).gas || 0n),
            0n,
          )
        const gasLimit = baseGasLimit + defxferGas

        // Convert global state to partial state for PVM
        const partialState: PartialState = {
          accounts: this.serviceAccountsService.getServiceAccounts().accounts,
          stagingset: this.validatorSetManager
            ? this.validatorSetManager
                .getStagingValidators()
                .values()
                .toArray()
                .map(encodeValidatorPublicKeys)
            : [],
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
            this.privilegesService?.getAlwaysAccers() ??
            new Map<bigint, bigint>(),
        }

        // Track which services were in partial state before this invocation
        // This allows us to detect ejected services after accumulation
        const partialStateServiceIds = new Set<bigint>()
        for (const [sid] of partialState.accounts) {
          partialStateServiceIds.add(sid)
        }
        partialStateAccountsPerInvocation.set(
          invocationIndex,
          partialStateServiceIds,
        )

        // Execute accumulate invocation with all inputs for this service
        // Gray Paper: Ψ_A(psX, thetime', s, g, i^T concat i^U)
        const result = await this.executeAccumulateInvocation(
          partialState,
          currentSlot,
          serviceId,
          gasLimit,
          inputs, // All inputs for this service (defxfers + operand tuples)
        )

        results.push(result)
        // Track all work reports processed for this service
        processedWorkReports.push(...serviceWorkReports)

        // Collect defxfers from this accumulation for next services
        // Gray Paper: defxfers from earlier accumulations are available to later ones
        if (result.ok) {
          // Add defxfers to pending for subsequent services in this iteration
          pendingDefxfers.push(...result.value.defxfers)
        }

        invocationIndex++
      }

      // Step 5: Update global state with results (removes items from ready queue and updates accumulated)
      // This makes items that depended on the processed items eligible in the next iteration
      this.updateGlobalState(
        results,
        processedWorkReports,
        currentSlot,
        epochSlotIndex,
        partialStateAccountsPerInvocation,
      )

      logger.info('[AccumulationService] Iteration completed', {
        slot: currentSlot.toString(),
        iteration: iterationCount,
        processedCount: processedWorkReports.length,
        successfulCount: results.filter((r) => r.ok).length,
        processedPackages: processedWorkReports.map((r) =>
          r.package_spec.hash.slice(0, 40),
        ),
      })
    }

    if (iterationCount >= maxIterations) {
      logger.warn('[AccumulationService] Reached max iterations limit', {
        slot: currentSlot.toString(),
        iterations: iterationCount,
      })
    }

    logger.info('[AccumulationService] Accumulation process completed', {
      slot: currentSlot.toString(),
      totalIterations: iterationCount,
    })
  }

  /**
   * Filter out items that are part of circular dependencies
   *
   * Detects cycles in the dependency graph among eligible items and filters them out.
   * A circular dependency exists when:
   * - Item A depends on Item B's package hash
   * - Item B depends on Item A's package hash
   *
   * @param eligibleItems - Items whose dependencies are satisfied
   * @returns Items that are not part of circular dependencies
   */
  filterCircularDependencies(eligibleItems: ReadyItem[]): ReadyItem[] {
    if (eligibleItems.length === 0) {
      return []
    }

    // Build a map from package hash to item
    const packageToItem = new Map<Hex, ReadyItem>()
    for (const item of eligibleItems) {
      packageToItem.set(item.workReport.package_spec.hash, item)
    }

    // Build dependency graph: package -> set of packages it depends on (within eligible items)
    const graph = new Map<Hex, Set<Hex>>()
    for (const item of eligibleItems) {
      const packageHash = item.workReport.package_spec.hash
      const deps = new Set<Hex>()
      for (const dep of item.dependencies) {
        // Only include dependencies that are also in the eligible items set
        if (packageToItem.has(dep)) {
          deps.add(dep)
        }
      }
      graph.set(packageHash, deps)
    }

    // Detect cycles using DFS
    const visited = new Set<Hex>()
    const recStack = new Set<Hex>()
    const inCycle = new Set<Hex>()

    const hasCycle = (pkg: Hex): boolean => {
      if (recStack.has(pkg)) {
        // Found a cycle - mark this node and all nodes in recursion stack as in cycle
        inCycle.add(pkg)
        for (const node of recStack) {
          inCycle.add(node)
        }
        return true
      }
      if (visited.has(pkg)) {
        return false
      }

      visited.add(pkg)
      recStack.add(pkg)

      const deps = graph.get(pkg)
      if (deps) {
        for (const dep of deps) {
          if (hasCycle(dep)) {
            // If a cycle was found downstream, mark current node as in cycle
            inCycle.add(pkg)
            return true
          }
        }
      }

      recStack.delete(pkg)
      return false
    }

    // Check all packages for cycles
    for (const item of eligibleItems) {
      const pkg = item.workReport.package_spec.hash
      if (!visited.has(pkg)) {
        hasCycle(pkg)
      }
    }

    // Filter out items that are part of cycles
    const filtered = eligibleItems.filter(
      (item) => !inCycle.has(item.workReport.package_spec.hash),
    )

    if (inCycle.size > 0) {
      logger.warn('[AccumulationService] Detected circular dependencies', {
        circularPackages: Array.from(inCycle),
        filteredCount: filtered.length,
        totalCount: eligibleItems.length,
      })
    }

    return filtered
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

      logger.debug('[AccumulationService] Checking dependencies for item', {
        packageHash: item.workReport.package_spec.hash,
        prerequisitesCount: prerequisites.length,
        prerequisites,
        accumulatedSlotsCount: accumulatedHashSets.length,
      })

      // Check if all prerequisites are fulfilled
      let satisfiedDependencies = 0
      const satisfiedPrerequisites: Hex[] = []
      for (const accumulatedHashSet of accumulatedHashSets) {
        for (const dependency of prerequisites) {
          if (accumulatedHashSet.has(dependency)) {
            satisfiedDependencies++
            satisfiedPrerequisites.push(dependency)
            break
          }
        }
      }

      const allSatisfied = satisfiedDependencies === prerequisites.length
      logger.debug('[AccumulationService] Dependency check result', {
        packageHash: item.workReport.package_spec.hash,
        prerequisitesCount: prerequisites.length,
        satisfiedCount: satisfiedDependencies,
        satisfiedPrerequisites,
        allSatisfied,
      })

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
        // Error string: map to WorkError
        const errorMap: Record<string, WorkError> = {
          out_of_gas: 'OOG',
          bad_exports: 'BADEXPORTS',
          oversize: 'OVERSIZE',
          bad_code: 'BAD',
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
        type: 1n, // DeferredTransfer type
        value: defxfer,
      })
    }

    // Step 2: Add operand tuples (i^U) - Gray Paper equation 323-338
    // i^U = sequence of operand tuples from work reports where service_id = s
    for (const item of readyItems) {
      const workReport = item.workReport
      if (!workReport.results[0]) {
        throw new Error('No results found for work report')
      }

      // Extract service ID from work report
      const serviceId = workReport.results[0]?.service_id || 0n

      // Convert WorkExecResultValue to WorkExecutionResult
      const executionResult = this.convertWorkResultToExecutionResult(
        workReport.results[0].result,
      )

      // Create OperandTuple from work report
      const operandTuple = {
        packageHash: workReport.package_spec.hash,
        segmentRoot: workReport.package_spec.erasure_root,
        authorizer: workReport.authorizer_hash,
        payloadHash: workReport.results[0].payload_hash,
        gasLimit: workReport.results[0].accumulate_gas,
        result: executionResult,
        authTrace: hexToBytes(workReport.auth_output),
      }

      if (!inputsByService.has(serviceId)) {
        inputsByService.set(serviceId, [])
      }
      inputsByService.get(serviceId)!.push({
        type: 0n, // OperandTuple type
        value: operandTuple,
      })
    }

    // Gray Paper: i = i^T concat i^U (defxfers first, then operand tuples)
    // This is already the order since we added defxfers first, then operand tuples
    logger.debug('[AccumulationService] Created accumulate inputs by service', {
      servicesCount: inputsByService.size,
      inputsPerService: Array.from(inputsByService.entries()).map(
        ([serviceId, inputs]) => ({
          serviceId: serviceId.toString(),
          totalInputs: inputs.length,
          defxferCount: inputs.filter((i) => i.type === 1n).length,
          operandTupleCount: inputs.filter((i) => i.type === 0n).length,
        }),
      ),
      pendingDefxfersCount: pendingDefxfers.length,
    })

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
  ): Promise<AccumulateInvocationResult> {
    if (!this.accumulatePVM) {
      throw new Error('Accumulate PVM not initialized')
    }
    try {
      const result = await this.accumulatePVM.executeAccumulate(
        partialState,
        timeslot,
        serviceId,
        gas,
        inputs,
      )

      return result
    } catch (error) {
      console.error('Accumulate invocation failed', {
        serviceId: serviceId.toString(),
        timeslot: timeslot.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return {
        ok: false,
        err: 'PANIC', // Return panic on unexpected errors
      }
    }
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
    if (!this.readyService) {
      throw new Error('Ready service not initialized')
    }
    try {
      // Step 0: Store old ready queue state before processing (needed for shift after accumulation)
      // Gray Paper equation 419-423 requires shifting using old ready queue and new accumulated packages
      // Store current ready queue state BEFORE adding new reports
      const currentReadyBeforeReports = this.readyService.getReady()
      const oldReadyQueue: Ready = {
        epochSlots: currentReadyBeforeReports.epochSlots.map((slotItems) =>
          slotItems.map((item) => ({
            workReport: item.workReport,
            dependencies: new Set<Hex>(item.dependencies),
          })),
        ),
      }

      // Determine if we need to shift based on slot advancement
      const needsShift =
        this.lastProcessedSlot !== null && slot !== this.lastProcessedSlot

      // Step 1: Store new reports separately (will be added to i=0 slot after shift)
      // Gray Paper: justbecameavailable^Q goes to cyclic{ready'}[m] where m = thetime'
      const newReportsSlot = Number(slot) % this.configService.epochDuration
      const newReportsItems: ReadyItem[] = []
      for (const report of reports) {
        const dependencies = new Set<Hex>(report.context.prerequisites)
        const readyItem: ReadyItem = {
          workReport: report,
          dependencies,
        }
        newReportsItems.push(readyItem)
        // Also add to current ready queue for accumulation processing
        this.readyService.addReadyItemToSlot(BigInt(newReportsSlot), readyItem)
      }

      // Step 2: Process accumulation
      await this.processAccumulation(slot)

      // Step 3: Shift ready queue if slots advanced (Gray Paper equation 419-423)
      // This must happen AFTER accumulation so we can use accumulated'[C_epochlen - 1] for E function
      if (needsShift && this.lastProcessedSlot !== null) {
        const slotDelta = Number(slot - this.lastProcessedSlot)
        if (slotDelta > 0) {
          const epochDuration = this.configService.epochDuration
          const oldEpochSlot = Number(this.lastProcessedSlot) % epochDuration
          const newEpochSlot = Number(slot) % epochDuration
          const epochDelta =
            (newEpochSlot - oldEpochSlot + epochDuration) % epochDuration

          if (epochDelta > 0) {
            // Cyclically shift ready queue forward by epochDelta positions
            // Gray Paper: cyclic{ready'}[m - i] where m = thetime'
            logger.debug('[AccumulationService] Shifting ready queue', {
              lastSlot: this.lastProcessedSlot.toString(),
              currentSlot: slot.toString(),
              oldEpochSlot,
              newEpochSlot,
              epochDelta,
            })

            // Use old ready queue for shifting (before new reports were added)
            // Gray Paper equation 419-423: E(cyclic{ready}[thetime - i], accumulated')
            const shiftedReady: ReadyItem[][] = new Array(epochDuration)
              .fill(null)
              .map(() => [])

            // Get new accumulated packages from the rightmost slot (accumulated'[C_epochlen - 1])
            const newAccumulatedPackages =
              this.accumulated.packages[epochDuration - 1] || new Set<Hex>()

            // Shift items according to Gray Paper equation 419-423
            // cyclic{ready'}[m - i] where m = thetime' (current slot)
            for (
              let newEpochSlot = 0;
              newEpochSlot < epochDuration;
              newEpochSlot++
            ) {
              // Gray Paper: cyclic{ready'}[m - i] where m = thetime'
              // Find i such that (thetime' - i) % epochDuration = newEpochSlot
              const currentEpochSlot = Number(slot) % epochDuration
              let i: number
              if (newEpochSlot === currentEpochSlot) {
                i = 0
              } else if (newEpochSlot < currentEpochSlot) {
                i = currentEpochSlot - newEpochSlot
              } else {
                i = epochDuration - (newEpochSlot - currentEpochSlot)
              }

              if (i === 0) {
                // Gray Paper: new items from justbecameavailable^Q
                // Apply E function to new reports: remove accumulated dependencies
                const editedNewItems: ReadyItem[] = []
                for (const item of newReportsItems) {
                  // Remove satisfied dependencies
                  const remainingDeps = new Set<Hex>()
                  for (const dep of item.dependencies) {
                    if (!newAccumulatedPackages.has(dep)) {
                      remainingDeps.add(dep)
                    }
                  }

                  // Only include if it has dependencies or if it's a valid report
                  // (reports without dependencies should have been accumulated immediately)
                  editedNewItems.push({
                    workReport: item.workReport,
                    dependencies: remainingDeps,
                  })
                }
                shiftedReady[newEpochSlot] = editedNewItems
              } else if (i < slotDelta) {
                // Gray Paper: [] when 1 ≤ i < thetime' - thetime
                shiftedReady[newEpochSlot] = []
              } else {
                // Gray Paper: E(cyclic{ready}[thetime - i], accumulated')
                // Items from old ready queue, shifted and with E applied
                const oldSlotValue = Number(this.lastProcessedSlot) - i
                const oldEpochSlot = oldSlotValue % epochDuration
                const oldSlotItems =
                  oldReadyQueue.epochSlots[oldEpochSlot] || []

                // Apply queue-editing function E:
                // 1. Remove items whose package hash is in newAccumulatedPackages
                // 2. Remove dependencies that are in newAccumulatedPackages
                const editedItems: ReadyItem[] = []
                for (const item of oldSlotItems) {
                  const packageHash = item.workReport.package_spec.hash
                  // Remove if package was accumulated
                  if (newAccumulatedPackages.has(packageHash)) {
                    continue
                  }

                  // Remove satisfied dependencies
                  const remainingDeps = new Set<Hex>()
                  for (const dep of item.dependencies) {
                    if (!newAccumulatedPackages.has(dep)) {
                      remainingDeps.add(dep)
                    }
                  }

                  editedItems.push({
                    workReport: item.workReport,
                    dependencies: remainingDeps,
                  })
                }

                shiftedReady[newEpochSlot] = editedItems
              }
            }

            // Debug: Log what's being shifted
            logger.debug('[AccumulationService] Ready queue shift details', {
              epochDelta,
              oldEpochSlot,
              newEpochSlot,
              slotDelta,
              shiftedSlots: shiftedReady.map((slot, idx) => ({
                slot: idx,
                itemCount: slot.length,
                packages: slot.map((item) =>
                  item.workReport.package_spec.hash.slice(0, 40),
                ),
              })),
            })

            this.readyService.setReady({ epochSlots: shiftedReady })
            logger.debug('[AccumulationService] Ready queue shifted', {
              epochDelta,
            })
          }
        }
      }

      // Step 4: Process accumulation (already done above)
      // await this.processAccumulation(slot) - already called before shift

      // Update last processed slot
      this.lastProcessedSlot = slot

      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        err: error instanceof Error ? error : new Error(String(error)),
      }
    }
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
    currentSlot: bigint,
    epochSlotIndex: bigint,
    partialStateAccountsPerInvocation?: Map<number, Set<bigint>>,
  ): void {
    if (!this.readyService) {
      throw new Error('Ready service not initialized')
    }
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
    for (const workReport of processedWorkReports) {
      // Extract package hash from work report (Gray Paper P function)
      newPackages.add(workReport.package_spec.hash)
    }

    // Ensure accumulated.packages is properly sized
    if (this.accumulated.packages.length !== epochLength) {
      this.accumulated.packages = new Array(epochLength)
        .fill(null)
        .map(() => new Set<Hex>())
    }

    // Shift accumulated history (Gray Paper equation 418)
    // Left shift: accumulated'[i] = accumulated[i + 1] for i ∈ [0, C_epochlen - 2]
    // New data goes to the rightmost slot: accumulated'[C_epochlen - 1] = new packages
    // Note: We only shift once per slot, not per iteration
    // Multiple iterations accumulate packages in the same slot
    if (this.lastShiftedSlot !== currentSlot) {
      for (let i = 0; i < epochLength - 1; i++) {
        this.accumulated.packages[i] = this.accumulated.packages[i + 1]
      }
      // Clear the rightmost slot for new packages from this slot
      const rightmostSlot = epochLength - 1
      this.accumulated.packages[rightmostSlot] = new Set<Hex>()
      this.lastShiftedSlot = currentSlot
    }

    // Add new packages to the rightmost slot (Gray Paper equation 417)
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
        logger.debug(
          '[AccumulationService] Updating service accounts from poststate',
          {
            invocationIndex: i,
            accumulatedServiceId: accumulatedServiceId.toString(),
            poststateAccountCount: poststate.accounts.size,
            poststateServiceIds: Array.from(poststate.accounts.keys()).map(
              (id) => id.toString(),
            ),
            poststateBalances: Array.from(poststate.accounts.entries()).map(
              ([id, account]) => ({
                serviceId: id.toString(),
                balance: account.balance.toString(),
              }),
            ),
          },
        )
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
          logger.debug('[AccumulationService] Checking for ejected services', {
            invocationIndex: i,
            partialStateServices: Array.from(
              partialStateServicesForThisInvocation,
            ).map((id) => id.toString()),
            poststateServices: Array.from(poststate.accounts.keys()).map((id) =>
              id.toString(),
            ),
          })
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

    // Delete ejected services from global accounts
    // Gray Paper: EJECT removes services from accounts dictionary
    logger.info('[AccumulationService] Ejected services to delete', {
      ejectedServiceIds: Array.from(ejectedServices).map((id) => id.toString()),
      count: ejectedServices.size,
    })
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
    logger.debug('[AccumulationService] Applying queue-editing function E', {
      slot: currentSlot.toString(),
      processedReportsCount: processedWorkReports.length,
    })

    // Build set of accumulated package hashes
    const accumulatedPackageHashes = new Set<Hex>()
    for (const processedReport of processedWorkReports) {
      accumulatedPackageHashes.add(processedReport.package_spec.hash)
    }

    // First, remove entries whose package hash was accumulated
    for (const processedReport of processedWorkReports) {
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
