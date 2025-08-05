/**
 * Block Body Serialization
 *
 * Implements block body encoding from Gray Paper Appendix D.2
 * Reference: Gray Paper block body specifications
 */

import {
  decodeVariableLength,
  encodeVariableLength,
} from '../core/discriminator'
import type { OctetSequence } from '../types'

/**
 * Block body structure
 */
export interface BlockBody {
  extrinsics: OctetSequence[]
}

/**
 * Encode block body
 *
 * Formula from Gray Paper:
 * encode(body) ≡ var{encode(extrinsics)}
 *
 * @param body - Block body to encode
 * @returns Encoded octet sequence
 */
export function encodeBlockBody(body: BlockBody): OctetSequence {
  // Encode extrinsics as a sequence
  const extrinsicsData = new Uint8Array(
    body.extrinsics.reduce((sum, ext) => sum + ext.length, 0),
  )
  let offset = 0

  for (const extrinsic of body.extrinsics) {
    extrinsicsData.set(extrinsic, offset)
    offset += extrinsic.length
  }

  // Encode as variable-length data
  return encodeVariableLength(extrinsicsData)
}

/**
 * Decode block body
 *
 * @param data - Octet sequence to decode
 * @returns Decoded block body and remaining data
 */
export function decodeBlockBody(data: OctetSequence): {
  value: BlockBody
  remaining: OctetSequence
} {
  // Decode variable-length extrinsics data
  const { value: extrinsicsData, remaining } = decodeVariableLength(data)

  // For now, treat extrinsics as a single blob
  // In a real implementation, you would parse individual extrinsics
  const extrinsics: OctetSequence[] = [extrinsicsData]

  return {
    value: { extrinsics },
    remaining,
  }
}

/**
 * Encode complete block (header + body)
 *
 * @param header - Block header
 * @param body - Block body
 * @returns Encoded octet sequence
 */
export function encodeBlock(
  header: OctetSequence,
  body: OctetSequence,
): OctetSequence {
  const result = new Uint8Array(header.length + body.length)
  result.set(header, 0)
  result.set(body, header.length)
  return result
}

/**
 * Decode complete block
 *
 * @param data - Octet sequence to decode
 * @param headerLength - Length of the header (must be known)
 * @returns Decoded header, body, and remaining data
 */
export function decodeBlock(
  data: OctetSequence,
  headerLength: number,
): {
  header: OctetSequence
  body: OctetSequence
  remaining: OctetSequence
} {
  if (data.length < headerLength) {
    throw new Error(
      `Insufficient data for block decoding (expected at least ${headerLength} bytes)`,
    )
  }

  const header = data.slice(0, headerLength)
  const body = data.slice(headerLength)

  return {
    header,
    body,
    remaining: new Uint8Array(0),
  }
}
