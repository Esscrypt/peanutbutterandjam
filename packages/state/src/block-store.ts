/**
 * Block Store - Database Integration for JAM Blocks (Normalized Schema)
 *
 * Provides storage and retrieval of JAM blocks using fully normalized tables
 * No JSONB usage - all extrinsics stored in dedicated tables
 */

import {
  blake2bHash,
  bytesToHex,
  type Hex,
  hexToBytes,
  type Safe,
  type SafePromise,
  safeError,
  safeResult,
  safeTry,
  zeroHash,
} from '@pbnj/core'
import {
  encodeHeader,
  encodeWorkContext,
  encodeWorkReport,
} from '@pbnj/serialization'
import type {
  Block,
  BlockBody,
  BlockHeader,
  Dispute,
  Guarantee,
  ImportSegment,
  ValidityDispute,
  WorkDigest,
  WorkError,
  WorkResult,
} from '@pbnj/types'
import { avg, count, desc, eq, max, min } from 'drizzle-orm'
import type { CoreDb } from './index'
import {
  assurances,
  blockHeaders,
  blocks,
  challengeDisputes,
  type DbBlockHeader,
  type DbNewAssurance,
  type DbNewBlock,
  type DbNewBlockHeader,
  type DbNewChallengeDispute,
  type DbNewDispute,
  type DbNewEpochMark,
  type DbNewEpochMarkValidator,
  type DbNewFinalityDispute,
  type DbNewGuarantee,
  type DbNewGuaranteeCredential,
  type DbNewJudgment,
  type DbNewOffendersMark,
  type DbNewSafroleTicket,
  type DbNewValidityDispute,
  type DbNewWinnersMark,
  disputes,
  epochMarks,
  epochMarkValidators,
  finalityDisputes,
  guaranteeCredentials,
  guarantees,
  importSegments,
  judgments,
  offendersMarks,
  preimages,
  safroleTickets,
  validityDisputes,
  winnersMarks,
  workDigests,
  workItems,
  workPackages,
  workReports,
} from './schema/core-schema'

/**
 * Block storage status for tracking
 */
export type BlockStatus = 'pending' | 'validated' | 'finalized' | 'orphaned'

/**
 * Block range query options
 */
export interface BlockRangeQuery {
  /** Start timeslot (inclusive) */
  fromTimeslot?: bigint
  /** End timeslot (inclusive) */
  toTimeslot?: bigint
  /** Start block number (inclusive) */
  fromBlockNumber?: bigint
  /** End block number (inclusive) */
  toBlockNumber?: bigint
  /** Filter by author */
  authorIndex?: bigint
  /** Filter by status */
  status?: BlockStatus
}

/**
 * Block statistics
 */
export interface BlockStats {
  totalBlocks: number
  pendingBlocks: number
  validatedBlocks: number
  finalizedBlocks: number
  orphanedBlocks: number
  avgExtrinsicsPerBlock: number
  latestTimeslot: bigint | null
  earliestTimeslot: bigint | null
}

/**
 * Block Store for JAM blocks using normalized schema
 */
export class BlockStore {
  constructor(private db: CoreDb) {}

  /**
   * Calculate block hash from block header
   */
  private calculateBlockHash(header: BlockHeader): Safe<Hex> {
    const [encodedHeaderError, encodedHeader] = encodeHeader(header)
    if (encodedHeaderError) {
      return safeError(encodedHeaderError)
    }
    return blake2bHash(encodedHeader)
  }

  /**
   * Create BlockHeader object directly from joined query results
   */
  private createBlockHeaderFromJoined(
    joinedResults: Array<{
      blockHash: Hex
      parent: Hex
      priorStateRoot: Hex
      extrinsicHash: Hex
      timeslot: bigint
      authorIndex: bigint
      vrfSig: Hex
      sealSig: Hex
      hasEpochMark: boolean
      hasWinnersMark: boolean
      blockNumber: bigint | null
      isGenesis: boolean
      epochMarkId: number | null
      entropyAccumulator: Hex | null
      entropy1: Hex | null
      validatorId: number | null
      validatorIndex: bigint | null
      bandersnatch: Hex | null
      ed25519: Hex | null
      winnersMarkId: number | null
      winnersSequenceIndex: number | null
      winnersTicketId: Hex | null
      winnersEntryIndex: bigint | null
      winnersSignature: Hex | null
      winnersTimestamp: bigint | null
      offendersMarkId: number | null
      offendersSequenceIndex: number | null
      offenderKey: Hex | null
    }>,
  ): BlockHeader {
    if (joinedResults.length === 0) {
      throw new Error('No header data found')
    }

    // Get the base header data from the first row
    const baseHeader = joinedResults[0]

    // Create base header
    const header: BlockHeader = {
      parent: baseHeader.parent,
      priorStateRoot: baseHeader.priorStateRoot,
      extrinsicHash: baseHeader.extrinsicHash,
      timeslot: baseHeader.timeslot,
      authorIndex: baseHeader.authorIndex,
      vrfSig: baseHeader.vrfSig,
      sealSig: baseHeader.sealSig,
      epochMark: null,
      winnersMark: null,
      offendersMark: [],
    }

    // Process epoch mark data
    if (baseHeader.hasEpochMark && baseHeader.epochMarkId) {
      const validators = joinedResults
        .filter((row) => row.validatorId !== null)
        .map((row) => ({
          bandersnatch: row.bandersnatch!,
          ed25519: row.ed25519!,
        }))

      header.epochMark = {
        entropyAccumulator: baseHeader.entropyAccumulator!,
        entropy1: baseHeader.entropy1!,
        validators,
      }
    }

    // Process winners mark data
    if (baseHeader.hasWinnersMark) {
      const winnersMarkData = joinedResults
        .filter((row) => row.winnersMarkId !== null)
        .sort(
          (a, b) =>
            (a.winnersSequenceIndex || 0) - (b.winnersSequenceIndex || 0),
        )
        .map((row) => ({
          id: row.winnersTicketId!,
          entryIndex: row.winnersEntryIndex!,
          signature: row.winnersSignature!,
          timestamp: row.winnersTimestamp!,
        }))

      header.winnersMark = winnersMarkData
    }

    // Process offenders mark data
    const offendersMarkData = joinedResults
      .filter((row) => row.offendersMarkId !== null)
      .sort(
        (a, b) =>
          (a.offendersSequenceIndex || 0) - (b.offendersSequenceIndex || 0),
      )
      .map((row) => row.offenderKey!)

    header.offendersMark = offendersMarkData

    return header
  }

