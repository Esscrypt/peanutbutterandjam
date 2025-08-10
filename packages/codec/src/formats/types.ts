/**
 * Format-specific codec types
 */

import type { Uint8Array } from '@pbnj/core'

/**
 * Base interface for format-specific codecs
 */
export interface FormatCodec<T> {
  encode(data: T): Uint8Array
  decode(data: Uint8Array): T
  validate(data: T): boolean
}

/**
 * Base configuration interface
 */
export interface BaseConfig {
  /** Maximum data size in Uint8Array */
  maxDataSize: number
  /** Enable validation */
  enableValidation: boolean
  /** Enable compression */
  enableCompression: boolean
  /** Timeout in milliseconds */
  timeout: number
}

/**
 * Binary format configuration
 */
export interface BinaryConfig extends BaseConfig {
  /** Use little-endian byte order */
  littleEndian: boolean
  /** Include type information in binary data */
  includeTypeInfo: boolean
  /** Use compression for binary data */
  useCompression: boolean
}

/**
 * JSON format configuration
 */
export interface JsonConfig extends BaseConfig {
  /** Pretty print JSON output */
  prettyPrint: boolean
  /** Include null values in JSON */
  includeNulls: boolean
  /** Use custom replacer function */
  replacer?: (key: string, value: unknown) => unknown
  /** Use custom reviver function */
  reviver?: (key: string, value: unknown) => unknown
}

/**
 * ASN.1 format configuration
 */
export interface Asn1Config extends BaseConfig {
  /** ASN.1 schema definition */
  schema?: string
  /** Use BER encoding */
  useBER: boolean
  /** Use DER encoding */
  useDER: boolean
  /** Validate against ASN.1 schema */
  validateSchema: boolean
}

/**
 * Binary data structure
 */
export interface BinaryData {
  /** Data type identifier */
  type: string
  /** Data version */
  version: number
  /** Actual data */
  data: Uint8Array
  /** Checksum for data integrity */
  checksum: string
}

/**
 * JSON data structure
 */
export interface JsonData {
  /** Data type identifier */
  type: string
  /** Data version */
  version: number
  /** Actual data */
  data: unknown
  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * ASN.1 data structure
 */
export interface Asn1Data {
  /** ASN.1 tag */
  tag: number
  /** ASN.1 length */
  length: number
  /** ASN.1 value */
  value: Uint8Array
  /** ASN.1 constructed flag */
  constructed: boolean
}
