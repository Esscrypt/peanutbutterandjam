import type {
  HostFunctionContext,
  HostFunctionResult,
  PVMGuest,
  RAM,
  RefineContextPVM,
} from '@pbnj/types'
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
 * Gray Paper Specification:
 * - Function ID: 12 (invoke)
 * - Gas Cost: 10
 * - Uses registers[7:2] to specify machine ID and memory offset
 * - Reads gas limit and register values from memory
 * - Executes PVM machine with specified parameters
 * - Returns execution result (HALT, PANIC, FAULT, OOG, HOST)
 * - Updates machine state and writes results back to memory
 */
export class InvokeHostFunction extends BaseHostFunction {
  readonly functionId = GENERAL_FUNCTIONS.INVOKE
  readonly name = 'invoke'
  readonly gasCost = 10n

  execute(
    context: HostFunctionContext,
    refineContext?: RefineContextPVM,
  ): HostFunctionResult {
    // Validate execution
    if (context.gasCounter < this.gasCost) {
      return {
        resultCode: RESULT_CODES.OOG,
      }
    }

    context.gasCounter -= this.gasCost

    const machineId = context.registers[7]
    const memoryOffset = context.registers[8]

    // Check if refine context is available
    if (!refineContext) {
      // If no refine context available, return WHO
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO // WHO
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    const machines = refineContext.machines

    // Check if machine exists
    const machine = machines.get(machineId)
    if (!machine) {
      // Return WHO (2^64 - 4) if machine doesn't exist
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Read gas limit and register values from memory
    const params = this.readInvokeParameters(context.ram, memoryOffset)
    if (!params) {
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Execute PVM machine
    const result = this.executePVMMachine(
      machine,
      params.gasLimit,
      params.registers,
    )

    // Write results back to memory
    this.writeInvokeResults(context.ram, memoryOffset, result)

    // Return execution result code
    context.registers[7] = BigInt(result.resultCode)

    return {
      resultCode: null, // continue execution
    }
  }

  private readInvokeParameters(
    ram: RAM,
    offset: bigint,
  ): { gasLimit: bigint; registers: bigint[] } | null {
    try {
      // Read gas limit (8 bytes)
      const [accessError, gasLimitData] = ram.readOctets(offset, 8n)
      if (accessError || !gasLimitData) {
        return null
      }
      const gasLimit = new DataView(gasLimitData.buffer).getBigUint64(0, true)

      // Read register values (13 registers * 8 bytes each = 104 bytes)
      const [accessError2, registersData] = ram.readOctets(offset + 8n, 104n)
      if (accessError2 || !registersData) {
        return null
      }

      const registers: bigint[] = []
      for (let i = 0; i < 13; i++) {
        const registerData = registersData.slice(i * 8, (i + 1) * 8)
        registers.push(new DataView(registerData.buffer).getBigUint64(0, true))
      }

      return { gasLimit, registers }
    } catch {
      return null
    }
  }

  private executePVMMachine(
    machine: PVMGuest,
    gasLimit: bigint,
    registers: bigint[],
  ): {
    resultCode: number
    hostCallId?: bigint
    finalRegisters: bigint[]
    finalPC: bigint
    finalGas: bigint
  } {
    // Use the actual PVM instance if available
    if (machine.pvm) {
      const result = machine.pvm.invoke(gasLimit, registers)

      // Update machine state
      machine.pc = result.finalPC

      return {
        resultCode: result.resultCode,
        hostCallId: result.hostCallId,
        finalRegisters: result.finalRegisters,
        finalPC: result.finalPC,
        finalGas: result.finalGas,
      }
    }

    // Fallback: return error if no PVM instance
    return {
      resultCode: RESULT_CODES.PANIC,
      finalRegisters: registers,
      finalPC: machine.pc,
      finalGas: gasLimit,
    }
  }

  private writeInvokeResults(
    ram: RAM,
    offset: bigint,
    result: {
      resultCode: number
      hostCallId?: bigint
      finalRegisters: bigint[]
      finalPC: bigint
      finalGas: bigint
    },
  ): void {
    try {
      // Write final registers (13 registers * 8 bytes each = 104 bytes)
      const registersData = new Uint8Array(104)
      for (let i = 0; i < 13; i++) {
        const registerValue = result.finalRegisters[i] || 0n
        const view = new DataView(registersData.buffer, i * 8, 8)
        view.setBigUint64(0, registerValue, true)
      }
      ram.writeOctets(offset, registersData)

      // Write final PC (8 bytes)
      const pcData = new Uint8Array(8)
      new DataView(pcData.buffer).setBigUint64(0, result.finalPC, true)
      ram.writeOctets(offset + 104n, pcData)

      // Write final gas (8 bytes)
      const gasData = new Uint8Array(8)
      new DataView(gasData.buffer).setBigUint64(0, result.finalGas, true)
      ram.writeOctets(offset + 112n, gasData)

      // Write host call ID if present (8 bytes)
      const hostCallId = result.hostCallId || 0n
      const hostCallData = new Uint8Array(8)
      new DataView(hostCallData.buffer).setBigUint64(0, hostCallId, true)
      ram.writeOctets(offset + 120n, hostCallData)
    } catch {
      // Ignore write errors
    }
  }
}
