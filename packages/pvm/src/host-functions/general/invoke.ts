import type {
  HostFunctionContext,
  HostFunctionResult,
  PVMState,
  RAM,
  RefineInvocationContext,
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
    refineContext: RefineInvocationContext | null,
  ): HostFunctionResult {
    const machineId = context.registers[7]
    const memoryOffset = context.registers[8]

    // Check if refine context is available
    if (!refineContext) {
      // If no refine context available, return WHO
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO // WHO
      context.log('Invoke host function: No refine context available')
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
      context.log('Invoke host function: Machine not found', {
        machineId: machineId.toString(),
      })
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Read gas limit and register values from memory
    // Gray Paper: Read gas limit (8 bytes)
    const [gasLimitData, faultAddress] = context.ram.readOctets(
      memoryOffset,
      8n,
    )
    if (faultAddress) {
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_read',
          address: faultAddress,
          details: 'Memory not readable',
        },
      }
    }
    if (gasLimitData === null) {
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_read',
          address: faultAddress ?? 0n,
          details: 'Memory not readable',
        },
      }
    }
    const gasLimit = new DataView(gasLimitData.buffer).getBigUint64(0, true)

    // Gray Paper: Read register values (13 registers * 8 bytes each = 104 bytes)
    const [registersData, faultAddress2] = context.ram.readOctets(
      memoryOffset + 8n,
      104n,
    )
    if (faultAddress2 || !registersData) {
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_read',
          address: faultAddress2 ?? 0n,
          details: 'Memory not readable',
        },
      }
    }

    const registers: bigint[] = []
    for (let i = 0; i < 13; i++) {
      const registerData = registersData.slice(i * 8, (i + 1) * 8)
      registers.push(new DataView(registerData.buffer).getBigUint64(0, true))
    }

    // Execute PVM machine
    // const result = this.executePVMMachine(
    //   machine,
    //   params.gasLimit,
    //   params.registers,
    // )
    machine.pvm.invoke(gasLimit, registers, machine.code)

    // Write results back to memory
    this.writeInvokeResults(context.ram, memoryOffset, machine.pvm.state)

    // Gray Paper: Update machine state (RAM and PC)

    // Gray Paper: Return result code in registers[7]
    // If HOST or FAULT, also return ID/address in registers[8]
    context.registers[7] = BigInt(machine.pvm.state.resultCode)
    if (machine.pvm.state.resultCode === RESULT_CODES.HOST) {
      context.registers[8] = machine.pvm.state.hostCallId ?? 0n
    } else if (machine.pvm.state.resultCode === RESULT_CODES.FAULT) {
      context.registers[8] = machine.pvm.state.faultAddress ?? 0n
    }

    context.log('Invoke host function: PVM machine execution completed', {
      machineId: machineId.toString(),
      resultCode: machine.pvm.state.resultCode.toString(),
      remainingGas: machine.pvm.state.gasCounter.toString(),
      finalPC: machine.pvm.state.instructionPointer.toString(),
    })

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
