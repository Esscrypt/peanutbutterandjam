/**
 * State Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix C - State Merklization
 * Formula (Equation 21-112):
 *
 * State-key constructor functions C:
 * C: N₈ ∪ ⟨N₈, serviceid⟩ ∪ ⟨serviceid, blob⟩ → blob[31]
 *
 * State serialization T(σ):
 * T(σ) ≡ {
 *   C(2) ↦ encode(authqueue),
 *   C(3) ↦ encode(var{⟨⟨RH_headerhash, RH_accoutlogsuperpeak, RH_stateroot, var{RH_reportedpackagehashes}⟩⟩}, mmrencode(accoutbelt)),
 *   C(4) ↦ encode(pendingset, epochroot, discriminator(sealtickets), sealtickets, var{ticketaccumulator}),
 *   C(5) ↦ encode(var{ordered(goodset)}, var{ordered(badset)}, var{ordered(wonkyset)}, var{ordered(offenders)}),
 *   C(6) ↦ encode(entropy),
 *   C(7) ↦ encode(stagingset),
 *   C(8) ↦ encode(activeset),
 *   C(9) ↦ encode(previousset),
 *   C(10) ↦ encode(⟨maybe{⟨RS_workreport, encode[4](RS_timestamp)⟩}⟩),
 *   C(11) ↦ encode[4](thetime),
 *   C(12) ↦ encode(encode[4](manager, assigners, delegator, registrar), alwaysaccers),
 *   C(13) ↦ encode(encode[4](valstatsaccumulator, valstatsprevious), corestats, servicestats),
 *   ...
 * }
 *
 * The serialization places all components of σ into a single mapping from
 * 31-octet state-keys to indefinite-length octet sequences for Merklization.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * State serialization transforms JAM's complex state structure into a
 * flat key-value mapping suitable for Merkle trie storage and commitment.
 *
 * State-key construction C():
 * - **C(i)**: Simple index → 31-byte key starting with i
 * - **C(i, s)**: Index + service → key encoding both values
 * - **C(s, h)**: Service + hash → key for service-specific data
 *
 * Key state components:
 * - **C(2)**: Authorization queue for pending authorizations
 * - **C(3)**: Recent history of blocks and account logs
 * - **C(4)**: Safrole consensus state (tickets, epoch data)
 * - **C(5)**: Validator behavior tracking (good/bad/wonky sets)
 * - **C(6)**: Entropy accumulator for randomness
 * - **C(7-9)**: Validator sets (staging/active/previous)
 * - **C(10)**: Pending work reports
 * - **C(11)**: Current time slot
 * - **C(12)**: Privileges and governance settings
 * - **C(13)**: Statistics and metrics
 * - **C(14-16)**: Work package state (ready/accumulated/last account)
 * - **C(255, s)**: Service account data for service s
 * - **C(s, ...)**: Service-specific storage, preimages, requests
 *
 * This flattening enables:
 * - Efficient Merkle proof generation for any state component
 * - Deterministic state root computation
 * - Partial state synchronization
 * - Compact state commitments (32-byte hash)
 */

