import { Hono } from 'hono'
import { loadEnvironmentVariables } from './core/config.js'
import { initialiseDatabase } from './core/database.js'
import { loggerMiddleware } from './core/logger.js'
import { createRoutes, useAuth, useCompression } from './core/router.js'

export async function createApp(): Promise<Hono> {
  await loadEnvironmentVariables()

  const app = new Hono()
  loggerMiddleware(app)
  useAuth(app)
  await initialiseDatabase()
  createRoutes(app)
  useCompression(app)
  return app
}
