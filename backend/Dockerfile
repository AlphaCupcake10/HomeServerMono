FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
# Defaults baked in; docker-compose.yml bind-mounts ./config over this so edits need no rebuild.
COPY config ./config
EXPOSE 3000
CMD ["node", "dist/index.js"]
