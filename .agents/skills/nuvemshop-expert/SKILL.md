---
name: nuvemshop-expert
description: "Guia canônico, arquitetura e especificações de integração com a plataforma Nuvemshop (Tiendanube API V1, OAuth 2.0, BYOK, Webhooks Thin, Sincronização em Lote via RabbitMQ e Telemetria)."
---

# ☁️ Nuvemshop REST API & SaaS Integration — Guia Canônico & AI Toolkit

Este documento é a **Fonte Canônica da Verdade** sobre o fluxo de integração, autorização OAuth 2.0, criptografia de credenciais BYOK (AES-256 GCM), especificações da API REST V1 (Tiendanube), segurança de webhooks com Thin Payloads, sincronização em lote via RabbitMQ e streaming SSE da **Nuvemshop** no ecossistema **E-commerce Bot**.

---

## 🏛️ 1. Visão Geral & Arquitetura Multi-Tenant

A Nuvemshop (Tiendanube) é uma das principais plataformas de e-commerce conectadas ao SaaS. O ecossistema suporta:
1. **Conexão Híbrida Multi-Tenant:** Autorização via fluxo oficial OAuth 2.0 (3-legged) ou chave direta de acesso (BYOK), com isolamento por `TenantId`.
2. **Publicação & Gestão de Catálogo:** Envio de produtos gerados/enriquecidos pela IA para a loja Nuvemshop (`PushProductAsync`).
3. **Sincronização em Massa (Bulk Sync):** Enfileiramento assíncrono via MassTransit RabbitMQ (`nuvemshop_bulk_sync`) com telemetria e progresso em tempo real via Server-Sent Events (SSE).
4. **Sincronização Reativa via Webhooks:** Notificações de alterações (`product/updated`, `app/uninstalled`) tratadas sob o padrão *Fetch-on-Notification*.

```text
  ┌──────────────────────────────────────────────────────────────┐
  │                 EcommerceBot.Web (React SPA)                 │
  │     • IntegrationsPage & useNuvemshopIntegration (OAuth)     │
  │     • useBulkPlatformSync (Disparo de Sincronização em Lote) │
  │     • SSE Listener: events:tenant:{tenantId}                 │
  └──────────────────────────────┬───────────────────────────────┘
                                 │ HTTP POST/GET /api/v1/nuvemshop/*
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │          NuvemshopIntegrationController & Service            │
  │     • Handshake OAuth 2.0 & Troca de Código                  │
  │     • Criptografia AES-256 GCM via IAesGcmCryptoService      │
  │     • Persistência Dapper: dbo.StoreIntegrations             │
  │     • Auto-registro de Webhooks (1-Clique Handshake)          │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
     Disparo de Bulk Sync        │ Webhooks Recebidos (product/updated)
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │              Filas & Mensageria RabbitMQ / Redis             │
  │     • Fila RabbitMQ: nuvemshop_bulk_sync                     │
  │     • Canal Redis: events:tenant:{tenantId} (SSE)           │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │        NuvemshopBulkSyncConsumer & NuvemshopGateway          │
  │     • Consumo assíncrono de NuvemshopBulkSyncMessage         │
  │     • Chamadas HTTP para https://api.nuvemshop.com.br/v1/    │
  │     • Atualização em dbo.Products (NuvemshopProductId)       │
  │     • Telemetria: dbo.RobotActivities (NuvemshopWorker)      │
  │     • Emissão de progresso: NUVEMSHOP_SYNC_PROGRESS          │
  └──────────────────────────────────────────────────────────────┘
```

---

## 🔐 2. Autenticação & Gestão Criptográfica de Credenciais

### 2.1. Modos de Conexão Suportados

