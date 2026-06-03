FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
COPY modules/tenders/frontend/package.json modules/tenders/frontend/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm install --workspace apps/web

COPY apps/web apps/web
COPY modules/tenders/frontend modules/tenders/frontend
COPY packages/shared-types packages/shared-types

WORKDIR /app/apps/web
EXPOSE 5173
CMD ["npm", "run", "dev"]
