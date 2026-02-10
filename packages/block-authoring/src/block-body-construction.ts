/**
 * Block Body Construction
 *
 * Constructs block bodies by collecting pending extrinsics from services
 * Reference: Gray Paper block body specifications
 */

import type {
  Assurance,
  BlockBody,
  Dispute,
  IAssuranceService,
  IClockService,
  IConfigService,
  IDisputesService,
  IGuarantorService,
  IRecentHistoryService,
  IServiceAccountService,
  ITicketService,
  IWorkReportService,
  Preimage,
  Safe,
  SafroleTicket,
} from '@pbnjam/types'
import { safeResult } from '@pbnjam/types'

/**
 * Construct block body by collecting extrinsics from services
 *
 * Gray Paper Block Body Structure:
 * - tickets: SafroleTicket[] from TicketService (pending tickets not yet on-chain)
 * - preimages: Preimage[] from ServiceAccountService (pending preimages requested on-chain)
 * - guarantees: Guarantee[] from GuarantorService/WorkReportService (pending guarantees)
 * - assurances: Assurance[] from AssuranceService (pending assurances)
 * - disputes: Dispute[] from DisputesService (pending disputes)
 *
 * @param slot - Current slot for the block being constructed
 * @param config - Config service
 * @param serviceAccountService - Service account service (for preimages)
 * @param ticketService - Ticket service (for tickets)
 * @param guarantorService - Guarantor service (for guarantees)
 * @param workReportService - Work report service (for guarantees)
 * @param assuranceService - Assurance service (for assurances)
 * @param disputesService - Disputes service (for disputes)
 * @param recentHistoryService - Recent history service (for parent hash validation)
 * @param clockService - Clock service (for slot validation)
 * @returns Block body with collected extrinsics
 */
export function constructBlockBody(
  slot: bigint,
  _config: IConfigService,
  serviceAccountService: IServiceAccountService,
  ticketService: ITicketService,
  _guarantorService: IGuarantorService,
  _workReportService: IWorkReportService,
  _assuranceService: IAssuranceService,
  _disputesService: IDisputesService,
  recentHistoryService: IRecentHistoryService,
  _clockService: IClockService,
): Safe<BlockBody> {
  // Services stored for future use (see TODOs below)
  void _config
  void _guarantorService
  void _assuranceService
  void _disputesService
  void _clockService
  // Get tickets from ticket service
  // Use proxy validator tickets which include proofs (SafroleTicket[])
  const tickets: SafroleTicket[] = []
  // Get proxy validator tickets which have proofs
  const proxyTickets = ticketService.getProxyValidatorTickets()
  tickets.push(...proxyTickets)

  // Also get received tickets (SafroleTicketWithoutProof[]) - these need proofs
  // TODO: Implement proof generation for received tickets or store them with proofs
  // For now, we only include proxy validator tickets which already have proofs

  // Get preimages from service account service
  // Preimages should only include those that are NOT yet in state but are requested
  // Preimages already in state should NOT be included in blocks (they're already available)
  const preimages: Preimage[] = []

  // Only collect pending preimages that are requested but not yet in state
  // Preimages already in state should NOT be included in blocks
  const requestedPendingPreimages =
    serviceAccountService.getRequestedPendingPreimages(slot)
  preimages.push(...requestedPendingPreimages)

  // Sort preimages by requester (ascending), then by blob (ascending)
  // Gray Paper: preimages must be sorted and unique
  preimages.sort((a, b) => {
    if (a.requester !== b.requester) {
      return a.requester < b.requester ? -1 : 1
    }
    return a.blob < b.blob ? -1 : a.blob > b.blob ? 1 : 0
  })

  // Get guarantees from work report service
  // Guarantees are created by guarantors when they sign work reports
  // They are stored in WorkReportService and collected here for block inclusion
  const guarantees = _workReportService.getPendingGuarantees()

  // Sort guarantees by core index (ascending, unique) as per Gray Paper equation 257
  guarantees.sort((a, b) => {
    const coreA = Number(a.report.core_index)
    const coreB = Number(b.report.core_index)
    return coreA - coreB
  })

  // Get assurances from assurance service
  // TODO: Implement method to get pending assurances ready for block inclusion
  // Assurances are created by validators when they attest to data availability
  // They should be collected from a pending assurances pool or queue
  const assurances: Assurance[] = []
  // Get parent hash from recent history for anchor validation
  const recentHistory = recentHistoryService.getRecentHistory()
  if (recentHistory.length > 0) {
    // TODO: Collect pending assurances from AssuranceService
    // Assurances should be:
    // - Validated (signature, anchor matches parent hash)
    // - Sorted by validator_index (ascending, unique)
    // - Ready for inclusion (not expired, anchor matches current parent)
    // For now, leaving empty - this needs to be implemented based on assurance workflow
    // The AssuranceService should expose a method like getPendingAssurances(parentHash: Hex): Assurance[]
  }

  // Get disputes from disputes service
  // TODO: Implement method to get pending disputes ready for block inclusion
  // Disputes are created by validators when they detect issues with work reports
  // They should be collected from a pending disputes pool or queue
  const disputes: Dispute[] = []
  // Note: Disputes are typically created by validators when they detect problems
  // They should be collected from a pending disputes pool or queue
  // For now, leaving empty - this needs to be implemented based on dispute workflow

  return safeResult({
    tickets,
    preimages,
    guarantees,
    assurances,
    disputes,
  })
}
