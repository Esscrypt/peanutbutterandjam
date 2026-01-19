import { describe, it, expect } from 'bun:test'
import { hexToBytes, bytesToHex } from '@pbnjam/core'
import { decodeNatural, encodeNatural } from '../core/natural-number'

describe('Hex Parse with Length', () => {
  it('should parse hex string with length prefix using JAM codec', () => {
    // Input hex string: 0xc63ee9132f8da544cc2c58ff83ad07f3
    const hexString = '0xc63ee9132f8da544cc2c58ff83ad07f3'
    
    // Convert hex to bytes
    const dataBytes = hexToBytes(hexString)
    expect(dataBytes.length).toBe(32) // 32 bytes = 64 hex characters / 2
    
    // Encode the length as a natural number (JAM variable-length encoding)
    const [lengthEncodeError, encodedLength] = encodeNatural(BigInt(dataBytes.length))
    expect(lengthEncodeError).toBeUndefined()
    expect(encodedLength).toBeDefined()
    
    // Create the full payload: length prefix + data
    const fullPayload = new Uint8Array(encodedLength!.length + dataBytes.length)
    fullPayload.set(encodedLength!, 0)
    fullPayload.set(dataBytes, encodedLength!.length)
    
    // Decode the length from the payload
    const [lengthDecodeError, lengthResult] = decodeNatural(fullPayload)
    expect(lengthDecodeError).toBeUndefined()
    expect(lengthResult).toBeDefined()
    expect(lengthResult!.value).toBe(BigInt(dataBytes.length))
    
    // Extract the remaining data (should be our original hex bytes)
    const remainingData = lengthResult!.remaining
    expect(remainingData.length).toBe(dataBytes.length)
    
    // Verify the extracted data matches the original
    const extractedHex = bytesToHex(remainingData)
    expect(extractedHex).toBe(hexString)
    
    // Verify the bytes match exactly
    expect(remainingData).toEqual(dataBytes)
    
    // Log the results for debugging
    console.log('Original hex:', hexString)
    console.log('Data length:', dataBytes.length, 'bytes')
    console.log('Encoded length bytes:', encodedLength!.length)
    console.log('Decoded length:', lengthResult!.value.toString())
    console.log('Extracted hex:', extractedHex)
    console.log('Total payload size:', fullPayload.length, 'bytes')
  })
})

