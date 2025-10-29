import { bytesToHex } from '@pbnj/core'
import type {
  HostFunctionContext,
  HostFunctionResult,
  RefineInvocationContext,
  ServiceAccount,
} from '@pbnj/types'
import { DEPOSIT_CONSTANTS } from '@pbnj/types'
import {
  ACCUMULATE_ERROR_CODES,
  GENERAL_FUNCTIONS,
  RESULT_CODES,
} from '../../config'
import { BaseHostFunction } from './base'

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
  readonly functionId = GENERAL_FUNCTIONS.WRITE
  readonly name = 'write'
  readonly gasCost = 10n

  execute(
    context: HostFunctionContext,
    refineContext: RefineInvocationContext | null,
  ): HostFunctionResult {

    // Extract parameters from registers
    const [keyOffset, keyLength, valueOffset, valueLength] =
      context.registers.slice(7, 11)

    // Check if refine context is available
    if (!refineContext) {
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Get current service account
    const serviceAccount = this.getServiceAccount(refineContext)
    if (!serviceAccount) {
      context.registers[7] = ACCUMULATE_ERROR_CODES.WHO
      return {
        resultCode: RESULT_CODES.HALT,
      }
    }

    // Read key from memory
    const [key, faultAddress] = context.ram.readOctets(keyOffset, keyLength)
    if (!key) {
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_read',
          address: faultAddress ?? 0n,
          details: 'Memory not readable',
        },
      }
    }

    // Check if this is a delete operation (value length = 0)
    if (valueLength === 0n) {
      // Delete the key
      const previousLength = this.deleteStorage(serviceAccount, key)
      context.registers[7] = previousLength
    } else {
      // Read value from memory
      const [value, _faultAddress] = context.ram.readOctets(valueOffset, valueLength)
      if (!value) {
        return {
          resultCode: RESULT_CODES.PANIC,
          faultInfo: {
            type: 'memory_read',
            address: _faultAddress ?? 0n,
            details: 'Memory not readable',
          },
        }
      }

      // Calculate what the new storage footprint would be
      const newItems = this.calculateItems(serviceAccount, key, value, false)
      const newOctets = this.calculateOctets(serviceAccount, key, value, false)
      const newMinBalance = this.calculateMinBalance(
        newItems,
        newOctets,
        serviceAccount.gratis,
      )

      // Check if service account has sufficient balance for the new storage footprint
      if (newMinBalance > serviceAccount.balance) {
        // Return FULL (2^64 - 5) for insufficient balance
        context.registers[7] = ACCUMULATE_ERROR_CODES.FULL
        return {
          resultCode: null, // continue execution
        }
      }

      // Write key-value pair to storage
      const previousLength = this.writeStorage(serviceAccount, key, value)
      context.registers[7] = previousLength
    }

    return {
      resultCode: null, // continue execution
    }
  }

  private getServiceAccount(
    refineContext: RefineInvocationContext,
  ): ServiceAccount | null {
    // Gray Paper: Ω_W(gascounter, registers, memory, s, s)
    // where s = current service account (always self)
    return (
      refineContext.accountsDictionary.get(refineContext.currentServiceId) ||
      null
    )
  }

  private calculateItems(
    serviceAccount: ServiceAccount,
    key: Uint8Array,
    _value: Uint8Array,
    isDelete: boolean,
  ): bigint {
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

    return BigInt(2 * requestsCount + storageCount)
  }

  private calculateOctets(
    serviceAccount: ServiceAccount,
    key: Uint8Array,
    value: Uint8Array,
    isDelete: boolean,
  ): bigint {
    // Gray Paper: a_octets = sum over requests (81 + z) + sum over storage (34 + len(y) + len(x))
    let totalOctets = 0

    // Sum over requests: 81 + z for each (h, z) in requests
    for (const [_hashHex, requestMap] of serviceAccount.requests) {
      for (const [length, _requestStatus] of requestMap) {
        totalOctets += 81 + Number(length)
      }
    }

    // Sum over storage: 34 + len(y) + len(x) for each (x, y) in storage
    const keyHex = bytesToHex(key)
    const keyBytes = new Uint8Array(Buffer.from(keyHex.slice(2), 'hex')) // Remove 0x prefix

    for (const [existingKeyHex, existingValue] of serviceAccount.storage) {
      if (existingKeyHex === keyHex) {
        // This is the key we're modifying
        if (!isDelete) {
          // Adding/updating: use new value
          totalOctets += 34 + value.length + keyBytes.length
        }
        // If deleting, skip this entry
      } else {
        // Different key: use existing value
        const existingKeyBytes = new Uint8Array(
          Buffer.from(existingKeyHex.slice(2), 'hex'),
        )
        totalOctets += 34 + existingValue.length + existingKeyBytes.length
      }
    }

    // If adding a new key (not updating existing), add it
    if (!isDelete && !serviceAccount.storage.has(keyHex)) {
      totalOctets += 34 + value.length + keyBytes.length
    }

    return BigInt(totalOctets)
  }

  private calculateMinBalance(
    items: bigint,
    octets: bigint,
    gratis: bigint,
  ): bigint {
    // Gray Paper: a_minbalance = max(0, Cbasedeposit + Citemdeposit * a_items + Cbytedeposit * a_octets - a_gratis)
    const baseDeposit = BigInt(DEPOSIT_CONSTANTS.C_BASEDEPOSIT)
    const itemDeposit = BigInt(DEPOSIT_CONSTANTS.C_ITEMDEPOSIT) * items
    const byteDeposit = BigInt(DEPOSIT_CONSTANTS.C_BYTEDEPOSIT) * octets

    const totalDeposit = baseDeposit + itemDeposit + byteDeposit
    const minBalance = totalDeposit - gratis

    return minBalance > 0n ? minBalance : 0n
  }

  private writeStorage(
    serviceAccount: ServiceAccount,
    key: Uint8Array,
    value: Uint8Array,
  ): bigint {
    // Get previous value length before writing
    const keyHex = bytesToHex(key)
    const previousValue = serviceAccount.storage.get(keyHex)
    const previousLength = previousValue
      ? BigInt(previousValue.length)
      : ACCUMULATE_ERROR_CODES.NONE

    // Write key-value pair to service account's storage
    serviceAccount.storage.set(keyHex, value)

    // Update storage footprint
    serviceAccount.items = this.calculateItems(
      serviceAccount,
      key,
      value,
      false,
    )
    serviceAccount.octets = this.calculateOctets(
      serviceAccount,
      key,
      value,
      false,
    )

    return previousLength
  }

  private deleteStorage(
    serviceAccount: ServiceAccount,
    key: Uint8Array,
  ): bigint {
    // Get previous value length before deleting
    const keyHex = bytesToHex(key)
    const previousValue = serviceAccount.storage.get(keyHex)
    const previousLength = previousValue
      ? BigInt(previousValue.length)
      : ACCUMULATE_ERROR_CODES.NONE

    // Delete key from service account's storage
    serviceAccount.storage.delete(keyHex)

    // Update storage footprint
    serviceAccount.items = this.calculateItems(
      serviceAccount,
      key,
      new Uint8Array(0),
      true,
    )
    serviceAccount.octets = this.calculateOctets(
      serviceAccount,
      key,
      new Uint8Array(0),
      true,
    )

    return previousLength
  }
}
