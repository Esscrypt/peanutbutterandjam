/**
 * PVM Accumulate Functions Implementation
 *
 * Implements all 13 Accumulate functions from Gray Paper Appendix B.7
 * These functions are called via ECALLI instruction with function identifiers 14-26
 */

import { logger } from '@pbnj/core'
import { ACCUMULATE_ERROR_CODES, ACCUMULATE_FUNCTIONS } from '../config'
import type { PartialState, RAM, RegisterState, ServiceAccount } from '../types'

// Accumulate context for individual function calls
export interface AccumulateContext {
  gasCounter: bigint
  registers: RegisterState
  memory: RAM
  state: PartialState
  currentTime: number
  currentServiceId: number
}

// Accumulate function result
export interface AccumulateResult {
  executionState: 'continue' | 'panic' | 'oog'
  registers: RegisterState
  memory: RAM
  state: PartialState
  implicationsX: number[][]
  implicationsY: number[][]
}

// Helper functions for memory access
function readMemoryRange(
  memory: RAM,
  start: number,
  length: number,
): number[] | 'error' {
  try {
    const result: number[] = []
    for (let i = 0; i < length; i++) {
      result.push(memory.readOctet(start + i))
    }
    return result
  } catch {
    return 'error'
  }
}

function readMemorySequence(
  memory: RAM,
  start: number,
  count: number,
  itemSize: number,
): number[][] | 'error' {
  try {
    const result: number[][] = []
    for (let i = 0; i < count; i++) {
      const item = readMemoryRange(memory, start + i * itemSize, itemSize)
      if (item === 'error') return 'error'
      result.push(item)
    }
    return result
  } catch {
    return 'error'
  }
}

// Accumulate function implementations

/**
 * Ω_B - bless function (14)
 * Service blessing/authorization
 */
