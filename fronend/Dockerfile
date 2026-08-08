# Build context is the REPO ROOT. Build with:
#   docker build -f fronend/Dockerfile .
FROM oven/bun:1.3-slim AS deps
WORKDIR /app
COPY package.json bun.lock* ./
COPY backend/package.json    backend/
COPY fronend/package.json    fronend/
RUN bun install --frozen-lockfile

FROM deps AS build
WORKDIR /app
COPY fronend/ fronend/
# The frontend imports the backend's `App` TYPE for the Eden client
# (fronend/lib/eden.ts). It is erased at runtime and none of it reaches the
# browser bundle, but `next build` typechecks, so the sources have to be here
# to compile against — and that chain reaches Prisma's generated client, which
# is gitignored. Generating it is therefore part of building the FRONTEND.
COPY backend/ backend/
RUN cd backend && bunx --bun prisma generate

# NEXT_PUBLIC_* is inlined into the client bundle at BUILD time — it cannot be
# supplied at runtime. That makes this image environment-specific: a staging
# and a production image are genuinely different artifacts, which is why the
# deploy workflow passes these as build args rather than compose env vars.
#
# Every one of these must be declared here. Docker DISCARDS a --build-arg whose
# name no ARG matches, without a warning, so a missing line here doesn't fail
# the build — it ships an image with the value silently empty. That is exactly
# what happened to the Cloudinary cloud name: compose and deploy.yml both passed
# it, this file declared NEXT_PUBLIC_STORAGE_URL (dead since media moved to
# Cloudinary) instead, and next.config.ts built its remotePatterns allow-list
# around an empty string — which makes next/image reject every product photo in
# production while working perfectly in dev.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=$NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
# Server-side only (proxy target) — read at runtime, but next.config.ts also
# reads it while building, so give it the in-network value here too.
ARG BACKEND_URL=http://backend:3000
ENV BACKEND_URL=$BACKEND_URL
ENV NODE_ENV=production

WORKDIR /app/fronend
RUN bun run build

# The BUILD stage above runs on Bun; this one does not.
#
# Under Bun this process did not have a working set — it had a ramp. Memory
# climbed continuously under sustained read traffic and the kernel killed it at
# the cgroup limit roughly every 40-50 seconds: 9 restarts in a single 7-minute
# 100k-request run, each one a wall of 502s at the edge (nginx logged 290
# `upstream prematurely closed`). Raising mem_limit only lengthened the interval
# between kills, because nothing was ever released.
#
# Next 16's standalone server targets Node, and `node server.js` is what its
# own self-hosting guide documents. Keep it that way. If you are tempted back to
# Bun for the ~40 MB of image size, re-read scratchpad/sustain2.log first.
FROM node:22-slim AS runtime
WORKDIR /app/fronend
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# `output: "standalone"` traces the server's real dependency set. Because
# outputFileTracingRoot is the repo root, the emitted tree mirrors the
# workspace: standalone/fronend/server.js plus standalone/node_modules.
#
# node:22-slim ships a `node` user at uid 1000; the Bun images shipped `bun` at
# the same uid. The files land with the same ownership either way, but the name
# has to match the image or the COPY fails outright.
COPY --chown=node:node --from=build /app/fronend/.next/standalone ./../
COPY --chown=node:node --from=build /app/fronend/.next/static     ./.next/static
COPY --chown=node:node --from=build /app/fronend/public           ./public

RUN mkdir -p .next/cache && chown -R node:node .next

USER node

EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# server.js is what standalone emits — `next start` is not available here.
CMD ["node", "server.js"]
