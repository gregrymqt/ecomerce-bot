# 📁 repositories/

**Objetivo:** Abstrair e isolar toda a lógica de comunicação direta com o Banco de Dados, seguindo o padrão *Repository*.

**O que colocar aqui:**
- `product_repository.py`: Arquivo que encapsula as _queries_ nativas, inserts, atualizações e métodos como `find_one_and_update` usando a biblioteca `motor` e driver nativo do MongoDB.

**Regras:**
- **Encapsulamento Strict:** As regras e queries de banco NUNCA devem ser escritas espalhadas dentro de `workers/` ou `api/`. Toda interação com o driver de banco de dados deve pertencer a uma classe ou função de um Repositório (separação de responsabilidades).
- Os métodos deste repositório devem retornar os modelos definidos em `models/`.
