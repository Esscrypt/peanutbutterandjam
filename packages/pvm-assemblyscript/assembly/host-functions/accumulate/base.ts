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

  constructor(resultCode: u8 = 255) {
    // Use 255 (0xFF) as sentinel value for null (continue execution)
    // This is safe because valid result codes are 0-5 (HALT, PANIC, etc.)
    this.resultCode = resultCode
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

  constructor(
    gasCounter: u32,
    registers: RegisterState,
    ram: RAM,
    implications: ImplicationsPair,
    timeslot: u64,
    expungePeriod: u64,
  ) {
    this.gasCounter = gasCounter
    this.registers = registers
    this.ram = ram
    this.implications = implications
    this.timeslot = timeslot
    this.expungePeriod = expungePeriod
  }
}

/**
 * Accumulate error codes
 * Gray Paper: Error codes for accumulation host functions
 */
export const ACCUMULATE_ERROR_NONE: i64 = i64(0xffffffffffffffff) // 2^64 - 1
export const ACCUMULATE_ERROR_WHAT: i64 = i64(0xfffffffffffffffe) // 2^64 - 2
export const ACCUMULATE_ERROR_OOB: i64 = i64(0xfffffffffffffffd) // 2^64 - 3
export const ACCUMULATE_ERROR_WHO: i64 = i64(0xfffffffffffffffc) // 2^64 - 4
export const ACCUMULATE_ERROR_FULL: i64 = i64(0xfffffffffffffffb) // 2^64 - 5
export const ACCUMULATE_ERROR_CORE: i64 = i64(0xfffffffffffffffa) // 2^64 - 6
export const ACCUMULATE_ERROR_CASH: i64 = i64(0xfffffffffffffff9) // 2^64 - 7
export const ACCUMULATE_ERROR_LOW: i64 = i64(0xfffffffffffffff8) // 2^64 - 8
export const ACCUMULATE_ERROR_HUH: i64 = i64(0xfffffffffffffff7) // 2^64 - 9
export const ACCUMULATE_ERROR_OK: i64 = i64(0) // Success

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
    const result_readable = ram.isReadableWithFault(offset, length)
    const readable = result_readable.data || result_readable[0] || result_readable
    const faultAddress = result_readable.faultAddress || result_readable[1] || null
    if (faultAddress_readResult !== null || faultAddress !== null) {
      return false
    }
    return readable
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
