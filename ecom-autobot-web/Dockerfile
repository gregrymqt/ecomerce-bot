# ========================================================
# Estágio 1: Build (Compilação do React + Vite)
# ========================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Argumento para injetar a URL da API FastAPI durante o build se necessário
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Copia os manifestos de dependência primeiro para otimização de cache
COPY package.json package-lock.json* ./

# Instala as dependências de forma limpa e rápida
RUN npm ci || npm install

# Copia o código-fonte do projeto
COPY . .

# Compila o projeto TypeScript + Vite gerando a pasta /app/dist
RUN npm run build

# ========================================================
# Estágio 2: Production Runtime (Nginx Ultraleve ~25MB)
# ========================================================
FROM nginx:alpine AS runner

# Copia a configuração otimizada para SPA (React Router DOM)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos estáticos compilados do estágio de build
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
