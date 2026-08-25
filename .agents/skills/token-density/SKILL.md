---
name: token-density
description: "Impõe densidade máxima de sinal e economia agressiva de tokens na janela de contexto de agentes de IA. Elimina conversação desnecessária, formata saídas de comandos e logs de forma limpa e compacta (RTK pattern), e preserva a memória operacional do agente focada estritamente em código, decisões arquiteturais e regras de negócio."
---

# ⚡ Token Density & Noise Sanitization — Guia de Alta Densidade

Este guia define as regras operacionais para **maximizar a relação sinal/ruído (Signal-to-Noise Ratio)** e evitar a exaustão prematura da janela de contexto do agente durante tarefas de longa duração.

---

## 🚫 1. Eliminação de Ruído Conversacional (Zero-Fluff Rule)

Em interações de engenharia, cada token desperdiçado com preâmbulos genéricos aproxima o agente do limite de compactação de contexto (*Lost in the Middle*).

### Regras de Redação:
1. **Sem Preâmbulos Óbvios:**
   - Evite frases como *"Com certeza! Agora vou analisar o código do arquivo X para então fazer a alteração que você solicitou..."*.
   - Vá direto à ação técnica ou à resposta direta: *"Alterando a query de paginação em `catalog_repository.py`..."*.
2. **Respostas Estruturadas e Diretas:**
   - Utilize listas com bullets curtos, tabelas comparativas e blocos de diffs objetivos.
3. **Preservação de Nuance Técnica:**
   - A concisão NUNCA deve remover explicações críticas de regras de negócio, decisões de segurança ou contratos de dados. Economize em palavras vazias, não em precisão técnica.

---

## 🧹 2. Sanitização de Saídas de Terminal e Ferramentas (RTK Pattern)

A maior fonte de poluição de contexto são saídas massivas de builds, suites de testes e linters (1.000+ linhas de texto repetitivo).

### Diretrizes de Execução de Comandos:
1. **Comandos Focados e Filtrados:**
   - Ao rodar testes, use flags para executar apenas o arquivo ou caso de teste em edição (ex: `pytest tests/unit/test_catalog.py -k test_filter`).
   - Ao rodar linters ou verificadores, capture e resuma apenas as falhas reais, sem imprimir o histórico de arquivos ignorados.
2. **Resumo Estruturado de Logs:**
   - Ao reportar a saída de um build ou linter, extraia apenas:
     - **Status:** Sucesso ou Código de Erro
     - **Métricas:** Número de arquivos analisados / tempo de build
     - **Erros / Warnings:** O arquivo, linha e mensagem de erro exata

---

## 🎯 3. Estratégia de Leitura Cirúrgica de Código

1. **Leitura com Escopo Definido (`view_file` com StartLine / EndLine):**
   - Evite carregar arquivos inteiros de 500+ linhas quando você só precisa inspecionar uma função ou interface específica.
   - Utilize `grep_search` ou `find_by_name` para localizar o símbolo exato e visualize apenas as 50-100 linhas ao redor do trecho alvo.
2. **Substituições Precisas (`replace_file_content`):**
   - Mantenha os blocos `TargetContent` e `ReplacementContent` estritamente contíguos e enxutos.
   - Não reescreva classes ou arquivos inteiros se apenas 3 linhas mudaram.

---

## 📊 4. Tabela de Eficiência de Tokens

| Prática Ruim (Poluição de Contexto) | Prática Recomendada (Alta Densidade) |
|---|---|
| Colar 400 linhas de stacktrace no chat | Extrair apenas a linha raiz da exceção e o arquivo causador |
| Descrever passo a passo antes de executar uma ferramenta | Executar a ferramenta imediatamente e apresentar o resultado |
| Carregar o arquivo inteiro para ler um único método | Usar `StartLine` e `EndLine` para ler apenas o método alvo |
| Repetir explicações teóricas que já estão no `AGENTS.md` | Citar a regra com link direto para a seção do documento |
