/**
 * PVM All Programs Test (using test-vector-whole.ts)
 * Runs each PVM test JSON from the programs directory in order
 * 
 * This test loads all test vectors from pvm-test-vectors/pvm/programs/
 * and executes them using executeTestVectorStepByStep from test-vector-whole.ts
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { executeTestVectorStepByStep, getTestVectorsDir, parseJsonSafe, type PVMTestVector, dumpParsedInstructions } from './test-vector-whole'
import { PVMParser, InstructionRegistry } from '@pbnjam/pvm'


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
      // Execute the program using executeTestVectorStepByStep from test-vector-whole.ts
      const result = await executeTestVectorStepByStep(testVector)

      // Decode registers from Uint8Array (104 bytes: 13 registers x 8 bytes each, little-endian)
      const registerView = new DataView(result.registers.buffer)
      const decodedRegisters: bigint[] = []
      for (let j = 0; j < 13; j++) {
        decodedRegisters[j] = registerView.getBigUint64(j * 8, true)
      }

      // Verify registers match expected values
      for (let j = 0; j < 13; j++) {
          if(decodedRegisters[j] !== BigInt(testVector['expected-regs'][j])) {
              console.error(`❌ Test failed: ${testVector.name}`, {
                  expected: `${testVector['expected-regs'][j]} at register ${j}`,
                  actual: `${decodedRegisters[j]} at register ${j}`,
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
      
      // Dump parsed instructions to test-failures directory
      try {
        const result = await executeTestVectorStepByStep(testVector)
        console.log(`\n🔍 Dumping parsed instructions for failed test at PC ${result.pc}...`)
        dumpParsedInstructions(testVector, result.pc)
      } catch (dumpError) {
        console.error('❌ Error getting result for dump, trying without PC:', dumpError)
        // If we can't get the result, try to dump with just the test vector
        try {
          dumpParsedInstructions(testVector)
        } catch (dumpError2) {
          console.error('❌ Failed to dump parsed instructions:', dumpError2)
        }
      }
      
      // Create test failure dump similar to panic dump
      try {
        const result = await executeTestVectorStepByStep(testVector)
        
        // Note: executeTestVectorStepByStep doesn't provide execution logs or PVM state access
        // Execution logs are not available with this API
        const executionLogs: Array<{
          pc: string
          instructionName: string
          opcode: string
          message: string
          data?: Record<string, unknown>
          timestamp: number
        }> = []

        // Get page map from memory chunks
        // Note: executeTestVectorStepByStep doesn't provide full page map, only memory chunks
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

        // Parse program again to get full parse result with codeLength
        const parser = new PVMParser()
        const programBytes = testVector.program.map(Number)
        const programBlob = new Uint8Array(programBytes)
        const parsed = parser.parseProgram(programBlob)
        
        // Prepare instructions with names (same format as dumpParsedInstructions)
        const registry = new InstructionRegistry()
        const instructionsWithNames = parsed.success ? parsed.instructions.map((inst, index) => {
          const handler = registry.getHandler(Number(inst.opcode))
          const instructionName = handler ? handler.name : `UNKNOWN_OPCODE_${inst.opcode.toString()}`
          const operandsStr = Array.from(inst.operands)
            .map(b => `0x${b.toString(16).padStart(2, '0')}`)
            .join(', ')
          
          return {
            index,
            pc: inst.pc.toString(),
            pcHex: `0x${inst.pc.toString(16)}`,
            opcode: inst.opcode.toString(),
            opcodeHex: `0x${inst.opcode.toString(16)}`,
            name: instructionName,
            operands: Array.from(inst.operands).map(b => `0x${b.toString(16).padStart(2, '0')}`),
            operandsStr,
            fskip: inst.fskip,
            isFailed: Number(inst.pc) === result.pc,
          }
        }) : []
        
        // Get last instruction executed from parsed instructions
        const lastInstruction = instructionsWithNames.find(
          (inst) => inst.pc === result.pc.toString()
        ) || (instructionsWithNames.length > 0
          ? instructionsWithNames[instructionsWithNames.length - 1]
          : null)
        
        // Convert to proper format if found
        const lastInstFormatted = lastInstruction
          ? {
              pc: lastInstruction.pc,
              pcHex: lastInstruction.pcHex,
              instructionName: lastInstruction.name,
              opcode: lastInstruction.opcode,
              opcodeHex: lastInstruction.opcodeHex,
              operands: lastInstruction.operands,
              operandsStr: lastInstruction.operandsStr,
              fskip: lastInstruction.fskip,
              message: 'Parsed from program',
              data: {
                operands: lastInstruction.operands,
              },
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
          parsedProgram: parsed.success ? {
            programInfo: {
              codeLength: parsed.codeLength,
              jumpTableSize: parsed.jumpTable.length,
              bitmaskLength: parsed.bitmask.length,
              instructionsCount: parsed.instructions.length,
            },
            jumpTable: parsed.jumpTable.map((target, index) => ({
              index,
              target: target.toString(),
              targetHex: `0x${target.toString(16)}`,
            })),
            instructions: instructionsWithNames,
            failedPC: {
              pc: result.pc,
              instruction: instructionsWithNames.find(inst => inst.isFailed) || null,
            },
            parseErrors: parsed.errors,
            success: true,
          } : {
            instructions: [],
            jumpTable: [],
            bitmask: [],
            parseErrors: parsed.errors,
            success: false,
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

