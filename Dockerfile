FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install --global bun@1.4.3
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
# Render supplies public URLs as build args; database/relay secrets stay runtime-only.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_COLLAB_URL
RUN bun run build && node scripts/prepare-server.mjs

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production WHITEBOARD_STANDALONE=1 WEB_HOST=0.0.0.0 PORT=3000 COLLAB_DATA_DIR=/tmp/knotleaf-rooms
WORKDIR /app
COPY --from=build --chown=node:node /app/server-dist ./
USER node
EXPOSE 3000
CMD ["node", "server/web.mjs"]
