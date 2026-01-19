/**
 * JAM RPC Server
 *
 * HTTP JSON-RPC server implementing JIP-2 specification.
 * Uses @pbnjam/node services directly via ServiceContext.
 *
 * JIP-2 Reference: https://hackmd.io/@polkadot/jip2
 *
 * Ports:
 * - HTTP RPC: configured via PORT env (default 3000)
 * - WebSocket: port 19800 (as per JIP-2 spec)
 */

import { logger } from '@pbnjam/core'
import { MainService } from '@pbnjam/node'
import { config } from './config'
import { handleRequest } from './routes'
import { setMainService } from './rpc-handler'
import { setupWebSocketForBun } from './ws-routes'

// Initialize logger first before any logging
logger.init()

// Global main service - initialized asynchronously
let mainService: MainService | null = null
let servicesInitialized = false
let server: ReturnType<typeof Bun.serve> | null = null

/**
 * Initialize and start the JAM node services using MainService
 */
async function initializeNodeServices(): Promise<MainService> {
  logger.info('Initializing JAM node services...')

  // Parse command-line arguments or use environment variables
  const chainSpecPath = process.env['CHAIN_SPEC_PATH']
  const genesisJsonPath = process.env['GENESIS_JSON_PATH']
  const validatorIndex = process.env['VALIDATOR_INDEX']
    ? Number.parseInt(process.env['VALIDATOR_INDEX'], 10)
    : undefined
  const nodeId = process.env['NODE_ID'] || 'rpc-server'

  // Create MainService instance
  const service = new MainService({
    genesis: {
      ...(chainSpecPath && { chainSpecPath }),
      ...(genesisJsonPath && { genesisJsonPath }),
    },
    networking: {
      nodeType: 'validator',
      isBuilder: false,
    },
    nodeId,
    ...(validatorIndex !== undefined && { validatorIndex }),
  })

  // Initialize and start the service
  const [initError] = await service.init()
  if (initError) {
    throw new Error(`Failed to initialize main service: ${initError.message}`)
  }

  const [startError] = await service.start()
  if (startError) {
    throw new Error(`Failed to start main service: ${startError.message}`)
  }

  // Set global main service for RPC handler
  setMainService(service)

  logger.info('Node services initialized successfully')
  servicesInitialized = true

  return service
}

// Start HTTP server at top level - Bun.serve() keeps the process alive
const port = config.port
const wsHandlers = setupWebSocketForBun()

server = Bun.serve({
  fetch: async (req, server) => {
    // Return 503 if services aren't initialized yet
    if (!servicesInitialized) {
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32000,
            message: 'Server initializing',
          },
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Handle WebSocket upgrade requests
    if (req.headers.get('upgrade') === 'websocket') {
      const url = new URL(req.url)
      if (url.pathname === '/ws') {
        if (wsHandlers.upgrade(req)) {
          // Upgrade the connection - Bun will handle the WebSocket
          if (server.upgrade(req, { data: {} })) {
            return // WebSocket upgrade handled
          }
        }
      }
    }
    // Regular HTTP requests
    return handleRequest(req)
  },
  websocket: wsHandlers.websocket,
  port,
  hostname: config.host,
})

console.log(`Server running at ${server.url}`)

logger.info(
  `JIP-2 RPC Server starting on http://${config.host}:${port} ${config.environment}`,
)
logger.info(`RPC Server is ready on port ${port}`)
logger.info(`Server URL: ${server.url}`)
logger.info(
  `WebSocket subscriptions available at ws://${config.host}:${port}/ws`,
)
logger.info(`Server listening on http://${config.host}:${port}`)

// Initialize services in the background
initializeNodeServices()
  .then((service) => {
    mainService = service
    logger.info('Node services initialized successfully')
  })
  .catch((error) => {
    logger.error(`Failed to initialize node services: ${error}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    // Don't exit - let the server keep running
  })

// Graceful shutdown handler
async function shutdown(): Promise<void> {
  logger.info('Shutting down gracefully...')
  if (mainService) {
    try {
      await mainService.stop()
      logger.info('Services stopped')
    } catch (error) {
      logger.error(`Error stopping services: ${error}`)
    }
  }
  if (server) {
    await server.stop()
  }
  process.exit(0)
}

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...')
  shutdown()
})

process.on('SIGINT', () => {
  logger.info('SIGINT received')
  shutdown()
})
