# 📁 services/

**Objetivo:** Agrupar a lógica inteligente e as integrações externas complexas do Bot.

**O que colocar aqui:**
- `llm_service.py` e `llm_provider.py`: Integrações diretas via SDK com provedores externos (ex: APIs da OpenAI ou Google Gemini). Implementação de Fallbacks e extração de schemas estruturados das IAs.
- `markdown_parser_service.py`: Lógicas de transformação de conteúdos purificados para processamento textual (ex: HTML2Text).

**Regras:**
- Os *Services* não se preocupam de onde o dado veio (se foi do RabbitMQ ou do HTTP), eles apenas executam a computação core e devolvem o dado enriquecido.
- Os *Services* orquestram as dependências mas não seguram estado permanente nativamente (stateless).
