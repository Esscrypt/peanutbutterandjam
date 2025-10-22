// /**
//  * Guarantor Service
//  *
//  * Gray Paper Reference: guaranteeing.tex
//  *
//  * Implements the guarantor role for JAM validators. Guarantors are responsible for:
//  * 1. Determining which core they are assigned to
//  * 2. Evaluating work-packages for their assigned core
//  * 3. Computing work-reports from work-packages
//  * 4. Signing and distributing work-reports
//  * 5. Creating guarantee extrinsics for block inclusion
//  *
//  * Core Assignment Algorithm (Gray Paper Equation 212-218):
//  * - Uses Fisher-Yates shuffle with epochal entropy (entropy_2)
//  * - Rotates assignments every C_rotationperiod slots
//  * - Each core has exactly 3 validators assigned (1023 validators / 341 cores = 3)
//  * - Assignment is deterministic based on: entropy_2, thetime, and validator index
//  */

// import {
//   bytesToHex,
//   type EventBusService,
//   hexToBytes,
//   logger,
//   type Safe,
//   type SafePromise,
//   safeError,
//   safeResult,
// } from '@pbnj/core'
// import {
//   createGuaranteeSignature,
//   getCoGuarantors as getCoGuarantorsHelper,
//   sortGuaranteeSignatures,
//   verifyWorkReportDistributionSignature,
// } from '@pbnj/guarantor'
// import type { CE134WorkPackageSharingProtocol } from '@pbnj/networking'
// import { calculateWorkPackageHash } from '@pbnj/serialization'
// import type {
//   Guarantee,
//   GuaranteeSignature,
//   IClockService,
//   IConfigService,
//   IEntropyService,
//   IGuarantorService,
//   StreamKind,
//   ValidatorPublicKeys,
//   WorkPackage,
//   WorkPackageSharing,
//   WorkPackageSharingResponse,
//   WorkReport,
// } from '@pbnj/types'
// import { BaseService } from '@pbnj/types'
// import type { Hex } from 'viem'
// import type { AuthPoolService } from './auth-pool-service'
// import type { ClockService } from './clock-service'
// import type { ConfigService } from './config-service'
// import type { EntropyService } from './entropy'
// import type { ErasureCodingService } from './erasure-coding-service'
// import type { KeyPairService } from './keypair-service'
// import type { NetworkingService } from './networking-service'
// import type { ShardService } from './shard-service'
// import type { ValidatorSetManager } from './validator-set'
// import type { WorkReportService } from './work-report-service'

// /**
//  * Guarantor Service Implementation
//  *
//  * Barebones implementation of the guarantor role
//  */
// export class GuarantorService extends BaseService implements IGuarantorService {
//   private readonly configService: IConfigService
//   private readonly clockService: IClockService
//   private readonly entropyService: IEntropyService
//   private readonly erasureCodingService: ErasureCodingService
//   // Map of timeslot to map of validator index to number of signatures
//   private readonly validatorSignaturesForTimeslot: Map<
//     bigint,
//     Map<number, number>
//   > = new Map()

//   private readonly authPoolService: AuthPoolService
//   private readonly networkService: NetworkingService
//   private readonly ce134WorkPackageSharingProtocol: CE134WorkPackageSharingProtocol
//   private readonly keyPairService: KeyPairService
//   private readonly workReportService: WorkReportService
//   private readonly eventBusService: EventBusService
//   private readonly validatorSetManager: ValidatorSetManager
//   private readonly shardService: ShardService
//   private validatorIndex = 0

//   constructor(options: {
//     configService: ConfigService
//     clockService: ClockService
//     entropyService: EntropyService
//     authPoolService: AuthPoolService
//     networkService: NetworkingService
//     ce134WorkPackageSharingProtocol: CE134WorkPackageSharingProtocol
//     keyPairService: KeyPairService
//     workReportService: WorkReportService
//     eventBusService: EventBusService
//     validatorSetManager: ValidatorSetManager
//     erasureCodingService: ErasureCodingService
//     shardService: ShardService
//   }) {
//     super('guarantor-service')
//     this.configService = options.configService
//     this.clockService = options.clockService
//     this.entropyService = options.entropyService
//     this.authPoolService = options.authPoolService
//     this.networkService = options.networkService
//     this.ce134WorkPackageSharingProtocol =
//       options.ce134WorkPackageSharingProtocol
//     this.workReportService = options.workReportService
//     this.eventBusService = options.eventBusService
//     this.validatorSetManager = options.validatorSetManager
//     this.erasureCodingService = options.erasureCodingService
//     this.shardService = options.shardService
//     // Register event handlers
//     this.eventBusService.addWorkPackageSubmissionReceivedCallback(
//       this.handleWorkPackageSubmission.bind(this),
//     )
//     this.eventBusService.addWorkPackageSharingCallback(
//       this.handleWorkPackageSharing.bind(this),
//     )
//     this.eventBusService.addWorkPackageSharingResponseCallback(
//       this.handleCoGuarantorSignature.bind(this),
//     )
//     this.keyPairService = options.keyPairService
//   }

//   start(): Safe<boolean> | SafePromise<boolean> {
//     const publicKey =
//       this.keyPairService.getLocalKeyPair().ed25519KeyPair.publicKey
//     const [validatorIndexError, validatorIndex] =
//       this.validatorSetManager.getValidatorIndex(bytesToHex(publicKey))
//     if (validatorIndexError) {
//       return safeError(validatorIndexError)
//     }
//     this.validatorIndex = validatorIndex
//     return safeResult(true)
//   }

