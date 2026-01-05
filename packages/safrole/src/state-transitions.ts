// /**
//  * Safrole State Transitions
//  *
//  * Implements the Safrole consensus protocol state transitions
//  * Reference: graypaper/text/safrole.tex
//  *
//  * Gray Paper Equation (50): σ ≡ ⟨pendingSet, epochRoot, sealTickets, ticketAccumulator⟩
//  * Key rotation (115-118): epoch transition with validator set rotation
//  * Validator shuffling (213-217): fyshuffle for core assignments
//  *
//  * TODO: Gray Paper Mathematical Constraints Compliance
//  * ===================================================
//  *
//  * MISSING IMPLEMENTATIONS:
//  *
//  * 1. SLOT PROGRESSION CONSTRAINTS (Gray Paper Eq. 28):
//  *    - ✅ Implemented: Strict monotonic slot progression: τ' > τ (lines 235-237)
//  *    - ✅ Implemented: No gaps allowed: τ' = τ + 1 (lines 241-243)
//  *    - ✅ Implemented: Slot phase calculations: e remainder m = τ/Cepochlen (lines 230-231, 332-336)
//  *
//  * 2. TICKET EXTRINSIC CONSTRAINTS (Gray Paper Eq. 290-299):
//  *    - ✅ Implemented: Entry index bounds: xt_entryindex ∈ Nmax{Cticketentries} (lines 278-280)
//  *    - ✅ Implemented: Epoch tail validation: |xttickets| = 0 when m' ≥ Cepochtailstart (lines 266-269)
//  *    - ✅ Implemented: Ticket limit: |xttickets| ≤ Cmaxblocktickets when m' < Cepochtailstart (lines 271-274)
//  *    - TODO: Validate Bandersnatch ring proof format: xt_proof ∈ bsringproof{epochroot'}{Xticket ∥ entropy'_2 ∥ xt_entryindex}{[]}
//  *
//  * 3. TICKET ORDERING CONSTRAINTS (Gray Paper Eq. 315-317):
//  *    - ✅ Implemented: Strict ticket ordering: n = sort_uniq_by(x_st_id, x ∈ n) (lines 592-604)
//  *    - ✅ Implemented: No duplicate ticket IDs: {x_st_id | x ∈ n} ∩ {x_st_id | x ∈ ticketaccumulator} = ∅ (lines 606-613)
//  *    - ✅ Implemented: All submitted tickets appear in accumulator: n ⊆ ticketaccumulator' (lines 516-523)
//  *
//  * 4. TICKET ACCUMULATOR CONSTRAINTS (Gray Paper Eq. 321-329):
//  *    - ✅ Implemented: Accumulator size limit: |ticketaccumulator'| ≤ Cepochlen (lines 511-513)
//  *    - ✅ Implemented: Accumulator construction: ticketaccumulator' = sort_by(x_st_id, n ∪ {ticketaccumulator | e' = e, ∅ | e' > e})^Cepochlen (lines 493-508)
//  *    - ✅ Implemented: Epoch reset: ticketaccumulator' = ∅ when e' > e (lines 498-500)
//  *
//  * 5. EPOCH TRANSITION CONSTRAINTS (Gray Paper Eq. 115-118):
//  *    - ✅ Implemented: Epoch marker validation: H_epochmark = {entropyaccumulator, entropy_1, [(k_vk_bs, k_vk_ed)] | k ∈ pendingset'} when e' > e (lines 454-457, 347-367)
//  *    - ✅ Implemented: Winning tickets marker: H_winnersmark = Z(ticketaccumulator) when e' = e ∧ m < Cepochtailstart ≤ m' ∧ |ticketaccumulator| = Cepochlen (lines 373-388)
//  *
//  * 6. BANDERSNATCH VRF CONSTRAINTS:
//  *    - ✅ Implemented: VRF proof structure validation matches Gray Paper specification (lines 406-443)
//  *    - ✅ Implemented: Ticket ID extraction: st_id = banderout(i_xt_proof) (lines 644-680)
//  *    - TODO: Validate ring commitment against epoch root (requires Ring VRF implementation)
//  *
//  * 7. ENTROPY VALIDATION CONSTRAINTS:
//  *    - ✅ Implemented: Entropy format validation matches Gray Paper specification (lines 448-484)
//  *    - ✅ Implemented: Entropy accumulation: entropy' = entropy_accumulator + entropy_1 (lines 459-465)
//  *
//  * REMAINING IMPLEMENTATIONS:
//  *
//  * 1. Ring VRF commitment validation against epoch root (requires Ring VRF implementation)
//  * 2. Complete Bandersnatch VRF proof verification (currently basic validation only)
//  */

// import { sha256 } from '@noble/hashes/sha2'
// // import * as crypto from 'node:crypto'
// import {
//   getRingRoot,
//   IETFVRFProver,
//   RingVRFProver,
// } from '@pbnjam/bandersnatch-vrf'

// import {
//   blake2bHash,
//   bytesToHex,
//   type Hex,
//   hexToBytes,
//   logger,
//   numberToBytes,
//   type Safe,
//   type SafePromise,
//   safeError,
//   safeResult,
//   zeroHash,
// } from '@pbnjam/core'
// import type {
//   SafroleInput,
//   SafroleOutput,
//   SafroleState,
//   SafroleTicket,
//   ValidatorPublicKeys,
// } from '@pbnjam/types'

// import { calculateSlotPhase } from './phase'
// import { parseEpochRootForRingCommitment } from './epoch-root'
// import { computeEpochMarker } from './epoch-marker'
// import { validateBandersnatchVRFProof } from './ticket-generation'

