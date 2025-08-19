# Use Node.js 20 LTS (for compatibility with dependencies)
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
# Skip Puppeteer download - Railway will handle Chrome
# Configure npm to handle certificate issues in Docker
RUN npm config set strict-ssl false
RUN PUPPETEER_SKIP_DOWNLOAD=true npm ci --no-audit --no-fund

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev

 