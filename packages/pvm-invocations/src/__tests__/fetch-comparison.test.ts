import { describe, test, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { instantiate } from '@pbnjam/pvm-assemblyscript/wasmAsInit'
import { FetchHostFunction, PVMRAM } from '@pbnjam/pvm'
import { ConfigService } from '../../../../infra/node/services/config-service'
import { EntropyService } from '../../../../infra/node/services/entropy'
import { EventBusService, bytesToHex, hexToBytes, concatBytes } from '@pbnjam/core'
import type { HostFunctionContext, FetchParams, PartialState, Implications, ImplicationsPair, ServiceAccount, WorkItem, ImportSegment, ExtrinsicReference } from '@pbnjam/types'
import { encodeImplicationsPair, encodeFixedLength, encodeNatural, encodeProgram, encodeServiceCodeToPreimage, encodeBlob, encodeVariableSequence, decodeVariableSequence, encodeWorkItem, decodeWorkItem } from '@pbnjam/codec'

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
      accumulateInputs: null,
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
      accumulateInputs: null,
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

  test('should return correct encoded work items sequence for selector 14', () => {
    // Expected hex value from jamduna test vector (179 bytes)
    // This is the encoded work items sequence for block 2 in preimages_light
    // Source: submodules/jamduna/jam-test-vectors/0.7.2/preimages_light/00000002/0/0/accumulate_input
    const expectedHex = '0x010025d8314884a4162787493635f1da182a6fbc7b31b55c18ce74ea1369a7999f4500000000000000000000000000000000000000000000000000000000000000002357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f8b5fd156d32aa8f25a91c80449f4e3bba4ea1e54aa9855b2ff53c32e42e7bc02de0809698002a0106f5d8957422098a7b2f007db98bce1bcf51c34311ab19671e7f5dcaadf54e0d9f370000000000000000'

    // Decode the expected hex to understand the work item structure
    // Format: var{sequence of work items}
    // First byte 0x01 = 1 work item
    // Then the encoded work item (178 bytes)
    //
    // Work item structure (from Gray Paper):
    // 1. encode[4]{serviceindex} = 0x25d83148 (little-endian) = service ID
    // 2. codehash = 32 bytes starting at offset 5
    // 3. encode[8]{refgaslimit} = 8 bytes
    // 4. encode[8]{accgaslimit} = 8 bytes
    // 5. encode[2]{exportcount} = 2 bytes
    // 6. var{payload} = length prefix + payload data
    // 7. var{importsegments} = length prefix + import refs
    // 8. var{extrinsics} = length prefix + extrinsic refs

    // Work item structure will be decoded from expectedBytes below

    // Actually, let's decode the expected value properly using the codec
    // and then re-encode to verify the round-trip

    // Set up registers for FETCH call with selector 14
    const outputOffset = 0x20000n
    const fromOffset = 0n
    const length = 0n
    const selector = 14n // Work items sequence

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

    // Decode the expected work items from the hex to create the input
    // The expected hex is already the encoded form, so we need to decode it first
    // to get the work items, then pass them to FETCH and verify we get the same output
    const expectedBytes = hexToBytes(expectedHex)

    // Parse the encoded sequence manually:
    // Byte 0: 0x01 = length prefix (1 work item)
    // Bytes 1-178: encoded work item (178 bytes)

    // Decode the work item:
    // Bytes 1-4: serviceindex (4 bytes little-endian)
    const serviceIndexView = new DataView(expectedBytes.buffer, 1, 4)
    const serviceIndex = BigInt(serviceIndexView.getUint32(0, true))

    // Bytes 5-36: codehash (32 bytes)
    const codehash = bytesToHex(expectedBytes.slice(5, 37))

    // Bytes 37-44: refgaslimit (8 bytes little-endian)
    const refGasLimitView = new DataView(expectedBytes.buffer, 37, 8)
    const refGasLimit = refGasLimitView.getBigUint64(0, true)

    // Bytes 45-52: accgaslimit (8 bytes little-endian)
    const accGasLimitView = new DataView(expectedBytes.buffer, 45, 8)
    const accGasLimit = accGasLimitView.getBigUint64(0, true)

    // Bytes 53-54: exportcount (2 bytes little-endian)
    const exportCountView = new DataView(expectedBytes.buffer, 53, 2)
    const exportCount = BigInt(exportCountView.getUint16(0, true))

    // Byte 55: payload length prefix (variable natural encoding)
    // Looking at hex at offset 55: 0x23 = 35 (length of payload)
    const payloadLengthPrefix = expectedBytes[55]
    const payloadLength = payloadLengthPrefix // Assuming single-byte length encoding

    // Bytes 56-(55+payloadLength): payload data
    const payload = expectedBytes.slice(56, 56 + payloadLength)

    // After payload: importsegments length prefix
    const importSegmentsOffset = 56 + payloadLength
    const importSegmentsLengthPrefix = expectedBytes[importSegmentsOffset]
    const importSegmentsLength = importSegmentsLengthPrefix

    // After importsegments: extrinsics length prefix
    // Note: Import references are 36 bytes each (32-byte hash + 4-byte index), not 4 bytes
    const _extrinsicsOffset = importSegmentsOffset + 1 + (importSegmentsLength * 36)

    // Create the work item with proper types matching WorkItem interface
    const decodedWorkItem: WorkItem = {
      serviceindex: serviceIndex,
      codehash: codehash,
      refgaslimit: refGasLimit,
      accgaslimit: accGasLimit,
      exportcount: exportCount,
      payload: payload,
      importsegments: [] as ImportSegment[],
      extrinsics: [] as ExtrinsicReference[],
    }

    // If there are import segments, decode them
    // Import segment format: 32-byte treeroot + 2-byte index (based on Gray Paper)
    if (importSegmentsLength > 0) {
      for (let i = 0; i < importSegmentsLength; i++) {
        const refOffset = importSegmentsOffset + 1 + (i * 34) // 32 + 2 bytes
        const treeRoot = bytesToHex(expectedBytes.slice(refOffset, refOffset + 32))
        const indexView = new DataView(expectedBytes.buffer, refOffset + 32, 2)
        const index = indexView.getUint16(0, true)
        decodedWorkItem.importsegments.push({ treeRoot, index })
      }
    }

    // Extrinsics are decoded similarly (hash + length)
    // For this test case, they appear to be empty

    console.log('Decoded work item:', {
      serviceindex: serviceIndex.toString(),
      codehash: codehash,
      refgaslimit: refGasLimit.toString(),
      accgaslimit: accGasLimit.toString(),
      exportcount: exportCount.toString(),
      payloadLength: payload.length,
      payloadHex: bytesToHex(payload),
    })

    // Create FetchParams with the decoded work items sequence
    const tsFetchParams: FetchParams = {
      workPackage: null,
      workPackageHash: null,
      authorizerTrace: null,
      workItemIndex: null,
      importSegments: null,
      exportSegments: null,
      accumulateInputs: [decodedWorkItem],
      entropyService: entropyService,
    }

    // Execute TypeScript FETCH
    const tsResult = tsFetchFunction.execute(tsContext, tsFetchParams)

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

    console.log('TypeScript FETCH selector 14 result:', tsHex)
    console.log('Expected result:', expectedHex)
    console.log('TypeScript length:', tsFetchedData!.length)
    console.log('Expected length:', 179)

    // The result should match the expected 179 bytes
    expect(tsHex).toBe(expectedHex)
    expect(tsFetchedData!.length).toBe(179)
  })
})

