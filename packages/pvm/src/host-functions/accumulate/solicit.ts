import { bytesToHex } from '@pbnjam/core'
import type { HostFunctionResult } from '@pbnjam/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import {
  type AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
} from './base'

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

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const { registers, ram, implications, timeslot } = context
    try {
      // Extract parameters from registers
      const [hashOffset, preimageLength] = registers.slice(7, 9)

      // Log all input parameters
      context.log('SOLICIT host function invoked', {
        hashOffset: hashOffset.toString(),
        preimageLength: preimageLength.toString(),
        timeslot: timeslot.toString(),
        currentServiceId: implications[0].id.toString(),
        expungePeriod: context.expungePeriod.toString(),
      })

      // Read hash from memory (32 bytes)
      const [hashData, faultAddress] = ram.readOctets(hashOffset, 32n)
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
      const [imX] = implications

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
      const existingRequest = requestMap?.get(preimageLength)

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
      // Track if this is a new request (affects items/octets)
      const isNewRequest = !existingRequest
      
      if (requestMap) {
        // Update existing request map
        requestMap.set(preimageLength, newRequest)
      } else {
        // Create new request map for this hash
        serviceAccount.requests.set(
          hashHex,
          new Map([[preimageLength, newRequest]]),
        )
      }

      // Gray Paper: Update items and octets when creating a new request
      // items += 2 for each new request (h, z)
      // octets += (81 + z) for each new request
      if (isNewRequest) {
        serviceAccount.items += 2n
        serviceAccount.octets += 81n + preimageLength
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
