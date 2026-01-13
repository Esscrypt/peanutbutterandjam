import {
  deleteServicePreimageValue,
  deleteServiceRequestValue,
  getServiceRequestValue,
  setServiceRequestValue,
} from '@pbnjam/codec'
import { bytesToHex, logger } from '@pbnjam/core'
import type { HostFunctionResult } from '@pbnjam/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import {
  type AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
} from './base'

//TODO: make a unit test for different request value lengths
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

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const { registers, ram, implications, timeslot } = context
    // Gray Paper line 204: Ω_F receives H_timeslot (block header's timeslot)
    // This is the current block's timeslot passed from the Accumulate invocation

    // Extract parameters from registers
    const [hashOffset, preimageLength] = registers.slice(7, 9)

    const serviceId = implications[0].id

    // Read hash from memory (32 bytes)
    // Gray Paper line 924-927: h = memory[o:32] when Nrange(o,32) ⊆ readable(memory), error otherwise
    const [hashData, faultAddress] = ram.readOctets(hashOffset, 32n)
    // Gray Paper line 941: panic when h = error, registers[7] unchanged
    if (faultAddress || !hashData) {
      logger.error('Forget host function: Memory read failed', {
        hashOffset: hashOffset.toString(),
        preimageLength: preimageLength.toString(),
        faultAddress: faultAddress?.toString() ?? 'null',
      })
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
      logger.error('Forget host function: Service account not found', {
        serviceId: serviceId.toString(),
        preimageLength: preimageLength.toString(),
      })
      // Gray Paper line 942: HUH when a = error
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }

    // Convert hash to hex and get request
    const hashHex = bytesToHex(hashData)
    const requestValue = getServiceRequestValue(
      serviceAccount,
      serviceId,
      hashHex,
      preimageLength,
    )
    if (!requestValue) {
      logger.error('Forget host function: Request does not exist', {
        serviceId: serviceId.toString(),
        hashHex: `${hashHex.substring(0, 40)}...`,
        preimageLength: preimageLength.toString(),
      })
      // Gray Paper line 942: HUH when a = error (request doesn't exist)
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }

    // For test vectors, Cexpungeperiod = 32 (as per README)
    // For production, Cexpungeperiod = 19200 (Gray Paper constant)
    const expungePeriod = context.expungePeriod

    // Apply Gray Paper logic for different request states (line 935-938)
    if (requestValue.length === 0) {
      // Case 1 (line 935): [] (empty) - Remove request and preimage completely
      // keys(a.sa_requests) = keys(imX.self.sa_requests) \ {(h, z)}
      // keys(a.sa_preimages) = keys(imX.self.sa_preimages) \ {h}

      deleteServiceRequestValue(
        serviceAccount,
        serviceId,
        hashHex,
        preimageLength,
      )
      deleteServicePreimageValue(serviceAccount, serviceId, hashHex)
      // Gray Paper: Update items and octets when removing a request
      // items -= 2 for each removed request (h, z)
      // octets -= (81 + z) for each removed request
      serviceAccount.items =
        serviceAccount.items >= 2n ? serviceAccount.items - 2n : 0n
      serviceAccount.octets =
        serviceAccount.octets >= 81n + preimageLength
          ? serviceAccount.octets - (81n + preimageLength)
          : 0n
    } else if (requestValue.length === 2) {
      // Case 2 (line 935): [x, y] where y < t - Cexpungeperiod - Remove request and preimage completely
      const [, y] = requestValue
      if (y < timeslot - expungePeriod) {
        // Remove request and preimage completely

        deleteServiceRequestValue(
          serviceAccount,
          serviceId,
          hashHex,
          preimageLength,
        )
        deleteServicePreimageValue(serviceAccount, serviceId, hashHex)
        // Gray Paper: Update items and octets when removing a request
        serviceAccount.items =
          serviceAccount.items >= 2n ? serviceAccount.items - 2n : 0n
        serviceAccount.octets =
          serviceAccount.octets >= 81n + preimageLength
            ? serviceAccount.octets - (81n + preimageLength)
            : 0n
      } else {
        // Gray Paper line 938: otherwise → error (HUH)
        this.setAccumulateError(registers, 'HUH')
        return {
          resultCode: null, // continue execution
        }
      }
    } else if (requestValue.length === 1) {
      // Case 3 (line 936): [x] - Update to [x, t] (mark as unavailable)
      const [x] = requestValue
      setServiceRequestValue(
        serviceAccount,
        serviceId,
        hashHex,
        preimageLength,
        [x, timeslot],
      )
    } else if (requestValue.length === 3) {
      // Case 4 (line 937): [x, y, w] where y < t - Cexpungeperiod - Update to [w, t]
      const [, y, w] = requestValue
      if (y < timeslot - expungePeriod) {
        // Update to [w, t] (mark as unavailable again)
        setServiceRequestValue(
          serviceAccount,
          serviceId,
          hashHex,
          preimageLength,
          [w, timeslot],
        )
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
