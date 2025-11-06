import { bytesToHex, hexToBytes, logger } from '@pbnj/core'
import type { HostFunctionResult } from '@pbnj/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import {
  type AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
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
  readonly functionId = ACCUMULATE_FUNCTIONS.EJECT
  readonly name = 'eject'
  readonly gasCost = 10n

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const { registers, ram, implications, timeslot } = context
    // Extract parameters from registers
    const [serviceIdToEject, hashOffset] = registers.slice(7, 9)

    // Read hash from memory (32 bytes)
    // Gray Paper line 851-854: h = memory[o:32] when Nrange(o,32) ⊆ readable(memory), error otherwise
    const [hashData, faultAddress] = ram.readOctets(hashOffset, 32n)
    // Gray Paper line 862: panic when h = error, registers[7] unchanged
    if (faultAddress || !hashData) {
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Get the current implications context
    const [imX] = implications

    // Get service account d from accounts dictionary
    // Gray Paper: d ≠ imX.id ∧ d ∈ keys(imX.state.ps_accounts)
    if (serviceIdToEject === imX.id) {
      this.setAccumulateError(registers, 'WHO')
      return {
        resultCode: null, // continue execution
      }
    }

    const serviceAccount = imX.state.accounts.get(serviceIdToEject)
    if (!serviceAccount) {
      this.setAccumulateError(registers, 'WHO')
      return {
        resultCode: null, // continue execution
      }
    }

    // Verify the hash matches the service's code hash
    // Gray Paper: d.sa_codehash ≠ encode[32]{imX.id}
    const expectedCodeHash = this.encodeServiceId(imX.id)
    const serviceCodeHash = hexToBytes(serviceAccount.codehash)
    if (!this.arraysEqual(serviceCodeHash, expectedCodeHash)) {
      this.setAccumulateError(registers, 'WHO')
      return {
        resultCode: null, // continue execution
      }
    }

    // Calculate length: max(81, d.sa_octets) - 81
    const l = Math.max(81, Number(serviceAccount.octets)) - 81

    // Check if the service has exactly 2 items and the request exists
    // Gray Paper: d.sa_items ≠ 2 ∨ (h, l) ∉ d.sa_requests
    if (Number(serviceAccount.items) !== 2) {
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }

    // Get request using nested map structure: requests[hash][length]
    const hashHex = bytesToHex(hashData)
    const requestMap = serviceAccount.requests.get(hashHex)
    if (!requestMap) {
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }

    const request = requestMap.get(BigInt(l))
    if (!request) {
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }

    // Check if the ejection period has expired
    // Gray Paper: d.sa_requests[h, l] = [x, y], y < t - Cexpungeperiod
    const C_EXPUNGE_PERIOD = 19200n // Gray Paper constant
    if (request.length < 2 || request[1] >= timeslot - C_EXPUNGE_PERIOD) {
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }

    // Transfer balance to current service and remove the ejected service
    // Gray Paper: imX'.state.ps_accounts = imX.state.ps_accounts \ {d} ∪ {imX.id: s'}
    // where s' = imX.self except s'.sa_balance = imX.self.sa_balance + d.sa_balance
    const currentService = imX.state.accounts.get(imX.id)
    const ejectedBalance = serviceAccount.balance
    const currentBalanceBefore = currentService?.balance ?? 0n

    if (currentService) {
      currentService.balance += serviceAccount.balance
    }

    // Remove the ejected service account
    const deleted = imX.state.accounts.delete(serviceIdToEject)

    // Log ejection details for debugging
    logger.debug('[EjectHostFunction] Service ejected successfully', {
      ejectedServiceId: serviceIdToEject.toString(),
      currentServiceId: imX.id.toString(),
      ejectedBalance: ejectedBalance.toString(),
      currentBalanceBefore: currentBalanceBefore.toString(),
      currentBalanceAfter: currentService?.balance?.toString() ?? 'N/A',
      deleted: deleted,
      remainingAccountsCount: imX.state.accounts.size,
      remainingAccountIds: Array.from(imX.state.accounts.keys()).map((id) =>
        id.toString(),
      ),
    })

    // Set success result
    this.setAccumulateSuccess(registers)
    return {
      resultCode: null, // continue execution
    }
  }

  private encodeServiceId(serviceId: bigint): Uint8Array {
    // Encode service ID as 32-byte hash
    const buffer = new ArrayBuffer(32)
    const view = new DataView(buffer)
    view.setBigUint64(0, serviceId, true) // little-endian
    return new Uint8Array(buffer)
  }

  private arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }
}
