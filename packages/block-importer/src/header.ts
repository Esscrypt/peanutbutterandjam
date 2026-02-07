import {
  banderout,
  type IETFVRFVerifier,
  type IETFVRFVerifierWasm,
  verifyEntropyVRFSignature,
  verifyEpochRoot,
} from '@pbnjam/bandersnatch-vrf'
import { bytesToHex, hexToBytes, logger, zeroHash } from '@pbnjam/core'
import {
  isSafroleTicket,
  verifyFallbackSealSignature,
  verifyTicketBasedSealSignature,
} from '@pbnjam/safrole'
import type {
  BlockHeader,
  IClockService,
  IConfigService,
  IEntropyService,
  IRecentHistoryService,
  ISealKeyService,
  IStateService,
  IValidatorSetManager,
  SafePromise,
  SafroleTicketWithoutProof,
  SealKey,
} from '@pbnjam/types'
import {
  BLOCK_HEADER_ERRORS,
  type Safe,
  safeError,
  safeResult,
  type ValidatorPublicKeys,
} from '@pbnjam/types'
export async function validateBlockHeader(
  header: BlockHeader,
  clockService: IClockService,
  configService: IConfigService,
  stateService: IStateService,
  recentHistoryService: IRecentHistoryService,
  validatorSetManagerService: IValidatorSetManager,
  sealKeyService: ISealKeyService,
  entropyService: IEntropyService,
  verifier: IETFVRFVerifier | IETFVRFVerifierWasm,
): SafePromise<void> {
  // pre-state root already validated in validatePreStateRoot (before emitting and processing the epoch transition event)
  // so we don't need to validate it again here

  // Gray Paper: Use thetime (C(11)) from state - the most recent block's timeslot index
  // Gray Paper safrole.tex: thetime defines the most recent block's slot index
  // The new block's timeslot should be greater than the previous block's timeslot
  const latestStateTimeslot = clockService.getLatestReportedBlockTimeslot()

  // Validate that the new block's timeslot is greater than the previous block's timeslot
  // Gray Paper: thetime' ≡ H_timeslot, and thetime' should be > thetime
  if (header.timeslot <= latestStateTimeslot) {
    return safeError(
      new Error(
        `Block slot (${header.timeslot}) must be greater than previous block's slot (${latestStateTimeslot})`,
      ),
    )
  }

  // Also validate against wall clock to prevent blocks from the far future
  // const wallClockSlot = clockService.getSlotFromWallClock()
  // if (header.timeslot > wallClockSlot) {
  //   return safeError(new Error('Block slot is in the future'))
  // }

  // Validate parent block hash
  if (header.parent !== zeroHash) {
    const recentHistory = recentHistoryService.getRecentHistory()
    const recentBlock = recentHistoryService.getRecentHistoryForBlock(
      header.parent,
    )

    if (!recentBlock) {
      // If recent history is empty, check if parent matches genesis hash
      if (recentHistory.length === 0) {
        // Get genesis hash from state service (via genesis manager)
        const genesisManager = stateService.getGenesisManager()
        if (genesisManager) {
          const [genesisHashError, genesisHash] =
            genesisManager.getGenesisHeaderHash()
          if (genesisHashError || !genesisHash) {
            return safeError(
              new Error(
                'Parent block not found and cannot verify against genesis hash',
              ),
            )
          }

          if (header.parent !== genesisHash) {
            return safeError(
              new Error(
                `Parent block hash (${header.parent}) does not match genesis hash (${genesisHash})`,
              ),
            )
          }

          // Parent matches genesis, which is valid for the first block after genesis
        } else {
          // No genesis manager available - skip genesis hash validation
          // This allows importing blocks when starting from a non-genesis state
          // (e.g., when loading state from trace pre-state)
        }
      }
    }
  }

  // Note: Epoch mark presence validation (if epoch mark is required/unexpected) is done
  // in block-importer-service.ts BEFORE this function is called, to ensure correct error ordering

  // validate that winners mark is present only at phase > contest duration and has correct number of tickets
  const currentPhase =
    (latestStateTimeslot + 1n) % BigInt(configService.epochDuration)
  if (header.winnersMark) {
    if (currentPhase < configService.contestDuration) {
      return safeError(new Error(BLOCK_HEADER_ERRORS.INVALID_TICKETS_MARK))
    }

    // winners mark should contain exactly as amny tickets as number of slots in an epoch
    if (header.winnersMark.length !== configService.epochDuration) {
      return safeError(new Error(BLOCK_HEADER_ERRORS.INVALID_TICKETS_MARK))
    }
  }

  // validate that epoch mark is present only at first slot of an epoch
  if (header.epochMark) {
    // if the validators are not as many as in config, return an error
    if (header.epochMark.validators.length !== configService.numValidators) {
      return safeError(new Error(BLOCK_HEADER_ERRORS.INVALID_EPOCH_MARK))
    }

    // Note: Epoch mark entropy1 validation is done in block-importer-service.ts
    // BEFORE the epoch transition is emitted (which rotates entropy).
    // We cannot validate it here because by this point entropy has already been rotated.

    // Verify epoch root matches the validators in the epoch mark
    // Convert ValidatorKeyPair[] to ValidatorPublicKeys[] for verification
    // Note: verifyEpochRoot only uses bandersnatch keys, so we can use zero-filled bls/metadata
    const pendingSet: ValidatorPublicKeys[] = header.epochMark.validators.map(
      (validator) => ({
        bandersnatch: validator.bandersnatch,
        ed25519: validator.ed25519,
        bls: zeroHash, // Not used in epoch root verification
        metadata: zeroHash, // Not used in epoch root verification
      }),
    )

    const nextEpochRoot = validatorSetManagerService.getEpochRoot()

    const [verifyError, isValid] = verifyEpochRoot(nextEpochRoot, pendingSet)
    if (verifyError) {
      return safeError(
        new Error(`Epoch root verification failed: ${verifyError.message}`),
      )
    }
    if (!isValid) {
      return safeError(new Error(BLOCK_HEADER_ERRORS.INVALID_EPOCH_MARK))
    }
  }

  //validate the vrf signature
  const [vrfValidationError, isValid] = validateVRFSignature(
    header,
    validatorSetManagerService,
    verifier,
  )
  if (vrfValidationError) {
    return safeError(vrfValidationError)
  }
  if (!isValid) {
    return safeError(new Error('VRF signature is invalid'))
  }

  //validate the seal signature
  const [sealValidationError] = validateSealSignature(
    header,
    sealKeyService,
    validatorSetManagerService,
    entropyService,
    configService,
    verifier,
  )
  if (sealValidationError) {
    return safeError(sealValidationError)
  }

  return safeResult(undefined)
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
 * @param sealKeyService Seal key service for getting seal key for this slot
 * @param validatorSetManagerService Validator set manager service
 * @returns Validation result
 */
export function validateSealSignature(
  header: BlockHeader,
  sealKeyService: ISealKeyService,
  validatorSetManagerService: IValidatorSetManager,
  entropyService: IEntropyService,
  configService: IConfigService,
  verifier: IETFVRFVerifier | IETFVRFVerifierWasm,
): Safe<void> {
  // Use thetime from state (C(11)) to determine the block's timeslot
  // Gray Paper: thetime' ≡ H_timeslot, so the new block's timeslot = thetime + 1
  // const latestStateTimeslot = clockService.getLatestReportedBlockTimeslot()
  // const blockTimeslot = latestStateTimeslot + 1n

  // Get seal key for the computed timeslot (must match the unsigned header timeslot)
  const [sealKeyError, sealKey] = sealKeyService.getSealKeyForSlot(
    header.timeslot,
  )
  // sealKeyService.getSealKeyForSlot(clockService.getLatestReportedBlockTimeslot() + 1n)
  if (sealKeyError) {
    return safeError(sealKeyError)
  }
  if (!sealKey) {
    return safeError(new Error('Seal key is undefined'))
  }

  // Get validator's Bandersnatch public key from active set
  // According to Gray Paper equation 154, we use the validator from the active set
  const activeValidators = validatorSetManagerService.getActiveValidators()
  if (header.authorIndex < 0 || header.authorIndex >= activeValidators.length) {
    return safeError(new Error(BLOCK_HEADER_ERRORS.INVALID_AUTHOR_INDEX))
  }
  const validatorKeys = activeValidators[Number(header.authorIndex)]
  if (!validatorKeys) {
    return safeError(new Error(BLOCK_HEADER_ERRORS.INVALID_AUTHOR_INDEX))
  }
  const publicKeys = validatorKeys

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
  // Gray Paper Eq. 179-181: (entropy'_1, entropy'_2, entropy'_3) = (entropy_0, entropy_1, entropy_2) when e' > e
  const entropy3 = entropyService.getEntropy3()

  // Determine sealing mode and validate accordingly
  // Check if sealKey is a ticket (has id and entryIndex properties) vs fallback (Uint8Array)
  const isTicketBased = isSafroleTicket(sealKey as SealKey)
  if (isTicketBased) {
    // Ticket-based sealing validation (Gray Paper eq. 147-148)
    const [verificationError, isValid] = verifyTicketBasedSealSignature(
      hexToBytes(publicKeys.bandersnatch),
      hexToBytes(header.sealSig),
      entropy3,
      unsignedHeader,
      sealKey as SafroleTicketWithoutProof,
      configService,
      verifier,
    )
    if (verificationError) {
      return safeError(verificationError)
    }
    if (!isValid) {
      return safeError(new Error(BLOCK_HEADER_ERRORS.BAD_SEAL_SIGNATURE))
    }
  } else {
    // Fallback sealing validation (Gray Paper eq. 154)
    // H_sealsig ∈ bssignature{H_authorbskey}{Xfallback ∥ entropy'_3}{encodeunsignedheader{H}}
    // where H_authorbskey ≡ activeset'[H_authorindex]_vk_bs (Gray Paper eq. 60)
    // For fallback: i = H_authorbskey (Gray Paper eq. 152), so seal key equals H_authorbskey

    // Validate that seal key matches the validator's Bandersnatch key
    // This ensures the seal key sequence was calculated correctly for this epoch
    const sealKeyHex = bytesToHex(sealKey as Uint8Array)
    if (sealKeyHex !== publicKeys.bandersnatch) {
      // Get all active validators to show in log
      const allActiveValidators =
        validatorSetManagerService.getActiveValidators()
      console.error(
        '[validateSealSignature] UNEXPECTED_AUTHOR - seal key mismatch',
        {
          slot: header.timeslot.toString(),
          authorIndex: header.authorIndex,
          sealKeyFromService: sealKeyHex,
          validatorBandersnatchKey: publicKeys.bandersnatch,
          hasEpochMark: !!header.epochMark,
          epochMarkValidatorCount: header.epochMark?.validators?.length ?? 0,
          // Show the validator at authorIndex from epoch_mark if present
          epochMarkValidatorAtIndex:
            header.epochMark?.validators?.[Number(header.authorIndex)]
              ?.bandersnatch ?? 'N/A',
          // Show all active validators for comparison
          activeValidatorSet: allActiveValidators.slice(0, 6).map((v, i) => ({
            index: i,
            bandersnatch: v.bandersnatch,
          })),
        },
      )
      return safeError(new Error(BLOCK_HEADER_ERRORS.UNEXPECTED_AUTHOR))
    }

    // But we use H_authorbskey from active set for verification
    const [verificationError, isValid] = verifyFallbackSealSignature(
      hexToBytes(publicKeys.bandersnatch), // H_authorbskey from activeset'[H_authorindex]_vk_bs
      hexToBytes(header.sealSig),
      entropy3,
      unsignedHeader,
      configService,
      verifier,
    )
    if (verificationError) {
      return safeError(verificationError)
    }
    if (!isValid) {
      return safeError(new Error(BLOCK_HEADER_ERRORS.BAD_SEAL_SIGNATURE))
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
 * @param validatorSetManagerService Validator set manager service
 * @param isEpochTransition Whether this is an epoch transition block
 * @returns Validation result
 */
export function validateVRFSignature(
  header: BlockHeader,
  validatorSetManagerService: IValidatorSetManager,
  verifier: IETFVRFVerifier | IETFVRFVerifierWasm,
): Safe<boolean> {
  // Get validator's Bandersnatch public key from active set
  // On epoch transition, use pending validators (which become the new active set)
  // Gray Paper Eq. 115-118: activeSet' = pendingSet on epoch transition
  const activeValidators = validatorSetManagerService.getActiveValidators()

  if (header.authorIndex < 0 || header.authorIndex >= activeValidators.length) {
    return safeError(new Error(BLOCK_HEADER_ERRORS.INVALID_AUTHOR_INDEX))
  }
  const validatorKeys = activeValidators[Number(header.authorIndex)]
  if (!validatorKeys) {
    return safeError(new Error(BLOCK_HEADER_ERRORS.INVALID_AUTHOR_INDEX))
  }
  const authorPublicKey = hexToBytes(validatorKeys.bandersnatch)

  // Extract VRF output from seal signature using banderout function
  // Gray Paper: banderout{H_sealsig} - first 32 bytes of VRF output hash
  const [extractError, sealOutput] = banderout(hexToBytes(header.sealSig))
  if (extractError) {
    return safeError(extractError)
  }

  // Verify VRF signature using existing entropy VRF verification function
  // Gray Paper Eq. 158: H_vrfsig ∈ bssignature{H_authorbskey}{Xentropy ∥ banderout{H_sealsig}}{[]}
  const [verifyError, isValid] = verifyEntropyVRFSignature(
    authorPublicKey,
    hexToBytes(header.vrfSig),
    sealOutput,
    verifier,
  )
  if (verifyError) {
    return safeError(verifyError)
  }

  if (!isValid) {
    return safeError(new Error('VRF signature is invalid'))
  }

  return safeResult(isValid)
}

export function validateEpochMark(
  header: BlockHeader,
  validatorSetManagerService: IValidatorSetManager,
  entropyService: IEntropyService,
): Safe<void> {
  // Validate epoch mark BEFORE rotation
  // This validation MUST happen BEFORE emitEpochTransition which rotates validator sets
  if (header.epochMark) {
    // Gray Paper: epoch mark's tickets_entropy (entropy1) must match the current entropy1 from state
    const currentEntropy = entropyService.getEntropy()
    if (header.epochMark.entropy1 !== currentEntropy.entropy1) {
      logger.error(
        '[BlockImporter] Epoch mark entropy1 mismatch (before rotation)',
        {
          epochMarkEntropy1: header.epochMark.entropy1,
          stateEntropy1: currentEntropy.entropy1,
        },
      )
      return safeError(new Error(BLOCK_HEADER_ERRORS.INVALID_EPOCH_MARK))
    }
    //TODO: double check if needed
    if (header.epochMark.entropyAccumulator !== currentEntropy.accumulator) {
      logger.error(
        '[BlockImporter] Epoch mark entropy accumulator mismatch (before rotation)',
        {
          epochMarkEntropyAccumulator: header.epochMark.entropyAccumulator,
          stateEntropyAccumulator: currentEntropy.accumulator,
        },
      )
      return safeError(new Error(BLOCK_HEADER_ERRORS.INVALID_EPOCH_MARK))
    }

    // Gray Paper Eq. 115: pendingSet' = Φ(stagingSet)
    // The epoch mark validators must match the staging set
    // Compare epoch mark validators with staging set validators
    const stagingValidators = validatorSetManagerService.getStagingValidators()
    const epochMarkValidators = header.epochMark.validators

    if (epochMarkValidators.length !== stagingValidators.length) {
      logger.error('[BlockImporter] Epoch mark validators count mismatch', {
        epochMarkCount: epochMarkValidators.length,
        stagingCount: stagingValidators.length,
      })
      return safeError(new Error(BLOCK_HEADER_ERRORS.INVALID_EPOCH_MARK))
    }

    // Check each validator matches (order matters!)
    for (let i = 0; i < epochMarkValidators.length; i++) {
      const epochMarkValidator = epochMarkValidators[i]
      const stagingValidator = stagingValidators[i]

      if (
        epochMarkValidator.bandersnatch !== stagingValidator.bandersnatch ||
        epochMarkValidator.ed25519 !== stagingValidator.ed25519
      ) {
        logger.error('[BlockImporter] Epoch mark validator mismatch at index', {
          index: i,
          epochMarkBandersnatch: epochMarkValidator.bandersnatch,
          stagingBandersnatch: stagingValidator.bandersnatch,
          epochMarkEd25519: epochMarkValidator.ed25519,
          stagingEd25519: stagingValidator.ed25519,
        })
        return safeError(new Error(BLOCK_HEADER_ERRORS.INVALID_EPOCH_MARK))
      }
    }
  }
  return safeResult(undefined)
}

export function validatePreStateRoot(
  header: BlockHeader,
  stateService: IStateService,
): Safe<void> {
  const [preStateRootError, preStateRoot] = stateService.getStateRoot()
  if (preStateRootError) {
    return safeError(
      new Error(`Failed to get pre-state root: ${preStateRootError.message}`),
    )
  }

  if (header.priorStateRoot !== preStateRoot) {
    return safeError(
      new Error(
        `Prior state root mismatch: computed ${preStateRoot}, expected ${header.priorStateRoot}. ` +
          `This may indicate decode/encode round-trip issues or state components not being set correctly from test vectors.`,
      ),
    )
  }

  return safeResult(undefined)
}

/**
 * Validate winnersMark in block header (JSON: tickets_mark)
 * Gray Paper Eq. 262-266:
 * H_winnersmark = Z(ticketaccumulator) when e' = e ∧ m < C_epochtailstart ≤ m' ∧ |ticketaccumulator| = C_epochlen
 * Otherwise H_winnersmark = ∅
 *
 * @param header - Block header to validate
 * @param previousSlot - Previous block's slot (from parent)
 * @param ticketAccumulator - Current ticket accumulator from state
 * @param configService - Config service for epoch/contest duration
 * @returns Safe<void> - success or error
 */
export function validateWinnersMark(
  header: BlockHeader,
  previousSlot: bigint,
  ticketAccumulator: SafroleTicketWithoutProof[],
  configService: IConfigService,
): Safe<void> {
  const epochDuration = BigInt(configService.epochDuration)
  const contestDuration = BigInt(configService.contestDuration)

  const currentSlot = header.timeslot
  const previousPhase = previousSlot % epochDuration
  const currentPhase = currentSlot % epochDuration
  const previousEpoch = previousSlot / epochDuration
  const currentEpoch = currentSlot / epochDuration

  // Condition: e' = e (same epoch) ∧ m < C_epochtailstart ≤ m' (crossing into epoch tail)
  const isSameEpoch = currentEpoch === previousEpoch
  const wasBelowTail = previousPhase < contestDuration
  const isAtOrAboveTail = currentPhase >= contestDuration

  // Check if accumulator is full
  const isAccumulatorFull =
    ticketAccumulator.length === configService.epochDuration

  // Determine if winnersMark should be present
  const shouldHaveWinnersMark =
    isSameEpoch && wasBelowTail && isAtOrAboveTail && isAccumulatorFull

  if (shouldHaveWinnersMark) {
    // winnersMark MUST be present and match Z(ticketAccumulator)
    if (!header.winnersMark) {
      return safeError(
        new Error(
          `${BLOCK_HEADER_ERRORS.INVALID_TICKETS_MARK}: Missing winnersMark when required. ` +
            `slot=${currentSlot}, previousPhase=${previousPhase}, currentPhase=${currentPhase}, ` +
            `contestDuration=${contestDuration}, accumulatorSize=${ticketAccumulator.length}`,
        ),
      )
    }

    // Compute Z(ticketAccumulator) - outside-in sequencer
    const expectedTickets = applyOutsideInSequencer(ticketAccumulator)

    // Compare with block header's winnersMark
    if (expectedTickets.length !== header.winnersMark.length) {
      return safeError(
        new Error(
          `${BLOCK_HEADER_ERRORS.INVALID_TICKETS_MARK}: winnersMark length mismatch. ` +
            `expected=${expectedTickets.length}, actual=${header.winnersMark.length}`,
        ),
      )
    }

    for (let i = 0; i < expectedTickets.length; i++) {
      const expected = expectedTickets[i]
      const actual = header.winnersMark[i]

      if (
        expected.id !== actual.id ||
        expected.entryIndex !== actual.entryIndex
      ) {
        return safeError(
          new Error(
            `${BLOCK_HEADER_ERRORS.INVALID_TICKETS_MARK}: winnersMark entry mismatch at index ${i}. ` +
              `expectedId=${expected.id}, actualId=${actual.id}, ` +
              `expectedEntryIndex=${expected.entryIndex}, actualEntryIndex=${actual.entryIndex}`,
          ),
        )
      }
    }
  } else {
    // winnersMark MUST be null/empty
    if (header.winnersMark && header.winnersMark.length > 0) {
      return safeError(
        new Error(
          `${BLOCK_HEADER_ERRORS.INVALID_TICKETS_MARK}: Unexpected winnersMark present. ` +
            `slot=${currentSlot}, previousPhase=${previousPhase}, currentPhase=${currentPhase}, ` +
            `contestDuration=${contestDuration}, accumulatorSize=${ticketAccumulator.length}, ` +
            `isSameEpoch=${isSameEpoch}, wasBelowTail=${wasBelowTail}, isAtOrAboveTail=${isAtOrAboveTail}, ` +
            `isAccumulatorFull=${isAccumulatorFull}`,
        ),
      )
    }
  }

  return safeResult(undefined)
}

/**
 * Apply outside-in sequencer (Z function) to ticket array
 * Gray Paper Eq. 211-215: Z(s) = {s₀, s_{|s|-1}, s₁, s_{|s|-2}, ...}
 */
function applyOutsideInSequencer(
  tickets: SafroleTicketWithoutProof[],
): SafroleTicketWithoutProof[] {
  const result: SafroleTicketWithoutProof[] = []
  const n = tickets.length

  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      // Even indices: take from start (0, 1, 2, ...)
      result.push(tickets[i / 2])
    } else {
      // Odd indices: take from end (n-1, n-2, n-3, ...)
      result.push(tickets[n - 1 - Math.floor(i / 2)])
    }
  }

  return result
}
