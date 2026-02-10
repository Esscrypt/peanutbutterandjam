import { describe, it, expect } from 'bun:test'
import {
  encodeRefineArguments,
  decodeRefineArguments,
  createRefineArguments,
} from '../pvm/refine-arguments'
import type { WorkItem, WorkPackage } from '@pbnjam/types'

const hex = (s: string): `0x${string}` => s as `0x${string}`

describe('Refine Arguments - GP-compliant encoding/decoding', () => {
  const minimalWorkPackage: WorkPackage = {
    authToken: hex('0x'),
    authCodeHost: 0n,
    authCodeHash: hex('0x' + '0'.repeat(64)),
    authConfig: hex('0x'),
    context: {
      anchor: hex('0x' + '0'.repeat(64)),
      state_root: hex('0x' + '0'.repeat(64)),
      beefy_root: hex('0x' + '0'.repeat(64)),
      lookup_anchor: hex('0x' + '0'.repeat(64)),
      lookup_anchor_slot: 0n,
      prerequisites: [],
    },
    workItems: [],
  }

  const minimalWorkItem: WorkItem = {
    serviceindex: 5n,
    codehash: hex('0x' + '0'.repeat(64)),
    payload: new Uint8Array([1, 2, 3]),
    refgaslimit: 1_000_000n,
    accgaslimit: 1_000_000n,
    exportcount: 0n,
    importsegments: [],
    extrinsics: [],
  }

  it('should round-trip encode/decode refine arguments (variable-length naturals)', () => {
    const [createErr, args] = createRefineArguments(
      0n,
      1n,
      minimalWorkItem,
      minimalWorkPackage,
    )
    if (createErr) throw createErr

    const [encodeErr, encoded] = encodeRefineArguments(
      args!.coreIndex,
      args!.workItemIndex,
      minimalWorkItem,
      minimalWorkPackage,
    )
    if (encodeErr) throw encodeErr

    const [decodeErr, decoded] = decodeRefineArguments(encoded!)
    if (decodeErr) throw decodeErr

    expect(decoded!.value.coreIndex).toBe(args!.coreIndex)
    expect(decoded!.value.workItemIndex).toBe(args!.workItemIndex)
    expect(decoded!.value.serviceIndex).toBe(args!.serviceIndex)
    expect(decoded!.value.payload).toEqual(args!.payload)
    expect(decoded!.value.workPackageHash).toEqual(args!.workPackageHash)
  })

  it('should produce shorter encoding for small indices (GP var natural)', () => {
    const [encodeErr, encoded] = encodeRefineArguments(
      0n,
      0n,
      { ...minimalWorkItem, serviceindex: 0n, payload: new Uint8Array(0) },
      minimalWorkPackage,
    )
    if (encodeErr) throw encodeErr

    const [decodeErr, decoded] = decodeRefineArguments(encoded!)
    if (decodeErr) throw decodeErr

    expect(decoded!.value.coreIndex).toBe(0n)
    expect(decoded!.value.workItemIndex).toBe(0n)
    expect(decoded!.value.serviceIndex).toBe(0n)
    expect(decoded!.value.payload.length).toBe(0)
    expect(encoded!.length).toBeLessThan(4 + 4 + 4 + 4 + 32)
  })
})
