import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { decodeDisputes, encodeDisputes } from '../block/dispute'
import type { Dispute, IConfigService } from '@pbnjam/types'

describe('Disputes Test Vectors - Comprehensive Round Trip', () => {
  // Create configs for different test vector sizes
  const tinyConfig = {
    numCores: 5, // Tiny config uses 5 validators
    numValidators: 5,
  } as IConfigService

  const fullConfig = {
    numCores: 341, // Full config uses 341 cores
    numValidators: 1023, // Full config uses 1023 validators
  } as IConfigService

  it('should handle tiny disputes_extrinsic round-trip encoding/decoding', () => {
    const tinyTestVectorsDir = join(__dirname, '../../../../submodules/jamtestvectors/codec/tiny')
    const binaryPath = join(tinyTestVectorsDir, 'disputes_extrinsic.bin')
    const binaryData = readFileSync(binaryPath)
    
    const jsonPath = join(tinyTestVectorsDir, 'disputes_extrinsic.json')
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
    
    // Decode the binary data using tiny config
    const [error, decodedDisputes] = decodeDisputes(binaryData, tinyConfig)
    if (error) {
      throw error
    }
    
    // Verify the decoded disputes match the JSON structure
    expect(decodedDisputes.value).toHaveLength(1) // Single dispute object
    
    const dispute = decodedDisputes.value[0]
    
    // Check verdicts
    expect(dispute.verdicts).toHaveLength(jsonData.verdicts.length)
    for (let i = 0; i < jsonData.verdicts.length; i++) {
      const verdict = dispute.verdicts[i]
      const expectedVerdict = jsonData.verdicts[i]
      
      expect(verdict.target).toBe(expectedVerdict.target)
      expect(verdict.age).toBe(BigInt(expectedVerdict.age))
      expect(verdict.votes).toHaveLength(expectedVerdict.votes.length)
      
      // Check votes (judgments)
      for (let j = 0; j < expectedVerdict.votes.length; j++) {
        const vote = verdict.votes[j]
        const expectedVote = expectedVerdict.votes[j]
        
        expect(vote.vote).toBe(expectedVote.vote)
        expect(vote.index).toBe(BigInt(expectedVote.index))
        expect(vote.signature).toBe(expectedVote.signature)
      }
    }
    
    // Check culprits
    expect(dispute.culprits).toHaveLength(jsonData.culprits.length)
    for (let i = 0; i < jsonData.culprits.length; i++) {
      const culprit = dispute.culprits[i]
      const expectedCulprit = jsonData.culprits[i]
      
      expect(culprit.target).toBe(expectedCulprit.target)
      expect(culprit.key).toBe(expectedCulprit.key)
      expect(culprit.signature).toBe(expectedCulprit.signature)
    }
    
    // Check faults
    expect(dispute.faults).toHaveLength(jsonData.faults.length)
    for (let i = 0; i < jsonData.faults.length; i++) {
      const fault = dispute.faults[i]
      const expectedFault = jsonData.faults[i]
      
      expect(fault.target).toBe(expectedFault.target)
      expect(fault.vote).toBe(expectedFault.vote)
      expect(fault.key).toBe(expectedFault.key)
      expect(fault.signature).toBe(expectedFault.signature)
    }
    
    // Encode the decoded disputes back to binary
    const [encodeError, encodedData] = encodeDisputes(decodedDisputes.value)
    if (encodeError) {
      throw encodeError
    }
    
    // Verify the encoded data matches the original binary
    expect(encodedData).toEqual(binaryData)
  })

  it('should handle full disputes_extrinsic round-trip encoding/decoding', () => {
    const fullTestVectorsDir = join(__dirname, '../../../../submodules/jamtestvectors/codec/full')
    const binaryPath = join(fullTestVectorsDir, 'disputes_extrinsic.bin')
    const binaryData = readFileSync(binaryPath)
    
    const jsonPath = join(fullTestVectorsDir, 'disputes_extrinsic.json')
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
    
    // Decode the binary data using full config
    const [error, decodedDisputes] = decodeDisputes(binaryData, fullConfig)
    if (error) {
      throw error
    }
    
    // Verify the decoded disputes match the JSON structure
    expect(decodedDisputes.value).toHaveLength(1) // Single dispute object
    
    const dispute = decodedDisputes.value[0]
    
    // Check verdicts
    expect(dispute.verdicts).toHaveLength(jsonData.verdicts.length)
    
    // For full test vectors, check first few verdicts to avoid testing all (performance)
    const maxVerdictsToCheck = Math.min(3, jsonData.verdicts.length)
    for (let i = 0; i < maxVerdictsToCheck; i++) {
      const verdict = dispute.verdicts[i]
      const expectedVerdict = jsonData.verdicts[i]
      
      expect(verdict.target).toBe(expectedVerdict.target)
      expect(verdict.age).toBe(BigInt(expectedVerdict.age))
      expect(verdict.votes).toHaveLength(expectedVerdict.votes.length)
      
      // Check first few votes to avoid testing all (performance)
      const maxVotesToCheck = Math.min(5, expectedVerdict.votes.length)
      for (let j = 0; j < maxVotesToCheck; j++) {
        const vote = verdict.votes[j]
        const expectedVote = expectedVerdict.votes[j]
        
        expect(vote.vote).toBe(expectedVote.vote)
        expect(vote.index).toBe(BigInt(expectedVote.index))
        expect(vote.signature).toBe(expectedVote.signature)
      }
    }
    
    // Check culprits
    expect(dispute.culprits).toHaveLength(jsonData.culprits.length)
    
    // Check first few culprits to avoid testing all (performance)
    const maxCulpritsToCheck = Math.min(3, jsonData.culprits.length)
    for (let i = 0; i < maxCulpritsToCheck; i++) {
      const culprit = dispute.culprits[i]
      const expectedCulprit = jsonData.culprits[i]
      
      expect(culprit.target).toBe(expectedCulprit.target)
      expect(culprit.key).toBe(expectedCulprit.key)
      expect(culprit.signature).toBe(expectedCulprit.signature)
    }
    
    // Check faults
    expect(dispute.faults).toHaveLength(jsonData.faults.length)
    
    // Check first few faults to avoid testing all (performance)
    const maxFaultsToCheck = Math.min(3, jsonData.faults.length)
    for (let i = 0; i < maxFaultsToCheck; i++) {
      const fault = dispute.faults[i]
      const expectedFault = jsonData.faults[i]
      
      expect(fault.target).toBe(expectedFault.target)
      expect(fault.vote).toBe(expectedFault.vote)
      expect(fault.key).toBe(expectedFault.key)
      expect(fault.signature).toBe(expectedFault.signature)
    }
    
    // Encode the decoded disputes back to binary
    const [encodeError, encodedData] = encodeDisputes(decodedDisputes.value)
    if (encodeError) {
      throw encodeError
    }
    
    // Verify the encoded data matches the original binary
    expect(encodedData).toEqual(binaryData)
  })

  it('should handle empty disputes round-trip encoding/decoding', () => {
    // Test empty disputes case
    const emptyDisputes: Dispute[] = []
    
    // Encode empty disputes
    const [encodeError, encodedData] = encodeDisputes(emptyDisputes)
    if (encodeError) {
      throw encodeError
    }
    
    // Decode empty disputes
    const [decodeError, decodedDisputes] = decodeDisputes(encodedData, tinyConfig)
    if (decodeError) {
      throw decodeError
    }
    
    // Verify empty disputes round-trip
    expect(decodedDisputes.value).toHaveLength(0)
  })

  it('should handle disputes with only verdicts round-trip encoding/decoding', () => {
    // Test disputes with only verdicts (no culprits or faults)
    // Need 5 votes for supermajority: ceil(2/3 * 5) + 1 = 5
    const verdictsOnlyDisputes: Dispute[] = [{
      verdicts: [
        {
          target: '0xdd1b65c036547750d2f84ff4c6fac7de56944658530a62e81c6cc290087440d0',
          age: 3n,
          votes: [
            {
              vote: true,
              index: 0n,
              signature: '0xc072848f5bc77d85a09dc4e69f3420293891163406ec3a49ccf31a5ff8c063042a9c8c59e5f83d4d276ab4110af0ca85d7a713434694f8c6b391b122c303aadb'
            },
            {
              vote: true,
              index: 1n,
              signature: '0xcb021d8507925eb2d49040cc08cbcca0af197c5f3eb7aad639a82497a8d6046780da26d4cbc113b375c34298bc5be500eb088a33a099f86e428154c9f6724d8c'
            },
            {
              vote: true,
              index: 2n,
              signature: '0x28e928fc44c1bf90f9c68001e59d89e855f5db43a75b256d89e2008e2d472bf57e3f7743e52ebde917b12f51135f8918cfdcba29115cc4856a9dc984efe9fe5e'
            },
            {
              vote: true,
              index: 3n,
              signature: '0x4a7237797e717725fbc0f43a5bbc50b318db3e59f5f536776a189bf65c6508100eedbb2bae1e2ed123c2fb025ca8e8b7f306ced32b03fd98c1045aef4153a1ae'
            },
            {
              vote: true,
              index: 4n,
              signature: '0xc20960a26a917aa7376623c7612c50741ed3442172c62edce97c5c8c9ced29179d1d5cb8aa8fbb8d6f42d49761f85ec4705b054c76f82a9d31dc05fec139b510'
            }
          ]
        }
      ],
      culprits: [],
      faults: []
    }]
    
    // Encode disputes with only verdicts
    const [encodeError, encodedData] = encodeDisputes(verdictsOnlyDisputes)
    if (encodeError) {
      throw encodeError
    }
    
    // Decode disputes with only verdicts
    const [decodeError, decodedDisputes] = decodeDisputes(encodedData, tinyConfig)
    if (decodeError) {
      throw decodeError
    }
    
    // Verify round-trip
    expect(decodedDisputes.value).toHaveLength(1)
    expect(decodedDisputes.value[0].verdicts).toHaveLength(1)
    expect(decodedDisputes.value[0].culprits).toHaveLength(0)
    expect(decodedDisputes.value[0].faults).toHaveLength(0)
    
    const verdict = decodedDisputes.value[0].verdicts[0]
    expect(verdict.target).toBe('0xdd1b65c036547750d2f84ff4c6fac7de56944658530a62e81c6cc290087440d0')
    expect(verdict.age).toBe(3n)
    expect(verdict.votes).toHaveLength(5)
    expect(verdict.votes[0].vote).toBe(true)
    expect(verdict.votes[0].index).toBe(0n)
    expect(verdict.votes[1].vote).toBe(true)
    expect(verdict.votes[1].index).toBe(1n)
    expect(verdict.votes[2].vote).toBe(true)
    expect(verdict.votes[2].index).toBe(2n)
    expect(verdict.votes[3].vote).toBe(true)
    expect(verdict.votes[3].index).toBe(3n)
    expect(verdict.votes[4].vote).toBe(true)
    expect(verdict.votes[4].index).toBe(4n)
  })

  it('should handle disputes with only culprits round-trip encoding/decoding', () => {
    // Test disputes with only culprits (no verdicts or faults)
    const culpritsOnlyDisputes: Dispute[] = [{
      verdicts: [],
      culprits: [
        {
          target: '0x99841f584606ab31badcdf38e8122874a699e0cb3989d8ddc7c0874b8f5f76bf',
          key: '0x4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace',
          signature: '0x99841f584606ab31badcdf38e8122874a699e0cb3989d8ddc7c0874b8f5f76bfc87c17f29dfbde33cfe599f3fb71d0fc211140801080ec105fbf435a977f784a'
        }
      ],
      faults: []
    }]
    
    // Encode disputes with only culprits
    const [encodeError, encodedData] = encodeDisputes(culpritsOnlyDisputes)
    if (encodeError) {
      throw encodeError
    }
    
    // Decode disputes with only culprits
    const [decodeError, decodedDisputes] = decodeDisputes(encodedData, tinyConfig)
    if (decodeError) {
      throw decodeError
    }
    
    // Verify round-trip
    expect(decodedDisputes.value).toHaveLength(1)
    expect(decodedDisputes.value[0].verdicts).toHaveLength(0)
    expect(decodedDisputes.value[0].culprits).toHaveLength(1)
    expect(decodedDisputes.value[0].faults).toHaveLength(0)
    
    const culprit = decodedDisputes.value[0].culprits[0]
    expect(culprit.target).toBe('0x99841f584606ab31badcdf38e8122874a699e0cb3989d8ddc7c0874b8f5f76bf')
    expect(culprit.key).toBe('0x4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace')
    expect(culprit.signature).toBe('0x99841f584606ab31badcdf38e8122874a699e0cb3989d8ddc7c0874b8f5f76bfc87c17f29dfbde33cfe599f3fb71d0fc211140801080ec105fbf435a977f784a')
  })

  it('should handle disputes with only faults round-trip encoding/decoding', () => {
    // Test disputes with only faults (no verdicts or culprits)
    const faultsOnlyDisputes: Dispute[] = [{
      verdicts: [],
      culprits: [],
      faults: [
        {
          target: '0x536fd52c4f4b1330e67d49717974435bf1c18edd91b69d343186a784844415bc',
          vote: false,
          key: '0x4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace',
          signature: '0x557e5ee3660be9247c4908c74a46c91eebd713925dd7f2ede3ef4900ba277039f7d46ec15432116176cce8ce39d8ae21eabafdf71796eeb724ee7e4ff1dd1fd7'
        }
      ]
    }]
    
    // Encode disputes with only faults
    const [encodeError, encodedData] = encodeDisputes(faultsOnlyDisputes)
    if (encodeError) {
      throw encodeError
    }
    
    // Decode disputes with only faults
    const [decodeError, decodedDisputes] = decodeDisputes(encodedData, tinyConfig)
    if (decodeError) {
      throw decodeError
    }
    
    // Verify round-trip
    expect(decodedDisputes.value).toHaveLength(1)
    expect(decodedDisputes.value[0].verdicts).toHaveLength(0)
    expect(decodedDisputes.value[0].culprits).toHaveLength(0)
    expect(decodedDisputes.value[0].faults).toHaveLength(1)
    
    const fault = decodedDisputes.value[0].faults[0]
    expect(fault.target).toBe('0x536fd52c4f4b1330e67d49717974435bf1c18edd91b69d343186a784844415bc')
    expect(fault.vote).toBe(false)
    expect(fault.key).toBe('0x4418fb8c85bb3985394a8c2756d3643457ce614546202a2f50b093d762499ace')
    expect(fault.signature).toBe('0x557e5ee3660be9247c4908c74a46c91eebd713925dd7f2ede3ef4900ba277039f7d46ec15432116176cce8ce39d8ae21eabafdf71796eeb724ee7e4ff1dd1fd7')
  })
})
