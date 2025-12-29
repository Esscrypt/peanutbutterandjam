import { bytesToHex } from '@pbnjam/core'
import type {
  HostFunctionContext,
  HostFunctionResult,
  LookupParams,
  ServiceAccount,
} from '@pbnjam/types'
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
  readonly functionId = GENERAL_FUNCTIONS.LOOKUP
  readonly name = 'lookup'

  execute(
    context: HostFunctionContext,
    lookupParams: LookupParams,
  ): HostFunctionResult {
    const queryServiceId = context.registers[7]
    const hashOffset = context.registers[8]
    const outputOffset = context.registers[9]
    const fromOffset = context.registers[10]
    const length = context.registers[11]

    // Gray Paper: a = service account to query
    // a = s (self)       when registers_7 ∈ {s, 2^64 - 1}
    // a = d[registers_7] when registers_7 ∈ keys{d}
    // a = none           otherwise
    let serviceAccount: ServiceAccount | undefined

    const MAX_U64 = BigInt('0xFFFFFFFFFFFFFFFF') // 2^64 - 1

    if (
      queryServiceId === lookupParams.serviceId ||
      queryServiceId === MAX_U64
    ) {
      // Query self
      serviceAccount = lookupParams.accounts.get(lookupParams.serviceId)
    } else if (lookupParams.accounts.has(queryServiceId)) {
      // Query another service from accounts dictionary
      serviceAccount = lookupParams.accounts.get(queryServiceId)
    } else {
      // Service not found - a = none
      serviceAccount = undefined
    }

    // Read hash from memory (32 bytes)
    // Gray Paper: v = error when N[h,32] ⊄ readable{memory}
    const [hashData, readFaultAddress] = context.ram.readOctets(hashOffset, 32n)
    if (!hashData) {
      // v = error - memory not readable
      context.log('Lookup host function: Hash memory not readable', {
        hashOffset: hashOffset.toString(),
        faultAddress: readFaultAddress?.toString() ?? 'null',
      })
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_read',
          address: readFaultAddress ?? 0n,
          details: 'Hash memory not readable',
        },
      }
    }

    // Gray Paper: v = none when a = none ∨ memory[h:32] ∉ keys{a.preimages}
    if (!serviceAccount) {
      context.log(
        'Lookup host function: Service account not found (a = none)',
        {
          queryServiceId: queryServiceId.toString(),
          selfServiceId: lookupParams.serviceId.toString(),
        },
      )
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return {
        resultCode: null, // continue execution
      }
    }

    // Look up preimage by hash
    const hashHex = bytesToHex(hashData)
    const preimage = serviceAccount.preimages.get(hashHex)

    if (!preimage) {
      // v = none - preimage not found
      context.log('Lookup host function: Preimage not found', {
        hashHex,
        queryServiceId: queryServiceId.toString(),
        preimagesKeys: Array.from(serviceAccount.preimages.keys()).slice(0, 5),
      })
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      return {
        resultCode: null, // continue execution
      }
    }

    // v found - calculate slice parameters
    // Gray Paper: f = min(registers[10], len{v})
    //             l = min(registers[11], len{v} - f)
    const preimageLength = BigInt(preimage.length)
    const f = fromOffset < preimageLength ? Number(fromOffset) : preimage.length
    const remainingAfterF = preimage.length - f
    const l =
      length < BigInt(remainingAfterF) ? Number(length) : remainingAfterF

    // Only write if there's data to write
    if (l > 0) {
      // Extract data slice
      const dataToWrite = preimage.subarray(f, f + l)

      // Write preimage slice to memory
      // Gray Paper: PANIC if N[o,l] ⊄ writable{memory}
      const writeFaultAddress = context.ram.writeOctets(
        outputOffset,
        dataToWrite,
      )
      if (writeFaultAddress) {
        context.log('Lookup host function: Output memory not writable', {
          outputOffset: outputOffset.toString(),
          length: l.toString(),
          faultAddress: writeFaultAddress.toString(),
        })
        return {
          resultCode: RESULT_CODES.PANIC,
          faultInfo: {
            type: 'memory_write',
            address: writeFaultAddress,
            details: 'Output memory not writable',
          },
        }
      }
    }

    // Gray Paper: Return len{v} (full preimage length, not slice length)
    context.registers[7] = preimageLength

    context.log('Lookup host function: Success', {
      queryServiceId: queryServiceId.toString(),
      hashHex,
      preimageLength: preimageLength.toString(),
      f,
      l,
    })

    return {
      resultCode: null, // continue execution
    }
  }
}
