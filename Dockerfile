FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/frontend/package.json packages/frontend/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build:frontend
EXPOSE 3000 3001
CMD ["pnpm", "backend"]
