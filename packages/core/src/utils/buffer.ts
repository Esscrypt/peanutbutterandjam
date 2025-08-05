/**
 * Buffer utilities for JAM Protocol
 *
 * Buffer manipulation and utility functions
 * Reference: Gray Paper buffer specifications
 */

import { bytesToBigInt, bytesToHex, type Hex, hexToBytes } from 'viem'
import type { Bytes } from '../types'

/**
 * Buffer utility functions
 */
export class BufferUtils {
  /**
   * Create a buffer from various input types
   */
  static from(input: string | number[] | Uint8Array | ArrayBuffer): Bytes {
    if (typeof input === 'string') {
      return Buffer.from(input, 'utf8')
    }
    if (Array.isArray(input)) {
      return Buffer.from(input)
    }
    if (input instanceof Uint8Array) {
      return Buffer.from(input)
    }
    if (input instanceof ArrayBuffer) {
      return Buffer.from(input)
    }
    throw new Error('Unsupported input type for buffer creation')
  }

  /**
   * Create a buffer filled with zeros
   */
  static zeros(length: number): Bytes {
    return Buffer.alloc(length, 0)
  }

  /**
   * Create a buffer filled with a specific value
   */
  static fill(length: number, value: number): Bytes {
    return Buffer.alloc(length, value)
  }

  /**
   * Concatenate multiple buffers
   */
  static concat(buffers: Bytes[]): Bytes {
    return Buffer.concat(buffers)
  }

  /**
   * Slice a buffer
   */
  static slice(buffer: Bytes, start?: number, end?: number): Bytes {
    return buffer.slice(start, end)
  }

  /**
   * Copy a buffer
   */
  static copy(
    source: Bytes,
    target: Bytes,
    targetStart?: number,
    sourceStart?: number,
    sourceEnd?: number,
  ): number {
    return (source as Buffer).copy(
      target as Buffer,
      targetStart,
      sourceStart,
      sourceEnd,
    )
  }

  /**
   * Compare two buffers
   */
  static compare(a: Bytes, b: Bytes): number {
    return Buffer.compare(a, b)
  }

  /**
   * Check if two buffers are equal
   */
  static equals(a: Bytes, b: Bytes): boolean {
    return Buffer.compare(a, b) === 0
  }

  /**
   * Get buffer length
   */
  static length(buffer: Bytes): number {
    return buffer.length
  }

  /**
   * Check if buffer is empty
   */
  static isEmpty(buffer: Bytes): boolean {
    return buffer.length === 0
  }

  /**
   * Convert buffer to hex string using viem
   */
  static toHex(buffer: Bytes): Hex {
    return bytesToHex(buffer)
  }

  /**
   * Convert buffer from hex string using viem
   */
  static fromHex(hex: Hex): Bytes {
    return Buffer.from(hexToBytes(hex))
  }

  /**
   * Convert buffer to BigInt using viem
   */
  static toBigInt(buffer: Bytes): bigint {
    return bytesToBigInt(buffer)
  }

  /**
   * Convert BigInt to buffer using viem
   */
  static fromBigInt(value: bigint): Bytes {
    const hex = value.toString(16) as Hex
    const bytes = hexToBytes(hex)
    return Buffer.from(bytes)
  }

  /**
   * Convert buffer to base64 string
   */
  static toBase64(buffer: Bytes): string {
    return (buffer as Buffer).toString('base64')
  }

  /**
   * Convert buffer from base64 string
   */
  static fromBase64(base64: string): Bytes {
    return Buffer.from(base64, 'base64')
  }

  /**
   * Convert buffer to UTF8 string
   */
  static toUtf8(buffer: Bytes): string {
    return (buffer as Buffer).toString('utf8')
  }

  /**
   * Convert buffer from UTF8 string
   */
  static fromUtf8(str: string): Bytes {
    return Buffer.from(str, 'utf8')
  }

  /**
   * Read unsigned 8-bit integer
   */
  static readUInt8(buffer: Bytes, offset: number): number {
    return (buffer as Buffer).readUInt8(offset)
  }

  /**
   * Write unsigned 8-bit integer
   */
  static writeUInt8(buffer: Bytes, value: number, offset: number): void {
    ;(buffer as Buffer).writeUInt8(value, offset)
  }

  /**
   * Read unsigned 16-bit integer (little-endian)
   */
  static readUInt16LE(buffer: Bytes, offset: number): number {
    return (buffer as Buffer).readUInt16LE(offset)
  }

  /**
   * Write unsigned 16-bit integer (little-endian)
   */
  static writeUInt16LE(buffer: Bytes, value: number, offset: number): void {
    ;(buffer as Buffer).writeUInt16LE(value, offset)
  }

