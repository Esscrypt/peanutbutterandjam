/**
 * JIP-3 Telemetry Message Encoder
 *
 * Encodes telemetry messages according to JIP-3 specification using JAM serialization.
 * Each message is sent in two parts:
 * 1. Message size as little-endian 32-bit unsigned integer
 * 2. Message content encoded as per regular JAM serialization
 */

import type { Safe } from '@pbnj/core'
import { numberToBytes, safeError, safeResult } from '@pbnj/core'
import {
  encodeFixedLength,
  encodeNatural,
  encodeVariableLength,
} from '@pbnj/serialization'
import type {
  AccumulateCost,
  BlockOutline,
  ExecCost,
  GuaranteeOutline,
  ImportSpec,
  IsAuthorizedCost,
  NodeInfo,
  RefineCost,
  TelemetryEvent,
  WorkItemOutline,
  WorkPackageOutline,
  WorkReportOutline,
} from '@pbnj/types'

/**
 * Concatenate multiple Uint8Arrays
 */
function concatenateArrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}

/**
 * Safely extract bytes from encoding result
 */
function extractBytes(result: Safe<Uint8Array>): Uint8Array {
  const [error, bytes] = result
  if (error) {
    throw error
  }
  return bytes
}

/**
 * Encode multiple parts and concatenate them safely
 */
