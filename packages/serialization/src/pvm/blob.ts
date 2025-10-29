import { type Safe, safeError, safeResult } from '@pbnj/core'
import type {
  DecodedBlob,
  DecodingResult,
  RAM,
  RegisterState,
} from '@pbnj/types'
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
 * Decodes a PVM program blob according to Gray Paper Y function specification
 *
 * Gray Paper pvm.tex: Y function (Standard Program Initialization)
 *
 * Format: E₃(|o|) || E₃(|w|) || E₂(z) || E₃(s) || o || w || E₄(|c|) || c
 *
 * Where:
 * - E₃(|o|): Read-only data length (3 bytes, big-endian)
 * - E₃(|w|): Read-write data length (3 bytes, big-endian)
 * - E₂(z): Jump table entry size (2 bytes, big-endian)
 * - E₃(s): Stack size (3 bytes, big-endian)
 * - o: Read-only data section
 * - w: Read-write data section
 * - E₄(|c|): Instruction data length (4 bytes, big-endian)
 * - c: Instruction data
 *
 * @param programBlob - The program blob bytes
 * @returns Decoded program components or error if invalid
 */
export function decodeProgram(programBlob: Uint8Array): Safe<
  DecodingResult<{
    code: Uint8Array
    roData: Uint8Array
    rwData: Uint8Array
    stackSize: number
    jumpTableEntrySize: number
  }>
> {
  let offset = 0

  // Helper function to read big-endian numbers
  const readBE = (bytes: number): number => {
    if (offset + bytes > programBlob.length) {
      throw new Error(
        `Insufficient data: need ${bytes} bytes, have ${programBlob.length - offset}`,
      )
    }
    let value = 0
    for (let i = 0; i < bytes; i++) {
      value = (value << 8) | programBlob[offset + i]
    }
    offset += bytes
    return value
  }

  try {
    // 1. Decode E₃(|o|) - read-only data length (3 bytes)
    const roDataLength = readBE(3)

    // 2. Decode E₃(|w|) - read-write data length (3 bytes)
    const rwDataLength = readBE(3)

    // 3. Decode E₂(z) - jump table entry size (2 bytes)
    const jumpTableEntrySize = readBE(2)

    // 4. Decode E₃(s) - stack size (3 bytes)
    const stackSize = readBE(3)

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

    // 7. Decode E₄(|c|) - instruction data length (4 bytes)
    const codeLength = readBE(4)

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
        code,
        roData,
        rwData,
        stackSize,
        jumpTableEntrySize,
      },
      remaining: programBlob.slice(offset),
      consumed: offset,
    })
  } catch (error) {
    return safeError(
      error instanceof Error ? error : new Error('Unknown error'),
    )
  }
}
