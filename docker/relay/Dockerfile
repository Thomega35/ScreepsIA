FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY docker/relay/package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY scripts/relay.mjs ./
USER node
CMD ["node", "relay.mjs"]
