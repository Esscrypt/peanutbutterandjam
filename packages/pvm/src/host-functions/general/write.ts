import {
  deleteServiceStorageValue,
  getServiceStorageValue,
  setServiceStorageValue,
} from '@pbnjam/codec'
import { bytesToHex, calculateMinBalance, logger } from '@pbnjam/core'
import type {
  HostFunctionContext,
  HostFunctionResult,
  ServiceAccount,
  WriteParams,
} from '@pbnjam/types'
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
    const serviceId = writeParams.serviceId

    // Read key from memory
    const [key, faultAddress] = context.ram.readOctets(keyOffset, keyLength)
    if (!key) {
      logger.error('Write host function: Memory read fault for key', {
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
      return this.deleteStorage(context, serviceAccount, serviceId, key)
    } else {
      // Read value from memory
      const [value, _faultAddress] = context.ram.readOctets(
        valueOffset,
        valueLength,
      )
      if (!value) {
        logger.error('Write host function: Memory read fault for value', {
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

      // Write key-value pair to storage
      return this.writeStorage(context, serviceAccount, serviceId, key, value)
    }
  }

  private writeStorage(
    context: HostFunctionContext,
    serviceAccount: ServiceAccount,
    serviceId: bigint,
    key: Uint8Array,
    value: Uint8Array,
  ): HostFunctionResult {
    // Get previous value length before writing
    const keyHex = bytesToHex(key)
    const previousValue = getServiceStorageValue(
      serviceAccount,
      serviceId,
      keyHex,
    )
    const previousLength = previousValue
      ? BigInt(previousValue.length)
      : ACCUMULATE_ERROR_CODES.NONE

    const previousOctets = serviceAccount.octets
    const previousItems = serviceAccount.items

    // Update storage footprint
    // Gray Paper: a_octets = sum over storage of (34 + len(y) + len(x))
    // For new key: add 34 + len(key) + len(value)
    // For existing key: delta is len(new_value) - len(old_value) (34 and len(key) cancel)
    if (!previousValue) {
      // New key: add 34 + len(key) + len(value)
      serviceAccount.items++
      serviceAccount.octets += 34n + BigInt(key.length) + BigInt(value.length)
    } else {
      // Existing key: delta is len(new_value) - len(old_value)
      // The 34 constant and key.length cancel out, so we only adjust value length
      const previousValueLength = BigInt(previousValue.length)
      const newValueLength = BigInt(value.length)
      serviceAccount.octets -= previousValueLength
      serviceAccount.octets += newValueLength
      // No new item since the key already existed
    }

    const newMinBalance = calculateMinBalance(
      serviceAccount.items,
      serviceAccount.octets,
      serviceAccount.gratis,
    )

    // Check if service account has sufficient balance for the new storage footprint
    if (newMinBalance > serviceAccount.balance) {
      // Return FULL (2^64 - 5) for insufficient balance
      context.registers[7] = ACCUMULATE_ERROR_CODES.FULL

      // revert the changes to the service account
      serviceAccount.octets = previousOctets
      serviceAccount.items = previousItems
      logger.warn('Write host function: Insufficient balance', {
        balance: serviceAccount.balance.toString(),
        requiredBalance: newMinBalance.toString(),
        newItems: serviceAccount.items.toString(),
        newOctets: serviceAccount.octets.toString(),
      })
      return {
        resultCode: null, // continue execution
      }
    }

    // Write key-value pair to service account's storage
    setServiceStorageValue(serviceAccount, serviceId, keyHex, value)

    context.registers[7] = previousLength

    return {
      resultCode: null, // continue execution
    }
  }

  private deleteStorage(
    context: HostFunctionContext,
    serviceAccount: ServiceAccount,
    serviceId: bigint,
    key: Uint8Array,
  ): HostFunctionResult {
    // Delete the key
    // Pass newOctets and newItems to avoid recalculating (they were already calculated for balance check)
    // const previousLength = this.deleteStorage(serviceAccount, serviceId, key)
    const keyHex = bytesToHex(key)
    const previousValueToDelete = getServiceStorageValue(
      serviceAccount,
      serviceId,
      keyHex,
    )
    const previousLength = previousValueToDelete
      ? BigInt(previousValueToDelete.length)
      : ACCUMULATE_ERROR_CODES.NONE

    const oldOctets = serviceAccount.octets
    const oldItems = serviceAccount.items

    // Update storage footprint
    // Gray Paper: a_octets = sum over storage of (34 + len(y) + len(x))
    // For delete: subtract 34 + len(key) + len(old_value)
    if (previousValueToDelete) {
      // Gray Paper formula: subtract 34 + len(key) + len(old_value)
      const keyLength = BigInt(key.length)
      const valueLength = previousLength
      const deletedOctets = 34n + keyLength + valueLength
      serviceAccount.octets -= deletedOctets
      serviceAccount.items--
    }

    context.registers[7] = previousLength

    const newMinBalance = calculateMinBalance(
      serviceAccount.items,
      serviceAccount.octets,
      serviceAccount.gratis,
    )

    // Gray Paper equation 450: Check if new minbalance > balance
    // If so, return FULL and keep old state
    if (newMinBalance > serviceAccount.balance) {
      context.registers[7] = ACCUMULATE_ERROR_CODES.FULL

      // revert the changes to the service account
      serviceAccount.octets = oldOctets
      serviceAccount.items = oldItems
      logger.error(
        'Write host function: Insufficient balance for delete operation',
        {
          balance: serviceAccount.balance.toString(),
          requiredBalance: newMinBalance.toString(),
          newItems: serviceAccount.items.toString(),
          newOctets: serviceAccount.octets.toString(),
        },
      )
      return {
        resultCode: null, // continue execution
      }
    }

    if (previousValueToDelete) {
      // Delete key from service account's storage
      deleteServiceStorageValue(serviceAccount, serviceId, keyHex)
    }

    return {
      resultCode: null, // continue execution
    }
  }
}