#### Modo A: App Público / OAuth 2.0 Flow (Recomendado para Lojistas)
1. **Passo 1 (Geração de URL de Autorização):**
   - Rota: `GET /api/v1/nuvemshop/auth` (requer header `X-Tenant-ID`).
   - URL gerada pelo backend:
     ```text
     https://www.nuvemshop.com.br/apps/authorize/token?client_id={ClientId}&redirect_uri={RedirectUri}&response_type=code&state={TenantId}
     ```
   - O parâmetro `state` carrega o `TenantId` do usuário para associação segura no callback.
2. **Passo 2 (Callback de Autorização):**
   - Rota: `GET /api/v1/nuvemshop/oauth/callback?code={code}&state={tenantId}` (`[AllowAnonymous]`).
   - O Core dispara requisição POST para troca de credenciais:
     ```http
     POST https://www.nuvemshop.com.br/apps/authorize/token
     Content-Type: application/json

     {
       "client_id": "{ClientId}",
       "client_secret": "{ClientSecret}",
       "grant_type": "authorization_code",
       "code": "{code}"
     }
     ```
   - Resposta da Nuvemshop: `{ "access_token": "...", "token_type": "bearer", "user_id": 123456 }`.
   - O `user_id` da resposta é o identificador exclusivo da loja (`StoreId`).

#### Modo B: Token Direto / BYOK (Bring Your Own Keys)
- Rota: `POST /api/v1/nuvemshop/credentials`
- Payload: `{ "storeId": "123456", "accessToken": "shpat_..." }`
- Utilizado para testes rápidos de homologação e lojas em sandbox.

### 2.2. Criptografia AES-256 GCM (Gravação Segura no Banco)
Implementado em [`NuvemshopIntegrationService.cs`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Core/src/EcommerceBot.Infrastructure/Services/NuvemshopIntegrationService.cs) via `IAesGcmCryptoService`:
- O `access_token` é criptografado com chave de 256 bits derivada do ambiente.
- Persistido na tabela `dbo.StoreIntegrations`:
  - `EncryptedAccessToken VARBINARY(MAX)`
  - `InitializationVector VARBINARY(32)` (Nonce único)
  - `AuthTag VARBINARY(32)` (Tag de autenticação GCM contra adulteração)
- `Platform = 'NUVEMSHOP'`
- `StoreDomain = storeId` (Armazena o User ID numérico da loja).

### 2.3. 1-Clique Handshake & Auto-registro de Webhooks
Assim que as credenciais são salvas com sucesso:
1. **Health Check Imediato:** O backend executa `GET /{storeId}/categories` para validar a validade do token e registrar a latência em `dbo.StoreIntegrations.HealthCheckLatencyMs`.
2. **Auto-registro em Background:** Dispara [`RegisterWebhooksAsync`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Core/src/EcommerceBot.Infrastructure/Gateways/NuvemshopGateway.cs) registrando os tópicos:
   - `product/updated`
   - `product/deleted`
   - `order/created`
   - `app/uninstalled`
   Apontando para a URL pública configurada (`/api/v1/nuvemshop/webhooks`).

---

## 📡 3. Especificações da API REST Nuvemshop (V1)

Todas as requisições autenticadas utilizam:
- **Base URL:** `https://api.nuvemshop.com.br/v1/{store_id}/`
- **Cabeçalhos Obrigatórios:**
  - `Authentication: bearer {token_descriptografado}`
  - `User-Agent: EcommerceBot (contato@ecommercebot.com)`
  - `Content-Type: application/json`

