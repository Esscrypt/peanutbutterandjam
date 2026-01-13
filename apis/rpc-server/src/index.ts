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

import path from 'node:path'
import { serve } from '@hono/node-server'
import { logger } from '@pbnjam/core'
import {
  createCoreServices,
  type ServiceContext,
  startCoreServices,
  stopCoreServices,
} from '@pbnjam/node'
import { config } from './config'
import { app } from './routes'
import { setServiceContext } from './rpc-handler'
import { setupWebSocket } from './ws-routes'

/**
 * Initialize and start the JAM node services
 */
async function initializeNodeServices(): Promise<ServiceContext> {
  // Determine SRS file path
  const srsFilePath =
    process.env['SRS_FILE_PATH'] ||
    path.join(
      __dirname,
      '../../../../packages/bandersnatch-vrf/test-data/srs/zcash-srs-2-11-uncompressed.bin',
    )

  logger.info(`Initializing JAM node services... ${srsFilePath}`)

  // Create core services using the shared factory
  const services = await createCoreServices({
    configSize: (process.env['CONFIG_SIZE'] as 'tiny' | 'full') || 'tiny',
    srsFilePath,
    enableNetworking: false, // RPC server doesn't need full networking
    genesis: {
      chainSpecPath: process.env['CHAIN_SPEC_PATH'],
    },
    useWasm: process.env['USE_WASM'] === 'true',
    nodeId: process.env['NODE_ID'] || 'rpc-server',
  })

  // Start services
  await startCoreServices(services)

  // Set global service context for RPC handler
  setServiceContext(services)

  logger.info('Node services initialized successfully')

  return services
}

// Main server startup
async function main(): Promise<void> {
  let services: ServiceContext | null = null

  try {
    // Initialize node services first
    services = await initializeNodeServices()
  } catch (error) {
    logger.error(`Failed to initialize node services: ${error}`)
    process.exit(1)
  }

  // Setup WebSocket support on the app
  const { injectWebSocket } = setupWebSocket(app)

  // Start HTTP server with WebSocket support
  const port = config.port
  logger.info(
    `JIP-2 RPC Server starting on http://${config.host}:${port} ${config.environment}`,
  )

  const server = serve({
    fetch: app.fetch,
    port,
    hostname: config.host,
  })

  // Inject WebSocket handler into the server
  injectWebSocket(server)

  logger.info(`RPC Server is ready on port ${port}`)
  logger.info(
    `WebSocket subscriptions available at ws://${config.host}:${port}/ws`,
  )

  // Graceful shutdown
  async function shutdown(): Promise<void> {
    logger.info('Shutting down gracefully...')
    if (services) {
      try {
        await stopCoreServices(services)
        logger.info('Services stopped')
      } catch (error) {
        logger.error(`Error stopping services: ${error}`)
      }
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
}

main().catch((error) => {
  logger.error(`Fatal error starting RPC server: ${error}`)
  process.exit(1)
})
