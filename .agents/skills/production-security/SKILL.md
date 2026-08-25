---
name: production-security
description: "Audita e impõe os mais altos padrões de segurança para aplicações SaaS prontas para produção (Production-Ready). Ative esta skill sempre que for criar, refatorar ou auditar código que vá para a VPS/produção, cobrindo: isolamento multi-tenant (RLS, tenant_id), criptografia de segredos (AES-256 GCM BYOK), prevenção de SSRF no Scraper, verificação de assinaturas HMAC/Svix de Webhooks, idempotência Redis, mitigação de SQL Injection, blindagem de Docker/Containers não-root e sanitização contra XSS/Injeção de templates."
---

# 🛡️ Production Security — Guardião de Segurança SaaS

Este documento define os **requisitos inegociáveis de segurança** que devem ser auditados e respeitados pelo agente de IA em qualquer alteração de código ou arquitetura no ecossistema **E-commerce Bot** antes e durante a operação em produção.

---

## 🔒 1. Isolamento de Dados Multi-Tenant & RLS (Row-Level Security)

Em uma arquitetura SaaS Multi-Tenant, o vazamento de dados entre clientes (*Tenant Data Leakage*) é uma falha crítica de segurança **P0**.

### Regras Obrigatórias:
1. **Filtro Explícito por `tenant_id`:**
   - Toda consulta no banco de dados (SQLAlchemy Async / PostgreSQL) em tabelas que contêm `tenant_id` DEVE conter obrigatoriamente o filtro explícito `.where(Model.tenant_id == current_tenant_id)`.
   - Chaves lógicas e primárias compostas devem usar `(tenant_id, sku)` ou `(tenant_id, id)`.
2. **Contexto de Sessão RLS:**
   - As conexões com o PostgreSQL que operam sob RLS devem definir a variável de sessão usando binds parametrizados:
     ```python
     # CORRETO (Blindado contra SQL Injection):
     await session.execute(
         text("SELECT set_config('app.current_tenant', :tenant_id, true);"),
         {"tenant_id": str(tenant_id)}
     )
     
     # NUNCA FAÇA (Vulnerável):
     await session.execute(text(f"SET LOCAL app.current_tenant = '{tenant_id}';"))
     ```
3. **Validação Estrita do Header `X-Tenant-ID`:**
   - O middleware de autenticação (`get_current_tenant_user`) DEVE validar se o tenant solicitado no header `X-Tenant-ID` pertence à lista de tenants autorizados nas claims do token JWT do usuário autenticado.

---

## 🔑 2. Gestão de Segredos & Criptografia (BYOK - Bring Your Own Key)

Chaves de API de terceiros (OpenRouter, DeepSeek, Groq, OpenAI, Gemini) e tokens de integração de lojas (Shopify Access Token, Nuvemshop Token) NUNCA podem ser expostos.

### Regras Obrigatórias:
1. **Criptografia em Repouso (AES-256 GCM):**
   - Chaves de API e tokens sensíveis salvos no banco de dados DEVEM ser criptografados via `encrypt_api_key()` e descriptografados via `decrypt_api_key()` utilizando a chave mestra `AES_MASTER_KEY`.
   - NUNCA armazene chaves ou tokens em texto puro (*plain text*).
2. **Proibição de Logs Sensíveis:**
   - É terminantemente proibido imprimir em `logger.info()`, `logger.error()` ou `print()` o valor de senhas, JWTs completos, chaves de API ou payloads de cartão de crédito.
   - Utilize funções de mascaramento (ex: `key[:6] + "..." + key[-4:]`).
3. **Isolamento de Variáveis de Ambiente:**
   - Arquivos `.env`, `.env.local`, `.env.production` NUNCA devem ser comitados no Git nem copiados para dentro de imagens Docker.

---

## 📡 3. Segurança de Webhooks & Idempotência

Endpoints públicos de Webhooks (Mercado Pago, Shopify, Nuvemshop) são alvos comuns de ataques de repetição (*Replay Attacks*) e falsificação (*Spoofing*).

### Regras Obrigatórias:
1. **Validação Criptográfica de Assinatura (HMAC / Svix):**
   - Todo payload recebido em rotas `/webhooks/*` DEVE ter sua assinatura criptográfica (header `x-signature`, `X-Shopify-Hmac-Sha256`, etc.) validada contra o segredo compartilhado antes de qualquer processamento de negócio.
2. **Idempotência no Redis (TTL 24h):**
   - Todo webhook deve registrar a chave de idempotência no Redis (`webhook:idempotency:{event_id}`) com TTL de 24 horas usando `SET NX` (`set(key, val, nx=True, ex=86400)`).
   - Se o evento já foi processado ou está em processamento, retorne status `200 OK` imediatamente sem duplicar operações financeiras ou de catálogo.