  /**
   * Read unsigned 16-bit integer (big-endian)
   */
  static readUInt16BE(buffer: Bytes, offset: number): number {
    return (buffer as Buffer).readUInt16BE(offset)
  }

  /**
   * Write unsigned 16-bit integer (big-endian)
   */
  static writeUInt16BE(buffer: Bytes, value: number, offset: number): void {
    ;(buffer as Buffer).writeUInt16BE(value, offset)
  }

  /**
   * Read unsigned 32-bit integer (little-endian)
   */
  static readUInt32LE(buffer: Bytes, offset: number): number {
    return (buffer as Buffer).readUInt32LE(offset)
  }

  /**
   * Write unsigned 32-bit integer (little-endian)
   */
  static writeUInt32LE(buffer: Bytes, value: number, offset: number): void {
    ;(buffer as Buffer).writeUInt32LE(value, offset)
  }

  /**
   * Read unsigned 32-bit integer (big-endian)
   */
  static readUInt32BE(buffer: Bytes, offset: number): number {
    return (buffer as Buffer).readUInt32BE(offset)
  }

  /**
   * Write unsigned 32-bit integer (big-endian)
   */
  static writeUInt32BE(buffer: Bytes, value: number, offset: number): void {
    ;(buffer as Buffer).writeUInt32BE(value, offset)
  }

  /**
   * Read signed 8-bit integer
   */
  static readInt8(buffer: Bytes, offset: number): number {
    return (buffer as Buffer).readInt8(offset)
  }

  /**
   * Write signed 8-bit integer
   */
  static writeInt8(buffer: Bytes, value: number, offset: number): void {
    ;(buffer as Buffer).writeInt8(value, offset)
  }

  /**
   * Read signed 16-bit integer (little-endian)
   */
  static readInt16LE(buffer: Bytes, offset: number): number {
    return (buffer as Buffer).readInt16LE(offset)
  }

  /**
   * Write signed 16-bit integer (little-endian)
   */
  static writeInt16LE(buffer: Bytes, value: number, offset: number): void {
    ;(buffer as Buffer).writeInt16LE(value, offset)
  }

  /**
   * Read signed 16-bit integer (big-endian)
   */
  static readInt16BE(buffer: Bytes, offset: number): number {
    return (buffer as Buffer).readInt16BE(offset)
  }

  /**
   * Write signed 16-bit integer (big-endian)
   */
  static writeInt16BE(buffer: Bytes, value: number, offset: number): void {
    ;(buffer as Buffer).writeInt16BE(value, offset)
  }

  /**
   * Read signed 32-bit integer (little-endian)
   */
  static readInt32LE(buffer: Bytes, offset: number): number {
    return (buffer as Buffer).readInt32LE(offset)
  }

  /**
   * Write signed 32-bit integer (little-endian)
   */
  static writeInt32LE(buffer: Bytes, value: number, offset: number): void {
    ;(buffer as Buffer).writeInt32LE(value, offset)
  }

  /**
   * Read signed 32-bit integer (big-endian)
   */
  static readInt32BE(buffer: Bytes, offset: number): number {
    return (buffer as Buffer).readInt32BE(offset)
  }

  /**
   * Write signed 32-bit integer (big-endian)
   */
  static writeInt32BE(buffer: Bytes, value: number, offset: number): void {
    ;(buffer as Buffer).writeInt32BE(value, offset)
  }

  /**
   * Read 64-bit float (little-endian)
   */
  static readDoubleLE(buffer: Bytes, offset: number): number {
    return (buffer as Buffer).readDoubleLE(offset)
  }

  /**
   * Write 64-bit float (little-endian)
   */
  static writeDoubleLE(buffer: Bytes, value: number, offset: number): void {
    ;(buffer as Buffer).writeDoubleLE(value, offset)
  }

  /**
   * Read 64-bit float (big-endian)
   */
  static readDoubleBE(buffer: Bytes, offset: number): number {
    return (buffer as Buffer).readDoubleBE(offset)
  }

  /**
   * Write 64-bit float (big-endian)
   */
  static writeDoubleBE(buffer: Bytes, value: number, offset: number): void {
    ;(buffer as Buffer).writeDoubleBE(value, offset)
  }

  /**
   * Read 32-bit float (little-endian)
   */
  static readFloatLE(buffer: Bytes, offset: number): number {
    return (buffer as Buffer).readFloatLE(offset)
  }

  /**
   * Write 32-bit float (little-endian)
   */
  static writeFloatLE(buffer: Bytes, value: number, offset: number): void {
    ;(buffer as Buffer).writeFloatLE(value, offset)
  }

  /**
   * Read 32-bit float (big-endian)
   */
  static readFloatBE(buffer: Bytes, offset: number): number {
    return (buffer as Buffer).readFloatBE(offset)
  }

