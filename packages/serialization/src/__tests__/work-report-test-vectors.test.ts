import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { decodeWorkReport, encodeWorkReport } from '../work-package/work-report'

describe('Work Report Test Vectors - Round Trip Encoding/Decoding', () => {
  const testVectorsDir = join(__dirname, '../../../../submodules/jamtestvectors/codec/full')

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
    expect(decodedReport.package_spec.hash).toBe(jsonData.package_spec.hash)
    expect(decodedReport.package_spec.length).toBe(BigInt(jsonData.package_spec.length))
    expect(decodedReport.package_spec.erasure_root).toBe(jsonData.package_spec.erasure_root)
    expect(decodedReport.package_spec.exports_root).toBe(jsonData.package_spec.exports_root)
    expect(decodedReport.package_spec.exports_count).toBe(BigInt(jsonData.package_spec.exports_count))
    
    // Check context
    expect(decodedReport.context.anchor).toBe(jsonData.context.anchor)
    expect(decodedReport.context.state_root).toBe(jsonData.context.state_root)
    expect(decodedReport.context.beefy_root).toBe(jsonData.context.beefy_root)
    expect(decodedReport.context.lookup_anchor).toBe(jsonData.context.lookup_anchor)
    expect(decodedReport.context.lookup_anchor_slot).toBe(BigInt(jsonData.context.lookup_anchor_slot))
    
    // Check core_index
    expect(decodedReport.core_index).toBe(BigInt(jsonData.core_index))
    
    // Check authorizer_hash
    expect(decodedReport.authorizer_hash).toBe(jsonData.authorizer_hash)
    
    // Check auth_output
    expect(decodedReport.auth_output).toBe(jsonData.auth_output)
    
    // Check results
    expect(decodedReport.results).toHaveLength(jsonData.results.length)
    
    // Encode the decoded report back to binary
    const [encodeError, encodedData] = encodeWorkReport(decodedReport)
    if (encodeError) {
      throw encodeError
    }
    
    // Verify the encoded data matches the original binary
    expect(encodedData).toEqual(binaryData)
  })
    
  // Note: work_result tests skipped - decodeWorkResult function not yet implemented
})
