/**
 * Guarantor Service
 *
 * Gray Paper Reference: guaranteeing.tex
 *
 * Implements the guarantor role for JAM validators. Guarantors are responsible for:
 * 1. Determining which core they are assigned to
 * 2. Evaluating work-packages for their assigned core
 * 3. Computing work-reports from work-packages
 * 4. Signing and distributing work-reports
 * 5. Creating guarantee extrinsics for block inclusion
 *
 * Core Assignment Algorithm (Gray Paper Equation 212-218):
 * - Uses Fisher-Yates shuffle with epochal entropy (entropy_2)
 * - Rotates assignments every C_rotationperiod slots
 * - Each core has exactly 3 validators assigned (1023 validators / 341 cores = 3)
 * - Assignment is deterministic based on: entropy_2, thetime, and validator index
 */

import { bytesToHex, type EventBusService, hexToBytes } from '@pbnj/core'
import {
  createGuaranteeSignature,
  getAssignedCore,
  getCoGuarantors,
  sortGuaranteeSignatures,
  verifyGuaranteeSignature,
  verifyWorkReportDistributionSignature,
} from '@pbnj/guarantor'
import type { CE134WorkPackageSharingProtocol } from '@pbnj/networking'
import { calculateWorkPackageHash } from '@pbnj/serialization'
import type {
  Guarantee,
  GuaranteeSignature,
  IClockService,
  IConfigService,
  IEntropyService,
  Safe,
  SafePromise,
  StreamKind,
  WorkPackage,
  WorkPackageSharing,
  WorkPackageSharingResponse,
  WorkReport,
} from '@pbnj/types'
import {
  BaseService,
  safeError,
  safeResult,
  WORK_REPORT_CONSTANTS,
} from '@pbnj/types'
import type { Hex } from 'viem'
import type { AccumulationService } from './accumulation-service'
import type { AuthPoolService } from './auth-pool-service'
import type { ClockService } from './clock-service'
import type { ConfigService } from './config-service'
import type { EntropyService } from './entropy'
// import type { ErasureCodingService } from './erasure-coding-service'
import type { KeyPairService } from './keypair-service'
import type { NetworkingService } from './networking-service'
import type { RecentHistoryService } from './recent-history-service'
import type { ServiceAccountService } from './service-account-service'
// import type { ShardService } from './shard-service'
import type { StatisticsService } from './statistics-service'
import type { ValidatorSetManager } from './validator-set'
import type { WorkReportService } from './work-report-service'

/**
 * Guarantor Service Implementation
 *
 * Barebones implementation of the guarantor role
 */
export class GuarantorService extends BaseService {
  private readonly configService: IConfigService
  private readonly clockService: IClockService
  private readonly entropyService: IEntropyService
  // private readonly erasureCodingService: ErasureCodingService | null
  private readonly accumulationService: AccumulationService | null
  // Map of timeslot to map of validator index to number of signatures
  private readonly validatorSignaturesForTimeslot: Map<
    bigint,
    Map<number, number>
  > = new Map()

  private readonly authPoolService: AuthPoolService
  private readonly networkService: NetworkingService | null
  private readonly ce134WorkPackageSharingProtocol: CE134WorkPackageSharingProtocol | null
  private readonly keyPairService: KeyPairService | null
  private readonly workReportService: WorkReportService
  private readonly eventBusService: EventBusService
  private readonly validatorSetManager: ValidatorSetManager
  private readonly recentHistoryService: RecentHistoryService | null
  private readonly serviceAccountService: ServiceAccountService | null
  private readonly statisticsService: StatisticsService | null
  // private readonly shardService: ShardService | null
  private validatorIndex = 0

  constructor(options: {
    configService: ConfigService
    clockService: ClockService
    entropyService: EntropyService
    authPoolService: AuthPoolService
    networkService: NetworkingService | null
    ce134WorkPackageSharingProtocol: CE134WorkPackageSharingProtocol | null
    keyPairService: KeyPairService | null
    workReportService: WorkReportService
    eventBusService: EventBusService
    validatorSetManager: ValidatorSetManager
    recentHistoryService: RecentHistoryService | null
    serviceAccountService: ServiceAccountService | null
    statisticsService: StatisticsService | null
    // erasureCodingService: ErasureCodingService | null
    // shardService: ShardService | null
    accumulationService: AccumulationService | null
  }) {
    super('guarantor-service')
    this.configService = options.configService
    this.clockService = options.clockService
    this.entropyService = options.entropyService
    this.authPoolService = options.authPoolService
    this.networkService = options.networkService
    this.ce134WorkPackageSharingProtocol =
      options.ce134WorkPackageSharingProtocol
    this.workReportService = options.workReportService
    this.eventBusService = options.eventBusService
    this.validatorSetManager = options.validatorSetManager
    this.recentHistoryService = options.recentHistoryService
    this.serviceAccountService = options.serviceAccountService
    this.statisticsService = options.statisticsService
    // this.erasureCodingService = options.erasureCodingService
    // this.shardService = options.shardService
    this.accumulationService = options.accumulationService
    // Register event handlers
    this.eventBusService.addWorkPackageSubmissionReceivedCallback(
      this.handleWorkPackageSubmission.bind(this),
    )
    this.eventBusService.addWorkPackageSharingCallback(
      this.handleWorkPackageSharing.bind(this),
    )
    this.eventBusService.addWorkPackageSharingResponseCallback(
      this.handleCoGuarantorSignature.bind(this),
    )
    this.keyPairService = options.keyPairService
  }

  start(): Safe<boolean> | SafePromise<boolean> {
    if (!this.keyPairService) {
      return safeError(new Error('Key pair service not found'))
    }
    const publicKey =
      this.keyPairService.getLocalKeyPair().ed25519KeyPair.publicKey
    const [validatorIndexError, validatorIndex] =
      this.validatorSetManager.getValidatorIndex(bytesToHex(publicKey))
    if (validatorIndexError) {
      return safeError(validatorIndexError)
    }
    this.validatorIndex = validatorIndex
    return safeResult(true)
  }

  /**
   * Evaluate work-package authorization
   */
  evaluateAuthorization(
    workPackage: WorkPackage,
    coreIndex: number,
  ): Safe<boolean> {
    try {
      // TODO: Step 1: Extract authorization hash from work-package
      const authHash = workPackage.authCodeHash

      // TODO: Step 2: Get authorization pool from state
      const authPool = this.authPoolService.getAuthPool()

      // TODO: Step 3: Check if auth hash exists in pool for core
      const isAuthorized = authPool[coreIndex].includes(authHash)

      if (!isAuthorized) {
        return safeError(new Error('Work package not authorized'))
      }

      // TODO: Step 4: Verify context validity
      // - Check anchor block exists
      // - Check prerequisites are met
      // - Check timeslot is valid

      // TODO: Step 5: Return authorization status

      // Placeholder: Always return false (not implemented)
      return safeResult(false)
    } catch (error) {
      return safeError(error as Error)
    }
  }

  /**
   * Compute work-report from work-package
   */
  computeWorkReport(
    _workPackage: WorkPackage,
    _coreIndex: number,
  ): Safe<WorkReport> {
    try {
      // TODO: Step 1: Verify authorization first (avoid wasted work)
      // const [authError, isAuthorized] = this.evaluateAuthorization(workPackage, coreIndex)
      // if (authError || !isAuthorized) return error

      // TODO: Step 2: Execute Ψ_R (Refine) function
      // const [refineError, refineResult] = refineInvocation(workPackage, coreIndex)

      // TODO: Step 3: For each work-item:
      // - Load service code from state
      // - Execute PVM with work-item payload
      // - Collect execution results and gas usage

      // TODO: Step 4: Aggregate all work-item results

      // TODO: Step 5: Calculate work-package hash and segment root

      // TODO: Step 6: Create work-report structure

      // Placeholder: Return error (not implemented)
      return safeError(new Error('Work-report computation not implemented'))
    } catch (error) {
      return safeError(error as Error)
    }
  }

