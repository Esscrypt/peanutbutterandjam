import { setServiceRequestValue } from '@pbnjam/codec'
import {
  bytesToHex,
  calculateMinBalance,
  calculateNextFreeId,
  logger,
} from '@pbnjam/core'
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
      expectedCodeLength, // This is the expected length of the code preimage, NOT the hash length
      minAccGas,
      minMemoGas,
      gratis,
      desiredId,
    ] = registers.slice(7, 13)

    // Gray Paper: l must be a valid 32-bit number
    // Gray Paper line 763: l ∈ N_bits32, otherwise codehash = error → PANIC
    // On PANIC, registers_7 remains unchanged
    if (expectedCodeLength > 0xffffffffn) {
      logger.error('[NEW] PANIC: expectedCodeLength exceeds 32-bit', {
        expectedCodeLength: expectedCodeLength.toString(),
      })
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Gray Paper: codehash = memory[o:32] - ALWAYS read 32 bytes for the hash
    // The hash is a blake2b hash which is always 32 bytes

    const [codeHashData, faultAddress] = ram.readOctets(
      codeHashOffset,
      32n, // Always read 32 bytes for the code hash
    )

    if (faultAddress) {
      logger.error('[NEW] PANIC: memory read fault for codehash', {
        codeHashOffset: codeHashOffset.toString(),
        faultAddress: faultAddress.toString(),
      })
      // Gray Paper: PANIC but registers_7 should remain UNCHANGED
      // Do NOT call setAccumulateError - just return PANIC
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }
    if (!codeHashData) {
      logger.error('[NEW] PANIC: no codehash data', {
        codeHashOffset: codeHashOffset.toString(),
      })
      // Gray Paper: PANIC but registers_7 should remain UNCHANGED
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Get the current implications context
    const [imX] = implications

    // Get current service account
    const currentService = imX.state.accounts.get(imX.id)
    if (!currentService) {
      logger.error('[NEW] PANIC: current service account not found', {
        serviceId: imX.id.toString(),
      })
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }

    // Gray Paper line 787: HUH when gratis != 0 AND service is not the manager
    // Only the manager can create services with gratis (free deposit allowance)
    if (gratis !== 0n && imX.id !== imX.state.manager) {
      logger.error('[NEW] HUH: gratis != 0 and service is not the manager', {
        serviceId: imX.id.toString(),
        managerId: imX.state.manager.toString(),
        gratis: gratis.toString(),
      })
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
    const newServiceItems = 2n // 2 * 1 request + 0 storage
    const newServiceOctets = 81n + expectedCodeLength // 81 + expected code length

    // Gray Paper: minbalance = max(0, Cbasedeposit + Citemdeposit * items + Cbytedeposit * octets - gratis)
    const minBalance = calculateMinBalance(
      newServiceItems,
      newServiceOctets,
      gratis,
    )

    // Check if current service has sufficient balance
    // Gray Paper line 786: CASH when s.balance < self.minbalance
    // where s = imX_self exc s_sa_balance = (imX_self)_sa_balance - a_sa_minbalance
    // So we check: (imX_self)_sa_balance - a_sa_minbalance < (imX_self)_sa_minbalance
    const balanceAfterDeduction = currentService.balance - minBalance

    // Check for underflow (would result in negative balance)
    if (
      balanceAfterDeduction < currentService.balance &&
      balanceAfterDeduction < 0n
    ) {
      // Would result in negative balance - insufficient funds
      this.setAccumulateError(registers, 'CASH')
      return {
        resultCode: null, // continue execution
      }
    }

    // Gray Paper line 786: Check if remaining balance is at least current service's minbalance
    // Calculate current service's minbalance from its storage footprint
    const currentServiceMinBalance = calculateMinBalance(
      currentService.items,
      currentService.octets,
      currentService.gratis,
    )

    if (balanceAfterDeduction < currentServiceMinBalance) {
      this.setAccumulateError(registers, 'CASH')
      return {
        resultCode: null, // continue execution
      }
    }

    // Determine new service ID
    // Gray Paper lines 788-792:
    // - If registrar and desiredId < Cminpublicindex: use desiredId, keep nextfreeid unchanged
    // - Otherwise: use imX.nextfreeid directly, then update nextfreeid to i*
    let newServiceId: bigint
    let updateNextFreeId = false
    const C_MIN_PUBLIC_INDEX = 65536n // 2^16

    if (
      gratis === 0n &&
      imX.id === imX.state.registrar &&
      desiredId < C_MIN_PUBLIC_INDEX
    ) {
      // Registrar creating reserved service with specific ID
      // Gray Paper line 788: check if desired ID is already taken
      if (imX.state.accounts.has(desiredId)) {
        logger.error('[NEW] FULL: desired ID is already taken', {
          desiredId: desiredId.toString(),
          serviceId: imX.id.toString(),
        })
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
      rawCshKeyvals: {},
    }

    // Gray Paper line 770: sa_requests = {(c, l): []}
    // where c = codehash and l = expectedCodeLength
    // Create the initial request entry with empty timeslots array
    // Request key: C(s, encode[4]{l} || codehash)
    // Request value: encode{var{sequence{encode[4]{x} | x ∈ t}}} where t = [] (empty)
    setServiceRequestValue(
      newServiceAccount,
      newServiceId,
      codeHashHex, // requestHash = codehash (32-byte hash)
      expectedCodeLength, // length = expectedCodeLength
      [], // requestValue = empty timeslots array
    )

    // Note: octets and items are already correctly set above:
    // - octets = 81 + expectedCodeLength (Gray Paper: sum((81 + z) for (h, z) in keys(requests)))
    // - items = 2 (Gray Paper: 2 * len(requests) + len(storage) = 2 * 1 + 0 = 2)
    // These values don't need to be recalculated because we know the blob length z = expectedCodeLength

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
      imX.nextfreeid = calculateNextFreeId(imX.nextfreeid, imX.state.accounts)
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
}
