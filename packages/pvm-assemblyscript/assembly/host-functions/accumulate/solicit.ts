import { RESULT_CODE_PANIC } from '../../config'
import { PreimageRequestStatus } from '../../codec'
import {
  ACCUMULATE_ERROR_FULL,
  ACCUMULATE_ERROR_HUH,
  ACCUMULATE_ERROR_WHAT,
  AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
  HostFunctionResult,
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
  functionId: u64 = u64(24) // SOLICIT function ID
  name: string = 'solicit'
  gasCost: u64 = u64(10)

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const registers = context.registers
    const ram = context.ram
    const implications = context.implications
    const timeslot = context.timeslot
    // Extract parameters from registers
    const hashOffset = u64(registers[7])
    const preimageLength = u64(registers[8])

    // Read hash from memory (32 bytes)
    const readResult_hash = ram.readOctets(u32(hashOffset), u32(32))
    if (readResult_hash.faultAddress !== 0) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    if (readResult_hash.data === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    const hashData = readResult_hash.data!

    // Get the current implications context
    const imX = implications.regular

    // Get current service account
    const accountEntry = this.findAccountEntry(imX.state.accounts, imX.id)
    if (accountEntry === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(255) // continue execution
    }
    const serviceAccount = accountEntry.account

    // Look up existing request (hashData is already Uint8Array)
    const existingRequestStatus = serviceAccount.requests.get(hashData, preimageLength)

    // Determine new request state based on Gray Paper logic
    let newRequestStatus: PreimageRequestStatus

    if (existingRequestStatus === null) {
      // Request doesn't exist - create empty request []
      newRequestStatus = new PreimageRequestStatus()
    } else if (existingRequestStatus.timeslots.length === 2) {
      // Request exists as [x, y] - append current timeslot to make [x, y, t]
      newRequestStatus = new PreimageRequestStatus()
      newRequestStatus.timeslots.push(existingRequestStatus.timeslots[0])
      newRequestStatus.timeslots.push(existingRequestStatus.timeslots[1])
      newRequestStatus.timeslots.push(u32(timeslot))
    } else {
      // Invalid request state - cannot solicit
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(255) // continue execution
    }

    // Check if service has sufficient balance
    // Gray Paper: a.sa_balance < a.sa_minbalance
    const C_MIN_BALANCE: u64 = u64(1000000) // Gray Paper constant for minimum balance
    if (serviceAccount.balance < C_MIN_BALANCE) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_FULL)
      return new HostFunctionResult(255) // continue execution
    }

    // Update the service account with the new request
    serviceAccount.requests.set(hashData, preimageLength, newRequestStatus)

    // Set success result
    this.setAccumulateSuccess(registers)
    return new HostFunctionResult(255) // continue execution
  }
}
