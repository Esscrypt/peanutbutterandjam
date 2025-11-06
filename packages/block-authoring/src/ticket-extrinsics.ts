import type {
  IClockService,
  IConfigService,
  ITicketService,
  SafroleTicketWithoutProof,
} from '@pbnj/types'
import { type SafePromise, safeResult } from '@pbnj/types'

export async function getTicketsForExtrinsic(
  clockService: IClockService,
  configService: IConfigService,
  ticketHolderService: ITicketService,
): SafePromise<SafroleTicketWithoutProof[]> {
  const currentPhase = clockService.getCurrentPhase()

  // Gray Paper Eq. 295-298: No tickets during epoch tail
  if (currentPhase >= BigInt(configService.contestDuration)) {
    return safeResult([]) // Empty during slots 500-599
  }

  // Get current ticket accumulator state
  const currentAccumulator = ticketHolderService.getTicketAccumulator()
  const currentAccumulatorSize = currentAccumulator.length

  // Get tickets we received via CE131/CE132
  const receivedTickets = ticketHolderService.getReceivedTickets()

  // Filter tickets that will actually make it into the accumulator
  const validTickets = filterTicketsForAccumulator(
    receivedTickets,
    currentAccumulator,
    currentAccumulatorSize,
    configService,
  )

  // Gray Paper Eq. 295: Limit to C_maxblocktickets (16)
  const ticketsToInclude = validTickets.slice(
    0,
    configService.maxTicketsPerExtrinsic,
  )

  return safeResult(ticketsToInclude)
}

export function filterTicketsForAccumulator(
  receivedTickets: SafroleTicketWithoutProof[],
  currentAccumulator: SafroleTicketWithoutProof[],
  currentAccumulatorSize: number,
  configService: IConfigService,
): SafroleTicketWithoutProof[] {
  const validTickets: SafroleTicketWithoutProof[] = []

  for (const ticket of receivedTickets) {
    // Gray Paper Eq. 316: No duplicate ticket IDs
    const isDuplicate = currentAccumulator.some(
      (existing) => existing.id === ticket.id,
    )
    if (isDuplicate) {
      continue
    }

    // Check if this ticket would make it into the final accumulator
    // Gray Paper Eq. 322: Keep lowest-scoring tickets (highest IDs)
    const wouldMakeIt = wouldTicketMakeItToAccumulator(
      ticket,
      currentAccumulator,
      currentAccumulatorSize,
      configService,
    )

    if (wouldMakeIt) {
      validTickets.push(ticket)
    }
  }

  // Gray Paper Eq. 313: Sort by ticket ID (ascending order)
  return validTickets.sort((a, b) => a.id.localeCompare(b.id))
}

export function wouldTicketMakeItToAccumulator(
  ticket: SafroleTicketWithoutProof,
  currentAccumulator: SafroleTicketWithoutProof[],
  currentAccumulatorSize: number,
  configService: IConfigService,
): boolean {
  // Gray Paper Eq. 322: ticketaccumulator' = sorted union ^Cepochlen

  // If accumulator is not full, any new ticket will make it
  if (currentAccumulatorSize < configService.epochDuration) {
    return true
  }

  // If accumulator is full, only include if ticket has higher score (lower ID)
  // than the worst ticket currently in the accumulator
  const worstTicket = currentAccumulator[currentAccumulatorSize - 1]
  return ticket.id < worstTicket.id
}
