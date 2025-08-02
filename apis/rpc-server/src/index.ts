import { createServer } from 'node:http'
import { logger } from '@pbnj/core'
import cors from 'cors'
import express from 'express'
import { WebSocketServer } from 'ws'
import { config } from './config'
import { RpcHandler } from './rpc-handler'
import { SubscriptionManager } from './subscription-manager'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

logger.init()

// Middleware
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  }),
)
app.use(express.json({ limit: config.maxPayloadSize }))

// Initialize services
const subscriptionManager = new SubscriptionManager()
const rpcHandler = new RpcHandler(subscriptionManager)

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// JSON-RPC endpoint
app.post('/rpc', async (req, res) => {
  try {
    const { jsonrpc, id, method, params } = req.body

    if (jsonrpc !== '2.0') {
      return res.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32600, message: 'Invalid Request' },
      })
    }

    const result = await rpcHandler.handleMethod(method, params)

    res.json({
      jsonrpc: '2.0',
      id,
      result,
    })
  } catch (error) {
    logger.error('RPC error:', error)
    res.json({
      jsonrpc: '2.0',
      id: req.body.id,
      error: {
        code: -32603,
        message: 'Internal error',
        data: error instanceof Error ? error.message : String(error),
      },
    })
  }
})

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  logger.info('WebSocket connection established', {
    ip: req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  })

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString())
      const { jsonrpc, id, method, params } = message

      if (jsonrpc !== '2.0') {
        ws.send(
          JSON.stringify({
            jsonrpc: '2.0',
            id,
            error: { code: -32600, message: 'Invalid Request' },
          }),
        )
        return
      }

      const result = await rpcHandler.handleMethod(method, params, ws)

      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id,
          result,
        }),
      )
    } catch (error) {
      logger.error('WebSocket RPC error:', error)
      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 'error',
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : String(error),
          },
        }),
      )
    }
  })

  ws.on('close', () => {
    logger.info('WebSocket connection closed')
    subscriptionManager.removeSubscriptions(ws)
  })

  ws.on('error', (error) => {
    logger.error('WebSocket error:', error)
  })
})

// Start server
server.listen(config.port, config.host, () => {
  logger.info('JIP-2 RPC Server started', {
    host: config.host,
    port: config.port,
    environment: config.environment,
  })
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
})
