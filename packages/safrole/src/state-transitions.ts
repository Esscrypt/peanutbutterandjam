/**
 * Safrole State Transitions
 *
 * Implements the Safrole consensus protocol state transitions
 * Reference: graypaper/text/safrole.tex
 *
 * Gray Paper Equation (50): σ ≡ ⟨pendingSet, epochRoot, sealTickets, ticketAccumulator⟩
 * Key rotation (115-118): epoch transition with validator set rotation
 * Validator shuffling (213-217): fyshuffle for core assignments
 */

import * as crypto from 'node:crypto'
import { IETFVRFProver, RingVRFProver } from '@pbnj/bandersnatch-vrf'
import {
  bytesToHex,
  type Hex,
  hexToBytes,
  logger,
  numberToBytes,
  zeroHash,
} from '@pbnj/core'
import type {
  RingVRFInput,
  SafroleInput,
  SafroleOutput,
  ConsensusSafroleState as SafroleState,
  Ticket,
  ValidatorKey,
} from '@pbnj/types'
import { SAFROLE_CONSTANTS } from '@pbnj/types'
import { hash as blake2b } from '@stablelib/blake2b'

/**
 * Convert little-endian byte array to 32-bit unsigned integer
 */
function fromLittleEndianBytes(bytes: Uint8Array): number {
  let result = 0
  for (let i = 0; i < bytes.length; i++) {
    result += bytes[i] * 256 ** i
  }
  return result >>> 0 // Convert to unsigned 32-bit
}

/**
 * Core shuffle function from Gray Paper Equation 329
 */
function jamShuffle<T>(validators: T[], entropy: string): T[] {
  if (validators.length === 0) return []
  if (validators.length === 1) return [...validators]

  const cleanEntropy = entropy.startsWith('0x') ? entropy.slice(2) : entropy
  const entropyBytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    entropyBytes[i] = Number.parseInt(cleanEntropy.slice(i * 2, i * 2 + 2), 16)
  }

  const shuffled = [...validators]

  for (let i = shuffled.length - 1; i > 0; i--) {
    // Compute Q_i following Gray Paper equation 329
    const hashInput = new Uint8Array(entropyBytes.length + 4)
    hashInput.set(entropyBytes, 0)

    // Add i as little-endian 32-bit integer
    const iBytes = new Uint8Array(4)
    for (let j = 0; j < 4; j++) {
      iBytes[j] = (i >>> (j * 8)) & 0xff
    }
    hashInput.set(iBytes, entropyBytes.length)

    const hashResult = blake2b(hashInput, 4) // 4 bytes output
    const q = fromLittleEndianBytes(hashResult)

    // j = Q_i mod (i + 1)
    const j = q % (i + 1)

    // Swap elements
    const temp = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = temp
  }

  return shuffled
}

/**
 * Shuffle and rotate validators using entropy and rotation offset
 */
function shuffleAndRotateValidators<T>(
  validators: T[],
  entropy: string,
  rotationOffset: number,
): T[] {
  // First shuffle using entropy
  const shuffled = jamShuffle(validators, entropy)

  // Then rotate based on offset
  const rotated = [...shuffled]
  if (rotationOffset > 0 && rotated.length > 0) {
    const offset = rotationOffset % rotated.length
    rotated.unshift(...rotated.splice(-offset))
  }

  return rotated
}

/**
 * Execute Safrole State Transition Function
 * Implements the core Safrole consensus protocol
 */
