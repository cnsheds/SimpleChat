FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json server/package.json
COPY client-user/package.json client-user/package.json
COPY client-agent/package.json client-agent/package.json
RUN npm install

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json server/package.json
RUN npm install --omit=dev --workspace server
COPY server server
COPY --from=build /app/client-user/dist server/public/user
COPY --from=build /app/client-agent/dist server/public/agent
WORKDIR /app/server
EXPOSE 3000
CMD ["node", "scripts/start.js"]
