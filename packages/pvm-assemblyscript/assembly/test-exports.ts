
// =============================================================================
// Implications Encoding/Decoding Wrappers for Round-Trip Testing
// =============================================================================

import { decodeImplicationsPair, encodeImplicationsPair, decodeImplications, encodeImplications, decodeCompleteServiceAccount, encodeCompleteServiceAccount, decodePartialState, encodePartialState, decodeProgramFromPreimage, DecodedProgram, decodeAccumulateInput, encodeAccumulateInput, decodeVariableSequence, encodeVariableSequenceGeneric, AccumulateInput, createStorageKey, createPreimageKey, createRequestKey, encodeFixedLength, getStorageValue, RawCshKeyvals } from './codec'
import { blake2b256 } from './crypto'

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

// =============================================================================
// Key Generation Exports for Testing Equivalence
// =============================================================================

/**
 * Generate a storage state key for testing
 * C(s, h) where h is the storage key
 * 
 * @param serviceId - Service ID (4 bytes little-endian)
 * @param storageKey - Storage key (arbitrary length)
 * @returns 31-byte interleaved state key
 */
export function testCreateStorageKey(serviceId: u32, storageKey: Uint8Array): Uint8Array {
  return createStorageKey(serviceId, storageKey)
}

/**
 * Generate a preimage state key for testing
 * C(s, h) where h is the preimage hash
 * 
 * @param serviceId - Service ID (4 bytes little-endian)
 * @param preimageHash - Preimage hash (32 bytes)
 * @returns 31-byte interleaved state key
 */
export function testCreatePreimageKey(serviceId: u32, preimageHash: Uint8Array): Uint8Array {
  return createPreimageKey(serviceId, preimageHash)
}

/**
 * Generate a request state key for testing
 * C(s, encode[4]{l} || h) where l is length and h is request hash
 * 
 * @param serviceId - Service ID (4 bytes little-endian)
 * @param requestHash - Request hash (32 bytes)
 * @param length - Blob length
 * @returns 31-byte interleaved state key
 */
export function testCreateRequestKey(serviceId: u32, requestHash: Uint8Array, length: u64): Uint8Array {
  return createRequestKey(serviceId, requestHash, length)
}

/**
 * Test the Blake2b-256 hash function
 * 
 * @param data - Data to hash
 * @returns 32-byte Blake2b-256 hash
 */
export function testBlake2b256(data: Uint8Array): Uint8Array {
  return blake2b256(data)
}

/**
 * Test fixed-length encoding
 * 
 * @param value - Value to encode
 * @param length - Number of bytes
 * @returns Encoded bytes (little-endian)
 */
export function testEncodeFixedLength(value: u64, length: i32): Uint8Array {
  return encodeFixedLength(value, length)
}

// =============================================================================
// Host Function Logic Exports for Testing Equivalence
// =============================================================================

import {
  CompleteServiceAccount,
  getRequestValue,
  setRequestValue,
  deleteRequestValue,
  getStorageValue,
  setStorageValue,
  deleteStorageValue,
  getPreimageValue,
  setPreimageValue,
  deletePreimageValue,
  encodeRequestTimeslots,
  decodeRequestTimeslots,
  RawCshKeyvals,
  CshEntry,
} from './codec'

// Deposit constants (Gray Paper)
const C_BASEDEPOSIT: u64 = u64(100) // Base deposit
const C_ITEMDEPOSIT: u64 = u64(10) // Per-item deposit
const C_BYTEDEPOSIT: u64 = u64(1) // Per-byte deposit

/**
 * Test result for host function operations
 */
export class HostFunctionTestResult {
  /** Result code: 0 = success, negative = error code */
  resultCode: i64
  /** Updated service account (encoded) */
  encodedAccount: Uint8Array
  /** Additional return value (e.g., previous length for WRITE) */
  returnValue: u64
  
  constructor(resultCode: i64, encodedAccount: Uint8Array, returnValue: u64) {
    this.resultCode = resultCode
    this.encodedAccount = encodedAccount
    this.returnValue = returnValue
  }
}

/**
 * Calculate minimum balance based on items and octets
 * Gray Paper: a_minbalance = max(0, Cbasedeposit + Citemdeposit * a_items + Cbytedeposit * a_octets - a_gratis)
 */
export function testCalculateMinBalance(items: u64, octets: u64, gratis: u64): u64 {
  const totalDeposit = C_BASEDEPOSIT + C_ITEMDEPOSIT * items + C_BYTEDEPOSIT * octets
  return totalDeposit > gratis ? totalDeposit - gratis : u64(0)
}

