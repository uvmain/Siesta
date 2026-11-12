import type { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { compress } from 'hono/compress'
import { getCookie } from 'hono/cookie'
import { hashSessionToken, SESSION_COOKIE_NAME } from './auth.js'
import { hasSession } from './database.js'
import * as handlers from './handlers.js'

export function useAuth(app: Hono) {
  app.use('/api/*', async (c, next) => {
    if (c.req.path === '/api/health' || c.req.path === '/api/auth/login') {
      await next()
      return
    }

    const token = getCookie(c, SESSION_COOKIE_NAME)
    if (!token || !hasSession(hashSessionToken(token))) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    await next()
  })
}

export function useCompression(app: Hono) {
  app.use(compress({ encoding: 'gzip', threshold: 4096 }))
}

export function createRoutes(app: Hono) {
  app.post('/api/auth/login', c => handlers.handleLoginRequest(c))
  app.post('/api/auth/logout', c => handlers.handleLogoutRequest(c))
  app.get('/api/auth/session', c => handlers.handleSessionRequest(c))
  app.put('/api/auth/password', c => handlers.handlePasswordChangeRequest(c))

  app.get('/api/collections', c => handlers.handleGetCollectionsRequest(c))
  app.post('/api/collections', c => handlers.handleCreateCollectionRequest(c))
  app.post('/api/collections/import', c => handlers.handleImportCollectionRequest(c))
  app.get('/api/collections/:id/export', c => handlers.handleExportCollectionRequest(c))
  app.get('/api/collections/:id/history', c => handlers.handleGetRequestHistoryRequest(c))
  app.post('/api/collections/:id/history', c => handlers.handleCreateRequestHistoryRequest(c))
  app.put('/api/collections/:id', c => handlers.handleUpdateCollectionRequest(c))
  app.delete('/api/collections/:id', c => handlers.handleDeleteCollectionRequest(c))

  app.get('/api/backups', c => handlers.handleCreateBackupRequest(c))
  app.post('/api/backups', c => handlers.handleRestoreBackupRequest(c))

  app.get('/api/environments', c => handlers.handleGetEnvironmentsRequest(c))
  app.post('/api/environments', c => handlers.handleCreateEnvironmentRequest(c))
  app.put('/api/environments/:id', c => handlers.handleUpdateEnvironmentRequest(c))
  app.delete('/api/environments/:id', c => handlers.handleDeleteEnvironmentRequest(c))

  app.post('/api/requests/send', c => handlers.handleSendRequest(c))

  // any other path, return the frontend index.html file
  app.get('*', serveStatic({ root: './dist/dist', index: 'index.html' }))
}
