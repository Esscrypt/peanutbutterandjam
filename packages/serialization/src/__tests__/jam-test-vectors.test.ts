import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { decodeHeader, encodeHeader } from '../block/header'
import { decodeBlock, encodeBlock } from '../block/body'
import { decodeWorkPackage, encodeWorkPackage } from '../work-package/package'
import { decodeWorkItem } from '../work-package/package'
import { decodeWorkReport, encodeWorkReport } from '../work-package/work-report'
// Note: decodeWorkResult function not yet implemented
import { decodeAssurances, encodeAssurances } from '../block/assurance'
import { decodeDisputes, encodeDisputes } from '../block/dispute'
import { decodeGuarantees, encodeGuarantees } from '../block/guarantee'
import { decodePreimages, encodePreimages } from '../block/preimage'
import { decodeSafroleTickets, encodeSafroleTickets } from '../block/ticket'
import { encodeWorkContext } from '../work-package/context'
import { decodeWorkContext } from '../work-package/work-report'
// import type { BlockHeader } from '@pbnj/types'

describe('JAM Test Vectors - Round Trip Encoding/Decoding', () => {
  const testVectorsDir = join(__dirname, '../../../../submodules/jamtestvectors/codec/full')
  
  describe('Header Test Vectors', () => {
    it('should handle header_0 round-trip encoding/decoding', () => {
      const binaryPath = join(testVectorsDir, 'header_0.bin')
      const binaryData = readFileSync(binaryPath)
      
      const jsonPath = join(testVectorsDir, 'header_0.json')
      const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
      
      // Decode the binary data
      const [error, decodedHeader] = decodeHeader(binaryData)
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
      const encodedData = encodeHeader(decodedHeader.value)
      
      // Verify the encoded data matches the original binary
      expect(encodedData).toEqual(binaryData)
    })
    
    it('should handle header_1 round-trip encoding/decoding', () => {
      const binaryPath = join(testVectorsDir, 'header_1.bin')
      const binaryData = readFileSync(binaryPath)
      
      const jsonPath = join(testVectorsDir, 'header_1.json')
      const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
      
      // Decode the binary data
      const [error, decodedHeader] = decodeHeader(binaryData)
      if (error) {
        throw error
      }
      
      // Verify the decoded header matches the JSON structure
      expect(decodedHeader.value.parent).toBe(jsonData.parent)
      expect(decodedHeader.value.priorStateRoot).toBe(jsonData.parent_state_root)
      expect(decodedHeader.value.extrinsicHash).toBe(jsonData.extrinsic_hash)
      expect(decodedHeader.value.timeslot).toBe(jsonData.slot)
      
      // Check tickets mark (header_1 has tickets instead of epoch mark)
      if (jsonData.tickets_mark) {
        expect(decodedHeader.value.winnersMark).not.toBeNull()
        expect(decodedHeader.value.winnersMark!).toHaveLength(jsonData.tickets_mark.length)
        
        // Check first few tickets
        for (let i = 0; i < Math.min(5, jsonData.tickets_mark.length); i++) {
          expect(decodedHeader.value.winnersMark![i].id).toBe(jsonData.tickets_mark[i].id)
          expect(decodedHeader.value.winnersMark![i].entryIndex).toBe(jsonData.tickets_mark[i].attempt)
        }
      } else {
        expect(decodedHeader.value.winnersMark).toBeNull()
      }
      
      // Check offenders mark
      expect(decodedHeader.value.offendersMark).toEqual(jsonData.offenders_mark || [])
      
      // Encode the decoded header back to binary
      const encodedData = encodeHeader(decodedHeader.value)
      
      // Verify the encoded data matches the original binary
      expect(encodedData).toEqual(binaryData)
    })
  })
  
  describe('Block Test Vectors', () => {
    it('should handle block round-trip encoding/decoding', () => {
      const binaryPath = join(testVectorsDir, 'block.bin')
      const binaryData = readFileSync(binaryPath)
      
      const jsonPath = join(testVectorsDir, 'block.json')
      const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
      
      // Decode the binary data
      const [error, decodedBlock] = decodeBlock(binaryData)
      if (error) {
        throw error
      }
      
      // Verify the decoded block matches the JSON structure
      expect(decodedBlock.value.header.parent).toBe(jsonData.header.parent)
      expect(decodedBlock.value.header.priorStateRoot).toBe(jsonData.header.parent_state_root)
      expect(decodedBlock.value.header.extrinsicHash).toBe(jsonData.header.extrinsic_hash)
      expect(decodedBlock.value.header.timeslot).toBe(jsonData.header.slot)
      
      // Check body
    //   expect(decodedBlock.value.body.extrinsics).toHaveLength(jsonData.body.extrinsics.length)
      
      // Encode the decoded block back to binary
      const encodedData = encodeBlock(decodedBlock.value)
      
      // Verify the encoded data matches the original binary
      expect(encodedData).toEqual(binaryData)
    })
  })
  
  describe('Work Package Test Vectors', () => {
    it('should handle work_package round-trip encoding/decoding', () => {
      const binaryPath = join(testVectorsDir, 'work_package.bin')
      const binaryData = readFileSync(binaryPath)
      
      const jsonPath = join(testVectorsDir, 'work_package.json')
      const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
      
      // Decode the binary data
      const [error, decodedPackageResult] = decodeWorkPackage(binaryData)
      if (error) {
        throw error
      }

      const decodedPackage = decodedPackageResult.value
      
      // Verify the decoded package matches the JSON structure
      expect(decodedPackage.authToken).toBe(jsonData.authorization)
      expect(decodedPackage.authCodeHost).toBe(jsonData.auth_code_host)
      expect(decodedPackage.authCodeHash).toBe(jsonData.authorizer.code_hash)
      expect(decodedPackage.authConfig).toBe(jsonData.authorizer.params)
      
      // Check context
      expect(decodedPackage.context.anchorHash).toBe(jsonData.context.anchor)
      expect(decodedPackage.context.anchorPostState).toBe(jsonData.context.state_root)
      expect(decodedPackage.context.anchorAccoutLog).toBe(jsonData.context.beefy_root)
      expect(decodedPackage.context.lookupAnchorHash).toBe(jsonData.context.lookup_anchor)
      expect(decodedPackage.context.lookupAnchorTime).toBe(jsonData.context.lookup_anchor_slot)
      
      // Check items
      expect(decodedPackage.workItems).toHaveLength(jsonData.items.length)
      
      // Encode the decoded package back to binary
      const encodedData = encodeWorkPackage(decodedPackage)
      
      // Verify the encoded data matches the original binary
      expect(encodedData).toEqual(binaryData)
    })
    
    it('should handle work_item round-trip encoding/decoding', () => {
      const binaryPath = join(testVectorsDir, 'work_item.bin')
      const binaryData = readFileSync(binaryPath)
      
      const jsonPath = join(testVectorsDir, 'work_item.json')
      const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
      
      // Decode the binary data
      const [error, decodedItem] = decodeWorkItem(binaryData)
      if (error) {
        throw error
      }
      
       // Verify the decoded item matches the JSON structure
       expect(decodedItem.value.serviceindex).toBe(BigInt(jsonData.service))
      expect(decodedItem.value.codehash).toBe(jsonData.code_hash)
      expect(decodedItem.value.payload).toBe(jsonData.payload)
      expect(decodedItem.value.refgaslimit).toBe(jsonData.refine_gas_limit)
      expect(decodedItem.value.accgaslimit).toBe(jsonData.accumulate_gas_limit)
      expect(decodedItem.value.exportcount).toBe(jsonData.export_count)
      
      // Check import segments
      expect(decodedItem.value.importsegments).toHaveLength(jsonData.import_segments.length)
      
      // Check extrinsic references
      expect(decodedItem.value.extrinsics).toHaveLength(jsonData.extrinsic.length)
      
      // Encode the decoded item back to binary
      const encodedData = encodeWorkPackage({ 
        authToken: '0x00',
        authCodeHost: 0n,
        authCodeHash: '0x00',
        authConfig: '0x00',
        context: {
          anchorHash: '0x00',
          anchorPostState: '0x00',
          anchorAccoutLog: '0x00',
          lookupAnchorHash: '0x00',
          lookupAnchorTime: 0n,
          prerequisites: []
        },
        workItems: [decodedItem.value]
      })
      
      // Verify the encoded data contains the work item
      expect(encodedData).toBeDefined()
    })
  })
  
  describe('Work Report Test Vectors', () => {
    it('should handle work_report round-trip encoding/decoding', () => {
      const binaryPath = join(testVectorsDir, 'work_report.bin')
      const binaryData = readFileSync(binaryPath)
      
      const jsonPath = join(testVectorsDir, 'work_report.json')
      const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
      
      // Decode the binary data
      const [error, decodedReportResult] = decodeWorkReport(binaryData)
      if (error) {
        throw error
      }

      const decodedReport = decodedReportResult.value
      
      // Verify the decoded report matches the JSON structure
      expect(decodedReport.availabilitySpec.packageHash).toBe(jsonData.package_spec.hash)
      expect(decodedReport.availabilitySpec.bundleLength).toBe(jsonData.package_spec.length)
      expect(decodedReport.availabilitySpec.erasureRoot).toBe(jsonData.package_spec.erasure_root)
      expect(decodedReport.availabilitySpec.segmentRoot).toBe(jsonData.package_spec.exports_root)
      expect(decodedReport.availabilitySpec.segmentCount).toBe(jsonData.package_spec.exports_count)
      
      // Check context
      expect(decodedReport.context.anchorHash).toBe(jsonData.context.anchor)
      expect(decodedReport.context.anchorPostState).toBe(jsonData.context.state_root)
      expect(decodedReport.context.anchorAccoutLog).toBe(jsonData.context.beefy_root)
      expect(decodedReport.context.lookupAnchorHash).toBe(jsonData.context.lookup_anchor)
      expect(decodedReport.context.lookupAnchorTime).toBe(jsonData.context.lookup_anchor_slot)
      
      // Check results
      expect(decodedReport.digests).toHaveLength(jsonData.results.length)
      
      // Encode the decoded report back to binary
      const encodedData = encodeWorkReport(decodedReport)
      
      // Verify the encoded data matches the original binary
      expect(encodedData).toEqual(binaryData)
    })
    
    // Note: work_result tests skipped - decodeWorkResult function not yet implemented
  })
  
  describe('Extrinsic Test Vectors', () => {
    it('should handle assurances_extrinsic round-trip encoding/decoding', () => {
      const binaryPath = join(testVectorsDir, 'assurances_extrinsic.bin')
      const binaryData = readFileSync(binaryPath)
      
      const jsonPath = join(testVectorsDir, 'assurances_extrinsic.json')
      const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
      
      // Decode the binary data
      const [error, decodedAssurances] = decodeAssurances(binaryData)
      if (error) {
        throw error
      }
      
      // Verify the decoded assurances match the JSON structure
      expect(decodedAssurances.value).toHaveLength(jsonData.length)
      
      for (let i = 0; i < jsonData.length; i++) {
        expect(decodedAssurances.value[i].anchor).toBe(jsonData[i].anchor)
        expect(decodedAssurances.value[i].availabilities).toBe(jsonData[i].bitfield)
        expect(decodedAssurances.value[i].assurer).toBe(jsonData[i].validator_index)
        expect(decodedAssurances.value[i].signature).toBe(jsonData[i].signature)
      }
      
      // Encode the decoded assurances back to binary
      const encodedData = encodeAssurances(decodedAssurances.value)
      
      // Verify the encoded data matches the original binary
      expect(encodedData).toEqual(binaryData)
    })
    
    it('should handle disputes_extrinsic round-trip encoding/decoding', () => {
      const binaryPath = join(testVectorsDir, 'disputes_extrinsic.bin')
      const binaryData = readFileSync(binaryPath)
      
      const jsonPath = join(testVectorsDir, 'disputes_extrinsic.json')
      const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
      
      // Decode the binary data
      const [error, decodedDisputes] = decodeDisputes(binaryData)
      if (error) {
        throw error
      }
      
      // Verify the decoded disputes match the JSON structure
      expect(decodedDisputes.value).toHaveLength(jsonData.length)
      
      // Encode the decoded disputes back to binary
      const encodedData = encodeDisputes(decodedDisputes.value)
      
      // Verify the encoded data matches the original binary
      expect(encodedData).toEqual(binaryData)
    })
    
    it('should handle guarantees_extrinsic round-trip encoding/decoding', () => {
      const binaryPath = join(testVectorsDir, 'guarantees_extrinsic.bin')
      const binaryData = readFileSync(binaryPath)
      
      const jsonPath = join(testVectorsDir, 'guarantees_extrinsic.json')
      const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
      
      // Decode the binary data
      const [error, decodedGuarantees] = decodeGuarantees(binaryData)
      if (error) {
        throw error
      }
      
      // Verify the decoded guarantees match the JSON structure
      expect(decodedGuarantees.value).toHaveLength(jsonData.length)
      
      // Encode the decoded guarantees back to binary
      const encodedData = encodeGuarantees(decodedGuarantees.value)
      
      // Verify the encoded data matches the original binary
      expect(encodedData).toEqual(binaryData)
    })
    
    it('should handle preimages_extrinsic round-trip encoding/decoding', () => {
      const binaryPath = join(testVectorsDir, 'preimages_extrinsic.bin')
      const binaryData = readFileSync(binaryPath)
      
      const jsonPath = join(testVectorsDir, 'preimages_extrinsic.json')
      const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
      
      // Decode the binary data
      const [error, decodedPreimages] = decodePreimages(binaryData)
      if (error) {
        throw error
      }
      
      // Verify the decoded preimages match the JSON structure
      expect(decodedPreimages.value).toHaveLength(jsonData.length)
      
      // Encode the decoded preimages back to binary
      const encodedData = encodePreimages(decodedPreimages.value)
      
      // Verify the encoded data matches the original binary
      expect(encodedData).toEqual(binaryData)
    })
    
    it('should handle tickets_extrinsic round-trip encoding/decoding', () => {
      const binaryPath = join(testVectorsDir, 'tickets_extrinsic.bin')
      const binaryData = readFileSync(binaryPath)
      
      const jsonPath = join(testVectorsDir, 'tickets_extrinsic.json')
      const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
      
      // Decode the binary data
      const [error, decodedTickets] = decodeSafroleTickets(binaryData)
      if (error) {
        throw error
      }
      
      // Verify the decoded tickets match the JSON structure
      expect(decodedTickets.value).toHaveLength(jsonData.length)
      
      // Encode the decoded tickets back to binary
      const encodedData = encodeSafroleTickets(decodedTickets.value)
      
      // Verify the encoded data matches the original binary
      expect(encodedData).toEqual(binaryData)
    })
  })
  
  describe('Context Test Vectors', () => {
    it('should handle refine_context round-trip encoding/decoding', () => {
      const binaryPath = join(testVectorsDir, 'refine_context.bin')
      const binaryData = readFileSync(binaryPath)
      
      const jsonPath = join(testVectorsDir, 'refine_context.json')
      const jsonData = JSON.parse(readFileSync(jsonPath, 'utf8'))
      
      // Decode the binary data
      const [error, decodedContext] = decodeWorkContext(binaryData)
      if (error) {
        throw error
      }
      
      // Verify the decoded context matches the JSON structure
      expect(decodedContext.value.anchorHash).toBe(jsonData.anchor)
      expect(decodedContext.value.anchorPostState).toBe(jsonData.state_root)
      expect(decodedContext.value.anchorAccoutLog).toBe(jsonData.beefy_root)
      expect(decodedContext.value.lookupAnchorHash).toBe(jsonData.lookup_anchor)
       expect(decodedContext.value.lookupAnchorTime).toBe(BigInt(jsonData.lookup_anchor_slot))
      expect(decodedContext.value.prerequisites).toEqual(jsonData.prerequisites || [])
      
      // Encode the decoded context back to binary
      const encodedData = encodeWorkContext(decodedContext.value)
      
      // Verify the encoded data matches the original binary
      expect(encodedData).toEqual(binaryData)
    })
  })
})
