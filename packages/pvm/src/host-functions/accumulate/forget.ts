import { bytesToHex } from '@pbnjam/core'
import type { HostFunctionResult } from '@pbnjam/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import {
  type AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
} from './base'

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

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const { registers, ram, implications, timeslot } = context
    // Gray Paper line 204: Ω_F receives H_timeslot (block header's timeslot)
    // This is the current block's timeslot passed from the Accumulate invocation

    // Extract parameters from registers
    const [hashOffset, preimageLength] = registers.slice(7, 9)

    // Log all input parameters
    context.log('FORGET host function invoked', {
      hashOffset: hashOffset.toString(),
      preimageLength: preimageLength.toString(),
      timeslot: timeslot.toString(),
      currentServiceId: implications[0].id.toString(),
      expungePeriod: context.expungePeriod.toString(),
    })

    // Read hash from memory (32 bytes)
    // Gray Paper line 924-927: h = memory[o:32] when Nrange(o,32) ⊆ readable(memory), error otherwise
    const [hashData, faultAddress] = ram.readOctets(hashOffset, 32n)
    // Gray Paper line 941: panic when h = error, registers[7] unchanged
    if (faultAddress || !hashData) {
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Get the current implications context
    const [imX] = implications

    // Get current service account (imX.self)
    // Gray Paper line 928-939: a = imX.self except modifications based on request state
    const serviceAccount = imX.state.accounts.get(imX.id)
    if (!serviceAccount) {
      // Gray Paper line 942: HUH when a = error
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }

    // Convert hash to hex and get request
    const hashHex = bytesToHex(hashData)
    const requestMap = serviceAccount.requests.get(hashHex)
    if (!requestMap) {
      // Gray Paper line 942: HUH when a = error (request doesn't exist)
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }

    const request = requestMap.get(preimageLength)
    if (!request) {
      // Gray Paper line 942: HUH when a = error (request doesn't exist for this size)
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }

    // For test vectors, Cexpungeperiod = 32 (as per README)
    // For production, Cexpungeperiod = 19200 (Gray Paper constant)
    const expungePeriod = context.expungePeriod

    // Apply Gray Paper logic for different request states (line 935-938)
    if (request.length === 0) {
      // Case 1 (line 935): [] (empty) - Remove request and preimage completely
      // keys(a.sa_requests) = keys(imX.self.sa_requests) \ {(h, z)}
      // keys(a.sa_preimages) = keys(imX.self.sa_preimages) \ {h}
      requestMap.delete(preimageLength)
      if (requestMap.size === 0) {
        serviceAccount.requests.delete(hashHex)
      }
      serviceAccount.preimages.delete(hashHex)
    } else if (request.length === 2) {
      // Case 2 (line 935): [x, y] where y < t - Cexpungeperiod - Remove request and preimage completely
      const [, y] = request
      if (y < timeslot - expungePeriod) {
        // Remove request and preimage completely
        requestMap.delete(preimageLength)
        if (requestMap.size === 0) {
          serviceAccount.requests.delete(hashHex)
        }
        serviceAccount.preimages.delete(hashHex)
      } else {
        // Gray Paper line 938: otherwise → error (HUH)
        this.setAccumulateError(registers, 'HUH')
        return {
          resultCode: null, // continue execution
        }
      }
    } else if (request.length === 1) {
      // Case 3 (line 936): [x] - Update to [x, t] (mark as unavailable)
      const [x] = request
      requestMap.set(preimageLength, [x, timeslot])
    } else if (request.length === 3) {
      // Case 4 (line 937): [x, y, w] where y < t - Cexpungeperiod - Update to [w, t]
      const [, y, w] = request
      if (y < timeslot - expungePeriod) {
        // Update to [w, t] (mark as unavailable again)
        requestMap.set(preimageLength, [w, timeslot])
      } else {
        // Gray Paper line 938: otherwise → error (HUH)
        this.setAccumulateError(registers, 'HUH')
        return {
          resultCode: null, // continue execution
        }
      }
    } else {
      // Gray Paper line 938: otherwise → error (HUH)
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }

    // Set success result
    // Gray Paper line 943: OK when otherwise
    this.setAccumulateSuccess(registers)
    return {
      resultCode: null, // continue execution
    }
  }
}
