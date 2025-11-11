import { describe, expect, it } from 'vitest'
import type { AccumulatedItem, IConfigService } from '@pbnj/types'
import { decodeAccumulated, encodeAccumulated } from '../state/accumulated'

// Mock config service with epochDuration = 12 for testing (matches 'tiny' config)
const mockConfigService: IConfigService = {
  epochDuration: 12,
  numValidators: 6,
  numCores: 2,
} as IConfigService

describe('Accumulated Serialization', () => {
  const mockAccumulated: AccumulatedItem[] = [
    { data: new Uint8Array([1, 2, 3, 4, 5]) },
    { data: new Uint8Array([10, 20, 30]) },
    { data: new Uint8Array([100, 200, 300, 400, 500, 600]) },
  ]

  const mockAccumulatedEmpty: AccumulatedItem[] = []

  const mockAccumulatedSingle: AccumulatedItem[] = [
    { data: new Uint8Array([255, 254, 253]) },
  ]

  it('should encode and decode accumulated with multiple items', () => {
    const [encodeError, encoded] = encodeAccumulated(
      mockAccumulated,
      mockConfigService,
    )
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()

    const [decodeError, decoded] = decodeAccumulated(
      encoded!,
      mockConfigService,
    )
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()

    // Verify the decoded structure
    expect(decoded!.value.length).toBe(3)
    
    // Verify first item
    expect(decoded!.value[0].data).toEqual(new Uint8Array([1, 2, 3, 4, 5]))
    
    // Verify second item
    expect(decoded!.value[1].data).toEqual(new Uint8Array([10, 20, 30]))
    
    // Verify third item
    expect(decoded!.value[2].data).toEqual(new Uint8Array([100, 200, 300, 400, 500, 600]))
  })

  it('should encode and decode empty accumulated', () => {
    const [encodeError, encoded] = encodeAccumulated(
      mockAccumulatedEmpty,
      mockConfigService,
    )
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()

    const [decodeError, decoded] = decodeAccumulated(
      encoded!,
      mockConfigService,
    )
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()

    expect(decoded!.value.length).toBe(0)
  })

  it('should encode and decode single item', () => {
    const [encodeError, encoded] = encodeAccumulated(
      mockAccumulatedSingle,
      mockConfigService,
    )
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()

    const [decodeError, decoded] = decodeAccumulated(
      encoded!,
      mockConfigService,
    )
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()

    expect(decoded!.value.length).toBe(1)
    expect(decoded!.value[0].data).toEqual(new Uint8Array([255, 254, 253]))
  })

  it('should handle realistic work-package data', () => {
    const realisticAccumulated: AccumulatedItem[] = [
      { 
        data: new Uint8Array([
          0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
          0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10,
        ])
      },
      { 
        data: new Uint8Array([
          0xff, 0xfe, 0xfd, 0xfc, 0xfb, 0xfa, 0xf9, 0xf8,
        ])
      },
    ]

    const [encodeError, encoded] = encodeAccumulated(
      realisticAccumulated,
      mockConfigService,
    )
    expect(encodeError).toBeUndefined()

    const [decodeError, decoded] = decodeAccumulated(
      encoded!,
      mockConfigService,
    )
    expect(decodeError).toBeUndefined()

    expect(decoded!.value.length).toBe(2)
    expect(decoded!.value[0].data.length).toBe(16)
    expect(decoded!.value[1].data.length).toBe(8)
  })

  it('should fail with insufficient data for natural number length prefix', () => {
    const insufficientData = new Uint8Array([]) // Empty data for natural number length

    const [decodeError, decoded] = decodeAccumulated(
      insufficientData,
      mockConfigService,
    )
    expect(decodeError).toBeDefined()
    expect(decoded).toBeUndefined()
  })

  it('should fail with insufficient data for item content', () => {
    // Natural number length prefix says 10 bytes, but only 5 bytes available
    const insufficientData = new Uint8Array([
      10, // Natural number: 10 (single byte encoding for values 1-127)
      1, 2, 3, 4, 5, // Only 5 bytes available
    ])

    const [decodeError, decoded] = decodeAccumulated(
      insufficientData,
      mockConfigService,
    )
    expect(decodeError).toBeDefined()
    expect(decoded).toBeUndefined()
  })

  it('should handle large accumulated items', () => {
    const largeData = new Uint8Array(1000)
    for (let i = 0; i < 1000; i++) {
      largeData[i] = i % 256
    }

    const largeAccumulated: AccumulatedItem[] = [
      { data: largeData },
      { data: new Uint8Array([1, 2, 3]) },
    ]

    const [encodeError, encoded] = encodeAccumulated(
      largeAccumulated,
      mockConfigService,
    )
    expect(encodeError).toBeUndefined()

    const [decodeError, decoded] = decodeAccumulated(
      encoded!,
      mockConfigService,
    )
    expect(decodeError).toBeUndefined()

    expect(decoded!.value.length).toBe(2)
    expect(decoded!.value[0].data.length).toBe(1000)
    expect(decoded!.value[1].data.length).toBe(3)
    
    // Verify first few bytes of large data
    expect(decoded!.value[0].data[0]).toBe(0)
    expect(decoded!.value[0].data[1]).toBe(1)
    expect(decoded!.value[0].data[255]).toBe(255)
  })

  it('should handle zero-length items', () => {
    const zeroLengthAccumulated: AccumulatedItem[] = [
      { data: new Uint8Array([]) },
      { data: new Uint8Array([1, 2, 3]) },
      { data: new Uint8Array([]) },
    ]

    const [encodeError, encoded] = encodeAccumulated(
      zeroLengthAccumulated,
      mockConfigService,
    )
    expect(encodeError).toBeUndefined()

    const [decodeError, decoded] = decodeAccumulated(
      encoded!,
      mockConfigService,
    )
    expect(decodeError).toBeUndefined()

    expect(decoded!.value.length).toBe(3)
    expect(decoded!.value[0].data.length).toBe(0)
    expect(decoded!.value[1].data.length).toBe(3)
    expect(decoded!.value[2].data.length).toBe(0)
  })
})