//   /**
//    * Evaluate work-package authorization
//    */
//   evaluateAuthorization(
//     workPackage: WorkPackage,
//     coreIndex: number,
//   ): Safe<boolean> {
//     try {
//       // TODO: Step 1: Extract authorization hash from work-package
//       const authHash = workPackage.authCodeHash

//       // TODO: Step 2: Get authorization pool from state
//       const authPool = this.authPoolService.getAuthPool()

//       // TODO: Step 3: Check if auth hash exists in pool for core
//       const isAuthorized = authPool[coreIndex].includes(authHash)

//       if (!isAuthorized) {
//         return safeError(new Error('Work package not authorized'))
//       }

//       // TODO: Step 4: Verify context validity
//       // - Check anchor block exists
//       // - Check prerequisites are met
//       // - Check timeslot is valid

//       // TODO: Step 5: Return authorization status

//       // Placeholder: Always return false (not implemented)
//       return safeResult(false)
//     } catch (error) {
//       return safeError(error as Error)
//     }
//   }

//   /**
//    * Compute work-report from work-package
//    */
//   computeWorkReport(
//     _workPackage: WorkPackage,
//     _coreIndex: number,
//   ): Safe<WorkReport> {
//     try {
//       // TODO: Step 1: Verify authorization first (avoid wasted work)
//       // const [authError, isAuthorized] = this.evaluateAuthorization(workPackage, coreIndex)
//       // if (authError || !isAuthorized) return error

//       // TODO: Step 2: Execute Ψ_R (Refine) function
//       // const [refineError, refineResult] = refineInvocation(workPackage, coreIndex)

//       // TODO: Step 3: For each work-item:
//       // - Load service code from state
//       // - Execute PVM with work-item payload
//       // - Collect execution results and gas usage

//       // TODO: Step 4: Aggregate all work-item results

//       // TODO: Step 5: Calculate work-package hash and segment root

//       // TODO: Step 6: Create work-report structure

//       // Placeholder: Return error (not implemented)
//       return safeError(new Error('Work-report computation not implemented'))
//     } catch (error) {
//       return safeError(error as Error)
//     }
//   }

//   /**
//    * Distribute work-package to co-guarantors
//    */
//   distributeToCoGuarantors(
//     workPackage: WorkPackage,
//     coreIndex: number,
//   ): Safe<GuaranteeSignature[]> {
//     try {
//       // TODO: Step 1: Get co-guarantors for this core
//       const [coGuarantorsError, coGuarantors] = this.getCoGuarantors(
//         coreIndex,
//         this.validatorIndex,
//       )

//       if (coGuarantorsError) {
//         return safeError(coGuarantorsError)
//       }

//       for (const coGuarantor of coGuarantors) {
//         const [messageError, message] =
//           this.ce134WorkPackageSharingProtocol.serializeRequest({
//             coreIndex: BigInt(coreIndex),
//             workPackageBundle: workPackage,
//             segmentsRootMappings: [], // TODO: Implement segments root mappings
//           })
//         if (messageError) {
//           return safeError(messageError)
//         }
//         this.networkService.sendMessage(
//           BigInt(coGuarantor),
//           134 as StreamKind,
//           message,
//         )
//       }

//       // Placeholder: Return empty array (not implemented)
//       return safeResult([])
//     } catch (error) {
//       return safeError(error as Error)
//     }
//   }

//   /**
//    * Perform erasure coding on work-package and trigger shard distribution
//    */
//   async performErasureCoding(
//     workPackage: WorkPackage,
//     exportedSegments: Uint8Array[],
//     extrinsicData: Uint8Array[],
//     importedSegments: Uint8Array[],
//     coreIndex: bigint,
//   ): SafePromise<void> {
//     // Trigger shard distribution through shard service
//     const [shardError] =
//       await this.shardService.generateAndDistributeWorkPackageShards(
//         workPackage,
//         exportedSegments,
//         importedSegments,
//         coreIndex,
//       )
//     if (shardError) {
//       logger.error('Failed to generate and distribute shards', {
//         error: shardError.message,
//         coreIndex: coreIndex.toString(),
//       })
//       return safeError(shardError)
//     }

//     return safeResult(undefined)
//   }

//   /**
//    * Create guarantee extrinsic
//    */
//   createGuarantee(
//     workReport: WorkReport,
//     signatures: GuaranteeSignature[],
//     timeslot: bigint,
//     coreAssignments: Map<number, number>,
//     validatorKeys: Map<number, ValidatorPublicKeys>,
//   ): Safe<Guarantee> {
//     try {
//       // Step 1 & 2: Sort signatures by validator index
//       // This also ensures they're in the correct order per Gray Paper
//       const sortedSignatures = sortGuaranteeSignatures(signatures)

//       // Steps 3-5: Validate all signatures
//       // This validates:
//       // - Signature count (2-3)
//       // - Unique validators
//       // - Correct ordering
//       // - Validators assigned to core
//       // - Cryptographic validity
//       const [validateError, validationResult] =
//         verifyWorkReportDistributionSignature(
//           workReport,
//           sortedSignatures,
//           coreAssignments,
//         )

//       // Step 6: Create guarantee tuple
//       const guarantee: Guarantee = {
//         work_report: workReport,
//         timeslot,
//         credential: sortedSignatures,
//       }

//       return safeResult(guarantee)
//     } catch (error) {
//       return safeError(error as Error)
//     }
//   }

