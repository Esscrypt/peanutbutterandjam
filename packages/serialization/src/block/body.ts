/**
 * Block Body Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 128-136):
 *
 * encode(B) = encode(
 *   H,
 *   encodeTickets(XT_tickets),
 *   encodePreimages(XT_preimages),
 *   encodeGuarantees(XT_guarantees),
 *   encodeAssurances(XT_assurances),
 *   encodeDisputes(XT_disputes)
 * )
 *
 * A block B is serialized as a tuple of its elements in regular order.
 * Reference: Gray Paper block body specifications
 *
 * *** IMPLEMENTER EXPLANATION ***
 * The block body contains all the extrinsics (transactions) and metadata
 * that validators need to process and validate the block contents.
 *
 * Block body components:
 * 1. **Header**: Block metadata (already explained above)
 * 2. **Tickets**: Safrole consensus tickets for randomness
 * 3. **Preimages**: Data blobs referenced by hash in work packages
 * 4. **Guarantees**: Validator attestations for work report validity
 * 5. **Assurances**: Validator attestations for data availability
 * 6. **Disputes**: Challenge proofs for invalid work or misbehavior
 *
 * Each component uses variable-length encoding (var{}) because:
 * - Number of tickets/preimages/etc. varies per block
 * - Size of individual items varies
 * - Allows efficient empty block encoding
 *
 * The tuple structure ensures deterministic ordering and makes it
 * possible to compute Merkle proofs for individual components.
 */

import { type Safe, safeError, safeResult } from '@pbnj/core'
import {
  decodeVariableLength,
  encodeVariableLength,
} from '../core/discriminator'

/**
 * Block body structure
 */
export interface BlockBody {
  extrinsics: Uint8Array[]
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
export function encodeBlockBody(body: BlockBody): Safe<Uint8Array> {
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
export function decodeBlockBody(data: Uint8Array): Safe<{
  value: BlockBody
  remaining: Uint8Array
}> {
  // Decode variable-length extrinsics data
  const [error, result] = decodeVariableLength(data)
  if (error) {
    return safeError(error)
  }
  const extrinsicsData = result.value
  const remaining = result.remaining

  // For now, treat extrinsics as a single blob
  // In a real implementation, you would parse individual extrinsics
  const extrinsics: Uint8Array[] = [extrinsicsData]

  return safeResult({
    value: { extrinsics },
    remaining,
  })
}

/**
 * Encode complete block (header + body)
 *
 * @param header - Block header
 * @param body - Block body
 * @returns Encoded octet sequence
 */
export function encodeBlock(header: Uint8Array, body: Uint8Array): Uint8Array {
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
  data: Uint8Array,
  headerLength: bigint,
): Safe<{
  header: Uint8Array
  body: Uint8Array
  remaining: Uint8Array
}> {
  if (data.length < headerLength) {
    return safeError(
      new Error(
        `Insufficient data for block decoding (expected at least ${headerLength} Uint8Array)`,
      ),
    )
  }

  const header = data.slice(0, Number(headerLength))
  const body = data.slice(Number(headerLength))

  return safeResult({
    header,
    body,
    remaining: new Uint8Array(0),
  })
}
