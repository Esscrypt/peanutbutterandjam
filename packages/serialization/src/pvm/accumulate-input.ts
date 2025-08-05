/**
 * Accumulate Input Serialization
 *
 * Implements accumulate input encoding from Gray Paper Appendix D.2
 * encode(aiX ∈ accinput) - PVM-specific accumulate input encoding
 */

import type { AccumulateInput, OctetSequence } from '../types'
import {
  decodeDeferredTransfer,
  encodeDeferredTransfer,
} from './deferred-transfer'
import { decodeOperandTuple, encodeOperandTuple } from './operand-tuple'

/**
 * Encode accumulate input using Gray Paper encoding
 *
 * Formula from Gray Paper:
 * encode(aiX ∈ accinput) ≡ begin{cases}
 *   encode{0, encode[U]{o}} &when aiX ∈ operandtuple \\
 *   encode{1, encode[X]{o}} &when aiX ∈ defxfer \\
 * end{cases}
 *
 * @param accumulateInput - Accumulate input to encode
 * @returns Encoded octet sequence
 */
export function encodeAccumulateInput(
  accumulateInput: AccumulateInput,
): OctetSequence {
  if (accumulateInput.type === 'operand') {
    // encode{0, encode[U]{o}} for operand tuple
    const operandEncoded = encodeOperandTuple(accumulateInput.value)
    const result = new Uint8Array(1 + operandEncoded.length)
    result[0] = 0 // Discriminator for operand tuple
    result.set(operandEncoded, 1)
    return result
  } else {
    // encode{1, encode[X]{o}} for deferred transfer
    const transferEncoded = encodeDeferredTransfer(accumulateInput.value)
    const result = new Uint8Array(1 + transferEncoded.length)
    result[0] = 1 // Discriminator for deferred transfer
    result.set(transferEncoded, 1)
    return result
  }
}

/**
 * Decode accumulate input using Gray Paper encoding
 *
 * @param data - Octet sequence to decode
 * @returns Decoded accumulate input and remaining data
 */
export function decodeAccumulateInput(data: OctetSequence): {
  value: AccumulateInput
  remaining: OctetSequence
} {
  if (data.length === 0) {
    throw new Error('Insufficient data for accumulate input decoding')
  }

  const discriminator = data[0]
  const remainingData = data.slice(1)

  if (discriminator === 0) {
    // Operand tuple: encode{0, encode[U]{o}}
    const { value: operandTuple, remaining } = decodeOperandTuple(remainingData)
    return {
      value: { type: 'operand', value: operandTuple },
      remaining,
    }
  } else if (discriminator === 1) {
    // Deferred transfer: encode{1, encode[X]{o}}
    const { value: deferredTransfer, remaining } =
      decodeDeferredTransfer(remainingData)
    return {
      value: { type: 'deferred', value: deferredTransfer },
      remaining,
    }
  } else {
    throw new Error(`Invalid accumulate input discriminator: ${discriminator}`)
  }
}
