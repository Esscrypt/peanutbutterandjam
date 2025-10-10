/**
 * Work Result Test Vectors - Round Trip Encoding/Decoding
 *
 * Tests the round-trip encoding/decoding of work result test vectors
 * against the Gray Paper specification.
 *
 * Test vectors:
 * - work_result_0.json: Success case with output data
 * - work_result_1.json: Panic case with no additional data
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { decodeWorkResult, encodeWorkResult } from '../work-package/work-result'
import type { WorkResult } from '@pbnj/types'
import { describe, it, expect } from 'vitest'

describe('Work Result Test Vectors - Round Trip Encoding/Decoding', () => {
  const testVectorsDir = join(
    __dirname,
    '../../../../submodules/jamtestvectors/codec/full',
  )

  describe('work_result_0 (Success Case)', () => {
    it('should handle work_result_0 round-trip encoding/decoding', () => {
      const binaryPath = join(testVectorsDir, 'work_result_0.bin')
      const jsonPath = join(testVectorsDir, 'work_result_0.json')

      // Read binary and JSON test data
      const binaryData = new Uint8Array(readFileSync(binaryPath))
      const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8')) as WorkResult

      // Decode the binary data
      const [error, decodedResult] = decodeWorkResult(binaryData)
      if (error) {
        throw error
      }

      // Verify structure matches JSON data
      expect(decodedResult.value.service_id).toBe(BigInt(jsonData.service_id))
      expect(decodedResult.value.code_hash).toBe(jsonData.code_hash)
      expect(decodedResult.value.payload_hash).toBe(jsonData.payload_hash)
      expect(decodedResult.value.accumulate_gas).toBe(BigInt(jsonData.accumulate_gas))
      expect(decodedResult.value.refine_load).toEqual({
        gas_used: BigInt(jsonData.refine_load.gas_used),
        imports: BigInt(jsonData.refine_load.imports),
        extrinsic_count: BigInt(jsonData.refine_load.extrinsic_count),
        extrinsic_size: BigInt(jsonData.refine_load.extrinsic_size),
        exports: BigInt(jsonData.refine_load.exports),
      })

      // Verify result structure (success case with discriminator 0)
      expect(decodedResult.value.result).toBe((jsonData.result as { ok: string }).ok)

      // Encode the decoded result back to binary
      const [encodeError, encodedData] = encodeWorkResult(decodedResult.value)
      if (encodeError) {
        throw encodeError
      }

      // Verify round-trip encoding matches original binary
      expect(encodedData.length).toBe(binaryData.length)
      expect(encodedData).toEqual(binaryData)
    })
  })

  describe('work_result_1 (Panic Case)', () => {
    it('should handle work_result_1 round-trip encoding/decoding', () => {
      const binaryPath = join(testVectorsDir, 'work_result_1.bin')
      const jsonPath = join(testVectorsDir, 'work_result_1.json')

      // Read binary and JSON test data
      const binaryData = new Uint8Array(readFileSync(binaryPath))
      const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8')) as WorkResult

      // Decode the binary data
      const [error, decodedResult] = decodeWorkResult(binaryData)
      if (error) {
        throw error
      }

      // Verify structure matches JSON data
      expect(decodedResult.value.service_id).toBe(BigInt(jsonData.service_id))
      expect(decodedResult.value.code_hash).toBe(jsonData.code_hash)
      expect(decodedResult.value.payload_hash).toBe(jsonData.payload_hash)
      expect(decodedResult.value.accumulate_gas).toBe(BigInt(jsonData.accumulate_gas))
      expect(decodedResult.value.refine_load).toEqual({
        gas_used: BigInt(jsonData.refine_load.gas_used),
        imports: BigInt(jsonData.refine_load.imports),
        extrinsic_count: BigInt(jsonData.refine_load.extrinsic_count),
        extrinsic_size: BigInt(jsonData.refine_load.extrinsic_size),
        exports: BigInt(jsonData.refine_load.exports),
      })

      // Verify result structure (panic case with discriminator 2)
      expect(decodedResult.value.result).toEqual(jsonData.result)

      // Encode the decoded result back to binary
      const [encodeError, encodedData] = encodeWorkResult(decodedResult.value)
      if (encodeError) {
        throw encodeError
      }

      // Verify round-trip encoding matches original binary
      expect(encodedData.length).toBe(binaryData.length)
      expect(encodedData).toEqual(binaryData)
    })
  })

  describe('Work Result Discriminated Union Encoding', () => {
    it('should correctly encode success result with discriminator 0', () => {
      const workResult: WorkResult = {
        service_id: 1n,
        code_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        payload_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        accumulate_gas: 0n,
        result: '0xaabbcc', // Hex string success result
        refine_load: {
          gas_used: 0n,
          imports: 0n,
          extrinsic_count: 0n,
          extrinsic_size: 0n,
          exports: 0n,
        },
      }

      const [error, encoded] = encodeWorkResult(workResult)
      if (error) {
        throw error
      }

      // Decode and verify
      const [decodeError, decoded] = decodeWorkResult(encoded)
      if (decodeError) {
        throw decodeError
      }

      expect(decoded.value.result).toBe('0xaabbcc')
    })

    it('should correctly encode panic result with discriminator 2', () => {
      const workResult: WorkResult = {
        service_id: 1n,
        code_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        payload_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        accumulate_gas: 0n,
        result: { panic: null }, // Panic result
        refine_load: {
          gas_used: 0n,
          imports: 0n,
          extrinsic_count: 0n,
          extrinsic_size: 0n,
          exports: 0n,
        },
      }

      const [error, encoded] = encodeWorkResult(workResult)
      if (error) {
        throw error
      }

      // Decode and verify
      const [decodeError, decoded] = decodeWorkResult(encoded)
      if (decodeError) {
        throw decodeError
      }

      expect(decoded.value.result).toEqual({ panic: null })
    })

    it('should correctly encode out of gas result with discriminator 1', () => {
      const workResult: WorkResult = {
        service_id: 1n,
        code_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        payload_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        accumulate_gas: 0n,
        result: 'out_of_gas', // Out of gas result
        refine_load: {
          gas_used: 0n,
          imports: 0n,
          extrinsic_count: 0n,
          extrinsic_size: 0n,
          exports: 0n,
        },
      }

      const [error, encoded] = encodeWorkResult(workResult)
      if (error) {
        throw error
      }

      // Decode and verify
      const [decodeError, decoded] = decodeWorkResult(encoded)
      if (decodeError) {
        throw decodeError
      }

      expect(decoded.value.result).toBe('out_of_gas')
    })

    it('should correctly encode bad exports result with discriminator 3', () => {
      const workResult: WorkResult = {
        service_id: 1n,
        code_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        payload_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        accumulate_gas: 0n,
        result: 'bad_exports', // Bad exports result
        refine_load: {
          gas_used: 0n,
          imports: 0n,
          extrinsic_count: 0n,
          extrinsic_size: 0n,
          exports: 0n,
        },
      }

      const [error, encoded] = encodeWorkResult(workResult)
      if (error) {
        throw error
      }

      // Decode and verify
      const [decodeError, decoded] = decodeWorkResult(encoded)
      if (decodeError) {
        throw decodeError
      }

      expect(decoded.value.result).toBe('bad_exports')
    })

    it('should correctly encode oversize result with discriminator 4', () => {
      const workResult: WorkResult = {
        service_id: 1n,
        code_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        payload_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        accumulate_gas: 0n,
        result: 'oversize', // Oversize result
        refine_load: {
          gas_used: 0n,
          imports: 0n,
          extrinsic_count: 0n,
          extrinsic_size: 0n,
          exports: 0n,
        },
      }

      const [error, encoded] = encodeWorkResult(workResult)
      if (error) {
        throw error
      }

      // Decode and verify
      const [decodeError, decoded] = decodeWorkResult(encoded)
      if (decodeError) {
        throw decodeError
      }

      expect(decoded.value.result).toBe('oversize')
    })

    it('should correctly encode bad code result with discriminator 5', () => {
      const workResult: WorkResult = {
        service_id: 1n,
        code_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        payload_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        accumulate_gas: 0n,
        result: 'bad_code', // Bad code result
        refine_load: {
          gas_used: 0n,
          imports: 0n,
          extrinsic_count: 0n,
          extrinsic_size: 0n,
          exports: 0n,
        },
      }

      const [error, encoded] = encodeWorkResult(workResult)
      if (error) {
        throw error
      }

      // Decode and verify
      const [decodeError, decoded] = decodeWorkResult(encoded)
      if (decodeError) {
        throw decodeError
      }

      expect(decoded.value.result).toBe('bad_code')
    })

    it('should correctly encode code oversize result with discriminator 6', () => {
      const workResult: WorkResult = {
        service_id: 1n,
        code_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        payload_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        accumulate_gas: 0n,
        result: 'code_oversize', // Code oversize result
        refine_load: {
          gas_used: 0n,
          imports: 0n,
          extrinsic_count: 0n,
          extrinsic_size: 0n,
          exports: 0n,
        },
      }

      const [error, encoded] = encodeWorkResult(workResult)
      if (error) {
        throw error
      }

      // Decode and verify
      const [decodeError, decoded] = decodeWorkResult(encoded)
      if (decodeError) {
        throw decodeError
      }

      expect(decoded.value.result).toBe('code_oversize')
    })
  })
})
