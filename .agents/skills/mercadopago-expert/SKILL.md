---
name: mercadopago-expert
description: "Guia canônico, arquitetura e especificações das features de checkout transparente (PIX, Cartão de Crédito), assinaturas SaaS (preapproval), recarga de créditos IA, webhooks criptográficos e conciliação do Mercado Pago."
---

# 💳 Mercado Pago SaaS Payments & Gateway — Guia Canônico & AI Toolkit

Este documento é a **Fonte Canônica da Verdade** sobre o fluxo de pagamentos, checkout transparente, assinaturas recorrentes, segurança de webhooks, conciliação e mensageria assíncrona do **Mercado Pago** no ecossistema **E-commerce Bot**.

---

## 🏛️ 1. Visão Geral & Arquitetura Multi-Tenant

O Mercado Pago é o provedor financeiro central da plataforma SaaS, responsável por:
1. **Assinaturas Recorrentes de Planos SaaS:** Cobrança mensal/anual dos planos Starter, Pro e Enterprise (`dbo.Plans` e `dbo.Subscriptions`).
2. **Recargas de Saldo Gerenciado de IA:** Compra de créditos de tokens OpenRouter para tenants (`AddManagedBalanceAsync` em `dbo.Tenants`).
3. **Checkout Transparente:** Pagamento direto via PIX (QR Code e Copia e Cola) ou Cartão de Crédito tokenizado via SDK oficial sem redirecionamento externo.

```text
  ┌──────────────────────────────────────────────────────────────┐
  │                 EcommerceBot.Web (React SPA)                 │
  │     • CreditCardPaymentTab (@mercadopago/sdk-react)          │
  │     • PixPaymentTab (Copia e Cola + QR Code Base64)          │
  │     • SSE Listener: events:tenant:{tenantId}                 │
  └──────────────────────────────┬───────────────────────────────┘
                                 │ HTTP POST /api/v1/checkout/*
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                EcommerceBot.Core (ASP.NET API)               │
  │     • CheckoutController -> CheckoutService                  │
  │     • MercadoPagoGateway -> https://api.mercadopago.com      │
  │     • Persistência Dapper: dbo.Orders & dbo.OrderItems       │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
     Notificação Webhook POST    │ (Webhook Assíncrono do MP)
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │              MercadoPagoWebhookController / Service          │
  │     • Validação HMAC SHA-256 (ts, v1, FixedTimeEquals)       │
  │     • Idempotência Redis 24h (SET NX)                        │
  │     • Despacho para RabbitMQ (payments_process_queue)        │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │         PaymentProcessingConsumer (MassTransit Worker)       │
  │     • Reconciliação na API do Mercado Pago                   │
  │     • Atualização do Pedido (dbo.Orders -> approved)         │
  │     • Ativação de Plano SaaS ou Saldo IA                     │
  │     • Disparo SSE no Redis: type = "payment_approved"        │
  │     • Fila de E-mail: email_notifications (Resend)           │
  │     • Telemetria: dbo.RobotActivities (PAYMENT_PROCESSOR)    │
  └──────────────────────────────────────────────────────────────┘
```

---

## 🔑 2. Credenciais, Configuração & Mocks Defensivos

### 2.1. Mapeamento de Opções Tipadas
A injeção de dependência resolve as configurações a partir do `MercadoPagoOptions`:
- `EcommerceBot.Infrastructure.Options.MercadoPagoOptions`
- Variáveis no `.env` da raiz:
  - `MERCADOPAGO_ACCESS_TOKEN`: Token de produção ou sandbox (`APP_USR-...`).
  - `MERCADOPAGO_PUBLIC_KEY`: Chave pública para o SDK frontend (`APP_USR-...`).
  - `MERCADOPAGO_WEBHOOK_SECRET`: Chave secreta compartilhada para validação de assinatura do webhook.

### 2.2. Mock Defensivo de Contingência (Desenvolvimento Local)
Para permitir testes locais de ponta a ponta sem internet ou sem credenciais ativas do Mercado Pago, o [`MercadoPagoGateway`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Core/src/EcommerceBot.Infrastructure/Gateways/MercadoPagoGateway.cs) detecta chaves de desenvolvimento (`APP_USR-seu-access-token` ou vazias):
- **PIX:** Retorna status `action_required`, `status_detail: "waiting_transfer"` com Copia e Cola válido e imagem Base64 simulada de 1x1 pixel.
- **Cartão:** Retorna status `processed`, `status_detail: "accredited"` com total pago.
- **Consultas (`GetOrderByIdAsync`, `GetPaymentByIdAsync`):** Retorna pedido simulado aprovado.

