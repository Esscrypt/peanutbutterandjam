/**
 * PVM Codec Implementation (AssemblyScript)
 *
 * Implements Gray Paper codec functions for decoding program blobs
 * Gray Paper Reference: pvm.tex, serialization.tex
 */

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
 * @returns Encoded octet sequence
 */
export function encodeServiceAccount(account: ServiceAccountData): Uint8Array {
  const parts: Uint8Array[] = []

  // Gray Paper: 0 (placeholder discriminator)
  parts.push(encodeNaturalZero())

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
  const result = new Uint8Array(length)
  
  // Little-endian encoding
  for (let i = 0; i < length; i++) {
    result[i] = u8((value >> (i * 8)) & 0xff)
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
 * Gray Paper: encode(timeslot, serviceid, len(inputs))
 * - timeslot: encode[4]{thetime} (4 bytes) - merklization.tex C(11)
 * - serviceid: encode[4]{serviceid} (4 bytes) - work package/item patterns
 * - len(inputs): encodeNatural (variable) - sequence length pattern
 *
 * @param args - Encoded accumulate arguments
 * @returns Decoding result with timeslot, serviceId, and inputLength, or null if decoding fails
 */
export function decodeAccumulateArgs(
  args: Uint8Array,
): DecodingResult<DecodedAccumulateArgs> | null {
  if (args.length < 4) {
    return null
  }

  let offset: i32 = 0

  // 1. Decode timeslot (4 bytes fixed) - Gray Paper: encode[4]{thetime}
  const timeslotResult = decodeFixedLength(args.slice(offset), 4)
  if (!timeslotResult) {
    return null
  }
  const timeslot = timeslotResult.value
  offset += 4

  // 2. Decode service ID (4 bytes fixed) - Gray Paper: encode[4]{serviceid}
  if (offset + 4 > args.length) {
    return null
  }
  const serviceIdResult = decodeFixedLength(args.slice(offset), 4)
  if (!serviceIdResult) {
    return null
  }
  const serviceId = serviceIdResult.value
  offset += 4

  // 3. Decode input length (variable) - Gray Paper: encodeNatural pattern
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
 * Storage entry structure
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
 * Service Account Storage Map (simplified for AssemblyScript)
 */
export class ServiceAccountStorage {
  entries: Array<StorageEntry>
  
  constructor() {
    this.entries = new Array<StorageEntry>()
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
    this.entries.push(new StorageEntry(key, value))
  }
  
  get(key: Uint8Array): Uint8Array | null {
    for (let i = 0; i < this.entries.length; i++) {
      if (this.compareKeys(this.entries[i].key, key)) {
        return this.entries[i].value
      }
    }
    return null
  }
  
  private compareKeys(a: Uint8Array, b: Uint8Array): bool {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
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
 * Service Account Preimages Map (simplified for AssemblyScript)
 */
export class ServiceAccountPreimages {
  entries: Array<PreimageEntry>
  
  constructor() {
    this.entries = new Array<PreimageEntry>()
  }
  
  set(hash: Uint8Array, blob: Uint8Array): void {
    // Find existing entry
    for (let i = 0; i < this.entries.length; i++) {
      if (this.compareHashes(this.entries[i].hash, hash)) {
        this.entries[i].blob = blob
        return
      }
    }
    // Add new entry
    this.entries.push(new PreimageEntry(hash, blob))
  }
  
  get(hash: Uint8Array): Uint8Array | null {
    for (let i = 0; i < this.entries.length; i++) {
      if (this.compareHashes(this.entries[i].hash, hash)) {
        return this.entries[i].blob
      }
    }
    return null
  }
  
  private compareHashes(a: Uint8Array, b: Uint8Array): bool {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
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
 * Service Account Requests Map (simplified for AssemblyScript)
 */
export class ServiceAccountRequests {
  entries: Array<RequestEntry>
  
  constructor() {
    this.entries = new Array<RequestEntry>()
  }
  
  set(hash: Uint8Array, length: u64, status: PreimageRequestStatus): void {
    // Find existing entry
    for (let i = 0; i < this.entries.length; i++) {
      if (this.compareHashes(this.entries[i].hash, hash) && this.entries[i].length === length) {
        this.entries[i].status = status
        return
      }
    }
    // Add new entry
    this.entries.push(new RequestEntry(hash, length, status))
  }
  
  get(hash: Uint8Array, length: u64): PreimageRequestStatus | null {
    for (let i = 0; i < this.entries.length; i++) {
      if (this.compareHashes(this.entries[i].hash, hash) && this.entries[i].length === length) {
        return this.entries[i].status
      }
    }
    return null
  }
  
  private compareHashes(a: Uint8Array, b: Uint8Array): bool {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }
}

/**
 * Complete Service Account structure (AssemblyScript)
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
  storage: ServiceAccountStorage
  preimages: ServiceAccountPreimages
  requests: ServiceAccountRequests
  
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
    this.storage = new ServiceAccountStorage()
    this.preimages = new ServiceAccountPreimages()
    this.requests = new ServiceAccountRequests()
  }
}


/**
 * Decode complete ServiceAccount according to Gray Paper accounts.tex equation 12-27
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
  
  // sa_storage: decode{dictionary{blob}{blob}}
  // Manually decode dictionary with variable-length keys and values
  const storageVarResult = decodeVariableLength(currentData)
  if (!storageVarResult) {
    return null
  }
  const storagePairs = storageVarResult.value
  currentData = currentData.slice(storageVarResult.consumed)
  
  let storageData = storagePairs
  // Decode pairs until we've processed all bytes
  while (storageData.length > 0) {
    // Decode key: var{blob} = length prefix + blob
    const keyVarResult = decodeVariableLength(storageData)
    if (!keyVarResult) {
      break
    }
    const keyBytes = keyVarResult.value // Already the blob data (blob has identity encoding)
    storageData = storageData.slice(keyVarResult.consumed)
    
    // Decode value: var{blob} = length prefix + blob
    const valueVarResult = decodeVariableLength(storageData)
    if (!valueVarResult) {
      break
    }
    const storageValue = valueVarResult.value // Already the blob data (blob has identity encoding)
    storageData = storageData.slice(valueVarResult.consumed)
    
    account.storage.set(keyBytes, storageValue)
  }
  
  // sa_preimages: decode{dictionary{hash}{blob}}
  // Manually decode dictionary with variable-length values
  const preimagesVarResult = decodeVariableLength(currentData)
  if (!preimagesVarResult) {
    return null
  }
  const preimagesPairs = preimagesVarResult.value
  currentData = currentData.slice(preimagesVarResult.consumed)
  
  let preimagesData = preimagesPairs
  // Decode pairs until we've processed all bytes
  while (preimagesData.length > 0) {
    // Decode key: hash (32 bytes fixed)
    if (preimagesData.length < 32) {
      break
    }
    const preimageHash = preimagesData.slice(0, 32)
    preimagesData = preimagesData.slice(32)
    
    // Decode value: var{blob} = length prefix + blob
    const blobVarResult = decodeVariableLength(preimagesData)
    if (!blobVarResult) {
      break
    }
    const preimageBlob = blobVarResult.value // Already the blob data (blob has identity encoding)
    preimagesData = preimagesData.slice(blobVarResult.consumed)
    
    account.preimages.set(preimageHash, preimageBlob)
  }
  
  // sa_requests: decode{dictionary{tuple{hash, bloblength}}{sequence[:3]{timeslot}}}
  // Manually decode dictionary with variable-length values
  const requestsVarResult = decodeVariableLength(currentData)
  if (!requestsVarResult) {
    return null
  }
  const requestsPairs = requestsVarResult.value
  currentData = currentData.slice(requestsVarResult.consumed)
  
  let requestsData = requestsPairs
  // Decode pairs until we've processed all bytes
  while (requestsData.length > 0) {
    // Decode key: tuple{hash, bloblength} = hash (32 bytes) || encode[4]{length} (4 bytes)
    if (requestsData.length < 36) {
      break
    }
    const hashBytes = requestsData.slice(0, 32)
    
    const lengthResult = decodeFixedLength(requestsData.slice(32), 4)
    if (!lengthResult) {
      return null
    }
    const blobLength = lengthResult.value
    requestsData = requestsData.slice(36) // Consume key
    
    // Decode value: sequence[:3]{timeslot} = var{sequence{encode[4]{timeslot}}}
    // First decode the var{} prefix to get the length prefix bytes and element count
    const lengthPrefixResult = decodeNatural(requestsData)
    if (!lengthPrefixResult) {
      return null
    }
    const lengthPrefixBytes = requestsData.slice(0, lengthPrefixResult.consumed)
    const elementCount = i32(lengthPrefixResult.value)
    // Each timeslot is 4 bytes (encode[4]{timeslot})
    const elementSize = 4
    const totalValueLength = lengthPrefixResult.consumed + (elementCount * elementSize)
    if (requestsData.length < totalValueLength) {
      return null
    }
    const valueData = requestsData.slice(0, totalValueLength) // Includes length prefix
    requestsData = requestsData.slice(totalValueLength) // Consume value
    
    // Now decode the sequence from valueData (which includes the length prefix)
    const statusResult = decodeVariableSequence<u32>(
      valueData,
      (data: Uint8Array) => {
        const result = decodeFixedLength(data, 4)
        if (!result) {
          return null
        }
        return new DecodingResult<u32>(u32(result.value), 4)
      },
    )
    if (!statusResult) {
      return null
    }
    
    const status = new PreimageRequestStatus()
    const statusArray = statusResult.value
    for (let j = 0; j < statusArray.length; j++) {
      status.timeslots.push(statusArray[j])
    }
    
    account.requests.set(hashBytes, blobLength, status)
  }
  
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
  
  // Compute octets and items from storage
  let totalOctets: u64 = u64(0)
  for (let i = 0; i < account.storage.entries.length; i++) {
    totalOctets += u64(account.storage.entries[i].value.length)
  }
  account.octets = totalOctets
  account.items = account.storage.entries.length
  
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
  
  // Memo: DX_memo (variable-length octet sequence)
  const memoLengthResult = decodeNatural(currentData)
  if (!memoLengthResult) {
    return null
  }
  const memoLength = i32(memoLengthResult.value)
  const memoRemaining = currentData.slice(memoLengthResult.consumed)
  if (memoRemaining.length < memoLength) {
    return null
  }
  transfer.memo = memoRemaining.slice(0, memoLength)
  currentData = memoRemaining.slice(memoLength)
  
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
  
  // Memo: DX_memo (variable-length with length prefix)
  parts.push(encodeNatural(u64(transfer.memo.length)))
  parts.push(transfer.memo)
  
  // Gas: encode[8]{DX_gas} (8-byte fixed-length)
  parts.push(encodeFixedLength(transfer.gasLimit, 8))
  
  return concatBytes(parts)
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
  
  // sa_storage: encode{dictionary{blob}{blob}}
  // Sort storage entries by key for deterministic encoding
  const sortedStorage = account.storage.entries.slice()
  sortedStorage.sort((a, b) => {
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
  const storagePairs: Uint8Array[] = []
  for (let i = 0; i < sortedStorage.length; i++) {
    const entry = sortedStorage[i]
    // Key: encode{var{blob}} = encode{len(key)} || key (already Uint8Array)
    const key = concatBytes([encodeNatural(u64(entry.key.length)), entry.key])
    // Value: encode{var{blob}} = encode{len(value)} || value
    const value = concatBytes([encodeNatural(u64(entry.value.length)), entry.value])
    storagePairs.push(concatBytes([key, value]))
  }
  const concatenatedStoragePairs = concatBytes(storagePairs)
  // Wrap with var{} discriminator
  parts.push(concatBytes([encodeNatural(u64(concatenatedStoragePairs.length)), concatenatedStoragePairs]))
  
  // sa_preimages: encode{dictionary{hash}{blob}}
  // Sort preimage entries by hash for deterministic encoding
  const sortedPreimages = account.preimages.entries.slice()
  sortedPreimages.sort((a, b) => {
    // Compare Uint8Array hashes byte-by-byte
    const minLen = a.hash.length < b.hash.length ? a.hash.length : b.hash.length
    for (let i = 0; i < minLen; i++) {
      if (a.hash[i] < b.hash[i]) return -1
      if (a.hash[i] > b.hash[i]) return 1
    }
    if (a.hash.length < b.hash.length) return -1
    if (a.hash.length > b.hash.length) return 1
    return 0
  })
  
  // Manually encode dictionary: var{sequence{sorted(key, value)}}
  const preimagePairs: Uint8Array[] = []
  for (let i = 0; i < sortedPreimages.length; i++) {
    const entry = sortedPreimages[i]
    // Key: hash (32-byte fixed-length, already Uint8Array)
    const key = entry.hash
    // Value: encode{var{blob}} = encode{len(blob)} || blob
    const value = concatBytes([encodeNatural(u64(entry.blob.length)), entry.blob])
    preimagePairs.push(concatBytes([key, value]))
  }
  const concatenatedPreimagePairs = concatBytes(preimagePairs)
  // Wrap with var{} discriminator
  parts.push(concatBytes([encodeNatural(u64(concatenatedPreimagePairs.length)), concatenatedPreimagePairs]))
  
  // sa_requests: encode{dictionary{tuple{hash, bloblength}}{sequence[:3]{timeslot}}}
  // Sort request entries by hash+length for deterministic encoding
  const sortedRequests = account.requests.entries.slice()
  sortedRequests.sort((a, b) => {
    // Compare Uint8Array hashes byte-by-byte
    const minLen = a.hash.length < b.hash.length ? a.hash.length : b.hash.length
    for (let i = 0; i < minLen; i++) {
      if (a.hash[i] < b.hash[i]) return -1
      if (a.hash[i] > b.hash[i]) return 1
    }
    if (a.hash.length < b.hash.length) return -1
    if (a.hash.length > b.hash.length) return 1
    if (a.length < b.length) return -1
    if (a.length > b.length) return 1
    return 0
  })
  
  // Manually encode dictionary: var{sequence{sorted(key, value)}}
  const requestPairs: Uint8Array[] = []
  for (let i = 0; i < sortedRequests.length; i++) {
    const entry = sortedRequests[i]
    // Key: tuple{hash, bloblength} = hash (32 bytes, already Uint8Array) || encode[4]{length} (4 bytes)
    const hashBytes = entry.hash
    const lengthBytes = encodeFixedLength(entry.length, 4)
    const key = concatBytes([hashBytes, lengthBytes])
    // Value: sequence[:3]{timeslot} = var{sequence{encode[4]{timeslot}}}
    const timeslots = encodeVariableSequenceGeneric<u32>(
      entry.status.timeslots,
      (slot: u32) => encodeFixedLength(u64(slot), 4),
    )
    requestPairs.push(concatBytes([key, timeslots]))
  }
  const concatenatedRequestPairs = concatBytes(requestPairs)
  // Wrap with var{} discriminator
  parts.push(concatBytes([encodeNatural(u64(concatenatedRequestPairs.length)), concatenatedRequestPairs]))
  
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
