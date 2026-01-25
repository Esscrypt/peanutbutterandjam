import { bytesToHex, logger } from '@pbnjam/core'
import type {
  HistoricalLookupParams,
  HostFunctionContext,
  HostFunctionResult,
  IServiceAccountService,
  ServiceAccount,
} from '@pbnjam/types'
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
  private readonly serviceAccountService: IServiceAccountService

  constructor(serviceAccountService: IServiceAccountService) {
    super()
    this.serviceAccountService = serviceAccountService
  }

  execute(
    context: HostFunctionContext,
    params: HistoricalLookupParams,
  ): HostFunctionResult {
    // Gray Paper: Extract parameters from registers
    // registers[7] = service ID selector (NONE for self, or specific service ID)
    // registers[8:2] = (hash offset, output offset)
    // registers[10:2] = (from offset, length)
    const requestedServiceId = context.registers[7]
    const hashOffset = context.registers[8]
    const outputOffset = context.registers[9]
    const fromOffset = context.registers[10]
    const length = context.registers[11]

    // Gray Paper equation 508-511: Determine service account
    // a = {
    //   d[s] if registers[7] = NONE (2^64 - 1) AND s in keys(d)
    //   d[registers[7]] if registers[7] in keys(d)
    //   none otherwise
    // }
    let serviceAccount: ServiceAccount | null = null
    if (
      requestedServiceId === ACCUMULATE_ERROR_CODES.NONE &&
      params.accounts.has(params.serviceId)
    ) {
      // registers[7] = NONE, use self (s)
      serviceAccount = params.accounts.get(params.serviceId) ?? null
    } else if (params.accounts.has(requestedServiceId)) {
      // registers[7] specifies a service ID in accounts
      serviceAccount = params.accounts.get(requestedServiceId) ?? null
    }

    if (!serviceAccount) {
      // Gray Paper: Return NONE if service account not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return {
        resultCode: null, // continue execution
      }
    }

    // Gray Paper: Read hash from memory (32 bytes at hashOffset)
    const [hashData, readFaultAddress] = context.ram.readOctets(hashOffset, 32n)
    if (hashData === null) {
      logger.error('HistoricalLookupHostFunction: Memory range not readable', {
        hashOffset: hashOffset.toString(),
        readFaultAddress: readFaultAddress?.toString() ?? 'null',
      })
      // Gray Paper: Return panic if memory range not readable
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_read',
          address: readFaultAddress ?? 0n,
          details: 'Memory range not readable',
        },
      }
    }

    // Gray Paper equation 517: histlookup(a, t, memory[h:32])
    // Perform historical lookup using histlookup function
    // We use the service account we determined from the lookup logic
    const [lookupError, preimage] =
      this.serviceAccountService.histLookupServiceAccount(
        params.serviceId,
        serviceAccount,
        bytesToHex(hashData),
        params.timeslot,
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

    // Log in the requested format: [host-calls] [serviceId] HISTORICAL_LOOKUP(serviceId, 0xhash, timeslot) <- (length bytes)
    const serviceId = context.serviceId ?? params.serviceId
    const hashHex = bytesToHex(hashData)
    logger.info(
      `[host-calls] [${serviceId}] HISTORICAL_LOOKUP(${serviceId}, 0x${hashHex}, ${params.timeslot}) <- (${dataToWrite.length} bytes)`,
    )

    return {
      resultCode: null, // continue execution
    }
  }
}
