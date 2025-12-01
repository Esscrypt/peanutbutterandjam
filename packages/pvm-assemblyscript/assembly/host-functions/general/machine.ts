import { RefineInvocationContext } from '../../pbnj-types-compat'
import { PVMGuest } from './base'
import { HostFunctionResult } from '../accumulate/base'
import { HostFunctionContext, HostFunctionParams, MachineParams } from './base'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  RESULT_CODES,
} from '../../config'
import { PVM } from '../../pvm'
import { BaseHostFunction } from './base'
import { HostFunctionRegistry } from './registry'
import { PVMRAM } from '../../ram'

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
  functionId: u64 = GENERAL_FUNCTIONS.MACHINE
  name: string = 'machine'
  gasCost: u64 = 10

  hostFunctionRegistry: HostFunctionRegistry
  constructor(hostFunctionRegistry: HostFunctionRegistry) {
    super()
    this.hostFunctionRegistry = hostFunctionRegistry
  }

  execute(
    context: HostFunctionContext,
    params: HostFunctionParams | null,
  ): HostFunctionResult {
    if (!params) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }
    const machineParams = params as MachineParams
    if (!machineParams.refineContext) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }
    // Validate execution
    if (context.gasCounter < u32(this.gasCost)) {
      return new HostFunctionResult(RESULT_CODES.OOG)
    }

    context.gasCounter -= u32(this.gasCost)

    const programOffset = u32(context.registers[7])
    const programLength = u32(context.registers[8])
    const initialPC = context.registers[9]

    // Read program from memory
    const readResult_programData = context.ram.readOctets(
      programOffset,
      programLength,
    )
    const programData = readResult_programData.data
    const programFaultAddress = readResult_programData.faultAddress
    if (programData === null || programFaultAddress !== 0) {
      return new HostFunctionResult(u8(RESULT_CODES.FAULT))
    }

    const refineContext = machineParams.refineContext!
    const machines = refineContext.machines

    // Create new PVM machine
    const machineId = this.createPVMMachine(machines, programData, initialPC)

    // Return machine ID
    context.registers[7] = machineId

    return new HostFunctionResult(255) // continue execution
  }

  createPVMMachine(
    machines: Map<u64, PVMGuest>,
    program: Uint8Array,
    initialPC: u64,
  ): u64 {
    // Generate new machine ID
    const machineId = u64(machines.size + 1)

    // Create PVM instance
    // Initialize with empty registers, new RAM, initial PC, and default gas
    const registerState = new StaticArray<u64>(13)
    for (let i: i32 = 0; i < 13; i++) {
      registerState[i] = 0
    }
    const ram = new PVMRAM()
    const pvm = new PVM(registerState, ram, u32(initialPC), 0, this.hostFunctionRegistry)

    // Add machine to context
    const guest = new PVMGuest(pvm)
    machines.set(machineId, guest)

    return machineId
  }
}
