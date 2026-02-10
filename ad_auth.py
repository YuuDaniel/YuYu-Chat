from ldap3 import Server, Connection, ALL, SIMPLE
from logger_app import registrar_log 

# --- CONFIGURAÇÕES ---
AD_SERVER_IP = '172.16.x.x' 
AD_DOMAIN = 'empresa.lan'

def autenticar_ad(usuario, senha):
    print(f"\n--- TENTATIVA DE LOGIN: {usuario} ---")
    
    if '\\' in usuario:
        user_short = usuario.split('\\')[1]
    elif '@' in usuario:
        user_short = usuario.split('@')[0]
    else:
        user_short = usuario.strip()
    
    user_login_simple = f"{user_short}@{AD_DOMAIN}"

    try:
        server = Server(AD_SERVER_IP, get_info=ALL)
        conn = Connection(server, user=user_login_simple, password=senha, authentication=SIMPLE, auto_bind=True)
        
        base_dn = 'dc=' + AD_DOMAIN.replace('.', ',dc=')
        filtro = f'(sAMAccountName={user_short})'
        conn.search(base_dn, filtro, attributes=['displayName', 'department'])
        
        nome_real = user_short
        equipe_ad = "Geral"
        caminho_completo = ""
        
        if conn.entries:
            entry = conn.entries[0]
            if entry.displayName: nome_real = str(entry.displayName)
            if entry.department: equipe_ad = str(entry.department)
            caminho_completo = str(entry.entry_dn).lower() 
            
            # --- DEBUG: MOSTRA O CAMINHO REAL NO TERMINAL ---
            print(f"--> CAMINHO AD: {caminho_completo}")
            print(f"--> DEPARTAMENTO: {equipe_ad}")
        
        # --- LÓGICA DE PERFIS ---
        dept_lower = equipe_ad.lower()
        
        equipe_final = equipe_ad
        cargo_exibicao = "Operador"
        perfil_sistema = "operador"

        # REGRA 1: T.I. 
        if "ou=t.i" in caminho_completo or "tecnologia" in dept_lower or "ti" in dept_lower:
            equipe_final = "Tecnologia"
            cargo_exibicao = "T.I."
            perfil_sistema = "supervisor" 
            
        # REGRA 2: MONITORIA
        elif "ou=monitoria" in caminho_completo or "qualidade" in dept_lower or "monitoria" in dept_lower:
            equipe_final = "Qualidade"
            cargo_exibicao = "Monitoria"
            perfil_sistema = "supervisor"

        # REGRA 3: SUPERVISORES
        elif "ou=supervisores" in caminho_completo or "supervisor" in dept_lower:
            if equipe_final == "Geral": equipe_final = "Supervisão"
            cargo_exibicao = "Supervisor"
            perfil_sistema = "supervisor"

        # --- REGRA 4: AUXILIARES ---
        elif "auxiliares" in caminho_completo or "auxiliar" in dept_lower or "assistente" in dept_lower:
            if equipe_final == "Geral": equipe_final = "Supervisão"
            cargo_exibicao = "Auxiliar"
            perfil_sistema = "supervisor"

        # REGRA 5: OPERADORES
        else:
            cargo_exibicao = "Operador"
            perfil_sistema = "operador"
            if equipe_final == "Geral":
                equipe_final = "Operação"

        print(f"--> DECISÃO: {cargo_exibicao} (Visão: {perfil_sistema})\n")
        
        registrar_log("LOGIN_SUCESSO", f"User: {nome_real} | Cargo: {cargo_exibicao} | Path: {caminho_completo}")

        return {
            "sucesso": True,
            "nome": nome_real,
            "equipe": equipe_final,
            "perfil": perfil_sistema,
            "cargo_exibicao": cargo_exibicao
        }

    except Exception as e:
        registrar_log("LOGIN_ERRO", f"Falha ao logar {usuario}. Erro: {e}")
        return {"sucesso": False}