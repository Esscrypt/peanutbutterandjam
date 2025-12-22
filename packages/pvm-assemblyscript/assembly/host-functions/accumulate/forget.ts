import { RESULT_CODE_PANIC } from '../../config'
import {
  ACCUMULATE_ERROR_HUH,
  AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
  HostFunctionResult,
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
  functionId: u64 = u64(24) // FORGET function ID (Gray Paper: 24)
  name: string = 'forget'
  gasCost: u64 = u64(10)

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const registers = context.registers
    const ram = context.ram
    const implications = context.implications
    const timeslot = context.timeslot
    const expungePeriod = context.expungePeriod
    // Gray Paper line 204: Ω_F receives H_timeslot (block header's timeslot)
    // This is the current block's timeslot passed from the Accumulate invocation

    // Extract parameters from registers
    const hashOffset = u64(registers[7])
    const preimageLength = u64(registers[8])

    // Read hash from memory (32 bytes)
    // Gray Paper line 924-927: h = memory[o:32] when Nrange(o,32) ⊆ readable(memory), error otherwise
    const readResult_hash = ram.readOctets(u32(hashOffset), u32(32))
    // Gray Paper line 941: panic when h = error, registers[7] unchanged
    if (readResult_hash.faultAddress !== 0) {
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    if (readResult_hash.data === null) {
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    const hashData = readResult_hash.data!

    // Get the current implications context
    const imX = implications.regular

    // Get current service account (imX.self)
    // Gray Paper line 928-939: a = imX.self except modifications based on request state
    const accountEntry = this.findAccountEntry(imX.state.accounts, imX.id)
    if (accountEntry === null) {
      // Gray Paper line 942: HUH when a = error
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(255) // continue execution
    }
    const serviceAccount = accountEntry.account

    // Get request (hashData is already Uint8Array)
    const requestStatus = serviceAccount.requests.get(hashData, preimageLength)
    if (requestStatus === null) {
      // Gray Paper line 942: HUH when a = error (request doesn't exist)
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(255) // continue execution
    }

    // Apply Gray Paper logic for different request states (line 935-938)
    const timeslots = requestStatus.timeslots
    if (timeslots.length === 0) {
      // Case 1 (line 935): [] (empty) - Remove request and preimage completely
      // For Array-based structure, we need to remove the entry
      // This is a simplified implementation - full version would remove from requests array
      // For now, we'll just clear the status
      requestStatus.timeslots = []
      // Remove preimage
      for (let i = 0; i < serviceAccount.preimages.entries.length; i++) {
        if (this.compareHashes(serviceAccount.preimages.entries[i].hash, hashData)) {
          serviceAccount.preimages.entries.splice(i, 1)
          break
        }
      }
      // Gray Paper: Update items and octets when removing a request
      // items -= 2 for each removed request (h, z)
      // octets -= (81 + z) for each removed request
      if (serviceAccount.items >= u32(2)) {
        serviceAccount.items -= u32(2)
      } else {
        serviceAccount.items = u32(0)
      }
      const octetsDelta = u32(81) + preimageLength
      if (serviceAccount.octets >= octetsDelta) {
        serviceAccount.octets -= octetsDelta
      } else {
        serviceAccount.octets = u64(0)
      }
    } else if (timeslots.length === 2) {
      // Case 2 (line 935): [x, y] where y < t - Cexpungeperiod - Remove request and preimage completely
      const y = u64(timeslots[1])
      if (y < timeslot - expungePeriod) {
        // Remove request and preimage completely
        requestStatus.timeslots = []
        // Remove preimage
        for (let i = 0; i < serviceAccount.preimages.entries.length; i++) {
          if (this.compareHashes(serviceAccount.preimages.entries[i].hash, hashData)) {
            serviceAccount.preimages.entries.splice(i, 1)
            break
          }
        }
        // Gray Paper: Update items and octets when removing a request
        if (serviceAccount.items >= u64(2)) {
          serviceAccount.items -= u32(2)
        } else {
          serviceAccount.items = u32(0)
        }
        const octetsDelta2 = u64(81) + preimageLength
        if (serviceAccount.octets >= octetsDelta2) {
          serviceAccount.octets -= octetsDelta2
        } else {
          serviceAccount.octets = u64(0)
        }
      } else {
        // Gray Paper line 938: otherwise → error (HUH)
        this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
        return new HostFunctionResult(255) // continue execution
      }
    } else if (timeslots.length === 1) {
      // Case 3 (line 936): [x] - Update to [x, t] (mark as unavailable)
      const x = timeslots[0]
      requestStatus.timeslots = [x, u32(timeslot)]
    } else if (timeslots.length === 3) {
      // Case 4 (line 937): [x, y, w] where y < t - Cexpungeperiod - Update to [w, t]
      const y = u64(timeslots[1])
      const w = timeslots[2]
      if (y < timeslot - expungePeriod) {
        // Update to [w, t] (mark as unavailable again)
        requestStatus.timeslots = [w, u32(timeslot)]
      } else {
        // Gray Paper line 938: otherwise → error (HUH)
        this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
        return new HostFunctionResult(255) // continue execution
      }
    } else {
      // Gray Paper line 938: otherwise → error (HUH)
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(255) // continue execution
    }

    // Set success result
    // Gray Paper line 943: OK when otherwise
    this.setAccumulateSuccess(registers)
    return new HostFunctionResult(255) // continue execution
  }

  private compareHashes(a: Uint8Array, b: Uint8Array): bool {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }
}
