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

/**
 * Convert hex string to bytes
 */
export function hexToBytes(hex: string): Uint8Array {
  // Remove 0x prefix if present
  if (hex.startsWith('0x')) {
    hex = hex.substring(2)
  }
  
  const length = hex.length / 2
  const bytes = new Uint8Array(length)
  
  for (let i = 0; i < length; i++) {
    const byteHex = hex.substring(i * 2, i * 2 + 2)
    bytes[i] = u8(Number.parseInt(byteHex, 16))
  }
  
  return bytes
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
  anchor: string // 32-byte hash (hex)
  state_root: string // 32-byte hash (hex)
  beefy_root: string // 32-byte hash (hex)
  lookup_anchor: string // 32-byte hash (hex)
  lookup_anchor_slot: u64 // 4-byte timeslot
  prerequisites: string[] // Array of 32-byte hashes (hex)
  
  constructor() {
    this.anchor = ''
    this.state_root = ''
    this.beefy_root = ''
    this.lookup_anchor = ''
    this.lookup_anchor_slot = 0
    this.prerequisites = []
  }
}

/**
 * Import segment structure
 */
export class ImportSegment {
  treeRoot: string // 32-byte hash (hex)
  index: u32 // Segment index (0-32767)
  isRefined: bool // Whether this is a refined hash
  
  constructor() {
    this.treeRoot = ''
    this.index = 0
    this.isRefined = false
  }
}

/**
 * Extrinsic reference structure
 */
export class ExtrinsicReference {
  hash: string // 32-byte hash (hex)
  length: u32 // 4-byte length
  
  constructor() {
    this.hash = ''
    this.length = 0
  }
}

/**
 * Work item structure
 */
export class WorkItem {
  serviceindex: u32
  codehash: string // 32-byte hash (hex)
  refgaslimit: u64
  accgaslimit: u64
  exportcount: u16
  payload: Uint8Array
  importsegments: ImportSegment[]
  extrinsics: ExtrinsicReference[]
  
  constructor() {
    this.serviceindex = 0
    this.codehash = ''
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
  authCodeHash: string // 32-byte hash (hex)
  context: RefineContext
  authToken: string // hex encoded
  authConfig: string // hex encoded
  workItems: WorkItem[]
  
  constructor() {
    this.authCodeHost = 0
    this.authCodeHash = ''
    this.context = new RefineContext()
    this.authToken = ''
    this.authConfig = ''
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
  parts.push(hexToBytes(context.anchor))
  
  // 2. State root (32 bytes)
  parts.push(hexToBytes(context.state_root))
  
  // 3. Beefy root (32 bytes)
  parts.push(hexToBytes(context.beefy_root))
  
  // 4. Lookup anchor (32 bytes)
  parts.push(hexToBytes(context.lookup_anchor))
  
  // 5. Lookup anchor slot - encode[4] (4 bytes, little-endian)
  parts.push(encodeFixedLength(context.lookup_anchor_slot, 4))
  
  // 6. Prerequisites - var{} encoding (length prefix + hashes)
  parts.push(encodeNatural(u64(context.prerequisites.length)))
  
  // Encode each prerequisite as 32-byte hash
  for (let i = 0; i < context.prerequisites.length; i++) {
    parts.push(hexToBytes(context.prerequisites[i]))
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
  parts.push(hexToBytes(importRef.treeRoot))
  
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
  parts.push(hexToBytes(extrinsicRef.hash))
  
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
  parts.push(hexToBytes(workItem.codehash))
  
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
  parts.push(hexToBytes(workItem.codehash))
  
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
  parts.push(hexToBytes(workPackage.authCodeHash))
  
  // 3. context - work context structure
  parts.push(encodeRefineContext(workPackage.context))
  
  // 4. var{authtoken} - variable-length auth token (hex to bytes)
  const authTokenBytes = hexToBytes(workPackage.authToken)
  parts.push(encodeNatural(u64(authTokenBytes.length)))
  parts.push(authTokenBytes)
  
  // 5. var{authconfig} - variable-length auth config (hex to bytes)
  const authConfigBytes = hexToBytes(workPackage.authConfig)
  parts.push(encodeNatural(u64(authConfigBytes.length)))
  parts.push(authConfigBytes)
  
  // 6. var{workitems} - variable-length work items
  parts.push(encodeNatural(u64(workPackage.workItems.length)))
  for (let i = 0; i < workPackage.workItems.length; i++) {
    parts.push(encodeWorkItem(workPackage.workItems[i]))
  }
  
  return concatBytes(parts)
}
