/**
 * Ticket Holder Service
 *
 * Handles ticket accumulation and clearing according to Gray Paper Eq. 321-329
 */

import { type Hex, type Safe, safeError, safeResult } from '@pbnj/core'
import {
  BaseService,
  type ITicketHolderService,
  type SafroleTicket,
} from '@pbnj/types'
import type { ConfigService } from './config-service'

/**
 * Ticket holder service implementation
 *
 * Implements Gray Paper Eq. 321-329:
 * ticketaccumulator' = sort_by(x_st_id, n ∪ {ticketaccumulator | e' = e, ∅ | e' > e})^Cepochlen
 */
export class TicketHolderService
  extends BaseService
  implements ITicketHolderService
{
  private ticketAccumulator: SafroleTicket[] = []
  private ticketToHolderPublicKey: Map<Hex, Hex> = new Map()
  private proxyValidatorTickets: SafroleTicket[] = []
  private configService: ConfigService

  constructor(options: { configService: ConfigService }) {
    super('ticket-holder-service')
    this.configService = options.configService
  }

  getTicketAccumulator(): SafroleTicket[] {
    return this.ticketAccumulator.slice(0, this.configService.epochDuration)
  }

  getFullTicketAccumulator(): SafroleTicket[] {
    return this.ticketAccumulator
  }

  getProxyValidatorTickets(): SafroleTicket[] {
    return this.proxyValidatorTickets
  }

  /**
   * Get tickets received via CE131/CE132 that can be included in block extrinsics
   *
   * @returns Array of received tickets sorted by ID
   */
  getReceivedTickets(): SafroleTicket[] {
    // Return tickets sorted by ID for consistent ordering
    return this.sortTicketsByID(this.ticketAccumulator)
  }

  /**
   * Add ticket to accumulator with proper sorting
   * Gray Paper Eq. 321-329: Maintains sorted order by ticket ID
   *
   * Note: No size limit enforcement here - that's handled by the state transition
   * logic according to Gray Paper Eq. 321-329: ^Cepochlen truncation
   */
  addReceivedTicket(ticket: SafroleTicket, publicKey: Hex): void {
    // Insert ticket in correct position to maintain sorted order
    const insertIndex = this.findInsertionIndex(ticket.id)
    this.ticketAccumulator.splice(insertIndex, 0, ticket)
    this.ticketToHolderPublicKey.set(ticket.id, publicKey)
  }

  addProxyValidatorTicket(ticket: SafroleTicket): void {
    this.proxyValidatorTickets.push(ticket)
  }

  getTicketHolder(ticket: SafroleTicket): Safe<Hex> {
    const publicKey = this.ticketToHolderPublicKey.get(ticket.id)
    if (!publicKey) {
      return safeError(new Error('Ticket not found'))
    }
    return safeResult(publicKey)
  }

  /**
   * Find the correct insertion index to maintain sorted order by ticket ID
   * Uses binary search for O(log n) performance
   */
  private findInsertionIndex(ticketId: string): number {
    let left = 0
    let right = this.ticketAccumulator.length

    while (left < right) {
      const mid = Math.floor((left + right) / 2)
      if (this.ticketAccumulator[mid].id < ticketId) {
        left = mid + 1
      } else {
        right = mid
      }
    }

    return left
  }

  /**
   * Add tickets to accumulator according to Gray Paper Eq. 321-324
   *
   * Gray Paper Logic:
   * ticketaccumulator' = sorted union of new tickets + existing accumulator ^Cepochlen
   *
   * Constraints:
   * - Gray Paper Eq. 315: No duplicate ticket IDs in new tickets
   * - Gray Paper Eq. 316: No duplicate ticket IDs between new and existing tickets
   * - Gray Paper Eq. 322: Sort by ticket ID (ascending order)
   * - Gray Paper Eq. 322: Truncate to Cepochlen (600 tickets)
   *
   * @param newTickets - Tickets from block extrinsic to add to accumulator
   * @param isNewEpoch - Whether this is a new epoch (e' > e)
   * @returns Updated ticket accumulator
   */
  addTicketsToAccumulator(
    newTickets: SafroleTicket[],
    isNewEpoch = false,
  ): Safe<SafroleTicket[]> {
    try {
      // Gray Paper Eq. 315: Remove duplicates from new tickets
      const uniqueNewTickets = this.removeDuplicateTickets(newTickets)

      // Gray Paper Eq. 316: Check for duplicates between new and existing tickets
      const [duplicateError, validNewTickets] = this.filterDuplicateTickets(
        uniqueNewTickets,
        this.ticketAccumulator,
      )

      if (duplicateError) {
        return safeError(duplicateError)
      }

      // Gray Paper Eq. 322: Create union of new tickets and existing accumulator
      const existingAccumulator = isNewEpoch
        ? [] // Gray Paper Eq. 322: ∅ when e' > e (new epoch)
        : this.ticketAccumulator // Gray Paper Eq. 322: ticketaccumulator when e' = e (same epoch)

      // Gray Paper Eq. 322: Union of new tickets and existing accumulator
      const unionTickets = [...validNewTickets, ...existingAccumulator]

      // Gray Paper Eq. 322: Sort by ticket ID (ascending order)
      const sortedTickets = this.sortTicketsByID(unionTickets)

      // Gray Paper Eq. 322: Truncate to Cepochlen (600 tickets)
      const truncatedTickets = sortedTickets.slice(
        0,
        this.configService.epochDuration,
      )

      // Update the accumulator
      this.ticketAccumulator = truncatedTickets

      // Update ticket holder mapping for new tickets
      // Note: We don't have the public key here, so we'll need to handle this differently
      // This might need to be passed as a parameter or handled elsewhere

      return safeResult(truncatedTickets)
    } catch (error) {
      return safeError(error as Error)
    }
  }

  /**
   * Remove duplicate tickets from a list (Gray Paper Eq. 315)
   *
   * @param tickets - List of tickets to deduplicate
   * @returns List of unique tickets
   */
  private removeDuplicateTickets(tickets: SafroleTicket[]): SafroleTicket[] {
    const seen = new Set<string>()
    const uniqueTickets: SafroleTicket[] = []

    for (const ticket of tickets) {
      if (!seen.has(ticket.id)) {
        seen.add(ticket.id)
        uniqueTickets.push(ticket)
      }
    }

    return uniqueTickets
  }

  /**
   * Filter out tickets that already exist in the accumulator (Gray Paper Eq. 316)
   *
   * @param newTickets - New tickets to check
   * @param existingAccumulator - Current accumulator
   * @returns Valid new tickets (no duplicates)
   */
  private filterDuplicateTickets(
    newTickets: SafroleTicket[],
    existingAccumulator: SafroleTicket[],
  ): Safe<SafroleTicket[]> {
    const existingIds = new Set(existingAccumulator.map((t) => t.id))
    const validTickets: SafroleTicket[] = []

    for (const ticket of newTickets) {
      if (existingIds.has(ticket.id)) {
        return safeError(new Error(`Duplicate ticket ID found: ${ticket.id}`))
      }
      validTickets.push(ticket)
    }

    return safeResult(validTickets)
  }

  /**
   * Sort tickets by ID in ascending order (Gray Paper Eq. 322)
   *
   * @param tickets - Tickets to sort
   * @returns Sorted tickets
   */
  private sortTicketsByID(tickets: SafroleTicket[]): SafroleTicket[] {
    return [...tickets].sort((a, b) => {
      // Sort by ticket ID (ascending order)
      // Lower ID = higher score = better ticket
      return a.id.localeCompare(b.id)
    })
  }

  /**
   * Clear ticket accumulator
   * Gray Paper Eq. 321-329: ticketaccumulator' = ∅ when e' > e
   */
  clearTicketAccumulator(): void {
    this.ticketAccumulator = []
  }

  /**
   * Get accumulator size
   */
  getAccumulatorSize(): number {
    return this.ticketAccumulator.length
  }

  /**
   * Check if accumulator is at or above the epoch length limit
   * Gray Paper: |ticketaccumulator| ≥ Cepochlen
   *
   * Note: This is used for informational purposes only.
   * Actual truncation is handled by state transition logic.
   */
  isAccumulatorFull(): boolean {
    return this.ticketAccumulator.length >= this.configService.epochDuration
  }
}
