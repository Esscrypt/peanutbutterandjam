import { RESULT_CODE_PANIC } from '../../config'
import { bytesToHex } from '../../types'
import {
  ACCUMULATE_ERROR_FULL,
  ACCUMULATE_ERROR_NONE,
  HostFunctionResult,
} from '../accumulate/base'
import { HostFunctionContext, WriteParams } from './base'
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
    params: WriteParams | null,
  ): HostFunctionResult {
    if (!params) {
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // Extract parameters from registers
    // Gray Paper: registers[7:4] = (keyOffset, keyLength, valueOffset, valueLength)
    const keyOffset = u64(context.registers[7])
    const keyLength = u64(context.registers[8])
    const valueOffset = u64(context.registers[9])
    const valueLength = u64(context.registers[10])

    const serviceAccount = params.serviceAccount

    // Read key from memory
    const readResult_key = context.ram.readOctets(keyOffset, keyLength)
    if (key === null || faultAddress !== null) {
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // Check if this is a delete operation (value length = 0)
    if (valueLength === u64(0)) {
      // Delete the key
      const previousLength = this.deleteStorage(serviceAccount, key)
      context.registers[7] = previousLength
    } else {
      // Read value from memory
      const readResult_value = context.ram.readOctets(
        valueOffset,
        valueLength,
      )
      if (value === null || _faultAddress !== null) {
        return new HostFunctionResult(RESULT_CODE_PANIC)
      }

      // Calculate what the new storage footprint would be
      const newItems = this.calculateItems(serviceAccount, key, false)
      const newOctets = this.calculateOctets(serviceAccount, key, value, false)
      const newMinBalance = this.calculateMinBalance(
        newItems,
        newOctets,
        serviceAccount.gratis,
      )

      // Check if service account has sufficient balance for the new storage footprint
      if (newMinBalance > serviceAccount.balance) {
        // Return FULL (2^64 - 5) for insufficient balance
        context.registers[7] = ACCUMULATE_ERROR_FULL
        return new HostFunctionResult(null) // continue execution
      }

      // Write key-value pair to storage
      const previousLength = this.writeStorage(serviceAccount, key, value)
      context.registers[7] = previousLength
    }

    return new HostFunctionResult(null) // continue execution
  }

  calculateItems(
    serviceAccount: ServiceAccount,
    key: Uint8Array,
    isDelete: bool,
  ): u64 {
    // Gray Paper: a_items = 2 * len(a_requests) + len(a_storage)
    const requestsCount = serviceAccount.requests.size
    const keyHex = bytesToHex(key)
    const hasKey = serviceAccount.storage.has(keyHex)

    let storageCount = serviceAccount.storage.size
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
    serviceAccount: ServiceAccount,
    key: Uint8Array,
    value: Uint8Array,
    isDelete: bool,
  ): u64 {
    // Gray Paper: a_octets = sum over requests (81 + z) + sum over storage (34 + len(y) + len(x))
    let totalOctets: u64 = u64(0)

    // Sum over requests: 81 + z for each (h, z) in requests
    const requestKeys = serviceAccount.requests.keys()
    for (let i: i32 = 0; i < requestKeys.length; i++) {
      const hashHex = requestKeys[i]
      const requestMap = serviceAccount.requests.get(hashHex)!
      const lengthKeys = requestMap.keys()
      for (let j: i32 = 0; j < lengthKeys.length; j++) {
        const length = lengthKeys[j]
        totalOctets += u64(81) + length
      }
    }

    // Sum over storage: 34 + len(y) + len(x) for each (x, y) in storage
    const keyHex = bytesToHex(key)
    const storageKeys = serviceAccount.storage.keys()

    for (let i: i32 = 0; i < storageKeys.length; i++) {
      const existingKeyHex = storageKeys[i]
      const existingValue = serviceAccount.storage.get(existingKeyHex)!
      if (existingKeyHex === keyHex) {
        // This is the key we're modifying
        if (!isDelete) {
          // Adding/updating: use new value
          totalOctets += u64(34) + u64(value.length) + u64(key.length)
        }
        // If deleting, skip this entry
      } else {
        // Different key: use existing value
        totalOctets += u64(34) + u64(existingValue.length) + u64(existingKeyHex.length / 2) // hex string length / 2 = byte length
      }
    }

    // If adding a new key (not updating existing), add it
    if (!isDelete && !serviceAccount.storage.has(keyHex)) {
      totalOctets += u64(34) + u64(value.length) + u64(key.length)
    }

    return totalOctets
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
    serviceAccount: ServiceAccount,
    key: Uint8Array,
    value: Uint8Array,
  ): i64 {
    // Get previous value length before writing
    const keyHex = bytesToHex(key)
    const previousValue = serviceAccount.storage.get(keyHex)
    const previousLength = previousValue
      ? i64(previousValue.length)
      : ACCUMULATE_ERROR_NONE

    // Write key-value pair to service account's storage
    serviceAccount.storage.set(keyHex, value)

    // Update storage footprint
    serviceAccount.items = this.calculateItems(serviceAccount, key, false)
    serviceAccount.octets = this.calculateOctets(
      serviceAccount,
      key,
      value,
      false,
    )

    return previousLength
  }

  deleteStorage(
    serviceAccount: ServiceAccount,
    key: Uint8Array,
  ): i64 {
    // Get previous value length before deleting
    const keyHex = bytesToHex(key)
    const previousValue = serviceAccount.storage.get(keyHex)
    const previousLength = previousValue
      ? i64(previousValue.length)
      : ACCUMULATE_ERROR_NONE

    // Delete key from service account's storage
    serviceAccount.storage.delete(keyHex)

    // Update storage footprint
    serviceAccount.items = this.calculateItems(serviceAccount, key, true)
    serviceAccount.octets = this.calculateOctets(
      serviceAccount,
      key,
      new Uint8Array(0),
      true,
    )

    return previousLength
  }
}
