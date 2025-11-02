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
 * FORGET accumulation host function (Ω_F)
 *
 * Forgets preimage request
 *
 * Gray Paper Specification:
 * - Function ID: 24 (forget)
 * - Gas Cost: 10
 * - Parameters: registers[7-8] = o, z
 *   - o: hash offset in memory (32 bytes)
 *   - z: size of the preimage
 * - Returns: registers[7] = OK or error code
 *
 * Gray Paper Logic:
 * 1. Read hash from memory at offset o (32 bytes)
 * 2. Get current service account from imX.self
 * 3. Check request status in sa_requests[h, z]:
 *    - [] (empty): Remove request and preimage completely
 *    - [x, y] where y < t - Cexpungeperiod: Remove request and preimage completely
 *    - [x]: Update to [x, t] (mark as unavailable)
 *    - [x, y, w] where y < t - Cexpungeperiod: Update to [w, t] (mark as unavailable again)
 *    - Otherwise: Error HUH (cannot forget)
 */
export class ForgetHostFunction extends BaseAccumulateHostFunction {
  readonly functionId = ACCUMULATE_FUNCTIONS.FORGET
  readonly name = 'forget'
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

      // Convert hash to hex and get request
      const hashHex = bytesToHex(hashData)
      const requestMap = serviceAccount.requests.get(hashHex)
      if (!requestMap) {
        this.setAccumulateError(registers, 'HUH')
        return {
          resultCode: null, // continue execution
        }
      }

      const request = requestMap.get(z)
      if (!request) {
        this.setAccumulateError(registers, 'HUH')
        return {
          resultCode: null, // continue execution
        }
      }

      const C_EXPUNGE_PERIOD = 19200n // Gray Paper constant

      // Apply Gray Paper logic for different request states
      if (request.length === 0) {
        // Case 1: [] (empty) - Remove request and preimage completely
        requestMap.delete(z)
        if (requestMap.size === 0) {
          serviceAccount.requests.delete(hashHex)
        }
        serviceAccount.preimages.delete(hashHex)
      } else if (request.length === 2) {
        // Case 2: [x, y] - Check if y < t - Cexpungeperiod
        const [, y] = request
        if (y < timeslot - C_EXPUNGE_PERIOD) {
          // Remove request and preimage completely
          requestMap.delete(z)
          if (requestMap.size === 0) {
            serviceAccount.requests.delete(hashHex)
          }
          serviceAccount.preimages.delete(hashHex)
        } else {
          // Cannot forget - not expired
          this.setAccumulateError(registers, 'HUH')
          return {
            resultCode: null, // continue execution
          }
        }
      } else if (request.length === 1) {
        // Case 3: [x] - Update to [x, t] (mark as unavailable)
        const [x] = request
        requestMap.set(z, [x, timeslot])
      } else if (request.length === 3) {
        // Case 4: [x, y, w] - Check if y < t - Cexpungeperiod
        const [, y, w] = request
        if (y < timeslot - C_EXPUNGE_PERIOD) {
          // Update to [w, t] (mark as unavailable again)
          requestMap.set(z, [w, timeslot])
        } else {
          // Cannot forget - not expired
          this.setAccumulateError(registers, 'HUH')
          return {
            resultCode: null, // continue execution
          }
        }
      } else {
        // Invalid request state
        this.setAccumulateError(registers, 'HUH')
        return {
          resultCode: null, // continue execution
        }
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
