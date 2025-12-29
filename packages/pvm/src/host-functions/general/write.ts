import {
  bytesToHex,
  calculateServiceAccountItems,
  calculateServiceAccountOctets,
} from '@pbnjam/core'
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
    // Use the extracted function from @pbnjam/core
    return calculateServiceAccountItems(serviceAccount, {
      writeKey: key,
      isDelete,
    })
  }

  private calculateOctets(
    serviceAccount: ServiceAccount,
    key: Uint8Array,
    value: Uint8Array,
    isDelete: boolean,
  ): bigint {
    // Use the extracted function from @pbnjam/core
    return calculateServiceAccountOctets(serviceAccount, {
      writeKey: key,
      writeValue: value,
      isDelete,
    })
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
