/**
 * WebSocket Routes for JIP-2 RPC Subscriptions
 *
 * Handles WebSocket connections for subscription-based RPC methods.
 * JIP-2 specifies WebSocket on port 19800 for subscriptions.
 *
 * Subscription methods:
 * - subscribeBestBlock
 * - subscribeFinalizedBlock
 * - subscribeStatistics
 * - subscribeServiceData
 * - subscribeServiceValue
 * - subscribeServicePreimage
 * - subscribeServiceRequest
 */

// @ts-expect-error - Module exists at runtime, types may not be available yet
import { createNodeWebSocket } from '@hono/node-ws'
import { logger } from '@pbnjam/core'
import type { Context, Hono } from 'hono'
import { rpcHandler, subscriptionManager } from './routes'
import type { RpcRequest, WebSocket } from './types'

// Types for @hono/node-ws (not fully typed)
interface WSContext {
  raw: unknown
}

interface WSEvent {
  data: { toString(): string }
}

/**
 * Upgrade Hono app with WebSocket support
 */
export function setupWebSocket(app: Hono): {
  injectWebSocket: (server: unknown) => void
  upgradeWebSocket: unknown
} {
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({
    app,
  }) as {
    injectWebSocket: (server: unknown) => void
    upgradeWebSocket: (handler: (c: Context) => object) => unknown
  }

  // WebSocket endpoint for subscriptions
  const wsHandler = upgradeWebSocket((_c: Context) => {
    return {
      onOpen(_evt: unknown, ws: WSContext) {
        const rawWs = ws.raw as unknown as WebSocket
        logger.info('WebSocket connection opened')

        // Track the connection
        rawWs.readyState = 1 // OPEN
      },

      onMessage(evt: WSEvent, ws: WSContext) {
        const rawWs = ws.raw as unknown as WebSocket
        handleWebSocketMessage(rawWs, evt.data.toString())
      },

      onClose(_evt: unknown, ws: WSContext) {
        const rawWs = ws.raw as unknown as WebSocket
        logger.info('WebSocket connection closed')

        // Clean up subscriptions for this connection
        subscriptionManager.removeSubscriptions(rawWs)
      },

      onError(evt: unknown, ws: WSContext) {
        const rawWs = ws.raw as unknown as WebSocket
        logger.error(`WebSocket error: ${evt}`)

        // Clean up subscriptions on error
        subscriptionManager.removeSubscriptions(rawWs)
      },
    }
  })

  // Register the WebSocket route - cast needed due to dynamic middleware typing
  ;(app as { get: (path: string, handler: unknown) => void }).get(
    '/ws',
    wsHandler,
  )

  return { injectWebSocket, upgradeWebSocket }
}

/**
 * Handle incoming WebSocket JSON-RPC messages
 */