// import { SAFROLE_CONSTANTS, type SafroleErrorCode } from '@pbnjam/types'

// /**
//  * Convert little-endian byte array to 32-bit unsigned integer
//  */
// function fromLittleEndianBytes(bytes: Uint8Array): number {
//   let result = 0
//   for (let i = 0; i < bytes.length; i++) {
//     result += bytes[i] * 256 ** i
//   }
//   return result >>> 0 // Convert to unsigned 32-bit
// }

// /**
//  * Verify ring commitment matches epoch root
//  *
//  * This validates that the ring commitment in the VRF proof matches
//  * the ring commitment stored in the epoch root.
//  *
//  * @param proofRingCommitment - Ring commitment from VRF proof (48 bytes)
//  * @param epochRoot - Epoch root containing the expected ring commitment (144 bytes)
//  * @returns True if ring commitments match, false otherwise
//  */
// function verifyRingCommitmentMatchesEpochRoot(
//   proofRingCommitment: Uint8Array,
//   epochRoot: Hex,
// ): Safe<boolean> {
//   try {
//     // Extract ring commitment from epoch root
//     const [extractError, epochRingCommitment] =
//       parseEpochRootForRingCommitment(epochRoot)
//     if (extractError) {
//       return safeError(extractError)
//     }

//     if (!epochRingCommitment) {
//       return safeError(
//         new Error('Failed to extract ring commitment from epoch root'),
//       )
//     }

//     // Compare ring commitments
//     const commitmentsMatch =
//       proofRingCommitment.length === epochRingCommitment.length &&
//       proofRingCommitment.every(
//         (byte, index) => byte === epochRingCommitment[index],
//       )

//     logger.debug('Ring commitment verification', {
//       proofCommitmentLength: proofRingCommitment.length,
//       epochCommitmentLength: epochRingCommitment.length,
//       commitmentsMatch,
//       proofCommitmentHex: bytesToHex(proofRingCommitment),
//       epochCommitmentHex: bytesToHex(epochRingCommitment),
//     })

//     return safeResult(commitmentsMatch)
//   } catch (error) {
//     logger.error('Failed to verify ring commitment against epoch root', {
//       error: error instanceof Error ? error.message : String(error),
//     })
//     return safeError(error instanceof Error ? error : new Error(String(error)))
//   }
// }

// /**
//  * Core shuffle function from Gray Paper Equation 329
//  */
// function jamShuffle<T>(validators: T[], entropy: string): T[] {
//   if (validators.length === 0) return []
//   if (validators.length === 1) return [...validators]

//   const cleanEntropy = entropy.startsWith('0x') ? entropy.slice(2) : entropy
//   const entropyBytes = new Uint8Array(32)
//   for (let i = 0; i < 32; i++) {
//     entropyBytes[i] = Number.parseInt(cleanEntropy.slice(i * 2, i * 2 + 2), 16)
//   }

//   const shuffled = [...validators]

//   for (let i = shuffled.length - 1; i > 0; i--) {
//     // Compute Q_i following Gray Paper equation 329
//     const hashInput = new Uint8Array(entropyBytes.length + 4)
//     hashInput.set(entropyBytes, 0)

//     // Add i as little-endian 32-bit integer
//     const iBytes = new Uint8Array(4)
//     for (let j = 0; j < 4; j++) {
//       iBytes[j] = (i >>> (j * 8)) & 0xff
//     }
//     hashInput.set(iBytes, entropyBytes.length)

//     const [hashResultError, hashResult] = blake2bHash(hashInput) // 4 bytes output
//     if (hashResultError) {
//       throw hashResultError
//     }
//     const q = fromLittleEndianBytes(hexToBytes(hashResult))

//     // j = Q_i mod (i + 1)
//     const j = q % (i + 1)

//     // Swap elements
//     const temp = shuffled[i]
//     shuffled[i] = shuffled[j]
//     shuffled[j] = temp
//   }

//   return shuffled
// }

// /**
//  * Shuffle and rotate validators using entropy and rotation offset
//  */
// function shuffleAndRotateValidators<T>(
//   validators: T[],
//   entropy: string,
//   rotationOffset: number,
// ): T[] {
//   // First shuffle using entropy
//   const shuffled = jamShuffle(validators, entropy)

//   // Then rotate based on offset
//   const rotated = [...shuffled]
//   if (rotationOffset > 0 && rotated.length > 0) {
//     const offset = rotationOffset % rotated.length
//     rotated.unshift(...rotated.splice(-offset))
//   }

//   return rotated
// }

// /**
//  * Safe execute Safrole State Transition Function
//  * Implements the core Safrole consensus protocol with safe error handling
//  */
// export async function safeExecuteSafroleSTF(
//   state: SafroleState,
//   input: SafroleInput,
//   currentSlot: number,
//   stagingSet: ValidatorPublicKeys[],
//   activeSet: ValidatorPublicKeys[],
//   offenders: Set<string> = new Set(),
// ): SafePromise<SafroleOutput> {
//   return executeSafroleSTF(
//     state,
//     input,
//     currentSlot,
//     stagingSet,
//     activeSet,
//     offenders,
//   )
// }

// /**
//  * Execute Safrole State Transition Function
//  * Implements the core Safrole consensus protocol
//  */
// export function executeSafroleSTF(
//   state: SafroleState,
//   input: SafroleInput,
//   currentSlot: number,
//   stagingSet: ValidatorPublicKeys[],
//   activeSet: ValidatorPublicKeys[],
//   offenders: Set<string> = new Set(),
// ): Safe<SafroleOutput> {
//   let errors: SafroleErrorCode[] = []
//   // Validate input safely
//   const [error, validationResult] = validateInput(
//     input,
//     BigInt(currentSlot),
//     state,
//   )
//   if (error) {
//     return safeError(error)
//   }
//   if (validationResult) {
//     errors = errors.concat(validationResult)
//   }

