---
name: impact-analyzer
description: "Mapeia deterministamente o grafo de dependências (AST) e calcula o Raio de Impacto (Blast Radius) antes de qualquer refatoração. Rastreia cadeias completas de chamadas entre Backend (Model -> Repo -> Service -> Router) e Frontend (API Client -> Service -> Hook -> Component), prevenindo quebras silenciosas e regressões em cascata."
---

# 🕸️ Impact Analyzer — Grafo de Dependências & Raio de Impacto (Blast Radius)

Esta skill define o protocolo para **rastreamento determinístico de dependências baseadas em AST (Abstract Syntax Tree)**, eliminando suposições e evitando quebras de código causadas por refatorações incompletas.

---

## 🎯 1. O Princípio do Raio de Impacto (*Blast Radius*)

Qualquer alteração em um contrato de dados, assinatura de função ou nome de propriedade tem um **raio de impacto** no sistema:

$$\text{Alteração no Nó Raiz } (X) \implies \text{Impacto Direto nos Nós Consumidores } [A, B, C] \implies \text{Impacto Indireto } [D, E]$$

O agente **NUNCA deve finalizar uma tarefa alterando apenas o nó raiz sem verificar e atualizar todos os nós do raio de impacto**.

---

## ⛓️ 2. A Cadeia Canônica de Rastreamento (Full-Stack Flow)

No ecossistema **E-commerce Bot**, a cadeia de dependências segue 7 níveis estritos:

```
[1. Entidade / DB Model] (SQLAlchemy ORM)
         │
         ▼
[2. Schemas / DTOs] (Pydantic v2)
         │
         ▼
[3. Repositório] (AsyncSession Queries)
         │
         ▼
[4. Serviço de Aplicação / Dispatcher] (Regras de Negócio & Filas)
         │
         ▼
[5. Roteador FastAPI / Endpoints] (HTTP Schemas & Status)
         │
         ▼ (Contrato HTTP / JSON)
[6. Frontend Service & Types] (TypeScript Interfaces & apiClient)
         │
         ▼
[7. Custom Hook & Componentes UI] (use<Feature> -> Component.tsx)
```

---

## 🔍 3. Protocolo de 4 Passos para Refatorações Seguras

Antes de alterar qualquer assinatura de método, nome de campo ou tipo:

### Passo 1: Localização do Símbolo
- Localize todas as ocorrências do símbolo usando `grep_search` nos diretórios do backend e frontend.
  ```json
  {"Query": "isFeatureLocked", "SearchPath": "c:/Users/digob/Desktop/ecommerce-bot/ecom-autobot-web/src"}
  ```

### Passo 2: Mapeamento dos Consumidores (Grafo de Chamadas)
- Identifique quem são os consumidores diretos:
  - Quais arquivos importam este símbolo?
  - Quais testes unitários ou de integração validam este comportamento?
  - Há exportações públicas em arquivos `index.ts` ou `__init__.py`?

### Passo 3: Execução Sincronizada da Alteração
- Aplique a alteração no nó de origem (ex: DTO Pydantic / Interface TypeScript).
- Imediatamente propague as alterações para todos os nós consumidores do grafo.

### Passo 4: Verificação de Integridade em Tempo de Compilação
- Backend: Verifique a importação e tipagem com Python (`python -m py_compile ...`).
- Frontend: Execute o typechecker e build do TypeScript (`npm run build`).

---

## 📋 Checklist Rápido de Impacto

- [ ] A alteração mudou o nome ou tipo de algum campo em um Schema/DTO?
- [ ] O contrato TypeScript no frontend está perfeitamente alinhado com o DTO do backend?
- [ ] Todos os arquivos que importam o método/componente alterado foram inspecionados?
- [ ] Os mocks e payloads dos testes unitários foram atualizados?
- [ ] O build do frontend (`npm run build`) e compilação do backend executaram com 0 erros?