//   /**
//    * Send guarantee to block author
//    */
//   sendToBlockAuthor(guarantee: Guarantee): Safe<void> {
//     try {
//       // TODO: Step 1: Get current block author from Safrole state
//       // TODO: Step 2: Package guarantee into network message
//       // TODO: Step 3: Send to block author
//       // TODO: Step 4: Track inclusion status
//       // TODO: Step 5: Resend if not included within timeout

//       // Placeholder: Return error (not implemented)
//       return safeError(new Error('Send to block author not implemented'))
//     } catch (error) {
//       return safeError(error as Error)
//     }
//   }

//   /**
//    * Get co-guarantors for a core
//    */
//   getCoGuarantors(
//     coreIndex: number,
//     currentValidatorIndex: number,
//   ): Safe<number[]> {
//     try {
//       // Get values from services
//       const entropy2 = this.entropyService.getEntropy2()
//       const currentSlot = this.clockService.getCurrentSlot()
//       const config = {
//         numValidators: this.configService.numValidators,
//         numCores: this.configService.numCores,
//         epochDuration: this.configService.epochDuration,
//         rotationPeriod: this.configService.rotationPeriod,
//       }

//       // Use the guarantor package helper function
//       return getCoGuarantorsHelper(
//         coreIndex,
//         currentValidatorIndex,
//         entropy2,
//         currentSlot,
//         config,
//       )
//     } catch (error) {
//       return safeError(error as Error)
//     }
//   }

//   /**
//    * Distribute Guaranteed Work Report to Validators (CE135)
//    *
//    * Gray Paper Reference: guaranteeing.tex, JAMNP-S CE135
//    *
//    * Called after collecting 2-3 signatures from co-guarantors.
//    * Distributes the guaranteed work-report to all relevant validators.
//    *
//    * TIMING REQUIREMENTS:
//    * - After getting 2 signatures, wait ~2 seconds for potential 3rd signature
//    * - Avoid distributing work-reports that cannot be included in next block
//    * - Don't distribute reports with slots too far in past/future
//    *
//    * DISTRIBUTION TARGETS:
//    * - All current epoch validators (always)
//    * - All next epoch validators (only during last core rotation of epoch)
//    * - Note: These validator sets likely overlap
//    *
//    * STRUCTURE:
//    * GuaranteedWorkReport = WorkReport ++ Slot ++ len++[ValidatorIndex ++ Ed25519Signature]
//    *
//    * @param workReport - The work report to distribute
//    * @param signatures - Guarantee signatures (2-3 signatures, sorted by validator index)
//    * @param slot - Current timeslot
//    */
//   private async distributeGuaranteedWorkReport(
//     workReport: WorkReport,
//     signatures: GuaranteeSignature[],
//     slot: bigint,
//   ): Promise<Safe<void>> {
//     try {
//       // ═══════════════════════════════════════════════════════════════════
//       // STEP 1: Validate Prerequisites
//       // ═══════════════════════════════════════════════════════════════════
//       // Ensure we have 2-3 signatures (Gray Paper requirement)
//       if (signatures.length < 2 || signatures.length > 3) {
//         return safeError(
//           new Error(
//             `Invalid signature count: ${signatures.length}. Must have 2-3 signatures.`,
//           ),
//         )
//       }

//       // Sort signatures by validator index (Gray Paper requirement)
//       const sortedSignatures = sortGuaranteeSignatures(signatures)

//       // ═══════════════════════════════════════════════════════════════════
//       // STEP 2: Check Slot Validity
//       // ═══════════════════════════════════════════════════════════════════
//       // Don't distribute work-reports that cannot be included in next block
//       const currentSlot = this.clockService.getCurrentSlot()
//       const slotDifference = currentSlot > slot ? currentSlot - slot : 0n
//       const MAX_PAST_SLOTS = 10n // Don't distribute stale reports
//       const MAX_FUTURE_SLOTS = 2n // Don't distribute reports too far ahead

//       if (slotDifference > MAX_PAST_SLOTS) {
//         return safeError(
//           new Error(
//             `Work-report slot ${slot} too far in past (current: ${currentSlot})`,
//           ),
//         )
//       }
//       if (slot - currentSlot > MAX_FUTURE_SLOTS) {
//         return safeError(
//           new Error(
//             `Work-report slot ${slot} too far in future (current: ${currentSlot})`,
//           ),
//         )
//       }

//       // ═══════════════════════════════════════════════════════════════════
//       // STEP 3: Determine Distribution Targets
//       // ═══════════════════════════════════════════════════════════════════
//       // Get current epoch validators (always distribute to these)
//       // TODO: Get from ValidatorSetManager when available
//       // For now, use a placeholder - distribute to all validators
//       const currentValidators: number[] = []
//       // currentValidators = this.validatorSetManager.getActiveValidators().map((_, i) => i)

//       // Check if we're in the last core rotation of the epoch
//       const isLastRotation = this.isLastCoreRotationOfEpoch()

//       // If last rotation, also get next epoch validators
//       const nextValidators: number[] = []
//       if (isLastRotation) {
//         // nextValidators = this.validatorSetManager.getStagingValidators().map((_, i) => i)
//       }

//       // Combine and deduplicate validators (sets likely overlap)
//       const allValidators = new Set([...currentValidators, ...nextValidators])

//       // ═══════════════════════════════════════════════════════════════════
//       // STEP 4: Create GuaranteedWorkReport Structure
//       // ═══════════════════════════════════════════════════════════════════
//       // Structure per JAMNP-S CE135:
//       // WorkReport ++ Slot ++ len++[ValidatorIndex ++ Ed25519Signature]
//       const _guaranteedWorkReport = {
//         workReport,
//         slot,
//         signatures: sortedSignatures,
//       }

