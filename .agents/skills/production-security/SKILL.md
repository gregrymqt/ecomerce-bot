---
name: production-security
description: "Audita e impõe os mais altos padrões de segurança para o ecossistema SaaS E-commerce Bot em produção. Ative esta skill sempre que for criar, refatorar ou auditar código na API Core (.NET/Dapper), migrações (DbUp/SQL Server) ou Worker Python, cobrindo: isolamento multi-tenant estrito no Dapper, criptografia de segredos (AES-256 GCM BYOK), prevenção de SSRF no Scraper, verificação de assinaturas HMAC em tempo constante, idempotência Redis, prevenção de SQL Injection e isolamento total do Worker sem acesso a banco."
---

# 🛡️ Production Security — Guardião de Segurança SaaS

Este documento define os **requisitos inegociáveis de segurança** que devem ser auditados e respeitados pelo agente de IA em qualquer alteração de código ou arquitetura no ecossistema **E-commerce Bot**.

---

## 🔒 1. Isolamento Multi-Tenant & Persistência Dapper (.NET 8/9 + SQL Server 2022)

Em uma arquitetura SaaS Multi-Tenant, o vazamento de dados entre clientes (*Tenant Data Leakage*) é uma falha crítica de segurança **P0**.

### Regras Obrigatórias de Consulta:
1. **Filtro Parametrizado Obrigatório:**
   - Toda consulta ou comando T-SQL executado via Dapper em tabelas com particionamento lógico por tenant DEVE conter obrigatoriamente a cláusula `WHERE TenantId = @TenantId`.
   - NUNCA realize interpolação de strings em queries T-SQL (`$"SELECT * FROM ... WHERE TenantId = '{tenantId}'"`). Utilize parâmetros anônimos ou `DynamicParameters` tipados do Dapper.
2. **Proibição Absoluta de Conexões de Banco no Python Worker:**
   - O microsserviço `EcommerceBot.Worker` NUNCA deve importar ou utilizar drivers/ORMs de banco de dados (`sqlalchemy`, `databases`, `psycopg`, `psycopg2`, `asyncpg`, `pyodbc`, `pymssql`, `tortoise-orm`).
   - A entrada de dados no Worker ocorre exclusivamente via RabbitMQ (`aio-pika`), e a saída de dados processados retorna via filas (`ecommerce_processed_queue`) para persistência controlada pela API Core .NET.
3. **Validação Estrita do Header `X-Tenant-ID`:**
   - O `TenantHeaderMiddleware` na API .NET valida obrigatoriamente se o header `X-Tenant-ID` corresponde à claim `tenantId` contida no JWT validado. Divergências resultam imediatamente em HTTP `403 Forbidden`.

---

## 🔑 2. Gestão de Segredos & Criptografia (BYOK - Bring Your Own Key)

Chaves de API de terceiros (OpenRouter, DeepSeek, Gemini) e tokens de integração (Shopify Access Token, Nuvemshop Token) NUNCA devem trafegar ou residir em texto puro.

### Regras Obrigatórias:
1. **Criptografia AES-256 GCM em C#:**
   - Chaves de API de clientes salvas em `dbo.Tenants` ou tabelas de integração devem ser cifradas usando `System.Security.Cryptography.AesGcm`.
   - Estrutura obrigatória das colunas: `EncryptedPayload VARBINARY(MAX)`, `InitializationVector VARBINARY(16)`, `AuthTag VARBINARY(16)`.
2. **Proibição de Logs Sensíveis:**
   - É proibido registrar em logs (ILogger/Serilog/logging) valores de senhas, JWTs completos, chaves de API ou payloads de cartão de crédito.
   - Aplique sempre mascaramento de chaves (ex: `key[..6] + "..." + key[^4..]`).
3. **Isolamento de Variáveis e Segredos:**
   - Arquivos `.env`, `.env.local` e secrets de produção NUNCA devem ser versionados no Git nem incorporados em imagens Docker.

---

## 📡 3. Segurança de Webhooks & Idempotência

Endpoints de Webhook (Mercado Pago, Shopify, Nuvemshop, Resend) recebem requisições públicas não autenticadas por JWT e exigem blindagem contra Replay Attacks e Spoofing.

### Regras Obrigatórias:
1. **Comparação Criptográfica em Tempo Constante:**
   - A validação de assinaturas HMAC/Svix deve ser feita utilizando:
     `CryptographicOperations.FixedTimeEquals(calculatedHashBytes, receivedHashBytes)`
   - NUNCA use operadores de igualdade padrão (`==` ou `.Equals()`) para validar hashes criptográficos.
2. **Idempotência no Redis (TTL 24h):**
   - Antes de processar qualquer evento de webhook, registre uma chave com TTL de 24 horas via `SET NX`:
     `await _redisDatabase.StringSetAsync($"webhook:idempotency:{eventId}", "processed", TimeSpan.FromHours(24), When.NotExists);`
   - Se o comando retornar falso (chave já existe), retorne `200 OK` imediatamente sem reprocessar a carga útil.

---

## 🌐 4. Proteção Anti-SSRF no Scraper de E-commerce

O motor de scraping recebe URLs fornecidas pelos usuários. Para impedir Server-Side Request Forgery (SSRF) contra a infraestrutura interna:

### Regras Obrigatórias:
1. **Validação Restrita de Protocolo:**
   - Aceite exclusivamente esquemas `http://` e `https://`. Bloqueie expressamente esquemas locais ou perigosos (`file://`, `gopher://`, `ftp://`, `data://`).
2. **Bloqueio de Loopback, IPs Privados e Metadados de Nuvem:**
   - Rejeite e aborte requisições para:
     - `127.0.0.0/8`, `localhost`, `::1`
     - Faixas privadas RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
     - Metadados de Cloud Providers: `169.254.169.254`, `0.0.0.0`
3. **Timeouts e Limites de Payload:**
   - Defina timeout máximo de 15 segundos nas requisições HTTP do Scraper e limite o tamanho da resposta em 10 MB.

---

## ⚡ 5. Rate Limiting & Proteção Financeira

1. **Rate Limiting no Redis:**
   - Rotas de autenticação (`/api/v1/auth/*`) e requisições públicas de scraping devem possuir barreiras de taxa ativas via Redis.
2. **Feature Gatekeeper & Saldos:**
   - Antes de despachar mensagens para `queue:ecommerce` ou consumir provedores LLM pagos, valide se o tenant possui saldo em `CreditsBalance > 0` ou `ManagedCreditBalance > 0` (exceto em modo `IsByok = 1`).

---

## 📋 Checklist de Auditoria Rápida para o Agente

Ao criar ou editar qualquer funcionalidade, valide:
- [ ] Todas as queries Dapper contêm `WHERE TenantId = @TenantId`?
- [ ] O Worker Python permanece 100% isolado de conexões de banco de dados?
- [ ] A assinatura do webhook foi comparada com `CryptographicOperations.FixedTimeEquals`?
- [ ] A chave de idempotência foi travada no Redis com TTL de 24 horas via `When.NotExists`?
- [ ] As URLs do scraper são validadas contra faixas de IP privadas e metadados de nuvem?