---

## 💳 3. Checkout Transparente: PIX & Cartão de Crédito

### 3.1. Pagamento via PIX
- **Endpoint:** `POST /api/v1/checkout/pix`
- **Controller:** [`CheckoutController.cs`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Core/src/EcommerceBot.Api/Controllers/CheckoutController.cs)
- **Serviço:** [`CheckoutService.cs`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Core/src/EcommerceBot.Infrastructure/Services/CheckoutService.cs)
- **Fluxo:**
  1. Cria `Order` no banco com status `pending` e gera `ExternalReference` único: `ord_{tenantId[..8]}_{timestamp}`.
  2. Constrói `MercadoPagoOrderRequest` com `transactions.payments`:
     ```json
     {
       "amount": "197.00",
       "payment_method": {
         "id": "pix",
         "type": "bank_transfer"
       },
       "expiration_time": "PT30M"
     }
     ```
  3. Dispara chamada HTTP para `POST https://api.mercadopago.com/v1/orders` com header `X-Idempotency-Key`.
  4. Extrai `qr_code` (string copia e cola) e `qr_code_base64`.
  5. Salva na entidade `dbo.Orders` com `PixExpirationDate = UtcNow.AddMinutes(30)`.
  6. Retorna `PixPaymentResponseDto` para o frontend renderizar imediatamente o modal com contador regressivo e botão de cópia.

### 3.2. Pagamento via Cartão de Crédito
- **Endpoint:** `POST /api/v1/checkout/card`
- **Tokenização no Frontend:**
  - O frontend usa `@mercadopago/sdk-react` via [`CreditCardPaymentTab.tsx`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Web/src/features/checkout/components/CreditCardPaymentTab.tsx).
  - Executa `createCardToken({ cardNumber, cardholderName, cardExpirationMonth, cardExpirationYear, securityCode, identificationType, identificationNumber })`.
  - O número bruto do cartão NUNCA toca o servidor backend (Conformidade estrita PCI-DSS).
  - Gera token efêmero (`card_token`) e detecta bandeira via BIN (`visa`, `master`, `amex`, `elo`, `hipercard`).
- **Processamento no Backend:**
  1. Cria `Order` com status `pending`.
  2. Dispara `POST /v1/orders` no Mercado Pago enviando o `token`, `installments` e dados do pagador.
  3. Atualiza os dígitos finais do cartão (`CardLastFourDigits`) e bandeira (`CardBrand`) em `dbo.Orders`.
  4. Se aprovado imediatamente, já marca status `approved` e dispara ativação de benefícios.

---

## 🔄 4. Assinaturas SaaS & Gestão de Créditos IA

No momento da aprovação do pagamento pelo webhook ou gateway:

1. **Assinatura Recorrente de Plano (`order.PlanId.HasValue`):**
   - Dispara [`ISubscriptionService.ActivateOrRenewSubscriptionAsync`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Core/src/EcommerceBot.Application/Interfaces/ISubscriptionService.cs).
   - Atualiza `dbo.Subscriptions`: define `Status = "authorized"`, `CurrentPeriodStart = UtcNow`, `CurrentPeriodEnd = UtcNow.AddMonths(1)`, e persiste `MpPreapprovalId`.
   - Concede créditos mensais inclusos no plano (`CreditsIncluded`).
2. **Recarga de Saldo Gerenciado de IA (`order.PlanId == null`):**
   - Dispara [`ITenantRepository.AddManagedBalanceAsync(order.TenantId, order.TotalAmount)`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Core/src/EcommerceBot.Domain/Interfaces/ITenantRepository.cs).
   - O valor pago é convertido diretamente em créditos de carteira para consumo do proxy OpenRouter (`dbo.Tenants.ManagedCreditBalance`).

---

## 🛡️ 5. Webhooks & Segurança Criptográfica

### 5.1. Rota do Webhook
- **Endpoint:** `POST /api/v1/webhooks/mercadopago`
- **Atributos:** `[AllowAnonymous]`, `[RateLimit(MaxRequests = 120, WindowSeconds = 60)]`.
- **Isenção de Tenant:** Rotas de webhook externo são isentas de `X-Tenant-ID` no `TenantHeaderMiddleware`.

