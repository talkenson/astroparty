# Multi-stage build for AstroParty game
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/server/package*.json ./packages/server/
COPY packages/client-display/package*.json ./packages/client-display/
COPY packages/client-controller/package*.json ./packages/client-controller/

# Install dependencies
RUN npm install

# Copy source code
COPY packages/ ./packages/
COPY tsconfig*.json ./

# Build all packages
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built files and production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package*.json ./packages/shared/
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/public ./packages/server/public
COPY --from=builder /app/packages/server/package*.json ./packages/server/
COPY --from=builder /app/packages/client-display/dist ./packages/client-display/dist
COPY --from=builder /app/packages/client-controller/dist ./packages/client-controller/dist

# Install only production dependencies
RUN npm install --omit=dev

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV ROUND_DURATION=150000

# Start server
CMD ["node", "packages/server/dist/server.js"]
