/**
 * Debug test to compare TypeScript and WASM parsing outputs
 */

import { instantiate } from '@assemblyscript/loader'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BaseInstruction } from '../../pvm/src/instructions/base'

describe('Debug Parsing Comparison', () => {
  let wasmModule: any = null

  beforeAll(async () => {
    // Load WASM module
    const wasmPath = join(__dirname, '../build/pvm.wasm')
    wasmModule = await instantiate(readFileSync(wasmPath))
  })

  it('should compare parseOneRegisterAndImmediateUnsigned outputs', async () => {
    // Test case from inst_load_i16:
    // Operands: [7, 0, 0, 2]
    // fskip: 4
    const operands = new Uint8Array([7, 0, 0, 2])
    const fskip = 4

    // TypeScript version
    class TempInstruction extends BaseInstruction {
      readonly opcode = 0
      readonly name = 'TEMP'
    }
    const tsTemp = new TempInstruction()
    const tsResult = tsTemp.parseOneRegisterAndImmediateUnsigned(operands, fskip)

    console.log('\n=== TypeScript Parsing ===')
    console.log('Operands:', Array.from(operands))
    console.log('fskip:', fskip)
    console.log('registerA:', tsResult.registerA)
    console.log('lengthX:', tsResult.lengthX)
    console.log('immediateX:', tsResult.immediateX.toString(), `(0x${tsResult.immediateX.toString(16)})`)

    // WASM version
    const exports = wasmModule.exports
    // Allocate memory in WASM and copy operands
    const operandsPtr = exports.__new(operands.length, 0) // id=0 for Uint8Array
    const operandsView = new Uint8Array(exports.memory.buffer, operandsPtr, operands.length)
    operandsView.set(operands)
    
    const wasmResultPtr = exports.debugParseOneRegisterAndImmediateUnsigned(
      operandsPtr,
      operands.length,
      fskip
    )

    if (wasmResultPtr === 0) {
      throw new Error('WASM returned null pointer')
    }

    const wasmResultView = new DataView(exports.memory.buffer, wasmResultPtr, 16)
    const wasmRegisterA = wasmResultView.getUint8(0)
    const wasmLengthX = wasmResultView.getInt32(4, true)
    const wasmImmediateX = wasmResultView.getBigUint64(8, true)

    console.log('\n=== WASM Parsing ===')
    console.log('registerA:', wasmRegisterA)
    console.log('lengthX:', wasmLengthX)
    console.log('immediateX:', wasmImmediateX.toString(), `(0x${wasmImmediateX.toString(16)})`)

    console.log('\n=== Comparison ===')
    console.log('registerA match:', tsResult.registerA === wasmRegisterA)
    console.log('lengthX match:', tsResult.lengthX === wasmLengthX)
    console.log('immediateX match:', tsResult.immediateX === wasmImmediateX)

    // Cleanup
    exports.__unpin(operandsPtr)
    exports.__unpin(wasmResultPtr)

    expect(tsResult.registerA).toBe(wasmRegisterA)
    expect(tsResult.lengthX).toBe(wasmLengthX)
    expect(tsResult.immediateX).toBe(wasmImmediateX)
  })

  it('should compare getImmediateValueUnsigned outputs', async () => {
    // Test case: operands[1:4] = [0, 0, 2], length = 3
    const operands = new Uint8Array([7, 0, 0, 2])
    const startIndex = 1
    const length = 3

    // TypeScript version
    class TempInstruction extends BaseInstruction {
      readonly opcode = 0
      readonly name = 'TEMP'
    }
    const tsTemp = new TempInstruction()
    const tsValue = tsTemp.getImmediateValueUnsigned(operands, startIndex, length)

    console.log('\n=== TypeScript getImmediateValueUnsigned ===')
    console.log('Operands:', Array.from(operands))
    console.log('startIndex:', startIndex)
    console.log('length:', length)
    console.log('Value:', tsValue.toString(), `(0x${tsValue.toString(16)})`)

    // WASM version
    const exports = wasmModule.exports
    // Allocate memory in WASM and copy operands
    const operandsPtr = exports.__new(operands.length, 0) // id=0 for Uint8Array
    const operandsView = new Uint8Array(exports.memory.buffer, operandsPtr, operands.length)
    operandsView.set(operands)
    
    const wasmValue = exports.debugGetImmediateValueUnsigned(
      operandsPtr,
      operands.length,
      startIndex,
      length
    )

    console.log('\n=== WASM getImmediateValueUnsigned ===')
    console.log('Value:', wasmValue.toString(), `(0x${wasmValue.toString(16)})`)

    console.log('\n=== Comparison ===')
    console.log('Values match:', tsValue === wasmValue)

    // Cleanup
    exports.__unpin(operandsPtr)

    expect(tsValue).toBe(wasmValue)
  })
})

