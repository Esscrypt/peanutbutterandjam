import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { decodeHeader, encodeHeader } from '../block/header'
import { ConfigService } from '../../../../infra/node/services/config-service'

describe('JAM Header Codec Tests', () => {
  const testVectorsDir = join(process.cwd(), 'submodules/jam-test-vectors/codec/full')
  const fullConfig = new ConfigService('full')
  it('should decode and encode header_0 correctly', () => {
    // Load the binary test vector
    const binaryPath = join(testVectorsDir, 'header_0.bin')
    const binaryData = readFileSync(binaryPath)
    
    // Load the expected JSON result
    const jsonPath = join(testVectorsDir, 'header_0.json')
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
    
    // Decode the binary data
    const [error, decodedHeader] = decodeHeader(binaryData, fullConfig)
    if (error) {
      throw error
    }
    
    // Verify the decoded header matches the JSON structure
    expect(decodedHeader.value.parent).toBe(jsonData.parent)
    expect(decodedHeader.value.priorStateRoot).toBe(jsonData.parent_state_root)
    expect(decodedHeader.value.extrinsicHash).toBe(jsonData.extrinsic_hash)
    expect(Number(decodedHeader.value.timeslot)).toBe(jsonData.slot)
    
    // Check epoch mark
    if (jsonData.epoch_mark) {
      expect(decodedHeader.value.epochMark).not.toBeNull()
      expect(decodedHeader.value.epochMark!.entropy1).toBe(jsonData.epoch_mark.tickets_entropy)
      expect(decodedHeader.value.epochMark!.entropyAccumulator).toBe(jsonData.epoch_mark.entropy)
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
    
    // Check offenders mark (should match the JSON data)
    expect(decodedHeader.value.offendersMark).toEqual(jsonData.offenders_mark)
    
    // Encode the decoded header back to binary
    const [encodeError, encodedData] = encodeHeader(decodedHeader.value, fullConfig)
    if (encodeError) {
      throw encodeError
    }
    
    // Verify the encoded data matches the original binary
    expect(encodedData).toEqual(binaryData)
  })
  
  it('should decode and encode header_1 correctly', () => {
    // Load the binary test vector
    const binaryPath = join(testVectorsDir, 'header_1.bin')
    const binaryData = readFileSync(binaryPath)
    
    // Load the expected JSON result
    const jsonPath = join(testVectorsDir, 'header_1.json')
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
    
    // Decode the binary data
    const [error, decodedHeader] = decodeHeader(binaryData, fullConfig)
    if (error) {
      throw error
    }
    
    // Verify the decoded header matches the JSON structure
    expect(decodedHeader.value.parent).toBe(jsonData.parent)
    expect(decodedHeader.value.priorStateRoot).toBe(jsonData.parent_state_root)
    expect(decodedHeader.value.extrinsicHash).toBe(jsonData.extrinsic_hash)
    expect(Number(decodedHeader.value.timeslot)).toBe(jsonData.slot)
    
    // Check epoch mark (should be null for header_1)
    expect(decodedHeader.value.epochMark).toBeNull()
    
    // Check winners mark (tickets_mark in JSON)
    if (jsonData.tickets_mark) {
      expect(decodedHeader.value.winnersMark).not.toBeNull()
      expect(decodedHeader.value.winnersMark).toHaveLength(jsonData.tickets_mark.length)
      
      // Check first few tickets to avoid testing all tickets
      for (let i = 0; i < Math.min(5, jsonData.tickets_mark.length); i++) {
        expect(decodedHeader.value.winnersMark![i].id).toBe(jsonData.tickets_mark[i].id)
        expect(Number(decodedHeader.value.winnersMark![i].entryIndex)).toBe(jsonData.tickets_mark[i].attempt)
      }
    } else {
      expect(decodedHeader.value.winnersMark).toBeNull()
    }
    
    // Check offenders mark (should match the JSON data)
    expect(decodedHeader.value.offendersMark).toEqual(jsonData.offenders_mark)
    
    // Check author index
    expect(Number(decodedHeader.value.authorIndex)).toBe(jsonData.author_index)
    
    // Check VRF signature (entropy_source in JSON)
    expect(decodedHeader.value.vrfSig).toBe(jsonData.entropy_source)
    
    // Check seal signature
    expect(decodedHeader.value.sealSig).toBe(jsonData.seal)
    
    // Encode the decoded header back to binary
    const [encodeError, encodedData] = encodeHeader(decodedHeader.value, fullConfig)
    if (encodeError) {
      throw encodeError
    }
    
    // Verify the encoded data matches the original binary
    expect(encodedData).toEqual(binaryData)
  })
  
})