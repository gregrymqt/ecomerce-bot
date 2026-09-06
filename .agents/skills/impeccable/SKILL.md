---
name: impeccable
description: "Padrões técnicos e arquiteturais para o desenvolvimento de frontend no ecossistema E-commerce Bot (React 18, TypeScript, Vite, Tailwind CSS). Impõe arquitetura em 4 camadas com separação estrita de responsabilidades (components/pages isolados de services via hooks), mobile-first, conformidade com acessibilidade WCAG 2.1 AA, touch targets de 44px e consumo resiliente de APIs REST e streaming SSE."
---

# 🎨 Frontend Engineering & UI Patterns — E-commerce Bot Web

Este documento define os padrões canônicos de arquitetura, acessibilidade e estilização para o aplicativo **`EcommerceBot.Web`**.

---

## 🏗️ 1. Arquitetura em 4 Camadas (Feature-Driven)

Todo módulo dentro de `src/features/` deve respeitar rigorosamente a separação de responsabilidades:

1. **Types (`features/{feature}/types/`):** Modelos de dados e contratos de payload em TypeScript estrito. Proibido o uso de `any`.
2. **Services (`features/{feature}/services/`):** Funções assíncronas de integração HTTP usando o `apiClient`. Nenhuma manipulação de estado do React deve residir aqui.
3. **Hooks (`features/{feature}/hooks/`):** Gerenciamento de estado local/global, mutações, paginação e consumo de streaming SSE.
4. **UI Components (`features/{feature}/components/`):** Componentes visuais desacoplados, consumindo dados exclusivamente via props ou hooks da feature.

### 🛡️ 1.1. Prevenção de Degradação por Injeção (Quality Gate: 350 Linhas)

Para evitar a degradação de contexto e acúmulo desordenado de código gerado por IA (conforme preconizado no *Vibe-Coding Toolkit*):
1. **Teto Rígido de 350 Linhas:** Nenhum arquivo de componente, hook ou serviço pode ultrapassar 350 linhas de código (excluindo linhas vazias e comentários), regra imposta com severidade `error` via ESLint (`max-lines`).
2. **Decomposição por "Costuras Naturais":**
   - Se um componente crescer, identifique seções auto-contidas (ex: formulário de lote, terminal de stream, cards de métricas, modais) e extraia-as em subcomponentes dedicados na mesma pasta `components/`.
   - Se um hook acumular múltiplos domínios de estado/efeito, extraia sub-hooks especializados.
3. **Proibição de Bypasses:** É estritamente proibido o uso de `/* eslint-disable max-lines */` ou truques artificiais de compactação. A modularização limpa é mandatória.

### 🚫 1.2. Barreira Arquitetural e Separação de Responsabilidade (Zero Tolerance)

Para manter testabilidade, manutenibilidade e evitar o acoplamento caótico entre camadas visuais e requisições HTTP:

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
│  • NUNCA utilizam hooks ou estado do React                   │
└──────────────────────────────┬───────────────────────────────┘
                               │ (HTTP com X-Tenant-ID)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  Core API Backend (.NET / ASP.NET Core)                      │
└──────────────────────────────────────────────────────────────┘
```

#### ❌ Violação de Responsabilidade (Antipadrão Proibido)
```tsx
// ❌ ERRADO: Componente ou Página importando e executando service diretamente
import { productService } from '../services/product.service';

export const ProductList = () => {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    // Violação de SoC: lógica de transporte e ciclo de rede acoplados à visualização
    productService.getProducts().then(setProducts).catch(console.error);
  }, []);

  return <div>{/* renderização */}</div>;
};
```

#### ✅ Padrão Canônico (Encapsulamento Estrito via Hook)
```typescript
// ✅ CORRETO: Hook orquestra o serviço, o ciclo de vida e os estados
// features/catalog/hooks/useProducts.ts
import { useState, useEffect, useCallback } from 'react';
import { productService } from '../services/product.service';
import type { Product } from '../types';

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await productService.getProducts();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar produtos');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, isLoading, error, refetch: fetchProducts };
};
```

```tsx
// ✅ CORRETO: Componente consome estritamente o hook da feature
// features/catalog/components/ProductList.tsx
import { useProducts } from '../hooks/useProducts';

