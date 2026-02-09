let ws;
let meuId = "";
let meuPerfil = "";
let minhaEquipe = "";
let meuNomeReal = "";
let chatsAbertos = {};
let mensagensNaoLidas = 0;
const tituloOriginal = document.title; 

const notificacaoAudio = new Audio('/static/sounds/notification-sound-effect-372475.mp3');

window.onload = function() {
    verificarSessaoExistente();
    limparHistoricoAntigo();
};

window.onfocus = function() {
    mensagensNaoLidas = 0;
    document.title = tituloOriginal;
};

function handleLoginEnter(e) {
    if (e.key === 'Enter') fazerLoginAPI();
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
}

// --- LOGIN VIA API (AD) ---
async function fazerLoginAPI() {
    const usuarioInput = document.getElementById('usuario-ad');
    const senhaInput = document.getElementById('senha-ad');
    const btn = document.getElementById('btn-entrar');
    const errorMsg = document.getElementById('error-msg');

    const usuario = usuarioInput.value.trim();
    const senha = senhaInput.value;

    if (!usuario || !senha) {
        alert("Preencha usuário e senha!");
        return;
    }

    btn.disabled = true;
    btn.innerText = "Verificando...";
    errorMsg.style.display = 'none';

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, senha })
        });

        if (!response.ok) throw new Error("Usuário ou senha incorretos.");

        const dados = await response.json();
        
        // Salva sessão e conecta
        localStorage.setItem("yuyu_session", JSON.stringify(dados));
        iniciarWebSocket(dados);

    } catch (erro) {
        errorMsg.innerText = erro.message;
        errorMsg.style.display = 'block';
        senhaInput.value = ""; 
        usuarioInput.focus();
    } finally {
        btn.disabled = false;
        btn.innerText = "Entrar";
    }
}

function verificarSessaoExistente() {
    const salvo = localStorage.getItem("yuyu_session");
    if (salvo) {
        try {
            const dados = JSON.parse(salvo);
            iniciarWebSocket(dados);
        } catch (e) {
            console.error("Erro ao recuperar sessão:", e);
        }
    }
}

