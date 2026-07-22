# 📁 dependencies/

**Objetivo:** Prover abstrações para o sistema de Injeção de Dependências (*Dependency Injection*) nativo do FastAPI.

**O que colocar aqui:**
- `rate_limiter.py`: Funções de dependência injetáveis nas rotas via `Depends()` para bloquear IP ou Tenants que excederem o limite.
- Autenticação e Autorização: Middlewares lógicos, extração de Token JWT do Header da requisição HTTP.
- Injeções de Banco de Dados ou Sessão: Funções geradoras (ex: `get_db_session`).

**Regras:**
- Se o código intercepta um Request HTTP antes de chegar na função de rota (ex: Validando um Header, aplicando um Rate Limit), ele pertence a esta pasta.
