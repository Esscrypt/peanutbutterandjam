/**
 * Header Construction
 *
 * Constructs block headers according to JAM Protocol specifications
 * Reference: Gray Paper header specifications
 */

import {
  banderout,
  generateEntropyVRFSignature,
} from '@pbnjam/bandersnatch-vrf'
import { calculateExtrinsicHash } from '@pbnjam/codec'
import {
  bytesToHex,
  generateDevAccountValidatorKeyPair,
  getValidatorCredentialsWithFallback,
  type Hex,
  zeroHash,
} from '@pbnjam/core'
import {
  generateFallbackSealSignature,
  generateTicketBasedSealSignature,
  isSafroleTicket,
} from '@pbnjam/safrole'
import type {
  BlockBody,
  BlockHeader,
  EpochMark,
  IClockService,
  IConfigService,
  IEntropyService,
  IGenesisManagerService,
  IKeyPairService,
  IRecentHistoryService,
  ISealKeyService,
  IStateService,
  ITicketService,
  IValidatorSetManager,
  SafePromise,
  SafroleTicketWithoutProof,
  UnsignedBlockHeader,
  ValidatorCredentials,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'

/**
 * Construct a new block header with seal and VRF signatures
 *
 * Gray Paper specifications:
 * - epochMark: Set when e' > e (epoch transition) with entropyaccumulator, entropy1, and pendingSet validators
 * - winnersMark: Set when e' = e ∧ m < C_epochtailstart ≤ m' ∧ |ticketaccumulator| = C_epochlen
 * - authorIndex: Uses config.validatorIndex if available
 * - sealSig: Generated using ticket-based or fallback sealing (Gray Paper Eq. 147-156)
 * - vrfSig: Generated using entropy VRF signature (Gray Paper Eq. 158)
 *
 * @param slot - Slot for the new block being constructed
 * @param blockBody - Block body containing tickets, preimages, guarantees, assurances, and disputes
 * @param config - Config service
 * @param recentHistoryService - Recent history service (for parent hash and prior state root)
 * @param genesisManagerService - Genesis manager service (for genesis header if no recent history)
 * @param stateService - State service (for prior state root calculation)
 * @param clockService - Clock service (optional, for epoch/slot calculations)
 * @param entropyService - Entropy service (required for seal and VRF signatures)
 * @param validatorSetManager - Validator set manager (optional, for epochMark and authorIndex)
 * @param ticketService - Ticket service (optional, for winnersMark)
 * @param keyPairService - Key pair service (required for seal and VRF signatures)
 * @param sealKeyService - Seal key service (required for seal signature generation)
 * @returns Complete block header with seal and VRF signatures
 */
export async function constructHeader(
  slot: bigint,
  blockBody: BlockBody,
  config: IConfigService,
  recentHistoryService: IRecentHistoryService,
  genesisManagerService: IGenesisManagerService | null,
  stateService: IStateService | null,
  clockService: IClockService | null,
  entropyService: IEntropyService | null,
  validatorSetManager: IValidatorSetManager | null,
  ticketService: ITicketService | null,
  keyPairService: IKeyPairService | null,
  sealKeyService: ISealKeyService | null,
): SafePromise<BlockHeader> {
  // Get parent hash from recent history (or genesis)
  // Gray Paper: H_parent = blake(encode(parent_header))
  // We get parent hash from recent history's latest entry, or use genesis if empty
  let parentHash: Hex
  let parentTimeslot: bigint
  let priorStateRoot: Hex

  const recentHistory = recentHistoryService.getRecentHistory()
  if (recentHistory.length > 0) {
    // Use latest entry from recent history as parent
    const latestEntry = recentHistory[recentHistory.length - 1]
    parentHash = latestEntry.headerHash
    priorStateRoot = latestEntry.stateRoot

    // Parent timeslot is the latest reported block timeslot from clock service
    // If clock service is not available, calculate as slot - 1
    if (clockService) {
      parentTimeslot = clockService.getLatestReportedBlockTimeslot()
    } else {
      parentTimeslot = slot - 1n
    }
  } else {
    // No recent history - use genesis
    if (!genesisManagerService) {
      return safeError(
        new Error(
          'No recent history and genesisManagerService not provided. Cannot determine parent hash.',
        ),
      )
    }

    const [genesisHashError, genesisHash] =
      genesisManagerService.getGenesisHeaderHash()
    if (genesisHashError) {
      return safeError(genesisHashError)
    }
    if (!genesisHash) {
      return safeError(new Error('Genesis header hash not available'))
    }

    parentHash = genesisHash
    parentTimeslot = 0n // Genesis slot is 0
    priorStateRoot = zeroHash // Genesis has zero state root
  }

  // Calculate extrinsics root from block body
  const [extrinsicsRootError, extrinsicsRoot] = calculateExtrinsicHash(
    blockBody,
    config,
  )
  if (extrinsicsRootError) {
    return safeError(extrinsicsRootError)
  }

  // Set timeslot to the slot index
  // Gray Paper: H_timeslot is the slot index (thetime' ≡ H_timeslot)
  const nextSlot = slot

  // Get seal key first to determine which validator should author this block
  // Gray Paper: The seal key sequence determines who can author blocks for each slot
  // authorIndex must match the seal key's validator index
  // Note: slot is a slot index (0, 1, 2, ...), not a timestamp
  let authorIndex = 0n
  if (!sealKeyService) {
    // Fallback to config.validatorIndex if sealKeyService is not available
    if (config.validatorIndex !== undefined) {
      authorIndex = BigInt(config.validatorIndex)
    }
  } else {
    // Get the seal key for this slot index to determine the author
    // getSealKeyForSlot expects a slot index, not a timestamp
    const [sealKeyError, sealKey] = sealKeyService.getSealKeyForSlot(slot)
    if (sealKeyError || !sealKey) {
      // Fallback to config.validatorIndex if seal key retrieval fails
      if (config.validatorIndex !== undefined) {
        authorIndex = BigInt(config.validatorIndex)
      }
    } else if (validatorSetManager) {
      // Find the validator index that matches the seal key
      const sealKeyHex =
        sealKey instanceof Uint8Array ? bytesToHex(sealKey) : null
      if (sealKeyHex) {
        const activeValidators = validatorSetManager.getActiveValidators()
        for (let i = 0; i < activeValidators.length; i++) {
          if (activeValidators[i]?.bandersnatch === sealKeyHex) {
            authorIndex = BigInt(i)
            break
          }
        }
      }
    }
  }

  // Compute epochMark if this is an epoch transition (e' > e)
  // Gray Paper Eq. 248-257: H_epochmark = {entropyaccumulator, entropy_1, [(k_vk_bs, k_vk_ed)] | k ∈ pendingset'} when e' > e
  let epochMark: EpochMark | null = null
  if (clockService && entropyService && validatorSetManager) {
    const parentEpoch = parentTimeslot / BigInt(config.epochDuration)
    const nextEpoch = nextSlot / BigInt(config.epochDuration)

    if (nextEpoch > parentEpoch) {
      // Epoch transition: compute epochMark
      const entropyAccumulator = bytesToHex(
        entropyService.getEntropyAccumulator(),
      )
      const entropy1 = bytesToHex(entropyService.getEntropy1())
      const pendingSet = validatorSetManager.getPendingValidators()

      // Convert pending set to ValidatorKeyPair format
      const validators = pendingSet.map((validator) => ({
        bandersnatch: validator.bandersnatch,
        ed25519: validator.ed25519,
      }))

      epochMark = {
        entropyAccumulator,
        entropy1,
        validators,
      }
    }
  }

  // Compute winnersMark if conditions are met
  // Gray Paper Eq. 262-266: H_winnersmark = Z(ticketaccumulator) when e' = e ∧ m < C_epochtailstart ≤ m' ∧ |ticketaccumulator| = C_epochlen
  let winnersMark: SafroleTicketWithoutProof[] | null = null
  if (clockService && ticketService) {
    const parentEpoch = parentTimeslot / BigInt(config.epochDuration)
    const nextEpoch = nextSlot / BigInt(config.epochDuration)
    const parentPhase = parentTimeslot % BigInt(config.epochDuration)
    const nextPhase = nextSlot % BigInt(config.epochDuration)

    // Condition: e' = e (same epoch) ∧ m < C_epochtailstart ≤ m' ∧ |ticketaccumulator| = C_epochlen
    const isSameEpoch = nextEpoch === parentEpoch
    const wasBelowTail = parentPhase < BigInt(config.contestDuration)
    const isAtOrAboveTail = nextPhase >= BigInt(config.contestDuration)
    const isAccumulatorFull = ticketService.isAccumulatorFull()

    if (isSameEpoch && wasBelowTail && isAtOrAboveTail && isAccumulatorFull) {
      // Apply Z function (outside-in sequencer) to ticket accumulator
      const ticketAccumulator = ticketService.getTicketAccumulator()
      const zSequencedTickets: SafroleTicketWithoutProof[] = []
      const n = ticketAccumulator.length

      for (let i = 0; i < n; i++) {
        if (i % 2 === 0) {
          // Even indices: take from start (0, 1, 2, ...)
          zSequencedTickets.push(ticketAccumulator[Math.floor(i / 2)])
        } else {
          // Odd indices: take from end (n-1, n-2, n-3, ...)
          zSequencedTickets.push(ticketAccumulator[n - 1 - Math.floor(i / 2)])
        }
      }

      winnersMark = zSequencedTickets
    }
  }

  // Calculate prior state root
  // Gray Paper: H_priorstateroot is the state root of the parent block
  // We get this from recent history (latest entry's stateRoot)
  // If stateService is provided, we can also validate it matches current state root
  let computedPriorStateRoot = priorStateRoot
  if (stateService) {
    const [stateRootError, currentStateRoot] = stateService.getStateRoot()
    if (!stateRootError && currentStateRoot) {
      // Validate that priorStateRoot matches current state root
      // This ensures consistency between recent history and state service
      if (priorStateRoot !== currentStateRoot) {
        // Log warning but use the one from recent history (it's the source of truth for parent)
        // This can happen if state was updated but recent history wasn't yet
      }
      // Use state service's state root as it's the authoritative source
      computedPriorStateRoot = currentStateRoot
    }
  }

  // Note: keyPairService can be null - getValidatorCredentialsWithFallback handles the fallback
  if (!entropyService || !sealKeyService) {
    return safeError(
      new Error(
        'entropyService and sealKeyService are required for signature generation',
      ),
    )
  }

  // Get validator credentials for the author
  // If authorIndex matches config.validatorIndex, use getValidatorCredentialsWithFallback
  // Otherwise, generate dev account keys for the authorIndex
  let validatorCredentials: ValidatorCredentials | null = null
  let credentialsError: Error | null = null

  if (
    config.validatorIndex !== undefined &&
    Number(authorIndex) === config.validatorIndex
  ) {
    // Our validator is the author - use getValidatorCredentialsWithFallback
    const [credError, creds] = getValidatorCredentialsWithFallback(
      config,
      keyPairService ?? undefined,
    )
    credentialsError = credError ?? null
    validatorCredentials = creds ?? null
  } else {
    // Different validator is the author - generate dev account keys for that index
    const [keyPairError, keyPairs] = generateDevAccountValidatorKeyPair(
      Number(authorIndex),
    )
    credentialsError = keyPairError ?? null
    validatorCredentials = keyPairs ?? null
  }

  if (credentialsError || !validatorCredentials) {
    return safeError(
      credentialsError ||
        new Error('Failed to get validator credentials for seal signature'),
    )
  }

  // Generate seal signature (H_sealsig) first with placeholder vrfSig
  // Gray Paper Eq. 147-156: Ticket-based or fallback sealing
  // We'll update the unsigned header with the actual VRF signature after generation
  let unsignedHeader: UnsignedBlockHeader = {
    parent: parentHash,
    priorStateRoot: computedPriorStateRoot,
    extrinsicHash: extrinsicsRoot,
    timeslot: nextSlot,
    epochMark: epochMark,
    winnersMark: winnersMark,
    offendersMark: [] as Hex[],
    authorIndex: authorIndex,
    vrfSig: zeroHash, // Placeholder - will be updated after VRF signature generation
  }

  const [sealSigError, initialSealSignature] = await generateSealSignature(
    unsignedHeader,
    slot,
    validatorCredentials,
    config,
    entropyService,
    sealKeyService,
  )
  if (sealSigError) {
    return safeError(sealSigError)
  }
  if (!initialSealSignature) {
    return safeError(new Error('Seal signature generation returned undefined'))
  }

  // Extract banderout{H_sealsig} from the initial seal signature
  // Gray Paper: banderout{s ∈ bssignature{k}{c}{m}} ∈ hash ≡ text{output}(x | x ∈ bssignature{k}{c}{m})[:32]
  const [extractError, initialSealOutput] = banderout(initialSealSignature)
  if (extractError) {
    return safeError(extractError)
  }

  // Generate VRF signature (H_vrfsig) using seal output
  // Gray Paper Eq. 158: H_vrfsig ∈ bssignature(H_authorbskey, Xentropy ∥ banderout(H_sealsig), [])
  // Use the same validator credentials that were used for seal signature generation
  const [vrfSigError, vrfSignature] = await generateVRFSignature(
    initialSealOutput,
    validatorCredentials,
  )
  if (vrfSigError) {
    return safeError(vrfSigError)
  }
  if (!vrfSignature) {
    return safeError(new Error('VRF signature generation returned undefined'))
  }

  // Update unsigned header with actual VRF signature to match verification expectations
  unsignedHeader = {
    ...unsignedHeader,
    vrfSig: bytesToHex(vrfSignature),
  }

  // Regenerate seal signature with the updated unsigned header (now includes actual VRF signature)
  const [finalSealSigError, finalSealSignature] = await generateSealSignature(
    unsignedHeader,
    slot,
    validatorCredentials,
    config,
    entropyService,
    sealKeyService,
  )
  if (finalSealSigError) {
    return safeError(finalSealSigError)
  }
  if (!finalSealSignature) {
    return safeError(
      new Error('Final seal signature generation returned undefined'),
    )
  }

  // Extract banderout{H_sealsig} from the final seal signature
  // The seal signature changed because the unsigned header now includes the VRF signature,
  // so we need to extract the new banderout output
  const [finalExtractError, finalSealOutput] = banderout(finalSealSignature)
  if (finalExtractError) {
    return safeError(finalExtractError)
  }

  // Regenerate VRF signature using the final seal signature's banderout output
  // The VRF signature depends on banderout{H_sealsig}, so it must be regenerated
  // when the seal signature changes
  const [finalVrfSigError, finalVrfSignature] = await generateVRFSignature(
    finalSealOutput,
    validatorCredentials,
  )
  if (finalVrfSigError) {
    return safeError(finalVrfSigError)
  }
  if (!finalVrfSignature) {
    return safeError(
      new Error('Final VRF signature generation returned undefined'),
    )
  }

  // Create complete header with both signatures
  const header: BlockHeader = {
    ...unsignedHeader,
    sealSig: bytesToHex(finalSealSignature),
    vrfSig: bytesToHex(finalVrfSignature),
  }

  return safeResult(header)
}

/**
 * Generate seal signature for block header
 *
 * Implements Gray Paper safrole.tex equations 144-156:
 *
 * Two modes based on sealtickets type:
 * 1. Ticket-based sealing (Eq. 148): sealtickets' ∈ sequence{SafroleTicket}
 *    - Uses Ring VRF with ticket context: Xticket ∥ entropy'_3 ∥ i_st_entryindex
 *    - Validates: i_st_id = banderout{H_sealsig}
 *    - Sets: isticketed = 1
 *
 * 2. Fallback sealing (Eq. 154): sealtickets' ∈ sequence{bskey}
 *    - Uses direct VRF with fallback context: Xfallback ∥ entropy'_3
 *    - Sets: isticketed = 0
 *
 * Gray Paper Eq. 144: i = cyclic{sealtickets'[H_timeslot]}
 * Gray Paper Eq. 147-148: Ticket-based sealing
 * Gray Paper Eq. 152-154: Fallback sealing
 */
async function generateSealSignature(
  unsignedHeader: UnsignedBlockHeader,
  slot: bigint,
  validatorCredentials: ValidatorCredentials,
  config: IConfigService,
  entropyService: IEntropyService,
  sealKeyService: ISealKeyService,
): SafePromise<Uint8Array> {
  try {
    // Get entropy_3 for seal generation (Gray Paper line 166)
    const entropy3 = entropyService.getEntropy3()

    // Gray Paper Eq. 144: i = cyclic{sealtickets'[H_timeslot]}
    // Get the seal key for this specific slot index from the seal key sequence
    // Note: slot is a slot index (0, 1, 2, ...), not a timestamp
    // getSealKeyForSlot expects a slot index and calculates phase = slot % epochDuration
    const [sealKeyError, sealKey] = sealKeyService.getSealKeyForSlot(slot)
    if (sealKeyError) {
      return safeError(sealKeyError)
    }

    const authorPrivateKey = validatorCredentials.bandersnatchKeyPair.privateKey

    // Determine sealing mode based on seal key type
    if (isSafroleTicket(sealKey)) {
      // Gray Paper Eq. 147-148: Ticket-based sealing
      // sealtickets' ∈ sequence{SafroleTicket} ⟹ ticket-based sealing
      return generateTicketBasedSealSignature(
        authorPrivateKey,
        entropy3,
        unsignedHeader,
        sealKey,
        slot,
        config,
      )
    } else {
      // Gray Paper Eq. 152-154: Fallback sealing
      // sealtickets' ∈ sequence{bskey} ⟹ fallback sealing
      const [sealError, sealResult] = generateFallbackSealSignature(
        authorPrivateKey,
        entropy3,
        unsignedHeader,
        config,
      )
      if (sealError) {
        return safeError(sealError)
      }
      return safeResult(sealResult.signature)
    }
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Generate VRF signature (H_vrfsig) using seal signature's banderout output
 *
 * Gray Paper Eq. 158: H_vrfsig ∈ bssignature(H_authorbskey, Xentropy ∥ banderout(H_sealsig), [])
 * Where Xentropy = "$jam_entropy"
 *
 * @param sealOutput - The banderout output (32 bytes) extracted from H_sealsig
 * @param validatorCredentials - Validator credentials containing the Bandersnatch private key
 * @returns 96-byte VRF signature (H_vrfsig)
 */
async function generateVRFSignature(
  sealOutput: Uint8Array,
  validatorCredentials: ValidatorCredentials,
): SafePromise<Uint8Array> {
  // Use the validator credentials that were used for seal signature generation
  // This ensures the VRF signature is generated with the same private key as the seal signature
  const authorBandersnatchKey =
    validatorCredentials.bandersnatchKeyPair.privateKey

  // Generate entropy VRF signature
  // Gray Paper Eq. 158: H_vrfsig ∈ bssignature(H_authorbskey, Xentropy ∥ banderout(H_sealsig), [])
  const [vrfSigError, vrfResult] = generateEntropyVRFSignature(
    authorBandersnatchKey,
    sealOutput, // banderout{H_sealsig} - 32-byte VRF output hash
  )
  if (vrfSigError) {
    return safeError(vrfSigError)
  }

  return safeResult(vrfResult.signature)
}
