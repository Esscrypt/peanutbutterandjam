/**
 * PVM Codec Implementation (AssemblyScript)
 *
 * Implements Gray Paper codec functions for decoding program blobs
 * Gray Paper Reference: pvm.tex, serialization.tex
 */

import { blake2b256 } from './crypto'

/**
 * Decoding result structure
 */
export class DecodingResult<T> {
  value: T
  consumed: i32

  constructor(value: T, consumed: i32) {
    this.value = value
    this.consumed = consumed
  }
}

/**
 * Service code decoding result
 */
export class ServiceCodeResult {
  metadata: Uint8Array
  codeBlob: Uint8Array

  constructor(metadata: Uint8Array, codeBlob: Uint8Array) {
    this.metadata = metadata
    this.codeBlob = codeBlob
  }
}

/**
 * Decoded blob structure
 */
export class DecodedBlob {
  code: Uint8Array
  bitmask: Uint8Array
  jumpTable: u32[]
  elementSize: i32
  headerSize: i32

  constructor(
    code: Uint8Array,
    bitmask: Uint8Array,
    jumpTable: u32[],
    elementSize: i32,
    headerSize: i32,
  ) {
    this.code = code
    this.bitmask = bitmask
    this.jumpTable = jumpTable
    this.elementSize = elementSize
    this.headerSize = headerSize
  }
}

/**
 * Decoded program structure (Y function format)
 */
export class DecodedProgram {
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
 * Decoded accumulate arguments structure
 */
export class DecodedAccumulateArgs {
  timeslot: u64
  serviceId: u64
  inputLength: u64

  constructor(timeslot: u64, serviceId: u64, inputLength: u64) {
    this.timeslot = timeslot
    this.serviceId = serviceId
    this.inputLength = inputLength
  }
}

/**
 * Decode natural number according to Gray Paper specification.
 *
 * Gray Paper Equation 30-38: Variable-length encoding for natural numbers
 */
export function decodeNatural(
  data: Uint8Array,
): DecodingResult<u64> | null {
  if (data.length === 0) {
    return null
  }

  const first = data[0]

  // Gray Paper Case 1: prefix = 0 → x = 0
  if (first === 0) {
    return new DecodingResult<u64>(u64(0), 1)
  }

  // Gray Paper Case 3: prefix = 255 → large number encoding
  if (first === 0xff) {
    if (data.length < 9) {
      return null
    }

    // decode[8]{x} - 8-byte little-endian decoding
    let value: u64 = u64(0)
    for (let i: i32 = 0; i < 8; i++) {
      value |= u64(data[1 + i]) << u64(i32(i * 8))
    }

    return new DecodingResult<u64>(value, 9)
  }

  // Special case for single-byte values (1-127): direct decoding
  if (first >= 1 && first <= 127) {
    return new DecodingResult<u64>(u64(first), 1)
  }

  // Gray Paper Case 2: Variable-length encoding
  // Determine l by finding which range the prefix falls into
  let l: i32 = 0
  for (let testL: i32 = 1; testL <= 8; testL++) {
    const minPrefix: u64 = u64(256) - (u64(1) << u64(8 - testL)) // 2^8-2^(8-l)
    const maxPrefix: u64 =
      minPrefix +
      (((u64(1) << u64(7 * (testL + 1))) - u64(1)) >> u64(8 * testL))

    if (u64(first) >= minPrefix && u64(first) <= maxPrefix) {
      l = testL
      break
    }
  }

  if (l === 0) {
    return null
  }

  if (data.length < 1 + l) {
    return null
  }

  // Extract high bits from prefix: (prefix - (2^8-2^(8-l))) * 2^(8l)
  const prefixBase: u64 = u64(256) - (u64(1) << u64(8 - l)) // 2^8-2^(8-l)
  const highBits: u64 = (u64(first) - prefixBase) << u64(8 * l)

  // Extract low bits from suffix: little-endian l-byte value
  let lowBits: u64 = u64(0)
  for (let i: i32 = 0; i < l; i++) {
    lowBits |= u64(data[1 + i]) << u64(i32(i * 8))
  }

  const value: u64 = highBits | lowBits
  return new DecodingResult<u64>(value, 1 + l)
}

/**
 * Decode PVM program blob according to Gray Paper pvm.tex deblob function
 *
 * Format: p = encode(len(j)) ⊕ encode[1](z) ⊕ encode(len(c)) ⊕ encode[z](j) ⊕ encode(c) ⊕ encode(k)
 */
export function decodeBlob(
  programBlob: Uint8Array,
): DecodedBlob | null {
  let offset: i32 = 0

  // 1. Decode len(j) - jump table length
  const jumpTableLengthResult = decodeNatural(programBlob.slice(offset))
  if (!jumpTableLengthResult) {
    return null
  }
  const jumpTableLength = i32(jumpTableLengthResult.value)
  offset += jumpTableLengthResult.consumed

  // 2. Decode z - element size (1 byte)
  if (offset >= programBlob.length) {
    return null
  }
  const elementSize = programBlob[offset]
  offset += 1

  // 3. Decode len(c) - code length
  const codeLengthResult = decodeNatural(programBlob.slice(offset))
  if (!codeLengthResult) {
    return null
  }
  const codeLength = i32(codeLengthResult.value)
  offset += codeLengthResult.consumed

  const headerSize = offset

  // 4. Decode jump table data
  const jumpTableSize = jumpTableLength * elementSize
  if (offset + jumpTableSize > programBlob.length) {
    return null
  }

  const jumpTable = new Array<u32>(jumpTableLength)
  for (let i: i32 = 0; i < jumpTableLength; i++) {
    const elementStart = offset + i * elementSize
    const elementBytes = programBlob.slice(
      elementStart,
      elementStart + elementSize,
    )
    // Decode as little-endian
    let value: u32 = 0
    for (let j: i32 = 0; j < i32(elementSize); j++) {
      value |= u32(elementBytes[j]) << u32(j * 8)
    }
    jumpTable[i] = value
  }
  offset += jumpTableSize

  // 5. Extract code data
  if (offset + codeLength > programBlob.length) {
    return null
  }
  const code = programBlob.slice(offset, offset + codeLength)
  offset += codeLength

  // 6. Extract bitmask according to Gray Paper specification
  if (offset >= programBlob.length) {
    return null
  }

  const remainingBytes = programBlob.length - offset
  const bitmask = new Uint8Array(codeLength)

  // Extract packed bitmask bytes and expand them
  let bitIndex: i32 = 0
  let byteIndex: i32 = 0

  while (bitIndex < codeLength && byteIndex < remainingBytes) {
    const packedByte = programBlob[offset + byteIndex]

    // Extract up to 8 bits from this packed byte
    for (let i: i32 = 0; i < 8 && bitIndex < i32(codeLength); i++) {
      bitmask[bitIndex] = u8((u32(packedByte) >> u32(i)) & u32(1))
      bitIndex++
    }
    byteIndex++
  }

  if (bitIndex < codeLength) {
    return null
  }

  return new DecodedBlob(code, bitmask, jumpTable, elementSize, headerSize)
}

/**
 * Decode service code from preimage blob according to Gray Paper accounts.tex
 *
 * Format: encode(len(m)) || encode(m) || encode(code_blob)
 */
export function decodeServiceCodeFromPreimage(
  preimageBlob: Uint8Array,
): DecodingResult<ServiceCodeResult> | null {
  let offset: i32 = 0

  // 1. Decode metadata length
  const metadataLengthResult = decodeNatural(preimageBlob.slice(offset))
  if (!metadataLengthResult) {
    return null
  }
  const metadataLength = i32(metadataLengthResult.value)
  offset += metadataLengthResult.consumed

  // 2. Extract metadata blob
  if (offset + metadataLength > preimageBlob.length) {
    return null
  }
  const metadata = preimageBlob.slice(offset, offset + metadataLength)
  offset += metadataLength

  // 3. Remaining data is the code blob
  const codeBlob = preimageBlob.slice(offset)

  return new DecodingResult<ServiceCodeResult>(
    new ServiceCodeResult(metadata, codeBlob),
    preimageBlob.length,
  )
}

/**
 * Decode program according to Gray Paper Y function specification
 *
 * Format: E₃(|o|) || E₃(|w|) || E₂(z) || E₃(s) || o || w || E₄(|c|) || c
 */
// Helper function to read little-endian unsigned numbers
function readLE(programBlob: Uint8Array, offset: i32, bytes: i32): u32 {
  if (offset + bytes > programBlob.length) {
    return u32(0xFFFFFFFF) // Sentinel value for error
  }
  let value: u32 = 0
  for (let i: i32 = 0; i < bytes; i++) {
    value |= u32(programBlob[offset + i]) << u32(i * 8)
  }
  return value
}

export function decodeProgram(
  programBlob: Uint8Array,
): DecodedProgram | null {
  let offset: i32 = 0

  // 1. Decode E₃(|o|) - read-only data length (3 bytes, little-endian)
  const roDataLengthResult = readLE(programBlob, offset, 3)
  if (roDataLengthResult === u32(0xFFFFFFFF)) {
    return null
  }
  const roDataLength = roDataLengthResult
  offset += 3

  // 2. Decode E₃(|w|) - read-write data length (3 bytes, little-endian)
  const rwDataLengthResult = readLE(programBlob, offset, 3)
  if (rwDataLengthResult === u32(0xFFFFFFFF)) {
    return null
  }
  const rwDataLength = rwDataLengthResult
  offset += 3

  // 3. Decode E₂(z) - heap zero padding size (2 bytes, little-endian)
  const heapZeroPaddingSizeResult = readLE(programBlob, offset, 2)
  if (heapZeroPaddingSizeResult === u32(0xFFFFFFFF)) {
    return null
  }
  const heapZeroPaddingSize = heapZeroPaddingSizeResult
  offset += 2

  // 4. Decode E₃(s) - stack size (3 bytes, little-endian)
  const stackSizeResult = readLE(programBlob, offset, 3)
  if (stackSizeResult === u32(0xFFFFFFFF)) {
    return null
  }
  const stackSize = stackSizeResult
  offset += 3

  // 5. Extract read-only data section (o)
  if (offset + roDataLength > programBlob.length) {
    return null
  }
  const roData = programBlob.slice(offset, offset + roDataLength)
  offset += roDataLength

  // 6. Extract read-write data section (w)
  if (offset + rwDataLength > programBlob.length) {
    return null
  }
  const rwData = programBlob.slice(offset, offset + rwDataLength)
  offset += rwDataLength

  // 7. Decode E₄(|c|) - instruction data length (4 bytes, little-endian)
  const codeSizeResult = readLE(programBlob, offset, 4)
  if (codeSizeResult === u32(0xFFFFFFFF)) {
    return null
  }
  const codeSize = codeSizeResult
  offset += 4

  // 8. Extract instruction data (c)
  if (offset + codeSize > programBlob.length) {
    return null
  }
  const code = programBlob.slice(offset, offset + codeSize)
  offset += codeSize

  return new DecodedProgram(
    new Uint8Array(0), // metadata (not used in decodeProgram)
    roDataLength,
    rwDataLength,
    heapZeroPaddingSize,
    stackSize,
    roData,
    rwData,
    codeSize,
    code,
  )
}

/**
 * Decode service code from preimage blob as Y function format
 *
 * After extracting metadata, the code blob c should be in Y function format
 */
export function decodeProgramFromPreimage(
  preimageBlob: Uint8Array,
): DecodedProgram | null {
  // First, extract metadata
  const preimageResult = decodeServiceCodeFromPreimage(preimageBlob)
  if (!preimageResult) {
    return null
  }

  // Then decode the code blob as Y function format
  const programResult = decodeProgram(preimageResult.value.codeBlob)
  if (!programResult) {
    return null
  }

  // Combine metadata and program results
  return new DecodedProgram(
    preimageResult.value.metadata,
    programResult.roDataLength,
    programResult.rwDataLength,
    programResult.heapZeroPaddingSize,
    programResult.stackSize,
    programResult.roData,
    programResult.rwData,
    programResult.codeSize,
    programResult.code,
  )
}

/**
 * Service Account structure (AssemblyScript compatible)
 */
export class ServiceAccountData {
  codehash: Uint8Array // 32 bytes
  balance: u64
  minaccgas: u64
  minmemogas: u64
  octets: u64
  gratis: u64
  items: u32
  created: u32
  lastacc: u32
  parent: u32

