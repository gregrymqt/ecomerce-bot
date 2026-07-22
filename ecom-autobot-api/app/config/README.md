# 📁 config/

**Objetivo:** Centralizar configurações globais, integrações de infraestrutura estrutural e validações de variáveis de ambiente do projeto.

**O que colocar aqui:**
- `settings.py`: Responsável por carregar o arquivo `.env` usando a biblioteca `pydantic-settings` para garantir tipagem e validação forte.
- `database.py`: Funções para instanciar a conexão com o **MongoDB** (motor assíncrono), criar e manter a higienização dos índices (TTL, Unicidade).
- `rabbitmq.py`: Funções para abrir as conexões AMQP via `aio-pika`, definir a topologia das filas e os canais de troca (Dead Letter Exchanges).

**Regras:**
- Nenhuma outra parte do código deve ler `os.environ` diretamente, exceto para lógicas hiper-específicas, devendo centralizar toda a tipagem no objeto global `Settings`.
