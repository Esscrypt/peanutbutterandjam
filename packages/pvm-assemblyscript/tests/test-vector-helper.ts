/**
 * Helper utilities for PVM test vector loading and execution
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
// import { instantiate } from '@assemblyscript/loader'
import { instantiate } from './wasmAsInit'
import { logger } from '@pbnj/core'
import { PVMParser } from '@pbnj/pvm'

// PVM page size (4KB)
const PAGE_SIZE = 4096

/**
 * Parse JSON with all numbers as strings to avoid precision loss
 * Wraps all numeric values in quotes before parsing
 */
export function parseJsonSafe(jsonString: string): unknown {
  // Wrap all numbers in quotes to avoid precision loss
  // Match all standalone numbers (not already in quotes) and wrap them
  // This regex matches: optional opening bracket/colon/comma + optional whitespace + digits + optional whitespace + comma/brace/bracket
  const quoted = jsonString.replace(/([:\[,]|^)\s*(\d+)\s*(?=[,\}\]])/gm, '$1"$2"')
  return JSON.parse(quoted)
}

export interface PVMTestVector {
  name: string
  program: (number | string)[] // all numbers as strings to preserve precision
  'initial-regs': (number | string)[]
  'initial-pc': number | string
  'initial-gas': number | string
  'initial-page-map'?: Array<{
    address: number | string
    length: number | string
    'is-writable': boolean
  }>
  'initial-memory'?: Array<{
    address: number | string
    contents: (number | string)[]
  }>
  'expected-regs': (number | string)[]
  'expected-pc': number | string
  'expected-gas': number | string
  'expected-status': string
  'expected-memory'?: Array<{
    address: number | string
    contents: (number | string)[]
  }>
  'expected-page-fault-address'?: number | string
}

/**
 * Get the test vectors directory path
 */
export function getTestVectorsDir(): string {
  const projectRoot = process.cwd().includes('/packages/pvm')
    ? process.cwd().split('/packages/pvm')[0]
    : process.cwd()
  return join(projectRoot, 'submodules', 'pvm-test-vectors', 'pvm', 'programs')
}

/**
 * Load test vectors matching a set of patterns
 */
export function loadTestVectors(patterns: string[]): PVMTestVector[] {
  const testVectorsDir = getTestVectorsDir()
  const testVectors: PVMTestVector[] = []

  for (const pattern of patterns) {
    try {
      const filePath = join(testVectorsDir, `${pattern}.json`)
      const fileContents = readFileSync(filePath, 'utf-8')
      const testVector = parseJsonSafe(fileContents) as PVMTestVector
      testVectors.push(testVector)
      // biome-ignore lint/suspicious/noCatchAllowedError: File might not exist, intentionally skip
    } catch {
      // File might not exist, that's okay - skip it
      continue
    }
  }

  return testVectors
}

/**
 * Load all test vectors matching a prefix
 */
export function loadTestVectorsByPrefix(prefix: string): PVMTestVector[] {
  const testVectorsDir = getTestVectorsDir()
  const allFiles = readdirSync(testVectorsDir)
  const matchingFiles = allFiles.filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
  
  const testVectors: PVMTestVector[] = []
  for (const file of matchingFiles) {
    try {
      const filePath = join(testVectorsDir, file)
      const fileContents = readFileSync(filePath, 'utf-8')
      const testVector = parseJsonSafe(fileContents) as PVMTestVector
      testVectors.push(testVector)
      // biome-ignore lint/suspicious/noCatchAllowedError: Failed to parse file, intentionally skip
    } catch {
      // Failed to parse file - skip it
      continue
    }
  }

  return testVectors
}

/**
 * Dump memory state for debugging
 */