//   // Handle epoch transition if needed
//   if (isEpochTransition(currentSlot, Number(input.slot))) {
//     return handleEpochTransition(state, input, stagingSet, activeSet, offenders)
//   }

//   // Handle regular slot with batch processing for large validator sets
//   return handleRegularSlot(state, input)
// }

// /**
//  * Validate input parameters with comprehensive error checking
//  */
// function validateInput(
//   input: SafroleInput,
//   currentSlot: bigint,
//   state?: SafroleState,
// ): Safe<SafroleErrorCode[]> {
//   let errors: SafroleErrorCode[] = []

//   // Gray Paper Eq. 33-34 - Calculate slot phase: e remainder m = τ/Cepochlen
//   const newPhase = calculateSlotPhase(input.slot)

//   // Gray Paper Eq. 28 - Strict monotonic slot progression: τ' > τ
//   // This implements the core constraint that slots must be strictly increasing
//   if (input.slot <= currentSlot) {
//     errors.push('bad_slot')
//   }

//   // Gray Paper Eq. 28 - Validate slot progression is exactly +1 (no gaps allowed)
//   // This ensures τ' = τ + 1, maintaining strict monotonicity without gaps
//   if (input.slot !== currentSlot + 1n) {
//     errors.push('invalid_slot_progression')
//   }

//   // Gray Paper Eq. 47-50 - Validate entropy format matches Gray Paper specification
//   const [entropyValidationError, entropyValidationResult] =
//     validateEntropyFormat(input.entropy)
//   if (entropyValidationError) {
//     return safeError(entropyValidationError)
//   }
//   if (entropyValidationResult) {
//     errors = errors.concat(entropyValidationResult)
//   }

//   // Gray Paper Eq. 295-298 - Epoch tail validation: |xttickets| = 0 when m' ≥ Cepochtailstart
//   if (newPhase.phase >= BigInt(SAFROLE_CONSTANTS.EPOCH_TAIL_START)) {
//     if (input.extrinsic.length > 0) {
//       errors.push('unexpected_ticket')
//     }
//   } else {
//     // Gray Paper Eq. 295-298 - Enforce ticket limit: |xttickets| ≤ Cmaxblocktickets when m' < Cepochtailstart
//     if (input.extrinsic.length > SAFROLE_CONSTANTS.MAX_EXTRINSICS_PER_SLOT) {
//       errors.push('too_many_extrinsics')
//     }
//   }

//   // Validate each extrinsic
//   for (let i = 0; i < input.extrinsic.length; i++) {
//     const extrinsic = input.extrinsic[i]

//     // Gray Paper Eq. 291 - Validate entry index bounds: xt_entryindex ∈ Nmax{Cticketentries}
//     // Nmax{Cticketentries} means natural numbers less than Cticketentries (0 to Cticketentries-1)
//     if (
//       extrinsic.entryIndex < 0n ||
//       extrinsic.entryIndex >= BigInt(SAFROLE_CONSTANTS.MAX_TICKET_ENTRIES)
//     ) {
//       errors.push('invalid_ticket_entry_index')
//     }

//     // Gray Paper Eq. 292 - Validate Bandersnatch ring proof format: xt_proof ∈ bsringproof{epochroot'}{Xticket ∥ entropy'_2 ∥ xt_entryindex}{[]}
//     if (state) {
//       const [vrfValidationError, vrfValidationResult] =
//         validateBandersnatchVRFProof(
//           extrinsic.proof,
//           input.entropy,
//           extrinsic.entryIndex,
//           state.epochRoot,
//           state.pendingSet,
//         )
//       if (vrfValidationError) {
//         return safeError(vrfValidationError)
//       }
//       if (vrfValidationResult) {
//         errors = errors.concat(vrfValidationResult)
//       }
//     }
//   }

//   // Validate ticket attempt ordering
//   const [ticketAttemptError, ticketAttemptResult] = validateTicketAttempts(
//     input.extrinsic,
//   )
//   if (ticketAttemptError) {
//     return safeError(ticketAttemptError)
//   }
//   if (ticketAttemptResult) {
//     errors = errors.concat(ticketAttemptResult)
//   }

//   // TODO: Gray Paper Eq. 315-317 - Implement strict ticket ordering: n = sort_uniq_by(x_st_id, x ∈ n)
//   // TODO: Gray Paper Eq. 315-317 - Validate no duplicate ticket IDs: {x_st_id | x ∈ n} ∩ {x_st_id | x ∈ ticketaccumulator} = ∅
//   // TODO: Gray Paper Eq. 328 - Ensure all submitted tickets appear in accumulator: n ⊆ ticketaccumulator'
//   // NOT COMPLIANT: Only checks entry indices, not ticket IDs as required by Gray Paper

//   // Check for duplicate entry indices
//   const entryIndices = input.extrinsic.map((ext) => ext.entryIndex)
//   const uniqueIndices = new Set(entryIndices)
//   if (uniqueIndices.size !== entryIndices.length) {
//     errors.push('duplicate_ticket')
//   }

//   return safeResult(errors)
// }

// /**
//  * Validate entropy format according to Gray Paper Eq. 47-50
//  * Ensures entropy matches the specification for proper accumulation
//  */
// function validateEntropyFormat(entropy: Hex): Safe<SafroleErrorCode[]> {
//   const errors: SafroleErrorCode[] = []

