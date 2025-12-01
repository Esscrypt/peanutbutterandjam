import { CompleteServiceAccount } from '../../codec'
import { RESULT_CODE_PANIC } from '../../config'
import {
  ACCUMULATE_ERROR_FULL,
  ACCUMULATE_ERROR_NONE,
  HostFunctionResult,
} from '../accumulate/base'
import { HostFunctionContext, HostFunctionParams, WriteParams } from './base'
import { BaseHostFunction } from './base'

// Deposit constants (Gray Paper)
const C_BASEDEPOSIT: u64 = u64(100) // Base deposit
const C_ITEMDEPOSIT: u64 = u64(10) // Per-item deposit
const C_BYTEDEPOSIT: u64 = u64(1) // Per-byte deposit

/**
 * WRITE host function (Ω_W)
 *
 * Writes storage data to service accounts
 *
 * Gray Paper Specification:
 * - Function ID: 4 (write)
 * - Gas Cost: 10
 * - Signature: Ω_W(gascounter, registers, memory, s, s)
 *   - s = current service account
 *   - s = current service ID
 * - Uses registers[7:4] to specify key offset, key length, value offset, value length
 * - Writes key-value pair to service account's storage
 * - If value length is 0, deletes the key
 * - Returns FULL if insufficient balance, length of previous value otherwise
 * - Updates service account's storage footprint (items, octets)
 */

export class WriteHostFunction extends BaseHostFunction {
  functionId: u64 = u64(4) // WRITE function ID
  name: string = 'write'
  gasCost: u64 = u64(10)