import {
  bytesToBigInt,
  bytesToHex,
  type Hex,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type {
  AccumulatedItem,
  ActivityStats,
  Dispute,
  SerializationGenesisState as GenesisState,
  LastAccountOut,
  Privileges,
  ReadyItem,
  SerializationSafroleState as SafroleState,
  SafroleTicket,
  ServiceAccount,
  StateTrie,
  WorkReport,
} from '@pbnj/types'
import type { Address } from 'viem'
import { encodeNatural } from '../core/natural-number'
import { encodeUint8Array } from '../core/sequence'

/**
 * State key constructor function C from Gray Paper
 * Creates 31-byte state keys from chapter and optional parameters
 */
export function createStateKey(
  chapter: number,
  serviceId?: bigint,
  hash?: Hex,
): Uint8Array {
  const key = new Uint8Array(31)

  if (serviceId !== undefined && hash !== undefined) {
    // C(s, h) = ⟨n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆⟩
    // where n = encode[4](s), a = blake(h)
    const serviceUint8Array = new Uint8Array(4)
    const view = new DataView(serviceUint8Array.buffer)
    view.setUint32(0, Number(serviceId), true) // little-endian

    const hashBytes = hexToBytes(hash)
    const blakeHash = hashBytes.slice(0, 27) // Take first 27 Uint8Array

    key.set(serviceUint8Array, 0) // n₀, n₁, n₂, n₃
    key.set(blakeHash, 4) // a₀, a₁, ..., a₂₆
  } else if (serviceId !== undefined) {
    // C(i, s) = ⟨i, n₀, 0, n₁, 0, n₂, 0, n₃, 0, 0, ...⟩
    // where n = encode[4](s)
    const serviceUint8Array = new Uint8Array(4)
    const view = new DataView(serviceUint8Array.buffer)
    view.setUint32(0, Number(serviceId), true) // little-endian

    key[0] = chapter
    key[1] = serviceUint8Array[0]
    key[3] = serviceUint8Array[1]
    key[5] = serviceUint8Array[2]
    key[7] = serviceUint8Array[3]
    // Rest are already 0
  } else {
    // C(i) = ⟨i, 0, 0, ...⟩
    key[0] = chapter
    // Rest are already 0
  }

  return key
}

/**
 * Serialize authpool (Chapter 1)
 */
export function serializeAuthpool(authpool: Hex[]): Safe<Uint8Array> {
  return encodeUint8Array(authpool.map((hex) => hexToBytes(hex)))
}

/**
 * Serialize authqueue (Chapter 2)
 */
export function serializeAuthqueue(authqueue: Hex[]): Safe<Uint8Array> {
  return encodeUint8Array(authqueue.map((hex) => hexToBytes(hex)))
}

/**
 * Serialize recent history (Chapter 3)
 */
export function serializeRecent(recent: Hex[]): Safe<Uint8Array> {
  return encodeUint8Array(recent.map((hex) => hexToBytes(hex)))
}

/**
 * Serialize safrole state (Chapter 4)
 * Based on Gray Paper: C(4) → encode(pendingset, epochroot, sealtickets_type, sealtickets, ticketaccumulator)
 */
export function serializeSafrole(safrole: SafroleState): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // pendingset
  const pendingTicketsResults = safrole.pendingset.map((ticket) => {
    return serializeSafroleTicket(ticket)
  })
  const pendingTickets: Uint8Array[] = []
  for (const [error, encoded] of pendingTicketsResults) {
    if (error) {
      return safeError(error)
    }
    pendingTickets.push(encoded)
  }
  const [error, encoded] = encodeUint8Array(pendingTickets)
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

  // epochroot (32 Uint8Array)
  parts.push(hexToBytes(safrole.epochroot))

  // sealtickets type (0 for tickets, 1 for keys)
  const sealticketsType = safrole.sealtickets.length > 0 ? 0n : 1n
  const [error2, encoded2] = encodeNatural(sealticketsType)
  if (error2) {
    return safeError(error2)
  }
  parts.push(encoded2)

  // sealtickets
  const sealTicketsResults = safrole.sealtickets.map((ticket) => {
    return serializeSafroleTicket(ticket)
  })
  const sealTickets: Uint8Array[] = []
  for (const [error, encoded] of sealTicketsResults) {
    if (error) {
      return safeError(error)
    }
    sealTickets.push(encoded)
  }
  const [error3, encoded3] = encodeUint8Array(sealTickets)
  if (error3) {
    return safeError(error3)
  }
  parts.push(encoded3)

  // ticketaccumulator
  parts.push(hexToBytes(safrole.ticketaccumulator))

  return safeResult(concatenateArrays(parts))
}

/**
 * Serialize a single safrole ticket
 */
function serializeSafroleTicket(ticket: SafroleTicket): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // hash (use id if hash is not available)
  if (ticket.hash) {
    parts.push(hexToBytes(ticket.hash))
  } else {
    parts.push(hexToBytes(ticket.id))
  }

  // owner
  if (ticket.owner) {
    parts.push(hexToBytes(ticket.owner))
  } else {
    parts.push(new Uint8Array(20)) // Default empty address
  }

  // stake
  if (ticket.stake) {
    const [error, encoded] = encodeNatural(BigInt(ticket.stake))
    if (error) {
      return safeError(error)
    }
    parts.push(encoded)
  } else {
    const [error, encoded] = encodeNatural(0n)
    if (error) {
      return safeError(error)
    }
    parts.push(encoded)
  }

  // timestamp
  const timestampUint8Array = new Uint8Array(4)
  const view = new DataView(timestampUint8Array.buffer)
  view.setUint32(0, Number(ticket.timestamp) || 0, true)
  parts.push(timestampUint8Array)

  return safeResult(concatenateArrays(parts))
}

/**
 * Serialize disputes (Chapter 5)
 */
