import { describe, it, expect, beforeAll } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { instantiate } from './wasmAsInit'

// Use AssemblyScript-compatible constants (matching pbnj-types-compat.ts)
// These may differ slightly from @pbnjam/types due to versioning
const DEPOSIT_CONSTANTS = {
  C_ITEMDEPOSIT: 10,
  C_BYTEDEPOSIT: 1,
  C_BASEDEPOSIT: 100,
}

const HISTORY_CONSTANTS = {
  C_RECENTHISTORYLEN: 8,
}

const SERVICE_CONSTANTS = {
  C_MAXSERVICECODESIZE: 4000000,
}

const TIME_CONSTANTS = {
  C_ASSURANCETIMEOUTPERIOD: 5,
}

const TRANSFER_CONSTANTS = {
  C_MEMOSIZE: 128,
}

const WORK_PACKAGE_CONSTANTS = {
  C_MAXPACKAGEITEMS: 16,
  C_MAXPACKAGEXTS: 128,
  C_MAXBUNDLESIZE: 13794360, // Gray Paper v0.7.2 says 13791360, but jamduna test vectors use 13794360
  C_MAXPACKAGEIMPORTS: 3072,
  C_MAXPACKAGEEXPORTS: 3072,
}

const WORK_REPORT_CONSTANTS = {
  C_REPORTACCGAS: 10000000,
  C_MAXREPORTDEPS: 8,
  C_MAXREPORTVARSIZE: 49152,
}

const AUTHORIZATION_CONSTANTS = {
  C_PACKAGEAUTHGAS: 50000000,
  C_AUTHPOOLSIZE: 8,
  C_AUTHQUEUESIZE: 80,
  C_MAXAUTHCODESIZE: 64000,
}

// Memory configuration constants (matching Gray Paper)
// Note: AssemblyScript uses 2^31-1 for MAX_MEMORY_ADDRESS while full spec is 2^32-1
const MEMORY_CONFIG = {
  PAGE_SIZE: 4096,
  MAX_MEMORY_ADDRESS: 0x7fffffff, // 2^31-1 (matching AssemblyScript implementation)
  ZONE_SIZE: 65536, // 2^16
}

// TypeScript alignToPage function (matching Gray Paper rnp function)
function alignToPage(address: number): number {
  const pageSize = MEMORY_CONFIG.PAGE_SIZE
  return Math.ceil(address / pageSize) * pageSize
}