  constructor(
    codehash: Uint8Array,
    balance: u64,
    minaccgas: u64,
    minmemogas: u64,
    octets: u64,
    gratis: u64,
    items: u32,
    created: u32,
    lastacc: u32,
    parent: u32
  ) {
    this.codehash = codehash
    this.balance = balance
    this.minaccgas = minaccgas
    this.minmemogas = minmemogas
    this.octets = octets
    this.gratis = gratis
    this.items = items
    this.created = created
    this.lastacc = lastacc
    this.parent = parent
  }
}

/**
 * Encode natural number (simplified for 0 only)
 * Full implementation would handle variable-length encoding
 */
function encodeNaturalZero(): Uint8Array {
  const result = new Uint8Array(1)
  result[0] = 0
  return result
}

/**
 * Concatenate multiple byte arrays
 */
function concatBytes(arrays: Uint8Array[]): Uint8Array {
  let totalLength = 0
  for (let i = 0; i < arrays.length; i++) {
    totalLength += arrays[i].length
  }

  const result = new Uint8Array(totalLength)
  let offset = 0
  for (let i = 0; i < arrays.length; i++) {
    const arr = arrays[i]
    for (let j = 0; j < arr.length; j++) {
      result[offset + j] = arr[j]
    }
    offset += arr.length
  }

  return result
}

/**
 * Encode service account according to Gray Paper specification
 * 
 * Gray Paper merklization.tex equation C(255, s):
 * ∀ ⟨s, sa⟩ ∈ accounts: C(255, s) ↦ encode{
 *   0,
 *   sa_codehash,
 *   encode[8]{sa_balance, sa_minaccgas, sa_minmemogas, sa_octets, sa_gratis},
 *   encode[4]{sa_items, sa_created, sa_lastacc, sa_parent}
 * }
 * 
 * @param account - Service account to encode
 * @param major - JAM version major (default: 0)
 * @param minor - JAM version minor (default: 7)
 * @param patch - JAM version patch (default: 2)
 * @returns Encoded octet sequence
 */
export function encodeServiceAccount(
  account: ServiceAccountData,
  major: i32 = 0,
  minor: i32 = 7,
  patch: i32 = 2,
): Uint8Array {
  const parts: Uint8Array[] = []

  // Gray Paper: 0 (placeholder discriminator)
  // Include discriminator for JAM version > 0.7.0 (v0.7.1+)
  // Fuzzer test vectors (v0.7.0) omit this discriminator byte
  const includeDiscriminator =
    major > 0 ||
    (major === 0 && minor > 7) ||
    (major === 0 && minor === 7 && patch > 0)

  if (includeDiscriminator) {
    parts.push(encodeNaturalZero())
  }

  // Gray Paper: sa_codehash (32-byte hash)
  parts.push(account.codehash)

  // Gray Paper: encode[8]{sa_balance, sa_minaccgas, sa_minmemogas, sa_octets, sa_gratis}
  // 5 × 8-byte fields = 40 bytes total
  const accountBytes = new Uint8Array(40)
  const view = new DataView(accountBytes.buffer)

  // Balance (8 bytes, little-endian)
  view.setUint64(0, account.balance, true)

  // MinAccGas (8 bytes, little-endian)
  view.setUint64(8, account.minaccgas, true)

  // MinMemoGas (8 bytes, little-endian)
  view.setUint64(16, account.minmemogas, true)

  // Octets (8 bytes, little-endian)
  view.setUint64(24, account.octets, true)

  // Gratis (8 bytes, little-endian)
  view.setUint64(32, account.gratis, true)

  parts.push(accountBytes)

  // Gray Paper: encode[4]{sa_items, sa_created, sa_lastacc, sa_parent}
  // 4 × 4-byte fields = 16 bytes total
  const metadataBytes = new Uint8Array(16)
  const metadataView = new DataView(metadataBytes.buffer)

  // Items (4 bytes, little-endian)
  metadataView.setUint32(0, account.items, true)

  // Created (4 bytes, little-endian)
  metadataView.setUint32(4, account.created, true)

  // LastAcc (4 bytes, little-endian)
  metadataView.setUint32(8, account.lastacc, true)

  // Parent (4 bytes, little-endian)
  metadataView.setUint32(12, account.parent, true)

  parts.push(metadataBytes)

  return concatBytes(parts)
}

/**
 * Decode service account according to Gray Paper specification
 * 
 * Gray Paper merklization.tex equation C(255, s):
 * Decodes the service account structure:
 * - 0 (discriminator, optional for JAM 0.7.0)
 * - sa_codehash (32 bytes)
 * - encode[8]{sa_balance, sa_minaccgas, sa_minmemogas, sa_octets, sa_gratis} (40 bytes)
 * - encode[4]{sa_items, sa_created, sa_lastacc, sa_parent} (16 bytes)
 * 
 * @param data - Octet sequence to decode
 * @param major - JAM version major (default: 0)
 * @param minor - JAM version minor (default: 7)
 * @param patch - JAM version patch (default: 2)
 * @returns Decoded ServiceAccountData and remaining data, or null on error
 */
export function decodeServiceAccount(
  data: Uint8Array,
  major: i32 = 0,
  minor: i32 = 7,
  patch: i32 = 2,
): DecodingResult<ServiceAccountData> | null {
  let currentData = data

  // Gray Paper: 0 (placeholder discriminator)
  // Include discriminator for JAM version > 0.7.0 (v0.7.1+)
  // Fuzzer test vectors (v0.7.0) omit this discriminator byte
  const expectDiscriminator =
    major > 0 ||
    (major === 0 && minor > 7) ||
    (major === 0 && minor === 7 && patch > 0)

  if (expectDiscriminator) {
    // For v0.7.1+, expect discriminator byte
    if (currentData.length > 0 && currentData[0] === 0x00) {
      const discriminatorResult = decodeNatural(currentData)
      if (!discriminatorResult) {
        return null
      }
      currentData = currentData.slice(discriminatorResult.consumed)
    } else {
      // Discriminator expected but missing - this is an error for v0.7.1+
      return null
    }
  } else {
    // For v0.7.0 and earlier, discriminator is optional (fuzzer test vectors omit it)
    // If first byte is 0x00, decode it as natural number. Otherwise, assume discriminator is missing.
    if (currentData.length > 0 && currentData[0] === 0x00) {
      const discriminatorResult = decodeNatural(currentData)
      if (!discriminatorResult) {
        return null
      }
      currentData = currentData.slice(discriminatorResult.consumed)
    }
    // If first byte is not 0x00, assume discriminator is missing and start with codehash
  }

  // Gray Paper: sa_codehash (32-byte hash)
  if (currentData.length < 32) {
    return null
  }
  const codehash = currentData.slice(0, 32)
  currentData = currentData.slice(32)

  // Gray Paper: decode[8]{sa_balance, sa_minaccgas, sa_minmemogas, sa_octets, sa_gratis}
  if (currentData.length < 40) {
    return null
  }
  const accountBytes = currentData.slice(0, 40)
  const accountView = new DataView(accountBytes.buffer)

  // Decode 8-byte fields (little-endian)
  const balance = accountView.getUint64(0, true)
  const minaccgas = accountView.getUint64(8, true)
  const minmemogas = accountView.getUint64(16, true)
  const octets = accountView.getUint64(24, true)
  const gratis = accountView.getUint64(32, true)

  currentData = currentData.slice(40)

  // Gray Paper: decode[4]{sa_items, sa_created, sa_lastacc, sa_parent}
  if (currentData.length < 16) {
    return null
  }
  const metadataBytes = currentData.slice(0, 16)
  const metadataView = new DataView(metadataBytes.buffer)

  // Decode 4-byte fields (little-endian)
  const items = metadataView.getUint32(0, true)
  const created = metadataView.getUint32(4, true)
  const lastacc = metadataView.getUint32(8, true)
  const parent = metadataView.getUint32(12, true)

  currentData = currentData.slice(16)

  const consumed = data.length - currentData.length

  const accountData = new ServiceAccountData(
    codehash,
    balance,
    minaccgas,
    minmemogas,
    octets,
    gratis,
    items,
    created,
    lastacc,
    parent,
  )

  return new DecodingResult<ServiceAccountData>(accountData, consumed)
}


// ============================================================================
// Fixed-Length Integer Encoding (Gray Paper compliant)
// ============================================================================

/**
 * Encode natural number using fixed-length little-endian encoding
 * 
 * Gray Paper: encode[l](x) - Fixed-length encoding in l bytes
 * Formula: ⟨x mod 256⟩ ∥ encode[l-1](⌊x/256⌋)
 * 
 * @param value - Natural number to encode
 * @param length - Fixed length in bytes (1, 2, 4, 8, etc.)
 * @returns Encoded bytes
 */
export function encodeFixedLength(value: u64, length: i32): Uint8Array {
  // Validate length to prevent issues with negative or zero lengths
  if (length <= 0) {
    return new Uint8Array(0)
  }
  
  const result = new Uint8Array(length)
  
  // Wrap value to fit in the encoding space (Gray Paper uses modulo operations)
  // This matches the mathematical definition: encode[l](x) uses x mod 256, x mod 2^8, etc.
  let wrappedValue: u64 = value
  
  // Calculate modulus: 2^(8*length)
  // For lengths >= 8, 2^(8*length) would overflow u64 (2^64 wraps to 0), causing division by zero
  // So we handle standard lengths explicitly and use loop for others, but cap at 63 bits
  if (length === 1) {
    wrappedValue = value % 256
  } else if (length === 2) {
    wrappedValue = value % 65536
  } else if (length === 4) {
    wrappedValue = value % 4294967296
  } else if (length === 8) {
    // For 8 bytes, u64 naturally wraps at 2^64, so value is already wrapped
    wrappedValue = value
  } else {
    // For other lengths, calculate modulus: 2^(8*length)
    // Prevent overflow: if length * 8 >= 64, modulus would overflow u64 to 0
    const bitsToShift = length * 8
    if (bitsToShift >= 64) {
      // For lengths >= 8, value is already wrapped by u64 type
      wrappedValue = value
    } else {
      // Calculate 2^(8*length) safely - modulus starts at 1, so it can never be 0
      let modulus: u64 = 1
      for (let i = 0; i < bitsToShift; i++) {
        modulus = modulus * 2
      }
      wrappedValue = value % modulus
    }
  }
  
  // Little-endian encoding
  for (let i = 0; i < length; i++) {
    result[i] = u8((wrappedValue >> (i * 8)) & 0xff)
  }
  
  return result
}

/**
 * Encode natural number (full implementation)
 * 
 * Gray Paper Equation 30-38: Variable-length encoding for natural numbers
 * - x = 0: Single byte [0x00]
 * - x >= 2^56: [0xFF] + 8 bytes little-endian
 * - Otherwise: prefix + variable bytes
 */
export function encodeNatural(value: u64): Uint8Array {
  // Case 1: x = 0
  if (value === 0) {
    const result = new Uint8Array(1)
    result[0] = 0
    return result
  }
  
  // Case 2: x >= 2^56 (large numbers)
  if (value >= (1 << 56)) {
    const result = new Uint8Array(9)
    result[0] = 0xff
    for (let i = 0; i < 8; i++) {
      result[1 + i] = u8((value >> (i * 8)) & 0xff)
    }
    return result
  }
  
  // Case 3: Small values (1-127) - direct encoding
  if (value >= 1 && value <= 127) {
    const result = new Uint8Array(1)
    result[0] = u8(value)
    return result
  }
  
  // Case 4: Variable-length encoding
  // Find length l where 2^(7l) ≤ x < 2^(7(l+1))
  let l = 1
  while (l <= 8 && value >= (1 << (7 * (l + 1)))) {
    l++
  }
  
  // Calculate prefix: 2^8 - 2^(8-l) + ⌊x/2^(8l)⌋
  const prefixBase = (1 << 8) - (1 << (8 - l))
  const highBits = value >> (8 * l)
  const prefix = prefixBase + i32(highBits)
  
  // Calculate suffix: x mod 2^(8l)
  const suffix = value & ((1 << (8 * l)) - 1)
  
  // Create result
  const result = new Uint8Array(1 + l)
  result[0] = u8(prefix)
  
  // Encode suffix in little-endian
  for (let i = 0; i < l; i++) {
    result[1 + i] = u8((suffix >> (i * 8)) & 0xff)
  }
  
  return result
}

// ============================================================================
// Work Package Encoding (Gray Paper compliant)
// ============================================================================

/**
 * RefineContext structure
 */
export class RefineContext {
  anchor: Uint8Array // 32-byte hash
  state_root: Uint8Array // 32-byte hash
  beefy_root: Uint8Array // 32-byte hash
  lookup_anchor: Uint8Array // 32-byte hash
  lookup_anchor_slot: u64 // 4-byte timeslot
  prerequisites: Uint8Array[] // Array of 32-byte hashes
  
  constructor() {
    this.anchor = new Uint8Array(32)
    this.state_root = new Uint8Array(32)
    this.beefy_root = new Uint8Array(32)
    this.lookup_anchor = new Uint8Array(32)
    this.lookup_anchor_slot = 0
    this.prerequisites = []
  }
}

/**
 * Import segment structure
 */
export class ImportSegment {
  treeRoot: Uint8Array // 32-byte hash
  index: u32 // Segment index (0-32767)
  isRefined: bool // Whether this is a refined hash
  
  constructor() {
    this.treeRoot = new Uint8Array(32)
    this.index = 0
    this.isRefined = false
  }
}

/**
 * Extrinsic reference structure
 */
export class ExtrinsicReference {
  hash: Uint8Array // 32-byte hash
  length: u32 // 4-byte length
  
  constructor() {
    this.hash = new Uint8Array(32)
    this.length = 0
  }
}

/**
 * Work item structure
 */
export class WorkItem {
  serviceindex: u32
  codehash: Uint8Array // 32-byte hash
  refgaslimit: u64
  accgaslimit: u64
  exportcount: u16
  payload: Uint8Array
  importsegments: ImportSegment[]
  extrinsics: ExtrinsicReference[]
  
  constructor() {
    this.serviceindex = 0
    this.codehash = new Uint8Array(32)
    this.refgaslimit = 0
    this.accgaslimit = 0
    this.exportcount = 0
    this.payload = new Uint8Array(0)
    this.importsegments = []
    this.extrinsics = []
  }
}

/**
 * Work package structure
 */
export class WorkPackage {
  authCodeHost: u32
  authCodeHash: Uint8Array // 32-byte hash
  context: RefineContext
  authToken: Uint8Array
  authConfig: Uint8Array
  workItems: WorkItem[]
  
