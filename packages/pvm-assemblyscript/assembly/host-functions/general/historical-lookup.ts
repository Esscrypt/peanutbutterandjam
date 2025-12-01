import { CompleteServiceAccount, PreimageRequestStatus } from '../../codec'
import { HostFunctionResult } from '../accumulate/base'
import { HostFunctionContext, HostFunctionParams, HistoricalLookupParams } from './base'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  RESULT_CODES,
} from '../../config'
import { BaseHostFunction } from './base'

/**
 * HISTORICAL_LOOKUP host function (Ω_H)
 *
 * Performs historical lookup of preimages using histlookup function
 *
 * Gray Paper Specification:
 * - Function ID: 6 (historical_lookup)
 * - Gas Cost: 10
 * - Signature: Ω_H(gascounter, registers, memory, (m, e), s, d, t)
 *   - (m, e) = refine context (machines, export segments)
 *   - s = current service ID
 *   - d = accounts dictionary
 *   - t = timeslot for historical lookup
 * - Uses registers[7] to specify service account (NONE for self)
 * - Uses registers[8:2] to specify hash and output offset in memory
 * - Uses registers[10:2] to specify from offset and length
 * - Uses histlookup(serviceAccount, timeslot, hash) to get historical data
 * - Writes result to memory at specified offset
 * - Returns NONE if not found, length if found
 *
 * Gray Paper Logic:
 * a = service account (self if registers[7] = NONE, otherwise accounts[registers[7]])
 * h = memory[registers[8]:32] (hash)
 * o = registers[9] (output offset)
 * f = registers[10] (from offset)
 * l = registers[11] (length)
 * v = histlookup(a, t, h) if a exists, NONE otherwise
 * if v != NONE: write v[f:f+l] to memory[o:o+l], return len(v)
 * else: return NONE
 */

export class HistoricalLookupHostFunction extends BaseHostFunction {
  functionId: u64 = GENERAL_FUNCTIONS.HISTORICAL_LOOKUP
  name: string = 'historical_lookup'

  execute(
    context: HostFunctionContext,
    params: HostFunctionParams | null,
  ): HostFunctionResult {
    if (!params) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }
    const lookupParams = params as HistoricalLookupParams
    // Gray Paper: Extract parameters from registers
    // registers[7] = service ID selector (NONE for self, or specific service ID)
    // registers[8:2] = (hash offset, output offset)
    // registers[10:2] = (from offset, length)
    const requestedServiceId = context.registers[7]
    const hashOffset = context.registers[8]
    const outputOffset = context.registers[9]
    const fromOffset = context.registers[10]
    const length = context.registers[11]

    // Gray Paper equation 508-511: Determine service account
    // a = {
    //   d[s] if registers[7] = NONE (2^64 - 1) AND s in keys(d)
    //   d[registers[7]] if registers[7] in keys(d)
    //   none otherwise
    // }
    let serviceAccount: CompleteServiceAccount | null = null
    if (
      requestedServiceId === ACCUMULATE_ERROR_CODES.NONE &&
      lookupParams.accounts.has(lookupParams.serviceId)
    ) {
      // registers[7] = NONE, use self (s)
      serviceAccount = lookupParams.accounts.get(lookupParams.serviceId) || null
    } else if (lookupParams.accounts.has(requestedServiceId)) {
      // registers[7] specifies a service ID in accounts
      serviceAccount = lookupParams.accounts.get(requestedServiceId) || null
    }

    if (!serviceAccount) {
      // Gray Paper: Return NONE if service account not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return new HostFunctionResult(255) // continue execution
    }

    // Gray Paper: Read hash from memory (32 bytes at hashOffset)
    const readResult_hashData = context.ram.readOctets(u32(hashOffset), 32)
    const hashData = readResult_hashData.data
    const readFaultAddress = readResult_hashData.faultAddress
    if (hashData === null || readFaultAddress !== 0) {
      // Gray Paper: Return panic if memory range not readable
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }

