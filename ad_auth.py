from ldap3 import Server, Connection, ALL, SIMPLE

# --- CONFIGURAÇÕES ---
AD_SERVER_IP = '172.16.x.x' 
AD_DOMAIN = 'empresa.lan'

def autenticar_ad(usuario, senha):
    print(f"--- LOGIN DE: {usuario} ---")
    
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
        a
        conn.search(base_dn, filtro, attributes=['displayName', 'department'])
        
        nome_real = user_short
        equipe = "Geral"
        
        perfil = "supervisor" 

        if conn.entries:
            entry = conn.entries[0]
            
            if entry.displayName: nome_real = str(entry.displayName)
            if entry.department: equipe = str(entry.department)
            
            caminho_completo = str(entry.entry_dn).lower()
            
            print(f"DEBUG -> Caminho encontrado: {caminho_completo}")

            if "ou=acionadores" in caminho_completo:
                perfil = "operador"
                print("--> DIAGNÓSTICO: Usuário está na pasta ACIONADORES. Perfil: OPERADOR")
            else:
                perfil = "supervisor"
                print("--> DIAGNÓSTICO: Usuário NÃO está na pasta Acionadores. Perfil: SUPERVISOR")

        return {
            "sucesso": True,
            "nome": nome_real,
            "equipe": equipe,
            "perfil": perfil
        }

    except Exception as e:
        print(f"ERRO DE LOGIN: {e}")
        return {"sucesso": False}