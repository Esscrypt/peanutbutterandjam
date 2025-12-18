import {
  encodeRefineContext,
  encodeVariableSequence,
  encodeWorkItem,
  encodeWorkItemSummary,
  encodeWorkPackage,
} from '../../codec'
import { HostFunctionResult } from '../accumulate/base'
import { HostFunctionContext, HostFunctionParams, FetchParams } from './base'
import { PVM } from '../../pvm'
import {
  AUTHORIZATION_CONSTANTS,
  DEPOSIT_CONSTANTS,
  HISTORY_CONSTANTS,
  SEGMENT_CONSTANTS,
  SERVICE_CONSTANTS,
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

  pvmInstance: PVM | null = null // Reference to PVM instance to access entropy accumulator
  
  setPvmInstance(pvm: PVM): void {
    this.pvmInstance = pvm
  }

  execute(
    context: HostFunctionContext,
    params: HostFunctionParams | null,
  ): HostFunctionResult {
    if (!params) {
      return new HostFunctionResult(RESULT_CODES.PANIC)
    }
    const fetchParams = params as FetchParams
    const selector = context.registers[10] & 0xffffffff
    const outputOffset = context.registers[7] // memory offset to write the data to
    const fromOffset = context.registers[8] // start offset in the fetched data
    const length = context.registers[9] // number of bytes to write to memory


    // Fetch data based on selector according to Gray Paper specification
    // Note: We always fetch to determine available length, even if requested length is 0
    const fetchedData = this.fetchData(selector, context, fetchParams)

    // Write result to memory
    if (fetchedData === null) {
      // Return NONE (2^64 - 1) for not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
    } else {
      // Gray Paper pvm_invocations.tex lines 363-370:
      // f = min(registers_8, len(v))
      // l = min(registers_9, len(v) - f)
      // (execst', registers'_7, memory'[o:l]) ≡ {
      //   (panic, registers_7, memory[o:l])  when Nrange{o}{l} ⊄ writable(memory)
      //   (continue, NONE, memory[o:l])       when v = none
      //   (continue, len(v), v[f:l])          otherwise
      // }
      const clampedFromOffset = min(i32(fromOffset), fetchedData.length)
      const availableLength = fetchedData.length - clampedFromOffset
      // Gray Paper: l = min(registers_9, len(v) - f)
      // When registers_9 = 0, l = 0 (no write operation)
      const actualLength = min(i32(length), availableLength)

      // Only perform memory write when l > 0
      // Gray Paper: Empty range (l = 0) is always writable, but we don't write anything
      if (actualLength > 0) {
        const dataToWrite = fetchedData.slice(
          clampedFromOffset,
          clampedFromOffset + actualLength,
        )

        // Check if memory range is writable before writing
        // Gray Paper: panic when Nrange{o}{l} ⊄ writable(memory)
        const writeResult = context.ram.writeOctets(u32(outputOffset), dataToWrite)
        if (writeResult.hasFault) {
          return new HostFunctionResult(RESULT_CODES.PANIC)
        }
      }

      // Return length of fetched data (len(v))
      // Gray Paper: registers'_7 = len(v)
      context.registers[7] = u64(fetchedData.length)
    }

    return new HostFunctionResult(255) // continue execution
  }

  fetchData(
    selector: u64,
    context: HostFunctionContext,
    params: FetchParams
  ): Uint8Array | null {
    // Gray Paper: Ω_Y(gascounter, registers, memory, p, n, r, i, ī, x̄, i, .)
    // where p = work package, n = work package hash, r = authorizer trace,
    // i = work item index, ī = import segments, x̄ = export segments

    switch (u32(selector)) {
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
        // Get entropy accumulator from PVM instance (passed in setup)
        if (this.pvmInstance && this.pvmInstance!.entropyAccumulator) {
          return this.pvmInstance!.entropyAccumulator
        }

        return null

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
        if (!params.exportSegments) {
          return null
        }
        const workItemIndex = context.registers[11]
        const extrinsicIndex = context.registers[12]
        const workItemIdx = i32(workItemIndex)
        const extrinsicIdx = i32(extrinsicIndex)
        const exportSegments3 = params.exportSegments!
        if (workItemIdx >= exportSegments3.length) {
          return null
        }
        const segments = exportSegments3[workItemIdx]
        if (extrinsicIdx >= segments.length) {
          return null
        }
        return segments[extrinsicIdx]
      }

      case 4: {
        // Gray Paper pvm_invocations.tex line 348: registers[10] = 4
        // Returns: x̄[i][registers[11]] when x̄ ≠ none ∧ i ≠ none
        // Export segments/extrinsics by work item: x̄[i] is the sequence for work item i,
        // accessed at index registers[11]. Requires: registers[11] < len(x̄[i])
        if (!params.exportSegments || params.workItemIndex === u64(0)) {
          return null
        }
        const workItemIdx = i32(params.workItemIndex)
        const segmentIdx = i32(context.registers[11])
        const exportSegments4 = params.exportSegments!
        if (workItemIdx >= exportSegments4.length) {
          return null
        }
        const segments = exportSegments4[workItemIdx]
        if (segmentIdx >= segments.length) {
          return null
        }
        return segments[segmentIdx]
      }
      case 5: {
        // Gray Paper pvm_invocations.tex line 349: registers[10] = 5
        // Returns: ī[registers[11]][registers[12]] when ī ≠ none
        // Import segments: ī is a nested sequence, accessed by flat index registers[11]
        // and sub-index registers[12]. Requires: registers[11] < len(ī) and registers[12] < len(ī[registers[11]])
        if (!params.importSegments) {
          return null
        }
        const workItemIndex = context.registers[11]
        const importIndex = context.registers[12]
        const workItemIdx = i32(workItemIndex)
        const importIdx = i32(importIndex)
        const importSegments5 = params.importSegments!
        if (workItemIdx >= importSegments5.length) {
          return null
        }
        const segments = importSegments5[workItemIdx]
        if (importIdx >= segments.length) {
          return null
        }
        return segments[importIdx]
      }
      case 6: {
        // Gray Paper pvm_invocations.tex line 350: registers[10] = 6
        // Returns: ī[i][registers[11]] when ī ≠ none ∧ i ≠ none
        // Import segments by work item: ī[i] is the sequence for work item i,
        // accessed at index registers[11]. Requires: registers[11] < len(ī[i])
        if (!params.importSegments || params.workItemIndex === u64(0)) {
          return null
        }
        const workItemIdx = i32(params.workItemIndex)
        const segmentIdx = i32(context.registers[11])
        const importSegments6 = params.importSegments!
        if (workItemIdx >= importSegments6.length) {
          return null
        }
        const segments = importSegments6[workItemIdx]
        if (segmentIdx >= segments.length) {
          return null
        }
        return segments[segmentIdx]
      }

      case 7: {
        if(!params.workPackage) {
          return null
        }
        const workPackage7 = params.workPackage!
        const encoded = encodeWorkPackage(workPackage7)
        return encoded
      }

      case 8: {
        // Gray Paper pvm_invocations.tex line 352: registers[10] = 8
        // Returns: p.authconfig when p ≠ none
        // Work package authorization configuration blob
        if(!params.workPackage) {
          return null
        }
        const workPackage = params.workPackage!
        return workPackage.authConfig
      }

      case 9:
        // Gray Paper pvm_invocations.tex line 353: registers[10] = 9
        // Returns: p.authtoken when p ≠ none
        // Work package authorization token blob
        if(!params.workPackage) {
          return null
        }
        const workPackage9 = params.workPackage!
        return workPackage9.authToken

      case 10: {
        // Gray Paper pvm_invocations.tex line 354: registers[10] = 10
        // Returns: encode(p.context) when p ≠ none
        // Encoded work package context
        if(!params.workPackage) {
          return null
        }
        const workPackage10 = params.workPackage!
        const encoded = encodeRefineContext(workPackage10.context)
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
        const workPackage11 = params.workPackage!
        // Encode each work item summary and collect into array
        const summaries = new Array<Uint8Array>(workPackage11.workItems.length)
        for (let i: i32 = 0; i < workPackage11.workItems.length; i++) {
          summaries[i] = encodeWorkItemSummary(workPackage11.workItems[i])
        }
        const encoded = encodeVariableSequence(summaries)
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
        const workPackage12 = params.workPackage!
        const workItems = workPackage12.workItems
        const itemIdx = i32(context.registers[11])
        if (itemIdx >= workItems.length) {
          return null
        }
        const workItem = workItems[itemIdx]
        const encoded = encodeWorkItemSummary(workItem)
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
        // Note: workItemsSequence should always be an array (never null) during accumulation
        // If it's null, return null (i = none). If it's an empty array, return encoded empty sequence.
        if(!params.workItemsSequence) {
          return null
        }
        const workItemsSequence14 = params.workItemsSequence!
        // Encode each work item and collect into array
        const encodedWorkItems = new Array<Uint8Array>(workItemsSequence14.length)
        for (let i: i32 = 0; i < workItemsSequence14.length; i++) {
          encodedWorkItems[i] = encodeWorkItem(workItemsSequence14[i])
        }
        // encodeVariableSequence will encode length prefix (0 for empty array) + items
        // This always returns a Uint8Array (even for empty sequence, it's length prefix 0x00)
        const encoded = encodeVariableSequence(encodedWorkItems)
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

  // Helper to encode u64 to little-endian bytes
  encodeU64(value: u64): Uint8Array {
    const bytes = new Uint8Array(8)
    for (let i: i32 = 0; i < 8; i++) {
      bytes[i] = u8((value >> (u64(i) * 8)) & 0xff)
    }
    return bytes
  }

  // Helper to encode u32 to little-endian bytes
  encodeU32(value: u32): Uint8Array {
    const bytes = new Uint8Array(4)
    for (let i: i32 = 0; i < 4; i++) {
      bytes[i] = u8((value >> (i * 8)) & 0xff)
    }
    return bytes
  }

  // Helper to encode u16 to little-endian bytes
  encodeU16(value: u16): Uint8Array {
    const bytes = new Uint8Array(2)
    bytes[0] = u8(value & 0xff)
    bytes[1] = u8((value >> 8) & 0xff)
    return bytes
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

    const buffer = new Uint8Array(134) // Total size: 8+8+8+2+4+4+8+8+8+8+2+2+2+2+4+2+2+2+2+2+2+2+2+4+4+4+4+4+4+4+4+4+4+4 = 134 bytes (per Gray Paper pvm_invocations.tex lines 308-343)
    let offset: i32 = 0

    // encode[8]{Citemdeposit = 10}
    const itemDepositBytes = this.encodeU64(u64(DEPOSIT_CONSTANTS.C_ITEMDEPOSIT))
    buffer.set(itemDepositBytes, offset)
    offset += 8

    // encode[8]{Cbytedeposit = 1}
    const byteDepositBytes = this.encodeU64(u64(DEPOSIT_CONSTANTS.C_BYTEDEPOSIT))
    buffer.set(byteDepositBytes, offset)
    offset += 8

    // encode[8]{Cbasedeposit = 100}
    const baseDepositBytes = this.encodeU64(u64(DEPOSIT_CONSTANTS.C_BASEDEPOSIT))
    buffer.set(baseDepositBytes, offset)
    offset += 8

    // encode[2]{Ccorecount = 341}
    if (!this.pvmInstance) {
      abort('getSystemConstants: pvmInstance not set - config values required')
      unreachable()
    }
    const numCores = this.pvmInstance!.configNumCores
    const coreCountBytes = this.encodeU16(u16(numCores))
    buffer.set(coreCountBytes, offset)
    offset += 2

    // encode[4]{Cexpungeperiod = 19200}
    const preimageExpungePeriod = this.pvmInstance!.configPreimageExpungePeriod
    const expungePeriodBytes = this.encodeU32(preimageExpungePeriod)
    buffer.set(expungePeriodBytes, offset)
    offset += 4

    // encode[4]{Cepochlen = 600}
    const epochDuration = this.pvmInstance!.configEpochDuration
    const epochLenBytes = this.encodeU32(epochDuration)
    buffer.set(epochLenBytes, offset)
    offset += 4

    // encode[8]{Creportaccgas = 10000000}
    const reportAccGasBytes = this.encodeU64(u64(WORK_REPORT_CONSTANTS.C_REPORTACCGAS))
    buffer.set(reportAccGasBytes, offset)
    offset += 8

    // encode[8]{Cpackageauthgas = 50000000}
    const packageAuthGasBytes = this.encodeU64(u64(AUTHORIZATION_CONSTANTS.C_PACKAGEAUTHGAS))
    buffer.set(packageAuthGasBytes, offset)
    offset += 8

    // encode[8]{Cpackagerefgas = configMaxRefineGas}
    const maxRefineGas = this.pvmInstance!.configMaxRefineGas
    const packageRefGasBytes = this.encodeU64(maxRefineGas)
    buffer.set(packageRefGasBytes, offset)
    offset += 8

    // encode[8]{Cblockaccgas = 3500000000}
    const maxBlockGas = this.pvmInstance!.configMaxBlockGas
    const blockAccGasBytes = this.encodeU64(maxBlockGas)
    buffer.set(blockAccGasBytes, offset)
    offset += 8

    // encode[2]{Crecenthistorylen = 8}
    const recentHistoryLenBytes = this.encodeU16(u16(HISTORY_CONSTANTS.C_RECENTHISTORYLEN))
    buffer.set(recentHistoryLenBytes, offset)
    offset += 2

    // encode[2]{Cmaxpackageitems = 16}
    const maxPackageItemsBytes = this.encodeU16(u16(WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEITEMS))
    buffer.set(maxPackageItemsBytes, offset)
    offset += 2

    // encode[2]{Cmaxreportdeps = 8}
    const maxReportDepsBytes = this.encodeU16(u16(WORK_REPORT_CONSTANTS.C_MAXREPORTDEPS))
    buffer.set(maxReportDepsBytes, offset)
    offset += 2

    // encode[2]{Cmaxblocktickets = configMaxTicketsPerExtrinsic}
    const maxTicketsPerExtrinsic = this.pvmInstance!.configMaxTicketsPerExtrinsic
    const maxBlockTicketsBytes = this.encodeU16(u16(maxTicketsPerExtrinsic))
    buffer.set(maxBlockTicketsBytes, offset)
    offset += 2

    // encode[4]{Cmaxlookupanchorage = 14400}
    const maxLookupAnchorage = this.pvmInstance!.configMaxLookupAnchorage
    const maxLookupAnchorageBytes = this.encodeU32(maxLookupAnchorage)
    buffer.set(maxLookupAnchorageBytes, offset)
    offset += 4

    // encode[2]{Cticketentries = 2}
    const ticketsPerValidator = this.pvmInstance!.configTicketsPerValidator
    const ticketEntriesBytes = this.encodeU16(ticketsPerValidator)
    buffer.set(ticketEntriesBytes, offset)
    offset += 2

    // encode[2]{Cauthpoolsize = 8}
    const authPoolSizeBytes = this.encodeU16(u16(AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE))
    buffer.set(authPoolSizeBytes, offset)
    offset += 2

    // encode[2]{Cslotseconds = 6}
    // Note: configSlotDuration is in seconds (not milliseconds like TypeScript)
    const slotDuration = this.pvmInstance!.configSlotDuration
    const slotSecondsBytes = this.encodeU16(slotDuration)
    buffer.set(slotSecondsBytes, offset)
    offset += 2

    // encode[2]{Cauthqueuesize = 80}
    const authQueueSizeBytes = this.encodeU16(u16(AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE))
    buffer.set(authQueueSizeBytes, offset)
    offset += 2

    // encode[2]{Crotationperiod = 10}
    const rotationPeriod = this.pvmInstance!.configRotationPeriod
    const rotationPeriodBytes = this.encodeU16(rotationPeriod)
    buffer.set(rotationPeriodBytes, offset)
    offset += 2

    // encode[2]{Cmaxpackagexts = 128}
    const maxPackageXtsBytes = this.encodeU16(u16(WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEXTS))
    buffer.set(maxPackageXtsBytes, offset)
    offset += 2

    // encode[2]{Cassurancetimeoutperiod = 5}
    const assuranceTimeoutPeriodBytes = this.encodeU16(u16(TIME_CONSTANTS.C_ASSURANCETIMEOUTPERIOD))
    buffer.set(assuranceTimeoutPeriodBytes, offset)
    offset += 2

    // encode[2]{Cvalcount = 1023}
    const numValidators = this.pvmInstance!.configNumValidators
    const valCountBytes = this.encodeU16(numValidators)
    buffer.set(valCountBytes, offset)
    offset += 2

    // encode[4]{Cmaxauthcodesize = 64000}
    const maxAuthCodeSizeBytes = this.encodeU32(AUTHORIZATION_CONSTANTS.C_MAXAUTHCODESIZE)
    buffer.set(maxAuthCodeSizeBytes, offset)
    offset += 4

    // encode[4]{Cmaxbundlesize = 13791360}
    const maxBundleSizeBytes = this.encodeU32(WORK_PACKAGE_CONSTANTS.C_MAXBUNDLESIZE)
    buffer.set(maxBundleSizeBytes, offset)
    offset += 4

    // encode[4]{Cmaxservicecodesize = 4000000}
    const maxServiceCodeSizeBytes = this.encodeU32(SERVICE_CONSTANTS.C_MAXSERVICECODESIZE)
    buffer.set(maxServiceCodeSizeBytes, offset)
    offset += 4

    // encode[4]{Cecpiecesize = 684}
    const ecPieceSize = this.pvmInstance!.configEcPieceSize
    const ecPieceSizeBytes = this.encodeU32(ecPieceSize)
    buffer.set(ecPieceSizeBytes, offset)
    offset += 4

    // encode[4]{Cmaxpackageimports = 3072}
    const maxPackageImportsBytes = this.encodeU32(WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEIMPORTS)
    buffer.set(maxPackageImportsBytes, offset)
    offset += 4

    // encode[4]{Csegmentecpieces = configNumEcPiecesPerSegment}
    const numEcPiecesPerSegment = this.pvmInstance!.configNumEcPiecesPerSegment
    const segmentEcPiecesBytes = this.encodeU32(numEcPiecesPerSegment)
    buffer.set(segmentEcPiecesBytes, offset)
    offset += 4

    // encode[4]{Cmaxreportvarsize = 48*2^10 = 49152}
    const maxReportVarSizeBytes = this.encodeU32(WORK_REPORT_CONSTANTS.C_MAXREPORTVARSIZE)
    buffer.set(maxReportVarSizeBytes, offset)
    offset += 4

    // encode[4]{Cmemosize = 128}
    const memoSizeBytes = this.encodeU32(TRANSFER_CONSTANTS.C_MEMOSIZE)
    buffer.set(memoSizeBytes, offset)
    offset += 4

    // encode[4]{Cmaxpackageexports = 3072}
    const maxPackageExportsBytes = this.encodeU32(WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEEXPORTS)
    buffer.set(maxPackageExportsBytes, offset)
    offset += 4

    // encode[4]{Cepochtailstart = configContestDuration}
    const contestDuration = this.pvmInstance!.configContestDuration
    const epochTailStartBytes = this.encodeU32(contestDuration)
    buffer.set(epochTailStartBytes, offset)

    return buffer
  }


  getWorkItemPayload(
    params: FetchParams,
    itemIndex: u64,
  ): Uint8Array | null {
    // Gray Paper: p.workitems[registers[11]].payload when p ≠ none ∧ registers[10] = 13
    // Returns payload of specific work item

    if (!params.workPackage) {
      return null
    }

    const workPackage = params.workPackage!
    const workItems = workPackage.workItems
    const itemIdx = i32(itemIndex)

    if (itemIdx >= workItems.length) {
      return null
    }

    const workItem = workItems[itemIdx]
    return workItem.payload
  }


  getWorkItemByIndex(
    params: FetchParams,
    itemIndex: u64,
  ): Uint8Array | null {
    // Gray Paper: encode(i[registers[11]]) when i ≠ none ∧ registers[10] = 15
    // Returns encoded work item at index registers[11] from work items sequence i
    // Note: i is the second 'i' parameter (workItemsSequence), not workPackage.workItems

    if (!params.workItemsSequence) {
      return null
    }

    const workItemsSequence = params.workItemsSequence!
    const workItems = workItemsSequence
    const itemIdx = i32(itemIndex)

    if (itemIdx >= workItems.length) {
      return null
    }

    const workItem = workItems[itemIdx]
    const encoded = encodeWorkItem(workItem)
    return encoded
  }
}
