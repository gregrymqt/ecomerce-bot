# 📁 models/

**Objetivo:** Definir as estruturas de dados (Data Models) e validações centrais do domínio de e-commerce.

**O que colocar aqui:**
- Modelos **Pydantic**.
- `products.py`: Esquema de Produto, metadados de scraping e controle de Pipeline de status (`Raw`, `Processing`, `Processed`).
- `messages.py`: Estruturas de mensagem esperadas que trafegam através do RabbitMQ.
- `llm_responses.py`: Modelos focados no parsing e na validação do retorno estruturado (JSON) da IA (OpenAI/Gemini).

**Regras:**
- Este diretório não contém lógicas, funções pesadas ou regras; apenas declara as tipagens estruturadas, valores padrões e validações automáticas do Pydantic.
