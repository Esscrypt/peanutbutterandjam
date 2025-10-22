import { decodeBlob } from '@pbnj/serialization'
import type {
  HostFunctionContext,
  HostFunctionResult,
  PVMGuest,
  PVMOptions,
  RefineContextPVM,
} from '@pbnj/types'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  RESULT_CODES,
} from '../../config'
import { PVM } from '../../pvm'
import { PVMRAM } from '../../ram'
import { BaseHostFunction } from './base'

/**
 * MACHINE host function (Ω_M)
 *
 * Creates a new PVM machine instance
 *
 * Gray Paper Specification:
 * - Function ID: 8 (machine)
 * - Gas Cost: 10
 * - Uses registers[7:3] to specify program offset, length, and initial PC
 * - Creates new PVM guest machine with specified program
 * - Returns machine ID in registers[7]
 * - Returns HUH if program is invalid
 */
export class MachineHostFunction extends BaseHostFunction {
  readonly functionId = GENERAL_FUNCTIONS.MACHINE
  readonly name = 'machine'
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

    const programOffset = context.registers[7]
    const programLength = context.registers[8]
    const initialPC = context.registers[9]

    // Read program from memory
    const [accessError, program] = context.ram.readOctets(
      programOffset,
      programLength,
    )
    if (accessError) {
      return {
        resultCode: RESULT_CODES.FAULT,
      }
    }

    // Validate program (deblob)
    const [error] = decodeBlob(program)
    if (error) {
      // Return HUH (2^64 - 9) if program is invalid
      context.registers[7] = ACCUMULATE_ERROR_CODES.HUH
      return {
        resultCode: null, // continue execution
      }
    }

    // Check if refine context is available
    if (!refineContext) {
      // If no refine context available, return HUH
      context.registers[7] = ACCUMULATE_ERROR_CODES.HUH
      return {
        resultCode: null, // continue execution
      }
    }

    const machines = refineContext.machines

    // Create new PVM machine
    const machineId = this.createPVMMachine(machines, program, initialPC)

    // Return machine ID
    context.registers[7] = machineId

    return {
      resultCode: null, // continue execution
    }
  }

  private createPVMMachine(
    machines: Map<bigint, PVMGuest>,
    program: Uint8Array,
    initialPC: bigint,
  ): bigint {
    // Generate new machine ID
    const machineId = BigInt(machines.size + 1)

    // Create new RAM instance for the machine
    const ram = new PVMRAM()

    // Create PVM instance with options
    const pvmOptions: PVMOptions = {
      code: program,
      ram: ram,
      pc: initialPC,
    }

    const pvm = new PVM(pvmOptions)

    // Create PVM guest wrapper
    const machine: PVMGuest = {
      code: program,
      ram: ram,
      pc: initialPC,
      pvm: pvm, // Store the actual PVM instance
    }

    // Add machine to context
    machines.set(machineId, machine)

    return machineId
  }
}
