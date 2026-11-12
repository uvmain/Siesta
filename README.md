# siesta

siesta is a single-user REST API client. Collections can send requests directly from the browser or through siesta, which persists application data in SQLite.

## Stack

- Vue 3, Vite, Vue Router, and UnoCSS in `frontend`
- Hono and `better-sqlite3` in `backend`
- Caddy as the development and preview reverse proxy
- pnpm workspace management

## Prerequisites

- Node.js compatible with the locked dependencies
- pnpm 12.10.1

## Getting started

Install dependencies, configure the backend environment, then start the complete development stack:

```sh
pnpm install
cp .env.example backend/.env
pnpm dev
```

Open `http://siesta.localhost`. Caddy routes `/api/*` to the Hono server on port 8080 and all other requests to the Vite development server.

The backend reads `AUTH_USERNAME`, `AUTH_PASSWORD`, and `DB_PATH` from its environment or from `backend/.env`. Environment variables take precedence. The initial credentials default to `admin` / `password` if omitted. They are used only when the database has no user yet; after that, change the password from the app rather than by changing the environment. The default data directory is gitignored.

## Commands

```sh
pnpm dev                 # Run Caddy, the Hono watcher, and Vite
pnpm dev:backend         # Run only the backend on port 8080
pnpm dev:frontend        # Run only the Vite frontend
pnpm build               # Build both packages and bundle the frontend into the backend output
pnpm preview             # Build and run the production-style Caddy/backend stack
pnpm lint                # Lint the workspace
```

There is no automated test suite yet. To lint a changed file directly, use:

```sh
pnpm lint -- frontend/src/pages/index.vue
pnpm lint -- backend/src/core/handlers.ts
```

## Docker

From the repository root, build the production image. It compiles the frontend and serves it through the Hono backend:

```sh
docker build --tag siesta --file Dockerfile .
```

Run the image and publish its internal port 8080 to port 8080 on the host:

```sh
docker run --rm --publish 8080:8080 --env AUTH_USERNAME=admin --env AUTH_PASSWORD=choose-a-password --volume siesta-data:/app/data siesta
```

`--publish 8080:8080` is required to access the container from the host. With Docker Desktop WSL integration, open `http://localhost:8080` from Windows. The SQLite database persists in the `siesta-data` volume.

## API and persistence

All `/api` endpoints except health and sign-in require an HttpOnly, `SameSite=Lax` cookie session. siesta stores password hashes, sessions, collections, and named environments in SQLite. Environment values, including secrets, are resolved in `{{VARIABLE}}` placeholders by the server before it makes a request. Marking a variable secret masks it in the environment editor; it remains available to requests.

The initial REST-client API is:

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Create a cookie session |
| `POST` | `/api/auth/logout` | End the current session |
| `GET` | `/api/auth/session` | Read the signed-in session |
| `PUT` | `/api/auth/password` | Change the current password |
| `GET`, `POST` | `/api/collections` | List or create stored collections |
| `POST` | `/api/collections/import` | Import a Postman collection JSON export or Bruno `.bru` request |
| `PUT`, `DELETE` | `/api/collections/:id` | Update or delete a collection |
| `GET`, `POST` | `/api/environments` | List or create named environments |
| `PUT`, `DELETE` | `/api/environments/:id` | Update or delete an environment |
| `POST` | `/api/requests/send` | Make a server-side HTTP request |

The starter cache API remains available:

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/kv/:key` | Read a cache value |
| `GET` | `/api/kv` | List unexpired cache rows |
| `PUT` | `/api/kv` | Store a value (`key`, `value`, optional `ttl`) |
| `DELETE` | `/api/kv/:key` | Remove one value |
| `DELETE` | `/api/kv` | Clear the cache |
| `GET` | `/api/health` | Health check |

Rows are stored in SQLite with WAL enabled. Values expire after five minutes by default; pass an optional `ttl` in milliseconds to change that duration.

## Request composition

Requests support Basic and Bearer authentication helpers, raw request bodies, and multipart form-data. File inputs are sent directly in browser mode or relayed through siesta in backend mode; saved requests retain their form fields but not the local file selection.

## Backups

Use **Backup all** to download collections and environments as a versioned JSON document. **Restore backup** merges collection copies into the workspace and updates environments with matching names.

## Browser verification

`.github/mcp.json` configures the Playwright MCP server for Copilot sessions. It starts through `npx` when enabled by Copilot and can be used to inspect and verify the running application in a browser.
