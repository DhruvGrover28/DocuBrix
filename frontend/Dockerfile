# Multi-stage Dockerfile for React + Vite Frontend
FROM node:20-alpine AS builder

WORKDIR /app
COPY frontend/package*.json ./
RUN npm install

COPY frontend ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/dist ./dist

EXPOSE 8501
ENV PORT=8501

CMD ["sh", "-c", "serve -s dist -l ${PORT:-8501}"]