export function bless(context: AccumulateContext): AccumulateResult {
  const { gasCounter, registers, memory, state } = context
  const gasCost = 10n

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Extract registers: r7-r12 contain m, a, v, r, o, n
  const m = registers.r7
  const a = registers.r8
  const v = registers.r9
  const r = registers.r10
  const o = registers.r11
  const n = registers.r12

  // Read authorization data
  const authData = readMemoryRange(memory, Number(a), 4 * 341) // 4 * Ccorecount
  if (authData === 'error') {
    return {
      executionState: 'panic',
      registers: { ...registers, r7: 0n },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Read zone data
  const zoneData = readMemorySequence(memory, Number(o), Number(n), 12)
  if (zoneData === 'error') {
    return {
      executionState: 'panic',
      registers: { ...registers, r7: 0n },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Validate service IDs
  if (m >= 2n ** 32n || v >= 2n ** 32n || r >= 2n ** 32n) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.WHO },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Success - update state
  const newState = { ...state }
  newState.manager = Number(m)
  newState.assigners.set(Number(v), Number(r))
  newState.alwaysaccers.set(Number(r), 0n)

  return {
    executionState: 'continue',
    registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.OK },
    memory,
    state: newState,
    implicationsX: [authData],
    implicationsY: zoneData,
  }
}

/**
 * Ω_A - assign function (15)
 * Core assignment
 */
export function assign(context: AccumulateContext): AccumulateResult {
  const { gasCounter, registers, memory, state } = context
  const gasCost = 10n

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Extract registers: r7-r9 contain c, o, a
  const c = registers.r7
  const o = registers.r8
  const a = registers.r9

  // Read queue data
  const queueData = readMemorySequence(memory, Number(o), 80, 32) // Cauthqueuesize = 80
  if (queueData === 'error') {
    return {
      executionState: 'panic',
      registers: { ...registers, r7: 0n },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Validate core count
  if (c >= 341n) {
    // Ccorecount = 341
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.CORE },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Validate authorization
  if (state.assigners.get(Number(c)) !== context.currentServiceId) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.HUH },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Validate service ID
  if (a >= 2n ** 32n) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.WHO },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Success - update state
  const newState = { ...state }
  newState.authqueue.set(Number(c), queueData)
  newState.assigners.set(Number(c), Number(a))

  return {
    executionState: 'continue',
    registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.OK },
    memory,
    state: newState,
    implicationsX: queueData,
    implicationsY: [[Number(a)]],
  }
}

/**
 * Ω_D - designate function (16)
 * Validator designation
 */
export function designate(context: AccumulateContext): AccumulateResult {
  const { gasCounter, registers, memory, state } = context
  const gasCost = 10n

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Extract register: r7 contains o
  const o = registers.r7

  // Read validator data
  const validatorData = readMemorySequence(memory, Number(o), 1023, 336) // Cvalcount = 1023
  if (validatorData === 'error') {
    return {
      executionState: 'panic',
      registers: { ...registers, r7: 0n },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Validate authorization
  if (state.delegator !== context.currentServiceId) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.HUH },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Success - update state
  const newState = { ...state }
  newState.stagingset = validatorData

  return {
    executionState: 'continue',
    registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.OK },
    memory,
    state: newState,
    implicationsX: validatorData,
    implicationsY: [],
  }
}

/**
 * Ω_C - checkpoint function (17)
 * State checkpointing
 */
export function checkpoint(context: AccumulateContext): AccumulateResult {
  const { gasCounter, registers, memory, state } = context
  const gasCost = 10n

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Copy implications and set checkpoint
  const newRegisters = { ...registers, r7: gasCounter - gasCost }

  return {
    executionState: 'continue',
    registers: newRegisters,
    memory,
    state,
    implicationsX: [],
    implicationsY: [],
  }
}

/**
 * Ω_N - new function (18)
 * Service creation
 */
export function newService(context: AccumulateContext): AccumulateResult {
  const { gasCounter, registers, memory, state } = context
  const gasCost = 10n

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Extract registers: r7-r12 contain o, l, minaccgas, minmemogas, gratis, desiredid
  const o = registers.r7
  const l = registers.r8
  const minaccgas = registers.r9
  const minmemogas = registers.r10
  const gratis = registers.r11
  const desiredid = registers.r12

  // Read code hash (c in Gray Paper)
  const c = readMemoryRange(memory, Number(o), 32)
  if (c === 'error' || l >= 2n ** 32n) {
    return {
      executionState: 'panic',
      registers: { ...registers, r7: 0n },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Create service account (a in Gray Paper)
  const a: ServiceAccount = {
    codehash: c,
    storage: new Map(),
    requests: new Map(),
    balance: 100n, // Cbasedeposit
    minaccgas: BigInt(minaccgas),
    minmemogas: BigInt(minmemogas),
    preimages: new Map(),
    created: context.currentTime,
    gratis: Number(gratis) !== 0,
    lastacc: 0,
    parent: context.currentServiceId,
    items: 2,
    minbalance: 100n, // Cbasedeposit
    octets: 81,
  }

  // Calculate new balance for current service (s in Gray Paper)
  const s = { ...state.accounts.get(context.currentServiceId)! }
  s.balance = s.balance - a.balance

  // Check if current service is registrar and desired ID is valid
  if (state.registrar === context.currentServiceId && desiredid < 65536n) {
    // Cminpublicindex = 2^16
    if (state.accounts.has(Number(desiredid))) {
      return {
        executionState: 'continue',
        registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.FULL },
        memory,
        state,
        implicationsX: [],
        implicationsY: [],
      }
    }

    // Success with desired ID - return desiredid as specified in Gray Paper
    const newState = { ...state }
    newState.accounts.set(Number(desiredid), a)
    newState.accounts.set(context.currentServiceId, s)

    return {
      executionState: 'continue',
      registers: { ...registers, r7: BigInt(desiredid) },
      memory,
      state: newState,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Check if current service has sufficient balance
  if (s.balance < s.minbalance) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.CASH },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Generate new ID using the check function from Gray Paper
  const i_star = state.nextfreeid
  const newState = { ...state }
  newState.accounts.set(i_star, a)
  newState.accounts.set(context.currentServiceId, s)
  newState.nextfreeid = i_star + 1

  // Return nextfreeid as specified in Gray Paper
  return {
    executionState: 'continue',
    registers: { ...registers, r7: BigInt(i_star) },
    memory,
    state: newState,
    implicationsX: [],
    implicationsY: [],
  }
}

/**
 * Ω_U - upgrade function (19)
 * Service code upgrade
 */
export function upgrade(context: AccumulateContext): AccumulateResult {
  const { gasCounter, registers, memory, state } = context
  const gasCost = 10n

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Extract registers: r7-r9 contain o, g, m
  const o = registers.r7
  const g = registers.r8
  const m = registers.r9

  // Read new code hash
  const codehash = readMemoryRange(memory, Number(o), 32)
  if (codehash === 'error') {
    return {
      executionState: 'panic',
      registers: { ...registers, r7: 0n },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Update service
  const newState = { ...state }
  const currentService = newState.accounts.get(context.currentServiceId)
  if (currentService) {
    currentService.codehash = codehash
    currentService.minaccgas = BigInt(g)
    currentService.minmemogas = BigInt(m)
  }

  return {
    executionState: 'continue',
    registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.OK },
    memory,
    state: newState,
    implicationsX: [],
    implicationsY: [],
  }
}

/**
 * Ω_T - transfer function (20)
 * Token transfers
 */
export function transfer(context: AccumulateContext): AccumulateResult {
  const { gasCounter, registers, memory, state } = context
  const gasCost = 10n + BigInt(registers.r9)

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Extract registers: r7-r10 contain dest, amount, l, o
  const dest = registers.r7
  const amount = registers.r8
  const l = registers.r9
  const o = registers.r10

  // Read memo
  const memo = readMemoryRange(memory, Number(o), 128) // Cmemosize = 128
  if (memo === 'error') {
    return {
      executionState: 'panic',
      registers: { ...registers, r7: 0n },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Validate destination
  if (!state.accounts.has(Number(dest))) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.WHO },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Validate gas
  const destService = state.accounts.get(Number(dest))!
  if (l < destService.minmemogas) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.LOW },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Validate balance - Gray Paper checks amount < minbalance
  const currentService = state.accounts.get(context.currentServiceId)!
  if (amount < currentService.minbalance) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.CASH },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Execute transfer
  const newState = { ...state }
  const transferData = [
    context.currentServiceId,
    Number(dest),
    Number(amount),
    ...memo,
    Number(l),
  ]

  newState.xfers.push(transferData)
  newState.accounts.get(context.currentServiceId)!.balance =
    newState.accounts.get(context.currentServiceId)!.balance - BigInt(amount)

  return {
    executionState: 'continue',
    registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.OK },
    memory,
    state: newState,
    implicationsX: [],
    implicationsY: [],
  }
}

/**
 * Ω_J - eject function (21)
 * Service ejection
 */
export function eject(context: AccumulateContext): AccumulateResult {
  const { gasCounter, registers, memory, state } = context
  const gasCost = 10n

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Extract registers: r7-r8 contain d, o
  const d = registers.r7
  const o = registers.r8

  // Read hash
  const hash = readMemoryRange(memory, Number(o), 32)
  if (hash === 'error') {
    return {
      executionState: 'panic',
      registers: { ...registers, r7: 0n },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Validate service
  if (
    d === BigInt(context.currentServiceId) ||
    !state.accounts.has(Number(d))
  ) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.WHO },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  const targetService = state.accounts.get(Number(d))!
  if (targetService.codehash.toString() !== hash.toString()) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.WHO },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Check expunge period
  const l = Math.max(81, targetService.octets) - 81
  const requestKey = `${hash.toString()}_${l}`
  const request = targetService.requests.get(requestKey)

  if (!request || request.length !== 2) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.HUH },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  const requestTime = Number(request[1])
  if (context.currentTime - requestTime < 19200) {
    // Cexpungeperiod = 19200
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.HUH },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Execute ejection
  const newState = { ...state }
  newState.accounts.delete(Number(d))
  newState.accounts.get(context.currentServiceId)!.balance +=
    targetService.balance

  return {
    executionState: 'continue',
    registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.OK },
    memory,
    state: newState,
    implicationsX: [],
    implicationsY: [],
  }
}

