---
name: impeccable
description: "Padrões técnicos e arquiteturais para o desenvolvimento frontend no ecossistema E-commerce Bot (React 18/19, TypeScript, Vite, Tailwind CSS). Impõe arquitetura em 4 camadas com separação estrita de responsabilidades, mobile-first, acessibilidade WCAG 2.1 AA, touch targets de 44px, code-splitting, prevenção de memory leaks via AbortController, governança anti-proliferação de componentes e organização hierárquica de pastas."
---

# 🎨 Frontend Engineering & UI Patterns — E-commerce Bot Web

Este documento define os padrões canônicos de arquitetura, acessibilidade, performance, ciclo de vida e governança de código para o aplicativo `EcommerceBot.Web`.

---

## 🏗️ 1. Arquitetura em 4 Camadas (Feature-Driven)

Todo módulo dentro de `src/features/` deve respeitar rigorosamente a separação de responsabilidades:

- **Types (`features/{feature}/types/`):** Modelos de dados e contratos de payload em TypeScript estrito. Proibido o uso de `any`.
- **Services (`features/{feature}/services/`):** Funções assíncronas puras de integração HTTP usando o `apiClient`. Devem aceitar `AbortSignal` para cancelamento de requisições. Nenhuma manipulação de estado do React reside aqui.
- **Hooks (`features/{feature}/hooks/`):** Gerenciamento de estado local/global, ciclo de vida, cancelamento de requisições, paginação, mutações e consumo de streaming SSE.
- **UI Components (`features/{feature}/components/`):** Componentes visuais declarativos e desacoplados, consumindo dados exclusivamente via props ou hooks da feature.

---

### 🛡️ 1.1. Prevenção de Degradação por Injeção (Quality Gate: 350 Linhas)

- **Teto Rígido de 350 Linhas:** Nenhum arquivo de componente, hook ou serviço pode ultrapassar 350 linhas de código (excluindo linhas vazias e comentários), regra imposta com severidade `error` via ESLint (`max-lines`).
- **Decomposição por "Costuras Naturais":**
  - Se um componente crescer, extraia subcomponentes dedicados na mesma pasta `components/` (ex: cards de métricas, itens de listagem, modais, formulários de lote).
  - Se um hook acumular múltiplos domínios de estado ou efeitos, particione-o em sub-hooks especializados.
- **Proibição de Bypasses:** É estritamente proibido o uso de `/* eslint-disable max-lines */` ou truques artificiais de compactação. A modularização limpa é mandatória.

---

### 🧩 1.2. Justificativa de Existência & Princípio Anti-Proliferação (Evitar Componentes Inúteis)

Antes de criar qualquer novo arquivo `.tsx`, o desenvolvedor/agente DEVE responder a dois critérios de validação:

#### Critério 1: "Por que criar outro se algo parecido já existe?" (Auditoria de Reuso)
- **Regra de Ouro:** É expressamente proibido criar um novo componente se já existir um elemento estrutural equivalente no Design System (`src/components/ui/`) ou na pasta `components/` compartilhada.
- Se o componente existente cobrir ~80% da necessidade, não duplique. Estenda-o utilizando composição (`children`), variantes do Tailwind via `cva` ou propriedades opcionais de configuração.
- Componentes duplicados com variações cosméticas mínimas (ex: criar `DangerButton.tsx` quando já existe `Button.tsx` com prop `variant="destructive"`) são considerados antipadrões críticos.

#### Critério 2: "Esse componente realmente faz sentido existir?" (Anti-Abstração Prematura)
- Não crie componentes que sejam apenas "passadores de propriedades" (*prop-drilling wrappers*) ou que apenas envelopem uma única tag HTML sem adicionar lógica de estado, estilo complexo reutilizável ou ganho de legibilidade.
- **Regra do Inline vs. Componente:** Mantenha a renderização inline caso o trecho de JSX seja usado em apenas um lugar, tenha menos de 25 linhas e não possua ciclo de vida próprio. Componentize apenas se houver reuso comprovado (Regra dos 3 Usos), isolamento de re-renderização pesada ou decomposição mandatória pelo teto de 350 linhas.

---

### 📁 1.3. Governança de Estrutura e Limite de Sprawl em components/

Para evitar diretórios com dezenas de arquivos soltos que degradam a navegabilidade e a manutenção:

- **Limite de Arquivos Raiz (Teto de 8 Componentes):**
  Nenhuma pasta `components/` (seja em `src/components/` ou em `src/features/{feature}/components/`) pode ter mais de 8 arquivos `.tsx` soltos na raiz.

- **Subdivisão Categórica Mandatória:**
  Ao atingir 8 componentes em uma pasta, é obrigatório criar subdiretórios semânticos para agrupamento lógico, por exemplo:
  - `components/cards/` (ex: `ProductCard.tsx`, `SummaryCard.tsx`)
  - `components/forms/` (ex: `ProductFilterForm.tsx`, `ProductPriceInput.tsx`)
  - `components/modals/` ou `components/dialogs/` (ex: `ConfirmDeleteDialog.tsx`)
  - `components/tables/` (ex: `ProductTable.tsx`, `ProductTableRow.tsx`)
  - `components/skeletons/` (ex: `ProductCardSkeleton.tsx`)

- **Escopo Local de Subcomponentes Exclusivos:**
  Se um subcomponente for utilizado exclusivamente por um único componente pai complexo (ex: `OrderTimelineItem.tsx` utilizado apenas por `OrderTimeline.tsx`), agrupe-os em uma pasta dedicada com o nome do componente principal:

```text
components/order-timeline/
├── OrderTimeline.tsx
├── OrderTimelineItem.tsx
└── OrderTimelineSkeleton.tsx
```


### 🚫 1.4. Barreira Arquitetural e Separação de Responsabilidade (Zero Tolerance)

```text
┌──────────────────────────────────────────────────────────────┐
│  Páginas & Componentes de UI (pages/ e components/)          │
│  • Exclusivamente declarativos e visuais                     │
│  • Consomem APENAS hooks customizados e props                │
│  ⛔ PROIBIDO importar services ou chamar APIs diretamente    │
└──────────────────────────────┬───────────────────────────────┘
                               │ (Consome dados & callbacks)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  Custom Hooks (hooks/)                                       │
│  • ÚNICA camada autorizada a orquestrar services             │
│  • Orquestra estado (useState, useReducer), efeitos e cache  │
│  • Trata loading, erros amigáveis, paginação e mutações      │
└──────────────────────────────┬───────────────────────────────┘
                               │ (Invoca métodos HTTP tipados)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  Services (services/)                                        │
│  • Funções assíncronas puras consumindo apiClient            │
│  • NUNCA utilizam hooks ou retêm referências de estado       │
└──────────────────────────────┬───────────────────────────────┘
                               │ (HTTP com X-Tenant-ID & AbortSignal)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  Core API Backend (.NET / ASP.NET Core)                      │
└──────────────────────────────────────────────────────────────┘
```

#### ❌ Violação de Responsabilidade (Antipadrão Proibido)

```typescript
// ❌ ERRADO: Componente importando service diretamente e acoplando ciclo de vida
import { productService } from '../services/product.service';

export const ProductList = () => {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    // Violação de SoC e vazamento de memória se o componente desmontar durante o fetch
    productService.getProducts().then(setProducts).catch(console.error);
  }, []);

  return <div>{/* renderização */}</div>;
};
```

#### ✅ Padrão Canônico (Encapsulamento Estrito via Hook com AbortController)

```typescript
// ✅ CORRETO: Hook orquestra o serviço, estado e cancelamento de memória
// features/catalog/hooks/useProducts.ts
import { useState, useEffect, useCallback } from 'react';
import { productService } from '../services/product.service';
import type { Product } from '../types';

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await productService.getProducts(signal);
      setProducts(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Erro ao carregar produtos');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchProducts(controller.signal);

    // Limpeza mandatória para evitar vazamentos de memória
    return () => controller.abort();
  }, [fetchProducts]);

  return { products, isLoading, error, refetch: () => fetchProducts() };
};
```

```tsx
// ✅ CORRETO: Componente consome estritamente o hook e usa Skeletons
// features/catalog/components/ProductList.tsx
import { useProducts } from '../hooks/useProducts';
import { ProductCardSkeleton } from './skeletons/ProductCardSkeleton';
import { ProductCard } from './cards/ProductCard';

export const ProductList = () => {
  const { products, isLoading, error, refetch } = useProducts();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="p-4 rounded-lg bg-red-50 text-red-700">
        <p>{error}</p>
        <button onClick={refetch} className="mt-2 text-sm font-semibold underline">
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ul>
  );
};
```
---

