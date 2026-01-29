import {
  RingVRFProver,
  type RingVRFProverW3F,
  type RingVRFProverWasm,
  type RingVRFVerifierW3F,
  type RingVRFVerifierWasm,
} from '@pbnjam/bandersnatch-vrf'
import { bytesToHex, hexToBytes, logger } from '@pbnjam/core'
import type {
  IConfigService,
  IEntropyService,
  IKeyPairService,
  IValidatorSetManager,
  Safe,
  SafroleTicket,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { generateTicketProof } from './generate-ring-proof'

/**
 * Generate tickets for submission according to Gray Paper specifications
 *
 * ============================================================================
 * GRAY PAPER SPECIFICATION:
 * ============================================================================
 *
 * Gray Paper safrole.tex equations 289-292:
 * xt_tickets ∈ sequence{⟨xt_entryindex, xt_proof⟩}
 * where:
 *   xt_entryindex ∈ N_max{C_ticketentries}
 *   xt_proof ∈ bsringproof{epochroot'}{Xticket ∥ entropy'_2 ∥ xt_entryindex}{[]}
 *
 * Gray Paper safrole.tex equation 161:
 * Xticket = "$jam_ticket_seal"
 *
 * Gray Paper safrole.tex equation 305:
 * st_id = banderout{i_xt_proof}  (ticket ID is banderout of the proof)
 *
 * Gray Paper safrole.tex equation 75:
 * SafroleTicket ≡ {st_id ∈ hash, st_entryindex ∈ ticketentryindex}
 *
 * Gray Paper bandersnatch.tex line 12-17:
 * The singly-contextualized Bandersnatch Ring VRF proofs bsringproof{r}{c}{m}
 * are a zk-SNARK-enabled analogue utilizing the Pedersen VRF.
 *
 * bsringproof{r ∈ ringroot}{c ∈ hash}{m ∈ blob} ⊂ blob[784]
 * banderout{p ∈ bsringproof{r}{c}{m}} ∈ hash ≡ text{output}(x | x ∈ bsringproof{r}{c}{m})[:32]
 *
 * @param validatorSecretKey - Validator's Bandersnatch SECRET key (32 bytes)
 * @param ringKeys - All validator public keys in the ring
 * @param proverIndex - Index of this validator in the ring
 * @param entropy2 - Second-oldest epoch entropy (32 bytes)
 * @param maxTickets - Maximum tickets to generate (C_maxblocktickets)
 * @returns Array of SafroleTicket objects with IDs (banderout) and entry indices
 */
function generateTickets(
  validatorSecretKey: Uint8Array,
  ringKeys: Uint8Array[],
  proverIndex: number,
  entropy2: Uint8Array,
  prover: RingVRFProverWasm | RingVRFProverW3F,
  configService: IConfigService,
): Safe<SafroleTicket[]> {
  const maxTickets = configService.ticketsPerValidator
  // Validate inputs
  if (validatorSecretKey.length !== 32) {
    return safeError(new Error('Validator secret key must be 32 bytes'))
  }

  if (proverIndex < 0 || proverIndex >= ringKeys.length) {
    return safeError(new Error('Invalid prover index'))
  }

  // Get entropy_2 for ticket generation
  if (entropy2.length !== 32) {
    return safeError(new Error('entropy_2 must be 32 bytes'))
  }

  // Generate tickets according to Gray Paper specifications
  const tickets: SafroleTicket[] = []

  // Sort ring keys for deterministic ordering (same as getRingRoot and verification)
  const sortedRingKeys = [...ringKeys].sort((a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] < b[i]) return -1
      if (a[i] > b[i]) return 1
    }
    return a.length - b.length
  })

  // Process each contest slot (entry index) from 0 to C_ticketentries - 1
  for (let entryIndex = 0; entryIndex < maxTickets; entryIndex++) {
    // Check if we've reached the maximum number of tickets
    if (tickets.length >= maxTickets) {
      break // Respect C_maxblocktickets limit
    }

    // Generate Ring VRF proof using the helper function
    // Message is empty [] for tickets (Gray Paper equation 292)
    const [proofError, proofResult] = generateTicketProof(
      validatorSecretKey,
      entropy2,
      entryIndex,
      new Uint8Array(0), // Empty message for tickets
      sortedRingKeys, // Use sorted keys for consistent ring ordering
      proverIndex,
      prover,
    )

    if (proofError) {
      logger.warn('Failed to generate Ring VRF proof', {
        entryIndex,
        error: proofError.message,
      })
      continue
    }

    if (!proofResult) {
      logger.warn('No proof result returned', { entryIndex })
      continue
    }

    // Verify the proof is the correct length (288 bytes per bandersnatch-vrf-spec)
    if (proofResult.proof.length !== 288) {
      logger.warn('Serialized Ring VRF proof has unexpected length', {
        expected: 288,
        actual: proofResult.proof.length,
      })
    }

    // Create SafroleTicket object according to Gray Paper equation 75
    // st_id = banderout{i_xt_proof} (Gray Paper equation 305)
    tickets.push({
      id: bytesToHex(proofResult.banderoutResult), // st_id = banderout(proof)
      entryIndex: BigInt(entryIndex), // st_entryindex
      proof: bytesToHex(proofResult.proof), // xt_proof (for verification)
    })
  }

  // Gray Paper equation 315-317: Tickets must be sorted by ticket ID
  tickets.sort((a, b) => {
    // Compare hex strings character by character
    if (a.id < b.id) return -1
    if (a.id > b.id) return 1
    return 0
  })

  return safeResult(tickets)
}

