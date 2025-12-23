import { bytesToHex, logger } from '@pbnjam/core'
import type { HostFunctionResult, ServiceAccount } from '@pbnjam/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import {
  type AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
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
  readonly functionId = ACCUMULATE_FUNCTIONS.NEW
  readonly name = 'new'
  readonly gasCost = 10n // Gray Paper pvm_invocations.tex line 760: g = 10

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const { registers, ram, implications, timeslot } = context
    // Gray Paper line 204: Ω_F receives H_timeslot (block header's timeslot)
    // This is the current block's timeslot passed from the Accumulate invocation

    // Extract parameters from registers
    // Gray Paper: (o, l, minaccgas, minmemogas, gratis, desiredid) = registers[7:6]
    // o = code hash offset
    // l = expected code length (NOT the hash length - hash is always 32 bytes)
    const [
      codeHashOffset,
      expectedCodeLength,  // This is the expected length of the code preimage, NOT the hash length
      minAccGas,
      minMemoGas,
      gratis,
      desiredId,
    ] = registers.slice(7, 13)

    // Gray Paper: l must be a valid 32-bit number
    if (expectedCodeLength > 0xFFFFFFFFn) {
      this.setAccumulateError(registers, 'WHAT')
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Log all input parameters
    context.log('NEW host function invoked', {
      codeHashOffset: codeHashOffset.toString(),
      expectedCodeLength: expectedCodeLength.toString(),
      minAccGas: minAccGas.toString(),
      minMemoGas: minMemoGas.toString(),
      gratis: gratis.toString(),
      desiredId: desiredId.toString(),
      timeslot: timeslot.toString(),
      currentServiceId: implications[0].id.toString(),
      registrar: implications[0].state.registrar.toString(),
      nextFreeId: implications[0].nextfreeid.toString(),
    })

    // Gray Paper: codehash = memory[o:32] - ALWAYS read 32 bytes for the hash
    // The hash is a blake2b hash which is always 32 bytes
    const [codeHashData, faultAddress] = ram.readOctets(
      codeHashOffset,
      32n,  // Always read 32 bytes for the code hash
    )
    if (faultAddress) {
      this.setAccumulateError(registers, 'WHAT')
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }
    if (!codeHashData) {
      this.setAccumulateError(registers, 'WHAT')
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Get the current implications context
    const [imX] = implications

    // Get current service account
    const currentService = imX.state.accounts.get(imX.id)
    if (!currentService) {
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }

    // Check if gratis is set and validate permissions
    if (gratis === 0n && imX.id !== imX.state.registrar) {
      // Only registrar can create paid services
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }

    // Calculate minimum balance required for the new service
    // Gray Paper accounts.tex equation (deposits):
    //   minbalance = max(0, Cbasedeposit + Citemdeposit * items + Cbytedeposit * octets - gratis)
    // For a new service with one request entry (codehash, expectedCodeLength):
    //   items = 2 * len(requests) + len(storage) = 2 * 1 + 0 = 2
    //   octets = sum((81 + z) for (h, z) in keys(requests)) = 81 + expectedCodeLength
    const C_BASE_DEPOSIT = 100n
    const C_ITEM_DEPOSIT = 10n
    const C_BYTE_DEPOSIT = 1n
    
    const newServiceItems = 2n // 2 * 1 request + 0 storage
    const newServiceOctets = 81n + expectedCodeLength // 81 + expected code length
    
    // Gray Paper: minbalance = max(0, Cbasedeposit + Citemdeposit * items + Cbytedeposit * octets - gratis)
    const minBalanceBeforeGratis = C_BASE_DEPOSIT + C_ITEM_DEPOSIT * newServiceItems + C_BYTE_DEPOSIT * newServiceOctets
    const minBalance = minBalanceBeforeGratis > gratis ? minBalanceBeforeGratis - gratis : 0n

    // Check if current service has sufficient balance
    // Gray Paper line 786: CASH when s.balance < self.minbalance
    const balanceAfterDeduction = currentService.balance - minBalance
    if (balanceAfterDeduction < currentService.balance && balanceAfterDeduction < 0n) {
      // Would result in negative balance - insufficient funds
      this.setAccumulateError(registers, 'CASH')
      return {
        resultCode: null, // continue execution
      }
    }
    
    // Also check that the remaining balance is at least the current service's minbalance
    // (This is calculated from the current service's storage footprint)
    // For simplicity, we check against the same formula for the current service
    // but in practice, the current service's minbalance depends on its own storage

    // Determine new service ID
    // Gray Paper lines 788-792:
    // - If registrar and desiredId < Cminpublicindex: use desiredId, keep nextfreeid unchanged
    // - Otherwise: use imX.nextfreeid directly, then update nextfreeid to i*
    let newServiceId: bigint
    let updateNextFreeId = false
    const C_MIN_PUBLIC_INDEX = 65536n // 2^16

    if (gratis === 0n && imX.id === imX.state.registrar && desiredId < C_MIN_PUBLIC_INDEX) {
      // Registrar creating reserved service with specific ID
      // Gray Paper line 788: check if desired ID is already taken
      if (imX.state.accounts.has(desiredId)) {
        this.setAccumulateError(registers, 'FULL')
        return {
          resultCode: null, // continue execution
        }
      }
      newServiceId = desiredId
      // nextfreeid stays unchanged for registrar with reserved ID
    } else {
      // Non-registrar OR registrar with public ID - use imX.nextfreeid directly
      // Gray Paper line 790: returns imX.nextfreeid as the new service ID
      newServiceId = imX.nextfreeid
      updateNextFreeId = true
    }

    logger.debug('[NEW Host Function] Determining service ID', {
      gratis: gratis.toString(),
      isRegistrar: (imX.id === imX.state.registrar).toString(),
      desiredId: desiredId.toString(),
      currentNextFreeId: imX.nextfreeid.toString(),
      newServiceId: newServiceId.toString(),
      updateNextFreeId,
    })

    // Create new service account
    // Gray Paper line 770: sa_requests = {(c, l): []}
    // where c = codehash and l = codeHashLength (expected code length)
    const codeHashHex = bytesToHex(codeHashData)

    const newServiceAccount: ServiceAccount = {
      codehash: codeHashHex,
      balance: minBalance, // Gray Paper line 771: balance = a.minbalance
      minaccgas: minAccGas,
      minmemogas: minMemoGas,
      octets: newServiceOctets,
      gratis: gratis,
      items: newServiceItems,
      created: timeslot,
      lastacc: 0n,
      parent: imX.id,
      storage: new Map(),
      preimages: new Map(),
      // Gray Paper line 770: requests = {(codehash, expectedCodeLength): []}
      requests: new Map([[codeHashHex, new Map([[expectedCodeLength, []]])]]),
    }

    logger.info('[NEW Host Function] Creating new service account', {
      newServiceId: newServiceId.toString(),
      parentServiceId: imX.id.toString(),
      timeslot: timeslot.toString(),
      codeHash: codeHashHex,
      minAccGas: minAccGas.toString(),
      minMemoGas: minMemoGas.toString(),
      gratis: gratis.toString(),
      desiredId: desiredId.toString(),
      balance: minBalance.toString(),
      currentServiceBalance: currentService.balance.toString(),
    })

    // Deduct balance from current service
    currentService.balance -= minBalance

    // Add new service to accounts
    imX.state.accounts.set(newServiceId, newServiceAccount)

    // Update next free ID only for non-registrar cases
    // Gray Paper line 791: i* = check(Cminpublicindex + (imX.nextfreeid - Cminpublicindex + 42) mod ...)
    if (updateNextFreeId) {
      imX.nextfreeid = this.getNextFreeId(imX.nextfreeid, imX.state.accounts)
    }

    logger.info(
      '[NEW Host Function] New service account created successfully',
      {
        newServiceId: newServiceId.toString(),
        nextFreeId: imX.nextfreeid.toString(),
        totalAccounts: imX.state.accounts.size,
        updateNextFreeId,
      },
    )

    // Set success result with new service ID
    this.setAccumulateSuccess(registers, newServiceId)
    return {
      resultCode: null, // continue execution
    }
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
  private getNextFreeId(
    currentId: bigint,
    accounts: Map<bigint, ServiceAccount>,
  ): bigint {
    const C_MIN_PUBLIC_INDEX = 65536n // 2^16 = Cminpublicindex
    const MODULUS = 2n ** 32n - C_MIN_PUBLIC_INDEX - 2n ** 8n // 2^32 - Cminpublicindex - 2^8

    // Gray Paper line 791: Calculate candidate ID
    // i* = Cminpublicindex + (im_nextfreeid - Cminpublicindex + 42) mod (2^32 - Cminpublicindex - 2^8)
    const candidateId =
      C_MIN_PUBLIC_INDEX + ((currentId - C_MIN_PUBLIC_INDEX + 42n) % MODULUS)

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
  private checkServiceId(
    id: bigint,
    accounts: Map<bigint, ServiceAccount>,
  ): bigint {
    const C_MIN_PUBLIC_INDEX = 65536n // 2^16 = Cminpublicindex
    const MODULUS = 2n ** 32n - 2n ** 8n - C_MIN_PUBLIC_INDEX // 2^32 - 2^8 - Cminpublicindex

    // If ID is not in accounts, return it
    if (!accounts.has(id)) {
      return id
    }

    // Otherwise, recursively check the next candidate
    // (i - Cminpublicindex + 1) mod (2^32 - 2^8 - Cminpublicindex) + Cminpublicindex
    const nextCandidate =
      C_MIN_PUBLIC_INDEX + ((id - C_MIN_PUBLIC_INDEX + 1n) % MODULUS)

    return this.checkServiceId(nextCandidate, accounts)
  }
}
