import os
from datetime import datetime

MESES = {
    1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
    5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
    9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
}

def salvar_log_conversa(remetente_nome, destinatario_id, mensagem):
    """
    Salva a mensagem em: logs/2025/Janeiro/17.txt
    """
    agora = datetime.now()
    
    ano = agora.strftime("%Y")           
    mes_nome = MESES[agora.month]       
    dia_arquivo = agora.strftime("%d.%m")   
    
    # Caminho base: pasta do projeto/logs/2025/Janeiro
    caminho_pasta = os.path.join("logs", ano, mes_nome)
    
    # 2. Cria as pastas se não existirem
    if not os.path.exists(caminho_pasta):
        os.makedirs(caminho_pasta)
        
    # 3. Define o caminho final do arquivo
    caminho_arquivo = os.path.join(caminho_pasta, f"{dia_arquivo}.txt")
    
    # 4. Formata a linha do log
    hora = agora.strftime("%H:%M:%S")
    # Ex: [14:30:05] João Silva -> comercial-maria: Olá, preciso de ajuda.
    linha_log = f"[{hora}] {remetente_nome} -> {destinatario_id}: {mensagem}\n"
    
    # 5. Escreve no arquivo (mode='a' significa append/adicionar ao final)
    try:
        with open(caminho_arquivo, "a", encoding="utf-8") as f:
            f.write(linha_log)
    except Exception as e:
        print(f"Erro ao salvar log: {e}")