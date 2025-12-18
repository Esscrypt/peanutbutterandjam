/**
 * PartialState Serialization
 *
 * *** DO NOT REMOVE - GRAY PAPER FORMULA ***
 * Gray Paper Section: pvm_invocations.tex, accumulation.tex
 * Formula:
 *
 * partialstate ≡ tuple{
 *   ps_accounts: dictionary<serviceid, serviceaccount>,
 *   ps_stagingset: sequence[Cvalcount]{valkey},
 *   ps_authqueue: sequence[Ccorecount]{sequence[C_authqueuesize]{hash}},
 *   ps_manager: serviceid,
 *   ps_assigners: sequence[Ccorecount]{serviceid},
 *   ps_delegator: serviceid,
 *   ps_registrar: serviceid,
 *   ps_alwaysaccers: dictionary<serviceid, gas>
 * }
 *
 * According to Gray Paper serialization rules (serialization.tex):
 * - Tuples are encoded as concatenation: encode{tuple{a, b}} = encode{a} || encode{b}
 * - Dictionaries are encoded as sorted sequences: encode{dict} = var{sequence{sorted(key, value)}}
 * - Sequences use var{} discriminator: var{x} = ⟨len(x), x⟩
 * - Fixed-length sequences don't use var{} discriminator
 *
 * *** IMPLEMENTER EXPLANATION ***
 * PartialState represents a subset of the global blockchain state that can be
 * modified during PVM accumulation invocations. It includes service accounts,
 * validator sets, authorization queues, and privilege settings.
 *
 * Field encoding order per Gray Paper:
 * 1. ps_accounts: encode{var{sequence{sorted(serviceid, serviceaccount)}}}
 * 2. ps_stagingset: encode{sequence[Cvalcount]{valkey}} (fixed-length, no var{})
 * 3. ps_authqueue: encode{sequence[Ccorecount]{sequence[C_authqueuesize]{hash}}} (fixed-length)
 * 4. ps_manager: encode[4]{serviceid} (4-byte fixed-length)
 * 5. ps_assigners: encode{sequence[Ccorecount]{encode[4]{serviceid}}} (fixed-length)
 * 6. ps_delegator: encode[4]{serviceid} (4-byte fixed-length)
 * 7. ps_registrar: encode[4]{serviceid} (4-byte fixed-length)
 * 8. ps_alwaysaccers: encode{var{sequence{sorted(serviceid, gas)}}}
 */

