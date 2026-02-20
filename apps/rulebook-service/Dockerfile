FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/ packages/
COPY apps/ apps/
RUN npm ci && npm run build

FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages packages
COPY --from=builder /app/apps/rulebook-service apps/rulebook-service
WORKDIR /app/apps/rulebook-service
EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
