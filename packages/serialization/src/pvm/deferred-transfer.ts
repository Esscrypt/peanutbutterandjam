/**
 * Deferred Transfer Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 271-277):
 *
 * encode[X](DX ∈ defxfer) ≡ encode(
 *   encode[4](DX_source),
 *   encode[4](DX_dest),
 *   encode[8](DX_amount),
 *   DX_memo,
 *   encode[8](DX_gas)
 * )
 *
 * Deferred transfers represent cross-service value transfers that are
 * processed during PVM accumulation phase. The [X] parameter indicates
 * the accumulation context for the encoding.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Deferred transfers enable services to send value to other services
 * without requiring immediate processing. They're queued and executed
 * during the accumulation phase.
 *
 * Deferred Transfer structure:
 * 1. **Source** (4 bytes): Service index sending the value
 * 2. **Destination** (4 bytes): Service index receiving the value
 * 3. **Amount** (8 bytes): How much value to transfer
 * 4. **Memo**: Arbitrary data payload for the transfer
 * 5. **Gas** (8 bytes): Gas provided for transfer processing
 *
 * Key concepts:
 * - **Async transfers**: Sending and receiving happen in different phases
 * - **Cross-service**: Enables inter-service communication and value flow
 * - **Gas payment**: Recipient pays gas to process incoming transfers
 * - **Memo data**: Allows complex transfer semantics (like smart contract calls)
 *
 * Example: DEX service sends tokens to user's wallet service
 * - Source: 42 (DEX service), Destination: 7 (wallet service)
 * - Amount: 1000000 (1M tokens), Gas: 50000 (processing fee)
 * - Memo: encoded function call for wallet to execute
 *
 * This enables sophisticated cross-service interactions while maintaining
 * clear separation and gas accounting between services.
 */

import type { DeferredTransfer } from '@pbnj/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'

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
): Uint8Array {
  const parts: Uint8Array[] = []

  // Source: encode[4](dxX_source) (4-byte fixed-length)
  parts.push(encodeFixedLength(BigInt(deferredTransfer.source), 4))

  // Destination: encode[4](dxX_dest) (4-byte fixed-length)
  parts.push(encodeFixedLength(BigInt(deferredTransfer.dest), 4))

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
export function decodeDeferredTransfer(data: Uint8Array): {
  value: DeferredTransfer
  remaining: Uint8Array
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
    source: Number(source),
    dest: Number(destination),
    amount,
    memo,
    gas,
  }

  return {
    value: deferredTransfer,
    remaining: currentData,
  }
}
