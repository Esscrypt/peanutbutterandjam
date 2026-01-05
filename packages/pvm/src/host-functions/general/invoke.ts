import type {
  HostFunctionContext,
  HostFunctionResult,
  InvokeParams,
  PVMState,
  RAM,
} from '@pbnjam/types'
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
  readonly functionId = GENERAL_FUNCTIONS.INVOKE
  readonly name = 'invoke'
  readonly gasCost = 10n

  execute(
    context: HostFunctionContext,
    params: InvokeParams,
  ): HostFunctionResult {
    // Gray Paper: Extract parameters from registers
    // registers[7] = machine ID (n)
    // registers[8] = memory offset (o)
    const machineId = context.registers[7]
    const memoryOffset = context.registers[8]

    const machines = params.refineContext.machines

    // Gray Paper equation 646: Check if machine exists
    // Return WHO if n not in m
    const machine = machines.get(machineId)
    if (!machine) {
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
      return {
        resultCode: null, // continue execution
      }
    }

    // Gray Paper equation 630-633: Read gas limit and register values from memory
    // (g, w) = decode[8]{g} || decode[8]{w} = memory[o:112]
    // where memory[o:112] must be readable
    const [gasLimitData, gasFaultAddress] = context.ram.readOctets(
      memoryOffset,
      8n,
    )
    if (gasFaultAddress || gasLimitData === null) {
      // Gray Paper equation 645: Return panic if memory not readable
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_read',
          address: gasFaultAddress ?? 0n,
          details: 'Memory not readable',
        },
      }
    }
    const gasLimit = new DataView(gasLimitData.buffer).getBigUint64(0, true)

    // Gray Paper: Read register values (13 registers * 8 bytes each = 104 bytes)
    const [registersData, registersFaultAddress] = context.ram.readOctets(
      memoryOffset + 8n,
      104n,
    )
    if (registersFaultAddress || !registersData) {
      // Gray Paper equation 645: Return panic if memory not readable
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_read',
          address: registersFaultAddress ?? 0n,
          details: 'Memory not readable',
        },
      }
    }

    // Decode register values (13 registers * 8 bytes each = 104 bytes)
    const registers: bigint[] = []
    for (let i = 0; i < 13; i++) {
      const registerData = registersData.slice(i * 8, (i + 1) * 8)
      registers.push(new DataView(registerData.buffer).getBigUint64(0, true))
    }

    // Gray Paper equation 635: Execute PVM machine
    // (c, i', g', w', u') = Ψ(code, pc, g, w, ram)
    machine.pvm.invoke(gasLimit, registers, machine.code)

    const pvmState = machine.pvm.state

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
      context.registers[7] = BigInt(RESULT_CODES.HOST)
      context.registers[8] = pvmState.hostCallId ?? 0n
    } else if (resultCode === RESULT_CODES.FAULT) {
      // Gray Paper equation 648: Return FAULT with fault address
      context.registers[7] = BigInt(RESULT_CODES.FAULT)
      context.registers[8] = pvmState.faultAddress ?? 0n
    } else if (resultCode === RESULT_CODES.OOG) {
      // Gray Paper equation 649: Return OOG
      context.registers[7] = BigInt(RESULT_CODES.OOG)
    } else if (resultCode === RESULT_CODES.PANIC) {
      // Gray Paper equation 650: Return PANIC
      context.registers[7] = BigInt(RESULT_CODES.PANIC)
    } else if (resultCode === RESULT_CODES.HALT) {
      // Gray Paper equation 651: Return HALT
      context.registers[7] = BigInt(RESULT_CODES.HALT)
    }

    return {
      resultCode: null, // continue execution
    }
  }

  private writeInvokeResults(ram: RAM, offset: bigint, pvm: PVMState): void {
    try {
      // Gray Paper: mem*[o:112] = encode[8]{g'} ∥ encode[8]{w'}
      // Write final gas (8 bytes)
      const gasData = new Uint8Array(8)
      new DataView(gasData.buffer).setBigUint64(0, pvm.gasCounter, true)
      ram.writeOctets(offset, gasData)

      // Write final registers (13 registers * 8 bytes each = 104 bytes)
      const registersData = new Uint8Array(104)
      for (let i = 0; i < 13; i++) {
        const registerValue = pvm.registerState[i] || 0n
        const view = new DataView(registersData.buffer, i * 8, 8)
        view.setBigUint64(0, registerValue, true)
      }
      ram.writeOctets(offset + 8n, registersData)
    } catch {
      // Ignore write errors
    }
  }
}