/**
 * Test SOLICIT host function logic
 * 
 * Tests the core logic of the SOLICIT host function without the full PVM context.
 * 
 * @param encodedAccount - Encoded service account
 * @param serviceId - Service ID
 * @param requestHash - 32-byte request hash
 * @param preimageLength - Length of the preimage
 * @param timeslot - Current timeslot
 * @returns HostFunctionTestResult with result code and updated account
 */
export function testSolicitLogic(
  encodedAccount: Uint8Array,
  serviceId: u32,
  requestHash: Uint8Array,
  preimageLength: u64,
  timeslot: u64,
): HostFunctionTestResult {
  // Decode service account
  const decodeResult = decodeCompleteServiceAccount(encodedAccount)
  if (!decodeResult) {
    return new HostFunctionTestResult(i64(-9), new Uint8Array(0), u64(0)) // HUH
  }
  const serviceAccount = decodeResult.value
  
  // Look up existing request
  const existingRequestValue = getRequestValue(serviceAccount, serviceId, requestHash, preimageLength)
  
  // Determine new request state
  let newTimeslots: u32[]
  let isNewRequest = false
  
  if (existingRequestValue === null) {
    // Request doesn't exist - create empty request []
    newTimeslots = []
    isNewRequest = true
  } else {
    // Decode existing request
    const existingTimeslots = decodeRequestTimeslots(existingRequestValue)
    if (existingTimeslots === null) {
      return new HostFunctionTestResult(i64(-9), new Uint8Array(0), u64(0)) // HUH
    }
    
    if (existingTimeslots.length === 2) {
      // Request exists as [x, y] - append current timeslot to make [x, y, t]
      newTimeslots = [existingTimeslots[0], existingTimeslots[1], u32(timeslot)]
    } else {
      // Invalid request state - cannot solicit
      return new HostFunctionTestResult(i64(-9), new Uint8Array(0), u64(0)) // HUH
    }
  }
  
  // Calculate new items and octets if this is a new request
  const newItems = isNewRequest
    ? serviceAccount.items + u32(2)
    : serviceAccount.items
  const newOctets = isNewRequest
    ? serviceAccount.octets + u64(81) + preimageLength
    : serviceAccount.octets
  
  // Calculate new minimum balance
  const newMinBalance = testCalculateMinBalance(u64(newItems), newOctets, serviceAccount.gratis)
  
  // Check if service has sufficient balance
  if (newMinBalance > serviceAccount.balance) {
    return new HostFunctionTestResult(i64(-5), new Uint8Array(0), u64(0)) // FULL
  }
  
  // Update service account with new request
  setRequestValue(serviceAccount, serviceId, requestHash, preimageLength, encodeRequestTimeslots(newTimeslots))
  
  // Update items and octets if this is a new request
  if (isNewRequest) {
    serviceAccount.items = newItems
    serviceAccount.octets = newOctets
  }
  
  // Encode updated account
  const encodedUpdated = encodeCompleteServiceAccount(serviceAccount)
  
  return new HostFunctionTestResult(i64(0), encodedUpdated, u64(0)) // OK
}

/**
 * Test FORGET host function logic
 * 
 * @param encodedAccount - Encoded service account
 * @param serviceId - Service ID
 * @param requestHash - 32-byte request hash
 * @param preimageLength - Length of the preimage
 * @param timeslot - Current timeslot
 * @param expungePeriod - Expunge period constant
 * @returns HostFunctionTestResult with result code and updated account
 */