// --- CONEXÃO WEBSOCKET ---
function iniciarWebSocket(dados) {
    meuNomeReal = dados.nome;
    meuPerfil = dados.perfil;
    minhaEquipe = dados.equipe;

    meuId = `${meuNomeReal}-${minhaEquipe}`.toLowerCase().replace(/\s+/g, '');
    
    console.log("Meu ID calculado:", meuId); // Debug

    const nomeSeguro = encodeURIComponent(meuNomeReal);
    const equipeSegura = encodeURIComponent(minhaEquipe);
    
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/ws/${meuPerfil}/${nomeSeguro}/${equipeSegura}`;
    
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'block';
        
        document.getElementById('welcome-msg').innerText = `Olá, ${meuNomeReal}`;
        document.getElementById('welcome-team').innerText = `${minhaEquipe} (${meuPerfil})`;
        
        const titulo = document.getElementById('list-title');
        titulo.innerText = meuPerfil === 'supervisor' ? "Painel de Controle (Todos Online)" : "Supervisores Disponíveis";
    };

    ws.onclose = (event) => {
        console.log("Conexão perdida.");
        if (localStorage.getItem("yuyu_session")) {
            setTimeout(() => {
                const dadosRec = JSON.parse(localStorage.getItem("yuyu_session"));
                if(dadosRec) iniciarWebSocket(dadosRec);
            }, 5000);
        }
    };

    ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.tipo === "lista_usuarios") {
            atualizarListaUsuarios(payload.usuarios);
        } 
        else if (payload.tipo === "mensagem_privada") {
            receberMensagem(payload);
        }
        else if (payload.tipo === "confirmacao_leitura") {
            marcarMensagensComoLidas(payload.quem_leu_id);
        }
    };
}

function logout() {
    localStorage.removeItem("yuyu_session");
    window.location.reload();
}

// --- LISTA DE USUÁRIOS (AQUI ESTAVA O PROBLEMA) ---
function atualizarListaUsuarios(usuarios) {
    const grid = document.getElementById('user-grid');
    grid.innerHTML = "";
    
    usuarios.sort((a, b) => {
        if (a.equipe === minhaEquipe && b.equipe !== minhaEquipe) return -1;
        if (a.equipe !== minhaEquipe && b.equipe === minhaEquipe) return 1;
        return 0;
    });

    usuarios.forEach(user => {o
        if (user.id === meuId) return; 

        let mostrar = false;

        // REGRAS DE VISIBILIDADE:
        if (meuPerfil === 'supervisor') {
            mostrar = true;
        } 
        else {
            if (user.perfil === 'supervisor') {
                mostrar = true;
            }
        }

        if (mostrar) {
            const card = document.createElement('div');
            card.className = 'user-card online';
            
            const isSupervisor = (user.perfil === 'supervisor');
            const isMinhaEquipe = (user.equipe === minhaEquipe);
            
            let icone = "";
            if (isSupervisor) icone = "⭐"; 
            else if (isMinhaEquipe) icone = "🎧";

            if (isMinhaEquipe) card.style.borderColor = "var(--primary)";
            if (isSupervisor) card.classList.add('supervisor-card');

            card.innerHTML = `
                <div class="card-header">
                    <span class="card-name">${icone} ${user.nome}</span>
                </div>
                <div class="badges">
                    <span class="badge" style="font-weight:bold;">${user.equipe}</span>
                    <span class="badge" style="font-style:italic; font-size:0.7rem;">${user.perfil}</span>
                </div>
            `;
            card.onclick = () => abrirPopup(user.id, user.nome);
            grid.appendChild(card);
        }
    });
}


function abrirPopup(targetId, targetName) {
    if (chatsAbertos[targetId]) {
        const popup = chatsAbertos[targetId];
        popup.classList.remove('minimized');
        const input = popup.querySelector('input');
        if(input) {
            input.focus();
            enviarConfirmacaoLeitura(targetId);
        }
        return;
    }

    const container = document.getElementById('popups-container');
    const popup = document.createElement('div');
    popup.className = 'chat-popup';
    popup.id = `popup-${targetId}`;

    popup.innerHTML = `
        <div class="popup-header" title="${targetName}"> <span>${targetName}</span>
            <button class="close-btn">×</button>
        </div>
        <div class="popup-body" id="msgs-${targetId}"></div>
        <div class="popup-footer">
            <input type="text" placeholder="Digite..." 
                onkeypress="handleEnter('${targetId}', event)"
                onfocus="enviarConfirmacaoLeitura('${targetId}')"
                onclick="enviarConfirmacaoLeitura('${targetId}')"
                autocomplete="off"
            >
        </div>
    `;

    const header = popup.querySelector('.popup-header');
    const closeBtn = popup.querySelector('.close-btn');

    closeBtn.onclick = (e) => {
        e.stopPropagation();
        fecharPopup(targetId);
    };

    header.onclick = () => {
        popup.classList.toggle('minimized');
    };

    container.appendChild(popup);
    chatsAbertos[targetId] = popup;

    carregarHistoricoLocal(targetId);
    enviarConfirmacaoLeitura(targetId);
}

function fecharPopup(targetId) {
    const popup = chatsAbertos[targetId];
    if (popup) {
        popup.remove();
        delete chatsAbertos[targetId];
    }
}

function handleEnter(targetId, event) {
    if (event.key === 'Enter') {
        const input = event.target;
        const texto = input.value.trim();
        if (texto) {
            const dadosMsg = {
                target_id: targetId,
                message: texto
            };
            ws.send(JSON.stringify(dadosMsg));
            input.value = "";
            input.focus();
        }
    }
}

function enviarConfirmacaoLeitura(targetId) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ read_confirmation: targetId }));
    }
}

function marcarMensagensComoLidas(leitorId) {
    const bodyChat = document.getElementById(`msgs-${leitorId}`);
    if (bodyChat) {
        const checks = bodyChat.querySelectorAll('.msg-check');
        checks.forEach(check => check.classList.add('lido'));
    }
}

// --- HISTÓRICO E MENSAGENS ---

function receberMensagem(dados) {
    let idConversa = (dados.remetente_id === "eu") ? dados.destinatario_id : dados.remetente_id;
    let classeCss = (dados.remetente_id === "eu") ? "enviada" : "recebida";
    
    let nomeExibir = (classeCss === "recebida") ? dados.remetente_nome : "Eu";

    salvarMensagemLocal(idConversa, {
        texto: dados.texto,
        classe: classeCss,
        hora: dados.hora,
        nome: nomeExibir, 
        timestamp: new Date().getTime()
    });

    if (classeCss === "recebida") {
        notificacaoAudio.play().catch(() => {});

        if (document.hidden) { 
            mensagensNaoLidas++;
            document.title = `(${mensagensNaoLidas}) Nova Mensagem`;
        }
        // --------------------------------------

        if (!chatsAbertos[idConversa]) {
            abrirPopup(idConversa, dados.remetente_nome);
        } else {
            setTimeout(() => enviarConfirmacaoLeitura(idConversa), 500);
        }
    }

    renderizarMensagem(idConversa, dados.texto, classeCss, dados.hora, nomeExibir);
}

function renderizarMensagem(idConversa, texto, classe, hora) {
    const bodyChat = document.getElementById(`msgs-${idConversa}`);
    if (bodyChat) {
        const balao = document.createElement('div');
        balao.className = `msg ${classe}`;
        balao.innerHTML = `
            <span>${texto}</span>
            <div class="msg-meta">
                <span>${hora}</span>
                <span class="msg-check">✓✓</span>
            </div>
        `;
        bodyChat.appendChild(balao);
        bodyChat.scrollTop = bodyChat.scrollHeight;
    }
}

// -- FUNÇÕES DE ARMAZENAMENTO LOCAL (HISTÓRICO) --
function salvarMensagemLocal(idConversa, msgObj) {
    let historico = JSON.parse(localStorage.getItem("yuyu_chat_history")) || {};
    if (!historico[idConversa]) historico[idConversa] = [];
    historico[idConversa].push(msgObj);
    localStorage.setItem("yuyu_chat_history", JSON.stringify(historico));
}

function carregarHistoricoLocal(idConversa) {
    let historico = JSON.parse(localStorage.getItem("yuyu_chat_history")) || {};
    if (historico[idConversa]) {
        historico[idConversa].forEach(msg => {
            renderizarMensagem(idConversa, msg.texto, msg.classe, msg.hora);
        });
    }
}

function limparHistoricoAntigo() {
    let historico = JSON.parse(localStorage.getItem("yuyu_chat_history"));
    if (!historico) return;
    const agora = new Date().getTime();
    const umDia = 24 * 60 * 60 * 1000;
    for (let idConv in historico) {
        historico[idConv] = historico[idConv].filter(msg => (agora - msg.timestamp) < umDia);
        if (historico[idConv].length === 0) delete historico[idConv];
    }
    localStorage.setItem("yuyu_chat_history", JSON.stringify(historico));
}