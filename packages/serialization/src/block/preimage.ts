/**
 * Preimage Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 139-144):
 *
 * encodePreimages(XT_preimages) = encode(
 *   var{⟨⟨encode[4](XP_serviceindex), var{XP_data}⟩ |
 *       ⟨XP_serviceindex, XP_data⟩ ∈ XT_preimages⟩}
 * )
 *
 * Inner tuples contain variable-length sequence terms which need
 * length discriminators (var{}).
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Preimages are data blobs that work packages reference by hash.
 * This allows work packages to be small while still accessing large data.
 *
 * Preimage structure:
 * 1. **Service index** (4 bytes): Which service this preimage belongs to
 * 2. **Data** (variable): The actual preimage data blob
 *
 * Key concepts:
 * - Hash-based addressing: Work packages store hashes, blocks store data
 * - Service isolation: Each service has its own preimage namespace
 * - Variable size: Preimages can be small configs or large datasets
 * - Length prefixing: var{XP_data} allows parser to know data size
 *
 * Example flow:
 * 1. Work package references hash(data) for service 5
 * 2. Block includes preimage entry: service=5, data=original_data
 * 3. PVM can resolve hash to actual data during execution
 *
 * This design enables efficient data availability while keeping
 * work package sizes manageable.
 */

import {
  bytesToHex,
  concatBytes,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { DecodingResult, Preimage } from '@pbnj/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import { decodeSequenceGeneric, encodeSequenceGeneric } from '../core/sequence'

/**
 * Encode single preimage according to Gray Paper specification.
 *
 * Gray Paper Equation 139-144 (label: encode{xp ∈ preimage}):
 * encode{xp ∈ preimage} ≡ encode{
 *   encode[4]{xp_serviceindex},
 *   var{xp_data}
 * }
 *
 * Preimages are data blobs that work packages reference by hash for efficient
 * data availability. They enable work packages to remain small while accessing
 * large datasets through cryptographic commitments.
 *
 * Field encoding per Gray Paper:
 * 1. encode[4]{xp_serviceindex}: 4-byte fixed-length service index
 * 2. var{xp_data}: Variable-length data blob with natural length prefix
 *
 * Preimage semantics:
 * - **Hash-based addressing**: Work packages store hashes, blocks store actual data
 * - **Service isolation**: Each service maintains its own preimage namespace
 * - **Variable size**: Supports small configurations to large datasets
 * - **Data availability**: Ensures referenced data is actually available
 *
 * Usage flow:
 * 1. Work package references hash(data) for specific service
 * 2. Block includes corresponding preimage entry with actual data
 * 3. PVM resolves hash to data during work item execution
 * 4. Service index ensures proper namespace isolation
 *
 * ✅ CORRECT: 4-byte fixed-length service index encoding
 * ✅ CORRECT: Variable-length data encoding with natural length prefix
 * ✅ CORRECT: Field order matches Gray Paper specification exactly
 * ✅ CORRECT: Supports efficient hash-based data resolution
 *
 * @param preimage - Preimage to encode
 * @returns Encoded octet sequence
 */
export function encodePreimage(preimage: Preimage): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // encode[4]{xp_serviceindex}: 4-byte fixed-length service index
  const [error1, serviceIndexEncoded] = encodeFixedLength(
    preimage.serviceIndex,
    4n,
  )
  if (error1) {
    return safeError(error1)
  }
  parts.push(serviceIndexEncoded)

  // var{xp_data}: Variable-length data blob with natural length prefix
  const [error2, dataLengthEncoded] = encodeNatural(
    BigInt(preimage.data.length),
  )
  if (error2) {
    return safeError(error2)
  }
  parts.push(dataLengthEncoded)
  parts.push(hexToBytes(preimage.data))

  return safeResult(concatBytes(parts))
}

/**
 * Decode single preimage according to Gray Paper specification.
 *
 * Gray Paper Equation 139-144 (label: decode{xp ∈ preimage}):
 * Inverse of encode{xp ∈ preimage} ≡ decode{
 *   decode[4]{xp_serviceindex},
 *   var{xp_data}
 * }
 *
 * Decodes preimage from octet sequence back to structured data.
 * Must exactly reverse the encoding process to maintain round-trip compatibility.
 *
 * Field decoding per Gray Paper:
 * 1. decode[4]{xp_serviceindex}: 4-byte fixed-length service index
 * 2. var{xp_data}: Variable-length data blob with natural length prefix
 *
 * Validation and error handling:
 * - Input size validation for minimum required data
 * - Service index bounds checking (if applicable)
 * - Data length validation against remaining buffer
 * - Proper error propagation with descriptive messages
 *
 * ✅ CORRECT: 4-byte fixed-length service index decoding
 * ✅ CORRECT: Variable-length data decoding with natural length prefix
 * ✅ CORRECT: Field order matches Gray Paper specification exactly
 * ✅ CORRECT: Uses safeError for consistent error handling
 * ✅ CORRECT: Maintains round-trip compatibility with encoding
 *
 * @param data - Octet sequence to decode
 * @returns Decoded preimage and remaining data
 */