function encodeParts(
  ...encoders: (() => Safe<Uint8Array>)[]
): Safe<Uint8Array> {
  try {
    const parts = encoders.map((encoder) => extractBytes(encoder()))
    return safeResult(concatenateArrays(parts))
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Encode string with length prefix and UTF-8 validation
 */
function encodeString(str: string, maxLength: bigint): Safe<Uint8Array> {
  if (str.length > maxLength) {
    return safeError(
      new Error(`String exceeds maximum length of ${maxLength} bytes`),
    )
  }

  const utf8Bytes = new TextEncoder().encode(str)
  if (utf8Bytes.length > maxLength) {
    return safeError(
      new Error(
        `String UTF-8 encoding exceeds maximum length of ${maxLength} bytes`,
      ),
    )
  }

  return encodeVariableLength(utf8Bytes) as Safe<Uint8Array>
}

/**
 * Encode boolean (0 = false, 1 = true)
 */
function encodeBoolean(value: boolean): Uint8Array {
  return new Uint8Array([value ? 1 : 0])
}

/**
 * Encode option type (0 for None, 1 + value for Some)
 */
function encodeOption<T>(
  value: T | undefined,
  encoder: (val: T) => Safe<Uint8Array>,
): Safe<Uint8Array> {
  if (value === undefined) {
    return safeResult(new Uint8Array([0]))
  }

  const [error, encoded] = encoder(value)
  if (error) {
    return safeError(error)
  }
  const result = new Uint8Array(1 + encoded.length)
  result[0] = 1
  result.set(encoded, 1)
  return safeResult(result)
}

/**
 * Encode array with length prefix
 */
function encodeArray<T>(
  array: T[],
  encoder: (item: T) => Safe<Uint8Array>,
): Safe<Uint8Array> {
  try {
    const lengthBytes = extractBytes(encodeNatural(BigInt(array.length)))
    const itemBytes = array.map((item) => extractBytes(encoder(item)))
    return safeResult(concatenateArrays([lengthBytes, ...itemBytes]))
  } catch (error) {
    return safeError(error as Error)
  }
}

/**
 * Encode peer address (IPv6 + port)
 */
function encodePeerAddress(address: {
  address: Uint8Array
  port: bigint
}): Safe<Uint8Array> {
  if (address.address.length !== 16) {
    return safeError(new Error('IPv6 address must be 16 bytes'))
  }

  return encodeParts(
    () => safeResult(address.address),
    () => encodeFixedLength(BigInt(address.port), 2n),
  )
}

/**
 * Encode connection side
 */
function encodeConnectionSide(side: 'local' | 'remote'): Safe<Uint8Array> {
  return safeResult(new Uint8Array([side === 'local' ? 0 : 1]))
}

/**
 * Encode execution cost
 */
function encodeExecCost(cost: ExecCost): Safe<Uint8Array> {
  return encodeParts(
    () => encodeNatural(cost.gasUsed),
    () => encodeNatural(cost.elapsedWallClockTimeNanos),
  )
}

/**
 * Encode is-authorized cost
 */
function encodeIsAuthorizedCost(cost: IsAuthorizedCost): Safe<Uint8Array> {
  return encodeParts(
    () => encodeExecCost(cost.total),
    () => encodeNatural(cost.codeLoadAndCompileTimeNanos),
    () => encodeExecCost(cost.hostCalls),
  )
}

/**
 * Encode refine cost
 */
function encodeRefineCost(cost: RefineCost): Safe<Uint8Array> {
  return encodeParts(
    () => encodeExecCost(cost.total),
    () => encodeNatural(cost.codeLoadAndCompileTimeNanos),
    () => encodeExecCost(cost.historicalLookupCalls),
    () => encodeExecCost(cost.machineExpungeCalls),
    () => encodeExecCost(cost.peekPokePagesCalls),
    () => encodeExecCost(cost.invokeCalls),
    () => encodeExecCost(cost.otherHostCalls),
  )
}

/**
 * Encode accumulate cost
 */
function encodeAccumulateCost(cost: AccumulateCost): Safe<Uint8Array> {
  return encodeParts(
    () => encodeFixedLength(BigInt(cost.accumulateCallCount), 4n),
    () => encodeFixedLength(BigInt(cost.transfersProcessedCount), 4n),
    () => encodeFixedLength(BigInt(cost.itemsAccumulatedCount), 4n),
    () => encodeExecCost(cost.total),
    () => encodeNatural(cost.codeLoadAndCompileTimeNanos),
    () => encodeExecCost(cost.readWriteCalls),
    () => encodeExecCost(cost.lookupCalls),
    () => encodeExecCost(cost.querySolicitForgetProvideCalls),
    () => encodeExecCost(cost.infoNewUpgradeEjectCalls),
    () => encodeExecCost(cost.transferCalls),
    () => encodeNatural(cost.totalGasChargedForTransferProcessing),
    () => encodeExecCost(cost.otherHostCalls),
  )
}

/**
 * Encode import spec
 */
function encodeImportSpec(spec: ImportSpec): Safe<Uint8Array> {
  return encodeParts(
    () => safeResult(spec.rootIdentifier),
    () => encodeFixedLength(BigInt(spec.exportIndex), 2n),
  )
}

/**
 * Encode work item outline
 */
function encodeWorkItemOutline(outline: WorkItemOutline): Safe<Uint8Array> {
  return encodeParts(
    () => encodeFixedLength(BigInt(outline.serviceId), 4n),
    () => encodeFixedLength(BigInt(outline.payloadSize), 4n),
    () => encodeNatural(outline.refineGasLimit),
    () => encodeNatural(outline.accumulateGasLimit),
    () => encodeFixedLength(BigInt(outline.sumOfExtrinsicLengths), 4n),
    () => encodeArray(outline.importSpecs, encodeImportSpec),
    () => encodeFixedLength(BigInt(outline.exportedSegmentCount), 2n),
  )
}

/**
 * Encode work package outline
 */
function encodeWorkPackageOutline(
  outline: WorkPackageOutline,
): Safe<Uint8Array> {
  return encodeParts(
    () => encodeFixedLength(BigInt(outline.sizeInBytes), 4n),
    () => safeResult(outline.workPackageHash),
    () => safeResult(outline.anchor),
    () => encodeFixedLength(BigInt(outline.lookupAnchorSlot), 4n),
    () => encodeArray(outline.prerequisites, (hash) => safeResult(hash)),
    () => encodeArray(outline.workItems, encodeWorkItemOutline),
  )
}

/**
 * Encode work report outline
 */
function encodeWorkReportOutline(outline: WorkReportOutline): Safe<Uint8Array> {
  return encodeParts(
    () => safeResult(outline.workReportHash),
    () => encodeFixedLength(BigInt(outline.bundleSizeInBytes), 4n),
    () => safeResult(outline.erasureRoot),
    () => safeResult(outline.segmentsRoot),
  )
}

/**
 * Encode guarantee outline
 */
function encodeGuaranteeOutline(outline: GuaranteeOutline): Safe<Uint8Array> {
  return encodeParts(
    () => safeResult(outline.workReportHash),
    () => encodeFixedLength(BigInt(outline.slot), 4n),
    () =>
      encodeArray(outline.guarantors, (index) =>
        encodeFixedLength(BigInt(index), 2n),
      ),
  )
}

/**
 * Encode block outline
 */
function encodeBlockOutline(outline: BlockOutline): Safe<Uint8Array> {
  return encodeParts(
    () => encodeFixedLength(BigInt(outline.sizeInBytes), 4n),
    () => safeResult(outline.headerHash),
    () => encodeFixedLength(BigInt(outline.ticketCount), 4n),
    () => encodeFixedLength(BigInt(outline.preimageCount), 4n),
    () => encodeFixedLength(BigInt(outline.preimagesSizeInBytes), 4n),
    () => encodeFixedLength(BigInt(outline.guaranteeCount), 4n),
    () => encodeFixedLength(BigInt(outline.assuranceCount), 4n),
    () => encodeFixedLength(BigInt(outline.disputeVerdictCount), 4n),
  )
}

/**
 * Encode node information message
 */
export function encodeNodeInfo(nodeInfo: NodeInfo): Safe<Uint8Array> {
  return encodeParts(
    () => safeResult(numberToBytes(nodeInfo.protocolVersion)),
    () => safeResult(nodeInfo.peerId), // 32 bytes
    () => encodePeerAddress(nodeInfo.peerAddress),
    () => encodeFixedLength(nodeInfo.nodeFlags, 4n),
    () => encodeString(nodeInfo.implementationName, 32n),
    () => encodeString(nodeInfo.implementationVersion, 32n),
    () => encodeString(nodeInfo.additionalInfo, 512n),
  )
}

/**
 * Helper function to encode simple event data
 */
function encodeSimpleEventData(
  ...encoders: (() => Safe<Uint8Array>)[]
): Safe<Uint8Array> {
  return encodeParts(...encoders)
}

/**
 * Encode telemetry event
 */
export function encodeTelemetryEvent(event: TelemetryEvent): Safe<Uint8Array> {
  const timestampResult = encodeNatural(event.timestamp)
  const [timestampError, timestampBytes] = timestampResult
  if (timestampError) {
    return safeError(timestampError)
  }

  const eventTypeBytes = numberToBytes(event.eventType)

  let eventDataResult: Safe<Uint8Array>

  switch (event.eventType) {
    case 0n: // Dropped
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.lastDroppedTimestamp),
        () => encodeFixedLength(BigInt(event.droppedEventCount), 4n),
      )
      break

    case 10n: // Status
      eventDataResult = encodeSimpleEventData(
        () => encodeFixedLength(BigInt(event.totalPeerCount), 4n),
        () => encodeFixedLength(BigInt(event.validatorPeerCount), 4n),
        () =>
          encodeFixedLength(BigInt(event.blockAnnouncementStreamPeerCount), 4n),
        () => safeResult(event.guaranteesByCore),
        () => encodeFixedLength(BigInt(event.shardCount), 4n),
        () => encodeNatural(event.shardTotalSizeBytes),
        () => encodeFixedLength(BigInt(event.readyPreimageCount), 4n),
        () => encodeFixedLength(BigInt(event.readyPreimageTotalSizeBytes), 4n),
      )
      break

    case 11n: // Best block changed
      eventDataResult = encodeSimpleEventData(
        () => encodeFixedLength(BigInt(event.newBestSlot), 4n),
        () => safeResult(event.newBestHeaderHash),
      )
      break

    case 12n: // Finalized block changed
      eventDataResult = encodeSimpleEventData(
        () => encodeFixedLength(BigInt(event.newFinalizedSlot), 4n),
        () => safeResult(event.newFinalizedHeaderHash),
      )
      break

    case 13n: // Sync status changed
      eventDataResult = safeResult(encodeBoolean(event.isSynced))
      break

    case 20n: // Connection refused
      eventDataResult = encodePeerAddress(event.peerAddress)
      break

    case 21n: // Connecting in
      eventDataResult = encodePeerAddress(event.peerAddress)
      break

    case 22n: // Connect in failed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.connectingInEventId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 23n: // Connected in
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.connectingInEventId),
        () => safeResult(event.peerId),
      )
      break

    case 24n: // Connecting out
      eventDataResult = encodeSimpleEventData(
        () => safeResult(event.peerId),
        () => encodePeerAddress(event.peerAddress),
      )
      break

    case 25n: // Connect out failed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.connectingOutEventId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 26n: // Connected out
      eventDataResult = encodeNatural(event.connectingOutEventId)
      break

    case 27n: // Disconnected
      eventDataResult = encodeSimpleEventData(
        () => safeResult(event.peerId),
        () => encodeOption(event.terminator, encodeConnectionSide),
        () => encodeString(event.reason, 128n),
      )
      break

    case 28n: // Peer misbehaved
      eventDataResult = encodeSimpleEventData(
        () => safeResult(event.peerId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 40n: // Authoring
      eventDataResult = encodeSimpleEventData(
        () => encodeFixedLength(BigInt(event.slot), 4n),
        () => safeResult(event.parentHeaderHash),
      )
      break

    case 41n: // Authoring failed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.authoringEventId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 42n: // Authored
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.authoringEventId),
        () => encodeBlockOutline(event.blockOutline),
      )
      break

    case 43n: // Importing
      eventDataResult = encodeSimpleEventData(
        () => encodeFixedLength(BigInt(event.slot), 4n),
        () => encodeBlockOutline(event.blockOutline),
      )
      break

    case 44n: // Block verification failed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.importingEventId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 45n: // Block verified
      eventDataResult = encodeNatural(event.importingEventId)
      break

    case 46n: // Block execution failed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.authoringOrImportingEventId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 47n: // Block executed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.authoringOrImportingEventId),
        () =>
          encodeArray(event.accumulatedServices, (service) =>
            encodeSimpleEventData(
              () => encodeFixedLength(BigInt(service.serviceId), 4n),
              () => encodeAccumulateCost(service.cost),
            ),
          ),
      )
      break

    // Safrole ticket events (80-84)
    case 80n: // Generating tickets
      eventDataResult = encodeNatural(event.epochIndex)
      break

    case 81n: // Ticket generation failed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.generatingTicketsEventId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 82n: // Tickets generated
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.generatingTicketsEventId),
        () =>
          encodeArray(event.ticketVrfOutputs, (output) => safeResult(output)),
      )
      break

    case 83n: // Ticket transfer failed
      eventDataResult = encodeSimpleEventData(
        () => safeResult(event.peerId),
        () => encodeConnectionSide(event.connectionSide),
        () => safeResult(encodeBoolean(event.wasCe132Used)),
        () => encodeString(event.reason, 128n),
      )
      break

    case 84n: // Ticket transferred
      eventDataResult = encodeSimpleEventData(
        () => safeResult(event.peerId),
        () => encodeConnectionSide(event.connectionSide),
        () => safeResult(encodeBoolean(event.wasCe132Used)),
        () => encodeNatural(event.epochIndex),
        () => safeResult(numberToBytes(event.attemptNumber)),
        () => safeResult(event.vrfOutput),
      )
      break

    // Guaranteeing events (90-113)
    case 90n: // Work-package submission
      eventDataResult = safeResult(event.peerId)
      break

    case 91n: // Work-package being shared
      eventDataResult = safeResult(event.peerId)
      break

    case 92n: // Work-package failed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.workPackageEventId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 93n: // Duplicate work-package
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.workPackageEventId),
        () => encodeFixedLength(event.coreIndex, 2n),
        () => safeResult(event.workPackageHash),
      )
      break

    case 94n: // Work-package received
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.workPackageEventId),
        () => encodeFixedLength(event.coreIndex, 2n),
        () => encodeWorkPackageOutline(event.workPackageOutline),
      )
      break

    case 95n: // Authorized
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.workPackageEventId),
        () => encodeIsAuthorizedCost(event.isAuthorizedCost),
      )
      break

    case 96n: // Extrinsic data received
      eventDataResult = encodeNatural(event.workPackageEventId)
      break

    case 97n: // Imports received
      eventDataResult = encodeNatural(event.workPackageEventId)
      break

    case 98n: // Sharing work-package
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.workPackageSubmissionEventId),
        () => safeResult(event.peerId),
      )
      break

    case 99n: // Work-package sharing failed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.workPackageSubmissionEventId),
        () => safeResult(event.peerId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 100n: // Bundle sent
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.workPackageSubmissionEventId),
        () => safeResult(event.peerId),
      )
      break

    case 101n: // Refined
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.workPackageEventId),
        () => encodeArray(event.refineCosts, encodeRefineCost),
      )
      break

    case 102n: // Work-report built
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.workPackageEventId),
        () => encodeWorkReportOutline(event.workReportOutline),
      )
      break

    case 103n: // Work-report signature sent
      eventDataResult = encodeNatural(event.workPackageBeingSharedEventId)
      break

    case 104n: // Work-report signature received
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.workPackageSubmissionEventId),
        () => safeResult(event.peerId),
      )
      break

    case 105n: // Guarantee built
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.workPackageSubmissionEventId),
        () => encodeGuaranteeOutline(event.guaranteeOutline),
      )
      break

    case 106n: // Sending guarantee
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.guaranteeBuiltEventId),
        () => safeResult(event.peerId),
      )
      break

    case 107n: // Guarantee send failed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.sendingGuaranteeEventId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 108n: // Guarantee sent
      eventDataResult = encodeNatural(event.sendingGuaranteeEventId)
      break

    case 109n: // Guarantees distributed
      eventDataResult = encodeNatural(event.workPackageSubmissionEventId)
      break

    case 110n: // Receiving guarantee
      eventDataResult = safeResult(event.peerId)
      break

    case 111n: // Guarantee receive failed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.receivingGuaranteeEventId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 112n: // Guarantee received
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.receivingGuaranteeEventId),
        () => encodeGuaranteeOutline(event.guaranteeOutline),
      )
      break

    case 113n: // Guarantee discarded
      eventDataResult = encodeSimpleEventData(
        () => encodeGuaranteeOutline(event.guaranteeOutline),
        () => safeResult(numberToBytes(event.discardReason)),
      )
      break

    case 60n: // Block announcement stream opened
      eventDataResult = encodeSimpleEventData(
        () => safeResult(event.peerId),
        () => encodeConnectionSide(event.connectionSide),
      )
      break

    case 61n: // Block announcement stream closed
      eventDataResult = encodeSimpleEventData(
        () => safeResult(event.peerId),
        () => encodeConnectionSide(event.connectionSide),
        () => encodeString(event.reason, 128n),
      )
      break

    case 62n: // Block announced
      eventDataResult = encodeSimpleEventData(
        () => safeResult(event.peerId),
        () => encodeConnectionSide(event.connectionSide),
        () => encodeFixedLength(BigInt(event.slot), 4n),
      )
      break

    case 63n: // Sending block request
      eventDataResult = encodeSimpleEventData(
        () => safeResult(event.peerId),
        () => safeResult(event.headerHash),
        () => encodeString(event.direction, 128n),
      )
      break

    case 64n: // Receiving block request
      eventDataResult = safeResult(event.peerId)
      break

    case 65n: // Block request failed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.blockRequestEventId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 66n: // Block request sent
      eventDataResult = encodeNatural(event.sendingBlockRequestEventId)
      break

    case 67n: // Block request received
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.receivingBlockRequestEventId),
        () => safeResult(event.headerHash),
        () => encodeString(event.direction, 128n),
      )
      break

    case 68n: // Block transferred
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.blockRequestEventId),
        () => encodeFixedLength(BigInt(event.slot), 4n),
        () => encodeBlockOutline(event.blockOutline),
      )
      break

    // Availability distribution events (120-131)
    case 120n: // Sending shard request
      eventDataResult = encodeSimpleEventData(
        () => safeResult(event.peerId),
        () => safeResult(event.erasureRoot),
        () => encodeFixedLength(event.shardIndex, 2n),
      )
      break

    case 121n: // Receiving shard request
      eventDataResult = safeResult(event.peerId)
      break

    case 122n: // Shard request failed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.shardRequestEventId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 123n: // Shard request sent
      eventDataResult = encodeNatural(event.sendingShardRequestEventId)
      break

    case 124n: // Shard request received
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.receivingShardRequestEventId),
        () => safeResult(event.erasureRoot),
        () => encodeFixedLength(event.shardIndex, 2n),
      )
      break

    case 125n: // Shards transferred
      eventDataResult = encodeNatural(event.shardRequestEventId)
      break

    case 126n: // Distributing assurance
      eventDataResult = encodeSimpleEventData(
        () => safeResult(event.assuranceAnchor),
        () => safeResult(event.availabilityBitfield),
      )
      break

    case 127n: // Assurance send failed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.distributingAssuranceEventId),
        () => safeResult(event.peerId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 128n: // Assurance sent
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.distributingAssuranceEventId),
        () => safeResult(event.peerId),
      )
      break

    case 129n: // Assurance distributed
      eventDataResult = encodeNatural(event.distributingAssuranceEventId)
      break

    case 130n: // Assurance receive failed
      eventDataResult = encodeSimpleEventData(
        () => safeResult(event.peerId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 131n: // Assurance received
      eventDataResult = encodeSimpleEventData(
        () => safeResult(event.peerId),
        () => safeResult(event.assuranceAnchor),
      )
      break

    // Bundle recovery events (140-147)
    case 140n: // Sending bundle shard request
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.auditingEventId),
        () => safeResult(event.peerId),
        () => encodeFixedLength(event.shardIndex, 2n),
      )
      break

    case 141n: // Receiving bundle shard request
      eventDataResult = safeResult(event.peerId)
      break

    case 142n: // Bundle shard request failed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.bundleShardRequestEventId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 143n: // Bundle shard request sent
      eventDataResult = encodeNatural(event.sendingBundleShardRequestEventId)
      break

    case 144n: // Bundle shard request received
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.receivingBundleShardRequestEventId),
        () => safeResult(event.erasureRoot),
        () => encodeFixedLength(event.shardIndex, 2n),
      )
      break

    case 145n: // Bundle shard transferred
      eventDataResult = encodeNatural(event.bundleShardRequestEventId)
      break

    case 146n: // Reconstructing bundle
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.auditingEventId),
        () => safeResult(encodeBoolean(event.isTrivialReconstruction)),
      )
      break

    case 147n: // Bundle reconstructed
      eventDataResult = encodeNatural(event.auditingEventId)
      break

    // Segment recovery events (160-172)
    case 160n: // Work-package hash mapped
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.workPackageSubmissionEventId),
        () => safeResult(event.workPackageHash),
        () => safeResult(event.segmentsRoot),
      )
      break

    case 161n: // Segments-root mapped
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.workPackageSubmissionEventId),
        () => safeResult(event.segmentsRoot),
        () => safeResult(event.erasureRoot),
      )
      break

    case 162n: // Sending segment shard request
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.workPackageSubmissionEventId),
        () => safeResult(event.peerId),
        () => safeResult(encodeBoolean(event.wasCe140Used)),
        () =>
          encodeArray(event.segmentShards, (shard) =>
            encodeParts(
              () => encodeFixedLength(shard.importSegmentId, 2n),
              () => encodeFixedLength(shard.shardIndex, 2n),
            ),
          ),
      )
      break

    case 163n: // Receiving segment shard request
      eventDataResult = encodeSimpleEventData(
        () => safeResult(event.peerId),
        () => safeResult(encodeBoolean(event.wasCe140Used)),
      )
      break

    case 164n: // Segment shard request failed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.segmentShardRequestEventId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 165n: // Segment shard request sent
      eventDataResult = encodeNatural(event.sendingSegmentShardRequestEventId)
      break

    case 166n: // Segment shard request received
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.receivingSegmentShardRequestEventId),
        () => encodeFixedLength(event.segmentShardCount, 2n),
      )
      break

    case 167n: // Segment shards transferred
      eventDataResult = encodeNatural(event.segmentShardRequestEventId)
      break

    case 168n: // Reconstructing segments
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.workPackageSubmissionEventId),
        () => encodeArray(event.segmentIds, (id) => encodeFixedLength(id, 2n)),
        () => safeResult(encodeBoolean(event.isTrivialReconstruction)),
      )
      break

    case 169n: // Segment reconstruction failed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.reconstructingSegmentsEventId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 170n: // Segments reconstructed
      eventDataResult = encodeNatural(event.reconstructingSegmentsEventId)
      break

    case 171n: // Segment verification failed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.workPackageSubmissionEventId),
        () =>
          encodeArray(event.failedSegmentIndices, (index) =>
            encodeFixedLength(index, 2n),
          ),
        () => encodeString(event.reason, 128n),
      )
      break

    case 172n: // Segments verified
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.workPackageSubmissionEventId),
        () =>
          encodeArray(event.verifiedSegmentIndices, (index) =>
            encodeFixedLength(index, 2n),
          ),
      )
      break

    // Preimage distribution events (190-199)
    case 190n: // Preimage announcement failed
      eventDataResult = encodeSimpleEventData(
        () => safeResult(event.peerId),
        () => encodeConnectionSide(event.connectionSide),
        () => encodeString(event.reason, 128n),
      )
      break

    case 191n: // Preimage announced
      eventDataResult = encodeSimpleEventData(
        () => safeResult(event.peerId),
        () => encodeConnectionSide(event.connectionSide),
        () => encodeFixedLength(event.requestingServiceId, 4n),
        () => safeResult(event.preimageHash),
        () => encodeFixedLength(event.preimageLength, 4n),
      )
      break

    case 192n: // Announced preimage forgotten
      eventDataResult = encodeSimpleEventData(
        () => encodeFixedLength(event.requestingServiceId, 4n),
        () => safeResult(event.preimageHash),
        () => encodeFixedLength(event.preimageLength, 4n),
        () => safeResult(numberToBytes(event.forgetReason)),
      )
      break

    case 193n: // Sending preimage request
      eventDataResult = encodeSimpleEventData(
        () => safeResult(event.peerId),
        () => safeResult(event.preimageHash),
      )
      break

    case 194n: // Receiving preimage request
      eventDataResult = safeResult(event.peerId)
      break

    case 195n: // Preimage request failed
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.preimageRequestEventId),
        () => encodeString(event.reason, 128n),
      )
      break

    case 196n: // Preimage request sent
      eventDataResult = encodeNatural(event.sendingPreimageRequestEventId)
      break

    case 197n: // Preimage request received
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.receivingPreimageRequestEventId),
        () => safeResult(event.preimageHash),
      )
      break

    case 198n: // Preimage transferred
      eventDataResult = encodeSimpleEventData(
        () => encodeNatural(event.preimageRequestEventId),
        () => encodeFixedLength(event.preimageLength, 4n),
      )
      break

    case 199n: // Preimage discarded
      eventDataResult = encodeSimpleEventData(
        () => safeResult(event.preimageHash),
        () => encodeFixedLength(event.preimageLength, 4n),
        () => safeResult(numberToBytes(event.discardReason)),
      )
      break

    default:
      return safeError(
        new Error(
          `Unsupported event type: ${(event as { eventType: bigint }).eventType}`,
        ),
      )
  }

  const [eventDataError, eventDataBytes] = eventDataResult
  if (eventDataError) {
    return safeError(eventDataError)
  }

  return encodeParts(
    () => safeResult(timestampBytes),
    () => safeResult(eventTypeBytes),
    () => safeResult(eventDataBytes),
  )
}

/**
 * Create complete telemetry message with size prefix
 */
export function createTelemetryMessage(
  messageContent: Uint8Array,
): Safe<Uint8Array> {
  const [error, sizeBytes] = encodeFixedLength(
    BigInt(messageContent.length),
    4n,
  )
  if (error) {
    return safeError(error)
  }
  const result = new Uint8Array(sizeBytes.length + messageContent.length)

  result.set(sizeBytes, 0)
  result.set(messageContent, sizeBytes.length)

  return safeResult(result)
}
