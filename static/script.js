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

function logout() {
    console.log("Realizando logout...");
    localStorage.removeItem("yuyu_session");
    if (ws) ws.close();
    window.location.href = window.location.origin;
}

function handleLoginEnter(e) {
    if (e.key === 'Enter') fazerLoginAPI();
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
}

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

function iniciarWebSocket(dados) {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
    }

    meuNomeReal = dados.nome;
    meuPerfil = dados.perfil; 
    minhaEquipe = dados.equipe;
    
    let meuCargo = dados.cargo_exibicao;
    if (!meuCargo || meuCargo === "Colaborador") meuCargo = "Operador";

    meuId = `${meuNomeReal}-${minhaEquipe}`.toLowerCase().replace(/\s+/g, '');
    
    const nomeSeguro = encodeURIComponent(meuNomeReal);
    const equipeSegura = encodeURIComponent(minhaEquipe);
    const cargoSeguro = encodeURIComponent(meuCargo); 
    
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}/ws/${meuPerfil}/${nomeSeguro}/${equipeSegura}/${cargoSeguro}`;
    
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'block';
        
        document.getElementById('welcome-msg').innerText = `Olá, ${meuNomeReal}`;
        document.getElementById('welcome-team').innerText = `${minhaEquipe} (${meuCargo})`;
        
        const titulo = document.getElementById('list-title');
        titulo.innerText = meuPerfil === 'supervisor' ? "Painel de Controle (Todos Online)" : "Supervisores Disponíveis";
    };

    ws.onclose = (event) => {
        console.log("Conexão perdida.");
        if (localStorage.getItem("yuyu_session")) {
            ws = null; 
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

// --- LISTA DE USUÁRIOS E ORDENAÇÃO ---
function atualizarListaUsuarios(usuarios) {
    const grid = document.getElementById('user-grid');
    
    const notificacoesAtivas = {};
    document.querySelectorAll('.card-notification.show').forEach(badge => {
        const userId = badge.parentElement.id.replace('card-', '');
        notificacoesAtivas[userId] = badge.innerText;
    });

    grid.innerHTML = "";
    
    const getPesoCargo = (u) => {
        const cargo = (u.cargo_exibicao || "").toLowerCase();
        const perfil = (u.perfil || "").toLowerCase();

        if (cargo.includes('t.i') || cargo.includes('tecnologia')) return 1;
        if (cargo.includes('monitor') || cargo.includes('qualidade')) return 2;
        if (perfil === 'supervisor' && !cargo.includes('auxiliar')) return 3; 
        if (cargo.includes('auxiliar')) return 4; 
        return 99;
    };

    usuarios.sort((a, b) => {
        const pesoA = getPesoCargo(a);
        const pesoB = getPesoCargo(b);
        if (pesoA !== pesoB) return pesoA - pesoB;
        return a.nome.localeCompare(b.nome);
    });

    usuarios.forEach(user => {
        if (user.id === meuId) return; 

        let mostrar = false;
        
        if (meuPerfil === 'supervisor') {
            mostrar = true;
        } else {
            if (user.perfil === 'supervisor') {
                mostrar = true;
            }
        }

        if (mostrar) {
            const card = document.createElement('div');
            card.className = 'user-card online';
            card.id = `card-${user.id}`; 
            
            let cargoShow = user.cargo_exibicao || "Operador"; 
            if (cargoShow === "Colaborador") cargoShow = "Operador";
            const cargoLower = cargoShow.toLowerCase();
            
            const isTI = cargoLower.includes('t.i') || cargoLower.includes('tecnologia');
            const isMonitoria = cargoLower.includes('monitor') || cargoLower.includes('qualidade');
            const isAuxiliar = cargoLower.includes('auxiliar'); 
            const isSupervisor = user.perfil === 'supervisor' && !isTI && !isMonitoria && !isAuxiliar;
            const isMinhaEquipe = (user.equipe === minhaEquipe);
            
            let icone = "🎧"; 
            let classeExtra = "";
            if (isTI) { icone = "💻"; classeExtra = "ti-card"; } 
            else if (isMonitoria) { icone = "📊"; classeExtra = "monitoria-card"; } 
            else if (isAuxiliar) { icone = "🛡️"; classeExtra = "auxiliar-card"; } 
            else if (isSupervisor) { icone = "⭐"; classeExtra = "supervisor-card"; }

            if (classeExtra) card.classList.add(classeExtra);
            if (isMinhaEquipe) card.style.borderColor = "var(--primary)";

            card.innerHTML = `
                <div class="card-notification" id="notif-${user.id}">0</div>
                <div class="card-header">
                    <span class="card-name">${icone} ${user.nome}</span>
                </div>
                <div class="badges">
                    <span class="badge" style="font-weight:bold;">${user.equipe}</span>
                    <span class="badge" style="font-size:0.75rem; background:#eee; color:#333; padding:2px 6px; border-radius:4px;">
                        ${cargoShow}
                    </span>
                </div>
            `;
            card.onclick = () => abrirPopup(user.id, user.nome);
            grid.appendChild(card);

            if (notificacoesAtivas[user.id]) {
                atualizarNotificacaoCard(user.id, parseInt(notificacoesAtivas[user.id]));
            }
        }
    });
}

// --- FUNÇÕES DE CONTROLE DE NOTIFICAÇÃO ---

function atualizarNotificacaoCard(userId, qtd) {
    const badge = document.getElementById(`notif-${userId}`);
    if (badge) {
        if (qtd > 0) {
            badge.innerText = qtd;
            badge.classList.add('show');
        } else {
            badge.classList.remove('show');
            badge.innerText = "0";
        }
    }
}

function atualizarNotificacaoPopup(targetId, qtd) {
    const badge = document.getElementById(`popup-notif-${targetId}`);
    if (badge) {
        if (qtd > 0) {
            badge.innerText = qtd;
            badge.classList.add('show');
        } else {
            badge.classList.remove('show');
            badge.innerText = "0";
        }
    }
}

function limparNotificacoes(targetId) {
    atualizarNotificacaoCard(targetId, 0);
    atualizarNotificacaoPopup(targetId, 0);
    enviarConfirmacaoLeitura(targetId);
}

// --- GERENCIAMENTO DE JANELAS DE CHAT ---
function abrirPopup(targetId, targetName) {
    const container = document.getElementById('popups-container');

    limparNotificacoes(targetId);

    if (chatsAbertos[targetId]) {
        const popup = chatsAbertos[targetId];
        
        container.appendChild(popup);
        
        popup.classList.remove('minimized');
        
        atualizarNotificacaoPopup(targetId, 0);

        const input = popup.querySelector('input');
        if(input) {
            setTimeout(() => input.focus(), 50);
            enviarConfirmacaoLeitura(targetId);
        }
        return;
    }

    const popup = document.createElement('div');
    popup.className = 'chat-popup';
    popup.id = `popup-${targetId}`;

    popup.innerHTML = `
        <div class="popup-header" title="${targetName}">
            <div class="popup-notification" id="popup-notif-${targetId}">0</div>
            <span>${targetName}</span>
            <button class="close-btn">×</button>
        </div>
        <div class="popup-body" id="msgs-${targetId}"></div>
        <div class="popup-footer">
            <input type="text" placeholder="Digite..." 
                onkeypress="handleEnter('${targetId}', event)"
                onfocus="limparNotificacoes('${targetId}')" 
                onclick="limparNotificacoes('${targetId}')"
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
        
        if (!popup.classList.contains('minimized')) {
            limparNotificacoes(targetId);
            const input = popup.querySelector('input');
            if (input) input.focus();
        }
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
            const mensagemId = gerarUUID(); 

            const dadosMsg = {
                target_id: targetId,
                message: texto,
                msg_id: mensagemId 
            };
            
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(dadosMsg));
                input.value = "";
                input.focus();
            } else {
                console.warn("Socket fechado, tentando reconectar...");
            }
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

