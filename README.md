# YuYu Chat - Comunicação Interna Corporativa

Sistema de chat em tempo real desenvolvido para facilitar a comunicação entre a Operação e a Gestão em ambiente de Call Center, eliminando a necessidade de deslocamento físico, reduzindo o tempo ocioso e garantindo auditoria completa.

![Status](https://img.shields.io/badge/Status-Versão_2.0-blue) ![Python](https://img.shields.io/badge/Python-3.10+-yellow) ![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)

## Funcionalidades

### Autenticação e Controle de Acesso (Active Directory)
O sistema realiza a leitura de credenciais e grupos diretamente do AD, atribuindo permissões automaticamente:
* **Login Integrado:** Utiliza credenciais de rede (LDAP Simple Bind).
* **Reconhecimento de Perfis:**
    * **T.I. & Supervisores:** Acesso total a todos os usuários e logs.
    * **Monitoria (Qualidade):** Acesso para monitoramento de conversas em tempo real.
    * **Auxiliares:** Permissões elevadas para suporte à supervisão.
    * **Operadores:** Visualização restrita (visualizam apenas a gestão online).

### Notificações e Interface
* **Design "Bolha" (Bubble):** Interface flutuante não intrusiva.
* **Sistema de Notificações Visual:**
    * **Contador de Mensagens:** Badge indicando mensagens não lidas.
    * **Identificação:** Nome do usuário remetente visível na notificação.
    * **Alertas:** Popups visuais tanto com o chat aberto quanto minimizado.
* **Painel de Controle:** Visualização clara de quem está online com etiquetas de setor (Ex: Tecnologia T.I.).

### Auditoria e Logs
Sistema robusto de registro para segurança e debugging:
1.  **Logs de Conversa (Auditoria):** Todas as trocas de mensagens são salvas em arquivos de texto hierarquizados (`logs/Ano/Mês/Dia.txt`).
2.  **Logs de Sistema:** Registro de inicialização, erros de conexão e eventos do servidor.

---

## Tecnologias Utilizadas

O projeto foi construído focando em performance assíncrona e facilidade de deploy na Intranet.

### Backend
* **FastAPI:** Framework principal para criação da API e gerenciamento do WebSocket.
* **Uvicorn:** Servidor ASGI de alta performance.
* **Pydantic:** Validação de dados e estruturação de modelos.
* **LDAP3:** Integração e autenticação com Active Directory.
* **Python (Standard Lib):** `os`, `datetime`, `collections` (deque) para gerenciamento de arquivos e filas.

### Frontend
* **HTML5 & CSS3:** Layout responsivo com Flexbox/Grid e tema Dark Mode.
* **JavaScript (Vanilla):** Lógica de conexão WebSocket e manipulação do DOM sem frameworks externos.

---

## Como Rodar o Projeto

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/YuuDaniel/yuyu-chat.git](https://github.com/YuuDaniel/yuyu-chat.git)
    cd yuyu-chat
    ```

2.  **Crie o ambiente virtual e instale as dependências:**
    ```bash
    python -m venv .venv
    # Windows:
    .\.venv\Scripts\activate
    
    # Instale os pacotes
    pip install -r requirements.txt
    ```

3.  **Configuração do Active Directory:**
    Edite o arquivo `ad_auth.py` para definir os grupos de acesso da sua rede:
    ```python
    AD_SERVER_IP = '172.16.X.X'      # IP do Controlador de Domínio
    AD_DOMAIN = 'empresa.lan'        # Domínio da rede
    
    # Definição de palavras-chave para grupos do AD
    GROUP_TI = "Tecnologia"
    GROUP_SUPERVISAO = "Supervisores"
    GROUP_MONITORIA = "Qualidade"
    ```

4.  **Execute o servidor:**
    Para liberar o acesso na rede interna (Intranet):
    ```bash
    python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
    ```
    O chat estará acessível em: `http://IP_DO_SERVIDOR:8000`

---
Desenvolvido por [Daniel Yu](https://github.com/YuuDaniel)