import { hexToBytes } from '@pbnj/core'
import {
  calculateWorkPackageHash,
  encodeWorkItem,
  encodeWorkPackage,
} from '@pbnj/serialization'
import type {
  HostFunctionContext,
  HostFunctionResult,
  RefineContextPVM,
  WorkItem,
} from '@pbnj/types'
import {
  AUTHORIZATION_CONSTANTS,
  CORE_CONSTANTS,
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
} from '@pbnj/types'
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
  readonly gasCost = 10n

  execute(
    context: HostFunctionContext,
    refineContext?: RefineContextPVM,
  ): HostFunctionResult {
    // Validate execution
    if (context.gasCounter < this.gasCost) {
      return {
        resultCode: RESULT_CODES.OOG,
      }
    }

    context.gasCounter -= this.gasCost

    const selector = context.registers[10]
    const outputOffset = context.registers[7]
    const fromOffset = context.registers[8]
    const length = context.registers[9]

    // Fetch data based on selector according to Gray Paper specification
    const fetchedData = this.fetchData(selector, context, refineContext)

    // Write result to memory
    if (fetchedData === null) {
      // Return NONE (2^64 - 1) for not found
      context.registers[7] = ACCUMULATE_ERROR_CODES.NONE
    } else {
      // Write data to memory
      const actualLength = Math.min(
        Number(length),
        fetchedData.length - Number(fromOffset),
      )
      const dataToWrite = fetchedData.slice(
        Number(fromOffset),
        Number(fromOffset) + actualLength,
      )

      context.ram.writeOctets(outputOffset, dataToWrite)

      // Return length of fetched data
      context.registers[7] = BigInt(fetchedData.length)
    }

    return {
      resultCode: null, // continue execution
    }
  }

  private fetchData(
    selector: bigint,
    context: HostFunctionContext,
    refineContext?: RefineContextPVM,
  ): Uint8Array | null {
    // Gray Paper: Ω_Y(gascounter, registers, memory, p, n, r, i, ī, x̄, i, ...)
    // where p = work package, n = work package hash, r = authorizer trace,
    // i = work item index, ī = import segments, x̄ = export segments

    switch (selector) {
      case 0n:
        // System constants - Gray Paper: registers[10] = 0
        return this.getSystemConstants()

      case 1n:
        // Work package hash - Gray Paper: registers[10] = 1
        // n when n ≠ none ∧ registers[10] = 1
        return this.getWorkPackageHash(refineContext)

      case 2n:
        // Authorizer trace - Gray Paper: registers[10] = 2
        // r when r ≠ none ∧ registers[10] = 2
        return this.getAuthorizerTrace(refineContext)

      case 3n:
        // Export segments - Gray Paper: registers[10] = 3
        // x̄[registers[11]][registers[12]] when x̄ ≠ none ∧ registers[10] = 3
        return this.getExportSegment(refineContext, context.registers[11])

      case 4n:
        // Export segments by work item - Gray Paper: registers[10] = 4
        // x̄[i][registers[11]] when x̄ ≠ none ∧ i ≠ none ∧ registers[10] = 4
        return this.getExportSegmentByWorkItem(
          refineContext,
          context.registers[11],
        )

      case 5n:
        // Import segments - Gray Paper: registers[10] = 5
        // ī[registers[11]][registers[12]] when ī ≠ none ∧ registers[10] = 5
        return this.getImportSegment(
          refineContext,
          context.registers[11],
          context.registers[12],
        )

      case 6n:
        // Import segments by work item - Gray Paper: registers[10] = 6
        // ī[i][registers[11]] when ī ≠ none ∧ i ≠ none ∧ registers[10] = 6
        return this.getImportSegmentByWorkItem(
          refineContext,
          context.registers[11],
        )

      case 7n:
        // Work package - Gray Paper: registers[10] = 7
        // encode(p) when p ≠ none ∧ registers[10] = 7
        return this.getWorkPackage(refineContext)

      case 8n:
        // Auth config - Gray Paper: registers[10] = 8
        // p.authconfig when p ≠ none ∧ registers[10] = 8
        return this.getAuthConfig(refineContext)

      case 9n:
        // Auth token - Gray Paper: registers[10] = 9
        // p.authtoken when p ≠ none ∧ registers[10] = 9
        return this.getAuthToken(refineContext)

      case 10n:
        // Work context - Gray Paper: registers[10] = 10
        // encode(p.context) when p ≠ none ∧ registers[10] = 10
        return this.getWorkContext(refineContext)

      case 11n:
        // Work items summary - Gray Paper: registers[10] = 11
        // encode({S(w) | w ∈ p.workitems}) when p ≠ none ∧ registers[10] = 11
        return this.getWorkItemsSummary(refineContext)

      case 12n:
        // Work item - Gray Paper: registers[10] = 12
        // S(p.workitems[registers[11]]) when p ≠ none ∧ registers[10] = 12
        return this.getWorkItem(refineContext, context.registers[11])

      case 13n:
        // Work item payload - Gray Paper: registers[10] = 13
        // p.workitems[registers[11]].payload when p ≠ none ∧ registers[10] = 13
        return this.getWorkItemPayload(refineContext, context.registers[11])

      case 14n:
        // Work items - Gray Paper: registers[10] = 14
        // encode(i) when i ≠ none ∧ registers[10] = 14
        return this.getWorkItems(refineContext)

      case 15n:
        // Work item by index - Gray Paper: registers[10] = 15
        // encode(i[registers[11]]) when i ≠ none ∧ registers[10] = 15
        return this.getWorkItemByIndex(refineContext, context.registers[11])

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

    const buffer = new ArrayBuffer(200) // Total size: 8+8+8+2+4+4+8+8+8+8+2+2+2+2+4+2+2+2+2+2+2+2+2+4+4+4+4+4+4+4+4+4+4+4 = 200 bytes
    const view = new DataView(buffer)
    let offset = 0

    // encode[8]{Citemdeposit = 10}
    view.setBigUint64(offset, BigInt(DEPOSIT_CONSTANTS.C_ITEMDEPOSIT), true)
    offset += 8

    // encode[8]{Cbytedeposit = 1}
    view.setBigUint64(offset, BigInt(DEPOSIT_CONSTANTS.C_BYTEDEPOSIT), true)
    offset += 8

    // encode[8]{Cbasedeposit = 100}
    view.setBigUint64(offset, BigInt(DEPOSIT_CONSTANTS.C_BASEDEPOSIT), true)
    offset += 8

    // encode[2]{Ccorecount = 341}
    view.setUint16(offset, CORE_CONSTANTS.C_CORECOUNT, true)
    offset += 2

    // encode[4]{Cexpungeperiod = 19200}
    view.setUint32(offset, TIME_CONSTANTS.C_EXPUNGEPERIOD, true)
    offset += 4

    // encode[4]{Cepochlen = 600}
    view.setUint32(offset, CORE_CONSTANTS.C_EPOCHLEN, true)
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

    // encode[8]{Cpackagerefgas = 5000000000}
    view.setBigUint64(offset, BigInt(GAS_CONSTANTS.C_PACKAGEREFGAS), true)
    offset += 8

    // encode[8]{Cblockaccgas = 3500000000}
    view.setBigUint64(offset, BigInt(GAS_CONSTANTS.C_BLOCKACCGAS), true)
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

    // encode[2]{Cmaxblocktickets = 16}
    view.setUint16(offset, TICKET_CONSTANTS.C_MAXBLOCKTICKETS, true)
    offset += 2

    // encode[4]{Cmaxlookupanchorage = 14400}
    view.setUint32(offset, TIME_CONSTANTS.C_MAXLOOKUPANCHORAGE, true)
    offset += 4

    // encode[2]{Cticketentries = 2}
    view.setUint16(offset, TICKET_CONSTANTS.C_TICKETENTRIES, true)
    offset += 2

    // encode[2]{Cauthpoolsize = 8}
    view.setUint16(offset, AUTHORIZATION_CONSTANTS.C_AUTHPOOLSIZE, true)
    offset += 2

    // encode[2]{Cslotseconds = 6}
    view.setUint16(offset, CORE_CONSTANTS.C_SLOTSECONDS, true)
    offset += 2

    // encode[2]{Cauthqueuesize = 80}
    view.setUint16(offset, AUTHORIZATION_CONSTANTS.C_AUTHQUEUESIZE, true)
    offset += 2

    // encode[2]{Crotationperiod = 10}
    view.setUint16(offset, TIME_CONSTANTS.C_ROTATIONPERIOD, true)
    offset += 2

    // encode[2]{Cmaxpackagexts = 128}
    view.setUint16(offset, WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEXTS, true)
    offset += 2

    // encode[2]{Cassurancetimeoutperiod = 5}
    view.setUint16(offset, TIME_CONSTANTS.C_ASSURANCETIMEOUTPERIOD, true)
    offset += 2

    // encode[2]{Cvalcount = 1023}
    view.setUint16(offset, CORE_CONSTANTS.C_VALCOUNT, true)
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
    view.setUint32(offset, SEGMENT_CONSTANTS.C_ECPIECESIZE, true)
    offset += 4

    // encode[4]{Cmaxpackageimports = 3072}
    view.setUint32(offset, WORK_PACKAGE_CONSTANTS.C_MAXPACKAGEIMPORTS, true)
    offset += 4

    // encode[4]{Csegmentecpieces = 6}
    view.setUint32(offset, SEGMENT_CONSTANTS.C_SEGMENTECPIECES, true)
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
    view.setUint32(offset, TICKET_CONSTANTS.C_EPOCHTAILSTART, true)

    return new Uint8Array(buffer)
  }

  private getExportSegment(
    refineContext: RefineContextPVM | undefined,
    segmentIndex: bigint,
  ): Uint8Array | null {
    // Gray Paper: x̄[registers[11]][registers[12]] when x̄ ≠ none ∧ registers[10] = 3
    // Note: exportSegments is Segment[] where Segment = Uint8Array
    // So we're accessing exportSegments[segmentIndex] which is a Uint8Array

    if (!refineContext) {
      return null
    }

    const exportSegments = refineContext.exportSegments
    const segmentIdx = Number(segmentIndex)

    // Check bounds
    if (segmentIdx >= exportSegments.length) {
      return null
    }

    // Return the entire segment (Uint8Array)
    // The Gray Paper shows x̄[registers[11]][registers[12]] but our structure
    // is simpler - just an array of segments
    return exportSegments[segmentIdx]
  }

  // Additional fetch methods for work package data
  // These are placeholders that would be implemented when the invocation system
  // provides the full work package context

  private getWorkPackageHash(
    refineContext: RefineContextPVM | undefined,
  ): Uint8Array | null {
    // Gray Paper: n when n ≠ none ∧ registers[10] = 1
    // Returns work package hash from refine context

    if (!refineContext?.workPackage) {
      return null
    }

    // Calculate work package hash from the work package
    const [error, workPackageHash] = calculateWorkPackageHash(
      refineContext.workPackage,
    )
    if (error || !workPackageHash) {
      return null
    }

    return hexToBytes(workPackageHash)
  }

  private getAuthorizerTrace(
    refineContext: RefineContextPVM | undefined,
  ): Uint8Array | null {
    // Gray Paper: r when r ≠ none ∧ registers[10] = 2
    // Returns authorizer trace from refine context

    if (!refineContext?.authorizerTrace) {
      return null
    }

    // Convert hex string to bytes
    return new Uint8Array(
      Buffer.from(refineContext.authorizerTrace.slice(2), 'hex'),
    )
  }

  private getExportSegmentByWorkItem(
    refineContext: RefineContextPVM | undefined,
    segmentIndex: bigint,
  ): Uint8Array | null {
    // Gray Paper: x̄[i][registers[11]] when x̄ ≠ none ∧ i ≠ none ∧ registers[10] = 4
    // Returns export segment for specific work item

    if (!refineContext?.workItemIndex || !refineContext?.exportSegments) {
      return null
    }

    const segmentIdx = Number(segmentIndex)

    // For now, we'll use the exportSegments array directly
    // In a full implementation, this would be organized by work item
    if (segmentIdx >= refineContext.exportSegments.length) {
      return null
    }

    return refineContext.exportSegments[segmentIdx]
  }

  private getImportSegment(
    refineContext: RefineContextPVM | undefined,
    segmentIndex: bigint,
    subIndex: bigint,
  ): Uint8Array | null {
    // Gray Paper: ī[registers[11]][registers[12]] when ī ≠ none ∧ registers[10] = 5
    // Returns specific import segment

    if (!refineContext?.importSegments) {
      return null
    }

    const segmentIdx = Number(segmentIndex)
    const subIdx = Number(subIndex)

    if (segmentIdx >= refineContext.importSegments.length) {
      return null
    }

    const segment = refineContext.importSegments[segmentIdx]
    if (subIdx >= segment.length) {
      return null
    }

    return segment[subIdx]
  }

  private getImportSegmentByWorkItem(
    refineContext: RefineContextPVM | undefined,
    segmentIndex: bigint,
  ): Uint8Array | null {
    // Gray Paper: ī[i][registers[11]] when ī ≠ none ∧ i ≠ none ∧ registers[10] = 6
    // Returns import segment for specific work item

    if (!refineContext?.workItemIndex || !refineContext?.importSegments) {
      return null
    }

    const workItemIdx = Number(refineContext.workItemIndex)
    const segmentIdx = Number(segmentIndex)

    if (workItemIdx >= refineContext.importSegments.length) {
      return null
    }

    const workItemImports = refineContext.importSegments[workItemIdx]
    if (segmentIdx >= workItemImports.length) {
      return null
    }

    return workItemImports[segmentIdx]
  }

  private getWorkPackage(
    refineContext: RefineContextPVM | undefined,
  ): Uint8Array | null {
    // Gray Paper: encode(p) when p ≠ none ∧ registers[10] = 7
    // Returns encoded work package

    if (!refineContext?.workPackage) {
      return null
    }

    const [error, encoded] = encodeWorkPackage(refineContext.workPackage)
    if (error) {
      return null
    }

    return encoded
  }

  private getAuthConfig(
    refineContext: RefineContextPVM | undefined,
  ): Uint8Array | null {
    // Gray Paper: p.authconfig when p ≠ none ∧ registers[10] = 8
    // Returns work package authorization configuration

    if (!refineContext?.workPackage) {
      return null
    }

    return hexToBytes(refineContext.workPackage.authConfig)
  }

  private getAuthToken(
    refineContext: RefineContextPVM | undefined,
  ): Uint8Array | null {
    // Gray Paper: p.authtoken when p ≠ none ∧ registers[10] = 9
    // Returns work package authorization token

    if (!refineContext?.workPackage) {
      return null
    }

    return hexToBytes(refineContext.workPackage.authToken)
  }

  private getWorkContext(
    refineContext: RefineContextPVM | undefined,
  ): Uint8Array | null {
    // Gray Paper: encode(p.context) when p ≠ none ∧ registers[10] = 10
    // Returns encoded work package context

    if (!refineContext?.workPackage) {
      return null
    }

    // For now, return a placeholder - would need proper context encoding
    return new Uint8Array(32) // Placeholder
  }

  private getWorkItemsSummary(
    refineContext: RefineContextPVM | undefined,
  ): Uint8Array | null {
    // Gray Paper: encode({S(w) | w ∈ p.workitems}) when p ≠ none ∧ registers[10] = 11
    // Returns encoded summary of all work items

    if (!refineContext?.workPackage) {
      return null
    }

    const workItems = refineContext.workPackage.workItems
    const summaries: Uint8Array[] = []

    for (const workItem of workItems) {
      const [error, encoded] = encodeWorkItem(workItem)
      if (error) {
        return null
      }
      summaries.push(encoded)
    }

    // Concatenate all summaries
    const totalLength = summaries.reduce((sum, item) => sum + item.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0

    for (const summary of summaries) {
      result.set(summary, offset)
      offset += summary.length
    }

    return result
  }

  private getWorkItem(
    refineContext: RefineContextPVM | undefined,
    itemIndex: bigint,
  ): Uint8Array | null {
    // Gray Paper: S(p.workitems[registers[11]]) when p ≠ none ∧ registers[10] = 12
    // Returns summary of specific work item (S function)

    if (!refineContext?.workPackage) {
      return null
    }

    const workItems = refineContext.workPackage.workItems
    const itemIdx = Number(itemIndex)

    if (itemIdx >= workItems.length) {
      return null
    }

    const workItem = workItems[itemIdx]

    // Create summary according to Gray Paper S(w) function
    // S(w) = encode{serviceIndex, codeHash, gasLimits, counts, payloadLen}
    const summary = this.createWorkItemSummary(workItem)
    return summary
  }

  private getWorkItemPayload(
    refineContext: RefineContextPVM | undefined,
    itemIndex: bigint,
  ): Uint8Array | null {
    // Gray Paper: p.workitems[registers[11]].payload when p ≠ none ∧ registers[10] = 13
    // Returns payload of specific work item

    if (!refineContext?.workPackage) {
      return null
    }

    const workItems = refineContext.workPackage.workItems
    const itemIdx = Number(itemIndex)

    if (itemIdx >= workItems.length) {
      return null
    }

    const workItem = workItems[itemIdx]
    return workItem.payload
  }

  private getWorkItems(
    refineContext: RefineContextPVM | undefined,
  ): Uint8Array | null {
    // Gray Paper: encode(i) when i ≠ none ∧ registers[10] = 14
    // Returns encoded work items (extrinsics)

    if (!refineContext?.workPackage) {
      return null
    }

    const workItems = refineContext.workPackage.workItems
    const encodedItems: Uint8Array[] = []

    for (const workItem of workItems) {
      const [error, encoded] = encodeWorkItem(workItem)
      if (error) {
        return null
      }
      encodedItems.push(encoded)
    }

    // Concatenate all encoded work items
    const totalLength = encodedItems.reduce((sum, item) => sum + item.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0

    for (const encodedItem of encodedItems) {
      result.set(encodedItem, offset)
      offset += encodedItem.length
    }

    return result
  }

  private getWorkItemByIndex(
    refineContext: RefineContextPVM | undefined,
    itemIndex: bigint,
  ): Uint8Array | null {
    // Gray Paper: encode(i[registers[11]]) when i ≠ none ∧ registers[10] = 15
    // Returns encoded specific work item

    if (!refineContext?.workPackage) {
      return null
    }

    const workItems = refineContext.workPackage.workItems
    const itemIdx = Number(itemIndex)

    if (itemIdx >= workItems.length) {
      return null
    }

    const workItem = workItems[itemIdx]
    const [error, encoded] = encodeWorkItem(workItem)
    if (error) {
      return null
    }

    return encoded
  }

  /**
   * Create work item summary according to Gray Paper S(w) function
   * S(w) = encode{serviceIndex, codeHash, gasLimits, counts, payloadLen}
   */
  private createWorkItemSummary(workItem: WorkItem): Uint8Array {
    // Create a summary buffer with key work item fields
    // This is a simplified implementation - in practice would need full S(w) spec
    const buffer = new ArrayBuffer(64) // Fixed size summary
    const view = new DataView(buffer)
    let offset = 0

    // Encode service index (8 bytes)
    view.setBigUint64(offset, BigInt(workItem.serviceindex || 0), true)
    offset += 8

    // Encode code hash (32 bytes) - simplified
    const codeHashBytes = new Uint8Array(32)
    if (workItem.codehash) {
      const hashBytes = Buffer.from(workItem.codehash.slice(2), 'hex')
      codeHashBytes.set(hashBytes.subarray(0, 32))
    }
    for (let i = 0; i < codeHashBytes.length; i++) {
      view.setUint8(offset + i, codeHashBytes[i])
    }
    offset += 32

    // Encode gas limits (8 bytes)
    view.setBigUint64(offset, BigInt(workItem.refgaslimit || 0), true)
    offset += 8

    // Encode counts (8 bytes) - simplified
    view.setBigUint64(offset, BigInt(workItem.extrinsics?.length || 0), true)
    offset += 8

    // Encode payload length (8 bytes)
    view.setBigUint64(offset, BigInt(workItem.payload?.length || 0), true)

    return new Uint8Array(buffer)
  }
}
