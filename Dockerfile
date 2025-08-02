# --- Builder Stage ---
    FROM node:22-alpine AS builder

    WORKDIR /usr/src/app
    
    # Copy package files and install dependencies
    COPY package*.json ./
    RUN npm install
    
    # Copy the rest of the application source code
    COPY . .
    
    # Build the application
    RUN npm run build
    
    # --- Production Stage ---
    FROM node:22-alpine
    
    WORKDIR /usr/src/app
    
    # Copy only necessary files from the builder stage
    COPY --from=builder /usr/src/app/dist ./dist
    COPY --from=builder /usr/src/app/node_modules ./node_modules
    COPY --from=builder /usr/src/app/package*.json ./
    
    # Expose the application port
    EXPOSE 3000
    
    # Command to run the application
    CMD ["node", "dist/main"]