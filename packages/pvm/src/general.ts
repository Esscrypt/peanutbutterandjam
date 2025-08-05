/**
 * PVM General Functions Implementation
 *
 * Implements the 14 General Functions (0-13) from Gray Paper Appendix B.7
 * These functions are used by PVM invocations and do not mutate accumulation context.
 */

import { logger } from '@pbnj/core'
import { ACCUMULATE_ERROR_CODES, GENERAL_FUNCTIONS } from './config'
import type { RAM, RegisterState, ServiceAccount, WorkPackage } from './types'

// General function context
export interface GeneralContext {
  gasCounter: bigint
  registers: RegisterState
  memory: RAM
  // Additional context parameters that may be needed for specific functions
  workPackage?: WorkPackage // p from Gray Paper
  serviceAccount?: ServiceAccount // s from Gray Paper
  serviceAccounts?: Map<number, ServiceAccount> // d from Gray Paper
  currentServiceId?: number // s from Gray Paper
  // Add other context parameters as needed
}

// General function result
export interface GeneralResult {
  executionState: 'continue' | 'panic' | 'oog'
  registers: RegisterState
  memory: RAM
  serviceAccount?: ServiceAccount // For functions that mutate service accounts
}

// Helper functions for memory access
function readMemoryRange(
  memory: RAM,
  start: number,
  length: number,
): Uint8Array | 'error' {
  try {
    const result = new Uint8Array(length)
    for (let i = 0; i < length; i++) {
      result[i] = memory.readOctet(start + i)
    }
    return result
  } catch {
    return 'error'
  }
}

function writeMemoryRange(
  memory: RAM,
  start: number,
  data: Uint8Array,
): boolean {
  try {
    for (let i = 0; i < data.length; i++) {
      memory.writeOctet(start + i, data[i])
    }
    return true
  } catch {
    return false
  }
}

/**
 * Ω_G - gas function (0)
 * Return current gas counter
 */
export function gas(context: GeneralContext): GeneralResult {
  const { gasCounter, registers, memory } = context
  const gasCost = 10n

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
    }
  }

  return {
    executionState: 'continue',
    registers: { ...registers, r7: gasCounter - gasCost },
    memory,
  }
}

/**
 * Ω_Y - fetch function (1)
 * Fetch various data based on r10 parameter
 */
export function fetch(context: GeneralContext): GeneralResult {
  const { gasCounter, registers, memory } = context
  const gasCost = 10n

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
    }
  }

  // Extract parameters
  const o = registers.r7 // Output address
  const mode = registers.r10 // Fetch mode

  // For now, implement basic fetch with constants
  // This is a simplified implementation - the full version would handle all modes
  // TODO: Implement the full version
  let data: Uint8Array | null = null

  if (Number(mode) === 0) {
    // Fetch constants
    // This would encode all the constants from the Gray Paper
    data = new Uint8Array(32) // Placeholder
  }

  if (!data) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.NONE },
      memory,
    }
  }

  // Write data to memory
  const writeSuccess = writeMemoryRange(memory, Number(o), data)
  if (!writeSuccess) {
    return {
      executionState: 'panic',
      registers,
      memory,
    }
  }

  return {
    executionState: 'continue',
    registers: { ...registers, r7: BigInt(data.length) },
    memory,
  }
}

/**
 * Ω_L - lookup function (2)
 * Lookup data from service account preimages
 */
export function lookup(context: GeneralContext): GeneralResult {
  const {
    gasCounter,
    registers,
    memory,
    serviceAccount,
    serviceAccounts,
    currentServiceId,
  } = context
  const gasCost = 10n

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
    }
  }

  // Extract parameters
  const serviceId = registers.r7
  const hashAddr = registers.r8
  const outputAddr = registers.r9

  // Read hash from memory
  const hash = readMemoryRange(memory, Number(hashAddr), 32)
  if (hash === 'error') {
    return {
      executionState: 'panic',
      registers,
      memory,
    }
  }

  // Determine which service account to use
  let targetAccount = null
  if (
    serviceId === 2n ** 64n - 1n ||
    serviceId === BigInt(currentServiceId || 0)
  ) {
    targetAccount = serviceAccount
  } else if (serviceAccounts?.has(Number(serviceId))) {
    targetAccount = serviceAccounts.get(Number(serviceId))
  }

  if (!targetAccount || !targetAccount.preimages) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.NONE },
      memory,
    }
  }

  // Look up data in preimages
  const data = targetAccount.preimages.get(hash.toString())
  if (!data) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.NONE },
      memory,
    }
  }

  // Write data to output
  const writeSuccess = writeMemoryRange(
    memory,
    Number(outputAddr),
    new Uint8Array(data),
  )
  if (!writeSuccess) {
    return {
      executionState: 'panic',
      registers,
      memory,
    }
  }

  return {
    executionState: 'continue',
    registers: { ...registers, r7: BigInt(data.length) },
    memory,
  }
}

