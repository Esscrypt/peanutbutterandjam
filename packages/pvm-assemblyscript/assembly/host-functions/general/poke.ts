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
  functionId: u64 = u64(10) // POKE function ID
  name: string = 'poke'
  gasCost: u64 = u64(10)

  execute(
    context: HostFunctionContext,
    params: HostFunctionParams | null,
  ): HostFunctionResult {
    if (!params) {
      return new HostFunctionResult(255) // continue execution
    }
    const pokeParams = params as PeekPokeParams
    if (!pokeParams.refineContext) {
      context.registers[7] = ACCUMULATE_ERROR_WHO
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // Gray Paper: [n, s, o, z] = registers[7:4]
    const machineId = u64(context.registers[7])
    const sourceOffset = u64(context.registers[8]) // s: source
    const destOffset = u64(context.registers[9]) // o: destination
    const length = u64(context.registers[10]) // z: length

    // Gray Paper error check order:
    // 1. Check if source range is readable in current memory → panic
    // Read data from current PVM's memory
    const readResult_data = context.ram.readOctets(
      u32(sourceOffset),
      u32(length),
    )
    const data = readResult_data.data
    const readFaultAddress = readResult_data.faultAddress
    if (data === null || readFaultAddress !== 0) {
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // 2. Check if machine exists → WHO
    const refineContext = pokeParams.refineContext!
    const machine = this.getPVMMachine(refineContext, machineId)
    if (!machine) {
      context.registers[7] = ACCUMULATE_ERROR_WHO
      return new HostFunctionResult(255) // continue
    }

    // 3. Check if destination range is writable → OOB
    // Gray Paper: (m'[n].ram)[o:z] = mem[s:z]
    const writeResult = machine.pvm.state.ram.writeOctets(u32(destOffset), data)
    if (writeResult.hasFault) {
      context.registers[7] = ACCUMULATE_ERROR_OOB
      return new HostFunctionResult(255) // continue (not HALT)
    }

    // Return OK (0) for success
    context.registers[7] = ACCUMULATE_ERROR_OK

    return new HostFunctionResult(255) // continue execution
  }

  getPVMMachine(
    refineContext: RefineInvocationContext,
    machineId: u64,
  ): PVMGuest | null {
    if (refineContext.machines.has(machineId)) {
      return refineContext.machines.get(machineId)!
    }
    return null
  }
}
