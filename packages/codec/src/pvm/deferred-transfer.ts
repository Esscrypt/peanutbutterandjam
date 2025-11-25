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

import { concatBytes } from '@pbnj/core'
import type { DecodingResult, DeferredTransfer, Safe } from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'

/**
 * Encode deferred transfer according to Gray Paper specification.
 *
 * Gray Paper Equation 271-277 (label: encode[X]{DX ∈ defxfer}):
 * encode[X]{DX ∈ defxfer} ≡ encode{
 *   encode[4]{DX_source},
 *   encode[4]{DX_dest},
 *   encode[8]{DX_amount},
 *   DX_memo,
 *   encode[8]{DX_gas}
 * }
 *
 * Deferred transfers represent cross-service value transfers processed during
 * PVM accumulation. They enable async value movement between services with
 * associated memo data and gas payment.
 *
 * Field encoding per Gray Paper:
 * 1. encode[4]{DX_source}: 4-byte fixed-length source service index
 * 2. encode[4]{DX_dest}: 4-byte fixed-length destination service index
 * 3. encode[8]{DX_amount}: 8-byte fixed-length transfer amount
 * 4. DX_memo: Variable-length memo data with length prefix
 * 5. encode[8]{DX_gas}: 8-byte fixed-length gas provided for processing
 *
 * Transfer semantics:
 * - Source/dest are service indices (not account addresses)
 * - Amount represents value units transferred between services
 * - Memo enables complex transfer logic (function calls, metadata)
 * - Gas covers processing costs on recipient service
 *
 * ✅ CORRECT: All 5 fields present in correct Gray Paper order
 * ✅ CORRECT: Uses encode[4] for service indices (4-byte fixed-length)
 * ✅ CORRECT: Uses encode[8] for amount and gas (8-byte fixed-length)
 * ✅ CORRECT: Uses variable-length encoding for memo data
 *
 * @param deferredTransfer - Deferred transfer to encode
 * @returns Encoded octet sequence
 */
export function encodeDeferredTransfer(
  deferredTransfer: DeferredTransfer,
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // Source: encode[4](dxX_source) (4-byte fixed-length)
  const [error, encoded] = encodeFixedLength(deferredTransfer.source, 4n)
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

  // Destination: encode[4](dxX_dest) (4-byte fixed-length)
  const [error2, encoded2] = encodeFixedLength(deferredTransfer.dest, 4n)
  if (error2) {
    return safeError(error2)
  }
  parts.push(encoded2)

  // Amount: encode[8](dxX_amount) (8-byte fixed-length)
  const [error3, encoded3] = encodeFixedLength(deferredTransfer.amount, 8n)
  if (error3) {
    return safeError(error3)
  }
  parts.push(encoded3)

  // Memo: dxX_memo (variable-length octet sequence)
  const [error4, encoded4] = encodeNatural(BigInt(deferredTransfer.memo.length))
  if (error4) {
    return safeError(error4)
  }
  parts.push(encoded4)
  parts.push(deferredTransfer.memo)

  // Gas: encode[8](dxX_gas) (8-byte fixed-length)
  const [error5, encoded5] = encodeFixedLength(deferredTransfer.gasLimit, 8n)
  if (error5) {
    return safeError(error5)
  }
  parts.push(encoded5)

  return safeResult(concatBytes(parts))
}

/**
 * Decode deferred transfer according to Gray Paper specification.
 *
 * Gray Paper Equation 271-277 (label: decode[X]{DX ∈ defxfer}):
 * Inverse of encode[X]{DX ∈ defxfer} ≡ decode{
 *   decode[4]{DX_source},
 *   decode[4]{DX_dest},
 *   decode[8]{DX_amount},
 *   DX_memo,
 *   decode[8]{DX_gas}
 * }
 *
 * Decodes deferred transfer from octet sequence back to structured data.
 * Must exactly reverse the encoding process to maintain round-trip compatibility.
 *
 * Field decoding per Gray Paper:
 * 1. decode[4]{DX_source}: 4-byte fixed-length source service index
 * 2. decode[4]{DX_dest}: 4-byte fixed-length destination service index
 * 3. decode[8]{DX_amount}: 8-byte fixed-length transfer amount
 * 4. DX_memo: Variable-length memo data with length prefix
 * 5. decode[8]{DX_gas}: 8-byte fixed-length gas provided for processing
 *
 * ✅ CORRECT: All 5 fields decoded in correct Gray Paper order
 * ✅ CORRECT: Uses decode[4] for service indices (4-byte fixed-length)
 * ✅ CORRECT: Uses decode[8] for amount and gas (8-byte fixed-length)
 * ✅ CORRECT: Uses variable-length decoding for memo data
 * ✅ CORRECT: Uses safeError instead of throw for error handling
 *
 * @param data - Octet sequence to decode
 * @returns Decoded deferred transfer and remaining data
 */
export function decodeDeferredTransfer(
  data: Uint8Array,
): Safe<DecodingResult<DeferredTransfer>> {
  let currentData = data

  // Source: encode[4](dxX_source) (4-byte fixed-length)
  const [error, sourceResult] = decodeFixedLength(currentData, 4n)
  if (error) {
    return safeError(error)
  }
  const source = sourceResult.value
  const sourceRemaining = sourceResult.remaining
  currentData = sourceRemaining

  // Destination: encode[4](dxX_dest) (4-byte fixed-length)
  const [error2, destinationResult] = decodeFixedLength(currentData, 4n)
  if (error2) {
    return safeError(error2)
  }
  const destination = destinationResult.value
  const destinationRemaining = destinationResult.remaining
  currentData = destinationRemaining

  // Amount: encode[8](dxX_amount) (8-byte fixed-length)
  const [error3, amountResult] = decodeFixedLength(currentData, 8n)
  if (error3) {
    return safeError(error3)
  }
  const amount = amountResult.value
  const amountRemaining = amountResult.remaining
  currentData = amountRemaining

  // Memo: dxX_memo (variable-length octet sequence)
  const [error4, memoLengthResult] = decodeNatural(currentData)
  if (error4) {
    return safeError(error4)
  }
  const memoLength = memoLengthResult.value
  const memoLengthRemaining = memoLengthResult.remaining
  const memoLengthNum = Number(memoLength)
  if (memoLengthRemaining.length < memoLengthNum) {
    return safeError(
      new Error('Insufficient data for deferred transfer memo decoding'),
    )
  }
  const memo = memoLengthRemaining.slice(0, memoLengthNum)
  currentData = memoLengthRemaining.slice(memoLengthNum)

  // Gas: encode[8](dxX_gas) (8-byte fixed-length)
  const [error5, gasResult] = decodeFixedLength(currentData, 8n)
  if (error5) {
    return safeError(error5)
  }
  const gas = gasResult.value
  const gasRemaining = gasResult.remaining
  currentData = gasRemaining

  const deferredTransfer: DeferredTransfer = {
    source,
    dest: destination,
    amount,
    memo,
    gasLimit: gas,
  }

  return safeResult({
    value: deferredTransfer,
    remaining: currentData,
    consumed: data.length - currentData.length,
  })
}