  constructor() {
    this.authCodeHost = 0
    this.authCodeHash = new Uint8Array(32)
    this.context = new RefineContext()
    this.authToken = new Uint8Array(0)
    this.authConfig = new Uint8Array(0)
    this.workItems = []
  }
}

/**
 * Encode refine context according to Gray Paper specification
 * 
 * Gray Paper Equation 199-206: encode{WC ∈ workcontext}
 * Fields:
 * 1. WC_anchorhash (32 bytes)
 * 2. WC_anchorpoststate (32 bytes)
 * 3. WC_anchoraccoutlog (32 bytes)
 * 4. WC_lookupanchorhash (32 bytes)
 * 5. encode[4]{WC_lookupanchortime} (4 bytes)
 * 6. var{WC_prerequisites} (variable-length sequence)
 */
export function encodeRefineContext(context: RefineContext): Uint8Array {
  const parts: Uint8Array[] = []
  
  // 1. Anchor hash (32 bytes)
  parts.push(context.anchor)
  
  // 2. State root (32 bytes)
  parts.push(context.state_root)
  
  // 3. Beefy root (32 bytes)
  parts.push(context.beefy_root)
  
  // 4. Lookup anchor (32 bytes)
  parts.push(context.lookup_anchor)
  
  // 5. Lookup anchor slot - encode[4] (4 bytes, little-endian)
  parts.push(encodeFixedLength(context.lookup_anchor_slot, 4))
  
  // 6. Prerequisites - var{} encoding (length prefix + hashes)
  parts.push(encodeNatural(u64(context.prerequisites.length)))
  
  // Encode each prerequisite as 32-byte hash
  for (let i = 0; i < context.prerequisites.length; i++) {
    parts.push(context.prerequisites[i])
  }
  
  return concatBytes(parts)
}

/**
 * Encode import reference according to Gray Paper specification
 * 
 * Gray Paper Equation 305-311: encodeImportRef
 * Structure:
 * - h: 32-byte hash
 * - encode[2]{index}: 2-byte index with type encoding:
 *   - Regular hash: i (0-32767)
 *   - Refined hash: i + 2^15 (32768-65535)
 */
export function encodeImportReference(importRef: ImportSegment): Uint8Array {
  const parts: Uint8Array[] = []
  
  // h: 32-byte hash
  parts.push(importRef.treeRoot)
  
  // encode[2]{index}: 2-byte index with type encoding
  let encodedIndex = importRef.index
  if (importRef.isRefined) {
    encodedIndex = importRef.index + 32768 // Add 2^15 for refined
  }
  
  // Encode as 2-byte little-endian
  parts.push(encodeFixedLength(u64(encodedIndex), 2))
  
  return concatBytes(parts)
}

/**
 * Encode extrinsic reference according to Gray Paper specification
 * 
 * Gray Paper formula: (h, encode[4]{length})
 * Structure:
 * - h: 32-byte hash
 * - encode[4]{length}: 4-byte fixed-length length
 */
export function encodeExtrinsicReference(extrinsicRef: ExtrinsicReference): Uint8Array {
  const parts: Uint8Array[] = []
  
  // h: 32-byte hash
  parts.push(extrinsicRef.hash)
  
  // encode[4]{length}: 4-byte fixed-length length
  parts.push(encodeFixedLength(u64(extrinsicRef.length), 4))
  
  return concatBytes(parts)
}

/**
 * Encode variable sequence (generic implementation)
 * 
 * Generic variable-length sequence encoding with length prefix.
 * This is used for arrays/sequences in the Gray Paper.
 * 
 * Format: encode(len) || item1 || item2 || .
 * 
 * @param sequence - Array of items to encode
 * @returns Encoded sequence with length prefix
 */
export function encodeVariableSequence(sequence: Uint8Array[]): Uint8Array {
  const parts: Uint8Array[] = []
  
  // Encode length prefix
  parts.push(encodeNatural(u64(sequence.length)))
  
  // Encode each item
  for (let i = 0; i < sequence.length; i++) {
    parts.push(sequence[i])
  }
  
  return concatBytes(parts)
}

/**
 * Encode work item according to Gray Paper specification
 * 
 * Gray Paper Equation 242-264: encode{WI ∈ workitem}
 * Fields:
 * 1. encode[4]{WI_serviceindex} - 4-byte service ID
 * 2. WI_codehash - 32-byte hash
 * 3. encode[8]{WI_refgaslimit} - 8-byte gas limit
 * 4. encode[8]{WI_accgaslimit} - 8-byte gas limit
 * 5. encode[2]{WI_exportcount} - 2-byte export count
 * 6. var{WI_payload} - variable-length payload
 * 7. var{WI_importsegments} - variable-length import segments
 * 8. var{WI_extrinsics} - variable-length extrinsic references
 */
export function encodeWorkItem(workItem: WorkItem): Uint8Array {
  const parts: Uint8Array[] = []
  
  // 1. encode[4]{serviceindex} - 4-byte service ID
  parts.push(encodeFixedLength(u64(workItem.serviceindex), 4))
  
  // 2. codehash - 32-byte hash
  parts.push(workItem.codehash)
  
  // 3. encode[8]{refgaslimit} - 8-byte gas limit
  parts.push(encodeFixedLength(workItem.refgaslimit, 8))
  
  // 4. encode[8]{accgaslimit} - 8-byte gas limit
  parts.push(encodeFixedLength(workItem.accgaslimit, 8))
  
  // 5. encode[2]{exportcount} - 2-byte export count
  parts.push(encodeFixedLength(u64(workItem.exportcount), 2))
  
  // 6. var{payload} - variable-length payload (length prefix + data)
  parts.push(encodeNatural(u64(workItem.payload.length)))
  parts.push(workItem.payload)
  
  // 7. var{importsegments} - variable-length import segments
  parts.push(encodeNatural(u64(workItem.importsegments.length)))
  for (let i = 0; i < workItem.importsegments.length; i++) {
    parts.push(encodeImportReference(workItem.importsegments[i]))
  }
  
  // 8. var{extrinsics} - variable-length extrinsic references
  parts.push(encodeNatural(u64(workItem.extrinsics.length)))
  for (let i = 0; i < workItem.extrinsics.length; i++) {
    parts.push(encodeExtrinsicReference(workItem.extrinsics[i]))
  }
  
  return concatBytes(parts)
}

/**
 * Encode work item summary according to Gray Paper S(w) function
 * 
 * Gray Paper pvm_invocations.tex line 357: S(w)
 * Fields:
 * 1. encode[4]{serviceindex} - 4-byte service ID
 * 2. codehash - 32-byte hash
 * 3. encode[8]{refgaslimit} - 8-byte gas limit
 * 4. encode[8]{accgaslimit} - 8-byte gas limit
 * 5. encode[2]{exportcount} - 2-byte export count
 * 6. encode[2]{len(importsegments)} - 2-byte import count
 * 7. encode[2]{len(extrinsics)} - 2-byte extrinsic count
 * 8. encode[4]{len(payload)} - 4-byte payload length
 * 
 * Total size: 4 + 32 + 8 + 8 + 2 + 2 + 2 + 4 = 62 bytes
 */
export function encodeWorkItemSummary(workItem: WorkItem): Uint8Array {
  const parts: Uint8Array[] = []
  
  // 1. encode[4]{serviceindex} - 4-byte service ID
  parts.push(encodeFixedLength(u64(workItem.serviceindex), 4))
  
  // 2. codehash - 32-byte hash
  parts.push(workItem.codehash)
  
  // 3. encode[8]{refgaslimit} - 8-byte gas limit
  parts.push(encodeFixedLength(workItem.refgaslimit, 8))
  
  // 4. encode[8]{accgaslimit} - 8-byte gas limit
  parts.push(encodeFixedLength(workItem.accgaslimit, 8))
  
  // 5. encode[2]{exportcount} - 2-byte export count
  parts.push(encodeFixedLength(u64(workItem.exportcount), 2))
  
  // 6. encode[2]{len(importsegments)} - 2-byte import count
  parts.push(encodeFixedLength(u64(workItem.importsegments.length), 2))
  
  // 7. encode[2]{len(extrinsics)} - 2-byte extrinsic count
  parts.push(encodeFixedLength(u64(workItem.extrinsics.length), 2))
  
  // 8. encode[4]{len(payload)} - 4-byte payload length
  parts.push(encodeFixedLength(u64(workItem.payload.length), 4))
  
  return concatBytes(parts)
}

/**
 * Decode import reference according to Gray Paper specification
 * 
 * Gray Paper Equation 305-311: encodeImportRef
 * Structure:
 * - h: 32-byte hash
 * - encode[2]{index}: 2-byte index with type encoding:
 *   - Regular hash: i (0-32767)
 *   - Refined hash: i + 2^15 (32768-65535)
 */
export function decodeImportReference(data: Uint8Array): DecodingResult<ImportSegment> | null {
  if (data.length < 34) {
    return null
  }
  
  // h: 32-byte hash
  const treeRoot = data.slice(0, 32)
  
  // encode[2]{index}: 2-byte index with type encoding
  const indexResult = decodeFixedLength(data.slice(32), 2)
  if (!indexResult) {
    return null
  }
  const encodedIndex = u32(indexResult.value)
  const isRefined = encodedIndex >= 32768
  const index = isRefined ? encodedIndex - 32768 : encodedIndex
  
  const importSegment = new ImportSegment()
  importSegment.treeRoot = treeRoot
  importSegment.index = index
  importSegment.isRefined = isRefined
  
  return new DecodingResult<ImportSegment>(importSegment, 34)
}

/**
 * Decode extrinsic reference according to Gray Paper specification
 * 
 * Gray Paper formula: (h, encode[4]{length})
 * Structure:
 * - h: 32-byte hash
 * - encode[4]{length}: 4-byte fixed-length length
 */
export function decodeExtrinsicReference(data: Uint8Array): DecodingResult<ExtrinsicReference> | null {
  if (data.length < 36) {
    return null
  }
  
  // h: 32-byte hash
  const hash = data.slice(0, 32)
  
  // encode[4]{length}: 4-byte fixed-length length
  const lengthResult = decodeFixedLength(data.slice(32), 4)
  if (!lengthResult) {
    return null
  }
  const length = u32(lengthResult.value)
  
  const extrinsicRef = new ExtrinsicReference()
  extrinsicRef.hash = hash
  extrinsicRef.length = length
  
  return new DecodingResult<ExtrinsicReference>(extrinsicRef, 36)
}

/**
 * Decode work item according to Gray Paper specification
 * 
 * Gray Paper Equation 242-264: encode{WI ∈ workitem}
 * Fields:
 * 1. encode[4]{WI_serviceindex} - 4-byte service ID
 * 2. WI_codehash - 32-byte hash
 * 3. encode[8]{WI_refgaslimit} - 8-byte gas limit
 * 4. encode[8]{WI_accgaslimit} - 8-byte gas limit
 * 5. encode[2]{WI_exportcount} - 2-byte export count
 * 6. var{WI_payload} - variable-length payload
 * 7. var{WI_importsegments} - variable-length import segments
 * 8. var{WI_extrinsics} - variable-length extrinsic references
 */
export function decodeWorkItem(data: Uint8Array): DecodingResult<WorkItem> | null {
  let currentData = data
  
  // 1. decode[4]{serviceindex} - 4-byte service ID
  const serviceIndexResult = decodeFixedLength(currentData, 4)
  if (!serviceIndexResult) {
    return null
  }
  const serviceIndex = u32(serviceIndexResult.value)
  currentData = currentData.slice(serviceIndexResult.consumed)
  
  // 2. codehash - 32-byte hash
  if (currentData.length < 32) {
    return null
  }
  const codehash = currentData.slice(0, 32)
  currentData = currentData.slice(32)
  
  // 3. decode[8]{refgaslimit} - 8-byte gas limit
  const refGasLimitResult = decodeFixedLength(currentData, 8)
  if (!refGasLimitResult) {
    return null
  }
  const refgaslimit = refGasLimitResult.value
  currentData = currentData.slice(refGasLimitResult.consumed)
  
  // 4. decode[8]{accgaslimit} - 8-byte gas limit
  const accGasLimitResult = decodeFixedLength(currentData, 8)
  if (!accGasLimitResult) {
    return null
  }
  const accgaslimit = accGasLimitResult.value
  currentData = currentData.slice(accGasLimitResult.consumed)
  
  // 5. decode[2]{exportcount} - 2-byte export count
  const exportCountResult = decodeFixedLength(currentData, 2)
  if (!exportCountResult) {
    return null
  }
  const exportcount = u16(exportCountResult.value)
  currentData = currentData.slice(exportCountResult.consumed)
  
  // 6. var{payload} - variable-length payload (length prefix + data)
  const payloadLengthResult = decodeNatural(currentData)
  if (!payloadLengthResult) {
    return null
  }
  const payloadLength = i32(payloadLengthResult.value)
  currentData = currentData.slice(payloadLengthResult.consumed)
  if (currentData.length < payloadLength) {
    return null
  }
  const payload = currentData.slice(0, payloadLength)
  currentData = currentData.slice(payloadLength)
  
  // 7. var{importsegments} - variable-length import segments
  const importSegmentsLengthResult = decodeNatural(currentData)
  if (!importSegmentsLengthResult) {
    return null
  }
  const importSegmentsLength = i32(importSegmentsLengthResult.value)
  currentData = currentData.slice(importSegmentsLengthResult.consumed)
  const importsegments = new Array<ImportSegment>()
  for (let i = 0; i < importSegmentsLength; i++) {
    const importSegmentResult = decodeImportReference(currentData)
    if (!importSegmentResult) {
      return null
    }
    importsegments.push(importSegmentResult.value)
    currentData = currentData.slice(importSegmentResult.consumed)
  }
  
  // 8. var{extrinsics} - variable-length extrinsic references
  const extrinsicsLengthResult = decodeNatural(currentData)
  if (!extrinsicsLengthResult) {
    return null
  }
  const extrinsicsLength = i32(extrinsicsLengthResult.value)
  currentData = currentData.slice(extrinsicsLengthResult.consumed)
  const extrinsics = new Array<ExtrinsicReference>()
  for (let i = 0; i < extrinsicsLength; i++) {
    const extrinsicResult = decodeExtrinsicReference(currentData)
    if (!extrinsicResult) {
      return null
    }
    extrinsics.push(extrinsicResult.value)
    currentData = currentData.slice(extrinsicResult.consumed)
  }
  
  const workItem = new WorkItem()
  workItem.serviceindex = serviceIndex
  workItem.codehash = codehash
  workItem.refgaslimit = refgaslimit
  workItem.accgaslimit = accgaslimit
  workItem.exportcount = exportcount
  workItem.payload = payload
  workItem.importsegments = importsegments
  workItem.extrinsics = extrinsics
  
  const consumed = data.length - currentData.length
  return new DecodingResult<WorkItem>(workItem, consumed)
}

/**
 * Encode work package according to Gray Paper specification
 * 
 * Gray Paper Equation 242-264: encode{WP ∈ workpackage}
 * Fields:
 * 1. encode[4]{WP_authcodehost} - 4-byte service ID
 * 2. WP_authcodehash - 32-byte hash
 * 3. WP_context - work context structure
 * 4. var{WP_authtoken} - variable-length auth token
 * 5. var{WP_authconfig} - variable-length auth config
 * 6. var{WP_workitems} - variable-length work items
 */
export function encodeWorkPackage(workPackage: WorkPackage): Uint8Array {
  const parts: Uint8Array[] = []
  
  // 1. encode[4]{authcodehost} - 4-byte service ID
  parts.push(encodeFixedLength(u64(workPackage.authCodeHost), 4))
  
  // 2. authcodehash - 32-byte hash
  parts.push(workPackage.authCodeHash)
  
  // 3. context - work context structure
  parts.push(encodeRefineContext(workPackage.context))
  
  // 4. var{authtoken} - variable-length auth token
  parts.push(encodeNatural(u64(workPackage.authToken.length)))
  parts.push(workPackage.authToken)
  
  // 5. var{authconfig} - variable-length auth config
  parts.push(encodeNatural(u64(workPackage.authConfig.length)))
  parts.push(workPackage.authConfig)
  
  // 6. var{workitems} - variable-length work items
  parts.push(encodeNatural(u64(workPackage.workItems.length)))
  for (let i = 0; i < workPackage.workItems.length; i++) {
    parts.push(encodeWorkItem(workPackage.workItems[i]))
  }
  
  return concatBytes(parts)
}

// ============================================================================
// Fixed-Length Integer Decoding (Gray Paper compliant)
// ============================================================================

/**
 * Decode natural number from fixed-length little-endian encoding
 * 
 * Gray Paper: decode[l](data) - Fixed-length decoding in l bytes
 * Formula: Little-endian decoding
 * 
 * @param data - Octet sequence to decode
 * @param length - Fixed length in bytes (1, 2, 4, 8, etc.)
 * @returns Decoded value and remaining data
 */
/**
 * Decode accumulate arguments according to Gray Paper specification
 *
 * Gray Paper pvm_invocations.tex equation 163: encode{t, s, len(i)}
 * All values use variable-length natural number encoding (decodeNatural):
 * - t (timeslot): decodeNatural (variable)
 * - s (serviceId): decodeNatural (variable)
 * - len(i) (input length): decodeNatural (variable)
 *
 * Note: This differs from fixed-length encodings used elsewhere (e.g. encode[4] in headers).
 * The general encode{} notation uses variable-length encoding.
 *
 * @param args - Encoded accumulate arguments
 * @returns Decoding result with timeslot, serviceId, and inputLength, or null if decoding fails
 */
export function decodeAccumulateArgs(
  args: Uint8Array,
): DecodingResult<DecodedAccumulateArgs> | null {
  if (args.length < 1) {
    return null
  }

  let offset: i32 = 0

  // 1. Decode timeslot - Gray Paper: encode{t} (variable-length natural number)
  const timeslotResult = decodeNatural(args.slice(offset))
  if (!timeslotResult) {
    return null
  }
  const timeslot = timeslotResult.value
  offset += timeslotResult.consumed

  // 2. Decode service ID - Gray Paper: encode{s} (variable-length natural number)
  if (offset >= args.length) {
    return null
  }
  const serviceIdResult = decodeNatural(args.slice(offset))
  if (!serviceIdResult) {
    return null
  }
  const serviceId = serviceIdResult.value
  offset += serviceIdResult.consumed

  // 3. Decode input length - Gray Paper: encode{len(i)} (variable-length natural number)
  if (offset >= args.length) {
    return null
  }
  const inputLengthResult = decodeNatural(args.slice(offset))
  if (!inputLengthResult) {
    return null
  }
  const inputLength = inputLengthResult.value
  offset += inputLengthResult.consumed

  return new DecodingResult(
    new DecodedAccumulateArgs(timeslot, serviceId, inputLength),
    offset,
  )
}

export function decodeFixedLength(data: Uint8Array, length: i32): DecodingResult<u64> | null {
  if (data.length < length) {
    return null
  }
  
  let value: u64 = u64(0)
  
  // Little-endian decoding
  for (let i = 0; i < length; i++) {
    value |= u64(data[i]) << u64(i * 8)
  }
  
  return new DecodingResult<u64>(value, length)
}

// ============================================================================
// Variable-Length Decoding (Gray Paper compliant)
// ============================================================================

/**
 * Decode variable-length term with length discriminator
 * 
 * Gray Paper: var{x} = ⟨len(x), x⟩
 * Format: encode(len) || data
 * 
 * @param data - Octet sequence to decode
 * @returns Decoded data and remaining octet sequence
 */
export function decodeVariableLength(data: Uint8Array): DecodingResult<Uint8Array> | null {
  const lengthResult = decodeNatural(data)
  if (!lengthResult) {
    return null
  }
  
  const length = i32(lengthResult.value)
  const offset = lengthResult.consumed
  
  if (data.length < offset + length) {
    return null
  }
  
  const value = data.slice(offset, offset + length)
  const remaining = data.slice(offset + length)
  
  return new DecodingResult<Uint8Array>(value, offset + length)
}

// ============================================================================
// Dictionary Decoding (Gray Paper compliant)
// ============================================================================

/**
 * Dictionary entry structure
 */
export class DictionaryEntry {
  key: Uint8Array
  value: Uint8Array
  
  constructor(key: Uint8Array, value: Uint8Array) {
    this.key = key
    this.value = value
  }
}

// ============================================================================
// Variable Sequence Decoding (Gray Paper compliant)
// ============================================================================

/**
 * Decode variable-length sequence with custom element decoder
 * 
 * Gray Paper: var{sequence} = encode(len) || encode(element0) || encode(element1) || ...
 * 
 * @param data - Octet sequence to decode
 * @param elementDecoder - Function to decode individual elements
 * @returns Decoded sequence and remaining data
 */
export function decodeVariableSequence<T>(
  data: Uint8Array,
  elementDecoder: (data: Uint8Array) => DecodingResult<T> | null,
): DecodingResult<T[]> | null {
  // Decode length prefix
  const lengthResult = decodeNatural(data)
  if (!lengthResult) {
    return null
  }
  
  const length = i32(lengthResult.value)
  let currentData = data.slice(lengthResult.consumed)
  
  const result = new Array<T>()
  
  // Decode each element
  for (let i = 0; i < length; i++) {
    const elementResult = elementDecoder(currentData)
    if (!elementResult) {
      return null
    }
    result.push(elementResult.value)
    currentData = currentData.slice(elementResult.consumed)
  }
  
  const consumed = data.length - currentData.length
  return new DecodingResult<T[]>(result, consumed)
}

// ============================================================================
// Service Account Structures (AssemblyScript)
// ============================================================================

/**
 * RawCshKeyvals entry structure
 * Matches TypeScript's Record<Hex, Hex> - a flat key-value dictionary
 * where keys are state keys and values are state values
 */
export class CshEntry {
  key: Uint8Array   // State key (variable length)
  value: Uint8Array // State value (variable length)
  