### 3.1. Criação / Publicação de Produto (`POST /{store_id}/products`)
Implementado no gateway [`NuvemshopGateway.PushProductAsync`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Core/src/EcommerceBot.Infrastructure/Gateways/NuvemshopGateway.cs):
```json
{
  "name": {
    "pt": "Camiseta Algodão Egípcio Minimalista"
  },
  "description": {
    "pt": "<p>Descrição gerada e otimizada por IA...</p>"
  },
  "brand": "Minha Marca",
  "published": true,
  "variants": [
    {
      "price": "149.90",
      "promotional_price": "129.90",
      "stock": 25,
      "sku": "TSHIRT-EGY-BLK-M",
      "stock_management": true
    }
  ],
  "images": [
    {
      "src": "https://cdn.ecommercebot.local/images/produto-1.jpg",
      "position": 1
    }
  ]
}
```
**Mapeamento de Retorno:**
- A resposta contém o `id` do produto e o `id` da variante gerados na Nuvemshop.
- O gateway atualiza imediatamente o registro local em `dbo.Products`:
  - `NuvemshopProductId = response.id.ToString()`
  - `NuvemshopVariantId = response.variants[0].id.ToString()`

### 3.2. Atualização Atômica de Estoque (`PUT /{store_id}/products/{productId}/variants/{variantId}`)
```json
{
  "stock": 42
}
```

### 3.3. Atualização de Status / Publicação (`PUT /{store_id}/products/{productId}`)
```json
{
  "published": true
}
```

### 3.4. Exclusão Remota (`DELETE /{store_id}/products/{productId}`)
Remove o produto do catálogo da loja remota quando o lojista decide arquivar ou excluir no SaaS.

---

## 🛡️ 4. Segurança de Webhooks & Thin Payloads

### 4.1. Rota do Webhook
- **Endpoint:** `POST /api/v1/nuvemshop/webhooks`
- **Atributos:** `[AllowAnonymous]`, `[RateLimit(MaxRequests = 120, WindowSeconds = 60)]`.

### 4.2. O Padrão "Thin Payload" da Nuvemshop
Ao contrário de outros provedores que enviam o objeto inteiro, a Nuvemshop envia **Thin Payloads** mínimos:
```json
{
  "store_id": 123456,
  "event": "product/updated",
  "id": 98765432
}
```
Cabeçalhos enviados pela Nuvemshop:
- `X-LinkedStore-HMAC-SHA256`: Assinatura hexadecimal da hash HMAC.
- `X-LinkedStore-Topic`: Tópico do evento (ex: `product/updated`).
- `X-LinkedStore-Store-Id`: ID da loja.
- `X-LinkedStore-Event-Id`: ID único do evento de webhook.

### 4.3. Validação de Assinatura HMAC SHA-256 (Fail-Closed)
Implementado em [`NuvemshopIntegrationController.VerifyNuvemshopSignature`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Core/src/EcommerceBot.Api/Controllers/NuvemshopIntegrationController.cs):
1. Lê o corpo bruto da requisição HTTP como string.
2. Calcula o HMAC-SHA256 utilizando `NuvemshopOptions.ClientSecret`.
3. Converte para string hexadecimal em minúsculas (`Convert.ToHexString(hash).ToLowerInvariant()`).
4. **Comparação em Tempo Constante:**
   ```csharp
   CryptographicOperations.FixedTimeEquals(calculatedBytes, headerBytes);
   ```
   > ⛔ **PROIBIDO** usar `==` ou `.Equals()` para prevenir Timing Attacks.
   Se `ClientSecret` não estiver configurado em ambiente de produção: rejeita imediatamente com `401 Unauthorized` (Fail-Closed).

### 4.4. Idempotência no Redis (TTL 24 Horas)
1. Identificador de Idempotência: `eventIdHeader` ou `{storeId}:{topic}:{resourceId}`.
2. Chave Redis: `webhook:nuvemshop:{idempotencyId}` via `SET NX` (`SetIfNotExistsAsync`) com expiração de 24 horas.
3. Se a chave já existir: responde `200 OK` imediatamente.

### 4.5. Resolução Multi-Tenant Dinâmica por Store ID
Como a Nuvemshop não envia o `X-Tenant-ID` nas notificações de webhook, o controlador resolve o inquilino buscando no banco:
```csharp
var integration = await _storeIntegrationRepository.GetByDomainAsync("NUVEMSHOP", storeId);
var tenantId = integration.TenantId;
```