export function serializeDisputes(disputes: Dispute[]): Safe<Uint8Array> {
  const disputeDataResults = disputes.map((dispute) => {
    const parts: Uint8Array[] = []
    // Serialize validity disputes
    const [error, encoded] = encodeNatural(
      BigInt(dispute.validityDisputes.length),
    )
    if (error) {
      return safeError(error)
    }
    parts.push(encoded)
    dispute.validityDisputes.forEach((vd) => {
      parts.push(hexToBytes(vd.reportHash))
      const [error, encoded] = encodeNatural(BigInt(vd.epochIndex))
      if (error) {
        return safeError(error)
      }
      parts.push(encoded)
    })
    // Serialize challenge and finality disputes as bytes
    parts.push(dispute.challengeDisputes)
    parts.push(dispute.finalityDisputes)
    return safeResult(concatenateArrays(parts))
  })
  const disputeData: Uint8Array[] = []
  for (const [error, encoded] of disputeDataResults) {
    if (error) {
      return safeError(error)
    }
    disputeData.push(encoded)
  }
  return encodeUint8Array(disputeData)
}

/**
 * Serialize entropy (Chapter 6)
 */
export function serializeEntropy(entropy: Hex): Safe<Uint8Array> {
  return safeResult(hexToBytes(entropy))
}

/**
 * Serialize staging set (Chapter 7)
 */
export function serializeStagingSet(stagingSet: Address[]): Safe<Uint8Array> {
  return encodeUint8Array(stagingSet.map((hex) => hexToBytes(hex)))
}

/**
 * Serialize active set (Chapter 8)
 */
export function serializeActiveSet(activeSet: Address[]): Safe<Uint8Array> {
  return encodeUint8Array(activeSet.map((hex) => hexToBytes(hex)))
}

/**
 * Serialize previous set (Chapter 9)
 */
export function serializePreviousSet(previousSet: Address[]): Safe<Uint8Array> {
  return encodeUint8Array(previousSet.map((hex) => hexToBytes(hex)))
}

/**
 * Serialize reports (Chapter 10)
 */
export function serializeReports(reports: WorkReport[]): Safe<Uint8Array> {
  const reportData = reports.map((report) => {
    const parts: Uint8Array[] = []
    // Use workPackageId as the hash identifier
    parts.push(hexToBytes(report.workPackageId))

    const timestampUint8Array = new Uint8Array(4)
    const view = new DataView(timestampUint8Array.buffer)
    view.setUint32(0, Number(report.timestamp), true)
    parts.push(timestampUint8Array)

    // Serialize the authTrace as the data
    parts.push(report.authTrace)
    return concatenateArrays(parts)
  })
  return encodeUint8Array(reportData)
}

/**
 * Serialize thetime (Chapter 11)
 * Based on Gray Paper: C(11) → encode[4](thetime)
 */
export function serializeTheTime(theTime: bigint): Safe<Uint8Array> {
  const timeBytes = new Uint8Array(4)
  const view = new DataView(timeBytes.buffer)
  view.setUint32(0, Number(theTime), true) // little-endian
  return safeResult(timeBytes)
}

/**
 * Serialize privileges (Chapter 12)
 * Based on Gray Paper: C(12) → encode(encode[4](manager, assigners, delegator, registrar), alwaysaccers)
 */
export function serializePrivileges(privileges: Privileges): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // encode[4](manager, assigners, delegator, registrar)
  const privilegeUint8Array = new Uint8Array(16)
  const view = new DataView(privilegeUint8Array.buffer)
  view.setUint32(0, Number(privileges.manager), true)
  view.setUint32(4, Number(privileges.assigners), true)
  view.setUint32(8, Number(privileges.delegator), true)
  view.setUint32(12, Number(privileges.registrar), true)
  parts.push(privilegeUint8Array)

  // alwaysaccers
  const [error, encoded] = encodeUint8Array(
    privileges.alwaysaccers.map((hex) => hexToBytes(hex)),
  )
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

  return safeResult(concatenateArrays(parts))
}

/**
 * Serialize activity (Chapter 13)
 * Based on Gray Paper: C(13) → encode(encode[4](valstatsaccumulator, valstatsprevious), corestats, servicestats)
 */
export function serializeActivity(activity: ActivityStats): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // encode[4](valstatsaccumulator, valstatsprevious)
  const statsUint8Array = new Uint8Array(8)
  const view = new DataView(statsUint8Array.buffer)
  view.setUint32(0, Number(activity.valstatsaccumulator), true)
  view.setUint32(4, Number(activity.valstatsprevious), true)
  parts.push(statsUint8Array)

  // corestats
  parts.push(activity.corestats)

  // servicestats
  parts.push(activity.servicestats)

  return safeResult(concatenateArrays(parts))
}

/**
 * Serialize ready (Chapter 14)
 */
