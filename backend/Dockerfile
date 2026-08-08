# Build context is the REPO ROOT (this is a Bun workspace — bun.lock and the
# sibling package.jsons live there). Build with:
#   docker build -f backend/Dockerfile .
FROM oven/bun:1.3-slim AS deps
WORKDIR /app
# Copy only manifests first so `bun install` is cached until a dependency
# actually changes, not on every source edit.
COPY package.json bun.lock* ./
COPY backend/package.json    backend/
COPY fronend/package.json    fronend/
RUN bun install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY backend/ backend/
# Prisma 7 generates the client into src/generated (gitignored), so it has to
# happen in the image. `generate` reads the schema only — no DB connection.
WORKDIR /app/backend
RUN bunx --bun prisma generate

FROM oven/bun:1.3-slim AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production
# Elysia serves on PORT; compose maps it, nothing is published to the host.
ENV PORT=3000

COPY --from=build /app/node_modules         /app/node_modules
COPY --from=build /app/backend/node_modules /app/backend/node_modules
COPY --from=build /app/backend              /app/backend

# Drop privileges. The bun image ships a `bun` user (uid 1000).
USER bun

EXPOSE 3000
# Matches the real readiness endpoint, so compose only marks this healthy once
# the DB adapter is actually connected.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD bun -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "run", "src/index.ts"]
