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

import type { Preimage } from '@pbnj/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import { decodeSequenceGeneric, encodeSequenceGeneric } from '../core/sequence'

/**
 * Encode single preimage using Gray Paper encoding
 *
 * Formula from Gray Paper:
 * encode(xp ∈ preimage) ≡ encode{encode[4](xp_serviceindex), var{xp_data}}
 *
 * @param preimage - Preimage to encode
 * @returns Encoded octet sequence
 */
function encodePreimage(preimage: Preimage): Uint8Array {
  const parts: Uint8Array[] = []

  // Service index: encode[4](xp_serviceindex)
  parts.push(encodeFixedLength(BigInt(preimage.serviceIndex), 4))

  // Data: var{xp_data} (variable-length octet sequence)
  parts.push(encodeNatural(BigInt(preimage.data.length))) // Length prefix
  parts.push(preimage.data)

  // Concatenate all parts
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }

  return result
}

/**
 * Decode single preimage using Gray Paper encoding
 *
 * @param data - Octet sequence to decode
 * @returns Decoded preimage and remaining data
 */
function decodePreimage(data: Uint8Array): {
  value: Preimage
  remaining: Uint8Array
} {
  let currentData = data

  // Service index: encode[4](xp_serviceindex)
  const { value: serviceIndex, remaining: serviceIndexRemaining } =
    decodeFixedLength(currentData, 4)
  currentData = serviceIndexRemaining

  // Data: var{xp_data} (variable-length octet sequence)
  const { value: dataLength, remaining: dataLengthRemaining } =
    decodeNatural(currentData)
  const dataLengthNum = Number(dataLength)
  if (dataLengthRemaining.length < dataLengthNum) {
    throw new Error('Insufficient data for preimage data decoding')
  }
  const preimageData = dataLengthRemaining.slice(0, dataLengthNum)
  currentData = dataLengthRemaining.slice(dataLengthNum)

  const preimage: Preimage = {
    serviceIndex: Number(serviceIndex),
    data: preimageData,
  }

  return {
    value: preimage,
    remaining: currentData,
  }
}

/**
 * Encode variable-length preimage sequence using Gray Paper encoding
 *
 * Formula from Gray Paper:
 * encode[P](xtpreimages) ≡ encode{var{sq{build{tuple{encode[4](xp_serviceindex), var{xp_data}}}{tuple{xp_serviceindex, xp_data} orderedin xtpreimages}}}}
 *
 * @param preimages - Array of preimages to encode (ordered by service index)
 * @returns Encoded octet sequence
 */
export function encodePreimages(preimages: Preimage[]): Uint8Array {
  // Sort preimages by service index as required by Gray Paper
  const sortedPreimages = [...preimages].sort((a, b) => {
    if (a.serviceIndex < b.serviceIndex) return -1
    if (a.serviceIndex > b.serviceIndex) return 1
    return 0
  })

  return encodeSequenceGeneric(sortedPreimages, encodePreimage)
}

/**
 * Decode variable-length preimage sequence using Gray Paper encoding
 *
 * @param data - Octet sequence to decode
 * @returns Decoded preimages and remaining data
 */
export function decodePreimages(data: Uint8Array): {
  value: Preimage[]
  remaining: Uint8Array
} {
  return decodeSequenceGeneric(data, decodePreimage)
}
