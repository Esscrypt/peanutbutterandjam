import { logger } from '@pbnjam/core'
import type {
  HostFunctionContext,
  HostFunctionResult,
  PVMGuest,
  PVMOptions,
  RefineInvocationContext,
} from '@pbnjam/types'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  RESULT_CODES,
} from '../../config'
import { PVM } from '../../pvm'
import { BaseHostFunction } from './base'
import type { HostFunctionRegistry } from './registry'

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

  private readonly hostFunctionRegistry: HostFunctionRegistry
  constructor(hostFunctionRegistry: HostFunctionRegistry) {
    super()
    this.hostFunctionRegistry = hostFunctionRegistry
  }

  execute(
    context: HostFunctionContext,
    refineContext: RefineInvocationContext | null,
  ): HostFunctionResult {
    const serviceId = context.serviceId ?? 0n
    const programOffset = context.registers[7]
    const programLength = context.registers[8]
    const initialPC = context.registers[9]

    // Validate execution
    if (context.gasCounter < this.gasCost) {
      logger.info(
        `[host-calls] [${serviceId}] MACHINE(${programLength}, ${initialPC}) <- OOG`,
      )
      return {
        resultCode: RESULT_CODES.OOG,
      }
    }

    context.gasCounter -= this.gasCost

    // Read program from memory
    const [programData, _faultAddress] = context.ram.readOctets(
      programOffset,
      programLength,
    )
    if (!programData) {
      logger.info(
        `[host-calls] [${serviceId}] MACHINE(${programLength}, ${initialPC}) <- FAULT`,
      )
      return {
        resultCode: RESULT_CODES.FAULT,
      }
    }

    // Check if refine context is available
    if (!refineContext) {
      // If no refine context available, return HUH
      context.registers[7] = ACCUMULATE_ERROR_CODES.HUH
      logger.info(
        `[host-calls] [${serviceId}] MACHINE(${programData.length}, ${initialPC}) <- HUH`,
      )
      return {
        resultCode: null, // continue execution
      }
    }

    const machines = refineContext.machines

    // Create new PVM machine
    const machineId = this.createPVMMachine(machines, programData, initialPC)

    // Return machine ID
    context.registers[7] = machineId

    // Log in the requested format: [host-calls] [serviceId] MACHINE(programLength, initialPC) <- OK: machineId
    logger.info(
      `[host-calls] [${serviceId}] MACHINE(${programData.length}, ${initialPC}) <- OK: ${machineId}`,
    )

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

    // Create PVM instance with options
    const pvmOptions: PVMOptions = {
      pc: initialPC,
    }

    const pvm = new PVM(this.hostFunctionRegistry, pvmOptions)

    // Add machine to context
    machines.set(machineId, {
      code: program,
      pvm: pvm,
    })

    return machineId
  }
}