function dumpMemoryState(wasm: WebAssembly.Instance, testVectorName?: string): void {
  try {
    console.log('\n🔍 MEMORY DUMP ON ERROR:')
    console.log('='.repeat(80))
    
    if (testVectorName) {
      console.log(`Test Vector: ${testVectorName}`)
    }
    
    // Dump registers
    try {
      // getRegisters() returns a pointer - use loader helper to lift it
      const regs = wasm.getRegisters()
      if (regs && regs.length >= 104) {
        const regView = new DataView(regs.buffer)
        console.log('\n📊 Registers:')
        for (let i = 0; i < 13; i++) {
          const value = regView.getBigUint64(i * 8, true)
          console.log(`  r${i}: 0x${value.toString(16).padStart(16, '0')} (${value.toString()})`)
        }
      } else {
        console.log('  ⚠️  Registers array too short or null:', regs?.length ?? 'null')
      }
    } catch (e) {
      console.log('  ❌ Failed to get registers:', e)
    }
    
    // Dump PC, gas, status
    try {
      console.log('\n📊 State:')
      console.log(`  PC: ${wasm.getProgramCounter()}`)
      console.log(`  Gas: ${wasm.getGasLeft()}`)
      console.log(`  Status: ${wasm.getStatus()}`)
      console.log(`  Exit Arg: ${wasm.getExitArg()}`)
    } catch (e) {
      console.log('  ❌ Failed to get state:', e)
    }
    
    // Dump memory pages (first few pages)
    try {
      console.log('\n📊 Memory Pages (first 10 pages):')
      for (let pageIndex = 0; pageIndex < 10; pageIndex++) {
        const pageData = wasm.getPageDump(pageIndex)
        if (pageData && pageData.length > 0) {
          // Show first 64 bytes of non-zero data
          const nonZeroBytes: number[] = []
          for (let i = 0; i < Math.min(64, pageData.length); i++) {
            if (pageData[i] !== 0) {
              nonZeroBytes.push(i)
            }
          }
          if (nonZeroBytes.length > 0) {
            console.log(`  Page ${pageIndex} (addr 0x${(pageIndex * PAGE_SIZE).toString(16)}):`)
            console.log(`    Non-zero bytes at offsets: ${nonZeroBytes.slice(0, 20).join(', ')}${nonZeroBytes.length > 20 ? '...' : ''}`)
            // Show first few non-zero values
            const sampleValues = nonZeroBytes.slice(0, 10).map(offset => ({
              offset,
              value: pageData[offset],
            }))
            console.log(`    Sample values: ${sampleValues.map(v => `[${v.offset}]=0x${v.value.toString(16)}`).join(', ')}`)
          }
        }
      }
    } catch (e) {
      console.log('  ❌ Failed to get memory pages:', e)
    }
    
    console.log('='.repeat(80))
    console.log('')
  } catch (e) {
    console.log('❌ Failed to dump memory state:', e)
  }
}

/**
 * Load WASM module (creates new instance for each test)
 */
async function loadWasmModule(): Promise<any> {
  // Get path relative to test file location
  const testVectorsDir = getTestVectorsDir()
  const projectRoot = testVectorsDir.split('/submodules/')[0]
  const wasmPath = join(projectRoot, 'packages', 'pvm-assemblyscript', 'build', 'debug.wasm')
  
  // Create a new instance for each test to ensure clean state
  const wasmModule = await instantiate(
    readFileSync(wasmPath),
  )
  
  return wasmModule
}


/**
 * Execute a test vector and return the resulting state
 */
