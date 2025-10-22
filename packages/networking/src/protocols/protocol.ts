import {
  type Hex,
  logger,
  type Safe,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/core'

/**
 * Event-driven protocol message interface
 */
export interface ProtocolMessageEvent<TRequest, TResponse> {
  request?: TRequest
  response?: TResponse
  peerPublicKey: Hex
  timestamp: number
  messageId: string
  messageType: 'request' | 'response'
}

/**
 * Event-driven protocol handler interface
 */
export interface ProtocolEventHandler<TRequest, TResponse> {
  onRequestReceived(event: ProtocolMessageEvent<TRequest, TResponse>): void
  onResponseReceived(event: ProtocolMessageEvent<TRequest, TResponse>): void
}

export abstract class NetworkingProtocol<TRequest, TResponse> {
  private eventHandler?: ProtocolEventHandler<TRequest, TResponse>
  private messageIdCounter = 0
  protected protocolName: string

  constructor() {
    // Extract protocol name from class name for logging
    this.protocolName = this.constructor.name
  }

  //   handleIncomingMessage(validatorIndex: bigint, streamKind: StreamKind, data: Uint8Array): StreamHandler
  abstract serializeRequest(data: TRequest): Safe<Uint8Array>

  abstract deserializeRequest(data: Uint8Array): Safe<TRequest>

  abstract serializeResponse(data: TResponse): Safe<Uint8Array>

  abstract deserializeResponse(data: Uint8Array): Safe<TResponse>

  abstract processRequest(data: TRequest, peerPublicKey: Hex): SafePromise<void>

  abstract processResponse(
    data: TResponse,
    peerPublicKey: Hex,
  ): SafePromise<void>

  /**
   * Set the event handler for this protocol
   */
  setEventHandler(handler: ProtocolEventHandler<TRequest, TResponse>): void {
    this.eventHandler = handler
  }

  /**
   * Initialize default event handlers for this protocol
   * This should be called in the constructor of derived classes
   */
  protected initializeEventHandlers(): void {
    this.setEventHandler({
      onRequestReceived: (event: ProtocolMessageEvent<TRequest, TResponse>) => {
        logger.info(`📨 ${this.protocolName} request received`, {
          messageId: event.messageId,
          peerPublicKey: event.peerPublicKey.slice(0, 20) + '...',
          protocolName: this.protocolName,
        })

        // Process asynchronously without blocking
        this.processRequest(event.request!, event.peerPublicKey)
          .then(([error]) => {
            if (error) {
              logger.error(
                `❌ ${this.protocolName} request processing failed`,
                {
                  messageId: event.messageId,
                  error: error.message,
                },
              )
            } else {
              logger.info(
                `✅ ${this.protocolName} request processed successfully`,
                {
                  messageId: event.messageId,
                },
              )
            }
          })
          .catch((error) => {
            logger.error(`❌ ${this.protocolName} request processing error`, {
              messageId: event.messageId,
              error: error instanceof Error ? error.message : String(error),
            })
          })
      },

      onResponseReceived: (
        event: ProtocolMessageEvent<TRequest, TResponse>,
      ) => {
        logger.info(`📨 ${this.protocolName} response received`, {
          messageId: event.messageId,
          peerPublicKey: event.peerPublicKey.slice(0, 20) + '...',
          protocolName: this.protocolName,
        })

        // Process asynchronously without blocking
        this.processResponse(event.response!, event.peerPublicKey)
          .then(([error]) => {
            if (error) {
              logger.error(
                `❌ ${this.protocolName} response processing failed`,
                {
                  messageId: event.messageId,
                  error: error.message,
                },
              )
            } else {
              logger.info(
                `✅ ${this.protocolName} response processed successfully`,
                {
                  messageId: event.messageId,
                },
              )
            }
          })
          .catch((error) => {
            logger.error(`❌ ${this.protocolName} response processing error`, {
              messageId: event.messageId,
              error: error instanceof Error ? error.message : String(error),
            })
          })
      },
    })

    logger.info(`✅ ${this.protocolName} initialized and ready`)
  }

  /**
   * Parse incoming stream data and emit event (non-blocking)
   * This method handles both requests and responses based on messageType
   */
  handleStreamData(
    data: Uint8Array,
    peerPublicKey: Hex,
    messageType: 'request' | 'response' = 'request',
  ): Safe<ProtocolMessageEvent<TRequest, TResponse>> {
    if (messageType === 'request') {
      return this.handleRequestData(data, peerPublicKey)
    } else {
      return this.handleResponseData(data, peerPublicKey)
    }
  }

  /**
   * Parse incoming request data and emit event (non-blocking)
   */
  private handleRequestData(
    data: Uint8Array,
    peerPublicKey: Hex,
  ): Safe<ProtocolMessageEvent<TRequest, TResponse>> {
    const [error, request] = this.deserializeRequest(data)
    if (error) {
      return safeError(error)
    }

    const event: ProtocolMessageEvent<TRequest, TResponse> = {
      request,
      peerPublicKey,
      timestamp: Date.now(),
      messageId: `req_${++this.messageIdCounter}`,
      messageType: 'request',
    }

    // Emit event if handler is set
    if (this.eventHandler) {
      this.eventHandler.onRequestReceived(event)
    }

    return safeResult(event)
  }

  /**
   * Parse incoming response data and emit event (non-blocking)
   */
  private handleResponseData(
    data: Uint8Array,
    peerPublicKey: Hex,
  ): Safe<ProtocolMessageEvent<TRequest, TResponse>> {
    const [error, response] = this.deserializeResponse(data)
    if (error) {
      return safeError(error)
    }

    const event: ProtocolMessageEvent<TRequest, TResponse> = {
      response,
      peerPublicKey,
      timestamp: Date.now(),
      messageId: `resp_${++this.messageIdCounter}`,
      messageType: 'response',
    }

    // Emit event if handler is set
    if (this.eventHandler) {
      this.eventHandler.onResponseReceived(event)
    }

    return safeResult(event)
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use handleStreamData with messageType parameter instead
   */
  handleResponseStreamData(
    data: Uint8Array,
    peerPublicKey: Hex,
  ): Safe<ProtocolMessageEvent<TRequest, TResponse>> {
    return this.handleStreamData(data, peerPublicKey, 'response')
  }
}
