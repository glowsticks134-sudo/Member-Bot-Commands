FROM node:20-alpine

# Build deps for better-sqlite3 native module
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Install pnpm via npm (simpler and more reliable than corepack)
RUN npm install -g pnpm tsx

# Install dependencies (cache-friendly: copy lockfiles first)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY scripts/package.json ./scripts/
COPY artifacts/dashboard/package.json ./artifacts/dashboard/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY lib ./lib
RUN pnpm install --frozen-lockfile=false

# Copy source
COPY src ./src
COPY tsconfig*.json ./

# Persistent runtime data
RUN mkdir -p /app/artifacts/data

ENV PORT=3000
EXPOSE 3000

# Run directly with tsx — no pnpm wrapper needed at runtime
CMD ["tsx", "src/index.ts"]
