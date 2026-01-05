import { HostFunctionResult } from '../accumulate/base'
import {
  HostFunctionContext,
  HostFunctionParams,
  LookupParams,
} from './base'
import { CompleteServiceAccount } from '../../codec'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  RESULT_CODES,
} from '../../config'
import { BaseHostFunction } from './base'

/**
 * LOOKUP host function (Ω_L)
 *
 * Looks up preimages from service account storage
 *
 * Gray Paper Specification (pvm_invocations.tex lines 374-396):
 * - Function ID: 2 (lookup)
 * - Gas Cost: 10
 * - Signature: Ω_L(gascounter, registers, memory, s, s, d)
 *   - s = current service account
 *   - s = current service ID
 *   - d = accounts dictionary
 *
 * Service account selection (a):
 *   a = s (current service)       when registers[7] ∈ {s, 2^64 - 1}
 *   a = d[registers[7]]           when registers[7] ∈ keys{d}
 *   a = none                      otherwise
 *
 * Register usage:
 *   registers[7] = service ID to query (or s/2^64-1 for self)
 *   registers[8] = hash offset (h) - 32 bytes to read from memory
 *   registers[9] = output offset (o) - where to write result
 *   registers[10] = from offset (f) in preimage
 *   registers[11] = length (l) to copy
 *
 * Value lookup (v):
 *   v = error  when hash memory not readable
 *   v = none   when a = none OR memory[h:32] ∉ keys{a.preimages}
 *   v = a.preimages[memory[h:32]] otherwise
 *
 * Slice parameters:
 *   f = min(registers[10], len{v})
 *   l = min(registers[11], len{v} - f)
 *
 * Result:
 *   - PANIC if v = error OR output memory not writable
 *   - registers[7] = NONE if v = none
 *   - registers[7] = len{v}, memory[o:l] = v[f:l] otherwise
 *
 * NOTE: LOOKUP is READ-ONLY - it does NOT modify service accounts!
 */

export class LookupHostFunction extends BaseHostFunction {
  functionId: u64 = GENERAL_FUNCTIONS.LOOKUP
  name: string = 'lookup'

  execute(
    context: HostFunctionContext,
    params: HostFunctionParams | null,
  ): HostFunctionResult {
    if (!params) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }
    const lookupParams = params as LookupParams
    const queryServiceId = context.registers[7]
    const hashOffset = context.registers[8]
    const outputOffset = context.registers[9]
    const fromOffset = context.registers[10]
    const length = context.registers[11]

    // Gray Paper: a = service account to query
    // a = s (self)       when registers_7 ∈ {s, 2^64 - 1}
    // a = d[registers_7] when registers_7 ∈ keys{d}
    // a = none           otherwise
    const MAX_U64: u64 = u64.MAX_VALUE // 2^64 - 1

    let serviceAccount: CompleteServiceAccount | null = null

    if (
      queryServiceId == lookupParams.serviceId ||
      queryServiceId == MAX_U64
    ) {
      // Query self
      if (lookupParams.accounts.has(lookupParams.serviceId)) {
        serviceAccount = lookupParams.accounts.get(lookupParams.serviceId)
      }
    } else if (lookupParams.accounts.has(queryServiceId)) {
      // Query another service from accounts dictionary
      serviceAccount = lookupParams.accounts.get(queryServiceId)
    }
    // else: serviceAccount remains null (a = none)

    // Read hash from memory (32 bytes)
    // Gray Paper: v = error when N[h,32] ⊄ readable{memory}
    const readResult_hashData = context.ram.readOctets(u32(hashOffset), 32)
    const hashData = readResult_hashData.data
    const hashFaultAddress = readResult_hashData.faultAddress
    if (hashData === null || hashFaultAddress !== 0) {
      // v = error - memory not readable
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }

    // Gray Paper: v = none when a = none ∨ memory[h:32] ∉ keys{a.preimages}
    if (serviceAccount === null) {
      // a = none - service account not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return new HostFunctionResult(255) // continue execution
    }

    // Look up preimage by hash
    const preimage = serviceAccount.preimages.get(hashData)
    if (!preimage) {
      // v = none - preimage not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return new HostFunctionResult(255) // continue execution
    }

    // v found - calculate slice parameters
    // Gray Paper: f = min(registers[10], len{v})
    //             l = min(registers[11], len{v} - f)
    const preimageLength = preimage.length
    const f: i32 = fromOffset < u64(preimageLength)
      ? i32(fromOffset)
      : preimageLength
    const remainingAfterF: i32 = preimageLength - f
    const l: i32 = length < u64(remainingAfterF)
      ? i32(length)
      : remainingAfterF

    // Only write if there's data to write
    if (l > 0) {
    // Extract data slice
      const dataToWrite = preimage.slice(f, f + l)

    // Write preimage slice to memory
      // Gray Paper: PANIC if N[o,l] ⊄ writable{memory}
    const writeResult = context.ram.writeOctets(u32(outputOffset), dataToWrite)
    if (writeResult.hasFault) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
      }
    }

    // Gray Paper: Return len{v} (full preimage length, not slice length)
    context.registers[7] = u64(preimageLength)

    return new HostFunctionResult(255) // continue execution
  }
}
