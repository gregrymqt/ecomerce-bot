---
name: shopify-expert
description: "Guia canônico e especificações do ecossistema Shopify (GraphQL Admin API 2024+, OAuth 2.0, Webhooks HMAC, Bulk API e Sincronização de Produtos) baseado no Shopify AI Toolkit oficial."
---

# 🛍️ Shopify GraphQL & SaaS Integration — Guia Canônico & AI Toolkit

Este documento reúne os padrões oficiais, especificações de GraphQL Admin API (versão 2024-01+), regras de segurança, autenticação OAuth 2.0, webhooks e sincronização assíncrona do ecossistema **Shopify** para o **E-commerce Bot**.

---

## 🔐 1. Autenticação & Gestão de Credenciais Multi-Tenant

### 1.1. Modos de Conexão Suportados:
1. **Custom App / Token Direto (BYOK):**
   - O lojista gera um *Admin API Access Token* (`shpat_...`) no painel da Shopify e informa o domínio da loja (ex: `minhaloja.myshopify.com`).
   - O token é criptografado com **AES-256 GCM** via `IAesGcmCryptoService` e persistido em `dbo.StoreIntegrations` com isolamento por `TenantId`.
2. **App Público / OAuth 2.0 Flow:**
   - **Passo 1 (Geração de URL):**
     `https://{shop}/admin/oauth/authorize?client_id={api_key}&scope={scopes}&redirect_uri={redirect_url}&state={nonce_state}`
   - **Passo 2 (Validação de Callback):**
     Validar a assinatura HMAC dos parâmetros de query recebidos no callback (`code`, `shop`, `state`, `timestamp`, `hmac`).
   - **Passo 3 (Troca de Código por Token):**
     `POST https://{shop}/admin/oauth/access_token` com payload JSON `{ "client_id": "...", "client_secret": "...", "code": "..." }`.
   - **Passo 4 (Persistência):**
     Armazenar o `access_token` criptografado no banco.

---

## 📡 2. Especificações de GraphQL Admin API (2024-01+)

Todas as chamadas GraphQL devem ser direcionadas para:
`POST https://{store_domain}/admin/api/2024-01/graphql.json`
Cabeçalhos obrigatórios:
- `X-Shopify-Access-Token: {admin_access_token}`
- `Content-Type: application/json`

### 2.1. Health Check & Teste de Conexão:
```graphql
query ShopHealthCheck {
  shop {
    name
    myshopifyDomain
    currencyCode
    plan {
      displayName
    }
  }
}
```

### 2.2. Criação / Publicação de Produto (`productCreate`):
```graphql
mutation ProductCreate($input: ProductInput!, $media: [CreateMediaInput!]) {
  productCreate(input: $input, media: $media) {
    product {
      id
      title
      handle
      status
      variants(first: 10) {
        nodes {
          id
          sku
          price
          inventoryItem {
            id
          }
        }
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

### 2.3. Atualização de Estoque (`inventorySetOnHandQuantities`):
```graphql
mutation InventorySet($input: InventorySetOnHandQuantitiesInput!) {
  inventorySetOnHandQuantities(input: $input) {
    inventoryAdjustmentGroup {
      createdAt
      reason
    }
    userErrors {
      field
      message
    }
  }
}
```

### 2.4. Exclusão Remota de Produto (`productDelete`):
```graphql
mutation ProductDelete($input: ProductDeleteInput!) {
  productDelete(input: $input) {
    deletedProductId
    userErrors {
      field
      message
    }
  }
}
```

---

## 🛡️ 3. Segurança & Blindagem de Webhooks

### 3.1. Validação Criptográfica de Assinatura (HMAC SHA-256):
- A Shopify envia o cabeçalho `X-Shopify-Hmac-Sha256` (Base64 da hash HMAC do corpo bruto com o *Client Secret*).
- O backend DEVE usar comparação em tempo constante para mitigar *Timing Attacks*:
  `CryptographicOperations.FixedTimeEquals(calculatedBytes, headerBytes)`.

### 3.2. Idempotência no Redis:
- Ler o header `X-Shopify-Webhook-Id`.
- Registrar chave no Redis: `webhook:shopify:{webhookId}` com TTL de 24 horas usando `SET NX`. Se já existir, retornar `200 OK` imediatamente.

### 3.3. Resolução Multi-Tenant por Domínio:
- Como a Shopify **não** envia o header `X-Tenant-ID`, o endpoint de webhook lê `X-Shopify-Shop-Domain` e faz a busca do `TenantId` no repositório de integrações.

### 3.4. Tópicos de Webhooks Essenciais:
- `products/create` / `products/update`: Sincronização reversa de produtos no catálogo local.
- `products/delete`: Arquivamento ou exclusão lógica do produto no banco de dados.
- `inventory_levels/update`: Atualização imediata do estoque no banco de dados local.
- `app/uninstalled`: Inativação imediata da credencial em `dbo.StoreIntegrations`.
- `customers/data_request`, `customers/redact`, `shop/redact`: Webhooks obrigatórios de privacidade GDPR da Shopify.

---

## ⚡ 4. Tratamento de Rate Limits (Leaky Bucket)

- A Shopify utiliza algoritmo de Leaky Bucket com limites de pontos de custo GraphQL (Standard: 50 pontos/segundo com bucket de 1000 pontos).
- Inspecione a extensão `extensions.cost.throttleStatus` no JSON de resposta.
- Caso a API responda com status HTTP `429 Too Many Requests`, o consumidor MassTransit ou o Gateway deve aguardar o tempo indicado no header `Retry-After` com *Exponential Backoff*.