  /**
   * Create BlockBody object directly from joined query results
   */
  private createBlockBodyFromJoined(
    joinedResults: Array<{
      // Safrole tickets fields
      ticketId: number | null
      ticketTicketId: Hex | null
      ticketEntryIndex: bigint | null
      ticketSignature: Hex | null
      ticketTimestamp: bigint | null

      // Preimages fields
      preimageId: number | null
      preimageHash: Hex | null
      preimageServiceIndex: bigint | null
      preimageData: Hex | null

      // Guarantees fields
      guaranteeId: number | null
      guaranteeWorkReportHash: Hex | null
      guaranteeTimeslot: bigint | null
      guaranteeValidatorIndex: bigint | null
      guaranteeSignature: Hex | null
      guaranteePackageHash: Hex | null
      guaranteeContextHash: Hex | null
      guaranteeCoreIndex: number | null
      guaranteeAuthorizerHash: Hex | null
      guaranteeOutput: Hex | null
      guaranteeGasUsed: bigint | null

      // Guarantee credentials fields
      credentialId: number | null
      credentialValidatorIndex: bigint | null
      credentialValue: bigint | null
      credentialSignature: Hex | null

      // Assurances fields
      assuranceId: number | null
      assuranceAnchor: Hex | null
      assuranceAssurer: bigint | null
      assuranceSignature: Hex | null
      assuranceAvailabilities: Hex | null
      assuranceChunkCount: number | null
      assuranceAvailableChunks: number | null

      // Disputes fields
      disputeId: number | null
      disputeSequenceIndex: number | null

      // Validity dispute fields
      validityDisputeId: number | null
      validityReportHash: Hex | null
      validityEpochIndex: bigint | null

      // Judgment fields
      judgmentId: number | null
      judgmentValidity: boolean | null
      judgmentJudgeIndex: bigint | null
      judgmentSignature: Hex | null

      // Challenge dispute fields
      challengeDisputeId: number | null
      challengeData: Hex | null
      challengeChallengerIndex: bigint | null
      challengeTargetValidatorIndex: bigint | null
      challengeEvidence: Hex | null
      challengeSignature: Hex | null

      // Finality dispute fields
      finalityDisputeId: number | null
      finalityData: Hex | null
      finalityDisputerIndex: bigint | null
      finalityContradictionEvidence: Hex | null
      finalitySignature: Hex | null

      // Work report fields
      workReportHash: Hex | null
      workReportCoreIndex: bigint | null
      workReportAuthorizer: Hex | null
      workReportAuthTrace: Hex | null
      workReportAuthGasUsed: bigint | null
      workReportPackageHash: Hex | null
      workReportErasureRoot: Hex | null
      workReportExportsRoot: Hex | null
      workReportExportsCount: number | null
      workReportContextAnchor: Hex | null
      workReportContextState: Hex | null
      workReportContextBelief: Hex | null
      workReportContextEpochMark: Hex | null
      workReportDigestCount: number | null
      workReportSrLookup: string | null
      workReportData: Hex | null
      workReportStatus: string | null

      // Work digest fields
      workDigestServiceIndex: bigint | null
      workDigestCodeHash: Hex | null
      workDigestPayloadHash: Hex | null
      workDigestGasLimit: bigint | null
      workDigestGasUsed: bigint | null
      workDigestResult: Hex | null
      workDigestIsError: boolean | null
      workDigestImportCount: bigint | null
      workDigestExtrinsicCount: bigint | null
      workDigestExtrinsicSize: bigint | null
      workDigestExportCount: bigint | null
      workDigestSequenceIndex: number | null

      // Work package fields
      workPackageHash: Hex | null
      workPackageAuthToken: Hex | null
      workPackageAuthCodeHost: bigint | null
      workPackageAuthCodeHash: Hex | null
      workPackageAuthConfig: Hex | null
      workPackageContextAnchor: Hex | null
      workPackageContextState: Hex | null
      workPackageContextBelief: Hex | null
      workPackageContextEpochMark: Hex | null
      workPackageWorkItemCount: number | null
      workPackageData: Hex | null
      workPackageStatus: string | null
      workPackageCoreIndex: number | null

      // Import segment fields
      importSegmentId: number | null
      importSegmentTreeRoot: Hex | null
      importSegmentIndex: number | null
      importSegmentSequenceIndex: number | null
      importSegmentWorkItemId: number | null
    }>,
  ): BlockBody {
    // Process tickets
    const tickets = joinedResults
      .filter((row) => row.ticketId !== null)
      .map((row) => ({
        id: row.ticketTicketId!,
        entryIndex: row.ticketEntryIndex!,
        timestamp: row.ticketTimestamp!,
      }))

    // Process preimages
    const preimages = joinedResults
      .filter((row) => row.preimageId !== null)
      .map((row) => ({
        serviceIndex: row.preimageServiceIndex!,
        data: row.preimageData!,
      }))

    // Process guarantees with credentials and work reports
    const guaranteeMap = new Map<number, Guarantee>()
    const workReportDigestsMap = new Map<Hex, WorkDigest[]>() // Map work report ID to digests
    const workItemImportSegmentsMap = new Map<number, ImportSegment[]>() // Map work item ID to import segments

    // First, collect work digests by work report ID
    for (const row of joinedResults) {
      if (row.workReportHash !== null) {
        if (!workReportDigestsMap.has(row.workReportHash)) {
          workReportDigestsMap.set(row.workReportHash, [])
        }
        workReportDigestsMap.get(row.workReportHash)!.push({
          serviceIndex: row.workDigestServiceIndex!,
          codeHash: row.workDigestCodeHash!,
          payloadHash: row.workDigestPayloadHash!,
          gasLimit: row.workDigestGasLimit!,
          gasUsed: row.workDigestGasUsed!,
          result: row.workDigestIsError!
            ? (row.workDigestResult! as WorkError)
            : (row.workDigestResult! as WorkResult),
          importCount: row.workDigestImportCount!,
          extrinsicCount: row.workDigestExtrinsicCount!,
          extrinsicSize: row.workDigestExtrinsicSize!,
          exportCount: row.workDigestExportCount!,
        })
      }
    }

    // Second, collect import segments by work item ID
    for (const row of joinedResults) {
      if (row.importSegmentWorkItemId !== null) {
        if (!workItemImportSegmentsMap.has(row.importSegmentWorkItemId)) {
          workItemImportSegmentsMap.set(row.importSegmentWorkItemId, [])
        }
        // Avoid duplicates by checking if this segment is already added
        const segments = workItemImportSegmentsMap.get(
          row.importSegmentWorkItemId,
        )!
        const exists = segments.some(
          (seg: ImportSegment) =>
            seg.treeRoot === row.importSegmentTreeRoot &&
            seg.index === row.importSegmentIndex,
        )
        if (!exists) {
          segments.push({
            treeRoot: row.importSegmentTreeRoot!,
            index: row.importSegmentIndex!,
          })
        }
      }
    }

    // Process guarantees with full work report data
    for (const row of joinedResults) {
      if (row.guaranteeId !== null) {
        if (!guaranteeMap.has(row.guaranteeId)) {
          // Create work report from joined data if available
          const workReport =
            row.workReportHash !== null
              ? {
                  context: {
                    anchorHash:
                      row.workReportContextAnchor || row.guaranteeContextHash!,
                    anchorPostState:
                      row.workReportContextState || row.guaranteeContextHash!,
                    anchorAccoutLog:
                      row.workReportContextBelief || row.guaranteeContextHash!,
                    lookupAnchorHash:
                      row.workReportContextAnchor || row.guaranteeContextHash!,
                    lookupAnchorTime: 0n,
                    prerequisites: [], // TODO: extract from context data
                  },
                  availabilitySpec: {
                    packageHash:
                      row.workReportPackageHash || row.guaranteePackageHash!,
                    bundleLength: 0n, // TODO: get from work package data
                    erasureRoot:
                      row.workReportErasureRoot || row.guaranteeContextHash!,
                    segmentRoot: row.guaranteeContextHash!, // TODO: calculate from segments
                    segmentCount: 0n, // TODO: calculate from segments
                  },
                  coreIndex:
                    row.workReportCoreIndex || BigInt(row.guaranteeCoreIndex!),
                  authorizer:
                    row.workReportAuthorizer || row.guaranteeAuthorizerHash!,
                  authGasUsed:
                    row.workReportAuthGasUsed || row.guaranteeGasUsed!,
                  authTrace: row.workReportAuthTrace
                    ? new Uint8Array(
                        Buffer.from(row.workReportAuthTrace.slice(2), 'hex'),
                      )
                    : new Uint8Array(),
                  srLookup: row.workReportSrLookup
                    ? new Map(
                        Object.entries(JSON.parse(row.workReportSrLookup)),
                      )
                    : new Map(),
                  digests: workReportDigestsMap.get(row.workReportHash) || [],
                }
              : {
                  // Fallback to placeholder data when work report not found
                  context: {
                    anchorHash: row.guaranteeContextHash!,
                    anchorPostState: row.guaranteeContextHash!,
                    anchorAccoutLog: row.guaranteeContextHash!,
                    lookupAnchorHash: row.guaranteeContextHash!,
                    lookupAnchorTime: 0n,
                    prerequisites: [],
                  },
                  availabilitySpec: {
                    packageHash: row.guaranteePackageHash!,
                    bundleLength: 0n,
                    erasureRoot: row.guaranteeContextHash!,
                    segmentRoot: row.guaranteeContextHash!,
                    segmentCount: 0n,
                  },
                  coreIndex: BigInt(row.guaranteeCoreIndex!),
                  authorizer: row.guaranteeAuthorizerHash!,
                  authGasUsed: row.guaranteeGasUsed!,
                  authTrace: new Uint8Array(),
                  srLookup: new Map(),
                  digests: [],
                }

          guaranteeMap.set(row.guaranteeId, {
            workReport,
            timeslot: row.guaranteeTimeslot!,
            credential: [],
          })
        }

        // Add credential if present
        if (row.credentialId && row.credentialSignature) {
          guaranteeMap.get(row.guaranteeId)!.credential.push({
            value: row.credentialValue!,
            signature: row.credentialSignature,
          })
        }
      }
    }
    const guarantees = Array.from(guaranteeMap.values())

    // Process assurances
    const assurances = joinedResults
      .filter((row) => row.assuranceId !== null)
      .map((row) => ({
        anchor: row.assuranceAnchor!,
        availabilities: row.assuranceAvailabilities!,
        assurer: row.assuranceAssurer!,
        signature: row.assuranceSignature!,
      }))

    // Process disputes with all related data
    const disputeMap = new Map<number, Dispute>()
    for (const row of joinedResults) {
      if (row.disputeId !== null) {
        if (!disputeMap.has(row.disputeId)) {
          disputeMap.set(row.disputeId, {
            validityDisputes: [],
            challengeDisputes: '0x0000',
            finalityDisputes: '0x0000',
          })
        }

        const dispute = disputeMap.get(row.disputeId)!

        // Add validity dispute if present
        if (
          row.validityDisputeId !== null &&
          !dispute.validityDisputes.find(
            (vd: ValidityDispute) => vd.reportHash === row.validityReportHash,
          )
        ) {
          const validityDispute: ValidityDispute = {
            reportHash: row.validityReportHash!,
            epochIndex: row.validityEpochIndex!,
            judgments: [],
          }

          // Add judgment if present
          if (row.judgmentId && row.judgmentSignature) {
            validityDispute.judgments.push({
              validity: row.judgmentValidity!,
              judgeIndex: row.judgmentJudgeIndex!,
              signature: row.judgmentSignature,
            })
          }

          dispute.validityDisputes.push(validityDispute)
        }

        // Add challenge dispute if present
        if (
          row.challengeDisputeId !== null &&
          dispute.challengeDisputes.length === 0 &&
          row.challengeData
        ) {
          dispute.challengeDisputes = row.challengeData
        }

        // Add finality dispute if present
        if (
          row.finalityDisputeId !== null &&
          dispute.finalityDisputes.length === 0 &&
          row.finalityData
        ) {
          dispute.finalityDisputes = row.finalityData
        }
      }
    }
    const disputes = Array.from(disputeMap.values())

    return {
      tickets,
      preimages,
      guarantees,
      assurances,
      disputes,
    }
  }