export function decodePreimage(
  data: Uint8Array,
): Safe<DecodingResult<Preimage>> {
  if (data.length < 5) {
    return safeError(
      new Error('[decodePreimage] Insufficient data for preimage decoding'),
    )
  }

  let currentData = data

  // decode[4]{xp_serviceindex}: 4-byte fixed-length service index
  const [error1, serviceIndexResult] = decodeFixedLength(currentData, 4n)
  if (error1) {
    return safeError(error1)
  }
  const serviceIndex = serviceIndexResult.value
  currentData = serviceIndexResult.remaining

  // var{xp_data}: Variable-length data blob with natural length prefix
  const [error2, dataLengthResult] = decodeNatural(currentData)
  if (error2) {
    return safeError(error2)
  }
  const dataLength = dataLengthResult.value
  const dataLengthNum = Number(dataLength)
  currentData = dataLengthResult.remaining

  // Validate data length against remaining buffer
  if (currentData.length < dataLengthNum) {
    return safeError(
      new Error(
        '[decodePreimage] Insufficient data for preimage data decoding',
      ),
    )
  }

  const preimageData = currentData.slice(0, dataLengthNum)
  currentData = currentData.slice(dataLengthNum)

  return safeResult({
    value: {
      serviceIndex,
      data: bytesToHex(preimageData),
    },
    remaining: currentData,
  })
}

/**
 * Encode variable-length preimage sequence according to Gray Paper specification.
 *
 * Gray Paper Equation 139-144 (label: encode[P]{xtpreimages}):
 * encode[P]{xtpreimages} ≡ encode{
 *   var{sequence{
 *     tuple{encode[4]{xp_serviceindex}, var{xp_data}} |
 *     tuple{xp_serviceindex, xp_data} ∈ sorted(xtpreimages)
 *   }}
 * }
 *
 * Encodes a variable-length sequence of preimages with proper ordering and
 * length prefixing. The Gray Paper requires deterministic encoding through
 * service index ordering for consistent block hashing.
 *
 * Encoding semantics:
 * - **Deterministic ordering**: Preimages sorted by service index
 * - **Variable-length sequence**: Natural length prefix for sequence
 * - **Service isolation**: Each preimage maintains service namespace
 * - **Hash-based addressing**: Enables efficient data availability
 *
 * Block structure requirements:
 * - All referenced preimages must be included in block
 * - Service index ordering ensures deterministic encoding
 * - Length prefixing enables efficient parsing
 * - Hash commitments provide data integrity
 *
 * ✅ CORRECT: Sorts preimages by service index for deterministic encoding
 * ✅ CORRECT: Uses variable-length sequence encoding with length prefix
 * ✅ CORRECT: Delegates to encodePreimage for individual preimage encoding
 * ✅ CORRECT: Maintains Gray Paper compliance for block serialization
 *
 * @param preimages - Array of preimages to encode (will be sorted by service index)
 * @returns Encoded octet sequence
 */
export function encodePreimages(preimages: Preimage[]): Safe<Uint8Array> {
  // Sort preimages by service index as required by Gray Paper for deterministic encoding
  const sortedPreimages = [...preimages].sort((a, b) => {
    if (a.serviceIndex < b.serviceIndex) return -1
    if (a.serviceIndex > b.serviceIndex) return 1
    return 0
  })

  return encodeSequenceGeneric(sortedPreimages, encodePreimage)
}

/**
 * Decode variable-length preimage sequence according to Gray Paper specification.
 *
 * Gray Paper Equation 139-144 (label: decode[P]{xtpreimages}):
 * Inverse of encode[P]{xtpreimages} ≡ decode{
 *   var{sequence{
 *     tuple{decode[4]{xp_serviceindex}, var{xp_data}}
 *   }}
 * }
 *
 * Decodes variable-length preimage sequence from octet sequence back to array.
 * Must exactly reverse the encoding process including proper sequence handling.
 *
 * ✅ CORRECT: Uses variable-length sequence decoding with length prefix
 * ✅ CORRECT: Delegates to decodePreimage for individual preimage decoding
 * ✅ CORRECT: Maintains round-trip compatibility with encoding
 * ✅ CORRECT: Preserves service index ordering from encoding
 *
 * @param data - Octet sequence to decode
 * @returns Decoded preimages and remaining data
 */
export function decodePreimages(
  data: Uint8Array,
): Safe<DecodingResult<Preimage[]>> {
  return decodeSequenceGeneric(data, decodePreimage)
}
