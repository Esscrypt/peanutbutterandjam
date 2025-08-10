import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env['DB_HOST'] || 'localhost',
    port: Number.parseInt(process.env['DB_PORT'] || '5432'),
    database: process.env['DB_NAME'] || 'jam_node',
    user: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || 'password',
  },
  verbose: true,
  strict: true,
})
