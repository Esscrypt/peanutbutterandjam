import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { decodeHeader, encodeHeader } from '../block/header'
import { ConfigService } from '../../../../infra/node/services/config-service'

describe('Header Test Vectors - Round Trip Encoding/Decoding', () => {
  const testVectorsDir = join(__dirname, '../../../../submodules/jamtestvectors/codec/full')
  
  // jamtestvectors were generated with full config (1023 validators)
  // Use full config for all tests to ensure consistency
  const fullConfig = new ConfigService('full')

  it('should handle header_0 round-trip encoding/decoding', () => {
    const binaryPath = join(testVectorsDir, 'header_0.bin')
    const binaryData = readFileSync(binaryPath)
    
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
    
    // Handle timeslot comparison (BigInt vs number)
    const timeslotValue = jsonData.timeslot || jsonData.slot
    const expectedTimeslot = typeof timeslotValue === 'number' ? BigInt(timeslotValue) : timeslotValue
    expect(decodedHeader.value.timeslot).toBe(expectedTimeslot)
    
    // Check epoch mark
    if (jsonData.epoch_mark) {
      expect(decodedHeader.value.epochMark).not.toBeNull()
      expect(decodedHeader.value.epochMark!.entropy1).toBe(jsonData.epoch_mark.tickets_entropy)
      expect(decodedHeader.value.epochMark!.entropyAccumulator).toBe(jsonData.epoch_mark.entropy)
      expect(decodedHeader.value.epochMark!.validators).toHaveLength(jsonData.epoch_mark.validators.length)
      
      // Check first few validators to avoid testing all validators
      for (let i = 0; i < Math.min(5, jsonData.epoch_mark.validators.length); i++) {
        expect(decodedHeader.value.epochMark!.validators[i].bandersnatch).toBe(jsonData.epoch_mark.validators[i].bandersnatch)
        expect(decodedHeader.value.epochMark!.validators[i].ed25519).toBe(jsonData.epoch_mark.validators[i].ed25519)
      }
    } else {
      expect(decodedHeader.value.epochMark).toBeNull()
    }
    
    // Check winners mark (should be null for header_0)
    expect(decodedHeader.value.winnersMark).toBeNull()
    
    // Check offenders mark
    expect(decodedHeader.value.offendersMark).toEqual(jsonData.offenders_mark || [])
    
    // Encode the decoded header back to binary using the full config
    const [encodeError, encodedData] = encodeHeader(decodedHeader.value, fullConfig)
    expect(encodeError).toBeUndefined()
    
    // Verify the encoded data matches the original binary
    expect(encodedData).toEqual(binaryData)
  })
  
  it('should handle header_1 round-trip encoding/decoding', () => {
    const binaryPath = join(testVectorsDir, 'header_1.bin')
    const binaryData = readFileSync(binaryPath)
    
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
    
    // Handle timeslot comparison (BigInt vs number)
    const timeslotValue = jsonData.timeslot || jsonData.slot
    const expectedTimeslot = typeof timeslotValue === 'number' ? BigInt(timeslotValue) : timeslotValue
    expect(decodedHeader.value.timeslot).toBe(expectedTimeslot)
    
    // Check tickets mark (header_1 has tickets instead of epoch mark)
    if (jsonData.tickets_mark) {
      expect(decodedHeader.value.winnersMark).not.toBeNull()
      expect(decodedHeader.value.winnersMark!).toHaveLength(jsonData.tickets_mark.length)
      
      // Check first few tickets
      for (let i = 0; i < Math.min(5, jsonData.tickets_mark.length); i++) {
        expect(decodedHeader.value.winnersMark![i].id).toBe(jsonData.tickets_mark[i].id)
        const expectedEntryIndex = typeof jsonData.tickets_mark[i].attempt === 'number' ? BigInt(jsonData.tickets_mark[i].attempt) : jsonData.tickets_mark[i].attempt
        expect(decodedHeader.value.winnersMark![i].entryIndex).toBe(expectedEntryIndex)
      }
    } else {
      expect(decodedHeader.value.winnersMark).toBeNull()
    }
    
    // Check offenders mark
    expect(decodedHeader.value.offendersMark).toEqual(jsonData.offenders_mark || [])
    
    // Encode the decoded header back to binary using the full config
    const [encodeError, encodedData] = encodeHeader(decodedHeader.value, fullConfig)
    expect(encodeError).toBeUndefined()
    
    // Verify the encoded data matches the original binary
    expect(encodedData).toEqual(binaryData)
  })
})
