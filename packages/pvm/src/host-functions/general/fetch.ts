import {
  encodeAccumulateInput,
  encodeRefineContext,
  encodeVariableSequence,
  encodeWorkItemSummary,
  encodeWorkPackage,
} from '@pbnjam/codec'
import { bytesToHex, hexToBytes, logger } from '@pbnjam/core'
import type {
  FetchParams,
  HostFunctionContext,
  HostFunctionResult,
  IConfigService,
} from '@pbnjam/types'
import {
  AUTHORIZATION_CONSTANTS,
  DEPOSIT_CONSTANTS,
  HISTORY_CONSTANTS,
  SERVICE_CONSTANTS,
  TIME_CONSTANTS,
  TRANSFER_CONSTANTS,
  WORK_PACKAGE_CONSTANTS,
  WORK_REPORT_CONSTANTS,
} from '@pbnjam/types'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  RESULT_CODES,
} from '../../config'
import { BaseHostFunction } from './base'

/**
 * FETCH host function (Ω_Y)
 *
 * Fetches various system constants and data
 *
 * Gray Paper Specification:
 * - Function ID: 1 (fetch)
 * - Gas Cost: 10
 * - Uses registers[10] as selector to determine what to fetch
 * - Can return system constants, work package data, import/export segments, etc.
 * - Writes fetched data to memory at registers[7] offset
 * - Returns length of fetched data in registers[7]
 */

export class FetchHostFunction extends BaseHostFunction {
  readonly functionId = GENERAL_FUNCTIONS.FETCH
  readonly name = 'fetch'

  private readonly configService: IConfigService
  constructor(configService: IConfigService) {
    super()
    this.configService = configService
  }

  execute(
    context: HostFunctionContext,
    params: FetchParams,
  ): HostFunctionResult {
    const selector = context.registers[10] & 0xffffffffn
    const outputOffset = context.registers[7] // memory offset to write the data to
    const fromOffset = context.registers[8] // start offset in the fetched data
    const length = context.registers[9] // number of bytes to write to memory

    // Fetch data based on selector according to Gray Paper specification
    // Note: We always fetch to determine available length, even if requested length is 0
    const fetchedData = this.fetchData(selector, context, params)

    // Write result to memory
    if (fetchedData === null) {
      // Return NONE (2^64 - 1) for not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
      // Log when data not found
      const logId = context.serviceId ?? context.gasCounter
      logger.info(`[host-calls] [${logId}] FETCH(${selector}) <- null`)
    } else {
      // Write data to memory
      // Gray Paper: f = min(registers_8, len(v)), l = min(registers_9, len(v) - f)
      // Note: When length = 0, it means "all available data" (common API pattern)
      // First clamp fromOffset to available data length
      const clampedFromOffset = Math.min(Number(fromOffset), fetchedData.length)
      // Then calculate available length after fromOffset
      const availableLength = fetchedData.length - clampedFromOffset
      // Finally clamp requested length to available data
      // Gray Paper: l = min(registers_9, len(v) - f)
      // When registers_9 = 0, l = 0 (write nothing, just return length in r7)
      const actualLength = Math.min(Number(length), availableLength)
      const dataToWrite = fetchedData.slice(
        clampedFromOffset,
        clampedFromOffset + actualLength,
      )

      // Gray Paper: Empty range (length = 0) is always writable
      // An empty set is a subset of any set, so \Nrange{o}{0} ⊆ \writable{\memory} is always true
      if (dataToWrite.length > 0) {
        // Write data (may be empty if length was 0 or fromOffset beyond data)
        const faultAddress = context.ram.writeOctets(outputOffset, dataToWrite)
        if (faultAddress) {
          logger.warn('Fetch host function: Memory write fault', {
            selector: selector.toString(),
            outputOffset: outputOffset.toString(),
            faultAddress: faultAddress.toString(),
          })
          return {
            resultCode: RESULT_CODES.PANIC,
            faultInfo: {
              type: 'memory_write',
              address: faultAddress,
              details: 'Memory is not writable',
            },
          }
        }
      }

      // Return length of fetched data
      context.registers[7] = BigInt(fetchedData.length)

      // Log in the requested format: TRACE [host-calls] [ID] FETCH(selector) <- hex_data (bytes)
      const hexData = bytesToHex(fetchedData)
      // Truncate if longer than 128 hex chars (64 bytes), showing first and last 64 hex chars
      const truncatedHex =
        hexData.length > 128
          ? `${hexData.slice(0, 64)}...${hexData.slice(-64)}`
          : hexData
      const logId = context.serviceId ?? context.gasCounter
      logger.info(
        `[host-calls] [${logId}] FETCH(${selector}) <- ${truncatedHex} (${fetchedData.length} bytes)`,
      )
    }

    return {
      resultCode: null, // continue execution
    }
  }

