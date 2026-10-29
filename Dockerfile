# Build the site, then run the API + static server with only production dependencies.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production DATABASE_PATH=/data/vp.db PORT=8080
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json tsconfig.server.json ./
COPY server ./server
COPY src/lib/types.ts ./src/lib/types.ts
EXPOSE 8080
CMD ["node_modules/.bin/tsx", "server/index.ts"]
