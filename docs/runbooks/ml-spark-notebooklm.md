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

## 📡 3. Observabilidade e Diagnóstico via Servidor MCP Central

O servidor central de diagnósticos (`EcommerceBot.Diagnostics.Mcp`) fornece monitoramento de baixo acoplamento e zero overhead para os modelos e jobs do ecossistema:

### 3.1. Arquitetura Desacoplada de Telemetria
- O Spark Batch Pipeline grava metadados determinísticos em formato JSON (`rfm_pipeline_metadata.json`) junto aos pesos serializados (`rfm_pipeline.joblib`).
- O servidor MCP em C# lê diretamente o manifesto em disco em **< 5ms**, sem invocar subprocessos Python ou sobrecarregar a memória do host.

### 3.2. Ferramentas de Diagnóstico (MCP Tools)
1. **`inspect_ml_artifacts` (`MlModelArtifactsTool`):**
   - Inspeciona o diretório `EcommerceBot.Worker/app/ml/models/artifacts/`.
   - Verifica existência, integridade, hashes SHA-256 e datas de modificação de modelos serializados (`.joblib`, `.onnx`).
2. **`check_spark_pipeline_status` (`SparkPipelineStatusTool`):**
   - Lê `rfm_pipeline_metadata.json`.
   - Retorna métricas analíticas vitais: contagem de amostras, Silhouette Score, distribuição de centróides e status da execução.

### 3.3. Recursos MCP (MCP Resources)
- **`resource://ml/latest-metrics` (`RunbookResourceProvider`):**
  - Expõe o conteúdo textual de `docs/notebooklm/reports/latest_metrics_report.md` diretamente no protocolo MCP.
  - Permite que agentes e LLMs consultem relatórios analíticos consolidados de forma nativa e contextualizada.

---

## ☁️ 4. MLOps & Governança de Artefatos no Cloudflare R2

Para evitar o inchaço do repositório Git (*Repository Bloat*) e viabilizar o deploy ágil em VPS, os pesos binários de Machine Learning (`.joblib`, `.onnx`, `.pkl`) são geridos externamente através do **Cloudflare R2** (S3-compatible Object Storage).

### 4.1. Estrutura do Bucket no Cloudflare R2
Os artefatos são sincronizados sob duas árvores de diretórios:
- **Histórico Versionado:** `s3://${R2_BUCKET}/ml-artifacts/rfm/${TIMESTAMP}/` (preserva cada execução para rollback e auditoria de drift).
- **Ponteiro de Produção:** `s3://${R2_BUCKET}/ml-artifacts/rfm/latest/` (sempre aponta para o conjunto de pesos e metadados mais recente).

### 4.2. Upload dos Artefatos após Calibração (Spark -> R2)
- **Via CLI do Spark (Python):**
  ```powershell
  & "EcommerceBot.Worker\.venv\Scripts\python.exe" -m app.ml.spark.run_batch --clusters 4 --upload-r2
  ```
- **Via Script Shell (Terminal / CI/CD):**
  ```bash
  chmod +x infra/prod/scripts/upload_ml_artifacts_r2.sh
  ./infra/prod/scripts/upload_ml_artifacts_r2.sh
  ```

### 4.3. Sincronização e Hot-Reload na VPS (R2 -> Worker)
1. **Script de Sincronização:**
   - Execute ou agende no crontab da VPS (ex: de hora em hora):
     ```bash
     0 * * * * /bin/bash /caminho/infra/prod/scripts/sync_ml_artifacts_r2.sh >> /var/log/ml_artifacts_sync.log 2>&1
     ```
2. **Volume Docker Persistente:**
   - O serviço `worker` no `docker-compose.prod.yml` monta o volume `worker-prod-artifacts:/app/app/ml/models/artifacts`.
3. **Hot-Reload em Tempo Real com Zero Downtime:**
   - O `RFMSegmentation` no Worker monitora o timestamp de modificação (`mtime`) do arquivo `rfm_pipeline.joblib`.
   - Quando o script de sync baixa novos pesos, o Worker detecta a alteração e recarrega o pipeline em memória instantaneamente na próxima inferência, **sem reiniciar o container**.

---

## ⛔ Regras de Segurança & Governança
1. **PROIBIDO versionar binários de ML no Git:** Pesos serializados (`.joblib`, `.onnx`, `.pkl`) devem permanecer estritamente no `.gitignore`. O Git versiona apenas código-fonte, manifestos JSON e relatórios analíticos Markdown.
2. **Zero PII no NotebookLM:** Dados exportados para relatórios de estudo no NotebookLM devem ser estritamente agregados ou pseudonimizados (IDs de clientes com hash SHA-256, sem nomes, CPFs ou cartões).
3. **Zero Acesso a Banco no Python:** O Spark ou os jobs de extração leem de dumps ou réplicas de leitura, nunca através do container do Python Worker.
4. **Ferramentas MCP Read-Only:** Todas as ferramentas MCP de ML são estritamente de inspeção em tempo constante, sem capacidade de trigger síncrono que bloqueie threads de telemetria.

