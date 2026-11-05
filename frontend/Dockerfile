# frontend/Dockerfile
# Etapa 1: compilar el frontend
FROM node:24-slim AS compilar
WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .
# La dirección de la API queda "/api": el mismo servidor web la manda al backend
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Etapa 2: servirlo con nginx
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=compilar /app/dist /usr/share/nginx/html
EXPOSE 80
