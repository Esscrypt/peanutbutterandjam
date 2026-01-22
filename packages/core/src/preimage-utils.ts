/**
 * Preimage Utilities
 *
 * Gray Paper functions for preimage availability checking
 * Reference: Gray Paper accounts.tex, equations 120-125
 */

/**
 * Check if preimage is available at the given slot using Gray Paper function I(l, t)
 *
 * Gray Paper equation 120-125:
 * I(l, t) = false when [] = l
 * I(l, t) = x ≤ t when [x] = l
 * I(l, t) = x ≤ t < y when [x, y] = l
 * I(l, t) = x ≤ t < y ∨ z ≤ t when [x, y, z] = l
 *
 * This function determines whether a preimage is available at a given timeslot
 * based on its request status sequence.
 *
 * @param requestStatus - Request status sequence (up to 3 timeslots)
 * @param timeslot - Timeslot to check availability
 * @returns True if preimage is available at the given timeslot
 */
export function checkPreimageAvailability(
  requestStatus: bigint[],
  timeslot: bigint,
): boolean {
  switch (requestStatus.length) {
    case 0:
      // Empty request - not available
      return false

    case 1:
      // [x] - available from x onwards
      return requestStatus[0] <= timeslot

    case 2:
      // [x, y] - available from x to y (exclusive)
      return requestStatus[0] <= timeslot && timeslot < requestStatus[1]

    case 3:
      // [x, y, z] - available from x to y OR from z onwards
      return (
        (requestStatus[0] <= timeslot && timeslot < requestStatus[1]) ||
        requestStatus[2] <= timeslot
      )

    default:
      // Invalid request format - not available
      return false
  }
}
