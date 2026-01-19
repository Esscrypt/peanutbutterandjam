/**
 * RPC Routes
 *
 * Bun-native HTTP JSON-RPC server implementing JIP-2 specification.
 * Uses Bun.serve() with native routing instead of Hono.
 */

import { logger } from '@pbnjam/core'
import { z } from 'zod'
import { config } from './config'
import { RpcHandler } from './rpc-handler'
import {
  beefyRootParamsSchema,
  bestBlockParamsSchema,
  finalizedBlockParamsSchema,
  jsonRpcRequestSchema,
  listServicesParamsSchema,
  parametersParamsSchema,
  parentParamsSchema,
  serviceDataParamsSchema,
  servicePreimageParamsSchema,
  serviceRequestParamsSchema,
  serviceValueParamsSchema,
  stateRootParamsSchema,
  statisticsParamsSchema,
  submitPreimageParamsSchema,
  submitWorkPackageParamsSchema,
} from './schemas'
import { SubscriptionManager } from './subscription-manager'

// Initialize services
export const subscriptionManager = new SubscriptionManager()
export const rpcHandler = new RpcHandler(subscriptionManager)

/**
 * Serialize BigInt values to numbers for JSON response
 */
function serializeBigInts(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj
  }
  if (typeof obj === 'bigint') {
    return Number(obj)
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInts)
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInts(value)
    }
    return result
  }
  return obj
}

/**
 * Create JSON-RPC error response
 */
function createErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): Response {
  return Response.json(
    {
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code,
        message,
        ...(data !== undefined && { data }),
      },
    },
    { status: 200 }, // JSON-RPC errors still return 200
  )
}

/**
 * Create JSON-RPC success response
 */
function createSuccessResponse(
  id: string | number | null,
  result: unknown,
): Response {
  return Response.json({
    jsonrpc: '2.0',
    id: id ?? null,
    result: serializeBigInts(result),
  })
}

/**
 * Handle CORS preflight requests
 */
function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin':
          config.corsOrigin === '*' ? '*' : config.corsOrigin,
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      },
    })
  }
  return null
}

/**
 * Add CORS headers to response
 */
function addCorsHeaders(response: Response): Response {
  // Create new response with CORS headers
  const headers = new Headers(response.headers)
  headers.set(
    'Access-Control-Allow-Origin',
    config.corsOrigin === '*' ? '*' : config.corsOrigin,
  )
  headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

/**
 * Handle JSON-RPC request
 */
async function handleRpcRequest(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as { id?: string | number | null }
    const parseResult = jsonRpcRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return createErrorResponse(
        body.id ?? null,
        -32600,
        'Invalid Request',
        parseResult.error.errors,
      )
    }

    const { id, method, params = [] } = parseResult.data

    // Validate method-specific parameters and handle methods
    let result: unknown
    try {
      switch (method) {
        case 'parameters': {
          parametersParamsSchema.parse(params)
          const paramsResult = await rpcHandler.parameters()
          // JIP-2 spec: wrap in V1
          result = { V1: serializeBigInts(paramsResult) }
          break
        }
        case 'bestBlock': {
          bestBlockParamsSchema.parse(params)
          result = serializeBigInts(await rpcHandler.bestBlock())
          break
        }
        case 'finalizedBlock': {
          finalizedBlockParamsSchema.parse(params)
          result = serializeBigInts(await rpcHandler.finalizedBlock())
          break
        }
        case 'parent': {
          const [blockHash] = parentParamsSchema.parse(params)
          result = serializeBigInts(await rpcHandler.parent(blockHash))
          break
        }
        case 'stateRoot': {
          const [blockHash] = stateRootParamsSchema.parse(params)
          result = await rpcHandler.stateRoot(blockHash)
          break
        }
        case 'statistics': {
          const [blockHash] = statisticsParamsSchema.parse(params)
          result = await rpcHandler.statistics(blockHash)
          break
        }
        case 'serviceData': {
          const [blockHash, serviceId] = serviceDataParamsSchema.parse(params)
          result = await rpcHandler.serviceData(blockHash, serviceId)
          break
        }
        case 'serviceValue': {
          const [blockHash, serviceId, key] =
            serviceValueParamsSchema.parse(params)
          result = await rpcHandler.serviceValue(blockHash, serviceId, key)
          break
        }
        case 'servicePreimage': {
          const [blockHash, serviceId, hash] =
            servicePreimageParamsSchema.parse(params)
          result = await rpcHandler.servicePreimage(blockHash, serviceId, hash)
          break
        }
        case 'serviceRequest': {
          const [blockHash, serviceId, hash, length] =
            serviceRequestParamsSchema.parse(params)
          result = await rpcHandler.serviceRequest(
            blockHash,
            serviceId,
            hash,
            length,
          )
          break
        }
        case 'beefyRoot': {
          const [blockHash] = beefyRootParamsSchema.parse(params)
          result = await rpcHandler.beefyRoot(blockHash)
          break
        }
        case 'listServices': {
          const [blockHash] = listServicesParamsSchema.parse(params)
          result = serializeBigInts(await rpcHandler.listServices(blockHash))
          break
        }
        case 'submitWorkPackage': {
          const [coreIndex, workPackage, extrinsics] =
            submitWorkPackageParamsSchema.parse(params)
          await rpcHandler.submitWorkPackage(coreIndex, workPackage, extrinsics)
          result = null
          break
        }
        case 'submitPreimage': {
          const [serviceId, preimage, blockHash] =
            submitPreimageParamsSchema.parse(params)
          await rpcHandler.submitPreimage(serviceId, preimage, blockHash)
          result = null
          break
        }
        default:
          return createErrorResponse(id, -32601, 'Method not found')
      }
    } catch (validationError: unknown) {
      // Handle Zod validation errors
      if (validationError instanceof z.ZodError) {
        return createErrorResponse(
          id,
          -32602,
          'Invalid params',
          validationError.errors,
        )
      }
      throw validationError
    }

    return createSuccessResponse(id, result)
  } catch (error) {
    logger.error('Error handling RPC request', error)
    return createErrorResponse(
      null,
      -32603,
      'Internal error',
      error instanceof Error ? error.message : String(error),
    )
  }
}

/**
 * Main fetch handler for Bun.serve()
 */
export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const pathname = url.pathname

  // Handle CORS
  const corsResponse = handleCors(req)
  if (corsResponse) {
    return corsResponse
  }

  // Health check endpoint
  if (pathname === '/health' && req.method === 'GET') {
    const response = Response.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
    return addCorsHeaders(response)
  }

  // JSON-RPC endpoint
  if (pathname === '/rpc' && req.method === 'POST') {
    const response = await handleRpcRequest(req)
    return addCorsHeaders(response)
  }

  // 404 for unknown routes
  return new Response('Not Found', { status: 404 })
}
