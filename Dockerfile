FROM node:18-alpine

# Install dependencies for Swiss Ephemeris compilation
RUN apk add --no-cache \
    build-base \
    python3 \
    make \
    gcc \
    g++ \
    libc-dev \
    linux-headers \
    wget

WORKDIR /app

# Copy package.json first for better Docker layer caching
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --production

# Copy Swiss Ephemeris source
COPY . .

# Compile Swiss Ephemeris library
RUN cd src && make libswe.so

# Create ephemeris data directory and download files
RUN mkdir -p /app/ephe

# Download essential ephemeris files (1800-2400 CE)
RUN wget -q -P /app/ephe \
    https://www.astro.com/ftp/swisseph/ephe/sepl_18.se1 \
    https://www.astro.com/ftp/swisseph/ephe/semo_18.se1 \
    https://www.astro.com/ftp/swisseph/ephe/seas_18.se1 || \
    echo "Warning: Could not download some ephemeris files"

# Set proper permissions
RUN chmod -R 755 /app/ephe
RUN chmod +x /app/src/libswe.so

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