/**
 * Ω_R - read function (3)
 * Read data from service account storage
 */
export function read(context: GeneralContext): GeneralResult {
  const {
    gasCounter,
    registers,
    memory,
    serviceAccount,
    serviceAccounts,
    currentServiceId,
  } = context
  const gasCost = 10n

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
    }
  }

  // Extract parameters
  const serviceId = registers.r7
  const keyOffset = registers.r8
  const keyLength = registers.r9
  const outputAddr = registers.r10

  // Determine service account
  const targetServiceId =
    serviceId === 2n ** 64n - 1n ? currentServiceId || 0 : Number(serviceId)
  const targetAccount =
    targetServiceId === (currentServiceId || 0)
      ? serviceAccount
      : serviceAccounts?.get(targetServiceId) || null

  if (!targetAccount) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.WHO },
      memory,
    }
  }

  // Read key from memory
  const key = readMemoryRange(memory, Number(keyOffset), Number(keyLength))
  if (key === 'error') {
    return {
      executionState: 'panic',
      registers,
      memory,
    }
  }

  // Look up data in storage
  const data = targetAccount.storage?.get(key.toString())
  if (!data) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.NONE },
      memory,
    }
  }

  // Write data to output
  const writeSuccess = writeMemoryRange(
    memory,
    Number(outputAddr),
    new Uint8Array(data),
  )
  if (!writeSuccess) {
    return {
      executionState: 'panic',
      registers,
      memory,
    }
  }

  return {
    executionState: 'continue',
    registers: { ...registers, r7: BigInt(data.length) },
    memory,
  }
}

/**
 * Ω_W - write function (4)
 * Write data to service account storage
 */
export function write(context: GeneralContext): GeneralResult {
  const { gasCounter, registers, memory, serviceAccount } = context
  const gasCost = 10n

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
    }
  }

  if (!serviceAccount) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.WHO },
      memory,
    }
  }

  // Extract parameters
  const keyOffset = registers.r7
  const keyLength = registers.r8
  const valueOffset = registers.r9
  const valueLength = registers.r10

  // Read key from memory
  const key = readMemoryRange(memory, Number(keyOffset), Number(keyLength))
  if (key === 'error') {
    return {
      executionState: 'panic',
      registers,
      memory,
    }
  }

  // Check if this is a delete operation (valueLength = 0)
  if (Number(valueLength) === 0) {
    const newServiceAccount = { ...serviceAccount }
    if (newServiceAccount.storage) {
      newServiceAccount.storage.delete(key.toString())
    }

    return {
      executionState: 'continue',
      registers: { ...registers, r7: 0n },
      memory,
      serviceAccount: newServiceAccount,
    }
  }

  // Read value from memory
  const value = readMemoryRange(
    memory,
    Number(valueOffset),
    Number(valueLength),
  )
  if (value === 'error') {
    return {
      executionState: 'panic',
      registers,
      memory,
    }
  }

  // Check balance constraint
  if (serviceAccount.balance < serviceAccount.minbalance) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.FULL },
      memory,
    }
  }

  // Write to storage
  const newServiceAccount = { ...serviceAccount }
  if (!newServiceAccount.storage) {
    newServiceAccount.storage = new Map()
  }

  const existingLength =
    newServiceAccount.storage.get(key.toString())?.length || 0
  newServiceAccount.storage.set(key.toString(), Array.from(value))

  return {
    executionState: 'continue',
    registers: { ...registers, r7: BigInt(existingLength) },
    memory,
    serviceAccount: newServiceAccount,
  }
}

/**
 * Ω_I - info function (5)
 * Get service account information
 */