    // Gray Paper equation 517: histlookup(a, t, memory[h:32])
    // Perform historical lookup using histlookup function
    // We use the service account we determined from the lookup logic
    // serviceAccount is guaranteed to be non-null here due to check above
    const preimage = this.histLookupServiceAccount(
      serviceAccount,
      hashData,
      lookupParams.lookupTimeslot,
    )
    if (!preimage) {
      // Return NONE (2^64 - 1) for not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return new HostFunctionResult(255) // continue execution
    }

    // Calculate slice parameters
    const f = i32(fromOffset)
    const l = i32(length)
    const preimageLength = preimage.length

    // Calculate actual slice length
    const actualLength = min(l, preimageLength - f)

    if (actualLength <= 0) {
      // Return NONE if no data to copy
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return new HostFunctionResult(255) // continue execution
    }

    // Extract data slice
    const dataToWrite = preimage.slice(f, f + actualLength)

    // Write preimage slice to memory
    const writeResult = context.ram.writeOctets(u32(outputOffset), dataToWrite)
    if (writeResult.hasFault) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }

    // Return length of preimage
    context.registers[7] = u64(preimageLength)

    return new HostFunctionResult(255) // continue execution
  }

  /**
   * Gray Paper histlookup function
   *
   * Gray Paper equation 115-127:
   * histlookup(a, t, h) ≡ a.sa_preimages[h] when h ∈ keys(a.sa_preimages) ∧ I(a.sa_requests[h, len(a.sa_preimages[h])], t)
   *
   * @param serviceAccount - Service account containing preimages and requests
   * @param hashBytes - Hash to lookup (as Uint8Array)
   * @param timeslot - Timeslot for historical lookup
   * @returns Preimage blob or null if not found/not available
   */
  private histLookupServiceAccount(
    serviceAccount: CompleteServiceAccount,
    hashBytes: Uint8Array,
    timeslot: u64,
  ): Uint8Array | null {
    // Get the preimage for this hash
    const preimage = serviceAccount.preimages.get(hashBytes)
    if (!preimage) {
      return null
    }

    const length = u64(preimage.length)

    // Get the request status for this hash and length
    const requestStatus = serviceAccount.requests.get(hashBytes, length)
    if (!requestStatus) {
      return null
    }

    // Apply the Gray Paper histlookup logic using I(l, t) function
    const isValid = this.checkRequestValidity(requestStatus, timeslot)

    if (!isValid) {
      return null
    }

    return preimage
  }

  /**
   * Check if a request is available at a given time using Gray Paper function I(l, t)
   *
   * Gray Paper equation 120-125:
   * I(l, t) = false when [] = l
   * I(l, t) = x ≤ t when [x] = l
   * I(l, t) = x ≤ t < y when [x, y] = l
   * I(l, t) = x ≤ t < y ∨ z ≤ t when [x, y, z] = l
   *
   * @param requestStatus - Request status sequence (up to 3 timeslots)
   * @param timeslot - Timeslot to check availability
   * @returns True if preimage is available at the given timeslot
   */
  private checkRequestValidity(
    requestStatus: PreimageRequestStatus,
    timeslot: u64,
  ): bool {
    const timeslots = requestStatus.timeslots
    switch (timeslots.length) {
      case 0:
        // Empty request - not available
        return false

      case 1:
        // [x] - available from x onwards
        return u64(timeslots[0]) <= timeslot

      case 2:
        // [x, y] - available from x to y (exclusive)
        return u64(timeslots[0]) <= timeslot && timeslot < u64(timeslots[1])

      case 3:
        // [x, y, z] - available from x to y OR from z onwards
        return (
          (u64(timeslots[0]) <= timeslot && timeslot < u64(timeslots[1])) ||
          u64(timeslots[2]) <= timeslot
        )

      default:
        // Invalid request format - not available
        return false
    }
  }
}