export const ProductList = () => {
  const { products, isLoading, error } = useProducts();

  if (isLoading) return <p>Carregando catálogo...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <ul>
      {products.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  );
};
```

---

## 📱 2. Diretrizes Mobile-First & A11y (Acessibilidade)

1. **Touch Targets:**
   - Todo elemento interativo (botões, links, toggles, itens de menu) DEVE possuir dimensões mínimas de 44x44px (`min-h-[44px] min-w-[44px]`).
2. **Prevenção de Auto-Zoom no iOS:**
   - Todos os inputs de formulário, selects e textareas DEVEM possuir `font-size: 1rem` (16px / `text-base`). O uso de `text-sm` em inputs é proibido por acionar o zoom automático no Safari iOS.
3. **Contraste de Cores & Feedback:**
   - Respeitar a razão mínima de contraste de 4.5:1 para texto normal conforme WCAG 2.1 AA.
   - Estados de foco (`focus-visible:ring-2 focus-visible:outline-none`) são obrigatórios em todos os componentes interativos.
4. **Sanitização de Renderização:**
   - Proibido o uso de `dangerouslySetInnerHTML` com conteúdo dinâmico não sanitizado.

---

## 🎨 3. Design System & Tailwind CSS

1. **Componentes Base (`src/components/ui/`):**
   - Utilize a biblioteca interna baseada em Radix UI / Atomic Tokens (Button, Input, Dialog, DropdownMenu).
   - Não crie novos botões com estilos inline ou classes ad-hoc se o componente `Button` padrão puder ser estendido via variantes (`cva`).
2. **Densidade e Responsividade:**
   - Desenvolva pensando na menor viewport (360px de largura) e escale progressivamente via breakpoints Tailwind (`sm:`, `md:`, `lg:`, `xl:`).
   - Modais e sidebars devem possuir tratamento para travamento de scroll do body e fechar na tecla `Escape`.

---

## ⚡ 4. Integração com Core API & Streaming SSE

1. **Autenticação & Tenant:**
   - O `apiClient` (`src/lib/apiClient.ts`) envia credenciais por cookies `HttpOnly` e injeta automaticamente o header `X-Tenant-ID`. Nunca monte cabeçalhos de autenticação manualmente em services.
2. **Streaming em Tempo Real (SSE):**
   - O consumo do canal `/api/v1/demo/stream` deve ser encapsulado em hooks que garantem reconexão automática, limpeza de event listeners no desmonte do componente (`useEffect cleanup`) e tratamento de erros de conexão.

---

## 🛡️ 5. Resiliência de Runtime, Error Cause & React 19 Guardrails

1. **Preservação de Erros na Camada de Services (`preserve-caught-error`):**
   - Ao capturar erros no `try/catch` de services e relançar mensagens de erro de negócio, é obrigatório encadear a causa original através da sintaxe ES2022:
     ```typescript
     try {
       const response = await apiClient.get('/endpoint');
       return response.data;
     } catch (error) {
       throw new Error('Falha ao obter dados do endpoint.', { cause: error });
     }
     ```

2. **Isolamento de React Context para Fast Refresh (`only-export-components`):**
   - NUNCA exporte `createContext` no mesmo arquivo `.tsx` de um componente (`AuthProvider`, etc.).
   - Isole o contexto em um arquivo TypeScript puro (ex: `AuthContextDefinition.ts`) e o provider no componente `.tsx`.

3. **Prevenção de Cascading Renders (`set-state-in-effect`):**
   - Não dispare `setState` síncrono no início de `useEffect` se o valor já puder ser inicializado no `useState` inicial.
   - Derivação de dados e resets de formulário em modais devem ser feitos durante a renderização, via `key` de componente ou em handlers de evento (`onClose`/`onSubmit`), nunca em `useEffect` observando `isOpen`.

4. **Tipagem Estrita de Metadados e JSON-LD:**
   - Proibido o uso de `Record<string, any>`. Utilize `Record<string, unknown>` acompanhado de narrowing seguro.

5. **Checklist Pré-Flight de Separação de Responsabilidades (Obrigatório):**
   Antes de finalizar qualquer modificação ou entrega no frontend (`EcommerceBot.Web`), o agente DEVE verificar:
   - [ ] **Nenhum import de `services/` em componentes ou páginas:**
     Verifique se os arquivos em `src/features/**/components/` e `src/features/**/pages/` não importam caminhos de serviços (`services/` ou `*.service`).
   - [ ] **Nenhum import de `apiClient` fora de `services/`:**
     O cliente HTTP (`src/lib/apiClient.ts`) só pode ser importado por arquivos na pasta `services/`.
   - [ ] **Toda mutação e busca de API orquestrada por Hook:**
     Submissão de formulários, paginação, filtros e botões de ação devem invocar exclusivamente métodos e estados expostos por hooks customizados.
   - [ ] **Teto de 350 Linhas Respeitado:**
     Nenhum arquivo modificado ultrapassa o limite de 350 linhas de código imposto pelo ESLint.