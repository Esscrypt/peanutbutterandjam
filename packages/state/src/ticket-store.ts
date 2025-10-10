/**
 * Block Store - Database Integration for JAM Blocks (Normalized Schema)
 *
 * Provides storage and retrieval of JAM blocks using fully normalized tables
 * No JSONB usage - all extrinsics stored in dedicated tables
 */

import {
  type Hex,
  type SafePromise,
  safeError,
  safeResult,
  safeTry,
} from '@pbnj/core'
import { eq } from 'drizzle-orm'
import type { CoreDb, DbSafroleTicket } from './index'
import { safroleTickets } from './schema/core-schema'

export class TicketStore {
  constructor(private db: CoreDb) {}

  async getTicket(hash: Hex): SafePromise<DbSafroleTicket> {
    const [err, result] = await safeTry(
      this.db
        .select()
        .from(safroleTickets)
        .where(eq(safroleTickets.ticketId, hash))
        .limit(1),
    )
    if (err) {
      return safeError(err)
    }
    return safeResult(result[0])
  }

  async hasTicket(hash: Hex): SafePromise<boolean> {
    const [err, result] = await safeTry(
      this.db
        .select()
        .from(safroleTickets)
        .where(eq(safroleTickets.ticketId, hash))
        .limit(1),
    )
    if (err) {
      return safeError(err)
    }
    return safeResult(result !== null)
  }

  async storeTicket(ticket: DbSafroleTicket): SafePromise<DbSafroleTicket> {
    const [err, result] = await safeTry(
      this.db.insert(safroleTickets).values(ticket).returning(),
    )
    if (err) {
      return safeError(err)
    }
    return safeResult(result[0])
  }
}
