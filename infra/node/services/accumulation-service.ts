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
  type PartialState,
  type Ready,
  type ReadyItem,
  type WorkReport,
} from '@pbnj/types'
import type { Hex } from 'viem'
import type { ClockService } from './clock-service'
import type { PrivilegesService } from './privileges-service'
import type { ServiceAccountsService } from './service-accounts-service'
import type { ValidatorSetManager } from './validator-set'
import type { ConfigService } from './config-service'
import type { AuthQueueService } from './auth-queue-service'

/**
 * Accumulation Service Implementation
 */
export class AccumulationService extends BaseService {
  public ready: Ready
  public accumulated: Accumulated

  private readonly clockService: ClockService
  private readonly configService: ConfigService
  private readonly serviceAccountsService: ServiceAccountsService
  private readonly privilegesService: PrivilegesService
  private readonly validatorSetManager: ValidatorSetManager
  private readonly accumulatePVM: AccumulatePVM
  private readonly authQueueService: AuthQueueService
  constructor(options: {
    configService: ConfigService
    clockService: ClockService
    serviceAccountsService: ServiceAccountsService
    privilegesService: PrivilegesService
    validatorSetManager: ValidatorSetManager
    authQueueService: AuthQueueService
    accumulatePVM: AccumulatePVM
  }) {
    super('accumulation-service')
    this.accumulatePVM = options.accumulatePVM
    this.ready = {
      epochSlots: new Array(options.configService.epochDuration).fill([]),
    }
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
  }

  /**
   * Get current ready state
   */
  getReady(): Ready {
    return this.ready
  }

  /**
   * Set ready state
   */
  setReady(ready: Ready): void {
    this.ready = ready
    logger.debug('Ready state updated', {
      totalSlots: ready.epochSlots.length,
      totalItems: ready.epochSlots.reduce(
        (sum, items) => sum + items.length,
        0,
      ),
    })
  }

  getReadyItem(workReportHash: Hex): ReadyItem | undefined {
    for (const items of this.ready.epochSlots) {
      const item = items.find((item) => {
        const [hashError, hash] = calculateWorkReportHash(item.workReport)
        return !hashError && hash === workReportHash
      })
      if (item) return item
    }
    return undefined
  }

  /**
   * Remove a specific dependency from a ready item
   */
  removeDependency(workReportHash: Hex, dependencyHash: Hex): void {
    const readyItem = this.getReadyItem(workReportHash)
    if (readyItem) {
      readyItem.dependencies.delete(dependencyHash)
      logger.debug('Dependency removed', { workReportHash, dependencyHash })
    }
  }

  /**
   * Add a dependency to a ready item
   */
  addDependency(workReportHash: Hex, dependencyHash: Hex): void {
    const readyItem = this.getReadyItem(workReportHash)
    if (readyItem) {
      readyItem.dependencies.add(dependencyHash)
      logger.debug('Dependency added', { workReportHash, dependencyHash })
    }
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
    console.info('Starting accumulation process', {
      slot: currentSlot.toString(),
      readyItemsCount: this.ready.epochSlots[Number(currentSlot)].length || 0,
      accumulatedCount: this.accumulated.packages[Number(currentSlot)].size,
    })

    // Step 1: Get ready work-reports for current slot
    const readyItems = this.ready.epochSlots[Number(currentSlot)] || []
    if (readyItems.length === 0) {
      console.info('No ready work-reports for current slot')
      return
    }

    // Step 2: Resolve dependencies - find work-reports that can be processed
    const eligibleItems = this.resolveDependencies(readyItems, this.accumulated)
    console.info('Dependency resolution complete', {
      totalReady: readyItems.length,
      eligibleForProcessing: eligibleItems.length,
    })

    if (eligibleItems.length === 0) {
      console.info(
        'No work-reports eligible for processing (dependencies not fulfilled)',
      )
      return
    }

    // Step 3: Convert to accumulate inputs
    const accumulateInputs = this.createAccumulateInputs(eligibleItems)
    console.info('Created accumulate inputs', {
      inputCount: accumulateInputs.length,
    })

    // Step 4: Execute PVM accumulate invocations
    const results: AccumulateInvocationResult[] = []
    const processedWorkReports: WorkReport[] = []

    for (let i = 0; i < accumulateInputs.length; i++) {
      const input = accumulateInputs[i]
      const workReport = eligibleItems[i].workReport

      // Extract service ID from work report results
      const serviceId = workReport.results[0]?.service_id || 0n
      const gasLimit = workReport.results[0]?.accumulate_gas || 100000n

      // Convert global state to partial state for PVM
      const partialState: PartialState = {
        accounts: this.serviceAccountsService.getAccounts(),
        stagingset: this.validatorSetManager
          .getStagingValidators()
          .values()
          .toArray()
          .map(encodeValidatorPublicKeys),
        authqueue: this.authQueueService.getAuthQueue().map((queue) => queue.map((item) => hexToBytes(item))),
        manager: this.privilegesService.getManager(),
        assigners: this.privilegesService.getAssigners(),
        delegator: this.privilegesService.getDelegator(),
        registrar: this.privilegesService.getRegistrar(),
        alwaysaccers: this.privilegesService.getAlwaysAccers(),
      }

      // Execute accumulate invocation
      const result = await this.executeAccumulateInvocation(
        partialState,
        currentSlot,
        serviceId,
        gasLimit,
        [input], // Process one input at a time
      )

      results.push(result)
      processedWorkReports.push(workReport)

      console.info('Accumulate invocation completed', {
        serviceId: serviceId.toString(),
        success: result.ok,
        gasUsed: result.ok ? result.value.gasused.toString() : 'N/A',
      })
    }

    // Step 5: Update global state with results
    const updatedState = this.updateGlobalState(
      globalState,
      results,
      processedWorkReports,
      currentSlot,
    )

    console.info('Accumulation process completed', {
      processedWorkReports: processedWorkReports.length,
      successfulInvocations: results.filter((r) => r.ok).length,
      failedInvocations: results.filter((r) => !r.ok).length,
    })

    return updatedState
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

      // Check if all prerequisites are fulfilled
      let satisfiedDependencies = 0
      for(const accumulatedHashSet of accumulatedHashSets) {
        for(const dependency of prerequisites) {
          if(accumulatedHashSet.has(dependency)) {
            satisfiedDependencies++
            break
          }
        }
      }
      if(satisfiedDependencies === prerequisites.length) {
        eligibleItems.push(item)
      }
    }

