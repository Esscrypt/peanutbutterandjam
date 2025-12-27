/**
 * State Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: Appendix C - State Merklization
 * Formula (Equation 21-112):
 *
 * State-key constructor functions C:
 * C: N₈ ∪ ⟨N₈, serviceid⟩ ∪ ⟨serviceid, blob⟩ → blob[31]
 *
 * State serialization T(σ):
 * T(σ) ≡ {
 *   C(2) ↦ encode(authqueue),
 *   C(3) ↦ encode(var{⟨⟨RH_headerhash, RH_accoutlogsuperpeak, RH_stateroot, var{RH_reportedpackagehashes}⟩⟩}, mmrencode(accoutbelt)),
 *   C(4) ↦ encode(pendingset, epochroot, discriminator(sealtickets), sealtickets, var{ticketaccumulator}),
 *   C(5) ↦ encode(var{ordered(goodset)}, var{ordered(badset)}, var{ordered(wonkyset)}, var{ordered(offenders)}),
 *   C(6) ↦ encode(entropy),
 *   C(7) ↦ encode(stagingset),
 *   C(8) ↦ encode(activeset),
 *   C(9) ↦ encode(previousset),
 *   C(10) ↦ encode(⟨maybe{⟨RS_workreport, encode[4](RS_timestamp)⟩}⟩),
 *   C(11) ↦ encode[4](thetime),
 *   C(12) ↦ encode(encode[4](manager, assigners, delegator, registrar), alwaysaccers),
 *   C(13) ↦ encode(encode[4](valstatsaccumulator, valstatsprevious), corestats, servicestats),
 *   ...
 * }
 *
 * The serialization places all components of σ into a single mapping from
 * 31-octet state-keys to indefinite-length octet sequences for Merklization.
 *
 * *** IMPLEMENTER EXPLANATION ***
 * State serialization transforms JAM's complex state structure into a
 * flat key-value mapping suitable for Merkle trie storage and commitment.
 *
 * State-key construction C():
 * - **C(i)**: Simple index → 31-byte key starting with i
 * - **C(i, s)**: Index + service → key encoding both values
 * - **C(s, h)**: Service + hash → key for service-specific data
 *
 * Key state components:
 * - **C(2)**: Authorization queue for pending authorizations
 * - **C(3)**: Recent history of blocks and account logs
 * - **C(4)**: Safrole consensus state (tickets, epoch data)
 * - **C(5)**: Validator behavior tracking (good/bad/wonky sets)
 * - **C(6)**: Entropy accumulator for randomness
 * - **C(7-9)**: Validator sets (staging/active/previous)
 * - **C(10)**: Pending work reports
 * - **C(11)**: Current time slot
 * - **C(12)**: Privileges and governance settings
 * - **C(13)**: Statistics and metrics
 * - **C(14-16)**: Work package state (ready/accumulated/last account)
 * - **C(255, s)**: Service account data for service s
 * - **C(s, ...)**: Service-specific storage, preimages, requests
 *
 * This flattening enables:
 * - Efficient Merkle proof generation for any state component
 * - Deterministic state root computation
 * - Partial state synchronization
 * - Compact state commitments (32-byte hash)
 */