/**
 * Ω_Q - query function (22)
 * State queries
 */
export function query(context: AccumulateContext): AccumulateResult {
  const { gasCounter, registers, memory, state } = context
  const gasCost = 10n

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Extract registers: r7-r8 contain o, z
  const o = registers.r7
  const z = registers.r8

  // Read hash
  const hash = readMemoryRange(memory, Number(o), 32)
  if (hash === 'error') {
    return {
      executionState: 'panic',
      registers: { ...registers, r7: 0n, r8: 0n },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Query request
  const requestKey = `${hash.toString()}_${Number(z)}`
  const request = state.accounts
    .get(context.currentServiceId)
    ?.requests.get(requestKey)

  if (!request) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.NONE, r8: 0n },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  if (request.length === 0) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: 0n, r8: 0n },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  if (request.length === 1) {
    return {
      executionState: 'continue',
      registers: {
        ...registers,
        r7: 1n + (BigInt(request[0].length) << 32n),
        r8: 0n,
      },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  if (request.length === 2) {
    return {
      executionState: 'continue',
      registers: {
        ...registers,
        r7: 2n + (BigInt(request[0].length) << 32n),
        r8: BigInt(request[1].length),
      },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  return {
    executionState: 'continue',
    registers: {
      ...registers,
      r7: 3n + (BigInt(request[0].length) << 32n),
      r8: BigInt(request[1].length) + (BigInt(request[2].length) << 32n),
    },
    memory,
    state,
    implicationsX: [],
    implicationsY: [],
  }
}

/**
 * Ω_S - solicit function (23)
 * Request solicitation
 */
export function solicit(context: AccumulateContext): AccumulateResult {
  const { gasCounter, registers, memory, state } = context
  const gasCost = 10n

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Extract registers: r7-r8 contain o, z
  const o = registers.r7
  const z = registers.r8

  // Read hash
  const hash = readMemoryRange(memory, Number(o), 32)
  if (hash === 'error') {
    return {
      executionState: 'panic',
      registers: { ...registers, r7: 0n },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Update service
  const newState = { ...state }
  const currentService = newState.accounts.get(context.currentServiceId)!
  const requestKey = `${hash.toString()}_${Number(z)}`

  if (!currentService.requests.has(requestKey)) {
    currentService.requests.set(requestKey, [])
  }

  const request = currentService.requests.get(requestKey)!
  if (request.length === 2) {
    request.push([context.currentTime])
  }

  // Check balance
  if (currentService.balance < currentService.minbalance) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.FULL },
      memory,
      state: newState,
      implicationsX: [],
      implicationsY: [],
    }
  }

  return {
    executionState: 'continue',
    registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.OK },
    memory,
    state: newState,
    implicationsX: [],
    implicationsY: [],
  }
}

/**
 * Ω_F - forget function (24)
 * Request cleanup
 */
export function forget(context: AccumulateContext): AccumulateResult {
  const { gasCounter, registers, memory, state } = context
  const gasCost = 10n

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Extract registers: r7-r8 contain o, z
  const o = registers.r7
  const z = registers.r8

  // Read hash
  const hash = readMemoryRange(memory, Number(o), 32)
  if (hash === 'error') {
    return {
      executionState: 'panic',
      registers: { ...registers, r7: 0n },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Update service
  const newState = { ...state }
  const currentService = newState.accounts.get(context.currentServiceId)!
  const requestKey = `${hash.toString()}_${Number(z)}`
  const request = currentService.requests.get(requestKey)

  if (!request) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.HUH },
      memory,
      state: newState,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Handle different request states
  if (request.length === 0 || request.length === 2) {
    const requestTime = request.length === 2 ? Number(request[1]) : 0
    if (context.currentTime - requestTime < 19200) {
      // Cexpungeperiod
      return {
        executionState: 'continue',
        registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.HUH },
        memory,
        state: newState,
        implicationsX: [],
        implicationsY: [],
      }
    }
    currentService.requests.delete(requestKey)
    currentService.preimages.delete(hash.toString())
  } else if (request.length === 1) {
    request.push([context.currentTime])
  } else if (request.length === 3) {
    const requestTime = Number(request[1])
    if (context.currentTime - requestTime < 19200) {
      return {
        executionState: 'continue',
        registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.HUH },
        memory,
        state: newState,
        implicationsX: [],
        implicationsY: [],
      }
    }
    request[1] = [context.currentTime]
  }

  return {
    executionState: 'continue',
    registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.OK },
    memory,
    state: newState,
    implicationsX: [],
    implicationsY: [],
  }
}

