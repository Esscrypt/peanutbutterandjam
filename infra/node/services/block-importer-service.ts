/**
 * Block Importer Service
 *
 * Validates incoming blocks against current time slot and emits BlockProcessedEvent
 * for statistics tracking and other downstream processing.
 *
 * Key Responsibilities:
 * - Validate block header timeslot against current clock time
 * - Emit BlockProcessedEvent for valid blocks
 * - Handle block validation errors
 * - Provide block import status tracking
 */

import {
  extractSealOutput,
  verifyEntropyVRFSignature,
} from '@pbnj/bandersnatch-vrf'
import {
  type BlockProcessedEvent,
  blake2bHash,
  type EventBusService,
  type Hex,
  hexToBytes,
  type Safe,
  type SafePromise,
  safeError,
  safeResult,
  verifySignature,
} from '@pbnj/core'
import {
  isSafroleTicket,
  verifyFallbackSealSignature,
  verifyTicketBasedSealSignature,
} from '@pbnj/safrole'
import { encodeWorkReport } from '@pbnj/serialization'
import type { BlockStore } from '@pbnj/state'
import type {
  Assurance,
  Block,
  BlockHeader,
  Guarantee,
  IClockService,
  IConfigService,
  IEntropyService,
  IValidatorSetManager,
  Judgment,
  Verdict,
} from '@pbnj/types'
import { BaseService as BaseServiceClass } from '@pbnj/types'
import type { RecentHistoryService } from './recent-history-service'
import type { SealKeyService } from './seal-key'

// ============================================================================
// Block Importer Service
// ============================================================================

export interface BlockImportResult {
  success: boolean
  error?: string
  timeslotValid: boolean
  currentSlot: bigint
  blockSlot: bigint
}

/**
 * Block Importer Service
 *
 * Validates blocks against current time slot and emits BlockProcessedEvent
 * for downstream processing by statistics and other services.
 */
