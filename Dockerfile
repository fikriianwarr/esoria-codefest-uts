# syntax=docker/dockerfile:1
FROM node:24.22.1-bookworm-slim AS verify
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY app ./app
COPY scripts ./scripts
COPY tests ./tests
# Dipakai oleh tests/deploy-regression.test.mjs saat verifikasi di image Docker.
COPY compose.deploy.yaml ./compose.deploy.yaml
COPY compose.yaml ./compose.yaml
COPY .github/workflows/esoria-ci-cd.yml ./.github/workflows/esoria-ci-cd.yml
RUN npm run check && npm test

FROM node:24.22.1-bookworm-slim AS runtime
ARG RELEASE_SHA=local
LABEL org.opencontainers.image.title="ESORIA CodeFest UTS" \
      org.opencontainers.image.description="Container aplikasi kompetisi ESORIA untuk UTS" \
      org.opencontainers.image.revision="${RELEASE_SHA}"
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    RELEASE_SHA=${RELEASE_SHA}
WORKDIR /app
COPY --from=verify --chown=node:node /build/app ./app
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "app/server.mjs"]
