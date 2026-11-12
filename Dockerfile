FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN chown -R node:node /app
USER node
EXPOSE 42069
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD wget -qO- http://127.0.0.1:42069/health >/dev/null || exit 1
CMD ["sh", "-c", "exec npx ponder start --schema ${DEPLOYMENT_ID:-v1} --port 42069"]
