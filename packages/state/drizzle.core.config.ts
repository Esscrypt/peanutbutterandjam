import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/core-schema.ts',
  dialect: 'postgresql',
  out: './src/core-migrations',
  dbCredentials: {
    url: process.env['DATABASE_URL']!,
  },
})
