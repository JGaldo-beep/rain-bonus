# Shared image for the FleetWeather monorepo (api + web run from the same build).
# Demo-oriented: installs the full workspace and runs via tsx / next dev.
FROM node:24-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

WORKDIR /app

# Install dependencies first (better layer caching).
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# Copy the rest of the source.
COPY . .

# Default command is overridden per service in docker-compose.yml.
CMD ["node", "--version"]