  /**
   * Reconstruct block header with markers from normalized database tables
   */
  private async reconstructBlockHeader(
    headerResult: DbBlockHeader,
  ): Promise<BlockHeader> {
    // Base header fields
    const header: BlockHeader = {
      parent: headerResult.parent,
      priorStateRoot: headerResult.priorStateRoot,
      extrinsicHash: headerResult.extrinsicHash,
      timeslot: headerResult.timeslot,
      authorIndex: headerResult.authorIndex,
      vrfSig: headerResult.vrfSig,
      sealSig: headerResult.sealSig,
      epochMark: null,
      winnersMark: null,
      offendersMark: [],
    }

    const blockHash = headerResult.blockHash

    // Reconstruct epoch mark if present
    if (headerResult.hasEpochMark) {
      const epochMarkResult = await this.db
        .select()
        .from(epochMarks)
        .where(eq(epochMarks.blockHash, blockHash))
        .limit(1)

      if (epochMarkResult.length > 0) {
        const epochMark = epochMarkResult[0]

        // Get validators for this epoch mark
        const validatorsResult = await this.db
          .select()
          .from(epochMarkValidators)
          .where(eq(epochMarkValidators.epochMarkId, epochMark.id))

        const validators = validatorsResult.map((v) => ({
          bandersnatch: v.bandersnatch as Hex,
          ed25519: v.ed25519 as Hex,
        }))

        header.epochMark = {
          entropyAccumulator: epochMark.entropyAccumulator as Hex,
          entropy1: epochMark.entropy1 as Hex,
          validators,
        }
      }
    }

    // Reconstruct winners mark if present
    if (headerResult.hasWinnersMark) {
      const winnersMarkResult = await this.db
        .select({
          sequenceIndex: winnersMarks.sequenceIndex,
          ticketId: safroleTickets.ticketId,
          entryIndex: winnersMarks.entryIndex,
          signature: winnersMarks.signature,
          timestamp: winnersMarks.timestamp,
        })
        .from(winnersMarks)
        .leftJoin(safroleTickets, eq(safroleTickets.id, winnersMarks.ticketId))
        .where(eq(winnersMarks.blockHash, blockHash))

      header.winnersMark = winnersMarkResult.map((w) => ({
        id: w.ticketId as Hex,
        entryIndex: w.entryIndex,
        signature: w.signature as Hex,
        timestamp: w.timestamp,
      }))
    }

    // Reconstruct offenders mark
    const offendersMarkResult = await this.db
      .select()
      .from(offendersMarks)
      .where(eq(offendersMarks.blockHash, blockHash))

    header.offendersMark = offendersMarkResult.map((o) => o.offenderKey as Hex)

    return header
  }