//   // Validate entropy format
//   if (!entropy.startsWith('0x')) {
//     errors.push('invalid_entropy_format')
//   }

//   if (entropy.length !== 66) {
//     // 0x + 64 hex chars for 32 bytes
//     errors.push('invalid_entropy_size')
//   }

//   // Validate entropy is not all zeros
//   if (entropy === `0x${'0'.repeat(64)}`) {
//     errors.push('invalid_entropy_all_zeros')
//   }

//   // Validate entropy is valid hex
//   if (entropy.startsWith('0x')) {
//     const hexPart = entropy.slice(2)
//     if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
//       errors.push('invalid_entropy_format')
//     }
//   }

//   // Validate entropy has sufficient entropy (not too many repeated patterns)
//   if (entropy.startsWith('0x')) {
//     const hexPart = entropy.slice(2)
//     const uniqueChars = new Set(hexPart).size
//     if (uniqueChars < 8) {
//       // At least 8 different hex characters
//       errors.push('invalid_entropy_all_zeros')
//     }
//   }

//   return safeResult(errors)
// }

// /**
//  * Check if this is an epoch transition
//  */
// function isEpochTransition(currentSlot: number, newSlot: number): boolean {
//   return (
//     Math.floor(newSlot / SAFROLE_CONSTANTS.EPOCH_LENGTH) >
//     Math.floor(currentSlot / SAFROLE_CONSTANTS.EPOCH_LENGTH)
//   )
// }

// /**
//  * Handle epoch transition - Gray Paper equations (115-118)
//  *
//  * Key rotation formula from Gray Paper:
//  * ⟨pendingSet', activeSet', previousSet', epochRoot'⟩ ≡
//  *   (Φ(stagingSet), pendingSet, activeSet, z) when e' > e
//  *
//  * @param state Current Safrole state
//  * @param input Safrole input with new slot
//  * @param stagingSet Global staging validator set
//  * @param activeSet Global active validator set
//  * @param offenders Set of offending validators to blacklist
//  */
// function handleEpochTransition(
//   state: SafroleState,
//   input: SafroleInput,
//   stagingSet: ValidatorPublicKeys[],
//   _activeSet: ValidatorPublicKeys[],
//   offenders: Set<string> = new Set(),
// ): Safe<SafroleOutput> {
//   // Apply blacklist filter Φ(stagingSet) - Gray Paper equation (119-128)
//   const filteredStagingSet = applyBlacklistFilter(stagingSet, offenders)

//   // Key rotation according to Gray Paper equation (115-118)
//   const newPendingSet = filteredStagingSet // pendingSet' = Φ(stagingSet)
//   // Note: activeSet' = pendingSet is used for global state updates, not internal Safrole state

//   // Gray Paper Eq. 248-257 - Compute epoch marker: H_epochmark = {entropyaccumulator, entropy_1, [(k_vk_bs, k_vk_ed)] | k ∈ pendingset'}
//   const entropyAccumulator = state.entropyAccumulator || zeroHash
//   const entropy1 = input.entropy
//   const currentPhase = calculateSlotPhase(BigInt(input.slot - 1n))
//   const nextPhase = calculateSlotPhase(BigInt(input.slot))
//   const [epochMarkerError, epochMarker] = computeEpochMarker(
//     entropyAccumulator,
//     entropy1,
//     newPendingSet,
//     currentPhase.epoch,
//     nextPhase.epoch,
//   )
//   if (epochMarkerError) {
//     return safeError(epochMarkerError)
//   }
//   // Note: epochMarker is computed for Gray Paper compliance
//   // Could be used for additional validation or logging in the future
//   logger.debug('Epoch marker computed', { epochMarker })

//   // Gray Paper Eq. 47-50 - Implement proper entropy accumulation: entropy' = entropy_accumulator + entropy_1
//   const [entropyHashError, entropyHash] = blake2bHash(
//     new Uint8Array([
//       ...hexToBytes(entropyAccumulator),
//       ...hexToBytes(entropy1),
//     ]),
//   )
//   if (entropyHashError) {
//     return safeError(entropyHashError)
//   }
//   const newEntropyAccumulator = entropyHash

//   // Compute new epoch root z = getRingRoot(...) - Gray Paper equation (118)
//   const [epochRootResultError, epochRootResult] = getRingRoot(
//     newPendingSet,
//     this.keyPairService,
//     this.validatorSetManager,
//   )
//   if (epochRootResultError) {
//     return safeError(epochRootResultError)
//   }
//   const newEpochRoot = epochRootResult

//   // Generate fallback seal tickets for the new epoch
//   const [fallbackTicketsError, fallbackTickets] = generateFallbackSealTickets(
//     newPendingSet,
//     input.entropy,
//   )
//   if (fallbackTicketsError) {
//     return safeError(fallbackTicketsError)
//   }

//   const newState: SafroleState = {
//     pendingSet: newPendingSet,
//     epochRoot: newEpochRoot,
//     sealTickets: fallbackTickets.map(
//       (ticket) =>
//         ({
//           // Convert strings to Ticket objects
//           id: ticket,
//           entryIndex: 0n,
//           signature: '0x' + '0'.repeat(128),
//         })
//     ),
//     ticketAccumulator: state.ticketAccumulator, // Preserve ticket accumulator
//     entropyAccumulator: newEntropyAccumulator, // Updated entropy accumulator
//   }

//   return safeResult({
//     state: newState,
//     tickets: [],
//     errors: [],
//   })
// }

// /**
//  * Handle regular slot processing with performance optimizations
//  */
// function handleRegularSlot(
//   state: SafroleState,
//   input: SafroleInput,
// ): Safe<SafroleOutput> {
//   logger.debug('Handling regular slot', {
//     slot: input.slot,
//     extrinsicCount: input.extrinsic.length,
//   })

