import { logger } from '@pbnj/core'
import type { Codec } from '@pbnj/types'

/**
 * JAM Custom Codec
 *
 * The JAM protocol uses a custom variable-length encoding format similar to SCALE
 * but with compact integer encoding. This is NOT standard ASN.1.
 */

export interface JamCodecConfig {
  debug?: boolean
}

export interface JamValidatorKeys {
  bandersnatch: Uint8Array
  ed25519: Uint8Array
}

export interface JamEpochMark {
  entropy: Uint8Array
  ticketsEntropy: Uint8Array
  validators: JamValidatorKeys[]
}

export interface BlockHeader {
  parent: Uint8Array
  parentStateRoot: Uint8Array
  extrinsicHash: Uint8Array
  slot: number
  epochMark?: JamEpochMark
  ticketsMark?: Uint8Array | null
  offendersMark: Uint8Array[]
  authorIndex: number
  entropySource: Uint8Array
  seal: Uint8Array
}

export interface JamBlock {
  header: BlockHeader
  extrinsics: Uint8Array[]
}

export class JamCodec<T> implements Codec<T> {
  private config: JamCodecConfig

  constructor(config: JamCodecConfig = {}) {
    this.config = config
    logger.debug('Initializing JAM Codec', { config })
  }

  encode(_data: T): Uint8Array {
    logger.debug('Encoding data to JAM format', { config: this.config })
    // TODO: Implement encoding
    throw new Error('Encoding not yet implemented')
  }

  decode(_data: Uint8Array): T {
    logger.debug('Decoding data from JAM format', { config: this.config })
    // TODO: Implement decoding
    throw new Error('Decoding not yet implemented')
  }

  validate(_data: T): {
    isValid: boolean
    errors: string[]
    warnings: string[]
  } {
    // TODO: Implement validation
    return { isValid: true, errors: [], warnings: [] }
  }
}

export class JamDecoder {
  private data: Uint8Array
  private offset = 0

  constructor(data: Uint8Array, _config: JamCodecConfig = {}) {
    this.data = data
  }

  /**
   * Read a compact integer (variable-length encoding)
   * Similar to SCALE encoding but with compact integer format
   */
  readCompactInt(): number {
    const firstByte = this.data[this.offset]
    this.offset++

    // Mode 0: single-byte (0-63)
    if ((firstByte & 0x80) === 0) {
      return firstByte
    }

    // Mode 1: two-byte (64-16383)
    if ((firstByte & 0xc0) === 0x80) {
      const secondByte = this.data[this.offset]
      this.offset++
      return ((firstByte & 0x3f) << 8) | secondByte
    }

    // Mode 2: four-byte (16384-1073741823)
    if ((firstByte & 0xe0) === 0xc0) {
      const bytes = this.data.slice(this.offset, this.offset + 3)
      this.offset += 3
      let value = (firstByte & 0x1f) << 24
      value |= bytes[0] << 16
      value |= bytes[1] << 8
      value |= bytes[2]
      return value
    }

    // Mode 3: big-integer (>= 1073741824)
    const length = firstByte & 0x03
    const bytes = this.data.slice(this.offset, this.offset + length)
    this.offset += length

    let value = 0
    for (let i = 0; i < bytes.length; i++) {
      value |= bytes[i] << (i * 8)
    }
    return value
  }

  /**
   * Read a fixed-length byte array
   */
  readBytes(length: number): Uint8Array {
    const bytes = this.data.slice(this.offset, this.offset + length)
    this.offset += length
    return bytes
  }

  /**
   * Read a variable-length byte array
   */
  readVariableBytes(): Uint8Array {
    const length = this.readCompactInt()
    return this.readBytes(length)
  }

  /**
   * Read a 32-byte hash
   */
  readHash(): Uint8Array {
    return this.readBytes(32)
  }

  /**
   * Read a boolean
   */
  readBoolean(): boolean {
    const byte = this.data[this.offset]
    this.offset++
    return byte !== 0
  }

  /**
   * Read an optional value
   */
  readOptional<T>(reader: () => T): T | null {
    const hasValue = this.readBoolean()
    if (hasValue) {
      return reader()
    }
    return null
  }

  /**
   * Read a vector (array) of values
   */
  readVector<T>(reader: () => T): T[] {
    const length = this.readCompactInt()
    const result: T[] = []
    for (let i = 0; i < length; i++) {
      result.push(reader())
    }
    return result
  }

  /**
   * Decode a JAM header
   */
  decodeHeader(): BlockHeader {
    // Read parent hash (32 bytes)
    const parent = this.readHash()

    // Read parent state root (32 bytes)
    const parentStateRoot = this.readHash()

    // Read extrinsic hash (32 bytes)
    const extrinsicHash = this.readHash()

    // Read slot number
    const slot = this.readCompactInt()

    // Read optional epoch mark
    const epochMark = this.readOptional(() => this.decodeEpochMark())

    // Read optional tickets mark
    const ticketsMark = this.readOptional(() => this.readHash())

    // Read offenders mark (vector of hashes)
    const offendersMark = this.readVector(() => this.readHash())

    // Read author index
    const authorIndex = this.readCompactInt()

    // Read entropy source (variable length)
    const entropySource = this.readVariableBytes()

    // Read seal (variable length)
    const seal = this.readVariableBytes()

    return {
      parent,
      parentStateRoot,
      extrinsicHash,
      slot,
      epochMark: epochMark || undefined,
      ticketsMark,
      offendersMark,
      authorIndex,
      entropySource,
      seal,
    }
  }

  /**
   * Decode an epoch mark
   */
  decodeEpochMark(): JamEpochMark {
    // Read entropy (32 bytes)
    const entropy = this.readHash()

    // Read tickets entropy (32 bytes)
    const ticketsEntropy = this.readHash()

    // Read validators vector
    const validators = this.readVector(() => this.decodeValidatorKeys())

    return {
      entropy,
      ticketsEntropy,
      validators,
    }
  }

  /**
   * Decode validator keys
   */
  decodeValidatorKeys(): JamValidatorKeys {
    // Read bandersnatch public key (32 bytes)
    const bandersnatch = this.readHash()

    // Read Ed25519 public key (32 bytes)
    const ed25519 = this.readHash()

    return {
      bandersnatch,
      ed25519,
    }
  }

  /**
   * Decode a complete block
   */
  decodeBlock(): JamBlock {
    // Read header
    const header = this.decodeHeader()

    // Read extrinsics vector
    const extrinsics = this.readVector(() => this.readVariableBytes())

    return {
      header,
      extrinsics,
    }
  }

  /**
   * Get current offset
   */
  getOffset(): number {
    return this.offset
  }

  /**
   * Check if we're at end of data
   */
  isEOF(): boolean {
    return this.offset >= this.data.length
  }

  /**
   * Skip remaining bytes
   */
  skipRemaining(): void {
    this.offset = this.data.length
  }
}