  /**
   * Store a complete block (header + body) in normalized tables
   */
  async storeBlock(
    block: Block,
    status: BlockStatus = 'pending',
  ): Promise<Safe<Hex>> {
    const [blockHashError, blockHash] = this.calculateBlockHash(block.header)
    if (blockHashError) {
      return safeError(blockHashError)
    }

    try {
      await this.db.transaction(async (tx) => {
        // Store block header - direct casting since types match
        const headerData: DbNewBlockHeader = {
          blockHash,
          parent: block.header.parent,
          priorStateRoot: block.header.priorStateRoot,
          extrinsicHash: block.header.extrinsicHash,
          timeslot: block.header.timeslot,
          authorIndex: block.header.authorIndex,
          vrfSig: block.header.vrfSig,
          sealSig: block.header.sealSig,
          hasEpochMark: block.header.epochMark !== null,
          hasWinnersMark: block.header.winnersMark !== null,
          blockNumber: null, // Will be computed later
          isGenesis: block.header.parent === zeroHash,
        }

        await tx.insert(blockHeaders).values(headerData).onConflictDoNothing()

        // Store epoch mark if present
        if (block.header.epochMark) {
          const epochMarkData: DbNewEpochMark = {
            blockHash,
            entropyAccumulator: block.header.epochMark.entropyAccumulator,
            entropy1: block.header.epochMark.entropy1,
          }

          const [epochMarkResult] = await tx
            .insert(epochMarks)
            .values(epochMarkData)
            .returning({ id: epochMarks.id })
            .onConflictDoNothing()

          if (epochMarkResult && block.header.epochMark.validators) {
            const validatorData: DbNewEpochMarkValidator[] =
              block.header.epochMark.validators.map((validator, index) => ({
                epochMarkId: epochMarkResult.id,
                validatorIndex: BigInt(index),
                bandersnatch: validator.bandersnatch,
                ed25519: validator.ed25519,
              }))

            await tx
              .insert(epochMarkValidators)
              .values(validatorData)
              .onConflictDoNothing()
          }
        }

        // Store winners mark if present
        if (block.header.winnersMark && block.header.winnersMark.length > 0) {
          const winnersMarkData: DbNewWinnersMark[] = []

          for (
            let index = 0;
            index < block.header.winnersMark.length;
            index++
          ) {
            const ticket = block.header.winnersMark[index]

            // Find the corresponding safrole ticket ID
            const safroleTicket = await tx
              .select({ id: safroleTickets.id })
              .from(safroleTickets)
              .where(eq(safroleTickets.ticketId, ticket.id))
              .limit(1)

            if (safroleTicket.length > 0) {
              winnersMarkData.push({
                blockHash,
                sequenceIndex: index,
                ticketId: safroleTicket[0].id,
                entryIndex: ticket.entryIndex,
                signature: ticket.signature,
                timestamp: ticket.timestamp,
              })
            }
          }

          if (winnersMarkData.length > 0) {
            await tx
              .insert(winnersMarks)
              .values(winnersMarkData)
              .onConflictDoNothing()
          }
        }

        // Store offenders mark if present
        if (
          block.header.offendersMark &&
          block.header.offendersMark.length > 0
        ) {
          const offendersMarkData: DbNewOffendersMark[] =
            block.header.offendersMark.map((offenderKey, index) => ({
              blockHash,
              sequenceIndex: index,
              offenderKey,
            }))

          await tx
            .insert(offendersMarks)
            .values(offendersMarkData)
            .onConflictDoNothing()
        }

        // Store safrole tickets
        if (block.body.tickets.length > 0) {
          const ticketData: DbNewSafroleTicket[] = block.body.tickets.map(
            (ticket, _index) => ({
              blockHash,
              ticketId: ticket.id,
              entryIndex: ticket.entryIndex,
              signature: zeroHash, // TODO
              timestamp: ticket.timestamp || 0n,
            }),
          )
          await tx
            .insert(safroleTickets)
            .values(ticketData)
            .onConflictDoNothing()
        }

        // Store preimages
        if (block.body.preimages.length > 0) {
          const preimageData = block.body.preimages
            .map((preimage) => {
              const [error, preimageHash] = blake2bHash(
                hexToBytes(preimage.data),
              )
              if (error || !preimageHash) {
                return null
              }
              return {
                blockHash,
                hash: preimageHash,
                serviceIndex: preimage.serviceIndex,
                data: preimage.data,
                length: preimage.data.length,
              }
            })
            .filter((preimage) => preimage !== null)

          await tx.insert(preimages).values(preimageData).onConflictDoNothing()
        }

        // Store guarantees
        if (block.body.guarantees.length > 0) {
          const guaranteeData = block.body.guarantees
            .map((guarantee) => {
              const [error, workReportEncoded] = encodeWorkReport(
                guarantee.workReport,
              )
              if (error) {
                return null
              }
              const [encodeError, workReportHash] =
                blake2bHash(workReportEncoded)
              if (encodeError || !workReportHash) {
                return null
              }
              const [encodeError2, contextEncoded] = encodeWorkContext(
                guarantee.workReport.context,
              )
              if (encodeError2 || !contextEncoded) {
                return null
              }
              const [hashError2, contextHash] = blake2bHash(contextEncoded)
              if (hashError2 || !contextHash) {
                return null
              }
              return {
                blockHash,
                workReportHash,
                timeslot: guarantee.timeslot,
                validatorIndex: guarantee.credential[0].value,
                signature: guarantee.credential[0].signature,
                packageHash: guarantee.workReport.availabilitySpec.packageHash,
                contextHash,
                coreIndex: Number(guarantee.workReport.coreIndex),
                authorizerHash: guarantee.workReport.authorizer,
                output:
                  typeof guarantee.workReport.digests[0].result === 'string'
                    ? (guarantee.workReport.digests[0].result as Hex)
                    : bytesToHex(
                        guarantee.workReport.digests[0].result as Uint8Array,
                      ),
                gasUsed: guarantee.workReport.authGasUsed,
              }
            })
            .filter((guarantee) => guarantee !== null)

          const guaranteeInsert: DbNewGuarantee[] = await tx
            .insert(guarantees)
            .values(guaranteeData)
            .onConflictDoNothing()

          // Store guarantee credentials
          const credentialData: DbNewGuaranteeCredential[] = []
          block.body.guarantees.forEach((guarantee, gIndex) => {
            guarantee.credential.forEach((cred) => {
              credentialData.push({
                guaranteeId: guaranteeInsert[gIndex].id!,
                validatorIndex: cred.value,
                value: cred.value,
                signature: cred.signature,
              })
            })
          })
          if (credentialData.length > 0) {
            await tx
              .insert(guaranteeCredentials)
              .values(credentialData)
              .onConflictDoNothing()
          }
        }

        // Store assurances
        if (block.body.assurances.length > 0) {
          const assuranceData: DbNewAssurance[] = block.body.assurances.map(
            (assurance, _index) => ({
              blockHash,
              anchor: assurance.anchor,
              assurer: assurance.assurer,
              signature: assurance.signature,
              availabilities: assurance.availabilities,
              chunkCount: assurance.availabilities.length * 8,
              availableChunks: Buffer.from(assurance.availabilities).filter(
                (b) => b !== 0,
              ).length,
            }),
          )
          await tx
            .insert(assurances)
            .values(assuranceData)
            .onConflictDoNothing()
        }

        // Store disputes with normalized structure
        if (block.body.disputes.length > 0) {
          for (
            let disputeIndex = 0;
            disputeIndex < block.body.disputes.length;
            disputeIndex++
          ) {
            const dispute = block.body.disputes[disputeIndex]

            // Insert main dispute record
            const disputeData: DbNewDispute = {
              blockHash,
              sequenceIndex: disputeIndex,
            }

            const [disputeResult] = await tx
              .insert(disputes)
              .values(disputeData)
              .returning({ id: disputes.id })
              .onConflictDoNothing()

            //  TODO: throw error if disputeResult is null
            if (!disputeResult) continue

            const disputeId = disputeResult.id

            // Store validity disputes
            if (
              dispute.validityDisputes &&
              dispute.validityDisputes.length > 0
            ) {
              for (const validityDispute of dispute.validityDisputes) {
                const validityDisputeData: DbNewValidityDispute = {
                  disputeId,
                  reportHash: validityDispute.reportHash,
                  epochIndex: validityDispute.epochIndex,
                }

                const [validityDisputeResult] = await tx
                  .insert(validityDisputes)
                  .values(validityDisputeData)
                  .returning({ id: validityDisputes.id })
                  .onConflictDoNothing()

                if (!validityDisputeResult) continue

                const validityDisputeId = validityDisputeResult.id

                // Store judgments for this validity dispute
                if (
                  validityDispute.judgments &&
                  validityDispute.judgments.length > 0
                ) {
                  const judgmentData: DbNewJudgment[] =
                    validityDispute.judgments.map((judgment) => ({
                      validityDisputeId,
                      validity: judgment.validity,
                      judgeIndex: judgment.judgeIndex,
                      signature: judgment.signature,
                    }))

                  await tx
                    .insert(judgments)
                    .values(judgmentData)
                    .onConflictDoNothing()
                }
              }
            }

            // Store challenge disputes
            if (
              dispute.challengeDisputes &&
              dispute.challengeDisputes.length > 0
            ) {
              const challengeDisputeData: DbNewChallengeDispute = {
                disputeId,
                challengeData: dispute.challengeDisputes,
                challengerIndex: 0n, // TODO: Extract from challenge data
                targetValidatorIndex: 0n, // TODO: Extract from challenge data
                evidence: dispute.challengeDisputes, // Raw data as evidence for now
                signature: dispute.challengeDisputes, // TODO: Extract signature from challenge data
              }

              await tx
                .insert(challengeDisputes)
                .values(challengeDisputeData)
                .onConflictDoNothing()
            }

            // Store finality disputes
            if (
              dispute.finalityDisputes &&
              dispute.finalityDisputes.length > 0
            ) {
              const finalityDisputeData: DbNewFinalityDispute = {
                disputeId,
                finalityData: dispute.finalityDisputes,
                disputerIndex: 0n, // TODO: Extract from finality data
                contradictionEvidence: dispute.finalityDisputes, // Raw data as evidence for now
                signature: '0x0000', // TODO: Extract signature from finality data
              }

              await tx
                .insert(finalityDisputes)
                .values(finalityDisputeData)
                .onConflictDoNothing()
            }
          }
        }

        // Store block summary
        const totalExtrinsics =
          block.body.tickets.length +
          block.body.preimages.length +
          block.body.guarantees.length +
          block.body.assurances.length +
          block.body.disputes.length

        const blockData: DbNewBlock = {
          blockHash,
          timeslot: block.header.timeslot,
          blockNumber: null, // Will be computed later
          authorIndex: block.header.authorIndex,
          ticketCount: block.body.tickets.length,
          preimageCount: block.body.preimages.length,
          guaranteeCount: block.body.guarantees.length,
          assuranceCount: block.body.assurances.length,
          disputeCount: block.body.disputes.length,
          totalExtrinsics,
          status,
        }

        await tx.insert(blocks).values(blockData).onConflictDoNothing()
      })

      return safeResult(blockHash)
    } catch (error) {
      return safeError(new Error(`Failed to store block: ${error}`))
    }
  }