### 5.2. Validação de Assinatura HMAC SHA-256 (Fail-Closed)
Implementado em [`MercadoPagoWebhookService.cs`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Core/src/EcommerceBot.Infrastructure/Services/MercadoPagoWebhookService.cs):
1. Lê o cabeçalho `x-signature` (ex: `ts=1725500000,v1=abcdef0123456789...`) e `x-request-id`.
2. Extrai timestamp (`ts`) e hash de assinatura (`v1`) via Regex pré-compilada.
3. Se `MERCADOPAGO_WEBHOOK_SECRET` não estiver configurado: dispara `Unauthorized` imediatamente (Fail-Closed).
4. Constrói o manifesto canônico exatamente no padrão do Mercado Pago:
   ```text
   manifest = "id:" + resourceId.ToLower() + ";request-id:" + xRequestId + ";ts:" + ts + ";";
   ```
5. Calcula a hash HMAC-SHA256 do manifesto usando o segredo.
6. **Comparação em Tempo Constante:** Compara a hash calculada com `v1` usando obrigatoriamente:
   ```csharp
   CryptographicOperations.FixedTimeEquals(
       Encoding.UTF8.GetBytes(computedHash),
       Encoding.UTF8.GetBytes(v1.ToLower()));
   ```
   > ⛔ **PROIBIDO** usar `==` ou `.Equals()` para prevenir Timing Attacks.

### 5.3. Idempotência no Redis (TTL 24 Horas)
1. Identifica o recurso: `dataId ?? idParam ?? body.data.id`.
2. Registra chave no Redis: `webhook:idempotency:mp:{resourceId}:{action}` via `SET NX` (`SetIfNotExistsAsync`) com expiração de 24 horas.
3. Se a chave já existir: responde imediatamente `200 OK` com payload `{ "status": "already_processed" }` evitando cobranças ou renovações duplicadas.

---

## 📡 6. Mensageria Assíncrona & Notificações em Tempo Real

Para garantir resposta ultra-rápida ao Mercado Pago (< 100ms), o webhook não faz processamento síncrono.

### 6.1. Publicação do Evento
O webhook publica o evento em RabbitMQ:
- **Evento:** `PaymentReceivedEvent`
- **Fila:** `payments_process_queue` (MassTransit com `cfg.UseRawJsonSerializer()`).

### 6.2. Consumidor: `PaymentProcessingConsumer`
Executa em background em [`PaymentProcessingConsumer.cs`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Core/src/EcommerceBot.Infrastructure/Messaging/PaymentProcessingConsumer.cs):
1. **Reconciliação:** Consulta o Mercado Pago via `GetOrderByIdAsync` (Orders API) ou `GetPaymentByIdAsync` (Payments API).
2. **Localização do Pedido:** Busca a entidade `dbo.Orders` por `ExternalReference` ou `MpPaymentId`.
3. **Aprovação do Pagamento (`processed` / `accredited` / `approved`):**
   - Atualiza `dbo.Orders.Status = "approved"` e preenche `PaidAt`.
   - Ativa assinatura SaaS ou adiciona saldo de IA.
4. **Streaming SSE para o Frontend (Zero Polling):**
   - Publica mensagem JSON no canal Redis Pub/Sub: `events:tenant:{tenantId}`:
     ```json
     {
       "type": "payment_approved",
       "order_id": "c1f7...",
       "status": "approved",
       "amount": 197.00
     }
     ```
   - O frontend React conectado ao SSE recebe o evento instantaneamente e fecha o modal de checkout, liberando a tela do usuário.
5. **E-mail Transacional de Confirmação:**
   - Publica evento `EmailEventPayload` para a fila `email_notifications`:
     - Evento: `payment.approved`
     - Destinatário: E-mail real do pagador
     - Idempotência: `email:payment:{resourceId}`
6. **Estornos & Chargebacks (`refunded` / `charged_back`):**
   - Marca pedido como `refunded`.
   - Cancela a assinatura correspondente via `subscriptionService.CancelSubscriptionAsync`.
7. **Auditoria de Robô:**
   - Registra execução na tabela `dbo.RobotActivities` com `WorkerType = "PAYMENT_PROCESSOR"`.

---

## 🗄️ 7. Modelagem T-SQL Canônica & Índices

