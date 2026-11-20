// =========================================================
// PÁGINA LOGIN — entrar com @usuario e senha ou criar um usuário.
// Fica logado (em cada aparelho) até tocar em "Sair".
// =========================================================
import { field } from "../components/ui.js";
import { MARCA } from "../config/marca.js";
import { limparUsuario, usuarioValido } from "../core/auth.js";
import { backend, configurado } from "../core/backend.js";
import { abrirCarteira } from "../core/sync.js";

const LOGO = `<img class="login-logo" src="icons/icon-192.png" alt="" width="72" height="72">`;

export function renderLogin(root, ctx) {
  if (!configurado()) {
    root.innerHTML = `<section class="login">${LOGO}<h1>${MARCA}</h1><p class="hint">Em configuração.</p></section>`;
    return;
  }
  const criar = ctx.loginModo === "criar";
  root.innerHTML = `
    <section class="login">
      ${LOGO}
      <h1>${criar ? "Criar usuário" : "Entrar"}</h1>
      <p class="hint">${MARCA}</p>
      <form class="card" id="login" novalidate autocomplete="on">
        <div class="fields stack">
          ${field({ id: "lg-user", name: "usuario", label: "Usuário", type: "text", prefix: "@", value: ctx.ultimoUsuario || "", attrs: 'autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username"' })}
          ${field({ id: "lg-pass", name: "senha", label: "Senha", type: "password", attrs: `autocomplete="${criar ? "new-password" : "current-password"}"` })}
          ${criar ? field({ id: "lg-pass2", name: "senha2", label: "Repetir senha", type: "password", attrs: 'autocomplete="new-password"' }) : ""}
        </div>
        <p class="preview" id="lg-msg" aria-live="polite"></p>
        <button class="btn primary block" type="submit">${criar ? "Criar e entrar" : "Entrar"}</button>
      </form>
      <p class="login-trocar">${criar ? "Já tenho usuário?" : "Ainda não tenho usuário?"}</p>
      <button class="btn block" id="lg-trocar">${criar ? "Entrar" : "Criar usuário"}</button>
    </section>`;

  root.querySelector("#lg-trocar").onclick = () => { ctx.loginModo = criar ? "entrar" : "criar"; ctx.rerender(); };

  const form = root.querySelector("#login");
  const btn = form.querySelector("button[type=submit]");
  const msg = (t) => { root.querySelector("#lg-msg").innerHTML = `<span class="status warn">${t}</span>`; };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuario = limparUsuario(form.usuario.value);
    const senha = form.senha.value;
    if (!usuarioValido(usuario)) return msg("Usuário: 3 a 30 letras, números, ponto ou _.");
    if (criar) {
      if (senha.length < 8) return msg("Senha com pelo menos 8 caracteres.");
      if (senha !== form.senha2.value) return msg("As senhas não são iguais.");
    }
    btn.disabled = true;
    try {
      const s = criar ? await backend.criar(usuario, senha) : await backend.entrar(usuario, senha);
      ctx.ultimoUsuario = usuario;
      try { localStorage.setItem("savia-wallet-ultimo", usuario); } catch { /* nada */ }
      ctx.loginModo = null;
      location.hash = "home";
      await abrirCarteira(ctx, s);
    } catch (err) {
      btn.disabled = false;
      msg(err.message || "Não deu certo. Tente de novo.");
    }
  });
  (ctx.ultimoUsuario ? form.senha : form.usuario).focus();
}
