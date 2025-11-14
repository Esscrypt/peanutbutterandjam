import { bytesToHex } from '@pbnj/core'
import type {
  HostFunctionContext,
  HostFunctionResult,
  IServiceAccountService,
  RefineInvocationContext,
  ServiceAccount,
} from '@pbnj/types'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  RESULT_CODES,
} from '../../config'
import { BaseHostFunction } from './base'

/**
 * HISTORICAL_LOOKUP host function (Ω_H)
 *
 * Performs historical lookup of preimages using histlookup function
 *
 * Gray Paper Specification:
 * - Function ID: 6 (historical_lookup)
 * - Gas Cost: 10
 * - Signature: Ω_H(gascounter, registers, memory, (m, e), s, d, t)
 *   - (m, e) = refine context (machines, export segments)
 *   - s = current service ID
 *   - d = accounts dictionary
 *   - t = timeslot for historical lookup
 * - Uses registers[7] to specify service account (NONE for self)
 * - Uses registers[8:2] to specify hash and output offset in memory
 * - Uses registers[10:2] to specify from offset and length
 * - Uses histlookup(serviceAccount, timeslot, hash) to get historical data
 * - Writes result to memory at specified offset
 * - Returns NONE if not found, length if found
 *
 * Gray Paper Logic:
 * a = service account (self if registers[7] = NONE, otherwise accounts[registers[7]])
 * h = memory[registers[8]:32] (hash)
 * o = registers[9] (output offset)
 * f = registers[10] (from offset)
 * l = registers[11] (length)
 * v = histlookup(a, t, h) if a exists, NONE otherwise
 * if v != NONE: write v[f:f+l] to memory[o:o+l], return len(v)
 * else: return NONE
 */
export class HistoricalLookupHostFunction extends BaseHostFunction {
  readonly functionId = GENERAL_FUNCTIONS.HISTORICAL_LOOKUP
  readonly name = 'historical_lookup'
  readonly gasCost = 10n

  private readonly serviceAccountService: IServiceAccountService

  constructor(serviceAccountService: IServiceAccountService) {
    super()
    this.serviceAccountService = serviceAccountService
  }

  execute(
    context: HostFunctionContext,
    refineContext: RefineInvocationContext | null,
  ): HostFunctionResult {
    const serviceId = context.registers[7]
    const hashOffset = context.registers[8]
    const outputOffset = context.registers[9]
    const fromOffset = context.registers[10]
    const length = context.registers[11]

    // Check if refine context is available
    if (!refineContext) {
      // If no refine context available, return WHO
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Read hash from memory (32 bytes)
    const [hashData, readFaultAddress] = context.ram.readOctets(hashOffset, 32n)
    if (hashData === null) {
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_read',
          address: readFaultAddress ?? 0n,
          details: 'Failed to read memory',
        },
      }
    }

    // Get service account
    const serviceAccount = this.getServiceAccount(refineContext, serviceId)
    if (!serviceAccount) {
      // Return NONE (2^64 - 1) for not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return {
        resultCode: null, // continue execution
      }
    }

    // Get lookup time from refine context
    const lookupTime = this.getLookupTime(refineContext)

    // Perform historical lookup using histlookup function
    const [lookupError, preimage] =
      this.serviceAccountService.histLookupForService(
        serviceId,
        bytesToHex(hashData),
        lookupTime,
      )
    if (lookupError || !preimage) {
      // Return NONE (2^64 - 1) for not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return {
        resultCode: null, // continue execution
      }
    }

    // Calculate slice parameters
    const f = Number(fromOffset)
    const l = Number(length)
    const preimageLength = preimage.length

    // Calculate actual slice length
    const actualLength = Math.min(l, preimageLength - f)

    if (actualLength <= 0) {
      // Return NONE if no data to copy
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return {
        resultCode: null, // continue execution
      }
    }

    // Extract data slice
    const dataToWrite = preimage.slice(f, f + actualLength)

    // Write preimage slice to memory
    const faultAddress = context.ram.writeOctets(outputOffset, dataToWrite)
    if (faultAddress) {
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_write',
          address: faultAddress,
          details: 'Failed to write memory',
        },
      }
    }

    // Return length of preimage
    context.registers[7] = BigInt(preimageLength)

    return {
      resultCode: null, // continue execution
    }
  }

  private getServiceAccount(
    refineContext: RefineInvocationContext,
    serviceId: bigint,
  ): ServiceAccount | null {
    // Gray Paper: Ω_H(gascounter, registers, memory, (m, e), s, d, t)
    // where s = current service ID, d = accounts dictionary

    // If registers[7] = NONE (2^64 - 1), use current service
    if (serviceId === ACCUMULATE_ERROR_CODES.NONE) {
      return (
        refineContext.accountsDictionary.get(refineContext.currentServiceId) ||
        null
      )
    }

    // Otherwise, lookup service by ID from accounts dictionary
    return refineContext.accountsDictionary.get(serviceId) || null
  }

  private getLookupTime(refineContext: RefineInvocationContext): bigint {
    // Gray Paper: Ω_H(gascounter, registers, memory, (m, e), s, d, t)
    // where t = timeslot for historical lookup
    return refineContext.lookupTimeslot
  }
}
