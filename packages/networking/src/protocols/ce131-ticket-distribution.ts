// /**
//  * CE 131: Ticket Distribution Protocol (Generator to Proxy Validator)
//  *
//  * Implements the first step of Safrole ticket distribution for JAMNP-S
//  * Generator validator sends ticket to deterministically-selected proxy validator
//  */

// import {
//   blake2bHash,
//   type Hex,
//   type SafePromise,
//   safeError,
//   safeResult,
//   type Safe,
//   concatBytes,
//   numberToBytes,
//   bytesToNumber,
// } from '@pbnj/core'
// import type { TicketStore } from '@pbnj/state'
// import type { TicketDistributionRequest } from '@pbnj/types'
// import { NetworkingProtocol } from './protocol'

// /**
//  * CE 131: Generator to Proxy Validator Ticket Distribution
//  */
// // Attempt = 0 OR 1 (Single byte)
// // Bandersnatch RingVRF Proof = [u8; 784]
// // Ticket = Attempt ++ Bandersnatch RingVRF Proof (As in GP)

// // Validator -> Validator

// // --> Epoch Index ++ Ticket (Epoch index should identify the epoch that the ticket will be used in)
// // --> FIN
// // <-- FIN
// export class CE131TicketDistributionProtocol extends NetworkingProtocol<
// TicketDistributionRequest,
//   void
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
//   ): TicketDistributionRequest {
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
//    * Serialize ticket distribution message
//    */
//   serializeRequest(distribution: TicketDistributionRequest): Safe<Uint8Array> {
//     // Serialize according to JAMNP-S specification
//     const parts: Uint8Array[] = []
//     parts.push(numberToBytes(distribution.epochIndex))
//     parts.push(numberToBytes(distribution.ticket.attempt))
//     parts.push(distribution.ticket.proof)
//     return safeResult(concatBytes(parts))
//   }

//   /**
//    * Deserialize ticket distribution message
//    */
//   deserializeRequest(data: Uint8Array): Safe<TicketDistributionRequest> {
//     const epochIndex = bytesToNumber(data.slice(0, 4))
//     const attempt = bytesToNumber(data.slice(4, 8))
//     const proof = data.slice(8)
//     return safeResult({
//       epochIndex,
//       ticket: { attempt, proof },
//     })
//   }

//   /**
//    * Serialize response (same as request for this protocol)
//    */
//   serializeResponse(_distribution: void): Safe<Uint8Array> {
//     return safeResult(new Uint8Array())
//   }

//   /**
//    * Deserialize response (same as request for this protocol)
//    */
//   deserializeResponse(_data: Uint8Array): Safe<void> {
//     return safeResult(undefined)
//   }

//   /**
//    * Process ticket distribution request
//    */
//   async processRequest(data: TicketDistributionRequest): SafePromise<TicketDistributionResponse> {
//       // Store the received ticket
//       await this.storeTicket(data.epochIndex, data.ticket)

//       // For CE 131, we just acknowledge receipt
//       // The actual forwarding happens in CE 132
//       return safeResult({
//         epochIndex: data.epochIndex,
//         ticket: data.ticket,
//       })

//   }

//   async processResponse(data: TicketDistributionResponse): SafePromise<void> {
//     return safeResult(undefined)
//   }
// }