//       // ═══════════════════════════════════════════════════════════════════
//       // STEP 5: Distribute via CE135 Protocol
//       // ═══════════════════════════════════════════════════════════════════
//       // TODO: Use CE135WorkReportDistributionProtocol to send to all validators
//       // This will be implemented once we have:
//       // - CE135Protocol instance in constructor
//       // - ValidatorSetManager for getting validator list
//       //
//       // for (const validatorIndex of allValidators) {
//       //   if (validatorIndex === this.validatorIndex) {
//       //     continue // Don't send to ourselves
//       //   }
//       //
//       //   try {
//       //     await this.networkService.sendToValidator(
//       //       validatorIndex,
//       //       'CE135',
//       //       guaranteedWorkReport,
//       //     )
//       //   } catch (error) {
//       //     // Continue distributing to other validators even if one fails
//       //     // Log warning but don't fail the entire distribution
//       //   }
//       // }

//       // Placeholder: At least log the distribution intent
//       if (allValidators.size > 0) {
//         // Distribution will happen here
//       }

//       // ═══════════════════════════════════════════════════════════════════
//       // STEP 6: Store Locally & Create Guarantee Extrinsic
//       // ═══════════════════════════════════════════════════════════════════
//       // Store in WorkReportService for local processing
//       await this.workReportService.storeGuaranteedWorkReport(
//         workReport,
//         workReport.core_index,
//       )

//       // Create Guarantee extrinsic structure for block inclusion
//       // Gray Paper Equation 251-258: Guarantee structure
//       const _guarantee: Guarantee = {
//         report: workReport,
//         slot,
//         credential: sortedSignatures,
//       }

//       // TODO: Add to pending guarantees queue for block authors
//       // This queue will be read by block authoring service
//       // await this.guaranteeQueue.add(guarantee)

//       return safeResult(undefined)
//     } catch (error) {
//       return safeError(
//         error instanceof Error ? error : new Error(String(error)),
//       )
//     }
//   }

//   /**
//    * Check if we're in the last core rotation of the current epoch
//    *
//    * Gray Paper Reference: safrole.tex
//    *
//    * - C_rotationperiod slots per rotation
//    * - C_epochlen slots per epoch
//    * - Last rotation starts at: epoch_start + (num_rotations - 1) * C_rotationperiod
//    */
//   private isLastCoreRotationOfEpoch(): boolean {
//     const currentSlot = this.clockService.getCurrentSlot()
//     const C_EPOCHLEN = this.configService.epochDuration
//     const C_ROTATIONPERIOD = this.configService.rotationPeriod

//     const slotInEpoch = Number(currentSlot % BigInt(C_EPOCHLEN))
//     const numRotations = Math.floor(
//       Number(C_EPOCHLEN) / Number(C_ROTATIONPERIOD),
//     )
//     const lastRotationStart = (numRotations - 1) * Number(C_ROTATIONPERIOD)

//     return slotInEpoch >= lastRotationStart
//   }

