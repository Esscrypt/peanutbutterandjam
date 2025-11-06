import type {
  DecodedBlob,
  DecodingResult,
  RAM,
  RegisterState,
  Safe,
} from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import { decodeNatural } from '../core/natural-number'

/**
 * Decoded standard program components (Gray Paper: Y function)
 *
 * Format: E₃(|o|) || E₃(|w|) || E₂(z) || E₃(s) || o || w || E₄(|c|) || c
 */
export interface StandardProgram {
  /** Instruction data (c) */
  code: Uint8Array
  /** Read-only data section (o) */
  roData: Uint8Array
  /** Read-write data section (w) */
  rwData: Uint8Array
  /** Stack size (s) */
  stackSize: number
  /** Jump table entry size (z) */
  jumpTableEntrySize: number
  /** Initial register state */
  registers: RegisterState
  /** Initial RAM state */
  ram: RAM
  /** Total header size (for PC offset calculations) */
  headerSize: number
}

/**
 * Decodes a PVM program blob according to Gray Paper specification
 *
 * Gray Paper pvm.tex: deblob function
 *
 * Format: p = encode(len(j)) ⊕ encode[1](z) ⊕ encode(len(c)) ⊕ encode[z](j) ⊕ encode(c) ⊕ encode(k)
 *
 * Where:
 * - encode(len(j)): Jump table length (natural number encoding)
 * - encode[1](z): Element size in jump table (1 byte)
 * - encode(len(c)): Code section length (natural number encoding)
 * - encode[z](j): Jump table data (each element is z bytes, big-endian)
 * - encode(c): Code data (instruction bytes)
 * - encode(k): Opcode bitmask (1 bit per byte of code, marking opcodes)
 *
 * For test vectors (simplified format without bitmask):
 * - Byte 0: len(j) (single byte, usually 0)
 * - Byte 1: z (single byte, usually 0)
 * - Byte 2: len(c) (single byte)
 * - Bytes 3+: Code data
 *
 * @param programBlob - The program blob bytes
 * @param isTestVector - If true, use simplified test vector format (no bitmask)
 * @returns Decoded blob components or null if invalid
 */
/**
 * Decode service code from preimage (strips metadata) then decode as deblob
 *
 * This is a convenience function that handles the full service code format:
 * metadata_prefix || deblob_format
 *
 * @param preimageBlob - The preimage blob bytes
 * @returns Decoded blob components (code, bitmask, jump table)
 */
export function decodeServiceCode(
  preimageBlob: Uint8Array,
): Safe<DecodingResult<DecodedBlob>> {
  // First, strip metadata prefix
  const [error, preimageResult] = decodeServiceCodeFromPreimage(preimageBlob)
  if (error) {
    return safeError(error)
  }

  // Then decode the code blob as deblob format
  return decodeBlob(preimageResult.value.codeBlob)
}

export function decodeBlob(
  programBlob: Uint8Array,
): Safe<DecodingResult<DecodedBlob>> {
  let offset = 0
  // Full Gray Paper format with natural number encoding

  // 1. Decode len(j) - jump table length
  const [error, jumpTableLengthResult] = decodeNatural(
    programBlob.slice(offset),
  )
  if (error) {
    return safeError(error)
  }
  const jumpTableLength = Number(jumpTableLengthResult.value)
  offset += jumpTableLengthResult.consumed

  // 2. Decode z - element size (1 byte)
  if (offset >= programBlob.length) {
    return safeError(new Error('Missing element size'))
  }
  const elementSize = programBlob[offset]
  offset += 1

  // 3. Decode len(c) - code length
  const [error2, codeLengthResult] = decodeNatural(programBlob.slice(offset))
  if (error2) {
    return safeError(error2)
  }
  const codeLength = Number(codeLengthResult.value)
  offset += codeLengthResult.consumed

  const headerSize = offset

  // 4. Decode jump table data
  const jumpTableSize = jumpTableLength * elementSize
  if (offset + jumpTableSize > programBlob.length) {
    return safeError(new Error('Missing jump table'))
  }

  const jumpTable: bigint[] = []
  for (let i = 0; i < jumpTableLength; i++) {
    const elementStart = offset + i * elementSize
    const elementBytes = programBlob.slice(
      elementStart,
      elementStart + elementSize,
    )
    // Decode as big-endian
    let value = 0n
    for (let j = 0; j < elementSize; j++) {
      value = (value << 8n) | BigInt(elementBytes[j])
    }
    jumpTable.push(value)
  }
  offset += jumpTableSize

  // 5. Extract code data
  if (offset + codeLength > programBlob.length) {
    return safeError(new Error('Missing code'))
  }
  const code = programBlob.slice(offset, offset + codeLength)
  offset += codeLength

  // 6. Extract bitmask according to Gray Paper specification
  // Gray Paper serialization.tex §Bit Sequence Encoding:
  // encode(b ∈ bitstring) ≡ {
  //   ⟨⟩ when b = ⟨⟩
  //   ⟨∑(i=0 to min(8, len(b))) b[i] * 2^i⟩ ∥ encode(b[8:]) otherwise
  // }
  // Bits are packed into octets in order of least significant to most.
  // Each bit position i corresponds to instruction data position i.
  if (offset >= programBlob.length) {
    return safeError(new Error('Missing bitmask'))
  }

  const remainingBytes = programBlob.length - offset
  const bitmask = new Uint8Array(codeLength)

  // Extract packed bitmask bytes and expand them according to Gray Paper formula
  let bitIndex = 0
  let byteIndex = 0

  while (bitIndex < codeLength && byteIndex < remainingBytes) {
    const packedByte = programBlob[offset + byteIndex]

    // Extract up to 8 bits from this packed byte
    for (let i = 0; i < 8 && bitIndex < codeLength; i++) {
      bitmask[bitIndex] = (packedByte >> i) & 1
      bitIndex++
    }
    byteIndex++
  }

  if (bitIndex < codeLength) {
    return safeError(
      new Error(
        `Insufficient bitmask data: need ${codeLength} bits, got ${bitIndex}`,
      ),
    )
  }

  return safeResult({
    value: {
      code,
      bitmask,
      jumpTable,
      elementSize,
      headerSize,
    },
    remaining: programBlob.slice(offset),
    consumed: offset,
  })
}

