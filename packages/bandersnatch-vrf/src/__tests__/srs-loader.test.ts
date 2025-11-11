/**
 * Test SRS loader to verify file reading
 */

import { describe, expect, test } from 'bun:test'
import { loadSRSFromFile } from '../utils/srs-loader'
import { readFileSync } from 'node:fs'

describe('SRS Loader', () => {
  const srsFilePath =
    'packages/bandersnatch-vrf/test-data/srs/zcash-srs-2-11-compressed.bin'

  test('should load SRS file and read entire file', () => {
    const [error, result] = loadSRSFromFile(srsFilePath)

    expect(error).toBeUndefined()
    expect(result).toBeDefined()

    if (!result) {
      throw new Error('Result is null')
    }

    // Verify G1 points
    expect(result.g1Points.length).toBeGreaterThan(0)
    expect(result.g1.length).toBe(48) // Compressed G1 point size
    expect(result.g1Points[0]).toEqual(result.g1)

    // Verify G2 points
    expect(result.g2Points.length).toBeGreaterThan(0)
    expect(result.g2.length).toBe(96) // Compressed G2 point size
    expect(result.g2Points[0]).toEqual(result.g2)

    // Verify file was read completely
    const fileSize = readFileSync(srsFilePath).length
    const expectedSize =
      8 + // G1 length (u64)
      result.g1Points.length * 48 + // G1 points
      8 + // G2 length (u64)
      result.g2Points.length * 96 // G2 points

    console.log('File reading verification:', {
      fileSize,
      expectedSize,
      g1Points: result.g1Points.length,
      g2Points: result.g2Points.length,
      match: fileSize === expectedSize,
    })

    // The file should match exactly
    expect(fileSize).toBe(expectedSize)
  })

  test('should validate G1 points are valid compressed points', () => {
    const [error, result] = loadSRSFromFile(srsFilePath)

    expect(error).toBeUndefined()
    expect(result).toBeDefined()

    if (!result) {
      throw new Error('Result is null')
    }

    // All G1 points should be 48 bytes
    for (const point of result.g1Points) {
      expect(point.length).toBe(48)
    }
  })

  test('should validate G2 points are valid compressed points', () => {
    const [error, result] = loadSRSFromFile(srsFilePath)

    expect(error).toBeUndefined()
    expect(result).toBeDefined()

    if (!result) {
      throw new Error('Result is null')
    }

    // All G2 points should be 96 bytes
    for (const point of result.g2Points) {
      expect(point.length).toBe(96)
    }
  })
})

