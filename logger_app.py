import os
from datetime import datetime

MESES = {
    1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
    5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
    9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
}

def registrar_log(tipo, mensagem):
    """
    Salva logs do sistema em: logs_sistema/2026/Janeiro/07.txt
    Tipos: [INFO], [LOGIN], [ERRO], [CONEXAO], [WARNING]
    """
    agora = datetime.now()
    
    ano = agora.strftime("%Y")
    mes_nome = MESES[agora.month]
    dia_arquivo = agora.strftime("%d.%m") 
    
    caminho_pasta = os.path.join("logs_sistema", ano, mes_nome)
    
    if not os.path.exists(caminho_pasta):
        os.makedirs(caminho_pasta)
        
    caminho_arquivo = os.path.join(caminho_pasta, f"{dia_arquivo}.txt")
    
    hora = agora.strftime("%H:%M:%S")
    linha_log = f"[{hora}] [{tipo.upper()}] {mensagem}\n"
    
    try:
        print(linha_log.strip()) 
        
        with open(caminho_arquivo, "a", encoding="utf-8") as f:
            f.write(linha_log)
    except Exception as e:
        print(f"Erro crítico ao salvar log do sistema: {e}")