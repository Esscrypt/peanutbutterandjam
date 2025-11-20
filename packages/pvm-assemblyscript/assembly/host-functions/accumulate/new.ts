import { RESULT_CODE_PANIC } from '../../config'
import { bytesToHex } from '../../types'
import {
  ACCUMULATE_ERROR_CASH,
  ACCUMULATE_ERROR_FULL,
  ACCUMULATE_ERROR_HUH,
  ACCUMULATE_ERROR_WHAT,
  AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
  HostFunctionResult,
  ServiceAccount,
} from './base'

/**
 * NEW accumulation host function (Ω_N)
 *
 * Creates a new service account
 *
 * Gray Paper Specification:
 * - Function ID: 18 (new)
 * - Gas Cost: 10
 * - Parameters: registers[7-12] = o, l, minAccGas, minMemoGas, gratis, desiredId
 *   - o: code hash offset in memory
 *   - l: code hash length (should be 32)
 *   - minAccGas: minimum accumulation gas
 *   - minMemoGas: minimum memory gas
 *   - gratis: gratis flag (0 = paid, 1 = free)
 *   - desiredId: desired service ID (if gratis = 0)
 * - Returns: registers[7] = new service ID or error code
 *
 * Gray Paper Logic:
 * 1. Read code hash from memory (32 bytes)
 * 2. Check if current service is registrar (if gratis = 0)
 * 3. Check if current service has sufficient balance
 * 4. Create new service account with specified parameters
 * 5. Deduct minimum balance from current service
 * 6. Return new service ID
 */
export class NewHostFunction extends BaseAccumulateHostFunction {
  functionId: u64 = u64(18) // NEW function ID
  name: string = 'new'
  gasCost: u64 = u64(10)

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const registers = context.registers
    const ram = context.ram
    const implications = context.implications
    const timeslot = context.timeslot
    // Gray Paper line 204: Ω_F receives H_timeslot (block header's timeslot)
    // This is the current block's timeslot passed from the Accumulate invocation

    // Extract parameters from registers
    const codeHashOffset = u64(registers[7])
    const codeHashLength = u64(registers[8])
    const minAccGas = u64(registers[9])
    const minMemoGas = u64(registers[10])
    const gratis = u64(registers[11])
    const desiredId = u64(registers[12])

