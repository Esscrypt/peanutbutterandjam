import { bytesToHex } from '@pbnj/core'
import type { HostFunctionResult } from '@pbnj/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import {
  type AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
} from './base'

/**
 * PROVIDE accumulation host function (Ω_♈)
 *
 * Provides preimage data
 *
 * Gray Paper Specification:
 * - Function ID: 26 (provide)
 * - Gas Cost: 10
 * - Parameters: registers[7-9] = s, o, z
 *   - s: service account ID (or 2^64-1 for current service)
 *   - o: preimage data offset in memory
 *   - z: preimage data length
 * - Returns: registers[7] = OK or error code
 *
 * Gray Paper Logic:
 * 1. Determine target service ID (current service if s = 2^64-1)
 * 2. Read preimage data from memory
 * 3. Check if service account exists
 * 4. Check if there's a matching request for this hash and size
 * 5. Check if the preimage hasn't already been provided
 * 6. Add the preimage to provisions
 */
export class ProvideHostFunction extends BaseAccumulateHostFunction {
  readonly functionId = ACCUMULATE_FUNCTIONS.PROVIDE
  readonly name = 'provide'
  readonly gasCost = 10n

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const { registers, ram, implications } = context
    // Gray Paper line 204: Ω_F receives H_timeslot (block header's timeslot)
    // This is the current block's timeslot passed from the Accumulate invocation

    // Extract parameters from registers
    const [targetServiceId, preimageOffset, preimageLength] = registers.slice(
      7,
      10,
    )

    // Determine target service ID
    // Gray Paper: s = imX.id when registers[7] = 2^64-1, otherwise registers[7]
    const serviceId =
      targetServiceId === 2n ** 64n - 1n ? implications[0].id : targetServiceId

    // Log all input parameters
    context.log('PROVIDE host function invoked', {
      targetServiceId: targetServiceId.toString(),
      resolvedServiceId: serviceId.toString(),
      preimageOffset: preimageOffset.toString(),
      preimageLength: preimageLength.toString(),
      currentServiceId: implications[0].id.toString(),
    })

    // Read preimage data from memory
    const [preimageData, faultAddress] = ram.readOctets(
      preimageOffset,
      preimageLength,
    )
    if (faultAddress || !preimageData) {
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Get the current implications context
    const [imX] = implications

    // Check if service account exists
    const serviceAccount = imX.state.accounts.get(serviceId)
    if (!serviceAccount) {
      this.setAccumulateError(registers, 'WHO')
      return {
        resultCode: null, // continue execution
      }
    }

    // Compute hash of the preimage data
    const preimageHash = bytesToHex(preimageData)

    // Check if there's a matching request for this hash and size
    // Gray Paper: a.sa_requests[(blake(i), z)] ≠ []
    const requestMap = serviceAccount.requests.get(preimageHash)
    if (!requestMap) {
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

    // Check if the preimage hasn't already been provided
    // Gray Paper: (s, i) ∈ imX.provisions
    // Note: We use a simple approach here - in practice, provisions would be a set of tuples
    // For now, we'll use the service ID as the key and check if the data matches
    const existingProvision = imX.provisions.get(serviceId)
    if (
      existingProvision &&
      this.arraysEqual(existingProvision, preimageData)
    ) {
      // Gray Paper line 942: HUH when a = error (preimage already provided)
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }

    // Add the preimage to provisions
    // Gray Paper: imX.provisions ∪ {(s, i)}
    imX.provisions.set(serviceId, preimageData)

    // Set success result
    this.setAccumulateSuccess(registers)
    return {
      resultCode: null, // continue execution
    }
  }

  private arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }
}
