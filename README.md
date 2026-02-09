# ✉︎ YuYu Chat - Comunicação Interna Corporativa

Sistema de chat em tempo real desenvolvido para facilitar a comunicação entre Supervisores e Operadores de Call Center em ambiente de Intranet, eliminando a necessidade de deslocamento físico e garantindo auditoria.

![Status](https://img.shields.io/badge/Status-Versão_2.0-blue) ![Python](https://img.shields.io/badge/Python-3.10+-yellow)

## Funcionalidades:

* **Autenticação Integrada (Active Directory):**
    * Login utilizando as credenciais de rede do Windows.
    * Validação via protocolo LDAP (Simple Bind).
    * Suporte automático para formatos `usuario` ou `usuario@dominio`.
* **Controle de Acesso Automático:**
    * O sistema identifica o perfil (Operador ou Supervisor) automaticamente baseado na pasta (OU) ou Grupos do usuário no AD.
    * **Operadores:** (Ex: Pasta "Acionadores") Veem apenas os supervisores online.
    * **Supervisores/TI:** Veem toda a equipe e operadores.
* **Auditoria e Logs:**
    * Registro automático de todas as conversas em arquivos `.txt` no servidor.
    * Organização hierárquica por data: `logs/Ano/Mês/Dia.txt`.
* **Interface Renovada:**
    * Design moderno estilo "Bolha".
    * Diferenciação visual clara entre mensagens enviadas (Azul) e recebidas (Cinza).
    * Identificação visual de Supervisores na lista.

## Funcionalidades Principais

* **Chat em Tempo Real:** Comunicação instantânea via WebSocket.
* **Zero Configuração no Cliente:** Funciona direto no navegador, sem instalação.
* **Interface:** Dark Mode, Notificações Sonoras e Popups flutuantes.
* **Histórico Híbrido:**
    * **Local:** Últimas 24h salvas no navegador do usuário.
    * **Servidor:** Histórico permanente em arquivos de log.

## Tecnologias Utilizadas

* **Backend:** Python (FastAPI, Uvicorn, LDAP3).
* **Frontend:** HTML5, CSS3 (Flexbox/Grid), JavaScript (Vanilla).
* **Protocolos:** WebSocket (Comunicação), LDAP (Autenticação).

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
    Edite o arquivo `ad_auth.py` com as informações da sua rede:
    ```python
    AD_SERVER_IP = '172.16.X.X'    # IP do Controlador de Domínio
    AD_DOMAIN = 'empresa.lan'      # Seu domínio
    KEYWORD_OPERADOR = "Acionadores" # Nome da pasta/grupo que define operadores
    ```

4.  **Execute o servidor:**
    Para liberar o acesso na rede interna (Intranet):
    ```bash
    python -m uvicorn main:app --host 0.0.0.0 --port 8000
    ```
    O chat estará acessível em: `http://IP_DO_SERVIDOR:8000`

---
Desenvolvido por [Daniel Yu](https://github.com/YuuDaniel)