    // Read code hash from memory (32 bytes)
    const readResult_codeHashData = ram.readOctets(
      codeHashOffset,
      codeHashLength,
    )
    if (faultAddress_readResult !== null || faultAddress !== null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    if (codeHashData === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // Get the current implications context
    const imX = implications.regular

    // Get current service account
    const currentService = imX.state.accounts.get(imX.id)
    if (!currentService) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(null) // continue execution
    }

    // Check if gratis is set and validate permissions
    if (gratis === u64(0) && imX.id !== imX.state.registrar) {
      // Only registrar can create paid services
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(null) // continue execution
    }

    // Calculate minimum balance required
    const C_MIN_BALANCE: u64 = u64(1000000) // Gray Paper constant for minimum balance
    const minBalance = C_MIN_BALANCE

    // Check if current service has sufficient balance
    if (currentService.balance < minBalance) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_CASH)
      return new HostFunctionResult(null) // continue execution
    }

    // Determine new service ID
    let newServiceId: u64
    const C_MIN_PUBLIC_INDEX: u64 = u64(65536) // 2^16

    if (gratis === u64(0)) {
      // Paid service - use desired ID if valid
      if (desiredId < C_MIN_PUBLIC_INDEX) {
        // Check if desired ID is already taken
        if (imX.state.accounts.has(desiredId)) {
          this.setAccumulateError(registers, ACCUMULATE_ERROR_FULL)
          return new HostFunctionResult(null) // continue execution
        }
        newServiceId = desiredId
      } else {
        // Use next free ID
        newServiceId = this.getNextFreeId(imX.nextfreeid, imX.state.accounts)
      }
    } else {
      // Free service - use next free ID
      newServiceId = this.getNextFreeId(imX.nextfreeid, imX.state.accounts)
    }

    // Create new service account
    const codeHashHex = bytesToHex(codeHashData)
    const newServiceAccount = new ServiceAccount()
    newServiceAccount.codehash = codeHashHex
    newServiceAccount.balance = minBalance
    newServiceAccount.minaccgas = minAccGas
    newServiceAccount.minmemogas = minMemoGas
    newServiceAccount.octets = u64(0) // Will be calculated
    newServiceAccount.gratis = gratis
    newServiceAccount.items = u64(0) // Will be calculated
    newServiceAccount.created = timeslot
    newServiceAccount.lastacc = u64(0)
    newServiceAccount.parent = imX.id
    // Initial request for code: requests[codeHashHex][0] = []
    const initialRequestMap = new Map<u64, u64[]>()
    initialRequestMap.set(u64(0), [] as u64[])
    newServiceAccount.requests.set(codeHashHex, initialRequestMap)

    // Deduct balance from current service
    currentService.balance -= minBalance

    // Add new service to accounts
    imX.state.accounts.set(newServiceId, newServiceAccount)

    // Update next free ID
    imX.nextfreeid = this.getNextFreeId(imX.nextfreeid, imX.state.accounts)

    // Set success result with new service ID
    this.setAccumulateSuccess(registers, newServiceId)
    return new HostFunctionResult(null) // continue execution
  }

  /**
   * Get next free ID according to Gray Paper specification
   *
   * Gray Paper line 791: i* = check(Cminpublicindex + (im_nextfreeid - Cminpublicindex + 42) mod (2^32 - Cminpublicindex - 2^8))
   *
   * The check function (Gray Paper line 252-255) ensures the ID is not already in use:
   * - If ID is available, return it
   * - Otherwise, recursively check the next candidate (increment by 1, wrapped)
   */
  getNextFreeId(
    currentId: u64,
    accounts: Map<u64, ServiceAccount>,
  ): u64 {
    const C_MIN_PUBLIC_INDEX: u64 = u64(65536) // 2^16 = Cminpublicindex
    const MODULUS: u64 = u64(4294967296) - C_MIN_PUBLIC_INDEX - u64(256) // 2^32 - Cminpublicindex - 2^8

    // Gray Paper line 791: Calculate candidate ID
    // i* = Cminpublicindex + (im_nextfreeid - Cminpublicindex + 42) mod (2^32 - Cminpublicindex - 2^8)
    const candidateId =
      C_MIN_PUBLIC_INDEX + ((currentId - C_MIN_PUBLIC_INDEX + u64(42)) % MODULUS)

    // Gray Paper line 252-255: Apply check function to ensure ID is available
    return this.checkServiceId(candidateId, accounts)
  }

  /**
   * Check function from Gray Paper line 252-255
   *
   * check(i ∈ serviceid) = {
   *   i                          if i ∉ keys(accounts)
   *   check((i - Cminpublicindex + 1) mod (2^32 - 2^8 - Cminpublicindex) + Cminpublicindex)  otherwise
   * }
   */
  checkServiceId(
    id: u64,
    accounts: Map<u64, ServiceAccount>,
  ): u64 {
    const C_MIN_PUBLIC_INDEX: u64 = u64(65536) // 2^16 = Cminpublicindex
    const MODULUS: u64 = u64(4294967296) - u64(256) - C_MIN_PUBLIC_INDEX // 2^32 - 2^8 - Cminpublicindex

    // If ID is not in accounts, return it
    if (!accounts.has(id)) {
      return id
    }

    // Otherwise, recursively check the next candidate
    // (i - Cminpublicindex + 1) mod (2^32 - 2^8 - Cminpublicindex) + Cminpublicindex
    const nextCandidate =
      C_MIN_PUBLIC_INDEX + ((id - C_MIN_PUBLIC_INDEX + u64(1)) % MODULUS)

    return this.checkServiceId(nextCandidate, accounts)
  }
}
