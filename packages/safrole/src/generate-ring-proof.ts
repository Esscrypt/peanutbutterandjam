import { getBanderoutFromGamma, RingVRFProver } from '@pbnj/bandersnatch-vrf'
import { type Safe, safeError, safeResult } from '@pbnj/core'

// Xticket = "$jam_ticket_seal" (Gray Paper safrole.tex equation 161)
const Xticket = new TextEncoder().encode('$jam_ticket_seal')

/**
 * bsringproof - Generate Ring VRF proof according to Gray Paper specification
 *
 * ============================================================================
 * GRAY PAPER SPECIFICATION:
 * ============================================================================
 *
 * Gray Paper notation.tex line 169:
 * bsringproof{r ∈ ringroot}{x ∈ blob}{m ∈ blob} ⊂ blob[784]
 *
 * Gray Paper safrole.tex equation 292:
 * xt_proof ∈ bsringproof{epochroot'}{Xticket ∥ entropy'_2 ∥ xt_entryindex}{[]}
 *
 * Gray Paper safrole.tex equation 161:
 * Xticket = "$jam_ticket_seal"
 *
 * ============================================================================
 * INPUT SPECIFICATION FOR TICKETS:
 * ============================================================================
 *
 * For ticket generation, bsringproof takes:
 *
 * 1. r (ringRoot): epochroot' from getRingRoot (144 bytes)
 *
 * 2. x (context): Xticket ∥ entropy'_2 ∥ xt_entryindex
 *    - Xticket = "$jam_ticket_seal" (hardcoded string from Gray Paper)
 *    - entropy'_2 = second-oldest epoch entropy (32 bytes)
 *    - xt_entryindex = entry index (4 bytes, little-endian)
 *
 * 3. m (message): [] (empty, no message data for tickets)
 *
 * 4. secretKey: Validator's actual Bandersnatch SECRET key (NOT public key!)
 *
 * ============================================================================
 * HARDCODED GRAY PAPER STRINGS:
 * ============================================================================
 *
 * Xticket  = "$jam_ticket_seal"     (for tickets, eq. 161)
 * Xentropy = "$jam_entropy"         (for VRF entropy, eq. 159)
 * Xfallback = "$jam_fallback_seal"  (for fallback seals, eq. 160)
 *
 * ============================================================================
 *
 * @param secretKey - Validator's Bandersnatch SECRET key (32 bytes)
 * @param entropy2 - Second-oldest epoch entropy (32 bytes)
 * @param entryIndex - Entry index for ticket generation
 * @param message - VRF message (empty [] for tickets)
 * @param ringKeys - All public keys in the ring
 * @param proverIndex - Index of the prover's key in the ring
 * @param prover - Ring VRF prover instance
 * @returns 784-byte Ring VRF proof + 32-byte VRF output
 */
export function generateRingVRFProof(
  secretKey: Uint8Array,
  entropy2: Uint8Array,
  entryIndex: number,
  message: Uint8Array,
  ringKeys: Uint8Array[],
  proverIndex: number,
  prover: RingVRFProver,
): Safe<{
  proof: Uint8Array
  banderoutResult: Uint8Array
}> {
  // Validate inputs
  if (secretKey.length !== 32) {
    return safeError(new Error('Secret key must be 32 bytes'))
  }

  if (entropy2.length !== 32) {
    return safeError(new Error('entropy_2 must be 32 bytes'))
  }

  if (proverIndex < 0 || proverIndex >= ringKeys.length) {
    return safeError(new Error('Invalid prover index'))
  }

  // Build VRF context according to Gray Paper equation 292:
  // context = Xticket ∥ entropy'_2 ∥ xt_entryindex

  // Encode entry index as 4 bytes (little-endian per Gray Paper)
  const entryIndexBytes = new Uint8Array(4)
  const view = new DataView(entryIndexBytes.buffer)
  view.setUint32(0, entryIndex, true) // true = little-endian

  // Concatenate: Xticket ∥ entropy'_2 ∥ xt_entryindex
  const context = new Uint8Array(
    Xticket.length + entropy2.length + entryIndexBytes.length,
  )
  let offset = 0
  context.set(Xticket, offset)
  offset += Xticket.length
  context.set(entropy2, offset)
  offset += entropy2.length
  context.set(entryIndexBytes, offset)

  // Debug: Log VRF context construction
  console.log('Prover VRF context bytes:', {
    Xticket: Array.from(Xticket)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
    entropy2: Array.from(entropy2)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
    entryIndexBytes: Array.from(entryIndexBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
    context: Array.from(context)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
  })

  // Create Ring VRF input according to Gray Paper specification
  const ringVRFInput = {
    input: context, // VRF context: "$jam_ticket_seal" || entropy_2 || entryIndex
    auxData: message, // VRF message (usually empty for tickets)
    ringKeys: ringKeys,
    proverIndex: proverIndex,
  }

  // Generate Ring VRF proof
  const proofResult = prover.prove(secretKey, ringVRFInput)

  // Serialize the complete result (output + proof)
  const serializedResult = RingVRFProver.serialize(proofResult)

  // Extract VRF output (banderout)
  // Gray Paper: banderout{p ∈ bsringproof{r}{x}{m}} ∈ hash
  // This is the first 32 bytes of the VRF output hash
  const vrfOutput = getBanderoutFromGamma(proofResult.gamma)

  return safeResult({
    proof: serializedResult,
    banderoutResult: vrfOutput,
  })
}
