# Build context is the REPO ROOT (changed from the storage dir so the build
# uses the workspace's bun.lock — installing without it was not reproducible).
#   docker build -f storage/Dockerfile .
FROM oven/bun:1.3-slim AS deps
WORKDIR /app
COPY package.json bun.lock* ./
COPY backend/package.json    backend/
COPY fronend/package.json    fronend/
COPY storage/package.json    storage/
RUN bun install --frozen-lockfile

FROM oven/bun:1.3-slim AS runtime
# ffmpeg/ffprobe are hard runtime deps — video poster + variant generation
# shells out to them (FFMPEG_PATH/FFPROBE_PATH).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/storage
ENV NODE_ENV=production
ENV PORT=3100
ENV HOST=0.0.0.0
# Bind-mounted volume in compose. Must be writable by the runtime user.
ENV STORAGE_ROOT=/data

COPY --from=deps /app/node_modules         /app/node_modules
COPY --from=deps /app/storage/node_modules /app/storage/node_modules
COPY storage/ /app/storage/

RUN mkdir -p /data && chown -R bun:bun /data
VOLUME ["/data"]
USER bun

EXPOSE 3100
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD bun -e "fetch('http://127.0.0.1:3100/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "run", "src/index.ts"]
