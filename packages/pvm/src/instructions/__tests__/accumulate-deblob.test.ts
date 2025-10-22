import { describe, it, expect } from 'bun:test'
import { decodeBlob } from '@pbnj/serialization'
import { PVMParser } from '../../parser'
import { InstructionRegistry } from '../registry'

describe('Accumulate Test Vector PVM Blob Parsing', () => {
  it('should parse PVM blob from accumulate test vector using deblob', () => {
    // Load the accumulate test vector JSON
    const testVectorPath = '/Users/tanyageorgieva/Repos/peanutbutterandjam/submodules/jam-test-vectors/stf/accumulate/tiny/accumulate_ready_queued_reports-1.json'
    
    try {
      const fs = require('fs')
      const testVectorData = JSON.parse(fs.readFileSync(testVectorPath, 'utf8'))
      
      // Extract the first PVM blob from preimages_blob
      const accounts = testVectorData.pre_state.accounts
      expect(accounts.length).toBeGreaterThan(0)
      
      const firstAccount = accounts[0]
      const preimagesBlob = firstAccount.data.preimages_blob
      expect(preimagesBlob.length).toBeGreaterThan(0)
      
      const firstBlob = preimagesBlob[0]
      const blobHex = firstBlob.blob
      expect(blobHex).toBeDefined()
      expect(blobHex.startsWith('0x')).toBe(true)
      
      // Convert hex string to Uint8Array
      const blobBytes = new Uint8Array(
        blobHex.slice(2).match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
      )
      
      console.log('=== PVM Blob Analysis ===')
      console.log(`Blob size: ${blobBytes.length} bytes`)
      console.log(`Blob hex (first 100 bytes): ${blobHex.slice(2, 202)}`)
      
      // Try to decode the blob using deblob function
      console.log('\n=== Attempting deblob decode ===')
      const [error, decoded] = decodeBlob(blobBytes, false) // Try as full PVM program first
      
      if (error) {
        console.log(`❌ Failed to decode as full PVM program: ${error}`)
        
        // Try as test vector format
        console.log('\n=== Attempting test vector decode ===')
        const [testError, testDecoded] = decodeBlob(blobBytes, true)
        
        if (testError) {
          console.log(`❌ Failed to decode as test vector: ${testError}`)
          console.log('This blob may not be a PVM program blob')
          return
        }
        
        console.log('✅ Successfully decoded as test vector format')
        console.log('Test vector decoded info:')
        console.log(`- Jump table length: ${testDecoded.value.jumpTable.length}`)
        console.log(`- Element size: ${testDecoded.value.elementSize}`)
        console.log(`- Code length: ${testDecoded.value.code.length}`)
        console.log(`- Header size: ${testDecoded.value.headerSize}`)
        console.log(`- Has bitmask: ${testDecoded.value.bitmask.length > 0}`)
        
        if (testDecoded.value.code.length > 0) {
          console.log(`- First 20 code bytes: ${Array.from(testDecoded.value.code.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
        }
        
      } else {
        console.log('✅ Successfully decoded as full PVM program')
        console.log('Full PVM program decoded info:')
        console.log(`- Jump table length: ${decoded.value.jumpTable.length}`)
        console.log(`- Element size: ${decoded.value.elementSize}`)
        console.log(`- Code length: ${decoded.value.code.length}`)
        console.log(`- Header size: ${decoded.value.headerSize}`)
        console.log(`- Bitmask length: ${decoded.value.bitmask.length}`)
        
        if (decoded.value.code.length > 0) {
          console.log(`- First 20 code bytes: ${Array.from(decoded.value.code.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
        }
        
        if (decoded.value.bitmask.length > 0) {
          console.log(`- First 20 bitmask bytes: ${Array.from(decoded.value.bitmask.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
        }
        
        // Try to parse the instructions
        console.log('\n=== Attempting instruction parsing ===')
        const registry = new InstructionRegistry()
        const parser = new PVMParser(registry)
        
        const parseResult = parser.parseProgram(blobBytes, false)
        
        if (parseResult.success) {
          console.log(`✅ Successfully parsed ${parseResult.instructions.length} instructions`)
          console.log('First 5 instructions:')
          parseResult.instructions.slice(0, 5).forEach((inst, i) => {
            console.log(`  ${i}: ${inst.name} (opcode ${inst.opcode}) at PC ${inst.address}`)
          })
        } else {
          console.log(`❌ Failed to parse instructions: ${parseResult.errors.join(', ')}`)
        }
      }
      
    } catch (err) {
      console.error('Error loading test vector:', err)
      throw err
    }
  })
  
  it('should analyze multiple accumulate test vectors', () => {
    const testVectorFiles = [
      'accumulate_ready_queued_reports-1.json',
      'no_available_reports-1.json',
      'process_one_immediate_report-1.json'
    ]
    
    const basePath = '/Users/tanyageorgieva/Repos/peanutbutterandjam/submodules/jam-test-vectors/stf/accumulate/tiny/'
    
    console.log('\n=== Analyzing Multiple Accumulate Test Vectors ===')
    
    testVectorFiles.forEach(filename => {
      try {
        const fs = require('fs')
        const testVectorPath = basePath + filename
        const testVectorData = JSON.parse(fs.readFileSync(testVectorPath, 'utf8'))
        
        console.log(`\n--- ${filename} ---`)
        
        // Count accounts and blobs
        const accounts = testVectorData.pre_state.accounts
        console.log(`Accounts: ${accounts.length}`)
        
        let totalBlobs = 0
        accounts.forEach((account: any, i: number) => {
          const blobs = account.data.preimages_blob || []
          totalBlobs += blobs.length
          if (blobs.length > 0) {
            console.log(`  Account ${account.id}: ${blobs.length} blobs`)
            blobs.forEach((blob: any, j: number) => {
              const blobBytes = new Uint8Array(
                blob.blob.slice(2).match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
              )
              console.log(`    Blob ${j}: ${blobBytes.length} bytes, hash: ${blob.hash}`)
            })
          }
        })
        
        console.log(`Total blobs: ${totalBlobs}`)
        
      } catch (err) {
        console.log(`❌ Error analyzing ${filename}: ${err}`)
      }
    })
  })
})
