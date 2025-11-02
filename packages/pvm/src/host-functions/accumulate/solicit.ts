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
 * SOLICIT accumulation host function (Ω_S)
 *
 * Solicits preimage request
 *
 * Gray Paper Specification:
 * - Function ID: 23 (solicit)
 * - Gas Cost: 10
 * - Parameters: registers[7-8] = o, z
 *   - o: hash offset in memory (32 bytes)
 *   - z: size of the preimage
 * - Returns: registers[7] = OK or error code
 *
 * Gray Paper Logic:
 * 1. Read hash from memory (32 bytes)
 * 2. Check if request already exists:
 *    - If doesn't exist: create empty request []
 *    - If exists as [x, y]: append current timeslot to make [x, y, t]
 *    - Otherwise: error HUH
 * 3. Check if service has sufficient balance
 * 4. Update service account with new request
 */
export class SolicitHostFunction extends BaseAccumulateHostFunction {
  readonly functionId = ACCUMULATE_FUNCTIONS.SOLICIT
  readonly name = 'solicit'
  readonly gasCost = 10n

  execute(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
    timeslot?: bigint,
  ): HostFunctionResult {
    // Validate execution
    if (gasCounter < this.gasCost) {
      return {
        resultCode: RESULT_CODES.OOG,
      }
    }

    if (!timeslot) {
      this.setAccumulateError(registers, 'WHAT')
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    try {
      // Extract parameters from registers
      const [o, z] = registers.slice(7, 9)

      // Read hash from memory (32 bytes)
      const [hashData, faultAddress] = ram.readOctets(o, 32n)
      if (faultAddress) {
        this.setAccumulateError(registers, 'WHAT')
        return {
          resultCode: RESULT_CODES.PANIC,
        }
      }
      if (!hashData) {
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

      // Convert hash to hex and look up existing request
      const hashHex = bytesToHex(hashData)
      const requestMap = serviceAccount.requests.get(hashHex)
      const existingRequest = requestMap?.get(z)

      // Determine new request state based on Gray Paper logic
      let newRequest: bigint[]

      if (!existingRequest) {
        // Request doesn't exist - create empty request []
        newRequest = []
      } else if (existingRequest.length === 2) {
        // Request exists as [x, y] - append current timeslot to make [x, y, t]
        const [x, y] = existingRequest
        newRequest = [x, y, timeslot]
      } else {
        // Invalid request state - cannot solicit
        this.setAccumulateError(registers, 'HUH')
        return {
          resultCode: null, // continue execution
        }
      }

      // Check if service has sufficient balance
      // Gray Paper: a.sa_balance < a.sa_minbalance
      const C_MIN_BALANCE = 1000000n // Gray Paper constant for minimum balance
      if (serviceAccount.balance < C_MIN_BALANCE) {
        this.setAccumulateError(registers, 'FULL')
        return {
          resultCode: null, // continue execution
        }
      }

      // Update the service account with the new request
      if (requestMap) {
        // Update existing request map
        requestMap.set(z, newRequest)
      } else {
        // Create new request map for this hash
        serviceAccount.requests.set(hashHex, new Map([[z, newRequest]]))
      }

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
