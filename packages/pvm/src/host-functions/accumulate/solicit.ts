import { getServiceRequestValue, setServiceRequestValue } from '@pbnjam/codec'
import { bytesToHex, calculateMinBalance, logger } from '@pbnjam/core'
import type { HostFunctionResult } from '@pbnjam/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import {
  type AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
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
  readonly functionId = ACCUMULATE_FUNCTIONS.SOLICIT
  readonly name = 'solicit'

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const { registers, ram, implications, timeslot } = context
    // Extract parameters from registers
    const [hashOffset, preimageLength] = registers.slice(7, 9)

    // Read hash from memory (32 bytes)
    // Gray Paper: If memory read fails (h = error), return PANIC without changing registers
    const [hashData, faultAddress] = ram.readOctets(hashOffset, 32n)
    if (faultAddress || !hashData) {
      logger.error('SOLICIT host function PANIC: memory read failed', {
        hashOffset: hashOffset.toString(),
        preimageLength: preimageLength.toString(),
        faultAddress: faultAddress?.toString() ?? 'null',
      })
      // Gray Paper line 911: (panic, registers_7, ...) when h = error
      // Do NOT modify registers - just return PANIC
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Get the current implications context
    const [imX] = implications

    // Get current service account
    const serviceAccount = imX.state.accounts.get(imX.id)
    if (!serviceAccount) {
      this.setAccumulateError(registers, 'HUH')
      logger.error('SOLICIT host function HUH: service account not found', {
        serviceId: imX.id.toString(),
      })
      return {
        resultCode: null, // continue execution
      }
    }

    // Convert hash to hex and look up existing request
    const hashHex = bytesToHex(hashData)
    const existingRequest = getServiceRequestValue(
      serviceAccount,
      imX.id,
      hashHex,
      preimageLength,
    )

    // Determine new request state based on Gray Paper logic
    let newRequest: bigint[]

    if (!existingRequest) {
      // Request doesn't exist - create empty request []
      newRequest = []
    } else if (existingRequest.length === 2) {
      // Request exists as [x, y] - append current timeslot to make [x, y, t]
      const [x, y] = existingRequest
      newRequest = [x, y, timeslot]
    } else {
      // Invalid request state - cannot solicit
      this.setAccumulateError(registers, 'HUH')
      logger.error('SOLICIT host function HUH: invalid request state', {
        serviceId: imX.id.toString(),
        hashHex,
        existingRequest,
      })
      return {
        resultCode: null, // continue execution
      }
    }

    // Track if this is a new request (affects items/octets)
    const isNewRequest = !existingRequest

    // Calculate new items and octets if this is a new request
    // Gray Paper: items += 2 for each new request (h, z)
    // Gray Paper: octets += (81 + z) for each new request
    const newItems = isNewRequest
      ? serviceAccount.items + 2n
      : serviceAccount.items
    const newOctets = isNewRequest
      ? serviceAccount.octets + 81n + preimageLength
      : serviceAccount.octets

    // Calculate new minimum balance
    // Gray Paper: a_minbalance = max(0, Cbasedeposit + Citemdeposit * a_items + Cbytedeposit * a_octets - a_gratis)
    const newMinBalance = calculateMinBalance(
      newItems,
      newOctets,
      serviceAccount.gratis,
    )

    // Check if service has sufficient balance for the new request
    // Gray Paper: If newMinBalance > balance, return FULL error
    if (newMinBalance > serviceAccount.balance) {
      this.setAccumulateError(registers, 'FULL')
      return {
        resultCode: null, // continue execution
      }
    }

    // Update the service account with the new request
    setServiceRequestValue(
      serviceAccount,
      imX.id,
      hashHex,
      preimageLength,
      newRequest,
    )

    // Update items and octets if this is a new request
    if (isNewRequest) {
      serviceAccount.items = newItems
      serviceAccount.octets = newOctets
    }

    // Set success result
    this.setAccumulateSuccess(registers)

    // Log in the requested format: [host-calls] [serviceId] SOLICIT(0xhash, preimageLength) <- OK
    const logServiceId = imX.id
    logger.info(
      `[host-calls] [${logServiceId}] SOLICIT(0x${hashHex}, ${preimageLength}) <- OK`,
    )

    return {
      resultCode: null, // continue execution
    }
  }

  /**
   * Calculate minimum balance based on items and octets
   * Gray Paper: a_minbalance = max(0, Cbasedeposit + Citemdeposit * a_items + Cbytedeposit * a_octets - a_gratis)
   */
}
