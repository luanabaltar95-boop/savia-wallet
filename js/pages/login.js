// =========================================================
// PÁGINA LOGIN — entrar com @usuario e senha ou criar um usuário novo.
// Depois de entrar, fica logado (em todos os aparelhos da conta) até "Sair".
// =========================================================
import { field } from "../components/ui.js";
import { MARCA } from "../config/marca.js";
import { limparUsuario, usuarioValido, criarPerfil, conferir, perfilDe } from "../core/auth.js";
import { salvarReg, abrirCarteira } from "../core/sync.js";

const LOGO = `<img class="login-logo" src="icons/icon-192.png" alt="" width="72" height="72">`;

export function renderLogin(root, ctx) {
  const reg = ctx.reg;
  const criar = ctx.loginModo ? ctx.loginModo === "criar" : !reg.perfis.length;
  const ultimo = reg.ultimo || (reg.perfis.length === 1 ? reg.perfis[0].usuario : "");

  root.innerHTML = `
    <section class="login">
      ${LOGO}
      <h1>${criar ? "Criar usuário" : "Entrar"}</h1>
      <p class="hint">${MARCA}</p>
      <form class="card" id="login" novalidate autocomplete="on">
        <div class="fields stack">
          ${field({ id: "lg-user", name: "usuario", label: "Usuário", type: "text", prefix: "@", value: criar ? "" : ultimo, attrs: 'autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username"' })}
          ${field({ id: "lg-pass", name: "senha", label: "Senha", type: "password", attrs: `autocomplete="${criar ? "new-password" : "current-password"}"` })}
          ${criar ? field({ id: "lg-pass2", name: "senha2", label: "Repetir senha", type: "password", attrs: 'autocomplete="new-password"' }) : ""}
        </div>
        <p class="preview" id="lg-msg" aria-live="polite"></p>
        <button class="btn primary block" type="submit">${criar ? "Criar e entrar" : "Entrar"}</button>
      </form>
      <p class="login-trocar">${criar ? "Já tenho usuário?" : "Ainda não tenho usuário?"}</p>
      <button class="btn block" id="lg-trocar">${criar ? "Entrar" : "Criar usuário"}</button>
    </section>`;

  const trocar = root.querySelector("#lg-trocar");
  trocar.onclick = () => { ctx.loginModo = criar ? "entrar" : "criar"; ctx.rerender(); };

  const form = root.querySelector("#login");
  const msg = (t) => { root.querySelector("#lg-msg").innerHTML = `<span class="status warn">${t}</span>`; };
  const abrir = async (p) => {
    reg.sessao = p.usuario;
    reg.ultimo = p.usuario;
    ctx.loginModo = null;
    await salvarReg(ctx);
    location.hash = "home";
    await abrirCarteira(ctx, p.doc);
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuario = limparUsuario(form.usuario.value);
    const senha = form.senha.value;
    if (criar) {
      if (!usuarioValido(usuario)) return msg("Usuário: 3 a 30 letras, números, ponto ou _.");
      if (perfilDe(reg, usuario)) return msg("Esse usuário já existe.");
      if (senha.length < 8) return msg("Senha com pelo menos 8 caracteres.");
      if (senha !== form.senha2.value) return msg("As senhas não são iguais.");
      return abrir(await criarPerfil(reg, usuario, senha));
    }
    if (!perfilDe(reg, usuario)) return msg(reg.perfis.length ? "Usuário ou senha incorretos." : "Nenhum usuário neste aparelho ainda. Toque em Criar usuário.");
    const p = await conferir(reg, usuario, senha);
    if (!p) return msg("Usuário ou senha incorretos.");
    abrir(p);
  });
  (criar || !ultimo ? form.usuario : form.senha).focus();
}
