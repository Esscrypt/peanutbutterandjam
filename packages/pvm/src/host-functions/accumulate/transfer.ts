import { logger } from '@pbnjam/core'
import type { DeferredTransfer, HostFunctionResult } from '@pbnjam/types'
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
 * - Gas Cost: 10 + l (gasLimit) on success, 10 on error
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
  readonly gasCost = 10n // Base cost, actual cost is 10 + gasLimit on success (Gray Paper: g = 10 + t)

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const { registers, ram, implications, gasCounter } = context
    // Extract parameters from registers
    // Gray Paper pvm_invocations.tex line 818: [dest, amount, l, o] = registers[7:4]
    // registers[7] = dest (destination service ID)
    // registers[8] = amount (transfer amount)
    // registers[9] = l (gas limit for transfer)
    // registers[10] = o (memo offset in memory)
    const [destinationServiceId, amount, gasLimit, memoOffset] =
      registers.slice(7, 11)

    // Log all input parameters
    logger.info('TRANSFER host function invoked', {
      destinationServiceId: destinationServiceId.toString(),
      amount: amount.toString(),
      gasLimit: gasLimit.toString(),
      memoOffset: memoOffset.toString(),
      gasCounter: gasCounter.toString(),
      currentServiceId: implications[0].id.toString(),
    })

    // Read memo from memory (128 bytes - Gray Paper Cmemosize)
    // Gray Paper pvm_invocations.tex lines 820-832:
    // t = error when Nrange(o, Cmemosize) not readable
    // c = panic when t = error
    // registers'_7 = registers_7 (unchanged) when c = panic
    const C_MEMO_SIZE = 128n
    const [memoData, faultAddress] = ram.readOctets(memoOffset, C_MEMO_SIZE)
    if (faultAddress || !memoData) {
      // Gray Paper line 832: c = panic when t = error
      // Gray Paper line 839: registers'_7 = registers_7 (unchanged) when c = panic
      // DO NOT modify registers[7] - it must remain unchanged on panic
      logger.error('TRANSFER host function invoked but memo data read failed', {
        faultAddress: faultAddress?.toString() ?? 'null',
        memoOffset: memoOffset.toString(),
        C_MEMO_SIZE: C_MEMO_SIZE.toString(),
      })
      return {
        resultCode: RESULT_CODES.PANIC,
      }
    }

    // Gray Paper: Gas cost is 10 + t, where t = gasLimit on success, t = 0 on error
    // We don't check OOG here - that's handled by the context mutator after we return
    // The gas cost depends on success/failure, so we just validate the base cost of 10
    // The additionalGasCost returned will be applied after this function returns

    // Get the current implications context
    const [imX] = implications

    // Get current service account
    const currentService = imX.state.accounts.get(imX.id)
    if (!currentService) {
      this.setAccumulateError(registers, 'HUH')
      logger.warn('TRANSFER host function invoked but current service account not found', {
        currentServiceId: imX.id.toString(),
      })
      return {
        resultCode: null, // continue execution
      }
    }

    // Check if destination service exists
    const destService = imX.state.accounts.get(destinationServiceId)
    if (!destService) {
      this.setAccumulateError(registers, 'WHO')
      logger.warn('TRANSFER host function invoked but destination service account not found', {
        destinationServiceId: destinationServiceId.toString(),
      })
      return {
        resultCode: null, // continue execution
      }
    }

    // Check if gas limit is sufficient for destination
    // Gray Paper: l < destService.sa_minmemogas
    if (gasLimit < destService.minmemogas) {
      this.setAccumulateError(registers, 'LOW')
      logger.warn('TRANSFER host function invoked but gas limit is insufficient for destination', {
        gasLimit: gasLimit.toString(),
        destServiceMinmemogas: destService.minmemogas.toString(),
      })
      return {
        resultCode: null, // continue execution
      }
    }

    // Check if sender has sufficient balance after transfer
    // Gray Paper line 830: b = (imX_self)_sa_balance - amount
    // Gray Paper line 835: CASH when b < (imX_self)_sa_minbalance
    // Gray Paper accounts.tex: sa_minbalance = max(0, Cbasedeposit + Citemdeposit * items + Cbytedeposit * octets - gratis)
    const balanceAfterTransfer = currentService.balance - amount

    // Calculate minbalance according to Gray Paper accounts.tex
    const C_BASEDEPOSIT = 100n
    const C_ITEMDEPOSIT = 10n
    const C_BYTEDEPOSIT = 1n
    const baseDeposit = C_BASEDEPOSIT
    const itemDeposit = C_ITEMDEPOSIT * currentService.items
    const byteDeposit = C_BYTEDEPOSIT * currentService.octets
    const totalDeposit = baseDeposit + itemDeposit + byteDeposit
    const minbalance =
      totalDeposit > currentService.gratis
        ? totalDeposit - currentService.gratis
        : 0n

    if (balanceAfterTransfer < minbalance) {
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

    logger.debug('[TransferHostFunction] Added transfer to xfers', {
      serviceId: imX.id.toString(),
      destinationServiceId: destinationServiceId.toString(),
      amount: amount.toString(),
      xfersLength: imX.xfers.length,
      xfers: imX.xfers.map((t) => ({
        source: t.source.toString(),
        dest: t.dest.toString(),
        amount: t.amount.toString(),
      })),
    })

    // Deduct amount from sender's balance
    // CRITICAL: Ensure we're modifying the account that's actually in the state map
    // Get the account directly from the state map to ensure we have the correct reference
    const accountInState = imX.state.accounts.get(imX.id)
    if (!accountInState) {
      this.setAccumulateError(registers, 'HUH')
      logger.warn('TRANSFER host function invoked but account in state not found', {
        serviceId: imX.id.toString(),
      })
      return {
        resultCode: null, // continue execution
      }
    }

    // Verify we have the same reference (should always be true, but check for safety)
    if (accountInState !== currentService) {
      logger.warn(
        '[TransferHostFunction] Account reference mismatch, using account from state map',
        {
          serviceId: imX.id.toString(),
        },
      )
    }

    const balanceBefore = accountInState.balance
    accountInState.balance = balanceAfterTransfer

    logger.debug('[TransferHostFunction] Balance deduction', {
      serviceId: imX.id.toString(),
      destinationServiceId: destinationServiceId.toString(),
      amount: amount.toString(),
      balanceBefore: balanceBefore.toString(),
      balanceAfter: balanceAfterTransfer.toString(),
      verifiedBalance: accountInState.balance.toString(),
      balanceMatches: accountInState.balance === balanceAfterTransfer,
    })

    // Set success result
    this.setAccumulateSuccess(registers)

    // Gray Paper: On success, gas cost is 10 + l (where l = gasLimit)
    // The base 10 gas is deducted in the context mutator, so we return
    // the gasLimit as additionalGasCost to be deducted there
    return {
      resultCode: null, // continue execution
      additionalGasCost: gasLimit,
    }
  }
}
