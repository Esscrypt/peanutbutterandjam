import { RAM, RegisterState } from '../../types'
import { ImplicationsPair, Implications, PartialState, CompleteServiceAccount, AccountEntry, ProvisionEntry } from '../../codec'

// Re-export types for convenience
export { ImplicationsPair, Implications, PartialState, CompleteServiceAccount, AccountEntry, ProvisionEntry }

// Alias for backward compatibility
export type ServiceAccount = CompleteServiceAccount

/**
 * Host function result
 * Uses 255 (0xFF) as sentinel value for null (continue execution)
 */
export class HostFunctionResult {
  resultCode: u8
  additionalGasCost: u64 // Additional gas to deduct beyond base 10 (e.g., TRANSFER deducts gasLimit on success)

  constructor(resultCode: u8 = 255, additionalGasCost: u64 = u64(0)) {
    // Use 255 (0xFF) as sentinel value for null (continue execution)
    // This is safe because valid result codes are 0-5 (HALT, PANIC, etc.)
    this.resultCode = resultCode
    this.additionalGasCost = additionalGasCost
  }
  
  // Helper to check if execution should continue
  shouldContinue(): bool {
    return this.resultCode === 255
  }
}

/**
 * Accumulate host function context
 */
export class AccumulateHostFunctionContext {
  gasCounter: u32
  registers: RegisterState
  ram: RAM
  implications: ImplicationsPair
  timeslot: u64
  expungePeriod: u64
  numCores: u32 // Ccorecount from config
  numValidators: u32 // Cvalcount from config
  // JAM version for version-aware behavior
  jamVersionMajor: u8
  jamVersionMinor: u8
  jamVersionPatch: u8

  constructor(
    gasCounter: u32,
    registers: RegisterState,
    ram: RAM,
    implications: ImplicationsPair,
    timeslot: u64,
    expungePeriod: u64,
    numCores: u32 = 341,
    numValidators: u32 = 1023,
    jamVersionMajor: u8 = 0,
    jamVersionMinor: u8 = 7,
    jamVersionPatch: u8 = 2,
  ) {
    this.gasCounter = gasCounter
    this.registers = registers
    this.ram = ram
    this.implications = implications
    this.timeslot = timeslot
    this.expungePeriod = expungePeriod
    this.numCores = numCores
    this.numValidators = numValidators
    this.jamVersionMajor = jamVersionMajor
    this.jamVersionMinor = jamVersionMinor
    this.jamVersionPatch = jamVersionPatch
  }
}

/**
 * Accumulate error codes
 * Gray Paper: Error codes for accumulation host functions
 * Must be u64 to properly represent values up to 2^64 - 1
 */
export const ACCUMULATE_ERROR_NONE: u64 = u64(0xffffffffffffffff) // 2^64 - 1
export const ACCUMULATE_ERROR_WHAT: u64 = u64(0xfffffffffffffffe) // 2^64 - 2
export const ACCUMULATE_ERROR_OOB: u64 = u64(0xfffffffffffffffd) // 2^64 - 3
export const ACCUMULATE_ERROR_WHO: u64 = u64(0xfffffffffffffffc) // 2^64 - 4
export const ACCUMULATE_ERROR_FULL: u64 = u64(0xfffffffffffffffb) // 2^64 - 5
export const ACCUMULATE_ERROR_CORE: u64 = u64(0xfffffffffffffffa) // 2^64 - 6
export const ACCUMULATE_ERROR_CASH: u64 = u64(0xfffffffffffffff9) // 2^64 - 7
export const ACCUMULATE_ERROR_LOW: u64 = u64(0xfffffffffffffff8) // 2^64 - 8
export const ACCUMULATE_ERROR_HUH: u64 = u64(0xfffffffffffffff7) // 2^64 - 9
export const ACCUMULATE_ERROR_OK: u64 = u64(0) // Success

/**
 * Base class for all accumulation host functions
 *
 * Accumulation host functions operate on accumulation context (implications)
 * and can mutate service accounts, manage transfers, and handle blockchain operations.
 * They are different from general host functions as they work with accumulation context
 * rather than just PVM state.
 */
export class BaseAccumulateHostFunction {
  public functionId: u64
  public name: string

  constructor(functionId: u64 = u64(0), name: string = '') {
    this.functionId = functionId
    this.name = name
  }

  public execute(
    context: AccumulateHostFunctionContext,
  ): HostFunctionResult {
    // This should be overridden by all accumulate host function subclasses
    return new HostFunctionResult(255)
  }

  // Helper methods for accumulation-specific operations
  setAccumulateError(
    registers: RegisterState,
    errorCode: u64,
  ): void {
    registers[7] = errorCode
  }

  setAccumulateSuccess(
    registers: RegisterState,
    value: u64 = ACCUMULATE_ERROR_OK,
  ): void {
    registers[7] = value
  }

  isMemoryRangeReadable(
    ram: RAM,
    offset: u64,
    length: u64,
  ): bool {
    const result = ram.isReadableWithFault(u32(offset), u32(length))
    if (result.faultAddress !== 0) {
      return false
    }
    return result.success
  }

  isMemoryRangeWritable(
    ram: RAM,
    offset: u64,
    length: u64,
  ): bool {
    const result_writable = ram.isWritableWithFault(u32(offset), u32(length))
    if (result_writable.faultAddress !== 0) {
      return false
    }
    return result_writable.success
  }

  // Helper functions for Array-based operations
  findAccountEntry(accounts: Array<AccountEntry>, serviceId: u64): AccountEntry | null {
    for (let i = 0; i < accounts.length; i++) {
      if (u64(accounts[i].serviceId) === serviceId) {
        return accounts[i]
      }
    }
    return null
  }

  hasAccountEntry(accounts: Array<AccountEntry>, serviceId: u64): bool {
    return this.findAccountEntry(accounts, serviceId) !== null
  }

  setAccountEntry(accounts: Array<AccountEntry>, serviceId: u64, account: CompleteServiceAccount): void {
    const entry = this.findAccountEntry(accounts, serviceId)
    if (entry !== null) {
      entry.account = account
    } else {
      accounts.push(new AccountEntry(u32(serviceId), account))
    }
  }

  findProvisionEntry(provisions: Array<ProvisionEntry>, serviceId: u64): ProvisionEntry | null {
    for (let i = 0; i < provisions.length; i++) {
      if (u64(provisions[i].serviceId) === serviceId) {
        return provisions[i]
      }
    }
    return null
  }

  hasProvisionEntry(provisions: Array<ProvisionEntry>, serviceId: u64): bool {
    return this.findProvisionEntry(provisions, serviceId) !== null
  }

  setProvisionEntry(provisions: Array<ProvisionEntry>, serviceId: u64, blob: Uint8Array): void {
    const entry = this.findProvisionEntry(provisions, serviceId)
    if (entry !== null) {
      entry.blob = blob
    } else {
      provisions.push(new ProvisionEntry(u32(serviceId), blob))
    }
  }
}
