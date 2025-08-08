/**
 * Safrole ticket serialization
 *
 * Implements Gray Paper Safrole ticket serialization
 * Reference: graypaper/text/ticket.tex
 */

import { bytesToHex, hexToBytes } from '@pbnj/core'
import { encodeNatural } from '../core/natural-number'
import type { Uint8Array, SafroleTicket } from '../types'

/**
 * Encode Safrole ticket
 *
 * @param ticket - Safrole ticket to encode
 * @returns Encoded octet sequence
 */
export function encodeSafroleTicket(ticket: SafroleTicket): Uint8Array {
  const parts: Uint8Array[] = []

  // ID (32 bytes)
  parts.push(hexToBytes(ticket.id))

  // Entry index (8 bytes)
  parts.push(encodeNatural(ticket.entryIndex))

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
 * Decode Safrole ticket
 *
 * @param data - Octet sequence to decode
 * @returns Decoded Safrole ticket and remaining data
 */
export function decodeSafroleTicket(data: Uint8Array): {
  value: SafroleTicket
  remaining: Uint8Array
} {
  let currentData = data

  // ID (32 bytes)
  const id = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // Entry index (8 bytes)
  const entryIndex = BigInt(
    `0x${Array.from(currentData.slice(0, 8))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`,
  )
  currentData = currentData.slice(8)

  return {
    value: {
      id,
      entryIndex,
    },
    remaining: currentData,
  }
}
