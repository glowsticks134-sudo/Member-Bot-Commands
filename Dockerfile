FROM node:20-alpine

# Native build tools for better-sqlite3
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Use a minimal standalone package.json — avoids the complex pnpm workspace
COPY docker-package.json ./package.json
RUN npm install --ignore-scripts
RUN npm rebuild better-sqlite3

# Copy source code
COPY src ./src
COPY tsconfig.bot.json ./tsconfig.json

# Runtime data directory
RUN mkdir -p /app/artifacts/data

ENV NODE_ENV=production

# Railway injects PORT automatically based on this EXPOSE value
EXPOSE 3000

CMD ["node_modules/.bin/tsx", "src/index.ts"]
