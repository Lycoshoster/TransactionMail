FROM node:20-alpine AS base

# Install dependencies
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/database ./packages/database
COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker

# Build packages
RUN pnpm --filter @transactionmail/shared build
RUN pnpm --filter @transactionmail/database build
RUN pnpm --filter @transactionmail/worker build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install pnpm
RUN npm install -g pnpm

# Copy necessary files
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages ./packages
COPY --from=base /app/apps/worker ./apps/worker
COPY --from=base /app/package.json ./package.json

WORKDIR /app/apps/worker

CMD ["node", "dist/index.js"]