  constructor(key: Uint8Array, value: Uint8Array) {
    this.key = key
    this.value = value
  }
}

/**
 * RawCshKeyvals - Flat key-value store for service account data
 * Matches TypeScript's rawCshKeyvals: Record<Hex, Hex>
 * 
 * This flattened structure contains all storage, preimages, and requests
 * in a single dictionary, matching the TypeScript implementation.
 */
export class RawCshKeyvals {
  entries: Array<CshEntry>
  
  constructor() {
    this.entries = new Array<CshEntry>()
  }
  
  set(key: Uint8Array, value: Uint8Array): void {
    // Find existing entry
    for (let i = 0; i < this.entries.length; i++) {
      if (this.compareKeys(this.entries[i].key, key)) {
        this.entries[i].value = value
        return
      }
    }
    // Add new entry
    this.entries.push(new CshEntry(key, value))
  }
  
  get(key: Uint8Array): Uint8Array | null {
    for (let i = 0; i < this.entries.length; i++) {
      if (this.compareKeys(this.entries[i].key, key)) {
        return this.entries[i].value
      }
    }
    return null
  }
  
  has(key: Uint8Array): bool {
    return this.get(key) !== null
  }
  
  delete(key: Uint8Array): bool {
    for (let i = 0; i < this.entries.length; i++) {
      if (this.compareKeys(this.entries[i].key, key)) {
        this.entries.splice(i, 1)
        return true
      }
    }
    return false
  }
  
  keys(): Array<Uint8Array> {
    const result = new Array<Uint8Array>()
    for (let i = 0; i < this.entries.length; i++) {
      result.push(this.entries[i].key)
    }
    return result
  }
  
  private compareKeys(a: Uint8Array, b: Uint8Array): bool {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }
}

// ============================================================================
// RawCshKeyvals Helper Functions
// These functions help access storage/preimages/requests from the flattened
// rawCshKeyvals dictionary, matching the TypeScript helper functions.
// ============================================================================

/**
 * Create a C(s, h) state key from serviceId and blake hash
 * 
 * Gray Paper format: C(s, h) = ⟨n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆⟩
 * where n = encode[4](serviceId), a = blake(h)[0:27]
 * 
 * This creates a 31-byte interleaved key.
 */
function createCshKey(serviceId: u32, combinedData: Uint8Array): Uint8Array {
  // Compute Blake2b-256 hash of the combined data
  const blakeHashFull = blake2b256(combinedData)
  
  // Take first 27 bytes of Blake hash
  const blakeHash = blakeHashFull.slice(0, 27)
  
  // Encode serviceId as 4 bytes little-endian
  const serviceBytes = new Uint8Array(4)
  serviceBytes[0] = u8(serviceId & 0xFF)
  serviceBytes[1] = u8((serviceId >> 8) & 0xFF)
  serviceBytes[2] = u8((serviceId >> 16) & 0xFF)
  serviceBytes[3] = u8((serviceId >> 24) & 0xFF)
  
  // Create 31-byte interleaved key
  const key = new Uint8Array(31)
  
  // Interleave: n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆
  key[0] = serviceBytes[0]  // n₀
  key[1] = blakeHash[0]     // a₀
  key[2] = serviceBytes[1]  // n₁
  key[3] = blakeHash[1]     // a₁
  key[4] = serviceBytes[2]  // n₂
  key[5] = blakeHash[2]     // a₂
  key[6] = serviceBytes[3]  // n₃
  key[7] = blakeHash[3]     // a₃
  
  // Remaining 23 bytes: a₄, a₅, ..., a₂₆
  for (let i = 4; i < 27; i++) {
    key[8 + (i - 4)] = blakeHash[i]
  }
  
  return key
}

/**
 * Create a storage key from service ID and storage key blob
 * Gray Paper: C(s, encode[4]{2^32-1} || k)
 * 
 * Special handling: If storageKey is already 27 bytes (Blake hash from state loading),
 * skip hashing and directly interleave with serviceId.
 */
export function createStorageKey(serviceId: u32, storageKey: Uint8Array): Uint8Array {
  // Check if storageKey is already a 27-byte Blake hash (from state loading)
  // When loading from state, we store h (27-byte Blake hash) directly
  // When creating new storage (from PVM), we have k (original storage key)
  if (storageKey.length === 27) {
    // Storage key is already a Blake hash - use it directly to construct state key
    // C(s, h) where h is already blake(encode[4]{0xFFFFFFFF} || k)
    // We just need to interleave serviceId with the 27-byte hash
    const key = new Uint8Array(31)
    
    // Encode serviceId as 4 bytes little-endian
    const serviceBytes = new Uint8Array(4)
    serviceBytes[0] = u8(serviceId & 0xFF)
    serviceBytes[1] = u8((serviceId >> 8) & 0xFF)
    serviceBytes[2] = u8((serviceId >> 16) & 0xFF)
    serviceBytes[3] = u8((serviceId >> 24) & 0xFF)
    
    // Interleave: n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆
    key[0] = serviceBytes[0]    // n₀
    key[1] = storageKey[0]      // a₀
    key[2] = serviceBytes[1]    // n₁
    key[3] = storageKey[1]      // a₁
    key[4] = serviceBytes[2]    // n₂
    key[5] = storageKey[2]      // a₂
    key[6] = serviceBytes[3]    // n₃
    key[7] = storageKey[3]      // a₃
    
    // Remaining 23 bytes: a₄, a₅, ..., a₂₆
    for (let i = 4; i < 27; i++) {
      key[8 + (i - 4)] = storageKey[i]
    }
    
    return key
  }
  
  // Storage key is the original key `k` - compute blake(encode[4]{0xFFFFFFFF} || k)
  // Prefix: encode[4]{2^32-1} = 0xFFFFFFFF (little-endian)
  const prefix = new Uint8Array(4)
  prefix[0] = 0xFF
  prefix[1] = 0xFF
  prefix[2] = 0xFF
  prefix[3] = 0xFF
  // Concatenate prefix + storage key
  const combinedData = concatBytes([prefix, storageKey])
  // Create proper C(s, h) key
  return createCshKey(serviceId, combinedData)
}

/**
 * Create a preimage key from service ID and preimage hash
 * Gray Paper: C(s, encode[4]{2^32-2} || h)
 * 
 * Special handling: If preimageHash is already 27 bytes (Blake hash from state loading),
 * skip hashing and directly interleave with serviceId.
 */
export function createPreimageKey(serviceId: u32, preimageHash: Uint8Array): Uint8Array {
  // Check if preimageHash is already a 27-byte Blake hash (from state loading)
  if (preimageHash.length === 27) {
    // Preimage hash is already a Blake hash - use it directly to construct state key
    const key = new Uint8Array(31)
    
    // Encode serviceId as 4 bytes little-endian
    const serviceBytes = new Uint8Array(4)
    serviceBytes[0] = u8(serviceId & 0xFF)
    serviceBytes[1] = u8((serviceId >> 8) & 0xFF)
    serviceBytes[2] = u8((serviceId >> 16) & 0xFF)
    serviceBytes[3] = u8((serviceId >> 24) & 0xFF)
    
    // Interleave: n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆
    key[0] = serviceBytes[0]      // n₀
    key[1] = preimageHash[0]      // a₀
    key[2] = serviceBytes[1]      // n₁
    key[3] = preimageHash[1]      // a₁
    key[4] = serviceBytes[2]      // n₂
    key[5] = preimageHash[2]      // a₂
    key[6] = serviceBytes[3]      // n₃
    key[7] = preimageHash[3]      // a₃
    
    // Remaining 23 bytes: a₄, a₅, ..., a₂₆
    for (let i = 4; i < 27; i++) {
      key[8 + (i - 4)] = preimageHash[i]
    }
    
    return key
  }
  
  // Preimage hash is the full 32-byte hash - compute blake(encode[4]{0xFFFFFFFE} || h)
  // Prefix: encode[4]{2^32-2} = 0xFEFFFFFF (little-endian)
  const prefix = new Uint8Array(4)
  prefix[0] = 0xFE
  prefix[1] = 0xFF
  prefix[2] = 0xFF
  prefix[3] = 0xFF
  // Concatenate prefix + preimage hash
  const combinedData = concatBytes([prefix, preimageHash])
  // Create proper C(s, h) key
  return createCshKey(serviceId, combinedData)
}

/**
 * Create a request key from service ID, request hash, and length
 * Gray Paper: C(s, encode[4]{l} || h)
 * 
 * Special handling: If requestHash is already 27 bytes (Blake hash from state loading),
 * skip hashing and directly interleave with serviceId.
 */
export function createRequestKey(serviceId: u32, requestHash: Uint8Array, length: u64): Uint8Array {
  // Check if requestHash is already a 27-byte Blake hash (from state loading)
  if (requestHash.length === 27) {
    // Request hash is already a Blake hash - use it directly to construct state key
    const key = new Uint8Array(31)
    
    // Encode serviceId as 4 bytes little-endian
    const serviceBytes = new Uint8Array(4)
    serviceBytes[0] = u8(serviceId & 0xFF)
    serviceBytes[1] = u8((serviceId >> 8) & 0xFF)
    serviceBytes[2] = u8((serviceId >> 16) & 0xFF)
    serviceBytes[3] = u8((serviceId >> 24) & 0xFF)
    
    // Interleave: n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆
    key[0] = serviceBytes[0]      // n₀
    key[1] = requestHash[0]       // a₀
    key[2] = serviceBytes[1]      // n₁
    key[3] = requestHash[1]       // a₁
    key[4] = serviceBytes[2]      // n₂
    key[5] = requestHash[2]       // a₂
    key[6] = serviceBytes[3]      // n₃
    key[7] = requestHash[3]       // a₃
    
    // Remaining 23 bytes: a₄, a₅, ..., a₂₆
    for (let i = 4; i < 27; i++) {
      key[8 + (i - 4)] = requestHash[i]
    }
    
    return key
  }
  
  // Request hash is the full 32-byte hash - compute blake(encode[4]{l} || h)
  // Prefix: encode[4]{length} (little-endian)
  const prefix = encodeFixedLength(length, 4)
  // Concatenate prefix + request hash
  const combinedData = concatBytes([prefix, requestHash])
  // Create proper C(s, h) key
  return createCshKey(serviceId, combinedData)
}

/**
 * Get storage value from rawCshKeyvals
 */
export function getStorageValue(account: CompleteServiceAccount, serviceId: u32, storageKey: Uint8Array): Uint8Array | null {
  const key = createStorageKey(serviceId, storageKey)
  return account.rawCshKeyvals.get(key)
}

/**
 * Set storage value in rawCshKeyvals
 */
export function setStorageValue(account: CompleteServiceAccount, serviceId: u32, storageKey: Uint8Array, value: Uint8Array): void {
  const key = createStorageKey(serviceId, storageKey)
  account.rawCshKeyvals.set(key, value)
}

/**
 * Delete storage value from rawCshKeyvals
 */
export function deleteStorageValue(account: CompleteServiceAccount, serviceId: u32, storageKey: Uint8Array): bool {
  const key = createStorageKey(serviceId, storageKey)
  return account.rawCshKeyvals.delete(key)
}

/**
 * Get preimage value from rawCshKeyvals
 */
export function getPreimageValue(account: CompleteServiceAccount, serviceId: u32, preimageHash: Uint8Array): Uint8Array | null {
  const key = createPreimageKey(serviceId, preimageHash)
  return account.rawCshKeyvals.get(key)
}

/**
 * Set preimage value in rawCshKeyvals
 */
export function setPreimageValue(account: CompleteServiceAccount, serviceId: u32, preimageHash: Uint8Array, blob: Uint8Array): void {
  const key = createPreimageKey(serviceId, preimageHash)
  account.rawCshKeyvals.set(key, blob)
}

/**
 * Delete preimage value from rawCshKeyvals
 */
export function deletePreimageValue(account: CompleteServiceAccount, serviceId: u32, preimageHash: Uint8Array): bool {
  const key = createPreimageKey(serviceId, preimageHash)
  return account.rawCshKeyvals.delete(key)
}

/**
 * Get request value from rawCshKeyvals
 * Returns the raw encoded value (sequence of timeslots)
 */
export function getRequestValue(account: CompleteServiceAccount, serviceId: u32, requestHash: Uint8Array, length: u64): Uint8Array | null {
  const key = createRequestKey(serviceId, requestHash, length)
  return account.rawCshKeyvals.get(key)
}

/**
 * Set request value in rawCshKeyvals
 * Value should be the encoded sequence of timeslots
 */
export function setRequestValue(account: CompleteServiceAccount, serviceId: u32, requestHash: Uint8Array, length: u64, value: Uint8Array): void {
  const key = createRequestKey(serviceId, requestHash, length)
  account.rawCshKeyvals.set(key, value)
}

/**
 * Delete request value from rawCshKeyvals
 */
export function deleteRequestValue(account: CompleteServiceAccount, serviceId: u32, requestHash: Uint8Array, length: u64): bool {
  const key = createRequestKey(serviceId, requestHash, length)
  return account.rawCshKeyvals.delete(key)
}

/**
 * Encode request timeslots to value format
 * Gray Paper: encode{var{sequence{encode[4]{x} | x ∈ t}}}
 */
export function encodeRequestTimeslots(timeslots: u32[]): Uint8Array {
  return encodeVariableSequenceGeneric<u32>(
    timeslots,
    (slot: u32) => encodeFixedLength(u64(slot), 4),
  )
}

/**
 * Decode request timeslots from value format
 */
export function decodeRequestTimeslots(value: Uint8Array): u32[] | null {
  const result = decodeVariableSequence<u32>(
    value,
    (data: Uint8Array) => {
      const fixedResult = decodeFixedLength(data, 4)
      if (!fixedResult) {
        return null
      }
      return new DecodingResult<u32>(u32(fixedResult.value), 4)
    },
  )
  if (!result) {
    return null
  }
  return result.value
}

/**
 * Storage entry structure
 * @deprecated Use RawCshKeyvals instead
 */
export class StorageEntry {
  key: Uint8Array
  value: Uint8Array
  
  constructor(key: Uint8Array, value: Uint8Array) {
    this.key = key
    this.value = value
  }
}

/**
 * Preimage entry structure
 */
export class PreimageEntry {
  hash: Uint8Array
  blob: Uint8Array
  
  constructor(hash: Uint8Array, blob: Uint8Array) {
    this.hash = hash
    this.blob = blob
  }
}

/**
 * Preimage Request Status (sequence of up to 3 timeslots)
 */
export class PreimageRequestStatus {
  timeslots: u32[]
  
  constructor() {
    this.timeslots = new Array<u32>()
  }
}

/**
 * Request entry structure
 */
export class RequestEntry {
  hash: Uint8Array
  length: u64
  status: PreimageRequestStatus
  
  constructor(hash: Uint8Array, length: u64, status: PreimageRequestStatus) {
    this.hash = hash
    this.length = length
    this.status = status
  }
}


/**
 * Complete Service Account structure (AssemblyScript)
 * 
 * Matches TypeScript ServiceAccount interface with rawCshKeyvals
 * for flattened storage/preimages/requests dictionary.
 */
export class CompleteServiceAccount {
  codehash: Uint8Array // 32 bytes
  balance: u64
  minaccgas: u64
  minmemogas: u64
  octets: u64
  gratis: u64
  items: u32
  created: u32
  lastacc: u32
  parent: u32
  
