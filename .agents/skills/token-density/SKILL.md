---
name: token-density
description: "Impõe densidade máxima de sinal e economia agressiva de tokens na janela de contexto de agentes de IA. Elimina conversação desnecessária, formata saídas de comandos e logs de forma limpa e compacta (RTK pattern), e preserva a memória operacional focada estritamente em código, decisões arquiteturais e contratos de dados."
---

# ⚡ Token Density & Noise Sanitization — Guia de Alta Densidade

Este guia define as regras operacionais para maximizar a relação sinal/ruído (Signal-to-Noise Ratio) e evitar a perda de contexto (*Lost in the Middle*) em tarefas extensas.

---

## 🚫 1. Eliminação de Ruído Conversacional (Zero-Fluff Rule)

1. **Sem Preâmbulos:**
   - Proibido iniciar respostas com frases óbvias ou descritivas ("Com certeza, agora vou analisar...", "Aqui está o arquivo alterado...").
   - Inicie a resposta diretamente pela ação técnica ou diff objetivo.
2. **Respostas Estruturadas:**
   - Utilize listas curtas, blocos de alteração pontuais e tabelas de impacto.
3. **Preservação de Nuance Técnica:**
   - Economize em saudações e enrolações. Mantenha 100% de integridade em contratos de API, schemas SQL e checagens de erro.

---

## 🧹 2. Sanitização de Saídas de Terminal e Ferramentas (RTK Pattern)

Saídas massivas de compiladores, analisadores e linters poluem irreversivelmente o contexto.

### Diretrizes de Execução:
1. **Comandos Cirúrgicos:**
   - Ao rodar testes .NET, filtre a suite: `dotnet test --filter FullyQualifiedName~CatalogTests`.
   - Ao compilar, capture apenas warnings e erros, omitindo cabeçalhos estáticos da CLI.
2. **Resumo Estruturado de Logs:**
   Ao reportar resultados de build, extraia apenas:
   - **Status:** Sucesso ou Código de Erro
   - **Alvos:** Projeto e tempo decorrido
   - **Erros / Warnings:** Arquivo exato, linha e código da falha

---

## 🎯 3. Leitura e Edição Cirúrgica de Código

1. **Inspeção por Janela:**
   - Evite inspecionar arquivos inteiros quando apenas um método ou interface precisa de ajuste. Localize o símbolo e leia apenas as linhas relevantes.
2. **Substituições Pontuais:**
   - Mantenha blocos de substituição estritamente focados nas linhas modificadas. Não reescreva arquivos íntegros para alterar poucas instruções.

---

## 📊 4. Tabela de Eficiência de Tokens

| Prática Ineficiente (Ruído) | Prática Canônica (Alta Densidade) |
|---|---|
| Colar saída completa de 1.000 linhas de build | Reportar status, projeto e mensagem de erro exata com arquivo/linha |
| Explicar a intenção antes de rodar o comando | Executar o comando e apresentar o resultado diretamente |
| Carregar classe inteira de 300 linhas | Inspecionar apenas as assinaturas e o método alvo |
| Repetir regras canônicas descritas no `AGENTS.md` | Apontar a regra correspondente de forma sintética |
