"""Testes pela API REST (PostgREST, o mesmo motor do Supabase) com JWTs de A, B e anônimo.
Rodar depois de tests/rls/rodar.sh, com o PostgREST local apontando para o banco savia_rls.
Uso: python3 tests/rls/api.py  (variáveis: API=http://127.0.0.1:3999 SEGREDO=...)"""
import base64, hashlib, hmac, json, os, urllib.request, urllib.error
API = os.environ.get("API", "http://127.0.0.1:3999")
SEGREDO = os.environ.get("SEGREDO", "segredo-de-teste-local-com-32-caracteres!!")
A, B = "aaaaaaaa-0000-0000-0000-00000000000a", "bbbbbbbb-0000-0000-0000-00000000000b"
b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
def jwt(claims):
    h = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()); p = b64(json.dumps(claims).encode())
    s = b64(hmac.new(SEGREDO.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest())
    return f"{h}.{p}.{s}"
TOK = {"A": jwt({"sub": A, "role": "authenticated"}), "B": jwt({"sub": B, "role": "authenticated"}), "anon": jwt({"role": "anon"})}
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
def req(quem, metodo, caminho, corpo=None):
    r = urllib.request.Request(API + caminho, method=metodo, data=json.dumps(corpo).encode() if corpo is not None else None,
        headers={"Authorization": f"Bearer {TOK[quem]}", "Content-Type": "application/json", "Prefer": "return=representation"})
    try:
        with opener.open(r) as x: return x.status, json.loads(x.read() or "null")
    except urllib.error.HTTPError as e: return e.code, (e.read() or b"").decode()[:120]
ok = falha = 0
def check(cond, nome):
    global ok, falha
    print(("OK    " if cond else "FALHA ") + nome); ok += bool(cond); falha += (not cond)
s, d = req("A", "GET", "/wallet_carteiras?select=user_id,dados"); check(s == 200 and len(d) == 1 and d[0]["user_id"] == A, "API: A lista só a própria carteira")
s, d = req("A", "GET", f"/wallet_carteiras?user_id=eq.{B}"); check(s == 200 and d == [], "API: A consulta a carteira de B pelo id → vazio")
s, d = req("A", "PATCH", f"/wallet_carteiras?user_id=eq.{B}", {"dados": {"hack": 1}}); check(s in (200, 204) and not d, "API: A tenta alterar B → nenhuma linha")
s, d = req("A", "DELETE", f"/wallet_carteiras?user_id=eq.{B}"); check(s in (401, 403) or (s in (200, 204) and not d), f"API: A tenta excluir B → bloqueado ({s})")
s, d = req("A", "POST", "/wallet_carteiras", {"user_id": B, "dados": {}}); check(s in (401, 403, 409), f"API: A cria carteira em nome de B → bloqueado ({s})")
s, d = req("B", "GET", "/wallet_carteiras?select=dados"); check(s == 200 and len(d) == 1 and "hack" not in json.dumps(d), "API: carteira de B intacta")
s, d = req("anon", "GET", "/wallet_carteiras"); check(s in (401, 403) or d == [], f"API: anônimo não lê carteiras ({s})")
s, d = req("anon", "GET", "/wallet_perfis"); check(s in (401, 403) or d == [], f"API: anônimo não lê perfis ({s})")
s, d = req("anon", "POST", "/rpc/wallet_buscar_usuario", {"p_usuario": "usuario_a"}); check(s in (401, 403, 404), f"API: anônimo não busca usuários ({s})")
s, d = req("anon", "POST", "/rpc/wallet_email_do_usuario", {"p_usuario": "usuario_a"}); check(not (s == 200 and d), f"API: anônimo não descobre e-mail pelo @ ({s}: {d})")
falso = jwt({"sub": B, "role": "authenticated"}).rsplit(".", 1)[0] + ".assinaturafalsa"
r = urllib.request.Request(API + "/wallet_carteiras", headers={"Authorization": f"Bearer {falso}"})
try: opener.open(r); check(False, "API: token com assinatura falsa é recusado")
except urllib.error.HTTPError as e: check(e.code == 401, f"API: token com assinatura falsa é recusado ({e.code})")
print(f"\n{ok} ok, {falha} falharam")
