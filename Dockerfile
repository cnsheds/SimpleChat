FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY server/package.json server/package.json
COPY client-user/package.json client-user/package.json
COPY client-agent/package.json client-agent/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json server/package.json
COPY --from=deps /app/node_modules node_modules
COPY server server
COPY --from=build /app/client-user/dist server/public/user
COPY --from=build /app/client-agent/dist server/public/agent
WORKDIR /app/server
EXPOSE 3000
CMD ["node", "scripts/start.js"]
