import { RESULT_CODE_PANIC } from '../../config'
import { getRequestValue, setRequestValue, decodeRequestTimeslots, encodeRequestTimeslots } from '../../codec'
import {
  ACCUMULATE_ERROR_FULL,
  ACCUMULATE_ERROR_HUH,
  AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
  HostFunctionResult,
} from './base'

// Deposit constants (Gray Paper)
const C_BASEDEPOSIT: u64 = u64(100) // Base deposit
const C_ITEMDEPOSIT: u64 = u64(10) // Per-item deposit
const C_BYTEDEPOSIT: u64 = u64(1) // Per-byte deposit

// Helper to check for u64 addition overflow
// Returns true if a + b would overflow
@inline
function wouldOverflowU64(a: u64, b: u64): bool {
  return a > u64.MAX_VALUE - b
}

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
  functionId: u64 = u64(23) // SOLICIT function ID (Gray Paper: 23)
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
    // Gray Paper: If memory read fails (h = error), return PANIC without changing registers
    const readResult_hash = ram.readOctets(u32(hashOffset), u32(32))
    if (readResult_hash.faultAddress !== 0 || readResult_hash.data === null) {
      // Gray Paper line 911: (panic, registers_7, ...) when h = error
      // Do NOT modify registers - just return PANIC
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

    // Look up existing request using rawCshKeyvals helper
    const existingRequestValue = getRequestValue(serviceAccount, u32(imX.id), hashData, preimageLength)

    // Determine new request state based on Gray Paper logic
    let newTimeslots: u32[]
    let isNewRequest = false

    if (existingRequestValue === null) {
      // Request doesn't exist - create empty request []
      newTimeslots = []
      isNewRequest = true
    } else {
      // Decode existing request
      const existingTimeslots = decodeRequestTimeslots(existingRequestValue)
      if (existingTimeslots === null) {
        this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
        return new HostFunctionResult(255) // continue execution
      }

      if (existingTimeslots.length === 2) {
        // Request exists as [x, y] - append current timeslot to make [x, y, t]
        newTimeslots = [existingTimeslots[0], existingTimeslots[1], u32(timeslot)]
      } else {
        // Invalid request state - cannot solicit
        this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
        return new HostFunctionResult(255) // continue execution
      }
    }

    // Calculate new items and octets if this is a new request
    // Gray Paper: items += 2 for each new request (h, z)
    // Gray Paper: octets += (81 + z) for each new request
    let newItems = serviceAccount.items
    let newOctets = serviceAccount.octets

    if (isNewRequest) {
      newItems = serviceAccount.items + u32(2)
      
      // Check for u64 overflow: octets + 81 + preimageLength
      // TypeScript uses bigint (no overflow), so we must detect overflow and return FULL
      const octetsIncrement = u64(81) + preimageLength
      if (wouldOverflowU64(u64(81), preimageLength) || 
          wouldOverflowU64(serviceAccount.octets, octetsIncrement)) {
        // Overflow would occur - in TypeScript this results in minBalance > balance
        this.setAccumulateError(registers, ACCUMULATE_ERROR_FULL)
        return new HostFunctionResult(255) // continue execution
      }
      newOctets = serviceAccount.octets + octetsIncrement
    }

    // Calculate new minimum balance
    // Gray Paper: a_minbalance = max(0, Cbasedeposit + Citemdeposit * a_items + Cbytedeposit * a_octets - a_gratis)
    const itemDeposit = C_ITEMDEPOSIT * u64(newItems)
    const byteDeposit = C_BYTEDEPOSIT * newOctets
    
    // Check for overflow in totalDeposit calculation
    if (wouldOverflowU64(C_BASEDEPOSIT, itemDeposit) ||
        wouldOverflowU64(C_BASEDEPOSIT + itemDeposit, byteDeposit)) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_FULL)
      return new HostFunctionResult(255) // continue execution
    }
    
    const totalDeposit = C_BASEDEPOSIT + itemDeposit + byteDeposit
    const newMinBalance = totalDeposit > serviceAccount.gratis ? totalDeposit - serviceAccount.gratis : u64(0)

    // Check if service has sufficient balance for the new request
    // Gray Paper: If newMinBalance > balance, return FULL error
    if (newMinBalance > serviceAccount.balance) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_FULL)
      return new HostFunctionResult(255) // continue execution
    }

    // Update the service account with the new request using rawCshKeyvals helper
    setRequestValue(serviceAccount, u32(imX.id), hashData, preimageLength, encodeRequestTimeslots(newTimeslots))

    // Update items and octets if this is a new request
    if (isNewRequest) {
      serviceAccount.items = newItems
      serviceAccount.octets = newOctets
    }

    // Set success result
    this.setAccumulateSuccess(registers)
    return new HostFunctionResult(255) // continue execution
  }
}