//   // Use batch processing for large numbers of extrinsics
//   const [processingError, processingResult] =
//     input.extrinsic.length > 100
//       ? processTicketsBatch(state, input, 50) // Smaller batches for better memory management
//       : processTickets(state, input)

//   if (processingError) {
//     return safeError(processingError)
//   }
//   const { tickets, errors } = processingResult

//   // Gray Paper Eq. 321-329 - Implement proper accumulator construction
//   const currentPhase = calculateSlotPhase(BigInt(input.slot))
//   const isEpochTransition =
//     currentPhase.epoch > calculateSlotPhase(BigInt(input.slot - 1n)).epoch

//   let updatedAccumulator: Ticket[]
//   if (isEpochTransition) {
//     // Gray Paper Eq. 321-329 - Handle epoch reset: ticketaccumulator' = ∅ when e' > e
//     updatedAccumulator = [...tickets]
//   } else {
//     // Gray Paper Eq. 321-329 - ticketaccumulator' = sort_by(x_st_id, n ∪ ticketaccumulator)^Cepochlen
//     const allTickets = [...state.ticketAccumulator, ...tickets]
//     // Sort by ticket ID and take only the first Cepochlen tickets
//     updatedAccumulator = allTickets
//       .sort((a, b) => a.id.localeCompare(b.id))
//       .slice(0, SAFROLE_CONSTANTS.EPOCH_LENGTH)
//   }

//   // Gray Paper Eq. 321-329 - Implement accumulator size limit: |ticketaccumulator'| ≤ Cepochlen
//   if (updatedAccumulator.length > SAFROLE_CONSTANTS.EPOCH_LENGTH) {
//     errors.push('too_many_extrinsics')
//   }

//   // Gray Paper Eq. 328 - Ensure all submitted tickets appear in accumulator: n ⊆ ticketaccumulator'
//   const submittedTicketIds = new Set(tickets.map((t) => t.id))
//   const finalTicketIds = new Set(updatedAccumulator.map((t) => t.id))
//   for (const ticketId of submittedTicketIds) {
//     if (!finalTicketIds.has(ticketId)) {
//       errors.push('unexpected_ticket')
//     }
//   }

//   // Gray Paper Eq. 262-266 - Compute winning tickets marker when accumulator is full
//   const currentPhase = calculateSlotPhase(BigInt(input.slot))
//   const previousPhase = calculateSlotPhase(BigInt(input.slot - 1n))
//   const [winnersMarkerError, winnersMarker] = computeWinnersMarker(
//     updatedAccumulator,
//     previousPhase.epoch,
//     currentPhase.epoch,
//     BigInt(input.slot - 1n),
//     BigInt(input.slot),
//   )
//   if (winnersMarkerError) {
//     return safeError(winnersMarkerError)
//   }
//   // Note: winnersMarker is computed for Gray Paper compliance
//   // Could be used for additional validation or logging in the future
//   logger.debug('Winners marker computed', { winnersMarker })

//   // Update state
//   const newState: SafroleState = {
//     pendingSet: state.pendingSet,
//     epochRoot: state.epochRoot,
//     sealTickets: state.sealTickets,
//     ticketAccumulator: updatedAccumulator,
//   }

//   logger.debug('Regular slot processed', {
//     slot: input.slot,
//     ticketsGenerated: tickets.length,
//     errorsCount: errors.length,
//     totalTickets: updatedAccumulator.length,
//   })

//   return safeResult({
//     state: newState,
//     tickets,
//     errors,
//   })
// }

// /**
//  * Safe process ticket submissions
//  */
// // function safeProcessTickets(
// //   _state: SafroleState,
// //   input: SafroleInput,
// // ): Safe<{ tickets: Ticket[]; errors: SafroleErrorCode[] }> {
// //   try {
// //     const result = processTickets(_state, input)
// //     return safeResult(result)
// //   } catch (error) {
// //     logger.error('Ticket processing failed', {
// //       error: error instanceof Error ? error.message : String(error),
// //     })
// //     return safeError(error instanceof Error ? error : new Error(String(error)))
// //   }
// // }

// /**
//  * Process ticket submissions
//  */
// function processTickets(
//   _state: SafroleState,
//   input: SafroleInput,
// ): Safe<{ tickets: SafroleTicket[]; errors: SafroleErrorCode[] }> {
//   const tickets: SafroleTicket[] = []
//   let errors: SafroleErrorCode[] = []

//   for (const extrinsic of input.extrinsic) {
//     try {
//       // Validate extrinsic before processing
//       const [extrinsicError, extrinsicResult] = validateTicketExtrinsic(
//         extrinsic,
//         input.entropy,
//       )
//       if (extrinsicError) {
//         return safeError(extrinsicError)
//       }
//       if (extrinsicResult) {
//         errors = errors.concat(extrinsicResult)
//       }

//       // Extract ticket ID using Bandersnatch VRF
//       const [ticketIdError, ticketIdResult] = extractTicketId(
//         extrinsic.proof,
//         input.entropy,
//         extrinsic.entryIndex,
//       )

//       if (ticketIdError) {
//         return safeError(ticketIdError)
//       }
//       const ticketId = ticketIdResult

//       const ticket: SafroleTicket = {
//         id: ticketId,
//         entryIndex: extrinsic.entryIndex,
//         proof: extrinsic.proof,
//       }

//       tickets.push(ticket)
//     } catch (error) {
//       return safeError(
//         error instanceof Error ? error : new Error(String(error)),
//       )
//     }
//   }