describe('SBRK Instruction Equivalence', () => {
  let wasm: Awaited<ReturnType<typeof instantiate>>

  beforeAll(async () => {
    const wasmPath = join(__dirname, '../build/pvm.wasm')
    const wasmBuffer = readFileSync(wasmPath)
    wasm = await instantiate(wasmBuffer)
    wasm.init(0)
  })

  describe('SBRK logic equivalence', () => {
    it('should return current heap pointer when requestedSize is 0 (query mode)', () => {
      const currentHeapPointer = 0x100000
      const requestedSize = 0n

      // Test AssemblyScript implementation
      const asResult = wasm.testSbrkLogic(currentHeapPointer, requestedSize)
      expect(asResult).not.toBeNull()

      // Test TypeScript-equivalent logic
      const tsResult = typescriptSbrkLogic(currentHeapPointer, requestedSize)

      // Compare results
      expect(asResult.resultValue).toBe(tsResult.resultValue)
      expect(asResult.newHeapPointer).toBe(tsResult.newHeapPointer)
      expect(asResult.pagesAllocated).toBe(tsResult.pagesAllocated)
      expect(asResult.startPageIndex).toBe(tsResult.startPageIndex)
    })

    it('should allocate memory within current page', () => {
      // Current heap pointer at page boundary + 100 bytes
      const currentHeapPointer = (16 * MEMORY_CONFIG.PAGE_SIZE) + 100
      const requestedSize = 100n // Request 100 more bytes (stays within page)

      const asResult = wasm.testSbrkLogic(currentHeapPointer, requestedSize)
      const tsResult = typescriptSbrkLogic(currentHeapPointer, requestedSize)

      expect(asResult.resultValue).toBe(tsResult.resultValue)
      expect(asResult.newHeapPointer).toBe(tsResult.newHeapPointer)
      expect(asResult.pagesAllocated).toBe(0) // No new pages needed
      expect(tsResult.pagesAllocated).toBe(0)
    })

    it('should allocate new pages when crossing page boundary', () => {
      // Current heap pointer at page boundary
      const pageAligned = 16 * MEMORY_CONFIG.PAGE_SIZE // 65536
      const currentHeapPointer = pageAligned
      const requestedSize = 8192n // Request 2 pages worth

      const asResult = wasm.testSbrkLogic(currentHeapPointer, requestedSize)
      const tsResult = typescriptSbrkLogic(currentHeapPointer, requestedSize)

      expect(asResult.resultValue).toBe(tsResult.resultValue)
      expect(asResult.newHeapPointer).toBe(tsResult.newHeapPointer)
      expect(asResult.pagesAllocated).toBe(tsResult.pagesAllocated)
      expect(asResult.startPageIndex).toBe(tsResult.startPageIndex)
      expect(asResult.pagesAllocated).toBe(2)
    })

    it('should return 0 on overflow', () => {
      // MAX_MEMORY_ADDRESS is 2^31-1 = 2147483647 (0x7FFFFFFF)
      // We need currentHeapPointer + requestedSize > MAX_MEMORY_ADDRESS
      const currentHeapPointer = 0x7fff0000 // Close to max
      const requestedSize = 0x20000n // Would exceed 2^31-1

      const asResult = wasm.testSbrkLogic(currentHeapPointer, requestedSize)
      const tsResult = typescriptSbrkLogic(currentHeapPointer, requestedSize)

      expect(asResult.resultValue).toBe(0n) // Return 0 on failure
      expect(tsResult.resultValue).toBe(0n)
      expect(asResult.newHeapPointer).toBe(currentHeapPointer) // Unchanged
      expect(tsResult.newHeapPointer).toBe(currentHeapPointer)
    })

    it('should handle allocation exactly at page boundary', () => {
      // Heap pointer exactly at end of current page
      const currentHeapPointer = 20 * MEMORY_CONFIG.PAGE_SIZE
      const requestedSize = 4096n // Exactly one page

      const asResult = wasm.testSbrkLogic(currentHeapPointer, requestedSize)
      const tsResult = typescriptSbrkLogic(currentHeapPointer, requestedSize)

      expect(asResult.resultValue).toBe(tsResult.resultValue)
      expect(asResult.newHeapPointer).toBe(tsResult.newHeapPointer)
      expect(asResult.pagesAllocated).toBe(tsResult.pagesAllocated)
    })
  })

  describe('alignToPage equivalence', () => {
    it('should align addresses correctly', () => {
      const testAddresses = [0, 1, 4095, 4096, 4097, 8191, 8192, 65535, 65536]

      for (const addr of testAddresses) {
        const asResult = wasm.testAlignToPage(addr)
        const tsResult = alignToPage(addr)

        expect(asResult).toBe(tsResult)
      }
    })
  })

  describe('memory config equivalence', () => {
    it('should have matching memory configuration constants', () => {
      const configBytes = wasm.testGetMemoryConfig()

      // Decode little-endian u32 values
      const view = new DataView(configBytes.buffer)
      const asPageSize = view.getUint32(0, true)
      const asMaxAddress = view.getUint32(4, true)
      const asZoneSize = view.getUint32(8, true)

      expect(asPageSize).toBe(MEMORY_CONFIG.PAGE_SIZE)
      expect(asMaxAddress).toBe(MEMORY_CONFIG.MAX_MEMORY_ADDRESS)
      expect(asZoneSize).toBe(MEMORY_CONFIG.ZONE_SIZE)
    })
  })
})