/**
 * Ω_♉ - yield function (25)
 * Yield control
 */
export function yieldControl(context: AccumulateContext): AccumulateResult {
  const { gasCounter, registers, memory, state } = context
  const gasCost = 10n

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Extract register: r7 contains o
  const o = registers.r7

  // Read hash
  const hash = readMemoryRange(memory, Number(o), 32)
  if (hash === 'error') {
    return {
      executionState: 'panic',
      registers: { ...registers, r7: 0n },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Update state
  const newState = { ...state }
  newState.yield = hash

  return {
    executionState: 'continue',
    registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.OK },
    memory,
    state: newState,
    implicationsX: [],
    implicationsY: [],
  }
}

/**
 * Ω_♈ - provide function (26)
 * Data provision
 */
export function provide(context: AccumulateContext): AccumulateResult {
  const { gasCounter, registers, memory, state } = context
  const gasCost = 10n

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Extract registers: r8-r9 contain o, z
  const o = registers.r8
  const z = registers.r9
  const s =
    registers.r7 === 2n ** 64n - 1n
      ? context.currentServiceId
      : Number(registers.r7)

  // Read input data
  const inputData = readMemoryRange(memory, Number(o), Number(z))
  if (inputData === 'error') {
    return {
      executionState: 'panic',
      registers: { ...registers, r7: 0n },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Validate service
  const targetService = state.accounts.get(s)
  if (!targetService) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.WHO },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Check if request exists
  const hash = inputData.toString()
  const requestKey = `${hash}_${Number(z)}`
  if (targetService.requests.get(requestKey)?.length !== 0) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.HUH },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Check if already provided
  if (state.provisions.has(s)) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.HUH },
      memory,
      state,
      implicationsX: [],
      implicationsY: [],
    }
  }

  // Add provision
  const newState = { ...state }
  newState.provisions.set(s, inputData)

  return {
    executionState: 'continue',
    registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.OK },
    memory,
    state: newState,
    implicationsX: [],
    implicationsY: [],
  }
}

