# Long-running server with live WebSockets (Fly.io, Render, Railway or any container host).
# Set DATABASE_URL to a Postgres database; run several copies behind a load balancer if needed.
FROM node:24-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY . .
ENV HOST=0.0.0.0 PORT=8080 SECURE_COOKIE=1
EXPOSE 8080
CMD ["node", "server.mjs"]
