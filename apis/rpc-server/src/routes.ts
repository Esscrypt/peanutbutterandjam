import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { config } from './config'
import { RpcHandler } from './rpc-handler'
import {
  beefyRootSchema,
  bestBlockSchema,
  finalizedBlockSchema,
  listServicesSchema,
  parametersSchema,
  parentSchema,
  serviceDataSchema,
  servicePreimageSchema,
  serviceRequestSchema,
  serviceValueSchema,
  stateRootSchema,
  statisticsSchema,
  submitPreimageSchema,
  submitWorkPackageSchema,
} from './schemas'
import { SubscriptionManager } from './subscription-manager'

// Initialize services
const subscriptionManager = new SubscriptionManager()
const rpcHandler = new RpcHandler(subscriptionManager)

// Create Hono app
const app = new Hono()

// Middleware
app.use('*', honoLogger())
app.use(
  '*',
  cors({
    origin: config.corsOrigin === '*' ? '*' : config.corsOrigin,
    credentials: true,
  }),
)

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Chain information methods
app.post('/rpc/parameters', zValidator('json', parametersSchema), async (c) => {
  const result = await rpcHandler.parameters()
  return c.json(result)
})

app.post('/rpc/bestBlock', zValidator('json', bestBlockSchema), async (c) => {
  const result = await rpcHandler.bestBlock()
  return c.json(result)
})

app.post(
  '/rpc/finalizedBlock',
  zValidator('json', finalizedBlockSchema),
  async (c) => {
    const result = await rpcHandler.finalizedBlock()
    return c.json(result)
  },
)

app.post('/rpc/parent', zValidator('json', parentSchema), async (c) => {
  const { blockHash } = c.req.valid('json')
  const result = await rpcHandler.parent(blockHash)
  return c.json(result)
})

app.post('/rpc/stateRoot', zValidator('json', stateRootSchema), async (c) => {
  const { blockHash } = c.req.valid('json')
  const result = await rpcHandler.stateRoot(blockHash)
  return c.json(result)
})

// Statistics methods
app.post('/rpc/statistics', zValidator('json', statisticsSchema), async (c) => {
  const { blockHash } = c.req.valid('json')
  const result = await rpcHandler.statistics(blockHash)
  return c.json(result)
})

// Service data methods
app.post(
  '/rpc/serviceData',
  zValidator('json', serviceDataSchema),
  async (c) => {
    const { blockHash, serviceId } = c.req.valid('json')
    const result = await rpcHandler.serviceData(blockHash, serviceId)
    return c.json(result)
  },
)

app.post(
  '/rpc/serviceValue',
  zValidator('json', serviceValueSchema),
  async (c) => {
    const { blockHash, serviceId, key } = c.req.valid('json')
    const result = await rpcHandler.serviceValue(blockHash, serviceId, key)
    return c.json(result)
  },
)

app.post(
  '/rpc/servicePreimage',
  zValidator('json', servicePreimageSchema),
  async (c) => {
    const { blockHash, serviceId, hash } = c.req.valid('json')
    const result = await rpcHandler.servicePreimage(blockHash, serviceId, hash)
    return c.json(result)
  },
)

app.post(
  '/rpc/serviceRequest',
  zValidator('json', serviceRequestSchema),
  async (c) => {
    const { blockHash, serviceId, hash, length } = c.req.valid('json')
    const result = await rpcHandler.serviceRequest(
      blockHash,
      serviceId,
      hash,
      length,
    )
    return c.json(result)
  },
)

// BEEFY methods
app.post('/rpc/beefyRoot', zValidator('json', beefyRootSchema), async (c) => {
  const { blockHash } = c.req.valid('json')
  const result = await rpcHandler.beefyRoot(blockHash)
  return c.json(result)
})

// Submission methods
app.post(
  '/rpc/submitWorkPackage',
  zValidator('json', submitWorkPackageSchema),
  async (c) => {
    const { coreIndex, workPackage, extrinsics } = c.req.valid('json')
    await rpcHandler.submitWorkPackage(coreIndex, workPackage, extrinsics)
    return c.json({ success: true })
  },
)

app.post(
  '/rpc/submitPreimage',
  zValidator('json', submitPreimageSchema),
  async (c) => {
    const { serviceId, preimage, blockHash } = c.req.valid('json')
    await rpcHandler.submitPreimage(serviceId, preimage, blockHash)
    return c.json({ success: true })
  },
)

// Service listing
app.post(
  '/rpc/listServices',
  zValidator('json', listServicesSchema),
  async (c) => {
    const { blockHash } = c.req.valid('json')
    const result = await rpcHandler.listServices(blockHash)
    return c.json(result)
  },
)

// WebSocket subscription endpoints (these will be handled separately)
// Note: Hono doesn't have built-in WebSocket support in the same way,
// so we'll need to handle WebSocket connections separately

export { app, subscriptionManager, rpcHandler }
export type AppType = typeof app