export function testForgetLogic(
  encodedAccount: Uint8Array,
  serviceId: u32,
  requestHash: Uint8Array,
  preimageLength: u64,
  timeslot: u64,
  expungePeriod: u64,
): HostFunctionTestResult {
  // Decode service account
  const decodeResult = decodeCompleteServiceAccount(encodedAccount)
  if (!decodeResult) {
    return new HostFunctionTestResult(i64(-9), new Uint8Array(0), u64(0)) // HUH
  }
  const serviceAccount = decodeResult.value
  
  // Get request
  const requestValue = getRequestValue(serviceAccount, serviceId, requestHash, preimageLength)
  if (requestValue === null) {
    return new HostFunctionTestResult(i64(-9), new Uint8Array(0), u64(0)) // HUH
  }
  
  // Decode request timeslots
  const timeslots = decodeRequestTimeslots(requestValue)
  if (timeslots === null) {
    return new HostFunctionTestResult(i64(-9), new Uint8Array(0), u64(0)) // HUH
  }
  
  // Apply Gray Paper logic for different request states
  if (timeslots.length === 0) {
    // Case 1: [] - Remove request and preimage completely
    deleteRequestValue(serviceAccount, serviceId, requestHash, preimageLength)
    deletePreimageValue(serviceAccount, serviceId, requestHash)
    // Update items and octets
    if (serviceAccount.items >= u32(2)) {
      serviceAccount.items -= u32(2)
    } else {
      serviceAccount.items = u32(0)
    }
    const octetsDelta = u64(81) + preimageLength
    if (serviceAccount.octets >= octetsDelta) {
      serviceAccount.octets -= octetsDelta
    } else {
      serviceAccount.octets = u64(0)
    }
  } else if (timeslots.length === 2) {
    // Case 2: [x, y] where y < t - expungePeriod - Remove completely
    const y = u64(timeslots[1])
    if (y < timeslot - expungePeriod) {
      deleteRequestValue(serviceAccount, serviceId, requestHash, preimageLength)
      deletePreimageValue(serviceAccount, serviceId, requestHash)
      if (serviceAccount.items >= u32(2)) {
        serviceAccount.items -= u32(2)
      } else {
        serviceAccount.items = u32(0)
      }
      const octetsDelta2 = u64(81) + preimageLength
      if (serviceAccount.octets >= octetsDelta2) {
        serviceAccount.octets -= octetsDelta2
      } else {
        serviceAccount.octets = u64(0)
      }
    } else {
      return new HostFunctionTestResult(i64(-9), new Uint8Array(0), u64(0)) // HUH
    }
  } else if (timeslots.length === 1) {
    // Case 3: [x] - Update to [x, t]
    const x = timeslots[0]
    const newTimeslots: u32[] = [x, u32(timeslot)]
    setRequestValue(serviceAccount, serviceId, requestHash, preimageLength, encodeRequestTimeslots(newTimeslots))
  } else if (timeslots.length === 3) {
    // Case 4: [x, y, w] where y < t - expungePeriod - Update to [w, t]
    const y = u64(timeslots[1])
    const w = timeslots[2]
    if (y < timeslot - expungePeriod) {
      const newTimeslots2: u32[] = [w, u32(timeslot)]
      setRequestValue(serviceAccount, serviceId, requestHash, preimageLength, encodeRequestTimeslots(newTimeslots2))
    } else {
      return new HostFunctionTestResult(i64(-9), new Uint8Array(0), u64(0)) // HUH
    }
  } else {
    return new HostFunctionTestResult(i64(-9), new Uint8Array(0), u64(0)) // HUH
  }
  
  // Encode updated account
  const encodedUpdated = encodeCompleteServiceAccount(serviceAccount)
  
  return new HostFunctionTestResult(i64(0), encodedUpdated, u64(0)) // OK
}

/**
 * Test QUERY host function logic
 * 
 * @param encodedAccount - Encoded service account
 * @param serviceId - Service ID
 * @param requestHash - 32-byte request hash
 * @param preimageLength - Length of the preimage
 * @returns HostFunctionTestResult with registers[7] and registers[8] packed in resultCode and returnValue
 */
export function testQueryLogic(
  encodedAccount: Uint8Array,
  serviceId: u32,
  requestHash: Uint8Array,
  preimageLength: u64,
): HostFunctionTestResult {
  // Decode service account
  const decodeResult = decodeCompleteServiceAccount(encodedAccount)
  if (!decodeResult) {
    return new HostFunctionTestResult(i64(-9), new Uint8Array(0), u64(0)) // NONE
  }
  const serviceAccount = decodeResult.value
  
  // Look up request
  const requestValue = getRequestValue(serviceAccount, serviceId, requestHash, preimageLength)
  if (requestValue === null) {
    return new HostFunctionTestResult(i64(-9), new Uint8Array(0), u64(0)) // NONE
  }
  
  // Decode request timeslots
  const timeslots = decodeRequestTimeslots(requestValue)
  if (timeslots === null) {
    return new HostFunctionTestResult(i64(-9), new Uint8Array(0), u64(0)) // NONE
  }
  
  // Return encoded status
  const TWO_TO_32: u64 = u64(4294967296)
  let reg7: u64 = u64(0)
  let reg8: u64 = u64(0)
  
  if (timeslots.length === 0) {
    reg7 = u64(0)
    reg8 = u64(0)
  } else if (timeslots.length === 1) {
    const x = u64(timeslots[0])
    reg7 = u64(1) + TWO_TO_32 * x
    reg8 = u64(0)
  } else if (timeslots.length === 2) {
    const x = u64(timeslots[0])
    const y = u64(timeslots[1])
    reg7 = u64(2) + TWO_TO_32 * x
    reg8 = y
  } else if (timeslots.length === 3) {
    const x = u64(timeslots[0])
    const y = u64(timeslots[1])
    const z = u64(timeslots[2])
    reg7 = u64(3) + TWO_TO_32 * x
    reg8 = y + TWO_TO_32 * z
  } else {
    return new HostFunctionTestResult(i64(-9), new Uint8Array(0), u64(0)) // NONE
  }
  
  return new HostFunctionTestResult(i64(reg7), new Uint8Array(0), reg8)
}

