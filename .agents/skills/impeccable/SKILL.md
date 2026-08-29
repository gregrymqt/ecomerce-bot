---
name: impeccable
description: "Padrões técnicos e arquiteturais para o desenvolvimento de frontend no ecossistema E-commerce Bot (React 18, TypeScript, Vite, Tailwind CSS). Impõe arquitetura em 4 camadas, mobile-first, conformidade com acessibilidade WCAG 2.1 AA, touch targets de 44px e consumo resiliente de APIs REST e streaming SSE."
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