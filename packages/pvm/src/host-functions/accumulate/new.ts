import { bytesToHex, logger } from '@pbnj/core'
import type { HostFunctionResult, ServiceAccount } from '@pbnj/types'
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

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const { registers, ram, implications, timeslot } = context
    // Gray Paper line 204: Ω_F receives H_timeslot (block header's timeslot)
    // This is the current block's timeslot passed from the Accumulate invocation

    // Extract parameters from registers
    const [
      codeHashOffset,
      codeHashLength,
      minAccGas,
      minMemoGas,
      gratis,
      desiredId,
    ] = registers.slice(7, 13)

    // Log all input parameters
    context.log('NEW host function invoked', {
      codeHashOffset: codeHashOffset.toString(),
      codeHashLength: codeHashLength.toString(),
      minAccGas: minAccGas.toString(),
      minMemoGas: minMemoGas.toString(),
      gratis: gratis.toString(),
      desiredId: desiredId.toString(),
      timeslot: timeslot.toString(),
      currentServiceId: implications[0].id.toString(),
      registrar: implications[0].state.registrar.toString(),
      nextFreeId: implications[0].nextfreeid.toString(),
    })

    // Read code hash from memory (32 bytes)
    const [codeHashData, faultAddress] = ram.readOctets(
      codeHashOffset,
      codeHashLength,
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

    // Calculate minimum balance required
    const C_MIN_BALANCE = 1000000n // Gray Paper constant for minimum balance
    const minBalance = C_MIN_BALANCE

    // Check if current service has sufficient balance
    if (currentService.balance < minBalance) {
      this.setAccumulateError(registers, 'CASH')
      return {
        resultCode: null, // continue execution
      }
    }

    // Determine new service ID
    let newServiceId: bigint
    const C_MIN_PUBLIC_INDEX = 65536n // 2^16

    if (gratis === 0n) {
      // Paid service - use desired ID if valid
      if (desiredId < C_MIN_PUBLIC_INDEX) {
        // Check if desired ID is already taken
        if (imX.state.accounts.has(desiredId)) {
          this.setAccumulateError(registers, 'FULL')
          return {
            resultCode: null, // continue execution
          }
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
    const newServiceAccount: ServiceAccount = {
      codehash: codeHashHex,
      balance: minBalance,
      minaccgas: minAccGas,
      minmemogas: minMemoGas,
      octets: 0n, // Will be calculated
      gratis: gratis,
      items: 0n, // Will be calculated
      created: timeslot,
      lastacc: 0n,
      parent: imX.id,
      storage: new Map(),
      preimages: new Map(),
      requests: new Map([[codeHashHex, new Map([[0n, []]])]]), // Initial request for code
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

    // Update next free ID
    imX.nextfreeid = this.getNextFreeId(imX.nextfreeid, imX.state.accounts)

    logger.info('[NEW Host Function] New service account created successfully', {
      newServiceId: newServiceId.toString(),
      nextFreeId: imX.nextfreeid.toString(),
      totalAccounts: imX.state.accounts.size,
    })

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
