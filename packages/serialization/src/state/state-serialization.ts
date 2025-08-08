/**
 * State Serialization
 *
 * Implements Gray Paper state serialization for genesis state
 * Reference: graypaper/text/merklization.tex
 */

import { bytesToHex, hexToUint8Array } from '@pbnj/core'
import { encodeNatural } from '../core/natural-number'
import { encodeUint8Array } from '../core/sequence'
import type { Uint8Array } from '../types'
import type {
  Hash,
  Address,
  Timeslot,
  ServiceId,
  SafroleTicket,
  SafroleState,
  Dispute,
  WorkReport,
  Privileges,
  ActivityStats,
  ReadyItem,
  AccumulatedItem,
  LastAccountOut,
  ServiceAccount,
  GenesisState,
  StateTrie
} from './types'

/**
 * State key constructor function C from Gray Paper
 * Creates 31-byte state keys from chapter and optional parameters
 */
export function createStateKey(
  chapter: number,
  serviceId?: ServiceId,
  hash?: Hash,
): Uint8Array {
  const key = new Uint8Array(31)

  if (serviceId !== undefined && hash !== undefined) {
    // C(s, h) = ⟨n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆⟩
    // where n = encode[4](s), a = blake(h)
    const serviceUint8Array = new Uint8Array(4)
    const view = new DataView(serviceUint8Array.buffer)
    view.setUint32(0, serviceId, true) // little-endian

    const hashUint8Array = hexToUint8Array(hash)
    const blakeHash = hashUint8Array.slice(0, 27) // Take first 27 Uint8Array

    key.set(serviceUint8Array, 0) // n₀, n₁, n₂, n₃
    key.set(blakeHash, 4) // a₀, a₁, ..., a₂₆
  } else if (serviceId !== undefined) {
    // C(i, s) = ⟨i, n₀, 0, n₁, 0, n₂, 0, n₃, 0, 0, ...⟩
    // where n = encode[4](s)
    const serviceUint8Array = new Uint8Array(4)
    const view = new DataView(serviceUint8Array.buffer)
    view.setUint32(0, serviceId, true) // little-endian

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
export function serializeAuthpool(authpool: Address[]): Uint8Array {
  return encodeUint8Array(authpool.map(hex => hexToUint8Array(hex)))
}

/**
 * Serialize authqueue (Chapter 2)
 */
export function serializeAuthqueue(authqueue: Address[]): Uint8Array {
  return encodeUint8Array(authqueue.map(hex => hexToUint8Array(hex)))
}

/**
 * Serialize recent history (Chapter 3)
 */
export function serializeRecent(recent: Hash[]): Uint8Array {
  return encodeUint8Array(recent.map(hex => hexToUint8Array(hex)))
}

/**
 * Serialize safrole state (Chapter 4)
 * Based on Gray Paper: C(4) → encode(pendingset, epochroot, sealtickets_type, sealtickets, ticketaccumulator)
 */
export function serializeSafrole(safrole: SafroleState): Uint8Array {
  const parts: Uint8Array[] = []

  // pendingset
  const pendingTickets = safrole.pendingset.map(ticket => serializeSafroleTicket(ticket))
  parts.push(encodeUint8Array(pendingTickets))

  // epochroot (32 Uint8Array)
  parts.push(hexToUint8Array(safrole.epochroot))

  // sealtickets type (0 for tickets, 1 for keys)
  const sealticketsType = safrole.sealtickets.length > 0 ? 0n : 1n
  parts.push(encodeNatural(sealticketsType))

  // sealtickets
  const sealTickets = safrole.sealtickets.map(ticket => serializeSafroleTicket(ticket))
  parts.push(encodeUint8Array(sealTickets))

  // ticketaccumulator
  parts.push(hexToUint8Array(safrole.ticketaccumulator))

  return concatenateArrays(parts)
}

/**
 * Serialize a single safrole ticket
 */
function serializeSafroleTicket(ticket: SafroleTicket): Uint8Array {
  const parts: Uint8Array[] = []
  
  // hash
  parts.push(hexToUint8Array(ticket.hash))
  
  // owner
  parts.push(hexToUint8Array(ticket.owner))
  
  // stake
  parts.push(encodeNatural(BigInt(ticket.stake)))
  
  // timestamp
  const timestampUint8Array = new Uint8Array(4)
  const view = new DataView(timestampUint8Array.buffer)
  view.setUint32(0, ticket.timestamp, true)
  parts.push(timestampUint8Array)
  
  return concatenateArrays(parts)
}

/**
 * Serialize disputes (Chapter 5)
 */
export function serializeDisputes(disputes: Dispute[]): Uint8Array {
  const disputeData = disputes.map(dispute => {
    const parts: Uint8Array[] = []
    parts.push(hexToUint8Array(dispute.hash))
    parts.push(encodeNatural(BigInt(dispute.type)))
    parts.push(dispute.data)
    return concatenateArrays(parts)
  })
  return encodeUint8Array(disputeData)
}

/**
 * Serialize entropy (Chapter 6)
 */
export function serializeEntropy(entropy: Hash): Uint8Array {
  return hexToUint8Array(entropy)
}

/**
 * Serialize staging set (Chapter 7)
 */
export function serializeStagingSet(stagingSet: Address[]): Uint8Array {
  return encodeUint8Array(stagingSet.map(hex => hexToUint8Array(hex)))
}

/**
 * Serialize active set (Chapter 8)
 */
export function serializeActiveSet(activeSet: Address[]): Uint8Array {
  return encodeUint8Array(activeSet.map(hex => hexToUint8Array(hex)))
}

/**
 * Serialize previous set (Chapter 9)
 */
export function serializePreviousSet(previousSet: Address[]): Uint8Array {
  return encodeUint8Array(previousSet.map(hex => hexToUint8Array(hex)))
}

/**
 * Serialize reports (Chapter 10)
 */
export function serializeReports(reports: WorkReport[]): Uint8Array {
  const reportData = reports.map(report => {
    const parts: Uint8Array[] = []
    parts.push(hexToUint8Array(report.hash))
    
    const timestampUint8Array = new Uint8Array(4)
    const view = new DataView(timestampUint8Array.buffer)
    view.setUint32(0, report.timestamp, true)
    parts.push(timestampUint8Array)
    
    parts.push(report.data)
    return concatenateArrays(parts)
  })
  return encodeUint8Array(reportData)
}

/**
 * Serialize thetime (Chapter 11)
 * Based on Gray Paper: C(11) → encode[4](thetime)
 */
export function serializeTheTime(theTime: Timeslot): Uint8Array {
  const timeUint8Array = new Uint8Array(4)
  const view = new DataView(timeUint8Array.buffer)
  view.setUint32(0, theTime, true) // little-endian
  return timeUint8Array
}

/**
 * Serialize privileges (Chapter 12)
 * Based on Gray Paper: C(12) → encode(encode[4](manager, assigners, delegator, registrar), alwaysaccers)
 */
export function serializePrivileges(privileges: Privileges): Uint8Array {
  const parts: Uint8Array[] = []

  // encode[4](manager, assigners, delegator, registrar)
  const privilegeUint8Array = new Uint8Array(16)
  const view = new DataView(privilegeUint8Array.buffer)
  view.setUint32(0, privileges.manager, true)
  view.setUint32(4, privileges.assigners, true)
  view.setUint32(8, privileges.delegator, true)
  view.setUint32(12, privileges.registrar, true)
  parts.push(privilegeUint8Array)

  // alwaysaccers
  parts.push(encodeUint8Array(privileges.alwaysaccers.map(hex => hexToUint8Array(hex))))

  return concatenateArrays(parts)
}

/**
 * Serialize activity (Chapter 13)
 * Based on Gray Paper: C(13) → encode(encode[4](valstatsaccumulator, valstatsprevious), corestats, servicestats)
 */
export function serializeActivity(activity: ActivityStats): Uint8Array {
  const parts: Uint8Array[] = []

  // encode[4](valstatsaccumulator, valstatsprevious)
  const statsUint8Array = new Uint8Array(8)
  const view = new DataView(statsUint8Array.buffer)
  view.setUint32(0, activity.valstatsaccumulator, true)
  view.setUint32(4, activity.valstatsprevious, true)
  parts.push(statsUint8Array)

  // corestats
  parts.push(activity.corestats)

  // servicestats
  parts.push(activity.servicestats)

  return concatenateArrays(parts)
}

/**
 * Serialize ready (Chapter 14)
 */
export function serializeReady(ready: ReadyItem[]): Uint8Array {
  const readyData = ready.map(item => {
    const parts: Uint8Array[] = []
    parts.push(hexToUint8Array(item.request))
    parts.push(item.data)
    return concatenateArrays(parts)
  })
  return encodeUint8Array(readyData)
}

/**
 * Serialize accumulated (Chapter 15)
 */
export function serializeAccumulated(accumulated: AccumulatedItem[]): Uint8Array {
  return encodeUint8Array(accumulated.map(item => item.data))
}

/**
 * Serialize last account out (Chapter 16)
 */
export function serializeLastAccountOut(lastAccountOut: LastAccountOut[]): Uint8Array {
  const lastAccountData = lastAccountOut.map(item => {
    const parts: Uint8Array[] = []
    
    const serviceIdUint8Array = new Uint8Array(4)
    const view = new DataView(serviceIdUint8Array.buffer)
    view.setUint32(0, item.serviceId, true)
    parts.push(serviceIdUint8Array)
    
    parts.push(hexToUint8Array(item.hash))
    return concatenateArrays(parts)
  })
  return encodeUint8Array(lastAccountData)
}

/**
 * Serialize service account (Chapter 255)
 * Based on Gray Paper: C(255, s) → encode(0, codehash, encode[8](balance, minaccgas, minmemogas, octets, gratis), encode[4](items, created, lastacc, parent))
 */
export function serializeServiceAccount(account: ServiceAccount): Uint8Array {
  const parts: Uint8Array[] = []

  // 0 (placeholder)
  parts.push(encodeNatural(0n))

  // codehash (32 Uint8Array)
  parts.push(hexToUint8Array(account.codehash))

  // encode[8](balance, minaccgas, minmemogas, octets, gratis)
  const accountUint8Array = new Uint8Array(40) // 5 * 8 Uint8Array
  const view = new DataView(accountUint8Array.buffer)
  view.setBigUint64(0, BigInt(account.balance), true)
  view.setBigUint64(8, account.minaccgas, true)
  view.setBigUint64(16, account.minmemogas, true)
  view.setBigUint64(24, account.octets, true)
  view.setBigUint64(32, account.gratis, true)
  parts.push(accountUint8Array)

  // encode[4](items, created, lastacc, parent)
  const metadataUint8Array = new Uint8Array(16) // 4 * 4 Uint8Array
  const metadataView = new DataView(metadataUint8Array.buffer)
  metadataView.setUint32(0, account.items, true)
  metadataView.setUint32(4, account.created, true)
  metadataView.setUint32(8, account.lastacc, true)
  metadataView.setUint32(12, account.parent, true)
  parts.push(metadataUint8Array)

  return concatenateArrays(parts)
}

/**
 * Create complete genesis state trie
 */
export function createGenesisStateTrie(genesisState: GenesisState): StateTrie {
  const stateTrie: StateTrie = {}

  // Chapter 1: authpool (empty for genesis)
  const authpoolKey = createStateKey(1)
  const authpoolData = serializeAuthpool([])
  stateTrie[bytesToHex(authpoolKey)] = bytesToHex(authpoolData)

  // Chapter 2: authqueue (empty for genesis)
  const authqueueKey = createStateKey(2)
  const authqueueData = serializeAuthqueue([])
  stateTrie[bytesToHex(authqueueKey)] = bytesToHex(authqueueData)

  // Chapter 3: recent (empty for genesis)
  const recentKey = createStateKey(3)
  const recentData = serializeRecent([])
  stateTrie[bytesToHex(recentKey)] = bytesToHex(recentData)

  // Chapter 4: safrole
  const safroleKey = createStateKey(4)
  const safroleData = serializeSafrole(genesisState.safrole)
  stateTrie[bytesToHex(safroleKey)] = bytesToHex(safroleData)

  // Chapter 5: disputes (empty for genesis)
  const disputesKey = createStateKey(5)
  const disputesData = serializeDisputes([])
  stateTrie[bytesToHex(disputesKey)] = bytesToHex(disputesData)

  // Chapter 6: entropy
  const entropyKey = createStateKey(6)
  const entropyData = serializeEntropy(genesisState.safrole.entropy)
  stateTrie[bytesToHex(entropyKey)] = bytesToHex(entropyData)

  // Chapter 7: staging set (empty for genesis)
  const stagingKey = createStateKey(7)
  const stagingData = serializeStagingSet([])
  stateTrie[bytesToHex(stagingKey)] = bytesToHex(stagingData)

  // Chapter 8: active set (empty for genesis)
  const activeKey = createStateKey(8)
  const activeData = serializeActiveSet([])
  stateTrie[bytesToHex(activeKey)] = bytesToHex(activeData)

  // Chapter 9: previous set (empty for genesis)
  const previousKey = createStateKey(9)
  const previousData = serializePreviousSet([])
  stateTrie[bytesToHex(previousKey)] = bytesToHex(previousData)

  // Chapter 10: reports (empty for genesis)
  const reportsKey = createStateKey(10)
  const reportsData = serializeReports([])
  stateTrie[bytesToHex(reportsKey)] = bytesToHex(reportsData)

  // Chapter 11: thetime (0 for genesis)
  const timeKey = createStateKey(11)
  const timeData = serializeTheTime(0)
  stateTrie[bytesToHex(timeKey)] = bytesToHex(timeData)

  // Chapter 12: privileges (empty for genesis)
  const privilegesKey = createStateKey(12)
  const privilegesData = serializePrivileges({
    manager: 0,
    assigners: 0,
    delegator: 0,
    registrar: 0,
    alwaysaccers: []
  })
  stateTrie[bytesToHex(privilegesKey)] = bytesToHex(privilegesData)

  // Chapter 13: activity (empty for genesis)
  const activityKey = createStateKey(13)
  const activityData = serializeActivity({
    valstatsaccumulator: 0,
    valstatsprevious: 0,
    corestats: new Uint8Array(0),
    servicestats: new Uint8Array(0)
  })
  stateTrie[bytesToHex(activityKey)] = bytesToHex(activityData)

  // Chapter 14: ready (empty for genesis)
  const readyKey = createStateKey(14)
  const readyData = serializeReady([])
  stateTrie[bytesToHex(readyKey)] = bytesToHex(readyData)

  // Chapter 15: accumulated (empty for genesis)
  const accumulatedKey = createStateKey(15)
  const accumulatedData = serializeAccumulated([])
  stateTrie[bytesToHex(accumulatedKey)] = bytesToHex(accumulatedData)

  // Chapter 16: last account out (empty for genesis)
  const lastAccountKey = createStateKey(16)
  const lastAccountData = serializeLastAccountOut([])
  stateTrie[bytesToHex(lastAccountKey)] = bytesToHex(lastAccountData)

  // Chapter 255: accounts
  for (const [address, account] of Object.entries(genesisState.accounts)) {
    const serviceId = parseInt(address.slice(2, 10), 16)
    const accountKey = createStateKey(255, serviceId)
    const accountData = serializeServiceAccount(account)
    stateTrie[bytesToHex(accountKey)] = bytesToHex(accountData)
  }

  return stateTrie
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