  /**
   * Flattened key-value store for storage, preimages, and requests
   * Matches TypeScript's rawCshKeyvals: Record<Hex, Hex>
   */
  rawCshKeyvals: RawCshKeyvals

  
  constructor() {
    this.codehash = new Uint8Array(32)
    this.balance = u64(0)
    this.minaccgas = u64(0)
    this.minmemogas = u64(0)
    this.octets = u64(0)
    this.gratis = u64(0)
    this.items = 0
    this.created = 0
    this.lastacc = 0
    this.parent = 0
    this.rawCshKeyvals = new RawCshKeyvals()
  }
}


/**
 * Decode complete ServiceAccount according to Gray Paper accounts.tex equation 12-27
 * 
 * NOTE: This implementation matches TypeScript's decodeCompleteServiceAccount
 * which decodes rawCshKeyvals as a SINGLE dictionary (flattened storage/preimages/requests).
 * 
 * Gray Paper: serviceaccount ≡ tuple{
 *   sa_storage ∈ dictionary{blob}{blob},
 *   sa_preimages ∈ dictionary{hash}{blob},
 *   sa_requests ∈ dictionary{tuple{hash, bloblength}}{sequence[:3]{timeslot}},
 *   sa_gratis ∈ balance,
 *   sa_codehash ∈ hash,
 *   sa_balance ∈ balance,
 *   sa_minaccgas ∈ gas,
 *   sa_minmemogas ∈ gas,
 *   sa_created ∈ timeslot,
 *   sa_lastacc ∈ timeslot,
 *   sa_parent ∈ serviceid
 * }
 * 
 * @param data - Octet sequence to decode
 * @returns Decoded ServiceAccount and remaining data
 */
export function decodeCompleteServiceAccount(
  data: Uint8Array,
): DecodingResult<CompleteServiceAccount> | null {
  let currentData = data
  
  const account = new CompleteServiceAccount()
  
  // rawCshKeyvals: decode{dictionary{blob}{blob}}
  // This is a single flattened dictionary matching TypeScript's rawCshKeyvals
  const keyvalVarResult = decodeVariableLength(currentData)
  if (!keyvalVarResult) {
    return null
  }
  const keyvalPairs = keyvalVarResult.value
  currentData = currentData.slice(keyvalVarResult.consumed)
  
  let keyvalData = keyvalPairs
  // Decode pairs until we've processed all bytes
  while (keyvalData.length > 0) {
    // Decode key: var{blob} = length prefix + blob
    const keyVarResult = decodeVariableLength(keyvalData)
    if (!keyVarResult) {
      break
    }
    const keyBytes = keyVarResult.value
    keyvalData = keyvalData.slice(keyVarResult.consumed)
    
    // Decode value: var{blob} = length prefix + blob
    const valueVarResult = decodeVariableLength(keyvalData)
    if (!valueVarResult) {
      break
    }
    const valueBytes = valueVarResult.value
    keyvalData = keyvalData.slice(valueVarResult.consumed)
    
    // Store in rawCshKeyvals
    account.rawCshKeyvals.set(keyBytes, valueBytes)
  }
  
  // sa_octets: decode[8]{octets} (8-byte fixed-length) - read octets from encoding
  const octetsResult = decodeFixedLength(currentData, 8)
  if (!octetsResult) {
    return null
  }
  account.octets = octetsResult.value
  currentData = currentData.slice(octetsResult.consumed)
  
  // sa_items: decode[4]{items} (4-byte fixed-length) - read items from encoding
  const itemsResult = decodeFixedLength(currentData, 4)
  if (!itemsResult) {
    return null
  }
  account.items = u32(itemsResult.value)
  currentData = currentData.slice(itemsResult.consumed)
  
  // sa_gratis: decode[8]{balance} (8-byte fixed-length)
  const gratisResult = decodeFixedLength(currentData, 8)
  if (!gratisResult) {
    return null
  }
  account.gratis = gratisResult.value
  currentData = currentData.slice(gratisResult.consumed)
  
  // sa_codehash: hash (32-byte blob, identity encoding)
  if (currentData.length < 32) {
    return null
  }
  account.codehash = currentData.slice(0, 32)
  currentData = currentData.slice(32)
  
  // sa_balance: decode[8]{balance} (8-byte fixed-length)
  const balanceResult = decodeFixedLength(currentData, 8)
  if (!balanceResult) {
    return null
  }
  account.balance = balanceResult.value
  currentData = currentData.slice(balanceResult.consumed)
  
  // sa_minaccgas: decode[8]{gas} (8-byte fixed-length)
  const minAccGasResult = decodeFixedLength(currentData, 8)
  if (!minAccGasResult) {
    return null
  }
  account.minaccgas = minAccGasResult.value
  currentData = currentData.slice(minAccGasResult.consumed)
  
  // sa_minmemogas: decode[8]{gas} (8-byte fixed-length)
  const minMemoGasResult = decodeFixedLength(currentData, 8)
  if (!minMemoGasResult) {
    return null
  }
  account.minmemogas = minMemoGasResult.value
  currentData = currentData.slice(minMemoGasResult.consumed)
  
  // sa_created: decode[4]{timeslot} (4-byte fixed-length)
  const createdResult = decodeFixedLength(currentData, 4)
  if (!createdResult) {
    return null
  }
  account.created = u32(createdResult.value)
  currentData = currentData.slice(createdResult.consumed)
  
  // sa_lastacc: decode[4]{timeslot} (4-byte fixed-length)
  const lastAccResult = decodeFixedLength(currentData, 4)
  if (!lastAccResult) {
    return null
  }
  account.lastacc = u32(lastAccResult.value)
  currentData = currentData.slice(lastAccResult.consumed)
  
  // sa_parent: decode[4]{serviceid} (4-byte fixed-length)
  const parentResult = decodeFixedLength(currentData, 4)
  if (!parentResult) {
    return null
  }
  account.parent = u32(parentResult.value)
  currentData = currentData.slice(parentResult.consumed)
  
  // Note: octets and items are already read from the encoding above (lines 2093-2107)
  // Do NOT recompute them - they should be preserved from the encoding
  
  const consumed = data.length - currentData.length
  return new DecodingResult<CompleteServiceAccount>(account, consumed)
}

// ============================================================================
// PartialState Structures (AssemblyScript)
// ============================================================================

/**
 * Account entry structure
 */
export class AccountEntry {
  serviceId: u32
  account: CompleteServiceAccount
  
  constructor(serviceId: u32, account: CompleteServiceAccount) {
    this.serviceId = serviceId
    this.account = account
  }
}

/**
 * AlwaysAccer entry structure
 */
export class AlwaysAccerEntry {
  serviceId: u32
  gas: u64
  
  constructor(serviceId: u32, gas: u64) {
    this.serviceId = serviceId
    this.gas = gas
  }
}

/**
 * PartialState structure (AssemblyScript)
 */
export class PartialState {
  accounts: Array<AccountEntry>
  stagingset: Uint8Array[]
  authqueue: Uint8Array[][]
  manager: u32
  assigners: u32[]
  delegator: u32
  registrar: u32
  alwaysaccers: Array<AlwaysAccerEntry>
  
  constructor() {
    this.accounts = new Array<AccountEntry>()
    this.stagingset = new Array<Uint8Array>()
    this.authqueue = new Array<Array<Uint8Array>>()
    this.manager = 0
    this.assigners = new Array<u32>()
    this.delegator = 0
    this.registrar = 0
    this.alwaysaccers = new Array<AlwaysAccerEntry>()
  }
}

/**
 * Decode PartialState according to Gray Paper specification
 * 
 * Gray Paper accumulation.tex equation 133-144:
 * partialstate ≡ tuple{
 *   ps_accounts: dictionary<serviceid, serviceaccount>,
 *   ps_stagingset: sequence[Cvalcount]{valkey},
 *   ps_authqueue: sequence[Ccorecount]{sequence[C_authqueuesize]{hash}},
 *   ps_manager: serviceid,
 *   ps_assigners: sequence[Ccorecount]{serviceid},
 *   ps_delegator: serviceid,
 *   ps_registrar: serviceid,
 *   ps_alwaysaccers: dictionary<serviceid, gas>
 * }
 * 
 * @param data - Octet sequence to decode
 * @param numCores - Number of cores (Ccorecount)
 * @param numValidators - Number of validators (Cvalcount)
 * @param authQueueSize - Authorization queue size (C_authqueuesize)
 * @returns Decoded PartialState and remaining data
 */
export function decodePartialState(
  data: Uint8Array,
  numCores: i32,
  numValidators: i32,
  authQueueSize: i32,
): DecodingResult<PartialState> | null {
  let currentData = data
  
  const partialState = new PartialState()
  
  // ps_accounts: decode{var{sequence{sorted(serviceid, serviceaccount)}}}
  // For dictionaries with variable-length values (service accounts), we need to decode
  // each value to know where it ends, since service accounts are self-delimiting
  // Note: This matches TypeScript's manual decoding approach
  const accountsVarResult = decodeVariableLength(currentData)
  if (!accountsVarResult) {
    return null
  }
  const accountsData = accountsVarResult.value
  currentData = currentData.slice(accountsVarResult.consumed)
  
  let accountsRemaining = accountsData
  while (accountsRemaining.length >= 4) {
    // Decode service ID (4 bytes)
    const serviceIdResult = decodeFixedLength(accountsRemaining, 4)
    if (!serviceIdResult) {
      break
    }
    const serviceId = u32(serviceIdResult.value)
    accountsRemaining = accountsRemaining.slice(serviceIdResult.consumed)
    
    // Decode complete service account (self-delimiting)
    const accountResult = decodeCompleteServiceAccount(accountsRemaining)
    if (!accountResult) {
      break
    }
    const account = accountResult.value
    accountsRemaining = accountsRemaining.slice(accountResult.consumed)
    
    partialState.accounts.push(new AccountEntry(serviceId, account))
  }
  
  // ps_stagingset: decode{sequence[Cvalcount]{valkey}} (fixed-length, no var{})
  // Each valkey is 336 bytes
  const VALIDATOR_KEY_SIZE = 336
  const stagingsetSize = numValidators * VALIDATOR_KEY_SIZE
  if (currentData.length < stagingsetSize) {
    return null
  }
  
  for (let i = 0; i < numValidators; i++) {
    const validatorKey = currentData.slice(i * VALIDATOR_KEY_SIZE, (i + 1) * VALIDATOR_KEY_SIZE)
    partialState.stagingset.push(validatorKey)
  }
  currentData = currentData.slice(stagingsetSize)
  
  // ps_authqueue: decode{sequence[Ccorecount]{sequence[C_authqueuesize]{hash}}} (fixed-length)
  // Gray Paper: C_authqueuesize = 80 (constant, not from config)
  // Each hash is 32 bytes
  const HASH_SIZE = 32
  const AUTH_QUEUE_SIZE = 80 // AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE
  const coreQueueSize = AUTH_QUEUE_SIZE * HASH_SIZE
  
  for (let coreIdx = 0; coreIdx < numCores; coreIdx++) {
    if (currentData.length < coreQueueSize) {
      return null
    }
    const coreQueue = new Array<Uint8Array>()
    for (let authIdx = 0; authIdx < AUTH_QUEUE_SIZE; authIdx++) {
      const hash = currentData.slice(authIdx * HASH_SIZE, (authIdx + 1) * HASH_SIZE)
      coreQueue.push(hash)
    }
    partialState.authqueue.push(coreQueue)
    currentData = currentData.slice(coreQueueSize)
  }
  
  // ps_manager: decode[4]{serviceid} (4-byte fixed-length)
  const managerResult = decodeFixedLength(currentData, 4)
  if (!managerResult) {
    return null
  }
  partialState.manager = u32(managerResult.value)
  currentData = currentData.slice(managerResult.consumed)
  
  // ps_assigners: decode{sequence[Ccorecount]{encode[4]{serviceid}}} (fixed-length)
  for (let i = 0; i < numCores; i++) {
    const assignerResult = decodeFixedLength(currentData, 4)
    if (!assignerResult) {
      return null
    }
    partialState.assigners.push(u32(assignerResult.value))
    currentData = currentData.slice(assignerResult.consumed)
  }
  
  // ps_delegator: decode[4]{serviceid} (4-byte fixed-length)
  const delegatorResult = decodeFixedLength(currentData, 4)
  if (!delegatorResult) {
    return null
  }
  partialState.delegator = u32(delegatorResult.value)
  currentData = currentData.slice(delegatorResult.consumed)
  
  // ps_registrar: decode[4]{serviceid} (4-byte fixed-length)
  const registrarResult = decodeFixedLength(currentData, 4)
  if (!registrarResult) {
    return null
  }
  partialState.registrar = u32(registrarResult.value)
  currentData = currentData.slice(registrarResult.consumed)
  
  // ps_alwaysaccers: decode{var{sequence{sorted(serviceid, gas)}}}
  // Manually decode dictionary with fixed-length keys and values
  const alwaysAccersVarResult = decodeVariableLength(currentData)
  if (!alwaysAccersVarResult) {
    return null
  }
  const alwaysAccersPairs = alwaysAccersVarResult.value
  currentData = currentData.slice(alwaysAccersVarResult.consumed)
  
  let alwaysAccersData = alwaysAccersPairs
  // Decode pairs until we've processed all bytes
  while (alwaysAccersData.length >= 8) { // 4 bytes key + 4 bytes value
    // Decode key: encode[4]{serviceid} (4 bytes fixed)
    const serviceIdResult = decodeFixedLength(alwaysAccersData, 4)
    if (!serviceIdResult) {
      break
    }
    const serviceId = u32(serviceIdResult.value)
    alwaysAccersData = alwaysAccersData.slice(4) // Consume key
    
    // Decode value: encode[4]{gas} (4 bytes fixed)
    const gasResult = decodeFixedLength(alwaysAccersData, 4)
    if (!gasResult) {
      break
    }
    const gas = u32(gasResult.value)
    alwaysAccersData = alwaysAccersData.slice(4) // Consume value
    
    partialState.alwaysaccers.push(new AlwaysAccerEntry(serviceId, gas))
  }
  
  const consumed = data.length - currentData.length
  return new DecodingResult<PartialState>(partialState, consumed)
}

// ============================================================================
// Optional Decoding (Gray Paper compliant)
// ============================================================================

/**
 * Decode optional value
 * 
 * Gray Paper: maybe{x} = {0 when x = none, ⟨1, x⟩ otherwise}
 * 
 * @param data - Octet sequence to decode
 * @param decoder - Function to decode the value when present
 * @returns Decoded optional value and remaining octet sequence
 */
export function decodeOptional<T>(
  data: Uint8Array,
  decoder: (data: Uint8Array) => DecodingResult<T> | null,
): DecodingResult<T> | null {
  if (data.length === 0) {
    return null
  }
  
  const discriminator = data[0]
  
  if (discriminator === 0) {
    // None case - return null (but we need to indicate consumed bytes)
    // For AssemblyScript, we'll return a special result indicating null
    // Actually, we can't return null for the value in a generic way in AssemblyScript
    // So we'll need to handle this differently - return a result with a flag
    return null // This indicates "none" case
  }
  
  if (discriminator === 1) {
    // Some case - decode the value
    const result = decoder(data.slice(1))
    if (!result) {
      return null
    }
    // Adjust consumed to include discriminator
    return new DecodingResult<T>(result.value, 1 + result.consumed)
  }
  
  return null // Invalid discriminator
}

// ============================================================================
// Deferred Transfer Structures and Decoding (Gray Paper compliant)
// ============================================================================

/**
 * Deferred Transfer structure (AssemblyScript)
 */
export class DeferredTransfer {
  source: u32
  dest: u32
  amount: u64
  memo: Uint8Array
  gasLimit: u64
  
