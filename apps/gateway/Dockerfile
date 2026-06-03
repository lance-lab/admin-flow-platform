FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/gateway/package.json apps/gateway/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm install --workspace apps/gateway

COPY apps/gateway apps/gateway
COPY packages/shared-types packages/shared-types

WORKDIR /app/apps/gateway
EXPOSE 3000
CMD ["npm", "run", "dev"]
