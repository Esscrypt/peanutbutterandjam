/**
 * Preimage Serialization
 *
 * Implements preimage encoding from Gray Paper Appendix D.2
 * encode[P](xtpreimages) - Variable-length preimage sequence
 */

import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import { decodeSequenceGeneric, encodeSequenceGeneric } from '../core/sequence'
import type { OctetSequence, Preimage } from '../types'

/**
 * Encode single preimage using Gray Paper encoding
 *
 * Formula from Gray Paper:
 * encode(xp ∈ preimage) ≡ encode{encode[4](xp_serviceindex), var{xp_data}}
 *
 * @param preimage - Preimage to encode
 * @returns Encoded octet sequence
 */
function encodePreimage(preimage: Preimage): OctetSequence {
  const parts: OctetSequence[] = []

  // Service index: encode[4](xp_serviceindex)
  parts.push(encodeFixedLength(preimage.serviceIndex, 4))

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
function decodePreimage(data: OctetSequence): {
  value: Preimage
  remaining: OctetSequence
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
    serviceIndex,
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
export function encodePreimages(preimages: Preimage[]): OctetSequence {
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
export function decodePreimages(data: OctetSequence): {
  value: Preimage[]
  remaining: OctetSequence
} {
  return decodeSequenceGeneric(data, decodePreimage)
}
