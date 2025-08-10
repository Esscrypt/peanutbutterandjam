/**
 * JAM ASN.1 Codec Implementation
 *
 * Implements JAM-specific ASN.1 encoding and decoding
 */

import { logger } from '@pbnj/core'
import type { CodecConfig, FormatCodec } from '@pbnj/types'

// ASN.1 Tag Classes
export enum Asn1TagClass {
  UNIVERSAL = 0x00,
  APPLICATION = 0x40,
  CONTEXT_SPECIFIC = 0x80,
  PRIVATE = 0xc0,
}

// ASN.1 Universal Tags
export enum Asn1UniversalTag {
  BOOLEAN = 0x01,
  INTEGER = 0x02,
  BIT_STRING = 0x03,
  OCTET_STRING = 0x04,
  NULL = 0x05,
  OBJECT_IDENTIFIER = 0x06,
  SEQUENCE = 0x10,
  SET = 0x11,
  PRINTABLE_STRING = 0x13,
  IA5_STRING = 0x16,
  UTC_TIME = 0x17,
  GENERALIZED_TIME = 0x18,
}

// ASN.1 Length Types
export enum Asn1LengthType {
  SHORT = 0x7f,
  LONG = 0x80,
}

// ASN.1 TLV (Tag-Length-Value) structure
export interface Asn1TLV {
  tag: number
  tagClass: Asn1TagClass
  isConstructed: boolean
  length: number
  value: Uint8Array
  children?: Asn1TLV[]
}

// JAM Protocol Types
export interface JamValidatorKeys {
  bandersnatch: Uint8Array // 32 bytes
  ed25519: Uint8Array // 32 bytes
}

export interface JamEpochMark {
  entropy: Uint8Array // 32 bytes
  ticketsEntropy: Uint8Array // 32 bytes
  validators: JamValidatorKeys[]
}

export interface JamHeader {
  parent: Uint8Array // 32 bytes
  parentStateRoot: Uint8Array // 32 bytes
  extrinsicHash: Uint8Array // 32 bytes
  slot: number // U32
  epochMark?: JamEpochMark
  ticketsMark?: Uint8Array[] // Optional
  offendersMark: Uint8Array[] // Ed25519Public[]
  authorIndex: number // U16
  entropySource: Uint8Array // BandersnatchVrfSignature (96 bytes)
  seal: Uint8Array // BandersnatchVrfSignature (96 bytes)
}

export interface JamBlock {
  header: JamHeader
  extrinsic: any // TODO: Define Extrinsic structure
}

/**
 * JAM ASN.1 Codec for JAM Protocol
 */
export class JamAsn1Codec<T> implements FormatCodec<T> {
  private config: CodecConfig

  constructor(config: CodecConfig) {
    this.config = config
    logger.debug('Initializing JAM ASN.1 Codec', { config })
  }