/**
 * Generate tickets for the specified epoch
 * Fetches all necessary constituents for generateTickets function
 */
export function generateTicketsForEpoch(
  validatorSetManager: IValidatorSetManager,
  keyPairService: IKeyPairService,
  entropyService: IEntropyService,
  prover: RingVRFProverWasm | RingVRFProverW3F,
  configService: IConfigService,
): Safe<SafroleTicket[]> {
  // 1. Get validator secret key
  const localKeyPair = keyPairService.getLocalKeyPair()
  const localValidatorSecretKey = localKeyPair.bandersnatchKeyPair.privateKey

  const ringKeys = validatorSetManager.getActiveValidatorKeys()

  // 3. Get prover index (this validator's index in the ring)
  const [proverIndexError, proverIndex] = validatorSetManager.getValidatorIndex(
    bytesToHex(localKeyPair.ed25519KeyPair.publicKey),
  )
  if (proverIndexError) {
    return safeError(proverIndexError)
  }

  // 4. Get entropy2 (second-oldest epoch entropy)      // Get entropy_2 for ticket generation
  const entropy2 = entropyService.getEntropy2()

  // 5. Generate tickets
  const [error, tickets] = generateTickets(
    localValidatorSecretKey,
    ringKeys,
    Number(proverIndex),
    entropy2,
    prover,
    configService,
  )

  if (error) {
    return safeError(error)
  }

  if (!tickets || tickets.length === 0) {
    return safeError(new Error('Failed to generate tickets'))
  }

  return safeResult(tickets)
}

/**
 * Validate Bandersnatch VRF proof according to Gray Paper Eq. 292
 * xt_proof ∈ bsringproof{epochroot'}{Xticket ∥ entropy'_2 ∥ xt_entryindex}{[]}
 *
 * This validates Ring VRF proofs (bsringproof) as specified in the Gray Paper.
 * Ring VRF proofs are 784-byte proofs that provide anonymity by proving membership
 * in a ring of validators.
 */
