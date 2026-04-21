from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Dict
from datetime import datetime
from collections import deque
import os
import secrets
import logging
from ad_auth import autenticar_ad
from logger import registrar_log, salvar_log_conversa

logging.getLogger("websockets").setLevel(logging.CRITICAL)
logging.getLogger("uvicorn.error").setLevel(logging.ERROR)

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
sessoes_ativas: Dict[str, dict] = {}


class LoginData(BaseModel):
    usuario: str
    senha: str


@app.get("/")
async def get():
    caminho = os.path.join(os.path.dirname(__file__), "index.html")
    with open(caminho, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


@app.post("/login")
async def login_endpoint(dados: LoginData):
    resultado = autenticar_ad(dados.usuario, dados.senha)
    if resultado and resultado["sucesso"]:
        token = secrets.token_urlsafe(32)
        sessoes_ativas[token] = {
            "nome":           resultado["nome"],
            "equipe":         resultado["equipe"],
            "perfil":         resultado["perfil"],
            "cargo_exibicao": resultado["cargo_exibicao"],
        }
        return {
            "sucesso":        True,
            "token":          token,
            "nome":           resultado["nome"],
            "equipe":         resultado["equipe"],
            "perfil":         resultado["perfil"],
            "cargo_exibicao": resultado["cargo_exibicao"],
        }
    raise HTTPException(status_code=401, detail="Usuário ou senha incorretos.")


# ── GERENCIADOR DE CONEXÕES ───────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, user_id: str, dados_usuario: dict):
        await websocket.accept()
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id]["ws"].close()
            except Exception:
                pass
        self.active_connections[user_id] = {
            "ws":            websocket,
            "dados":         dados_usuario,
            "processed_ids": deque(maxlen=20),
        }
        await self.broadcast_user_list()

    def disconnect(self, user_id: str):
        self.active_connections.pop(user_id, None)

    async def broadcast_user_list(self):
        lista = [info["dados"] for info in self.active_connections.values()]
        mortos = []

        for uid, info in list(self.active_connections.items()):
            try:
                await info["ws"].send_json({"tipo": "lista_usuarios", "usuarios": lista})
            except Exception:
                mortos.append(uid)

        if mortos:
            for uid in mortos:
                self.active_connections.pop(uid, None)
                print(f"[INFO] Conexão encerrada removida: {uid}")
            lista_atualizada = [info["dados"] for info in self.active_connections.values()]
            for uid, info in list(self.active_connections.items()):
                try:
                    await info["ws"].send_json({"tipo": "lista_usuarios", "usuarios": lista_atualizada})
                except Exception:
                    pass

    async def send_private_message(self, sender_id: str, target_id: str, message: str):
        hora = datetime.now().strftime("%H:%M")
        if target_id in self.active_connections:
            try:
                await self.active_connections[target_id]["ws"].send_json({
                    "tipo":           "mensagem_privada",
                    "remetente_id":   sender_id,
                    "remetente_nome": self.active_connections[sender_id]["dados"]["nome"],
                    "texto":          message,
                    "hora":           hora,
                })
            except Exception as e:
                print(f"[WARN] Falha ao enviar para {target_id}: {e}")

        if sender_id in self.active_connections and sender_id != target_id:
            try:
                await self.active_connections[sender_id]["ws"].send_json({
                    "tipo":            "mensagem_privada",
                    "remetente_id":    "eu",
                    "destinatario_id": target_id,
                    "texto":           message,
                    "hora":            hora,
                })
            except Exception as e:
                print(f"[WARN] Falha ao confirmar envio para {sender_id}: {e}")

    async def send_broadcast(self, sender_id: str, targets: list, message: str):
        hora = datetime.now().strftime("%H:%M")
        nome_remetente = self.active_connections[sender_id]["dados"]["nome"]
        for target_id in targets:
            if target_id in self.active_connections and target_id != sender_id:
                try:
                    await self.active_connections[target_id]["ws"].send_json({
                        "tipo":           "mensagem_privada",
                        "remetente_id":   sender_id,
                        "remetente_nome": nome_remetente,
                        "texto":          message,
                        "hora":           hora,
                    })
                except Exception as e:
                    print(f"[WARN] Broadcast falhou para {target_id}: {e}")

    async def send_read_status(self, reader_id: str, target_id: str):
        if target_id in self.active_connections:
            try:
                await self.active_connections[target_id]["ws"].send_json({
                    "tipo":        "confirmacao_leitura",
                    "quem_leu_id": reader_id,
                })
            except Exception as e:
                print(f"[WARN] Falha ao enviar confirmação de leitura para {target_id}: {e}")