export class BlockImporterService extends BaseServiceClass {
  private readonly eventBusService: EventBusService
  private readonly clockService: IClockService
  private readonly recentHistoryService: RecentHistoryService
  private readonly configService: IConfigService
  private readonly validatorSetManagerService: IValidatorSetManager
  private readonly entropyService: IEntropyService
  private readonly sealKeyService: SealKeyService
  private readonly blockStore: BlockStore
  constructor(options: {
    eventBusService: EventBusService
    clockService: IClockService
    recentHistoryService: RecentHistoryService
    configService: IConfigService
    validatorSetManagerService: IValidatorSetManager
    entropyService: IEntropyService
    sealKeyService: SealKeyService
    blockStore: BlockStore
  }) {
    super('block-importer-service')
    this.eventBusService = options.eventBusService
    this.clockService = options.clockService
    this.recentHistoryService = options.recentHistoryService
    this.configService = options.configService
    this.validatorSetManagerService = options.validatorSetManagerService
    this.entropyService = options.entropyService
    this.sealKeyService = options.sealKeyService
    this.blockStore = options.blockStore
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Import a block and validate its timeslot
   *
   * @param block The block to import
   * @returns Result of the import operation
   */
  async importBlock(block: Block): SafePromise<void> {
    // validate the block header
    const [blockHeaderValidationError] = await this.validateBlockHeader(
      block.header,
      this.clockService,
      this.configService,
    )
    if (blockHeaderValidationError) {
      return safeError(blockHeaderValidationError)
    }

    // read relevant GP sections first
    const [guaranteeValidationError] = this.validateGuarantees(
      block.body.guarantees,
      this.configService,
      this.validatorSetManagerService,
    )
    if (guaranteeValidationError) {
      return safeError(guaranteeValidationError)
    }

    // validate the assurances
    const [assuranceValidationError] = this.validateAssurances(
      block.body.assurances,
      this.validatorSetManagerService,
    )
    if (assuranceValidationError) {
      return safeError(assuranceValidationError)
    }

    //validate the verdicts

    const currentEpoch = this.clockService.getCurrentEpoch()

    const event: BlockProcessedEvent = {
      timestamp: Date.now(),
      slot: block.header.timeslot,
      epoch: currentEpoch,
      authorIndex: Number(block.header.authorIndex),
      header: block.header,
      body: block.body,
    }
    // Block is valid, emit BlockProcessedEvent
    this.eventBusService.emitBlockProcessed(event)

    //TODO: emit events to update the epoch mark and winners mark when they are present

    return safeResult(undefined)
  }

  // TODO: add VRF signature validation, seal signature validation, and block header validations according to GP
  async validateBlockHeader(
    header: BlockHeader,
    clockService: IClockService,
    configService: IConfigService,
  ): SafePromise<void> {
    const currentSlot = clockService.getCurrentSlot()

    // according to the gray paper, the block header timeslot should be in the past
    if (header.timeslot > currentSlot) {
      return safeError(new Error('Block slot is in the future'))
    }

    // validate the parent hash exists in the block store
    const [parentHashError, parentHeader] =
      await this.blockStore.getBlockHeader(header.parent)
    if (parentHashError) {
      return safeError(parentHashError)
    }
    if (!parentHeader) {
      return safeError(new Error('Parent block not found'))
    }

    // validate that winners mark is present only at phase > contest duration and has correct number of tickets
    const currentPhase = clockService.getCurrentPhase()
    if (header.winnersMark) {
      if (currentPhase <= configService.contestDuration) {
        return safeError(
          new Error('winners mark is present at phase <= contest duration'),
        )
      }

      // winners mark should contain exactly as amny tickets as number of slots in an epoch
      if (header.winnersMark.length !== configService.epochDuration) {
        return safeError(
          new Error('winners mark contains incorrect number of tickets'),
        )
      }
    }

    // validate that epoch mark is present only at first slot of an epoch
    if (header.epochMark) {
      if (currentPhase !== BigInt(0)) {
        return safeError(new Error('epoch mark is present at non-first slot'))
      }
      // if the validators are not as many as in config, return an error
      if (header.epochMark.validators.length !== configService.numValidators) {
        return safeError(
          new Error('epoch mark contains incorrect number of validators'),
        )
      }
    }

    // verify state against prior state root

    //validate the seal signature
    const [sealValidationError] = this.validateSealSignature(
      header,
      this.sealKeyService,
      this.validatorSetManagerService,
    )
    if (sealValidationError) {
      return safeError(sealValidationError)
    }

    //validate the vrf signature
    const [vrfValidationError] = this.validateVRFSignature(
      header,
      this.validatorSetManagerService,
    )
    if (vrfValidationError) {
      return safeError(vrfValidationError)
    }

    return safeResult(undefined)
  }

  validateGuarantees(
    guarantees: Guarantee[],
    configService: IConfigService,
    validatorSetManagerService: IValidatorSetManager,
  ): Safe<void> {
    if (guarantees.length > configService.numCores) {
      return safeError(
        new Error('guaranttees extrinsic count exceeds core count'),
      )
    }

    // t. The core index of each guarantee must be unique and
    // guarantees must be in ascending order of this. Formally:
    const uniqueCoreIndices = new Set(
      guarantees.map((g) => g.report.core_index),
    )
    if (uniqueCoreIndices.size !== guarantees.length) {
      return safeError(new Error('guarantees have duplicate core indices'))
    }

    for (let i = 0; i < guarantees.length; i++) {
      if (Number(guarantees[i].report.core_index) !== i) {
        return safeError(
          new Error('guarantees are not in ascending order of core index'),
        )
      }
      // ensure the core index is unique
      if (
        guarantees.some(
          (g) => g.report.core_index === guarantees[i].report.core_index,
        )
      ) {
        return safeError(new Error('guarantees have duplicate core indices'))
      }

      // ensure the slot is in the past
      if (guarantees[i].slot > this.clockService.getCurrentSlot()) {
        return safeError(new Error('guarantees are in the future'))
      }

      // validate the guarantee signatures
      const [error] = this.validateGuaranteeSignatures(
        guarantees[i],
        validatorSetManagerService,
      )
      if (error) {
        return safeError(error)
      }
      // if no error, the guarantee is valid
    }

    return safeResult(undefined)
  }

  validateAssurances(
    assurances: Assurance[],
    validatorSetManagerService: IValidatorSetManager,
  ): Safe<void> {
    for (const assurance of assurances) {
      // 1. TODO: validate that the anchor is a know header hash in the recent history
      if (!this.recentHistoryService.isValidAnchor(assurance.anchor)) {
        return safeError(
          new Error('assurance anchor is not in the recent history'),
        )
      }
      // 2. TODO: validate that the bitfield length is as long as the number of cores

      // 3. validate the signature
      const [error, isValid] = this.validateAssuranceSignature(
        assurance,
        validatorSetManagerService,
      )
      if (error) {
        return safeError(error)
      }
      if (!isValid) {
        return safeError(new Error('assurance signature is invalid'))
      }
    }
    return safeResult(undefined)
  }

  validateGuaranteeSignatures(
    guarantee: Guarantee,
    validatorSetManagerService: IValidatorSetManager,
  ): Safe<void> {
    if (guarantee.signatures.length < 2) {
      return safeError(new Error('guarantee signatures are less than 2'))
    }

    // Construct the correct message according to Gray Paper:
    // s ∈ edsignature{(k_v)_vk_ed}{X_guarantee ∥ blake{xg_workreport}}
    // Where X_guarantee = "$jam_guarantee"

    // Step 1: Serialize the work report
    const [workReportBytesError, workReportBytes] = encodeWorkReport(
      guarantee.report,
    )
    if (workReportBytesError) {
      return safeError(new Error('failed to encode work report'))
    }

    // Step 2: Compute Blake2b hash of the work report
    const [hashError, workReportHash] = blake2bHash(workReportBytes)
    if (hashError) {
      return safeError(new Error('failed to hash work report'))
    }

    // Step 3: Construct the message: "$jam_guarantee" + Blake2b(work_report)
    const contextString = '$jam_guarantee'
    const contextBytes = new TextEncoder().encode(contextString)
    const hashBytes = hexToBytes(workReportHash)
    const message = new Uint8Array(contextBytes.length + hashBytes.length)
    message.set(contextBytes, 0)
    message.set(hashBytes, contextBytes.length)

    // Validate each signature according to Gray Paper equation (274)
    for (const signature of guarantee.signatures) {
      const [publicKeyError, publicKeys] =
        validatorSetManagerService.getValidatorAtIndex(
          Number(signature.validator_index),
        )
      if (publicKeyError) {
        return safeError(
          new Error(
            `failed to get validator at index ${signature.validator_index}`,
          ),
        )
      }

      // Step 4: Verify the Ed25519 signature
      const publicKey = publicKeys.ed25519
      const signatureBytes = hexToBytes(signature.signature)
      const isValid = verifySignature(
        hexToBytes(publicKey),
        message,
        signatureBytes,
      )

      if (!isValid) {
        return safeError(new Error('guarantee signature is invalid'))
      }
    }
    return safeResult(undefined)
  }

  validateAssuranceSignature(
    assurance: Assurance,
    validatorSetManagerService: IValidatorSetManager,
  ): Safe<boolean> {
    // Construct the correct message according to Gray Paper equation (160):
    // a_xa_signature ∈ edsignature{activeset[a_xa_assurer]_vk_ed}{X_available ∥ blake{encode{H_parent, a_xa_availabilities}}}
    // Where X_available = "$jam_available"

    // Step 1: Encode the (parent_hash, bitfield) tuple
    // In a full implementation, this would use proper JAM serialization
    // For now, we'll create a simple encoding: parent_hash + bitfield
    const parentHashBytes = hexToBytes(assurance.anchor)
    const bitfieldBytes = hexToBytes(assurance.bitfield)
    const encodedData = new Uint8Array(
      parentHashBytes.length + bitfieldBytes.length,
    )
    encodedData.set(parentHashBytes, 0)
    encodedData.set(bitfieldBytes, parentHashBytes.length)

    // Step 2: Compute Blake2b hash of the encoded data
    const [hashError, dataHash] = blake2bHash(encodedData)
    if (hashError) {
      return safeError(new Error('failed to hash assurance data'))
    }

    // Step 3: Construct the message: "$jam_available" + Blake2b(encoded_data)
    const contextString = '$jam_available'
    const contextBytes = new TextEncoder().encode(contextString)
    const hashBytes = hexToBytes(dataHash)
    const message = new Uint8Array(contextBytes.length + hashBytes.length)
    message.set(contextBytes, 0)
    message.set(hashBytes, contextBytes.length)

    // Step 4: Get validator's Ed25519 public key
    const [publicKeyError, publicKeys] =
      validatorSetManagerService.getValidatorAtIndex(assurance.validator_index)
    if (publicKeyError) {
      return safeError(
        new Error(
          `failed to get validator at index ${assurance.validator_index}`,
        ),
      )
    }

    // Step 5: Verify the Ed25519 signature
    const publicKey = publicKeys.ed25519
    const signatureBytes = hexToBytes(assurance.signature)
    const isValid = verifySignature(
      hexToBytes(publicKey),
      message,
      signatureBytes,
    )

    return safeResult(isValid)
  }

  /**
   * Validate seal signature according to Gray Paper specifications
   *
   * Gray Paper safrole.tex equations 147-148 (ticket-based) and 154 (fallback):
   *
   * Ticket-based sealing (eq. 147-148):
   * - i_st_id = banderout{H_sealsig}
   * - H_sealsig ∈ bssignature{H_authorbskey}{Xticket ∥ entropy'_3 ∥ i_st_entryindex}{encodeunsignedheader{H}}
   *
   * Fallback sealing (eq. 154):
   * - H_sealsig ∈ bssignature{H_authorbskey}{Xfallback ∥ entropy'_3}{encodeunsignedheader{H}}
   *
   * @param header Block header containing seal signature
   * @param clockService Clock service for epoch information
   * @param validatorSetManagerService Validator set manager service
   * @returns Validation result
   */
  validateSealSignature(
    header: BlockHeader,
    sealKeyService: SealKeyService,
    validatorSetManagerService: IValidatorSetManager,
  ): Safe<void> {
    const [sealKeyError, sealKey] = sealKeyService.getSealKeyForSlot(
      header.timeslot,
    )
    if (sealKeyError) {
      return safeError(sealKeyError)
    }

    // Get validator's Bandersnatch public key
    const [publicKeyError, publicKeys] =
      validatorSetManagerService.getValidatorAtIndex(Number(header.authorIndex))
    if (publicKeyError) {
      return safeError(publicKeyError)
    }

    // Create unsigned header (header without seal signature)
    const unsignedHeader = {
      parent: header.parent,
      priorStateRoot: header.priorStateRoot,
      extrinsicHash: header.extrinsicHash,
      timeslot: header.timeslot,
      epochMark: header.epochMark,
      winnersMark: header.winnersMark,
      offendersMark: header.offendersMark,
      authorIndex: header.authorIndex,
      vrfSig: header.vrfSig,
    }

    // Get entropy_3 for seal signature validation
    const entropy3 = this.entropyService.getEntropy3()

    // Determine sealing mode and validate accordingly
    if (sealKey && isSafroleTicket(sealKey)) {
      // Ticket-based sealing validation (Gray Paper eq. 147-148)
      const [isValid] = verifyTicketBasedSealSignature(
        hexToBytes(publicKeys.bandersnatch),
        hexToBytes(header.sealSig),
        entropy3,
        unsignedHeader,
        sealKey,
        this.configService,
      )
      if (!isValid) {
        return safeError(new Error('Ticket-based seal signature is invalid'))
      }
    } else {
      // Fallback sealing validation (Gray Paper eq. 154)
      const [isValid] = verifyFallbackSealSignature(
        hexToBytes(publicKeys.bandersnatch),
        hexToBytes(header.sealSig),
        entropy3,
        unsignedHeader,
        this.configService,
      )
      if (!isValid) {
        return safeError(new Error('Fallback seal signature is invalid'))
      }
    }

    return safeResult(undefined)
  }

  /**
   * Validate VRF signature according to Gray Paper specifications
   *
   * Gray Paper safrole.tex equation 158:
   * H_vrfsig ∈ bssignature{H_authorbskey}{Xentropy ∥ banderout{H_sealsig}}{[]}
   * where Xentropy = "$jam_entropy"
   *
   * This verifies that:
   * 1. The VRF signature was generated by the block author
   * 2. The signature corresponds to the correct context (entropy + seal output)
   * 3. The VRF output provides deterministic, verifiable randomness
   *
   * @param header Block header containing VRF signature
   * @param sealKeyService Service to get seal key for this slot
   * @param validatorSetManagerService Validator set manager service
   * @returns Validation result
   */
  validateVRFSignature(
    header: BlockHeader,
    validatorSetManagerService: IValidatorSetManager,
  ): Safe<void> {
    // Get validator's Bandersnatch public key
    const [publicKeyError, publicKeys] =
      validatorSetManagerService.getValidatorAtIndex(Number(header.authorIndex))
    if (publicKeyError) {
      return safeError(publicKeyError)
    }

    // Extract VRF output from seal signature using banderout function
    // Gray Paper: banderout{H_sealsig} - first 32 bytes of VRF output hash
    const [extractError, sealOutput] = extractSealOutput(
      hexToBytes(header.sealSig),
    )
    if (extractError) {
      return safeError(extractError)
    }

    // Verify VRF signature using existing entropy VRF verification function
    // Gray Paper Eq. 158: H_vrfsig ∈ bssignature{H_authorbskey}{Xentropy ∥ banderout{H_sealsig}}{[]}
    const [isValid] = verifyEntropyVRFSignature(
      hexToBytes(publicKeys.bandersnatch),
      hexToBytes(header.vrfSig),
      sealOutput,
    )

    if (!isValid) {
      return safeError(new Error('VRF signature is invalid'))
    }

    return safeResult(undefined)
  }

  /**
   * Validate verdicts according to Gray Paper specifications
   *
   * @param verdicts Array of verdicts to validate
   * @param validatorSetManagerService Validator set manager service
   * @returns Validation result
   */
  validateVerdicts(
    verdicts: Verdict[],
    validatorSetManagerService: IValidatorSetManager,
  ): Safe<void> {
    for (const verdict of verdicts) {
      // Validate that verdict has at least 2/3 + 1 judgments
      const requiredJudgments =
        Math.floor((2 * this.configService.numValidators) / 3) + 1
      if (verdict.votes.length < requiredJudgments) {
        return safeError(
          new Error(
            `verdict has insufficient judgments: ${verdict.votes.length} < ${requiredJudgments}`,
          ),
        )
      }

      // Validate each judgment in the verdict
      for (const judgment of verdict.votes) {
        const [error] = this.validateJudgmentSignature(
          judgment,
          verdict.target,
          validatorSetManagerService,
        )
        if (error) {
          return safeError(error)
        }
      }
    }

    return safeResult(undefined)
  }

  /**
   * Validate judgment signature according to Gray Paper specifications
   *
   * Gray Paper equation (47):
   * XVJ_signature ∈ edsignature{𝐤[XVJ_judgeindex]_vk_ed}{𝖷_v || XV_reporthash}
   * where 𝖷_valid ≡ "$jam_valid", 𝖷_invalid ≡ "$jam_invalid"
   *
   * @param judgment The judgment to validate
   * @param reportHash The work report hash being judged
   * @param validatorSetManagerService Validator set manager service
   * @returns Validation result
   */
  validateJudgmentSignature(
    judgment: Judgment,
    reportHash: Hex,
    validatorSetManagerService: IValidatorSetManager,
  ): Safe<void> {
    // Step 1: Get validator's Ed25519 public key
    const [publicKeyError, publicKeys] =
      validatorSetManagerService.getValidatorAtIndex(Number(judgment.index))
    if (publicKeyError) {
      return safeError(
        new Error(`failed to get validator at index ${judgment.index}`),
      )
    }

    // Step 2: Construct the message according to Gray Paper
    // Message = "$jam_valid" || report_hash OR "$jam_invalid" || report_hash
    const contextString = judgment.vote ? '$jam_valid' : '$jam_invalid'
    const contextBytes = new TextEncoder().encode(contextString)
    const reportHashBytes = hexToBytes(reportHash)
    const message = new Uint8Array(contextBytes.length + reportHashBytes.length)
    message.set(contextBytes, 0)
    message.set(reportHashBytes, contextBytes.length)

    // Step 3: Verify the Ed25519 signature
    const publicKey = publicKeys.ed25519
    const signatureBytes = hexToBytes(judgment.signature)
    const isValid = verifySignature(
      hexToBytes(publicKey),
      message,
      signatureBytes,
    )

    if (!isValid) {
      return safeError(
        new Error(
          `judgment signature is invalid for validator ${judgment.index}`,
        ),
      )
    }

    return safeResult(undefined)
  }
}
