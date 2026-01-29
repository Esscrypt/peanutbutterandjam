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

  execute(context: AccumulateHostFunctionContext): HostFunctionResult {
    const { registers, ram, implications } = context
    // Extract parameters from registers
    // Gray Paper pvm_invocations.tex line 818: [dest, amount, l, o] = registers[7:4]
    // registers[7] = dest (destination service ID)
    // registers[8] = amount (transfer amount)
    // registers[9] = l (gas limit for transfer)
    // registers[10] = o (memo offset in memory)
    const [destinationServiceId, amount, gasLimit, memoOffset] =
      registers.slice(7, 11)

    const logServiceId = implications[0].id

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
      logger.info(
        `[host-calls] [${logServiceId}] TRANSFER(${destinationServiceId}, ${amount}, ${gasLimit}) <- PANIC`,
      )
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
      logger.info(
        `[host-calls] [${logServiceId}] TRANSFER(${destinationServiceId}, ${amount}, ${gasLimit}) <- HUH`,
      )
      return {
        resultCode: null, // continue execution
      }
    }

    // Check if destination service exists
    const destService = imX.state.accounts.get(destinationServiceId)
    if (!destService) {
      this.setAccumulateError(registers, 'WHO')
      logger.info(
        `[host-calls] [${logServiceId}] TRANSFER(${destinationServiceId}, ${amount}, ${gasLimit}) <- WHO`,
      )
      return {
        resultCode: null, // continue execution
      }
    }

    // Check if gas limit is sufficient for destination
    // Gray Paper: l < destService.sa_minmemogas
    if (gasLimit < destService.minmemogas) {
      this.setAccumulateError(registers, 'LOW')
      logger.info(
        `[host-calls] [${logServiceId}] TRANSFER(${destinationServiceId}, ${amount}, ${gasLimit}) <- LOW`,
      )
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
      logger.info(
        `[host-calls] [${logServiceId}] TRANSFER(${destinationServiceId}, ${amount}, ${gasLimit}) <- CASH`,
      )
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
    // CRITICAL: Ensure we're modifying the account that's actually in the state map
    // Get the account directly from the state map to ensure we have the correct reference
    const accountInState = imX.state.accounts.get(imX.id)
    if (!accountInState) {
      this.setAccumulateError(registers, 'HUH')
      logger.info(
        `[host-calls] [${logServiceId}] TRANSFER(${destinationServiceId}, ${amount}, ${gasLimit}) <- HUH`,
      )
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

    accountInState.balance = balanceAfterTransfer

    // Set success result
    this.setAccumulateSuccess(registers)

    // Log in the requested format: [host-calls] [serviceId] TRANSFER(dest, amount, gasLimit) <- OK
    logger.info(
      `[host-calls] [${logServiceId}] TRANSFER(${destinationServiceId}, ${amount}, ${gasLimit}) <- OK`,
    )

    // Gray Paper: On success, gas cost is 10 + l (where l = gasLimit)
    // The base 10 gas is deducted in the context mutator, so we return
    // the gasLimit as additionalGasCost to be deducted there
    return {
      resultCode: null, // continue execution
      additionalGasCost: gasLimit,
    }
  }
}
