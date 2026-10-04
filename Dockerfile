# Stage 1: build the Vue frontend
FROM node:24-alpine AS web
WORKDIR /src
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY web ./web
RUN pnpm build

# Stage 2: runtime (server + built frontend, production dependencies only)
FROM node:24-alpine
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production DATA_DIR=/data PORT=3000
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod && pnpm store prune
COPY server ./server
COPY --from=web /src/web/dist ./web/dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server/index.js"]