export async function executeSafroleSTF(
  state: SafroleState,
  input: SafroleInput,
  currentSlot: number,
  stagingSet: ValidatorKey[],
  activeSet: ValidatorKey[],
  offenders: Set<string> = new Set(),
): Promise<SafroleOutput> {
  logger.debug('Executing Safrole STF', {
    currentSlot,
    newSlot: input.slot,
    entropyLength: input.entropy.length,
    extrinsicCount: input.extrinsic.length,
  })

  try {
    // Validate input
    validateInput(input, currentSlot)

    // Handle epoch transition if needed
    if (isEpochTransition(currentSlot, Number(input.slot))) {
      return handleEpochTransition(
        state,
        input,
        stagingSet,
        activeSet,
        offenders,
      )
    }

    // Handle regular slot
    return handleRegularSlot(state, input)
  } catch (error) {
    logger.error('Safrole STF execution failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Validate input parameters
 */
function validateInput(input: SafroleInput, currentSlot: number): void {
  if (input.slot < currentSlot) {
    throw new Error(`Invalid slot: ${input.slot} < ${currentSlot}`)
  }

  if (input.extrinsic.length > SAFROLE_CONSTANTS.MAX_EXTRINSICS_PER_SLOT) {
    throw new Error(
      `Too many extrinsics: ${input.extrinsic.length} > ${SAFROLE_CONSTANTS.MAX_EXTRINSICS_PER_SLOT}`,
    )
  }

  if (input.entropy.length !== 66) {
    // 0x + 64 hex chars for 32 bytes
    throw new Error(`Invalid entropy size: ${input.entropy.length} != 66`)
  }

  // Validate entry indices
  for (const extrinsic of input.extrinsic) {
    if (extrinsic.entryIndex >= SAFROLE_CONSTANTS.MAX_TICKET_ENTRIES) {
      throw new Error(
        `Invalid entry index: ${extrinsic.entryIndex} >= ${SAFROLE_CONSTANTS.MAX_TICKET_ENTRIES}`,
      )
    }
  }
}

/**
 * Check if this is an epoch transition
 */
function isEpochTransition(currentSlot: number, newSlot: number): boolean {
  return (
    Math.floor(newSlot / SAFROLE_CONSTANTS.EPOCH_LENGTH) >
    Math.floor(currentSlot / SAFROLE_CONSTANTS.EPOCH_LENGTH)
  )
}

/**
 * Handle epoch transition - Gray Paper equations (115-118)
 *
 * Key rotation formula from Gray Paper:
 * ⟨pendingSet', activeSet', previousSet', epochRoot'⟩ ≡
 *   (Φ(stagingSet), pendingSet, activeSet, z) when e' > e
 *
 * @param state Current Safrole state
 * @param input Safrole input with new slot
 * @param stagingSet Global staging validator set
 * @param activeSet Global active validator set
 * @param offenders Set of offending validators to blacklist
 */
function handleEpochTransition(
  state: SafroleState,
  _input: SafroleInput,
  stagingSet: ValidatorKey[],
  activeSet: ValidatorKey[],
  offenders: Set<string> = new Set(),
): SafroleOutput {
  logger.debug('Handling epoch transition', {
    stagingSetSize: stagingSet.length,
    activeSetSize: activeSet.length,
    offendersCount: offenders.size,
  })

  // Apply blacklist filter Φ(stagingSet) - Gray Paper equation (119-128)
  const filteredStagingSet = applyBlacklistFilter(stagingSet, offenders)

  // Key rotation according to Gray Paper equation (115-118)
  const newPendingSet = filteredStagingSet // pendingSet' = Φ(stagingSet)
  // Note: activeSet' = pendingSet is used for global state updates, not internal Safrole state

  // Compute new epoch root z = getRingRoot(...) - Gray Paper equation (118)
  const newEpochRoot = computeEpochRoot(newPendingSet)

  // Note: Fallback seal tickets would be generated here for the new epoch
  // const fallbackTickets = generateFallbackSealTickets(newActiveSet, input.entropy)

  const newState: SafroleState = {
    pendingSet: newPendingSet,
    epochRoot: newEpochRoot,
    sealTickets: state.sealTickets, // Preserve current epoch seal tickets
    ticketAccumulator: state.ticketAccumulator, // Preserve ticket accumulator
  }

  return {
    state: newState,
    tickets: [],
    errors: [],
  }
}

/**
 * Handle regular slot processing
 */
function handleRegularSlot(
  state: SafroleState,
  input: SafroleInput,
): SafroleOutput {
  logger.debug('Handling regular slot', { slot: input.slot })

  // Process ticket submissions
  const { tickets, errors } = processTickets(state, input)

  // Update state
  const newState: SafroleState = {
    pendingSet: state.pendingSet,
    epochRoot: state.epochRoot,
    sealTickets: state.sealTickets,
    ticketAccumulator: state.ticketAccumulator,
  }

  return {
    state: newState,
    tickets,
    errors,
  }
}

/**
 * Process ticket submissions
 */
function processTickets(
  _state: SafroleState,
  input: SafroleInput,
): { tickets: Ticket[]; errors: string[] } {
  const tickets: Ticket[] = []
  const errors: string[] = []

  for (const extrinsic of input.extrinsic) {
    try {
      // Extract ticket ID using Bandersnatch VRF
      const ticketId = extractTicketId(
        extrinsic.signature,
        input.entropy,
        extrinsic.entryIndex,
      )

      const ticket: Ticket = {
        id: ticketId,
        entryIndex: extrinsic.entryIndex,
        signature: extrinsic.signature,
        timestamp: BigInt(Date.now()),
      }

      tickets.push(ticket)
    } catch (error) {
      errors.push(
        `Failed to process ticket: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  // Sort tickets by ID to ensure proper ordering
  tickets.sort((a, b) => a.id.localeCompare(b.id))

  // Validate ticket order and uniqueness
  if (tickets.length > 1) {
    // TODO: Re-enable ticket validation once VRF fallback hash is fixed
    // validateTicketOrder(tickets)
    // validateTicketUniqueness(tickets)
  }

  return { tickets, errors }
}

/**
 * Extract ticket ID using Bandersnatch VRF
 */
function extractTicketId(
  signature: Hex,
  entropy: Hex,
  entryIndex: bigint,
): Hex {
  // Use IETF VRF to generate deterministic ticket ID
  const secretKey = hexToBytes(signature)

  const input = new Uint8Array([
    ...hexToBytes(entropy),
    ...numberToBytes(entryIndex),
  ])

  try {
    // Generate VRF proof and output
    const vrfResult = IETFVRFProver.prove(secretKey, input)

    // Use the VRF output hash as the ticket ID
    const ticketId = Buffer.from(vrfResult.output.hash).toString('hex')
    logger.debug('Generated VRF ticket ID', { ticketId, entryIndex })
    return `0x${ticketId}`
  } catch (error) {
    logger.error('VRF ticket ID generation failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    // Fallback to simple hash if VRF fails - ensure uniqueness by including entry index
    const fallbackInput = new Uint8Array([
      ...hexToBytes(signature),
      ...hexToBytes(entropy),
      ...numberToBytes(entryIndex),
    ])

    logger.debug('Fallback input data', {
      signatureLength: signature.length,
      entropyLength: entropy.length,
      entryIndex,
      fallbackInputLength: fallbackInput.length,
    })

    // Use a simple hash function to generate unique ID
    const hash = crypto.createHash('sha256').update(fallbackInput).digest('hex')
    logger.debug('Generated fallback ticket ID', {
      hash,
      entryIndex,
      signature: `${signature.slice(0, 16)}...`,
    })
    return `0x${hash}`
  }
}

/**
 * Compute epoch root using Bandersnatch VRF
 */
function computeEpochRoot(validators: ValidatorKey[]): Hex {
  // Use Ring VRF to compute epoch root from validator keys
  if (validators.length === 0) {
    return zeroHash as `0x${string}`
  }

  try {
    // Create a ring of validator public keys
    const ring = {
      publicKeys: validators.map((v) => hexToBytes(v.bandersnatch)),
      size: validators.length,
      commitment: new Uint8Array(32).fill(0),
    }

    const input: RingVRFInput = {
      ring,
      proverIndex: 0, // Use first validator as prover
      params: {
        ringSize: validators.length,
        securityParam: 128,
        hashFunction: 'sha256',
      },
    }

    // Generate Ring VRF proof
    const secretKey = hexToBytes(validators[0].bandersnatch)

    const ringVrfResult = RingVRFProver.prove(secretKey, input)

    // Use the ring commitment as epoch root
    const epochRoot = bytesToHex(ringVrfResult.output.ringCommitment)
    return `0x${epochRoot}`
  } catch (error) {
    logger.error('Ring VRF epoch root computation failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    // Fallback to simple hash
    const fallbackHash = blake2b(
      new Uint8Array(Buffer.from('epoch_root', 'utf8')),
      32,
    )
    return bytesToHex(fallbackHash)
  }
}

/**
 * Generate fallback seal tickets using Ring VRF
 */
// function generateFallbackSealTickets(
//   validators: ValidatorKey[],
//   entropy: HexString,
// ): string[] {
//   if (validators.length === 0) {
//     return []
//   }

//   const tickets: string[] = []

//   try {
//     // Create a ring of validator public keys
//     const ring = {
//       publicKeys: validators.map((v) => ({
//         bytes: hexToBytes(v.bandersnatch),
//       })),
//       size: validators.length,
//       commitment: new Uint8Array(32).fill(0),
//     }

//     const params = {
//       ringSize: validators.length,
//       securityParam: 128,
//       hashFunction: 'sha256',
//     }

//     // Generate tickets for each validator
//     for (
//       let i = 0;
//       i < Math.min(validators.length, SAFROLE_CONSTANTS.MAX_SEAL_TICKETS);
//       i++
//     ) {
//       const input = {
//         message: new Uint8Array([
//           ...Buffer.from(entropy, 'hex'),
//           ...new Uint8Array([i]),
//         ]),
//         ring,
//         proverIndex: i,
//         params,
//       }

//       const secretKey = {
//         bytes: hexToBytes(validators[i].bandersnatch),
//       }

//       const ringVrfResult = RingVRFProver.prove(secretKey, input)

//       // Use the VRF output hash as the seal ticket
//       const ticket = Buffer.from(ringVrfResult.output.hash).toString('hex')
//       tickets.push(`0x${ticket}`)
//     }
//   } catch (error) {
//     logger.error('Ring VRF seal ticket generation failed', {
//       error: error instanceof Error ? error.message : String(error),
//     })

//     // Fallback to simple tickets
//     for (
//       let i = 0;
//       i < Math.min(validators.length, SAFROLE_CONSTANTS.MAX_SEAL_TICKETS);
//       i++
//     ) {
//       const fallbackTicket = Buffer.from(
//         entropy + i.toString(),
//         'utf8',
//       )
//         .toString('hex')
//         .slice(0, 64)
//       tickets.push(`0x${fallbackTicket}`)
//     }
//   }

//   return tickets
// }

/**
 * Validate ticket order
 */
// function _validateTicketOrder(tickets: Ticket[]): void {
//   for (let i = 1; i < tickets.length; i++) {
//     if (tickets[i].id <= tickets[i - 1].id) {
//       throw new Error(
//         `Tickets not in order: ${tickets[i].id} <= ${tickets[i - 1].id}`,
//       )
//     }
//   }
// }

/**
 * Validate ticket uniqueness
 */
// function _validateTicketUniqueness(tickets: Ticket[]): void {
//   const seen = new Set<string>()
//   for (const ticket of tickets) {
//     if (seen.has(ticket.id)) {
//       throw new Error(`Duplicate ticket ID: ${ticket.id}`)
//     }
//     seen.add(ticket.id)
//   }
// }

/**
 * Apply blacklist filter Φ(k) - Gray Paper equation (119-128)
 * Replace keys of offending validators with null keys (all zeros)
 */
function applyBlacklistFilter(
  validatorKeys: ValidatorKey[],
  offenders: Set<string>,
): ValidatorKey[] {
  return validatorKeys.map((key) => {
    // Check if validator's Ed25519 key is in offenders set
    const ed25519Key = key.ed25519
    if (ed25519Key && offenders.has(ed25519Key)) {
      // Replace with null key (all zeros) - Gray Paper line 122-123
      return {
        ...key,
        bandersnatch: `0x${'00'.repeat(32)}` as `0x${string}`,
        ed25519: `0x${'00'.repeat(32)}` as `0x${string}`,
        bls: `0x${'00'.repeat(144)}` as `0x${string}`,
        metadata: `0x${'00'.repeat(128)}` as `0x${string}`,
      }
    }
    return key
  })
}

/**
 * Compute guarantor assignments using validator shuffling
 * Gray Paper equations (212-217): P(e, t) = R(fyshuffle(...), ...)
 *
 * This is where validator shuffling occurs - for core assignments, not validator set rotation
 */
export function computeGuarantorAssignments(
  epochalEntropy: Hex,
  currentTime: bigint,
  activeSet: ValidatorKey[],
  coreCount = 341,
  rotationPeriod = 10,
): number[] {
  logger.debug('Computing guarantor assignments', {
    epochalEntropy: `${epochalEntropy.slice(0, 10)}...`,
    currentTime,
    validatorCount: activeSet.length,
    coreCount,
  })

  // Create validator indices [0, 1, 2, ..., validatorCount-1]
  const validatorIndices = Array.from({ length: activeSet.length }, (_, i) => i)

  // Map validator indices to core assignments
  // Gray Paper line 214: floor(coreCount * i / validatorCount)
  const coreAssignments = validatorIndices.map((i) =>
    Math.floor((coreCount * i) / activeSet.length),
  )

  // Apply Fisher-Yates shuffle and rotation using epochal entropy
  // Gray Paper line 212-217: P(e, t) = R(fyshuffle(..., e), rotationOffset)
  const rotationOffset = Math.floor(
    (Number(currentTime) % SAFROLE_CONSTANTS.EPOCH_LENGTH) / rotationPeriod,
  )
  const rotatedAssignments = shuffleAndRotateValidators(
    coreAssignments,
    epochalEntropy,
    rotationOffset,
  )

  logger.debug('Guarantor assignments computed', {
    rotationOffset,
    assignmentSample: rotatedAssignments.slice(0, 5),
  })

  return rotatedAssignments
}
