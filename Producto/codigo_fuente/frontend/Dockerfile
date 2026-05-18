# =============================================================================
# Camaras-IA · Frontend React (multi-stage)
# =============================================================================
# Etapa 1: build con Node — genera el bundle estático.
# Etapa 2: nginx alpine — sirve los archivos + reverse-proxy a backend.
# =============================================================================

# --------- BUILD ---------
FROM node:20-alpine AS build

WORKDIR /app

# Cache de deps
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

# Código + build
COPY frontend/ ./
RUN npm run build

# --------- RUNTIME ---------
FROM nginx:1.27-alpine

# Quitar config default
RUN rm /etc/nginx/conf.d/default.conf

# Nuestro nginx.conf con reverse proxy al backend
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Bundle estático del build
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
