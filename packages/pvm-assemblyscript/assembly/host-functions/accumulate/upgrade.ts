import { RESULT_CODE_PANIC } from '../../config'
import { bytesToHex } from '../../types'
import {
  ACCUMULATE_ERROR_HUH,
  ACCUMULATE_ERROR_WHAT,
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
    const readResult_codeHashData = ram.readOctets(codeHashOffset, u64(32))
    if (faultAddress_readResult !== null || faultAddress !== null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    if (codeHashData === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // Get the current implications context
    const imX = implications.regular

    // Get current service account
    const serviceAccount = imX.state.accounts.get(imX.id)
    if (!serviceAccount) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(null) // continue execution
    }

    // Update service account with new code hash and gas limits
    // Gray Paper: imX.self.codehash = c, imX.self.minaccgas = g, imX.self.minmemogas = m
    serviceAccount.codehash = bytesToHex(codeHashData)
    serviceAccount.minaccgas = newMinimumAccumulationGas
    serviceAccount.minmemogas = newMinimumMemoryGas

    imX.state.accounts.set(imX.id, serviceAccount)

    // Set success result
    this.setAccumulateSuccess(registers)
    return new HostFunctionResult(null) // continue execution
  }
}