    return eligibleItems
  }

  /**
   * Create accumulate inputs from ready items
   *
   * This method transforms work-reports into the format expected by the PVM
   * accumulate invocation. Each work-report becomes an OperandTuple.
   */
  createAccumulateInputs(readyItems: ReadyItem[]): AccumulateInput[] {
    const inputs: AccumulateInput[] = []

    for (const item of readyItems) {
      const workReport = item.workReport
      if (!workReport.results[0]) {
        throw new Error('No results found for work report')
      }

      // Create OperandTuple from work report
      const operandTuple = {
        packageHash: workReport.package_spec.hash,
        segmentRoot: workReport.package_spec.erasure_root,
        authorizer: workReport.authorizer_hash,
        payloadHash: workReport.results[0].payload_hash,
        gasLimit: workReport.results[0].accumulate_gas,
        result: workReport.results[0].result,
        authTrace: workReport.auth_output,
      }

      inputs.push({
        type: 0n, // OperandTuple type
        value: operandTuple,
      })
    }

    return inputs
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
  ): void {
    // Step 1: Update accumulated packages
    // Gray Paper equations 417-418:
    // accumulated'_{C_epochlen - 1} = P(justbecameavailable^*[..n])
    // ∀i ∈ [0, C_epochlen - 1): accumulated'_i = accumulated_{i + 1}
    //
    // Where P extracts package hashes from work-reports (equation 77-83):
    // P: protoset{workreport} → protoset{hash}
    // P(r) = {(r_avspec)_packagehash : r ∈ r}

    const newPackages = new Set<Hex>()
    for (const workReport of processedWorkReports) {
      // Extract package hash from work report (Gray Paper P function)
      newPackages.add(workReport.package_spec.hash)
    }

    // Get the epoch duration (C_epochlen)
    const epochLength = this.configService.epochDuration

    // Ensure accumulated.packages is properly sized
    if (this.accumulated.packages.length !== epochLength) {
      this.accumulated.packages = Array(epochLength)
        .fill(null)
        .map(() => new Set<Hex>())
    }

    // Shift accumulated history (Gray Paper equation 418)
    // Left shift: accumulated'[i] = accumulated[i + 1] for i ∈ [0, C_epochlen - 2]
    // New data goes to the rightmost slot: accumulated'[C_epochlen - 1] = new packages
    for (let i = 0; i < epochLength - 1; i++) {
      this.accumulated.packages[i] = this.accumulated.packages[i + 1]
    }

    // Insert new packages at the rightmost slot (Gray Paper equation 417)
    this.accumulated.packages[epochLength - 1] = newPackages

    // Step 2: Update service accounts
    for (const result of results) {
      if (result.ok) {
        const { poststate } = result.value

        // Update service accounts with new state
        for (const [serviceId, account] of poststate.accounts) {
          this.serviceAccountsService.setAccount(serviceId, account)
        }

        this.privilegesService.setManager(poststate.manager)
        this.privilegesService.setAssigners(poststate.assigners)
        this.privilegesService.setDelegator(poststate.delegator)
        this.privilegesService.setRegistrar(poststate.registrar)
        this.privilegesService.setAlwaysAccers(poststate.alwaysaccers)
      }
    }

    // Step 3: Remove processed work-reports from ready queue
    const updatedReady = { ...this.ready }
    const currentSlotItems = updatedReady.epochSlots[Number(currentSlot)] || []

    // Filter out processed work-reports
    const remainingItems = currentSlotItems.filter(
      (item) =>
        !processedWorkReports.some(
          (processed) =>
            processed.package_spec.hash === item.workReport.package_spec.hash,
        ),
    )

    updatedReady.epochSlots[Number(currentSlot)] = remainingItems
    this.setReady(updatedReady)

    // Step 4: Update timeslot
    this.clockService.getCurrentSlot()
  }
}