  /**
   * Write 32-bit float (big-endian)
   */
  static writeFloatBE(buffer: Bytes, value: number, offset: number): void {
    ;(buffer as Buffer).writeFloatBE(value, offset)
  }

  /**
   * Read variable-length integer (LEB128)
   */
  static readVarInt(
    buffer: Bytes,
    offset: number,
  ): { value: number; bytesRead: number } {
    let value = 0
    let shift = 0
    let bytesRead = 0

    while (bytesRead < 5) {
      const byte = (buffer as Buffer).readUInt8(offset + bytesRead)
      value |= (byte & 0x7f) << shift
      bytesRead++

      if ((byte & 0x80) === 0) {
        break
      }

      shift += 7
    }

    return { value, bytesRead }
  }

  /**
   * Write variable-length integer (LEB128)
   */
  static writeVarInt(buffer: Bytes, value: number, offset: number): number {
    let bytesWritten = 0

    while (value >= 0x80) {
      ;(buffer as Buffer).writeUInt8(
        (value & 0x7f) | 0x80,
        offset + bytesWritten,
      )
      value >>>= 7
      bytesWritten++
    }

    ;(buffer as Buffer).writeUInt8(value & 0x7f, offset + bytesWritten)
    bytesWritten++

    return bytesWritten
  }

  /**
   * Read string with length prefix
   */
  static readString(
    buffer: Bytes,
    offset: number,
  ): { value: string; bytesRead: number } {
    const lengthResult = BufferUtils.readVarInt(buffer, offset)
    const length = lengthResult.value
    const stringBuffer = buffer.slice(
      offset + lengthResult.bytesRead,
      offset + lengthResult.bytesRead + length,
    )
    const value = (stringBuffer as Buffer).toString('utf8')

    return {
      value,
      bytesRead: lengthResult.bytesRead + length,
    }
  }

  /**
   * Write string with length prefix
   */
  static writeString(buffer: Bytes, value: string, offset: number): number {
    const stringBuffer = Buffer.from(value, 'utf8')
    const lengthBytesWritten = BufferUtils.writeVarInt(
      buffer,
      stringBuffer.length,
      offset,
    )
    stringBuffer.copy(buffer as Buffer, offset + lengthBytesWritten)

    return lengthBytesWritten + stringBuffer.length
  }

  /**
   * Read bytes with length prefix
   */
  static readBytes(
    buffer: Bytes,
    offset: number,
  ): { value: Bytes; bytesRead: number } {
    // Ensure we have a Buffer instance
    const bufferInstance = Buffer.isBuffer(buffer)
      ? buffer
      : Buffer.from(buffer)

    // Read the length as a simple 4-byte integer for now
    const length = bufferInstance.readUInt32LE(offset)
    const value = bufferInstance.slice(offset + 4, offset + 4 + length)

    return {
      value,
      bytesRead: 4 + length,
    }
  }

  /**
   * Write bytes with length prefix
   */
  static writeBytes(buffer: Bytes, value: Bytes, offset: number): number {
    // Ensure we have a Buffer instance
    const bufferInstance = Buffer.isBuffer(buffer)
      ? buffer
      : Buffer.from(buffer)
    const valueInstance = Buffer.isBuffer(value) ? value : Buffer.from(value)

    // Write the length as a simple 4-byte integer for now
    bufferInstance.writeUInt32LE(valueInstance.length, offset)
    valueInstance.copy(bufferInstance, offset + 4)

    return 4 + valueInstance.length
  }
}

// Export individual functions for convenience
export const {
  from,
  zeros,
  fill,
  concat,
  slice,
  copy,
  compare,
  equals,
  length,
  isEmpty,
  toHex,
  fromHex,
  toBigInt,
  fromBigInt,
  toBase64,
  fromBase64,
  toUtf8,
  fromUtf8,
  readUInt8,
  writeUInt8,
  readUInt16LE,
  writeUInt16LE,
  readUInt16BE,
  writeUInt16BE,
  readUInt32LE,
  writeUInt32LE,
  readUInt32BE,
  writeUInt32BE,
  readInt8,
  writeInt8,
  readInt16LE,
  writeInt16LE,
  readInt16BE,
  writeInt16BE,
  readInt32LE,
  writeInt32LE,
  readInt32BE,
  writeInt32BE,
  readDoubleLE,
  writeDoubleLE,
  readDoubleBE,
  writeDoubleBE,
  readFloatLE,
  writeFloatLE,
  readFloatBE,
  writeFloatBE,
  readVarInt,
  writeVarInt,
  readString,
  writeString,
  readBytes,
  writeBytes,
} = BufferUtils
