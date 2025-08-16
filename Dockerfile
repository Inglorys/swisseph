FROM node:16-alpine

# Install system dependencies
RUN apk add --no-cache \
    build-base \
    python3 \
    make \
    gcc \
    g++ \
    libc-dev \
    linux-headers

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with specific flags
RUN npm ci --only=production --no-optional

# Copy source code
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