  /**
   * Store only block header
   */
  async storeBlockHeader(header: BlockHeader): Promise<Safe<Hex>> {
    const [blockHashError, blockHash] = this.calculateBlockHash(header)
    if (blockHashError) {
      return safeError(blockHashError)
    }

    try {
      const headerData: DbNewBlockHeader = {
        blockHash,
        parent: header.parent,
        priorStateRoot: header.priorStateRoot,
        extrinsicHash: header.extrinsicHash,
        timeslot: header.timeslot,
        authorIndex: header.authorIndex,
        vrfSig: header.vrfSig,
        sealSig: header.sealSig,
        hasEpochMark: header.epochMark !== null,
        hasWinnersMark: header.winnersMark !== null,
        blockNumber: null,
        isGenesis: header.parent === `0x${'00'.repeat(32)}`,
      }

      await this.db
        .insert(blockHeaders)
        .values(headerData)
        .onConflictDoNothing()
      return safeResult(blockHash)
    } catch (error) {
      return safeError(new Error(`Failed to store block header: ${error}`))
    }
  }

  /**
   * Get child block by parent hash - reuses getBlock functionality
   */
  async getChildBlock(parentHash: Hex): SafePromise<Block | null> {
    // Find the child block by looking up the parent hash
    const [error, childResult] = await safeTry(
      this.db
        .select({ blockHash: blockHeaders.blockHash })
        .from(blockHeaders)
        .where(eq(blockHeaders.parent, parentHash))
        .limit(1),
    )
    if (error) {
      return safeError(error)
    }

    if (childResult.length === 0)
      return safeError(new Error('Child block not found'))

    // Reuse the existing getBlock method to get the full block
    return this.getBlock(childResult[0].blockHash)
  }