//   /**
//    * Handle Work Package Submission from Builder (CE133)
//    *
//    * Gray Paper Reference: guaranteeing.tex (Section 12), work_packages_and_reports.tex
//    *
//    * Called when a builder submits a work-package via CE133 protocol.
//    * This is the primary entry point for guarantors to evaluate work packages.
//    *
//    * COMPLETE WORKFLOW:
//    *
//    * ═══════════════════════════════════════════════════════════════════════
//    * STEP 1: Verify Assignment & Anti-Spam
//    * ═══════════════════════════════════════════════════════════════════════
//    * - Check if we are assigned to the target core (getAssignedCore)
//    * - Gray Paper Equations 210-218: Core assignment via Fisher-Yates shuffle
//    * - Check if we can sign (max 2 signatures per timeslot) (canSignWorkReport)
//    * - Gray Paper: Anti-spam measure to prevent validator overload
//    *
//    * ═══════════════════════════════════════════════════════════════════════
//    * STEP 2: Authorization Validation
//    * ═══════════════════════════════════════════════════════════════════════
//    * - Compute authorizer hash: blake{authcodehash ∥ authconfig}
//    * - Check if authorizer is in auth pool for this core
//    * - Service: AuthPoolService.getAuthPool()
//    * - Gray Paper Equations 154-159: Authorization validation
//    *
//    * ═══════════════════════════════════════════════════════════════════════
//    * STEP 3: Work Package Evaluation (Refine Invocation)
//    * ═══════════════════════════════════════════════════════════════════════
//    * - Execute Refine (Ψ_R) function on each work item
//    * - Input: work-package, extrinsic data, imported segments
//    * - Gray Paper Equations 186-241: Refine execution in PVM
//    * - Output: work results, gas used, exported segments
//    * - TODO: Service needed: IPVMService.executeRefine()
//    * - TODO: Fetch imported segments from availability system
//    *
//    * ═══════════════════════════════════════════════════════════════════════
//    * STEP 4: Compute Work Report
//    * ═══════════════════════════════════════════════════════════════════════
//    * - Construct work-report from refine results
//    * - Gray Paper Equations 185-241: Work-report structure
//    * - Includes:
//    *   • context (anchor, state_root, beefy_root, etc.)
//    *   • authorization trace & gas used
//    *   • work item digests
//    *   • segments-root (merklecd of exported segments)
//    *   • package specification (hash, length, erasure_root, exports_root)
//    * - TODO: Service needed: IWorkReportComputationService.computeReport()
//    *
//    * ═══════════════════════════════════════════════════════════════════════
//    * STEP 5: Erasure Coding & Distribution
//    * ═══════════════════════════════════════════════════════════════════════
//    * - Erasure code the audit bundle (work-package + extrinsics + imports)
//    * - Gray Paper Section 12.2: Reed-Solomon on GF(2^16)
//    * - 684-byte pieces, 1023 validators, 342-of-1023 reconstruction
//    * - Create two data sets:
//    *   A) Audit bundle (short-term, until finality)
//    *   B) Export segments + paged proofs (long-term, 28 days minimum)
//    * - TODO: Service needed: IErasureCodingService.encodeWorkPackage()
//    * - TODO: Distribute chunks to validators via JAMNP-S protocols
//    *
//    * ═══════════════════════════════════════════════════════════════════════
//    * STEP 6: Store & Sign Work Report
//    * ═══════════════════════════════════════════════════════════════════════
//    * - Store work-report in WorkReportService
//    * - Service: WorkReportService.storeGuaranteedWorkReport()
//    * - Sign using Ed25519 key (createGuaranteeSignature)
//    * - Record signature in history (recordSignature)
//    * - Gray Paper Equation 265: Guarantee signature on blake{encode{work-report}}
//    *
//    * ═══════════════════════════════════════════════════════════════════════
//    * STEP 7: Share with Co-Guarantors (CE134)
//    * ═══════════════════════════════════════════════════════════════════════
//    * - Get co-guarantors for this core (getCoGuarantors)
//    * - Each core has 3 validators, we need 2-3 signatures total
//    * - Share work-package + segments-root mappings via CE134 protocol
//    * - Service: CE134WorkPackageSharingProtocol.shareWorkPackage()
//    * - Wait for signature responses from co-guarantors
//    *
//    * ═══════════════════════════════════════════════════════════════════════
//    * STEP 8: Create Guarantee Extrinsic
//    * ═══════════════════════════════════════════════════════════════════════
//    * - Once we have 2-3 signatures total, create Guarantee extrinsic
//    * - Sort signatures by validator index (sortGuaranteeSignatures)
//    * - Gray Paper Equation 251-258: Guarantee structure
//    * - Add to pending guarantees for block inclusion
//    * - Guarantees are included in block extrinsics (xt_guarantees)
//    *
//    * @param data - Work package submission from builder (coreIndex, workPackage, extrinsics)
//    */
//   private async handleWorkPackageSubmission(data: {
//     coreIndex: bigint
//     workPackage: WorkPackage
//     extrinsics: Uint8Array
//     peerId?: Uint8Array
//   }): Promise<Safe<void>> {
//     // ═══════════════════════════════════════════════════════════════════
//     // STEP 1: Verify Assignment & Anti-Spam
//     // ═══════════════════════════════════════════════════════════════════
//     const [coreError, assignedCore] = this.validatorSetManager.getAssignedCore(
//       this.validatorIndex,
//     )
//     if (coreError) {
//       return safeError(coreError)
//     }

//     if (assignedCore !== Number(data.coreIndex)) {
//       return safeError(
//         new Error(
//           `Not assigned to core ${data.coreIndex}, assigned to core ${assignedCore}`,
//         ),
//       )
//     }

//     // Check anti-spam limit (max 2 signatures per timeslot)
//     const currentSlot = this.clockService.getCurrentSlot()
//     const validatorSignatures =
//       this.validatorSignaturesForTimeslot
//         .get(currentSlot)
//         ?.get(this.validatorIndex) ?? 0
//     if (validatorSignatures && validatorSignatures > 2) {
//       return safeError(
//         new Error(
//           `Cannot sign work report: already signed 2 reports this timeslot`,
//         ),
//       )
//     }

//     // ═══════════════════════════════════════════════════════════════════
//     // STEP 2: Authorization Validation
//     // ═══════════════════════════════════════════════════════════════════
//     // TODO: Compute authorizer hash: blake{authcodehash ∥ authconfig}
//     // const authorizerHash = blake2bHash(
//     //   concatBytes([
//     //     hexToBytes(workPackage.authCodeHash),
//     //     hexToBytes(workPackage.authConfig),
//     //   ])
//     // )
//     //
//     // TODO: Check if authorizer is in auth pool for this core
//     // const authPool = this.authPoolService.getAuthPool()
//     // const coreAuthorizers = authPool[Number(data.coreIndex)]
//     // if (!coreAuthorizers || !coreAuthorizers.includes(authorizerHash)) {
//     //   return safeError(new Error('Authorizer not in auth pool for this core'))
//     // }

//     // ═══════════════════════════════════════════════════════════════════
//     // STEP 3: Work Package Evaluation (Refine Invocation)
//     // ═══════════════════════════════════════════════════════════════════
//     // TODO: Execute Refine (Ψ_R) function on each work item
//     // Service needed: IPVMService
//     //
//     // const [refineError, refineResult] = await this.pvmService.executeRefine({
//     //   workPackage,
//     //   extrinsics: data.extrinsics,
//     //   importedSegments: await this.fetchImportedSegments(workPackage.workItems),
//     //   context: workPackage.context,
//     // })
//     // if (refineError) {
//     //   return safeError(new Error(`Refine execution failed: ${refineError.message}`))
//     // }

