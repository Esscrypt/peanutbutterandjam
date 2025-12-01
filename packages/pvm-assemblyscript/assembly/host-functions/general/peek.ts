import { RESULT_CODE_PANIC } from '../../config'
import {
  ACCUMULATE_ERROR_OK,
  ACCUMULATE_ERROR_OOB,
  ACCUMULATE_ERROR_WHO,
  HostFunctionResult,
} from '../accumulate/base'
import {
  HostFunctionContext,
  HostFunctionParams,
  PeekPokeParams,
  PVMGuest,
  RefineInvocationContext,
} from './base'
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
  functionId: u64 = u64(9) // PEEK function ID
  name: string = 'peek'
  gasCost: u64 = u64(10)

  execute(
    context: HostFunctionContext,
    params: HostFunctionParams | null,
  ): HostFunctionResult {
    if (!params) {
      return new HostFunctionResult(255) // continue execution
    }
    const peekParams = params as PeekPokeParams
    if (!peekParams.refineContext) {
      context.registers[7] = ACCUMULATE_ERROR_WHO
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // Gray Paper: [n, o, s, z] = registers[7:4]
    const machineId = u64(context.registers[7])
    const destOffset = u64(context.registers[8]) // o: destination
    const sourceOffset = u64(context.registers[9]) // s: source
    const length = u64(context.registers[10]) // z: length

    // Gray Paper error check order:
    // 1. Check if machine exists → WHO
    const refineContext = peekParams.refineContext!
    const machine = this.getPVMMachine(refineContext, machineId)
    if (!machine) {
      context.registers[7] = ACCUMULATE_ERROR_WHO
      return new HostFunctionResult(255) // continue (not HALT)
    }

    // 2. Check if source range is readable → OOB
    if (!this.isMachineMemoryReadable(machine, sourceOffset, length)) {
      context.registers[7] = ACCUMULATE_ERROR_OOB
      return new HostFunctionResult(255) // continue (not HALT)
    }

    // Read data from machine's memory
    const data = this.readFromMachineMemory(machine, sourceOffset, length)
    if (data === null) {
      context.registers[7] = ACCUMULATE_ERROR_OOB
      return new HostFunctionResult(255) // continue
    }

    // Gray Paper: mem'[o:z] = (m[n].ram)[s:z]
    const writeResult = context.ram.writeOctets(u32(destOffset), data)
    if (writeResult.hasFault) {
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // Return OK (0) for success
    context.registers[7] = ACCUMULATE_ERROR_OK
    return new HostFunctionResult(255) // continue execution
  }

  getPVMMachine(
    refineContext: RefineInvocationContext,
    machineId: u64,
  ): PVMGuest | null {
    // Get PVM machine by ID from context
    if (refineContext.machines.has(machineId)) {
      return refineContext.machines.get(machineId)!
    }
    return null
  }

  isMachineMemoryReadable(
    machine: PVMGuest,
    offset: u64,
    length: u64,
  ): bool {
    const result_readable = machine.pvm.state.ram.isReadableWithFault(
      u32(offset),
      u32(length),
    )
    const readable = result_readable.success
    const faultAddress = result_readable.faultAddress
    if (faultAddress !== 0) {
      return false
    }
    return readable
  }

  readFromMachineMemory(
    machine: PVMGuest,
    offset: u64,
    length: u64,
  ): Uint8Array | null {
    // Read data from machine's memory
    const readResult_data = machine.pvm.state.ram.readOctets(u32(offset), u32(length))
    const data = readResult_data.data
    const faultAddress = readResult_data.faultAddress
    if (data === null || faultAddress !== 0) {
      return null
    }
    return data
  }
}
