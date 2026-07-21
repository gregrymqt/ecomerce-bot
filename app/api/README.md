# 📁 api/

**Objetivo:** Agrupar e expor todos os pontos de entrada HTTP (Endpoints) da aplicação baseados no framework **FastAPI**.

**O que colocar aqui:**
- `endpoints.py` ou sub-roteadores separados por domínio (ex: `users.py`, `export.py`).
- Definição dos métodos `GET`, `POST`, `PUT`, `DELETE`.
- Esquemas de validação locais para o request body (Pydantic Models específicos de input/output de API que não sejam de domínio).

**Regras:**
- **Não** coloque regras de negócios pesadas ou lógicas de banco de dados diretamente nas rotas. A rota deve receber a requisição, chamar a camada `services/` ou `workers/` e retornar a resposta.
- Todas as rotas devem ser agrupadas por um `APIRouter` e registradas no `main.py`.