/**
 * Test WRITE host function logic
 * 
 * @param encodedAccount - Encoded service account
 * @param serviceId - Service ID
 * @param key - Storage key
 * @param value - Storage value (empty to delete)
 * @returns HostFunctionTestResult with result (previous length or error) and updated account
 */
export function testWriteLogic(
  encodedAccount: Uint8Array,
  serviceId: u32,
  key: Uint8Array,
  value: Uint8Array,
): HostFunctionTestResult {
  // Decode service account
  const decodeResult = decodeCompleteServiceAccount(encodedAccount)
  if (!decodeResult) {
    return new HostFunctionTestResult(i64(-9), new Uint8Array(0), u64(0)) // HUH
  }
  const serviceAccount = decodeResult.value
  
  // Get previous value
  const previousValue = getStorageValue(serviceAccount, serviceId, key)
  const previousLength = previousValue ? i64(previousValue.length) : i64(-9) // NONE
  
  if (value.length === 0) {
    // Delete operation
    let newItems = u64(serviceAccount.items)
    let newOctets = serviceAccount.octets
    
    if (previousValue !== null) {
      newItems = newItems > u64(0) ? newItems - u64(1) : u64(0)
      const deletedOctets = u64(34) + u64(key.length) + u64(previousValue.length)
      newOctets = newOctets > deletedOctets ? newOctets - deletedOctets : u64(0)
    }
    
    // Check balance
    const newMinBalance = testCalculateMinBalance(newItems, newOctets, serviceAccount.gratis)
    if (newMinBalance > serviceAccount.balance) {
      return new HostFunctionTestResult(i64(-5), new Uint8Array(0), u64(0)) // FULL
    }
    
    // Delete
    if (previousValue !== null) {
      deleteStorageValue(serviceAccount, serviceId, key)
      serviceAccount.items = u32(newItems)
      serviceAccount.octets = newOctets
    }
  } else {
    // Write operation
    let newItems = u64(serviceAccount.items)
    let newOctets = serviceAccount.octets
    
    if (previousValue !== null) {
      // Updating existing
      newOctets = newOctets - u64(previousValue.length) + u64(value.length)
    } else {
      // Adding new
      newItems = newItems + u64(1)
      newOctets = newOctets + u64(34) + u64(key.length) + u64(value.length)
    }
    
    // Check balance
    const newMinBalance = testCalculateMinBalance(newItems, newOctets, serviceAccount.gratis)
    if (newMinBalance > serviceAccount.balance) {
      return new HostFunctionTestResult(i64(-5), new Uint8Array(0), u64(0)) // FULL
    }
    
    // Write
    setStorageValue(serviceAccount, serviceId, key, value)
    serviceAccount.items = u32(newItems)
    serviceAccount.octets = newOctets
  }
  
  // Encode updated account
  const encodedUpdated = encodeCompleteServiceAccount(serviceAccount)
  
  return new HostFunctionTestResult(previousLength, encodedUpdated, u64(0))
}

/**
 * Test READ host function logic
 * 
 * @param encodedAccount - Encoded service account
 * @param serviceId - Service ID
 * @param key - Storage key
 * @param fromOffset - Offset to start reading from
 * @param length - Maximum length to read
 * @returns HostFunctionTestResult with length or error, and the read data
 */
