FROM node:16-alpine

# Install system dependencies including curl
RUN apk add --no-cache \
    build-base \
    python3 \
    make \
    gcc \
    g++ \
    libc-dev \
    linux-headers \
    curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with npm install instead of npm ci
RUN npm install --omit=dev --omit=optional

# Copy source code
COPY . .

EXPOSE 3000

# Add healthcheck using curl
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
