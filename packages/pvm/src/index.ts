import pino from 'pino'

// Set up logging
const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
})

// Log startup
logger.info('PVM package initialized')

export { logger }
export * from './parser'
export * from './pvm'
export * from './types'
