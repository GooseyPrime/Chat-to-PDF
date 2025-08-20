# Stage 1: Build
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
# Install all dependencies (including dev) for building  
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]