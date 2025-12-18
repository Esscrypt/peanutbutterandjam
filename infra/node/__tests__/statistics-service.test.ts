/**
 * Statistics Service Test Vectors
 *
 * Loads JAM statistics test vectors (tiny/full) and runs a minimal
 * state transition on StatisticsService by emitting a BlockProcessedEvent.
 *
 * Mirrors the style of disputes.test.ts for loading and setup.
 */

import { describe, it, expect } from 'bun:test'
import { EventBusService, hexToBytes, type Hex } from '@pbnjam/core'
import { getTicketIdFromProof } from '@pbnjam/safrole'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { BlockBody, BlockHeader, WorkReport, StatisticsTestVector } from '@pbnjam/types'
import { ConfigService } from '../services/config-service'
import { StatisticsService } from '../services/statistics-service'
import { ClockService } from '../services/clock-service'

const WORKSPACE_ROOT = path.join(__dirname, '../../../')

function loadStatisticsVectors(
  config: 'tiny' | 'full',
): Array<{ name: string; vector: StatisticsTestVector }> {
  const dir = path.join(
    WORKSPACE_ROOT,
    `submodules/jam-test-vectors/stf/statistics/${config}`,
  )

  const files = fs.readdirSync(dir)
  const jsonFiles = files.filter((f) => f.endsWith('.json'))

  return jsonFiles.map((file) => {
    const filePath = path.join(dir, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const vector = JSON.parse(content) as StatisticsTestVector
    return { name: file.replace('.json', ''), vector }
  })
}

// Helper: convert JSON WorkReport (numbers) to WorkReport with bigint fields where required
function convertJsonReportToWorkReport(jsonReport: any): WorkReport {
  return {
    ...jsonReport,
    core_index: BigInt(jsonReport.core_index || 0),
    auth_gas_used: BigInt(jsonReport.auth_gas_used || 0),
    context: {
      ...jsonReport.context,
      lookup_anchor_slot: BigInt(jsonReport.context?.lookup_anchor_slot || 0),
    },
    results: (jsonReport.results || []).map((r: any) => ({
      ...r,
      service_id: BigInt(r.service_id || 0),
      accumulate_gas: BigInt(r.accumulate_gas || 0),
      refine_load: {
        ...r.refine_load,
        gas_used: BigInt(r.refine_load?.gas_used || 0),
        imports: BigInt(r.refine_load?.imports || 0),
        extrinsic_count: BigInt(r.refine_load?.extrinsic_count || 0),
        extrinsic_size: BigInt(r.refine_load?.extrinsic_size || 0),
        exports: BigInt(r.refine_load?.exports || 0),
      },
    })),
  }
}

describe('Statistics Service - JAM Test Vectors', () => {
  for (const configType of ['tiny', 'full'] as const) {
    describe(`Configuration: ${configType}`, () => {
      const vectors = loadStatisticsVectors(configType)

      it('should load statistics vectors', () => {
        expect(vectors.length).toBeGreaterThan(0)
      })

      for (const { name, vector } of vectors) {
        it(`Statistics Vector: ${name}`, async () => {
          const eventBusService = new EventBusService()
          const configService = new ConfigService(configType)
          const clockService = new ClockService({eventBusService: eventBusService, configService: configService})
          const statsService = new StatisticsService({eventBusService: eventBusService, configService: configService, clockService: clockService})
          // Initialize activity from pre_state BEFORE starting to avoid any accidental resets
          statsService.setActivityFromPreState({
            vals_curr_stats: vector.pre_state.vals_curr_stats,
            vals_last_stats: vector.pre_state.vals_last_stats,
          })
          statsService.start()

          // Construct a minimal BlockHeader using vector input
          const zero: Hex =
            '0x0000000000000000000000000000000000000000000000000000000000000000'
          const header: BlockHeader = {
            parent: zero,
            priorStateRoot: zero,
            extrinsicHash: zero,
            timeslot: BigInt(vector.input.slot),
            epochMark: null,
            winnersMark: null,
            offendersMark: [],
            authorIndex: BigInt(vector.input.author_index),
            vrfSig: zero,
            sealSig: zero,
          }

          // Build BlockBody from extrinsic fields where types align
          const body: BlockBody = {
            tickets: vector.input.extrinsic.tickets.map((t) => ({
              entryIndex: BigInt(t.attempt),
              proof: t.signature as Hex,
              id: getTicketIdFromProof(hexToBytes(t.signature as Hex)),
            })),
            preimages: (vector.input.extrinsic.preimages || []).map((p) => ({
              requester: BigInt(p.requester),
              blob: p.blob as Hex,
            })),
            guarantees: (vector.input.extrinsic.guarantees || []).map((g) => ({
              report: convertJsonReportToWorkReport(g.report),
              slot: BigInt(g.slot),
              signatures: g.signatures.map((s) => ({
                validator_index: Number(s.validator_index), // TODO: fix this
                signature: s.signature as Hex,
              })),
            })),
            assurances: (vector.input.extrinsic.assurances || []).map((a) => ({
              anchor: a.anchor as Hex,
              bitfield: a.bitfield as Hex,
              validator_index: Number(a.validator_index), // TODO: fix this
              signature: a.signature as Hex,
            })),
            disputes: [{
              verdicts: vector.input.extrinsic.disputes.verdicts.map((v) => ({
                target: v.target as Hex,
                age: BigInt(v.age),
                votes: v.votes.map((vv) => ({
                  vote: !!vv.vote,
                  index: BigInt(vv.index),
                  signature: vv.signature as Hex,
                })),
              })),
              culprits: vector.input.extrinsic.disputes.culprits.map((c) => ({
                target: c.target as Hex,
                key: c.key as Hex,
                signature: c.signature as Hex,
              })),
              faults: vector.input.extrinsic.disputes.faults.map((f) => ({
                target: f.target as Hex,
                vote: !!f.vote,
                key: f.key as Hex,
                signature: f.signature as Hex,
              })),
            }],
          }

          // Emit a BlockProcessedEvent to drive StatisticsService
          await eventBusService.emitBlockProcessed({
            timestamp: Date.now(),
            slot: header.timeslot,
            epoch: 0n,
            authorIndex: Number(vector.input.author_index),
            header,
            body,
          })

          statsService.updateGuarantees(body.guarantees)

          // Validate validator statistics against post_state
          const activity = statsService.getActivity()

          // 1) Current epoch validator stats (vals_curr_stats)
          const actualCurr = activity.validatorStatsAccumulator.map((s) => ({
            blocks: s.blocks,
            tickets: s.tickets,
            pre_images: s.preimageCount,
            pre_images_size: s.preimageSize,
            guarantees: s.guarantees,
            assurances: s.assurances,
          }))
          expect(actualCurr.length).toBe(vector.post_state.vals_curr_stats.length)
          for (let i = 0; i < actualCurr.length; i++) {
            expect(actualCurr[i]).toEqual(vector.post_state.vals_curr_stats[i])
          }

          // 2) Previous epoch validator stats (vals_last_stats)
          const actualPrev = activity.validatorStatsPrevious.map((s) => ({
            blocks: s.blocks,
            tickets: s.tickets,
            pre_images: s.preimageCount,
            pre_images_size: s.preimageSize,
            guarantees: s.guarantees,
            assurances: s.assurances,
          }))
          expect(actualPrev.length).toBe(vector.post_state.vals_last_stats.length)
          for (let i = 0; i < actualPrev.length; i++) {
            expect(actualPrev[i]).toEqual(vector.post_state.vals_last_stats[i])
          }
        })
      }
    })
  }
})


