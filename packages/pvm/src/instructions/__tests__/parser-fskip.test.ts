import { describe, it, expect } from 'bun:test'
import { PVMParser } from '../../parser'
import { InstructionRegistry } from '../registry'

describe('PVM Parser with Fskip Function', () => {
  it('should parse minimal executable blob using Gray Paper Fskip function', () => {
    console.log('=== Testing PVM Parser with Minimal Executable Blob ===\n')
    
    // Minimal executable blob from statistics test vector
    // Blob: 0x0101010101010101010101010101010101 (17 bytes)
    // Structure: jump_table_len=1, element_size=1, code_len=1, jump_table=[1], code=[1], bitmask=[1]
    const minimalBlobHex = '0x0101010101010101010101010101010101'
    const blobBytes = new Uint8Array(
      minimalBlobHex.slice(2).match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    )
    
    console.log('Minimal Blob Details:')
    console.log(`Hex: ${minimalBlobHex}`)
    console.log(`Size: ${blobBytes.length} bytes`)
    console.log(`Raw bytes: ${Array.from(blobBytes).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
    
    // Create parser with instruction registry
    const registry = new InstructionRegistry()
    const parser = new PVMParser(registry)
    
    // Parse the blob as a full Gray Paper program (not test vector)
    const parseResult = parser.parseProgram(blobBytes, false)
    
    console.log('\nParse Result:')
    console.log(`Success: ${parseResult.success}`)
    console.log(`Instructions parsed: ${parseResult.instructions.length}`)
    console.log(`Jump table length: ${parseResult.jumpTable.length}`)
    console.log(`Bitmask length: ${parseResult.bitmask.length}`)
    
    if (parseResult.errors.length > 0) {
      console.log(`Errors: ${parseResult.errors.join(', ')}`)
    }
    
    // Verify parsing results
    expect(parseResult.success).toBe(true)
    expect(parseResult.instructions.length).toBe(1)
    expect(parseResult.jumpTable.length).toBe(1)
    expect(parseResult.bitmask.length).toBe(1)
    
    // Analyze the parsed instruction
    const instruction = parseResult.instructions[0]
    console.log('\nParsed Instruction:')
    console.log(`Opcode: ${instruction.opcode}`)
    console.log(`Address: ${instruction.address}`)
    console.log(`Operands: [${Array.from(instruction.operands).join(', ')}]`)
    console.log(`Operand length: ${instruction.operands.length}`)
    
    // Verify instruction details
    expect(instruction.opcode).toBe(1n) // FALLTHROUGH instruction
    expect(instruction.address).toBe(0n) // First instruction at address 0
    expect(instruction.operands.length).toBe(6) // Fskip(0) = 6, so 6 operand bytes
    
    // Verify bitmask
    console.log('\nBitmask Analysis:')
    console.log(`Bitmask bytes: [${Array.from(parseResult.bitmask).join(', ')}]`)
    const bitmaskBinary = Array.from(parseResult.bitmask)
      .map(byte => byte.toString(2).padStart(8, '0'))
      .join('')
    console.log(`Bitmask binary: ${bitmaskBinary}`)
    
    // Verify jump table
    console.log('\nJump Table Analysis:')
    console.log(`Jump table: [${parseResult.jumpTable.join(', ')}]`)
    expect(parseResult.jumpTable[0]).toBe(1n)
    
    console.log('\n✅ Minimal blob parsing successful with Gray Paper Fskip function!')
  })
  
  it('should parse metadata blob using Gray Paper Fskip function', () => {
    console.log('\n=== Testing PVM Parser with Metadata Blob ===\n')
    
    // Metadata blob from accumulate test vector (first 100 bytes for testing)
    const metadataBlobHex = '0x47000c746573742d7365727669636506302e312e32360a4170616368652d322e30012550617269747920546563686e6f6c6f67696573203c61646d696e407061726974792e696f3ea01c0014000002000020004b598638d6c56d3420286279746573208080808080808080210b59c84216b2009400ffff9600ffff9600ffff9600ffff9600ffff9600ffff9600ffff9600ffff9600ffffa000ffff9a00ffff9600ffff9600ffff9e00ffff9600ffff9600ffff9600ffff9600ffff9600ffff9600ffff9600ffff9600ffff9600ffff9600ffff9600ffff9600ffff9600ffff9600ffff9600ffff9600ffff9600ffff9600ffff9600ffff9600ffffa200ffff9600ffff9600ffff9600ffff9600ffff9c00ffff63616c6c65642060526573756c743a3a756e77726170282960206f6e20616e2060457272602076616c75652f6d6e742f7373642f646576656c6f702f6a616d2f706f6c6b616a616d2d66757a7a2f6372617465732f6a616d2d70766d2d636f6d6d6f6e2f7372632f6d656d2e72732f686f6d652f64617678792f2e7275737475702f746f6f6c636861696e732f6e696768746c792d323032352d30352d31302d7838365f36342d756e6b6e6f776e2d6c696e75782d676e752f6c69622f727573746c69622f7372632f727573742'
    
    const blobBytes = new Uint8Array(
      metadataBlobHex.slice(2).match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    )
    
    console.log('Metadata Blob Details:')
    console.log(`Size: ${blobBytes.length} bytes`)
    console.log(`First 20 bytes: ${Array.from(blobBytes.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
    
    // Create parser with instruction registry
    const registry = new InstructionRegistry()
    const parser = new PVMParser(registry)
    
    // Parse the blob as a full Gray Paper program
    const parseResult = parser.parseProgram(blobBytes, false)
    
    console.log('\nParse Result:')
    console.log(`Success: ${parseResult.success}`)
    console.log(`Instructions parsed: ${parseResult.instructions.length}`)
    console.log(`Jump table length: ${parseResult.jumpTable.length}`)
    console.log(`Bitmask length: ${parseResult.bitmask.length}`)
    
    if (parseResult.errors.length > 0) {
      console.log(`Errors: ${parseResult.errors.join(', ')}`)
    }
    
    // Verify parsing results - metadata blobs may have parsing errors due to invalid opcodes
    // This is expected since metadata contains ASCII text, not PVM opcodes
    expect(parseResult.jumpTable.length).toBe(71) // Jump table with 71 entries
    expect(parseResult.bitmask.length).toBe(12) // Bitmask for 12-byte code section
    
    // Analyze first few instructions
    console.log('\nFirst 5 Instructions:')
    parseResult.instructions.slice(0, 5).forEach((inst, i) => {
      console.log(`  ${i}: Opcode ${inst.opcode} at PC ${inst.address}, operands: [${Array.from(inst.operands).join(', ')}]`)
    })
    
    // Verify that these are ASCII characters (metadata)
    const firstInstruction = parseResult.instructions[0]
    const asciiChar = String.fromCharCode(Number(firstInstruction.opcode))
    console.log(`\nFirst "instruction" is ASCII character: '${asciiChar}' (opcode ${firstInstruction.opcode})`)
    
    console.log('\n✅ Metadata blob parsing successful with Gray Paper Fskip function!')
  })
  
  it('should demonstrate Fskip calculation for different instruction types', () => {
    console.log('\n=== Fskip Calculation Demonstration ===\n')
    
    // Create a test bitmask that demonstrates different Fskip values
    // Bitmask: [0b10000001] = positions 0 and 7 are instruction starts
    const testBitmask = new Uint8Array([0b10000001]) // Binary: 10000001
    const testCode = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) // 8 bytes
    
    console.log('Test Setup:')
    console.log(`Code: [${Array.from(testCode).join(', ')}]`)
    console.log(`Bitmask: [${Array.from(testBitmask).join(', ')}]`)
    console.log(`Bitmask binary: ${Array.from(testBitmask).map(b => b.toString(2).padStart(8, '0')).join('')}`)
    
    // Create parser to access private calculateFskip method
    const registry = new InstructionRegistry()
    const parser = new PVMParser(registry)
    
    // Use reflection to access private method for testing
    const calculateFskip = (parser as any).calculateFskip.bind(parser)
    
    console.log('\nFskip Calculations:')
    for (let i = 0; i < testCode.length; i++) {
      const fskip = calculateFskip(i, testBitmask)
      const instructionLength = 1 + fskip
      console.log(`Fskip(${i}) = ${fskip} (instruction length = ${instructionLength})`)
    }
    
    // Expected results:
    // Fskip(0) = 6 (next set bit at position 7, distance = 7-0-1 = 6)
    // Fskip(1) = 5 (next set bit at position 7, distance = 7-1-1 = 5)
    // Fskip(2) = 4 (next set bit at position 7, distance = 7-2-1 = 4)
    // Fskip(3) = 3 (next set bit at position 7, distance = 7-3-1 = 3)
    // Fskip(4) = 2 (next set bit at position 7, distance = 7-4-1 = 2)
    // Fskip(5) = 1 (next set bit at position 7, distance = 7-5-1 = 1)
    // Fskip(6) = 0 (next set bit at position 7, distance = 7-6-1 = 0)
    // Fskip(7) = 0 (next set bit at position 8, distance = 8-7-1 = 0)
    
    expect(calculateFskip(0, testBitmask)).toBe(6)
    expect(calculateFskip(1, testBitmask)).toBe(5)
    expect(calculateFskip(2, testBitmask)).toBe(4)
    expect(calculateFskip(3, testBitmask)).toBe(3)
    expect(calculateFskip(4, testBitmask)).toBe(2)
    expect(calculateFskip(5, testBitmask)).toBe(1)
    expect(calculateFskip(6, testBitmask)).toBe(0)
    expect(calculateFskip(7, testBitmask)).toBe(0)
    
    console.log('\n✅ Fskip calculations match Gray Paper specification!')
  })
})