export function testReadLogic(
  encodedAccount: Uint8Array,
  serviceId: u32,
  key: Uint8Array,
  fromOffset: u32,
  length: u32,
): HostFunctionTestResult {
  // Decode service account
  const decodeResult = decodeCompleteServiceAccount(encodedAccount)
  if (!decodeResult) {
    return new HostFunctionTestResult(i64(-9), new Uint8Array(0), u64(0)) // NONE
  }
  const serviceAccount = decodeResult.value
  
  // Get value
  const storedValue = getStorageValue(serviceAccount, serviceId, key)
  if (storedValue === null) {
    return new HostFunctionTestResult(i64(-9), new Uint8Array(0), u64(0)) // NONE
  }
  
  // Calculate slice
  const f = min(i32(fromOffset), storedValue.length)
  const l = min(i32(length), storedValue.length - f)
  const slicedData = storedValue.slice(f, f + l)
  
  return new HostFunctionTestResult(i64(storedValue.length), slicedData, u64(l))
}

/**
 * Test request timeslot encoding
 * 
 * @param timeslots - Array of timeslots (0-3 entries)
 * @returns Encoded bytes
 */
export function testEncodeRequestTimeslots(timeslots: u32[]): Uint8Array {
  return encodeRequestTimeslots(timeslots)
}

/**
 * Test request timeslot decoding
 * 
 * @param data - Encoded request value
 * @returns Decoded timeslots or null
 */
export function testDecodeRequestTimeslots(data: Uint8Array): u32[] | null {
  return decodeRequestTimeslots(data)
}

// =============================================================================
// SBRK Instruction Logic Exports for Testing Equivalence
// =============================================================================

import { alignToPage } from './alignment-helpers'
import { MEMORY_CONFIG, MAX_MEMORY_ADDRESS, PAGE_SIZE, INIT_CONFIG } from './config'

/**
 * Test result for SBRK instruction
 */
export class SBRKTestResult {
  /** Result register value (new heap pointer or 0 on failure) */
  resultValue: u64
  /** New current heap pointer after operation */
  newHeapPointer: u32
  /** Number of pages allocated */
  pagesAllocated: u32
  /** Start page index for allocation */
  startPageIndex: u32
  
  constructor(resultValue: u64, newHeapPointer: u32, pagesAllocated: u32, startPageIndex: u32) {
    this.resultValue = resultValue
    this.newHeapPointer = newHeapPointer
    this.pagesAllocated = pagesAllocated
    this.startPageIndex = startPageIndex
  }
}

/**
 * Test SBRK instruction logic
 * 
 * Tests the core SBRK logic without full PVM context.
 * Returns the result value and new heap state.
 * 
 * @param currentHeapPointer - Current heap pointer before SBRK
 * @param requestedSize - Requested allocation size (registers[A])
 * @returns SBRKTestResult with all computed values
 */
export function testSbrkLogic(
  currentHeapPointer: u32,
  requestedSize: u64,
): SBRKTestResult {
  // If requestedSize == 0, return current heap pointer (query mode)
  if (requestedSize === u64(0)) {
    return new SBRKTestResult(
      u64(currentHeapPointer),
      currentHeapPointer,
      0,
      0
    )
  }
  
  // Record current heap pointer to return (before allocation)
  const result = u64(currentHeapPointer)
  
  // Calculate new heap pointer
  const nextPageBoundary = alignToPage(currentHeapPointer)
  const newHeapPointer: u32 = currentHeapPointer + u32(requestedSize)
  
  // Check for overflow
  if (newHeapPointer > MAX_MEMORY_ADDRESS) {
    return new SBRKTestResult(
      u64(0), // Return 0 on failure
      currentHeapPointer, // Heap pointer unchanged
      0,
      0
    )
  }
  
  // Calculate pages to allocate
  let pagesAllocated: u32 = 0
  let startPageIndex: u32 = 0
  
  if (newHeapPointer > nextPageBoundary) {
    const finalBoundary = alignToPage(newHeapPointer)
    startPageIndex = nextPageBoundary / PAGE_SIZE
    const endPageIndex = finalBoundary / PAGE_SIZE
    pagesAllocated = endPageIndex - startPageIndex
  }
  
  return new SBRKTestResult(
    result,
    newHeapPointer,
    pagesAllocated,
    startPageIndex
  )
}

/**
 * Test page alignment function
 * 
 * @param address - Address to align
 * @returns Page-aligned address (aligned up to next page boundary)
 */
export function testAlignToPage(address: u32): u32 {
  return alignToPage(address)
}

/**
 * Get memory configuration constants for testing
 */
