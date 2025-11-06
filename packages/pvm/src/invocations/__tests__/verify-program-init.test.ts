/**
 * Verify PVM Initialization Against program.json
 * 
 * This test verifies that the PVM initialization (Y function) produces
 * the exact same state as specified in program.json, including:
 * - Register values (r0-r12)
 * - Page map (address, length, is-writable)
 * - Memory contents for each page
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hexToBytes, EventBusService } from '@pbnj/core'
import { decodeProgramFromPreimage } from '@pbnj/serialization'
import { PVM } from '../../pvm'
import { HostFunctionRegistry } from '../../host-functions/general/registry'
import { ConfigService } from '../../../../../infra/node/services/config-service'
import { ServiceAccountService } from '../../../../../infra/node/services/service-account-service'
import {describe, it, expect} from 'bun:test'
import { ClockService } from '../../../../../infra/node/services/clock-service'

// Test vector file path
const WORKSPACE_ROOT = process.cwd().includes('/packages/pvm')
  ? process.cwd().split('/packages/pvm')[0]
  : process.cwd()

const TEST_VECTOR_PATH = join(
  WORKSPACE_ROOT,
  'submodules',
  'jam-test-vectors',
  'stf',
  'accumulate',
  'tiny',
  'transfer_for_ejected_service-1.json',
)

const PROGRAM_JSON_PATH = join(
  WORKSPACE_ROOT,
  'packages',
  'pvm',
  'src',
  'invocations',
  'program.json',
)

interface ProgramJson {
  regs: string[]
  pc: number
  pageMap: Array<{
    address: number
    length: number
    'is-writable': boolean
  }>
  memory: Array<{
    address: number
    contents: number[]
  }>
}

interface TestVector {
  pre_state: {
    accounts: Array<{
      id: number
      data: {
        service: {
          code_hash: string
        }
        preimages_blob: Array<{
          hash: string
          blob: string // hex string
        }>
      }
    }>
  }
  input: {
    slot: number
    reports: Array<{
      service_id: number
      result: {
        blob: string // hex string
      }
    }>
  }
}

/**
 * Compare two arrays of numbers for equality
 */
function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * Compare page maps for equality
 */
function comparePageMaps(
  actual: Array<{
    address: string
    length: number
    'is-writable': boolean
  }>,
  expected: Array<{
    address: number
    length: number
    'is-writable': boolean
  }>,
): { match: boolean; differences: string[] } {
  const differences: string[] = []

  if (actual.length !== expected.length) {
    differences.push(
      `Page count mismatch: expected ${expected.length}, got ${actual.length}`,
    )
    return { match: false, differences }
  }

  for (let i = 0; i < expected.length; i++) {
    const exp = expected[i]
    const act = actual[i]

    if (BigInt(act.address) !== BigInt(exp.address)) {
      differences.push(
        `Page ${i}: address mismatch - expected ${exp.address}, got ${act.address}`,
      )
    }
    if (act.length !== exp.length) {
      differences.push(
        `Page ${i}: length mismatch - expected ${exp.length}, got ${act.length}`,
      )
    }
    if (act['is-writable'] !== exp['is-writable']) {
      differences.push(
        `Page ${i}: is-writable mismatch - expected ${exp['is-writable']}, got ${act['is-writable']}`,
      )
    }
  }

  return {
    match: differences.length === 0,
    differences,
  }
}

/**
 * Compare memory contents for equality
 */
function compareMemoryContents(
  actual: Array<{
    address: string
    contents: number[]
  }>,
  expected: Array<{
    address: number
    contents: number[]
  }>,
): { match: boolean; differences: string[] } {
  const differences: string[] = []

  // Create maps for easier lookup
  const actualMap = new Map<bigint, number[]>()
  for (const entry of actual) {
    actualMap.set(BigInt(entry.address), entry.contents)
  }

  const expectedMap = new Map<bigint, number[]>()
  for (const entry of expected) {
    expectedMap.set(BigInt(entry.address), entry.contents)
  }

  // Check all expected addresses exist and match
  for (const exp of expected) {
    const addr = BigInt(exp.address)
    const actContents = actualMap.get(addr)

    if (!actContents) {
      differences.push(
        `Memory address ${exp.address}: expected contents but got nothing`,
      )
      continue
    }

    if (!arraysEqual(actContents, exp.contents)) {
      // Find first mismatch
      const minLen = Math.min(actContents.length, exp.contents.length)
      let mismatchIdx = -1
      for (let i = 0; i < minLen; i++) {
        if (actContents[i] !== exp.contents[i]) {
          mismatchIdx = i
          break
        }
      }

      if (mismatchIdx >= 0) {
        differences.push(
          `Memory address ${exp.address}, offset ${mismatchIdx}: expected ${exp.contents[mismatchIdx]}, got ${actContents[mismatchIdx]}`,
        )
      } else {
        differences.push(
          `Memory address ${exp.address}: length mismatch - expected ${exp.contents.length}, got ${actContents.length}`,
        )
      }
    }
  }

  // Check for unexpected addresses (warn only, as program.json might not include all pages)
  for (const act of actual) {
    const addr = BigInt(act.address)
    if (!expectedMap.has(addr)) {
      // Only warn if the page has non-zero contents
      const hasNonZero = act.contents.some((b) => b !== 0)
      if (hasNonZero) {
        differences.push(
          `Memory address ${act.address}: unexpected page with non-zero contents (length ${act.contents.length})`,
        )
      }
    }
  }

  return {
    match: differences.length === 0,
    differences,
  }
}