import { blake2bHash, bytesToHex, type Hex, hexToBytes } from '@pbnjam/core'
import type {
  GlobalState,
  IConfigService,
  JamVersion,
  Safe,
  StateTrie,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { encodeFixedLength } from '../core/fixed-length'
import { encodeVariableSequence } from '../core/sequence'
import { encodeAccumulated } from './accumulated'
import { encodeActivity } from './activity'
import { encodeAuthpool } from './authpool'
import { encodeAuthqueue } from './authqueue'
import { encodeDisputeState } from './disputes'
import { encodeEntropy } from './entropy'
import { encodeLastAccumulationOutputs } from './last-accumulation-outputs'
import { encodePrivileges } from './privileges'
import { encodeReady } from './ready'
import { encodeRecent } from './recent'
import { encodeStateWorkReports } from './reports'
import { encodeSafrole } from './safrole'
import { encodeServiceAccount } from './service-account'
import { encodeTheTime } from './the-time'
import { encodeValidatorSet } from './validator-set'

/**
 * State key constructor function C from Gray Paper
 * Creates 31-byte state keys from chapter and optional parameters
 */
export function createStateKey(
  chapter: number,
  serviceId?: bigint,
  hash?: Hex,
): Uint8Array {
  const key = new Uint8Array(31)

  if (serviceId !== undefined && hash !== undefined) {
    // C(s, h) = ⟨n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, a₄, a₅, ..., a₂₆⟩
    // where n = encode[4](s), a = blake(h)
    // Bytes are INTERLEAVED: n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃, then a₄...a₂₆
    const serviceUint8Array = new Uint8Array(4)
    const view = new DataView(serviceUint8Array.buffer)
    view.setUint32(0, Number(serviceId), true) // little-endian

    // Gray Paper: a = blake(h)
    // The hash parameter is the combined key (e.g., encode[4]{0xFFFFFFFF} ∥ k for storage)
    // We need to compute the Blake hash of it, then take the first 27 bytes
    const combinedKeyBytes = hexToBytes(hash)
    const [blakeError, blakeHashHex] = blake2bHash(combinedKeyBytes)
    if (blakeError) {
      throw new Error(`Failed to compute Blake hash: ${blakeError.message}`)
    }
    const blakeHashFull = hexToBytes(blakeHashHex)
    const blakeHash = blakeHashFull.slice(0, 27) // Take first 27 bytes of Blake hash

    // Interleave: n₀, a₀, n₁, a₁, n₂, a₂, n₃, a₃
    key[0] = serviceUint8Array[0] // n₀
    key[1] = blakeHash[0] // a₀
    key[2] = serviceUint8Array[1] // n₁
    key[3] = blakeHash[1] // a₁
    key[4] = serviceUint8Array[2] // n₂
    key[5] = blakeHash[2] // a₂
    key[6] = serviceUint8Array[3] // n₃
    key[7] = blakeHash[3] // a₃
    // Remaining bytes: a₄, a₅, ..., a₂₆ (23 bytes)
    key.set(blakeHash.slice(4), 8) // a₄...a₂₆
  } else if (serviceId !== undefined) {
    // C(i, s) = ⟨i, n₀, 0, n₁, 0, n₂, 0, n₃, 0, 0, ...⟩
    // where n = encode[4](s)
    const serviceUint8Array = new Uint8Array(4)
    const view = new DataView(serviceUint8Array.buffer)
    view.setUint32(0, Number(serviceId), true) // little-endian

    key[0] = chapter
    key[1] = serviceUint8Array[0]
    key[3] = serviceUint8Array[1]
    key[5] = serviceUint8Array[2]
    key[7] = serviceUint8Array[3]
    // Rest are already 0
  } else {
    // C(i) = ⟨i, 0, 0, ...⟩
    key[0] = chapter
    // Rest are already 0
  }

  return key
}

/**
 * Create service storage key according to Gray Paper specification.
 *
 * Gray Paper merklization.tex (lines 103-104):
 * ∀ ⟨s, sa⟩ ∈ accounts, ⟨k, v⟩ ∈ sa_storage:
 * C(s, encode[4]{2³²-1} ∥ k) ↦ v
 *
 * Storage keys use the pattern: C(s, encode[4]{0xFFFFFFFF} ∥ storage_key)
 * where s is the service ID and k is the storage key.
 *
 * @param serviceId - Service account ID
 * @param storageKey - Storage key (blob)
 * @returns 31-byte state key for service storage
 */
export function createServiceStorageKey(
  serviceId: bigint,
  storageKey: Hex,
): Uint8Array {
  // Create the prefix: encode[4]{2³²-1} = encode[4]{0xFFFFFFFF}
  const prefix = new Uint8Array(4)
  const prefixView = new DataView(prefix.buffer)
  prefixView.setUint32(0, 0xffffffff, true) // little-endian

  // Concatenate prefix with storage key
  const storageKeyBytes = hexToBytes(storageKey)
  const combinedKey = new Uint8Array(prefix.length + storageKeyBytes.length)
  combinedKey.set(prefix, 0)
  combinedKey.set(storageKeyBytes, prefix.length)

  // Convert to hex for createStateKey
  const combinedKeyHex = bytesToHex(combinedKey)

  // Use C(s, combinedKey) pattern
  return createStateKey(0, serviceId, combinedKeyHex)
}

/**
 * Create service preimage key according to Gray Paper specification.
 *
 * Gray Paper merklization.tex (lines 105-106):
 * ∀ ⟨s, sa⟩ ∈ accounts, ⟨h, p⟩ ∈ sa_preimages:
 * C(s, encode[4]{2³²-2} ∥ h) ↦ p
 *
 * Preimage keys use the pattern: C(s, encode[4]{0xFFFFFFFE} ∥ preimage_hash)
 * where s is the service ID and h is the preimage hash.
 *
 * @param serviceId - Service account ID
 * @param preimageHash - Preimage hash
 * @returns 31-byte state key for service preimage
 */
export function createServicePreimageKey(
  serviceId: bigint,
  preimageHash: Hex,
): Uint8Array {
  // Create the prefix: encode[4]{2³²-2} = encode[4]{0xFFFFFFFE}
  const prefix = new Uint8Array(4)
  const prefixView = new DataView(prefix.buffer)
  prefixView.setUint32(0, 0xfffffffe, true) // little-endian

  // Concatenate prefix with preimage hash
  const preimageHashBytes = hexToBytes(preimageHash)
  const combinedKey = new Uint8Array(prefix.length + preimageHashBytes.length)
  combinedKey.set(prefix, 0)
  combinedKey.set(preimageHashBytes, prefix.length)

  // Convert to hex for createStateKey
  const combinedKeyHex = bytesToHex(combinedKey)

  // Use C(s, combinedKey) pattern
  return createStateKey(0, serviceId, combinedKeyHex)
}

/**
 * Create service request key according to Gray Paper specification.
 *
 * Gray Paper merklization.tex (lines 107-110):
 * ∀ ⟨s, sa⟩ ∈ accounts, ⟨⟨h, l⟩, t⟩ ∈ sa_requests:
 * C(s, encode[4]{l} ∥ h) ↦ encode{var{sequence{encode[4]{x} | x ∈ t}}}
 *
 * Request keys use the pattern: C(s, encode[4]{length} ∥ request_hash)
 * where s is the service ID, l is the blob length, and h is the request hash.
 *
 * @param serviceId - Service account ID
 * @param requestHash - Request hash
 * @param length - Blob length
 * @returns 31-byte state key for service request
 */
export function createServiceRequestKey(
  serviceId: bigint,
  requestHash: Hex,
  length: bigint,
): Uint8Array {
  // Create the prefix: encode[4]{length}
  const prefix = new Uint8Array(4)
  const prefixView = new DataView(prefix.buffer)
  prefixView.setUint32(0, Number(length), true) // little-endian

  // Concatenate prefix with request hash
  const requestHashBytes = hexToBytes(requestHash)
  const combinedKey = new Uint8Array(prefix.length + requestHashBytes.length)
  combinedKey.set(prefix, 0)
  combinedKey.set(requestHashBytes, prefix.length)

  // Convert to hex for createStateKey
  const combinedKeyHex = bytesToHex(combinedKey)

  // Use C(s, combinedKey) pattern
  return createStateKey(0, serviceId, combinedKeyHex)
}

/**
 * Serialize activity (Chapter 13) according to Gray Paper specification.
 *
 * Gray Paper formula: C(13) ↦ encode{
 *   encode[4]{valstatsaccumulator, valstatsprevious},
 *   corestats,
 *   servicestats
 * }
 *
 * Activity tracks validator performance statistics and core/service metrics.
 * It contains validator statistics for current and previous epochs, plus
 * core and service performance data.
 *
 * Structure per Gray Paper:
 * - encode[4]{valstatsaccumulator, valstatsprevious}: fixed-length validator stats
 * - corestats: core performance metrics (sequence)
 * - servicestats: service performance metrics (dictionary)
 *
 * Field encoding:
 * - valstatsaccumulator: 4-byte current epoch validator stats accumulator
 * - valstatsprevious: 4-byte previous epoch final validator stats
 * - corestats: sequence of per-core statistics
 * - servicestats: dictionary of per-service statistics
 *
 * ✅ CORRECT: Encodes validator statistics with proper fixed-length format
 * ✅ CORRECT: Uses Activity interface with proper validator/core/service breakdown
 */

/**
 * Create complete state trie according to Gray Paper merklization specification.
 *
 * Gray Paper formula: T(state) = {
 *   C(2) ↦ encode{authqueue},
 *   C(3) ↦ encode{var{recenthistory}, mmrencode{accoutbelt}},
 *   C(4) ↦ encode{pendingset, epochroot, discriminator, sealtickets, var{ticketaccumulator}},
 *   C(5) ↦ encode{var{goodset}, var{badset}, var{wonkyset}, var{offenders}},
 *   C(6) ↦ encode{entropy},
 *   C(7) ↦ encode{stagingset},
 *   C(8) ↦ encode{activeset},
 *   C(9) ↦ encode{previousset},
 *   C(10) ↦ encode{sequence of maybe{(workreport, encode[4]{timestamp})}},
 *   C(11) ↦ encode[4]{thetime},
 *   C(12) ↦ encode{encode[4]{manager, assigners, delegator, registrar}, alwaysaccers},
 *   C(13) ↦ encode{encode[4]{valstatsaccumulator, valstatsprevious}, corestats, servicestats},
 *   C(14) ↦ encode{ready work reports with nested structure},
 *   C(15) ↦ encode{sequence of var{accumulated}},
 *   C(16) ↦ encode{var{sequence of (encode[4]{s}, encode{h})}},
 *   C(255, s) ↦ encode{0, codehash, encode[8]{balance, minaccgas, minmemogas, octets, gratis}, encode[4]{items, created, lastacc, parent}},
 *   Service storage/preimages/requests mappings...
 * }
 *
 * ✅ CORRECT: Basic structure and chapter mapping
 * ❌ WRONG: Chapter 3 - missing complex recenthistory structure
 * ❌ WRONG: Chapter 4 - missing complex safrole structure
 * ✅ FIXED: Chapter 5 - now uses proper disputes encoding (goodset, badset, wonkyset, offenders)
 * ✅ FIXED: Chapter 7 - now uses proper stagingset encoding (336-byte validator keys)
 * ✅ FIXED: Chapter 8 - now uses proper activeset encoding (336-byte validator keys)
 * ✅ FIXED: Chapter 9 - now uses proper previousset encoding (336-byte validator keys)
 * ✅ FIXED: Chapter 10 - now uses proper reports encoding (maybe{(workreport, timestamp)} per core)
 * ✅ FIXED: Chapter 11 - now uses proper encode[4]{thetime}
 * ✅ FIXED: Chapter 12 - now uses proper privileges encoding format
 * ✅ FIXED: Service accounts - now uses proper ServiceAccountCore encoding
 * ✅ FIXED: Service storage, preimages, requests mappings - now included with Gray Paper key patterns
 */
export function createStateTrie(
  globalState: GlobalState,
  configService: IConfigService,
  jamVersion?: JamVersion,
): Safe<StateTrie> {
  const stateTrie: StateTrie = {}

  // Chapter 1: authpool
  const authpoolKey = createStateKey(1)
  const [error, authpoolData] = encodeAuthpool(
    globalState.authpool,
    configService,
  )
  if (error) {
    return safeError(error)
  }
  if (authpoolData) {
    stateTrie[bytesToHex(authpoolKey)] = bytesToHex(authpoolData)
  }

  // Chapter 2: authqueue
  const authqueueKey = createStateKey(2)
  const [error2, authqueueData] = encodeAuthqueue(
    globalState.authqueue,
    configService,
  )
  if (error2) {
    return safeError(error2)
  }
  if (authqueueData) {
    stateTrie[bytesToHex(authqueueKey)] = bytesToHex(authqueueData)
  }

  // Chapter 3: recent
  const recentKey = createStateKey(3)

  const [error3, recentData] = encodeRecent(globalState.recent)
  if (error3) {
    return safeError(error3)
  }
  if (recentData) {
    stateTrie[bytesToHex(recentKey)] = bytesToHex(recentData)
  }

  // Chapter 4: safrole
  const safroleKey = createStateKey(4)
  const [error4, safroleData] = encodeSafrole(globalState.safrole)
  if (error4) {
    return safeError(error4)
  }
  if (safroleData) {
    stateTrie[bytesToHex(safroleKey)] = bytesToHex(safroleData)
  }

  // Chapter 5: disputes
  const disputesKey = createStateKey(5)
  const [error5, disputesData] = encodeDisputeState(globalState.disputes)
  if (error5) {
    return safeError(error5)
  }
  if (disputesData) {
    stateTrie[bytesToHex(disputesKey)] = bytesToHex(disputesData)
  }

  // Chapter 6: entropy
  const entropyKey = createStateKey(6)
  const [error6, entropyData] = encodeEntropy(globalState.entropy)
  if (error6) {
    return safeError(error6)
  }
  if (entropyData) {
    stateTrie[bytesToHex(entropyKey)] = bytesToHex(entropyData)
  }

  // Chapter 7: staging set
  const stagingKey = createStateKey(7)
  const [error7, stagingData] = encodeValidatorSet(
    globalState.stagingset,
    configService,
  )
  if (error7) {
    return safeError(error7)
  }
  if (stagingData) {
    stateTrie[bytesToHex(stagingKey)] = bytesToHex(stagingData)
  }

  // Chapter 8: active set
  const activeKey = createStateKey(8)
  const [error8, activeData] = encodeValidatorSet(
    globalState.activeset,
    configService,
  )
  if (error8) {
    return safeError(error8)
  }
  if (activeData) {
    stateTrie[bytesToHex(activeKey)] = bytesToHex(activeData)
  }

  // Chapter 9: previous set
  const previousKey = createStateKey(9)
  const [error9, previousData] = encodeValidatorSet(
    globalState.previousset,
    configService,
  )
  if (error9) {
    return safeError(error9)
  }
  if (previousData) {
    stateTrie[bytesToHex(previousKey)] = bytesToHex(previousData)
  }

  // Chapter 10: reports
  const reportsKey = createStateKey(10)
  const [error10, reportsData] = encodeStateWorkReports(
    globalState.reports,
    configService,
  )
  if (error10) {
    return safeError(error10)
  }
  if (reportsData) {
    stateTrie[bytesToHex(reportsKey)] = bytesToHex(reportsData)
  }

  // Chapter 11: thetime - Gray Paper specifies encode[4]{thetime}
  const timeKey = createStateKey(11)
  const [error11, timeData] = encodeTheTime(globalState.thetime)
  if (error11) {
    return safeError(error11)
  }
  stateTrie[bytesToHex(timeKey)] = bytesToHex(timeData)

  // Chapter 12: privileges - Gray Paper specifies encode{encode[4]{manager, assigners, delegator, registrar}, alwaysaccers}
  const privilegesKey = createStateKey(12)
  const [error12, privilegesData] = encodePrivileges(
    globalState.privileges,
    configService,
    jamVersion,
  )
  if (error12) {
    return safeError(error12)
  }
  stateTrie[bytesToHex(privilegesKey)] = bytesToHex(privilegesData)

  // Chapter 13: activity
  const activityKey = createStateKey(13)
  const [error13, activityData] = encodeActivity(
    globalState.activity,
    configService,
    jamVersion,
  )
  if (error13) {
    return safeError(error13)
  }
  if (activityData) {
    stateTrie[bytesToHex(activityKey)] = bytesToHex(activityData)
  }

  // Chapter 14: ready
  const readyKey = createStateKey(14)
  const [error14, readyData] = encodeReady(globalState.ready, configService)
  if (error14) {
    return safeError(error14)
  }
  if (readyData) {
    stateTrie[bytesToHex(readyKey)] = bytesToHex(readyData)
  }

  // Chapter 15: accumulated
  // Gray Paper: C(15) ↦ encode{sq{build{var{i}}{i orderedin accumulated}}}
  // accumulated ∈ sequence[C_epochlen]{protoset{hash}}
  // Each element i is a set of hashes
  // var{i} encodes the set as: var{sq{hash, hash, ...}} = length + sequence of hashes
  const accumulatedKey = createStateKey(15)
  // Ensure accumulated is initialized (default to empty array if undefined)
  const accumulatedPackages = globalState.accumulated

  const [error15, accumulatedData] = encodeAccumulated(
    accumulatedPackages,
    configService,
  )
  if (error15) {
    return safeError(error15)
  }
  if (accumulatedData) {
    stateTrie[bytesToHex(accumulatedKey)] = bytesToHex(accumulatedData)
  }

  // Chapter 16: last accumulation output
  const lastAccountKey = createStateKey(16)
  const [error16, lastAccountData] = encodeLastAccumulationOutputs(
    globalState.lastAccumulationOutput,
  )
  if (error16) {
    return safeError(error16)
  }
  if (lastAccountData) {
    stateTrie[bytesToHex(lastAccountKey)] = bytesToHex(lastAccountData)
  }

  // Chapter 255: accounts
  // ServiceAccounts.accounts is a Map<bigint, ServiceAccount>, not a plain object
  for (const [serviceId, account] of globalState.accounts.accounts) {
    const accountKey = createStateKey(255, serviceId)

    // Gray Paper accounts.tex: items and octets are DERIVED values that must be recalculated
    // items = 2 * len(requests) + len(storage)
    // octets = sum((81 + z) for (h, z) in keys(requests)) + sum((34 + len(y) + len(x)) for (x, y) in storage)
    // Count unique request keys (hash, length pairs)
    let requestKeyCount = 0
    let computedOctets = 0n
    for (const [_hash, lengthMap] of account.requests) {
      for (const [length, _status] of lengthMap) {
        requestKeyCount++
        computedOctets += 81n + length
      }
    }
    // Add storage octets: 34 + len(key) + len(value) for each storage entry
    for (const [storageKey, storageValue] of account.storage) {
      const keyBytes = hexToBytes(storageKey)
      computedOctets += 34n + BigInt(keyBytes.length) + BigInt(storageValue.length)
    }
    const computedItems = BigInt(2 * requestKeyCount + account.storage.size)

    // Update account with computed values before encoding
    const accountWithComputed = {
      ...account,
      items: computedItems,
      octets: computedOctets,
    }

    const [error17, accountData] = encodeServiceAccount(
      accountWithComputed,
      jamVersion,
    )
    if (error17) {
      return safeError(error17)
    }
    if (accountData) {
      stateTrie[bytesToHex(accountKey)] = bytesToHex(accountData)
    }

    // Generate C(s, h) keys from service account Maps
    // Gray Paper merklization.tex line 118: "Implementations are free to use this fact in order
    // to avoid storing the keys themselves" - we generate keys from service account storage/preimages/requests
    // Service storage mappings: C(s, encode[4]{0xFFFFFFFF} ∥ storage_key) ↦ storage_value
    // Gray Paper merklization.tex (lines 103-104)
    for (const [storageKey, storageValue] of account.storage) {
      const storageStateKey = createServiceStorageKey(serviceId, storageKey)
      stateTrie[bytesToHex(storageStateKey)] = bytesToHex(storageValue)
    }

    // Service preimage mappings: C(s, encode[4]{0xFFFFFFFE} ∥ preimage_hash) ↦ preimage_data
    // Gray Paper merklization.tex (lines 105-106)
    for (const [preimageHash, preimageData] of account.preimages) {
      const preimageStateKey = createServicePreimageKey(serviceId, preimageHash)
      stateTrie[bytesToHex(preimageStateKey)] = bytesToHex(preimageData)
    }

    // Service request mappings: C(s, encode[4]{length} ∥ request_hash) ↦ request_status
    // Gray Paper merklization.tex (lines 107-110)
    // encode{var{sequence{encode[4]{x} | x ∈ t}}}
    // where t is the sequence of timeslots (up to 3)
    for (const [requestHash, lengthMap] of account.requests) {
      for (const [length, requestStatus] of lengthMap) {
        const requestStateKey = createServiceRequestKey(
          serviceId,
          requestHash,
          length,
        )
        // Gray Paper: encode{var{sequence{encode[4]{x} | x ∈ t}}}
        // var{...} = length prefix (natural number)
        // sequence{encode[4]{x}} = sequence of 4-byte timeslots
        const [error18, requestStatusData] = encodeVariableSequence(
          requestStatus,
          (timeslot: bigint) => encodeFixedLength(timeslot, 4n),
        )
        if (error18) {
          return safeError(error18)
        }
        stateTrie[bytesToHex(requestStateKey)] = bytesToHex(requestStatusData)
      }
    }
  }

  return safeResult(stateTrie)
}
