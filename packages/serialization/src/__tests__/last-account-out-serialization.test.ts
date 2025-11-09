import { describe, expect, it } from 'vitest'
import type { LastAccountOut } from '@pbnj/types'
import { decodeLastAccumulationOutputs, encodeLastAccumulationOutputs } from '../state/last-accumulation-outputs'

describe('LastAccountOut Serialization', () => {
  const mockLastAccountOut: LastAccountOut[] = [
    {
      serviceId: 1n,
      hash: '0x1111111111111111111111111111111111111111111111111111111111111111',
    },
    {
      serviceId: 2n,
      hash: '0x2222222222222222222222222222222222222222222222222222222222222222',
    },
    {
      serviceId: 100n,
      hash: '0x3333333333333333333333333333333333333333333333333333333333333333',
    },
  ]

  const mockLastAccountOutEmpty: LastAccountOut[] = []

  const mockLastAccountOutSingle: LastAccountOut[] = [
    {
      serviceId: 42n,
      hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    },
  ]

  it('should encode and decode last account out with multiple entries', () => {
    const [encodeError, encoded] = encodeLastAccumulationOutputs(mockLastAccountOut)
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()

    const [decodeError, decoded] = decodeLastAccumulationOutputs(encoded!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()

    // Verify the decoded structure
    expect(decoded!.value.length).toBe(3)
    
    // Verify first entry
    expect(decoded!.value[0].serviceId).toBe(1n)
    expect(decoded!.value[0].hash).toBe('0x1111111111111111111111111111111111111111111111111111111111111111')
    
    // Verify second entry
    expect(decoded!.value[1].serviceId).toBe(2n)
    expect(decoded!.value[1].hash).toBe('0x2222222222222222222222222222222222222222222222222222222222222222')
    
    // Verify third entry
    expect(decoded!.value[2].serviceId).toBe(100n)
    expect(decoded!.value[2].hash).toBe('0x3333333333333333333333333333333333333333333333333333333333333333')
  })

  it('should encode and decode empty last account out', () => {
    const [encodeError, encoded] = encodeLastAccumulationOutputs(mockLastAccountOutEmpty)
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()

    const [decodeError, decoded] = decodeLastAccumulationOutputs(encoded!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()

    expect(decoded!.value.length).toBe(0)
  })

  it('should encode and decode single entry', () => {
    const [encodeError, encoded] = encodeLastAccumulationOutputs(mockLastAccountOutSingle)
    expect(encodeError).toBeUndefined()
    expect(encoded).toBeDefined()

    const [decodeError, decoded] = decodeLastAccumulationOutputs(encoded!)
    expect(decodeError).toBeUndefined()
    expect(decoded).toBeDefined()

    expect(decoded!.value.length).toBe(1)
    expect(decoded!.value[0].serviceId).toBe(42n)
    expect(decoded!.value[0].hash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')
  })

  it('should handle realistic account output values', () => {
    const realisticLastAccountOut: LastAccountOut[] = [
      {
        serviceId: 0n,
        hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      },
      {
        serviceId: 4294967295n, // Max 32-bit value
        hash: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      },
    ]

    const [encodeError, encoded] = encodeLastAccumulationOutputs(realisticLastAccountOut)
    expect(encodeError).toBeUndefined()

    const [decodeError, decoded] = decodeLastAccumulationOutputs(encoded!)
    expect(decodeError).toBeUndefined()

    expect(decoded!.value.length).toBe(2)
    expect(decoded!.value[0].serviceId).toBe(0n)
    expect(decoded!.value[1].serviceId).toBe(4294967295n)
  })

  it('should fail with insufficient data for entry', () => {
    const insufficientData = new Uint8Array([1, 2, 3]) // Less than 36 bytes

    const [decodeError, decoded] = decodeLastAccumulationOutputs(insufficientData)
    expect(decodeError).toBeDefined()
    expect(decoded).toBeUndefined()
  })

  it('should handle large service IDs', () => {
    const largeServiceIdOut: LastAccountOut[] = [
      {
        serviceId: 2147483647n, // Max signed 32-bit value
        hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      },
    ]

    const [encodeError, encoded] = encodeLastAccumulationOutputs(largeServiceIdOut)
    expect(encodeError).toBeUndefined()

    const [decodeError, decoded] = decodeLastAccumulationOutputs(encoded!)
    expect(decodeError).toBeUndefined()

    expect(decoded!.value.length).toBe(1)
    expect(decoded!.value[0].serviceId).toBe(2147483647n)
  })

  it('should maintain round-trip compatibility', () => {
    const originalData: LastAccountOut[] = [
      { serviceId: 1n, hash: '0x1111111111111111111111111111111111111111111111111111111111111111' },
      { serviceId: 2n, hash: '0x2222222222222222222222222222222222222222222222222222222222222222' },
      { serviceId: 3n, hash: '0x3333333333333333333333333333333333333333333333333333333333333333' },
    ]

    const [encodeError, encoded] = encodeLastAccumulationOutputs(originalData)
    expect(encodeError).toBeUndefined()

    const [decodeError, decoded] = decodeLastAccumulationOutputs(encoded!)
    expect(decodeError).toBeUndefined()

    // Verify exact round-trip match
    expect(decoded!.value).toEqual(originalData)
  })
})