  /**
   * Get parent block by child hash - reuses getBlock functionality
   */
  async getParentBlock(childHash: Hex): SafePromise<Block | null> {
    // First get the child block to find its parent hash
    const [error, childResult] = await safeTry(
      this.db
        .select({ parent: blockHeaders.parent })
        .from(blockHeaders)
        .where(eq(blockHeaders.blockHash, childHash))
        .limit(1),
    )
    if (error) {
      return safeError(error)
    }

    if (childResult.length === 0)
      return safeError(new Error('Child block not found'))

    const parentHash = childResult[0].parent

    // Check if this is a genesis block (no parent)
    if (parentHash === zeroHash)
      return safeError(new Error('Parent block not found'))

    // Reuse the existing getBlock method to get the full parent block
    return this.getBlock(parentHash)
  }

  /**
   * Get block by hash - reconstructed from normalized tables using a single query with all joins
   */
  async getBlock(blockHash: Hex): SafePromise<Block | null> {
    // Get all block data (header + extrinsics) in a single query with LEFT JOINs
    const [error, blockResult] = await safeTry(
      this.db
        .select({
          // Block header fields
          blockHash: blockHeaders.blockHash,
          parent: blockHeaders.parent,
          priorStateRoot: blockHeaders.priorStateRoot,
          extrinsicHash: blockHeaders.extrinsicHash,
          timeslot: blockHeaders.timeslot,
          authorIndex: blockHeaders.authorIndex,
          vrfSig: blockHeaders.vrfSig,
          sealSig: blockHeaders.sealSig,
          hasEpochMark: blockHeaders.hasEpochMark,
          hasWinnersMark: blockHeaders.hasWinnersMark,
          blockNumber: blockHeaders.blockNumber,
          isGenesis: blockHeaders.isGenesis,

          // Epoch mark fields
          epochMarkId: epochMarks.id,
          entropyAccumulator: epochMarks.entropyAccumulator,
          entropy1: epochMarks.entropy1,

          // Epoch mark validator fields
          validatorId: epochMarkValidators.id,
          validatorIndex: epochMarkValidators.validatorIndex,
          bandersnatch: epochMarkValidators.bandersnatch,
          ed25519: epochMarkValidators.ed25519,

          // Winners mark fields
          winnersMarkId: winnersMarks.id,
          winnersSequenceIndex: winnersMarks.sequenceIndex,
          winnersTicketId: safroleTickets.ticketId,
          winnersEntryIndex: winnersMarks.entryIndex,
          winnersSignature: winnersMarks.signature,
          winnersTimestamp: winnersMarks.timestamp,

          // Offenders mark fields
          offendersMarkId: offendersMarks.id,
          offendersSequenceIndex: offendersMarks.sequenceIndex,
          offenderKey: offendersMarks.offenderKey,

          // Safrole tickets fields
          ticketId: safroleTickets.id,
          ticketTicketId: safroleTickets.ticketId,
          ticketEntryIndex: safroleTickets.entryIndex,
          ticketSignature: safroleTickets.signature,
          ticketTimestamp: safroleTickets.timestamp,

          // Preimages fields
          preimageId: preimages.id,
          preimageHash: preimages.hash,
          preimageServiceIndex: preimages.serviceIndex,
          preimageData: preimages.data,

          // Guarantees fields
          guaranteeId: guarantees.id,
          guaranteeWorkReportHash: guarantees.workReportHash,
          guaranteeTimeslot: guarantees.timeslot,
          guaranteeValidatorIndex: guarantees.validatorIndex,
          guaranteeSignature: guarantees.signature,
          guaranteePackageHash: guarantees.packageHash,
          guaranteeContextHash: guarantees.contextHash,
          guaranteeCoreIndex: guarantees.coreIndex,
          guaranteeAuthorizerHash: guarantees.authorizerHash,
          guaranteeOutput: guarantees.output,
          guaranteeGasUsed: guarantees.gasUsed,

          // Guarantee credentials fields
          credentialId: guaranteeCredentials.id,
          credentialValidatorIndex: guaranteeCredentials.validatorIndex,
          credentialValue: guaranteeCredentials.value,
          credentialSignature: guaranteeCredentials.signature,

          // Assurances fields
          assuranceId: assurances.id,
          assuranceAnchor: assurances.anchor,
          assuranceAssurer: assurances.assurer,
          assuranceSignature: assurances.signature,
          assuranceAvailabilities: assurances.availabilities,
          assuranceChunkCount: assurances.chunkCount,
          assuranceAvailableChunks: assurances.availableChunks,

          // Disputes fields
          disputeId: disputes.id,
          disputeSequenceIndex: disputes.sequenceIndex,

          // Validity dispute fields
          validityDisputeId: validityDisputes.id,
          validityReportHash: validityDisputes.reportHash,
          validityEpochIndex: validityDisputes.epochIndex,

          // Judgment fields
          judgmentId: judgments.id,
          judgmentValidity: judgments.validity,
          judgmentJudgeIndex: judgments.judgeIndex,
          judgmentSignature: judgments.signature,

          // Challenge dispute fields
          challengeDisputeId: challengeDisputes.id,
          challengeData: challengeDisputes.challengeData,
          challengeChallengerIndex: challengeDisputes.challengerIndex,
          challengeTargetValidatorIndex: challengeDisputes.targetValidatorIndex,
          challengeEvidence: challengeDisputes.evidence,
          challengeSignature: challengeDisputes.signature,

          // Finality dispute fields
          finalityDisputeId: finalityDisputes.id,
          finalityData: finalityDisputes.finalityData,
          finalityDisputerIndex: finalityDisputes.disputerIndex,
          finalityContradictionEvidence: finalityDisputes.contradictionEvidence,
          finalitySignature: finalityDisputes.signature,

          // Work report fields (from guarantees)
          workReportHash: workReports.reportHash,
          workReportCoreIndex: workReports.coreIndex,
          workReportAuthorizer: workReports.authorizer,
          workReportAuthTrace: workReports.authTrace,
          workReportAuthGasUsed: workReports.authGasUsed,
          workReportPackageHash: workReports.packageHash,
          workReportErasureRoot: workReports.erasureRoot,
          workReportExportsRoot: workReports.exportsRoot,
          workReportExportsCount: workReports.exportsCount,
          workReportContextAnchor: workReports.contextAnchor,
          workReportContextState: workReports.contextState,
          workReportContextBelief: workReports.contextBelief,
          workReportContextEpochMark: workReports.contextEpochMark,
          workReportDigestCount: workReports.digestCount,
          workReportSrLookup: workReports.srLookup,
          workReportData: workReports.data,
          workReportStatus: workReports.status,

          // Work digest fields
          workDigestId: workDigests.id,
          workDigestServiceIndex: workDigests.serviceIndex,
          workDigestCodeHash: workDigests.codeHash,
          workDigestPayloadHash: workDigests.payloadHash,
          workDigestGasLimit: workDigests.gasLimit,
          workDigestGasUsed: workDigests.gasUsed,
          workDigestResult: workDigests.result,
          workDigestIsError: workDigests.isError,
          workDigestImportCount: workDigests.importCount,
          workDigestExtrinsicCount: workDigests.extrinsicCount,
          workDigestExtrinsicSize: workDigests.extrinsicSize,
          workDigestExportCount: workDigests.exportCount,
          workDigestSequenceIndex: workDigests.sequenceIndex,

          // Work package fields (from work reports)
          workPackageHash: workPackages.packageHash,
          workPackageAuthToken: workPackages.authToken,
          workPackageAuthCodeHost: workPackages.authCodeHost,
          workPackageAuthCodeHash: workPackages.authCodeHash,
          workPackageAuthConfig: workPackages.authConfig,
          workPackageContextAnchor: workPackages.contextAnchor,
          workPackageContextState: workPackages.contextState,
          workPackageContextBelief: workPackages.contextBelief,
          workPackageContextEpochMark: workPackages.contextEpochMark,
          workPackageWorkItemCount: workPackages.workItemCount,
          workPackageData: workPackages.data,
          workPackageStatus: workPackages.status,
          workPackageCoreIndex: workPackages.coreIndex,

          // Import segment fields
          importSegmentId: importSegments.id,
          importSegmentTreeRoot: importSegments.treeRoot,
          importSegmentIndex: importSegments.index,
          importSegmentSequenceIndex: importSegments.sequenceIndex,
          importSegmentWorkItemId: importSegments.workItemId,
        })
        .from(blockHeaders)
        // Header-related joins
        .leftJoin(epochMarks, eq(epochMarks.blockHash, blockHeaders.blockHash))
        .leftJoin(
          epochMarkValidators,
          eq(epochMarkValidators.epochMarkId, epochMarks.id),
        )
        .leftJoin(
          winnersMarks,
          eq(winnersMarks.blockHash, blockHeaders.blockHash),
        )
        .leftJoin(safroleTickets, eq(safroleTickets.id, winnersMarks.ticketId))
        .leftJoin(
          offendersMarks,
          eq(offendersMarks.blockHash, blockHeaders.blockHash),
        )
        // Extrinsic-related joins
        .leftJoin(preimages, eq(preimages.blockHash, blockHeaders.blockHash))
        .leftJoin(guarantees, eq(guarantees.blockHash, blockHeaders.blockHash))
        .leftJoin(
          guaranteeCredentials,
          eq(guaranteeCredentials.guaranteeId, guarantees.id),
        )
        .leftJoin(assurances, eq(assurances.blockHash, blockHeaders.blockHash))
        .leftJoin(disputes, eq(disputes.blockHash, blockHeaders.blockHash))
        .leftJoin(validityDisputes, eq(validityDisputes.disputeId, disputes.id))
        .leftJoin(
          judgments,
          eq(judgments.validityDisputeId, validityDisputes.id),
        )
        .leftJoin(
          challengeDisputes,
          eq(challengeDisputes.disputeId, disputes.id),
        )
        .leftJoin(finalityDisputes, eq(finalityDisputes.disputeId, disputes.id))
        // Work-related joins (via guarantees)
        .leftJoin(
          workReports,
          eq(workReports.reportHash, guarantees.workReportHash),
        )
        .leftJoin(
          workDigests,
          eq(workDigests.workReportHash, workReports.reportHash),
        )
        .leftJoin(
          workPackages,
          eq(workPackages.packageHash, workReports.packageHash),
        )
        .leftJoin(
          workItems,
          eq(workItems.workPackageHash, workPackages.packageHash),
        )
        .leftJoin(importSegments, eq(importSegments.workItemId, workItems.id))
        .where(eq(blockHeaders.blockHash, blockHash)),
    )
    if (error) {
      return safeError(error)
    }

    if (blockResult.length === 0) return safeError(new Error('Block not found'))

    // Create BlockHeader object directly from joined data
    const header = this.createBlockHeaderFromJoined(blockResult)

    // Create BlockBody object directly from joined data
    const body = this.createBlockBodyFromJoined(blockResult)

    return safeResult({ header, body })
  }

