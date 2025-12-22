import { encodeServiceAccountForInfo } from '@pbnjam/codec'
import type {
  HostFunctionContext,
  HostFunctionResult,
  InfoParams,
  ServiceAccount,
  ServiceAccountCore,
} from '@pbnjam/types'
import { DEPOSIT_CONSTANTS } from '@pbnjam/types'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  RESULT_CODES,
} from '../../config'
import { BaseHostFunction } from './base'

/**
 * INFO host function (Ω_I)
 *
 * Gets information about service accounts
 *
 * Gray Paper Specification (pvm-invocations.tex line 193, 457-482):
 * - Function ID: 5 (info)
 * - Gas Cost: 10
 * - Signature: Ω_I(gascounter, registers, memory, s, d)
 *   - s = service ID (from Implications)
 *   - d = accounts dictionary (from PartialState)
 * - Uses registers[7] to specify service account (NONE for self, or specific service ID)
 * - Uses registers[8] for output offset (o)
 * - Uses registers[9] for from offset (f)
 * - Uses registers[10] for length (l)
 * - Returns encoded service account info (codehash, balance, gas limits, etc.)
 * - Writes result to memory at specified offset
 */

export class InfoHostFunction extends BaseHostFunction {
  readonly functionId = GENERAL_FUNCTIONS.INFO
  readonly name = 'info'
  readonly gasCost = 10n

  execute(
    context: HostFunctionContext,
    params: InfoParams,
  ): HostFunctionResult {
    // Gray Paper: Extract parameters from registers
    // registers[7] = service ID selector (NONE for self, or specific service ID)
    // registers[8] = output offset (o)
    // registers[9] = from offset (f)
    // registers[10] = length (l)
    const requestedServiceId = context.registers[7]
    const outputOffset = context.registers[8]
    const fromOffset = context.registers[9]
    const length = context.registers[10]

    // Gray Paper equation 460-463: Determine service account
    // a = {
    //   d[s] if registers[7] = NONE (2^64 - 1)
    //   d[registers[7]] otherwise
    // }
    let serviceAccount: ServiceAccount | null = null
    if (requestedServiceId === ACCUMULATE_ERROR_CODES.NONE) {
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

    // Gray Paper equation 466-473: Encode service account info for INFO host function
    // INFO uses a different format than merklization (pvm_invocations.tex vs merklization.tex)
    // Format: codehash + encode[8]{balance, minbalance, minaccgas, minmemogas, octets} +
    //         encode[4]{items} + encode[8]{gratis} + encode[4]{created, lastacc, parent}
    // Total: 32 + 40 + 4 + 8 + 12 = 96 bytes

    // Calculate minbalance: max(0, Cbasedeposit + Citemdeposit * items + Cbytedeposit * octets - gratis)
    const baseDeposit = BigInt(DEPOSIT_CONSTANTS.C_BASEDEPOSIT)
    const itemDeposit =
      BigInt(DEPOSIT_CONSTANTS.C_ITEMDEPOSIT) * serviceAccount.items
    const byteDeposit =
      BigInt(DEPOSIT_CONSTANTS.C_BYTEDEPOSIT) * serviceAccount.octets
    const totalDeposit = baseDeposit + itemDeposit + byteDeposit
    const minbalance =
      totalDeposit > serviceAccount.gratis
        ? totalDeposit - serviceAccount.gratis
        : 0n

    // Encode using INFO-specific format (96 bytes, includes minbalance)
    const [encodeError, info] = encodeServiceAccountForInfo(
      serviceAccount as ServiceAccountCore,
      minbalance,
    )
    if (encodeError || !info) {
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Gray Paper equation 475-476: Calculate slice parameters
    // f = min(registers[9], len(v))
    // l = min(registers[10], len(v) - f)
    const f = Math.min(Number(fromOffset), info.length)
    const l = Math.min(Number(length), info.length - f)

    if (l <= 0) {
      // Return NONE if no data to copy
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return {
        resultCode: null, // continue execution
      }
    }

    // Gray Paper equation 480: Extract slice v[f:f+l]
    const dataSlice = info.slice(f, f + l)

    // Pad to requested length if needed (to match jamduna behavior)
    // Gray Paper equation 478: Write to memory[o:o+l]
    // Note: l is the actual slice length, but if requested length > actual length,
    // jamduna pads with zeros to the requested length
    const requestedWriteLength = Number(length)
    let dataToWrite: Uint8Array
    if (requestedWriteLength > dataSlice.length) {
      // Pad with zeros to requested length
      dataToWrite = new Uint8Array(requestedWriteLength)
      dataToWrite.set(dataSlice, 0)
      // Remaining bytes are already zero (default Uint8Array initialization)
    } else {
      dataToWrite = dataSlice
    }

    const faultAddress = context.ram.writeOctets(outputOffset, dataToWrite)
    if (faultAddress) {
      // Gray Paper: Return panic if memory not writable
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_write',
          address: faultAddress,
          details: 'Memory not writable',
        },
      }
    }

    // Gray Paper equation 480: Return length of written data (requested length if padded)
    // Match jamduna behavior: return the length that was actually written
    context.registers[7] = BigInt(dataToWrite.length)

    return {
      resultCode: null, // continue execution
    }
  }
}