//     // ═══════════════════════════════════════════════════════════════════
//     // STEP 4: Compute Work Report
//     // ═══════════════════════════════════════════════════════════════════
//     // TODO: Construct work-report from refine results
//     // Service needed: IWorkReportComputationService
//     //
//     // const [reportError, workReport] = this.workReportComputationService.computeReport({
//     //   workPackage,
//     //   refineResult,
//     //   coreIndex: data.coreIndex,
//     //   authorizationTrace: refineResult.authTrace,
//     //   authorizationGasUsed: refineResult.authGasUsed,
//     //   segmentsRoot: merklizecd(refineResult.exportSegments),
//     //   packageSpec: {
//     //     hash: calculateWorkPackageHash(workPackage),
//     //     length: encodeWorkPackage(workPackage).length,
//     //     erasure_root: ..., // Computed in step 5
//     //     exports_root: merklizecd(refineResult.exportSegments),
//     //     exports_count: refineResult.exportSegments.length,
//     //   },
//     // })
//     // if (reportError) {
//     //   return safeError(new Error(`Work report computation failed: ${reportError.message}`))
//     // }

//     // ═══════════════════════════════════════════════════════════════════
//     // STEP 5: Erasure Coding & Distribution
//     // ═══════════════════════════════════════════════════════════════════
//     // TODO: Erasure code the audit bundle and export segments
//     // Service needed: IErasureCodingService
//     //
//     // Gray Paper Section 12.2: 684-byte pieces, 1023 validators, Reed-Solomon on GF(2^16)
//     //
//     // const [erasureError, { auditChunks, exportChunks, erasureRoot }] =
//     //   await this.erasureCodingService.encodeWorkPackage({
//     //     workPackage,
//     //     extrinsics: data.extrinsics,
//     //     importSegments: ..., // Self-justifying imported segments
//     //     exportSegments: refineResult.exportSegments,
//     //   })
//     // if (erasureError) {
//     //   return safeError(new Error(`Erasure coding failed: ${erasureError.message}`))
//     // }
//     //
//     // TODO: Distribute chunks to all validators
//     // for (const [validatorIndex, chunk] of auditChunks.entries()) {
//     //   await this.distributionService.sendChunk(validatorIndex, chunk, 'audit')
//     // }
//     // for (const [validatorIndex, chunk] of exportChunks.entries()) {
//     //   await this.distributionService.sendChunk(validatorIndex, chunk, 'export')
//     // }

//     // ═══════════════════════════════════════════════════════════════════
//     // STEP 6: Store & Sign Work Report
//     // ═══════════════════════════════════════════════════════════════════
//     // TODO: Store work-report in WorkReportService
//     // await this.workReportService.storeGuaranteedWorkReport(
//     //   workReport,
//     //   data.coreIndex,
//     // )
//     //
//     // TODO: Sign using Ed25519 key
//     // const [signError, signature] = createGuaranteeSignature(
//     //   workReport,
//     //   this.validatorEdPrivateKey,
//     // )
//     // if (signError) {
//     //   return safeError(new Error(`Signature creation failed: ${signError.message}`))
//     // }
//     //
//     // Record signature in history (anti-spam tracking)
//     const currentSignatures =
//       this.validatorSignaturesForTimeslot.get(currentSlot) ?? new Map()
//     const currentValidatorSignatures =
//       currentSignatures.get(this.validatorIndex) ?? 0
//     currentSignatures.set(this.validatorIndex, currentValidatorSignatures + 1)
//     this.validatorSignaturesForTimeslot.set(currentSlot, currentSignatures)
//     // ═══════════════════════════════════════════════════════════════════
//     // STEP 7: Share with Co-Guarantors (CE134)
//     // ═══════════════════════════════════════════════════════════════════
//     // Get co-guarantors for this core (each core has 3 validators)
//     const [coGuarantorsError, _coGuarantors] = this.getCoGuarantors(
//       Number(data.coreIndex),
//       this.validatorIndex,
//     )
//     if (coGuarantorsError) {
//       return safeError(coGuarantorsError)
//     }

//     // TODO: Share work-package + segments-root mappings via CE134
//     // const sharing: WorkPackageSharing = {
//     //   coreIndex: data.coreIndex,
//     //   workPackageBundle: workPackage,
//     //   segmentsRootMappings: refineResult.segmentsRootMappings,
//     // }
//     // for (const coGuarantor of coGuarantors) {
//     //   if (coGuarantor !== this.validatorIndex) {
//     //     await this.ce134WorkPackageSharingProtocol.shareWorkPackage(
//     //       coGuarantor,
//     //       sharing,
//     //     )
//     //   }
//     // }

//     // ═══════════════════════════════════════════════════════════════════
//     // STEP 8: Wait for Co-Guarantor Signatures & Distribute (CE135)
//     // ═══════════════════════════════════════════════════════════════════
//     // This step is handled asynchronously:
//     // 1. Wait for responses from co-guarantors (handleWorkPackageSharingResponse)
//     // 2. Once we have 2 signatures, wait ~2 seconds for potential 3rd signature
//     // 3. Create GuaranteedWorkReport structure (work-report ++ slot ++ signatures)
//     // 4. Distribute to all current validators via CE135
//     // 5. During last core rotation of epoch, also distribute to next epoch validators
//     // 6. Create Guarantee extrinsic for block inclusion
//     //
//     // The distribution is handled by:
//     // - distributGuaranteedWorkReport() method (called after signature collection)
//     // - CE135WorkReportDistributionProtocol for actual transmission
//     //
//     // See: handleWorkPackageSharingResponse() and distributeGuaranteedWorkReport()

//     return safeResult(undefined)
//   }