  private fetchData(
    selector: bigint,
    context: HostFunctionContext,
    params: FetchParams,
  ): Uint8Array | null {
    // Gray Paper: Ω_Y(gascounter, registers, memory, p, n, r, i, ī, x̄, i, ...)
    // where p = work package, n = work package hash, r = authorizer trace,
    // i = work item index, ī = import segments, x̄ = export segments

    switch (selector) {
      case 0n:
        // Gray Paper pvm_invocations.tex line 307-344: registers[10] = 0
        // Returns: c (system constants)
        // Encoded sequence of all system constants: Citemdeposit, Cbytedeposit, Cbasedeposit,
        // Ccorecount, Cexpungeperiod, Cepochlen, Creportaccgas, Cpackageauthgas, Cpackagerefgas,
        // Cblockaccgas, Crecenthistorylen, Cmaxpackageitems, Cmaxreportdeps, Cmaxblocktickets,
        // Cmaxlookupanchorage, Cticketentries, Cauthpoolsize, Cslotseconds, Cauthqueuesize,
        // Crotationperiod, Cmaxpackagexts, Cassurancetimeoutperiod, Cvalcount, Cmaxauthcodesize,
        // Cmaxbundlesize, Cmaxservicecodesize, Cecpiecesize, Cmaxpackageimports, Csegmentecpieces,
        // Cmaxreportvarsize, Cmemosize, Cmaxpackageexports, Cepochtailstart
        return this.getSystemConstants()

      case 1n:
        // Gray Paper pvm_invocations.tex line 345: registers[10] = 1
        // Returns: n when n ≠ none
        // In accumulate invocation (line 189): n = entropyaccumulator' (entropy accumulator)
        // In refine invocation (line 96): n = zerohash (work package hash, but set to zero/none)
        // In is-authorized invocation (line 49): n = none (not available)
        return params.entropyService.getEntropyAccumulator()

      case 2n: {
        // Gray Paper pvm_invocations.tex line 346: registers[10] = 2
        // Returns: r (authorizer trace) when r ≠ none
        // The authorizer trace parameter passed to Ω_Y
        if (!params?.authorizerTrace) {
          return null
        }
        return hexToBytes(params.authorizerTrace)
      }
      case 3n: {
        const workItemIndex = context.registers[11]
        const extrinsicIndex = context.registers[12]
        return (
          params.exportSegments?.[Number(workItemIndex)]?.[
            Number(extrinsicIndex)
          ] ?? null
        )
      }

      case 4n: {
        // Gray Paper pvm_invocations.tex line 348: registers[10] = 4
        // Returns: x̄[i][registers[11]] when x̄ ≠ none ∧ i ≠ none
        // Export segments/extrinsics by work item: x̄[i] is the sequence for work item i,
        // accessed at index registers[11]. Requires: registers[11] < len(x̄[i])
        if (!params.exportSegments || params.workItemIndex === null) {
          return null
        }
        const workItemIdx = Number(params.workItemIndex)
        const segmentIdx = Number(context.registers[11])
        return params.exportSegments[workItemIdx]?.[segmentIdx] ?? null
      }
      case 5n: {
        // Gray Paper pvm_invocations.tex line 349: registers[10] = 5
        // Returns: ī[registers[11]][registers[12]] when ī ≠ none
        // Import segments: ī is a nested sequence, accessed by flat index registers[11]
        // and sub-index registers[12]. Requires: registers[11] < len(ī) and registers[12] < len(ī[registers[11]])
        const workItemIndex = context.registers[11]
        const importIndex = context.registers[12]
        return (
          params.importSegments?.[Number(workItemIndex)]?.[
            Number(importIndex)
          ] ?? null
        )
      }
      case 6n: {
        // Gray Paper pvm_invocations.tex line 350: registers[10] = 6
        // Returns: ī[i][registers[11]] when ī ≠ none ∧ i ≠ none
        // Import segments by work item: ī[i] is the sequence for work item i,
        // accessed at index registers[11]. Requires: registers[11] < len(ī[i])
        if (!params.importSegments || params.workItemIndex === null) {
          return null
        }
        const workItemIdx = Number(params.workItemIndex)
        const segmentIdx = Number(context.registers[11])
        return params.importSegments[workItemIdx]?.[segmentIdx] ?? null
      }

      case 7n: {
        if (!params.workPackage) {
          return null
        }
        const [error, encoded] = encodeWorkPackage(params.workPackage)
        if (error || !encoded) {
          return null
        }
        return encoded
      }

      case 8n: {
        // Gray Paper pvm_invocations.tex line 352: registers[10] = 8
        // Returns: p.authconfig when p ≠ none
        // Work package authorization configuration blob
        if (!params.workPackage) {
          return null
        }
        return hexToBytes(params.workPackage.authConfig)
      }

      case 9n:
        // Gray Paper pvm_invocations.tex line 353: registers[10] = 9
        // Returns: p.authtoken when p ≠ none
        // Work package authorization token blob
        if (!params.workPackage) {
          return null
        }
        return hexToBytes(params.workPackage.authToken)

      case 10n: {
        // Gray Paper pvm_invocations.tex line 354: registers[10] = 10
        // Returns: encode(p.context) when p ≠ none
        // Encoded work package context
        if (!params.workPackage) {
          return null
        }
        const [error, encoded] = encodeRefineContext(params.workPackage.context)
        if (error || !encoded) {
          return null
        }
        return encoded
      }

      case 11n: {
        // Gray Paper pvm_invocations.tex line 355: registers[10] = 11
        // Returns: encode({S(w) | w ∈ p.workitems}) when p ≠ none
        // Encoded sequence of work item summaries S(w) for all work items in p.workitems
        // S(w) = encode{encode[4]{w.serviceindex}, w.codehash, encode[8]{w.refgaslimit, w.accgaslimit},
        // encode[2]{w.exportcount, len(w.importsegments), len(w.extrinsics)}, encode[4]{len(w.payload)}}
        if (!params.workPackage) {
          return null
        }
        const [error, encoded] = encodeVariableSequence(
          params.workPackage.workItems,
          encodeWorkItemSummary,
        )
        if (error || !encoded) {
          return null
        }
        return encoded
      }

      case 12n: {
        // Gray Paper pvm_invocations.tex line 356-357: registers[10] = 12
        // Returns: S(p.workitems[registers[11]]) when p ≠ none ∧ registers[11] < len(p.workitems)
        // Work item summary S(w) for work item at index registers[11]
        // S(w) = encode{encode[4]{w.serviceindex}, w.codehash, encode[8]{w.refgaslimit, w.accgaslimit},
        // encode[2]{w.exportcount, len(w.importsegments), len(w.extrinsics)}, encode[4]{len(w.payload)}}
        if (!params.workPackage) {
          return null
        }
        const workItems = params.workPackage.workItems
        const itemIdx = Number(context.registers[11])
        if (itemIdx >= workItems.length) {
          return null
        }
        const workItem = workItems[itemIdx]
        const [error, encoded] = encodeWorkItemSummary(workItem)
        if (error || !encoded) {
          return null
        }
        return encoded
      }
      case 13n: {
        // Gray Paper pvm_invocations.tex line 358: registers[10] = 13
        // Returns: p.workitems[registers[11]].payload when p ≠ none ∧ registers[11] < len(p.workitems)
        // Payload blob of work item at index registers[11]
        return this.getWorkItemPayload(params, context.registers[11])
      }

      case 14n: {
        // Gray Paper pvm_invocations.tex line 359: registers[10] = 14
        // Returns: encode{var{i}} when i ≠ none
        // Where i is sequence{accinput} - the accumulate inputs sequence
        // Gray Paper equation 126: accinput = operandtuple ∪ defxfer
        // Gray Paper equations 289-292: encode(AccumulateInput) format
        if (!params.accumulateInputs) {
          return null
        }

        // Get JAM version from config service for version-specific encoding
        const jamVersion = this.configService.jamVersion
        const [error, encoded] = encodeVariableSequence(
          params.accumulateInputs,
          (input) => encodeAccumulateInput(input, jamVersion),
        )
        if (error || !encoded) {
          return null
        }
        // encodeVariableSequence always returns a Uint8Array (even for empty sequence, it's length prefix 0x00)
        return encoded
      }

      case 15n: {
        // Gray Paper pvm_invocations.tex line 360: registers[10] = 15
        // Returns: encode{i[registers[11]]} when i ≠ none ∧ registers[11] < len(i)
        // Encoded single AccumulateInput at index registers[11] from i sequence
        return this.getAccumulateInputByIndex(params, context.registers[11])
      }
      default:
        // Unknown selector - return NONE
        return null
    }
  }