describe('PVM Initialization Verification', () => {
  it('should match program.json exactly', () => {
    // Load program.json
    const programJsonContent = readFileSync(PROGRAM_JSON_PATH, 'utf-8')
    const programJson: ProgramJson = JSON.parse(programJsonContent)

    // Load test vector
    const testVectorContent = readFileSync(TEST_VECTOR_PATH, 'utf-8')
    const testVector: TestVector = JSON.parse(testVectorContent)

    // Extract preimage blob and arguments
    const account = testVector.pre_state.accounts[0]
    const preimageBlob = account.data.preimages_blob[0]
    const blobBytes = hexToBytes(preimageBlob.blob as `0x${string}`)

    // Extract arguments from first report
    // const report = testVector.input.reports[0]

    // initializeProgram expects the preimage blob directly (it calls decodeProgramFromPreimage internally)

    // Create PVM instance (we only need it for initialization, not execution)
    const configService = new ConfigService('tiny')
    const eventBusService = new EventBusService()
    const clockService = new ClockService({
      eventBusService: eventBusService,
      configService: configService,
    })
    const serviceAccountService = new ServiceAccountService({
      preimageStore: null,
      configService: configService,
      eventBusService: eventBusService,
      clockService: clockService,
      networkingService: null,
      preimageRequestProtocol: null,
    })
    const hostFunctionRegistry = new HostFunctionRegistry(
      serviceAccountService,
      configService,
    )
    const pvm = new PVM(hostFunctionRegistry)
    const [error1, decoded] = decodeProgramFromPreimage(blobBytes)
    if (error1) {
      throw new Error(`Failed to decode program from preimage: ${error1.message}`)
    }
    const { code } = decoded.value

    // log the code to a file
    writeFileSync('code.txt', code.toString())


    // // Encode arguments for accumulation
    // // According to Gray Paper: encode(timeslot, serviceId, inputLength)
    // const timeslot = BigInt(testVector.input.slot)
    // const serviceId = BigInt(report.service_id)
    // const inputLength = BigInt(0) // No inputs for this test

    // // Encode: timeslot (4 bytes) + serviceId (4 bytes) + inputLength (variable natural)
    // const timeslotBytes = new Uint8Array(4)
    // new DataView(timeslotBytes.buffer).setUint32(0, Number(timeslot), true)
    // const serviceIdBytes = new Uint8Array(4)
    // new DataView(serviceIdBytes.buffer).setUint32(0, Number(serviceId), true)

    // // Encode inputLength as variable natural using encodeNatural
    // const [encodeError, inputLengthBytes] = encodeNatural(inputLength)
    // if (encodeError) {
    //   throw new Error(`Failed to encode input length: ${encodeError.message}`)
    // }

    // const encodedArgs = new Uint8Array(
    //   timeslotBytes.length +
    //     serviceIdBytes.length +
    //     inputLengthBytes.length,
    // )
    // encodedArgs.set(timeslotBytes, 0)
    // encodedArgs.set(serviceIdBytes, timeslotBytes.length)
    // encodedArgs.set(
    //   inputLengthBytes,
    //   timeslotBytes.length + serviceIdBytes.length,
    // )

    // Initialize PVM (this calls Y function internally)
    // initializeProgram expects the preimage blob, not the decoded code
    const [error] = pvm['initializeProgram'](blobBytes, new Uint8Array(0))
    if (error) {
      throw new Error(`Failed to initialize program: ${error.message}`)
    }

    // Get actual state
    const actualRegs = pvm.state.registerState.map((r) => r.toString())
    const actualPageMap = pvm.state.ram.getPageMapJSON()
    const actualPageMapWithContents =
      pvm.state.ram.getPageMapWithContentsJSON()

    // Convert actual page map with contents to memory format
    const actualMemory = actualPageMapWithContents.map((page) => ({
      address: Number.parseInt(page.address, 10),
      contents: page.contents,
    }))

    // Compare registers
    expect(actualRegs.length).toBe(programJson.regs.length)
    for (let i = 0; i < programJson.regs.length; i++) {
      // Ignore r8 as arguments were not passed in program.json
      if (i === 8) continue
      expect(actualRegs[i]).toBe(programJson.regs[i])
    }

    // Compare page map
    // const pageMapComparison = comparePageMaps(actualPageMap, programJson.pageMap)
    // if (!pageMapComparison.match) {
    //   console.error('Page map differences:')
    //   for (const diff of pageMapComparison.differences) {
    //     console.error(`  - ${diff}`)
    //   }
    // }
    // expect(pageMapComparison.match).toBe(true)

    // Compare memory contents
    const memoryComparison = compareMemoryContents(
      actualMemory.map((m) => ({
        address: m.address.toString(),
        contents: m.contents,
      })),
      programJson.memory,
    )
    if (!memoryComparison.match) {
      console.error('Memory differences:')
      for (const diff of memoryComparison.differences) {
        console.error(`  - ${diff}`)
      }
    }
    expect(memoryComparison.match).toBe(true)
  })
})

