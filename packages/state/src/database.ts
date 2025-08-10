/**
 * Database connection and management
 */

import type { DatabaseConfig } from '@pbnj/types'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * Database manager for JAM node state using Drizzle ORM
 */
export class DatabaseManager {
  private client: postgres.Sql
  private db: ReturnType<typeof drizzle>

  constructor(config: DatabaseConfig) {
    this.client = postgres(config.url, {
      max: config.poolSize || 10,
      idle_timeout: 20,
      connect_timeout: config.timeout || 10,
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
