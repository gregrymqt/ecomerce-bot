# ========================================================
# Estágio 1: Build (Compilação de dependências)
# ========================================================
FROM python:3.12-slim AS builder

WORKDIR /build

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Instala ferramentas essenciais para compilação de pacotes C se necessário
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Criação e isolamento do Virtual Environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Cache de camadas eficiente: Copia apenas os arquivos de dependência primeiro
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ========================================================
# Estágio 2: Runtime (Imagem final limpa e segura)
# ========================================================
FROM python:3.12-slim AS runner

WORKDIR /app

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ENVIRONMENT=production

# Copia o ambiente virtual do estágio de build
COPY --from=builder /opt/venv /opt/venv

# Copia o código-fonte da aplicação
COPY . /app

# Criação de um usuário do sistema seguro (Não-Root)
RUN useradd --uid 10001 --user-group --shell /bin/false appuser && \
    chown -R appuser:appuser /app

# Transfere o contexto de execução para o usuário restrito
USER appuser

EXPOSE 8000

# Inicializa o Uvicorn ajustando workers para paralelismo baseado no hardware
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]