  constructor() {
    this.source = 0
    this.dest = 0
    this.amount = u64(0)
    this.memo = new Uint8Array(0)
    this.gasLimit = u64(0)
  }
}

/**
 * Decode deferred transfer according to Gray Paper specification
 * 
 * Gray Paper Equation 271-277:
 * encode[X]{DX ∈ defxfer} ≡ encode{
 *   encode[4]{DX_source},
 *   encode[4]{DX_dest},
 *   encode[8]{DX_amount},
 *   DX_memo,
 *   encode[8]{DX_gas}
 * }
 * 
 * @param data - Octet sequence to decode
 * @returns Decoded deferred transfer and remaining data
 */
export function decodeDeferredTransfer(
  data: Uint8Array,
): DecodingResult<DeferredTransfer> | null {
  let currentData = data
  
  const transfer = new DeferredTransfer()
  
  // Source: decode[4]{DX_source} (4-byte fixed-length)
  const sourceResult = decodeFixedLength(currentData, 4)
  if (!sourceResult) {
    return null
  }
  transfer.source = u32(sourceResult.value)
  currentData = currentData.slice(sourceResult.consumed)
  
  // Destination: decode[4]{DX_dest} (4-byte fixed-length)
  const destResult = decodeFixedLength(currentData, 4)
  if (!destResult) {
    return null
  }
  transfer.dest = u32(destResult.value)
  currentData = currentData.slice(destResult.consumed)
  
  // Amount: decode[8]{DX_amount} (8-byte fixed-length)
  const amountResult = decodeFixedLength(currentData, 8)
  if (!amountResult) {
    return null
  }
  transfer.amount = amountResult.value
  currentData = currentData.slice(amountResult.consumed)
  
  // Memo: DX_memo (fixed 128-byte blob, Cmemosize = 128)
  // Gray Paper specifies memo is exactly 128 bytes, no length prefix
  if (currentData.length < 128) {
    return null
  }
  transfer.memo = currentData.slice(0, 128)
  currentData = currentData.slice(128)
  
  // Gas: decode[8]{DX_gas} (8-byte fixed-length)
  const gasResult = decodeFixedLength(currentData, 8)
  if (!gasResult) {
    return null
  }
  transfer.gasLimit = gasResult.value
  currentData = currentData.slice(gasResult.consumed)
  
  const consumed = data.length - currentData.length
  return new DecodingResult<DeferredTransfer>(transfer, consumed)
}

// ============================================================================
// Implications Structures and Decoding (Gray Paper compliant)
// ============================================================================

/**
 * Provision entry structure
 */
export class ProvisionEntry {
  serviceId: u32
  blob: Uint8Array
  
  constructor(serviceId: u32, blob: Uint8Array) {
    this.serviceId = serviceId
    this.blob = blob
  }
}

/**
 * Implications structure (AssemblyScript)
 */
export class Implications {
  id: u32
  state: PartialState
  nextfreeid: u32
  xfers: Array<DeferredTransfer>
  yield: Uint8Array | null
  provisions: Array<ProvisionEntry>
  
  constructor() {
    this.id = 0
    this.state = new PartialState()
    this.nextfreeid = 0
    this.xfers = new Array<DeferredTransfer>()
    this.yield = null
    this.provisions = new Array<ProvisionEntry>()
  }
}

/**
 * Decode Implications according to Gray Paper specification
 * 
 * Gray Paper pvm_invocations.tex equation 126-133:
 * implications ≡ tuple{
 *   im_id: serviceid,
 *   im_state: partialstate,
 *   im_nextfreeid: serviceid,
 *   im_xfers: defxfers,
 *   im_yield: optional<hash>,
 *   im_provisions: protoset<tuple{serviceid, blob}>
 * }
 * 
 * @param data - Octet sequence to decode
 * @param numCores - Number of cores (Ccorecount)
 * @param numValidators - Number of validators (Cvalcount)
 * @param authQueueSize - Authorization queue size (C_authqueuesize)
 * @returns Decoded Implications and remaining data
 */
export function decodeImplications(
  data: Uint8Array,
  numCores: i32,
  numValidators: i32,
  authQueueSize: i32,
): DecodingResult<Implications> | null {
  let currentData = data
  
  const implications = new Implications()
  
  // im_id: decode[4]{serviceid} (4-byte fixed-length)
  const idResult = decodeFixedLength(currentData, 4)
  if (!idResult) {
    return null
  }
  implications.id = u32(idResult.value)
  currentData = currentData.slice(idResult.consumed)
  
  // im_state: decode{partialstate}
  const stateResult = decodePartialState(currentData, numCores, numValidators, authQueueSize)
  if (!stateResult) {
    return null
  }
  implications.state = stateResult.value
  currentData = currentData.slice(stateResult.consumed)
  
  // im_nextfreeid: decode[4]{serviceid} (4-byte fixed-length)
  const nextFreeIdResult = decodeFixedLength(currentData, 4)
  if (!nextFreeIdResult) {
    return null
  }
  implications.nextfreeid = u32(nextFreeIdResult.value)
  currentData = currentData.slice(nextFreeIdResult.consumed)
  
  // im_xfers: decode{var{sequence{defxfer}}}
  const xfersResult = decodeVariableSequence<DeferredTransfer>(currentData, decodeDeferredTransfer)
  if (!xfersResult) {
    return null
  }
  implications.xfers = xfersResult.value
  currentData = currentData.slice(xfersResult.consumed)
  
  // im_yield: decode{maybe{hash}}
  // maybe{x} = {0 when x = none, ⟨1, x⟩ otherwise}
  // hash is 32 bytes
  if (currentData.length === 0) {
    return null
  }
  const yieldDiscriminator = currentData[0]
  if (yieldDiscriminator === 0) {
    // None case
    implications.yield = null
    currentData = currentData.slice(1)
  } else if (yieldDiscriminator === 1) {
    // Some case - decode 32-byte hash
    if (currentData.length < 33) {
      return null
    }
    implications.yield = currentData.slice(1, 33)
    currentData = currentData.slice(33)
  } else {
    return null // Invalid discriminator
  }
  
  // im_provisions: decode{var{sequence{sorted(serviceid, blob)}}}
  // Each tuple is: encode[4]{serviceid} || encode{var{blob}}
  const provisionsResult = decodeVariableSequence<ProvisionEntry>(
    currentData,
    (data: Uint8Array) => {
      // Decode serviceid: encode[4]{serviceid}
      const serviceIdResult = decodeFixedLength(data, 4)
      if (!serviceIdResult) {
        return null
      }
      const serviceId = u32(serviceIdResult.value)
      let remaining = data.slice(serviceIdResult.consumed)
      
      // Decode blob: encode{var{blob}} = encode{len(blob)} || blob
      const blobLengthResult = decodeNatural(remaining)
      if (!blobLengthResult) {
        return null
      }
      const blobLength = i32(blobLengthResult.value)
      remaining = remaining.slice(blobLengthResult.consumed)
      
      if (remaining.length < blobLength) {
        return null
      }
      
      const blob = remaining.slice(0, blobLength)
      remaining = remaining.slice(blobLength)
      
      const consumed = data.length - remaining.length
      return new DecodingResult<ProvisionEntry>(
        new ProvisionEntry(serviceId, blob),
        consumed,
      )
    },
  )
  if (!provisionsResult) {
    return null
  }
  implications.provisions = provisionsResult.value
  currentData = currentData.slice(provisionsResult.consumed)
  
  const consumed = data.length - currentData.length
  return new DecodingResult<Implications>(implications, consumed)
}

/**
 * ImplicationsPair structure (AssemblyScript)
 */
export class ImplicationsPair {
  regular: Implications
  exceptional: Implications
  
  constructor(regular: Implications, exceptional: Implications) {
    this.regular = regular
    this.exceptional = exceptional
  }
}

/**
 * Decode ImplicationsPair according to Gray Paper specification
 * 
 * Gray Paper: ImplicationsPair = implications × implications
 * decode{ImplicationsPair} = decode{Implications} || decode{Implications}
 * 
 * @param data - Octet sequence to decode
 * @param numCores - Number of cores (Ccorecount)
 * @param numValidators - Number of validators (Cvalcount)
 * @param authQueueSize - Authorization queue size (C_authqueuesize)
 * @returns Decoded ImplicationsPair and remaining data
 */
export function decodeImplicationsPair(
  data: Uint8Array,
  numCores: i32,
  numValidators: i32,
  authQueueSize: i32,
): DecodingResult<ImplicationsPair> | null {
  // Decode regular dimension (first element)
  const regularResult = decodeImplications(data, numCores, numValidators, authQueueSize)
  if (!regularResult) {
    return null
  }
  const regular = regularResult.value
  const regularRemaining = data.slice(regularResult.consumed)
  
  // Decode exceptional dimension (second element)
  const exceptionalResult = decodeImplications(
    regularRemaining,
    numCores,
    numValidators,
    authQueueSize,
  )
  if (!exceptionalResult) {
    return null
  }
  const exceptional = exceptionalResult.value
  const exceptionalRemaining = regularRemaining.slice(exceptionalResult.consumed)
  
  const pair = new ImplicationsPair(regular, exceptional)
  
  const consumed = data.length - exceptionalRemaining.length
  return new DecodingResult<ImplicationsPair>(pair, consumed)
}

// ============================================================================
// Encoding Functions (Gray Paper compliant)
// ============================================================================

/**
 * Encode optional value according to Gray Paper specification
 * 
 * Gray Paper: maybe{x} = {0 when x = none, ⟨1, x⟩ otherwise}
 * 
 * @param value - Optional value to encode (null for none, Uint8Array for some)
 * @param encoder - Function to encode the value when present
 * @returns Encoded octet sequence
 */
export function encodeOptional(
  value: Uint8Array | null,
  encoder: (value: Uint8Array) => Uint8Array,
): Uint8Array {
  if (value === null) {
    // None case: single byte 0
    const result = new Uint8Array(1)
    result[0] = 0
    return result
  } else {
    // Some case: discriminator 1 + encoded value
    const encoded = encoder(value)
    const result = new Uint8Array(1 + encoded.length)
    result[0] = 1
    result.set(encoded, 1)
    return result
  }
}

/**
 * Encode deferred transfer according to Gray Paper specification
 * 
 * Gray Paper Equation 271-277:
 * encode[X]{DX ∈ defxfer} ≡ encode{
 *   encode[4]{DX_source},
 *   encode[4]{DX_dest},
 *   encode[8]{DX_amount},
 *   DX_memo,
 *   encode[8]{DX_gas}
 * }
 * 
 * @param transfer - Deferred transfer to encode
 * @returns Encoded octet sequence
 */
export function encodeDeferredTransfer(transfer: DeferredTransfer): Uint8Array {
  const parts: Uint8Array[] = []
  
  // Source: encode[4]{DX_source} (4-byte fixed-length)
  parts.push(encodeFixedLength(u64(transfer.source), 4))
  
  // Destination: encode[4]{DX_dest} (4-byte fixed-length)
  parts.push(encodeFixedLength(u64(transfer.dest), 4))
  
  // Amount: encode[8]{DX_amount} (8-byte fixed-length)
  parts.push(encodeFixedLength(transfer.amount, 8))
  
  // Memo: DX_memo (fixed 128-byte blob, Cmemosize = 128)
  // Gray Paper specifies memo is exactly 128 bytes, no length prefix
  if (transfer.memo.length != 128) {
    // Pad or truncate to exactly 128 bytes
    const fixedMemo = new Uint8Array(128)
    const copyLen = i32(min(u64(transfer.memo.length), u64(128)))
    for (let i = 0; i < copyLen; i++) {
      fixedMemo[i] = transfer.memo[i]
    }
    parts.push(fixedMemo)
  } else {
    parts.push(transfer.memo)
  }
  
  // Gas: encode[8]{DX_gas} (8-byte fixed-length)
  parts.push(encodeFixedLength(transfer.gasLimit, 8))
  
  return concatBytes(parts)
}

// ============================================================================
// Accumulate Input Structures and Encoding (Gray Paper compliant)
// ============================================================================

/**
 * OperandTuple structure for work item results
 * 
 * Gray Paper Equation 279-287: encode[U]{OT ∈ operandtuple}
 */
export class OperandTuple {
  packageHash: Uint8Array    // 32-byte hash
  segmentRoot: Uint8Array    // 32-byte hash
  authorizer: Uint8Array     // 32-byte public key
  payloadHash: Uint8Array    // 32-byte hash
  gasLimit: u64              // 8-byte gas limit
  result: Uint8Array         // Variable-length result (success blob or empty for error)
  resultType: u8             // 0 = success, 1-6 = error types
  authTrace: Uint8Array      // Variable-length authorization trace
  
  constructor() {
    this.packageHash = new Uint8Array(32)
    this.segmentRoot = new Uint8Array(32)
    this.authorizer = new Uint8Array(32)
    this.payloadHash = new Uint8Array(32)
    this.gasLimit = u64(0)
    this.result = new Uint8Array(0)
    this.resultType = 0 // Success by default
    this.authTrace = new Uint8Array(0)
  }
}

/**
 * AccumulateInput structure (discriminated union)
 * 
 * Gray Paper Equation 289-292:
 * encode{AI ∈ accinput} ≡ {
 *   encode{0, encode[U]{o}}  when AI ∈ operandtuple
 *   encode{1, encode[X]{o}}  when AI ∈ defxfer
 * }
 */
export class AccumulateInput {
  inputType: u8  // 0 = OperandTuple, 1 = DeferredTransfer
  operandTuple: OperandTuple | null
  deferredTransfer: DeferredTransfer | null
  
  constructor(inputType: u8) {
    this.inputType = inputType
    this.operandTuple = null
    this.deferredTransfer = null
  }
  
  static fromOperandTuple(ot: OperandTuple): AccumulateInput {
    const input = new AccumulateInput(0)
    input.operandTuple = ot
    return input
  }
  
