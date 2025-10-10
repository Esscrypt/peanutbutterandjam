/**
 * Ticket Distribution Service
 *
 * Handles CE 131/132 ticket distribution events from the clock service
 * Implements proxy validator selection and ticket distribution logic
 */

import type { EventBusService, TicketDistributionEvent } from '@pbnj/core'
import {
  hexToBytes,
  logger,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/core'
import type {
  CE131TicketDistributionProtocol,
  CE132TicketDistributionProtocol,
} from '@pbnj/networking'
import { determineProxyValidator } from '@pbnj/safrole'
import {
  BaseService,
  type StreamKind,
  type TicketDistributionRequest,
} from '@pbnj/types'
import type { NetworkingService } from './networking-service'
import type { TicketHolderService } from './ticket-holder-service'
import type { ValidatorSetManager } from './validator-set'

/**
 * Ticket distribution service implementation
 */
export class TicketDistributionService extends BaseService {
  private readonly eventBusService: EventBusService
  private readonly validatorSetManager: ValidatorSetManager
  private readonly networkingService: NetworkingService
  private readonly ce131TicketDistributionProtocol: CE131TicketDistributionProtocol
  private readonly ticketHolderService: TicketHolderService
  private readonly ce132TicketDistributionProtocol: CE132TicketDistributionProtocol

  constructor(options: {
    eventBusService: EventBusService
    validatorSetManager: ValidatorSetManager
    networkingService: NetworkingService
    ce131TicketDistributionProtocol: CE131TicketDistributionProtocol
    ticketHolderService: TicketHolderService
    ce132TicketDistributionProtocol: CE132TicketDistributionProtocol
  }) {
    super('ticket-distribution-service')
    this.eventBusService = options.eventBusService
    this.validatorSetManager = options.validatorSetManager
    this.networkingService = options.networkingService
    this.ce131TicketDistributionProtocol =
      options.ce131TicketDistributionProtocol
    this.ticketHolderService = options.ticketHolderService
    this.ce132TicketDistributionProtocol =
      options.ce132TicketDistributionProtocol
  }

  /**
   * Initialize the ticket distribution service
   */
  async init(): SafePromise<boolean> {
    logger.info('Initializing ticket distribution service...')

    // Register for ticket distribution events from clock service
    this.eventBusService.onTicketDistribution(
      this.handleTicketDistributionEvent.bind(this),
    )

    this.setInitialized(true)
    logger.info('Ticket distribution service initialized successfully')

    return safeResult(true)
  }

  /**
   * Handle ticket distribution events from clock service
   */
  private async handleTicketDistributionEvent(
    event: TicketDistributionEvent,
  ): SafePromise<void> {
    switch (event.phase) {
      case 'first-step':
        await this.executeFirstStep(event)
        break
      case 'second-step':
        await this.executeSecondStep(event)
        break
      default:
        return safeError(new Error('Invalid ticket distribution phase'))
    }

    return safeResult(undefined)
  }

  /**
   * Execute first step ticket distribution (CE 131)
   */
  private async executeFirstStep(
    event: TicketDistributionEvent,
  ): SafePromise<void> {
    const tickets = this.ticketHolderService.getProxyValidatorTickets()

    for (const ticket of tickets) {
      // Determine proxy validator using JAMNP-S specification:
      // "The index of the proxy validator for a ticket is determined by interpreting
      // the last 4 bytes of the ticket's VRF output as a big-endian unsigned integer,
      // modulo the number of validators"
      const proxyValidatorIndex = determineProxyValidator(
        ticket,
        this.validatorSetManager,
      )

      const ticketDistributionRequest: TicketDistributionRequest = {
        epochIndex: event.epoch,
        ticket: {
          entryIndex: ticket.entryIndex,
          proof: hexToBytes(ticket.proof),
        },
      }
      const [serializeError, serializedRequest] =
        this.ce131TicketDistributionProtocol.serializeRequest(
          ticketDistributionRequest,
        )
      if (serializeError) {
        return safeError(serializeError)
      }

      this.networkingService.sendMessage(
        BigInt(proxyValidatorIndex),
        132 as StreamKind, // Proxy validator to all current validators
        serializedRequest,
      )
    }

    return safeResult(undefined)
  }

  /**
   * Execute second step ticket distribution (CE 132)
   */
  private async executeSecondStep(
    _event: TicketDistributionEvent,
  ): SafePromise<void> {
    logger.info('Executing second step ticket distribution (CE 132)')

    try {
      // Get current validator set
      const validators = this.validatorSetManager.getActiveValidators()
      const totalValidators = validators.size

      if (totalValidators === 0) {
        logger.warn('No active validators for ticket distribution')
        return safeError(
          new Error('No active validators for ticket distribution'),
        )
      }

      const ticketsToForward =
        this.ticketHolderService.getProxyValidatorTickets()

      for (const ticket of ticketsToForward) {
        const ticketDistributionRequest: TicketDistributionRequest = {
          epochIndex: _event.epoch,
          ticket: {
            entryIndex: ticket.entryIndex,
            proof: hexToBytes(ticket.proof),
          },
        }
        const [serializeError, serializedRequest] =
          this.ce132TicketDistributionProtocol.serializeRequest(
            ticketDistributionRequest,
          )
        if (serializeError) {
          return safeError(serializeError)
        }
        for (const validatorIndex of validators.keys()) {
          try {
            this.networkingService.sendMessage(
              BigInt(validatorIndex),
              132 as StreamKind, // Proxy validator to all current validators
              serializedRequest,
            )
          } catch (error) {
            logger.error('Failed to send ticket distribution request', {
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }
      }
    } catch (error) {
      logger.error('Failed to execute second step ticket distribution', {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    return safeResult(undefined)
  }
}
