// /**
//  * Safrole Consensus Service
//  *
//  * Implements the Safrole consensus protocol according to Gray Paper specification
//  * This service continuously runs the Safrole STF and manages consensus state
//  * Reference: graypaper/text/safrole.tex
//  */

// import {
//   logger,
//   type Safe,
//   type SafePromise,
//   safeError,
//   safeResult,
// } from '@pbnj/core'
// import { executeSafroleSTF, generateTicketsForEpoch } from '@pbnj/safrole'
// import type { BlockStore } from '@pbnj/state'
// import type {
//   SafroleInput,
//   SafroleState,
//   SafroleTicket,
// } from '@pbnj/types'
// import { BaseService, SAFROLE_CONSTANTS } from '@pbnj/types'
// import type { EntropyService } from './entropy'
// import type { EventBusService, SlotChangeEvent } from './event-bus'
// import type { KeyPairService } from './keypair-service'
// import type { RingVRFProver } from '@pbnj/bandersnatch-vrf'
// /**
//  * Safrole Consensus Service Configuration
//  */
// export interface SafroleConsensusConfig {
//   /** Initial Safrole state */
//   initialState: SafroleState
// }

// /**
//  * Safrole Consensus Service Statistics
//  */
// export interface SafroleConsensusStats {
//   /** Total slots processed */
//   slotsProcessed: bigint
//   /** Total epochs processed */
//   epochsProcessed: bigint
//   /** Total tickets processed */
//   ticketsProcessed: bigint
//   /** Total errors encountered */
//   errorsEncountered: bigint
//   /** Last processed slot */
//   lastProcessedSlot: bigint
//   /** Current epoch */
//   currentEpoch: bigint
//   /** Service uptime in milliseconds */
//   uptime: number
//   /** Average slot processing time in milliseconds */
//   averageSlotTime: number
// }

// /**
//  * Safrole Consensus Service
//  *
//  * Continuously runs the Safrole consensus protocol according to Gray Paper
//  */
// export class SafroleConsensusService extends BaseService {
//   private state: SafroleState
//   private eventBusService: EventBusService
//   private keyPairService: KeyPairService
//   private blockStore: BlockStore
//   private validatorKeyService: ValidatorKeyService
//   private entropyService: EntropyService
//   private prover: RingVRFProver
//   private isProcessing = false
//   private stats = {
//     errorsEncountered: 0n,
//     slotsProcessed: 0n,
//     lastProcessedSlot: 0n,
//     uptime: 0,
//     averageSlotTime: 0,
//   }
//   constructor(
//     config: SafroleConsensusConfig,
//     eventBusService: EventBusService,
//     validatorKeyService: KeyPairService,
//     keyPairService: KeyPairService,
//     entropyService: EntropyService,
//     blockStore: BlockStore,
//     prover: RingVRFProver,
//   ) {
//     super('safrole-consensus-service')
//     this.state = { ...config.initialState }
//     this.eventBusService = eventBusService
//     this.validatorKeyService = validatorKeyService
//     this.keyPairService = keyPairService
//     this.entropyService = entropyService
//     this.blockStore = blockStore
//     this.prover = prover
//   }

//   override start(): Safe<boolean> {
//     this.eventBusService.onSlotChange(this.processSlot)
//     return safeResult(true)
//   }
//   override stop(): Safe<boolean> {
//     this.eventBusService.removeSlotChangeCallback(this.processSlot)
//     return safeResult(true)
//   }

//   /**
//    * Initialize the Safrole consensus service
//    */
//   async init(): SafePromise<boolean> {
//     logger.info('Initializing Safrole consensus service...')

//     // Validate initial state
//     if (!this.validateInitialState()) {
//       return safeError(new Error('Invalid initial state'))
//     }

//     this.setInitialized(true)
//     logger.info('Safrole consensus service initialized successfully', {
//       initialState: this.state,
//     })

//     return safeResult(true)
//   }

//   /**
//    * Get current Safrole state
//    */
//   getState(): SafroleState {
//     return { ...this.state }
//   }

//   getStats() {
//     return {
//       errorsEncountered: this.stats.errorsEncountered,
//       slotsProcessed: this.stats.slotsProcessed,
//       lastProcessedSlot: this.stats.lastProcessedSlot,
//       currentEpoch:
//         this.stats.lastProcessedSlot / BigInt(SAFROLE_CONSTANTS.EPOCH_LENGTH),
//       uptime: Date.now() - this.stats.uptime,
//       averageSlotTime: this.stats.averageSlotTime,
//     }
//   }

//   /**
//    * Process a specific slot manually (for testing/debugging)
//    */
//   async processSlot(event: SlotChangeEvent): Promise<Safe<void>> {
//     if (this.isProcessing) {
//       return safeError(new Error('Already processing a slot'))
//     }

//     try {
//       // Generate input if not provided
//       const [safroleInputError, safroleInput] = this.generateSlotInput(
//         event.slot,
//       )
//       if (safroleInputError) {
//         return safeError(safroleInputError)
//       }

