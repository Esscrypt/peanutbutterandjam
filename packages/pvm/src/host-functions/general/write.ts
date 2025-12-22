import { bytesToHex } from '@pbnjam/core'
import type {
  HostFunctionContext,
  HostFunctionResult,
  ServiceAccount,
  WriteParams,
} from '@pbnjam/types'
import { DEPOSIT_CONSTANTS } from '@pbnjam/types'
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

  execute(
    context: HostFunctionContext,
    writeParams: WriteParams,
  ): HostFunctionResult {
    // Extract parameters from registers
    // Gray Paper: registers[7:4] = (keyOffset, keyLength, valueOffset, valueLength)
    const [keyOffset, keyLength, valueOffset, valueLength] =
      context.registers.slice(7, 11)

    const serviceAccount = writeParams.serviceAccount

    // Read key from memory
    const [key, faultAddress] = context.ram.readOctets(keyOffset, keyLength)
    if (!key) {
      context.log('Write host function: Memory read fault for key', {
        keyOffset: keyOffset.toString(),
        keyLength: keyLength.toString(),
        faultAddress: faultAddress?.toString() ?? 'null',
      })
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
      // Gray Paper: Calculate new account state with deletion, then check balance
      // Calculate what the new storage footprint would be after deletion
      const newItems = this.calculateItems(serviceAccount, key, true)
      const newOctets = this.calculateOctets(serviceAccount, key, new Uint8Array(0), true)
      const newMinBalance = this.calculateMinBalance(
        newItems,
        newOctets,
        serviceAccount.gratis,
      )

      // Gray Paper equation 450: Check if new minbalance > balance
      // If so, return FULL and keep old state
      if (newMinBalance > serviceAccount.balance) {
        context.registers[7] = ACCUMULATE_ERROR_CODES.FULL
        context.log('Write host function: Insufficient balance for delete operation', {
          balance: serviceAccount.balance.toString(),
          requiredBalance: newMinBalance.toString(),
          newItems: newItems.toString(),
          newOctets: newOctets.toString(),
        })
        return {
          resultCode: null, // continue execution
        }
      }

      // Delete the key
      const previousLength = this.deleteStorage(serviceAccount, key)
      context.registers[7] = previousLength
      context.log('Write host function: Storage key deleted', {
        keyLength: key.length.toString(),
        previousLength: previousLength.toString(),
      })
    } else {
      // Read value from memory
      const [value, _faultAddress] = context.ram.readOctets(
        valueOffset,
        valueLength,
      )
      if (!value) {
        context.log('Write host function: Memory read fault for value', {
          valueOffset: valueOffset.toString(),
          valueLength: valueLength.toString(),
          faultAddress: _faultAddress?.toString() ?? 'null',
        })
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
        context.registers[7] = ACCUMULATE_ERROR_CODES.FULL
        context.log('Write host function: Insufficient balance', {
          balance: serviceAccount.balance.toString(),
          requiredBalance: newMinBalance.toString(),
          newItems: newItems.toString(),
          newOctets: newOctets.toString(),
        })
        return {
          resultCode: null, // continue execution
        }
      }

      // Write key-value pair to storage
      const previousLength = this.writeStorage(serviceAccount, key, value)
      context.registers[7] = previousLength
      context.log('Write host function: Storage key-value written', {
        keyLength: key.length.toString(),
        valueLength: value.length.toString(),
        previousLength: previousLength.toString(),
      })
    }

    return {
      resultCode: null, // continue execution
    }
  }

  private calculateItems(
    serviceAccount: ServiceAccount,
    key: Uint8Array,
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

    for (const [existingKeyHex, existingValue] of serviceAccount.storage) {
      if (existingKeyHex === keyHex) {
        // This is the key we're modifying
        if (!isDelete) {
          // Adding/updating: use new value
          totalOctets += 34 + value.length + key.length
        }
        // If deleting, skip this entry
      } else {
        // Different key: use existing value
        // Convert hex string length to bytes: subtract "0x" prefix (2 chars), divide by 2
        const existingKeyBytes = (existingKeyHex.length - 2) / 2
        totalOctets += 34 + existingValue.length + existingKeyBytes
      }
    }

    // If adding a new key (not updating existing), add it
    if (!isDelete && !serviceAccount.storage.has(keyHex)) {
      totalOctets += 34 + value.length + key.length
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

    // DEBUG: Log the write operation
    console.log('[WRITE Host Function] Storage key written', {
      keyHex: keyHex.slice(0, 20) + '...',
      valueLength: value.length,
      storageSize: serviceAccount.storage.size,
    })

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