describe('FETCH Host Function Equivalence', () => {
  let wasm: Awaited<ReturnType<typeof instantiate>>

  beforeAll(async () => {
    const wasmPath = join(__dirname, '../build/pvm.wasm')
    const wasmBuffer = readFileSync(wasmPath)
    wasm = await instantiate(wasmBuffer)
    wasm.init(0)
  })

  describe('system constants encoding (selector 0)', () => {
    it('should encode system constants identically to TypeScript', () => {
      // Test with default production values
      const asResult = wasm.testGetSystemConstants(
        341,    // numCores
        19200,  // preimageExpungePeriod
        600,    // epochDuration
        3500000000n, // maxBlockGas
        5000000000n, // maxRefineGas
        16,     // maxTicketsPerExtrinsic
        2,      // ticketsPerValidator
        6,      // slotDuration (seconds)
        10,     // rotationPeriod
        1023,   // numValidators
        6,      // numEcPiecesPerSegment
        500,    // contestDuration
        14400,  // maxLookupAnchorage
        684,    // ecPieceSize
      )

      const tsResult = typescriptGetSystemConstants({
        numCores: 341,
        preimageExpungePeriod: 19200,
        epochDuration: 600,
        maxBlockGas: 3500000000n,
        maxRefineGas: 5000000000n,
        maxTicketsPerExtrinsic: 16,
        ticketsPerValidator: 2,
        slotDuration: 6,
        rotationPeriod: 10,
        numValidators: 1023,
        numEcPiecesPerSegment: 6,
        contestDuration: 500,
        maxLookupAnchorage: 14400,
        ecPieceSize: 684,
      })

      expect(asResult.length).toBe(134) // Gray Paper specification
      expect(tsResult.length).toBe(134)

      // Compare byte-by-byte
      for (let i = 0; i < 134; i++) {
        expect(asResult[i]).toBe(tsResult[i])
      }
    })

    it('should encode system constants with tiny mode config', () => {
      // Test with tiny mode values (smaller config)
      const asResult = wasm.testGetSystemConstants(
        2,      // numCores (tiny mode)
        32,     // preimageExpungePeriod (tiny mode)
        12,     // epochDuration (tiny mode)
        100000000n, // maxBlockGas (tiny mode)
        50000000n,  // maxRefineGas (tiny mode)
        4,      // maxTicketsPerExtrinsic (tiny mode)
        2,      // ticketsPerValidator
        6,      // slotDuration (seconds)
        4,      // rotationPeriod (tiny mode)
        6,      // numValidators (tiny mode)
        6,      // numEcPiecesPerSegment
        10,     // contestDuration (tiny mode)
        28,     // maxLookupAnchorage (tiny mode)
        342,    // ecPieceSize (tiny mode)
      )

      const tsResult = typescriptGetSystemConstants({
        numCores: 2,
        preimageExpungePeriod: 32,
        epochDuration: 12,
        maxBlockGas: 100000000n,
        maxRefineGas: 50000000n,
        maxTicketsPerExtrinsic: 4,
        ticketsPerValidator: 2,
        slotDuration: 6,
        rotationPeriod: 4,
        numValidators: 6,
        numEcPiecesPerSegment: 6,
        contestDuration: 10,
        maxLookupAnchorage: 28,
        ecPieceSize: 342,
      })

      expect(asResult.length).toBe(134)
      expect(tsResult.length).toBe(134)

      // Compare byte-by-byte
      for (let i = 0; i < 134; i++) {
        if (asResult[i] !== tsResult[i]) {
          console.error(`Mismatch at byte ${i}: AS=${asResult[i]}, TS=${tsResult[i]}`)
        }
        expect(asResult[i]).toBe(tsResult[i])
      }
    })
  })
})

// ========== TypeScript Reference Implementations ==========

interface SBRKTestResult {
  resultValue: bigint
  newHeapPointer: number
  pagesAllocated: number
  startPageIndex: number
}

function typescriptSbrkLogic(
  currentHeapPointer: number,
  requestedSize: bigint,
): SBRKTestResult {
  // If requestedSize == 0, return current heap pointer (query mode)
  if (requestedSize === 0n) {
    return {
      resultValue: BigInt(currentHeapPointer),
      newHeapPointer: currentHeapPointer,
      pagesAllocated: 0,
      startPageIndex: 0,
    }
  }

  // Record current heap pointer to return (before allocation)
  const result = BigInt(currentHeapPointer)

  // Calculate new heap pointer
  const nextPageBoundary = alignToPage(currentHeapPointer)
  const newHeapPointer = currentHeapPointer + Number(requestedSize)

  // Check for overflow
  if (newHeapPointer > MEMORY_CONFIG.MAX_MEMORY_ADDRESS) {
    return {
      resultValue: 0n, // Return 0 on failure
      newHeapPointer: currentHeapPointer, // Heap pointer unchanged
      pagesAllocated: 0,
      startPageIndex: 0,
    }
  }

  // Calculate pages to allocate
  let pagesAllocated = 0
  let startPageIndex = 0

  if (newHeapPointer > nextPageBoundary) {
    const finalBoundary = alignToPage(newHeapPointer)
    startPageIndex = Math.floor(nextPageBoundary / MEMORY_CONFIG.PAGE_SIZE)
    const endPageIndex = Math.floor(finalBoundary / MEMORY_CONFIG.PAGE_SIZE)
    pagesAllocated = endPageIndex - startPageIndex
  }

  return {
    resultValue: result,
    newHeapPointer: newHeapPointer,
    pagesAllocated: pagesAllocated,
    startPageIndex: startPageIndex,
  }
}

interface SystemConstantsConfig {
  numCores: number
  preimageExpungePeriod: number
  epochDuration: number
  maxBlockGas: bigint
  maxRefineGas: bigint
  maxTicketsPerExtrinsic: number
  ticketsPerValidator: number
  slotDuration: number
  rotationPeriod: number
  numValidators: number
  numEcPiecesPerSegment: number
  contestDuration: number
  maxLookupAnchorage: number
  ecPieceSize: number
}

