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

# Install dependencies with npm install instead of npm ci
RUN npm install --omit=dev --omit=optional

# Copy source code
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
