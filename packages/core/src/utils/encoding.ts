/**
 * Encoding Utilities for JAM Protocol
 *
 * Encoding and decoding utilities for various formats
 * Reference: Gray Paper encoding specifications
 */

import { bytesToHex, type Hex, hexToBytes } from 'viem'
import { isValidHex } from './crypto'

/**
 * Encoding formats supported by the protocol
 */
export enum EncodingFormat {
  HEX = 'hex',
  BASE64 = 'base64',
  BASE58 = 'base58',
  UTF8 = 'utf8',
  BINARY = 'binary',
}

/**
 * Encode Uint8Array to base64 string
 */
export function encodeBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

/**
 * Decode base64 string to Uint8Array
 */
export function decodeBase64(base64: string): Uint8Array {
  return Buffer.from(base64, 'base64')
}

/**
 * Encode Uint8Array to base58 string
 */
export function encodeBase58(bytes: Uint8Array): string {
  // Simple base58 implementation - in production, use a proper base58 library
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const base = alphabet.length

  let num = BigInt(`0x${Buffer.from(bytes).toString('hex')}`)
  let str = ''

  while (num > 0) {
    const remainder = Number(num % BigInt(base))
    str = alphabet[remainder] + str
    num = num / BigInt(base)
  }

  // Handle leading zeros
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    str = `1${str}`
  }

  return str
}

/**
 * Decode base58 string to Uint8Array
 */
export function decodeBase58(base58: string): Uint8Array {
  // Simple base58 implementation - in production, use a proper base58 library
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const base = alphabet.length

  let num = BigInt(0)
  let power = BigInt(1)

  for (let i = base58.length - 1; i >= 0; i--) {
    const char = base58[i]
    const value = alphabet.indexOf(char)
    if (value === -1) {
      throw new Error(`Invalid base58 character: ${char}`)
    }
    num += BigInt(value) * power
    power *= BigInt(base)
  }

  const hex = num.toString(16)
  const bytes = Buffer.from(
    hex.padStart(hex.length + (hex.length % 2), '0'),
    'hex',
  )

  // Handle leading zeros
  let leadingZeros = 0
  for (let i = 0; i < base58.length && base58[i] === '1'; i++) {
    leadingZeros++
  }

  const result = Buffer.alloc(leadingZeros + bytes.length)
  result.fill(0, 0, leadingZeros)
  bytes.copy(result, leadingZeros)

  return result
}

/**
 * Encode Uint8Array to UTF8 string
 */
export function encodeUtf8(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('utf8')
}

/**
 * Decode UTF8 string to Uint8Array
 */
export function decodeUtf8(str: string): Uint8Array {
  return Buffer.from(str, 'utf8')
}

/**
 * Encode Uint8Array to binary string
 */
export function encodeBinary(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('binary')
}

/**
 * Decode binary string to Uint8Array
 */
export function decodeBinary(binary: string): Uint8Array {
  return Buffer.from(binary, 'binary')
}

/**
 * Generic encode function
 */
export function encode(bytes: Uint8Array, format: EncodingFormat): string {
  switch (format) {
    case EncodingFormat.HEX:
      return bytesToHex(bytes)
    case EncodingFormat.BASE64:
      return encodeBase64(bytes)
    case EncodingFormat.BASE58:
      return encodeBase58(bytes)
    case EncodingFormat.UTF8:
      return encodeUtf8(bytes)
    case EncodingFormat.BINARY:
      return encodeBinary(bytes)
    default:
      throw new Error(`Unsupported encoding format: ${format}`)
  }
}

/**
 * Generic decode function
 */
export function decode(data: string, format: EncodingFormat): Uint8Array {
  switch (format) {
    case EncodingFormat.HEX:
      return hexToBytes(data as Hex)
    case EncodingFormat.BASE64:
      return decodeBase64(data)
    case EncodingFormat.BASE58:
      return decodeBase58(data)
    case EncodingFormat.UTF8:
      return decodeUtf8(data)
    case EncodingFormat.BINARY:
      return decodeBinary(data)
    default:
      throw new Error(`Unsupported encoding format: ${format}`)
  }
}

/**
 * Convert between encoding formats
 */
export function convertEncoding(
  data: string,
  fromFormat: EncodingFormat,
  toFormat: EncodingFormat,
): string {
  const bytes = decode(data, fromFormat)
  return encode(bytes, toFormat)
}

/**
 * Validate base64 string format
 */
export function isValidBase64(base64: string): boolean {
  try {
    decodeBase64(base64)
    return true
  } catch {
    return false
  }
}

/**
 * Validate base58 string format
 */
export function isValidBase58(base58: string): boolean {
  try {
    decodeBase58(base58)
    return true
  } catch {
    return false
  }
}

/**
 * Get encoding format from string (auto-detect)
 */
export function detectEncoding(data: string): EncodingFormat {
  if (isValidHex(data)) {
    return EncodingFormat.HEX
  }
  if (isValidBase64(data)) {
    return EncodingFormat.BASE64
  }
  if (isValidBase58(data)) {
    return EncodingFormat.BASE58
  }
  // Default to UTF8 for text-like data
  return EncodingFormat.UTF8
}
