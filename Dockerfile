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

# Download and build Swiss Ephemeris with working URLs
RUN mkdir -p src ephe && \
    cd /tmp && \
    # Try multiple sources for the source code
    (wget https://www.astro.com/ftp/swisseph/swe_unix_src_2.10.03.tar.gz || \
     curl -L -o swe_unix_src_2.10.03.tar.gz https://github.com/aloistr/swisseph/archive/refs/heads/master.tar.gz) && \
    tar -xzf swe_unix_src_2.10.03.tar.gz && \
    # Handle different archive structures
    (cd swe/src || cd swisseph-master/src) && \
    make libswe.so && \
    cp libswe.so /app/src/ && \
    cd /tmp && \
    # Download ephemeris files with fallbacks
    (wget https://www.astro.com/ftp/swisseph/ephe/sepl_18.se1 || echo "sepl_18.se1 not available") && \
    (wget https://www.astro.com/ftp/swisseph/ephe/semo_18.se1 || echo "semo_18.se1 not available") && \
    (wget https://www.astro.com/ftp/swisseph/ephe/seas_18.se1 || echo "seas_18.se1 not available") && \
    # Copy any ephemeris files that were downloaded
    find . -name "*.se1" -exec cp {} /app/ephe/ \; 2>/dev/null || echo "No ephemeris files found" && \
    rm -rf /tmp/*

# Copy source code
COPY . .

EXPOSE 3000

# Add healthcheck using curl
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:3000/health || exit 1

CMD ["npm", "start"]
