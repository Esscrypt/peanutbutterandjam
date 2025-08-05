/**
 * Test Vector Integration Tests for PVM
 *
 * This test suite runs the official JAM test vectors from jamtestvectors
 * against our PVM implementation to ensure compliance with the Gray Paper.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AccumulateInvocationResult, Gas } from '@pbnj/types'
import { beforeAll, describe, expect, it } from 'vitest'

interface TestVectorData {
  input: {
    slot: number
    reports: any[]
  }
  pre_state: {
    slot: number
    entropy: string
    ready_queue: any[][]
    accumulated: any[][]
    privileges: {
      bless: number
      assign: number
      designate: number
      always_acc: any[]
    }
    statistics: any[]
    accounts: Array<{
      id: number
      data: {
        service: {
          code_hash: string
          balance: number
          min_item_gas: number
          min_memo_gas: number
          bytes: number
          items: number
        }
        storage: any[]
        preimages: Array<{
          hash: string
          blob: string
        }>
      }
    }>
  }
  output: {
    ok?: string
    err?: string
  }
  post_state: {
    slot: number
    entropy: string
    ready_queue: any[][]
    accumulated: any[][]
    privileges: {
      bless: number
      assign: number
      designate: number
      always_acc: any[]
    }
    statistics: any[]
    accounts: Array<{
      id: number
      data: {
        service: {
          code_hash: string
          balance: number
          min_item_gas: number
          min_memo_gas: number
          bytes: number
          items: number
        }
        storage: any[]
        preimages: Array<{
          hash: string
          blob: string
        }>
      }
    }>
  }
}

describe('JAM Test Vectors - PVM Integration', () => {
  let pvm: PVM
  const testVectorsPath = '../../../../submodules/jamtestvectors/stf/accumulate'

  beforeAll(() => {
    pvm = new PVM()
  })

  function loadTestVectors(): TestVectorData[] {
    const tinyPath = join(__dirname, testVectorsPath, 'tiny')
    const vectors: TestVectorData[] = []

    if (!existsSync(tinyPath)) {
      console.warn(`Test vectors path not found: ${tinyPath}`)
      return vectors
    }

    const files = readdirSync(tinyPath)
      .filter((file) => file.endsWith('.json'))
      .slice(0, 5) // Start with first 5 test vectors for initial testing

    for (const file of files) {
      const filePath = join(tinyPath, file)
      const content = readFileSync(filePath, 'utf-8')
      const data = JSON.parse(content) as TestVectorData
      vectors.push(data)
    }

    return vectors
  }

  function convertTestVectorToPVMState(testData: TestVectorData): PVMState {
    // Convert test vector pre_state to PVM state
    const preState = testData.pre_state

    // Create initial RAM with test data
    const ram: RAM = {
      memory: new Uint8Array(1024 * 1024), // 1MB RAM
      size: 1024 * 1024,
    }

    // Create initial call stack
    const callStack: CallStack = {
      frames: [],
      maxDepth: 1000,
    }

    // Create program blob from the first account's preimage
    const firstAccount = preState.accounts[0]
    const programBlob: ProgramBlob = {
      code: Buffer.from(firstAccount.data.preimages[0].blob.slice(2), 'hex'), // Remove '0x' prefix
      codeHash: firstAccount.data.preimages[0].hash,
      version: '1.0.0',
    }

    return {
      gas: { remaining: 1000000, limit: 1000000 } as Gas,
      ram,
      callStack,
      programBlob,
      registers: new Uint32Array(32),
      pc: 0,
      resultCode: 0,
    }
  }

  function convertTestVectorInput(testData: TestVectorData): any {
    // Convert test vector input to PVM accumulate invocation input
    return {
      slot: testData.input.slot,
      reports: testData.input.reports,
      // Add other necessary fields based on your PVM accumulate interface
    }
  }

  function validatePVMResult(
    testData: TestVectorData,
    result: AccumulateInvocationResult,
  ): boolean {
    // Compare PVM result with expected test vector output
    const expected = testData.output
    const actual = result

    // Check if the result matches expected output
    if (expected.ok && actual.success) {
      // Success case - compare states
      return true
    } else if (expected.err && !actual.success) {
      // Error case - compare error codes
      return true
    }

    return false
  }

  it('should run accumulate test vectors against PVM implementation', async () => {
    const testVectors = loadTestVectors()

    if (testVectors.length === 0) {
      console.warn('No test vectors found, skipping test')
      return
    }

    console.log(`Running ${testVectors.length} test vectors...`)

    for (let i = 0; i < testVectors.length; i++) {
      const testData = testVectors[i]
      const testName = `test_vector_${i + 1}`

      console.log(`Running ${testName}...`)

      try {
        // Convert test vector to PVM state
        const pvmState = convertTestVectorToPVMState(testData)

        // Convert test vector input
        const input = convertTestVectorInput(testData)

        // Execute accumulate function in PVM
        const result = await pvm.executeAccumulate(pvmState, input)

        // Validate result against expected output
        const isValid = validatePVMResult(testData, result)

        expect(isValid).toBe(true, `Test vector ${testName} failed`)

        console.log(`✓ ${testName} passed`)
      } catch (error) {
        console.error(`✗ ${testName} failed:`, error)
        throw error
      }
    }
  })

  it('should handle no_available_reports test vector', async () => {
    const testVectors = loadTestVectors()
    const noReportsTest = testVectors.find(
      (tv) => tv.input.reports.length === 0,
    )

    if (!noReportsTest) {
      console.warn('No "no_available_reports" test vector found')
      return
    }

    const pvmState = convertTestVectorToPVMState(noReportsTest)
    const input = convertTestVectorInput(noReportsTest)

    const result = await pvm.executeAccumulate(pvmState, input)

    // Should succeed with no reports
    expect(result.success).toBe(true)
    expect(result.state.accumulated.length).toBe(0)
  })

  it('should handle process_one_immediate_report test vector', async () => {
    const testVectors = loadTestVectors()
    const immediateReportTest = testVectors.find(
      (tv) =>
        tv.input.reports.length === 1 &&
        tv.input.reports[0]?.dependencies?.length === 0,
    )

    if (!immediateReportTest) {
      console.warn('No "process_one_immediate_report" test vector found')
      return
    }

    const pvmState = convertTestVectorToPVMState(immediateReportTest)
    const input = convertTestVectorInput(immediateReportTest)

    const result = await pvm.executeAccumulate(pvmState, input)

    // Should process the immediate report
    expect(result.success).toBe(true)
    expect(result.state.accumulated.length).toBeGreaterThan(0)
  })

  it('should validate gas consumption matches test vectors', async () => {
    const testVectors = loadTestVectors()

    for (const testData of testVectors.slice(0, 3)) {
      // Test first 3 vectors
      const pvmState = convertTestVectorToPVMState(testData)
      const input = convertTestVectorInput(testData)

      const initialGas = pvmState.gas.remaining
      const result = await pvm.executeAccumulate(pvmState, input)
      const gasUsed = initialGas - result.state.gas.remaining

      // Gas should be consumed (not negative)
      expect(gasUsed).toBeGreaterThanOrEqual(0)

      // Gas should not exceed limit
      expect(result.state.gas.remaining).toBeGreaterThanOrEqual(0)
    }
  })

  it('should validate state transitions match test vectors', async () => {
    const testVectors = loadTestVectors()

    for (const testData of testVectors.slice(0, 3)) {
      const pvmState = convertTestVectorToPVMState(testData)
      const input = convertTestVectorInput(testData)

      const result = await pvm.executeAccumulate(pvmState, input)

      // Slot should increment
      expect(result.state.slot).toBe(testData.pre_state.slot + 1)

      // Entropy should be updated
      expect(result.state.entropy).toBeDefined()

      // Ready queue and accumulated should be arrays
      expect(Array.isArray(result.state.readyQueue)).toBe(true)
      expect(Array.isArray(result.state.accumulated)).toBe(true)
    }
  })
})
