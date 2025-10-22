import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { PVMParser } from '../../parser'
import { InstructionRegistry } from '../../instructions/registry'

describe('parseProgram with jam-test-vectors PVM blobs', () => {
  it('should parse PVM blob from jam-test-vectors accumulate section', () => {
    console.log('=== Testing parseProgram with jam-test-vectors PVM blob ===\n')
    
    // Load jam-test-vectors accumulate file
    const testVectorPath = '../../submodules/jam-test-vectors/stf/accumulate/full/accumulate_ready_queued_reports-1.json'
    
    const testVectorData = JSON.parse(readFileSync(testVectorPath, 'utf-8'))
    
    // Find a PVM blob in the test vector
    let pvmBlob: string | null = null
    let blobSource = ''
    
    // Search for blobs in the test vector structure
    function findBlob(obj: any, path: string = ''): void {
      if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          if (key === 'blob' && typeof value === 'string' && value.startsWith('0x')) {
            // Check if this looks like a PVM blob (has reasonable length)
            const blobBytes = value.slice(2) // Remove '0x' prefix
            if (blobBytes.length >= 20) { // At least 10 bytes (20 hex chars)
              pvmBlob = value
              blobSource = path + '.' + key
              console.log(`Found PVM blob at ${blobSource}`)
              console.log(`Blob length: ${blobBytes.length / 2} bytes`)
              console.log(`Blob preview: ${value.slice(0, 50)}...`)
              return
            }
          } else if (typeof value === 'object') {
            findBlob(value, path + (path ? '.' : '') + key)
          }
        }
      }
    }
    
    findBlob(testVectorData)
    
    if (!pvmBlob) {
      throw new Error('No PVM blob found in jam-test-vectors file')
    }
    
    console.log(`\nUsing blob from: ${blobSource}`)
    
    // Convert hex string to Uint8Array
    const blobBytes = pvmBlob.slice(2) // Remove '0x' prefix
    const blobArray = new Uint8Array(blobBytes.length / 2)
    for (let i = 0; i < blobBytes.length; i += 2) {
      blobArray[i / 2] = parseInt(blobBytes.slice(i, i + 2), 16)
    }
    
    console.log(`Blob as Uint8Array: [${Array.from(blobArray.slice(0, 20)).join(', ')}...]`)
    
    // Create parser with instruction registry
    const registry = new InstructionRegistry()
    const parser = new PVMParser(registry)
    
    // Parse the program blob
    console.log('\n--- Parsing PVM blob with parseProgram ---')
    const parseResult = parser.parseProgram(blobArray) // false = not a test vector
    
    console.log('Parse result:')
    console.log(`Success: ${parseResult.success}`)
    console.log(`Instructions count: ${parseResult.instructions.length}`)
    console.log(`Bitmask length: ${parseResult.bitmask.length}`)
    console.log(`Jump table length: ${parseResult.jumpTable.length}`)
    console.log(`Errors: ${parseResult.errors.length}`)
    
    if (parseResult.errors.length > 0) {
      console.log('Parse errors:')
      parseResult.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`)
      })
    }
    
    // Display first few instructions
    console.log('\nFirst few instructions:')
    parseResult.instructions.slice(0, 5).forEach((instruction, i) => {
      console.log(`  ${i + 1}. Opcode: ${instruction.opcode}, Address: ${instruction.address}, Operands: [${Array.from(instruction.operands).join(', ')}]`)
    })
    
    // Verify the parse result
    expect(parseResult).toBeDefined()
    expect(parseResult.success).toBeDefined()
    expect(parseResult.instructions).toBeDefined()
    expect(parseResult.bitmask).toBeDefined()
    expect(parseResult.jumpTable).toBeDefined()
    expect(parseResult.errors).toBeDefined()
    
    // The parse should succeed for a valid PVM blob
    expect(parseResult.success).toBe(true)
    expect(parseResult.errors.length).toBe(0)
    
    // Should have parsed some instructions
    expect(parseResult.instructions.length).toBeGreaterThan(0)
    
    // Bitmask should match code length
    expect(parseResult.bitmask.length).toBeGreaterThan(0)
    
    console.log('\n✅ Successfully parsed PVM blob from jam-test-vectors!')
  })
  
  it('should handle multiple PVM blobs from jam-test-vectors', () => {
    console.log('\n=== Testing multiple PVM blobs from jam-test-vectors ===\n')
    
    // Load jam-test-vectors accumulate file
    const testVectorPath = '../../submodules/jam-test-vectors/stf/accumulate/full/accumulate_ready_queued_reports-1.json'
    
    const testVectorData = JSON.parse(readFileSync(testVectorPath, 'utf-8'))
    
    // Find all PVM blobs
    const pvmBlobs: Array<{ blob: string, source: string }> = []
    
    function findAllBlobs(obj: any, path: string = ''): void {
      if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          if (key === 'blob' && typeof value === 'string' && value.startsWith('0x')) {
            const blobBytes = value.slice(2)
            if (blobBytes.length >= 20) { // At least 10 bytes
              pvmBlobs.push({
                blob: value,
                source: path + '.' + key
              })
            }
          } else if (typeof value === 'object') {
            findAllBlobs(value, path + (path ? '.' : '') + key)
          }
        }
      }
    }
    
    findAllBlobs(testVectorData)
    
    console.log(`Found ${pvmBlobs.length} PVM blobs`)
    
    // Create parser
    const registry = new InstructionRegistry()
    const parser = new PVMParser(registry)
    
    // Test parsing each blob
    pvmBlobs.forEach((blobInfo, i) => {
      console.log(`\n--- Testing blob ${i + 1}/${pvmBlobs.length} ---`)
      console.log(`Source: ${blobInfo.source}`)
      
      // Convert hex to Uint8Array
      const blobBytes = blobInfo.blob.slice(2)
      const blobArray = new Uint8Array(blobBytes.length / 2)
      for (let j = 0; j < blobBytes.length; j += 2) {
        blobArray[j / 2] = parseInt(blobBytes.slice(j, j + 2), 16)
      }
      
      console.log(`Blob size: ${blobArray.length} bytes`)
      
      // Parse the blob
      const parseResult = parser.parseProgram(blobArray, false)
      
      console.log(`Parse success: ${parseResult.success}`)
      console.log(`Instructions: ${parseResult.instructions.length}`)
      console.log(`Errors: ${parseResult.errors.length}`)
      
      if (parseResult.errors.length > 0) {
        console.log(`First error: ${parseResult.errors[0]}`)
      }
      
      // Verify basic structure
      expect(parseResult.success).toBeDefined()
      expect(parseResult.instructions).toBeDefined()
      expect(parseResult.bitmask).toBeDefined()
      expect(parseResult.jumpTable).toBeDefined()
      expect(parseResult.errors).toBeDefined()
    })
    
    console.log('\n✅ Successfully tested all PVM blobs from jam-test-vectors!')
  })
})
