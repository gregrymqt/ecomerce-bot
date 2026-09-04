# 🔬 Módulo 3: Modelos de Machine Learning, Analytics & Fórmulas

Este módulo consolida a arquitetura analítica e preditiva do **E-commerce Bot**, detalhando as fórmulas matemáticas, hiperparâmetros, pipelines de treinamento e regras de classificação implementadas.

---

## 🏛️ 1. Arquitetura Tripartite de Machine Learning

1. **Batch & Data Plane (Google Spark / PySpark):**
   - Processamento de grandes volumes históricos de vendas e eventos de catálogo.
   - Treinamento em lote, calibração de centróides e exportação de pipelines serializados (`.joblib` / `.onnx`).
   - Geração de relatórios sem PII para estudo no Google NotebookLM.
2. **Runtime Inference Plane (FastAPI / aio-pika):**
   - Inferência em memória (< 50ms) no microsserviço Python (`EcommerceBot.Worker`).
   - Comunicação via filas RabbitMQ (`queue:analytics_ml` -> `queue:analytics_processed`).
   - Zero acesso direto ao banco de dados SQL Server.
3. **Knowledge & Research Plane (Google NotebookLM):**
   - Grounding de métricas analíticas, auditoria de acurácia e estudo executivo.

---

## 📐 2. Fórmulas Matemáticas & Especificações dos Algoritmos

### 2.1. Matriz RFM (Recência, Frequência e Valor Monetário)
Implementado em [`rfm_segmentation.py`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Worker/app/ml/rfm_segmentation.py) e [`batch_pipeline.py`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Worker/app/ml/spark/batch_pipeline.py).

- **Cálculo das Variáveis Base:**
  $$\text{Recência } (R) = \max(0, \text{Data de Referência} - \max(\text{Data do Pedido}))$$
  $$\text{Frequência } (F) = \sum 1 \quad \text{(Total de transações pagas do cliente)}$$
  $$\text{Monetário } (M) = \sum \text{Valor Líquido dos Pedidos}$$

- **Estabilização & Normalização:**
  A distribuição de frequência e valor é tipicamente assimétrica à direita (cauda longa). Aplica-se a transformação logarítmica seguida de padronização z-score:
  $$X_{\log} = \ln(1 + X)$$
  $$Z = \frac{X_{\log} - \mu}{\sigma}$$

- **Clusterização KMeans & Silhueta:**
  - Hiperparâmetros: $K = 4$ clusters, `random_state=42`, `n_init=10`.
  - Métrica de Validação: Silhouette Score:
    $$s(i) = \frac{b(i) - a(i)}{\max(a(i), b(i))}$$
    *(Onde $a(i)$ é a distância intra-cluster e $b(i)$ é a distância média até o cluster vizinho mais próximo).*

- **Segmentos de Negócio Atribuídos:**
  1. **Campeões (VIP):** Menor recência, altíssima frequência e maior ticket. Ação: Clube de benefícios exclusivos.
  2. **Clientes Fiéis:** Frequência constante e valor moderado/alto. Ação: Cross-sell e novidades.
  3. **Em Risco:** Clientes que compravam com frequência mas a recência ultrapassou a média. Ação: E-mail com cupom de reativação imediata.
  4. **Inativos / Ocasionais:** Baixa frequência e alta recência. Ação: Campanhas de remarketing de baixo custo.

---

### 2.2. Previsão de Churn (`churn_predictor.py`)
- **Definição Operacional:** Considera-se cliente em churn aquele que não realiza compra há mais de 2x o intervalo médio de recompra da categoria (ou cancelou assinatura recorrente).
- **Features do Modelo:** `recency_days`, `order_interval_std`, `ticket_variance`, `refund_count`, `support_ticket_count`.
- **Modelos:** Ensembles baseados em Random Forest e Scikit-Learn com threshold de probabilidade calibrado para $P(\text{churn}) > 0.65$.

---

### 2.3. Projeção de LTV (Lifetime Value - `ltv_forecaster.py`)
- **Fórmula para E-commerce Transacional:**
  $$\text{LTV} = \text{Ticket Médio} \times \text{Frequência Anual de Compra} \times \text{Vida Média do Cliente (Anos)}$$
- **Fórmula para SaaS / Assinaturas:**
  $$\text{LTV} = \frac{\text{ARPU} \times \text{Margem de Contribuição}}{\text{Taxa de Churn Mensal}}$$

---

### 2.4. Atribuição de Tráfego Last-Click (`tracker.js` + SQL)
- **Script:** [`tracker.js`](file:///c:/Users/digob/Desktop/ecommerce-bot/EcommerceBot.Web/public/tracker.js)
- **Parâmetros Capturados:** `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `ad_id`, `fbclid`, `gclid`.
- **Regra Last-Click:** O cookie `_ec_traffic_utm` grava a última visita (TTL 30 dias). Na finalização do pedido, os atributos gravam a sessão no pedido e o Core API persiste na tabela `dbo.TrafficAttributions`.