// Main dispatch function
export function dispatchAccumulateFunction(
  functionId: number,
  context: AccumulateContext,
): AccumulateResult {
  logger.debug('Dispatching Accumulate function', { functionId })

  switch (functionId) {
    case ACCUMULATE_FUNCTIONS.BLESS:
      return bless(context)
    case ACCUMULATE_FUNCTIONS.ASSIGN:
      return assign(context)
    case ACCUMULATE_FUNCTIONS.DESIGNATE:
      return designate(context)
    case ACCUMULATE_FUNCTIONS.CHECKPOINT:
      return checkpoint(context)
    case ACCUMULATE_FUNCTIONS.NEW:
      return newService(context)
    case ACCUMULATE_FUNCTIONS.UPGRADE:
      return upgrade(context)
    case ACCUMULATE_FUNCTIONS.TRANSFER:
      return transfer(context)
    case ACCUMULATE_FUNCTIONS.EJECT:
      return eject(context)
    case ACCUMULATE_FUNCTIONS.QUERY:
      return query(context)
    case ACCUMULATE_FUNCTIONS.SOLICIT:
      return solicit(context)
    case ACCUMULATE_FUNCTIONS.FORGET:
      return forget(context)
    case ACCUMULATE_FUNCTIONS.YIELD:
      return yieldControl(context)
    case ACCUMULATE_FUNCTIONS.PROVIDE:
      return provide(context)
    default:
      logger.error('Unknown Accumulate function ID', { functionId })
      return {
        executionState: 'panic',
        registers: context.registers,
        memory: context.memory,
        state: context.state,
        implicationsX: [],
        implicationsY: [],
      }
  }
}
