# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable

WORKDIR /app

FROM base AS dependencies

RUN apt-get update \
  && apt-get install --yes --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY . .

RUN pnpm build

FROM build AS production-dependencies

RUN pnpm --filter dac-backend deploy --prod /opt/server

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV="production"

WORKDIR /app/backend

COPY --from=production-dependencies /opt/server/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist

VOLUME ["/app/data"]

EXPOSE 8080

CMD ["node", "dist/server.js"]