export function serializeReady(ready: ReadyItem[]): Safe<Uint8Array> {
  const readyData = ready.map((item) => {
    const parts: Uint8Array[] = []
    parts.push(hexToBytes(item.request))
    parts.push(item.data)
    return concatenateArrays(parts)
  })
  return encodeUint8Array(readyData)
}

/**
 * Serialize accumulated (Chapter 15)
 */
export function serializeAccumulated(
  accumulated: AccumulatedItem[],
): Safe<Uint8Array> {
  return encodeUint8Array(accumulated.map((item) => item.data))
}

/**
 * Serialize last account out (Chapter 16)
 */
export function serializeLastAccountOut(
  lastAccountOut: LastAccountOut[],
): Safe<Uint8Array> {
  const lastAccountData = lastAccountOut.map((item) => {
    const parts: Uint8Array[] = []

    const serviceIdUint8Array = new Uint8Array(4)
    const view = new DataView(serviceIdUint8Array.buffer)
    view.setUint32(0, Number(item.serviceId), true)
    parts.push(serviceIdUint8Array)

    parts.push(hexToBytes(item.hash))
    return concatenateArrays(parts)
  })
  return encodeUint8Array(lastAccountData)
}

/**
 * Serialize service account (Chapter 255)
 * Based on Gray Paper: C(255, s) → encode(0, codehash, encode[8](balance, minaccgas, minmemogas, octets, gratis), encode[4](items, created, lastacc, parent))
 */
export function serializeServiceAccount(
  account: ServiceAccount,
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // 0 (placeholder)
  const [error, encoded] = encodeNatural(0n)
  if (error) {
    return safeError(error)
  }
  parts.push(encoded)

  // codehash (32 Uint8Array)
  parts.push(hexToBytes(account.codehash))

  // encode[8](balance, minaccgas, minmemogas, octets, gratis)
  const accountUint8Array = new Uint8Array(40) // 5 * 8 Uint8Array
  const view = new DataView(accountUint8Array.buffer)
  view.setBigUint64(0, account.balance, true)
  view.setBigUint64(8, account.minaccgas, true)
  view.setBigUint64(16, account.minmemogas, true)
  view.setBigUint64(24, account.octets, true)
  view.setBigUint64(32, account.gratis, true)
  parts.push(accountUint8Array)

  // encode[4](items, created, lastacc, parent)
  const metadataUint8Array = new Uint8Array(16) // 4 * 4 Uint8Array
  const metadataView = new DataView(metadataUint8Array.buffer)
  metadataView.setUint32(0, Number(account.items), true)
  metadataView.setUint32(4, Number(account.created), true)
  metadataView.setUint32(8, Number(account.lastacc), true)
  metadataView.setUint32(12, Number(account.parent), true)
  parts.push(metadataUint8Array)

  return safeResult(concatenateArrays(parts))
}

/**
 * Create complete genesis state trie
 */
