import { RESULT_CODE_PANIC } from '../../config'
import { CompleteServiceAccount, PreimageRequestStatus, AccountEntry } from '../../codec'
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
    // Gray Paper: (o, l, minaccgas, minmemogas, gratis, desiredid) = registers[7:6]
    // o = code hash offset
    // l = expected code length (NOT the hash length - hash is always 32 bytes)
    const codeHashOffset = u64(registers[7])
    const expectedCodeLength = u64(registers[8])  // Expected length of the code preimage
    const minAccGas = u64(registers[9])
    const minMemoGas = u64(registers[10])
    const gratis = u64(registers[11])
    const desiredId = u64(registers[12])

    // Gray Paper: l must be a valid 32-bit number
    if (expectedCodeLength > u64(0xFFFFFFFF)) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // Gray Paper: codehash = memory[o:32] - ALWAYS read 32 bytes for the hash
    // The hash is a blake2b hash which is always 32 bytes
    const readResult_codeHash = ram.readOctets(
      u32(codeHashOffset),
      u32(32),  // Always read 32 bytes for the code hash
    )
    if (readResult_codeHash.faultAddress !== 0) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    if (readResult_codeHash.data === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_WHAT)
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    const codeHashData = readResult_codeHash.data!

    // Get the current implications context
    const imX = implications.regular

    // Get current service account
    const currentAccountEntry = this.findAccountEntry(imX.state.accounts, imX.id)
    if (currentAccountEntry === null) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(255) // continue execution
    }
    const currentService = currentAccountEntry.account

    // Check if gratis is set and validate permissions
    if (gratis === u64(0) && imX.id !== imX.state.registrar) {
      // Only registrar can create paid services
      this.setAccumulateError(registers, ACCUMULATE_ERROR_HUH)
      return new HostFunctionResult(255) // continue execution
    }

    // Calculate minimum balance required
    const C_MIN_BALANCE: u64 = u64(1000000) // Gray Paper constant for minimum balance
    const minBalance = C_MIN_BALANCE

    // Check if current service has sufficient balance
    if (currentService.balance < minBalance) {
      this.setAccumulateError(registers, ACCUMULATE_ERROR_CASH)
      return new HostFunctionResult(255) // continue execution
    }

    // Determine new service ID
    // Gray Paper lines 788-792:
    // - If registrar and desiredId < Cminpublicindex: use desiredId, keep nextfreeid unchanged
    // - Otherwise: use imX.nextfreeid directly, then update nextfreeid to i*
    let newServiceId: u64
    let updateNextFreeId = false
    const C_MIN_PUBLIC_INDEX: u64 = u64(65536) // 2^16

    if (gratis === u64(0) && imX.id === imX.state.registrar && desiredId < C_MIN_PUBLIC_INDEX) {
      // Registrar creating reserved service with specific ID
      // Gray Paper line 788: check if desired ID is already taken
      if (this.hasAccountEntry(imX.state.accounts, desiredId)) {
        this.setAccumulateError(registers, ACCUMULATE_ERROR_FULL)
        return new HostFunctionResult(255) // continue execution
      }
      newServiceId = desiredId
      // nextfreeid stays unchanged for registrar with reserved ID
    } else {
      // Non-registrar OR registrar with public ID - use imX.nextfreeid directly
      // Gray Paper line 790: returns imX.nextfreeid as the new service ID
      newServiceId = u64(imX.nextfreeid)
      updateNextFreeId = true
    }

    // Create new service account
    // Gray Paper line 770: sa_requests = {(c, l): []}
    // where c = codehash and l = expectedCodeLength (expected code length)
    const newServiceAccount = new CompleteServiceAccount()
    newServiceAccount.codehash = codeHashData
    newServiceAccount.balance = minBalance
    newServiceAccount.minaccgas = minAccGas
    newServiceAccount.minmemogas = minMemoGas
    // Calculate items and octets for the new service account
    // Gray Paper: items = 2 * len(requests) + len(storage) = 2 * 1 + 0 = 2
    // Gray Paper: octets = sum((81 + z) for (h, z) in keys(requests)) = 81 + expectedCodeLength
    newServiceAccount.octets = u64(81) + expectedCodeLength
    newServiceAccount.gratis = gratis
    newServiceAccount.items = 2 // 2 * 1 request + 0 storage
    newServiceAccount.created = u32(timeslot)
    newServiceAccount.lastacc = 0
    newServiceAccount.parent = u32(imX.id)
    // Gray Paper line 770: Initial request for code: requests[(codeHashData, expectedCodeLength)] = []
    const initialStatus = new PreimageRequestStatus()
    newServiceAccount.requests.set(codeHashData, expectedCodeLength, initialStatus)

    // Deduct balance from current service
    currentService.balance -= minBalance

    // Add new service to accounts
    this.setAccountEntry(imX.state.accounts, newServiceId, newServiceAccount)

    // Update next free ID only for non-registrar cases
    // Gray Paper line 791: i* = check(Cminpublicindex + (imX.nextfreeid - Cminpublicindex + 42) mod ...)
    if (updateNextFreeId) {
      imX.nextfreeid = u32(this.getNextFreeId(u64(imX.nextfreeid), imX.state.accounts))
    }

    // Set success result with new service ID
    this.setAccumulateSuccess(registers, newServiceId)
    return new HostFunctionResult(255) // continue execution
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
    accounts: Array<AccountEntry>,
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
    accounts: Array<AccountEntry>,
  ): u64 {
    const C_MIN_PUBLIC_INDEX: u64 = u64(65536) // 2^16 = Cminpublicindex
    const MODULUS: u64 = u64(4294967296) - u64(256) - C_MIN_PUBLIC_INDEX // 2^32 - 2^8 - Cminpublicindex

    // If ID is not in accounts, return it
    if (!this.hasAccountEntry(accounts, id)) {
      return id
    }

    // Otherwise, recursively check the next candidate
    // (i - Cminpublicindex + 1) mod (2^32 - 2^8 - Cminpublicindex) + Cminpublicindex
    const nextCandidate =
      C_MIN_PUBLIC_INDEX + ((id - C_MIN_PUBLIC_INDEX + u64(1)) % MODULUS)

    return this.checkServiceId(nextCandidate, accounts)
  }
}
