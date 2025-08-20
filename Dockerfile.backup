# Use Node.js 20 LTS (for compatibility with dependencies)
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files for production dependencies
COPY package*.json ./

# Install all dependencies (both prod and dev needed for runtime)
# Skip Puppeteer download - Railway will provide Chrome
RUN PUPPETEER_SKIP_DOWNLOAD=true npm ci --no-audit --no-fund

# Copy pre-built application
COPY dist ./dist
COPY server ./server
COPY shared ./shared
COPY migrations ./migrations

# Expose the port the app runs on (Railway provides PORT env var)
EXPOSE 5000

# Start the application
CMD ["npm", "start"]