---

## ⚡ 5. Sincronização Reativa & Processamento em Lote (RabbitMQ)

### 5.1. Sincronização Reativa (*Fetch-on-Notification*)
Quando o webhook `product/updated` é recebido:
1. O payload contém apenas o `id` remoto do produto (`resourceId`).
2. O serviço [`NuvemshopIntegrationService`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Core/src/EcommerceBot.Infrastructure/Services/NuvemshopIntegrationService.cs) executa `gateway.GetProductByIdAsync(tenantId, resourceId)`.
3. Com o produto completo baixado da Nuvemshop, localiza o registro local via `dbo.Products.Sku`.
4. Atualiza preço, estoque e IDs vinculados.
5. **Streaming SSE para o Frontend:** Publica evento no canal Redis Pub/Sub `events:tenant:{tenantId}`:
   ```json
   {
     "type": "NUVEMSHOP_PRODUCT_UPDATED",
     "sku": "TSHIRT-EGY-BLK-M",
     "product_id": 98765432,
     "price": 149.90,
     "stock": 25,
     "timestamp": "2026-09-05T17:00:00Z"
   }
   ```

### 5.2. Desconexão Atômica (`app/uninstalled`)
Quando o lojista remove o aplicativo no painel da Nuvemshop:
- O webhook `app/uninstalled` atualiza imediatamente `dbo.StoreIntegrations.Status = 'DISCONNECTED'` e `HealthCheckStatus = 'App Desinstalado na Nuvemshop'`.

### 5.3. Sincronização em Massa (Bulk Sync Pipeline)
Para publicar dezenas ou centenas de produtos simultaneamente:
1. **Disparo:** `POST /api/v1/nuvemshop/sync/bulk` com `{ "skus": ["SKU1", "SKU2", ...], "forceUpdate": true, "visibility": "visible" }`.
2. **Desacoplamento:** O serviço gera um `jobId` e publica cada item como `NuvemshopBulkSyncMessage` na fila RabbitMQ:
   - **Fila:** `nuvemshop_bulk_sync` (MassTransit com `cfg.UseRawJsonSerializer()`).
3. **Consumo por `NuvemshopBulkSyncConsumer`:**
   - Consome as mensagens de forma assíncrona com controle de concorrência.
   - Executa `NuvemshopGateway.PushProductAsync`.
   - **Telemetria:** Grava registro em `dbo.RobotActivities` (`WorkerType = "NuvemshopBulkSyncWorker"`, duração em ms, status e JSON de detalhes).
   - **Streaming SSE de Progresso:** Emite no canal Redis Pub/Sub:
     ```json
     {
       "type": "NUVEMSHOP_SYNC_PROGRESS",
       "job_id": "a1b2c3d4...",
       "sku": "SKU1",
       "status": "SYNCED",
       "nuvemshop_id": "98765432",
       "timestamp": "2026-09-05T17:00:00Z"
     }
     ```

---

## 🗄️ 6. Modelagem T-SQL Canônica & Índices

### 6.1. Tabela `dbo.StoreIntegrations`
```sql
CREATE TABLE dbo.StoreIntegrations (
    Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    TenantId UNIQUEIDENTIFIER NOT NULL,
    Platform NVARCHAR(50) NOT NULL, -- 'NUVEMSHOP', 'SHOPIFY'
    StoreDomain NVARCHAR(255) NOT NULL, -- User ID da Nuvemshop (ex: "123456")
    EncryptedAccessToken VARBINARY(MAX) NOT NULL,
    InitializationVector VARBINARY(32) NOT NULL,
    AuthTag VARBINARY(32) NOT NULL,
    Status NVARCHAR(30) NOT NULL DEFAULT 'CONNECTED',
    HealthCheckStatus NVARCHAR(200) NULL,
    HealthCheckLatencyMs INT NULL,
    LastHealthCheckAt DATETIMEOFFSET NULL,
    CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CONSTRAINT PK_StoreIntegrations PRIMARY KEY CLUSTERED (Id),
    CONSTRAINT FK_StoreIntegrations_Tenants FOREIGN KEY (TenantId) 
        REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
    CONSTRAINT UQ_StoreIntegrations_Tenant_Platform_Domain UNIQUE NONCLUSTERED (TenantId, Platform, StoreDomain)
);
```

