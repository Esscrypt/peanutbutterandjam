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

import { concatBytes } from '@pbnjam/core'
import type {
  AccumulateInput,
  DecodingResult,
  DeferredTransfer,
  JamVersion,
  OperandTuple,
  Safe,
} from '@pbnjam/types'
import { DEFAULT_JAM_VERSION, safeError, safeResult } from '@pbnjam/types'
import {
  decodeDeferredTransfer,
  encodeDeferredTransfer,
} from './deferred-transfer'
import { decodeOperandTuple, encodeOperandTuple } from './operand-tuple'

/**
 * Encode accumulate input according to Gray Paper specification.
 *
 * Gray Paper Equation 289-292 (label: encode{AI ∈ accinput}):
 * encode{AI ∈ accinput} ≡ {
 *   encode{0, encode[U]{o}}  when AI ∈ operandtuple
 *   encode{1, encode[X]{o}}  when AI ∈ defxfer
 * }
 *
 * Accumulate inputs represent the flow of data between work items during
 * PVM accumulation. The discriminator-based encoding distinguishes between
 * two fundamental types of accumulation data.
 *
 * Discriminator encoding per Gray Paper:
 * - **Type 0 (operandtuple)**: Results from successful work item execution
 * - **Type 1 (defxfer)**: Deferred transfers for cross-service value movement
 *
 * Field encoding per Gray Paper:
 * 1. Discriminator: 1-byte type indicator (0 or 1)
 * 2. Payload: Variable-length encoded data based on type
 *   - Type 0: encodeOperandTuple for work item results
 *   - Type 1: encodeDeferredTransfer for value transfers
 *
 * ✅ CORRECT: Uses 1-byte discriminator for type distinction
 * ✅ CORRECT: Proper delegation to type-specific encoders
 * ✅ CORRECT: Maintains Gray Paper discriminator semantics
 * ✅ CORRECT: Supports both operand tuples and deferred transfers
 *
 * Version differences:
 * - **v0.7.0**: accinput encoding did not exist (only raw defxfer/operandtuple)
 * - **v0.7.2+**: accinput encoding with discriminator-based union (0=operandtuple, 1=defxfer)
 *
 * @param accumulateInput - Accumulate input to encode
 * @param jamVersion - Optional JAM version. Defaults to v0.7.2
 * @returns Encoded octet sequence
 */
export function encodeAccumulateInput(
  accumulateInput: AccumulateInput,
  jamVersion?: JamVersion,
): Safe<Uint8Array> {
  const version = jamVersion ?? DEFAULT_JAM_VERSION
  
  // Check if version is <= 0.7.0 (accinput encoding didn't exist)
  const isV070OrEarlier =
    version.major < 0 ||
    (version.major === 0 && version.minor < 7) ||
    (version.major === 0 && version.minor === 7 && version.patch <= 0)
  
  if (isV070OrEarlier) {
    // In v0.7.0, accinput didn't exist - encode as raw type
    if (accumulateInput.type === 0) {
      // Operand tuple: just encode the tuple directly
      return encodeOperandTuple(accumulateInput.value as OperandTuple)
    } else {
      // Deferred transfer: just encode the tuple directly
      return encodeDeferredTransfer(accumulateInput.value as DeferredTransfer, version)
    }
  }
  const parts: Uint8Array[] = []

  // v0.7.2+ encoding with discriminator
  if (accumulateInput.type === 0) {
    // encode{0, encode[U]{o}} for operand tuple
    parts.push(new Uint8Array([0])) // Discriminator

    const [error, operandEncoded] = encodeOperandTuple(
      accumulateInput.value as OperandTuple,
    )
    if (error) {
      return safeError(error)
    }
    parts.push(operandEncoded)
  } else if (accumulateInput.type === 1) {
    // encode{1, encode[X]{o}} for deferred transfer
    parts.push(new Uint8Array([1])) // Discriminator

    const [error, transferEncoded] = encodeDeferredTransfer(
      accumulateInput.value as DeferredTransfer,
      version,
    )
    if (error) {
      return safeError(error)
    }
    parts.push(transferEncoded)
  } else {
    return safeError(new Error(`Invalid accumulate input type`))
  }

  return safeResult(concatBytes(parts))
}