  /**
   * Encode data to ASN.1 format
   */
  encode(data: T): Uint8Array {
    const startTime = Date.now()

    logger.debug('Encoding data to JAM ASN.1 format', {
      config: this.config,
    })

    try {
      // Convert data to ASN.1 representation
      const asn1Data = this.dataToAsn1(data)

      // Encode to ASN.1 format
      const encoded = this.encodeAsn1(asn1Data)

      const encodingTime = Date.now() - startTime

      logger.debug('JAM ASN.1 encoding completed', {
        originalSize: this.getDataSize(data),
        encodedSize: encoded.length,
        encodingTime,
      })

      return encoded
    } catch (error) {
      logger.error('JAM ASN.1 encoding failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Decode data from ASN.1 format
   */
  decode(data: Uint8Array): T {
    const startTime = Date.now()

    logger.debug('Decoding data from JAM ASN.1 format', {
      dataSize: data.length,
    })

    try {
      // Decode from ASN.1 format
      const asn1Data = this.decodeAsn1(data)

      // Convert ASN.1 data back to original format
      const decoded = this.asn1ToData(asn1Data)

      const decodingTime = Date.now() - startTime

      logger.debug('JAM ASN.1 decoding completed', {
        encodedSize: data.length,
        decodedSize: this.getDataSize(decoded),
        decodingTime,
      })

      return decoded
    } catch (error) {
      logger.error('JAM ASN.1 decoding failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Validate data structure
   */
  validate(data: T): boolean {
    try {
      // Basic validation - check if data can be serialized
      const serialized = this.serializeData(data)
      return serialized.length > 0
    } catch {
      return false
    }
  }

  /**
   * Convert data to ASN.1 representation
   */
  private dataToAsn1(data: T): Asn1TLV {
    // For now, convert to a simple ASN.1 structure
    // This will be expanded based on the specific JAM types
    const jsonString = JSON.stringify(data, this.bigIntReplacer)
    const bytes = new TextEncoder().encode(jsonString)

    return {
      tag: Asn1UniversalTag.OCTET_STRING,
      tagClass: Asn1TagClass.UNIVERSAL,
      isConstructed: false,
      length: bytes.length,
      value: bytes,
    }
  }

  /**
   * Convert ASN.1 data back to original format
   */
  private asn1ToData(asn1Data: Asn1TLV): T {
    // For now, convert from simple ASN.1 structure
    // This will be expanded based on the specific JAM types
    const jsonString = new TextDecoder().decode(asn1Data.value)
    return JSON.parse(jsonString, this.bigIntReviver) as T
  }

  /**
   * Encode ASN.1 data to bytes
   */
  private encodeAsn1(asn1Data: Asn1TLV): Uint8Array {
    const result: number[] = []

    // Encode tag
    const tagByte =
      asn1Data.tagClass | (asn1Data.isConstructed ? 0x20 : 0x00) | asn1Data.tag
    result.push(tagByte)

    // Encode length
    if (asn1Data.length <= 127) {
      result.push(asn1Data.length)
    } else {
      const lengthBytes = this.intToBytes(asn1Data.length)
      result.push(0x80 | lengthBytes.length)
      result.push(...lengthBytes)
    }

    // Encode value
    result.push(...asn1Data.value)

    return new Uint8Array(result)
  }

  /**
   * Decode ASN.1 data from bytes
   */
  private decodeAsn1(data: Uint8Array): Asn1TLV {
    const decoder = new JamAsn1Decoder(data)
    return decoder.readTLV()
  }

  /**
   * Convert integer to bytes
   */
  private intToBytes(value: number): number[] {
    const bytes: number[] = []
    while (value > 0) {
      bytes.unshift(value & 0xff)
      value = value >> 8
    }
    return bytes.length > 0 ? bytes : [0]
  }

  /**
   * BigInt replacer for JSON serialization
   */
  private bigIntReplacer(_key: string, value: unknown): unknown {
    if (typeof value === 'bigint') {
      return value.toString()
    }
    return value
  }

  /**
   * BigInt reviver for JSON deserialization
   */
  private bigIntReviver(_key: string, value: unknown): unknown {
    if (typeof value === 'string' && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1))
    }
    return value
  }

  /**
   * Get data size
   */
  private getDataSize(data: T): number {
    return new TextEncoder().encode(JSON.stringify(data)).length
  }

  /**
   * Serialize data for validation
   */
  private serializeData(data: T): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(data))
  }
}

/**
 * ASN.1 Decoder for JAM Protocol
 */
export class JamAsn1Decoder {
  private data: Uint8Array
  private offset = 0

  constructor(data: Uint8Array) {
    this.data = data
  }

  /**
   * Decode a complete JAM block
   */
  decodeBlock(): JamBlock {
    const tlv = this.readTLV()

    if (tlv.tag !== Asn1UniversalTag.SEQUENCE) {
      throw new Error('Expected SEQUENCE for Block')
    }

    const children = this.decodeSequence(tlv.value)

    if (children.length < 2) {
      throw new Error('Block must have at least header and extrinsic')
    }

    return {
      header: this.decodeHeader(children[0]),
      extrinsic: children[1], // TODO: Implement extrinsic decoding
    }
  }

  /**
   * Decode a JAM header
   */
  decodeHeader(tlv: Asn1TLV): JamHeader {
    if (tlv.tag !== Asn1UniversalTag.SEQUENCE) {
      throw new Error('Expected SEQUENCE for Header')
    }

    const children = this.decodeSequence(tlv.value)

    if (children.length < 8) {
      throw new Error('Header must have at least 8 fields')
    }

    // Parse required fields
    const parent = this.decodeOctetString(children[0])
    const parentStateRoot = this.decodeOctetString(children[1])
    const extrinsicHash = this.decodeOctetString(children[2])
    const slot = this.decodeInteger(children[3])
    const authorIndex = this.decodeInteger(children[6])
    const entropySource = this.decodeOctetString(children[7])
    const seal = this.decodeOctetString(children[8])

    // Parse optional fields
    let epochMark: JamEpochMark | undefined
    let ticketsMark: Uint8Array[] | undefined
    const offendersMark: Uint8Array[] = []

    // Parse epoch mark if present
    if (children[4] && children[4].tag === Asn1UniversalTag.SEQUENCE) {
      epochMark = this.decodeEpochMark(children[4])
    }

    // Parse tickets mark if present
    if (children[5] && children[5].tag === Asn1UniversalTag.SEQUENCE) {
      ticketsMark = this.decodeSequence(children[5].value).map((child) =>
        this.decodeOctetString(child),
      )
    }

    // Parse offenders mark
    if (children[9] && children[9].tag === Asn1UniversalTag.SEQUENCE) {
      const offendersChildren = this.decodeSequence(children[9].value)
      for (const offender of offendersChildren) {
        offendersMark.push(this.decodeOctetString(offender))
      }
    }

    return {
      parent,
      parentStateRoot,
      extrinsicHash,
      slot,
      epochMark,
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
  decodeEpochMark(tlv: Asn1TLV): JamEpochMark {
    if (tlv.tag !== Asn1UniversalTag.SEQUENCE) {
      throw new Error('Expected SEQUENCE for EpochMark')
    }

    const children = this.decodeSequence(tlv.value)

    if (children.length < 3) {
      throw new Error('EpochMark must have at least 3 fields')
    }

    const entropy = this.decodeOctetString(children[0])
    const ticketsEntropy = this.decodeOctetString(children[1])

    // Parse validators
    const validators: JamValidatorKeys[] = []
    if (children[2] && children[2].tag === Asn1UniversalTag.SEQUENCE) {
      const validatorChildren = this.decodeSequence(children[2].value)
      for (const validator of validatorChildren) {
        validators.push(this.decodeValidatorKeys(validator))
      }
    }

    return {
      entropy,
      ticketsEntropy,
      validators,
    }
  }

  /**
   * Decode validator keys
   */
  decodeValidatorKeys(tlv: Asn1TLV): JamValidatorKeys {
    if (tlv.tag !== Asn1UniversalTag.SEQUENCE) {
      throw new Error('Expected SEQUENCE for ValidatorKeys')
    }

    const children = this.decodeSequence(tlv.value)

    if (children.length < 2) {
      throw new Error('ValidatorKeys must have at least 2 fields')
    }

    return {
      bandersnatch: this.decodeOctetString(children[0]),
      ed25519: this.decodeOctetString(children[1]),
    }
  }

  /**
   * Read a TLV (Tag-Length-Value) structure
   */
  readTLV(): Asn1TLV {
    if (this.offset >= this.data.length) {
      throw new Error('Unexpected end of data')
    }

    // Read tag
    const tagByte = this.data[this.offset++]
    const tagClass = tagByte & 0xc0
    const isConstructed = (tagByte & 0x20) !== 0
    const tag = tagByte & 0x1f

    // Read length
    const lengthByte = this.data[this.offset++]
    let length: number

    if (lengthByte <= Asn1LengthType.SHORT) {
      length = lengthByte
    } else {
      const numLengthBytes = lengthByte & 0x7f
      length = 0
      for (let i = 0; i < numLengthBytes; i++) {
        if (this.offset >= this.data.length) {
          throw new Error('Unexpected end of data while reading length')
        }
        length = (length << 8) | this.data[this.offset++]
      }
    }

    // Read value
    if (this.offset + length > this.data.length) {
      throw new Error('Value extends beyond data bounds')
    }

    const value = this.data.slice(this.offset, this.offset + length)
    this.offset += length

    return {
      tag,
      tagClass,
      isConstructed,
      length,
      value,
    }
  }

  /**
   * Decode a SEQUENCE
   */
  private decodeSequence(data: Uint8Array): Asn1TLV[] {
    const decoder = new JamAsn1Decoder(data)
    const children: Asn1TLV[] = []

    while (decoder.offset < data.length) {
      children.push(decoder.readTLV())
    }

    return children
  }

  /**
   * Decode an INTEGER
   */
  private decodeInteger(tlv: Asn1TLV): number {
    if (tlv.tag !== Asn1UniversalTag.INTEGER) {
      throw new Error('Expected INTEGER')
    }

    if (tlv.value.length === 0) {
      return 0
    }

    let value = 0
    for (let i = 0; i < tlv.value.length; i++) {
      value = (value << 8) | tlv.value[i]
    }

    return value
  }

  /**
   * Decode an OCTET STRING
   */
  private decodeOctetString(tlv: Asn1TLV): Uint8Array {
    if (tlv.tag !== Asn1UniversalTag.OCTET_STRING) {
      throw new Error('Expected OCTET STRING')
    }

    return tlv.value
  }

  /**
   * Get current offset
   */
  getOffset(): number {
    return this.offset
  }

  /**
   * Check if we've reached the end
   */
  isEOF(): boolean {
    return this.offset >= this.data.length
  }
}