  execute(
    context: HostFunctionContext,
    params: HostFunctionParams | null,
  ): HostFunctionResult {
    if (!params) {
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }
    const writeParams = params as WriteParams

    // Extract parameters from registers
    // Gray Paper: registers[7:4] = (keyOffset, keyLength, valueOffset, valueLength)
    const keyOffset = u64(context.registers[7])
    const keyLength = u64(context.registers[8])
    const valueOffset = u64(context.registers[9])
    const valueLength = u64(context.registers[10])

    const serviceAccount = writeParams.serviceAccount

    // Read key from memory
    const readResult_key = context.ram.readOctets(u32(keyOffset), u32(keyLength))
    const key = readResult_key.data
    const faultAddress = readResult_key.faultAddress
    if (key === null || faultAddress !== 0) {
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // Check if this is a delete operation (value length = 0)
    if (valueLength === u64(0)) {
      // Delete the key
      const previousLength = this.deleteStorage(serviceAccount, key!)
      context.registers[7] = u64(previousLength)
    } else {
      // Read value from memory
      const readResult_value = context.ram.readOctets(
        u32(valueOffset),
        u32(valueLength),
      )
      const value = readResult_value.data
      const _faultAddress = readResult_value.faultAddress
      if (value === null || _faultAddress !== 0) {
        return new HostFunctionResult(RESULT_CODE_PANIC)
      }

      // Calculate what the new storage footprint would be
      const newItems = this.calculateItems(serviceAccount, key!, false)
      const newOctets = this.calculateOctets(serviceAccount, key!, value!, false)
      const newMinBalance = this.calculateMinBalance(
        newItems,
        newOctets,
        serviceAccount.gratis,
      )

      // Check if service account has sufficient balance for the new storage footprint
      if (newMinBalance > serviceAccount.balance) {
        // Return FULL (2^64 - 5) for insufficient balance
        context.registers[7] = ACCUMULATE_ERROR_FULL
        return new HostFunctionResult(255) // continue execution
      }

      // Write key-value pair to storage
      const previousLength = this.writeStorage(serviceAccount, key!, value!)
      context.registers[7] = u64(previousLength)
    }

    return new HostFunctionResult(255) // continue execution
  }

  calculateItems(
    serviceAccount: CompleteServiceAccount,
    key: Uint8Array,
    isDelete: bool,
  ): u64 {
    // Gray Paper: a_items = 2 * len(a_requests) + len(a_storage)
    const requestsCount = serviceAccount.requests.entries.length
    const hasKey = serviceAccount.storage.get(key) !== null

    let storageCount = serviceAccount.storage.entries.length
    if (isDelete) {
      // If deleting and key exists, reduce count by 1
      storageCount = hasKey ? storageCount - 1 : storageCount
    } else {
      // If writing and key doesn't exist, increase count by 1
      storageCount = hasKey ? storageCount : storageCount + 1
    }

    return u64(2 * requestsCount + storageCount)
  }

  calculateOctets(
    serviceAccount: CompleteServiceAccount,
    key: Uint8Array,
    value: Uint8Array,
    isDelete: bool,
  ): u64 {
    // Gray Paper: a_octets = sum over requests (81 + z) + sum over storage (34 + len(y) + len(x))
    let totalOctets: u64 = u64(0)

    // Sum over requests: 81 + z for each (h, z) in requests
    for (let i: i32 = 0; i < serviceAccount.requests.entries.length; i++) {
      const entry = serviceAccount.requests.entries[i]
      totalOctets += u64(81) + entry.length
    }

    // Sum over storage: 34 + len(y) + len(x) for each (x, y) in storage
    const keyExists = serviceAccount.storage.get(key) !== null
    
    for (let i: i32 = 0; i < serviceAccount.storage.entries.length; i++) {
      const entry = serviceAccount.storage.entries[i]
      const isCurrentKey = this.compareKeys(entry.key, key)
      if (isCurrentKey) {
        // This is the key we're modifying
        if (!isDelete) {
          // Adding/updating: use new value
          totalOctets += u64(34) + u64(value.length) + u64(key.length)
        }
        // If deleting, skip this entry
      } else {
        // Different key: use existing value
        totalOctets += u64(34) + u64(entry.value.length) + u64(entry.key.length)
      }
    }

    // If adding a new key (not updating existing), add it
    if (!isDelete && !keyExists) {
      totalOctets += u64(34) + u64(value.length) + u64(key.length)
    }

    return totalOctets
  }
  
  private compareKeys(a: Uint8Array, b: Uint8Array): bool {
    if (a.length !== b.length) return false
    for (let i: i32 = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }

  calculateMinBalance(
    items: u64,
    octets: u64,
    gratis: u64,
  ): u64 {
    // Gray Paper: a_minbalance = max(0, Cbasedeposit + Citemdeposit * a_items + Cbytedeposit * a_octets - a_gratis)
    const baseDeposit = C_BASEDEPOSIT
    const itemDeposit = C_ITEMDEPOSIT * items
    const byteDeposit = C_BYTEDEPOSIT * octets

    const totalDeposit = baseDeposit + itemDeposit + byteDeposit
    const minBalance = totalDeposit > gratis ? totalDeposit - gratis : u64(0)

    return minBalance
  }

  writeStorage(
    serviceAccount: CompleteServiceAccount,
    key: Uint8Array,
    value: Uint8Array,
  ): i64 {
    // Get previous value length before writing
    const previousValue = serviceAccount.storage.get(key)
    const previousLength = previousValue
      ? i64(previousValue.length)
      : ACCUMULATE_ERROR_NONE

    // Write key-value pair to service account's storage
    serviceAccount.storage.set(key, value)

    // Update storage footprint
    serviceAccount.items = u32(this.calculateItems(serviceAccount, key, false))
    serviceAccount.octets = this.calculateOctets(
      serviceAccount,
      key,
      value,
      false,
    )

    return previousLength
  }

  deleteStorage(
    serviceAccount: CompleteServiceAccount,
    key: Uint8Array,
  ): i64 {
    // Get previous value length before deleting
    const previousValue = serviceAccount.storage.get(key)
    const previousLength = previousValue
      ? i64(previousValue.length)
      : ACCUMULATE_ERROR_NONE

    // Delete key from service account's storage
    // Find and remove the entry
    const entries = serviceAccount.storage.entries
    for (let i: i32 = 0; i < entries.length; i++) {
      if (this.compareKeys(entries[i].key, key)) {
        // Remove entry by shifting remaining elements
        for (let j: i32 = i; j < entries.length - 1; j++) {
          entries[j] = entries[j + 1]
        }
        entries.pop()
        break
      }
    }

    // Update storage footprint
    serviceAccount.items = u32(this.calculateItems(serviceAccount, key, true))
    serviceAccount.octets = this.calculateOctets(
      serviceAccount,
      key,
      new Uint8Array(0),
      true,
    )

    return previousLength
  }
}
