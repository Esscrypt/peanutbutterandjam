import { describe, expect, it } from 'bun:test'
import { decodeTheTime, encodeTheTime } from '../state/the-time'

describe('TheTime Serialization', () => {
  it('should encode and decode the time with zero value', () => {
    const theTime = 0n

    const [encodeError, encoded] = encodeTheTime(theTime)
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()

    const [decodeError, decoded] = decodeTheTime(encoded!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()

    expect(decoded!.value).toBe(0n)
    expect(decoded!.consumed).toBe(4)
  })

  it('should encode and decode the time with small value', () => {
    const theTime = 12345n

    const [encodeError, encoded] = encodeTheTime(theTime)
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()

    const [decodeError, decoded] = decodeTheTime(encoded!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()

    expect(decoded!.value).toBe(12345n)
    expect(decoded!.consumed).toBe(4)
  })

  it('should encode and decode the time with realistic timestamp', () => {
    const theTime = 1700000000n // Realistic Unix timestamp

    const [encodeError, encoded] = encodeTheTime(theTime)
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()

    const [decodeError, decoded] = decodeTheTime(encoded!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()

    expect(decoded!.value).toBe(1700000000n)
    expect(decoded!.consumed).toBe(4)
  })

  it('should encode and decode the time with maximum 32-bit value', () => {
    const theTime = 4294967295n // Max 32-bit unsigned value

    const [encodeError, encoded] = encodeTheTime(theTime)
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()

    const [decodeError, decoded] = decodeTheTime(encoded!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()

    expect(decoded!.value).toBe(4294967295n)
    expect(decoded!.consumed).toBe(4)
  })

  it('should fail with insufficient data', () => {
    const insufficientData = new Uint8Array([1, 2, 3]) // Less than 4 bytes

    const [decodeError, decoded] = decodeTheTime(insufficientData)
    expect(decodeError).toBeDefined()
    expect(decoded).toBeUndefined()
  })

  it('should maintain round-trip compatibility', () => {
    const originalTime = 1234567890n

    const [encodeError, encoded] = encodeTheTime(originalTime)
    expect(encodeError).toBeUndefined()

    const [decodeError, decoded] = decodeTheTime(encoded!)
    expect(decodeError).toBeUndefined()

    expect(decoded!.value).toBe(originalTime)
  })

  it('should handle edge case values', () => {
    const edgeCases = [1n, 255n, 256n, 65535n, 65536n, 16777215n, 16777216n]

    for (const theTime of edgeCases) {
      const [encodeError, encoded] = encodeTheTime(theTime)
      expect(encodeError).toBeUndefined()

      const [decodeError, decoded] = decodeTheTime(encoded!)
      expect(decodeError).toBeUndefined()
      expect(decoded!.value).toBe(theTime)
    }
  })

  it('should verify little-endian encoding', () => {
    const theTime = 0x12345678n // Specific pattern to verify endianness

    const [encodeError, encoded] = encodeTheTime(theTime)
    expect(encodeError).toBeUndefined()

    // Verify little-endian byte order: 0x12345678 should be [0x78, 0x56, 0x34, 0x12]
    expect(encoded![0]).toBe(0x78)
    expect(encoded![1]).toBe(0x56)
    expect(encoded![2]).toBe(0x34)
    expect(encoded![3]).toBe(0x12)

    const [decodeError, decoded] = decodeTheTime(encoded!)
    expect(decodeError).toBeUndefined()
    expect(decoded!.value).toBe(theTime)
  })

  it('should handle remaining data correctly', () => {
    const theTime = 1000n
    const extraData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const combinedData = new Uint8Array([...new Uint8Array(4), ...extraData])

    // Manually encode the time into the first 4 bytes
    const view = new DataView(combinedData.buffer)
    view.setUint32(0, Number(theTime), true)

    const [decodeError, decoded] = decodeTheTime(combinedData)
    expect(decodeError).toBeUndefined()
    expect(decoded!.value).toBe(theTime)
    expect(decoded!.remaining).toEqual(extraData)
    expect(decoded!.consumed).toBe(4)
  })
})