export function testGetMemoryConfig(): Uint8Array {
  // Return 12 bytes: PAGE_SIZE (4), MAX_MEMORY_ADDRESS (4), ZONE_SIZE (4)
  const buffer = new Uint8Array(12)
  const pageSize = MEMORY_CONFIG.PAGE_SIZE
  const maxAddress = MAX_MEMORY_ADDRESS
  const zoneSize = INIT_CONFIG.ZONE_SIZE
  
  // Little-endian encoding
  buffer[0] = u8(pageSize & 0xFF)
  buffer[1] = u8((pageSize >> 8) & 0xFF)
  buffer[2] = u8((pageSize >> 16) & 0xFF)
  buffer[3] = u8((pageSize >> 24) & 0xFF)
  
  buffer[4] = u8(maxAddress & 0xFF)
  buffer[5] = u8((maxAddress >> 8) & 0xFF)
  buffer[6] = u8((maxAddress >> 16) & 0xFF)
  buffer[7] = u8((maxAddress >> 24) & 0xFF)
  
  buffer[8] = u8(zoneSize & 0xFF)
  buffer[9] = u8((zoneSize >> 8) & 0xFF)
  buffer[10] = u8((zoneSize >> 16) & 0xFF)
  buffer[11] = u8((zoneSize >> 24) & 0xFF)
  
  return buffer
}

// =============================================================================
// FETCH Host Function Exports for Testing Equivalence
// =============================================================================

import {
  DEPOSIT_CONSTANTS,
  HISTORY_CONSTANTS,
  SERVICE_CONSTANTS,
  TIME_CONSTANTS,
  TRANSFER_CONSTANTS,
  WORK_PACKAGE_CONSTANTS,
  WORK_REPORT_CONSTANTS,
  AUTHORIZATION_CONSTANTS,
} from './pbnj-types-compat'

/**
 * Get system constants as encoded bytes (FETCH selector 0)
 * 
 * This matches the encoding in FetchHostFunction.getSystemConstants()
 * allowing comparison with TypeScript implementation.
 * 
 * @param numCores - Number of cores
 * @param preimageExpungePeriod - Expunge period
 * @param epochDuration - Epoch duration
 * @param maxBlockGas - Max block gas
 * @param maxRefineGas - Max refine gas
 * @param maxTicketsPerExtrinsic - Max tickets per extrinsic
 * @param ticketsPerValidator - Tickets per validator
 * @param slotDuration - Slot duration (seconds)
 * @param rotationPeriod - Rotation period
 * @param numValidators - Number of validators
 * @param numEcPiecesPerSegment - EC pieces per segment
 * @param contestDuration - Contest duration
 * @param maxLookupAnchorage - Max lookup anchorage
 * @param ecPieceSize - EC piece size
 * @returns 134-byte system constants
 */