//       // Execute the Safrole STF
//       const [error, result] = await executeSafroleSTF(
//         this.state,
//         safroleInput,
//         Number(event.slot),
//         [], // stagingSet - empty for now
//         [], // activeSet - empty for now
//         new Set(), // offenders - empty for now
//       )

//       if (error) {
//         this.stats.errorsEncountered++
//         logger.error('Safrole STF execution failed', {
//           slot: event.slot,
//           error,
//           state: this.state,
//         })
//         return safeError(error)
//       }

//       if (!result) {
//         return safeError(new Error('Safrole STF returned undefined result'))
//       }

//       // Update state
//       this.state = result.state

//       return safeResult(undefined)
//     } catch (error) {
//       this.stats.errorsEncountered++
//       const errorMessage =
//         error instanceof Error ? error.message : String(error)
//       logger.error('Error processing slot', {
//         slot: event.slot,
//         error: errorMessage,
//         state: this.state,
//       })
//       return safeError(new Error(errorMessage))
//     } finally {
//       this.isProcessing = false
//     }
//   }

//   /**
//    * Validate the current state
//    */
//   validateState(): { valid: boolean; errors: string[] } {
//     const errors: string[] = []

//     // Validate pending set
//     if (!Array.isArray(this.state.pendingSet)) {
//       errors.push('Invalid pending set: must be an array')
//     }

//     // Validate epoch root
//     if (!this.state.epochRoot || !this.state.epochRoot.startsWith('0x')) {
//       errors.push('Invalid epoch root format')
//     }

//     // Validate seal tickets
//     if (!Array.isArray(this.state.sealTickets)) {
//       errors.push('Invalid seal tickets: must be an array')
//     }

//     // Validate ticket accumulator
//     if (!Array.isArray(this.state.ticketAccumulator)) {
//       errors.push('Invalid ticket accumulator: must be an array')
//     }

//     return {
//       valid: errors.length === 0,
//       errors,
//     }
//   }

//   /**
//    * Generate slot input for consensus processing according to Gray Paper specifications
//    *
//    * This method uses the seal signature from the previous block to generate VRF entropy
//    * For block 1, it uses the seal signature from the genesis block
//    */
//   private generateSlotInput(slot: bigint): Safe<SafroleInput> {
//     try {
//       // 1. Get validator credentials and verify authorization
//       const localKeyPair = this.keyPairService.getLocalKeyPair()

//       // 2. Calculate epoch and slot timing
//       const phase = slot % BigInt(SAFROLE_CONSTANTS.EPOCH_LENGTH)
//       const isInEpochTail = phase >= BigInt(SAFROLE_CONSTANTS.EPOCH_TAIL_START)

//       // 3. generate the seal signature output
//       const sealOutput = generateRingVRFProof(
//         localKeyPair.bandersnatchKeyPair.privateKey,
//         new Uint8Array(0),
//         new Uint8Array(0),
//         ringKeys,
//         localKeyPair.validatorIndex,
//       )

//       // 4. Generate VRF entropy using the seal signature output
//       const [entropyError, entropy] = this.entropyService.generateVRFEntropy(
//         localKeyPair.bandersnatchKeyPair.privateKey,
//         sealOutput,
//       )

//       if (entropyError) {
//         logger.error('Failed to generate VRF entropy', { error: entropyError })
//         return safeError(entropyError)
//       }

//       // Get entropy_2 for ticket generation
//       const entropy2 = this.entropyService.getEntropy2()

//       // const ticketIndices = this.state.sealTickets.map((ticket) => ticket.entryIndex)

//       // 5. Generate ticket proofs if not in epoch tail
//       const extrinsic: SafroleTicket[] = []
//       if (!isInEpochTail) {
//         // Get validator index for the current slot
//         const validatorIndex = this.validatorKeyService.getValidatorIndex(
//           localKeyPair.ed25519KeyPair.publicKey,
//         )
//         const epochRoot = this.validatorKeyService.getEpochRoot()
//         if (validatorIndex === null) {
//           logger.warn('Not authorized for this slot', { slot })
//         } else {
//           const [error, tickets] = generateTicketsForEpoch(
//             this.validatorKeyService,
//             this.keyPairService,
//             this.entropyService,
//             this.ringProver,
//           )

//           if (error) {
//             logger.error('Failed to generate ticket proofs', { error })
//           } else if (tickets) {
//             extrinsic.push(...tickets)
//           }
//         }
//       }

//       return {
//         slot,
//         entropy,
//         extrinsic,
//       }
//     } catch (error) {
//       logger.error('Failed to generate slot input', { error, slot })
//       return safeError(error as Error)
//     }
//   }

//   /**
//    * Validate initial state
//    */
//   private validateInitialState(): boolean {
//     const validation = this.validateState()
//     if (!validation.valid) {
//       logger.error('Invalid initial state', { errors: validation.errors })
//       return false
//     }
//     return true
//   }
// }