## 📱 2. Diretrizes Mobile-First, UI/UX & Acessibilidade

- **Touch Targets:**
  Todo elemento interativo (botões, links, toggles, paginação) DEVE possuir dimensões mínimas de 44x44px (`min-h-[44px] min-w-[44px]`).

- **Prevenção de Auto-Zoom no iOS:**
  Todos os inputs de formulário, selects e textareas DEVEM possuir `font-size: 1rem` (16px / `text-base`). O uso de `text-sm` em campos editáveis é estritamente proibido.

- **Contraste de Cores & Foco:**
  - Respeitar a razão mínima de contraste de 4.5:1 para texto padrão conforme WCAG 2.1 AA.
  - Anéis de foco interativo (`focus-visible:ring-2 focus-visible:outline-none`) são obrigatórios.

- **Estados de Carregamento Estruturados (Skeletons):**
  É proibido exibir mensagens textuais estáticas como `<p>Carregando...</p>`. Utilize Skeleton Screens que repliquem a geometria final do layout para mitigar o tempo percebido de resposta.

- **Estabilidade Visual & Prevenção de Layout Shift (CLS):**
  Banners, mídias e imagens de produtos devem conter dimensões intrínsecas explícitas (`width` e `height`) ou classes utilitárias de aspecto (`aspect-video`, `aspect-square`).

- **Fronteiras de Erro Resilientes (Error Boundaries):**
  Páginas e blocos dinâmicos complexos (como feeds de métricas ou listagens de produtos) devem ser envelopados por `ErrorBoundary`. Uma falha localizada não deve produzir tela em branco global.

- **Sanitização de Renderização:**
  Proibido o uso de `dangerouslySetInnerHTML` com conteúdo não sanitizado via `DOMPurify`.

---

## ⚡ 3. Performance de Renderização & Ciclo de Vida

- **Localização de Estado (State Colocation):**
  Estados efêmeros (como digitação em buscas, abertura de seletores e filtros locais) devem residir no componente folha correspondente. Não propague estados para contextos globais se apenas um componente filho os consome.

- **Memoização Criteriosa (`memo`, `useMemo`, `useCallback`):**
  - Não aplique memoização indiscriminada. Utilize `useMemo` apenas em transformações de coleções pesadas (>100 itens) ou cálculos de alta complexidade computacional.
  - Aplique `React.memo` prioritariamente em componentes de listas, dashboards ou tabelas que sofrem renderizações frequentes por atualização de componentes irmãos.

- **Virtualização de Listas e Tabelas:**
  Qualquer catálogo, log de eventos ou tabela que possa exibir mais de 50 nós simultâneos DEVE utilizar virtualização via `@tanstack/react-virtual`, prevenindo saturação da árvore DOM e quedas de FPS durante a rolagem.

- **Desalocação de Recursos em Componentes:**
  Todo listener de DOM (`window.addEventListener`), temporizador (`setInterval`) ou conexão aberta deve ser limpo explicitamente na função de retorno do `useEffect`.

---

## 📦 4. Otimização de Tamanho de Pacote (Bundle Size) & Código

- **Code-Splitting Mandatório por Rota:**
  Todas as visualizações contidas em `src/pages/` devem ser carregadas sob demanda via `React.lazy()` e encapsuladas por `Suspense` com fallbacks baseados em skeletons estruturais.

- **Importações Dinâmicas de Módulos Pesados:**
  Bibliotecas com peso significativo (ex: geradores de relatórios PDF, leitores XLSX, editores Markdown, visualizadores de gráficos) não devem compor o chunk inicial. Devem ser requisitadas via importação dinâmica assíncrona (`await import(...)`) no momento do disparo da ação.

- **Importações Pontuais e Tree-Shaking:**
  É proibido o uso de importações universais de pacotes utilitários (`import _ from 'lodash'` ou `import * as Icons from 'lucide-react'`). Importe exclusivamente os membros nomeados necessários (`import debounce from 'lodash-es/debounce'`).

- **Auditoria de Chunks:**
  O projeto deve manter integração com o plugin de visualização de pacotes do Vite (`rollup-plugin-visualizer`) para validar que nenhum chunk de página ultrapasse 150 kB gzipped.

---

## 🎨 5. Design System & Tailwind CSS

