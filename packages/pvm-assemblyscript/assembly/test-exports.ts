
// =============================================================================
// Implications Encoding/Decoding Wrappers for Round-Trip Testing
// =============================================================================

import { decodeImplicationsPair, encodeImplicationsPair, decodeImplications, encodeImplications, decodeCompleteServiceAccount, encodeCompleteServiceAccount, decodePartialState, encodePartialState, decodeProgramFromPreimage, DecodedProgram, decodeAccumulateInput, encodeAccumulateInput, decodeVariableSequence, encodeVariableSequenceGeneric, AccumulateInput } from './codec'

/**
 * Round-trip decode and encode single Implications
 * Used for testing interoperability between TypeScript and AssemblyScript
 * 
 * This function decodes the input bytes to Implications, then re-encodes them
 * back to bytes, returning the encoded result.
 * 
 * @param data - Encoded Implications bytes
 * @param numCores - Number of cores (Ccorecount)
 * @param numValidators - Number of validators (Cvalcount)
 * @param authQueueSize - Authorization queue size (C_authqueuesize)
 * @returns Re-encoded Implications bytes (or empty array on error)
 */
export function roundTripSingleImplications(
  data: Uint8Array,
  numCores: i32,
  numValidators: i32,
  authQueueSize: i32,
): Uint8Array {
  // Decode Implications from bytes
  const decodeResult = decodeImplications(data, numCores, numValidators, authQueueSize)
  if (!decodeResult) {
    // Decode failed - return empty array
    return new Uint8Array(0)
  }
  
  // Encode the implications back to bytes
  const encoded = encodeImplications(decodeResult.value, numCores, numValidators, authQueueSize)
  
  // Ensure we always return a valid Uint8Array (not null/undefined)
  if (encoded === null || encoded.length === 0) {
    return new Uint8Array(0)
  }
  
  return encoded
}

/**
 * Round-trip decode and encode ImplicationsPair
 * Used for testing interoperability between TypeScript and AssemblyScript
 * 
 * This function decodes the input bytes to ImplicationsPair, then re-encodes them
 * back to bytes, returning the encoded result.
 * 
 * @param data - Encoded ImplicationsPair bytes
 * @param numCores - Number of cores (Ccorecount)
 * @param numValidators - Number of validators (Cvalcount)
 * @param authQueueSize - Authorization queue size (C_authqueuesize)
 * @returns Re-encoded ImplicationsPair bytes (or empty array on error)
 */
export function roundTripImplications(
  data: Uint8Array,
  numCores: i32,
  numValidators: i32,
  authQueueSize: i32,
): Uint8Array {
  // Decode ImplicationsPair from bytes
  const decodeResult = decodeImplicationsPair(data, numCores, numValidators, authQueueSize)
  if (!decodeResult) {
    // Decode failed - return empty array
    return new Uint8Array(0)
  }
  
  // Encode the pair back to bytes
  const encoded = encodeImplicationsPair(decodeResult.value, numCores, numValidators, authQueueSize)
  
  // Ensure we always return a valid Uint8Array (not null/undefined)
  if (encoded === null || encoded.length === 0) {
    return new Uint8Array(0)
  }
  
  return encoded
}

/**
 * Round-trip encode/decode for CompleteServiceAccount
 * 
 * Decodes a CompleteServiceAccount from bytes, then re-encodes it.
 * Useful for testing encoding/decoding compatibility between TypeScript and AssemblyScript.
 * 
 * @param data - Encoded CompleteServiceAccount bytes
 * @returns Re-encoded CompleteServiceAccount bytes (or empty array on error)
 */
export function roundTripServiceAccount(data: Uint8Array): Uint8Array {
  // Decode CompleteServiceAccount from bytes
  const decodeResult = decodeCompleteServiceAccount(data)
  if (!decodeResult) {
    // Decode failed - return empty array
    return new Uint8Array(0)
  }
  
  // Encode the account back to bytes
  const encoded = encodeCompleteServiceAccount(decodeResult.value)
  
  // Ensure we always return a valid Uint8Array (not null/undefined)
  if (encoded === null || encoded.length === 0) {
    return new Uint8Array(0)
  }
  
  return encoded
}

/**
 * Round-trip encode/decode for PartialState
 * 
 * Decodes a PartialState from bytes, then re-encodes it.
 * Useful for testing encoding/decoding compatibility between TypeScript and AssemblyScript.
 * 
 * @param data - Encoded PartialState bytes
 * @param numCores - Number of cores (Ccorecount)
 * @param numValidators - Number of validators (Cvalcount)
 * @param authQueueSize - Authorization queue size (C_authqueuesize)
 * @returns Re-encoded PartialState bytes (or empty array on error)
 */
