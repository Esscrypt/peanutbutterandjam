import { type Safe, safeError, safeResult } from '@pbnj/core'
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
 * PEEK host function (Ω_P)
 *
 * Reads memory from a PVM machine instance
 *
 * Gray Paper Specification:
 * - Function ID: 9 (peek)
 * - Gas Cost: 10
 * - Uses registers[7:4] to specify machine ID, source offset, dest offset, length
 * - Reads memory from specified PVM machine
 * - Writes data to current PVM's memory
 * - Returns WHO if machine doesn't exist, OOB if out of bounds
 */
export class PeekHostFunction extends BaseHostFunction {
  readonly functionId = GENERAL_FUNCTIONS.PEEK
  readonly name = 'peek'
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

    // Check if source range is readable in machine's memory
    if (!this.isMachineMemoryReadable(machine, sourceOffset, length)) {
      // Return OOB (2^64 - 3) if out of bounds
      context.registers[7] = ACCUMULATE_ERROR_CODES.OOB
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Read data from machine's memory
    const [error, data] = this.readFromMachineMemory(
      machine,
      sourceOffset,
      length,
    )
    if (error) {
      context.registers[7] = ACCUMULATE_ERROR_CODES.OOB
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Write data to current PVM's memory
    const [error2] = context.ram.writeOctets(destOffset, data)
    if (error2) {
      return {
        resultCode: RESULT_CODES.FAULT,
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
    // Get PVM machine by ID from context
    return refineContext.machines.get(machineId) || null
  }

  private isMachineMemoryReadable(
    machine: PVMGuest,
    offset: bigint,
    length: bigint,
  ): boolean {
    return machine.ram.isReadable(offset, length)
  }

  private readFromMachineMemory(
    machine: PVMGuest,
    offset: bigint,
    length: bigint,
  ): Safe<Uint8Array> {
    // Read data from machine's memory
    // This is a placeholder implementation
    const [error, data] = machine.ram.readOctets(offset, length)
    if (error) {
      return safeError(error)
    }
    return safeResult(data)
  }
}
