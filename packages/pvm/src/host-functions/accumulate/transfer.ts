import { logger } from '@pbnj/core'
import type { DeferredTransfer, HostFunctionResult } from '@pbnj/types'
import { ACCUMULATE_FUNCTIONS, RESULT_CODES } from '../../config'
import {
  type AccumulateHostFunctionContext,
  BaseAccumulateHostFunction,
} from './base'

/**
 * TRANSFER accumulation host function (Ω_T)
 *
 * Transfers tokens between service accounts
 *
 * Gray Paper Specification:
 * - Function ID: 20 (transfer)
 * - Gas Cost: 10 + amount
 * - Parameters: registers[7-10] = dest, amount, l, o
 *   - dest: destination service account ID
 *   - amount: transfer amount
 *   - l: gas limit for the transfer
 *   - o: memo offset in memory
 * - Returns: registers[7] = OK or error code
 *
 * Gray Paper Logic:
 * 1. Read memo from memory (128 bytes)
 * 2. Check if destination service exists
 * 3. Check if gas limit is sufficient for destination
 * 4. Check if sender has sufficient balance
 * 5. Create deferred transfer entry
 * 6. Deduct amount from sender's balance
 */
export class TransferHostFunction extends BaseAccumulateHostFunction {
  readonly functionId = ACCUMULATE_FUNCTIONS.TRANSFER
  readonly name = 'transfer'
  readonly gasCost = 10n // Base cost, actual cost is 10 + amount

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const { registers, ram, implications, gasCounter } = context
    // Extract parameters from registers
    const [destinationServiceId, amount, gasLimit, memoOffset] =
      registers.slice(7, 11)

    // Log all input parameters
    context.log('TRANSFER host function invoked', {
      destinationServiceId: destinationServiceId.toString(),
      amount: amount.toString(),
      gasLimit: gasLimit.toString(),
      memoOffset: memoOffset.toString(),
      gasCounter: gasCounter.toString(),
      currentServiceId: implications[0].id.toString(),
    })

    // Read memo from memory (128 bytes - Gray Paper Cmemosize)
    const C_MEMO_SIZE = 128n
    const [memoData, faultAddress] = ram.readOctets(memoOffset, C_MEMO_SIZE)
    if (faultAddress || !memoData) {
      this.setAccumulateError(registers, 'WHAT')
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Calculate actual gas cost (10 + amount)
    const actualGasCost = 10n + amount

    // Validate execution
    if (gasCounter < actualGasCost) {
      return {
        resultCode: RESULT_CODES.OOG,
      }
    }

    // Get the current implications context
    const [imX] = implications

    // Get current service account
    const currentService = imX.state.accounts.get(imX.id)
    if (!currentService) {
      this.setAccumulateError(registers, 'HUH')
      return {
        resultCode: null, // continue execution
      }
    }

    // Check if destination service exists
    const destService = imX.state.accounts.get(destinationServiceId)
    if (!destService) {
      this.setAccumulateError(registers, 'WHO')
      return {
        resultCode: null, // continue execution
      }
    }

    // Check if gas limit is sufficient for destination
    // Gray Paper: l < destService.sa_minmemogas
    if (gasLimit < destService.minmemogas) {
      this.setAccumulateError(registers, 'LOW')
      return {
        resultCode: null, // continue execution
      }
    }

    // Check if sender has sufficient balance after transfer
    // Gray Paper: b = currentService.sa_balance - amount
    const balanceAfterTransfer = currentService.balance - amount
    const C_MIN_BALANCE = 1000000n // Gray Paper constant for minimum balance

    if (balanceAfterTransfer < C_MIN_BALANCE) {
      this.setAccumulateError(registers, 'CASH')
      return {
        resultCode: null, // continue execution
      }
    }

    // Create deferred transfer entry
    // Gray Paper: t = {source: imX.id, dest, amount, memo, gas: l}
    const deferredTransfer = {
      source: imX.id,
      dest: destinationServiceId,
      amount,
      memo: memoData,
      gasLimit,
    } satisfies DeferredTransfer

    // Add transfer to xfers list
    imX.xfers.push(deferredTransfer)

    // Deduct amount from sender's balance
    const balanceBefore = currentService.balance
    currentService.balance = balanceAfterTransfer

    // Verify the balance was actually updated in the state
    const verifyService = imX.state.accounts.get(imX.id)
    logger.debug('[TransferHostFunction] Balance deduction', {
      serviceId: imX.id.toString(),
      balanceBefore: balanceBefore.toString(),
      balanceAfter: balanceAfterTransfer.toString(),
      verifiedBalance: verifyService?.balance.toString(),
      balanceMatches: verifyService?.balance === balanceAfterTransfer,
    })

    // Set success result
    this.setAccumulateSuccess(registers)
    return {
      resultCode: null, // continue execution
    }
  }
}
