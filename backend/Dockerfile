FROM node:18-alpine

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar el código fuente restante
COPY . .

# Exponer el puerto del backend
EXPOSE 3000

# Comando de inicio del servidor
CMD ["npm", "start"]