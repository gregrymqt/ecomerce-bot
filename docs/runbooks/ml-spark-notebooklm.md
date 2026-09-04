# 🔬 Runbook: Pipeline Tripartite de ML (Google Spark + Python Worker + NotebookLM)

Este runbook orienta engenheiros e agentes de IA sobre o ciclo de vida analítico e preditivo do **E-commerce Bot**, detalhando a separação de responsabilidades entre treinamento em lote (*Batch*), inferência em tempo real (*Runtime*) e ambiente de estudo cognitivo (*Knowledge*).

---

## 🏛️ 1. Diagrama de Fluxo e Fronteiras

```text
┌────────────────────────────────────────────────────────┐
│         1. BATCH & DATA PLANE (Google Spark)           │
│  • Ambiente: PySpark (Dataproc ou Job Local)          │
│  • Entrada: Exportação histórica de transações / RFM   │
│  • Processamento: Normalização, Agrupamento e Treino   │
│  • Saída 1: Artefato serializado (.joblib / .onnx)     │
│  • Saída 2: Relatório consolidado em Markdown          │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼ Artefato                  ▼ Métricas & Relatório
┌───────────────────────────┐   ┌───────────────────────────┐
│ 2. RUNTIME INFERENCE      │   │ 3. KNOWLEDGE & RESEARCH   │
│    (Python Worker)        │   │    (Google NotebookLM)    │
│  • EcommerceBot.Worker    │   │  • Interface Cognitiva    │
│  • Carrega .joblib/.onnx  │   │  • Perguntas & Insights   │
│  • Inferência em < 50ms   │   │  • Análise de Churn / RFM │
│  • Consome queue:analytics│   │  • Zero impacto em prod   │
└───────────────────────────┘   └───────────────────────────┘
```

---

## ⚙️ 2. Guia de Operação

### Passo 1: Executar Job PySpark de Treinamento / Calibração
- Execute o script de agregação para recalcular centróides de RFM ou pesos de Churn:
```bash
# Execução do job batch (local ou no Google Cloud Dataproc)
python -m app.ml.spark.batch_train --output-dir app/ml/models/artifacts/
```
- O job gera:
  1. `rfm_pipeline.joblib` / `churn_model.onnx` (pesos atualizados).
  2. `metrics_report_YYYYMMDD.md` (distribuição de clusters, silhouette score, matriz de confusão e drift de dados).

### Passo 2: Carga de Modelo no Python Worker (`EcommerceBot.Worker`)
- O microsserviço `EcommerceBot.Worker` inicializa os modelos em memória:
  - Se existir o artefato `.joblib` ou `.onnx` atualizado em `app/ml/models/artifacts/`, ele utiliza os pesos otimizados.
  - Se não existir, ele utiliza o fallback heurístico em tempo real do Scikit-Learn.
- **Regra Inviolável:** O worker nunca treina do zero durante uma requisição HTTP ou evento de fila. Ele faz apenas `.predict()` ou `.transform()`.

### Passo 3: Ingestão de Conhecimento e Métricas no Google NotebookLM
1. **Relatórios Periódicos de Métricas de Vendas & RFM:**
   - Faça o upload do arquivo `metrics_report_YYYYMMDD.md` gerado no passo 1 diretamente no seu caderno do **NotebookLM**.
2. **Master Knowledge Pack de Engenharia & Arquitetura (Card 83):**
   - Para alimentar o NotebookLM com as especificações de APIs externas (Shopify, Nuvemshop, Mercado Pago, OpenRouter), dicionário de dados SQL Server, modelos analíticos e topologia de filas, execute:
     ```powershell
     & "EcommerceBot.Worker\.venv\Scripts\python.exe" .agents\scripts\generate_notebooklm_pack.py
     ```
   - O comando gera:
     - Os módulos individuais em `docs/notebooklm/pack/` (01 a 04).
     - O **Master Bundle consolidado** em `docs/notebooklm/ecosystem_knowledge_pack.md`.
   - Faça o upload do arquivo `ecosystem_knowledge_pack.md` no seu caderno do NotebookLM como a **Fonte Única da Verdade Técnica** para consultas de engenharia sem alucinações.

---

## ⛔ Regras de Segurança
1. **Zero PII no NotebookLM:** Dados exportados para relatórios de estudo no NotebookLM devem ser estritamente agregados ou pseudonimizados (IDs de clientes com hash SHA-256, sem nomes, CPFs ou cartões).
2. **Zero Acesso a Banco no Python:** O Spark ou os jobs de extração leem de dumps ou réplicas de leitura, nunca através do container do Python Worker.
