FROM node:20-alpine AS base

# Install dependencies
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY apps/admin/package.json ./apps/admin/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/admin ./apps/admin

# Build Next.js app
WORKDIR /app/apps/admin
RUN pnpm build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install pnpm
RUN npm install -g pnpm

# Copy necessary files
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/admin/.next ./.next
COPY --from=base /app/apps/admin/package.json ./package.json

EXPOSE 3000

CMD ["pnpm", "start"]