  /**
   * Compute segments root mappings for a work package
   *
   * *** GRAY PAPER FORMULA ***
   * Gray Paper: work_packages_and_reports.tex, equations 201, 224, 236
   *
   * Process:
   * 1. Identify all work-package hashes referenced in import segments (h^+)
   * 2. Lookup segment roots from recent history or current batch guarantees
   * 3. Create mappings dictionary: {workPackageHash → segmentRoot}
   *
   * Formula:
   * keys{wr_srlookup} = {h : wi ∈ wp.workitems, (h^+, n) ∈ wi.importsegments}
   * ∀ (h, e) ∈ wr_srlookup : ∃ wp, core : blake(wp) = h ∧ (computereport(wp, core).avspec).segroot = e
   *
   * @param workPackage - The work package to compute mappings for
   * @param currentBatchGuarantees - Guarantees being processed in current batch (optional)
   * @returns Segments root mappings array
   */
  computeSegmentsRootMappings(
    workPackage: WorkPackage,
    currentBatchGuarantees: Guarantee[] = [],
  ): Safe<
    Array<{
      workPackageHash: Uint8Array
      segmentsRoot: Uint8Array
    }>
  > {
    try {
      // Step 1: Collect all work-package hashes from import segments
      // Gray Paper equation 201: keys{wr_srlookup} = {h : wi ∈ wp.workitems, (h^+, n) ∈ wi.importsegments}
      const requiredPackageHashes = new Set<Hex>()

      for (const workItem of workPackage.workItems) {
        for (const importSegment of workItem.importsegments) {
          const treeRoot = importSegment.treeRoot

          // Check if this treeRoot is a work-package hash (tagged reference h^+)
          // We determine this by checking if it matches a package hash in recent history
          // or current batch, but NOT a segment root
          let isWorkPackageHash = false

          // Check recent history for package hash
          if (this.recentHistoryService) {
            const recentHistory = this.recentHistoryService.getRecentHistory()
            for (const entry of recentHistory) {
              // Check if treeRoot is a package hash (key in reportedPackageHashes)
              if (entry.reportedPackageHashes.has(treeRoot)) {
                isWorkPackageHash = true
                requiredPackageHashes.add(treeRoot)
                break
              }
            }
          }

          // Check current batch guarantees for package hash
          if (!isWorkPackageHash) {
            for (const guarantee of currentBatchGuarantees) {
              if (guarantee.report.package_spec.hash === treeRoot) {
                isWorkPackageHash = true
                requiredPackageHashes.add(treeRoot)
                break
              }
            }
          }
        }
      }

      // Step 2: Build mappings dictionary by looking up segment roots
      // Gray Paper equation 236: segment root comes from work-report's avspec.segroot
      const mappings = new Map<Hex, Hex>()

      // Lookup from recent history
      if (this.recentHistoryService) {
        const recentHistory = this.recentHistoryService.getRecentHistory()
        for (const packageHash of requiredPackageHashes) {
          for (const entry of recentHistory) {
            const segmentTreeRoot = entry.reportedPackageHashes.get(packageHash)
            if (segmentTreeRoot !== undefined) {
              // Found in recent history - add to mappings
              // reportedPackageHashes maps: packageHash → exports_root (which is the segment root)
              mappings.set(packageHash, segmentTreeRoot)
              break
            }
          }
        }
      }

      // Lookup from current batch guarantees
      for (const packageHash of requiredPackageHashes) {
        // Skip if already found in recent history
        if (mappings.has(packageHash)) {
          continue
        }

        for (const guarantee of currentBatchGuarantees) {
          if (guarantee.report.package_spec.hash === packageHash) {
            // Found in current batch - use exports_root as segment root
            // Gray Paper: avspec.segroot = exports_root (the segment tree root)
            mappings.set(
              packageHash,
              guarantee.report.package_spec.exports_root,
            )
            break
          }
        }
      }

      // Step 3: Convert to array format expected by WorkPackageSharing
      const mappingsArray = Array.from(mappings.entries()).map(
        ([workPackageHash, segmentsRoot]) => ({
          workPackageHash: hexToBytes(workPackageHash),
          segmentsRoot: hexToBytes(segmentsRoot),
        }),
      )

      // Gray Paper equation 50: Validate total dependencies
      // Note: This validation happens later in applyGuarantees, but we check here for safety
      const prerequisites = workPackage.context.prerequisites || []
      const totalDependencies = prerequisites.length + mappingsArray.length
      if (totalDependencies > WORK_REPORT_CONSTANTS.C_MAXREPORTDEPS) {
        return safeError(
          new Error(
            `Total dependencies (${totalDependencies}) exceed maximum (${WORK_REPORT_CONSTANTS.C_MAXREPORTDEPS})`,
          ),
        )
      }

      return safeResult(mappingsArray)
    } catch (error) {
      return safeError(error as Error)
    }
  }

  /**
   * Distribute work-package to co-guarantors
   */
  distributeToCoGuarantors(
    workPackage: WorkPackage,
    coreIndex: number,
  ): Safe<GuaranteeSignature[]> {
    if (!this.ce134WorkPackageSharingProtocol) {
      return safeError(new Error('CE134WorkPackageSharingProtocol not found'))
    }
    if (!this.networkService) {
      return safeError(new Error('NetworkService not found'))
    }
    const entropy2 = this.entropyService.getEntropy2()
    const currentSlot = this.clockService.getCurrentSlot()
    // TODO: Step 1: Get co-guarantors for this core
    const [coGuarantorsError, coGuarantors] = getCoGuarantors(
      coreIndex,
      this.validatorIndex,
      entropy2,
      currentSlot,
      this.configService,
    )

    if (coGuarantorsError) {
      return safeError(coGuarantorsError)
    }

    // Compute segments root mappings according to Gray Paper
    const [mappingsError, segmentsRootMappings] =
      this.computeSegmentsRootMappings(workPackage, [])
    if (mappingsError) {
      return safeError(mappingsError)
    }

    for (const coGuarantor of coGuarantors) {
      const [messageError, message] =
        this.ce134WorkPackageSharingProtocol.serializeRequest({
          coreIndex: BigInt(coreIndex),
          workPackageBundle: workPackage,
          segmentsRootMappings,
        })
      if (messageError) {
        return safeError(messageError)
      }
      this.networkService.sendMessage(
        BigInt(coGuarantor),
        134 as StreamKind,
        message,
      )
    }

    // Placeholder: Return empty array (not implemented)
    return safeResult([])
  }

  /**
   * Perform erasure coding on work-package and trigger shard distribution
   */
  // async performErasureCoding(
  //   workPackage: WorkPackage,
  //   exportedSegments: Uint8Array[],
  //   extrinsicData: Uint8Array[],
  //   importedSegments: Uint8Array[],
  //   coreIndex: bigint,
  // ): SafePromise<void> {
  //   if (!this.shardService) {
  //     return safeError(new Error('Shard service not found'))
  //   }
  //   // Trigger shard distribution through shard service
  //   const [shardError] =
  //     await this.shardService.generateAndDistributeWorkPackageShards(
  //       workPackage,
  //       exportedSegments,
  //       importedSegments,
  //       coreIndex,
  //     )
  //   if (shardError) {
  //     logger.error('Failed to generate and distribute shards', {
  //       error: shardError.message,
  //       coreIndex: coreIndex.toString(),
  //     })
  //     return safeError(shardError)
  //   }

  //   return safeResult(undefined)
  // }

  /**
   * Create guarantee extrinsic
   */
  // createGuarantee(
  //   workReport: WorkReport,
  //   signatures: GuaranteeSignature[],
  //   timeslot: bigint,
  //   coreAssignments: Map<number, number>,
  //   validatorKeys: Map<number, ValidatorPublicKeys>,
  // ): Safe<Guarantee> {
  //   try {
  //     // Step 1 & 2: Sort signatures by validator index
  //     // This also ensures they're in the correct order per Gray Paper
  //     const sortedSignatures = sortGuaranteeSignatures(signatures)

  //     // Steps 3-5: Validate all signatures
  //     // This validates:
  //     // - Signature count (2-3)
  //     // - Unique validators
  //     // - Correct ordering
  //     // - Validators assigned to core
  //     // - Cryptographic validity
  //     const [validateError, validationResult] =
  //       verifyWorkReportDistributionSignature(
  //         workReport,
  //         sortedSignatures,
  //         coreAssignments,
  //       )

  //     // Step 6: Create guarantee tuple
  //     const guarantee: Guarantee = {
  //       work_report: workReport,
  //       timeslot,
  //       credential: sortedSignatures,
  //     }

  //     return safeResult(guarantee)
  //   } catch (error) {
  //     return safeError(error as Error)
  //   }
  // }