  /**
   * Get block header by hash
   */
  async getBlockHeader(blockHash: Hex): Promise<BlockHeader | null> {
    try {
      const result = await this.db
        .select()
        .from(blockHeaders)
        .where(eq(blockHeaders.blockHash, blockHash))
        .limit(1)

      if (result.length === 0) return null

      // Reconstruct header with normalized markers
      return await this.reconstructBlockHeader(result[0])
    } catch (error) {
      console.error('Failed to get block header:', error)
      return null
    }
  }

  /**
   * Update block status
   */
  async updateBlockStatus(
    blockHash: Hex,
    status: BlockStatus,
  ): Promise<boolean> {
    try {
      await this.db
        .update(blocks)
        .set({
          status,
          finalizedAt: status === 'finalized' ? new Date() : undefined,
        })
        .where(eq(blocks.blockHash, blockHash))

      return true
    } catch (error) {
      console.error('Failed to update block status:', error)
      return false
    }
  }

  /**
   * Get latest finalized block
   */
  async getLatestFinalizedBlock(): SafePromise<Block | null> {
    const [error, result] = await safeTry(
      this.db
        .select()
        .from(blocks)
        .where(eq(blocks.status, 'finalized'))
        .orderBy(desc(blocks.timeslot))
        .limit(1),
    )
    if (error) {
      return safeError(error)
    }

    if (result.length === 0)
      return safeError(new Error('Latest finalized block not found'))

    return this.getBlock(result[0].blockHash)
  }

