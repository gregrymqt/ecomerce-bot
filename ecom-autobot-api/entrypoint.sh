#!/bin/sh
set -e

echo "🔄 Aguardando e aplicando migrations do PostgreSQL via Alembic..."
alembic upgrade head

echo "🚀 Iniciando aplicação FastAPI / Worker..."
exec "$@"