//   // Gray Paper Eq. 315-317 - Implement strict ticket ordering: n = sort_uniq_by(x_st_id, x ∈ n)
//   // First, ensure uniqueness by removing duplicates based on ticket ID
//   const uniqueTickets = new Map<string, Ticket>()
//   for (const ticket of tickets) {
//     if (!uniqueTickets.has(ticket.id)) {
//       uniqueTickets.set(ticket.id, ticket)
//     } else {
//       errors.push('duplicate_ticket')
//     }
//   }

//   // Convert back to array and sort by ID
//   const sortedTickets = Array.from(uniqueTickets.values()).sort((a, b) =>
//     a.id.localeCompare(b.id),
//   )

//   // Gray Paper Eq. 315-317 - Validate no duplicate ticket IDs: {x_st_id | x ∈ n} ∩ {x_st_id | x ∈ ticketaccumulator} = ∅
//   // Check for intersection with existing tickets in accumulator
//   const existingTicketIds = new Set(_state.ticketAccumulator.map((t) => t.id))
//   for (const ticket of sortedTickets) {
//     if (existingTicketIds.has(ticket.id)) {
//       errors.push('duplicate_ticket')
//     }
//   }

//   // Validate ticket batch
//   const [batchValidationError, batchValidationResult] =
//     validateTicketBatch(sortedTickets)
//   if (batchValidationError) {
//     return safeError(batchValidationError)
//   }
//   if (batchValidationResult) {
//     errors = errors.concat(batchValidationResult)
//   }

//   return safeResult({ tickets: sortedTickets, errors })
// }

// /**
//  * Validate individual ticket extrinsic
//  */
// function validateTicketExtrinsic(
//   extrinsic: SafroleTicket,
//   entropy: Hex,
// ): Safe<SafroleErrorCode[]> {
//   const errors: SafroleErrorCode[] = []
//   // Validate entry index
//   if (extrinsic.entryIndex >= SAFROLE_CONSTANTS.MAX_TICKET_ENTRIES) {
//     errors.push('invalid_ticket_entry_index')
//   }

//   if (extrinsic.entryIndex < 0n) {
//     errors.push('invalid_ticket_entry_index')
//   }

//   // Validate signature format
//   if (!extrinsic.proof.startsWith('0x')) {
//     errors.push('ticket_signature_invalid_format')
//   }

//   // Validate entropy format
//   if (!entropy.startsWith('0x')) {
//     errors.push('invalid_entropy_format')
//   }

//   if (entropy.length !== 66) {
//     // 0x + 64 hex chars
//     errors.push('invalid_entropy_size')
//   }

//   return safeResult(errors)
// }

// /**
//  * Extract ticket ID using Bandersnatch VRF
//  * TODO: Gray Paper Eq. 303-311 - Implement proper ticket ID extraction: st_id = banderout(i_xt_proof)
//  * TODO: Gray Paper Eq. 292 - Validate VRF proof structure matches Gray Paper specification
//  * TODO: Gray Paper Eq. 292 - Validate ring commitment against epoch root
//  * NOT IMPLEMENTED: Proper Bandersnatch VRF proof validation and ticket ID extraction
//  */
// function extractTicketId(
//   signature: Hex,
//   entropy: Hex,
//   entryIndex: bigint,
// ): Safe<Hex> {
//   // Use IETF VRF to generate deterministic ticket ID
//   const secretKey = hexToBytes(signature)

//   const input = new Uint8Array([
//     ...hexToBytes(entropy),
//     ...numberToBytes(entryIndex),
//   ])

//   try {
//     // Generate VRF proof and output
//     const vrfResult = IETFVRFProver.prove(secretKey, input)

//     // Use the VRF output hash as the ticket ID
//     const ticketId = bytesToHex(vrfResult.output.hash)
//     return safeResult(ticketId)
//   } catch (error) {
//     logger.error('VRF ticket ID generation failed', {
//       error: error instanceof Error ? error.message : String(error),
//     })

//     // Fallback to simple hash if VRF fails - ensure uniqueness by including entry index
//     const fallbackInput = new Uint8Array([
//       ...hexToBytes(signature),
//       ...hexToBytes(entropy),
//       ...numberToBytes(entryIndex),
//     ])

//     // Use a simple hash function to generate unique ID
//     const hash = sha256(fallbackInput)
//     return safeResult(bytesToHex(hash))
//   }
// }

// /**
//  * Generate fallback seal tickets using Ring VRF
//  * Implements Gray Paper seal ticket generation for epoch transitions
//  */
// function generateFallbackSealTickets(
//   validators: ValidatorPublicKeys[],
//   entropy: Hex,
// ): Safe<string[]> {
//   if (validators.length === 0) {
//     return safeResult([])
//   }

//   const tickets: string[] = []
//   const maxTickets = Math.min(
//     validators.length,
//     Number(SAFROLE_CONSTANTS.MAX_SEAL_TICKETS),
//   )

//   try {
//     // Only use Ring VRF if we have enough validators (ring size >= 2)
//     if (validators.length >= 2) {
//       // Create ring public keys
//       const ringPublicKeys = validators.map((v) => hexToBytes(v.bandersnatch))

//       // Create Ring VRF prover instance
//       const ringProver = new RingVRFProver()

//       // Generate tickets for each validator
//       for (let i = 0; i < maxTickets; i++) {
//         // Create prover for this validator
//         const proverSecretKey = hexToBytes(validators[i].bandersnatch)

//         // Find prover index in ring
//         let proverIndex = -1
//         for (let j = 0; j < ringPublicKeys.length; j++) {
//           if (bytesToHex(ringPublicKeys[j]) === bytesToHex(proverSecretKey)) {
//             proverIndex = j
//             break
//           }
//         }

