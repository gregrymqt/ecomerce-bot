# 📡 Módulo 4: Infraestrutura, Mensageria, Observabilidade & Segurança

Este módulo detalha a espinha dorsal de infraestrutura do sistema, as regras de mensageria com **MassTransit & RabbitMQ**, a camada de cache e eventos com **Redis**, os servidores **MCP** e as políticas de segurança corporativa.

---

## 🐇 1. Mensageria MassTransit & RabbitMQ

Para garantir interoperabilidade entre o Core C# (.NET 8/9) e o Worker Python (FastAPI / aio-pika), a serialização é configurada com **Raw JSON**:
```csharp
cfg.UseRawJsonSerializer();
```

### Topologia de Filas
| Fila | Finalidade | Produtor | Consumidor |
|---|---|---|---|
| `queue:ecommerce` | Ingestão de URLs para scraping e enriquecimento por IA | `EcommerceBot.Core` | `ScraperWorker` (Python) |
| `queue:demo_ecommerce` | Demonstração interativa e testes rápidos | `EcommerceBot.Web` / Core | `ScraperWorker` (Python) |
| `ecommerce_processed_queue` | Retorno de produtos enriquecidos | `ScraperWorker` (Python) | `ProcessedProductConsumer` (C#) |
| `queue:analytics_ml` | Transações para inferência de RFM/Churn | `EcommerceBot.Core` | `MLWorker` (Python) |
| `email_notifications` | Notificações e e-mails transacionais (Resend) | `EcommerceBot.Core` | `EmailNotificationConsumer` (C#) |
| `shopify_bulk_sync` | Sincronização em lote de catálogo Shopify | `EcommerceBot.Core` | `ShopifyBulkSyncConsumer` (C#) |
| `nuvemshop_bulk_sync` | Sincronização em lote de catálogo Nuvemshop | `EcommerceBot.Core` | `NuvemshopBulkSyncConsumer` (C#) |

---

## ⚡ 2. Redis: Cache, Idempotência, Rate Limit & SSE

1. **Idempotência de Webhooks:**
   Evita processamento concorrente ou repetido de webhooks:
   ```csharp
   await _redis.StringSetAsync($"webhook:idempotency:{id}", "processed", TimeSpan.FromHours(24), When.NotExists);
   ```
2. **Streaming em Tempo Real (SSE):**
   O canal `demo_stream_{correlationId}` recebe eventos de progresso publicados pelo Worker e republicados pelo Core como `text/event-stream`.
3. **Rate Limiting por Tenant:**
   Contadores de janela deslizante no Redis limitam requisições de scraping e chamadas de inferência para evitar abuso e proteger as cotas dos planos.

---

## 🩺 3. Model Context Protocol (MCP) — Servidor de Diagnósticos

- **Projeto:** `EcommerceBot.Diagnostics.Mcp` (.NET 9 Console)
- **Transporte:** Standard Input / Output (`stdio`)
- **Regras Fail-Closed:** Somente leitura (`WITH (NOLOCK)` em DMVs), sanitização estrita de segredos (chaves de API e senhas mascaradas).

### Ferramentas Nativas Registradas
1. `check_sql_health`: CPU, consultas lentas e locks no SQL Server.
2. `check_redis_metrics`: Consumo de memória, conexões clientes e taxa de hit/miss.
3. `inspect_rabbitmq_queues`: Profundidade de mensagens acumuladas, contagem de consumidores ativos.
4. `get_recent_application_errors`: Leitura dos últimos erros estruturados em `logs/errors-*.json` sem travar a API.

---

## 🛡️ 4. Regras de Segurança SaaS Invioláveis

1. **Fail-Closed em Segredos:** Proibido o uso de `?? "default_secret"` para chaves JWT ou criptográficas. Disparo imediato de `InvalidOperationException`.
2. **Prevenção de SSRF:** O scraper bloqueia esquemas não-HTTP e endereços IP de loopback (`127.0.0.1`, `localhost`), redes privadas RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) e metadados de nuvem (`169.254.169.254`).
3. **Validação de HMAC em Tempo Constante:** Prevenção de timing attacks via `CryptographicOperations.FixedTimeEquals`.
4. **Zero Acesso a Banco no Python Worker:** O microsserviço Python comunica-se exclusivamente através do RabbitMQ e Redis.
