import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hexToBytes } from '@pbnj/core'
import {
  decodeProgram,
  decodeProgramFromPreimage,
  encodeProgram,
  encodeServiceCodeToPreimage,
} from '../pvm/blob'

/**
 * Round-trip test for encodeProgram and decodeProgram
 * 
 * Tests that encoding and decoding program blobs (Y function format) produces
 * identical results when using preimage blobs from jam-test-vectors.
 */
describe('Program Round-Trip Tests', () => {
  // Calculate workspace root
  const currentDir = dirname(fileURLToPath(import.meta.url))
  // packages/codec/src/__tests__ -> packages -> root
  const workspaceRoot = join(currentDir, '..', '..', '..', '..')

  /**
   * Load preimage blobs from test vectors JSON file
   * The JSON file contains pre_state.keyvals with key-value pairs
   * where values are preimage blobs as hex strings
   * 
   * Returns all preimage blobs found in the keyvals that can be decoded
   */
  function loadPreimageBlobs(jsonFilename: string): Uint8Array[] {
    const jsonPath = join(
      workspaceRoot,
      'submodules',
      'jam-test-vectors',
      'traces',
      'preimages',
      jsonFilename,
    )
    const jsonContent = readFileSync(jsonPath, 'utf-8')
    const testVector = JSON.parse(jsonContent)
    
    if (!testVector.pre_state || !testVector.pre_state.keyvals) {
      throw new Error(`Invalid test vector structure in ${jsonFilename}: missing pre_state.keyvals`)
    }
    
    const preimageBlobs: Uint8Array[] = []
    
    // Extract all preimage blobs from keyvals
    // Preimage blobs are stored in keyvals as hex strings
    for (const kv of testVector.pre_state.keyvals) {
      if (!kv.key || !kv.value) {
        continue
      }
      
      // Convert hex string to bytes
      try {
        const blob = hexToBytes(kv.value)
        // Only include blobs that are large enough to be preimages (at least 100 bytes)
        // and can be decoded as Y function format
        if (blob.length >= 100) {
          preimageBlobs.push(blob)
        }
      } catch (error) {
        throw new Error(
          `Failed to convert hex to bytes for key ${kv.key} in ${jsonFilename}: ${error}`,
        )
      }
    }
    
    if (preimageBlobs.length === 0) {
      throw new Error(`No preimage blobs found in ${jsonFilename}`)
    }
    
    return preimageBlobs
  }

  test('should round-trip encode/decode program from preimage blob', () => {
    // Load preimage blobs from test vectors JSON
    const preimageBlobs = loadPreimageBlobs('00000001.json')
    
    // Use the first preimage blob that can be decoded
    let originalPreimageBlob: Uint8Array | null = null
    let decodeError: Error | undefined = undefined
    
    for (const blob of preimageBlobs) {
      const [error] = decodeProgramFromPreimage(blob)
      if (!error) {
        originalPreimageBlob = blob
        break
      }
      decodeError = error
    }
    
    if (!originalPreimageBlob) {
      throw new Error(
        `No valid Y function format preimage found in 00000001.json. Last error: ${decodeError?.message}`,
      )
    }

    // Step 1: Decode the preimage to get metadata and program components
    const [decodeError2, decodeResult] = decodeProgramFromPreimage(
      originalPreimageBlob,
    )
    expect(decodeError2).toBeUndefined()
    expect(decodeResult).toBeDefined()

    const decoded = decodeResult!.value

    // Step 2: Encode the program components back (Y function format)
    const [encodeError, encodedProgram] = encodeProgram({
      roData: decoded.roData,
      rwData: decoded.rwData,
      heapZeroPaddingSize: decoded.heapZeroPaddingSize,
      stackSize: decoded.stackSize,
      code: decoded.code,
    })
    expect(encodeError).toBeUndefined()
    expect(encodedProgram).toBeDefined()

    // Step 3: Verify the encoded program is valid
    expect(encodedProgram!.length).toBeGreaterThan(0)

    // Step 4: Decode the encoded program to verify round-trip
    const [roundTripError, roundTripResult] = decodeProgram(encodedProgram!)
    expect(roundTripError).toBeUndefined()
    expect(roundTripResult).toBeDefined()

    const roundTrip = roundTripResult!.value

    // Verify all fields match
    expect(roundTrip.roDataLength).toBe(decoded.roDataLength)
    expect(roundTrip.rwDataLength).toBe(decoded.rwDataLength)
    expect(roundTrip.heapZeroPaddingSize).toBe(decoded.heapZeroPaddingSize)
    expect(roundTrip.stackSize).toBe(decoded.stackSize)
    expect(roundTrip.codeSize).toBe(decoded.codeSize)

    // Verify data sections match byte-by-byte
    expect(roundTrip.roData.length).toBe(decoded.roData.length)
    expect(roundTrip.rwData.length).toBe(decoded.rwData.length)
    expect(roundTrip.code.length).toBe(decoded.code.length)

    for (let i = 0; i < roundTrip.roData.length; i++) {
      expect(roundTrip.roData[i]).toBe(decoded.roData[i])
    }
    for (let i = 0; i < roundTrip.rwData.length; i++) {
      expect(roundTrip.rwData[i]).toBe(decoded.rwData[i])
    }
    for (let i = 0; i < roundTrip.code.length; i++) {
      expect(roundTrip.code[i]).toBe(decoded.code[i])
    }
  })

  test('should round-trip encode/decode full preimage blob', () => {
    // Load preimage blobs from test vectors JSON
    const preimageBlobs = loadPreimageBlobs('00000001.json')
    
    // Use the first preimage blob that can be decoded
    let originalPreimageBlob: Uint8Array | null = null
    let decodeError: Error | undefined = undefined
    
    for (const blob of preimageBlobs) {
      const [error] = decodeProgramFromPreimage(blob)
      if (!error) {
        originalPreimageBlob = blob
        break
      }
      decodeError = error
    }
    
    if (!originalPreimageBlob) {
      throw new Error(
        `No valid Y function format preimage found in 00000001.json. Last error: ${decodeError?.message}`,
      )
    }

    // Step 1: Decode the preimage to get metadata and program components
    const [decodeError2, decodeResult] = decodeProgramFromPreimage(
      originalPreimageBlob,
    )
    expect(decodeError2).toBeUndefined()
    expect(decodeResult).toBeDefined()

    const decoded = decodeResult!.value

    // Step 2: Encode the program components (Y function format)
    const [encodeError, encodedProgram] = encodeProgram({
      roData: decoded.roData,
      rwData: decoded.rwData,
      heapZeroPaddingSize: decoded.heapZeroPaddingSize,
      stackSize: decoded.stackSize,
      code: decoded.code,
    })
    expect(encodeError).toBeUndefined()
    expect(encodedProgram).toBeDefined()

    // Step 3: Encode the full preimage (metadata + program)
    const [preimageEncodeError, encodedPreimage] =
      encodeServiceCodeToPreimage(decoded.metadata, encodedProgram!)
    expect(preimageEncodeError).toBeUndefined()
    expect(encodedPreimage).toBeDefined()

    // Step 4: Decode the encoded preimage
    const [roundTripError, roundTripResult] = decodeProgramFromPreimage(
      encodedPreimage!,
    )
    expect(roundTripError).toBeUndefined()
    expect(roundTripResult).toBeDefined()

    const roundTrip = roundTripResult!.value

    // Verify metadata matches
    expect(roundTrip.metadata.length).toBe(decoded.metadata.length)
    for (let i = 0; i < roundTrip.metadata.length; i++) {
      expect(roundTrip.metadata[i]).toBe(decoded.metadata[i])
    }

    // Verify program components match
    expect(roundTrip.roDataLength).toBe(decoded.roDataLength)
    expect(roundTrip.rwDataLength).toBe(decoded.rwDataLength)
    expect(roundTrip.heapZeroPaddingSize).toBe(decoded.heapZeroPaddingSize)
    expect(roundTrip.stackSize).toBe(decoded.stackSize)
    expect(roundTrip.codeSize).toBe(decoded.codeSize)

    // Verify data sections match byte-by-byte
    expect(roundTrip.roData.length).toBe(decoded.roData.length)
    expect(roundTrip.rwData.length).toBe(decoded.rwData.length)
    expect(roundTrip.code.length).toBe(decoded.code.length)

    for (let i = 0; i < roundTrip.roData.length; i++) {
      expect(roundTrip.roData[i]).toBe(decoded.roData[i])
    }
    for (let i = 0; i < roundTrip.rwData.length; i++) {
      expect(roundTrip.rwData[i]).toBe(decoded.rwData[i])
    }
    for (let i = 0; i < roundTrip.code.length; i++) {
      expect(roundTrip.code[i]).toBe(decoded.code[i])
    }
  })

  test('should round-trip multiple preimage blobs', () => {
    const testFiles = [
      '00000001.json',
      '00000002.json',
      '00000003.json',
      '00000004.json',
      '00000005.json',
    ]

    for (const filename of testFiles) {
      // Load all preimage blobs from this JSON file
      const preimageBlobs = loadPreimageBlobs(filename)
      
      // Find the first preimage blob that can be decoded as Y function format
      let originalPreimageBlob: Uint8Array | null = null
      let decodeError: Error | undefined = undefined
      
      for (const blob of preimageBlobs) {
        const [error] = decodeProgramFromPreimage(blob)
        if (!error) {
          originalPreimageBlob = blob
          break
        }
        decodeError = error
      }
      
      // Fail if no valid preimage blob found
      if (!originalPreimageBlob) {
        throw new Error(
          `No valid Y function format preimage found in ${filename}. Last error: ${decodeError?.message}`,
        )
      }

      // Decode
      const [decodeError2, decodeResult] = decodeProgramFromPreimage(
        originalPreimageBlob,
      )
      
      // This should not fail since we already validated it above
      if (decodeError2) {
        throw new Error(
          `Failed to decode preimage from ${filename}: ${decodeError2.message}`,
        )
      }
      
      expect(decodeResult).toBeDefined()

      const decoded = decodeResult!.value

      // Encode program
      const [encodeError, encodedProgram] = encodeProgram({
        roData: decoded.roData,
        rwData: decoded.rwData,
        heapZeroPaddingSize: decoded.heapZeroPaddingSize,
        stackSize: decoded.stackSize,
        code: decoded.code,
      })
      expect(encodeError).toBeUndefined()
      expect(encodedProgram).toBeDefined()

      // Encode full preimage
      const [preimageEncodeError, encodedPreimage] =
        encodeServiceCodeToPreimage(decoded.metadata, encodedProgram!)
      expect(preimageEncodeError).toBeUndefined()
      expect(encodedPreimage).toBeDefined()

      // Decode again
      const [roundTripError, roundTripResult] = decodeProgramFromPreimage(
        encodedPreimage!,
      )
      expect(roundTripError).toBeUndefined()
      expect(roundTripResult).toBeDefined()

      const roundTrip = roundTripResult!.value

      // Verify metadata
      expect(roundTrip.metadata.length).toBe(decoded.metadata.length)
      for (let i = 0; i < roundTrip.metadata.length; i++) {
        expect(roundTrip.metadata[i]).toBe(decoded.metadata[i])
      }

      // Verify program components
      expect(roundTrip.roDataLength).toBe(decoded.roDataLength)
      expect(roundTrip.rwDataLength).toBe(decoded.rwDataLength)
      expect(roundTrip.heapZeroPaddingSize).toBe(decoded.heapZeroPaddingSize)
      expect(roundTrip.stackSize).toBe(decoded.stackSize)
      expect(roundTrip.codeSize).toBe(decoded.codeSize)

      // Verify data sections
      expect(roundTrip.roData.length).toBe(decoded.roData.length)
      expect(roundTrip.rwData.length).toBe(decoded.rwData.length)
      expect(roundTrip.code.length).toBe(decoded.code.length)

      for (let i = 0; i < roundTrip.roData.length; i++) {
        expect(roundTrip.roData[i]).toBe(decoded.roData[i])
      }
      for (let i = 0; i < roundTrip.rwData.length; i++) {
        expect(roundTrip.rwData[i]).toBe(decoded.rwData[i])
      }
      for (let i = 0; i < roundTrip.code.length; i++) {
        expect(roundTrip.code[i]).toBe(decoded.code[i])
      }
    }
  })
})