export async function executeTestVector(testVector: PVMTestVector): Promise<{
  registers: Uint8Array // 104 bytes (13 registers x 8 bytes each, little-endian)
  pc: number
  gas: number
  status: string
  faultAddress: bigint | null
  memory: Map<bigint, number>
  parseResult: { instructions: Array<{ opcode: bigint; operands: Uint8Array; pc: bigint }>; jumpTable: bigint[]; bitmask: Uint8Array; success: boolean }
}> {
  // Load WASM module
  const wasm = await loadWasmModule()
  
  // Set current test vector for error reporting
  // ;(wasm as any).__currentTestVector = testVector.name

  // Convert program bytes to Uint8Array
  const programBytes = testVector.program.map(Number)
  const programBlob = new Uint8Array(programBytes)

  // Initialize WASM PVM
  // Always call init() to create a fresh PVM instance for each test
  // If the WASM module is in a bad state from a previous panic, it will be reloaded
  // Use SimpleRAM for test vectors (simpler memory model)
  // RAMType: 0=PVMRAM, 1=SimpleRAM, 2=MockRAM
  wasm.init(1) // RAMType.SimpleRAM

  // Create initial registers (13 x 8 bytes = 104 bytes)
  const initialRegisters = new Uint8Array(104)
  const initialRegisterView = new DataView(initialRegisters.buffer)
  for (let i = 0; i < 13; i++) {
    const value = BigInt(String(testVector['initial-regs'][i]))
    initialRegisterView.setBigUint64(i * 8, value, true)
  }

  // Set gas and initial PC
  const initialGas = BigInt(String(testVector['initial-gas']))
  wasm.setGasLeft(initialGas)
  // @assemblyscript/loader automatically converts Uint8Array to Array<u8>
  wasm.setRegisters(initialRegisters)

  const initialPC = Number(testVector['initial-pc'])
  if (initialPC !== 0) {
    wasm.setNextProgramCounter(initialPC)
  }

  // Initialize pages from initial-page-map first (like TypeScript test helper)
  // TypeScript helper: 1) ram.initializePage() for each page, 2) ram.writeOctetsDuringInitialization() for each memory block
  if (testVector['initial-page-map']) {
    for (const page of testVector['initial-page-map']) {
      const address = Number(page.address)
      const length = Number(page.length)
      const isWritable = page['is-writable']
      
      // Convert boolean to access type (0=NONE, 1=READ, 2=WRITE)
      // Test vectors only use read vs write
      const accessType = isWritable ? 2 : 1 // WRITE=2, READ=1
      
      // Initialize page in RAM (matches TypeScript: ram.initializePage())
      try {
        wasm.initPage(address, length, accessType)
      } catch (error) {
        console.error(`❌ Error initializing page at address 0x${address.toString(16)}:`, error)
        dumpMemoryState(wasm, testVector.name)
        throw error
      }
    }
  }

  // Set initial memory (like TypeScript test helper)
  // During initialization, we can write to any initialized page regardless of access type
  if (testVector['initial-memory']) {
    for (const memBlock of testVector['initial-memory']) {
      const address = Number(memBlock.address)
      const contents = memBlock.contents.map(Number)
      const values = new Uint8Array(contents)
      
      // @assemblyscript/loader automatically converts Uint8Array to Array<u8>
      try {
        wasm.setMemory(address, values)
      } catch (error) {
        console.error(`❌ Error setting memory at address 0x${address.toString(16)}:`, error)
        dumpMemoryState(wasm, testVector.name)
        throw error
      }
      
      // Debug: Verify memory was written correctly (for failing tests)
      const pageIndex = Math.floor(address / PAGE_SIZE)
      const pageOffset = address % PAGE_SIZE
      const pageData = wasm.getPageDump(pageIndex)
      if (pageData && pageData.length > 0) {
        const writtenData = pageData.slice(pageOffset, pageOffset + values.length)
        const match = Array.from(values).every((v, i) => v === writtenData[i])
        
        // Get registers for debugging
        // getRegisters() returns a pointer - use loader helper to lift it
        const regsCopy =  wasm.getRegisters()
        const regView = new DataView(regsCopy.buffer)
        const registers: Record<string, string> = {}
        for (let i = 0; i < 13; i++) {
          const value = regView.getBigUint64(i * 8, true)
          registers[`r${i}`] = `0x${value.toString(16)} (${value.toString()})`
        }
        
        console.log('🔍 DEBUG: Memory write verification', {
          address: `0x${address.toString(16)}`,
          pageIndex,
          pageOffset,
          expected: Array.from(values),
          actual: Array.from(writtenData),
          match,
          registers,
          pc: wasm.getProgramCounter(),
          gas: Number(wasm.getGasLeft()),
          status: wasm.getStatus(),
        })
        
        if (!match) {
          console.log('❌ Memory write verification FAILED')
        }
      } else {
        // Get registers for debugging even when page data is missing
        // getRegisters() returns a pointer - use loader helper to lift it
        const regs = wasm.getRegisters()
        const regView = new DataView(regs.buffer)
        const registers: Record<string, string> = {}
        for (let i = 0; i < 13; i++) {
          const value = regView.getBigUint64(i * 8, true)
          registers[`r${i}`] = `0x${value.toString(16)} (${value.toString()})`
        }
        
        console.log('🔍 DEBUG: Memory write verification FAILED - pagePtr is 0', {
          address: `0x${address.toString(16)}`,
          pageIndex,
          registers,
          pc: wasm.getProgramCounter(),
          gas: Number(wasm.getGasLeft()),
          status: wasm.getStatus(),
        })
      }
    }
  }

  // Debug: Check state before execution
  if (testVector.name === 'gas_basic_consume_all') {
    console.log('🔍 DEBUG: Before runBlob', {
      programBlob: Array.from(programBlob),
      programBlobLength: programBlob.length,
      initialGas: Number(initialGas),
      initialPC,
      pcBefore: wasm.getProgramCounter(),
      gasBefore: Number(wasm.getGasLeft()),
      statusBefore: wasm.getStatus(),
    })
    
    // Try to decode manually to see what we get
    // Program: [0, 0, 2, 100, 0, 1]
    // Should decode to: jumpTableLength=0, elementSize=0, codeLength=2, code=[100,0], bitmask=[1,0]
    console.log('🔍 DEBUG: Manual decode check', {
      byte0_jumpTableLength: programBlob[0],
      byte1_elementSize: programBlob[1],
      byte2_codeLength: programBlob[2],
      codeBytes: [programBlob[3], programBlob[4]],
      bitmaskByte: programBlob[5],
      expectedBitmask: [1, 0], // bitmask byte 1 = 0b00000001, expanded for codeLength=2
    })
  }

  // Execute program using runBlob() - decoding happens inside WASM
  // Test vectors use deblob format, not preimage format
  // Use wrapped runBlob which expects Uint8Array
  
  // Debug for specific tests
  if (testVector.name === 'inst_store_imm_indirect_u16_without_offset_ok' || 
      testVector.name === 'inst_store_imm_indirect_u16_with_offset_ok' || 
      testVector.name === 'inst_store_imm_indirect_u16_with_offset_nok') {
    console.log('🔍 DEBUG: Before runBlob', {
      name: testVector.name,
      programBlob: Array.from(programBlob),
      initialPC: wasm.getProgramCounter(),
      initialGas: Number(wasm.getGasLeft()),
      initialStatus: wasm.getStatus(),
    })
  }
  
  wasm.runBlob(programBlob)
  
  // Debug for specific tests
  if (testVector.name === 'inst_store_imm_indirect_u16_without_offset_ok' || 
      testVector.name === 'inst_store_imm_indirect_u16_with_offset_ok' || 
      testVector.name === 'inst_store_imm_indirect_u16_with_offset_nok') {
    console.log('🔍 DEBUG: After runBlob', {
      name: testVector.name,
      finalPC: wasm.getProgramCounter(),
      finalGas: Number(wasm.getGasLeft()),
      finalStatus: wasm.getStatus(),
      exitArg: wasm.getExitArg(),
      expectedPC: Number(testVector['expected-pc']),
    })
  }
  
  // Use __getUint8ArrayView for a live view (faster) or __getUint8Array for a copy
  const finalRegisters = wasm.getRegisters()

  // Get final state
  const finalPC = wasm.getProgramCounter()
  const finalGas = wasm.getGasLeft()
  const wasmStatus = wasm.getStatus()
  const exitArg = wasm.getExitArg()

  // Debug: Check state after execution
  if (testVector.name === 'gas_basic_consume_all') {
    console.log('🔍 DEBUG: After runBlob', {
      finalPC,
      finalGas: Number(finalGas),
      wasmStatus,
      exitArg,
      gasConsumed: Number(initialGas) - Number(finalGas),
      pcAdvanced: finalPC - initialPC,
    })
  }

  // Map WASM status to test vector status string
  // WASM Status enum: OK=0, HALT=1, PANIC=2, FAULT=3, HOST=4, OOG=5
  // Test vector status: 'halt', 'panic', 'page-fault', 'host', 'out-of-gas'
  const statusMap: Record<number, string> = {
    0: 'halt', // OK shouldn't happen after execution
    1: 'halt',
    2: 'panic',
    3: 'page-fault',
    4: 'host',
    5: 'out-of-gas',
  }
  const status = statusMap[wasmStatus] || 'panic'

  // Extract final memory state
  const finalMemory = new Map<bigint, number>()
  if (testVector['expected-memory']) {
    for (const memBlock of testVector['expected-memory']) {
      const address = BigInt(memBlock.address)
      const length = memBlock.contents.length
      
      // Calculate page index (page size is 4096)
      const pageSize = PAGE_SIZE
      const pageIndex = Math.floor(Number(address) / pageSize)
      
      // @assemblyscript/loader returns a pointer, so we need to lift it manually
      const pageData = wasm.getPageDump(pageIndex)
      if (pageData && pageData.length > 0) {
        for (let i = 0; i < length; i++) {
          const addr = address + BigInt(i)
          const pageIdx = Math.floor(Number(addr) / pageSize)
          const offset = Number(addr) % pageSize
          
          if (pageIdx === pageIndex) {
            finalMemory.set(addr, pageData[offset])
          } else {
            // Read from different page
            const otherPageData = wasm.getPageDump(pageIdx)
            if (otherPageData && otherPageData.length > 0) {
              finalMemory.set(addr, otherPageData[offset])
            }
          }
        }
      }
    }
  }

  // Fault address from WASM (exitArg contains fault address for FAULT status)
  // exitArg is 0 if no fault address, otherwise contains the fault address
  const faultAddress: bigint | null = wasmStatus === 3 ? (exitArg !== 0 ? BigInt(exitArg) : null) : null

  return {
    registers: finalRegisters,
    pc: finalPC,
    gas: Number(finalGas),
    status,
    faultAddress,
    memory: finalMemory,
    parseResult: {
      instructions: [],
      jumpTable: [],
      bitmask: new Uint8Array(0),
      success: true,
    },
  }
}