### 6.2. Índices de Cobertura Críticos
```sql
-- Resolução ultra-rápida de webhooks por plataforma e ID da loja (sem lock de tabela)
CREATE NONCLUSTERED INDEX IX_StoreIntegrations_Platform_Domain
ON dbo.StoreIntegrations (Platform, StoreDomain)
INCLUDE (TenantId, Status, EncryptedAccessToken, InitializationVector, AuthTag);

-- Busca e mapeamento de produtos por ID da Nuvemshop
CREATE NONCLUSTERED INDEX IX_Products_Tenant_NuvemshopProduct
ON dbo.Products (TenantId, NuvemshopProductId)
INCLUDE (Sku, Title, Price, StockQuantity)
WHERE NuvemshopProductId IS NOT NULL;
```

---

## 🎨 7. Frontend React & Atribuição de Tráfego

- **Módulo de Integrações:** [`src/features/integrations`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Web/src/features/integrations)
  - Hook [`useNuvemshopIntegration.ts`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Web/src/features/integrations/hooks/useNuvemshopIntegration.ts): Gerencia o redirecionamento OAuth 2.0 (`initiateOAuth`), listagem de categorias e mutação rápida de lote de estoque/preço.
  - Componentes de UI: Exibição do status da conexão (Latência em ms, badge verde/vermelho, modal de reconexão).
- **Módulo de Catálogo:** [`src/features/catalog`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Web/src/features/catalog)
  - Hook [`useBulkPlatformSync.ts`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Web/src/features/catalog/hooks/useBulkPlatformSync.ts): Permite ao usuário selecionar SKUs na tabela e disparar envio em massa para `NUVEMSHOP` ou `ALL` (Shopify + Nuvemshop).
- **Rastreamento com `tracker.js`:**
  - O script [`public/tracker.js`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Web/public/tracker.js) é injetado no rodapé da loja Nuvemshop.
  - Captura as variáveis UTM (`ec_utm_source`, `ec_utm_campaign`, `ec_session_id`) e injeta inputs ocultos no formulário de checkout para atribuição precisa de vendas ao robô.

---

## 🚨 8. Troubleshooting & Regras Fail-Closed

1. **Erro 401 (Unauthorized) na chamada para a API Nuvemshop:**
   - **Causa:** O lojista desinstalou o aplicativo ou o token expirou.
   - **Comportamento:** O gateway registra o erro e o serviço atualiza o status da integração para `ERROR` ou `DISCONNECTED`.
2. **Erro 401 (Invalid HMAC signature) no Webhook:**
   - **Causa:** Chave secreta `NUVEMSHOP_CLIENT_SECRET` divergente da cadastrada no portal de parceiros da Nuvemshop.
   - **Investigação:** Verifique a variável de ambiente no container Core.
3. **Fila `nuvemshop_bulk_sync` acumulando mensagens:**
   - **Causa:** Limite de requisições por segundo (Rate Limit da Nuvemshop) ou instabilidade no gateway.
   - **Investigação:** Utilize a ferramenta MCP `inspect_rabbitmq_queues` para verificar a taxa de consumo da fila e consulte a ferramenta `get_recent_application_errors` para identificar exceções de status HTTP 429.
4. **Produtos sem vínculo após sincronização:**
   - **Causa:** Falha ao persistir `NuvemshopProductId` em `dbo.Products`.
   - **Investigação:** Verifique se a migração `014_Nuvemshop_Product_Columns.sql` foi devidamente aplicada no banco de dados.
