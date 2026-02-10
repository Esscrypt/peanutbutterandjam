/**
 * WebSocket Routes for JIP-2 RPC Subscriptions
 *
 * Handles WebSocket connections for subscription-based RPC methods using Bun's native WebSocket.
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

import { logger } from '@pbnjam/core'
import { rpcHandler, subscriptionManager } from './routes'
import {
  beefyRootParamsSchema,
  bestBlockParamsSchema,
  finalizedBlockParamsSchema,
  listServicesParamsSchema,
  parentParamsSchema,
  serviceDataParamsSchema,
  servicePreimageParamsSchema,
  serviceRequestParamsSchema,
  serviceValueParamsWebSocketSchema,
  stateRootParamsSchema,
  statisticsParamsSchema,
  submitPreimageParamsWebSocketSchema,
  submitWorkPackageParamsWebSocketSchema,
  subscribeServiceDataParamsSchema,
  subscribeServicePreimageParamsSchema,
  subscribeServiceRequestParamsSchema,
  subscribeServiceValueParamsSchema,
  subscribeStatisticsParamsSchema,
  unsubscribeParamsSchema,
} from './schemas'
import type { RpcRequest, WebSocket } from './types'

/**
 * Setup WebSocket handlers for Bun
 */
export function setupWebSocketForBun(): {
  upgrade: (req: Request) => boolean
  websocket: {
    message: (ws: WebSocket, message: string | Buffer) => void | Promise<void>
    open: (ws: WebSocket) => void | Promise<void>
    close: (ws: WebSocket) => void | Promise<void>
    error: (ws: WebSocket, error: Error) => void | Promise<void>
  }
} {
  return {
    upgrade: (req: Request): boolean => {
      logger.info('WebSocket upgrade requested')
      const url = new URL(req.url)
      if (url.pathname === '/') {
        return true // Allow upgrade at root path
      }
      return false
    },
    websocket: {
      open: (_ws: WebSocket) => {
        logger.info('WebSocket connection opened')
      },

      message: async (ws: WebSocket, message: string | Buffer) => {
        const data = typeof message === 'string' ? message : message.toString()
        await handleWebSocketMessage(ws, data)
      },

      close: (ws: WebSocket, code?: number, message?: string) => {
        logger.info(
          `WebSocket connection closed${code !== undefined ? ` (code: ${code})` : ''}${message ? ` (message: ${message})` : ''}`,
        )
        // Clean up subscriptions for this connection
        subscriptionManager.removeSubscriptions(ws)
      },

      error: (ws: WebSocket, error: Error | unknown) => {
        const errorMessage =
          error instanceof Error
            ? error.message
            : error
              ? String(error)
              : 'Unknown error'
        logger.error(`WebSocket error: ${errorMessage}`)
        // Clean up subscriptions on error
        subscriptionManager.removeSubscriptions(ws)
      },
    },
  }
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
      request.params ?? [],
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
 * Handle subscription method calls with type-safe Zod validation
 * JIP-2: params should always be an array (mandatory per spec)
 */
async function handleSubscriptionMethod(
  ws: WebSocket,
  method: string,
  params: unknown[],
): Promise<unknown> {
  switch (method) {
    // Subscription methods
    case 'subscribeBestBlock': {
      const subscriptionId = await rpcHandler.subscribeBestBlock(ws)
      return { subscriptionId }
    }

    case 'subscribeFinalizedBlock': {
      const subscriptionId = await rpcHandler.subscribeFinalizedBlock(ws)
      return { subscriptionId }
    }

    case 'subscribeStatistics': {
      const [finalized] = subscribeStatisticsParamsSchema.parse(params)
      const subscriptionId = await rpcHandler.subscribeStatistics(finalized, ws)
      return { subscriptionId }
    }

    case 'subscribeServiceData': {
      const [serviceId, finalized] =
        subscribeServiceDataParamsSchema.parse(params)
      const subscriptionId = await rpcHandler.subscribeServiceData(
        serviceId,
        finalized,
        ws,
      )
      return { subscriptionId }
    }

    case 'subscribeServiceValue': {
      const [serviceId, key, finalized] =
        subscribeServiceValueParamsSchema.parse(params)
      const subscriptionId = await rpcHandler.subscribeServiceValue(
        serviceId,
        key,
        finalized,
        ws,
      )
      return { subscriptionId }
    }

    case 'subscribeServicePreimage': {
      const [serviceId, hash, finalized] =
        subscribeServicePreimageParamsSchema.parse(params)
      const subscriptionId = await rpcHandler.subscribeServicePreimage(
        serviceId,
        hash,
        finalized,
        ws,
      )
      return { subscriptionId }
    }

    case 'subscribeServiceRequest': {
      const [serviceId, hash, length, finalized] =
        subscribeServiceRequestParamsSchema.parse(params)
      const subscriptionId = await rpcHandler.subscribeServiceRequest(
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
      const [subscriptionId] = unsubscribeParamsSchema.parse(params)
      const removed = subscriptionManager.removeSubscription(subscriptionId)
      return { success: removed }
    }

    // Regular RPC methods can also be called over WebSocket
    case 'parameters': {
      const paramsResult = await rpcHandler.parameters()
      return { V1: paramsResult }
    }

    case 'bestBlock': {
      bestBlockParamsSchema.parse(params)
      return await rpcHandler.bestBlock()
    }

    case 'finalizedBlock': {
      finalizedBlockParamsSchema.parse(params)
      return await rpcHandler.finalizedBlock()
    }

    case 'parent': {
      const [blockHash] = parentParamsSchema.parse(params)
      return await rpcHandler.parent(blockHash)
    }

    case 'stateRoot': {
      const [blockHash] = stateRootParamsSchema.parse(params)
      return await rpcHandler.stateRoot(blockHash)
    }

    case 'statistics': {
      const [blockHash] = statisticsParamsSchema.parse(params)
      return await rpcHandler.statistics(blockHash)
    }

    case 'serviceData': {
      const [blockHash, serviceId] = serviceDataParamsSchema.parse(params)
      return await rpcHandler.serviceData(blockHash, serviceId)
    }

    case 'serviceValue': {
      const [blockHash, serviceId, key] =
        serviceValueParamsWebSocketSchema.parse(params)
      return await rpcHandler.serviceValue(blockHash, serviceId, key)
    }

    case 'servicePreimage': {
      const [blockHash, serviceId, hash] =
        servicePreimageParamsSchema.parse(params)
      return await rpcHandler.servicePreimage(blockHash, serviceId, hash)
    }

    case 'serviceRequest': {
      const [blockHash, serviceId, hash, length] =
        serviceRequestParamsSchema.parse(params)
      return await rpcHandler.serviceRequest(blockHash, serviceId, hash, length)
    }

    case 'beefyRoot': {
      const [blockHash] = beefyRootParamsSchema.parse(params)
      return await rpcHandler.beefyRoot(blockHash)
    }

    case 'submitWorkPackage': {
      const [coreIndex, workPackage, extrinsics] =
        submitWorkPackageParamsWebSocketSchema.parse(params)
      await rpcHandler.submitWorkPackage(coreIndex, workPackage, extrinsics)
      return { success: true }
    }

    case 'submitPreimage': {
      const [serviceId, preimage, blockHash] =
        submitPreimageParamsWebSocketSchema.parse(params)
      await rpcHandler.submitPreimage(serviceId, preimage, blockHash)
      return { success: true }
    }

    case 'listServices': {
      const [blockHash] = listServicesParamsSchema.parse(params)
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
