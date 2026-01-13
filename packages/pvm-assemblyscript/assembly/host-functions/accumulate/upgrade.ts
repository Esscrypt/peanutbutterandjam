import { RESULT_CODE_PANIC } from '../../config'
import {
  ACCUMULATE_ERROR_HUH,
  AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
  HostFunctionResult,
} from './base'

/**
 * UPGRADE accumulation host function (Ω_U)
 *
 * Upgrades service code hash and gas limits
 *
 * Gray Paper Specification:
 * - Function ID: 19 (upgrade)
 * - Gas Cost: 10
 * - Parameters: registers[7-9] = o, g, m
 *   - o: code hash offset in memory (32 bytes)
 *   - g: new minimum accumulation gas
 *   - m: new minimum memory gas
 * - Returns: registers[7] = OK or error code
 *
 * Gray Paper Logic:
 * 1. Read code hash from memory (32 bytes)
 * 2. Update current service's code hash
 * 3. Update minimum accumulation gas
 * 4. Update minimum memory gas
 */
export class UpgradeHostFunction extends BaseAccumulateHostFunction {
  functionId: u64 = u64(19) // UPGRADE function ID
  name: string = 'upgrade'
  gasCost: u64 = u64(10)

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const registers = context.registers
    const ram = context.ram
    const implications = context.implications
    // Extract parameters from registers
    const codeHashOffset = u64(registers[7])
    const newMinimumAccumulationGas = u64(registers[8])
    const newMinimumMemoryGas = u64(registers[9])

    // Read code hash from memory (32 bytes)
    const readResult_codeHash = ram.readOctets(u32(codeHashOffset), u32(32))
    // Gray Paper line 808: (panic, registers_7, ...) when c = error
    // Gray Paper: registers'_7 = registers_7 (unchanged) when c = panic
    // DO NOT modify registers[7] - it must remain unchanged on panic
    if (readResult_codeHash.faultAddress !== 0 || readResult_codeHash.data === null) {
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    const codeHashData = readResult_codeHash.data!

    // Get the current implications context
    const imX = implications.regular

    // Get current service account
    const accountEntry = this.findAccountEntry(imX.state.accounts, imX.id)
    if (accountEntry === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(255) // continue execution
    }
    const serviceAccount = accountEntry.account

    // Update service account with new code hash and gas limits
    // Gray Paper: imX.self.codehash = c, imX.self.minaccgas = g, imX.self.minmemogas = m
    serviceAccount.codehash = codeHashData
    serviceAccount.minaccgas = newMinimumAccumulationGas
    serviceAccount.minmemogas = newMinimumMemoryGas

    this.setAccountEntry(imX.state.accounts, imX.id, serviceAccount)

    // Set success result
    this.setAccumulateSuccess(registers)
    return new HostFunctionResult(255) // continue execution
  }
}