//   /**
//    * Handle Work Package Sharing Event
//    *
//    * Gray Paper Reference: guaranteeing.tex (lines 31-33)
//    *
//    * Called when a co-guarantor shares a work package with us via CE134 protocol.
//    * This is Step 2 in the guarantor workflow after the primary guarantor has evaluated
//    * the work package and wants to collect signatures from co-guarantors.
//    *
//    * Required Steps:
//    * 1. Verify we are assigned to this core (can reuse: getAssignedCore)
//    * 2. Verify authorization against auth pool (can reuse: authPoolService methods)
//    * 3. Compute work-report from work-package (TODO: implement Ψ_R function)
//    * 4. Calculate work-report hash
//    * 5. Verify we can sign (anti-spam check) (can reuse: canSignWorkReport)
//    * 6. Sign work-report using Ed25519 key (can reuse: createGuaranteeSignature)
//    * 7. Record that we signed this timeslot (can reuse: recordSignedReport)
//    * 8. Send response back via CE134 protocol
//    *
//    * Reusable Methods:
//    * - getAssignedCore() - Check if we're assigned to this core
//    * - canSignWorkReport() - Check anti-spam limit (max 2 signatures per timeslot)
//    * - createGuaranteeSignature() - Sign the work report
//    * - recordSignedReport() - Update signature history
//    *
//    * @param sharing - Work package sharing data from co-guarantor
//    */
//   private handleWorkPackageSharing(
//     sharing: WorkPackageSharing,
//     peerPublicKey: Hex,
//   ): Safe<void> {
//     // get validator index from peer public key
//     const [validatorIndexError, validatorIndex] =
//       this.validatorSetManager.getValidatorIndex(peerPublicKey)
//     if (validatorIndexError) {
//       return safeError(validatorIndexError)
//     }
//     // Step 1: Verify we are assigned to this core
//     const [coreError, assignedCore] =
//       this.validatorSetManager.getAssignedCore(validatorIndex)
//     if (coreError) {
//       return safeError(coreError)
//     }

//     if (assignedCore !== Number(sharing.coreIndex)) {
//       return safeError(
//         new Error(
//           `Not assigned to core ${sharing.coreIndex}, assigned to core ${assignedCore}`,
//         ),
//       )
//     }

//     // Step 2: Verify authorization against auth pool
//     // TODO: Check if work package authorization hash is in auth pool for this core
//     const authPool = this.authPoolService.getCoreAuthorizations(
//       Number(sharing.coreIndex),
//     )
//     const [authHashError, authHash] = calculateWorkPackageHash(
//       sharing.workPackageBundle,
//     )
//     if (authHashError) {
//       return safeError(authHashError)
//     }
//     if (!authPool.includes(authHash)) {
//       return safeError(new Error('Work package not authorized'))
//     }

//     // Step 3: Compute work-report from work-package
//     // TODO: Implement Ψ_R(p, c) - Refine function to compute work report
//     // This involves:
//     // - Executing PVM for each work item
//     // - Computing work results
//     // - Building work report structure
//     // const workReport = await this.computeWorkReport(sharing.workPackageBundle, sharing.coreIndex)

//     // Step 4: Calculate work-report hash
//     // TODO: Hash the work report using BLAKE2b
//     // const workReportHash = blake2bHash(encode(workReport))

//     // Step 5: Verify we can sign (anti-spam check - max 2 per timeslot)
//     const currentSlot = this.clockService.getCurrentSlot()
//     const validatorSignatures =
//       this.validatorSignaturesForTimeslot.get(currentSlot) ?? new Map()
//     const currentValidatorSignatures =
//       validatorSignatures.get(this.validatorIndex) ?? 0
//     if (currentValidatorSignatures >= 2) {
//       return safeError(
//         new Error(
//           'Cannot sign work report: anti-spam limit reached (2 per timeslot)',
//         ),
//       )
//     }

//     // Step 6: Sign work-report using Ed25519 key
//     // TODO: Get our Ed25519 private key and sign the work report hash
//     // const edPrivateKey = await this.getEdPrivateKey()
//     // const signature = createGuaranteeSignature(workReportHash, edPrivateKey)

//     // Step 7: Record that we signed this timeslot
//     currentValidatorSignatures.set(
//       this.validatorIndex,
//       currentValidatorSignatures + 1,
//     )
//     this.validatorSignaturesForTimeslot.set(currentSlot, validatorSignatures)

//     // Step 8: Send response back via CE134 protocol
//     // TODO: Send WorkPackageSharingResponse with workReportHash and signature
//     // const response: WorkPackageSharingResponse = {
//     //   workReportHash,
//     //   signature,
//     // }
//     // await this.ce134WorkPackageSharingProtocol.sendResponse(response)

//     return safeResult(undefined)
//   }

//   /**
//    * Handle Co-Guarantor Signature (CE134 Response)
//    *
//    * Gray Paper Reference: guaranteeing.tex (line 33)
//    *
//    * Called when we receive a signature from a co-guarantor after sharing
//    * a work package with them via CE134. Collects signatures and triggers
//    * distribution via CE135 when ready.
//    *
//    * Workflow:
//    * 1. Verify signature is from a valid co-guarantor
//    * 2. Get the work report we're collecting signatures for
//    * 3. Validate the signature cryptographically
//    * 4. Store signature in pending collection
//    * 5. Check if we have enough signatures (2-3)
//    * 6. Wait ~2 seconds for potential 3rd signature if we have 2
//    * 7. Distribute guaranteed work-report via CE135
//    *
//    * @param response - Signature response containing workReportHash, signature, validatorIndex
//    */
//   private async handleCoGuarantorSignature(
//     response: WorkPackageSharingResponse,
//     peerPublicKey: Hex,
//   ): Promise<Safe<void>> {
//     // make sure we have the work report in the work report service
//     const workReportEntry = this.workReportService.getWorkReportByHash(
//       bytesToHex(response.workReportHash),
//     )
//     if (!workReportEntry) {
//       return safeError(
//         new Error(
//           `Work report not found for hash: ${bytesToHex(response.workReportHash)}`,
//         ),
//       )
//     }

