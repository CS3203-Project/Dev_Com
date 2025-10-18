# --- Builder Stage ---
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production=false && npm cache clean --force

# Copy the rest of the application source code
COPY . .

# Build the application
RUN npm run build

# --- Production Stage ---
FROM node:22-alpine AS production

# Install dumb-init for proper signal handling and create non-root user
RUN apk add --no-cache dumb-init && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /usr/src/app

# Change ownership of working directory
RUN chown -R nestjs:nodejs /usr/src/app
USER nestjs

# Copy only necessary files from the builder stage
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /usr/src/app/package*.json ./

# Expose the application port (communication service uses 3001)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node --version || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
# Run the compiled NestJS entrypoint (generated at dist/main.js by nest build)
CMD ["node", "dist/main"]
