/**
 * Encoding Utilities for JAM Protocol
 *
 * Encoding and decoding utilities for various formats
 * Reference: Gray Paper encoding specifications
 */

import type { Hex } from 'viem'
import type { Bytes } from '../types'
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
 * Encode bytes to hex string
 */
export function encodeHex(bytes: Bytes): Hex {
  return `0x${Buffer.from(bytes).toString('hex')}` as Hex
}

/**
 * Decode hex string to bytes
 */
export function decodeHex(hex: Hex): Bytes {
  return Buffer.from(hex.replace('0x', ''), 'hex')
}

/**
 * Encode bytes to base64 string
 */
export function encodeBase64(bytes: Bytes): string {
  return Buffer.from(bytes).toString('base64')
}

/**
 * Decode base64 string to bytes
 */
export function decodeBase64(base64: string): Bytes {
  return Buffer.from(base64, 'base64')
}

/**
 * Encode bytes to base58 string
 */
export function encodeBase58(bytes: Bytes): string {
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
 * Decode base58 string to bytes
 */
export function decodeBase58(base58: string): Bytes {
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
 * Encode bytes to UTF8 string
 */
export function encodeUtf8(bytes: Bytes): string {
  return Buffer.from(bytes).toString('utf8')
}

/**
 * Decode UTF8 string to bytes
 */
export function decodeUtf8(str: string): Bytes {
  return Buffer.from(str, 'utf8')
}

/**
 * Encode bytes to binary string
 */
export function encodeBinary(bytes: Bytes): string {
  return Buffer.from(bytes).toString('binary')
}

/**
 * Decode binary string to bytes
 */
export function decodeBinary(binary: string): Bytes {
  return Buffer.from(binary, 'binary')
}

/**
 * Generic encode function
 */
export function encode(bytes: Bytes, format: EncodingFormat): string {
  switch (format) {
    case EncodingFormat.HEX:
      return encodeHex(bytes)
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
export function decode(data: string, format: EncodingFormat): Bytes {
  switch (format) {
    case EncodingFormat.HEX:
      return decodeHex(data as Hex)
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