import { bytesToHex, concatBytes, type Hex, hexToBytes } from '@pbnjam/core'
import type {
  AuthQueue,
  DecodingResult,
  IConfigService,
  PartialState,
  PreimageRequestStatus,
  Safe,
  ServiceAccount,
  ValidatorPublicKeys,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { decodeVariableLength } from '../core/discriminator'
import { decodeFixedLength, encodeFixedLength } from '../core/fixed-length'
import { decodeNatural, encodeNatural } from '../core/natural-number'
import {
  decodeVariableSequence,
  encodeSequenceGeneric,
  encodeVariableSequence,
} from '../core/sequence'
import { decodeAuthqueue, encodeAuthqueue } from '../state/authqueue'
import { decodeValidatorSet, encodeValidatorSet } from '../state/validator-set'

/**
 * Convert Uint8Array[] to ValidatorPublicKeys[]
 * Each Uint8Array should be 336 bytes representing a validator key
 */
function convertValidatorKeys(
  validatorBytes: Uint8Array[],
): Safe<ValidatorPublicKeys[]> {
  const validators: ValidatorPublicKeys[] = []
  const VALIDATOR_KEY_SIZE = 336

  for (const bytes of validatorBytes) {
    if (bytes.length !== VALIDATOR_KEY_SIZE) {
      return safeError(
        new Error(
          `Validator key must be ${VALIDATOR_KEY_SIZE} bytes, got ${bytes.length}`,
        ),
      )
    }

    // Extract fields from 336-byte blob
    // Gray Paper: vk[0:32] = Bandersnatch, vk[32:32] = Ed25519, vk[64:144] = BLS, vk[208:128] = Metadata
    const bandersnatch = bytesToHex(bytes.slice(0, 32))
    const ed25519 = bytesToHex(bytes.slice(32, 64))
    const bls = bytesToHex(bytes.slice(64, 208))
    const metadata = bytesToHex(bytes.slice(208, 336))

    validators.push({
      bandersnatch,
      ed25519,
      bls,
      metadata,
    })
  }

  return safeResult(validators)
}

/**
 * Convert ValidatorPublicKeys[] to Uint8Array[]
 */
function convertValidatorKeysToBytes(
  validators: ValidatorPublicKeys[],
): Safe<Uint8Array[]> {
  const validatorBytes: Uint8Array[] = []

  for (const validator of validators) {
    const bytes = new Uint8Array(336)
    let offset = 0

    // Bandersnatch key (32 bytes)
    const bsBytes = hexToBytes(validator.bandersnatch)
    if (bsBytes.length !== 32) {
      return safeError(
        new Error(`Bandersnatch key must be 32 bytes, got ${bsBytes.length}`),
      )
    }
    bytes.set(bsBytes, offset)
    offset += 32

    // Ed25519 key (32 bytes)
    const edBytes = hexToBytes(validator.ed25519)
    if (edBytes.length !== 32) {
      return safeError(
        new Error(`Ed25519 key must be 32 bytes, got ${edBytes.length}`),
      )
    }
    bytes.set(edBytes, offset)
    offset += 32

    // BLS key (144 bytes)
    const blsBytes = hexToBytes(validator.bls)
    if (blsBytes.length !== 144) {
      return safeError(
        new Error(`BLS key must be 144 bytes, got ${blsBytes.length}`),
      )
    }
    bytes.set(blsBytes, offset)
    offset += 144

    // Metadata (128 bytes)
    const metadataBytes = hexToBytes(validator.metadata)
    if (metadataBytes.length !== 128) {
      return safeError(
        new Error(`Metadata must be 128 bytes, got ${metadataBytes.length}`),
      )
    }
    bytes.set(metadataBytes, offset)

    validatorBytes.push(bytes)
  }

  return safeResult(validatorBytes)
}

/**
 * Convert Uint8Array[][] to AuthQueue (Hex[][])
 */
function convertAuthQueue(authqueue: Uint8Array[][]): AuthQueue {
  return authqueue.map((coreQueue) => coreQueue.map((hash) => bytesToHex(hash)))
}

/**
 * Convert AuthQueue (Hex[][]) to Uint8Array[][]
 */
function convertAuthQueueToBytes(authqueue: AuthQueue): Uint8Array[][] {
  return authqueue.map((coreQueue) => coreQueue.map((hash) => hexToBytes(hash)))
}

/**
 * Encode complete ServiceAccount according to Gray Paper accounts.tex equation 12-27.
 *
 * Gray Paper: serviceaccount ≡ tuple{
 *   sa_storage ∈ dictionary{blob}{blob},
 *   sa_preimages ∈ dictionary{hash}{blob},
 *   sa_requests ∈ dictionary{tuple{hash, bloblength}}{sequence[:3]{timeslot}},
 *   sa_gratis ∈ balance,
 *   sa_codehash ∈ hash,
 *   sa_balance ∈ balance,
 *   sa_minaccgas ∈ gas,
 *   sa_minmemogas ∈ gas,
 *   sa_created ∈ timeslot,
 *   sa_lastacc ∈ timeslot,
 *   sa_parent ∈ serviceid
 * }
 *
 * @param account - Complete ServiceAccount to encode
 * @returns Encoded octet sequence
 */
export function encodeCompleteServiceAccount(
  account: ServiceAccount,
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // sa_storage: encode{dictionary{blob}{blob}}
  // Sort storage entries by key for deterministic encoding
  const sortedStorage = Array.from(account.storage.entries())
  sortedStorage.sort((a, b) => {
    const aBytes = hexToBytes(a[0])
    const bBytes = hexToBytes(b[0])
    const minLen = aBytes.length < bBytes.length ? aBytes.length : bBytes.length
    for (let i = 0; i < minLen; i++) {
      if (aBytes[i] < bBytes[i]) return -1
      if (aBytes[i] > bBytes[i]) return 1
    }
    if (aBytes.length < bBytes.length) return -1
    if (aBytes.length > bBytes.length) return 1
    return 0
  })

  // Manually encode dictionary: var{sequence{sorted(key, value)}}
  const storagePairs: Uint8Array[] = []
  for (const [key, value] of sortedStorage) {
    const keyBytes = hexToBytes(key)
    const [keyLenError, encodedKeyLen] = encodeNatural(BigInt(keyBytes.length))
    if (keyLenError) {
      return safeError(keyLenError)
    }
    const [valueLenError, encodedValueLen] = encodeNatural(BigInt(value.length))
    if (valueLenError) {
      return safeError(valueLenError)
    }
    // Key: encode{var{blob}} = encode{len(key)} || key
    const encodedKey = concatBytes([encodedKeyLen, keyBytes])
    // Value: encode{var{blob}} = encode{len(value)} || value
    const encodedValue = concatBytes([encodedValueLen, value])
    storagePairs.push(concatBytes([encodedKey, encodedValue]))
  }
  const concatenatedStoragePairs = concatBytes(storagePairs)
  // Wrap with var{} discriminator
  const [storageLengthError, encodedStorageLength] = encodeNatural(
    BigInt(concatenatedStoragePairs.length),
  )
  if (storageLengthError) {
    return safeError(storageLengthError)
  }
  parts.push(concatBytes([encodedStorageLength, concatenatedStoragePairs]))

  // sa_preimages: encode{dictionary{hash}{blob}}
  // Sort preimage entries by hash for deterministic encoding
  const sortedPreimages = Array.from(account.preimages.entries())
  sortedPreimages.sort((a, b) => {
    const aBytes = hexToBytes(a[0])
    const bBytes = hexToBytes(b[0])
    const minLen = aBytes.length < bBytes.length ? aBytes.length : bBytes.length
    for (let i = 0; i < minLen; i++) {
      if (aBytes[i] < bBytes[i]) return -1
      if (aBytes[i] > bBytes[i]) return 1
    }
    if (aBytes.length < bBytes.length) return -1
    if (aBytes.length > bBytes.length) return 1
    return 0
  })

  // Manually encode dictionary: var{sequence{sorted(key, value)}}
  const preimagePairs: Uint8Array[] = []
  for (const [hash, blob] of sortedPreimages) {
    const hashBytes = hexToBytes(hash)
    if (hashBytes.length !== 32) {
      return safeError(
        new Error(`Preimage hash must be 32 bytes, got ${hashBytes.length}`),
      )
    }
    const [blobLenError, encodedBlobLen] = encodeNatural(BigInt(blob.length))
    if (blobLenError) {
      return safeError(blobLenError)
    }
    // Key: hash (32-byte fixed-length)
    const key = hashBytes
    // Value: encode{var{blob}} = encode{len(blob)} || blob
    const value = concatBytes([encodedBlobLen, blob])
    preimagePairs.push(concatBytes([key, value]))
  }
  const concatenatedPreimagePairs = concatBytes(preimagePairs)
  // Wrap with var{} discriminator
  const [preimagesLengthError, encodedPreimagesLength] = encodeNatural(
    BigInt(concatenatedPreimagePairs.length),
  )
  if (preimagesLengthError) {
    return safeError(preimagesLengthError)
  }
  parts.push(concatBytes([encodedPreimagesLength, concatenatedPreimagePairs]))

  // sa_requests: encode{dictionary{tuple{hash, bloblength}}{sequence[:3]{timeslot}}}
  // Collect all request entries and sort by (hash, length) for deterministic encoding
  const requestEntries: Array<{ key: Uint8Array; value: Uint8Array }> = []
  for (const [hash, lengthMap] of account.requests.entries()) {
    const hashBytes = hexToBytes(hash)
    if (hashBytes.length !== 32) {
      return safeError(
        new Error(`Request hash must be 32 bytes, got ${hashBytes.length}`),
      )
    }
    for (const [length, status] of lengthMap.entries()) {
      // Key: tuple{hash, bloblength} = hash || encode[4]{length}
      const [lengthError, encodedLength] = encodeFixedLength(length, 4n)
      if (lengthError) {
        return safeError(lengthError)
      }
      const requestKey = concatBytes([hashBytes, encodedLength])

      // Value: sequence[:3]{timeslot} = var{sequence{encode[4]{timeslot}}}
      const [statusError, encodedStatus] = encodeVariableSequence(
        status,
        (timeslot: bigint) => encodeFixedLength(timeslot, 4n),
      )
      if (statusError) {
        return safeError(statusError)
      }
      requestEntries.push({
        key: requestKey,
        value: encodedStatus,
      })
    }
  }
  // Sort by key (hash + length) for deterministic encoding
  requestEntries.sort((a, b) => {
    const minLen = a.key.length < b.key.length ? a.key.length : b.key.length
    for (let i = 0; i < minLen; i++) {
      if (a.key[i] < b.key[i]) return -1
      if (a.key[i] > b.key[i]) return 1
    }
    if (a.key.length < b.key.length) return -1
    if (a.key.length > b.key.length) return 1
    return 0
  })

  // Manually encode dictionary: var{sequence{sorted(key, value)}}
  const requestPairs: Uint8Array[] = []
  for (const entry of requestEntries) {
    requestPairs.push(concatBytes([entry.key, entry.value]))
  }
  const concatenatedRequestPairs = concatBytes(requestPairs)
  // Wrap with var{} discriminator
  const [requestsLengthError, encodedRequestsLength] = encodeNatural(
    BigInt(concatenatedRequestPairs.length),
  )
  if (requestsLengthError) {
    return safeError(requestsLengthError)
  }
  parts.push(concatBytes([encodedRequestsLength, concatenatedRequestPairs]))

  // sa_gratis: encode[8]{balance} (8-byte fixed-length)
  const [gratisError, encodedGratis] = encodeFixedLength(account.gratis, 8n)
  if (gratisError) {
    return safeError(gratisError)
  }
  parts.push(encodedGratis)

  // sa_codehash: hash (32-byte blob, identity encoding)
  parts.push(hexToBytes(account.codehash))

  // sa_balance: encode[8]{balance} (8-byte fixed-length)
  const [balanceError, encodedBalance] = encodeFixedLength(account.balance, 8n)
  if (balanceError) {
    return safeError(balanceError)
  }
  parts.push(encodedBalance)

  // sa_minaccgas: encode[8]{gas} (8-byte fixed-length)
  const [minAccGasError, encodedMinAccGas] = encodeFixedLength(
    account.minaccgas,
    8n,
  )
  if (minAccGasError) {
    return safeError(minAccGasError)
  }
  parts.push(encodedMinAccGas)

  // sa_minmemogas: encode[8]{gas} (8-byte fixed-length)
  const [minMemoGasError, encodedMinMemoGas] = encodeFixedLength(
    account.minmemogas,
    8n,
  )
  if (minMemoGasError) {
    return safeError(minMemoGasError)
  }
  parts.push(encodedMinMemoGas)

  // sa_created: encode[4]{timeslot} (4-byte fixed-length)
  const [createdError, encodedCreated] = encodeFixedLength(account.created, 4n)
  if (createdError) {
    return safeError(createdError)
  }
  parts.push(encodedCreated)

  // sa_lastacc: encode[4]{timeslot} (4-byte fixed-length)
  const [lastAccError, encodedLastAcc] = encodeFixedLength(account.lastacc, 4n)
  if (lastAccError) {
    return safeError(lastAccError)
  }
  parts.push(encodedLastAcc)

  // sa_parent: encode[4]{serviceid} (4-byte fixed-length)
  const [parentError, encodedParent] = encodeFixedLength(account.parent, 4n)
  if (parentError) {
    return safeError(parentError)
  }
  parts.push(encodedParent)

  const result = concatBytes(parts)
  return safeResult(result)
}

/**
 * Encode PartialState according to Gray Paper specification.
 *
 * @param partialState - PartialState to encode
 * @param configService - Configuration service for core/validator counts
 * @returns Encoded octet sequence
 */
export function encodePartialState(
  partialState: PartialState,
  configService: IConfigService,
): Safe<Uint8Array> {
  const parts: Uint8Array[] = []

  // ps_accounts: encode{var{sequence{sorted(serviceid, serviceaccount)}}}
  // Sort accounts by serviceId for deterministic encoding
  const sortedAccounts = Array.from(partialState.accounts.entries())
  sortedAccounts.sort((a, b) => {
    if (a[0] < b[0]) return -1
    if (a[0] > b[0]) return 1
    return 0
  })

  // Manually encode dictionary: var{sequence{sorted(key, value)}}
  const accountPairs: Uint8Array[] = []
  for (const [serviceId, account] of sortedAccounts) {
    const [keyError, encodedKey] = encodeFixedLength(serviceId, 4n)
    if (keyError) {
      return safeError(keyError)
    }
    const [valueError, encodedValue] = encodeCompleteServiceAccount(account)
    if (valueError) {
      return safeError(valueError)
    }
    accountPairs.push(concatBytes([encodedKey, encodedValue]))
  }
  const concatenatedAccountPairs = concatBytes(accountPairs)
  // Wrap with var{} discriminator
  const [accountsLengthError, encodedAccountsLength] = encodeNatural(
    BigInt(concatenatedAccountPairs.length),
  )
  if (accountsLengthError) {
    return safeError(accountsLengthError)
  }
  parts.push(concatBytes([encodedAccountsLength, concatenatedAccountPairs]))

  // ps_stagingset: encode{sequence[Cvalcount]{valkey}} (fixed-length, no var{})
  // Convert Uint8Array[] to ValidatorPublicKeys[]
  const [validatorsError, validators] = convertValidatorKeys(
    partialState.stagingset,
  )
  if (validatorsError) {
    return safeError(validatorsError)
  }

  const [stagingsetError, encodedStagingset] = encodeValidatorSet(
    validators,
    configService,
  )
  if (stagingsetError) {
    return safeError(stagingsetError)
  }
  parts.push(encodedStagingset)

  // ps_authqueue: encode{sequence[Ccorecount]{sequence[C_authqueuesize]{hash}}} (fixed-length)
  const authqueue = convertAuthQueue(partialState.authqueue)
  const [authqueueError, encodedAuthqueue] = encodeAuthqueue(
    authqueue,
    configService,
  )
  if (authqueueError) {
    return safeError(authqueueError)
  }
  parts.push(encodedAuthqueue)

  // ps_manager: encode[4]{serviceid} (4-byte fixed-length)
  const [managerError, encodedManager] = encodeFixedLength(
    partialState.manager,
    4n,
  )
  if (managerError) {
    return safeError(managerError)
  }
  parts.push(encodedManager)

  // ps_assigners: encode{sequence[Ccorecount]{encode[4]{serviceid}}} (fixed-length)
  const coreCount = configService.numCores
  const paddedAssigners = [...partialState.assigners]
  while (paddedAssigners.length < coreCount) {
    paddedAssigners.push(0n)
  }
  const assignersToEncode = paddedAssigners.slice(0, coreCount)
  const [assignersError, encodedAssigners] = encodeSequenceGeneric(
    assignersToEncode,
    (serviceId) => encodeFixedLength(serviceId, 4n),
  )
  if (assignersError) {
    return safeError(assignersError)
  }
  parts.push(encodedAssigners)

  // ps_delegator: encode[4]{serviceid} (4-byte fixed-length)
  const [delegatorError, encodedDelegator] = encodeFixedLength(
    partialState.delegator,
    4n,
  )
  if (delegatorError) {
    return safeError(delegatorError)
  }
  parts.push(encodedDelegator)

  // ps_registrar: encode[4]{serviceid} (4-byte fixed-length)
  const [registrarError, encodedRegistrar] = encodeFixedLength(
    partialState.registrar,
    4n,
  )
  if (registrarError) {
    return safeError(registrarError)
  }
  parts.push(encodedRegistrar)

  // ps_alwaysaccers: encode{var{sequence{sorted(serviceid, gas)}}}
  // Sort alwaysaccers by serviceId for deterministic encoding
  const sortedAlwaysAccers = Array.from(partialState.alwaysaccers.entries())
  sortedAlwaysAccers.sort((a, b) => {
    if (a[0] < b[0]) return -1
    if (a[0] > b[0]) return 1
    return 0
  })

  // Manually encode dictionary: var{sequence{sorted(key, value)}}
  const alwaysAccerPairs: Uint8Array[] = []
  for (const [serviceId, gas] of sortedAlwaysAccers) {
    const [keyError, encodedKey] = encodeFixedLength(serviceId, 4n)
    if (keyError) {
      return safeError(keyError)
    }
    const [valueError, encodedValue] = encodeFixedLength(gas, 4n)
    if (valueError) {
      return safeError(valueError)
    }
    alwaysAccerPairs.push(concatBytes([encodedKey, encodedValue]))
  }
  const concatenatedAlwaysAccerPairs = concatBytes(alwaysAccerPairs)
  // Wrap with var{} discriminator
  const [alwaysAccersLengthError, encodedAlwaysAccersLength] = encodeNatural(
    BigInt(concatenatedAlwaysAccerPairs.length),
  )
  if (alwaysAccersLengthError) {
    return safeError(alwaysAccersLengthError)
  }
  parts.push(
    concatBytes([encodedAlwaysAccersLength, concatenatedAlwaysAccerPairs]),
  )

  return safeResult(concatBytes(parts))
}

/**
 * Decode complete ServiceAccount according to Gray Paper accounts.tex equation 12-27.
 *
 * Gray Paper: serviceaccount ≡ tuple{
 *   sa_storage ∈ dictionary{blob}{blob},
 *   sa_preimages ∈ dictionary{hash}{blob},
 *   sa_requests ∈ dictionary{tuple{hash, bloblength}}{sequence[:3]{timeslot}},
 *   sa_gratis ∈ balance,
 *   sa_codehash ∈ hash,
 *   sa_balance ∈ balance,
 *   sa_minaccgas ∈ gas,
 *   sa_minmemogas ∈ gas,
 *   sa_created ∈ timeslot,
 *   sa_lastacc ∈ timeslot,
 *   sa_parent ∈ serviceid
 * }
 *
 * @param data - Octet sequence to decode
 * @returns Decoded ServiceAccount and remaining data
 */
export function decodeCompleteServiceAccount(
  data: Uint8Array,
): Safe<DecodingResult<ServiceAccount>> {
  let currentData = data

  // sa_storage: decode{dictionary{blob}{blob}}
  // Manually decode dictionary with variable-length keys and values
  const [storageVarError, storageVarResult] = decodeVariableLength(currentData)
  if (storageVarError) {
    return safeError(storageVarError)
  }
  const storagePairs = storageVarResult.value
  currentData = storageVarResult.remaining

  const storage = new Map<Hex, Uint8Array>()
  let storageData = storagePairs

  // Decode pairs until we've processed all bytes
  while (storageData.length > 0) {
    // Decode key: var{blob} = length prefix + blob
    const [keyVarError, keyVarResult] = decodeVariableLength(storageData)
    if (keyVarError) {
      break
    }
    const keyData = keyVarResult.value
    storageData = storageData.slice(
      storageData.length - keyVarResult.remaining.length,
    )

    // Decode key blob (keyData already has length prefix removed by decodeVariableLength)
    // keyData is already the blob data (blob has identity encoding)
    const keyBytes = keyData
    const storageKey = bytesToHex(keyBytes)

    // Decode value: var{blob} = length prefix + blob
    // decodeVariableLength returns the blob data directly (blob has identity encoding)
    const [valueVarError, valueVarResult] = decodeVariableLength(storageData)
    if (valueVarError) {
      break
    }
    const storageValue = valueVarResult.value // Already the blob data
    storageData = storageData.slice(
      storageData.length - valueVarResult.remaining.length,
    )

    storage.set(storageKey, storageValue)
  }

  // sa_preimages: decode{dictionary{hash}{blob}}
  // Manually decode dictionary with variable-length values
  const [preimagesVarError, preimagesVarResult] =
    decodeVariableLength(currentData)
  if (preimagesVarError) {
    return safeError(preimagesVarError)
  }
  const preimagesPairs = preimagesVarResult.value
  currentData = preimagesVarResult.remaining

  const preimages = new Map<Hex, Uint8Array>()
  let preimagesData = preimagesPairs

  // Decode pairs until we've processed all bytes
  while (preimagesData.length > 0) {
    // Decode key: hash (32 bytes fixed)
    if (preimagesData.length < 32) {
      break
    }
    const preimageHash = bytesToHex(preimagesData.slice(0, 32))
    preimagesData = preimagesData.slice(32)

    // Decode value: var{blob} = length prefix + blob
    const [blobVarError, blobVarResult] = decodeVariableLength(preimagesData)
    if (blobVarError) {
      break
    }
    const blobData = blobVarResult.value
    preimagesData = preimagesData.slice(
      preimagesData.length - blobVarResult.remaining.length,
    )

    // Decode blob (blobData already has length prefix removed by decodeVariableLength)
    // blobData is already the blob data (blob has identity encoding)
    const preimageBlob = blobData

    preimages.set(preimageHash, preimageBlob)
  }

  // sa_requests: decode{dictionary{tuple{hash, bloblength}}{sequence[:3]{timeslot}}}
  // Manually decode dictionary with variable-length values
  // Gray Paper: var{sequence{sorted(key, value)}}
  const [dictVarError, dictVarResult] = decodeVariableLength(currentData)
  if (dictVarError) {
    return safeError(dictVarError)
  }
  const concatenatedPairs = dictVarResult.value
  currentData = dictVarResult.remaining

  const requests = new Map<Hex, Map<bigint, PreimageRequestStatus>>()
  let pairsData = concatenatedPairs

  // Decode pairs until we've processed all bytes
  while (pairsData.length > 0) {
    // Decode key: tuple{hash, bloblength} = hash (32 bytes) || encode[4]{length} (4 bytes)
    if (pairsData.length < 36) {
      break
    }
    const hashBytes = pairsData.slice(0, 32)
    const preimageHash = bytesToHex(hashBytes)

    const [lengthError, lengthResult] = decodeFixedLength(
      pairsData.slice(32),
      4n,
    )
    if (lengthError) {
      return safeError(lengthError)
    }
    const blobLength = lengthResult.value
    pairsData = pairsData.slice(36) // Consume key

    // Decode value: sequence[:3]{timeslot} = var{sequence{encode[4]{timeslot}}}
    // First decode the var{} prefix to get the length prefix bytes and element count
    const [lengthPrefixError, lengthPrefixResult] = decodeNatural(pairsData)
    if (lengthPrefixError) {
      return safeError(lengthPrefixError)
    }
    const elementCount = Number(lengthPrefixResult.value)
    // Each timeslot is 4 bytes (encode[4]{timeslot})
    const elementSize = 4
    const totalValueLength =
      lengthPrefixResult.consumed + elementCount * elementSize
    if (pairsData.length < totalValueLength) {
      return safeError(
        new Error(
          `Insufficient data for request value: need ${totalValueLength} bytes, got ${pairsData.length}`,
        ),
      )
    }
    const valueData = pairsData.slice(0, totalValueLength) // Includes length prefix
    pairsData = pairsData.slice(totalValueLength) // Consume value

    // Now decode the sequence from valueData (which includes the length prefix)
    const [statusError, statusResult] = decodeVariableSequence(
      valueData,
      (data: Uint8Array) => {
        const [error, result] = decodeFixedLength(data, 4n)
        if (error) {
          return safeError(error)
        }
        return safeResult({
          value: result.value,
          remaining: result.remaining,
          consumed: 4,
        })
      },
    )
    if (statusError) {
      return safeError(statusError)
    }
    const status = statusResult.value as PreimageRequestStatus

    // Group by hash
    if (!requests.has(preimageHash)) {
      requests.set(preimageHash, new Map())
    }
    requests.get(preimageHash)!.set(blobLength, status)
  }

  // sa_gratis: decode[8]{balance} (8-byte fixed-length)
  const [gratisError, gratisResult] = decodeFixedLength(currentData, 8n)
  if (gratisError) {
    return safeError(gratisError)
  }
  const gratis = gratisResult.value
  currentData = gratisResult.remaining

  // sa_codehash: hash (32-byte blob, identity encoding)
  if (currentData.length < 32) {
    return safeError(new Error('Insufficient data for codehash'))
  }
  const codehash = bytesToHex(currentData.slice(0, 32))
  currentData = currentData.slice(32)

  // sa_balance: decode[8]{balance} (8-byte fixed-length)
  const [balanceError, balanceResult] = decodeFixedLength(currentData, 8n)
  if (balanceError) {
    return safeError(balanceError)
  }
  const balance = balanceResult.value
  currentData = balanceResult.remaining

  // sa_minaccgas: decode[8]{gas} (8-byte fixed-length)
  const [minAccGasError, minAccGasResult] = decodeFixedLength(currentData, 8n)
  if (minAccGasError) {
    return safeError(minAccGasError)
  }
  const minaccgas = minAccGasResult.value
  currentData = minAccGasResult.remaining

  // sa_minmemogas: decode[8]{gas} (8-byte fixed-length)
  const [minMemoGasError, minMemoGasResult] = decodeFixedLength(currentData, 8n)
  if (minMemoGasError) {
    return safeError(minMemoGasError)
  }
  const minmemogas = minMemoGasResult.value
  currentData = minMemoGasResult.remaining

  // sa_created: decode[4]{timeslot} (4-byte fixed-length)
  const [createdError, createdResult] = decodeFixedLength(currentData, 4n)
  if (createdError) {
    return safeError(createdError)
  }
  const created = createdResult.value
  currentData = createdResult.remaining

  // sa_lastacc: decode[4]{timeslot} (4-byte fixed-length)
  const [lastAccError, lastAccResult] = decodeFixedLength(currentData, 4n)
  if (lastAccError) {
    return safeError(lastAccError)
  }
  const lastacc = lastAccResult.value
  currentData = lastAccResult.remaining

  // sa_parent: decode[4]{serviceid} (4-byte fixed-length)
  const [parentError, parentResult] = decodeFixedLength(currentData, 4n)
  if (parentError) {
    return safeError(parentError)
  }
  const parent = parentResult.value
  currentData = parentResult.remaining

  // Compute octets and items from storage
  let totalOctets = 0n
  for (const value of storage.values()) {
    totalOctets += BigInt(value.length)
  }
  const octets = totalOctets
  const items = BigInt(storage.size)

  const account: ServiceAccount = {
    codehash,
    balance,
    minaccgas,
    minmemogas,
    octets,
    gratis,
    items,
    created,
    lastacc,
    parent,
    storage,
    preimages,
    requests,
  }

  const consumed = data.length - currentData.length

  return safeResult({
    value: account,
    remaining: currentData,
    consumed,
  })
}

/**
 * Decode PartialState according to Gray Paper specification.
 *
 * @param data - Octet sequence to decode
 * @param configService - Configuration service for core/validator counts
 * @returns Decoded PartialState and remaining data
 */
export function decodePartialState(
  data: Uint8Array,
  configService: IConfigService,
): Safe<DecodingResult<PartialState>> {
  let currentData = data

  // ps_accounts: decode{var{sequence{sorted(serviceid, serviceaccount)}}}
  // For dictionaries with variable-length values (service accounts), we need to decode
  // each value to know where it ends, since service accounts are self-delimiting
  const [accountsVarError, accountsVarResult] =
    decodeVariableLength(currentData)
  if (accountsVarError) {
    return safeError(accountsVarError)
  }
  const accountsData = accountsVarResult.value
  currentData = accountsVarResult.remaining

  const accounts = new Map<bigint, ServiceAccount>()
  let accountsRemaining = accountsData
  while (accountsRemaining.length >= 4) {
    // Decode service ID (4 bytes)
    const [serviceIdError, serviceIdResult] = decodeFixedLength(
      accountsRemaining,
      4n,
    )
    if (serviceIdError) {
      break
    }
    const serviceId = serviceIdResult.value
    accountsRemaining = serviceIdResult.remaining

    // Decode complete service account (self-delimiting)
    const [accountError, accountResult] =
      decodeCompleteServiceAccount(accountsRemaining)
    if (accountError) {
      break
    }
    const account = accountResult.value
    accountsRemaining = accountResult.remaining

    accounts.set(serviceId, account)
  }

  // ps_stagingset: decode{sequence[Cvalcount]{valkey}} (fixed-length, no var{})
  const [stagingsetError, stagingsetResult] = decodeValidatorSet(
    currentData,
    configService,
  )
  if (stagingsetError) {
    return safeError(stagingsetError)
  }
  currentData = stagingsetResult.remaining

  // Convert ValidatorPublicKeys[] to Uint8Array[]
  const [validatorsBytesError, validatorsBytes] = convertValidatorKeysToBytes(
    stagingsetResult.value,
  )
  if (validatorsBytesError) {
    return safeError(validatorsBytesError)
  }

  // ps_authqueue: decode{sequence[Ccorecount]{sequence[C_authqueuesize]{hash}}} (fixed-length)
  const [authqueueError, authqueueResult] = decodeAuthqueue(
    currentData,
    configService,
  )
  if (authqueueError) {
    return safeError(authqueueError)
  }
  currentData = authqueueResult.remaining

  const authqueue = convertAuthQueueToBytes(authqueueResult.value)

  // ps_manager: decode[4]{serviceid} (4-byte fixed-length)
  const [managerError, managerResult] = decodeFixedLength(currentData, 4n)
  if (managerError) {
    return safeError(managerError)
  }
  const manager = managerResult.value
  currentData = managerResult.remaining

  // ps_assigners: decode{sequence[Ccorecount]{encode[4]{serviceid}}} (fixed-length)
  const coreCount = configService.numCores
  const assigners: bigint[] = []
  for (let i = 0; i < coreCount; i++) {
    const [error, result] = decodeFixedLength(currentData, 4n)
    if (error) {
      return safeError(error)
    }
    assigners.push(result.value)
    currentData = result.remaining
  }

  // ps_delegator: decode[4]{serviceid} (4-byte fixed-length)
  const [delegatorError, delegatorResult] = decodeFixedLength(currentData, 4n)
  if (delegatorError) {
    return safeError(delegatorError)
  }
  const delegator = delegatorResult.value
  currentData = delegatorResult.remaining

  // ps_registrar: decode[4]{serviceid} (4-byte fixed-length)
  const [registrarError, registrarResult] = decodeFixedLength(currentData, 4n)
  if (registrarError) {
    return safeError(registrarError)
  }
  const registrar = registrarResult.value
  currentData = registrarResult.remaining

  // ps_alwaysaccers: decode{var{sequence{sorted(serviceid, gas)}}}
  // Manually decode dictionary with fixed-length keys and values
  const [alwaysAccersVarError, alwaysAccersVarResult] =
    decodeVariableLength(currentData)
  if (alwaysAccersVarError) {
    return safeError(alwaysAccersVarError)
  }
  const alwaysAccersPairs = alwaysAccersVarResult.value
  currentData = alwaysAccersVarResult.remaining

  const alwaysaccers = new Map<bigint, bigint>()
  let alwaysAccersData = alwaysAccersPairs
  // Decode pairs until we've processed all bytes
  while (alwaysAccersData.length >= 8) {
    // 4 bytes key + 4 bytes value
    // Decode key: encode[4]{serviceid} (4 bytes fixed)
    const [serviceIdError, serviceIdResult] = decodeFixedLength(
      alwaysAccersData,
      4n,
    )
    if (serviceIdError) {
      break
    }
    const serviceId = serviceIdResult.value
    alwaysAccersData = serviceIdResult.remaining

    // Decode value: encode[4]{gas} (4 bytes fixed)
    const [gasError, gasResult] = decodeFixedLength(alwaysAccersData, 4n)
    if (gasError) {
      break
    }
    const gas = gasResult.value
    alwaysAccersData = gasResult.remaining

    alwaysaccers.set(serviceId, gas)
  }

  const partialState: PartialState = {
    accounts,
    stagingset: validatorsBytes,
    authqueue,
    manager,
    assigners,
    delegator,
    registrar,
    alwaysaccers,
  }

  const consumed = data.length - currentData.length

  return safeResult({
    value: partialState,
    remaining: currentData,
    consumed,
  })
}
