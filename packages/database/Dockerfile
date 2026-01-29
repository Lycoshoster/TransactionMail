FROM node:20-alpine AS base

# Install dependencies
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/database ./packages/database
COPY packages/shared ./packages/shared

# Build shared
RUN pnpm --filter @transactionmail/shared build

# Generate Prisma client and run migrations
WORKDIR /app/packages/database
RUN npx prisma generate

CMD ["npx", "prisma", "migrate", "deploy"]
