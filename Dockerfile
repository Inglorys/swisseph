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
    curl \
    wget

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with npm install instead of npm ci
RUN npm install --omit=dev --omit=optional

# Download and build Swiss Ephemeris
RUN mkdir -p src ephe && \
    cd /tmp && \
    wget https://www.astro.com/ftp/swisseph/swe_unix_src_2.10.03.tar.gz && \
    tar -xzf swe_unix_src_2.10.03.tar.gz && \
    cd swe/src && \
    make libswe.so && \
    cp libswe.so /app/src/ && \
    cd /tmp && \
    wget https://www.astro.com/ftp/swisseph/ephe/sepl_18.se1 && \
    wget https://www.astro.com/ftp/swisseph/ephe/semo_18.se1 && \
    wget https://www.astro.com/ftp/swisseph/ephe/seas_18.se1 && \
    cp *.se1 /app/ephe/ && \
    rm -rf /tmp/*

# Copy source code
COPY . .

EXPOSE 3000

# Add healthcheck using curl
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:3000/health || exit 1

CMD ["npm", "start"]
