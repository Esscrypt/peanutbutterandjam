import pino from 'pino'

/**
 * LoggerProvider is a class that provides logging functionality.
 * It is a wrapper around the pino logger.
 * It is a singleton class.
 * @description ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️ !IMPORTANT! Before using the logger, it must be initialized with this method at the top of the entry point file of a service.
 */
export class LoggerProvider {
  private pino = pino(
    {
      level: process.env['PINO_LEVEL'] || 'info',
    },
    pino.multistream([
      { level: 'error', stream: process.stderr },
      { level: 'fatal', stream: process.stderr },
      { level: 'debug', stream: process.stdout },
    ]),
  )
  private hasBeenInitialized = false

  get hasBeenInitializedValue() {
    return this.hasBeenInitialized
  }

  get level() {
    return process.env['PINO_LEVEL'] || 'info'
  }

  init() {
    //TODO: connect to Prometheus or other metrics service
    this.pino.info('LoggerProvider initialized')
    this.hasBeenInitialized = true
  }

  noInitLog(message: string) {
    this.pino.info(message)
  }

  info(message: string, ...args: unknown[]) {
    this._checkInit()
    this.pino.info(args, message)
  }

  debug(message: string, ...args: unknown[]) {
    this._checkInit()
    this.pino.debug(args, message)
  }

  warning(message: string, ...args: unknown[]) {
    this._checkInit()
    this.pino.warn(args, message)
  }

  error(message: string, error?: unknown, ..._args: unknown[]) {
    this._checkInit()
    const args = typeof Bun !== 'undefined' ? Bun.inspect(_args) : _args
    this.pino.error({ err: error, args }, message)
  }

  private _checkInit() {
    if (!this.hasBeenInitialized) {
      throw new Error('LoggerProvider has not been initialized')
    }
  }
}

export const logger = new LoggerProvider()