  /**
   * Get block statistics
   */
  async getBlockStats(): Promise<BlockStats> {
    try {
      const [
        totalResult,
        pendingResult,
        validatedResult,
        finalizedResult,
        orphanedResult,
        timeslotRangeResult,
      ] = await Promise.all([
        this.db.select({ count: count() }).from(blocks),
        this.db
          .select({ count: count() })
          .from(blocks)
          .where(eq(blocks.status, 'pending')),
        this.db
          .select({ count: count() })
          .from(blocks)
          .where(eq(blocks.status, 'validated')),
        this.db
          .select({ count: count() })
          .from(blocks)
          .where(eq(blocks.status, 'finalized')),
        this.db
          .select({ count: count() })
          .from(blocks)
          .where(eq(blocks.status, 'orphaned')),
        this.db
          .select({
            minTimeslot: min(blocks.timeslot),
            maxTimeslot: max(blocks.timeslot),
            avgExtrinsics: avg(blocks.totalExtrinsics),
          })
          .from(blocks),
      ])

      return {
        totalBlocks: totalResult[0]?.count || 0,
        pendingBlocks: pendingResult[0]?.count || 0,
        validatedBlocks: validatedResult[0]?.count || 0,
        finalizedBlocks: finalizedResult[0]?.count || 0,
        orphanedBlocks: orphanedResult[0]?.count || 0,
        avgExtrinsicsPerBlock: Number(
          timeslotRangeResult[0]?.avgExtrinsics || 0,
        ),
        latestTimeslot: timeslotRangeResult[0]?.maxTimeslot || null,
        earliestTimeslot: timeslotRangeResult[0]?.minTimeslot || null,
      }
    } catch (error) {
      console.error('Failed to get block stats:', error)
      return {
        totalBlocks: 0,
        pendingBlocks: 0,
        validatedBlocks: 0,
        finalizedBlocks: 0,
        orphanedBlocks: 0,
        avgExtrinsicsPerBlock: 0,
        latestTimeslot: null,
        earliestTimeslot: null,
      }
    }
  }

  /**
   * Check if block exists
   */
  async hasBlock(blockHash: Hex): Promise<boolean> {
    try {
      const result = await this.db
        .select({ count: count() })
        .from(blockHeaders)
        .where(eq(blockHeaders.blockHash, blockHash))

      return (result[0]?.count || 0) > 0
    } catch (error) {
      console.error('Failed to check block existence:', error)
      return false
    }
  }

  /**
   * Delete block (mark as orphaned)
   */
  async deleteBlock(blockHash: Hex): Promise<boolean> {
    return this.updateBlockStatus(blockHash, 'orphaned')
  }
}
