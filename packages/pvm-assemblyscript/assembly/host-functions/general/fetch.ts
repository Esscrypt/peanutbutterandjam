import {
  encodeRefineContext,
  encodeVariableSequence,
  encodeWorkItem,
  encodeWorkItemSummary,
  encodeWorkPackage,
} from '../../codec'
import {
  FetchParams,
  HostFunctionContext,
  HostFunctionResult,
  IConfigService,
} from '../../pbnj-types-compat'
import {
  AUTHORIZATION_CONSTANTS,
  DEPOSIT_CONSTANTS,
  GAS_CONSTANTS,
  HISTORY_CONSTANTS,
  SEGMENT_CONSTANTS,
  SERVICE_CONSTANTS,
  TICKET_CONSTANTS,
  TIME_CONSTANTS,
  TRANSFER_CONSTANTS,
  WORK_PACKAGE_CONSTANTS,
  WORK_REPORT_CONSTANTS,
} from '../../pbnj-types-compat'
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
  functionId: u64 = GENERAL_FUNCTIONS.FETCH
  name: string = 'fetch'

  configService: IConfigService
  constructor(configService: IConfigService) {
    super()
    this.configService = configService
  }

  execute(
    context: HostFunctionContext,
    params: FetchParams
  ): HostFunctionResult {
    const selector = context.registers[10] & 0xffffffff
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
    } else {
      // Write data to memory
      // Gray Paper: f = min(registers_8, len(v)), l = min(registers_9, len(v) - f)
      // First clamp fromOffset to available data length
      const clampedFromOffset = Math.min(Number(fromOffset), fetchedData.length)
      // Then calculate available length after fromOffset
      const availableLength = fetchedData.length - clampedFromOffset
      // Finally clamp requested length to available data
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
          return {
            resultCode: RESULT_CODES.PANIC,
          }
        }
      }

      // Return length of fetched data
      context.registers[7] = BigInt(fetchedData.length)
    }

    return {
      resultCode: null, // continue execution
    }
  }

  fetchData(
    selector: bigint,
    context: HostFunctionContext,
    params: FetchParams
  ): Uint8Array | null {
    // Gray Paper: Ω_Y(gascounter, registers, memory, p, n, r, i, ī, x̄, i, .)
    // where p = work package, n = work package hash, r = authorizer trace,
    // i = work item index, ī = import segments, x̄ = export segments

    switch (selector) {
      case 0:
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

      case 1:
        // Gray Paper pvm_invocations.tex line 345: registers[10] = 1
        // Returns: n when n ≠ none
        // In accumulate invocation (line 189): n = entropyaccumulator' (entropy accumulator)
        // In refine invocation (line 96): n = zerohash (work package hash, but set to zero/none)
        // In is-authorized invocation (line 49): n = none (not available)
        return params.entropyService.getEntropyAccumulator()

      case 2: {
        // Gray Paper pvm_invocations.tex line 346: registers[10] = 2
        // Returns: r (authorizer trace) when r ≠ none
        // The authorizer trace parameter passed to Ω_Y
        if (!params.authorizerTrace) {
          return null
        }
        return params.authorizerTrace
      }
      case 3: {
        const workItemIndex = context.registers[11]
        const extrinsicIndex = context.registers[12]
        return params.exportSegments[Number(workItemIndex)][Number(extrinsicIndex)] || null
      }

      case 4: {
        // Gray Paper pvm_invocations.tex line 348: registers[10] = 4
        // Returns: x̄[i][registers[11]] when x̄ ≠ none ∧ i ≠ none
        // Export segments/extrinsics by work item: x̄[i] is the sequence for work item i,
        // accessed at index registers[11]. Requires: registers[11] < len(x̄[i])
        if (!params.exportSegments || params.workItemIndex === null) {
          return null
        }
        const workItemIdx = Number(params.workItemIndex)
        const segmentIdx = Number(context.registers[11])
        return params.exportSegments[workItemIdx][segmentIdx] || null
      }
      case 5: {
        // Gray Paper pvm_invocations.tex line 349: registers[10] = 5
        // Returns: ī[registers[11]][registers[12]] when ī ≠ none
        // Import segments: ī is a nested sequence, accessed by flat index registers[11]
        // and sub-index registers[12]. Requires: registers[11] < len(ī) and registers[12] < len(ī[registers[11]])
        const workItemIndex = context.registers[11]
        const importIndex = context.registers[12]
        return params.importSegments[Number(workItemIndex)][Number(importIndex)] || null
      }
      case 6: {
        // Gray Paper pvm_invocations.tex line 350: registers[10] = 6
        // Returns: ī[i][registers[11]] when ī ≠ none ∧ i ≠ none
        // Import segments by work item: ī[i] is the sequence for work item i,
        // accessed at index registers[11]. Requires: registers[11] < len(ī[i])
        if (!params.importSegments || params.workItemIndex === null) {
          return null
        }
        const workItemIdx = Number(params.workItemIndex)
        const segmentIdx = Number(context.registers[11])
        return params.importSegments[workItemIdx][segmentIdx] || null
      }

      case 7: {
        if(!params.workPackage) {
          return null
        }
        const result_error = encodeWorkPackage(params.workPackage)
    const error = result_error.data || result_error[0] || result_error
    const encoded = result_error.faultAddress || result_error[1] || null
        if (error || !encoded) {
          return null
        }
        return encoded
      }

      case 8: {
        // Gray Paper pvm_invocations.tex line 352: registers[10] = 8
        // Returns: p.authconfig when p ≠ none
        // Work package authorization configuration blob
        if(!params.workPackage) {
          return null
        }
        return params.workPackage.authConfig
      }

      case 9:
        // Gray Paper pvm_invocations.tex line 353: registers[10] = 9
        // Returns: p.authtoken when p ≠ none
        // Work package authorization token blob
        if(!params.workPackage) {
          return null
        }
        return params.workPackage.authToken

      case 10: {
        // Gray Paper pvm_invocations.tex line 354: registers[10] = 10
        // Returns: encode(p.context) when p ≠ none
        // Encoded work package context
        if(!params.workPackage) {
          return null
        }
        const result_error = encodeRefineContext(params.workPackage.context)
    const error = result_error.data || result_error[0] || result_error
    const encoded = result_error.faultAddress || result_error[1] || null
        if (error || !encoded) {
          return null
        }
        return encoded
      }

      case 11: {
        // Gray Paper pvm_invocations.tex line 355: registers[10] = 11
        // Returns: encode({S(w) | w ∈ p.workitems}) when p ≠ none
        // Encoded sequence of work item summaries S(w) for all work items in p.workitems
        // S(w) = encode{encode[4]{w.serviceindex}, w.codehash, encode[8]{w.refgaslimit, w.accgaslimit},
        // encode[2]{w.exportcount, len(w.importsegments), len(w.extrinsics)}, encode[4]{len(w.payload)}}
        if (!params.workPackage) {
          return null
        }
        const result_error = encodeVariableSequence(params.workPackage.workItems, encodeWorkItemSummary)
    const error = result_error.data || result_error[0] || result_error
    const encoded = result_error.faultAddress || result_error[1] || null
        if (error || !encoded) {
          return null
        }
        return encoded
      }

      case 12: {
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
        const result_error = encodeWorkItemSummary(workItem)
    const error = result_error.data || result_error[0] || result_error
    const encoded = result_error.faultAddress || result_error[1] || null
        if (error || !encoded) {
          return null
        }
        return encoded

      }
      case 13: {
        // Gray Paper pvm_invocations.tex line 358: registers[10] = 13
        // Returns: p.workitems[registers[11]].payload when p ≠ none ∧ registers[11] < len(p.workitems)
        // Payload blob of work item at index registers[11]
        return this.getWorkItemPayload(params, context.registers[11])
      }

      case 14: {
        // Gray Paper pvm_invocations.tex line 359: registers[10] = 14
        // Returns: encode(i) when i ≠ none
        // Encoded work items sequence i (the second 'i' parameter to Ω_Y)
        if(!params.workItemsSequence) {
          return null
        }
        const result_error = encodeVariableSequence(params.workItemsSequence, encodeWorkItem)
    const error = result_error.data || result_error[0] || result_error
    const encoded = result_error.faultAddress || result_error[1] || null
        if (error || !encoded) {
          return null
        }
        return encoded
      }

      case 15: {
        // Gray Paper pvm_invocations.tex line 360: registers[10] = 15
        // Returns: encode(i[registers[11]]) when i ≠ none ∧ registers[11] < len(i)
        // Encoded work item at index registers[11] from work items sequence i
        return this.getWorkItemByIndex(params, context.registers[11])
      }
      default:
        // Unknown selector - return NONE
        return null
    }
  }

  getSystemConstants(): Uint8Array {
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

    const buffer = new ArrayBuffer(200) // Total size: 8+8+8+2+4+4+8+8+8+8+2+2+2+2+4+2+2+2+2+2+2+2+2+4+4+4+4+4+4+4+4+4+4+4 = 200 bytes
    const view = new DataView(buffer)
    let offset = 0

    // encode[8]{Citemdeposit = 10}
    view.setBigUint64(offset, BigInt(DEPOSIT_CONSTANTS.C_ITEMDEPOSIT), false)
    offset += 8

    // encode[8]{Cbytedeposit = 1}
    view.setBigUint64(offset, BigInt(DEPOSIT_CONSTANTS.C_BYTEDEPOSIT), false)
    offset += 8

    // encode[8]{Cbasedeposit = 100}
    view.setBigUint64(offset, BigInt(DEPOSIT_CONSTANTS.C_BASEDEPOSIT), false)
    offset += 8

    // encode[2]{Ccorecount = 341}
    view.setUint16(offset, this.configService.numCores, false)
    offset += 2

    // encode[4]{Cexpungeperiod = 19200}
    view.setUint32(offset, this.configService.preimageExpungePeriod, false)
    offset += 4

    // encode[4]{Cepochlen = 600}
    view.setUint32(offset, this.configService.epochDuration, false)
    offset += 4

    // encode[8]{Creportaccgas = 10000000}
    view.setBigUint64(
      offset,
      BigInt(WORK_REPORT_CONSTANTS.C_REPORTACCGAS),
      false,
    )
    offset += 8

    // encode[8]{Cpackageauthgas = 50000000}
    view.setBigUint64(
      offset,
      BigInt(AUTHORIZATION_CONSTANTS.C_PACKAGEAUTHGAS),
      false,
    )
    offset += 8

    // encode[8]{Cpackagerefgas = 5000000000}
    view.setBigUint64(offset, BigInt(GAS_CONSTANTS.C_PACKAGEREFGAS), false)
    offset += 8

    // encode[8]{Cblockaccgas = 3500000000}
    view.setBigUint64(offset, BigInt(this.configService.maxBlockGas), false)
    offset += 8

    // encode[2]{Crecenthistorylen = 8}
    view.setUint16(offset, HISTORY_CONSTANTS.C_RECENTHISTORYLEN, false)
    offset += 2

    // encode[2]{Cmaxpackageitems = 16}
    view.setUint16(offset, WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEITEMS, false)
    offset += 2

    // encode[2]{Cmaxreportdeps = 8}
      view.setUint16(offset, WORK_REPORT_CONSTANTS.C_MAXREPORTDEPS, false)
    offset += 2

    // encode[2]{Cmaxblocktickets = 16}
    view.setUint16(offset, TICKET_CONSTANTS.C_MAXBLOCKTICKETS, false)
    offset += 2

    // encode[4]{Cmaxlookupanchorage = 14400}
    view.setUint32(offset, TIME_CONSTANTS.C_MAXLOOKUPANCHORAGE, false)
    offset += 4

    // encode[2]{Cticketentries = 2}
    view.setUint16(offset, this.configService.ticketsPerValidator, false)
    offset += 2

    // encode[2]{Cauthpoolsize = 8}
    view.setUint16(offset, AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE, false)
    offset += 2

    // encode[2]{Cslotseconds = 6}
    view.setUint16(offset, this.configService.slotDuration, false)
    offset += 2

    // encode[2]{Cauthqueuesize = 80}
    view.setUint16(offset, AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE, false)
    offset += 2

    // encode[2]{Crotationperiod = 10}
    view.setUint16(offset, this.configService.rotationPeriod, false)
    offset += 2

    // encode[2]{Cmaxpackagexts = 128}
    view.setUint16(offset, WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEXTS, false)
    offset += 2

    // encode[2]{Cassurancetimeoutperiod = 5}
    view.setUint16(offset, TIME_CONSTANTS.C_ASSURANCETIMEOUTPERIOD, false)
    offset += 2

    // encode[2]{Cvalcount = 1023}
    view.setUint16(offset, this.configService.numValidators, false)
    offset += 2

    // encode[4]{Cmaxauthcodesize = 64000}
    view.setUint32(offset, AUTHORIZATION_CONSTANTS.C_MAXAUTHCODESIZE, false)
    offset += 4

    // encode[4]{Cmaxbundlesize = 13791360}
      view.setUint32(offset, WORK_PACKAGE_CONSTANTS.C_MAXBUNDLESIZE, false)
    offset += 4

    // encode[4]{Cmaxservicecodesize = 4000000}
    view.setUint32(offset, SERVICE_CONSTANTS.C_MAXSERVICECODESIZE, false)
    offset += 4

    // encode[4]{Cecpiecesize = 684}
    view.setUint32(offset, SEGMENT_CONSTANTS.C_ECPIECESIZE, false)
    offset += 4

    // encode[4]{Cmaxpackageimports = 3072}
    view.setUint32(offset, WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEIMPORTS, false)
    offset += 4

    // encode[4]{Csegmentecpieces = 6}
    view.setUint32(offset, SEGMENT_CONSTANTS.C_SEGMENTECPIECES, false)
    offset += 4

    // encode[4]{Cmaxreportvarsize = 48*2^10 = 49152}
    view.setUint32(offset, WORK_REPORT_CONSTANTS.C_MAXREPORTVARSIZE, false)
    offset += 4

    // encode[4]{Cmemosize = 128}
    view.setUint32(offset, TRANSFER_CONSTANTS.C_MEMOSIZE, false)
    offset += 4

    // encode[4]{Cmaxpackageexports = 3072}
    view.setUint32(offset, WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEEXPORTS, false)
    offset += 4

    // encode[4]{Cepochtailstart = 500}
    view.setUint32(offset, TICKET_CONSTANTS.C_EPOCHTAILSTART, false)

    return new Uint8Array(buffer)
  }


  getWorkItemPayload(
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


  getWorkItemByIndex(
    params: FetchParams,
    itemIndex: bigint,
  ): Uint8Array | null {
    // Gray Paper: encode(i[registers[11]]) when i ≠ none ∧ registers[10] = 15
    // Returns encoded work item at index registers[11] from work items sequence i
    // Note: i is the second 'i' parameter (workItemsSequence), not workPackage.workItems

    if (!params.workItemsSequence) {
      return null
    }

    const workItems = params.workItemsSequence
    const itemIdx = Number(itemIndex)

    if (itemIdx >= workItems.length) {
      return null
    }

    const workItem = workItems[itemIdx]
    const result_error = encodeWorkItem(workItem)
    const error = result_error.data || result_error[0] || result_error
    const encoded = result_error.faultAddress || result_error[1] || null
    if (error || !encoded) {
      return null
    }

    return encoded
  }
}
