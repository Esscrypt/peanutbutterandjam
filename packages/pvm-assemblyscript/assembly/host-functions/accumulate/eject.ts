import { encodeFixedLength } from '../../codec'
import { RESULT_CODE_PANIC } from '../../config'
import {
  ACCUMULATE_ERROR_HUH,
  ACCUMULATE_ERROR_WHO,
  AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
  HostFunctionResult,
} from './base'

/**
 * EJECT accumulation host function (Ω_J)
 *
 * Ejects/removes service account
 *
 * Gray Paper Specification:
 * - Function ID: 21 (eject)
 * - Gas Cost: 10
 * - Parameters: registers[7-8] = d, o
 *   - d: service account ID to eject
 *   - o: hash offset in memory (32 bytes)
 * - Returns: registers[7] = OK or error code
 *
 * Gray Paper Logic:
 * 1. Read hash from memory at offset o (32 bytes)
 * 2. Get service account d from accounts dictionary
 * 3. Check if service account exists and is not the current service
 * 4. Verify the hash matches the service's code hash
 * 5. Check if the service has exactly 2 items and the request exists
 * 6. Check if the ejection period has expired (y < t - Cexpungeperiod)
 * 7. Remove the service account and transfer its balance to current service
 */
export class EjectHostFunction extends BaseAccumulateHostFunction {
  functionId: u64 = u64(21) // EJECT function ID
  name: string = 'eject'
  gasCost: u64 = u64(10)

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const registers = context.registers
    const ram = context.ram
    const implications = context.implications
    const timeslot = context.timeslot
    const expungePeriod = context.expungePeriod
    // Extract parameters from registers
    const serviceIdToEject = u64(registers[7])
    const hashOffset = u64(registers[8])

    // Read hash from memory (32 bytes)
    // Gray Paper line 851-854: h = memory[o:32] when Nrange(o,32) ⊆ readable(memory), error otherwise
    const readResult_hash = ram.readOctets(u32(hashOffset), u32(32))
    // Gray Paper line 862: panic when h = error, registers[7] unchanged
    if (readResult_hash.faultAddress !== 0) {
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    if (readResult_hash.data === null) {
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    const hashData = readResult_hash.data!

    // Get the current implications context
    const imX = implications.regular

    // Get service account d from accounts dictionary
    // Gray Paper: d ≠ imX.id ∧ d ∈ keys(imX.state.ps_accounts)
    if (serviceIdToEject === imX.id) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHO)
      return new HostFunctionResult(255) // continue execution
    }

    const accountEntry = this.findAccountEntry(imX.state.accounts, serviceIdToEject)
    if (accountEntry === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHO)
      return new HostFunctionResult(255) // continue execution
    }
    const serviceAccount = accountEntry.account

    // Verify the hash matches the service's code hash
    // Gray Paper: d.sa_codehash ≠ encode[32]{imX.id}
    // Use encodeFixedLength for proper Gray Paper encoding
    const expectedCodeHash = encodeFixedLength(imX.id, 32)
    const serviceCodeHash = serviceAccount.codehash
    if (!this.arraysEqual(serviceCodeHash, expectedCodeHash)) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHO)
      return new HostFunctionResult(255) // continue execution
    }

    // Calculate length: max(81, d.sa_octets) - 81
    const octetsI32 = i32(serviceAccount.octets)
    const l = max(81, octetsI32) - 81

    // Check if the service has exactly 2 items and the request exists
    // Gray Paper: d.sa_items ≠ 2 ∨ (h, l) ∉ d.sa_requests
    if (serviceAccount.items !== 2) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(255) // continue execution
    }

    // Get request using requests structure: requests.get(hash, length)
    const requestStatus = serviceAccount.requests.get(hashData, u64(l))
    if (requestStatus === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(255) // continue execution
    }

    // Check if the ejection period has expired
    // Gray Paper: d.sa_requests[h, l] = [x, y], y < t - Cexpungeperiod
    // For test vectors, Cexpungeperiod = 32 (as per README)
    // For production, Cexpungeperiod = 19200 (Gray Paper constant)
    const timeslots = requestStatus.timeslots
    if (timeslots.length < 2 || u64(timeslots[1]) >= timeslot - expungePeriod) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(255) // continue execution
    }

    // Transfer balance to current service and remove the ejected service
    // Gray Paper: imX'.state.ps_accounts = imX.state.ps_accounts \ {d} ∪ {imX.id: s'}
    // where s' = imX.self except s'.sa_balance = imX.self.sa_balance + d.sa_balance
    const currentAccountEntry = this.findAccountEntry(imX.state.accounts, imX.id)
    
    if (currentAccountEntry === null) {
      // Current service account not found - this should not happen but handle gracefully
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHO)
      return new HostFunctionResult(255) // continue execution
    }

    // Transfer balance: s'.sa_balance = imX.self.sa_balance + d.sa_balance
    currentAccountEntry.account.balance += serviceAccount.balance

    // Remove the ejected service account
    for (let i = 0; i < imX.state.accounts.length; i++) {
      if (u64(imX.state.accounts[i].serviceId) === serviceIdToEject) {
        imX.state.accounts.splice(i, 1)
        break
      }
    }

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