  static fromDeferredTransfer(dt: DeferredTransfer): AccumulateInput {
    const input = new AccumulateInput(1)
    input.deferredTransfer = dt
    return input
  }
}

/**
 * Encode work result according to Gray Paper specification
 * 
 * Gray Paper pvm_invocations.tex encodeResult:
 * 0 = success (followed by var{blob})
 * 1 = ∞ (out of gas)
 * 2 = panic
 * 3 = badexports
 * 4 = oversize
 * 5 = BAD
 * 6 = BIG
 */
export function encodeWorkResult(resultType: u8, result: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = []
  
  // Discriminator byte
  const discriminatorByte = new Uint8Array(1)
  discriminatorByte[0] = resultType
  parts.push(discriminatorByte)
  
  // If success (type 0), append the variable-length result blob
  if (resultType == 0) {
    parts.push(encodeNatural(u64(result.length)))
    parts.push(result)
  }
  // For error types 1-6, no additional data
  
  return concatBytes(parts)
}

/**
 * Encode OperandTuple according to Gray Paper specification
 * 
 * Gray Paper Equation 279-287:
 * encode[U]{OT ∈ operandtuple} ≡ encode{
 *   OT_packagehash,
 *   OT_segroot,
 *   OT_authorizer,
 *   OT_payloadhash,
 *   OT_gaslimit,
 *   encodeResult{OT_result},
 *   var{OT_authtrace}
 * }
 * 
 * Note: OT_gaslimit uses natural encoding (no encode[8]{} wrapper)
 */
export function encodeOperandTuple(ot: OperandTuple): Uint8Array {
  const parts: Uint8Array[] = []
  
  // packageHash: 32-byte hash
  parts.push(ot.packageHash)
  
  // segmentRoot: 32-byte hash
  parts.push(ot.segmentRoot)
  
  // authorizer: 32-byte public key
  parts.push(ot.authorizer)
  
  // payloadHash: 32-byte hash
  parts.push(ot.payloadHash)
  
  // gasLimit: natural encoding (Gray Paper uses encode{} not encode[8]{})
  parts.push(encodeNatural(ot.gasLimit))
  
  // encodeResult{result}: discriminator + optional var{blob}
  parts.push(encodeWorkResult(ot.resultType, ot.result))
  
  // var{authTrace}: variable-length with length prefix
  parts.push(encodeNatural(u64(ot.authTrace.length)))
  parts.push(ot.authTrace)
  
  return concatBytes(parts)
}

/**
 * Encode AccumulateInput according to Gray Paper specification
 * 
 * Gray Paper Equation 289-292:
 * encode{AI ∈ accinput} ≡ {
 *   encode{0, encode[U]{o}}  when AI ∈ operandtuple
 *   encode{1, encode[X]{o}}  when AI ∈ defxfer
 * }
 * 
 * For v0.7.0 and earlier, accinput encoding didn't exist - encode as raw type
 * For v0.7.1+, include type discriminator byte
 * 
 * @param input - AccumulateInput to encode
 * @param jamVersionMajor - JAM version major (default 0)
 * @param jamVersionMinor - JAM version minor (default 7)
 * @param jamVersionPatch - JAM version patch (default 2)
 */
export function encodeAccumulateInput(
  input: AccumulateInput,
  jamVersionMajor: u8 = 0,
  jamVersionMinor: u8 = 7,
  jamVersionPatch: u8 = 2,
): Uint8Array {
  // Check if version is <= 0.7.0 (accinput encoding didn't exist)
  const isV070OrEarlier = 
    jamVersionMajor < 0 ||
    (jamVersionMajor == 0 && jamVersionMinor < 7) ||
    (jamVersionMajor == 0 && jamVersionMinor == 7 && jamVersionPatch <= 0)
  
  if (isV070OrEarlier) {
    // In v0.7.0, accinput didn't exist - encode as raw type without discriminator
    if (input.inputType == 0 && input.operandTuple != null) {
      return encodeOperandTuple(input.operandTuple!)
    } else if (input.inputType == 1 && input.deferredTransfer != null) {
      return encodeDeferredTransfer(input.deferredTransfer!)
    }
    return new Uint8Array(0)
  }
  
  // v0.7.1+ encoding with discriminator
  const parts: Uint8Array[] = []
  
  // Type discriminator
  const discriminatorByte = new Uint8Array(1)
  discriminatorByte[0] = input.inputType
  parts.push(discriminatorByte)
  
  if (input.inputType == 0 && input.operandTuple != null) {
    // OperandTuple encoding
    parts.push(encodeOperandTuple(input.operandTuple!))
  } else if (input.inputType == 1 && input.deferredTransfer != null) {
    // DeferredTransfer encoding
    parts.push(encodeDeferredTransfer(input.deferredTransfer!))
  }
  
  return concatBytes(parts)
}

/**
 * Decode work result according to Gray Paper specification
 * 
 * Gray Paper pvm_invocations.tex encodeResult:
 * 0 = success (followed by var{blob})
 * 1-6 = error types (no additional data)
 */
export function decodeWorkResult(data: Uint8Array): DecodingResult<OperandTuple> | null {
  if (data.length === 0) {
    return null
  }
  
  const ot = new OperandTuple()
  ot.resultType = data[0]
  
  if (ot.resultType == 0) {
    // Success: var{result_blob}
    const lengthResult = decodeNatural(data.slice(1))
    if (!lengthResult) {
      return null
    }
    const blobLength = i32(lengthResult.value)
    const remaining = data.slice(1 + lengthResult.consumed)
    if (remaining.length < blobLength) {
      return null
    }
    ot.result = remaining.slice(0, blobLength)
    return new DecodingResult<OperandTuple>(ot, 1 + lengthResult.consumed + blobLength)
  }
  
  // Error types 1-6: no additional data
  return new DecodingResult<OperandTuple>(ot, 1)
}

/**
 * Decode OperandTuple according to Gray Paper specification
 * 
 * Gray Paper Equation 279-287:
 * encode[U]{OT ∈ operandtuple} ≡ encode{
 *   OT_packagehash,
 *   OT_segroot,
 *   OT_authorizer,
 *   OT_payloadhash,
 *   OT_gaslimit,
 *   encodeResult{OT_result},
 *   var{OT_authtrace}
 * }
 */
export function decodeOperandTuple(data: Uint8Array): DecodingResult<OperandTuple> | null {
  if (data.length < 128) { // Minimum: 32+32+32+32 = 128 bytes for fixed hash fields
    return null
  }
  
  const ot = new OperandTuple()
  let offset = 0
  
  // packageHash: 32 bytes
  ot.packageHash = data.slice(offset, offset + 32)
  offset += 32
  
  // segmentRoot: 32 bytes
  ot.segmentRoot = data.slice(offset, offset + 32)
  offset += 32
  
  // authorizer: 32 bytes
  ot.authorizer = data.slice(offset, offset + 32)
  offset += 32
  
  // payloadHash: 32 bytes
  ot.payloadHash = data.slice(offset, offset + 32)
  offset += 32
  
  // gasLimit: natural encoding (Gray Paper uses encode{} not encode[8]{})
  const gasResult = decodeNatural(data.slice(offset))
  if (!gasResult) {
    return null
  }
  ot.gasLimit = gasResult.value
  offset += gasResult.consumed
  
  // decodeResult: discriminator + optional var{blob}
  const resultDisc = data[offset]
  ot.resultType = resultDisc
  offset += 1
  
  if (resultDisc == 0) {
    // Success: var{result_blob}
    const lengthResult = decodeNatural(data.slice(offset))
    if (!lengthResult) {
      return null
    }
    const blobLength = i32(lengthResult.value)
    offset += lengthResult.consumed
    
    if (offset + blobLength > data.length) {
      return null
    }
    ot.result = data.slice(offset, offset + blobLength)
    offset += blobLength
  }
  // For error types 1-6: no additional data, result stays empty
  
  // var{authTrace}: variable-length with length prefix
  const authTraceLengthResult = decodeNatural(data.slice(offset))
  if (!authTraceLengthResult) {
    return null
  }
  const authTraceLength = i32(authTraceLengthResult.value)
  offset += authTraceLengthResult.consumed
  
  if (offset + authTraceLength > data.length) {
    return null
  }
  ot.authTrace = data.slice(offset, offset + authTraceLength)
  offset += authTraceLength
  
  return new DecodingResult<OperandTuple>(ot, offset)
}

/**
 * Decode AccumulateInput according to Gray Paper specification
 * 
 * Gray Paper Equation 289-292:
 * encode{AI ∈ accinput} ≡ {
 *   encode{0, encode[U]{o}}  when AI ∈ operandtuple
 *   encode{1, encode[X]{o}}  when AI ∈ defxfer
 * }
 */
export function decodeAccumulateInput(data: Uint8Array): DecodingResult<AccumulateInput> | null {
  if (data.length === 0) {
    return null
  }
  
  const inputType = data[0]
  const remaining = data.slice(1)
  
  if (inputType == 0) {
    // OperandTuple
    const otResult = decodeOperandTuple(remaining)
    if (!otResult) {
      return null
    }
    const input = AccumulateInput.fromOperandTuple(otResult.value)
    return new DecodingResult<AccumulateInput>(input, 1 + otResult.consumed)
  } else if (inputType == 1) {
    // DeferredTransfer
    const dtResult = decodeDeferredTransfer(remaining)
    if (!dtResult) {
      return null
    }
    const input = AccumulateInput.fromDeferredTransfer(dtResult.value)
    return new DecodingResult<AccumulateInput>(input, 1 + dtResult.consumed)
  }
  
  return null
}

/**
 * Encode variable-length sequence with custom element encoder
 * 
 * Gray Paper: var{sequence} = encode(len) || encode(element0) || encode(element1) || ...
 * 
 * @param sequence - Array of elements to encode
 * @param elementEncoder - Function to encode individual elements
 * @returns Encoded sequence with length prefix
 */
export function encodeVariableSequenceGeneric<T>(
  sequence: T[],
  elementEncoder: (element: T) => Uint8Array,
): Uint8Array {
  const parts: Uint8Array[] = []
  
  // Encode length prefix
  parts.push(encodeNatural(u64(sequence.length)))
  
  // Encode each element
  for (let i = 0; i < sequence.length; i++) {
    parts.push(elementEncoder(sequence[i]))
  }
  
  return concatBytes(parts)
}

/**
 * Encode complete service account according to Gray Paper specification
 * 
 * NOTE: This implementation matches TypeScript's encodeCompleteServiceAccount
 * which encodes rawCshKeyvals as a SINGLE dictionary (flattened storage/preimages/requests).
 * 
 * Gray Paper accounts.tex equation 12-27:
 * serviceaccount ≡ tuple{
 *   sa_storage ∈ dictionary{blob}{blob},
 *   sa_preimages ∈ dictionary{hash}{blob},
 *   sa_requests ∈ dictionary{tuple{hash, bloblength}}{sequence[:3]{timeslot}},
 *   sa_gratis ∈ balance,
 *   sa_codehash ∈ hash,
 *   sa_balance ∈ balance,
 *   sa_minaccgas ∈ gas,
 *   sa_minmemogas ∈ gas,
 *   sa_created ∈ timeslot,
 *   sa_lastacc ∈ timeslot,
 *   sa_parent ∈ serviceid
 * }
 * 
 * @param account - CompleteServiceAccount to encode
 * @returns Encoded octet sequence
 */
export function encodeCompleteServiceAccount(account: CompleteServiceAccount): Uint8Array {
  const parts: Uint8Array[] = []
  
  // rawCshKeyvals: encode{dictionary{blob}{blob}}
  // Sort entries by key for deterministic encoding (matching TypeScript)
  const sortedEntries = account.rawCshKeyvals.entries.slice()
  sortedEntries.sort((a, b) => {
    // Compare Uint8Array keys byte-by-byte
    const minLen = a.key.length < b.key.length ? a.key.length : b.key.length
    for (let i = 0; i < minLen; i++) {
      if (a.key[i] < b.key[i]) return -1
      if (a.key[i] > b.key[i]) return 1
    }
    if (a.key.length < b.key.length) return -1
    if (a.key.length > b.key.length) return 1
    return 0
  })
  
  // Manually encode dictionary: var{sequence{sorted(key, value)}}
  // Each key and value must be encoded with var{} discriminator (length prefix + blob)
  const keyvalPairs: Uint8Array[] = []
  for (let i = 0; i < sortedEntries.length; i++) {
    const entry = sortedEntries[i]
    // Key: encode{var{blob}} = encode{len(key)} || key
    const encodedKey = concatBytes([encodeNatural(u64(entry.key.length)), entry.key])
    // Value: encode{var{blob}} = encode{len(value)} || value
    const encodedValue = concatBytes([encodeNatural(u64(entry.value.length)), entry.value])
    keyvalPairs.push(concatBytes([encodedKey, encodedValue]))
  }
  const concatenatedPairs = concatBytes(keyvalPairs)
  // Wrap with var{} discriminator
  parts.push(concatBytes([encodeNatural(u64(concatenatedPairs.length)), concatenatedPairs]))
  
  // sa_octets: encode[8]{octets} (8-byte fixed-length) - include octets in encoding
  parts.push(encodeFixedLength(account.octets, 8))
  
  // sa_items: encode[4]{items} (4-byte fixed-length) - include items in encoding
  parts.push(encodeFixedLength(u64(account.items), 4))
  
  // sa_gratis: encode[8]{balance} (8-byte fixed-length)
  parts.push(encodeFixedLength(account.gratis, 8))
  
  // sa_codehash: hash (32-byte blob, identity encoding)
  parts.push(account.codehash)
  
  // sa_balance: encode[8]{balance} (8-byte fixed-length)
  parts.push(encodeFixedLength(account.balance, 8))
  
  // sa_minaccgas: encode[8]{gas} (8-byte fixed-length)
  parts.push(encodeFixedLength(account.minaccgas, 8))
  
  // sa_minmemogas: encode[8]{gas} (8-byte fixed-length)
  parts.push(encodeFixedLength(account.minmemogas, 8))
  
  // sa_created: encode[4]{timeslot} (4-byte fixed-length)
  parts.push(encodeFixedLength(u64(account.created), 4))
  
  // sa_lastacc: encode[4]{timeslot} (4-byte fixed-length)
  parts.push(encodeFixedLength(u64(account.lastacc), 4))
  
  // sa_parent: encode[4]{serviceid} (4-byte fixed-length)
  parts.push(encodeFixedLength(u64(account.parent), 4))
  
  return concatBytes(parts)
}

/**
 * Encode partial state according to Gray Paper specification
 * 
 * Gray Paper accumulation.tex equation 133-144:
 * partialstate ≡ tuple{
 *   ps_accounts: dictionary<serviceid, serviceaccount>,
 *   ps_stagingset: sequence[Cvalcount]{valkey},
 *   ps_authqueue: sequence[Ccorecount]{sequence[C_authqueuesize]{hash}},
 *   ps_manager: serviceid,
 *   ps_assigners: sequence[Ccorecount]{serviceid},
 *   ps_delegator: serviceid,
 *   ps_registrar: serviceid,
 *   ps_alwaysaccers: dictionary<serviceid, gas>
 * }
 * 
 * @param state - PartialState to encode
 * @param numCores - Number of cores (Ccorecount)
 * @param numValidators - Number of validators (Cvalcount)
 * @param authQueueSize - Authorization queue size (C_authqueuesize)
 * @returns Encoded octet sequence
 */
export function encodePartialState(
  state: PartialState,
  numCores: i32,
  numValidators: i32,
  authQueueSize: i32,
): Uint8Array {
  const parts: Uint8Array[] = []
  
  // ps_accounts: encode{var{sequence{sorted(serviceid, serviceaccount)}}}
  // Sort accounts by serviceId for deterministic encoding
  const sortedAccounts = state.accounts.slice()
  sortedAccounts.sort((a, b) => {
    if (a.serviceId < b.serviceId) return -1
    if (a.serviceId > b.serviceId) return 1
    return 0
  })
  
  // Manually encode dictionary: var{sequence{sorted(key, value)}}
  const accountPairs: Uint8Array[] = []
  for (let i = 0; i < sortedAccounts.length; i++) {
    const entry = sortedAccounts[i]
    // Key: encode[4]{serviceid}
    const key = encodeFixedLength(u64(entry.serviceId), 4)
    // Value: encode{serviceaccount}
    const value = encodeCompleteServiceAccount(entry.account)
    accountPairs.push(concatBytes([key, value]))
  }
  const concatenatedAccountPairs = concatBytes(accountPairs)
  // Wrap with var{} discriminator
  parts.push(concatBytes([encodeNatural(u64(concatenatedAccountPairs.length)), concatenatedAccountPairs]))
  
  // ps_stagingset: encode{sequence[Cvalcount]{valkey}} (fixed-length, no var{})
  // Each valkey is 336 bytes
  for (let i = 0; i < numValidators; i++) {
    if (i < state.stagingset.length) {
      parts.push(state.stagingset[i])
    } else {
      // Pad with zeros if not enough validators
      parts.push(new Uint8Array(336))
    }
  }
  
  // ps_authqueue: encode{sequence[Ccorecount]{sequence[C_authqueuesize]{hash}}} (fixed-length)
  // Gray Paper: C_authqueuesize = 80 (constant, not from config)
  // Each hash is 32 bytes
  const HASH_SIZE = 32
  const AUTH_QUEUE_SIZE = 80 // AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE
  for (let coreIdx = 0; coreIdx < numCores; coreIdx++) {
    if (coreIdx < state.authqueue.length) {
      const coreQueue = state.authqueue[coreIdx]
      for (let authIdx = 0; authIdx < AUTH_QUEUE_SIZE; authIdx++) {
        if (authIdx < coreQueue.length) {
          parts.push(coreQueue[authIdx])
        } else {
          // Pad with zeros if not enough hashes
          parts.push(new Uint8Array(HASH_SIZE))
        }
      }
    } else {
      // Pad entire core queue with zeros
      for (let authIdx = 0; authIdx < AUTH_QUEUE_SIZE; authIdx++) {
        parts.push(new Uint8Array(HASH_SIZE))
      }
    }
  }
  
  // ps_manager: encode[4]{serviceid} (4-byte fixed-length)
  parts.push(encodeFixedLength(u64(state.manager), 4))
  
  // ps_assigners: encode{sequence[Ccorecount]{encode[4]{serviceid}}} (fixed-length)
  for (let i = 0; i < numCores; i++) {
    if (i < state.assigners.length) {
      parts.push(encodeFixedLength(u64(state.assigners[i]), 4))
    } else {
      // Pad with zeros if not enough assigners
      parts.push(encodeFixedLength(u64(0), 4))
    }
  }
  
  // ps_delegator: encode[4]{serviceid} (4-byte fixed-length)
  parts.push(encodeFixedLength(u64(state.delegator), 4))
  
  // ps_registrar: encode[4]{serviceid} (4-byte fixed-length)
  parts.push(encodeFixedLength(u64(state.registrar), 4))
  
  // ps_alwaysaccers: encode{var{sequence{sorted(serviceid, gas)}}}
  // Sort alwaysaccers by serviceId for deterministic encoding
  const sortedAlwaysAccers = state.alwaysaccers.slice()
  sortedAlwaysAccers.sort((a, b) => {
    if (a.serviceId < b.serviceId) return -1
    if (a.serviceId > b.serviceId) return 1
    return 0
  })
  
  // Manually encode dictionary: var{sequence{sorted(key, value)}}
  const alwaysAccerPairs: Uint8Array[] = []
  for (let i = 0; i < sortedAlwaysAccers.length; i++) {
    const entry = sortedAlwaysAccers[i]
    // Key: encode[4]{serviceid}
    const key = encodeFixedLength(u64(entry.serviceId), 4)
    // Value: encode[4]{gas} (4-byte fixed-length)
    const value = encodeFixedLength(entry.gas, 4)
    alwaysAccerPairs.push(concatBytes([key, value]))
  }
  const concatenatedAlwaysAccerPairs = concatBytes(alwaysAccerPairs)
  // Wrap with var{} discriminator
  parts.push(concatBytes([encodeNatural(u64(concatenatedAlwaysAccerPairs.length)), concatenatedAlwaysAccerPairs]))
  
  return concatBytes(parts)
}

/**
 * Encode Implications according to Gray Paper specification
 * 
 * Gray Paper pvm_invocations.tex equation 126-133:
 * implications ≡ tuple{
 *   im_id: serviceid,
 *   im_state: partialstate,
 *   im_nextfreeid: serviceid,
 *   im_xfers: defxfers,
 *   im_yield: optional<hash>,
 *   im_provisions: protoset<tuple{serviceid, blob}>
 * }
 * 
 * @param implications - Implications to encode
 * @param numCores - Number of cores (Ccorecount)
 * @param numValidators - Number of validators (Cvalcount)
 * @param authQueueSize - Authorization queue size (C_authqueuesize)
 * @returns Encoded octet sequence
 */
export function encodeImplications(
  implications: Implications,
  numCores: i32,
  numValidators: i32,
  authQueueSize: i32,
): Uint8Array {
  const parts: Uint8Array[] = []
  
  // im_id: encode[4]{serviceid} (4-byte fixed-length)
  parts.push(encodeFixedLength(u64(implications.id), 4))
  
  // im_state: encode{partialstate}
  parts.push(encodePartialState(implications.state, numCores, numValidators, authQueueSize))
  
  // im_nextfreeid: encode[4]{serviceid} (4-byte fixed-length)
  parts.push(encodeFixedLength(u64(implications.nextfreeid), 4))
  
  // im_xfers: encode{var{sequence{defxfer}}}
  parts.push(encodeVariableSequenceGeneric<DeferredTransfer>(
    implications.xfers,
    encodeDeferredTransfer,
  ))
  
  // im_yield: encode{maybe{hash}}
  // maybe{x} = {0 when x = none, ⟨1, x⟩ otherwise}
  // hash is 32 bytes
  parts.push(encodeOptional(
    implications.yield,
    (hash: Uint8Array) => hash, // Identity encoding for hash
  ))
  
  // im_provisions: encode{var{sequence{sorted(serviceid, blob)}}}
  // Sort provisions by serviceId for deterministic encoding
  const sortedProvisions = implications.provisions.slice()
  sortedProvisions.sort((a, b) => {
    if (a.serviceId < b.serviceId) return -1
    if (a.serviceId > b.serviceId) return 1
    return 0
  })
  
  // Each tuple is: encode[4]{serviceid} || encode{var{blob}}
  parts.push(encodeVariableSequenceGeneric<ProvisionEntry>(
    sortedProvisions,
    (entry: ProvisionEntry) => {
      const provisionParts: Uint8Array[] = []
      // encode[4]{serviceid}
      provisionParts.push(encodeFixedLength(u64(entry.serviceId), 4))
      // encode{var{blob}} = encode{len(blob)} || blob
      provisionParts.push(encodeNatural(u64(entry.blob.length)))
      provisionParts.push(entry.blob)
      return concatBytes(provisionParts)
    },
  ))
  
  return concatBytes(parts)
}

/**
 * Encode ImplicationsPair according to Gray Paper specification
 * 
 * Gray Paper: ImplicationsPair = implications × implications
 * encode{ImplicationsPair} = encode{Implications} || encode{Implications}
 * 
 * @param pair - ImplicationsPair to encode
 * @param numCores - Number of cores (Ccorecount)
 * @param numValidators - Number of validators (Cvalcount)
 * @param authQueueSize - Authorization queue size (C_authqueuesize)
 * @returns Encoded octet sequence
 */
export function encodeImplicationsPair(
  pair: ImplicationsPair,
  numCores: i32,
  numValidators: i32,
  authQueueSize: i32,
): Uint8Array {
  // Encode regular dimension (first element)
  const encodedRegular = encodeImplications(pair.regular, numCores, numValidators, authQueueSize)
  
  // Encode exceptional dimension (second element)
  const encodedExceptional = encodeImplications(pair.exceptional, numCores, numValidators, authQueueSize)
  
  // Concatenate: encode{regular} || encode{exceptional}
  return concatBytes([encodedRegular, encodedExceptional])
}

/**
 * Create service storage key according to Gray Paper specification.
 *
 * Gray Paper merklization.tex (lines 103-104):
 * ∀ ⟨s, sa⟩ ∈ accounts, ⟨k, v⟩ ∈ sa_storage:
 * C(s, encode[4]{2³²-1} ∥ k) ↦ v
 *
 * Storage keys use the pattern: C(s, encode[4]{0xFFFFFFFF} ∥ storage_key)
 * where s is the service ID and k is the storage key.
 *
 * This function handles two cases:
 * 1. Original storage key `k`: Computes blake(encode[4]{0xFFFFFFFF} || k) and uses first 27 bytes
 * 2. Already-hashed storage key (27 bytes): Uses the hash directly to construct the state key
 *
 * @param serviceId - Service account ID
 * @param storageKey - Storage key (either original blob `k` or 27-byte Blake hash `h`)
 * @returns 31-byte state key for service storage
 */
export function createServiceStorageKey(
  serviceId: u64,
  storageKey: Uint8Array,
): Uint8Array {
  // Check if storageKey is already a 27-byte Blake hash (from state loading)
  if (storageKey.length === 27) {
    // Storage key is already a Blake hash - use it directly to construct state key
    // C(s, h) where h is already blake(encode[4]{0xFFFFFFFF} || k)
    const key = new Uint8Array(31)
    const serviceUint8Array = encodeFixedLength(serviceId, 4)

    // Interleave: n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆
    key[0] = serviceUint8Array[0] // n₀
    key[1] = storageKey[0] // a₀
    key[2] = serviceUint8Array[1] // n₁
    key[3] = storageKey[1] // a₁
    key[4] = serviceUint8Array[2] // n₂
    key[5] = storageKey[2] // a₂
    key[6] = serviceUint8Array[3] // n₃
    key[7] = storageKey[3] // a₃
    // Remaining bytes: a₄, a₅, ..., a₂₆ (23 bytes)
    for (let i = 0; i < 23; i++) {
      key[8 + i] = storageKey[4 + i]
    }

    return key
  }

  // Storage key is the original key `k` - compute blake(encode[4]{0xFFFFFFFF} || k)
  // Create the prefix: encode[4]{2³²-1} = encode[4]{0xFFFFFFFF}
  const prefix = encodeFixedLength(0xffffffff, 4)

  // Concatenate prefix with storage key
  const combinedKey = new Uint8Array(prefix.length + storageKey.length)
  for (let i = 0; i < prefix.length; i++) {
    combinedKey[i] = prefix[i]
  }
  for (let i = 0; i < storageKey.length; i++) {
    combinedKey[prefix.length + i] = storageKey[i]
  }

  // Compute Blake hash and take first 27 bytes
  const blakeHashFull = blake2b256(combinedKey)
  const blakeHash = blakeHashFull.slice(0, 27)

  // Construct the state key by interleaving service ID with Blake hash
  const key = new Uint8Array(31)
  const serviceUint8Array = encodeFixedLength(serviceId, 4)

  key[0] = serviceUint8Array[0] // n₀
  key[1] = blakeHash[0] // a₀
  key[2] = serviceUint8Array[1] // n₁
  key[3] = blakeHash[1] // a₁
  key[4] = serviceUint8Array[2] // n₂
  key[5] = blakeHash[2] // a₂
  key[6] = serviceUint8Array[3] // n₃
  key[7] = blakeHash[3] // a₃
  for (let i = 0; i < 23; i++) {
    key[8 + i] = blakeHash[4 + i] // a₄...a₂₆
  }

  return key
}

/**
 * Create service preimage key according to Gray Paper specification.
 *
 * Gray Paper merklization.tex (lines 105-106):
 * ∀ ⟨s, sa⟩ ∈ accounts, ⟨h, p⟩ ∈ sa_preimages:
 * C(s, encode[4]{2³²-2} ∥ h) ↦ p
 *
 * Preimage keys use the pattern: C(s, encode[4]{0xFFFFFFFE} ∥ preimage_hash)
 * where s is the service ID and h is the preimage hash.
 *
 * This function handles two cases:
 * 1. Full preimage hash `h` (32 bytes): Computes blake(encode[4]{0xFFFFFFFE} || h) and uses first 27 bytes
 * 2. Already-hashed key (27 bytes): Uses the hash directly to construct the state key
 *
 * @param serviceId - Service account ID
 * @param preimageHash - Preimage hash (either full 32-byte hash or 27-byte Blake hash)
 * @returns 31-byte state key for service preimage
 */
export function createServicePreimageKey(
  serviceId: u64,
  preimageHash: Uint8Array,
): Uint8Array {
  // Check if preimageHash is already a 27-byte Blake hash (from state loading)
  if (preimageHash.length === 27) {
    // Preimage hash is already a Blake hash - use it directly to construct state key
    const key = new Uint8Array(31)
    const serviceUint8Array = encodeFixedLength(serviceId, 4)

    // Interleave: n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆
    key[0] = serviceUint8Array[0] // n₀
    key[1] = preimageHash[0] // a₀
    key[2] = serviceUint8Array[1] // n₁
    key[3] = preimageHash[1] // a₁
    key[4] = serviceUint8Array[2] // n₂
    key[5] = preimageHash[2] // a₂
    key[6] = serviceUint8Array[3] // n₃
    key[7] = preimageHash[3] // a₃
    for (let i = 0; i < 23; i++) {
      key[8 + i] = preimageHash[4 + i] // a₄...a₂₆
    }

    return key
  }

  // Preimage hash is the full 32-byte hash - compute blake(encode[4]{0xFFFFFFFE} || h)
  // Create the prefix: encode[4]{2³²-2} = encode[4]{0xFFFFFFFE}
  const prefix = encodeFixedLength(0xfffffffe, 4)

  // Concatenate prefix with preimage hash
  const combinedKey = new Uint8Array(prefix.length + preimageHash.length)
  for (let i = 0; i < prefix.length; i++) {
    combinedKey[i] = prefix[i]
  }
  for (let i = 0; i < preimageHash.length; i++) {
    combinedKey[prefix.length + i] = preimageHash[i]
  }

  // Compute Blake hash and take first 27 bytes
  const blakeHashFull = blake2b256(combinedKey)
  const blakeHash = blakeHashFull.slice(0, 27)

  // Construct the state key by interleaving service ID with Blake hash
  const key = new Uint8Array(31)
  const serviceUint8Array = encodeFixedLength(serviceId, 4)

  key[0] = serviceUint8Array[0] // n₀
  key[1] = blakeHash[0] // a₀
  key[2] = serviceUint8Array[1] // n₁
  key[3] = blakeHash[1] // a₁
  key[4] = serviceUint8Array[2] // n₂
  key[5] = blakeHash[2] // a₂
  key[6] = serviceUint8Array[3] // n₃
  key[7] = blakeHash[3] // a₃
  for (let i = 0; i < 23; i++) {
    key[8 + i] = blakeHash[4 + i] // a₄...a₂₆
  }

  return key
}

/**
 * Create service request key according to Gray Paper specification.
 *
 * Gray Paper merklization.tex (lines 107-110):
 * ∀ ⟨s, sa⟩ ∈ accounts, ⟨⟨h, l⟩, t⟩ ∈ sa_requests:
 * C(s, encode[4]{l} ∥ h) ↦ encode{var{sequence{encode[4]{x} | x ∈ t}}}
 *
 * Request keys use the pattern: C(s, encode[4]{length} ∥ request_hash)
 * where s is the service ID, l is the blob length, and h is the request hash.
 *
 * This function handles two cases:
 * 1. Full request hash `h` (32 bytes): Computes blake(encode[4]{l} || h) and uses first 27 bytes
 * 2. Already-hashed key (27 bytes): Uses the hash directly to construct the state key
 *
 * @param serviceId - Service account ID
 * @param requestHash - Request hash (either full 32-byte hash or 27-byte Blake hash)
 * @param length - Blob length
 * @returns 31-byte state key for service request
 */
export function createServiceRequestKey(
  serviceId: u64,
  requestHash: Uint8Array,
  length: u64,
): Uint8Array {
  // Check if requestHash is already a 27-byte Blake hash (from state loading)
  if (requestHash.length === 27) {
    // Request hash is already a Blake hash - use it directly to construct state key
    const key = new Uint8Array(31)
    const serviceUint8Array = encodeFixedLength(serviceId, 4)

    // Interleave: n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆
    key[0] = serviceUint8Array[0] // n₀
    key[1] = requestHash[0] // a₀
    key[2] = serviceUint8Array[1] // n₁
    key[3] = requestHash[1] // a₁
    key[4] = serviceUint8Array[2] // n₂
    key[5] = requestHash[2] // a₂
    key[6] = serviceUint8Array[3] // n₃
    key[7] = requestHash[3] // a₃
    for (let i = 0; i < 23; i++) {
      key[8 + i] = requestHash[4 + i] // a₄...a₂₆
    }

    return key
  }

  // Request hash is the full 32-byte hash - compute blake(encode[4]{l} || h)
  // Create the prefix: encode[4]{length}
  const prefix = encodeFixedLength(length, 4)

  // Concatenate prefix with request hash
  const combinedKey = new Uint8Array(prefix.length + requestHash.length)
  for (let i = 0; i < prefix.length; i++) {
    combinedKey[i] = prefix[i]
  }
  for (let i = 0; i < requestHash.length; i++) {
    combinedKey[prefix.length + i] = requestHash[i]
  }

  // Compute Blake hash and take first 27 bytes
  const blakeHashFull = blake2b256(combinedKey)
  const blakeHash = blakeHashFull.slice(0, 27)

  // Construct the state key by interleaving service ID with Blake hash
  const key = new Uint8Array(31)
  const serviceUint8Array = encodeFixedLength(serviceId, 4)

  key[0] = serviceUint8Array[0] // n₀
  key[1] = blakeHash[0] // a₀
  key[2] = serviceUint8Array[1] // n₁
  key[3] = blakeHash[1] // a₁
  key[4] = serviceUint8Array[2] // n₂
  key[5] = blakeHash[2] // a₂
  key[6] = serviceUint8Array[3] // n₃
  key[7] = blakeHash[3] // a₃
  for (let i = 0; i < 23; i++) {
    key[8 + i] = blakeHash[4 + i] // a₄...a₂₆
  }

  return key
}
