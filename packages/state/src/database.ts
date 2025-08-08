/**
 * Database connection and management
 */

import { logger } from '@pbnj/core'
import type { DatabaseConfig } from '@pbnj/types'
import * as schema from './schema'

/**
 * Database manager for JAM node state using Drizzle ORM
 */
export class DatabaseManager {
  private client: postgres.Sql
  private db: ReturnType<typeof drizzle>
  private config: DatabaseConfig

  constructor(config: DatabaseConfig) {
    this.config = config
    this.client = postgres({
      host: config.host,
      port: config.port,
      database: config.database,
      username: config.username,
      password: config.password,
      ssl: config.ssl,
      max: config.maxConnections || 10,
      idle_timeout: 20,
      connect_timeout: 10
    })
    
    this.db = drizzle(this.client, { schema })
  }

  /**
   * Initialize database tables
   */
  async initialize(): Promise<void> {
    // Tables are created automatically by Drizzle migrations
    // This method can be used for any additional initialization
    console.log('Database initialized with Drizzle ORM')
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.client.end()
  }

  /**
   * Get the Drizzle database instance
   */
  getDatabase() {
    return this.db
  }

  /**
   * Get the underlying postgres client
   */
  getClient(): postgres.Sql {
    return this.client
  }
} 