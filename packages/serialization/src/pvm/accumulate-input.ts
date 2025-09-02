/**
 * Accumulate Input Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix D.1 - Block Serialization
 * Formula (Equation 289-292):
 *
 * encode(AI ∈ accinput) ≡ {
 *   encode(0, encode[U](o))  when AI ∈ operandtuple
 *   encode(1, encode[X](o))  when AI ∈ defxfer
 * }
 *
 * Accumulate inputs represent either operand tuples from work item execution
 * or deferred transfers, distinguished by discriminator encoding.
 * Used in PVM accumulation operations.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * Accumulate inputs are the data flowing between work items during
 * the PVM accumulation phase. They can be one of two types.
 *
 * Discriminator encoding (0 or 1 prefix):
 * - **Type 0**: Operand tuple from successful work item execution
 * - **Type 1**: Deferred transfer for cross-service value movement
 *
 * Key concepts:
 * - **Operand tuples**: Results from work items that other items can import
 * - **Deferred transfers**: Value transfers between services scheduled for later
 * - **Type safety**: Discriminator ensures correct deserialization
 * - **Flow control**: Accumulation phase processes these in dependency order
 *
 * Example flow:
 * 1. Work item A produces operand tuple (type 0)
 * 2. Work item B imports A's output and creates deferred transfer (type 1)
 * 3. PVM accumulation processes both in correct order
 *
 * This unified input type allows the PVM to handle heterogeneous
 * data flows while maintaining type safety and execution ordering.
 */

import { type Safe, safeError, safeResult } from '@pbnj/core'
import type {
  AccumulateInput,
  DeferredTransfer,
  OperandTuple,
} from '@pbnj/types'
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
): Safe<Uint8Array> {
  if (accumulateInput.type === 0n) {
    // encode{0, encode[U]{o}} for operand tuple
    const [error, operandEncoded] = encodeOperandTuple(
      accumulateInput.value as OperandTuple,
    )
    if (error) {
      return safeError(error)
    }
    const result = new Uint8Array(1 + operandEncoded.length)
    result[0] = 0 // Discriminator for operand tuple
    result.set(operandEncoded, 1)
    return safeResult(result)
  } else {
    // encode{1, encode[X]{o}} for deferred transfer
    const [error, transferEncoded] = encodeDeferredTransfer(
      accumulateInput.value as DeferredTransfer,
    )
    if (error) {
      return safeError(error)
    }
    const result = new Uint8Array(1 + transferEncoded.length)
    result[0] = 1 // Discriminator for deferred transfer
    result.set(transferEncoded, 1)
    return safeResult(result)
  }
}

/**
 * Decode accumulate input using Gray Paper encoding
 *
 * @param data - Octet sequence to decode
 * @returns Decoded accumulate input and remaining data
 */
export function decodeAccumulateInput(data: Uint8Array): Safe<{
  value: AccumulateInput
  remaining: Uint8Array
}> {
  if (data.length === 0) {
    throw new Error('Insufficient data for accumulate input decoding')
  }

  const discriminator = data[0]
  const remainingData = data.slice(1)

  if (discriminator === 0) {
    // Operand tuple: encode{0, encode[U]{o}}
    const [error, operandTupleResult] = decodeOperandTuple(remainingData)
    if (error) {
      return safeError(error)
    }
    const operandTuple = operandTupleResult.value
    const remaining = operandTupleResult.remaining
    return safeResult({
      value: { type: 0n, value: operandTuple },
      remaining,
    })
  } else if (discriminator === 1) {
    // Deferred transfer: encode{1, encode[X]{o}}
    const [error, deferredTransferResult] =
      decodeDeferredTransfer(remainingData)
    if (error) {
      return safeError(error)
    }
    const deferredTransfer = deferredTransferResult.value
    const remaining = deferredTransferResult.remaining
    return safeResult({
      value: { type: 1n, value: deferredTransfer },
      remaining,
    })
  } else {
    return safeError(
      new Error(`Invalid accumulate input discriminator: ${discriminator}`),
    )
  }
}
