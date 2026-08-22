FROM node:24-bookworm-slim

WORKDIR /app

COPY deploy/render/package.json deploy/render/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY src/engine ./src/engine
COPY src/game ./src/game
COPY src/live ./src/live

ENV NODE_ENV=production
ENV GATEWAY_HOST=0.0.0.0

EXPOSE 10000

USER node

CMD ["node", "--experimental-strip-types", "src/live/dev-server.ts"]
