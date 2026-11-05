# backend/Dockerfile
FROM node:24-slim

WORKDIR /app
ENV NODE_ENV=production

# Primero solo los package*.json: así Docker reutiliza las dependencias si no cambiaron
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY . .
RUN mkdir -p /app/uploads

EXPOSE 3000

# 1) crea el primer administrador si la base está vacía  2) arranca el servidor
CMD ["sh", "-c", "node scripts/crear-admin-inicial.js && node index.js"]
