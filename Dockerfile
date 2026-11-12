FROM node:22-alpine
WORKDIR /app
RUN chown node:node /app
USER node
ENV NODE_ENV=production
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY --chown=node:node . .
EXPOSE 42069
CMD ["sh", "-c", "exec npx ponder serve --schema ${DEPLOYMENT_ID:-v1} --port 42069"]