function typescriptGetSystemConstants(config: SystemConstantsConfig): Uint8Array {
  const buffer = new ArrayBuffer(134)
  const view = new DataView(buffer)
  let offset = 0

  // encode[8]{Citemdeposit = 10}
  view.setBigUint64(offset, BigInt(DEPOSIT_CONSTANTS.C_ITEMDEPOSIT), true)
  offset += 8

  // encode[8]{Cbytedeposit = 1}
  view.setBigUint64(offset, BigInt(DEPOSIT_CONSTANTS.C_BYTEDEPOSIT), true)
  offset += 8

  // encode[8]{Cbasedeposit = 100}
  view.setBigUint64(offset, BigInt(DEPOSIT_CONSTANTS.C_BASEDEPOSIT), true)
  offset += 8

  // encode[2]{Ccorecount}
  view.setUint16(offset, config.numCores, true)
  offset += 2

  // encode[4]{Cexpungeperiod}
  view.setUint32(offset, config.preimageExpungePeriod, true)
  offset += 4

  // encode[4]{Cepochlen}
  view.setUint32(offset, config.epochDuration, true)
  offset += 4

  // encode[8]{Creportaccgas = 10000000}
  view.setBigUint64(offset, BigInt(WORK_REPORT_CONSTANTS.C_REPORTACCGAS), true)
  offset += 8

  // encode[8]{Cpackageauthgas = 50000000}
  view.setBigUint64(offset, BigInt(AUTHORIZATION_CONSTANTS.C_PACKAGEAUTHGAS), true)
  offset += 8

  // encode[8]{Cpackagerefgas}
  view.setBigUint64(offset, config.maxRefineGas, true)
  offset += 8

  // encode[8]{Cblockaccgas}
  view.setBigUint64(offset, config.maxBlockGas, true)
  offset += 8

  // encode[2]{Crecenthistorylen = 8}
  view.setUint16(offset, HISTORY_CONSTANTS.C_RECENTHISTORYLEN, true)
  offset += 2

  // encode[2]{Cmaxpackageitems = 16}
  view.setUint16(offset, WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEITEMS, true)
  offset += 2

  // encode[2]{Cmaxreportdeps = 8}
  view.setUint16(offset, WORK_REPORT_CONSTANTS.C_MAXREPORTDEPS, true)
  offset += 2

  // encode[2]{Cmaxblocktickets}
  view.setUint16(offset, config.maxTicketsPerExtrinsic, true)
  offset += 2

  // encode[4]{Cmaxlookupanchorage}
  view.setUint32(offset, config.maxLookupAnchorage, true)
  offset += 4

  // encode[2]{Cticketentries}
  view.setUint16(offset, config.ticketsPerValidator, true)
  offset += 2

  // encode[2]{Cauthpoolsize = 8}
  view.setUint16(offset, AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE, true)
  offset += 2

  // encode[2]{Cslotseconds}
  view.setUint16(offset, config.slotDuration, true)
  offset += 2

  // encode[2]{Cauthqueuesize = 80}
  view.setUint16(offset, AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE, true)
  offset += 2

  // encode[2]{Crotationperiod}
  view.setUint16(offset, config.rotationPeriod, true)
  offset += 2

  // encode[2]{Cmaxpackagexts = 128}
  view.setUint16(offset, WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEXTS, true)
  offset += 2

  // encode[2]{Cassurancetimeoutperiod = 5}
  view.setUint16(offset, TIME_CONSTANTS.C_ASSURANCETIMEOUTPERIOD, true)
  offset += 2

  // encode[2]{Cvalcount}
  view.setUint16(offset, config.numValidators, true)
  offset += 2

  // encode[4]{Cmaxauthcodesize = 64000}
  view.setUint32(offset, AUTHORIZATION_CONSTANTS.C_MAXAUTHCODESIZE, true)
  offset += 4

  // encode[4]{Cmaxbundlesize = 13791360}
  view.setUint32(offset, WORK_PACKAGE_CONSTANTS.C_MAXBUNDLESIZE, true)
  offset += 4

  // encode[4]{Cmaxservicecodesize = 4000000}
  view.setUint32(offset, SERVICE_CONSTANTS.C_MAXSERVICECODESIZE, true)
  offset += 4

  // encode[4]{Cecpiecesize}
  view.setUint32(offset, config.ecPieceSize, true)
  offset += 4

  // encode[4]{Cmaxpackageimports = 3072}
  view.setUint32(offset, WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEIMPORTS, true)
  offset += 4

  // encode[4]{Csegmentecpieces}
  view.setUint32(offset, config.numEcPiecesPerSegment, true)
  offset += 4

  // encode[4]{Cmaxreportvarsize = 49152}
  view.setUint32(offset, WORK_REPORT_CONSTANTS.C_MAXREPORTVARSIZE, true)
  offset += 4

  // encode[4]{Cmemosize = 128}
  view.setUint32(offset, TRANSFER_CONSTANTS.C_MEMOSIZE, true)
  offset += 4

  // encode[4]{Cmaxpackageexports = 3072}
  view.setUint32(offset, WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEEXPORTS, true)
  offset += 4

  // encode[4]{Cepochtailstart}
  view.setUint32(offset, config.contestDuration, true)

  return new Uint8Array(buffer)
}