/**
 * Execute a test vector using runProgram with PVMRAM (real memory)
 * This uses the prepareProgram/runProgram API instead of runBlob
 */
export async function executeTestVectorWithRunProgram(testVector: PVMTestVector): Promise<{
  registers: Uint8Array // 104 bytes (13 registers x 8 bytes each, little-endian)
  pc: number
  gas: number
  status: string
  faultAddress: bigint | null
  memory: Map<bigint, number>
  parseResult: { instructions: Array<{ opcode: bigint; operands: Uint8Array; pc: bigint }>; jumpTable: bigint[]; bitmask: Uint8Array; success: boolean }
}> {
  // Load WASM module
  const wasm = await loadWasmModule()
  
  // Convert program bytes to Uint8Array
  const programBytes = testVector.program.map(Number)
  const program = new Uint8Array(programBytes)

  // Initialize WASM PVM with PVMRAM (real memory)
  wasm.init(0) // RAMType.PVMRAM

  // Create initial registers as Uint8Array (104 bytes: 13 registers x 8 bytes each, little-endian)
  const initialRegisters = new Uint8Array(104)
  const initialRegisterView = new DataView(initialRegisters.buffer)
  for (let i = 0; i < 13; i++) {
    const value = BigInt(String(testVector['initial-regs'][i]))
    initialRegisterView.setBigUint64(i * 8, value, true)
  }

  // Initialize program using initializeProgram (sets up code, bitmask, jumpTable)
  wasm.initializeProgram(program, new Uint8Array(0)) // args (empty for test vectors)

  // Set gas and initial PC
  const initialGas = BigInt(String(testVector['initial-gas']))
  wasm.setGasLeft(initialGas)
  wasm.setRegisters(initialRegisters)

  const initialPC = Number(testVector['initial-pc'])
  if (initialPC !== 0) {
    wasm.setNextProgramCounter(initialPC)
  }

  // Initialize pages from initial-page-map (like executeTestVector)
  if (testVector['initial-page-map']) {
    for (const page of testVector['initial-page-map']) {
      const address = Number(page.address)
      const length = Number(page.length)
      const isWritable = page['is-writable']
      
      // Convert boolean to access type (0=NONE, 1=READ, 2=WRITE)
      const accessType = isWritable ? 2 : 1 // WRITE=2, READ=1
      
      try {
        wasm.initPage(address, length, accessType)
      } catch (error) {
        console.error(`❌ Error initializing page at address 0x${address.toString(16)}:`, error)
        dumpMemoryState(wasm, testVector.name)
        throw error
      }
    }
  }

  // Set initial memory (like executeTestVector)
  if (testVector['initial-memory']) {
    for (const memBlock of testVector['initial-memory']) {
      const address = Number(memBlock.address)
      const contents = memBlock.contents.map(Number)
      const values = new Uint8Array(contents)
      
      try {
        wasm.setMemory(address, values)
      } catch (error) {
        console.error(`❌ Error setting memory at address 0x${address.toString(16)}:`, error)
        dumpMemoryState(wasm, testVector.name)
        throw error
      }
    }
  }

  // Execute using runBlob (since we already initialized the program)
  wasm.runProgram()

  // Extract results from VmOutput
  // VmOutput: { status, registers, pc, memory, gas, exitCode }
  const wasmStatus = wasm.getStatus()
  const finalPC = wasm.getProgramCounter()
  const finalGas = wasm.getGasLeft()
  const exitCode = wasm.getExitArg()

  // Map WASM status to test vector status string
  // WASM Status enum: OK=0, HALT=1, PANIC=2, FAULT=3, HOST=4, OOG=5
  // Test vector status: 'halt', 'panic', 'page-fault', 'host', 'out-of-gas'
  const statusMap: Record<number, string> = {
    0: 'halt', // OK shouldn't happen after execution
    1: 'halt',
    2: 'panic',
    3: 'page-fault',
    4: 'host',
    5: 'out-of-gas',
  }
  const status = statusMap[wasmStatus] || 'panic'

  // Get final state (same as executeTestVector)
  const finalRegisters = wasm.getRegisters()

  // Extract final memory state (same as executeTestVector)
  const finalMemory = new Map<bigint, number>()

  // Also check expected-memory from test vector if available
  if (testVector['expected-memory']) {
    for (const memBlock of testVector['expected-memory']) {
      const address = BigInt(memBlock.address)
      const length = memBlock.contents.length
      
      // Calculate page index (page size is 4096)
      const pageSize = PAGE_SIZE
      const pageIndex = Math.floor(Number(address) / pageSize)
      
      // Get page dump to read actual memory
      const pageData = wasm.getPageDump(pageIndex)
      if (pageData && pageData.length > 0) {
        for (let i = 0; i < length; i++) {
          const addr = address + BigInt(i)
          const pageIdx = Math.floor(Number(addr) / pageSize)
          const offset = Number(addr) % pageSize
          
          if (pageIdx === pageIndex) {
            finalMemory.set(addr, pageData[offset])
          } else {
            // Read from different page
            const otherPageData = wasm.getPageDump(pageIdx)
            if (otherPageData && otherPageData.length > 0) {
              finalMemory.set(addr, otherPageData[offset])
            }
          }
        }
      }
    }
  }

  // Fault address from exitCode (for FAULT status)
  const faultAddress: bigint | null = wasmStatus === 3 ? (exitCode !== 0 ? BigInt(exitCode) : null) : null

  // Parse program for debugging purposes
  let parseResult: {
    instructions: Array<{ opcode: bigint; operands: Uint8Array; pc: bigint }>
    jumpTable: bigint[]
    bitmask: Uint8Array
    success: boolean
  } = {
    instructions: [],
    jumpTable: [],
    bitmask: new Uint8Array(0),
    success: true,
  }

  try {
    const parser = new PVMParser()
    const programBytes = testVector.program.map(Number)
    const programBlob = new Uint8Array(programBytes)
    const parsed = parser.parseProgram(programBlob)
    
    parseResult = {
      instructions: parsed.instructions.map((inst) => ({
        opcode: BigInt(inst.opcode),
        operands: new Uint8Array(inst.operands),
        pc: inst.pc,
      })),
      jumpTable: parsed.jumpTable,
      bitmask: parsed.bitmask,
      success: parsed.success,
    }
  } catch (error) {
    logger.warn('Failed to parse program for debugging', { error })
    parseResult.success = false
  }

  return {
    registers: finalRegisters,
    pc: finalPC,
    gas: Number(finalGas),
    status,
    faultAddress,
    memory: finalMemory,
    parseResult,
  }
}

