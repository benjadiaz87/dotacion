FROM node:22-slim

# Chromium del sistema para puppeteer (evita descargar el bundle)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium fonts-liberation ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm i -D tsx typescript @types/node
COPY . .

EXPOSE 3001
CMD ["npx", "tsx", "index.ts"]