/**
 * Decode accumulate input according to Gray Paper specification.
 *
 * Gray Paper Equation 289-292 (label: decode{AI ∈ accinput}):
 * Inverse of encode{AI ∈ accinput} ≡ {
 *   decode{0, decode[U]{o}}  when AI ∈ operandtuple
 *   decode{1, decode[X]{o}}  when AI ∈ defxfer
 * }
 *
 * Decodes accumulate input from octet sequence back to structured data.
 * Must exactly reverse the encoding process to maintain round-trip compatibility.
 *
 * Discriminator decoding per Gray Paper:
 * - **Type 0**: Decode as operand tuple (work item results)
 * - **Type 1**: Decode as deferred transfer (value movement)
 *
 * Field decoding per Gray Paper:
 * 1. Discriminator: 1-byte type indicator (0 or 1)
 * 2. Payload: Variable-length data decoded based on discriminator
 *   - Type 0: decodeOperandTuple for work item results
 *   - Type 1: decodeDeferredTransfer for value transfers
 *
 * ✅ CORRECT: Uses 1-byte discriminator decoding
 * ✅ CORRECT: Proper delegation to type-specific decoders
 * ✅ CORRECT: Uses safeError instead of throw for error handling
 * ✅ CORRECT: Maintains round-trip compatibility
 *
 * Version differences:
 * - **v0.7.0**: accinput decoding did not exist (only raw defxfer/operandtuple)
 * - **v0.7.2+**: accinput decoding with discriminator-based union (0=operandtuple, 1=defxfer)
 *
 * @param data - Octet sequence to decode
 * @param jamVersion - Optional JAM version. Defaults to v0.7.2
 * @returns Decoded accumulate input and remaining data
 */
export function decodeAccumulateInput(
  data: Uint8Array,
  jamVersion?: JamVersion,
): Safe<DecodingResult<AccumulateInput>> {
  const version = jamVersion ?? DEFAULT_JAM_VERSION
  
  // Check if version is <= 0.7.0 (accinput encoding didn't exist)
  const isV070OrEarlier =
    version.major < 0 ||
    (version.major === 0 && version.minor < 7) ||
    (version.major === 0 && version.minor === 7 && version.patch <= 0)
  
  if (isV070OrEarlier) {
    // In v0.7.0, accinput didn't exist - try to decode as raw operand tuple first
    // (operand tuples are more common, so try that first)
    const [error1, operandResult] = decodeOperandTuple(data)
    if (!error1) {
      return safeResult({
        value: { type: 0, value: operandResult.value },
        remaining: operandResult.remaining,
        consumed: operandResult.consumed,
      })
    }
    
    // If operand tuple fails, try deferred transfer
    const [error2, transferResult] = decodeDeferredTransfer(data, version)
    if (!error2) {
      return safeResult({
        value: { type: 1, value: transferResult.value },
        remaining: transferResult.remaining,
        consumed: transferResult.consumed,
      })
    }
    
    return safeError(new Error('Could not decode as v0.7.0 format (neither operand tuple nor deferred transfer)'))
  }
  if (data.length === 0) {
    return safeError(
      new Error('Insufficient data for accumulate input decoding'),
    )
  }

  const discriminator = data[0]
  const remainingData = data.slice(1)

  // v0.7.2+ decoding with discriminator
  if (discriminator === 0) {
    // Operand tuple: decode{0, decode[U]{o}}
    const [error, operandTupleResult] = decodeOperandTuple(remainingData)
    if (error) {
      return safeError(error)
    }
    const operandTuple = operandTupleResult.value
    const remaining = operandTupleResult.remaining
    const consumed = data.length - remaining.length
    return safeResult({
      value: { type: 0, value: operandTuple },
      remaining,
      consumed,
    })
  } else if (discriminator === 1) {
    // Deferred transfer: decode{1, decode[X]{o}}
    const [error, deferredTransferResult] =
      decodeDeferredTransfer(remainingData, version)
    if (error) {
      return safeError(error)
    }
    const deferredTransfer = deferredTransferResult.value
    const remaining = deferredTransferResult.remaining
    const consumed = data.length - remaining.length
    return safeResult({
      value: { type: 1, value: deferredTransfer },
      remaining,
      consumed,
    })
  } else {
    return safeError(
      new Error(`Invalid accumulate input discriminator: ${discriminator}`),
    )
  }
}
