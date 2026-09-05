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

### Padrão Canônico de Templates de E-mail
- **C# Core API:** Proibido HTML inline. Todo e-mail utiliza views Razor `.cshtml` em `EcommerceBot.Core/src/EcommerceBot.Api/Views/Emails` associadas a ViewModels tipadas em `EcommerceBot.Core/src/EcommerceBot.Application/ViewModels/Emails` renderizadas via `IRazorTemplateRenderer`.
- **Python Worker:** Proibido HTML inline. Relatórios e notificações HTML utilizam templates `.html` em `EcommerceBot.Worker/app/templates` renderizados via Jinja2 com autoescape ativado (`render_jinja_template`).

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

### Arquitetura de Observabilidade & Logs (Serilog)
A API Core adota arquitetura desacoplada via `SerilogConfigurationExtensions`:
- **Console Rico:** Formatação colorida com timestamp, nível e contexto para debug imediato no terminal.
- **Arquivo Rotativo Geral (`logs/app-.log`):** Nível `Information+` para rastreamento contínuo de execução.
- **Arquivo Rotativo de Erros (`logs/errors-.json`):** Formato `CompactJsonFormatter` filtrado para `Warning+` com acesso multi-processo compartilhado (`shared: true`), lido nativamente pelo MCP.
- **Request Logging:** Middleware `app.UseCustomRequestLogging()` interceptando requisições com latência, status code e TenantId.

---

## 🛡️ 4. Regras de Segurança SaaS Invioláveis

1. **Fail-Closed em Segredos:** Proibido o uso de `?? "default_secret"` para chaves JWT ou criptográficas. Disparo imediato de `InvalidOperationException`.
2. **Prevenção de SSRF:** O scraper bloqueia esquemas não-HTTP e endereços IP de loopback (`127.0.0.1`, `localhost`), redes privadas RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) e metadados de nuvem (`169.254.169.254`).
3. **Validação de HMAC em Tempo Constante:** Prevenção de timing attacks via `CryptographicOperations.FixedTimeEquals`.
4. **Zero Acesso a Banco no Python Worker:** O microsserviço Python comunica-se exclusivamente através do RabbitMQ e Redis.
5. **Zero HTML Inline em E-mails:** Proibido hardcoding de HTML em C# ou Python. C# utiliza views Razor (`.cshtml` em `EcommerceBot.Api/Views/Emails` com ViewModels em `EcommerceBot.Application/ViewModels/Emails`) e Python utiliza Jinja2 com autoescape (`.html` em `EcommerceBot.Worker/app/templates`).
6. **Clean Program.cs Pattern:** Proibido lógica de serviço ou configuração inline no `Program.cs`. Todo setup de DI, middlewares e observabilidade deve ser encapsulado em métodos de extensão dedicados (`*Extensions.cs`).