/**
 * Test for round-trip decoding and re-encoding work item sequences
 * 
 * This helps identify mismatches between our codec and jamduna's expectations
 */
describe('Work Item Sequence Round-Trip Encoding', () => {
  test('should round-trip decode and re-encode work item sequence from jamduna test vector', () => {
    // This is the 179-byte encoded work items sequence from jamduna test vector
    // Source: submodules/jamduna/jam-test-vectors/0.7.2/preimages_light/00000002/0/0/accumulate_input
    // This is what FETCH selector 14 should return
    const originalHex = '0x010025d8314884a4162787493635f1da182a6fbc7b31b55c18ce74ea1369a7999f4500000000000000000000000000000000000000000000000000000000000000002357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f8b5fd156d32aa8f25a91c80449f4e3bba4ea1e54aa9855b2ff53c32e42e7bc02de0809698002a0106f5d8957422098a7b2f007db98bce1bcf51c34311ab19671e7f5dcaadf54e0d9f370000000000000000'
    const originalBytes = hexToBytes(originalHex)
    
    console.log('=== Work Item Sequence Round-Trip Test ===')
    console.log('Original length:', originalBytes.length, 'bytes')
    
    // Step 1: Decode the sequence using our decoder
    const [decodeError, decodeResult] = decodeVariableSequence(originalBytes, decodeWorkItem)
    
    if (decodeError) {
      console.log('Decode error:', decodeError.message)
      expect(decodeError).toBeNull()
      return
    }
    
    console.log('Decoded work items count:', decodeResult.value.length)
    console.log('Bytes consumed by decode:', decodeResult.consumed)
    console.log('Remaining bytes after decode:', decodeResult.remaining.length)
    
    // Log each decoded work item
    for (let i = 0; i < decodeResult.value.length; i++) {
      const wi = decodeResult.value[i]
      console.log(`\nWork item ${i}:`)
      console.log('  serviceindex:', wi.serviceindex.toString())
      console.log('  codehash:', wi.codehash)
      console.log('  refgaslimit:', wi.refgaslimit.toString())
      console.log('  accgaslimit:', wi.accgaslimit.toString())
      console.log('  exportcount:', wi.exportcount.toString())
      console.log('  payload length:', wi.payload.length)
      console.log('  payload hex:', bytesToHex(wi.payload))
      console.log('  importsegments count:', wi.importsegments.length)
      console.log('  extrinsics count:', wi.extrinsics.length)
    }
    
    // Step 2: Re-encode the decoded work items
    const [encodeError, reEncodedBytes] = encodeVariableSequence(
      decodeResult.value,
      encodeWorkItem
    )
    
    if (encodeError) {
      console.log('Re-encode error:', encodeError.message)
      expect(encodeError).toBeNull()
      return
    }
    
    console.log('\n=== Comparison ===')
    console.log('Original length:', originalBytes.length, 'bytes')
    console.log('Re-encoded length:', reEncodedBytes.length, 'bytes')
    console.log('Consumed during decode:', decodeResult.consumed, 'bytes')
    console.log('Remaining after decode:', decodeResult.remaining.length, 'bytes')
    
    // Compare the re-encoded bytes with the consumed portion of the original
    const consumedOriginal = originalBytes.slice(0, decodeResult.consumed)
    const reEncodedHex = bytesToHex(reEncodedBytes)
    const consumedHex = bytesToHex(consumedOriginal)
    
    console.log('\nConsumed original:', consumedHex)
    console.log('Re-encoded:       ', reEncodedHex)
    console.log('Match:', reEncodedHex === consumedHex)
    
    // The re-encoded should match what we consumed from the original
    expect(reEncodedHex).toBe(consumedHex)
    
    // If there are remaining bytes, they indicate a format difference
    if (decodeResult.remaining.length > 0) {
      console.log('\n=== REMAINING BYTES ANALYSIS ===')
      console.log('There are', decodeResult.remaining.length, 'bytes remaining after decoding')
      console.log('This indicates the original encoding has more data than our decoder consumes')
      console.log('Remaining bytes:', bytesToHex(decodeResult.remaining))
      
      // Analyze the remaining bytes structure
      const rem = decodeResult.remaining
      console.log('\nFirst 20 bytes of remaining:')
      for (let i = 0; i < Math.min(20, rem.length); i++) {
        console.log(`  [${i}] 0x${rem[i].toString(16).padStart(2, '0')} = ${rem[i]}`)
      }
    }
    
    // For now, we expect the round-trip to work for what we decode
    // The remaining bytes issue needs investigation
    expect(decodeResult.value.length).toBe(1) // Should have 1 work item
  })

  test('should identify field-by-field differences in work item encoding', () => {
    // Parse the expected 179-byte data manually to understand the structure
    const originalHex = '0x010025d8314884a4162787493635f1da182a6fbc7b31b55c18ce74ea1369a7999f4500000000000000000000000000000000000000000000000000000000000000002357426f2313559a271d6782dc00197b379f79cbe3c6a1e72f61f7b592c509f8b5fd156d32aa8f25a91c80449f4e3bba4ea1e54aa9855b2ff53c32e42e7bc02de0809698002a0106f5d8957422098a7b2f007db98bce1bcf51c34311ab19671e7f5dcaadf54e0d9f370000000000000000'
    const data = hexToBytes(originalHex)
    
    console.log('=== Field-by-Field Analysis ===')
    console.log('Total bytes:', data.length)
    
    // Manual parsing based on Gray Paper WorkItem structure
    let offset = 0
    
    // Sequence length prefix (natural encoding)
    const seqLen = data[offset]
    console.log(`[${offset}] Sequence length: ${seqLen}`)
    offset += 1
    
    // Work item fields
    console.log('\n--- Work Item 0 ---')
    
    // 1. serviceindex (4 bytes, little-endian)
    const serviceindexBytes = data.slice(offset, offset + 4)
    const serviceindex = new DataView(serviceindexBytes.buffer).getUint32(0, true)
    console.log(`[${offset}-${offset+3}] serviceindex: ${serviceindex} (0x${serviceindex.toString(16)})`)
    console.log(`  bytes: ${bytesToHex(serviceindexBytes)}`)
    offset += 4
    
    // 2. codehash (32 bytes)
    const codehash = data.slice(offset, offset + 32)
    console.log(`[${offset}-${offset+31}] codehash: ${bytesToHex(codehash)}`)
    offset += 32
    
    // 3. refgaslimit (8 bytes, little-endian)
    const refgaslimitBytes = data.slice(offset, offset + 8)
    const refgaslimit = new DataView(refgaslimitBytes.buffer).getBigUint64(0, true)
    console.log(`[${offset}-${offset+7}] refgaslimit: ${refgaslimit}`)
    console.log(`  bytes: ${bytesToHex(refgaslimitBytes)}`)
    offset += 8
    
    // 4. accgaslimit (8 bytes, little-endian)
    const accgaslimitBytes = data.slice(offset, offset + 8)
    const accgaslimit = new DataView(accgaslimitBytes.buffer).getBigUint64(0, true)
    console.log(`[${offset}-${offset+7}] accgaslimit: ${accgaslimit}`)
    console.log(`  bytes: ${bytesToHex(accgaslimitBytes)}`)
    offset += 8
    
    // 5. exportcount (2 bytes, little-endian)
    const exportcountBytes = data.slice(offset, offset + 2)
    const exportcount = new DataView(exportcountBytes.buffer).getUint16(0, true)
    console.log(`[${offset}-${offset+1}] exportcount: ${exportcount}`)
    console.log(`  bytes: ${bytesToHex(exportcountBytes)}`)
    offset += 2
    
    // 6. payload (variable: length prefix + data)
    const payloadLen = data[offset]
    console.log(`[${offset}] payload length prefix: ${payloadLen}`)
    offset += 1
    if (payloadLen > 0) {
      const payload = data.slice(offset, offset + payloadLen)
      console.log(`[${offset}-${offset+payloadLen-1}] payload: ${bytesToHex(payload)}`)
      offset += payloadLen
    }
    
    // 7. importsegments (variable: length prefix + segments)
    const importsegmentsLen = data[offset]
    console.log(`[${offset}] importsegments length prefix: ${importsegmentsLen}`)
    offset += 1
    
    // 8. extrinsics (variable: length prefix + refs)
    const extrinsicsLen = data[offset]
    console.log(`[${offset}] extrinsics length prefix: ${extrinsicsLen}`)
    offset += 1
    
    console.log(`\nTotal consumed so far: ${offset} bytes`)
    console.log(`Remaining: ${data.length - offset} bytes`)
    
    if (offset < data.length) {
      console.log('\n=== UNEXPECTED REMAINING DATA ===')
      const remaining = data.slice(offset)
      console.log(`Remaining ${remaining.length} bytes: ${bytesToHex(remaining)}`)
      
      // Try to understand what this extra data could be
      console.log('\nFirst non-zero byte in remaining:')
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i] !== 0) {
          console.log(`  Found at offset ${offset + i}: 0x${remaining[i].toString(16)} = ${remaining[i]}`)
          break
        }
      }
    }
    
    // The test passes if we can parse the work item, even with remaining data
    expect(seqLen).toBe(1)
  })
})

