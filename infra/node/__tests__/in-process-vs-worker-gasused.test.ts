/**
 * Unit test: compare gasused when running the same accumulation invocation
 * in-process vs through the worker pool. Surfaces divergence (e.g. block 10
 * activity π mismatch) from different gas used between the two paths.
 */

import { describe, it, expect } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { AccumulateInput, PartialState } from '@pbnjam/types'
import {
  deserializePartialState,
} from '../services/workers/pvm-worker-pool'
import { PVMWorkerPool } from '../services/workers/pvm-worker-pool'
import { initializeServices } from './test-utils'

const PARTIAL_STATE_FROM_RUN_PATH = path.join(
  __dirname,
  'traces/test-data/partial-state-from-run.json',
)

function minimalPartialState(): PartialState {
  const accounts = new Map<
    bigint,
    {
      codehash: `0x${string}`
      balance: bigint
      minaccgas: bigint
      minmemogas: bigint
      octets: bigint
      gratis: bigint
      items: bigint
      created: bigint
      lastacc: bigint
      parent: bigint
      rawCshKeyvals: Record<`0x${string}`, `0x${string}`>
    }
  >()
  accounts.set(0n, {
    codehash: ('0x' + '00'.repeat(32)) as `0x${string}`,
    balance: 1000n,
    minaccgas: 0n,
    minmemogas: 0n,
    octets: 0n,
    gratis: 0n,
    items: 0n,
    created: 0n,
    lastacc: 0n,
    parent: 0n,
    rawCshKeyvals: {
      '0x004400b500a400aaa0d7f8eab5ca1cca4a0472988422febc68a6b6a944cabf':
        '0x4110adeb' as `0x${string}`,
    },
  })
  return {
    accounts,
    stagingset: [new Uint8Array([1, 2, 3])],
    authqueue: [[new Uint8Array([4, 5])]],
    manager: 1n,
    assigners: [2n, 3n],
    delegator: 4n,
    registrar: 5n,
    alwaysaccers: new Map([
      [6n, 10n],
      [7n, 20n],
    ]),
  }
}

function minimalInputs(): AccumulateInput[] {
  return [
    {
      type: 0,
      value: {
        packageHash: '0x' + 'aa'.repeat(32) as `0x${string}`,
        segmentRoot: '0x' + 'bb'.repeat(32) as `0x${string}`,
        authorizer: '0x' + 'cc'.repeat(32) as `0x${string}`,
        payloadHash: '0x' + 'dd'.repeat(32) as `0x${string}`,
        gasLimit: 1_000_000n,
        result: new Uint8Array([1, 2, 3]),
        authTrace: new Uint8Array([4, 5, 6]),
      },
    },
  ]
}

describe('In-process vs worker pool gasused', () => {
  it('in-process and worker return the same gasused for the same invocation', async () => {
    const services = await initializeServices({
      spec: 'tiny',
      useWasm: true,
      useWorkerPool: true,
    })
    const accumulationService = services.fullContext.accumulationService

    const workerPool = await PVMWorkerPool.create(
      { configMode: 'tiny', traceSubfolder: undefined },
      2,
    )

    const partialState = existsSync(PARTIAL_STATE_FROM_RUN_PATH)
      ? deserializePartialState(
          JSON.parse(
            readFileSync(PARTIAL_STATE_FROM_RUN_PATH, 'utf8'),
          ) as Parameters<typeof deserializePartialState>[0],
        )
      : minimalPartialState()
    const currentSlot = 0n
    const serviceId = 0n
    const gasLimit = 2_000_000n
    const inputs = minimalInputs()
    const invocationIndex = 0

    const entropy = services.fullContext.entropyService.getEntropyAccumulator()
    const [inProcessResult, workerResult] = await Promise.all([
      accumulationService.executeAccumulateInvocation(
        partialState,
        currentSlot,
        serviceId,
        gasLimit,
        inputs,
        invocationIndex,
      ),
      workerPool.execute(
        partialState,
        currentSlot,
        serviceId,
        gasLimit,
        inputs,
        invocationIndex,
        { entropyAccumulator: entropy },
      ),
    ])

    await workerPool.shutdown()

    expect(inProcessResult.ok).toBe(true)
    expect(workerResult.ok).toBe(true)
    if (!inProcessResult.ok || !workerResult.ok) return

    expect(
      workerResult.value.gasused,
      `gasused mismatch: in-process=${inProcessResult.value.gasused.toString()}, worker=${workerResult.value.gasused.toString()}`,
    ).toBe(inProcessResult.value.gasused)
  })
})
