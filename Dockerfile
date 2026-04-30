FROM node:20-alpine

# Build deps for better-sqlite3 native module
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies (cache-friendly: copy lockfiles first)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY scripts/package.json ./scripts/
COPY artifacts ./artifacts
COPY lib ./lib
RUN pnpm install --frozen-lockfile=false --prod=false

# Copy the rest of the source
COPY . .

# Persistent runtime data
RUN mkdir -p /app/artifacts/data

ENV PORT=3000
EXPOSE 3000

CMD ["pnpm", "start"]
