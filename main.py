from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel 
from typing import Dict
from datetime import datetime
from collections import deque
import os
from ad_auth import autenticar_ad
from logger import salvar_log_conversa 

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

# --- MODELO DE DADOS PARA O LOGIN ---
class LoginData(BaseModel):
    usuario: str
    senha: str

@app.get("/")
async def get():
    caminho_arquivo = os.path.join(os.path.dirname(__file__), "index.html")
    with open(caminho_arquivo, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

# --- ROTA DE LOGIN (HTTP) ---
@app.post("/login")
async def login_endpoint(dados: LoginData):
    resultado = autenticar_ad(dados.usuario, dados.senha)
    
    if resultado and resultado['sucesso']:
        return {
            "sucesso": True,
            "nome": resultado['nome'],
            "equipe": resultado['equipe'],
            "perfil": resultado['perfil'],
            "cargo_exibicao": resultado['cargo_exibicao'] 
        }
    else:
        raise HTTPException(status_code=401, detail="Usuário ou senha incorretos.")

# --- GERENCIADOR DE CONEXÕES ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, user_id: str, dados_usuario: dict):
        await websocket.accept()
        
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id]["ws"].close()
            except:
                pass
        
        self.active_connections[user_id] = {
            "ws": websocket,
            "dados": dados_usuario,
            "processed_ids": deque(maxlen=20) 
        }
        
        await self.broadcast_user_list()

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        return True

    async def broadcast_user_list(self):
        lista = []
        for info in list(self.active_connections.values()):
            lista.append(info["dados"])
        
        conexoes_seguras = list(self.active_connections.items())

        for uid, info in conexoes_seguras:
            try:
                await info["ws"].send_json({
                    "tipo": "lista_usuarios",
                    "usuarios": lista
                })
            except:
                pass

    async def send_private_message(self, sender_id: str, target_id: str, message: str):
        hora_atual = datetime.now().strftime("%H:%M")
        
        if target_id in self.active_connections:
            try:
                await self.active_connections[target_id]["ws"].send_json({
                    "tipo": "mensagem_privada",
                    "remetente_id": sender_id,
                    "remetente_nome": self.active_connections[sender_id]["dados"]["nome"],
                    "texto": message,
                    "hora": hora_atual
                })
            except:
                pass
        
        # Envia Echo para Remetente
        if sender_id in self.active_connections and sender_id != target_id:
            try:
                await self.active_connections[sender_id]["ws"].send_json({
                    "tipo": "mensagem_privada",
                    "remetente_id": "eu",
                    "destinatario_id": target_id,
                    "texto": message,
                    "hora": hora_atual
                })
            except:
                pass

    async def send_read_status(self, reader_id: str, target_id: str):
        if target_id in self.active_connections:
            try:
                await self.active_connections[target_id]["ws"].send_json({
                    "tipo": "confirmacao_leitura",
                    "quem_leu_id": reader_id
                })
            except:
                pass

manager = ConnectionManager()

# --- LÓGICA WEBSOCKET ---
async def logica_websocket_compartilhada(websocket: WebSocket, perfil: str, nome: str, equipe: str, cargo_exibicao: str):
    from urllib.parse import unquote
    cargo_limpo = unquote(cargo_exibicao) 
    
    user_id = f"{nome}-{equipe}".lower().replace(" ", "")
    
    dados_usuario = {
        "id": user_id,
        "nome": nome,
        "perfil": perfil, 
        "equipe": equipe,
        "cargo_exibicao": cargo_limpo 
    }

    await manager.connect(websocket, user_id, dados_usuario)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if "target_id" in data and "message" in data:
                msg_texto = data["message"]
                msg_id = data.get("msg_id", "") 
                
                # --- SISTEMA DE IDEMPOTÊNCIA (EVITA DUPLICIDADE) ---
                if user_id in manager.active_connections:
                    user_data = manager.active_connections[user_id]
                    ids_processados = user_data["processed_ids"]
                    
                    if msg_id and msg_id in ids_processados:
                        print(f"--- Duplicidade Barrada pelo ID: {msg_id} ---")
                        continue
                    
                    if msg_id:
                        ids_processados.append(msg_id)

                await manager.send_private_message(user_id, data["target_id"], msg_texto)
                salvar_log_conversa(nome, data["target_id"], msg_texto)
            
            elif "read_confirmation" in data:
                target = data["read_confirmation"]
                await manager.send_read_status(reader_id=user_id, target_id=target)

    except WebSocketDisconnect:
        manager.disconnect(user_id)
        await manager.broadcast_user_list()
    
    except OSError as e:
        print(f"--- Queda de Rede (WinError): {nome} ---")
        manager.disconnect(user_id)
        
    except Exception as e:
        print(f"--- Erro Genérico: {e} ---")
        manager.disconnect(user_id)

# --- ROTAS WEBSOCKET ---

@app.websocket("/ws/{perfil}/{nome}/{equipe}/{cargo_exibicao}")
async def websocket_endpoint_novo(websocket: WebSocket, perfil: str, nome: str, equipe: str, cargo_exibicao: str):
    await logica_websocket_compartilhada(websocket, perfil, nome, equipe, cargo_exibicao)

# 2. ROTA ANTIGA
@app.websocket("/ws/{perfil}/{nome}/{equipe}")
async def websocket_endpoint_antigo(websocket: WebSocket, perfil: str, nome: str, equipe: str):
    cargo_padrao = "Operador" 
    if perfil == "supervisor":
        cargo_padrao = "Supervisor"
    await logica_websocket_compartilhada(websocket, perfil, nome, equipe, cargo_padrao)