/**
 * Decode service code from preimage blob according to Gray Paper accounts.tex
 *
 * Gray Paper accounts.tex equation 42-43:
 * \encode{\var{\mathbf{m}}, \mathbf{c}} = \mathbf{a}_\sa¬preimages[\mathbf{a}_\sa¬codehash]
 *
 * Format: encode(len(m)) || encode(m) || encode(code_blob)
 *
 * Where:
 * - encode(len(m)): Variable-length natural number encoding of metadata length
 * - encode(m): Metadata blob
 * - encode(code_blob): Code blob (could be Y function format or deblob format)
 *
 * @param preimageBlob - The preimage blob bytes (includes metadata prefix)
 * @returns Decoded code blob, metadata, and remaining data
 */
export function decodeServiceCodeFromPreimage(preimageBlob: Uint8Array): Safe<
  DecodingResult<{
    metadata: Uint8Array
    codeBlob: Uint8Array
  }>
> {
  let offset = 0

  // 1. Decode metadata length
  const [error, metadataLengthResult] = decodeNatural(
    preimageBlob.slice(offset),
  )
  if (error) {
    return safeError(
      new Error(`Failed to decode metadata length: ${error.message}`),
    )
  }
  const metadataLength = Number(metadataLengthResult.value)
  offset += metadataLengthResult.consumed

  // 2. Extract metadata blob
  if (offset + metadataLength > preimageBlob.length) {
    return safeError(
      new Error(
        `Missing metadata: need ${metadataLength} bytes, have ${preimageBlob.length - offset}`,
      ),
    )
  }
  const metadata = preimageBlob.slice(offset, offset + metadataLength)
  offset += metadataLength

  // 3. Remaining data is the code blob (in deblob format)
  const codeBlob = preimageBlob.slice(offset)

  return safeResult({
    value: {
      metadata,
      codeBlob,
    },
    remaining: new Uint8Array(0), // All consumed
    consumed: preimageBlob.length,
  })
}

/**
 * Decodes a PVM program blob according to Gray Paper Y function specification
 *
 * Gray Paper pvm.tex: Y function (Standard Program Initialization)
 * Gray Paper serialization.tex: Fixed-length encodings use little-endian
 *
 * Format: E₃(|o|) || E₃(|w|) || E₂(z) || E₃(s) || o || w || E₄(|c|) || c
 *
 * Where:
 * - E₃(|o|): Read-only data length (3 bytes, little-endian)
 * - E₃(|w|): Read-write data length (3 bytes, little-endian)
 * - E₂(z): Jump table entry size (2 bytes, little-endian)
 * - E₃(s): Stack size (3 bytes, little-endian)
 * - o: Read-only data section
 * - w: Read-write data section
 * - E₄(|c|): Instruction data length (4 bytes, little-endian)
 * - c: Instruction data
 *
 * Gray Paper serialization.tex line 100: "Values are encoded in a regular
 * little-endian fashion. This is utilized for almost all integer encoding
 * across the protocol."
 *
 * @param programBlob - The program blob bytes
 * @returns Decoded program components or error if invalid
 */
