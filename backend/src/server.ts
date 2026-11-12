/* eslint-disable antfu/no-top-level-await */
import { createServer } from 'node:http'
import process from 'node:process'
import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { closeDatabase } from './core/database.js'
import { colourLog } from './core/logger.js'

const app = await createApp()

const server = serve({
  fetch: app.fetch,
  port: 8080,
  createServer,
}, () => {
  colourLog('green', 'Server is running on http://localhost:8080')
})

function shutdown(signal: NodeJS.Signals) {
  colourLog('yellow', `Received ${signal}, starting graceful shutdown`)

  server.close((err) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    closeDatabase()
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