async function handleWebSocketMessage(
  ws: WebSocket,
  data: string,
): Promise<void> {
  let request: RpcRequest

  try {
    request = JSON.parse(data) as RpcRequest
  } catch (_error) {
    sendError(ws, null, -32700, 'Parse error: Invalid JSON')
    return
  }

  if (request.jsonrpc !== '2.0' || !request.method) {
    sendError(ws, request.id, -32600, 'Invalid Request')
    return
  }

  try {
    const result = await handleSubscriptionMethod(
      ws,
      request.method,
      request.params,
    )

    if (result !== undefined) {
      sendResult(ws, request.id, result)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    sendError(ws, request.id, -32603, message)
  }
}

/**
 * Handle subscription method calls
 */
async function handleSubscriptionMethod(
  ws: WebSocket,
  method: string,
  params?: unknown[],
): Promise<unknown> {
  switch (method) {
    // Subscription methods
    case 'subscribeBestBlock': {
      const subscriptionId = rpcHandler.subscribeBestBlock(ws)
      return { subscriptionId }
    }

    case 'subscribeFinalizedBlock': {
      const subscriptionId = rpcHandler.subscribeFinalizedBlock(ws)
      return { subscriptionId }
    }

    case 'subscribeStatistics': {
      const finalized = (params?.[0] as boolean) ?? false
      const subscriptionId = rpcHandler.subscribeStatistics(finalized, ws)
      return { subscriptionId }
    }

    case 'subscribeServiceData': {
      const serviceId = params?.[0] as number
      const finalized = (params?.[1] as boolean) ?? false
      if (serviceId === undefined) {
        throw new Error('Missing serviceId parameter')
      }
      const subscriptionId = rpcHandler.subscribeServiceData(
        serviceId,
        finalized,
        ws,
      )
      return { subscriptionId }
    }

    case 'subscribeServiceValue': {
      const serviceId = params?.[0] as number
      const key = params?.[1] as Uint8Array
      const finalized = (params?.[2] as boolean) ?? false
      if (serviceId === undefined || !key) {
        throw new Error('Missing required parameters')
      }
      const subscriptionId = rpcHandler.subscribeServiceValue(
        serviceId,
        key,
        finalized,
        ws,
      )
      return { subscriptionId }
    }

    case 'subscribeServicePreimage': {
      const serviceId = params?.[0] as number
      const hash = params?.[1] as `0x${string}`
      const finalized = (params?.[2] as boolean) ?? false
      if (serviceId === undefined || !hash) {
        throw new Error('Missing required parameters')
      }
      const subscriptionId = rpcHandler.subscribeServicePreimage(
        serviceId,
        hash,
        finalized,
        ws,
      )
      return { subscriptionId }
    }

    case 'subscribeServiceRequest': {
      const serviceId = params?.[0] as number
      const hash = params?.[1] as `0x${string}`
      const length = params?.[2] as number
      const finalized = (params?.[3] as boolean) ?? false
      if (serviceId === undefined || !hash || length === undefined) {
        throw new Error('Missing required parameters')
      }
      const subscriptionId = rpcHandler.subscribeServiceRequest(
        serviceId,
        hash,
        length,
        finalized,
        ws,
      )
      return { subscriptionId }
    }

    // Unsubscribe methods
    case 'unsubscribeBestBlock':
    case 'unsubscribeFinalizedBlock':
    case 'unsubscribeStatistics':
    case 'unsubscribeServiceData':
    case 'unsubscribeServiceValue':
    case 'unsubscribeServicePreimage':
    case 'unsubscribeServiceRequest': {
      const subscriptionId = params?.[0] as string
      if (!subscriptionId) {
        throw new Error('Missing subscriptionId parameter')
      }
      const removed = subscriptionManager.removeSubscription(subscriptionId)
      return { success: removed }
    }

    // Regular RPC methods can also be called over WebSocket
    case 'parameters': {
      return await rpcHandler.parameters()
    }

    case 'bestBlock': {
      return await rpcHandler.bestBlock()
    }

    case 'finalizedBlock': {
      return await rpcHandler.finalizedBlock()
    }

    case 'parent': {
      const blockHash = params?.[0] as `0x${string}`
      if (!blockHash) throw new Error('Missing blockHash parameter')
      return await rpcHandler.parent(blockHash)
    }

    case 'stateRoot': {
      const blockHash = params?.[0] as `0x${string}`
      if (!blockHash) throw new Error('Missing blockHash parameter')
      return await rpcHandler.stateRoot(blockHash)
    }

    case 'statistics': {
      const blockHash = params?.[0] as `0x${string}`
      if (!blockHash) throw new Error('Missing blockHash parameter')
      return await rpcHandler.statistics(blockHash)
    }

    case 'serviceData': {
      const blockHash = params?.[0] as `0x${string}`
      const serviceId = params?.[1] as number
      if (!blockHash || serviceId === undefined) {
        throw new Error('Missing required parameters')
      }
      return await rpcHandler.serviceData(blockHash, serviceId)
    }

    case 'serviceValue': {
      const blockHash = params?.[0] as `0x${string}`
      const serviceId = params?.[1] as number
      const key = params?.[2] as Uint8Array
      if (!blockHash || serviceId === undefined || !key) {
        throw new Error('Missing required parameters')
      }
      return await rpcHandler.serviceValue(blockHash, serviceId, key)
    }

    case 'servicePreimage': {
      const blockHash = params?.[0] as `0x${string}`
      const serviceId = params?.[1] as number
      const hash = params?.[2] as `0x${string}`
      if (!blockHash || serviceId === undefined || !hash) {
        throw new Error('Missing required parameters')
      }
      return await rpcHandler.servicePreimage(blockHash, serviceId, hash)
    }

    case 'serviceRequest': {
      const blockHash = params?.[0] as `0x${string}`
      const serviceId = params?.[1] as number
      const hash = params?.[2] as `0x${string}`
      const length = params?.[3] as number
      if (
        !blockHash ||
        serviceId === undefined ||
        !hash ||
        length === undefined
      ) {
        throw new Error('Missing required parameters')
      }
      return await rpcHandler.serviceRequest(blockHash, serviceId, hash, length)
    }

    case 'beefyRoot': {
      const blockHash = params?.[0] as `0x${string}`
      if (!blockHash) throw new Error('Missing blockHash parameter')
      return await rpcHandler.beefyRoot(blockHash)
    }

    case 'submitWorkPackage': {
      const coreIndex = BigInt(params?.[0] as number)
      const workPackage = params?.[1] as Uint8Array
      const extrinsics = params?.[2] as Uint8Array[]
      if (coreIndex === undefined || !workPackage || !extrinsics) {
        throw new Error('Missing required parameters')
      }
      await rpcHandler.submitWorkPackage(coreIndex, workPackage, extrinsics)
      return { success: true }
    }

    case 'submitPreimage': {
      const serviceId = BigInt(params?.[0] as number)
      const preimage = params?.[1] as Uint8Array
      const blockHash = params?.[2] as `0x${string}`
      if (serviceId === undefined || !preimage || !blockHash) {
        throw new Error('Missing required parameters')
      }
      await rpcHandler.submitPreimage(serviceId, preimage, blockHash)
      return { success: true }
    }

    case 'listServices': {
      const blockHash = params?.[0] as `0x${string}`
      if (!blockHash) throw new Error('Missing blockHash parameter')
      return await rpcHandler.listServices(blockHash)
    }

    default:
      throw new Error(`Method not found: ${method}`)
  }
}

/**
 * Send JSON-RPC result
 */
function sendResult(
  ws: WebSocket,
  id: string | number | null,
  result: unknown,
): void {
  const response = {
    jsonrpc: '2.0' as const,
    id,
    result,
  }
  ws.send(JSON.stringify(response))
}

/**
 * Send JSON-RPC error
 */
function sendError(
  ws: WebSocket,
  id: string | number | null,
  code: number,
  message: string,
): void {
  const response = {
    jsonrpc: '2.0' as const,
    id,
    error: { code, message },
  }
  ws.send(JSON.stringify(response))
}
