import { bytesToHex } from '@pbnj/core'
import type {
  HostFunctionResult,
  ImplicationsPair,
  RAM,
  RegisterState,
  ServiceAccount,
} from '@pbnj/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import { BaseAccumulateHostFunction } from './base'

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
  readonly gasCost = 10n

  execute(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
    timeslot?: bigint,
  ): HostFunctionResult {
    // Validate execution
    if (gasCounter < this.gasCost) {
      return {
        resultCode: RESULT_CODES.OOG,
      }
    }

    if (!timeslot) {
      this.setAccumulateError(registers, 'WHAT')
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    try {
      // Extract parameters from registers
      const [o, l, minAccGas, minMemoGas, gratis, desiredId] = registers.slice(
        7,
        13,
      )

      // Read code hash from memory (32 bytes)
      const codeHashData = ram.readOctets(o, l)
      if (!codeHashData || codeHashData.length !== 32) {
        this.setAccumulateError(registers, 'WHAT')
        return {
          resultCode: RESULT_CODES.PANIC,
        }
      }

      // Get the current implications context
      const [imX] = context

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

      // Deduct balance from current service
      currentService.balance -= minBalance

      // Add new service to accounts
      imX.state.accounts.set(newServiceId, newServiceAccount)

      // Update next free ID
      imX.nextfreeid = this.getNextFreeId(imX.nextfreeid, imX.state.accounts)

      // Set success result with new service ID
      this.setAccumulateSuccess(registers, newServiceId)
      return {
        resultCode: null, // continue execution
      }
    } catch {
      this.setAccumulateError(registers, 'WHAT')
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }
  }

  private getNextFreeId(
    currentId: bigint,
    accounts: Map<bigint, ServiceAccount>,
  ): bigint {
    const C_MIN_PUBLIC_INDEX = 65536n // 2^16
    const MAX_ID = 2n ** 32n - 256n // 2^32 - 2^8

    let id = currentId
    while (accounts.has(id)) {
      id =
        C_MIN_PUBLIC_INDEX +
        ((id - C_MIN_PUBLIC_INDEX + 1n) % (MAX_ID - C_MIN_PUBLIC_INDEX))
    }
    return id
  }
}
