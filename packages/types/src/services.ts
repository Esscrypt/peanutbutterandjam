import type { Hex, Safe, SafePromise } from '@pbnj/core'
import type { PreimageAnnouncement } from './jamnp'
import type { ValidatorCredentials } from './keys'
import type {
  Judgment,
  Preimage,
  SafroleTicket,
  ValidatorKeyTuple,
} from './serialization'
import type { BaseService } from './service'

export interface IValidatorSetManager extends BaseService {
  getActiveValidatorKeys(): Uint8Array[]
  getValidatorIndex(ed25519PublicKey: Hex): Safe<number>
  getActiveValidators(): Map<number, ValidatorKeyTuple>
  getValidatorAtIndex(validatorIndex: number): Safe<ValidatorKeyTuple>
  getPendingValidators(): Map<number, ValidatorKeyTuple>
}

export interface IKeyPairService extends BaseService {
  getLocalKeyPair(): ValidatorCredentials
}

export interface IEntropyService extends BaseService {
  getEntropy1(): Uint8Array
  getEntropy2(): Uint8Array
  getEntropy3(): Uint8Array
  getEntropyAccumulator(): Uint8Array
}

export interface ITicketHolderService extends BaseService {
  getTicketAccumulator(): SafroleTicket[]
  addReceivedTicket(ticket: SafroleTicket, publicKey: Hex): void
  addProxyValidatorTicket(ticket: SafroleTicket): void
  getProxyValidatorTickets(): SafroleTicket[]
  getReceivedTickets(): SafroleTicket[]
}

export interface IPreimageHolderService extends BaseService {
  getPreimage(hash: Hex): SafePromise<Preimage | null>
  storePreimage(preimage: Preimage, creationSlot: bigint): SafePromise<Hex>
  getAllAvailablePreimages(): SafePromise<Map<Hex, Preimage>>
  storePreimageToRequest(announcement: PreimageAnnouncement): void
  getPreimagesToRequest(): Hex[]
  clearPreimageToRequest(hash: Hex): void
}

export interface IJudgmentHolderService extends BaseService {
  getJudgements(): Judgment[]
  addJudgement(
    judgement: Judgment,
    epochIndex: bigint,
    workReportHash: Hex,
  ): SafePromise<void>
}

export interface IConfigService extends BaseService {
  get epochDuration(): number
  get ticketsPerValidator(): number
  get maxTicketsPerExtrinsic(): number
  get contestDuration(): number
  get rotationPeriod(): number
  get numEcPiecesPerSegment(): number
  get maxBlockGas(): number
  get maxRefineGas(): number
  get numValidators(): number
  get numCores(): number
  get preimageExpungePeriod(): number
  get slotDuration(): number
}

export interface IClockService extends BaseService {
  getCurrentSlot(): bigint
  getCurrentEpoch(): bigint
  getCurrentPhase(): bigint
}