export function testGetSystemConstants(
  numCores: u16,
  preimageExpungePeriod: u32,
  epochDuration: u32,
  maxBlockGas: u64,
  maxRefineGas: u64,
  maxTicketsPerExtrinsic: u16,
  ticketsPerValidator: u16,
  slotDuration: u16,
  rotationPeriod: u16,
  numValidators: u16,
  numEcPiecesPerSegment: u32,
  contestDuration: u32,
  maxLookupAnchorage: u32,
  ecPieceSize: u32,
): Uint8Array {
  const buffer = new Uint8Array(134)
  let offset: i32 = 0

  // encode[8]{Citemdeposit = 10}
  encodeU64ToBuffer(buffer, offset, u64(DEPOSIT_CONSTANTS.C_ITEMDEPOSIT))
  offset += 8

  // encode[8]{Cbytedeposit = 1}
  encodeU64ToBuffer(buffer, offset, u64(DEPOSIT_CONSTANTS.C_BYTEDEPOSIT))
  offset += 8

  // encode[8]{Cbasedeposit = 100}
  encodeU64ToBuffer(buffer, offset, u64(DEPOSIT_CONSTANTS.C_BASEDEPOSIT))
  offset += 8

  // encode[2]{Ccorecount}
  encodeU16ToBuffer(buffer, offset, numCores)
  offset += 2

  // encode[4]{Cexpungeperiod}
  encodeU32ToBuffer(buffer, offset, preimageExpungePeriod)
  offset += 4

  // encode[4]{Cepochlen}
  encodeU32ToBuffer(buffer, offset, epochDuration)
  offset += 4

  // encode[8]{Creportaccgas = 10000000}
  encodeU64ToBuffer(buffer, offset, u64(WORK_REPORT_CONSTANTS.C_REPORTACCGAS))
  offset += 8

  // encode[8]{Cpackageauthgas = 50000000}
  encodeU64ToBuffer(buffer, offset, u64(AUTHORIZATION_CONSTANTS.C_PACKAGEAUTHGAS))
  offset += 8

  // encode[8]{Cpackagerefgas}
  encodeU64ToBuffer(buffer, offset, maxRefineGas)
  offset += 8

  // encode[8]{Cblockaccgas}
  encodeU64ToBuffer(buffer, offset, maxBlockGas)
  offset += 8

  // encode[2]{Crecenthistorylen = 8}
  encodeU16ToBuffer(buffer, offset, u16(HISTORY_CONSTANTS.C_RECENTHISTORYLEN))
  offset += 2

  // encode[2]{Cmaxpackageitems = 16}
  encodeU16ToBuffer(buffer, offset, u16(WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEITEMS))
  offset += 2

  // encode[2]{Cmaxreportdeps = 8}
  encodeU16ToBuffer(buffer, offset, u16(WORK_REPORT_CONSTANTS.C_MAXREPORTDEPS))
  offset += 2

  // encode[2]{Cmaxblocktickets}
  encodeU16ToBuffer(buffer, offset, maxTicketsPerExtrinsic)
  offset += 2

  // encode[4]{Cmaxlookupanchorage}
  encodeU32ToBuffer(buffer, offset, maxLookupAnchorage)
  offset += 4

  // encode[2]{Cticketentries}
  encodeU16ToBuffer(buffer, offset, ticketsPerValidator)
  offset += 2

  // encode[2]{Cauthpoolsize = 8}
  encodeU16ToBuffer(buffer, offset, u16(AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE))
  offset += 2

  // encode[2]{Cslotseconds}
  encodeU16ToBuffer(buffer, offset, slotDuration)
  offset += 2

  // encode[2]{Cauthqueuesize = 80}
  encodeU16ToBuffer(buffer, offset, u16(AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE))
  offset += 2

  // encode[2]{Crotationperiod}
  encodeU16ToBuffer(buffer, offset, rotationPeriod)
  offset += 2

  // encode[2]{Cmaxpackagexts = 128}
  encodeU16ToBuffer(buffer, offset, u16(WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEXTS))
  offset += 2

  // encode[2]{Cassurancetimeoutperiod = 5}
  encodeU16ToBuffer(buffer, offset, u16(TIME_CONSTANTS.C_ASSURANCETIMEOUTPERIOD))
  offset += 2

  // encode[2]{Cvalcount}
  encodeU16ToBuffer(buffer, offset, numValidators)
  offset += 2

  // encode[4]{Cmaxauthcodesize = 64000}
  encodeU32ToBuffer(buffer, offset, AUTHORIZATION_CONSTANTS.C_MAXAUTHCODESIZE)
  offset += 4

  // encode[4]{Cmaxbundlesize = 13791360}
  encodeU32ToBuffer(buffer, offset, WORK_PACKAGE_CONSTANTS.C_MAXBUNDLESIZE)
  offset += 4

  // encode[4]{Cmaxservicecodesize = 4000000}
  encodeU32ToBuffer(buffer, offset, SERVICE_CONSTANTS.C_MAXSERVICECODESIZE)
  offset += 4

  // encode[4]{Cecpiecesize}
  encodeU32ToBuffer(buffer, offset, ecPieceSize)
  offset += 4

  // encode[4]{Cmaxpackageimports = 3072}
  encodeU32ToBuffer(buffer, offset, WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEIMPORTS)
  offset += 4

  // encode[4]{Csegmentecpieces}
  encodeU32ToBuffer(buffer, offset, numEcPiecesPerSegment)
  offset += 4

  // encode[4]{Cmaxreportvarsize = 49152}
  encodeU32ToBuffer(buffer, offset, WORK_REPORT_CONSTANTS.C_MAXREPORTVARSIZE)
  offset += 4

  // encode[4]{Cmemosize = 128}
  encodeU32ToBuffer(buffer, offset, TRANSFER_CONSTANTS.C_MEMOSIZE)
  offset += 4

  // encode[4]{Cmaxpackageexports = 3072}
  encodeU32ToBuffer(buffer, offset, WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEEXPORTS)
  offset += 4

  // encode[4]{Cepochtailstart}
  encodeU32ToBuffer(buffer, offset, contestDuration)

  return buffer
}

