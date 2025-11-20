/**
 * PVM All Programs Test
 * Runs each PVM test JSON from the programs directory in order
 * 
 * This test loads all test vectors from pvm-test-vectors/pvm/programs/
 * and executes them sequentially to verify PVM correctness
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { executeTestVector, getTestVectorsDir, parseJsonSafe, type PVMTestVector } from './test-vector-helper'


const testVectorsDir = getTestVectorsDir()
const allFiles = readdirSync(testVectorsDir)
const jsonFiles = allFiles
  .filter(file => file.endsWith('.json'))
  .filter(file => file.startsWith('riscv'))
  // .filter(file => !file.startsWith('riscv_rv64um_divw')) // filter out passing tests
  // .filter(file => !file.startsWith('riscv_rv64ua_amomaxu_w')) // filter out passing tests
  // .filter(file => !file.startsWith('riscv_rv64ui_sh')) // does not pass, because STORE_IND_U16 should sign extend according to GP, but not in this riscv variation
  // .filter(file => !file.startsWith('riscv_rv64ui_sd')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64ui_slli')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64ui_lh')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64ui_ld')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64ua_amomin_d')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64ua_amomaxu_d')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64ui_lw')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64ua_amoxor_w')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64uc_rvc')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64ua_amoor_w')) // does not pass, deal with it late
  // .filter(file => !file.startsWith('riscv_rv64ua_amoor_d')) // does not pass, deal with it late

  // r
  // .sort() // Sort alphabetically for consistent order

console.log(`Found ${jsonFiles.length} test vector files`)

// Load all test vectors
const testVectors: PVMTestVector[] = []
for (const file of jsonFiles) {
  try {
    const filePath = join(testVectorsDir, file)
    const fileContents = readFileSync(filePath, 'utf-8')
    
    // Parse JSON with all numbers as strings to avoid precision loss
    const testVector = parseJsonSafe(fileContents) as PVMTestVector
    
    testVectors.push(testVector)
    console.log(`Loaded test vector: ${file}`)
  } catch (error) {
    console.warn(`Failed to load test vector ${file}:`, error)
    // Continue with other files
  }
}

console.log(`Successfully loaded ${testVectors.length} test vectors`)

// Run each test vector
for (let i = 0; i < testVectors.length; i++) {
  const testVector = testVectors[i]
  
  try {
      // Execute the program
      const result = await executeTestVector(testVector)

      // Verify registers match expected values
      for (let j = 0; j < 13; j++) {
          if(result.registers[j] !== BigInt(testVector['expected-regs'][j])) {
              console.error(`❌ Test failed: ${testVector.name}`, {
                  expected: `${testVector['expected-regs'][j]} at register ${j}`,
                  actual: `${result.registers[j]} at register ${j}`,
              })
              throw new Error(`Test failed: ${testVector.name}`)
          }
      }

      // Verify gas usage
      if(result.status !== 'page-fault') {
        if(result.gas !== Number(testVector['expected-gas'])) {
            console.error(`❌ Test failed: ${testVector.name}`, {
                expected: testVector['expected-gas'],
                actual: result.gas,
            })
            throw new Error(`Test failed: ${testVector.name}`)
        }
    }

      // Verify PC
      if(result.pc !== Number(testVector['expected-pc'])) {
          console.error(`❌ Test failed: ${testVector.name}`, {
              expected: testVector['expected-pc'],
              actual: result.pc,
          })
          throw new Error(`Test failed: ${testVector.name}`)
      }

      // Verify exit status
      if(testVector['expected-status'] !== result.status) {
        console.error(`❌ Test failed: ${testVector.name}`, {
          expected: testVector['expected-status'],
          actual: result.status,
        })
        throw new Error(`Test failed: ${testVector.name}`)
      }

      // Verify page fault address
      if(testVector['expected-page-fault-address'] && result.faultAddress !== BigInt(testVector['expected-page-fault-address'])) {
        console.error(`❌ Test failed: ${testVector.name}`, {
          expected: testVector['expected-page-fault-address'],
          actual: result.faultAddress,
        })
        throw new Error(`Test failed: ${testVector.name}`)
      }

      // Verify memory if expected
      if (testVector['expected-memory']) {
        for (const memBlock of testVector['expected-memory']) {
          const address = BigInt(memBlock.address)
          const expectedContents = memBlock.contents.map(Number)
          
          for (let k = 0; k < expectedContents.length; k++) {
            const addr = address + BigInt(k)
            const actualValue = result.memory.get(addr)
            if(actualValue !== expectedContents[k]) {
              console.error(`❌ Test failed: ${testVector.name}`, {
                  expected: expectedContents[k],
                  actual: actualValue,
              })
              throw new Error(`Test failed: ${testVector.name}`)
            }
          }
        }
      }

      console.log(`✅ Test passed: ${testVector.name}`)
    } catch (error) {
      console.error(`❌ Test failed: ${testVector.name}`, error)
      
      // Create test failure dump similar to panic dump
      try {
        const result = await executeTestVector(testVector)
        
        // Get execution logs from PVM
        // IMPORTANT: Do NOT sort these logs - they are already in execution order
        // Sorting by PC would break the execution sequence (branches/jumps cause PC to go backwards)
        const executionLogs = result.pvm.getExecutionLogs().map((log) => {
          const serializedData = log.data
            ? Object.fromEntries(
                Object.entries(log.data).map(([key, value]) => [
                  key,
                  typeof value === 'bigint' ? value.toString() : value,
                ]),
              )
            : undefined

          return {
            pc: log.pc.toString(),
            instructionName: log.instructionName,
            opcode: log.opcode,
            message: log.message,
            data: serializedData,
            timestamp: log.timestamp,
          }
        })

        // Get page map - only include pages that have been written to (non-zero contents)
        const allPages = result.pvm.getState().ram.getPageMapWithContentsJSON()
        const pageMap = allPages.filter((page) => {
          // Include page if it has any non-zero contents
          return page.contents.some((byte) => byte !== 0)
        })

        // Find register mismatches
        const registerMismatches: Array<{
          register: number
          expected: string
          actual: string
        }> = []
        for (let j = 0; j < 13; j++) {
          if (result.registers[j] !== BigInt(testVector['expected-regs'][j])) {
            registerMismatches.push({
              register: j,
              expected: testVector['expected-regs'][j].toString(),
              actual: result.registers[j].toString(),
            })
          }
        }

        // Get last instruction executed
        const lastInstruction = executionLogs.length > 0
          ? {
              pc: executionLogs[executionLogs.length - 1].pc,
              instructionName: executionLogs[executionLogs.length - 1].instructionName,
              opcode: executionLogs[executionLogs.length - 1].opcode,
              message: executionLogs[executionLogs.length - 1].message,
              data: executionLogs[executionLogs.length - 1].data,
            }
          : null

        // Create test failure dump
        // Ensure all register values are serialized as strings
        const testDump = {
          timestamp: new Date().toISOString(),
          testVectorName: testVector.name,
          testVector: {
            name: testVector.name,
            'initial-regs': testVector['initial-regs'].map(v => typeof v === 'string' ? v : String(v)),
            'initial-pc': typeof testVector['initial-pc'] === 'string' ? testVector['initial-pc'] : String(testVector['initial-pc']),
            'initial-gas': typeof testVector['initial-gas'] === 'string' ? testVector['initial-gas'] : String(testVector['initial-gas']),
            'expected-regs': testVector['expected-regs'].map(v => typeof v === 'string' ? v : String(v)),
            'expected-pc': typeof testVector['expected-pc'] === 'string' ? testVector['expected-pc'] : String(testVector['expected-pc']),
            'expected-gas': typeof testVector['expected-gas'] === 'string' ? testVector['expected-gas'] : String(testVector['expected-gas']),
            'expected-status': testVector['expected-status'],
          },
          actualResult: {
            registers: result.registers.map((r, i) => ({
              register: i,
              value: r.toString(),
            })),
            pc: result.pc,
            gas: result.gas,
            status: result.status,
            faultAddress: result.faultAddress?.toString() ?? null,
          },
          registerMismatches,
          mismatches: {
            registers: registerMismatches.length > 0,
            pc: result.pc !== Number(testVector['expected-pc']),
            gas: result.status !== 'page-fault' && result.gas !== Number(testVector['expected-gas']),
            status: testVector['expected-status'] !== result.status,
          },
          postState: {
            pc: result.pvm.getState().programCounter.toString(),
            resultCode: result.pvm.getState().resultCode,
            gasCounter: result.pvm.getState().gasCounter.toString(),
            registers: result.pvm.getState().registerState.reduce(
              (acc, r, i) => {
                acc[`r${i}`] = r.toString()
                return acc
              },
              {} as Record<string, string>,
            ),
            faultAddress: result.pvm.getState().faultAddress?.toString() ?? null,
          },
          lastInstruction,
          pageMap,
          executionLogs,
        }

        // Create test dump directory
        const testDumpDir = join(process.cwd(), 'packages', 'pvm', 'src', 'instructions', '__tests__', 'test-failure-dumps')
        mkdirSync(testDumpDir, { recursive: true })

        // Create filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const filename = `test-failure-${testVector.name}-${timestamp}.json`
        const filepath = join(testDumpDir, filename)

        // Write to file
        writeFileSync(
          filepath,
          JSON.stringify(
            testDump,
            (_key, value) => {
              if (typeof value === 'bigint') {
                return value.toString()
              }
              return value
            },
            2,
          ),
          'utf-8',
        )

        console.error(`📄 Test failure dump saved to: ${filepath}`)
      } catch (dumpError) {
        console.error('Failed to create test failure dump:', dumpError)
      }
      
      throw error
    }
  }

