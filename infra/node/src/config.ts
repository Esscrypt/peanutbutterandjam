import { z } from '@pbnj/core'

const schema = z.object({
  DATABASE_URL: z.string().url(),
})

export const { DATABASE_URL } = schema.parse(process.env)
