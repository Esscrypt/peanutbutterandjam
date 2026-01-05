/**
 * ASN.1 Decoder for JAM Protocol
 *
 * Implements ASN.1 decoding for JAM protocol structures based on
 * the specification in jamtestvectors/lib/jam-types.asn
 */

import type { Extrinsic } from '@pbnjam/types'

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

export interface BlockHeader {
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
  header: BlockHeader
  extrinsic: Extrinsic
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
  // TODO: fix this
  // decodeBlock(): JamBlock {
  //   const tlv = this.readTLV()

  //   if (tlv.tag !== Asn1UniversalTag.SEQUENCE) {
  //     throw new Error('Expected SEQUENCE for Block')
  //   }

  //   const children = this.decodeSequence(tlv.value)

  //   if (children.length < 2) {
  //     throw new Error('Block must have at least header and extrinsic')
  //   }

  //   return {
  //     header: this.decodeHeader(children[0]),
  //     extrinsic: this.decodeExtrinsic(children[1]),
  //   }
  // }

  /**
   * Decode a JAM header
   */
  decodeHeader(tlv: Asn1TLV): BlockHeader {
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
  private readTLV(): Asn1TLV {
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