manager = ConnectionManager()


# ── LÓGICA WEBSOCKET (compartilhada) ─────────────────────────────────────

async def logica_websocket_compartilhada(websocket: WebSocket, dados_usuario: dict):
    nome        = dados_usuario["nome"]
    equipe      = dados_usuario["equipe"]
    perfil      = dados_usuario["perfil"]
    cargo_limpo = dados_usuario["cargo_exibicao"]

    user_id = f"{nome}-{equipe}".lower().replace(" ", "")
    payload = {
        "id":             user_id,
        "nome":           nome,
        "perfil":         perfil,
        "equipe":         equipe,
        "cargo_exibicao": cargo_limpo,
    }

    await manager.connect(websocket, user_id, payload)

    try:
        while True:
            data = await websocket.receive_json()

            if "ping" in data:
                continue

            if "target_id" in data and "message" in data:
                msg_id = data.get("msg_id", "")
                if user_id in manager.active_connections:
                    ids = manager.active_connections[user_id]["processed_ids"]
                    if msg_id and msg_id in ids:
                        continue
                    if msg_id:
                        ids.append(msg_id)
                await manager.send_private_message(user_id, data["target_id"], data["message"])
                salvar_log_conversa(nome, data["target_id"], data["message"])

            elif "broadcast_targets" in data and "message" in data:
                msg_id = data.get("msg_id", "")
                if user_id in manager.active_connections:
                    ids = manager.active_connections[user_id]["processed_ids"]
                    if msg_id and msg_id in ids:
                        continue
                    if msg_id:
                        ids.append(msg_id)
                await manager.send_broadcast(user_id, data["broadcast_targets"], data["message"])
                for t_id in data["broadcast_targets"]:
                    salvar_log_conversa(nome, t_id, data["message"])

            elif "read_confirmation" in data:
                await manager.send_read_status(reader_id=user_id, target_id=data["read_confirmation"])

    except WebSocketDisconnect:
        manager.disconnect(user_id)
        await manager.broadcast_user_list()

    except OSError as e:
        print(f"[REDE] Queda de conexão — {nome}: {e}")
        manager.disconnect(user_id)
        await manager.broadcast_user_list()

    except Exception as e:
        nome_erro = type(e).__name__
        if "ConnectionClosed" in nome_erro or "keepalive" in str(e).lower():
            print(f"[INFO] Conexão encerrada ({nome_erro}) — {nome}")
        else:
            print(f"[ERRO] WebSocket inesperado — {nome}: {e}")
        manager.disconnect(user_id)
        await manager.broadcast_user_list()


# ── ROTAS WEBSOCKET ───────────────────────────────────────────────────────

@app.websocket("/ws/{token}")
async def ws_autenticado(websocket: WebSocket, token: str):
    """Rota principal — requer token gerado no /login."""
    dados = sessoes_ativas.get(token)
    if not dados:
        await websocket.close(code=1008)
        print(f"[SEGURANÇA] Token inválido ou expirado: {token[:8]}...")
        return
    await logica_websocket_compartilhada(websocket, dados)


@app.websocket("/ws/{perfil}/{nome}/{equipe}/{cargo_exibicao}")
async def ws_legado_cargo(websocket: WebSocket, perfil: str, nome: str, equipe: str, cargo_exibicao: str):
    """Rota legada com cargo — mantida para compatibilidade."""
    from urllib.parse import unquote
    await logica_websocket_compartilhada(websocket, {
        "nome":           unquote(nome),
        "equipe":         unquote(equipe),
        "perfil":         perfil,
        "cargo_exibicao": unquote(cargo_exibicao),
    })


@app.websocket("/ws/{perfil}/{nome}/{equipe}")
async def ws_legado(websocket: WebSocket, perfil: str, nome: str, equipe: str):
    """Rota legada sem cargo."""
    from urllib.parse import unquote
    await logica_websocket_compartilhada(websocket, {
        "nome":           unquote(nome),
        "equipe":         unquote(equipe),
        "perfil":         perfil,
        "cargo_exibicao": "Supervisor" if perfil == "supervisor" else "Operador",
    })