/**
 * Entropy serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: merklization.tex (Equation C(6))
 * Formula:
 *
 * C(6) ↦ encode{entropy}
 *
 * Gray Paper Section: safrole.tex (Equation 169)
 * Entropy structure:
 *
 * entropy ∈ sequence[4]{hash}
 *
 * Gray Paper Section: safrole.tex (Equation 174-175)
 * Entropy composition:
 *
 * entropyaccumulator' ≡ blake{entropyaccumulator ∥ banderout{H_vrfsig}}
 *
 * Gray Paper Section: safrole.tex (Equation 179-181)
 * Epoch transition rotation:
 *
 * (entropy'_1, entropy'_2, entropy'_3) ≡ {
 *   (entropy_0, entropy_1, entropy_2)  when e' > e
 *   (entropy_1, entropy_2, entropy_3)   otherwise
 * }
 *
 * Implements Gray Paper entropy serialization as specified
 * Reference: graypaper/text/safrole.tex and merklization.tex
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Entropy provides high-quality randomness for JAM's consensus mechanism.
 * It ensures unbiased randomness for validator selection and other protocols.
 *
 * Entropy structure per Gray Paper:
 * 1. **entropyaccumulator**: Current randomness accumulator (32 bytes)
 * 2. **entropy_1**: First previous epoch randomness (32 bytes)
 * 3. **entropy_2**: Second previous epoch randomness (32 bytes)
 * 4. **entropy_3**: Third previous epoch randomness (32 bytes)
 *
 * Key concepts:
 * - **VRF-based**: Entropy derived from Verifiable Random Function outputs
 * - **Epochal rotation**: Historical values rotated on epoch transitions
 * - **Bias resistance**: Prevents manipulation of randomness
 * - **Protocol integration**: Used for validator shuffling and ticket generation
 * - **Blake2 accumulation**: Each block updates accumulator with VRF output
 *
 * The fixed-length sequence encoding ensures deterministic serialization
 * for consistent state hashing and consensus.
 *
 * This is critical for JAM's randomness generation that maintains
 * network security through unbiased validator selection.
 */

import { bytesToHex, type Hex, hexToBytes } from '@pbnj/core'
import type { DecodingResult, EntropyState, Safe } from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import { encodeSequenceGeneric } from '../core/sequence'

/**
 * Encode entropy state according to Gray Paper specification.
 *
 * Gray Paper merklization.tex equation C(6):
 * C(6) ↦ encode{entropy}
 *
 * Gray Paper safrole.tex equation 169:
 * entropy ∈ sequence[4]{hash}
 *
 * Entropy provides high-quality randomness for JAM's consensus mechanism,
 * ensuring unbiased randomness for validator selection and other protocols.
 *
 * Field encoding per Gray Paper:
 * 1. entropyaccumulator: Current randomness accumulator (32 bytes)
 * 2. entropy_1: First previous epoch randomness (32 bytes)
 * 3. entropy_2: Second previous epoch randomness (32 bytes)
 * 4. entropy_3: Third previous epoch randomness (32 bytes)
 *
 * Entropy semantics:
 * - **VRF-based**: Entropy derived from Verifiable Random Function outputs
 * - **Epochal rotation**: Historical values rotated on epoch transitions
 * - **Bias resistance**: Prevents manipulation of randomness
 * - **Protocol integration**: Used for validator shuffling and ticket generation
 * - **Blake2 accumulation**: Each block updates accumulator with VRF output
 *
 * Consensus integration:
 * - Entropy_2 used for unbiased ticket generation
 * - Entropy_3 used for fallback seal-key generation
 * - Accumulator updated each block with VRF signature output
 * - Fixed-length sequence ensures deterministic state hashing
 *
 * ✅ CORRECT: Uses fixed-length sequence encoding for 4 hashes
 * ✅ CORRECT: Encodes hashes as raw 32-byte sequences
 * ✅ CORRECT: Matches Gray Paper sequence[4]{hash} structure exactly
 * ✅ CORRECT: Supports entropy accumulation and epochal rotation
 *
 * @param entropy - Entropy state to encode
 * @returns Encoded octet sequence
 */
export function encodeEntropy(entropy: EntropyState): Safe<Uint8Array> {
  // Gray Paper: sequence[4]{hash} - fixed-length sequence of 4 hashes
  const entropyArray = [
    entropy.accumulator,
    entropy.entropy1,
    entropy.entropy2,
    entropy.entropy3,
  ]

  return encodeSequenceGeneric(entropyArray, (hash: Hex) =>
    safeResult(hexToBytes(hash)),
  )
}

/**
 * Decode entropy state according to Gray Paper specification.
 *
 * Decodes the Gray Paper compliant entropy structure:
 * entropy ∈ sequence[4]{hash}
 *
 * The structure contains exactly 4 hashes in fixed order:
 * - entropyaccumulator: Current randomness accumulator
 * - entropy_1: First previous epoch randomness
 * - entropy_2: Second previous epoch randomness
 * - entropy_3: Third previous epoch randomness
 *
 * ✅ CORRECT: Decodes fixed-length sequence of exactly 4 hashes
 * ✅ CORRECT: Maintains deterministic ordering from encoding
 * ✅ CORRECT: Reconstructs EntropyState from decoded hashes
 * ✅ CORRECT: Matches Gray Paper sequence[4]{hash} structure exactly
 *
 * @param data - Octet sequence to decode
 * @returns Decoded entropy state and remaining data
 */
export function decodeEntropy(
  data: Uint8Array,
): Safe<DecodingResult<EntropyState>> {
  let currentData = data

  // Gray Paper: sequence[4]{hash} - decode exactly 4 hashes
  // Check if we have enough data for 4 hashes (4 × 32 = 128 bytes)
  if (currentData.length < 128) {
    return safeError(
      new Error(
        `Insufficient data for entropy: need 128 bytes, got ${currentData.length}`,
      ),
    )
  }

  // Decode each hash directly
  const accumulator = currentData.slice(0, 32)
  currentData = currentData.slice(32)

  const entropy1 = currentData.slice(0, 32)
  currentData = currentData.slice(32)

  const entropy2 = currentData.slice(0, 32)
  currentData = currentData.slice(32)

  const entropy3 = currentData.slice(0, 32)
  currentData = currentData.slice(32)

  const consumed = data.length - currentData.length

  return safeResult({
    value: {
      accumulator: bytesToHex(accumulator),
      entropy1: bytesToHex(entropy1),
      entropy2: bytesToHex(entropy2),
      entropy3: bytesToHex(entropy3),
    },
    remaining: currentData,
    consumed,
  })
}