  private getSystemConstants(): Uint8Array {
    // Gray Paper: System constants encoded as per specification
    // encode[8]{Citemdeposit}, encode[8]{Cbytedeposit}, encode[8]{Cbasedeposit},
    // encode[2]{Ccorecount}, encode[4]{Cexpungeperiod}, encode[4]{Cepochlen},
    // encode[8]{Creportaccgas}, encode[8]{Cpackageauthgas}, encode[8]{Cpackagerefgas},
    // encode[8]{Cblockaccgas}, encode[2]{Crecenthistorylen}, encode[2]{Cmaxpackageitems},
    // encode[2]{Cmaxreportdeps}, encode[2]{Cmaxblocktickets}, encode[4]{Cmaxlookupanchorage},
    // encode[2]{Cticketentries}, encode[2]{Cauthpoolsize}, encode[2]{Cslotseconds},
    // encode[2]{Cauthqueuesize}, encode[2]{Crotationperiod}, encode[2]{Cmaxpackagexts},
    // encode[2]{Cassurancetimeoutperiod}, encode[2]{Cvalcount}, encode[4]{Cmaxauthcodesize},
    // encode[4]{Cmaxbundlesize}, encode[4]{Cmaxservicecodesize}, encode[4]{Cecpiecesize},
    // encode[4]{Cmaxpackageimports}, encode[4]{Csegmentecpieces}, encode[4]{Cmaxreportvarsize},
    // encode[4]{Cmemosize}, encode[4]{Cmaxpackageexports}, encode[4]{Cepochtailstart}

    const buffer = new ArrayBuffer(134) // Total size: 8+8+8+2+4+4+8+8+8+8+2+2+2+2+4+2+2+2+2+2+2+2+2+4+4+4+4+4+4+4+4+4+4+4 = 134 bytes (per Gray Paper pvm_invocations.tex lines 308-343)
    const view = new DataView(buffer)
    let offset = 0

    // encode[8]{Citemdeposit = 10}
    // Use little-endian to match AssemblyScript implementation
    view.setBigUint64(offset, BigInt(DEPOSIT_CONSTANTS.C_ITEMDEPOSIT), true)
    offset += 8

    // encode[8]{Cbytedeposit = 1}
    view.setBigUint64(offset, BigInt(DEPOSIT_CONSTANTS.C_BYTEDEPOSIT), true)
    offset += 8

    // encode[8]{Cbasedeposit = 100}
    view.setBigUint64(offset, BigInt(DEPOSIT_CONSTANTS.C_BASEDEPOSIT), true)
    offset += 8

    // encode[2]{Ccorecount = 341}
    view.setUint16(offset, this.configService.numCores, true)
    offset += 2

    // encode[4]{Cexpungeperiod = 19200}
    view.setUint32(offset, this.configService.preimageExpungePeriod, true)
    offset += 4

    // encode[4]{Cepochlen = 600}
    view.setUint32(offset, this.configService.epochDuration, true)
    offset += 4

    // encode[8]{Creportaccgas = 10000000}
    view.setBigUint64(
      offset,
      BigInt(WORK_REPORT_CONSTANTS.C_REPORTACCGAS),
      true,
    )
    offset += 8

    // encode[8]{Cpackageauthgas = 50000000}
    view.setBigUint64(
      offset,
      BigInt(AUTHORIZATION_CONSTANTS.C_PACKAGEAUTHGAS),
      true,
    )
    offset += 8

    // encode[8]{Cpackagerefgas = configMaxRefineGas}
    view.setBigUint64(offset, BigInt(this.configService.maxRefineGas), true)
    offset += 8

    // encode[8]{Cblockaccgas = 3500000000}
    view.setBigUint64(offset, BigInt(this.configService.maxBlockGas), true)
    offset += 8

    // encode[2]{Crecenthistorylen = 8}
    view.setUint16(offset, HISTORY_CONSTANTS.C_RECENTHISTORYLEN, true)
    offset += 2

    // encode[2]{Cmaxpackageitems = 16}
    view.setUint16(offset, WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEITEMS, true)
    offset += 2

    // encode[2]{Cmaxreportdeps = 8}
    view.setUint16(offset, WORK_REPORT_CONSTANTS.C_MAXREPORTDEPS, true)
    offset += 2

    // encode[2]{Cmaxblocktickets = configMaxTicketsPerExtrinsic}
    view.setUint16(offset, this.configService.maxTicketsPerExtrinsic, true)
    offset += 2

    // encode[4]{Cmaxlookupanchorage = 14400}
    view.setUint32(offset, this.configService.maxLookupAnchorage, true)
    offset += 4

    // encode[2]{Cticketentries = 2}
    view.setUint16(offset, this.configService.ticketsPerValidator, true)
    offset += 2

    // encode[2]{Cauthpoolsize = 8}
    view.setUint16(offset, AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE, true)
    offset += 2

    // encode[2]{Cslotseconds = 6}
    // Convert from milliseconds to seconds (configService.slotDuration is in milliseconds)
    const slotDurationSeconds = Math.floor(
      this.configService.slotDuration / 1000,
    )
    view.setUint16(offset, slotDurationSeconds, true)
    offset += 2

    // encode[2]{Cauthqueuesize = 80}
    view.setUint16(offset, AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE, true)
    offset += 2

    // encode[2]{Crotationperiod = 10}
    view.setUint16(offset, this.configService.rotationPeriod, true)
    offset += 2

    // encode[2]{Cmaxpackagexts = 128}
    view.setUint16(offset, WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEXTS, true)
    offset += 2

    // encode[2]{Cassurancetimeoutperiod = 5}
    view.setUint16(offset, TIME_CONSTANTS.C_ASSURANCETIMEOUTPERIOD, true)
    offset += 2

    // encode[2]{Cvalcount = 1023}
    view.setUint16(offset, this.configService.numValidators, true)
    offset += 2

    // encode[4]{Cmaxauthcodesize = 64000}
    view.setUint32(offset, AUTHORIZATION_CONSTANTS.C_MAXAUTHCODESIZE, true)
    offset += 4

    // encode[4]{Cmaxbundlesize = 13791360}
    view.setUint32(offset, WORK_PACKAGE_CONSTANTS.C_MAXBUNDLESIZE, true)
    offset += 4

    // encode[4]{Cmaxservicecodesize = 4000000}
    view.setUint32(offset, SERVICE_CONSTANTS.C_MAXSERVICECODESIZE, true)
    offset += 4

    // encode[4]{Cecpiecesize = 684}
    view.setUint32(offset, this.configService.ecPieceSize, true)
    offset += 4

    // encode[4]{Cmaxpackageimports = 3072}
    view.setUint32(offset, WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEIMPORTS, true)
    offset += 4

    // encode[4]{Csegmentecpieces = configNumEcPiecesPerSegment}
    view.setUint32(offset, this.configService.numEcPiecesPerSegment, true)
    offset += 4

    // encode[4]{Cmaxreportvarsize = 48*2^10 = 49152}
    view.setUint32(offset, WORK_REPORT_CONSTANTS.C_MAXREPORTVARSIZE, true)
    offset += 4

    // encode[4]{Cmemosize = 128}
    view.setUint32(offset, TRANSFER_CONSTANTS.C_MEMOSIZE, true)
    offset += 4

    // encode[4]{Cmaxpackageexports = 3072}
    view.setUint32(offset, WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEEXPORTS, true)
    offset += 4

    // encode[4]{Cepochtailstart = 500}
    view.setUint32(offset, this.configService.contestDuration, true)
    offset += 4

    // Verify we've used exactly 134 bytes as per Gray Paper specification
    if (offset !== 134) {
      throw new Error(
        `System constants encoding error: expected 134 bytes, got ${offset}`,
      )
    }

    return new Uint8Array(buffer)
  }