### 7.1. Tabela `dbo.Orders`
- **Chave Primária:** `Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID()`.
- **Tenant:** `TenantId UNIQUEIDENTIFIER NOT NULL` (FK `dbo.Tenants(Id) ON DELETE CASCADE`).
- **Campos de Pagamento:**
  - `ExternalReference NVARCHAR(150) NULL`
  - `PaymentMethod NVARCHAR(50) NOT NULL` (`pix`, `credit_card`)
  - `MpPaymentId NVARCHAR(100) NULL`
  - `PixQrCode NVARCHAR(MAX) NULL`
  - `PixQrCodeBase64 NVARCHAR(MAX) NULL`
  - `PixExpirationDate DATETIMEOFFSET NULL`
  - `TotalAmount DECIMAL(18,2) NOT NULL`
  - `TotalPaidAmount DECIMAL(18,2) NOT NULL DEFAULT 0.00`
  - `Status NVARCHAR(50) NOT NULL DEFAULT 'pending'` (`approved`, `pending`, `rejected`, `refunded`)
  - `CardLastFourDigits NVARCHAR(10) NULL`
  - `CardBrand NVARCHAR(50) NULL`
  - `PaidAt DATETIMEOFFSET NULL`

### 7.2. Índices de Cobertura Críticos
```sql
-- Busca global na conciliação do webhook por referência externa
CREATE NONCLUSTERED INDEX IX_Orders_ExternalReference 
ON dbo.Orders (ExternalReference);

-- Extrato financeiro e listagem de pedidos por tenant
CREATE NONCLUSTERED INDEX IX_Orders_Tenant_CreatedAt
ON dbo.Orders (TenantId, CreatedAt DESC)
INCLUDE (TotalAmount, Status, PaymentMethod, MpPaymentId, PaidAt);

-- Subscriptions ativas do tenant
CREATE NONCLUSTERED INDEX IX_Subscriptions_Tenant_Status
ON dbo.Subscriptions (TenantId, Status)
INCLUDE (PlanId, CurrentPeriodStart, CurrentPeriodEnd, MpPreapprovalId);
```

---

## 🎨 8. Integração Frontend SPA (`EcommerceBot.Web`)

- **Biblioteca:** `@mercadopago/sdk-react` inicializada via `initMercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' })` em [`src/features/checkout`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Web/src/features/checkout).
- **Variáveis Centralizadas:** Importação estrita de `@/config/env` (`env.mercadoPagoPublicKey`).
- **Abas de Pagamento:**
  - `CreditCardPaymentTab.tsx`: Formulário completo com validação de número de cartão, validade, CVV, CPF/CNPJ e parcelamento.
  - `PixPaymentTab.tsx`: Renderização do QR Code visual com fallback para botão de cópia de texto com feedback via Toast.
- **Resolução em Tempo Real (SSE):** O hook `useCheckout` escuta o canal SSE do tenant (`/api/v1/notifications/stream`) e dispara a transição de status para `approved` sem necessidade de polling repetitivo via `setInterval`.

---

## 🚨 9. Troubleshooting & Regras Fail-Closed

1. **Erro 401 (MissingSecret) no Webhook:**
   - **Causa:** `MERCADOPAGO_WEBHOOK_SECRET` não configurado no `.env` do Core.
   - **Solução:** Configure a chave secreta gerada no painel de desenvolvedores do Mercado Pago.
2. **Erro 401 (InvalidSignature) no Webhook:**
   - **Causa:** Divergência na assinatura HMAC gerada ou cabeçalho `x-signature` ausente.
   - **Solução:** Verifique se o proxy reverso (Nginx) está repassando os cabeçalhos `x-signature` e `x-request-id` sem alteração.
3. **Pagamento aprovado no Mercado Pago mas pendente no SaaS:**
   - **Causa:** Backlog na fila `payments_process_queue` do RabbitMQ ou queda no consumidor MassTransit.
   - **Investigação:** Utilize a ferramenta MCP `inspect_rabbitmq_queues` para verificar a profundidade da fila `payments_process_queue` e eventuais mensagens na fila de erro (`payments_process_queue_error`).
4. **SSE não atualiza o modal do comprador:**
   - **Causa:** Perda de conexão no canal Redis `events:tenant:{tenantId}`.
   - **Investigação:** Utilize a ferramenta MCP `check_redis_metrics` para verificar o status do servidor Redis e a saúde das conexões Pub/Sub.