---

## 🌐 4. Proteção Anti-SSRF no Scraper de E-commerce

O robô de extração de produtos aceita URLs fornecidas por usuários. Para evitar ataques de *Server-Side Request Forgery* (SSRF) contra a infraestrutura interna da VPS:

### Regras Obrigatórias:
1. **Bloqueio de Esquemas Não-HTTP:**
   - Apenas esquemas `http://` e `https://` são permitidos. Bloqueie estritamente esquemas perigosos (`file://`, `gopher://`, `ftp://`, `data://`).
2. **Bloqueio de Faixas de IPs Privados & Metadados de Nuvem:**
   - NUNCA realize requisições HTTP para:
     - `127.0.0.0/8` (Loopback / Localhost)
     - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (Redes Privadas / RFC 1918)
     - `169.254.169.254` (Endpoints de Metadados de Cloud Providers como AWS/GCP/DigitalOcean)
     - `0.0.0.0`
3. **Timeouts Rígidos e Limites de Payload:**
   - Requisições do Scraper devem conter timeouts estritos (`timeout=15s`) e tamanho máximo de resposta (`max_content_length=10MB`) para prevenir ataques de negação de serviço por exaustão de memória.

---

## 🐳 5. Blindagem de Containers & VPS (Docker Hardening)

Ao realizar deploy em servidores VPS:

### Regras Obrigatórias:
1. **Execução Não-Root:**
   - Imagens Docker DEVEM rodar sob um usuário de privilégios mínimos (`USER appuser` no backend, `USER nginx` no frontend). Nunca execute processos de produção como `root`.
2. **Build Limpo com `.dockerignore`:**
   - As imagens Docker devem ignorar a pasta `.agents/`, arquivos `.git/`, diretórios de teste e arquivos `.env`.
3. **Headers de Segurança HTTP (Nginx / Proxy Reverso):**
   - O proxy Nginx DEVE enviar os seguintes cabeçalhos de segurança:
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY`
     - `X-XSS-Protection: 1; mode=block`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Content-Security-Policy` restritivo.
4. **Proteção contra H2C Smuggling:**
   - Remova cabeçalhos de `Upgrade` e `Connection` em rotas HTTP puras da API no Nginx.

---

## 🛡️ 6. Prevenção de Injeções & Sanitização (OWASP Top 10)

1. **Prevenção de XSS no Frontend:**
   - Nunca utilize `dangerouslySetInnerHTML` com conteúdo não sanitizado.
   - Scripts JSON-LD devem escapar o caractere `<` como `\u003c`.
2. **Prevenção de Injeção em Templates de E-mail:**
   - Templates Jinja2 DEVEM utilizar `select_autoescape(["html", "xml", "htm"])` e qualquer interpolação direta de fallback deve usar `html.escape()`.
3. **Prevenção de SQL Injection:**
   - Todas as queries devem ser compostas via SQLAlchemy ORM ou `text()` com bind parameters nomeados (`:param`).

---

## ⚡ 7. Rate Limiting & Proteção contra Exaustão Financeira

1. **Rate Limiting por IP / Tenant:**
   - Endpoints de autenticação (`/auth/login`, `/auth/register`) e extração (`/scraper/extract`) devem ter limites de taxa estritos via Redis (`SlowAPI` ou `RateLimiter`).
2. **Feature Gatekeeper & Validação de Créditos Pré-Execução:**
   - Antes de enviar mensagens caras para o RabbitMQ ou chamar o OpenRouter / DeepSeek, o sistema DEVE verificar se o tenant possui créditos suficientes na Carteira SaaS (`credits_balance > 0`).

---

## 📋 Checklist de Auditoria Rápida para o Agente

Ao criar ou editar qualquer funcionalidade, execute mentalmente este checklist:
- [ ] Todas as queries SQLAlchemy possuem `.where(Model.tenant_id == ...)`?
- [ ] Todas as chaves/tokens recebidos de clientes estão criptografados com AES-256 GCM?
- [ ] Nenhum segredo, senha ou token está sendo logado em texto puro?
- [ ] O endpoint de Webhook valida assinatura HMAC e trava duplicidade no Redis?
- [ ] O Scraper valida se a URL é pública e bloqueia IPs locais/privados?
- [ ] O `.dockerignore` está impedindo arquivos sensíveis de entrar na imagem?
- [ ] Os inputs do usuário são tipados e validados estritamente com Pydantic v2?