  private getWorkItemPayload(
    params: FetchParams,
    itemIndex: bigint,
  ): Uint8Array | null {
    // Gray Paper: p.workitems[registers[11]].payload when p ≠ none ∧ registers[10] = 13
    // Returns payload of specific work item

    if (!params.workPackage) {
      return null
    }

    const workItems = params.workPackage.workItems
    const itemIdx = Number(itemIndex)

    if (itemIdx >= workItems.length) {
      return null
    }

    const workItem = workItems[itemIdx]
    return workItem.payload
  }

  private getAccumulateInputByIndex(
    params: FetchParams,
    itemIndex: bigint,
  ): Uint8Array | null {
    // Gray Paper pvm_invocations.tex line 360: registers[10] = 15
    // Returns: encode{i[registers[11]]} when i ≠ none ∧ registers[11] < len(i)
    // Where i is sequence{accinput} - the accumulate inputs sequence
    // Gray Paper equation 126: accinput = operandtuple ∪ defxfer

    if (!params.accumulateInputs) {
      return null
    }

    const inputs = params.accumulateInputs
    const idx = Number(itemIndex)

    if (idx >= inputs.length) {
      return null
    }

    const input = inputs[idx]
    // Get JAM version from config service for version-specific encoding
    // Version differences: v0.7.0 and below use different encoding (no discriminator)
    // See: https://graypaper.fluffylabs.dev/#/9a08063/32fb0132fb01?v=0.6.6
    const jamVersion = this.configService.jamVersion
    const [error, encoded] = encodeAccumulateInput(input, jamVersion)
    if (error || !encoded) {
      return null
    }

    return encoded
  }
}
