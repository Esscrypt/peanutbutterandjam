/**
 * Unit tests for PVM worker pool serialization and deserialization.
 *
 * Verifies that PartialState, AccumulateInput[], and AccumulateInvocationResult
 * survive round-trip serialize/deserialize correctly when sent to/from workers.
 */

import { describe, it, expect } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type {
  AccumulateInput,
  DeferredTransfer,
  OperandTuple,
  PartialState,
} from '@pbnjam/types'
import {
  serializePartialState,
  deserializePartialState,
  serializeInputs,
  deserializeResult,
} from '../services/workers/pvm-worker-pool'

const PARTIAL_STATE_FROM_RUN_PATH = path.join(
  __dirname,
  'traces/test-data/partial-state-from-run.json',
)

function minimalServiceAccount() {
  return {
    codehash: '0x' + '00'.repeat(32) as `0x${string}`,
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
        '0x4110adeb',
    } as Record<`0x${string}`, `0x${string}`>,
  }
}

function minimalPartialState(): PartialState {
  const accounts = new Map<bigint, ReturnType<typeof minimalServiceAccount>>()
  accounts.set(0n, minimalServiceAccount())
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

function minimalOperandTupleInput(): AccumulateInput {
  return {
    type: 0,
    value: {
      packageHash: '0x' + 'aa'.repeat(32),
      segmentRoot: '0x' + 'bb'.repeat(32),
      authorizer: '0x' + 'cc'.repeat(32),
      payloadHash: '0x' + 'dd'.repeat(32),
      gasLimit: 1_000_000n,
      result: new Uint8Array([1, 2, 3]),
      authTrace: new Uint8Array([4, 5, 6]),
    } as OperandTuple,
  }
}

function minimalDeferredTransferInput(): AccumulateInput {
  return {
    type: 1,
    value: {
      source: 10n,
      dest: 20n,
      amount: 100n,
      memo: new Uint8Array([7, 8, 9]),
      gasLimit: 5000n,
    } as DeferredTransfer,
  }
}

function assertPartialStateEqual(a: PartialState, b: PartialState) {
  expect(b.accounts.size).toBe(a.accounts.size)
  for (const [id, acc] of a.accounts) {
    const bAcc = b.accounts.get(id)
    expect(bAcc).toBeDefined()
    expect(bAcc!.codehash).toBe(acc.codehash)
    expect(bAcc!.balance).toBe(acc.balance)
    expect(bAcc!.rawCshKeyvals).toEqual(acc.rawCshKeyvals)
  }
  expect(b.manager).toBe(a.manager)
  expect(b.assigners).toEqual(a.assigners)
  expect(b.delegator).toBe(a.delegator)
  expect(b.registrar).toBe(a.registrar)
  expect(b.alwaysaccers.size).toBe(a.alwaysaccers.size)
  expect(b.stagingset.length).toBe(a.stagingset.length)
  expect(b.authqueue.length).toBe(a.authqueue.length)
}

describe('PVM worker pool serialization', () => {
  describe('PartialState round-trip', () => {
    it('serializes and deserializes PartialState without data loss', () => {
      const state = minimalPartialState()
      const serialized = serializePartialState(state)
      const deserialized = deserializePartialState(serialized)
      assertPartialStateEqual(state, deserialized)
    })

    it('preserves rawCshKeyvals in accounts', () => {
      const state = minimalPartialState()
      const key =
        '0x004400b500a400aaa0d7f8eab5ca1cca4a0472988422febc68a6b6a944cabf'
      const value = '0x4110adeb'
      const serialized = serializePartialState(state)
      const deserialized = deserializePartialState(serialized)
      const acc = deserialized.accounts.get(0n)
      expect(acc).toBeDefined()
      expect(acc!.rawCshKeyvals[key]).toBe(value)
    })

    it('preserves empty accounts and multiple alwaysaccers', () => {
      const state = minimalPartialState()
      state.accounts.set(99n, { ...minimalServiceAccount(), balance: 99n })
      state.alwaysaccers.set(100n, 200n)
      const deserialized = deserializePartialState(serializePartialState(state))
      expect(deserialized.accounts.size).toBe(2)
      expect(deserialized.accounts.get(99n)?.balance).toBe(99n)
      expect(deserialized.alwaysaccers.get(100n)).toBe(200n)
    })

    it('round-trips partial state from real run when partial-state-from-run.json exists', () => {
      if (!existsSync(PARTIAL_STATE_FROM_RUN_PATH)) {
        return
      }
      const json = JSON.parse(
        readFileSync(PARTIAL_STATE_FROM_RUN_PATH, 'utf8'),
      ) as Parameters<typeof deserializePartialState>[0]
      const state = deserializePartialState(json)
      const serialized = serializePartialState(state)
      const deserialized = deserializePartialState(serialized)
      assertPartialStateEqual(state, deserialized)
    })
  })

  describe('AccumulateInput[] serialization', () => {
    it('serializes OperandTuple (type 0) with string gasLimit and authTrace data', () => {
      const inputs: AccumulateInput[] = [minimalOperandTupleInput()]
      const serialized = serializeInputs(inputs)
      expect(serialized).toHaveLength(1)
      expect(serialized[0]!.type).toBe(0)
      expect(serialized[0]!.value).toBeDefined()
      const v = serialized[0]!.value as Record<string, unknown>
      expect(v.gasLimit).toBe('1000000')
      expect(v.authTrace).toEqual({ data: [4, 5, 6] })
      expect(v.packageHash).toBe('0x' + 'aa'.repeat(32))
    })

    it('serializes DeferredTransfer (type 1) with string amounts and memo data', () => {
      const inputs: AccumulateInput[] = [minimalDeferredTransferInput()]
      const serialized = serializeInputs(inputs)
      expect(serialized).toHaveLength(1)
      expect(serialized[0]!.type).toBe(1)
      const v = serialized[0]!.value as Record<string, unknown>
      expect(v.source).toBe('10')
      expect(v.dest).toBe('20')
      expect(v.amount).toBe('100')
      expect(v.memo).toEqual({ data: [7, 8, 9] })
      expect(v.gasLimit).toBe('5000')
    })

    it('serializes mixed OperandTuple and DeferredTransfer inputs', () => {
      const inputs: AccumulateInput[] = [
        minimalOperandTupleInput(),
        minimalDeferredTransferInput(),
      ]
      const serialized = serializeInputs(inputs)
      expect(serialized).toHaveLength(2)
      expect(serialized[0]!.type).toBe(0)
      expect(serialized[1]!.type).toBe(1)
    })
  })

  describe('AccumulateInvocationResult deserialization', () => {
    it('deserializes ok result with poststate, gasused, defxfers, provisions', () => {
      const poststate = minimalPartialState()
      const serializedPoststate = serializePartialState(poststate)
      const result = deserializeResult({
        ok: true,
        value: {
          poststate: serializedPoststate,
          gasused: '12345',
          defxfers: [
            {
              source: '1',
              dest: '2',
              amount: '100',
              memo: { data: [1, 2, 3] },
              gasLimit: '5000',
            },
          ],
          yield: { data: [10, 20] },
          provisions: [
            ['999', { data: [7, 8, 9] }],
          ],
          resultCode: '0',
        },
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.gasused).toBe(12345n)
      expect(result.value.defxfers).toHaveLength(1)
      expect(result.value.defxfers[0]!.source).toBe(1n)
      expect(result.value.defxfers[0]!.dest).toBe(2n)
      expect(result.value.defxfers[0]!.amount).toBe(100n)
      expect(Array.from(result.value.defxfers[0]!.memo)).toEqual([1, 2, 3])
      expect(result.value.yield).toEqual(new Uint8Array([10, 20]))
      expect(result.value.provisions.size).toBe(1)
      const [[sid, blob]] = Array.from(result.value.provisions)
      expect(sid).toBe(999n)
      expect(Array.from(blob)).toEqual([7, 8, 9])
      assertPartialStateEqual(poststate, result.value.poststate)
    })

    it('deserializes error result', () => {
      const result = deserializeResult({
        ok: false,
        err: 'PANIC',
      })
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.err).toBe('PANIC')
    })

    it('deserializes result with null yield', () => {
      const serializedPoststate = serializePartialState(minimalPartialState())
      const result = deserializeResult({
        ok: true,
        value: {
          poststate: serializedPoststate,
          gasused: '0',
          defxfers: [],
          yield: null,
          provisions: [],
          resultCode: '0',
        },
      })
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.yield).toBeNull()
    })
  })
})
