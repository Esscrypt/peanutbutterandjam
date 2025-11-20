import { bytesToHex } from '@pbnj/core'
import type { HostFunctionResult } from '@pbnj/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import {
  type AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
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
  readonly functionId = ACCUMULATE_FUNCTIONS.UPGRADE
  readonly name = 'upgrade'

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const { registers, ram, implications } = context
    // Extract parameters from registers
    const [codeHashOffset, newMinimumAccumulationGas, newMinimumMemoryGas] =
      registers.slice(7, 10)

    // Log all input parameters
    context.log('UPGRADE host function invoked', {
      codeHashOffset: codeHashOffset.toString(),
      newMinimumAccumulationGas: newMinimumAccumulationGas.toString(),
      newMinimumMemoryGas: newMinimumMemoryGas.toString(),
      currentServiceId: implications[0].id.toString(),
    })

    // Read code hash from memory (32 bytes)
    const [codeHashData, faultAddress] = ram.readOctets(codeHashOffset, 32n)
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
    const [imX] = implications

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
    serviceAccount.minaccgas = newMinimumAccumulationGas
    serviceAccount.minmemogas = newMinimumMemoryGas

    imX.state.accounts.set(imX.id, serviceAccount)

    // Set success result
    this.setAccumulateSuccess(registers)
    return {
      resultCode: null, // continue execution
    }
  }
}
