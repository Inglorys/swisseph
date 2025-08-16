# Modernāks Node + Alpine
FROM node:20-alpine

# Sistēmas atkarības
RUN apk add --no-cache \
  build-base python3 make gcc g++ libc-dev linux-headers \
  curl wget ca-certificates

WORKDIR /app

# Tikai package* lai ātrāk kešotu node_modules
COPY package*.json ./
RUN npm install --omit=dev --omit=optional

# ---- Swiss Ephemeris ----
# Parametrizē versiju un pamata URL
ARG SWE_VERSION=2.10.05
ARG SWE_BASE=https://www.astro.com/ftp/swisseph
ARG SWE_MIRROR=https://downloads.sourceforge.net/project/swisseph

# Kur meklēt .se1 failus
ENV SWEPATH=/app/ephe

# Build & ephemeris lejupielāde ar fallback un retry
RUN set -eux; \
    mkdir -p /app/src /app/ephe /tmp/swe && cd /tmp/swe && \
    (curl -fsSL --retry 5 "${SWE_BASE}/swe_unix_src_${SWE_VERSION}.tar.gz" -o swe.tar.gz \
     || curl -fsSL --retry 5 "${SWE_MIRROR}/swe_unix_src_${SWE_VERSION}.tar.gz" -o swe.tar.gz) && \
    tar -xzf swe.tar.gz && cd swe/src && make libswe.so && cp libswe.so /app/src/ && \
    cd /tmp && \
    (curl -fsSL --retry 5 "${SWE_BASE}/ephe/sepl_18.se1" -o sepl_18.se1 || curl -fsSL --retry 5 "${SWE_MIRROR}/ephe/sepl_18.se1" -o sepl_18.se1) && \
    (curl -fsSL --retry 5 "${SWE_BASE}/ephe/semo_18.se1" -o semo_18.se1 || curl -fsSL --retry 5 "${SWE_MIRROR}/ephe/semo_18.se1" -o semo_18.se1) && \
    (curl -fsSL --retry 5 "${SWE_BASE}/ephe/seas_18.se1" -o seas_18.se1 || curl -fsSL --retry 5 "${SWE_MIRROR}/ephe/seas_18.se1" -o seas_18.se1) && \
    cp *.se1 /app/ephe/ && rm -rf /tmp/*

# Pārējo kodu kopē beigās
COPY . .

EXPOSE 3000

# Healthcheck (pārliecinies, ka /health maršruts eksistē)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:3000/health || exit 1

CMD ["npm", "start"]