//     const workReport = workReportEntry.workReport
//     // get validator index from peer public key
//     const [validatorIndexError, validatorIndex] =
//       this.validatorSetManager.getValidatorIndex(peerPublicKey)
//     if (validatorIndexError) {
//       return safeError(validatorIndexError)
//     }

//     // get assigned core for validator index
//     const [assignedCoreError, assignedCore] =
//       this.validatorSetManager.getAssignedCore(validatorIndex)
//     if (assignedCoreError) {
//       return safeError(assignedCoreError)
//     }

//     // check if assigned core is the same as the core in the response
//     if (assignedCore !== Number(workReport.core_index)) {
//       return safeError(
//         new Error(
//           `Validator ${validatorIndex} is not assigned to core ${workReport.core_index}`,
//         ),
//       )
//     }

//     // Get or create signature collection for this work report
//     let pending = this.pendingSignatures.get(
//       bytesToHex(response.workReportHash),
//     )
//     if (!pending) {
//       // First signature for this work report
//       pending = {
//         workReport,
//         signatures: [],
//         timer: undefined,
//       }
//       this.pendingSignatures.set(bytesToHex(response.workReportHash), pending)
//     }

//     // Validate signature cryptographically
//     // TODO: Get validator keys from ValidatorSetManager
//     // const validatorKeys = this.validatorSetManager.getActiveValidators()
//     // const coreAssignments = this.getCoreAssignments()
//     const [validationError, isValid] = verifyWorkReportDistributionSignature(
//       workReport,
//       {
//         validator_index: validatorIndex,
//         signature: bytesToHex(response.signature),
//       },
//       hexToBytes(peerPublicKey),
//     )
//     if (validationError) {
//       return safeError(validationError)
//     }

//     if (!isValid) {
//       return safeError(
//         new Error(`Signature is invalid for validator ${validatorIndex}`),
//       )
//     }

//     // Add signature to collection
//     pending.signatures.push({
//       validator_index: validatorIndex,
//       signature: bytesToHex(response.signature),
//     })

//     // Check if we have enough signatures (2-3)
//     const totalSignatures = pending.signatures.length + 1 // +1 for our own signature

//     if (totalSignatures >= 2) {
//       // Clear any existing timer
//       if (pending.timer) {
//         clearTimeout(pending.timer)
//       }

//       // If we have exactly 2 signatures, wait ~2 seconds for potential 3rd
//       if (totalSignatures === 2) {
//         pending.timer = setTimeout(() => {
//           this.finalizeAndDistributeWorkReport(
//             bytesToHex(response.workReportHash),
//           )
//         }, 2000) // 2 second wait
//       } else {
//         // We have 3 signatures, distribute immediately
//         this.finalizeAndDistributeWorkReport(
//           bytesToHex(response.workReportHash),
//         )
//       }
//     }

//     return safeResult(undefined)
//   }

//   /**
//    * Finalize signature collection and distribute work report via CE135
//    *
//    * @param workReportHash - Hash of the work report to distribute
//    */
//   private async finalizeAndDistributeWorkReport(
//     workReportHash: Hex,
//   ): Promise<void> {
//     const pending = this.pendingSignatures.get(workReportHash)
//     if (!pending) {
//       return
//     }

//     // Clean up
//     this.pendingSignatures.delete(workReportHash)
//     if (pending.timer) {
//       clearTimeout(pending.timer)
//     }

//     // Add our own signature to the collection
//     const localValidatorIndex = this.validatorIndex
//     const [ourSignatureError, _ourSignature] = createGuaranteeSignature(
//       pending.workReport,
//       localValidatorIndex,
//       this.keyPairService.getLocalKeyPair().ed25519KeyPair.privateKey,
//     )
//     if (ourSignatureError) {
//       return
//     }
//     // TODO: Get our own signature for this work report
//     // const ourSignature: GuaranteeSignature = {
//     //   validator_index: this.validatorIndex,
//     //   signature: ..., // Our Ed25519 signature
//     // }
//     // const allSignatures = [ourSignature, ...pending.signatures]

//     // For now, simulate with collected signatures
//     const allSignatures = pending.signatures

//     // Sort signatures by validator index (Gray Paper requirement)
//     const sortedSignatures = sortGuaranteeSignatures(allSignatures)

//     // Distribute via CE135
//     const currentSlot = this.clockService.getCurrentSlot()
//     const [distributionError] = await this.distributeGuaranteedWorkReport(
//       pending.workReport,
//       sortedSignatures,
//       currentSlot,
//     )

//     if (distributionError) {
//       // Log error but don't throw - distribution already attempted
//       console.error(
//         'Failed to distribute guaranteed work report:',
//         distributionError,
//       )
//     }
//   }

//   // Storage for collecting signatures per work report
//   // TODO: Move this to a proper state management structure
//   private readonly pendingSignatures = new Map<
//     Hex,
//     {
//       workReport: WorkReport
//       signatures: GuaranteeSignature[]
//       timer?: NodeJS.Timeout
//     }
//   >()
// }
