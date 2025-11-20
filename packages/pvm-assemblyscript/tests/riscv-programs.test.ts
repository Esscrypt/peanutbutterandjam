/**
 * PVM All Programs Test
 * Runs each PVM test JSON from the programs directory in order
 * 
 * This test loads all test vectors from pvm-test-vectors/pvm/programs/
 * and executes them sequentially to verify PVM correctness
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { executeTestVectorWithRunProgram, getTestVectorsDir, parseJsonSafe, type PVMTestVector } from './test-vector-helper'


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
      // Execute the program using runProgram with PVMRAM
      const result = await executeTestVectorWithRunProgram(testVector)

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
        const result = await executeTestVectorWithRunProgram(testVector)
        
        // Note: runProgram doesn't provide execution logs or PVM state access
        // Execution logs are not available with runProgram API
        const executionLogs: Array<{
          pc: string
          instructionName: string
          opcode: string
          message: string
          data?: Record<string, unknown>
          timestamp: number
        }> = []

        // Get page map from memory chunks in VmOutput
        // Note: runProgram doesn't provide full page map, only memory chunks
        const pageMap: Array<{
          address: string
          length: number
          isWritable: boolean
          contents: number[]
        }> = []

        // Find register mismatches
        const registerMismatches: Array<{
          register: number
          expected: string
          actual: string
        }> = []
        const registerView = new DataView(result.registers.buffer)
        for (let j = 0; j < 13; j++) {
          const actualValue = registerView.getBigUint64(j * 8, true)
          const expectedValue = BigInt(String(testVector['expected-regs'][j]))
          if (actualValue !== expectedValue) {
            registerMismatches.push({
              register: j,
              expected: expectedValue.toString(),
              actual: actualValue.toString(),
            })
          }
        }

        // Get last instruction executed from parsed instructions
        // Use parseResult to get instruction info at the final PC
        const lastInstruction = result.parseResult.instructions.find(
          (inst) => inst.pc === BigInt(result.pc)
        ) || (result.parseResult.instructions.length > 0
          ? {
              pc: result.parseResult.instructions[result.parseResult.instructions.length - 1].pc.toString(),
              instructionName: `opcode_${result.parseResult.instructions[result.parseResult.instructions.length - 1].opcode}`,
              opcode: result.parseResult.instructions[result.parseResult.instructions.length - 1].opcode.toString(),
              message: 'Parsed from program',
              data: {
                operands: Array.from(result.parseResult.instructions[result.parseResult.instructions.length - 1].operands),
              },
            }
          : null)
        
        // Convert to proper format if found
        const lastInstFormatted = lastInstruction && typeof lastInstruction === 'object' && 'pc' in lastInstruction
          ? {
              pc: typeof lastInstruction.pc === 'bigint' ? lastInstruction.pc.toString() : lastInstruction.pc,
              instructionName: lastInstruction.instructionName || 'unknown',
              opcode: typeof lastInstruction.opcode === 'bigint' ? lastInstruction.opcode.toString() : lastInstruction.opcode,
              message: lastInstruction.message || 'Parsed from program',
              data: lastInstruction.data || {},
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
            registers: (() => {
              const regs: Array<{ register: number; value: string }> = []
              const regView = new DataView(result.registers.buffer)
              for (let i = 0; i < 13; i++) {
                const value = regView.getBigUint64(i * 8, true)
                regs.push({ register: i, value: value.toString() })
              }
              return regs
            })(),
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
            pc: result.pc.toString(),
            resultCode: result.status === 'halt' ? 0 : result.status === 'panic' ? 2 : result.status === 'page-fault' ? 3 : 1,
            gasCounter: result.gas.toString(),
            registers: (() => {
              const regs: Record<string, string> = {}
              const regView = new DataView(result.registers.buffer)
              for (let i = 0; i < 13; i++) {
                const value = regView.getBigUint64(i * 8, true)
                regs[`r${i}`] = value.toString()
              }
              return regs
            })(),
            faultAddress: result.faultAddress?.toString() ?? null,
          },
          lastInstruction: lastInstFormatted,
          pageMap,
          executionLogs,
          parsedProgram: {
            instructions: result.parseResult.instructions.map((inst) => ({
              pc: inst.pc.toString(),
              opcode: inst.opcode.toString(),
              operands: Array.from(inst.operands),
            })),
            jumpTable: result.parseResult.jumpTable.map((jt) => jt.toString()),
            bitmask: Array.from(result.parseResult.bitmask),
            success: result.parseResult.success,
          },
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

