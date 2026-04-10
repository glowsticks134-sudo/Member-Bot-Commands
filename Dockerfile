FROM node:20-alpine

WORKDIR /app

COPY artifacts/api-server/dist ./artifacts/api-server/dist
COPY artifacts/data/.gitkeep ./artifacts/data/.gitkeep

ENV PORT=8080

EXPOSE 8080

CMD ["node", "artifacts/api-server/dist/index.mjs"]
