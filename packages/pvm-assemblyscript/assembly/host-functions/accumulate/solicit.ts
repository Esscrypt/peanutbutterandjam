import { RESULT_CODE_PANIC } from '../../config'
import { bytesToHex } from '../../types'
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
    const readResult_hashData = ram.readOctets(hashOffset, u64(32))
    if (faultAddress_readResult !== null || faultAddress !== null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    if (hashData === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // Get the current implications context
    const imX = implications.regular

    // Get current service account
    const serviceAccount = imX.state.accounts.get(imX.id)
    if (!serviceAccount) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(null) // continue execution
    }

    // Convert hash to hex and look up existing request
    const hashHex = bytesToHex(hashData)
    const requestMap = serviceAccount.requests.get(hashHex)
    const existingRequest = requestMap ? requestMap.get(preimageLength) : null

    // Determine new request state based on Gray Paper logic
    let newRequest: u64[]

    if (!existingRequest) {
      // Request doesn't exist - create empty request []
      newRequest = [] as u64[]
    } else if (existingRequest.length === 2) {
      // Request exists as [x, y] - append current timeslot to make [x, y, t]
      const x = existingRequest[0]
      const y = existingRequest[1]
      newRequest = [] as u64[]
      newRequest.push(x)
      newRequest.push(y)
      newRequest.push(timeslot)
    } else {
      // Invalid request state - cannot solicit
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(null) // continue execution
    }

    // Check if service has sufficient balance
    // Gray Paper: a.sa_balance < a.sa_minbalance
    const C_MIN_BALANCE: u64 = u64(1000000) // Gray Paper constant for minimum balance
    if (serviceAccount.balance < C_MIN_BALANCE) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_FULL)
      return new HostFunctionResult(null) // continue execution
    }

    // Update the service account with the new request
    if (requestMap) {
      // Update existing request map
      requestMap.set(preimageLength, newRequest)
    } else {
      // Create new request map for this hash
      const newRequestMap = new Map<u64, u64[]>()
      newRequestMap.set(preimageLength, newRequest)
      serviceAccount.requests.set(hashHex, newRequestMap)
    }

    // Set success result
    this.setAccumulateSuccess(registers)
    return new HostFunctionResult(null) // continue execution
  }
}
