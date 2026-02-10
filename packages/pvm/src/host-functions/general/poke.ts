import { logger } from '@pbnjam/core'
import type {
  HostFunctionContext,
  HostFunctionResult,
  PVMGuest,
  RefineInvocationContext,
} from '@pbnjam/types'
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
 * *** GRAY PAPER FORMULA ***
 * Gray Paper: pvm_invocations.tex, Ω_O (poke = 10)
 *
 * Parameters: [n, s, o, z] = registers[7:4]
 * - n: machine ID
 * - s: source offset in current memory
 * - o: destination offset in machine's memory
 * - z: length
 *
 * Return states (equation 586-593):
 * - panic when Nrange{s}{z} not ⊆ readable[memory]  (source not readable)
 * - continue with WHO when n not ∈ keys(m)  (machine doesn't exist)
 * - continue with OOB when Nrange{o}{z} not ⊆ writable{m[n].ram}  (destination not writable)
 * - continue with OK otherwise
 *
 * Memory update: (m'[n].ram)[o:z] = mem[s:z]
 */
export class PokeHostFunction extends BaseHostFunction {
  readonly functionId = GENERAL_FUNCTIONS.POKE
  readonly name = 'poke'
  execute(
    context: HostFunctionContext,
    refineContext: RefineInvocationContext | null,
  ): HostFunctionResult {
    if (!refineContext) {
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
      logger.error('Poke host function: No refine context available')
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Gray Paper: [n, s, o, z] = registers[7:4]
    const machineId = context.registers[7]
    const sourceOffset = context.registers[8] // s: source
    const destOffset = context.registers[9] // o: destination
    const length = context.registers[10] // z: length

    const serviceId = context.serviceId ?? 0n

    // Gray Paper error check order:
    // 1. Check if source range is readable in current memory → panic
    // Read data from current PVM's memory
    const [data, readFaultAddress] = context.ram.readOctets(
      sourceOffset,
      length,
    )
    if (!data) {
      logger.info(
        `[host-calls] [${serviceId}] POKE(${machineId}, ${destOffset}, ${length}) <- PANIC`,
      )
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_read',
          address: readFaultAddress ?? 0n,
          details: 'Memory not readable',
        },
      }
    }

    // 2. Check if machine exists → WHO
    const machine = this.getPVMMachine(refineContext, machineId)
    if (!machine) {
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
      logger.info(
        `[host-calls] [${serviceId}] POKE(${machineId}, ${destOffset}, ${length}) <- WHO`,
      )
      return {
        resultCode: null, // continue
      }
    }

    // 3. Check if destination range is writable → OOB
    // Gray Paper: (m'[n].ram)[o:z] = mem[s:z]
    const writeFaultAddress = machine.pvm.state.ram.writeOctets(
      destOffset,
      data,
    )
    if (writeFaultAddress) {
      context.registers[7] = ACCUMULATE_ERROR_CODES.OOB
      logger.info(
        `[host-calls] [${serviceId}] POKE(${machineId}, ${destOffset}, ${length}) <- OOB`,
      )
      return {
        resultCode: null, // continue (not HALT)
      }
    }

    // Return OK (0) for success
    context.registers[7] = ACCUMULATE_ERROR_CODES.OK

    // Log in the requested format: [host-calls] [serviceId] POKE(machineId, destOffset, length) <- OK: length
    logger.info(
      `[host-calls] [${serviceId}] POKE(${machineId}, ${destOffset}, ${length}) <- OK: ${data.length}`,
    )

    return {
      resultCode: null, // continue execution
    }
  }

  private getPVMMachine(
    refineContext: RefineInvocationContext,
    machineId: bigint,
  ): PVMGuest | null {
    return refineContext.machines.get(machineId) || null
  }
}
