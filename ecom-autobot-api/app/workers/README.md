# 📁 workers/

**Objetivo:** Classes independentes projetadas para rodar em *Background Tasks* processando lógicas longas de maneira assíncrona.

**O que colocar aqui:**
- `scraper_worker.py`: O consumidor nativo do RabbitMQ. Ele puxa as requisições (`ImportRequestMessage`), extrai o HTML da loja parceira, tenta isolar os JSON-LD do DOM e salva os status brutos no banco.
- `processor_worker.py`: Atua como um processo *Cron/Polling*. Varre o banco em busca de produtos pendentes, processa-os com Segurança (criptografia de chaves BYOK via Utils) e evoca os `services/` (Inteligência Artificial).
- `exporter_worker.py`: Um job engatilhado sob-demanda pela `api/` para gerar CSVs paginados.

**Regras:**
- Os workers devem sempre ser iniciados no ciclo de vida (Lifespan) da aplicação do FastAPI (no arquivo `main.py`).
- Eles precisam capturar erros profundamente para nunca derrubarem a *Task* do EventLoop do Python em falhas não-tratadas (evitar a "morte silenciosa").
