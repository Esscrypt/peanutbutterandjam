import { bytesToHex } from '@pbnj/core'
import type {
  HostFunctionResult,
  ImplicationsPair,
  RAM,
  RegisterState,
} from '@pbnj/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import { BaseAccumulateHostFunction } from './base'

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
  readonly functionId = ACCUMULATE_FUNCTIONS.UPGRADE
  readonly name = 'upgrade'
  readonly gasCost = 10n

  execute(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): HostFunctionResult {
    // Validate execution
    if (gasCounter < this.gasCost) {
      return {
        resultCode: RESULT_CODES.OOG,
      }
    }

    try {
      // Extract parameters from registers
      const [o, g, m] = registers.slice(7, 10)

      // Read code hash from memory (32 bytes)
      const [codeHashData, faultAddress] = ram.readOctets(o, 32n)
      if (faultAddress) {
        this.setAccumulateError(registers, 'WHAT')
        return {
          resultCode: RESULT_CODES.PANIC,
        }
      }
      if (!codeHashData) {
        this.setAccumulateError(registers, 'WHAT')
        return {
          resultCode: RESULT_CODES.PANIC,
        }
      }

      // Get the current implications context
      const [imX] = context

      // Get current service account
      const serviceAccount = imX.state.accounts.get(imX.id)
      if (!serviceAccount) {
        this.setAccumulateError(registers, 'HUH')
        return {
          resultCode: null, // continue execution
        }
      }

      // Update service account with new code hash and gas limits
      // Gray Paper: imX.self.codehash = c, imX.self.minaccgas = g, imX.self.minmemogas = m
      serviceAccount.codehash = bytesToHex(codeHashData)
      serviceAccount.minaccgas = g
      serviceAccount.minmemogas = m

      // Set success result
      this.setAccumulateSuccess(registers)
      return {
        resultCode: null, // continue execution
      }
    } catch {
      this.setAccumulateError(registers, 'WHAT')
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }
  }
}
