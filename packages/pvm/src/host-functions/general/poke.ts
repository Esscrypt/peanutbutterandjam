import type { Safe } from '@pbnj/core'
import type {
  HostFunctionContext,
  HostFunctionResult,
  PVMGuest,
  RefineContextPVM,
} from '@pbnj/types'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  RESULT_CODES,
} from '../../config'
import { BaseHostFunction } from './base'

/**
 * POKE host function (Ω_O)
 *
 * Writes memory to a PVM machine instance
 *
 * Gray Paper Specification:
 * - Function ID: 10 (poke)
 * - Gas Cost: 10
 * - Uses registers[7:4] to specify machine ID, source offset, dest offset, length
 * - Writes data from current PVM to specified PVM machine
 * - Returns WHO if machine doesn't exist, OOB if out of bounds
 */
export class PokeHostFunction extends BaseHostFunction {
  readonly functionId = GENERAL_FUNCTIONS.POKE
  readonly name = 'poke'
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
    const sourceOffset = context.registers[8]
    const destOffset = context.registers[9]
    const length = context.registers[10]

    // Check if machine exists
    const machine = this.getPVMMachine(refineContext!, machineId)
    if (!machine) {
      // Return WHO (2^64 - 4) if machine doesn't exist
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Read data from current PVM's memory
    const [readError, data] = context.ram.readOctets(sourceOffset, length)
    if (readError) {
      context.registers[7] = ACCUMULATE_ERROR_CODES.OOB
      return {
        resultCode: RESULT_CODES.FAULT,
      }
    }

    // Check if dest range is writable in machine's memory
    if (!this.isMachineMemoryWritable(machine, destOffset, length)) {
      // Return OOB (2^64 - 3) if out of bounds
      context.registers[7] = ACCUMULATE_ERROR_CODES.OOB
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Write data to machine's memory
    const [error] = this.writeToMachineMemory(machine, destOffset, data)
    if (error) {
      context.registers[7] = ACCUMULATE_ERROR_CODES.OOB
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Return OK (0) for success
    context.registers[7] = ACCUMULATE_ERROR_CODES.OK

    return {
      resultCode: null, // continue execution
    }
  }

  private getPVMMachine(
    refineContext: RefineContextPVM,
    machineId: bigint,
  ): PVMGuest | null {
    return refineContext.machines.get(machineId) || null
  }

  private isMachineMemoryWritable(
    machine: PVMGuest,
    offset: bigint,
    length: bigint,
  ): boolean {
    // Check if memory range is writable in machine's memory
    return machine.ram.isWritable(offset, length)
  }

  private writeToMachineMemory(
    machine: PVMGuest,
    offset: bigint,
    data: Uint8Array,
  ): Safe<void> {
    // Write data to machine's memory
    return machine.ram.writeOctets(offset, data)
  }
}