export function decodeProgram(programBlob: Uint8Array): Safe<
  DecodingResult<{
    roDataLength: number
    rwDataLength: number
    jumpTableEntrySize: number
    stackSize: number
    roData: Uint8Array
    rwData: Uint8Array
    codeSize: number
    code: Uint8Array
  }>
> {
  let offset = 0

  // Helper function to read little-endian numbers
  // Gray Paper serialization.tex eq. 102-108: encode[l](x) = x mod 256 || encode[l-1](floor(x/256))
  const readLE = (bytes: number): number => {
    if (offset + bytes > programBlob.length) {
      throw new Error(
        `Insufficient data: need ${bytes} bytes, have ${programBlob.length - offset}`,
      )
    }
    let value = 0
    for (let i = 0; i < bytes; i++) {
      value |= programBlob[offset + i] << (i * 8)
    }
    offset += bytes
    return value
  }

  // 1. Decode E₃(|o|) - read-only data length (3 bytes, little-endian)
  const roDataLength = readLE(3)

  // 2. Decode E₃(|w|) - read-write data length (3 bytes, little-endian)
  const rwDataLength = readLE(3)

  // 3. Decode E₂(z) - jump table entry size (2 bytes, little-endian)
  const jumpTableEntrySize = readLE(2)

  // 4. Decode E₃(s) - stack size (3 bytes, little-endian)
  const stackSize = readLE(3)

  // 5. Extract read-only data section (o)
  if (offset + roDataLength > programBlob.length) {
    return safeError(
      new Error(`Missing read-only data: need ${roDataLength} bytes`),
    )
  }
  const roData = programBlob.slice(offset, offset + roDataLength)
  offset += roDataLength

  // 6. Extract read-write data section (w)
  if (offset + rwDataLength > programBlob.length) {
    return safeError(
      new Error(`Missing read-write data: need ${rwDataLength} bytes`),
    )
  }
  const rwData = programBlob.slice(offset, offset + rwDataLength)
  offset += rwDataLength

  // 7. Decode E₄(|c|) - instruction data length (4 bytes, little-endian)
  const codeLength = readLE(4)

  // 8. Extract instruction data (c)
  if (offset + codeLength > programBlob.length) {
    return safeError(
      new Error(`Missing instruction data: need ${codeLength} bytes`),
    )
  }
  const code = programBlob.slice(offset, offset + codeLength)
  offset += codeLength

  return safeResult({
    value: {
      roDataLength: roDataLength,
      rwDataLength: rwDataLength,
      jumpTableEntrySize: jumpTableEntrySize,
      stackSize: stackSize,
      roData,
      rwData,
      codeSize: codeLength,
      code,
    },
    remaining: programBlob.slice(offset),
    consumed: offset,
  })
}

/**
 * Decode service code from preimage blob as Y function format
 *
 * Gray Paper accounts.tex equation 42-43:
 * \encode{\var{\mathbf{m}}, \mathbf{c}} = \mathbf{a}_\sa¬preimages[\mathbf{a}_\sa¬codehash]
 *
 * After extracting metadata, the code blob c should be in Y function format:
 * E₃(|o|) || E₃(|w|) || E₂(z) || E₃(s) || o || w || E₄(|c|) || c
 *
 * @param preimageBlob - The preimage blob bytes (includes metadata prefix)
 * @returns Decoded metadata and Y function program components
 */
export function decodeProgramFromPreimage(preimageBlob: Uint8Array): Safe<
  DecodingResult<{
    metadata: Uint8Array
    roDataLength: number
    rwDataLength: number
    jumpTableEntrySize: number
    stackSize: number
    roData: Uint8Array
    rwData: Uint8Array
    codeSize: number
    code: Uint8Array
  }>
> {
  // First, extract metadata
  const [error, preimageResult] = decodeServiceCodeFromPreimage(preimageBlob)
  if (error) {
    return safeError(error)
  }

  // Then decode the code blob as Y function format
  const [programError, programResult] = decodeProgram(
    preimageResult.value.codeBlob,
  )
  if (programError) {
    return safeError(programError)
  }

  // Combine metadata and program results
  return safeResult({
    value: {
      metadata: preimageResult.value.metadata,
      roDataLength: programResult.value.roDataLength,
      rwDataLength: programResult.value.rwDataLength,
      jumpTableEntrySize: programResult.value.jumpTableEntrySize,
      stackSize: programResult.value.stackSize,
      roData: programResult.value.roData,
      rwData: programResult.value.rwData,
      codeSize: programResult.value.codeSize,
      code: programResult.value.code,
    },
    remaining: programResult.remaining,
    consumed:
      preimageResult.consumed -
      preimageResult.value.codeBlob.length +
      programResult.consumed,
  })
}