export function roundTripPartialState(
  data: Uint8Array,
  numCores: i32,
  numValidators: i32,
  authQueueSize: i32,
): Uint8Array {
  // Decode PartialState from bytes
  const decodeResult = decodePartialState(data, numCores, numValidators, authQueueSize)
  if (!decodeResult) {
    // Decode failed - return empty array
    return new Uint8Array(0)
  }
  
  // Encode the state back to bytes
  const encoded = encodePartialState(decodeResult.value, numCores, numValidators, authQueueSize)
  
  // Ensure we always return a valid Uint8Array (not null/undefined)
  if (encoded === null || encoded.length === 0) {
    return new Uint8Array(0)
  }
  
  return encoded
}

/**
 * DecodedProgramFields structure for returning all fields
 */
export class DecodedProgramFields {
  metadata: Uint8Array
  roDataLength: u32
  rwDataLength: u32
  heapZeroPaddingSize: u32
  stackSize: u32
  roData: Uint8Array
  rwData: Uint8Array
  codeSize: u32
  code: Uint8Array

  constructor(
    metadata: Uint8Array,
    roDataLength: u32,
    rwDataLength: u32,
    heapZeroPaddingSize: u32,
    stackSize: u32,
    roData: Uint8Array,
    rwData: Uint8Array,
    codeSize: u32,
    code: Uint8Array,
  ) {
    this.metadata = metadata
    this.roDataLength = roDataLength
    this.rwDataLength = rwDataLength
    this.heapZeroPaddingSize = heapZeroPaddingSize
    this.stackSize = stackSize
    this.roData = roData
    this.rwData = rwData
    this.codeSize = codeSize
    this.code = code
  }
}

/**
 * Get all fields from DecodedProgram for comparison testing
 * This decodes the preimage blob and returns all fields for comparison with TypeScript
 * 
 * @param preimageBlob - The preimage blob bytes to decode
 * @returns All decoded program fields or null if decode fails
 */
export function getDecodedProgramFields(preimageBlob: Uint8Array): DecodedProgramFields | null {
  // Decode the preimage blob
  const decoded = decodeProgramFromPreimage(preimageBlob)
  if (!decoded) {
    return null
  }
  
  // Return all fields
  return new DecodedProgramFields(
    decoded.metadata,
    decoded.roDataLength,
    decoded.rwDataLength,
    decoded.heapZeroPaddingSize,
    decoded.stackSize,
    decoded.roData,
    decoded.rwData,
    decoded.codeSize,
    decoded.code,
  )
}

// =============================================================================
// AccumulateInput Encoding/Decoding Wrappers for Round-Trip Testing
// =============================================================================

/**
 * Round-trip decode and encode AccumulateInputs sequence
 * Used for testing interoperability between TypeScript and AssemblyScript
 * 
 * This function decodes the input bytes as a variable-length sequence of AccumulateInputs,
 * then re-encodes them back to bytes, returning the encoded result.
 * 
 * @param data - Encoded AccumulateInputs sequence bytes (var{sequence{accinput}})
 * @returns Re-encoded AccumulateInputs sequence bytes (or empty array on error)
 */
export function roundTripAccumulateInputs(data: Uint8Array): Uint8Array {
  // Decode variable-length sequence of AccumulateInputs from bytes
  const decodeResult = decodeVariableSequence<AccumulateInput>(
    data,
    (inputData: Uint8Array) => decodeAccumulateInput(inputData),
  )
  
  if (!decodeResult) {
    // Decode failed - return empty array
    return new Uint8Array(0)
  }
  
  const inputs = decodeResult.value
  
  // Encode the sequence back to bytes using encodeVariableSequenceGeneric
  const encoded = encodeVariableSequenceGeneric<AccumulateInput>(
    inputs,
    (input: AccumulateInput) => encodeAccumulateInput(input),
  )
  
  // Ensure we always return a valid Uint8Array (not null/undefined)
  if (encoded === null || encoded.length === 0) {
    return new Uint8Array(0)
  }
  
  return encoded
}

/**
 * Round-trip decode and encode a single AccumulateInput
 * Used for testing interoperability between TypeScript and AssemblyScript
 * 
 * This function decodes a single AccumulateInput from bytes, then re-encodes it.
 * 
 * @param data - Encoded AccumulateInput bytes
 * @returns Re-encoded AccumulateInput bytes (or empty array on error)
 */
export function roundTripSingleAccumulateInput(data: Uint8Array): Uint8Array {
  // Decode single AccumulateInput from bytes
  const decodeResult = decodeAccumulateInput(data)
  
  if (!decodeResult) {
    // Decode failed - return empty array
    return new Uint8Array(0)
  }
  
  // Encode the input back to bytes
  const encoded = encodeAccumulateInput(decodeResult.value)
  
  // Ensure we always return a valid Uint8Array (not null/undefined)
  if (encoded === null || encoded.length === 0) {
    return new Uint8Array(0)
  }
  
  return encoded
}