// --- FUNÇÃO DE RECEBER MENSAGEM (CORRIGIDA: ABRE AUTOMÁTICO) ---
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

    let jaRenderizouViaHistorico = false;

    if (classeCss === "recebida") {
        notificacaoAudio.play().catch(() => {});
        
        if (document.hidden) { 
            mensagensNaoLidas++;
            document.title = `(${mensagensNaoLidas}) Nova Mensagem`;
        }

        if (!chatsAbertos[idConversa]) {
            abrirPopup(idConversa, dados.remetente_nome);
            jaRenderizouViaHistorico = true;
        }

        const popup = chatsAbertos[idConversa];
        if (popup) {
            const input = popup.querySelector('input');
            
            const isFocado = (document.activeElement === input && document.hasFocus());
            const isMinimizado = popup.classList.contains('minimized');

            if (isMinimizado || !isFocado) {
                // Notifica Card
                const cardBadge = document.getElementById(`notif-${idConversa}`);
                let cardCount = cardBadge && cardBadge.innerText ? parseInt(cardBadge.innerText) : 0;
                atualizarNotificacaoCard(idConversa, cardCount + 1);

                const popupBadge = document.getElementById(`popup-notif-${idConversa}`);
                let popupCount = popupBadge && popupBadge.innerText ? parseInt(popupBadge.innerText) : 0;
                atualizarNotificacaoPopup(idConversa, popupCount + 1);
            } else {
                setTimeout(() => enviarConfirmacaoLeitura(idConversa), 500);
            }
        }
    }

    if (!jaRenderizouViaHistorico) {
        renderizarMensagem(idConversa, dados.texto, classeCss, dados.hora, nomeExibir);
    }
}

// --- FUNÇÃO ABRIR POPUP ---
function abrirPopup(targetId, targetName) {
    const container = document.getElementById('popups-container');

    limparNotificacoes(targetId);

    if (chatsAbertos[targetId]) {
        const popup = chatsAbertos[targetId];
        container.appendChild(popup); 
        popup.classList.remove('minimized');
        
        atualizarNotificacaoPopup(targetId, 0);

        const input = popup.querySelector('input');
        if(input) {
            setTimeout(() => input.focus(), 50);
            enviarConfirmacaoLeitura(targetId);
        }
        return;
    }

    const popup = document.createElement('div');
    popup.className = 'chat-popup';
    popup.id = `popup-${targetId}`;

    popup.innerHTML = `
        <div class="popup-header" title="${targetName}">
            <div class="popup-notification" id="popup-notif-${targetId}">0</div>
            <span>${targetName}</span>
            <button class="close-btn">×</button>
        </div>
        <div class="popup-body" id="msgs-${targetId}" onclick="limparNotificacoes('${targetId}')"></div>
        <div class="popup-footer">
            <input type="text" placeholder="Digite..." 
                onkeypress="handleEnter('${targetId}', event)"
                onfocus="limparNotificacoes('${targetId}')" 
                onclick="limparNotificacoes('${targetId}')"
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
        if (!popup.classList.contains('minimized')) {
            limparNotificacoes(targetId);
            const input = popup.querySelector('input');
            if (input) input.focus();
        }
    };

    container.appendChild(popup);
    chatsAbertos[targetId] = popup;

    carregarHistoricoLocal(targetId);
    enviarConfirmacaoLeitura(targetId);
}

function limparNotificacoes(targetId) {
    atualizarNotificacaoCard(targetId, 0);
    atualizarNotificacaoPopup(targetId, 0);
    enviarConfirmacaoLeitura(targetId);
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

function gerarUUID() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}