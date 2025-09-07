// /**
//  * CE 132: Ticket Distribution Protocol (Proxy Validator to All Current Validators)
//  *
//  * Implements the second step of Safrole ticket distribution for JAMNP-S
//  * Proxy validator forwards ticket to all current validators
//  */

// import {
//   blake2bHash,
//   type Hex,
//   type SafePromise,
//   safeError,
//   safeResult,
// } from '@pbnj/core'
// import type { TicketStore } from '@pbnj/state'
// import type { TicketDistribution } from '@pbnj/types'
// import { NetworkingProtocol } from './protocol'

// /**
//  * CE 132: Proxy Validator to All Current Validators Ticket Distribution
//  */
// export class CE132TicketDistributionProtocol extends NetworkingProtocol<
//   TicketDistribution,
//   TicketDistribution
// > {
//   private tickets: Map<string, Uint8Array> = new Map()
//   private ticketStore: TicketStore

//   constructor(ticketStore: TicketStore) {
//     super()
//     this.ticketStore = ticketStore
//   }

//   /**
//    * Create ticket distribution message
//    */
//   createTicketDistribution(
//     epochIndex: bigint,
//     ticket: { attempt: bigint; proof: Uint8Array },
//   ): TicketDistribution {
//     return {
//       epochIndex,
//       ticket,
//     }
//   }

//   /**
//    * Store ticket in local cache and persist to database
//    */
//   async storeTicket(
//     epochIndex: bigint,
//     ticket: { attempt: bigint; proof: Uint8Array },
//   ): Promise<void> {
//     const hashString = `${epochIndex}_${ticket.attempt}`

//     // Store in local cache
//     this.tickets.set(hashString, ticket.proof)

//     // Persist to database if available
//     if (this.ticketStore) {
//       try {
//         // Calculate ticket hash from proof
//         const [hashError, ticketHash] = blake2bHash(ticket.proof)
//         if (hashError || !ticketHash) {
//           console.error('Failed to calculate ticket hash:', hashError)
//           return
//         }

//         await this.ticketStore.storeTicket({
//           id: 0, // Will be set by database
//           blockHash:
//             '0x0000000000000000000000000000000000000000000000000000000000000000', // Placeholder
//           ticketId: ticketHash,
//           entryIndex: ticket.attempt,
//           signature:
//             '0x0000000000000000000000000000000000000000000000000000000000000000', // Placeholder
//           timestamp: BigInt(Date.now()),
//           createdAt: new Date(),
//         })
//       } catch (error) {
//         console.error('Failed to persist ticket to database:', error)
//       }
//     }
//   }

//   /**
//    * Get ticket from local cache
//    */
//   getTicket(epochIndex: bigint, attempt: bigint): Uint8Array | undefined {
//     const hashString = `${epochIndex}_${attempt}`
//     return this.tickets.get(hashString)
//   }

//   /**
//    * Get ticket from database if not in local cache
//    */
//   async getTicketFromDatabase(
//     epochIndex: bigint,
//     attempt: bigint,
//   ): Promise<Uint8Array | null> {
//     if (this.getTicket(epochIndex, attempt)) {
//       return this.getTicket(epochIndex, attempt) || null
//     }

//     if (!this.ticketStore) return null

//     try {
//       const hashString = `${epochIndex}_${attempt}`
//       const [error, ticketData] = await this.ticketStore.getTicket(
//         hashString as Hex,
//       )

//       if (error || !ticketData) {
//         return null
//       }

//       // Cache in local store - convert hex string to Uint8Array
//       const signatureBytes = new Uint8Array(
//         Buffer.from(ticketData.signature.slice(2), 'hex'),
//       )
//       this.tickets.set(hashString, signatureBytes)
//       return signatureBytes
//     } catch (error) {
//       console.error('Failed to get ticket from database:', error)
//       return null
//     }
//   }

//   /**
//    * Verify ticket proof and proxy selection
//    */
//   async verifyTicket(
//     distribution: TicketDistribution,
//     validatorIndex: bigint,
//     totalValidators: number,
//   ): Promise<boolean> {
//     try {
//       // Verify the VRF proof (simplified - in practice would use proper VRF verification)
//       if (distribution.ticket.proof.length === 0) {
//         return false
//       }

//       // Verify proxy selection
//       // The proxy validator is determined by interpreting the last 4 bytes of the ticket's VRF output
//       // as a big-endian unsigned integer, modulo the number of validators
//       const vrfOutput = distribution.ticket.proof.slice(-4)
//       const view = new DataView(
//         vrfOutput.buffer,
//         vrfOutput.byteOffset,
//         vrfOutput.byteLength,
//       )
//       const proxyIndex = view.getUint32(0, false) % totalValidators // big-endian

//       return Number(validatorIndex) === proxyIndex
//     } catch (error) {
//       console.error('Failed to verify ticket:', error)
//       return false
//     }
//   }

//   /**
//    * Serialize ticket distribution message
//    */
//   serializeRequest(distribution: TicketDistribution): Uint8Array {
//     // Serialize according to JAMNP-S specification
//     const buffer = new ArrayBuffer(4 + 4 + 4 + distribution.ticket.proof.length)
//     const view = new DataView(buffer)
//     let offset = 0

//     // Write epoch index (4 bytes, little-endian)
//     view.setUint32(offset, Number(distribution.epochIndex), true)
//     offset += 4

//     // Write attempt (4 bytes, little-endian)
//     view.setUint32(offset, Number(distribution.ticket.attempt), true)
//     offset += 4

//     // Write proof length (4 bytes, little-endian)
//     view.setUint32(offset, distribution.ticket.proof.length, true)
//     offset += 4

//     // Write proof data
//     new Uint8Array(buffer).set(distribution.ticket.proof, offset)

//     return new Uint8Array(buffer)
//   }

//   /**
//    * Deserialize ticket distribution message
//    */
//   deserializeRequest(data: Uint8Array): TicketDistribution {
//     const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
//     let offset = 0

//     // Read epoch index (4 bytes, little-endian)
//     const epochIndex = view.getUint32(offset, true)
//     offset += 4

//     // Read attempt (4 bytes, little-endian)
//     const attempt = view.getUint32(offset, true)
//     offset += 4

//     // Read proof length (4 bytes, little-endian)
//     const proofLength = view.getUint32(offset, true)
//     offset += 4

//     // Read proof data
//     const proof = data.slice(offset, offset + proofLength)

//     return {
//       epochIndex: BigInt(epochIndex),
//       ticket: {
//         attempt: BigInt(attempt),
//         proof,
//       },
//     }
//   }

//   /**
//    * Serialize response (same as request for this protocol)
//    */
//   serializeResponse(distribution: TicketDistribution): Uint8Array {
//     return this.serializeRequest(distribution)
//   }

//   /**
//    * Deserialize response (same as request for this protocol)
//    */
//   deserializeResponse(data: Uint8Array): TicketDistribution {
//     return this.deserializeRequest(data)
//   }

//   /**
//    * Process ticket distribution request
//    */
//   async process(data: TicketDistribution): SafePromise<TicketDistribution> {
//     try {
//       // Store the received ticket
//       await this.storeTicket(data.epochIndex, data.ticket)

//       // For CE 132, we acknowledge receipt and the ticket is now available
//       // for inclusion in blocks by all validators
//       return safeResult(data)
//     } catch (error) {
//       return safeError(
//         new Error(`Failed to process ticket distribution: ${error}`),
//       )
//     }
//   }
// }
