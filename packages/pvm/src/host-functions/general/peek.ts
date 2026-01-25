import { logger } from '@pbnjam/core'
import type {
  HostFunctionContext,
  HostFunctionResult,
  PVMGuest,
  RefineInvocationContext,
  Safe,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
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
 * *** GRAY PAPER FORMULA ***
 * Gray Paper: pvm_invocations.tex, Ω_P (peek = 9)
 *
 * Parameters: [n, o, s, z] = registers[7:4]
 * - n: machine ID
 * - o: destination offset in current memory
 * - s: source offset in machine's memory
 * - z: length
 *
 * Return states (equation 571-577):
 * - panic when Nrange{o}{z} not ⊆ writable[memory]  (destination not writable)
 * - continue with WHO when n not ∈ keys(m)  (machine doesn't exist)
 * - continue with OOB when Nrange{s}{z} not ⊆ readable{m[n].ram}  (source not readable)
 * - continue with OK otherwise
 *
 * Memory update: mem'[o:z] = (m[n].ram)[s:z]
 */
export class PeekHostFunction extends BaseHostFunction {
  readonly functionId = GENERAL_FUNCTIONS.PEEK
  readonly name = 'peek'
  readonly gasCost = 10n

  execute(
    context: HostFunctionContext,
    refineContext: RefineInvocationContext | null,
  ): HostFunctionResult {
    if (!refineContext) {
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
      context.log('Peek host function: No refine context available')
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Gray Paper: [n, o, s, z] = registers[7:4]
    const machineId = context.registers[7]
    const destOffset = context.registers[8] // o: destination
    const sourceOffset = context.registers[9] // s: source
    const length = context.registers[10] // z: length

    // Gray Paper error check order:
    // 1. Check if machine exists → WHO
    const machine = this.getPVMMachine(refineContext, machineId)
    if (!machine) {
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
      context.log('Peek host function: Machine not found', {
        machineId: machineId.toString(),
      })
      return {
        resultCode: null, // continue (not HALT)
      }
    }

    const serviceId = context.serviceId ?? 0n

    // 2. Check if source range is readable → OOB
    if (!this.isMachineMemoryReadable(machine, sourceOffset, length)) {
      context.registers[7] = ACCUMULATE_ERROR_CODES.OOB
      logger.info(
        `[host-calls] [${serviceId}] PEEK(${machineId}, ${sourceOffset}, ${length}) <- OOB`,
      )
      return {
        resultCode: null, // continue (not HALT)
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
      logger.info(
        `[host-calls] [${serviceId}] PEEK(${machineId}, ${sourceOffset}, ${length}) <- OOB`,
      )
      return {
        resultCode: null, // continue
      }
    }

    // Gray Paper: mem'[o:z] = (m[n].ram)[s:z]
    const writeFaultAddress = context.ram.writeOctets(destOffset, data)
    if (writeFaultAddress) {
      logger.info(
        `[host-calls] [${serviceId}] PEEK(${machineId}, ${sourceOffset}, ${length}) <- PANIC`,
      )
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_write',
          address: writeFaultAddress,
          details: 'Memory not writable',
        },
      }
    }

    // Return OK (0) for success
    context.registers[7] = ACCUMULATE_ERROR_CODES.OK

    // Log in the requested format: [host-calls] [serviceId] PEEK(machineId, sourceOffset, length) <- OK: length
    logger.info(
      `[host-calls] [${serviceId}] PEEK(${machineId}, ${sourceOffset}, ${length}) <- OK: ${data.length}`,
    )

    return {
      resultCode: null, // continue execution
    }
  }

  private getPVMMachine(
    refineContext: RefineInvocationContext,
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
    return machine.pvm.state.ram.isReadableWithFault(offset, length)[0]
  }

  private readFromMachineMemory(
    machine: PVMGuest,
    offset: bigint,
    length: bigint,
  ): Safe<Uint8Array> {
    // Read data from machine's memory
    // This is a placeholder implementation
    const [data, _faultAddress] = machine.pvm.state.ram.readOctets(
      offset,
      length,
    )
    if (!data) {
      return safeError(new Error('Memory not readable'))
    }
    return safeResult(data)
  }
}
