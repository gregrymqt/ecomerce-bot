# 🌐 Módulo 1: Hub de APIs Externas, Gateways & Provedores

Este módulo documenta os contratos técnicos, protocolos de comunicação, estruturas de payload e regras de autenticação com todas as integrações de terceiros do ecossistema **E-commerce Bot**.

---

## 🛍️ 1. Shopify Admin API (GraphQL & Webhooks)

- **Versão da API:** GraphQL Admin API 2024-07+
- **Padrão de Autenticação:** Token de acesso via cabeçalho `X-Shopify-Access-Token`.
- **Biblioteca / Gateway:** `EcommerceBot.Infrastructure.Gateways.ShopifyGateway`

### 1.1. Mutação de Produtos (`productSet`)
Para sincronização atômica de catálogo (criação e atualização de produtos, variações de SKU, preços e imagens):

```graphql
mutation productSet($input: ProductSetInput!) {
  productSet(input: $input) {
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

### 1.2. Injeção de Atribuição no Carrinho (`note_attributes`)
O script cliente [`tracker.js`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Web/public/tracker.js) captura as UTMs do comprador e faz o despacho automático para o carrinho da Shopify:
- **Endpoint:** `POST /cart/update.js`
- **Payload:**
```json
{
  "attributes": {
    "ec_utm_source": "instagram",
    "ec_utm_medium": "paid_social",
    "ec_utm_campaign": "blackfriday2026",
    "ec_ad_id": "ad_987654",
    "ec_session_id": "sess_1725463829_a8b9c"
  }
}
```

### 1.3. Webhooks & Validação de Segurança HMAC
- **Tópico Principal:** `orders/paid`
- **Cabeçalho:** `X-Shopify-Hmac-Sha256`
- **Regra Fail-Closed:** A verificação de assinatura calcula o hash HMAC-SHA256 do corpo bruto com a `ShopifyApiKeySecret` e compara estritamente com `CryptographicOperations.FixedTimeEquals` para prevenção de ataques de temporização (Timing Attacks).

---

## ☁️ 2. Nuvemshop REST API (V1)

- **Padrão de Autenticação:** `Authentication: bearer <access_token>` com `User-Agent: EcommerceBot (suporte@ecommercebot.com)`.
- **Gateway:** `EcommerceBot.Infrastructure.Gateways.NuvemshopGateway`.
- **Endpoints Chave:**
  - `GET /v1/{user_id}/products`: Leitura paginada do catálogo.
  - `POST /v1/{user_id}/products`: Criação de novos produtos enriquecidos pela IA.
  - `POST /v1/{user_id}/scripts`: Injeção do `tracker.js` no rodapé da loja.
- **Rastreamento:** Injeção de campos ocultos (`hidden inputs`) no formulário de checkout para propagação das variáveis `ec_utm_*`.

---

## 💳 3. Mercado Pago API (Checkout Transparente & Assinaturas)

- **Padrão de Autenticação:** `Authorization: Bearer <ACCESS_TOKEN>`
- **Gateway:** `EcommerceBot.Infrastructure.Gateways.MercadoPagoGateway`
- **Controller de Webhooks:** `MercadoPagoWebhookController` (`/api/v1/webhooks/mercadopago`)

### 3.1. Modalidades de Pagamento Suportadas
1. **PIX (Checkout Transparente):**
   - Criação via `POST /v1/payments` com `payment_method_id: "pix"`.
   - Retorna `point_of_interaction.transaction_data.qr_code` (Copia e Cola) e `qr_code_base64`.
2. **Cartão de Crédito Transparente:**
   - Tokenização no frontend via MercadoPago SDK (`device_id` anti-fraude).
   - Envio de `token`, `installments` e `payer.email`.
3. **Assinaturas Recorrentes (Preapproval):**
   - Criação de planos de assinatura mensal/anual via `POST /preapproval_plan` e `POST /preapproval`.

### 3.2. Idempotência e Segurança
- O identificador `data.id` ou `id` do webhook é checado no Redis com TTL de 24h via `SET NX` (`webhook:idempotency:{id}`). Duplicidades recebem `200 OK` imediato sem reprocessamento.
- Validação do cabeçalho `x-signature` com `x-request-id` usando chave secreta do webhook.

---

## 🤖 4. OpenRouter LLM API (Inference Engine)

- **Provedor:** `EcommerceBot.Worker.app.ai.providers.openrouter_provider.OpenRouterLLMProvider`
- **Endpoint:** `https://openrouter.ai/api/v1/chat/completions`
- **Cabeçalhos de Telemetria:**
  - `HTTP-Referer`: `https://ecommercebot.local`
  - `X-Title`: `EcommerceBot`
- **Cadeia de Fallback Resiliente:**
  1. `deepseek/deepseek-chat` (Alta velocidade e excelente copywriting em PT-BR)
  2. `meta-llama/llama-3.3-70b-instruct` (Capacidade de raciocínio profundo e estruturação JSON)
  3. `google/gemini-flash-1.5` (Baixíssima latência e ampla janela de contexto)
- **Política de Retentativas (Tenacity):** Retenta até 3 vezes com recuo exponencial (`wait_exponential(multiplier=1, min=2, max=10)`) em erros 429, 500, 502, 503 e 504.
