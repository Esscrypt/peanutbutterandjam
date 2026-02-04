import { CompleteServiceAccount } from '../../codec'
import { HostFunctionResult } from '../accumulate/base'
import { HostFunctionContext, HostFunctionParams, InfoParams } from './base'
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
  functionId: u64 = GENERAL_FUNCTIONS.INFO
  name: string = 'info'

  execute(
    context: HostFunctionContext,
    params: HostFunctionParams | null,
  ): HostFunctionResult {
    if (!params) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }
    const infoParams = params as InfoParams
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
    let serviceAccount: CompleteServiceAccount | null = null
    if (requestedServiceId === ACCUMULATE_ERROR_CODES.NONE) {
      // registers[7] = NONE, use self (s)
      serviceAccount = infoParams.accounts.get(infoParams.serviceId) || null
    } else if (infoParams.accounts.has(requestedServiceId)) {
      // registers[7] specifies a service ID in accounts
      serviceAccount = infoParams.accounts.get(requestedServiceId) || null
    }

    if (!serviceAccount) {
      // Gray Paper: Return NONE if service account not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return new HostFunctionResult(255) // continue execution
    }

    // Gray Paper equation 466-473: Encode service account info for INFO host function
    // INFO uses a different format than merklization (pvm_invocations.tex vs merklization.tex)
    // Format: codehash + encode[8]{balance, minbalance, minaccgas, minmemogas, octets} +
    //         encode[4]{items} + encode[8]{gratis} + encode[4]{created, lastacc, parent}
    // Total: 32 + 40 + 4 + 8 + 12 = 96 bytes

    // Calculate minbalance: max(0, Cbasedeposit + Citemdeposit * items + Cbytedeposit * octets - gratis)
    const C_BASEDEPOSIT: u64 = u64(100)
    const C_ITEMDEPOSIT: u64 = u64(10)
    const C_BYTEDEPOSIT: u64 = u64(1)
    const baseDeposit = C_BASEDEPOSIT
    const itemDeposit = C_ITEMDEPOSIT * serviceAccount.items
    const byteDeposit = C_BYTEDEPOSIT * serviceAccount.octets
    const totalDeposit = baseDeposit + itemDeposit + byteDeposit
    const minbalance =
      totalDeposit > serviceAccount.gratis
        ? totalDeposit - serviceAccount.gratis
        : u64(0)

    // Encode using INFO-specific format (96 bytes, includes minbalance)
    // Gray Paper pvm_invocations.tex format (NOT merklization format)
    const info = new Uint8Array(96) // Total: 32 + 40 + 4 + 8 + 12 = 96 bytes
    const view = new DataView(info.buffer)

    // 1. codehash (32 bytes)
    // codehash is already a Uint8Array in CompleteServiceAccount
    info.set(serviceAccount.codehash, 0)

    // 2. encode[8]{balance, minbalance, minaccgas, minmemogas, octets} (40 bytes)
    view.setUint64(32, serviceAccount.balance, true) // balance at offset 32
    view.setUint64(40, minbalance, true) // minbalance at offset 40
    view.setUint64(48, serviceAccount.minaccgas, true) // minaccgas at offset 48
    view.setUint64(56, serviceAccount.minmemogas, true) // minmemogas at offset 56
    view.setUint64(64, serviceAccount.octets, true) // octets at offset 64

    // 3. encode[4]{items} (4 bytes)
    view.setUint32(72, serviceAccount.items, true) // items at offset 72

    // 4. encode[8]{gratis} (8 bytes)
    view.setUint64(76, serviceAccount.gratis, true) // gratis at offset 76

    // 5. encode[4]{created, lastacc, parent} (12 bytes)
    view.setUint32(84, serviceAccount.created, true) // created at offset 84
    view.setUint32(88, serviceAccount.lastacc, true) // lastacc at offset 88
    view.setUint32(92, serviceAccount.parent, true) // parent at offset 92

    // Gray Paper equation 475-476: Calculate slice parameters
    // f = min(registers[9], len(v))
    // l = min(registers[10], len(v) - f)
    const f = min(i32(fromOffset), info.length)
    const l = min(i32(length), info.length - f)

    if (l <= 0) {
      // Return NONE if no data to copy
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return new HostFunctionResult(255) // continue execution
    }

    // Gray Paper equation 480: Extract slice v[f:f+l]
    const dataSlice = info.slice(f, f + l)
    
    // Pad to requested length if needed (to match reference behavior)
    // Gray Paper equation 478: Write to memory[o:o+l]
    // Note: l is the actual slice length, but if requested length > actual length,
    // reference pads with zeros to the requested length
    const requestedWriteLength = i32(length)
    let dataToWrite: Uint8Array
    if (requestedWriteLength > dataSlice.length) {
      // Pad with zeros to requested length
      dataToWrite = new Uint8Array(requestedWriteLength)
      for (let i = 0; i < dataSlice.length; i++) {
        dataToWrite[i] = dataSlice[i]
      }
      // Remaining bytes are already zero (default Uint8Array initialization)
    } else {
      dataToWrite = dataSlice
    }

    // Gray Paper equation 478: Write to memory[o:o+l]
    const writeResult = context.ram.writeOctets(u32(outputOffset), dataToWrite)
    if (writeResult.hasFault) {
      // Gray Paper: Return panic if memory not writable
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }

    // Gray Paper equation 480: Return length of full info data (v)
    // Like FETCH, INFO returns len(v) = 96 (the full info length), not the written slice length
    context.registers[7] = u64(info.length)

    return new HostFunctionResult(255) // continue execution
  }
}
