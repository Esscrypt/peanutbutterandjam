/**
 * Work Item Test Vectors - Round Trip Encoding/Decoding
 *
 * Tests the round-trip encoding/decoding of work item test vectors
 * against the Gray Paper specification.
 *
 * Test vectors:
 * - work_item.json: Work item with service, code hash, gas limits, payload, import segments, and extrinsics
 * - work_item.bin: Corresponding binary encoding
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { decodeWorkItem, encodeWorkItem } from '../work-package/package'
import type { WorkItem } from '@pbnj/types'
import { describe, it, expect } from 'vitest'

describe('Work Item Test Vectors - Round Trip Encoding/Decoding', () => {
  const testVectorsDir = join(
    __dirname,
    '../../../../submodules/jamtestvectors/codec/full',
  )

  describe('work_item (Complete Work Item)', () => {
    it('should handle work_item round-trip encoding/decoding', () => {
      const binaryPath = join(testVectorsDir, 'work_item.bin')
      const jsonPath = join(testVectorsDir, 'work_item.json')

      // Read binary and JSON test data
      const binaryData = new Uint8Array(readFileSync(binaryPath))
      const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))

      // Convert JSON data to WorkItem type (numbers to BigInt)
      const workItem: WorkItem = {
        serviceindex: BigInt(jsonData.service),
        codehash: jsonData.code_hash,
        payload: jsonData.payload,
        refgaslimit: BigInt(jsonData.refine_gas_limit),
        accgaslimit: BigInt(jsonData.accumulate_gas_limit),
        exportcount: BigInt(jsonData.export_count),
        importsegments: jsonData.import_segments.map((seg: any) => ({
          treeRoot: seg.tree_root,
          index: seg.index,
        })),
        extrinsics: jsonData.extrinsic.map((ext: any) => ({
          hash: ext.hash,
          length: BigInt(ext.len),
        })),
      }

      // Decode the binary data
      const [error, decodedItem] = decodeWorkItem(binaryData)
      if (error) {
        throw error
      }

      // Verify structure matches JSON data
      expect(decodedItem.value.serviceindex).toBe(workItem.serviceindex)
      expect(decodedItem.value.codehash).toBe(workItem.codehash)
      expect(decodedItem.value.payload).toBe(workItem.payload)
      expect(decodedItem.value.refgaslimit).toBe(workItem.refgaslimit)
      expect(decodedItem.value.accgaslimit).toBe(workItem.accgaslimit)
      expect(decodedItem.value.exportcount).toBe(workItem.exportcount)

      // Verify import segments
      expect(decodedItem.value.importsegments).toHaveLength(workItem.importsegments.length)
      for (let i = 0; i < workItem.importsegments.length; i++) {
        expect(decodedItem.value.importsegments[i].treeRoot).toBe(
          workItem.importsegments[i].treeRoot,
        )
        expect(decodedItem.value.importsegments[i].index).toBe(
          workItem.importsegments[i].index,
        )
      }

      // Verify extrinsics
      expect(decodedItem.value.extrinsics).toHaveLength(workItem.extrinsics.length)
      for (let i = 0; i < workItem.extrinsics.length; i++) {
        expect(decodedItem.value.extrinsics[i].hash).toBe(workItem.extrinsics[i].hash)
        expect(decodedItem.value.extrinsics[i].length).toBe(workItem.extrinsics[i].length)
      }

      // Encode the decoded item back to binary
      const [encodeError, encodedData] = encodeWorkItem(decodedItem.value)
      if (encodeError) {
        throw encodeError
      }

      // Verify round-trip encoding matches original binary
      expect(encodedData.length).toBe(binaryData.length)
      expect(encodedData).toEqual(binaryData)
    })
  })

  describe('Work Item Individual Field Encoding', () => {
    it('should correctly encode work item with minimal data', () => {
      const workItem: WorkItem = {
        serviceindex: 1n,
        codehash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        payload: new Uint8Array(),
        refgaslimit: 0n,
        accgaslimit: 0n,
        exportcount: 0n,
        importsegments: [],
        extrinsics: [],
      }

      const [error, encoded] = encodeWorkItem(workItem)
      if (error) {
        throw error
      }

      // Decode and verify
      const [decodeError, decoded] = decodeWorkItem(encoded)
      if (decodeError) {
        throw decodeError
      }

      expect(decoded.value.serviceindex).toBe(1n)
      expect(decoded.value.codehash).toBe('0x0000000000000000000000000000000000000000000000000000000000000000')
      expect(decoded.value.payload).toEqual(new Uint8Array())
      expect(decoded.value.refgaslimit).toBe(0n)
      expect(decoded.value.accgaslimit).toBe(0n)
      expect(decoded.value.exportcount).toBe(0n)
      expect(decoded.value.importsegments).toHaveLength(0)
      expect(decoded.value.extrinsics).toHaveLength(0)
    })

    it('should correctly encode work item with import segments', () => {
      const workItem: WorkItem = {
        serviceindex: 1n,
        codehash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        payload: new Uint8Array([1, 2, 3]),
        refgaslimit: 1000n,
        accgaslimit: 2000n,
        exportcount: 1n,
        importsegments: [
          {
            treeRoot: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            index: 0,
          },
          {
            treeRoot: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
            index: 1,
          },
        ],
        extrinsics: [],
      }

      const [error, encoded] = encodeWorkItem(workItem)
      if (error) {
        throw error
      }

      // Decode and verify
      const [decodeError, decoded] = decodeWorkItem(encoded)
      if (decodeError) {
        throw decodeError
      }

      expect(decoded.value.importsegments).toHaveLength(2)
      expect(decoded.value.importsegments[0].treeRoot).toBe(
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      )
      expect(decoded.value.importsegments[0].index).toBe(0)
      expect(decoded.value.importsegments[1].treeRoot).toBe(
        '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
      )
      expect(decoded.value.importsegments[1].index).toBe(1)
    })

    it('should correctly encode work item with extrinsics', () => {
      const workItem: WorkItem = {
        serviceindex: 1n,
        codehash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        payload: new Uint8Array([1, 2, 3]),
        refgaslimit: 1000n,
        accgaslimit: 2000n,
        exportcount: 1n,
        importsegments: [],
        extrinsics: [
          {
            hash: '0x1111111111111111111111111111111111111111111111111111111111111111',
            length: 100n,
          },
          {
            hash: '0x2222222222222222222222222222222222222222222222222222222222222222',
            length: 200n,
          },
        ],
      }

      const [error, encoded] = encodeWorkItem(workItem)
      if (error) {
        throw error
      }

      // Decode and verify
      const [decodeError, decoded] = decodeWorkItem(encoded)
      if (decodeError) {
        throw decodeError
      }

      expect(decoded.value.extrinsics).toHaveLength(2)
      expect(decoded.value.extrinsics[0].hash).toBe(
        '0x1111111111111111111111111111111111111111111111111111111111111111',
      )
      expect(decoded.value.extrinsics[0].length).toBe(100n)
      expect(decoded.value.extrinsics[1].hash).toBe(
        '0x2222222222222222222222222222222222222222222222222222222222222222',
      )
      expect(decoded.value.extrinsics[1].length).toBe(200n)
    })
  })
})
