import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { decodeJamHeader, encodeJamHeader } from '../block/header'
import type { BlockHeader } from '@pbnj/types'
import { zeroHash } from '@pbnj/core'

describe('JAM Header Codec Tests', () => {
  const testVectorsDir = join(__dirname, '../../../../submodules/jamtestvectors/codec/full')
  
  it('should decode and encode header_0 correctly', () => {
    // Load the binary test vector
    const binaryPath = join(testVectorsDir, 'header_0.bin')
    const binaryData = readFileSync(binaryPath)
    
    // Load the expected JSON result
    const jsonPath = join(testVectorsDir, 'header_0.json')
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
    
    // Decode the binary data
    const [error, decodedHeader] = decodeJamHeader(binaryData)
    if (error) {
      throw error
    }
    
    // Verify the decoded header matches the JSON structure
    expect(decodedHeader.value.parent).toBe(jsonData.parent)
    expect(decodedHeader.value.priorStateRoot).toBe(jsonData.parent_state_root)
    expect(decodedHeader.value.extrinsicHash).toBe(jsonData.extrinsic_hash)
    expect(decodedHeader.value.timeslot).toBe(jsonData.timeslot)
    
    // Check epoch mark
    if (jsonData.epoch_mark) {
      expect(decodedHeader.value.epochMark).not.toBeNull()
      expect(decodedHeader.value.epochMark!.entropy1).toBe(jsonData.epoch_mark.entropy)
      expect(decodedHeader.value.epochMark!.entropyAccumulator).toBe(jsonData.epoch_mark.ticketsEntropy)
      expect(decodedHeader.value.epochMark!.validators).toHaveLength(jsonData.epoch_mark.validators.length)
      
      // Check first few validators to avoid testing all 1024
      for (let i = 0; i < Math.min(5, jsonData.epoch_mark.validators.length); i++) {
        expect(decodedHeader.value.epochMark!.validators[i].bandersnatch).toBe(jsonData.epoch_mark.validators[i].bandersnatch)
        expect(decodedHeader.value.epochMark!.validators[i].ed25519).toBe(jsonData.epoch_mark.validators[i].ed25519)
      }
    } else {
      expect(decodedHeader.value.epochMark).toBeNull()
    }
    
    // Check winners mark (should be null for header_0)
    expect(decodedHeader.value.winnersMark).toBeNull()
    
    // Check offenders mark (should be empty array for header_0) 
    expect(decodedHeader.value.offendersMark).toEqual([])
    
    // Encode the decoded header back to binary
    const encodedData = encodeJamHeader(decodedHeader.value)
    
    // Verify the encoded data matches the original binary
    expect(encodedData).toEqual(binaryData)
  })
  
  it('should handle round-trip encoding/decoding for simple header', () => {
    // Create a minimal test header
    const testHeader: BlockHeader = {
      parent: zeroHash,
      priorStateRoot: zeroHash,
      extrinsicHash: zeroHash,
      timeslot: 0n,
      epochMark: null,
      winnersMark: null,
      offendersMark: [],
      authorIndex: 0n,
      vrfSig: '0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      sealSig: '0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
    }
    
    // Encode the header
    const [error, encoded] = encodeJamHeader(testHeader)
    if (error) {
      throw error
    }
    
    // Decode the encoded data
    const [error2, decodedHeader] = decodeJamHeader(encoded)
    if (error2) {
      throw error2
    }
    
    // Verify round-trip consistency
    expect(decodedHeader.value.parent).toBe(testHeader.parent)
    expect(decodedHeader.value.priorStateRoot).toBe(testHeader.priorStateRoot)
    expect(decodedHeader.value.extrinsicHash).toBe(testHeader.extrinsicHash)
    expect(decodedHeader.value.timeslot).toBe(testHeader.timeslot)
    expect(decodedHeader.value.epochMark).toBe(testHeader.epochMark)
    expect(decodedHeader.value.winnersMark).toBe(testHeader.winnersMark)
    expect(decodedHeader.value.offendersMark).toEqual(testHeader.offendersMark)
    expect(decodedHeader.value.authorIndex).toBe(testHeader.authorIndex)
    expect(decodedHeader.value.vrfSig).toBe(testHeader.vrfSig)
    expect(decodedHeader.value.sealSig).toBe(testHeader.sealSig)
  })
  
  it('should handle header with epoch mark', () => {
    // Create a test header with epoch mark
    const testHeader: BlockHeader = {
      parent: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        priorStateRoot: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
      extrinsicHash: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      timeslot: 42n,
      epochMark: {
        entropyAccumulator: '0xae85d6635e9ae539d0846b911ec86a27fe000f619b78bcac8a74b77e36f6dbcf',
        entropy1: '0x333a7e328f0c4183f4b947e1d8f68aa4034f762e5ecdb5a7f6fbf0afea2fd8cd',
        validators: [
          {
            bandersnatch: '0xff71c6c03ff88adb5ed52c9681de1629a54e702fc14729f6b50d2f0a76f185b3',
            ed25519: '0x4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace'
          },
          {
            bandersnatch: '0xdee6d555b82024f1ccf8a1e37e60fa60fd40b1958c4bb3006af78647950e1b91',
            ed25519: '0xad93247bd01307550ec7acd757ce6fb805fcf73db364063265b30a949e90d933'
          }
        ]
      },
      winnersMark: null,
      offendersMark: [],
      authorIndex: 1n,
      vrfSig: '0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
      sealSig: '0x222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222'
    }
    
    // Encode the header
    const [error, encoded] = encodeJamHeader(testHeader)
    if (error) {
      throw error
    }
    
    // Decode the encoded data
    const [error2, decodedHeader] = decodeJamHeader(encoded)
    if (error2) {
      throw error2
    }
    
    // Verify round-trip consistency
    expect(decodedHeader.value.parent).toBe(testHeader.parent)
    expect(decodedHeader.value.priorStateRoot).toBe(testHeader.priorStateRoot)
    expect(decodedHeader.value.extrinsicHash).toBe(testHeader.extrinsicHash)
    expect(decodedHeader.value.timeslot).toBe(testHeader.timeslot)
    
    // Check epoch mark
    expect(decodedHeader.value.epochMark).not.toBeNull()
    expect(decodedHeader.value.epochMark!.entropy1).toBe(testHeader.epochMark!.entropy1)
    expect(decodedHeader.value.epochMark!.entropyAccumulator).toBe(testHeader.epochMark!.entropyAccumulator)
    expect(decodedHeader.value.epochMark!.validators).toHaveLength(testHeader.epochMark!.validators.length)
    
    for (let i = 0; i < testHeader.epochMark!.validators.length; i++) {
      expect(decodedHeader.value.epochMark!.validators[i].bandersnatch).toBe(testHeader.epochMark!.validators[i].bandersnatch)
      expect(decodedHeader.value.epochMark!.validators[i].ed25519).toBe(testHeader.epochMark!.validators[i].ed25519)
    }
    
    expect(decodedHeader.value.winnersMark).toBe(testHeader.winnersMark)
    expect(decodedHeader.value.offendersMark).toEqual(testHeader.offendersMark)
    expect(decodedHeader.value.authorIndex).toBe(testHeader.authorIndex)
    expect(decodedHeader.value.vrfSig).toBe(testHeader.vrfSig)
    expect(decodedHeader.value.sealSig).toBe(testHeader.sealSig)
  })
  
  it('should handle header with offenders', () => {
    // Create a test header with offenders
    const testHeader: BlockHeader = {
      parent: '0x1111111111111111111111111111111111111111111111111111111111111111',
      priorStateRoot: '0x2222222222222222222222222222222222222222222222222222222222222222',
      extrinsicHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
      timeslot: 100n,
      epochMark: null,
      winnersMark: null,
      offendersMark: [
        '0x4444444444444444444444444444444444444444444444444444444444444444',
        '0x5555555555555555555555555555555555555555555555555555555555555555'
      ],
        authorIndex: 2n,
      vrfSig: '0x333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333',
      sealSig: '0x444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444'
    }
    
    // Encode the header
    const [error, encoded] = encodeJamHeader(testHeader)
    if (error) {
      throw error
    }
    
    // Decode the encoded data
    const [error2, decodedHeader] = decodeJamHeader(encoded)
    if (error2) {
      throw error2
    }
    if (error) {
      throw error
    }
    
    // Verify round-trip consistency
    expect(decodedHeader.value.parent).toBe(testHeader.parent)
      expect(decodedHeader.value.priorStateRoot).toBe(testHeader.priorStateRoot)
    expect(decodedHeader.value.extrinsicHash).toBe(testHeader.extrinsicHash)
    expect(decodedHeader.value.timeslot).toBe(testHeader.timeslot)
    expect(decodedHeader.value.epochMark).toBe(testHeader.epochMark)
    expect(decodedHeader.value.winnersMark).toBe(testHeader.winnersMark)
    expect(decodedHeader.value.offendersMark).toEqual(testHeader.offendersMark)
    expect(decodedHeader.value.authorIndex).toBe(testHeader.authorIndex)
    expect(decodedHeader.value.vrfSig).toBe(testHeader.vrfSig)
    expect(decodedHeader.value.sealSig).toBe(testHeader.sealSig)
  })
})