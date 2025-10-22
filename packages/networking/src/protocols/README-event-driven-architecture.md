# Event-Driven Protocol Architecture

## Overview

The event-driven protocol architecture allows protocols to handle incoming messages (both requests and responses) without blocking the networking service. Messages are parsed immediately and events are emitted, while actual processing happens when the service is ready.

## Key Benefits

1. **Non-blocking**: The networking service doesn't wait for protocol processing
2. **Service-ready processing**: Messages are processed only when services are initialized
3. **Queue management**: Messages arriving before service readiness are queued
4. **Request-response matching**: Responses can be matched to pending requests
5. **Backward compatibility**: Legacy synchronous methods are still available

## Architecture Components

### 1. ProtocolMessageEvent Interface

```typescript
interface ProtocolMessageEvent<TRequest, TResponse> {
  request?: TRequest
  response?: TResponse
  peerPublicKey: Hex
  timestamp: number
  messageId: string
  messageType: 'request' | 'response'
}
```

### 2. ProtocolEventHandler Interface

```typescript
interface ProtocolEventHandler<TRequest, TResponse> {
  onRequestReceived(event: ProtocolMessageEvent<TRequest, TResponse>): void
  onResponseReceived(event: ProtocolMessageEvent<TRequest, TResponse>): void
}
```

### 3. Enhanced NetworkingProtocol Base Class

The base class now provides:
- `handleStreamData(data, peerPublicKey, messageType)` - Unified message handling
- `setEventHandler(handler)` - Set event handler for the protocol
- Legacy methods for backward compatibility

## Implementation Pattern

### 1. Protocol Setup

```typescript
export class MyProtocol extends NetworkingProtocol<MyRequest, MyResponse> {
  private isServiceReady = false
  private pendingRequests: ProtocolMessageEvent<MyRequest, MyResponse>[] = []
  private pendingResponses: ProtocolMessageEvent<MyRequest, MyResponse>[] = []

  constructor() {
    super()
    
    // Set up event handler
    this.setEventHandler({
      onRequestReceived: this.handleRequestEvent.bind(this),
      onResponseReceived: this.handleResponseEvent.bind(this),
    })
  }
}
```

### 2. Service Initialization

```typescript
async initializeService(): Promise<void> {
  logger.info('🔄 Initializing service...')
  
  // Perform initialization work
  await this.loadConfiguration()
  await this.connectToDatabase()
  await this.initializeCaches()
  
  this.isServiceReady = true
  logger.info('✅ Service ready!')
  
  // Process any pending messages
  this.processPendingMessages()
}
```

### 3. Event Handlers

```typescript
private handleRequestEvent(event: ProtocolMessageEvent<MyRequest, MyResponse>): void {
  logger.info('📨 Request received', {
    messageId: event.messageId,
    requestId: event.request?.id,
  })

  if (this.isServiceReady) {
    this.processRequestImmediately(event)
  } else {
    logger.info('⏳ Service not ready, queuing request')
    this.pendingRequests.push(event)
  }
}

private handleResponseEvent(event: ProtocolMessageEvent<MyRequest, MyResponse>): void {
  logger.info('📨 Response received', {
    messageId: event.messageId,
    requestId: event.response?.requestId,
  })

  if (this.isServiceReady) {
    this.processResponseImmediately(event)
  } else {
    logger.info('⏳ Service not ready, queuing response')
    this.pendingResponses.push(event)
  }
}
```

### 4. Message Processing

```typescript
private async processRequestImmediately(event: ProtocolMessageEvent<MyRequest, MyResponse>): Promise<void> {
  if (!event.request) return

  try {
    // Process the request
    const result = await this.processRequestData(event.request)
    
    // Send response back to peer (via networking service)
    await this.sendResponse(event.peerPublicKey, result)
    
    logger.info('✅ Request processed', {
      messageId: event.messageId,
    })
  } catch (error) {
    logger.error('❌ Request processing failed', {
      messageId: event.messageId,
      error: error.message,
    })
  }
}

private async processResponseImmediately(event: ProtocolMessageEvent<MyRequest, MyResponse>): Promise<void> {
  if (!event.response) return

  try {
    // Process the response
    await this.handleResponseData(event.response)
    
    logger.info('✅ Response processed', {
      messageId: event.messageId,
    })
  } catch (error) {
    logger.error('❌ Response processing failed', {
      messageId: event.messageId,
      error: error.message,
    })
  }
}
```

## Networking Service Integration

The networking service now calls protocols with the message type:

```typescript
// For incoming requests
const [parseError, event] = protocol.handleStreamData(messageData, peerPublicKey, 'request')

// For incoming responses  
const [parseError, event] = protocol.handleStreamData(messageData, peerPublicKey, 'response')
```

## Request-Response Matching

For protocols that need to match responses to requests:

```typescript
export class RequestResponseProtocol extends NetworkingProtocol<MyRequest, MyResponse> {
  private pendingRequests = new Map<string, ProtocolMessageEvent<MyRequest, MyResponse>>()

  private handleRequestEvent(event: ProtocolMessageEvent<MyRequest, MyResponse>): void {
    if (event.request) {
      // Track pending request
      this.pendingRequests.set(event.request.id, event)
      
      if (this.isServiceReady) {
        this.processRequestImmediately(event)
      } else {
        this.pendingRequests.set(event.request.id, event)
      }
    }
  }

  private handleResponseEvent(event: ProtocolMessageEvent<MyRequest, MyResponse>): void {
    if (event.response) {
      // Find matching request
      const originalRequest = this.pendingRequests.get(event.response.requestId)
      
      if (originalRequest) {
        // Process response with context from original request
        this.processResponseWithContext(event, originalRequest)
        this.pendingRequests.delete(event.response.requestId)
      }
    }
  }
}
```

## Migration Guide

### From Synchronous to Event-Driven

1. **Add event handler setup** in constructor
2. **Implement service initialization** method
3. **Add message queuing** for unready services
4. **Implement event handlers** for requests and responses
5. **Add immediate processing** methods
6. **Keep legacy methods** for backward compatibility

### Example Migration

```typescript
// Before (synchronous)
async handleStreamData(data: Uint8Array, peerPublicKey: Hex): SafePromise<Response> {
  const [error, request] = this.deserializeRequest(data)
  if (error) return safeError(error)
  
  return this.processRequest(request, peerPublicKey) // Blocking!
}

// After (event-driven)
handleStreamData(data: Uint8Array, peerPublicKey: Hex, messageType: 'request' | 'response' = 'request'): Safe<ProtocolMessageEvent<Request, Response>> {
  // Parse and emit event immediately - non-blocking!
  if (messageType === 'request') {
    return this.handleRequestData(data, peerPublicKey)
  } else {
    return this.handleResponseData(data, peerPublicKey)
  }
}
```

## Best Practices

1. **Always check service readiness** before processing
2. **Queue messages** when service is not ready
3. **Process pending messages** when service becomes ready
4. **Use proper error handling** in event handlers
5. **Log message flow** for debugging
6. **Match responses to requests** when needed
7. **Clean up resources** when processing completes

## Examples

- `example-event-driven-protocol.ts` - Basic event-driven protocol
- `example-request-response-protocol.ts` - Request-response matching protocol

This architecture provides a robust, scalable foundation for handling network protocols in a non-blocking, event-driven manner while maintaining backward compatibility with existing synchronous implementations.
