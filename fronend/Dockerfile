# Build context is the REPO ROOT. Build with:
#   docker build -f fronend/Dockerfile .
FROM oven/bun:1.3-slim AS deps
WORKDIR /app
COPY package.json bun.lock* ./
COPY backend/package.json    backend/
COPY fronend/package.json    fronend/
COPY storage/package.json    storage/
RUN bun install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY fronend/ fronend/

# NEXT_PUBLIC_* is inlined into the client bundle at BUILD time — it cannot be
# supplied at runtime. That makes this image environment-specific: a staging
# and a production image are genuinely different artifacts, which is why the
# deploy workflow passes these as build args rather than compose env vars.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_STORAGE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_STORAGE_URL=$NEXT_PUBLIC_STORAGE_URL
# Server-side only (proxy target) — read at runtime, but next.config.ts also
# reads it while building, so give it the in-network value here too.
ARG BACKEND_URL=http://backend:3000
ENV BACKEND_URL=$BACKEND_URL
ENV NODE_ENV=production

WORKDIR /app/fronend
RUN bun run build

FROM oven/bun:1.3-slim AS runtime
WORKDIR /app/fronend
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# `output: "standalone"` traces the server's real dependency set. Because
# outputFileTracingRoot is the repo root, the emitted tree mirrors the
# workspace: standalone/fronend/server.js plus standalone/node_modules.
COPY --chown=bun:bun --from=build /app/fronend/.next/standalone ./../
COPY --chown=bun:bun --from=build /app/fronend/.next/static     ./.next/static
COPY --chown=bun:bun --from=build /app/fronend/public           ./public

RUN mkdir -p .next/cache && chown -R bun:bun .next

USER bun

EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD bun -e "fetch('http://127.0.0.1:3001/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# server.js is what standalone emits — `next start` is not available here.
CMD ["bun", "run", "server.js"]
