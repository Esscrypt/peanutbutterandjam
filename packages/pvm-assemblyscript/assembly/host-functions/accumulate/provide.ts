import { RESULT_CODE_PANIC } from '../../config'
import {
  ACCUMULATE_ERROR_HUH,
  ACCUMULATE_ERROR_WHO,
  AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
  HostFunctionResult,
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
  functionId: u64 = u64(22) // PROVIDE function ID
  name: string = 'provide'
  gasCost: u64 = u64(10)

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const registers = context.registers
    const ram = context.ram
    const implications = context.implications
    // Gray Paper line 204: Ω_F receives H_timeslot (block header's timeslot)
    // This is the current block's timeslot passed from the Accumulate invocation

    // Extract parameters from registers
    const targetServiceId = u64(registers[7])
    const preimageOffset = u64(registers[8])
    const preimageLength = u64(registers[9])

    // Determine target service ID
    // Gray Paper: s = imX.id when registers[7] = 2^64-1, otherwise registers[7]
    const MAX_U64: u64 = u64(0xffffffffffffffff) // 2^64 - 1
    const serviceId =
      targetServiceId === MAX_U64 ? implications.regular.id : targetServiceId

    // Read preimage data from memory
    const readResult_preimage = ram.readOctets(
      u32(preimageOffset),
      u32(preimageLength),
    )
    if (readResult_preimage.faultAddress !== 0) {
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    if (readResult_preimage.data === null) {
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    const preimageData = readResult_preimage.data!

    // Get the current implications context
    const imX = implications.regular

    // Check if service account exists
    const accountEntry = this.findAccountEntry(imX.state.accounts, serviceId)
    if (accountEntry === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHO)
      return new HostFunctionResult(255) // continue execution
    }
    const serviceAccount = accountEntry.account

    // Check if there's a matching request for this hash and size
    // Gray Paper: a.sa_requests[(blake(i), z)] ≠ []
    // preimageData is already the hash as Uint8Array
    const requestStatus = serviceAccount.requests.get(preimageData, preimageLength)
    if (requestStatus === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(255) // continue execution
    }

    // Check if the preimage hasn't already been provided
    // Gray Paper: (s, i) ∈ imX.provisions
    const existingProvision = this.findProvisionEntry(imX.provisions, serviceId)
    if (
      existingProvision !== null &&
      this.arraysEqual(existingProvision.blob, preimageData)
    ) {
      // Gray Paper line 942: HUH when a = error (preimage already provided)
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(255) // continue execution
    }

    // Add the preimage to provisions
    // Gray Paper: imX.provisions ∪ {(s, i)}
    this.setProvisionEntry(imX.provisions, serviceId, preimageData)

    // Set success result
    this.setAccumulateSuccess(registers)
    return new HostFunctionResult(255) // continue execution
  }

  arraysEqual(a: Uint8Array, b: Uint8Array): bool {
    if (a.length !== b.length) return false
    for (let i: i32 = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }
}