// Helper functions for buffer encoding
function encodeU64ToBuffer(buffer: Uint8Array, offset: i32, value: u64): void {
  for (let i: i32 = 0; i < 8; i++) {
    buffer[offset + i] = u8((value >> (u64(i) * 8)) & 0xff)
  }
}

function encodeU32ToBuffer(buffer: Uint8Array, offset: i32, value: u32): void {
  for (let i: i32 = 0; i < 4; i++) {
    buffer[offset + i] = u8((value >> (i * 8)) & 0xff)
  }
}

function encodeU16ToBuffer(buffer: Uint8Array, offset: i32, value: u16): void {
  buffer[offset] = u8(value & 0xff)
  buffer[offset + 1] = u8((value >> 8) & 0xff)
}

/**
 * Debug function to decode ImplicationsPair and check rawCshKeyvals contents
 * Returns the number of entries in rawCshKeyvals for service 0
 * 
 * @param data - Encoded ImplicationsPair bytes
 * @param numCores - Number of cores
 * @param numValidators - Number of validators
 * @param authQueueSize - Authorization queue size
 * @returns Number of rawCshKeyvals entries for service 0, or -1 on error
 */
export function debugDecodeAndCheckStorage(
  data: Uint8Array,
  numCores: i32,
  numValidators: i32,
  authQueueSize: i32,
): i32 {
  // Decode ImplicationsPair
  const decodeResult = decodeImplicationsPair(data, numCores, numValidators, authQueueSize)
  if (!decodeResult) {
    return -1 // Decode failed
  }
  
  const imPair = decodeResult.value
  const imX = imPair.regular
  
  // Find service account 0
  const state = imX.state
  for (let i = 0; i < state.accounts.length; i++) {
    if (state.accounts[i].serviceId === 0) {
      const account = state.accounts[i].account
      return account.rawCshKeyvals.entries.length
    }
  }
  
  return -2 // Service 0 not found
}

/**
 * Debug function to test storage lookup
 * 
 * @param data - Encoded ImplicationsPair bytes
 * @param numCores - Number of cores
 * @param numValidators - Number of validators
 * @param authQueueSize - Authorization queue size
 * @param storageKey - The original storage key to look up
 * @returns Storage value length if found, -1 if not found, -2 if decode error
 */
export function debugStorageLookup(
  data: Uint8Array,
  numCores: i32,
  numValidators: i32,
  authQueueSize: i32,
  storageKey: Uint8Array,
): i32 {
  // Decode ImplicationsPair
  const decodeResult = decodeImplicationsPair(data, numCores, numValidators, authQueueSize)
  if (!decodeResult) {
    return -2 // Decode failed
  }
  
  const imPair = decodeResult.value
  const imX = imPair.regular
  
  // Find service account 0
  const state = imX.state
  for (let i = 0; i < state.accounts.length; i++) {
    if (state.accounts[i].serviceId === 0) {
      const account = state.accounts[i].account
      const value = getStorageValue(account, 0, storageKey)
      if (value) {
        return value.length
      } else {
        return -1 // Not found
      }
    }
  }
  
  return -3 // Service 0 not found
}

/**
 * Debug function to get the first key from rawCshKeyvals for service 0
 * 
 * @param data - Encoded ImplicationsPair bytes
 * @param numCores - Number of cores
 * @param numValidators - Number of validators
 * @param authQueueSize - Authorization queue size
 * @returns First key as Uint8Array, or empty array on error
 */
export function debugGetFirstStorageKey(
  data: Uint8Array,
  numCores: i32,
  numValidators: i32,
  authQueueSize: i32,
): Uint8Array {
  // Decode ImplicationsPair
  const decodeResult = decodeImplicationsPair(data, numCores, numValidators, authQueueSize)
  if (!decodeResult) {
    return new Uint8Array(0)
  }
  
  const imPair = decodeResult.value
  const imX = imPair.regular
  
  // Find service account 0
  const state = imX.state
  for (let i = 0; i < state.accounts.length; i++) {
    if (state.accounts[i].serviceId === 0) {
      const account = state.accounts[i].account
      if (account.rawCshKeyvals.entries.length > 0) {
        return account.rawCshKeyvals.entries[0].key
      }
      return new Uint8Array(0)
    }
  }
  
  return new Uint8Array(0)
}
