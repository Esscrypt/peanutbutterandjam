/**
 * CE 131-132: Ticket Distribution Protocol
 *
 * Implements the Safrole ticket distribution protocol for JAMNP-S
 * CE 131: Generator to proxy validator
 * CE 132: Proxy validator to all current validators
 */

import type { NetworkingStore } from '@pbnj/state'
import type { StreamInfo, TicketDistribution } from '@pbnj/types'

/**
 * Ticket distribution protocol handler
 */
export class TicketDistributionProtocol {
  private tickets: Map<string, { ticket: Uint8Array; timestamp: number }> =
    new Map()
  private dbIntegration: NetworkingStore | null = null

  constructor(dbIntegration?: NetworkingStore) {
    this.dbIntegration = dbIntegration || null
  }

  /**
   * Set database integration for persistent storage
   */
  setDatabaseIntegration(dbIntegration: NetworkingStore): void {
    this.dbIntegration = dbIntegration
  }

  /**
   * Load state from database
   */
  async loadState(): Promise<void> {
    if (!this.dbIntegration) return

    try {
      // Load tickets from database (service ID 4 for tickets)
      // We'll implement this when the protocol is fully implemented
      console.log(
        'Ticket distribution state loading - protocol not yet fully implemented',
      )
    } catch (error) {
      console.error('Failed to load ticket state from database:', error)
    }
  }

  /**
   * Store ticket in local store and persist to database
   */
  async storeTicket(
    epochIndex: number,
    ticket: { attempt: number; proof: Uint8Array },
  ): Promise<void> {
    const ticketHash = Buffer.from(`${epochIndex}_${ticket.attempt}`)
    const hashString = ticketHash.toString()
    this.tickets.set(hashString, {
      ticket: ticket.proof,
      timestamp: Date.now(),
    })

    // Persist to database if available
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.setServiceStorage(
          `ticket_${hashString}`,
          ticket.proof,
        )

        // Store metadata
        const metadata = {
          epochIndex,
          attempt: ticket.attempt,
          timestamp: Date.now(),
        }

        await this.dbIntegration.setServiceStorage(
          `ticket_meta_${hashString}`,
          Buffer.from(JSON.stringify(metadata), 'utf8'),
        )
      } catch (error) {
        console.error('Failed to persist ticket to database:', error)
      }
    }
  }

  /**
   * Get ticket from local store
   */
  getTicket(epochIndex: number, attempt: number): Uint8Array | undefined {
    const hashString = `${epochIndex}_${attempt}`
    return this.tickets.get(hashString)?.ticket
  }

  /**
   * Get ticket from database if not in local store
   */
  async getTicketFromDatabase(
    epochIndex: number,
    attempt: number,
  ): Promise<Uint8Array | null> {
    if (this.getTicket(epochIndex, attempt)) {
      return this.getTicket(epochIndex, attempt) || null
    }

    if (!this.dbIntegration) return null

    try {
      const hashString = `${epochIndex}_${attempt}`
      const ticketData = await this.dbIntegration.getServiceStorage(
        `ticket_${hashString}`,
      )

      if (ticketData) {
        // Cache in local store
        this.tickets.set(hashString, {
          ticket: ticketData,
          timestamp: Date.now(),
        })
        return ticketData
      }

      return null
    } catch (error) {
      console.error('Failed to get ticket from database:', error)
      return null
    }
  }

  /**
   * Process ticket distribution
   */
  async processTicketDistribution(
    distribution: TicketDistribution,
  ): Promise<void> {
    try {
      // Store the ticket
      await this.storeTicket(distribution.epochIndex, distribution.ticket)

      console.log(
        `Processed ticket distribution for epoch ${distribution.epochIndex}, attempt ${distribution.ticket.attempt}`,
      )
    } catch (error) {
      console.error('Failed to process ticket distribution:', error)
    }
  }

  /**
   * Create ticket distribution message
   */
  createTicketDistribution(
    epochIndex: number,
    ticket: { attempt: number; proof: Uint8Array },
  ): TicketDistribution {
    return {
      epochIndex,
      ticket,
    }
  }

  /**
   * Serialize ticket distribution message
   */
  serializeTicketDistribution(distribution: TicketDistribution): Uint8Array {
    // Serialize according to JAMNP-S specification
    const buffer = new ArrayBuffer(4 + 4 + 4 + distribution.ticket.proof.length)
    const view = new DataView(buffer)
    let offset = 0

    // Write epoch index (4 bytes, little-endian)
    view.setUint32(offset, distribution.epochIndex, true)
    offset += 4

    // Write attempt (4 bytes, little-endian)
    view.setUint32(offset, distribution.ticket.attempt, true)
    offset += 4

    // Write proof length (4 bytes, little-endian)
    view.setUint32(offset, distribution.ticket.proof.length, true)
    offset += 4

    // Write proof data
    new Uint8Array(buffer).set(distribution.ticket.proof, offset)

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize ticket distribution message
   */
  deserializeTicketDistribution(data: Uint8Array): TicketDistribution {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read epoch index (4 bytes, little-endian)
    const epochIndex = view.getUint32(offset, true)
    offset += 4

    // Read attempt (4 bytes, little-endian)
    const attempt = view.getUint32(offset, true)
    offset += 4

    // Read proof length (4 bytes, little-endian)
    const proofLength = view.getUint32(offset, true)
    offset += 4

    // Read proof data
    const proof = data.slice(offset, offset + proofLength)

    return {
      epochIndex,
      ticket: {
        attempt,
        proof,
      },
    }
  }

  /**
   * Handle incoming stream data
   */
  async handleStreamData(_stream: StreamInfo, data: Uint8Array): Promise<void> {
    try {
      const distribution = this.deserializeTicketDistribution(data)
      await this.processTicketDistribution(distribution)
    } catch (error) {
      console.error('Failed to handle ticket distribution stream data:', error)
    }
  }
}
