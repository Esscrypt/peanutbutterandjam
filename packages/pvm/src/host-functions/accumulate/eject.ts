import { encodeFixedLength, getServiceRequestValue } from '@pbnjam/codec'
import { bytesToHex, hexToBytes, logger } from '@pbnjam/core'
import type { HostFunctionResult } from '@pbnjam/types'
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
  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const { registers, ram, implications, timeslot } = context
    // Extract parameters from registers
    const [serviceIdToEject, hashOffset] = registers.slice(7, 9)

    // Log all input parameters
    context.log('EJECT host function invoked', {
      serviceIdToEject: serviceIdToEject.toString(),
      hashOffset: hashOffset.toString(),
      timeslot: timeslot.toString(),
      currentServiceId: implications[0].id.toString(),
      expungePeriod: context.expungePeriod.toString(),
    })

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
    // Use encodeFixedLength for proper Gray Paper encoding
    const [encodeError, expectedCodeHash] = encodeFixedLength(imX.id, 32n)
    if (encodeError) {
      logger.error('[EjectHostFunction] Failed to encode service ID', {
        serviceId: imX.id.toString(),
        error: encodeError.message,
      })
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }
    const serviceCodeHash = hexToBytes(serviceAccount.codehash)
    if (!this.arraysEqual(serviceCodeHash, expectedCodeHash)) {
      logger.warning('[EjectHostFunction] Codehash mismatch', {
        serviceIdToEject: serviceIdToEject.toString(),
        currentServiceId: imX.id.toString(),
        expectedCodeHash: bytesToHex(expectedCodeHash),
        actualCodeHash: serviceAccount.codehash,
      })
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
    const requestValue = getServiceRequestValue(serviceAccount, serviceIdToEject, hashHex, BigInt(l));

    // const requestMap = serviceAccount.requests.get(hashHex)
    if (!requestValue) {
      logger.warning('[EjectHostFunction] Request map not found for hash', {
        hashHex,
        availableHashes: Object.keys(serviceAccount.rawCshKeyvals),
      })
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }


    // Check if the ejection period has expired
    // Gray Paper: d.sa_requests[h, l] = [x, y], y < t - Cexpungeperiod
    // For test vectors, Cexpungeperiod = 32 (as per README)
    // For production, Cexpungeperiod = 19200 (Gray Paper constant)
    const expungePeriod = context.expungePeriod
    const threshold = timeslot - expungePeriod

    if (requestValue.length < 2 || requestValue[1] >= timeslot - expungePeriod) {
      logger.warning('[EjectHostFunction] Expunge period check failed', {
        requestLength: requestValue.length,
        y: requestValue[1]?.toString(),
        timeslot: timeslot.toString(),
        expungePeriod: expungePeriod.toString(),
        threshold: threshold.toString(),
      })
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }

    // Transfer balance to current service and remove the ejected service
    // Gray Paper: imX'.state.ps_accounts = imX.state.ps_accounts \ {d} ∪ {imX.id: s'}
    // where s' = imX.self except s'.sa_balance = imX.self.sa_balance + d.sa_balance
    const currentService = imX.state.accounts.get(imX.id)

    if (!currentService) {
      logger.error(
        '[EjectHostFunction] Current service account not found in state',
        {
          currentServiceId: imX.id.toString(),
          availableAccountIds: Array.from(imX.state.accounts.keys()).map((id) =>
            id.toString(),
          ),
        },
      )
      this.setAccumulateError(registers, 'WHO')
      return {
        resultCode: null, // continue execution
      }
    }

    currentService.balance += serviceAccount.balance

    // Remove the ejected service account
    imX.state.accounts.delete(serviceIdToEject)

    // Set success result
    this.setAccumulateSuccess(registers)
    return {
      resultCode: null, // continue execution
    }
  }

  private arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }
}