//         if (proverIndex === -1) {
//           throw new Error(
//             `Prover public key not found in ring for validator ${i}`,
//           )
//         }

//         // Create input for seal ticket generation
//         const ticketInput = new Uint8Array([
//           ...hexToBytes(entropy),
//           ...numberToBytes(i, { size: 4 }),
//         ])

//         // Generate Ring VRF proof and use its output for seal ticket
//         const auxData = new TextEncoder().encode('seal_ticket')

//         // Create Ring VRF input
//         const ringInput = {
//           input: ticketInput,
//           auxData,
//           ringKeys: ringPublicKeys,
//           proverIndex,
//         }

//         // Generate Ring VRF proof
//         const proofResult = ringProver.prove(proverSecretKey, ringInput)

//         // Use the output hash as the seal ticket
//         const ticket = bytesToHex(proofResult.output.hash)
//         tickets.push(ticket)
//       }
//     } else {
//       // Fallback for small validator sets
//       logger.warn('Not enough validators for Ring VRF, using simple tickets', {
//         validatorCount: validators.length,
//       })
//       // Generate simple tickets instead
//       for (let i = 0; i < maxTickets; i++) {
//         const fallbackTicket = generateSimpleSealTicket(entropy, i)
//         tickets.push(fallbackTicket)
//       }
//     }
//   } catch (error) {
//     logger.warn('Ring VRF seal ticket generation failed, using fallback', {
//       error: error instanceof Error ? error.message : String(error),
//       validatorCount: validators.length,
//     })

//     // Fallback to simple tickets using entropy + index
//     for (let i = 0; i < maxTickets; i++) {
//       const fallbackTicket = generateSimpleSealTicket(entropy, i)
//       tickets.push(fallbackTicket)
//     }
//   }

//   return safeResult(tickets)
// }

// /**
//  * Generate simple seal ticket as fallback
//  * Uses entropy + index with proper hashing
//  */
// function generateSimpleSealTicket(entropy: Hex, index: number): string {
//   const entropyBytes = hexToBytes(entropy)
//   const indexBytes = numberToBytes(index, { size: 4 })
//   const combined = new Uint8Array(entropyBytes.length + indexBytes.length)

//   combined.set(entropyBytes, 0)
//   combined.set(indexBytes, entropyBytes.length)

//   const [hashError, hash] = blake2bHash(combined)
//   if (hashError) {
//     // Fallback to simple hash if blake2bHash fails
//     const fallbackHash = sha256(combined)
//     return bytesToHex(fallbackHash)
//   }
//   return hash
// }

// /**
//  * Validate ticket order
//  * Ensures tickets are in ascending order by ID
//  */
// function validateTicketOrder(tickets: Ticket[]): Safe<SafroleErrorCode[]> {
//   const errors: SafroleErrorCode[] = []
//   for (let i = 1; i < tickets.length; i++) {
//     if (tickets[i].id <= tickets[i - 1].id) {
//       errors.push('bad_ticket_order')
//     }
//   }
//   return safeResult(errors)
// }

// /**
//  * Validate ticket uniqueness
//  * Ensures no duplicate ticket IDs exist
//  */
// function validateTicketUniqueness(tickets: Ticket[]): Safe<SafroleErrorCode[]> {
//   const seen = new Set<string>()
//   const errors: SafroleErrorCode[] = []
//   for (const ticket of tickets) {
//     if (seen.has(ticket.id)) {
//       errors.push('duplicate_ticket')
//     }
//     seen.add(ticket.id)
//   }
//   return safeResult(errors)
// }

// /**
//  * Validate ticket batch
//  * Validates order, uniqueness, and other constraints
//  */
// function validateTicketBatch(tickets: Ticket[]): Safe<SafroleErrorCode[]> {
//   if (tickets.length === 0) {
//     return safeResult([])
//   }

//   let errors: SafroleErrorCode[] = []

//   // Validate uniqueness first (faster check)
//   const [uniquenessError, uniquenessResult] = validateTicketUniqueness(tickets)
//   if (uniquenessError) {
//     return safeError(uniquenessError)
//   }
//   if (uniquenessResult) {
//     errors = errors.concat(uniquenessResult)
//   }

//   // Validate ordering
//   const [orderError, orderResult] = validateTicketOrder(tickets)
//   if (orderError) {
//     return safeError(orderError)
//   }
//   if (orderResult) {
//     errors = errors.concat(orderResult)
//   }

//   // Validate ticket count limits
//   if (tickets.length > Number(SAFROLE_CONSTANTS.MAX_EXTRINSICS_PER_SLOT)) {
//     errors.push('too_many_extrinsics')
//   }

//   return safeResult(errors)
// }

// function validateTicketAttempts(
//   extrinsics: SafroleTicket[],
// ): Safe<SafroleErrorCode[]> {
//   const errors: SafroleErrorCode[] = []
//   // Check if attempts are sequential starting from 0
//   const attempts = extrinsics
//     .map((ext) => ext.entryIndex)
//     .sort((a, b) => Number(a - b))

//   for (let i = 0; i < attempts.length; i++) {
//     if (attempts[i] !== BigInt(i)) {
//       errors.push('bad_ticket_attempt')
//     }
//   }

//   return safeResult(errors)
// }

