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
        
        conn.search(base_dn, filtro, attributes=['*', 'memberOf'])
        
        nome_real = user_short
        equipe_ad = "Geral"
        caminho_completo = ""
        lista_grupos = [] 
        
        if conn.entries:
            entry = conn.entries[0]
            
            if hasattr(entry, 'displayName') and entry.displayName: 
                nome_real = str(entry.displayName)
            if hasattr(entry, 'department') and entry.department: 
                equipe_ad = str(entry.department)
            
            caminho_completo = str(entry.entry_dn).lower() 
            
            atributos = entry.entry_attributes_as_dict
            if 'memberOf' in atributos and atributos['memberOf']:
                grupos = atributos['memberOf']
                if isinstance(grupos, str):
                    grupos = [grupos] 
                    
                for grupo_dn in grupos:
                    partes = str(grupo_dn).split(',')
                    if partes:
                        primeira_parte = partes[0]
                        if primeira_parte.upper().startswith('CN='):
                            nome_grupo = primeira_parte[3:].strip()
                            lista_grupos.append(nome_grupo)
            
            print(f"--> CAMINHO AD: {caminho_completo}")
            print(f"--> GRUPOS LIDOS: {lista_grupos}")
        
        # --- LÓGICA DE PERFIS ---
        dept_lower = equipe_ad.lower()
        equipe_final = equipe_ad
        cargo_exibicao = "Operador"
        perfil_sistema = "operador"

        for grupo in lista_grupos:
            if grupo.upper().startswith("EQUIPE "):
                nome_carteira = grupo[7:].strip() 
                equipe_final = nome_carteira
                break 

        if "ou=t.i" in caminho_completo or "tecnologia" in dept_lower or "ti" in dept_lower:
            equipe_final = "Tecnologia"
            cargo_exibicao = "T.I."
            perfil_sistema = "supervisor" 
            
        elif "ou=monitoria" in caminho_completo or "qualidade" in dept_lower or "monitoria" in dept_lower:
            equipe_final = "Qualidade"
            cargo_exibicao = "Monitoria"
            perfil_sistema = "supervisor"

        elif "ou=supervisores" in caminho_completo or "supervisor" in dept_lower:
            if equipe_final == "Geral": equipe_final = "Supervisão"
            cargo_exibicao = "Supervisor"
            perfil_sistema = "supervisor"

        elif "auxiliares" in caminho_completo or "auxiliar" in dept_lower or "assistente" in dept_lower:
            if equipe_final == "Geral": equipe_final = "Supervisão"
            cargo_exibicao = "Auxiliar"
            perfil_sistema = "supervisor"

        else:
            cargo_exibicao = "Operador"
            perfil_sistema = "operador"
            if equipe_final == "Geral":
                equipe_final = "Operação"

        print(f"--> DECISÃO FINAL: {cargo_exibicao} | Equipe: {equipe_final}\n")
        
        registrar_log("LOGIN_SUCESSO", f"User: {nome_real} | Cargo: {cargo_exibicao} | Equipe: {equipe_final} | Path: {caminho_completo}")

        return {
            "sucesso": True,
            "nome": nome_real,
            "equipe": equipe_final,
            "perfil": perfil_sistema,
            "cargo_exibicao": cargo_exibicao
        }

    except Exception as e:
        registrar_log("LOGIN_ERRO", f"Falha ao logar {usuario}. Erro: {e}")
        print(f"ERRO AD: {e}")
        return {"sucesso": False}