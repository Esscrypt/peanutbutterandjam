import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { decodeJamHeader, encodeJamHeader } from '../block/header'
import type { JamHeader } from '@pbnj/types'

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
    expect(decodedHeader.value.parent_state_root).toBe(jsonData.parent_state_root)
    expect(decodedHeader.value.extrinsic_hash).toBe(jsonData.extrinsic_hash)
    expect(decodedHeader.value.slot).toBe(jsonData.slot)
    
    // Check epoch mark
    if (jsonData.epoch_mark) {
      expect(decodedHeader.value.epoch_mark).not.toBeNull()
      expect(decodedHeader.value.epoch_mark!.entropy).toBe(jsonData.epoch_mark.entropy)
      expect(decodedHeader.value.epoch_mark!.tickets_entropy).toBe(jsonData.epoch_mark.tickets_entropy)
      expect(decodedHeader.value.epoch_mark!.validators).toHaveLength(jsonData.epoch_mark.validators.length)
      
      // Check first few validators to avoid testing all 1024
      for (let i = 0; i < Math.min(5, jsonData.epoch_mark.validators.length); i++) {
        expect(decodedHeader.value.epoch_mark!.validators[i].bandersnatch).toBe(jsonData.epoch_mark.validators[i].bandersnatch)
        expect(decodedHeader.value.epoch_mark!.validators[i].ed25519).toBe(jsonData.epoch_mark.validators[i].ed25519)
      }
    } else {
      expect(decodedHeader.value.epoch_mark).toBeNull()
    }
    
    // Check winners mark (should be null for header_0)
    expect(decodedHeader.value.winners_mark).toBeNull()
    
    // Check offenders mark (should be empty array for header_0) 
    expect(decodedHeader.value.offenders_mark).toEqual([])
    
    // Encode the decoded header back to binary
    const encodedData = encodeJamHeader(decodedHeader.value)
    
    // Verify the encoded data matches the original binary
    expect(encodedData).toEqual(binaryData)
  })
  
  it('should handle round-trip encoding/decoding for simple header', () => {
    // Create a minimal test header
    const testHeader: JamHeader = {
      parent: '0x0000000000000000000000000000000000000000000000000000000000000000',
      parent_state_root: '0x0000000000000000000000000000000000000000000000000000000000000000',
      extrinsic_hash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      slot: 0n,
      epoch_mark: null,
      winners_mark: null,
      offenders_mark: [],
      author_index: 0n,
      vrf_sig: '0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      seal_sig: '0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
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
    expect(decodedHeader.value.parent_state_root).toBe(testHeader.parent_state_root)
    expect(decodedHeader.value.extrinsic_hash).toBe(testHeader.extrinsic_hash)
    expect(decodedHeader.value.slot).toBe(testHeader.slot)
    expect(decodedHeader.value.epoch_mark).toBe(testHeader.epoch_mark)
    expect(decodedHeader.value.winners_mark).toBe(testHeader.winners_mark)
    expect(decodedHeader.value.offenders_mark).toEqual(testHeader.offenders_mark)
    expect(decodedHeader.value.author_index).toBe(testHeader.author_index)
    expect(decodedHeader.value.vrf_sig).toBe(testHeader.vrf_sig)
    expect(decodedHeader.value.seal_sig).toBe(testHeader.seal_sig)
  })
  
  it('should handle header with epoch mark', () => {
    // Create a test header with epoch mark
    const testHeader: JamHeader = {
      parent: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      parent_state_root: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
      extrinsic_hash: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      slot: 42n,
      epoch_mark: {
        entropy: '0xae85d6635e9ae539d0846b911ec86a27fe000f619b78bcac8a74b77e36f6dbcf',
        tickets_entropy: '0x333a7e328f0c4183f4b947e1d8f68aa4034f762e5ecdb5a7f6fbf0afea2fd8cd',
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
      winners_mark: null,
      offenders_mark: [],
      author_index: 1n,
      vrf_sig: '0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111',
      seal_sig: '0x222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222'
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
    expect(decodedHeader.value.parent_state_root).toBe(testHeader.parent_state_root)
    expect(decodedHeader.value.extrinsic_hash).toBe(testHeader.extrinsic_hash)
    expect(decodedHeader.value.slot).toBe(testHeader.slot)
    
    // Check epoch mark
    expect(decodedHeader.value.epoch_mark).not.toBeNull()
    expect(decodedHeader.value.epoch_mark!.entropy).toBe(testHeader.epoch_mark!.entropy)
    expect(decodedHeader.value.epoch_mark!.tickets_entropy).toBe(testHeader.epoch_mark!.tickets_entropy)
    expect(decodedHeader.value.epoch_mark!.validators).toHaveLength(testHeader.epoch_mark!.validators.length)
    
    for (let i = 0; i < testHeader.epoch_mark!.validators.length; i++) {
      expect(decodedHeader.value.epoch_mark!.validators[i].bandersnatch).toBe(testHeader.epoch_mark!.validators[i].bandersnatch)
      expect(decodedHeader.value.epoch_mark!.validators[i].ed25519).toBe(testHeader.epoch_mark!.validators[i].ed25519)
    }
    
    expect(decodedHeader.value.winners_mark).toBe(testHeader.winners_mark)
    expect(decodedHeader.value.offenders_mark).toEqual(testHeader.offenders_mark)
    expect(decodedHeader.value.author_index).toBe(testHeader.author_index)
    expect(decodedHeader.value.vrf_sig).toBe(testHeader.vrf_sig)
    expect(decodedHeader.value.seal_sig).toBe(testHeader.seal_sig)
  })
  
  it('should handle header with offenders', () => {
    // Create a test header with offenders
    const testHeader: JamHeader = {
      parent: '0x1111111111111111111111111111111111111111111111111111111111111111',
      parent_state_root: '0x2222222222222222222222222222222222222222222222222222222222222222',
      extrinsic_hash: '0x3333333333333333333333333333333333333333333333333333333333333333',
      slot: 100n,
      epoch_mark: null,
      winners_mark: null,
      offenders_mark: [
        '0x4444444444444444444444444444444444444444444444444444444444444444',
        '0x5555555555555555555555555555555555555555555555555555555555555555'
      ],
      author_index: 2n,
      vrf_sig: '0x333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333',
      seal_sig: '0x444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444'
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
    expect(decodedHeader.value.parent_state_root).toBe(testHeader.parent_state_root)
    expect(decodedHeader.value.extrinsic_hash).toBe(testHeader.extrinsic_hash)
    expect(decodedHeader.value.slot).toBe(testHeader.slot)
    expect(decodedHeader.value.epoch_mark).toBe(testHeader.epoch_mark)
    expect(decodedHeader.value.winners_mark).toBe(testHeader.winners_mark)
    expect(decodedHeader.value.offenders_mark).toEqual(testHeader.offenders_mark)
    expect(decodedHeader.value.author_index).toBe(testHeader.author_index)
    expect(decodedHeader.value.vrf_sig).toBe(testHeader.vrf_sig)
    expect(decodedHeader.value.seal_sig).toBe(testHeader.seal_sig)
  })
})