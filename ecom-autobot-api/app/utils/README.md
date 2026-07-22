# 📁 utils/

**Objetivo:** Centralizar pequenos utilitários ou módulos transversais à aplicação (Cross-Cutting Concerns).

**O que colocar aqui:**
- `logger.py`: Configurações avançadas do pacote `logging` nativo, transformando logs em formato padronizado e injetando metadados dinâmicos nas saídas do console.
- `crypto.py`: Operações criptográficas focadas em segurança de dados em repouso. É o responsável por mascarar chaves privadas (BYOK) utilizando a suíte `cryptography` via protocolo `AES-256 GCM`.

**Regras:**
- Este pacote serve funções limpas. Elas nunca recebem injeções pesadas (como banco de dados ou RabbitMQ) e atuam como ajudantes (helpers).
