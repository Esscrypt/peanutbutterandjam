import { PVMState, RAM } from '../../pbnj-types-compat'
import { HostFunctionResult } from '../accumulate/base'
import { HostFunctionContext, HostFunctionParams, InvokeParams } from './base'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  RESULT_CODES,
} from '../../config'
import { BaseHostFunction } from './base'

/**
 * INVOKE host function (Ω_K)
 *
 * Invokes execution on a PVM machine instance
 *
 * Gray Paper Specification (pvm-invocations.tex line 103, 626-653):
 * - Function ID: 12 (invoke)
 * - Gas Cost: 10
 * - Signature: Ω_K(gascounter, registers, memory, (m, e))
 *   - (m, e) = refine context pair (machines, export segments)
 * - Uses registers[7] for machine ID (n)
 * - Uses registers[8] for memory offset (o)
 * - Reads gas limit (8 bytes) and register values (13 × 8 = 104 bytes) from memory[o:112]
 * - Executes PVM machine with specified parameters
 * - Returns execution result (HALT, PANIC, FAULT, OOG, HOST)
 * - Updates machine state (RAM and PC) and writes results back to memory
 */


export class InvokeHostFunction extends BaseHostFunction {
  functionId: u64 = GENERAL_FUNCTIONS.INVOKE
  name: string = 'invoke'
  gasCost: u64 = 10

  execute(
    context: HostFunctionContext,
    params: HostFunctionParams | null,
  ): HostFunctionResult {
    if (!params) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }
    const invokeParams = params as InvokeParams
    if (!invokeParams.refineContext) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }
    
    // Gray Paper: Extract parameters from registers
    // registers[7] = machine ID (n)
    // registers[8] = memory offset (o)
    const machineId = context.registers[7]
    const memoryOffset = context.registers[8]

    const refineContext = invokeParams.refineContext!
    const machines = refineContext.machines

    // Gray Paper equation 646: Check if machine exists
    // Return WHO if n not in m
    const machine = machines.get(machineId)
    if (!machine) {
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
      return new HostFunctionResult(255) // continue execution
    }

    // Gray Paper equation 630-633: Read gas limit and register values from memory
    // (g, w) = decode[8]{g} || decode[8]{w} = memory[o:112]
    // where memory[o:112] must be readable
    const readResult_gasLimitData = context.ram.readOctets(
      u32(memoryOffset),
      8,
    )
    const gasLimitData = readResult_gasLimitData.data
    const gasFaultAddress = readResult_gasLimitData.faultAddress
    if (gasLimitData === null || gasFaultAddress !== 0) {
      // Gray Paper equation 645: Return panic if memory not readable
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }
    const gasLimit = this.decodeU64(gasLimitData)

    // Gray Paper: Read register values (13 registers * 8 bytes each = 104 bytes)
    const readResult_registersData = context.ram.readOctets(
      u32(memoryOffset + 8),
      104,
    )
    const registersData = readResult_registersData.data
    const registersFaultAddress = readResult_registersData.faultAddress
    if (registersData === null || registersFaultAddress !== 0) {
      // Gray Paper equation 645: Return panic if memory not readable
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }

    // Decode register values (13 registers * 8 bytes each = 104 bytes)
    const registers = new StaticArray<u64>(13)
    for (let i: i32 = 0; i < 13; i++) {
      const registerData = registersData.slice(i * 8, (i + 1) * 8)
      registers[i] = this.decodeU64(registerData)
    }

    // Gray Paper equation 635: Execute PVM machine
    // (c, i', g', w', u') = Ψ(code, pc, g, w, ram)
    // Get code, bitmask, and jumpTable from machine's current state
    const pvm = machine.pvm
    pvm.invoke(
      u32(gasLimit),
      registers,
      pvm.state.code,
      pvm.state.bitmask,
      pvm.state.jumpTable,
    )

    const pvmState = pvm.state

    // Gray Paper equation 636: Update memory
    // memory*[o:112] = encode[8]{g'} || encode[8]{w'}
    this.writeInvokeResults(context.ram, memoryOffset, pvmState)

    // Gray Paper equation 637-642: Update machine state
    // m*[n].ram = u' (already updated in machine.pvm.state.ram)
    // m*[n].pc = i' + fskip(i') + 1 if HOST, else i' (already updated in machine.pvm.state.programCounter)
    // Note: The PVM state is already updated by the invoke call, so no explicit assignment needed

    // Gray Paper equation 644-652: Return result code in registers[7] and registers[8]
    const resultCode = pvmState.resultCode
    if (resultCode === RESULT_CODES.HOST) {
      // Gray Paper equation 647: Return HOST with host call ID
      context.registers[7] = u64(RESULT_CODES.HOST)
      context.registers[8] = u64(pvmState.hostCallId || 0)
    } else if (resultCode === RESULT_CODES.FAULT) {
      // Gray Paper equation 648: Return FAULT with fault address
      context.registers[7] = u64(RESULT_CODES.FAULT)
      context.registers[8] = u64(pvmState.faultAddress || 0)
    } else if (resultCode === RESULT_CODES.OOG) {
      // Gray Paper equation 649: Return OOG
      context.registers[7] = u64(RESULT_CODES.OOG)
    } else if (resultCode === RESULT_CODES.PANIC) {
      // Gray Paper equation 650: Return PANIC
      context.registers[7] = u64(RESULT_CODES.PANIC)
    } else if (resultCode === RESULT_CODES.HALT) {
      // Gray Paper equation 651: Return HALT
      context.registers[7] = u64(RESULT_CODES.HALT)
    }

    return new HostFunctionResult(255) // continue execution
  }

  writeInvokeResults(ram: RAM, offset: u64, pvm: PVMState): void {
    // Gray Paper: mem*[o:112] = encode[8]{g'} ∥ encode[8]{w'}
    // Write final gas (8 bytes)
    const gasData = this.encodeU64(pvm.gasCounter)
    const gasWriteResult = ram.writeOctets(u32(offset), gasData)
    if (gasWriteResult.hasFault) {
      return // Ignore write errors
    }

    // Write final registers (13 registers * 8 bytes each = 104 bytes)
    const registersData = new Uint8Array(104)
    for (let i: i32 = 0; i < 13; i++) {
      const registerValue = pvm.registerState[i] || u64(0)
      const registerBytes = this.encodeU64(registerValue)
      registersData.set(registerBytes, i * 8)
    }
    const registersWriteResult = ram.writeOctets(u32(offset + 8), registersData)
    if (registersWriteResult.hasFault) {
      return // Ignore write errors
    }
  }

  // Helper to decode u64 from little-endian bytes
  decodeU64(bytes: Uint8Array): u64 {
    let value: u64 = u64(0)
    for (let i: i32 = 0; i < 8 && i < bytes.length; i++) {
      value |= (u64(bytes[i]) << (u64(i) * 8))
    }
    return value
  }

  // Helper to encode u64 to little-endian bytes
  encodeU64(value: u64): Uint8Array {
    const bytes = new Uint8Array(8)
    for (let i: i32 = 0; i < 8; i++) {
      bytes[i] = u8((value >> (u64(i) * 8)) & 0xff)
    }
    return bytes
  }
}