- **Componentes Base (`src/components/ui/`):**
  - Utilize a biblioteca interna baseada em Radix UI com variantes construídas via `class-variance-authority` (`cva`).
  - É proibido recriar botões, inputs ou badges com classes ad-hoc caso o componente base possa ser parametrizado.

- **Densidade e Responsividade:**
  - Projete a partir da menor viewport móvel (360px) e escale progressivamente via breakpoints Tailwind (`sm:`, `md:`, `lg:`, `xl:`).
  - Modais, gavetas e sidebars devem travar a rolagem do elemento raiz (`body`) e possuir listener para fechamento na tecla `Escape`.

---

## 🔌 6. Integração com Core API & Streaming SSE

- **Autenticação & Injeção de Contexto:**
  O `apiClient` (`src/lib/apiClient.ts`) injeta automaticamente cookies `HttpOnly` e o header `X-Tenant-ID`. É proibido inserir tokens ou cabeçalhos manuais dentro dos arquivos de serviço.

- **Propagação de AbortSignal em Services:**
  Toda função em `services/` deve aceitar opcionalmente um parâmetro `signal?: AbortSignal` e repassá-lo na configuração da requisição do `apiClient`.

- **Streaming em Tempo Real (SSE):**
  O consumo do canal `/api/v1/demo/stream` deve ser isolado em hooks dedicados com suporte a reconexão automática com backoff exponencial e encerramento compulsório da conexão (`eventSource.close()`) no desmonte.

---

## 🛡️ 7. Resiliência de Runtime & React Guardrails

- **Preservação da Causa Raiz de Erros (`preserve-caught-error`):**
  Ao relançar erros dentro da camada de services, encadeie o erro de origem com a propriedade `cause`:

```typescript
try {
  const response = await apiClient.get('/products', { signal });
  return response.data;
} catch (error) {
  throw new Error('Falha ao obter produtos.', { cause: error });
}
```

- **Isolamento de React Context para Fast Refresh (`only-export-components`):**
  NUNCA exporte `createContext` no mesmo arquivo `.tsx` de um componente (`AuthProvider.tsx`). O contexto deve residir em um arquivo de definição TypeScript puro (ex: `AuthContextDefinition.ts`).

- **Prevenção de Cascading Renders (`set-state-in-effect`):**
  É proibido disparar `setState` síncrono no corpo de um `useEffect` para fins de derivação de estado. Transforme os dados diretamente durante a renderização ou force a reinicialização limpa do componente via prop `key`.

- **Tipagem Estrita de Estruturas Genéricas:**
  É proibido o uso de `Record<string, any>`. Utilize `Record<string, unknown>` com checagem de tipos (*type narrowing*).

---

## 📋 8. Checklist Pré-Flight de Engenharia (Obrigatório)

Antes de aprovar ou finalizar qualquer alteração no frontend (`EcommerceBot.Web`), valide:

- [ ] **Anti-Proliferação de Componentes:** Foi verificado se já não existe um componente similar no Design System ou na feature antes de criar um novo? O novo componente tem razão real de existir (não é apenas um invólucro de 1 tag)?
- [ ] **Organização de Pastas (Teto de 8 Arquivos):** A pasta `components/` possui no máximo 8 arquivos soltos na raiz? Se passou disso, os componentes foram agrupados em subpastas semânticas (`cards/`, `forms/`, `dialogs/`, etc.)?
- [ ] **Barreira de Services:** Nenhum componente ou página importa caminhos de `services/` ou do `apiClient`.
- [ ] **Cancelamento de Rede:** Requisições assíncronas em hooks repassam `AbortSignal` e acionam `controller.abort()` no retorno do `useEffect`.
- [ ] **Lazy Loading:** Rotas e ferramentas auxiliares pesadas utilizam `React.lazy()` e importações dinâmicas.
- [ ] **Experiência de Carregamento:** Não há textos simples de espera; Skeleton Screens adequados são exibidos.
- [ ] **Virtualização:** Listas com possibilidade de ultrapassar 50 registros utilizam virtualização.
- [ ] **Acessibilidade:** Elementos clicáveis possuem no mínimo 44x44px e inputs mantêm 16px (`text-base`).
- [ ] **Teto de 350 Linhas:** Nenhum arquivo modificado ultrapassa o limite rígido de 350 linhas imposto pelo ESLint.