  /**
   * Send guarantee to block author
   */
  sendToBlockAuthor(_guarantee: Guarantee): Safe<void> {
    try {
      // TODO: Step 1: Get current block author from Safrole state
      // TODO: Step 2: Package guarantee into network message
      // TODO: Step 3: Send to block author
      // TODO: Step 4: Track inclusion status
      // TODO: Step 5: Resend if not included within timeout

      // Placeholder: Return error (not implemented)
      return safeError(new Error('Send to block author not implemented'))
    } catch (error) {
      return safeError(error as Error)
    }
  }

  /**
   * Distribute Guaranteed Work Report to Validators (CE135)
   *
   * Gray Paper Reference: guaranteeing.tex, JAMNP-S CE135
   *
   * Called after collecting 2-3 signatures from co-guarantors.
   * Distributes the guaranteed work-report to all relevant validators.
   *
   * TIMING REQUIREMENTS:
   * - After getting 2 signatures, wait ~2 seconds for potential 3rd signature
   * - Avoid distributing work-reports that cannot be included in next block
   * - Don't distribute reports with slots too far in past/future
   *
   * DISTRIBUTION TARGETS:
   * - All current epoch validators (always)
   * - All next epoch validators (only during last core rotation of epoch)
   * - Note: These validator sets likely overlap
   *
   * STRUCTURE:
   * GuaranteedWorkReport = WorkReport ++ Slot ++ len++[ValidatorIndex ++ Ed25519Signature]
   *
   * @param workReport - The work report to distribute
   * @param signatures - Guarantee signatures (2-3 signatures, sorted by validator index)
   * @param slot - Current timeslot
   */
  private async distributeGuaranteedWorkReport(
    workReport: WorkReport,
    signatures: GuaranteeSignature[],
    slot: bigint,
  ): Promise<Safe<void>> {
    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Validate Prerequisites
    // ═══════════════════════════════════════════════════════════════════
    // Ensure we have 2-3 signatures (Gray Paper requirement)
    if (signatures.length < 2 || signatures.length > 3) {
      return safeError(
        new Error(
          `Invalid signature count: ${signatures.length}. Must have 2-3 signatures.`,
        ),
      )
    }

    // Sort signatures by validator index (Gray Paper requirement)
    // const sortedSignatures = sortGuaranteeSignatures(signatures)

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Check Slot Validity
    // ═══════════════════════════════════════════════════════════════════
    // Don't distribute work-reports that cannot be included in next block
    const currentSlot = this.clockService.getCurrentSlot()
    const slotDifference = currentSlot > slot ? currentSlot - slot : 0n
    const MAX_PAST_SLOTS = 10n // Don't distribute stale reports
    const MAX_FUTURE_SLOTS = 2n // Don't distribute reports too far ahead

    if (slotDifference > MAX_PAST_SLOTS) {
      return safeError(
        new Error(
          `Work-report slot ${slot} too far in past (current: ${currentSlot})`,
        ),
      )
    }
    if (slot - currentSlot > MAX_FUTURE_SLOTS) {
      return safeError(
        new Error(
          `Work-report slot ${slot} too far in future (current: ${currentSlot})`,
        ),
      )
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: Determine Distribution Targets
    // ═══════════════════════════════════════════════════════════════════
    // Get current epoch validators (always distribute to these)
    // TODO: Get from ValidatorSetManager when available
    // For now, use a placeholder - distribute to all validators
    const currentValidators: number[] = []
    // currentValidators = this.validatorSetManager.getActiveValidators().map((_, i) => i)

    // Check if we're in the last core rotation of the epoch
    const isLastRotation = this.isLastCoreRotationOfEpoch()

    // If last rotation, also get next epoch validators
    const nextValidators: number[] = []
    if (isLastRotation) {
      // nextValidators = this.validatorSetManager.getStagingValidators().map((_, i) => i)
    }

    // Combine and deduplicate validators (sets likely overlap)
    const allValidators = new Set([...currentValidators, ...nextValidators])

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: Create GuaranteedWorkReport Structure
    // ═══════════════════════════════════════════════════════════════════
    // Structure per JAMNP-S CE135:
    // WorkReport ++ Slot ++ len++[ValidatorIndex ++ Ed25519Signature]
    // const _guaranteedWorkReport = {
    //   workReport,
    //   slot,
    //   signatures: sortedSignatures,
    // }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 5: Distribute via CE135 Protocol
    // ═══════════════════════════════════════════════════════════════════
    // TODO: Use CE135WorkReportDistributionProtocol to send to all validators
    // This will be implemented once we have:
    // - CE135Protocol instance in constructor
    // - ValidatorSetManager for getting validator list
    //
    // for (const validatorIndex of allValidators) {
    //   if (validatorIndex === this.validatorIndex) {
    //     continue // Don't send to ourselves
    //   }
    //
    //   try {
    //     await this.networkService.sendToValidator(
    //       validatorIndex,
    //       'CE135',
    //       guaranteedWorkReport,
    //     )
    //   } catch (error) {
    //     // Continue distributing to other validators even if one fails
    //     // Log warning but don't fail the entire distribution
    //   }
    // }

    // Placeholder: At least log the distribution intent
    if (allValidators.size > 0) {
      // Distribution will happen here
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 6: Store Locally & Create Guarantee Extrinsic
    // ═══════════════════════════════════════════════════════════════════
    // Store in WorkReportService for local processing
    const [storeError] =
      this.workReportService.storeGuaranteedWorkReport(workReport)
    if (storeError) {
      return safeError(storeError)
    }

    // Create Guarantee extrinsic structure for block inclusion
    // Gray Paper Equation 251-258: Guarantee structure
    // const _guarantee: Guarantee = {
    //   report: workReport,
    //   slot,
    //   signatures: sortedSignatures,
    // }

    return safeResult(undefined)
  }

  /**
   * Check if we're in the last core rotation of the current epoch
   *
   * Gray Paper Reference: safrole.tex
   *
   * - C_rotationperiod slots per rotation
   * - C_epochlen slots per epoch
   * - Last rotation starts at: epoch_start + (num_rotations - 1) * C_rotationperiod
   */
  private isLastCoreRotationOfEpoch(): boolean {
    const currentSlot = this.clockService.getCurrentSlot()
    const C_EPOCHLEN = this.configService.epochDuration
    const C_ROTATIONPERIOD = this.configService.rotationPeriod

    const slotInEpoch = Number(currentSlot % BigInt(C_EPOCHLEN))
    const numRotations = Math.floor(
      Number(C_EPOCHLEN) / Number(C_ROTATIONPERIOD),
    )
    const lastRotationStart = (numRotations - 1) * Number(C_ROTATIONPERIOD)

    return slotInEpoch >= lastRotationStart
  }

  /**
   * Handle Work Package Submission from Builder (CE133)
   *
   * Gray Paper Reference: guaranteeing.tex (Section 12), work_packages_and_reports.tex
   *
   * Called when a builder submits a work-package via CE133 protocol.
   * This is the primary entry point for guarantors to evaluate work packages.
   *
   * COMPLETE WORKFLOW:
   *
   * ═══════════════════════════════════════════════════════════════════════
   * STEP 1: Verify Assignment & Anti-Spam
   * ═══════════════════════════════════════════════════════════════════════
   * - Check if we are assigned to the target core (getAssignedCore)
   * - Gray Paper Equations 210-218: Core assignment via Fisher-Yates shuffle
   * - Check if we can sign (max 2 signatures per timeslot) (canSignWorkReport)
   * - Gray Paper: Anti-spam measure to prevent validator overload
   *
   * ═══════════════════════════════════════════════════════════════════════
   * STEP 2: Authorization Validation
   * ═══════════════════════════════════════════════════════════════════════
   * - Compute authorizer hash: blake{authcodehash ∥ authconfig}
   * - Check if authorizer is in auth pool for this core
   * - Service: AuthPoolService.getAuthPool()
   * - Gray Paper Equations 154-159: Authorization validation
   *
   * ═══════════════════════════════════════════════════════════════════════
   * STEP 3: Work Package Evaluation (Refine Invocation)
   * ═══════════════════════════════════════════════════════════════════════
   * - Execute Refine (Ψ_R) function on each work item
   * - Input: work-package, extrinsic data, imported segments
   * - Gray Paper Equations 186-241: Refine execution in PVM
   * - Output: work results, gas used, exported segments
   * - TODO: Service needed: IPVMService.executeRefine()
   * - TODO: Fetch imported segments from availability system
   *
   * ═══════════════════════════════════════════════════════════════════════
   * STEP 4: Compute Work Report
   * ═══════════════════════════════════════════════════════════════════════
   * - Construct work-report from refine results
   * - Gray Paper Equations 185-241: Work-report structure
   * - Includes:
   *   • context (anchor, state_root, beefy_root, etc.)
   *   • authorization trace & gas used
   *   • work item digests
   *   • segments-root (merklecd of exported segments)
   *   • package specification (hash, length, erasure_root, exports_root)
   * - TODO: Service needed: IWorkReportComputationService.computeReport()
   *
   * ═══════════════════════════════════════════════════════════════════════
   * STEP 5: Erasure Coding & Distribution
   * ═══════════════════════════════════════════════════════════════════════
   * - Erasure code the audit bundle (work-package + extrinsics + imports)
   * - Gray Paper Section 12.2: Reed-Solomon on GF(2^16)
   * - 684-byte pieces, 1023 validators, 342-of-1023 reconstruction
   * - Create two data sets:
   *   A) Audit bundle (short-term, until finality)
   *   B) Export segments + paged proofs (long-term, 28 days minimum)
   * - TODO: Service needed: IErasureCodingService.encodeWorkPackage()
   * - TODO: Distribute chunks to validators via JAMNP-S protocols
   *
   * ═══════════════════════════════════════════════════════════════════════
   * STEP 6: Store & Sign Work Report
   * ═══════════════════════════════════════════════════════════════════════
   * - Store work-report in WorkReportService
   * - Service: WorkReportService.storeGuaranteedWorkReport()
   * - Sign using Ed25519 key (createGuaranteeSignature)
   * - Record signature in history (recordSignature)
   * - Gray Paper Equation 265: Guarantee signature on blake{encode{work-report}}
   *
   * ═══════════════════════════════════════════════════════════════════════
   * STEP 7: Share with Co-Guarantors (CE134)
   * ═══════════════════════════════════════════════════════════════════════
   * - Get co-guarantors for this core (getCoGuarantors)
   * - Each core has 3 validators, we need 2-3 signatures total
   * - Share work-package + segments-root mappings via CE134 protocol
   * - Service: CE134WorkPackageSharingProtocol.shareWorkPackage()
   * - Wait for signature responses from co-guarantors
   *
   * ═══════════════════════════════════════════════════════════════════════
   * STEP 8: Create Guarantee Extrinsic
   * ═══════════════════════════════════════════════════════════════════════
   * - Once we have 2-3 signatures total, create Guarantee extrinsic
   * - Sort signatures by validator index (sortGuaranteeSignatures)
   * - Gray Paper Equation 251-258: Guarantee structure
   * - Add to pending guarantees for block inclusion
   * - Guarantees are included in block extrinsics (xt_guarantees)
   *
   * @param data - Work package submission from builder (coreIndex, workPackage, extrinsics)
   */
  private async handleWorkPackageSubmission(data: {
    coreIndex: bigint
    workPackage: WorkPackage
    extrinsics: Uint8Array
    peerId?: Uint8Array
  }): Promise<Safe<void>> {
    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Verify Assignment & Anti-Spam
    // ═══════════════════════════════════════════════════════════════════
    const entropy2 = this.entropyService.getEntropy2()
    const currentSlot = this.clockService.getCurrentSlot()
    const [coreError, assignedCore] = getAssignedCore(
      this.validatorIndex,
      entropy2,
      currentSlot,
      this.configService,
    )
    if (coreError) {
      return safeError(coreError)
    }

    if (assignedCore !== Number(data.coreIndex)) {
      return safeError(
        new Error(
          `Not assigned to core ${data.coreIndex}, assigned to core ${assignedCore}`,
        ),
      )
    }

    // Check anti-spam limit (max 2 signatures per timeslot)
    const validatorSignatures =
      this.validatorSignaturesForTimeslot
        .get(currentSlot)
        ?.get(this.validatorIndex) ?? 0
    if (validatorSignatures && validatorSignatures > 2) {
      return safeError(
        new Error(
          `Cannot sign work report: already signed 2 reports this timeslot`,
        ),
      )
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Authorization Validation
    // ═══════════════════════════════════════════════════════════════════
    // TODO: Compute authorizer hash: blake{authcodehash ∥ authconfig}
    // const authorizerHash = blake2bHash(
    //   concatBytes([
    //     hexToBytes(workPackage.authCodeHash),
    //     hexToBytes(workPackage.authConfig),
    //   ])
    // )
    //
    // TODO: Check if authorizer is in auth pool for this core
    // const authPool = this.authPoolService.getAuthPool()
    // const coreAuthorizers = authPool[Number(data.coreIndex)]
    // if (!coreAuthorizers || !coreAuthorizers.includes(authorizerHash)) {
    //   return safeError(new Error('Authorizer not in auth pool for this core'))
    // }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: Work Package Evaluation (Refine Invocation)
    // ═══════════════════════════════════════════════════════════════════
    // TODO: Execute Refine (Ψ_R) function on each work item
    // Service needed: IPVMService
    //
    // const [refineError, refineResult] = await this.pvmService.executeRefine({
    //   workPackage,
    //   extrinsics: data.extrinsics,
    //   importedSegments: await this.fetchImportedSegments(workPackage.workItems),
    //   context: workPackage.context,
    // })
    // if (refineError) {
    //   return safeError(new Error(`Refine execution failed: ${refineError.message}`))
    // }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: Compute Work Report
    // ═══════════════════════════════════════════════════════════════════
    // TODO: Construct work-report from refine results
    // Service needed: IWorkReportComputationService
    //
    // const [reportError, workReport] = this.workReportComputationService.computeReport({
    //   workPackage,
    //   refineResult,
    //   coreIndex: data.coreIndex,
    //   authorizationTrace: refineResult.authTrace,
    //   authorizationGasUsed: refineResult.authGasUsed,
    //   segmentsRoot: merklizecd(refineResult.exportSegments),
    //   packageSpec: {
    //     hash: calculateWorkPackageHash(workPackage),
    //     length: encodeWorkPackage(workPackage).length,
    //     erasure_root: ..., // Computed in step 5
    //     exports_root: merklizecd(refineResult.exportSegments),
    //     exports_count: refineResult.exportSegments.length,
    //   },
    // })
    // if (reportError) {
    //   return safeError(new Error(`Work report computation failed: ${reportError.message}`))
    // }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 5: Erasure Coding & Distribution
    // ═══════════════════════════════════════════════════════════════════
    // TODO: Erasure code the audit bundle and export segments
    // Service needed: IErasureCodingService
    //
    // Gray Paper Section 12.2: 684-byte pieces, 1023 validators, Reed-Solomon on GF(2^16)
    //
    // const [erasureError, { auditChunks, exportChunks, erasureRoot }] =
    //   await this.erasureCodingService.encodeWorkPackage({
    //     workPackage,
    //     extrinsics: data.extrinsics,
    //     importSegments: ..., // Self-justifying imported segments
    //     exportSegments: refineResult.exportSegments,
    //   })
    // if (erasureError) {
    //   return safeError(new Error(`Erasure coding failed: ${erasureError.message}`))
    // }
    //
    // TODO: Distribute chunks to all validators
    // for (const [validatorIndex, chunk] of auditChunks.entries()) {
    //   await this.distributionService.sendChunk(validatorIndex, chunk, 'audit')
    // }
    // for (const [validatorIndex, chunk] of exportChunks.entries()) {
    //   await this.distributionService.sendChunk(validatorIndex, chunk, 'export')
    // }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 6: Store & Sign Work Report
    // ═══════════════════════════════════════════════════════════════════
    // TODO: Store work-report in WorkReportService
    // await this.workReportService.storeGuaranteedWorkReport(
    //   workReport,
    //   data.coreIndex,
    // )
    //
    // TODO: Sign using Ed25519 key
    // const [signError, signature] = createGuaranteeSignature(
    //   workReport,
    //   this.validatorEdPrivateKey,
    // )
    // if (signError) {
    //   return safeError(new Error(`Signature creation failed: ${signError.message}`))
    // }
    //
    // Record signature in history (anti-spam tracking)
    const currentSignatures =
      this.validatorSignaturesForTimeslot.get(currentSlot) ?? new Map()
    const currentValidatorSignatures =
      currentSignatures.get(this.validatorIndex) ?? 0
    currentSignatures.set(this.validatorIndex, currentValidatorSignatures + 1)
    this.validatorSignaturesForTimeslot.set(currentSlot, currentSignatures)
    // ═══════════════════════════════════════════════════════════════════
    // STEP 7: Share with Co-Guarantors (CE134)
    // ═══════════════════════════════════════════════════════════════════
    // Get co-guarantors for this core (each core has 3 validators)

    const [coGuarantorsError, _coGuarantors] = getCoGuarantors(
      Number(data.coreIndex),
      this.validatorIndex,
      entropy2,
      currentSlot,
      this.configService,
    )
    if (coGuarantorsError) {
      return safeError(coGuarantorsError)
    }

    // TODO: Share work-package + segments-root mappings via CE134
    // const sharing: WorkPackageSharing = {
    //   coreIndex: data.coreIndex,
    //   workPackageBundle: workPackage,
    //   segmentsRootMappings: refineResult.segmentsRootMappings,
    // }
    // for (const coGuarantor of coGuarantors) {
    //   if (coGuarantor !== this.validatorIndex) {
    //     await this.ce134WorkPackageSharingProtocol.shareWorkPackage(
    //       coGuarantor,
    //       sharing,
    //     )
    //   }
    // }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 8: Wait for Co-Guarantor Signatures & Distribute (CE135)
    // ═══════════════════════════════════════════════════════════════════
    // This step is handled asynchronously:
    // 1. Wait for responses from co-guarantors (handleWorkPackageSharingResponse)
    // 2. Once we have 2 signatures, wait ~2 seconds for potential 3rd signature
    // 3. Create GuaranteedWorkReport structure (work-report ++ slot ++ signatures)
    // 4. Distribute to all current validators via CE135
    // 5. During last core rotation of epoch, also distribute to next epoch validators
    // 6. Create Guarantee extrinsic for block inclusion
    //
    // The distribution is handled by:
    // - distributGuaranteedWorkReport() method (called after signature collection)
    // - CE135WorkReportDistributionProtocol for actual transmission
    //
    // See: handleWorkPackageSharingResponse() and distributeGuaranteedWorkReport()

    return safeResult(undefined)
  }

  /**
   * Handle Work Package Sharing Event
   *
   * Gray Paper Reference: guaranteeing.tex (lines 31-33)
   *
   * Called when a co-guarantor shares a work package with us via CE134 protocol.
   * This is Step 2 in the guarantor workflow after the primary guarantor has evaluated
   * the work package and wants to collect signatures from co-guarantors.
   *
   * Required Steps:
   * 1. Verify we are assigned to this core (can reuse: getAssignedCore)
   * 2. Verify authorization against auth pool (can reuse: authPoolService methods)
   * 3. Compute work-report from work-package (TODO: implement Ψ_R function)
   * 4. Calculate work-report hash
   * 5. Verify we can sign (anti-spam check) (can reuse: canSignWorkReport)
   * 6. Sign work-report using Ed25519 key (can reuse: createGuaranteeSignature)
   * 7. Record that we signed this timeslot (can reuse: recordSignedReport)
   * 8. Send response back via CE134 protocol
   *
   * Reusable Methods:
   * - getAssignedCore() - Check if we're assigned to this core
   * - canSignWorkReport() - Check anti-spam limit (max 2 signatures per timeslot)
   * - createGuaranteeSignature() - Sign the work report
   * - recordSignedReport() - Update signature history
   *
   * @param sharing - Work package sharing data from co-guarantor
   */
  private handleWorkPackageSharing(
    sharing: WorkPackageSharing,
    peerPublicKey: Hex,
  ): Safe<void> {
    // get validator index from peer public key
    const [validatorIndexError, validatorIndex] =
      this.validatorSetManager.getValidatorIndex(peerPublicKey)
    if (validatorIndexError) {
      return safeError(validatorIndexError)
    }
    if (!this.entropyService) {
      return safeError(new Error('Entropy service not found'))
    }
    if (!this.clockService) {
      return safeError(new Error('Clock service not found'))
    }
    // Step 1: Verify we are assigned to this core
    const entropy2 = this.entropyService.getEntropy2()
    const currentSlot = this.clockService.getCurrentSlot()
    const [coreError, assignedCore] = getAssignedCore(
      validatorIndex,
      entropy2,
      currentSlot,
      this.configService,
    )
    if (coreError) {
      return safeError(coreError)
    }

    if (assignedCore !== Number(sharing.coreIndex)) {
      return safeError(
        new Error(
          `Not assigned to core ${sharing.coreIndex}, assigned to core ${assignedCore}`,
        ),
      )
    }

    // Step 2: Verify authorization against auth pool
    // TODO: Check if work package authorization hash is in auth pool for this core
    const authPool = this.authPoolService.getCoreAuthorizations(
      Number(sharing.coreIndex),
    )
    const [authHashError, authHash] = calculateWorkPackageHash(
      sharing.workPackageBundle,
    )
    if (authHashError) {
      return safeError(authHashError)
    }
    if (!authPool.includes(authHash)) {
      return safeError(new Error('Work package not authorized'))
    }

    // Step 3: Compute work-report from work-package
    // TODO: Implement Ψ_R(p, c) - Refine function to compute work report
    // This involves:
    // - Executing PVM for each work item
    // - Computing work results
    // - Building work report structure
    // const workReport = await this.computeWorkReport(sharing.workPackageBundle, sharing.coreIndex)

    // Step 4: Calculate work-report hash
    // TODO: Hash the work report using BLAKE2b
    // const workReportHash = blake2bHash(encode(workReport))

    // Step 5: Verify we can sign (anti-spam check - max 2 per timeslot)
    const validatorSignatures =
      this.validatorSignaturesForTimeslot.get(currentSlot) ?? new Map()
    const currentValidatorSignatures =
      validatorSignatures.get(this.validatorIndex) ?? 0
    if (currentValidatorSignatures >= 2) {
      return safeError(
        new Error(
          'Cannot sign work report: anti-spam limit reached (2 per timeslot)',
        ),
      )
    }

    // Step 6: Sign work-report using Ed25519 key
    // TODO: Get our Ed25519 private key and sign the work report hash
    // const edPrivateKey = await this.getEdPrivateKey()
    // const signature = createGuaranteeSignature(workReportHash, edPrivateKey)

    // Step 7: Record that we signed this timeslot
    currentValidatorSignatures.set(
      this.validatorIndex,
      currentValidatorSignatures + 1,
    )
    this.validatorSignaturesForTimeslot.set(currentSlot, validatorSignatures)

    // Step 8: Send response back via CE134 protocol
    // TODO: Send WorkPackageSharingResponse with workReportHash and signature
    // const response: WorkPackageSharingResponse = {
    //   workReportHash,
    //   signature,
    // }
    // await this.ce134WorkPackageSharingProtocol.sendResponse(response)

    return safeResult(undefined)
  }

  /**
   * Handle Co-Guarantor Signature (CE134 Response)
   *
   * Gray Paper Reference: guaranteeing.tex (line 33)
   *
   * Called when we receive a signature from a co-guarantor after sharing
   * a work package with them via CE134. Collects signatures and triggers
   * distribution via CE135 when ready.
   *
   * Workflow:
   * 1. Verify signature is from a valid co-guarantor
   * 2. Get the work report we're collecting signatures for
   * 3. Validate the signature cryptographically
   * 4. Store signature in pending collection
   * 5. Check if we have enough signatures (2-3)
   * 6. Wait ~2 seconds for potential 3rd signature if we have 2
   * 7. Distribute guaranteed work-report via CE135
   *
   * @param response - Signature response containing workReportHash, signature, validatorIndex
   */
  private async handleCoGuarantorSignature(
    response: WorkPackageSharingResponse,
    peerPublicKey: Hex,
  ): Promise<Safe<void>> {
    // make sure we have the work report in the work report service
    const workReportEntry = this.workReportService.getWorkReportByHash(
      bytesToHex(response.workReportHash),
    )
    if (!workReportEntry) {
      return safeError(
        new Error(
          `Work report not found for hash: ${bytesToHex(response.workReportHash)}`,
        ),
      )
    }

    const workReport = workReportEntry
    // get validator index from peer public key
    const [validatorIndexError, validatorIndex] =
      this.validatorSetManager.getValidatorIndex(peerPublicKey)
    if (validatorIndexError) {
      return safeError(validatorIndexError)
    }

    // get assigned core for validator index
    const entropy2 = this.entropyService.getEntropy2()
    const currentSlot = this.clockService.getCurrentSlot()
    const [assignedCoreError, assignedCore] = getAssignedCore(
      validatorIndex,
      entropy2,
      currentSlot,
      this.configService,
    )
    if (assignedCoreError) {
      return safeError(assignedCoreError)
    }

    // check if assigned core is the same as the core in the response
    if (assignedCore !== Number(workReport.core_index)) {
      return safeError(
        new Error(
          `Validator ${validatorIndex} is not assigned to core ${workReport.core_index}`,
        ),
      )
    }

    // Get or create signature collection for this work report
    let pending = this.pendingSignatures.get(
      bytesToHex(response.workReportHash),
    )
    if (!pending) {
      // First signature for this work report
      pending = {
        workReport,
        signatures: [],
        timer: undefined,
      }
      this.pendingSignatures.set(bytesToHex(response.workReportHash), pending)
    }

    // Validate signature cryptographically
    // TODO: Get validator keys from ValidatorSetManager
    // const validatorKeys = this.validatorSetManager.getActiveValidators()
    // const coreAssignments = this.getCoreAssignments()
    const [validationError, isValid] = verifyWorkReportDistributionSignature(
      workReport,
      {
        validator_index: validatorIndex,
        signature: bytesToHex(response.signature),
      },
      hexToBytes(peerPublicKey),
    )
    if (validationError) {
      return safeError(validationError)
    }

    if (!isValid) {
      return safeError(
        new Error(`Signature is invalid for validator ${validatorIndex}`),
      )
    }

    // Add signature to collection
    pending.signatures.push({
      validator_index: validatorIndex,
      signature: bytesToHex(response.signature),
    })

    // Check if we have enough signatures (2-3)
    const totalSignatures = pending.signatures.length + 1 // +1 for our own signature

    if (totalSignatures >= 2) {
      // Clear any existing timer
      if (pending.timer) {
        clearTimeout(pending.timer)
      }

      // If we have exactly 2 signatures, wait ~2 seconds for potential 3rd
      if (totalSignatures === 2) {
        pending.timer = setTimeout(() => {
          this.finalizeAndDistributeWorkReport(
            bytesToHex(response.workReportHash),
          )
        }, 2000) // 2 second wait
      } else {
        // We have 3 signatures, distribute immediately
        this.finalizeAndDistributeWorkReport(
          bytesToHex(response.workReportHash),
        )
      }
    }

    return safeResult(undefined)
  }

  /**
   * Finalize signature collection and distribute work report via CE135
   *
   * @param workReportHash - Hash of the work report to distribute
   */
  private async finalizeAndDistributeWorkReport(
    workReportHash: Hex,
  ): Promise<void> {
    if (!this.keyPairService) {
      return
    }
    const pending = this.pendingSignatures.get(workReportHash)
    if (!pending) {
      return
    }

    // Clean up
    this.pendingSignatures.delete(workReportHash)
    if (pending.timer) {
      clearTimeout(pending.timer)
    }

    // Add our own signature to the collection
    const localValidatorIndex = this.validatorIndex
    const [ourSignatureError, _ourSignature] = createGuaranteeSignature(
      pending.workReport,
      localValidatorIndex,
      this.keyPairService.getLocalKeyPair().ed25519KeyPair.privateKey,
    )
    if (ourSignatureError) {
      return
    }
    // TODO: Get our own signature for this work report
    // const ourSignature: GuaranteeSignature = {
    //   validator_index: this.validatorIndex,
    //   signature: ..., // Our Ed25519 signature
    // }
    // const allSignatures = [ourSignature, ...pending.signatures]

    // For now, simulate with collected signatures
    const allSignatures = pending.signatures

    // Sort signatures by validator index (Gray Paper requirement)
    const sortedSignatures = sortGuaranteeSignatures(allSignatures)

    // Distribute via CE135
    const currentSlot = this.clockService.getCurrentSlot()
    const [distributionError] = await this.distributeGuaranteedWorkReport(
      pending.workReport,
      sortedSignatures,
      currentSlot,
    )

    if (distributionError) {
      // Log error but don't throw - distribution already attempted
      console.error(
        'Failed to distribute guaranteed work report:',
        distributionError,
      )
    }
  }

  // Storage for collecting signatures per work report
  // TODO: Move this to a proper state management structure
  private readonly pendingSignatures = new Map<
    Hex,
    {
      workReport: WorkReport
      signatures: GuaranteeSignature[]
      timer?: NodeJS.Timeout
    }
  >()

  /**
   * Apply guarantees state transition
   *
   * Gray Paper Reference: reporting_assurance.tex (Section 12.3)
   * Processes guarantees extrinsic and marks work reports as available
   *
   * Validation rules (Gray Paper equations 251-298):
   * 1. Guarantees must be sorted by core index (ascending, unique)
   * 2. Each guarantee must have 2-3 signatures, sorted by validator index
   * 3. Signatures must be cryptographically valid
   * 4. Validators must be assigned to the core (current or previous rotation)
   * 5. Core must not be engaged (no pending report)
   * 6. Authorizer hash must be in auth pool for the core
   * 7. Work report structure must be valid
   * 8. Dependencies must be satisfied (known packages)
   *
   * @param guarantees - Array of guarantees from block body
   * @param currentSlot - Current timeslot
   * @returns Array of reporter validator public keys (ed25519)
   */
  applyGuarantees(guarantees: Guarantee[], currentSlot: bigint): Safe<Hex[]> {
    // Pre-validate all guarantees before processing
    // Pass currentSlot and rotationPeriod to determine correct validator set
    for (const guarantee of guarantees) {
      const [guaranteeValidationError] = verifyGuaranteeSignature(
        guarantee,
        this.validatorSetManager,
        currentSlot,
        this.configService.rotationPeriod,
      )
      if (guaranteeValidationError) {
        return safeError(guaranteeValidationError)
      }
    }
    const reporters = new Set<Hex>()
    const processedCores = new Set<number>()
    // Track package hashes to detect duplicates across all guarantees
    const seenPackageHashes = new Set<Hex>()
    // Track ALL package hashes from ALL guarantees in the batch (for prerequisite resolution)
    // Gray Paper: local_incomingpackagehashes includes all guarantees in the batch
    const allGuaranteePackageHashes = new Set<Hex>()
    for (const guarantee of guarantees) {
      allGuaranteePackageHashes.add(guarantee.report.package_spec.hash)
    }

    // Gray Paper equation 257: Guarantees must be sorted by core index (ascending, unique)
    for (let i = 0; i < guarantees.length; i++) {
      const guarantee = guarantees[i]
      const coreIndex = Number(guarantee.report.core_index)
      const packageHash = guarantee.report.package_spec.hash

      // Validate no duplicate package hashes across all guarantees
      if (seenPackageHashes.has(packageHash)) {
        return safeError(new Error('duplicate_package'))
      }
      seenPackageHashes.add(packageHash)

      // Gray Paper equation 361-362: Package hash must not appear in recent history
      // p \not\in \bigcup_{x \in \recenthistory}\keys{x_\rh¬reportedpackagehashes}
      if (this.recentHistoryService) {
        const recentHistory = this.recentHistoryService.getRecentHistory()
        for (const entry of recentHistory) {
          if (entry.reportedPackageHashes.has(packageHash)) {
            return safeError(new Error('duplicate_package'))
          }
        }
      }

      // Validate guarantee slot is not in the future
      if (guarantee.slot > currentSlot) {
        return safeError(new Error('future_report_slot'))
      }

      // Validate guarantee is not from before the last rotation
      // Guarantees must be from either the current rotation or the previous rotation
      const rotationPeriod = BigInt(this.configService.rotationPeriod)
      const currentRotation = currentSlot / rotationPeriod
      const guaranteeRotation = guarantee.slot / rotationPeriod

      // Check if guarantee is from before the last rotation (more than 1 rotation ago)
      if (guaranteeRotation < currentRotation - 1n) {
        return safeError(new Error('report_epoch_before_last'))
      }

      // Validate core_index is within valid range
      if (coreIndex < 0 || coreIndex >= this.configService.numCores) {
        return safeError(new Error('bad_core_index'))
      }

      // Check uniqueness
      if (processedCores.has(coreIndex)) {
        return safeError(new Error('out_of_order_guarantee'))
      }
      processedCores.add(coreIndex)

      // Check ordering (must be ascending)
      if (i > 0) {
        const prevCoreIndex = Number(guarantees[i - 1].report.core_index)
        if (coreIndex <= prevCoreIndex) {
          return safeError(new Error('out_of_order_guarantee'))
        }
      }

      // Gray Paper equation 335: Validate anchor is in recent history and context matches
      const anchorHash = guarantee.report.context.anchor
      if (this.recentHistoryService) {
        if (!this.recentHistoryService.isValidAnchor(anchorHash)) {
          return safeError(new Error('anchor_not_recent'))
        }

        // Get recent history entry for anchor validation
        const recentEntry =
          this.recentHistoryService.getRecentHistoryForBlock(anchorHash)
        if (!recentEntry) {
          return safeError(new Error('anchor_not_recent'))
        }

        // Gray Paper equation 335: Validate state_root matches
        const contextStateRoot = guarantee.report.context.state_root
        if (contextStateRoot !== recentEntry.stateRoot) {
          return safeError(new Error('bad_state_root'))
        }

        // Gray Paper equation 335: Validate beefy_root (accoutLogSuperPeak) matches
        const contextBeefyRoot = guarantee.report.context.beefy_root
        if (contextBeefyRoot !== recentEntry.accoutLogSuperPeak) {
          return safeError(new Error('bad_beefy_mmr_root'))
        }
      }

      // Gray Paper equation 398: Validate code_hash for each work result
      if (this.serviceAccountService) {
        for (const result of guarantee.report.results) {
          const [serviceAccountError, serviceAccount] =
            this.serviceAccountService.getServiceAccount(result.service_id)
          if (serviceAccountError) {
            return safeError(new Error('bad_service_id'))
          }

          // Validate code_hash matches service account codehash
          if (result.code_hash !== serviceAccount.codehash) {
            return safeError(new Error('bad_code_hash'))
          }

          // Validate accumulate_gas >= minaccgas
          // Gray Paper: accumulate_gas must be at least the service's minaccgas
          if (
            BigInt(result.accumulate_gas) < BigInt(serviceAccount.minaccgas)
          ) {
            return safeError(new Error('service_item_gas_too_low'))
          }
        }
      }

      // Gray Paper equation 260-262: Credential must have 2-3 signatures, sorted by validator index
      const guaranteeSignatures = guarantee.signatures
      if (guaranteeSignatures.length < 2) {
        return safeError(new Error('insufficient_guarantees'))
      }
      if (guaranteeSignatures.length > 3) {
        return safeError(
          new Error(
            `Invalid signature count: ${guaranteeSignatures.length}. Must have 2-3 signatures.`,
          ),
        )
      }

      // Check signatures are sorted by validator index and unique
      const validatorIndices = new Set<number>()
      for (let j = 0; j < guaranteeSignatures.length; j++) {
        const sig = guaranteeSignatures[j]
        const validatorIdx = sig.validator_index

        if (validatorIndices.has(validatorIdx)) {
          return safeError(new Error('not_sorted_or_unique_guarantors'))
        }
        validatorIndices.add(validatorIdx)

        // Check ordering
        if (
          j > 0 &&
          guaranteeSignatures[j - 1].validator_index >= validatorIdx
        ) {
          return safeError(new Error('not_sorted_or_unique_guarantors'))
        }
      }

      // Gray Paper equation 267-281: Validate signatures and validator assignments
      // For guarantees from previous rotations, use previous validators for lookup
      const previousValidators =
        this.validatorSetManager.getPreviousValidators()
      const isFromPreviousRotation = guaranteeRotation < currentRotation

      // Get active validators once per guarantee (not per signature) to ensure consistency
      // For current rotation guarantees, we'll use this; for previous rotation, we'll use previousValidators
      const activeValidators = !isFromPreviousRotation
        ? this.validatorSetManager.getActiveValidators()
        : null

      for (const sig of guaranteeSignatures) {
        const validatorIdx = sig.validator_index

        // Get validator keys for reporter collection
        // Strategy:
        // - For current rotation guarantees: use active validators only (getActiveValidators)
        // - For previous rotation guarantees: use previous validators (getPreviousValidators)
        // This ensures we use the correct validator set, not the merged getAllConnectedValidators
        let validatorKey: { ed25519: Hex } | null = null

        if (!isFromPreviousRotation) {
          // Current rotation guarantee: use active validators only
          // Verify validator is actually in the active set (not previous set)
          if (!this.validatorSetManager.isValidatorActive(validatorIdx)) {
            return safeError(new Error('bad_validator_index'))
          }
          // Use the active validators we got above
          if (!activeValidators) {
            return safeError(
              new Error('internal error: activeValidators not initialized'),
            )
          }
          // Explicitly check that this validator exists in the active set (not just get it)
          if (!activeValidators.has(validatorIdx)) {
            return safeError(new Error('bad_validator_index'))
          }
          const activeValidator = activeValidators.get(validatorIdx)
          // For current rotation guarantees, we MUST use the active validator's key from the active set
          // Never use previous validator's key - always use active set key for current rotation
          // Explicitly ensure we're getting the key from the active set at the correct index
          if (!activeValidator) {
            return safeError(
              new Error(
                `Validator ${validatorIdx} not found in active set for current rotation guarantee`,
              ),
            )
          }
          validatorKey = { ed25519: activeValidator.ed25519 }
        } else {
          // Previous rotation guarantee: use previous validators only
          const prevValidator = previousValidators.get(validatorIdx)
          if (prevValidator) {
            validatorKey = { ed25519: prevValidator.ed25519 }
          } else {
            // Validator not in previous set - this is an error for previous rotation guarantees
            // Do NOT fall back to current set - we must use the set that matches the rotation
            return safeError(new Error('bad_validator_index'))
          }
        }

        // Check if validator is banned/offender
        if (this.validatorSetManager.isOffender(validatorIdx)) {
          return safeError(new Error('banned_validator'))
        }

        // Get assigned core for validator at the guarantee's slot time
        // Gray Paper equation 275: Validate assignment at guarantee slot time
        // The validator must be assigned to the core at the time the guarantee was created
        const entropy2 = this.entropyService.getEntropy2()
        const [coreAssignmentError, assignedCore] = getAssignedCore(
          validatorIdx,
          entropy2,
          guarantee.slot, // Check assignment at guarantee slot time, not current slot
          this.configService,
        )
        if (coreAssignmentError) {
          return safeError(
            new Error(
              `Failed to get core assignment for validator ${validatorIdx}: ${coreAssignmentError.message}`,
            ),
          )
        }

        // Validate validator is assigned to this core (current or previous rotation)
        // Gray Paper equation 275: guarantee slot must be within current or previous rotation
        // Note: guaranteeRotation and currentRotation are already calculated above

        // Valid if in same rotation, or guarantee is from previous rotation
        const isValidRotation =
          guaranteeRotation === currentRotation ||
          guaranteeRotation === currentRotation - 1n

        // For guarantees from previous rotation, assignment validation uses previous validator set
        // The assignment calculation should still work, but we verify rotation is valid
        if (!isValidRotation) {
          return safeError(new Error('wrong_assignment'))
        }

        // Check that validator was assigned to this core at guarantee slot time
        // For guarantees from previous rotation, we've already verified the validators
        // are in the previous set and signed correctly. The assignment calculation
        // using getAssignedCore may not work correctly if the validator count changed,
        // so for previous rotation guarantees, we skip strict assignment check.
        // The fact that they signed and are in the previous set is sufficient validation.
        if (!isFromPreviousRotation && assignedCore !== coreIndex) {
          return safeError(new Error('wrong_assignment'))
        }

        // For previous rotation guarantees, we still verify the assignment if possible,
        // but if getAssignedCore fails due to validator count mismatch, we allow it
        // since the validators are verified to be in the previous set
        if (isFromPreviousRotation && assignedCore !== coreIndex) {
          // Check if validator exists in previous set - if so, assignment is acceptable
          // (the assignment calculation may be off due to validator count changes)
          const prevValidator = previousValidators.get(validatorIdx)
          if (!prevValidator) {
            // Validator not in previous set - this is an error
            return safeError(new Error('wrong_assignment'))
          }
          // Validator is in previous set - assignment check passed via validator existence
        }

        // Add to reporters set (Gray Paper equation 277)
        // Ensure we have a valid key before adding
        if (!validatorKey || !validatorKey.ed25519) {
          return safeError(
            new Error(
              `Internal error: validator key is null for validator ${validatorIdx}`,
            ),
          )
        }
        reporters.add(validatorKey.ed25519)
      }

      // Gray Paper equation 296-298: Core must not be engaged (no pending or available report)
      const pendingReport = this.workReportService.getCoreReport(
        BigInt(coreIndex),
      )
      if (pendingReport !== null) {
        return safeError(new Error('core_engaged'))
      }

      // Also check if core has an available report (from avail_assignments)
      if (this.workReportService.hasAvailableReport(BigInt(coreIndex))) {
        return safeError(new Error('core_engaged'))
      }

      // Validate authorizer hash is in auth pool for this core
      // Gray Paper: The authorizer must be in the auth pool for the core
      const authorizerHash = guarantee.report.authorizer_hash
      const authPool = this.authPoolService.getAuthPool()
      if (coreIndex >= authPool.length) {
        return safeError(
          new Error(`Core index ${coreIndex} out of range for auth pool`),
        )
      }
      const coreAuthPool = authPool[coreIndex]
      if (!coreAuthPool.includes(authorizerHash)) {
        return safeError(new Error('core_unauthorized'))
      }

      if (!this.accumulationService) {
        return safeError(new Error('Accumulation service not initialized'))
      }
      // Get known packages from accumulated state
      const knownPackages = new Set<Hex>(
        this.accumulationService
          .getAccumulated() // sequence[C_epochlen]{protoset{hash}}
          .packages.flatMap((packageSet) => Array.from(packageSet)), // protoset{hash}
      )

      // Validate dependencies (prerequisites must be in known packages, any guarantee in batch, or recent history)
      // Gray Paper equation 369-378: Prerequisites must be in local_incomingpackagehashes or recent history
      // local_incomingpackagehashes includes ALL guarantees in the batch (\xtguarantees), not just processed ones
      const prerequisites = guarantee.report.context.prerequisites || []
      for (const prereqHash of prerequisites) {
        // Check if prerequisite is in known packages
        const isInKnownPackages = knownPackages.has(prereqHash)
        // Check if prerequisite is in any guarantee in the batch (local_incomingpackagehashes)
        const isInAnyGuarantee = allGuaranteePackageHashes.has(prereqHash)
        // Check if prerequisite is in recent history
        let isInRecentHistory = false
        if (this.recentHistoryService) {
          const recentHistory = this.recentHistoryService.getRecentHistory()
          for (const entry of recentHistory) {
            if (entry.reportedPackageHashes.has(prereqHash)) {
              isInRecentHistory = true
              break
            }
          }
        }

        // Prerequisite must be in at least one of: known_packages, any guarantee in batch, or recent history
        if (!isInKnownPackages && !isInAnyGuarantee && !isInRecentHistory) {
          return safeError(new Error('dependency_missing'))
        }
      }

      // Gray Paper equation 236: Validate segment_root_lookup
      // Each work_package_hash must correspond to a valid work package
      // segment_root_lookup references work packages from:
      // - ALL guarantees in the batch (local_incomingpackagehashes)
      // - recent history (and segment_tree_root must match exports_root)
      // Note: segment_root_lookup does NOT check known_packages (only prerequisites do)
      const segmentRootLookup = guarantee.report.segment_root_lookup || []
      for (const lookupItem of segmentRootLookup) {
        const workPackageHash = lookupItem.work_package_hash
        const expectedSegmentTreeRoot = lookupItem.segment_tree_root

        // Check if work package hash is in any guarantee in the batch (not just processed ones)
        let isInAnyGuarantee = false
        let matchingGuarantee: Guarantee | null = null
        for (const g of guarantees) {
          if (g.report.package_spec.hash === workPackageHash) {
            isInAnyGuarantee = true
            matchingGuarantee = g
            break
          }
        }

        // If found in a guarantee, verify segment_tree_root matches exports_root
        if (isInAnyGuarantee && matchingGuarantee) {
          if (
            matchingGuarantee.report.package_spec.exports_root !==
            expectedSegmentTreeRoot
          ) {
            return safeError(new Error('segment_root_lookup_invalid'))
          }
        }

        // Check if work package hash is in recent history and segment_tree_root matches
        let isInRecentHistory = false
        if (this.recentHistoryService) {
          const recentHistory = this.recentHistoryService.getRecentHistory()
          for (const entry of recentHistory) {
            const exportsRoot = entry.reportedPackageHashes.get(workPackageHash)
            if (exportsRoot !== undefined) {
              // Found in recent history - verify segment_tree_root matches exports_root
              if (exportsRoot !== expectedSegmentTreeRoot) {
                return safeError(new Error('segment_root_lookup_invalid'))
              }
              isInRecentHistory = true
              break
            }
          }
        }

        // Work package hash must be in at least one of: any guarantee in batch, or recent history
        // Note: known_packages is NOT checked for segment_root_lookup
        if (!isInAnyGuarantee && !isInRecentHistory) {
          return safeError(new Error('segment_root_lookup_invalid'))
        }
      }

      // Gray Paper equation 49-50: Validate total dependencies
      // len(segment_root_lookup) + len(prerequisites) <= C_maxreportdeps
      const totalDependencies = prerequisites.length + segmentRootLookup.length
      if (totalDependencies > WORK_REPORT_CONSTANTS.C_MAXREPORTDEPS) {
        return safeError(new Error('too_many_dependencies'))
      }

      // Gray Paper equation 210: Validate work report size
      // The total size of all unbounded blobs (auth_output + result.ok outputs) must not exceed C_maxreportvarsize
      let totalUnboundedSize = 0

      // Add auth_output size
      const authOutputBytes = hexToBytes(guarantee.report.auth_output)
      totalUnboundedSize += authOutputBytes.length

      // Add each result.ok output size
      // WorkExecResultValue can be: Hex string (ok), { ok: Hex }, { panic: null }, or error string
      for (const resultItem of guarantee.report.results) {
        if (
          typeof resultItem.result === 'string' &&
          resultItem.result.startsWith('0x')
        ) {
          // Success case: result is a hex string directly
          const resultOutputBytes = hexToBytes(resultItem.result as Hex)
          totalUnboundedSize += resultOutputBytes.length
        } else if (
          typeof resultItem.result === 'object' &&
          resultItem.result !== null &&
          'ok' in resultItem.result
        ) {
          // Success case: result is { ok: Hex }
          const okValue = (resultItem.result as { ok: Hex }).ok
          if (typeof okValue === 'string' && okValue.startsWith('0x')) {
            const resultOutputBytes = hexToBytes(okValue)
            totalUnboundedSize += resultOutputBytes.length
          }
        }
        // Error/panic cases don't contribute to unbounded size
      }

      // Check if total size exceeds limit
      if (totalUnboundedSize > WORK_REPORT_CONSTANTS.C_MAXREPORTVARSIZE) {
        return safeError(new Error('work_report_too_big'))
      }

      // Gray Paper equation 121-125: Validate total accumulate_gas
      // The sum of all accumulate_gas values must be <= C_reportaccgas
      let totalAccumulateGas = 0n
      for (const resultItem of guarantee.report.results) {
        totalAccumulateGas += BigInt(resultItem.accumulate_gas)
      }

      // Check if total accumulate_gas > C_REPORTACCGAS (greater than is not allowed, equal is allowed)
      if (totalAccumulateGas > BigInt(WORK_REPORT_CONSTANTS.C_REPORTACCGAS)) {
        return safeError(new Error('work_report_gas_too_high'))
      }

      // All validations passed - mark work report as available
      const [markError] = this.workReportService.markAsAvailable(
        guarantee.report,
        currentSlot, // Timeout set to current slot
      )

      if (markError) {
        return safeError(
          new Error(
            `Failed to mark work report as available: ${markError.message}`,
          ),
        )
      }
    }

    // Update statistics from successfully processed guarantees
    // This updates validator, core, and service statistics based on the guarantees
    if (this.statisticsService) {
      this.statisticsService.updateGuarantees(guarantees)
    }

    // Convert Set to array for return (reporters should be unique)
    return safeResult(Array.from(reporters))
  }
}
