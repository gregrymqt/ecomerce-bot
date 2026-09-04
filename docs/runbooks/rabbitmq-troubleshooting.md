# 🐇 Runbook: Diagnóstico e Troubleshooting de RabbitMQ & Filas

Este runbook orienta agentes de IA e engenheiros na inspeção e mitigação de gargalos nas filas do RabbitMQ 3.13 do **E-commerce Bot**, cobrindo o fluxo entre a API Core (.NET MassTransit) e o Worker Python (aio-pika).

---

## 🗺️ Topologia Canônica de Filas

| Fila | Produtor | Consumidor | Propósito | DLQ Associada |
|---|---|---|---|---|
| `queue:ecommerce` | `EcommerceBot.Core` | `EcommerceBot.Worker` (Scraper) | Extração e enriquecimento de produtos | `queue:ecommerce_error` |
| `queue:analytics_ml` | `EcommerceBot.Core` | `EcommerceBot.Worker` (ML) | Processamento de RFM, Churn e LTV | `analytics_ml_error` |
| `ecommerce_processed_queue` | `EcommerceBot.Worker` | `EcommerceBot.Core` (Consumer) | Persistência Dapper e notificação SSE | `ecommerce_processed_error` |
| `email_notifications` | `EcommerceBot.Core` | `EcommerceBot.Core` (Resend) | Disparos transacionais de e-mail | `email_notifications_error` |

---

## 🔍 1. Investigação via RabbitMQ Management HTTP API

O RabbitMQ expõe métricas HTTP locais em `http://localhost:15672/api/`:

### 1.1. Inspecionar Profundidade e Taxa das Filas
```bash
# Requisição GET para inspecionar filas críticas
curl -s -u guest:guest http://localhost:15672/api/queues/%2F/queue:ecommerce | jq '{name: .name, messages: .messages, messages_ready: .messages_ready, messages_unacknowledged: .messages_unacknowledged, consumers: .consumers}'
```

### 1.2. Sintomas e Diagnósticos:
1. **`messages_ready` acumulando e `consumers == 0`:**
   - **Causa:** O microsserviço `EcommerceBot.Worker` está fora do ar ou o container reiniciou em crashloop.
   - **Ação:** Verificar logs do Worker via `docker logs ecommercebot-worker` ou terminal local.
2. **`messages_unacknowledged` alto e travado:**
   - **Causa:** O Worker recebeu a mensagem, mas o processo síncrono (ex: Scrapling anti-bot ou modelo ML pesado) está sofrendo timeout ou travou sem enviar ACK/NACK.
   - **Ação:** Inspecionar threads ativas do Python Worker.
3. **Mensagens caindo em filas `*_error` (DLQs):**
   - **Causa:** Exceção não tratada (ex: JSON payload corrompido, URL bloqueada por SSRF, payload sem `TenantId`).
   - **Ação:** Inspecionar o payload no topo da DLQ sem descartá-lo (`requeue=false`).

---

## 🛠️ 2. Procedimento de Recuperação de Dead Letters (DLQ Replay)

Caso uma falha de rede temporária tenha enviado mensagens válidas para a DLQ, realize o reenvio controlado após restabelecer o serviço:

```bash
# Inspecionar primeira mensagem da DLQ (modo seguro: requeue=true para não perder a mensagem)
curl -s -u guest:guest -X POST http://localhost:15672/api/queues/%2F/queue:ecommerce_error/get \
  -H "Content-Type: application/json" \
  -d '{"count":1,"requeue":true,"encoding":"auto"}' | jq .
```

---

## 🛡️ 3. Regras Invioláveis do RabbitMQ
1. **Raw JSON Serializer:** Todo payload trafega como JSON bruto (`cfg.UseRawJsonSerializer()` no .NET) para interoperabilidade limpa com o `aio-pika`.
2. **Idempotência no Consumidor:** Consumidores devem consultar a chave Redis (`SET NX`) antes de reprocessar eventos para evitar duplicidade de escrita.