export function verifyTicket(
  ticket: SafroleTicket,
  entropyService: IEntropyService,
  validatorSetManager: IValidatorSetManager,
  ringVerifier: RingVRFVerifierWasm | RingVRFVerifierW3F,
): Safe<boolean> {
  // Gray Paper Eq. 292: Validate proof format - must be 288 bytes per bandersnatch-vrf-spec
  const proofBytes = hexToBytes(ticket.proof)
  if (proofBytes.length !== 784) {
    return safeError(
      new Error(
        'Invalid Ring VRF proof size, expected 784 bytes, got ' +
          proofBytes.length +
          ' bytes',
      ),
    )
  }

  const entropy2 = entropyService.getEntropy2()

  // Gray Paper Eq. 161: Xticket = "$jam_ticket_seal"
  const XTICKET_SEAL = new TextEncoder().encode('jam_ticket_seal')

  // Gray Paper Eq. 292: Create VRF context: Xticket ∥ entropy'_2 ∥ xt_entryindex
  // Use the same encoding as generateTicketProof for consistency
  // Cticketentries = 2, so entryIndex can only be 0 or 1 (1 byte sufficient)

  const entryIndexBytes = new Uint8Array(1)
  entryIndexBytes[0] = Number(ticket.entryIndex)

  // Gray Paper Eq. 292: context = Xticket ∥ entropy'_2 ∥ xt_entryindex
  // Construct vrfContext by concatenating bytes (spread operator doesn't work on Uint8Array)
  const vrfContext = new Uint8Array(
    XTICKET_SEAL.length + entropy2.length + entryIndexBytes.length,
  )
  let offset = 0
  vrfContext.set(XTICKET_SEAL, offset)
  offset += XTICKET_SEAL.length
  vrfContext.set(entropy2, offset)
  offset += entropy2.length
  vrfContext.set(entryIndexBytes, offset)

  // Gray Paper Eq. 292: Empty message for tickets: m = []
  const vrfMessage = new Uint8Array(0)

  // Deserialize the Ring VRF result (output + proof)
  const ringVRFResult = RingVRFProver.deserialize(proofBytes)

  // RingVRFVerifier will handle all proof structure validation internally
  // Use the same active validator keys that were used during generation
  const ringKeys = validatorSetManager.getActiveValidatorKeys()

  // Gray Paper: Ring VRF proofs are anonymous - we don't need to know which validator
  // created the proof. The verification only needs the ring keys, proof, and context.
  // The proverIndex is not used during verification (it's only needed during proof generation).
  // Step 2: Create Ring VRF input for verification
  const ringVRFInput = {
    input: vrfContext,
    auxData: vrfMessage,
    ringKeys: ringKeys,
    proverIndex: 0, // Not used during verification - Ring VRF is anonymous
  }

  // Step 4: Perform Ring VRF verification using RingVRFVerifier
  // The verifier now internally deserializes gamma and proofs from the serialized result
  const isValid = ringVerifier.verify(
    ringKeys,
    ringVRFInput,
    ringVRFResult,
    vrfMessage,
  )

  if (!isValid) {
    // Use generic "bad signature batch" error message for conformance with jam-conformance
    return safeError(new Error('bad signature batch'))
  }

  return safeResult(true)
}

/**
 * Determine proxy validator index using JAMNP-S specification
 * "The index of the proxy validator for a ticket is determined by interpreting
 * the last 4 bytes of the ticket's VRF output as a big-endian unsigned integer,
 * modulo the number of validators"
 */
export function determineProxyValidator(
  ticket: SafroleTicket,
  validatorSetManager: IValidatorSetManager,
): number {
  // Extract last 4 bytes from ticket ID (which is the banderout from VRF)
  // Note: ticket.id is the banderout (first 32 bytes of VRF output)
  // We need the last 4 bytes of the VRF output, which would be bytes 28-31 of the banderout
  const ticketIdBytes = hexToBytes(ticket.id)
  const last4Bytes = ticketIdBytes.slice(-4)

  // Interpret as big-endian unsigned integer
  const view = new DataView(
    last4Bytes.buffer,
    last4Bytes.byteOffset,
    last4Bytes.byteLength,
  )
  const proxyIndex = view.getUint32(0, false) // false = big-endian

  const totalValidators = validatorSetManager.getActiveValidators().length

  // Modulo the number of validators
  const finalIndex = proxyIndex % totalValidators

  return finalIndex
}

// getTicketIdFromProof moved to @pbnjam/core to break circular dependency
// Re-exported from safrole index.ts for backward compatibility

// isSafroleTicket moved to @pbnjam/types to break circular dependency
// Re-exported from safrole index.ts for backward compatibility
