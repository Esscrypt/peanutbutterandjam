import { CompleteServiceAccount, getStorageValue, setStorageValue, deleteStorageValue } from '../../codec'
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
    const serviceId = u32(writeParams.serviceId)

    // Read key from memory
    const readResult_key = context.ram.readOctets(u32(keyOffset), u32(keyLength))
    const key = readResult_key.data
    const faultAddress = readResult_key.faultAddress
    if (key === null || faultAddress !== 0) {
      return new HostFunctionResult(RESULT_CODE_PANIC)
    }

    // Check if this is a delete operation (value length = 0)
    if (valueLength === u64(0)) {
      // Gray Paper: Calculate new account state with deletion, then check balance
      // Calculate what the new storage footprint would be after deletion
      const newItems = this.calculateNewItems(serviceAccount, serviceId, key!, true)
      const newOctets = this.calculateNewOctets(serviceAccount, serviceId, key!, new Uint8Array(0), true)
      const newMinBalance = this.calculateMinBalance(
        newItems,
        newOctets,
        serviceAccount.gratis,
      )

      // Gray Paper equation 450: Check if new minbalance > balance
      // If so, return FULL and keep old state
      if (newMinBalance > serviceAccount.balance) {
        context.registers[7] = ACCUMULATE_ERROR_FULL
        return new HostFunctionResult(255) // continue execution
      }

      // Delete the key
      const previousLength = this.doDeleteStorage(serviceAccount, serviceId, key!, newItems, newOctets)
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
      const newItems = this.calculateNewItems(serviceAccount, serviceId, key!, false)
      const newOctets = this.calculateNewOctets(serviceAccount, serviceId, key!, value!, false)
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
      const previousLength = this.writeStorage(serviceAccount, serviceId, key!, value!, newItems, newOctets)
      context.registers[7] = u64(previousLength)
    }

    return new HostFunctionResult(255) // continue execution
  }

  calculateNewItems(
    serviceAccount: CompleteServiceAccount,
    serviceId: u32,
    key: Uint8Array,
    isDelete: bool,
  ): u64 {
    // Gray Paper: items change based on whether key exists
    // Using rawCshKeyvals helper to check key existence
    const hasKey = getStorageValue(serviceAccount, serviceId, key) !== null
    let currentItems = u64(serviceAccount.items)

    if (isDelete) {
      // If deleting and key exists, reduce items by 1
      return hasKey ? currentItems - u64(1) : currentItems
    } else {
      // If writing and key doesn't exist, increase items by 1
      return hasKey ? currentItems : currentItems + u64(1)
    }
  }

  calculateNewOctets(
    serviceAccount: CompleteServiceAccount,
    serviceId: u32,
    key: Uint8Array,
    value: Uint8Array,
    isDelete: bool,
  ): u64 {
    // Gray Paper: a_octets = sum over storage of (34 + len(y) + len(x))
    // Using rawCshKeyvals helper to get current value
    const previousValue = getStorageValue(serviceAccount, serviceId, key)
    let currentOctets = serviceAccount.octets

    if (isDelete) {
      // If deleting and key exists, subtract its octets
      if (previousValue !== null) {
        const deletedOctets = u64(34) + u64(key.length) + u64(previousValue.length)
        return currentOctets > deletedOctets ? currentOctets - deletedOctets : u64(0)
      }
      return currentOctets
    } else {
      // If updating or adding
      if (previousValue !== null) {
        // Updating: adjust for value length change
        const previousLength = u64(previousValue.length)
        const newLength = u64(value.length)
        return currentOctets - previousLength + newLength
      } else {
        // Adding new: add 34 + len(key) + len(value)
        return currentOctets + u64(34) + u64(key.length) + u64(value.length)
      }
    }
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
    serviceId: u32,
    key: Uint8Array,
    value: Uint8Array,
    newItems: u64,
    newOctets: u64,
  ): i64 {
    // Get previous value length before writing using rawCshKeyvals helper
    const previousValue = getStorageValue(serviceAccount, serviceId, key)
    const previousLength = previousValue
      ? i64(previousValue.length)
      : ACCUMULATE_ERROR_NONE

    // Write key-value pair to service account's storage using rawCshKeyvals helper
    setStorageValue(serviceAccount, serviceId, key, value)

    // Update storage footprint (already calculated)
    serviceAccount.items = u32(newItems)
    serviceAccount.octets = newOctets

    return previousLength
  }

  doDeleteStorage(
    serviceAccount: CompleteServiceAccount,
    serviceId: u32,
    key: Uint8Array,
    newItems: u64,
    newOctets: u64,
  ): i64 {
    // Get previous value length before deleting using rawCshKeyvals helper
    const previousValue = getStorageValue(serviceAccount, serviceId, key)
    const previousLength = previousValue
      ? i64(previousValue.length)
      : ACCUMULATE_ERROR_NONE

    // Delete key from service account's storage using rawCshKeyvals helper
    if (previousValue !== null) {
      deleteStorageValue(serviceAccount, serviceId, key)
    }

    // Update storage footprint (already calculated)
    serviceAccount.items = u32(newItems)
    serviceAccount.octets = newOctets

    return previousLength
  }
}

