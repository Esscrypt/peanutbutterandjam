import {
  createServiceStorageKey,
  deleteServiceStorageValue,
  getAllServiceRequests,
  getAllServiceStorageItems,
  getServiceStorageValue,
  setServiceStorageValue,
} from '@pbnjam/codec'
import type { Hex } from '@pbnjam/core'
import {
  bytesToHex,
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
    const serviceId = writeParams.serviceId

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
      const newItems = this.calculateItems(serviceAccount, serviceId, key, true)
      const newOctets = this.calculateOctets(
        serviceAccount,
        serviceId,
        key,
        new Uint8Array(0),
        true,
      )
      const newMinBalance = this.calculateMinBalance(
        newItems,
        newOctets,
        serviceAccount.gratis,
      )

      // Gray Paper equation 450: Check if new minbalance > balance
      // If so, return FULL and keep old state
      if (newMinBalance > serviceAccount.balance) {
        context.registers[7] = ACCUMULATE_ERROR_CODES.FULL
        context.log(
          'Write host function: Insufficient balance for delete operation',
          {
            balance: serviceAccount.balance.toString(),
            requiredBalance: newMinBalance.toString(),
            newItems: newItems.toString(),
            newOctets: newOctets.toString(),
          },
        )
        return {
          resultCode: null, // continue execution
        }
      }

      // Delete the key
      // Pass newOctets and newItems to avoid recalculating (they were already calculated for balance check)
      const previousLength = this.deleteStorage(serviceAccount, serviceId, key, newOctets, newItems)
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
      const newItems = this.calculateItems(serviceAccount, serviceId, key, false)
      const newOctets = this.calculateOctets(serviceAccount, serviceId, key, value, false)
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
      // Pass newOctets and newItems to avoid recalculating (they were already calculated for balance check)
      const previousLength = this.writeStorage(serviceAccount, serviceId, key, value, newOctets, newItems)
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
    serviceId: bigint,
    key: Uint8Array,
    isDelete: boolean,
  ): bigint {
    // Gray Paper: a_items = 2 * len(a_requests) + len(a_storage)
    const requests = getAllServiceRequests(serviceAccount)
    const requestsCount = requests.size
    
    const storage = getAllServiceStorageItems(serviceAccount)
    const keyHex = bytesToHex(key)
    const storageStateKey = createServiceStorageKey(serviceId, keyHex as Hex)
    const storageStateKeyHex = bytesToHex(storageStateKey)
    const hasKey = storageStateKeyHex in serviceAccount.rawCshKeyvals

    let storageCount = storage.size
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
    serviceId: bigint,
    key: Uint8Array,
    value: Uint8Array,
    isDelete: boolean,
    previousValue?: Uint8Array,
  ): bigint {
    // Incrementally update octets: start with current value and add/subtract delta
    // This avoids needing to know original key lengths for pre-existing items
    let newOctets = serviceAccount.octets

    const keyHex = bytesToHex(key)
    // Use provided previousValue if available (for post-write calculation),
    // otherwise get it from storage (for pre-write balance check)
    const oldValue = previousValue ?? getServiceStorageValue(serviceAccount, serviceId, keyHex)
    const keyExists = oldValue !== undefined

    if (isDelete) {
      // Deleting: subtract 34 + len(old_value) + len(key)
      if (keyExists) {
        const oldEntryOctets = 34n + BigInt(oldValue.length) + BigInt(key.length)
        newOctets -= oldEntryOctets
      }
    } else {
      // Writing: add/subtract delta based on whether key exists
      if (keyExists) {
        // Updating existing key: subtract old, add new
        const oldEntryOctets = 34n + BigInt(oldValue.length) + BigInt(key.length)
        const newEntryOctets = 34n + BigInt(value.length) + BigInt(key.length)
        const delta = newEntryOctets - oldEntryOctets
        newOctets += delta
        fetch('http://127.0.0.1:7242/ingest/3fca1dc3-0561-4f6b-af77-e67afc81f2d7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'write.ts:237',message:'calculateOctets: update delta',data:{serviceId:serviceId.toString(),oldEntryOctets:oldEntryOctets.toString(),newEntryOctets:newEntryOctets.toString(),delta:delta.toString(),previousOctets:serviceAccount.octets.toString(),newOctets:newOctets.toString(),keyLength:key.length.toString(),oldValueLength:oldValue.length.toString(),newValueLength:value.length.toString()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      } else {
        // Adding new key: add 34 + len(new_value) + len(key)
        const newEntryOctets = 34n + BigInt(value.length) + BigInt(key.length)
        newOctets += newEntryOctets
      }
    }

    return newOctets
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
    serviceId: bigint,
    key: Uint8Array,
    value: Uint8Array,
    newOctets: bigint,
    newItems: bigint,
  ): bigint {
    // Get previous value length before writing
    const keyHex = bytesToHex(key)
    const previousValue = getServiceStorageValue(serviceAccount, serviceId, keyHex)
    const previousLength = previousValue
      ? BigInt(previousValue.length)
      : ACCUMULATE_ERROR_CODES.NONE

    // Write key-value pair to service account's storage
    setServiceStorageValue(serviceAccount, serviceId, keyHex, value)

    // Update storage footprint using pre-calculated values from balance check
    // This avoids recalculating and ensures consistency
    serviceAccount.items = newItems
    serviceAccount.octets = newOctets

    return previousLength
  }

  private deleteStorage(
    serviceAccount: ServiceAccount,
    serviceId: bigint,
    key: Uint8Array,
    newOctets: bigint,
    newItems: bigint,
  ): bigint {
    // Get previous value length before deleting
    const keyHex = bytesToHex(key)
    const previousValue = getServiceStorageValue(serviceAccount, serviceId, keyHex)
    const previousLength = previousValue
      ? BigInt(previousValue.length)
      : ACCUMULATE_ERROR_CODES.NONE

    // Delete key from service account's storage
    deleteServiceStorageValue(serviceAccount, serviceId, keyHex)

    // Update storage footprint using pre-calculated values from balance check
    // This avoids recalculating and ensures consistency
    serviceAccount.items = newItems
    serviceAccount.octets = newOctets

    return previousLength
  }
}
