import { describe, test, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { instantiate } from '@pbnj/pvm-assemblyscript/wasmAsInit'
import { FetchHostFunction, PVMRAM } from '@pbnj/pvm'
import { ConfigService } from '../../../../infra/node/services/config-service'
import { EntropyService } from '../../../../infra/node/services/entropy'
import { EventBusService, bytesToHex, concatBytes } from '@pbnj/core'
import type { HostFunctionContext, FetchParams, PartialState, Implications, ImplicationsPair, ServiceAccount } from '@pbnj/types'
import { encodeImplicationsPair, encodeFixedLength, encodeNatural, encodeProgram, encodeServiceCodeToPreimage, encodeBlob } from '@pbnj/codec'

/**
 * Test to compare FETCH host function results between TypeScript and AssemblyScript implementations
 * 
 * This test calls FETCH with selector 0 (system constants) from both implementations
 * and compares the returned binary values to ensure they match.
 */
describe('FETCH Host Function Comparison', () => {
  let configService: ConfigService
  let entropyService: EntropyService
  let tsFetchFunction: FetchHostFunction
  let wasm: Awaited<ReturnType<typeof instantiate>>
  let workspaceRoot: string

  beforeEach(async () => {
    configService = new ConfigService('tiny')
    const eventBusService = new EventBusService()
    entropyService = new EntropyService(eventBusService)

    // Initialize TypeScript FETCH host function
    tsFetchFunction = new FetchHostFunction(configService)

    // Load and initialize WASM module
    const currentDir = dirname(fileURLToPath(import.meta.url))
    
    // Calculate workspace root (packages/pvm-invocations/src/__tests__ -> packages -> root)
    workspaceRoot = join(currentDir, '..', '..', '..')
    
    // Load from pvm-assemblyscript build directory
    const wasmPath = join(workspaceRoot, 'pvm-assemblyscript', 'build', 'pvm.wasm')
    const wasmBytes = readFileSync(wasmPath)
    wasm = await instantiate(wasmBytes, {})
    
    // Initialize PVM with PVMRAM
    wasm.init(wasm.RAMType.PVMRAM)
  })

  test('should return identical system constants from TypeScript and AssemblyScript FETCH', () => {
    // Expected hex value (system constants encoded for tiny config)
    const expectedHex = '0x0a00000000000000010000000000000064000000000000000200200000000c000000809698000000000080f0fa020000000000ca9a3b00000000002d3101000000000800100008000300180000000300080006005000040080000500060000fa00008070d20000093d0004000000000c00000204000000c0000080000000000c00000a000000'
    
    // Set up registers for FETCH call
    // registers[10] = selector (0 = system constants)
    // registers[7] = output offset (where to write the data)
    // registers[8] = from offset (start offset in fetched data, 0 = start)
    // registers[9] = length (number of bytes to write, 0 = all available)
    // Use heap address (0x20000) for output - this is in a writable memory region
    const outputOffset = 0x20000n // Write to heap memory (writable region)
    const fromOffset = 0n // Start from beginning of fetched data
    const length = 0n // 0 means fetch all available data
    const selector = 0n // 0 = system constants
    const pageSize = 4096 // Page size for memory initialization

    // Create RAM for TypeScript execution
    const tsRam = new PVMRAM()
    // Initialize with a small heap to ensure heap region is writable
    // Heap needs to be large enough to accommodate the output data (system constants are ~200 bytes)
    const minHeapSize = 4096 // At least one page for the output
    tsRam.initializeMemoryLayout(
      new Uint8Array(0), // argumentData
      new Uint8Array(0), // readOnlyData
      new Uint8Array(minHeapSize).fill(0), // readWriteData - ensure heap region exists
      0, // stackSize
      0, // heapZeroPaddingSize
    )

    // Note: heapStartAddress should be 0x20000 (2 * ZONE_SIZE)
    // The heap region is now initialized and writable

    // Create TypeScript host function context
    const tsRegisters: bigint[] = new Array(13).fill(0n)
    tsRegisters[7] = outputOffset
    tsRegisters[8] = fromOffset
    tsRegisters[9] = length
    tsRegisters[10] = selector

    const tsContext: HostFunctionContext = {
      gasCounter: 1000n,
      registers: tsRegisters,
      ram: tsRam,
      log: () => {}, // No-op logger
    }

    // Create FetchParams for TypeScript
    const tsFetchParams: FetchParams = {
      workPackage: null,
      workPackageHash: null,
      authorizerTrace: null,
      workItemIndex: null,
      importSegments: null,
      exportSegments: null,
      workItemsSequence: null,
      entropyService: entropyService,
    }

    // Execute TypeScript FETCH
    const tsResult = tsFetchFunction.execute(tsContext, tsFetchParams)

    // Check that TypeScript execution succeeded
    expect(tsResult.resultCode).toBeNull() // null = continue execution (success)

    // Read the result from TypeScript memory
    const tsDataLength = tsContext.registers[7] // Length of fetched data
    expect(tsDataLength).toBeGreaterThan(0n)
    
    const [tsFetchedData, tsFault] = tsRam.readOctets(outputOffset, tsDataLength)
    expect(tsFault).toBeNull()
    expect(tsFetchedData).not.toBeNull()

    // Convert TypeScript result to hex
    const tsHex = bytesToHex(tsFetchedData!)

    // Now test AssemblyScript version
    // We need to call the FETCH host function through the WASM module
    // The WASM module has the host function registered internally
    
    // Set up WASM registers
    const wasmRegisters = new Uint8Array(104) // 13 registers * 8 bytes
    const wasmRegisterView = new DataView(wasmRegisters.buffer)
    wasmRegisterView.setBigUint64(7 * 8, outputOffset, true) // register[7] = outputOffset
    wasmRegisterView.setBigUint64(8 * 8, fromOffset, true) // register[8] = fromOffset
    wasmRegisterView.setBigUint64(9 * 8, length, true) // register[9] = length
    wasmRegisterView.setBigUint64(10 * 8, selector, true) // register[10] = selector

    // Set up accumulation invocation context to enable host functions
    // We need to provide config values for the host function to work
    const numCores = configService.numCores
    const numValidators = configService.numValidators
    const authQueueSize = 80
    const entropyAccumulator = entropyService.getEntropyAccumulator()

    // Create a minimal valid implications pair context
    // We need a valid context for setupAccumulateInvocation to work
    const serviceId = 1n
    
    // Create staging set with exactly numValidators validators (each is 336 bytes)
    // Gray Paper requires exactly Cvalcount validators in the staging set
    const stagingset: Uint8Array[] = []
    for (let i = 0; i < configService.numValidators; i++) {
      stagingset.push(new Uint8Array(336).fill(0)) // Null validators (all zeros)
    }
    
    // Create authqueue with numCores cores, each with authQueueSize entries
    const authqueue: Uint8Array[][] = []
    for (let core = 0; core < configService.numCores; core++) {
      const coreQueue: Uint8Array[] = []
      for (let i = 0; i < authQueueSize; i++) {
        coreQueue.push(new Uint8Array(32).fill(0)) // Empty hashes (all zeros)
      }
      authqueue.push(coreQueue)
    }
    
    const minimalPartialState: PartialState = {
      accounts: new Map([
        [
          serviceId,
          {
            codehash: '0x0000000000000000000000000000000000000000000000000000000000000000',
            balance: 0n,
            minaccgas: 0n,
            minmemogas: 0n,
            octets: 0n,
            gratis: 0n,
            items: 0n,
            created: 0n,
            lastacc: 0n,
            parent: 0n,
            preimages: new Map(),
            requests: new Map(),
            storage: new Map(),
          } as ServiceAccount,
        ],
      ]),
      authqueue,
      assigners: new Array(configService.numCores).fill(0n),
      stagingset,
      manager: 0n,
      registrar: 0n,
      delegator: 0n,
      alwaysaccers: new Map(),
    }

    const minimalImplications: Implications = {
      id: serviceId,
      state: minimalPartialState,
      nextfreeid: serviceId + 1n,
      xfers: [],
      yield: null,
      provisions: new Map(),
    }

    const minimalImplicationsPair: ImplicationsPair = [minimalImplications, minimalImplications]

    // Encode the implications pair context
    const [contextError, encodedContext] = encodeImplicationsPair(minimalImplicationsPair, configService)
    if (contextError || !encodedContext) {
      throw new Error(`Failed to encode context: ${contextError?.message}`)
    }

    // Encode accumulation arguments: encode(timeslot, serviceId, len(inputs))
    // Gray Paper: timeslot (4 bytes), serviceId (4 bytes), inputLength (variable natural encoding)
    const timeslot = 1n
    const inputLength = 0n // No inputs for this test
    const [timeslotError, timeslotBytes] = encodeFixedLength(timeslot, 4n)
    if (timeslotError) {
      throw new Error(`Failed to encode timeslot: ${timeslotError.message}`)
    }
    const [serviceIdError, serviceIdBytes] = encodeFixedLength(serviceId, 4n)
    if (serviceIdError) {
      throw new Error(`Failed to encode serviceId: ${serviceIdError.message}`)
    }
    const [inputLengthError, inputLengthBytes] = encodeNatural(inputLength)
    if (inputLengthError) {
      throw new Error(`Failed to encode inputLength: ${inputLengthError.message}`)
    }
    const encodedArgs = concatBytes([timeslotBytes, serviceIdBytes, inputLengthBytes])

    // Create a minimal program: ECALLI with host call ID 1 (FETCH)
    // ECALLI opcode = 10 (0x0A)
    // Operand: host call ID = 1 (FETCH)
    // Format: [opcode: 1 byte][operand: 8 bytes little-endian]
    const ecalliOpcode = 0x0A
    const fetchHostCallId = 1n
    const program = new Uint8Array(9)
    program[0] = ecalliOpcode
    const operandView = new DataView(program.buffer, 1)
    operandView.setBigUint64(0, fetchHostCallId, true)

    // Create a minimal preimage blob containing our ECALLI program
    // setupAccumulateInvocation calls initializeProgram which expects Y function format:
    // E₃(|o|) || E₃(|w|) || E₂(z) || E₃(s) || o || w || E₄(|c|) || c
    // Where:
    // - o: read-only data
    // - w: read-write data (heap)
    // - z: heap zero padding size
    // - s: stack size
    // - c: code (instructions) - THIS MUST BE IN DEBLOB FORMAT!
    //
    // The code field (c) in Y function format must be in deblob format:
    // encode(len(j)) || encode[1](z) || encode(len(c)) || encode[z](j) || encode(c) || encode(k)
    
    // First, encode the instruction code as a blob (deblob format)
    // Create bitmask: 1 bit per byte of code, marking opcodes
    // For ECALLI at position 0, bit 0 should be set
    const bitmask = new Uint8Array(program.length)
    bitmask[0] = 1 // bit 0 set = instruction at position 0
    
    // Encode code as blob (deblob format)
    const [blobError, codeBlob] = encodeBlob({
      code: program,
      bitmask,
      jumpTable: [], // Empty jump table
      elementSize: 8, // Element size in bytes (8 = u64, valid even when jump table is empty)
    })
    if (blobError || !codeBlob) {
      throw new Error(`Failed to encode blob: ${blobError?.message}`)
    }
    
    // Now encode program in Y function format, with code field in deblob format
    const [programError, programBlob] = encodeProgram({
      roData: new Uint8Array(0), // Empty read-only data
      rwData: new Uint8Array(0), // Empty read-write data
      heapZeroPaddingSize: 0, // No heap zero padding
      stackSize: 0, // No stack
      code: codeBlob, // Code blob in deblob format (not raw instructions!)
    })
    if (programError || !programBlob) {
      throw new Error(`Failed to encode program: ${programError?.message}`)
    }
    
    // Encode preimage with empty metadata
    // Preimage format: encode(len(m)) || encode(m) || encode(code_blob)
    // Where code_blob is in Y function format
    const [preimageError, preimageBlob] = encodeServiceCodeToPreimage(
      new Uint8Array(0), // Empty metadata
      programBlob, // Code blob in Y function format
    )
    if (preimageError || !preimageBlob) {
      throw new Error(`Failed to encode preimage: ${preimageError?.message}`)
    }

    // Setup accumulation invocation to initialize host function context and memory
    // This will call initializeProgram internally which sets up memory layout
    wasm.setupAccumulateInvocation(
      1000, // gasLimit
      preimageBlob, // preimageBlob with ECALLI instruction
      encodedArgs, // encodedArgs (timeslot, serviceId, inputLength)
      encodedContext, // encodedContext (valid implications pair)
      numCores,
      numValidators,
      authQueueSize,
      entropyAccumulator,
      configService.numCores,
      configService.preimageExpungePeriod,
      configService.epochDuration,
      BigInt(configService.maxBlockGas),
      BigInt(configService.maxRefineGas),
      configService.maxTicketsPerExtrinsic,
      configService.ticketsPerValidator,
      configService.slotDuration, // Pass in milliseconds, AssemblyScript will convert to seconds
      configService.rotationPeriod,
      configService.numValidators,
      configService.numEcPiecesPerSegment,
      configService.contestDuration,
      configService.maxLookupAnchorage,
      configService.ecPieceSize,
    )

    // Initialize a writable page at outputOffset for WASM (after setupAccumulateInvocation)
    // Heap region should already be initialized by setupAccumulateInvocation, but ensure it's writable
    wasm.initPage(Number(outputOffset), pageSize, 2) // 2 = write access

    // Set registers and gas after setup (setupAccumulateInvocation may have changed them)
    wasm.setRegisters(wasmRegisters)
    wasm.setGasLeft(1000n)

    // Now execute the ECALLI instruction to call FETCH

    // Set PC to 0 (start of program) - setupAccumulateInvocation should have set PC to 5, but we want 0
    wasm.setNextProgramCounter(0)

    // Execute one step (the ECALLI instruction)
    wasm.nextStep()

    // After execution, read the result from WASM memory
    const wasmRegistersAfter = wasm.getRegisters()
    const wasmRegisterViewAfter = new DataView(wasmRegistersAfter.buffer)
    const wasmDataLength = wasmRegisterViewAfter.getBigUint64(7 * 8, true) // register[7] = data length

    expect(wasmDataLength).toBeGreaterThan(0n)

    // Read data from WASM memory using getPageDump
    // Calculate which page contains the output offset
    const pageIndex = Math.floor(Number(outputOffset) / pageSize)
    const pageOffset = Number(outputOffset) % pageSize
    
    // Get the page dump (returns Uint8Array directly)
    const pageData = wasm.getPageDump(pageIndex)
    expect(pageData).not.toBeNull()
    expect(pageData.length).toBeGreaterThan(0)
    
    // Extract the fetched data from the page
    const wasmFetchedData = new Uint8Array(Number(wasmDataLength))
    for (let i = 0; i < wasmFetchedData.length && (pageOffset + i) < pageData.length; i++) {
      wasmFetchedData[i] = pageData[pageOffset + i]
    }

    // Convert WASM result to hex
    const wasmHex = bytesToHex(wasmFetchedData)

    // Compare results
    console.log('TypeScript FETCH result:', tsHex)
    console.log('AssemblyScript FETCH result:', wasmHex)
    console.log('Expected result:', expectedHex)

    // Both implementations should match the expected value exactly
    expect(tsHex).toBe(expectedHex)
    expect(wasmHex).toBe(expectedHex)
    
    // Both should have the same length
    expect(tsFetchedData!.length).toBe(wasmFetchedData.length)
    expect(tsFetchedData!.length).toBe(134) // Expected length in bytes
    
    // Compare byte by byte
    for (let i = 0; i < tsFetchedData!.length; i++) {
      expect(tsFetchedData![i]).toBe(wasmFetchedData[i])
    }
  })

  test('should return expected system constants for full config', () => {
    // Expected hex value for full config (from JIP-4 example)
    const expectedHex = '0a00000000000000010000000000000064000000000000005501004b000058020000809698000000000080f0fa020000000000f2052a0100000000c39dd00000000008001000080010004038000002000800060050000a0080000500ff0300fa00008070d20000093d00ac020000000c00000600000000c0000080000000000c0000f4010000'
    
    // Create a new config service for full config
    const fullConfigService = new ConfigService('full')
    const fullTsFetchFunction = new FetchHostFunction(fullConfigService)

    // Set up registers for FETCH call
    const outputOffset = 0x20000n
    const fromOffset = 0n
    const length = 0n
    const selector = 0n
    const pageSize = 4096

    // Create RAM for TypeScript execution
    const tsRam = new PVMRAM()
    const minHeapSize = 4096
    tsRam.initializeMemoryLayout(
      new Uint8Array(0),
      new Uint8Array(0),
      new Uint8Array(minHeapSize).fill(0),
      0,
      0,
    )

    // Create TypeScript host function context
    const tsRegisters: bigint[] = new Array(13).fill(0n)
    tsRegisters[7] = outputOffset
    tsRegisters[8] = fromOffset
    tsRegisters[9] = length
    tsRegisters[10] = selector

    const tsContext: HostFunctionContext = {
      gasCounter: 1000n,
      registers: tsRegisters,
      ram: tsRam,
      log: () => {},
    }

    // Create FetchParams for TypeScript
    const tsFetchParams: FetchParams = {
      workPackage: null,
      workPackageHash: null,
      authorizerTrace: null,
      workItemIndex: null,
      importSegments: null,
      exportSegments: null,
      workItemsSequence: null,
      entropyService: entropyService,
    }

    // Execute TypeScript FETCH
    const tsResult = fullTsFetchFunction.execute(tsContext, tsFetchParams)

    // Check that TypeScript execution succeeded
    expect(tsResult.resultCode).toBeNull()

    // Read the result from TypeScript memory
    const tsDataLength = tsContext.registers[7]
    expect(tsDataLength).toBeGreaterThan(0n)
    
    const [tsFetchedData, tsFault] = tsRam.readOctets(outputOffset, tsDataLength)
    expect(tsFault).toBeNull()
    expect(tsFetchedData).not.toBeNull()

    // Convert TypeScript result to hex
    const tsHex = bytesToHex(tsFetchedData!)

    // Verify the result matches expected value (bytesToHex includes 0x prefix)
    expect(tsHex).toBe(`0x${expectedHex}`)
    expect(tsFetchedData!.length).toBeGreaterThan(0)
  })
})

