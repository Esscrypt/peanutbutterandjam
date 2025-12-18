/**
 * Helper utilities for PVM test vector loading and execution
 */

import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { PVM } from '../../pvm'
import { EventBusService, logger } from '@pbnjam/core'
import { PVMParser } from '../../parser'
import { InstructionRegistry } from '../registry'
import type { PVMOptions } from '@pbnjam/types'
import { PVMRAM } from '../../ram'
import { MEMORY_CONFIG } from '../../config'
import { HostFunctionRegistry } from '../../host-functions/general/registry'
import { ConfigService } from '../../../../../infra/node/services/config-service'
import { ServiceAccountService } from '../../../../../infra/node/services/service-account-service'
import { ClockService } from '../../../../../infra/node/services/clock-service'

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
 * Execute a test vector and return the resulting state
 */
export async function executeTestVector(testVector: PVMTestVector): Promise<{
  registers: bigint[]
  pc: number
  gas: number
  status: string
  faultAddress: bigint | null
  memory: Map<bigint, number>
  pvm: PVM
  parseResult: { instructions: Array<{ opcode: bigint; operands: Uint8Array; pc: bigint }>; jumpTable: bigint[]; bitmask: Uint8Array; success: boolean }
}> {
    // Create PVM instance
  const registry = new InstructionRegistry()
  const parser = new PVMParser()

  // Parse the program using PVM's parser (which has the instruction registry)
  const programBytes = testVector.program.map(v => Number(v))
  const programBlob = new Uint8Array(programBytes)
    const parseResult = parser.parseProgram(new Uint8Array(programBytes))

    logger.info('instructions:', { instructions: parseResult.instructions.map(i => `${registry.getHandler(i.opcode)?.name} (${i.opcode}) operands: ${i.operands.join(', ')} pc: ${i.pc}`) })
    logger.info('jumpTable:', { jumpTable: parseResult.jumpTable })
    logger.info('bitmask:', { bitmask: parseResult.bitmask })

  
  if (!parseResult.success) {
    throw new Error(`Failed to parse program: ${parseResult.errors.join(', ')}`)
  }

  const ram = new PVMRAM()

  // Set initial page map (memory pages)
  if (testVector['initial-page-map']) {
    for (const page of testVector['initial-page-map']) {
      const address = BigInt(page.address)
      const length = Number(page.length)
      const isWritable = page['is-writable']
      
      // Convert boolean to MemoryAccessType
      // Test vectors only use read vs write, but we support the full Gray Paper model
      const accessType = isWritable ? 'write' : 'read'
      
      // Initialize page in RAM
      ram.initializePage(address, length, accessType)
    }
  }

  // Set initial memory
  // During initialization, we can write to any initialized page regardless of access type
  // This matches the test vector format where read-only pages can have initial data
  if (testVector['initial-memory']) {
    for (const memBlock of testVector['initial-memory']) {
      const address = BigInt(memBlock.address)
      const contents = memBlock.contents.map(v => Number(v))
      const values = new Uint8Array(contents)
      
      // Write directly to memory during initialization, bypassing writable checks
      // This is needed because test vectors may write to read-only pages during setup
      ram.writeOctetsDuringInitialization(address, values)
    }
  }


  const options: PVMOptions = {
    pc: BigInt(testVector['initial-pc']),
    gasCounter: BigInt(testVector['initial-gas']),
    // gasCounter: 10n,
    registerState: testVector['initial-regs'].map(v => BigInt(String(v))),
    ram: ram,
  }
  const configService = new ConfigService('tiny')
  const eventBusService = new EventBusService()
  const clockService = new ClockService({
    eventBusService: eventBusService,
    configService: configService,
  })
  const serviceAccountService = new ServiceAccountService({
    configService: new ConfigService('tiny'),
    eventBusService: eventBusService,
    clockService: clockService,
    networkingService: null,
    preimageRequestProtocol: null,
  })
  const hostFunctionRegistry = new HostFunctionRegistry(serviceAccountService, new ConfigService('tiny'))
  const pvm = new PVM(hostFunctionRegistry, options);
  // Load parsed instructions (RISC-V test vectors don't have jump tables)

  // Run program
  await pvm.run(programBlob)

  // Extract final registers as bigint array for comparison
  const finalRegisters: bigint[] = new Array(13)
  for (let i = 0; i < 13; i++) {
    finalRegisters[i] = pvm.getState().registerState[i]
  }

  const faultAddress = pvm.getState().faultAddress

  // Map result code to status string
  const statusMap: Record<number, string> = {
    0: 'halt',
    1: 'panic',
    2: 'page-fault',
    3: 'host',
    4: 'out-of-gas',
  }
  const status = statusMap[pvm.getState().resultCode]

  // Extract final memory state
  // Access the private cells map through the PVMRAM instance
  const finalMemory = new Map<bigint, number>()
  if (testVector['expected-memory']) {
    // Set page access for expected memory addresses if not already set
    // This ensures we can read from addresses that were written during execution
    // but weren't in the initial-page-map
    for (const memBlock of testVector['expected-memory']) {
      const address = BigInt(memBlock.address)
      const length = memBlock.contents.length
      
      // Calculate page-aligned range
      const pageSize = BigInt(MEMORY_CONFIG.PAGE_SIZE)
      const startPage = address / pageSize
      const endPage = (address + BigInt(length) + pageSize - 1n) / pageSize
      const startAddress = startPage * pageSize
      const endAddress = endPage * pageSize
      
      // Check if page access is already set for all pages in this range
      const ram = pvm.getState().ram as PVMRAM
      let allPagesHaveAccess = true
      for (let page = startPage; page < endPage; page++) {
        const pageAddr = page * pageSize
        const accessType = ram.getPageAccessType(pageAddr)
        if (accessType === 'none') {
          allPagesHaveAccess = false
          break
        }
      }
      
      // If any page doesn't have access, set it to 'read' for the entire range
      // This ensures we can read from addresses that were written during execution
      // but weren't in the initial-page-map
      if (!allPagesHaveAccess) {
        ram.setPageAccessRightsForAddressRange(startAddress, endAddress, 'read')
      }
    }
    
    // Now read the memory
    for (const memBlock of testVector['expected-memory']) {
      const address = BigInt(memBlock.address)
      const length = memBlock.contents.length
      for (let i = 0; i < length; i++) {
        const addr = address + BigInt(i)
        const [bytes, faultAddress] = pvm.getState().ram.readOctets(addr, 1n)
        if (faultAddress) {
          throw new Error(`Failed to read memory at address ${addr.toString()}: ${faultAddress}`)
        }
        if (bytes) {
          finalMemory.set(addr, Number(bytes[0]))
        }
      }
    }
  }

  // Test vectors expect PC as code-relative (byte offset within code section)
  // Our PVM tracks PC as code-relative as well, so return it directly
  return {
    registers: finalRegisters,
    pc: Number(pvm.getState().programCounter),
    gas: Number(pvm.getState().gasCounter),
    status,
    faultAddress,
    memory: finalMemory,
    pvm,
    parseResult: {
      instructions: parseResult.instructions,
      jumpTable: parseResult.jumpTable,
      bitmask: parseResult.bitmask,
      success: parseResult.success,
    },
  }
}

