import {
  blake2bHash,
  type Hex,
  hexToBytes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/core'
import type { IConfigService, SafroleTicket } from '@pbnj/types'

/**
 * Compute winning tickets marker according to Gray Paper Eq. 262-266
 * H_winnersmark = Z(ticketaccumulator) when e' = e ∧ m < Cepochtailstart ≤ m' ∧ |ticketaccumulator| = Cepochlen
 *
 * Gray Paper Z function: outside-in sequencer
 * Z: sequence[Cepochlen]{SafroleTicket} → sequence[Cepochlen]{SafroleTicket}
 * s ↦ {s₀, s_{len(s)-1}, s₁, s_{len(s)-2}, ...}
 */
export function computeWinnersMarker(
  ticketAccumulator: SafroleTicket[],
  configManager: IConfigService,
  currentEpoch: bigint,
  nextEpoch: bigint,
  currentSlot: bigint,
  nextSlot: bigint,
): Safe<Hex | null> {
  // Gray Paper condition: e' = e ∧ m < Cepochtailstart ≤ m' ∧ |ticketaccumulator| = Cepochlen
  const epochTransition = nextEpoch > currentEpoch
  const currentPhase = currentSlot % BigInt(configManager.epochDuration)
  const nextPhase = nextSlot % BigInt(configManager.epochDuration)
  const isEpochTailStart = nextPhase >= BigInt(configManager.contestDuration)
  const isAccumulatorFull =
    ticketAccumulator.length === configManager.epochDuration

  // Check Gray Paper conditions
  if (
    !epochTransition ||
    currentPhase >= BigInt(configManager.contestDuration) ||
    !isEpochTailStart ||
    !isAccumulatorFull
  ) {
    return safeResult(null) // Gray Paper: none
  }

  // Apply Z function (outside-in sequencer) to ticket accumulator
  const zSequencedTickets: SafroleTicket[] = []
  const n = ticketAccumulator.length

  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      // Even indices: take from start (0, 1, 2, ...)
      zSequencedTickets.push(ticketAccumulator[i / 2])
    } else {
      // Odd indices: take from end (n-1, n-2, n-3, ...)
      zSequencedTickets.push(ticketAccumulator[n - 1 - Math.floor(i / 2)])
    }
  }

  // Create accumulator data for hashing (Z-sequenced tickets)
  const accumulatorData = new Uint8Array(zSequencedTickets.length * 32)
  for (let i = 0; i < zSequencedTickets.length; i++) {
    const ticketIdBytes = hexToBytes(zSequencedTickets[i].id)
    accumulatorData.set(ticketIdBytes, i * 32)
  }

  // Hash the Z-sequenced accumulator data
  const [hashError, hash] = blake2bHash(accumulatorData)
  if (hashError) {
    return safeError(hashError)
  }

  return safeResult(hash)
}