export function info(context: GeneralContext): GeneralResult {
  const { gasCounter, registers, memory, serviceAccounts, currentServiceId } =
    context
  const gasCost = 10n

  if (gasCounter < gasCost) {
    return {
      executionState: 'oog',
      registers,
      memory,
    }
  }

  // Extract parameters
  const serviceId = registers.r7
  const outputAddr = registers.r8

  // Determine which service account to query
  const targetServiceId =
    serviceId === 2n ** 64n - 1n ? currentServiceId || 0 : Number(serviceId)
  const targetAccount = serviceAccounts?.get(targetServiceId)

  if (!targetAccount) {
    return {
      executionState: 'continue',
      registers: { ...registers, r7: ACCUMULATE_ERROR_CODES.NONE },
      memory,
    }
  }

  // Encode service account info (simplified)
  const infoData = new Uint8Array(64) // Placeholder for encoded info

  // Write info to memory
  const writeSuccess = writeMemoryRange(memory, Number(outputAddr), infoData)
  if (!writeSuccess) {
    return {
      executionState: 'panic',
      registers,
      memory,
    }
  }

  return {
    executionState: 'continue',
    registers: { ...registers, r7: BigInt(infoData.length) },
    memory,
  }
}

// Placeholder implementations for remaining functions
export function historicalLookup(context: GeneralContext): GeneralResult {
  return {
    executionState: 'continue',
    registers: { ...context.registers, r7: ACCUMULATE_ERROR_CODES.NONE },
    memory: context.memory,
  }
}

export function exportData(context: GeneralContext): GeneralResult {
  return {
    executionState: 'continue',
    registers: { ...context.registers, r7: 0n },
    memory: context.memory,
  }
}

export function machine(context: GeneralContext): GeneralResult {
  return {
    executionState: 'continue',
    registers: { ...context.registers, r7: 0n },
    memory: context.memory,
  }
}

export function peek(context: GeneralContext): GeneralResult {
  return {
    executionState: 'continue',
    registers: { ...context.registers, r7: 0n },
    memory: context.memory,
  }
}

export function poke(context: GeneralContext): GeneralResult {
  return {
    executionState: 'continue',
    registers: { ...context.registers, r7: 0n },
    memory: context.memory,
  }
}

export function pages(context: GeneralContext): GeneralResult {
  return {
    executionState: 'continue',
    registers: { ...context.registers, r7: 0n },
    memory: context.memory,
  }
}

export function invoke(context: GeneralContext): GeneralResult {
  return {
    executionState: 'continue',
    registers: { ...context.registers, r7: 0n },
    memory: context.memory,
  }
}

export function expunge(context: GeneralContext): GeneralResult {
  return {
    executionState: 'continue',
    registers: { ...context.registers, r7: 0n },
    memory: context.memory,
  }
}

/**
 * Dispatch function to route ECALLI calls to the correct General function
 */
export function dispatchGeneralFunction(
  functionId: number,
  context: GeneralContext,
): GeneralResult {
  logger.debug('Dispatching General function', { functionId })

  switch (functionId) {
    case GENERAL_FUNCTIONS.GAS:
      return gas(context)
    case GENERAL_FUNCTIONS.FETCH:
      return fetch(context)
    case GENERAL_FUNCTIONS.LOOKUP:
      return lookup(context)
    case GENERAL_FUNCTIONS.READ:
      return read(context)
    case GENERAL_FUNCTIONS.WRITE:
      return write(context)
    case GENERAL_FUNCTIONS.INFO:
      return info(context)
    case GENERAL_FUNCTIONS.HISTORICAL_LOOKUP:
      return historicalLookup(context)
    case GENERAL_FUNCTIONS.EXPORT:
      return exportData(context)
    case GENERAL_FUNCTIONS.MACHINE:
      return machine(context)
    case GENERAL_FUNCTIONS.PEEK:
      return peek(context)
    case GENERAL_FUNCTIONS.POKE:
      return poke(context)
    case GENERAL_FUNCTIONS.PAGES:
      return pages(context)
    case GENERAL_FUNCTIONS.INVOKE:
      return invoke(context)
    case GENERAL_FUNCTIONS.EXPUNGE:
      return expunge(context)
    default:
      logger.error('Unknown General function ID', { functionId })
      return {
        executionState: 'panic',
        registers: context.registers,
        memory: context.memory,
      }
  }
}