export function createGenesisStateTrie(
  genesisState: GenesisState,
): Safe<StateTrie> {
  const stateTrie: StateTrie = {}

  // Chapter 1: authpool (empty for genesis)
  const authpoolKey = createStateKey(1)
  const [error, authpoolData] = serializeAuthpool([])
  if (error) {
    return safeError(error)
  }
  if (authpoolData) {
    stateTrie[bytesToHex(authpoolKey)] = bytesToHex(authpoolData)
  }

  // Chapter 2: authqueue (empty for genesis)
  const authqueueKey = createStateKey(2)
  const [error2, authqueueData] = serializeAuthqueue([])
  if (error2) {
    return safeError(error2)
  }
  if (authqueueData) {
    stateTrie[bytesToHex(authqueueKey)] = bytesToHex(authqueueData)
  }

  // Chapter 3: recent (empty for genesis)
  const recentKey = createStateKey(3)
  const [error3, recentData] = serializeRecent([])
  if (error3) {
    return safeError(error3)
  }
  if (recentData) {
    stateTrie[bytesToHex(recentKey)] = bytesToHex(recentData)
  }

  // Chapter 4: safrole
  const safroleKey = createStateKey(4)
  const [error4, safroleData] = serializeSafrole(genesisState.safrole)
  if (error4) {
    return safeError(error4)
  }
  if (safroleData) {
    stateTrie[bytesToHex(safroleKey)] = bytesToHex(safroleData)
  }

  // Chapter 5: disputes (empty for genesis)
  const disputesKey = createStateKey(5)
  const [error5, disputesData] = serializeDisputes([])
  if (error5) {
    return safeError(error5)
  }
  if (disputesData) {
    stateTrie[bytesToHex(disputesKey)] = bytesToHex(disputesData)
  }

  // Chapter 6: entropy
  const entropyKey = createStateKey(6)
  const [error6, entropyData] = serializeEntropy(genesisState.safrole.entropy)
  if (error6) {
    return safeError(error6)
  }
  if (entropyData) {
    stateTrie[bytesToHex(entropyKey)] = bytesToHex(entropyData)
  }

  // Chapter 7: staging set (empty for genesis)
  const stagingKey = createStateKey(7)
  const [error7, stagingData] = serializeStagingSet([])
  if (error7) {
    return safeError(error7)
  }
  if (stagingData) {
    stateTrie[bytesToHex(stagingKey)] = bytesToHex(stagingData)
  }

  // Chapter 8: active set (empty for genesis)
  const activeKey = createStateKey(8)
  const [error8, activeData] = serializeActiveSet([])
  if (error8) {
    return safeError(error8)
  }
  if (activeData) {
    stateTrie[bytesToHex(activeKey)] = bytesToHex(activeData)
  }

  // Chapter 9: previous set (empty for genesis)
  const previousKey = createStateKey(9)
  const [error9, previousData] = serializePreviousSet([])
  if (error9) {
    return safeError(error9)
  }
  if (previousData) {
    stateTrie[bytesToHex(previousKey)] = bytesToHex(previousData)
  }

  // Chapter 10: reports (empty for genesis)
  const reportsKey = createStateKey(10)
  const [error10, reportsData] = serializeReports([])
  if (error10) {
    return safeError(error10)
  }
  if (reportsData) {
    stateTrie[bytesToHex(reportsKey)] = bytesToHex(reportsData)
  }

  // Chapter 11: thetime (0 for genesis)
  const timeKey = createStateKey(11)
  const [error11, timeData] = serializeTheTime(0n)
  if (error11) {
    return safeError(error11)
  }
  if (timeData) {
    stateTrie[bytesToHex(timeKey)] = bytesToHex(timeData)
  }

  // Chapter 12: privileges (empty for genesis)
  const privilegesKey = createStateKey(12)
  const [error12, privilegesData] = serializePrivileges({
    manager: 0n,
    assigners: 0n,
    delegator: 0n,
    registrar: 0n,
    alwaysaccers: [],
  })
  if (error12) {
    return safeError(error12)
  }
  if (privilegesData) {
    stateTrie[bytesToHex(privilegesKey)] = bytesToHex(privilegesData)
  }

  // Chapter 13: activity (empty for genesis)
  const activityKey = createStateKey(13)
  const [error13, activityData] = serializeActivity({
    valstatsaccumulator: 0n,
    valstatsprevious: 0n,
    corestats: new Uint8Array(0),
    servicestats: new Uint8Array(0),
  })
  if (error13) {
    return safeError(error13)
  }
  if (activityData) {
    stateTrie[bytesToHex(activityKey)] = bytesToHex(activityData)
  }

  // Chapter 14: ready (empty for genesis)
  const readyKey = createStateKey(14)
  const [error14, readyData] = serializeReady([])
  if (error14) {
    return safeError(error14)
  }
  if (readyData) {
    stateTrie[bytesToHex(readyKey)] = bytesToHex(readyData)
  }

  // Chapter 15: accumulated (empty for genesis)
  const accumulatedKey = createStateKey(15)
  const [error15, accumulatedData] = serializeAccumulated([])
  if (error15) {
    return safeError(error15)
  }
  if (accumulatedData) {
    stateTrie[bytesToHex(accumulatedKey)] = bytesToHex(accumulatedData)
  }

  // Chapter 16: last account out (empty for genesis)
  const lastAccountKey = createStateKey(16)
  const [error16, lastAccountData] = serializeLastAccountOut([])
  if (error16) {
    return safeError(error16)
  }
  if (lastAccountData) {
    stateTrie[bytesToHex(lastAccountKey)] = bytesToHex(lastAccountData)
  }

  // Chapter 255: accounts
  for (const [address, account] of genesisState.accounts.entries()) {
    const serviceId = bytesToBigInt(hexToBytes(address as `0x${string}`))
    const accountKey = createStateKey(255, serviceId)
    const [error17, accountData] = serializeServiceAccount(
      account as ServiceAccount,
    )
    if (error17) {
      return safeError(error17)
    }
    if (accountData) {
      stateTrie[bytesToHex(accountKey)] = bytesToHex(accountData)
    }
  }

  return safeResult(stateTrie)
}

/**
 * Helper function to concatenate arrays
 */
function concatenateArrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const array of arrays) {
    result.set(array, offset)
    offset += array.length
  }

  return result
}
