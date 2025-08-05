/**
 * Deferred Transfer Serialization
 *
 * Implements deferred transfer encoding from Gray Paper Appendix D.2
 * encode[X](dxX ∈ defxfer) - PVM-specific deferred transfer encoding
 */

import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import type { DeferredTransfer, OctetSequence } from '../types'

/**
 * Encode deferred transfer using Gray Paper encoding
 *
 * Formula from Gray Paper:
 * encode[X](dxX ∈ defxfer) ≡ encode{encode[4](dxX_source), encode[4](dxX_dest), encode[8](dxX_amount), dxX_memo, encode[8](dxX_gas)}
 *
 * @param deferredTransfer - Deferred transfer to encode
 * @returns Encoded octet sequence
 */
export function encodeDeferredTransfer(
  deferredTransfer: DeferredTransfer,
): OctetSequence {
  const parts: OctetSequence[] = []

  // Source: encode[4](dxX_source) (4-byte fixed-length)
  parts.push(encodeFixedLength(deferredTransfer.source, 4))

  // Destination: encode[4](dxX_dest) (4-byte fixed-length)
  parts.push(encodeFixedLength(deferredTransfer.destination, 4))

  // Amount: encode[8](dxX_amount) (8-byte fixed-length)
  parts.push(encodeFixedLength(deferredTransfer.amount, 8))

  // Memo: dxX_memo (variable-length octet sequence)
  parts.push(encodeNatural(BigInt(deferredTransfer.memo.length))) // Length prefix
  parts.push(deferredTransfer.memo)

  // Gas: encode[8](dxX_gas) (8-byte fixed-length)
  parts.push(encodeFixedLength(deferredTransfer.gas, 8))

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
 * Decode deferred transfer using Gray Paper encoding
 *
 * @param data - Octet sequence to decode
 * @returns Decoded deferred transfer and remaining data
 */
export function decodeDeferredTransfer(data: OctetSequence): {
  value: DeferredTransfer
  remaining: OctetSequence
} {
  let currentData = data

  // Source: encode[4](dxX_source) (4-byte fixed-length)
  const { value: source, remaining: sourceRemaining } = decodeFixedLength(
    currentData,
    4,
  )
  currentData = sourceRemaining

  // Destination: encode[4](dxX_dest) (4-byte fixed-length)
  const { value: destination, remaining: destinationRemaining } =
    decodeFixedLength(currentData, 4)
  currentData = destinationRemaining

  // Amount: encode[8](dxX_amount) (8-byte fixed-length)
  const { value: amount, remaining: amountRemaining } = decodeFixedLength(
    currentData,
    8,
  )
  currentData = amountRemaining

  // Memo: dxX_memo (variable-length octet sequence)
  const { value: memoLength, remaining: memoLengthRemaining } =
    decodeNatural(currentData)
  const memoLengthNum = Number(memoLength)
  if (memoLengthRemaining.length < memoLengthNum) {
    throw new Error('Insufficient data for deferred transfer memo decoding')
  }
  const memo = memoLengthRemaining.slice(0, memoLengthNum)
  currentData = memoLengthRemaining.slice(memoLengthNum)

  // Gas: encode[8](dxX_gas) (8-byte fixed-length)
  const { value: gas, remaining: gasRemaining } = decodeFixedLength(
    currentData,
    8,
  )
  currentData = gasRemaining

  const deferredTransfer: DeferredTransfer = {
    source,
    destination,
    amount,
    memo,
    gas,
  }

  return {
    value: deferredTransfer,
    remaining: currentData,
  }
}