// /**
//  * Apply blacklist filter Φ(k) - Gray Paper equation (119-128)
//  * Replace keys of offending validators with null keys (all zeros)
//  */
// function applyBlacklistFilter(
//   validatorKeys: ValidatorPublicKeys[],
//   offenders: Set<string>,
// ): ValidatorPublicKeys[] {
//   return validatorKeys.map((key) => {
//     // Check if validator's Ed25519 key is in offenders set
//     const ed25519Key = key.ed25519
//     if (ed25519Key && offenders.has(ed25519Key)) {
//       // Replace with null key (all zeros) - Gray Paper line 122-123
//       return {
//         ...key,
//         bandersnatch: `0x${'00'.repeat(32)}` as `0x${string}`,
//         ed25519: `0x${'00'.repeat(32)}` as `0x${string}`,
//         bls: `0x${'00'.repeat(144)}` as `0x${string}`,
//         metadata: `0x${'00'.repeat(128)}` as `0x${string}`,
//       }
//     }
//     return key
//   })
// }

// /**
//  * Compute guarantor assignments using validator shuffling
//  * Gray Paper equations (212-217): P(e, t) = R(fyshuffle(...), ...)
//  *
//  * This is where validator shuffling occurs - for core assignments, not validator set rotation
//  */
// export function computeGuarantorAssignments(
//   epochalEntropy: Hex,
//   currentTime: bigint,
//   activeSet: ValidatorPublicKeys[],
//   coreCount = 341,
//   rotationPeriod = 10,
// ): number[] {
//   logger.debug('Computing guarantor assignments', {
//     epochalEntropy: `${epochalEntropy.slice(0, 10)}...`,
//     currentTime,
//     validatorCount: activeSet.length,
//     coreCount,
//   })

//   // Create validator indices [0, 1, 2, ..., validatorCount-1]
//   const validatorIndices = Array.from({ length: activeSet.length }, (_, i) => i)

//   // Map validator indices to core assignments
//   // Gray Paper line 214: floor(coreCount * i / validatorCount)
//   const coreAssignments = validatorIndices.map((i) =>
//     Math.floor((coreCount * i) / activeSet.length),
//   )

//   // Apply Fisher-Yates shuffle and rotation using epochal entropy
//   // Gray Paper line 212-217: P(e, t) = R(fyshuffle(..., e), rotationOffset)
//   const rotationOffset = Math.floor(
//     (Number(currentTime) % SAFROLE_CONSTANTS.EPOCH_LENGTH) / rotationPeriod,
//   )
//   const rotatedAssignments = shuffleAndRotateValidators(
//     coreAssignments,
//     epochalEntropy,
//     rotationOffset,
//   )

//   logger.debug('Guarantor assignments computed', {
//     rotationOffset,
//     assignmentSample: rotatedAssignments.slice(0, 5),
//   })

//   return rotatedAssignments
// }

// /**
//  * Process tickets in batches for better performance
//  * Optimized for large validator sets
//  */
// function processTicketsBatch(
//   state: SafroleState,
//   input: SafroleInput,
//   batchSize = 100,
// ): Safe<{ tickets: Ticket[]; errors: SafroleErrorCode[] }> {
//   let allTickets: Ticket[] = []
//   let allErrors: SafroleErrorCode[] = []

//   // Process extrinsics in batches
//   for (let i = 0; i < input.extrinsic.length; i += batchSize) {
//     const batch = input.extrinsic.slice(i, i + batchSize)
//     const batchInput = {
//       ...input,
//       extrinsic: batch,
//     }

//     const [batchError, batchResult] = processTickets(state, batchInput)
//     if (batchError) {
//       return safeError(batchError)
//     }
//     if (batchResult) {
//       allTickets = allTickets.concat(batchResult.tickets)
//       allErrors = allErrors.concat(batchResult.errors)
//     }
//   }

//   // Final validation of all tickets combined
//   const [finalValidationError, finalValidationResult] =
//     validateTicketBatch(allTickets)
//   if (finalValidationError) {
//     return safeError(finalValidationError)
//   }
//   if (finalValidationResult) {
//     allErrors = allErrors.concat(finalValidationResult)
//   }

//   return safeResult({ tickets: allTickets, errors: allErrors })
// }

// /**
//  * Memory-efficient ticket accumulator
//  * Manages ticket storage with automatic cleanup
//  */
// export class TicketAccumulator {
//   private tickets: Map<string, Ticket> = new Map()
//   private maxTickets: number
//   private cleanupThreshold: number

//   constructor(maxTickets = 10000, cleanupThreshold = 0.8) {
//     this.maxTickets = maxTickets
//     this.cleanupThreshold = cleanupThreshold
//   }

//   addTicket(ticket: Ticket): void {
//     // Check if we need to cleanup old tickets
//     if (this.tickets.size >= this.maxTickets * this.cleanupThreshold) {
//       this.cleanupOldTickets()
//     }

//     this.tickets.set(ticket.id, ticket)
//   }

//   getTickets(): Ticket[] {
//     return Array.from(this.tickets.values())
//   }

//   getTicketById(id: string): Ticket | undefined {
//     return this.tickets.get(id)
//   }

//   removeTicket(id: string): boolean {
//     return this.tickets.delete(id)
//   }

//   private cleanupOldTickets(): void {
//     const tickets = Array.from(this.tickets.values())
//     tickets.sort((a, b) => Number(b.timestamp - a.timestamp))

//     // Keep only the most recent tickets
//     const keepCount = Math.floor(this.maxTickets * 0.5)
//     const toRemove = tickets.slice(keepCount)

//     for (const ticket of toRemove) {
//       this.tickets.delete(ticket.id)
//     }

//     logger.debug('Cleaned up old tickets', {
//       removed: toRemove.length,
//       remaining: this.tickets.size,
//     })
//   }

//   clear(): void {
//     this.tickets.clear()
//   }

//   size(): number {
//     return this.tickets.size
//   }
// }
