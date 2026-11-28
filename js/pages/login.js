// =========================================================
// PÁGINA LOGIN — entrar com @usuario (ou e-mail) e senha, criar usuário
// (com e-mail, para recuperar a senha) e "esqueci minha senha".
// Fica logado (em cada aparelho) até tocar em "Sair".
// =========================================================
import { field } from "../components/ui.js";
import { MARCA } from "../config/marca.js";
import { limparUsuario, usuarioValido } from "../core/auth.js";
import { backend, configurado } from "../core/backend.js";
import { ehDemo } from "../config/ambiente.js";
import { SENHA_DEMO } from "../demo/perfis.js";
import { abrirCarteira } from "../core/sync.js";

const LOGO = `<img class="login-logo" src="icons/icon-192.png" alt="" width="72" height="72">`;
const ehEmail = (t) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t);
const TITULO = { entrar: "Entrar", criar: "Criar usuário", esqueci: "Esqueci minha senha" };

export function renderLogin(root, ctx) {
  if (!configurado()) {
    root.innerHTML = `<section class="login">${LOGO}<h1>${MARCA}</h1><p class="hint">Em configuração.</p></section>`;
    return;
  }
  const modo = ctx.loginModo || "entrar";
  const campos = {
    entrar: `
      ${field({ id: "lg-user", name: "usuario", label: "@usuário ou e-mail", type: "text", value: ctx.ultimoUsuario ? `@${ctx.ultimoUsuario}` : "", attrs: 'autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username"' })}
      ${field({ id: "lg-pass", name: "senha", label: "Senha", type: "password", attrs: 'autocomplete="current-password"' })}`,
    criar: `
      ${field({ id: "lg-user", name: "usuario", label: "Usuário", type: "text", prefix: "@", value: "", attrs: 'autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username"' })}
      ${field({ id: "lg-email", name: "email", label: "E-mail", type: "email", attrs: 'autocapitalize="none" autocomplete="email" inputmode="email"' })}
      ${field({ id: "lg-pass", name: "senha", label: "Senha", type: "password", attrs: 'autocomplete="new-password"' })}
      ${field({ id: "lg-pass2", name: "senha2", label: "Repetir senha", type: "password", attrs: 'autocomplete="new-password"' })}`,
    esqueci: `
      ${field({ id: "lg-user", name: "usuario", label: "@usuário ou e-mail", type: "text", value: ctx.ultimoUsuario ? `@${ctx.ultimoUsuario}` : "", attrs: 'autocapitalize="none" autocorrect="off" spellcheck="false"' })}`,
  }[modo];
  const botao = { entrar: "Entrar", criar: "Criar e entrar", esqueci: "Enviar link" }[modo];

  root.innerHTML = `
    <section class="login">
      ${LOGO}
      <h1>${TITULO[modo]}</h1>
      <p class="hint">${MARCA}</p>
      ${ehDemo() ? `<p class="banner calm demo-aviso">Ambiente de teste com dados fictícios. Entre como <b>@ana</b>, <b>@bruno</b>, <b>@carla</b> ou <b>@novo</b> · senha <b>${SENHA_DEMO}</b></p>` : ""}
      <form class="card" id="login" novalidate autocomplete="on">
        <div class="fields stack">${campos}</div>
        <p class="preview" id="lg-msg" aria-live="polite"></p>
        <button class="btn primary block" type="submit">${botao}</button>
        ${modo === "entrar" ? `<button class="link" type="button" data-modo="esqueci">Esqueci minha senha</button>` : ""}
      </form>
      <p class="login-trocar">${modo === "criar" ? "Já tenho usuário?" : modo === "entrar" ? "Ainda não tenho usuário?" : ""}</p>
      <button class="btn block" type="button" data-modo="${modo === "entrar" ? "criar" : "entrar"}">${modo === "entrar" ? "Criar usuário" : "Entrar"}</button>
    </section>`;

  root.querySelectorAll("[data-modo]").forEach((b) => (b.onclick = () => { ctx.loginModo = b.dataset.modo; ctx.rerender(); }));

  const form = root.querySelector("#login");
  const btn = form.querySelector("button[type=submit]");
  const msg = (t, ok) => { root.querySelector("#lg-msg").innerHTML = `<span class="status ${ok ? "ok" : "warn"}">${t}</span>`; };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const login = form.usuario.value.trim();
    btn.disabled = true;
    try {
      if (modo === "esqueci") {
        if (!login) throw new Error("Digite o usuário ou e-mail.");
        await backend.esqueci(login);
        btn.disabled = false;
        return msg("Se existir um usuário com esses dados, mandei um link para o e-mail cadastrado.", true);
      }
      let s;
      if (modo === "criar") {
        const usuario = limparUsuario(login);
        const email = form.email.value.trim().toLowerCase();
        if (!usuarioValido(usuario)) throw new Error("Usuário: 3 a 30 letras, números, ponto ou _.");
        if (!ehEmail(email)) throw new Error("Digite um e-mail válido.");
        if (form.senha.value.length < 8) throw new Error("Senha com pelo menos 8 caracteres.");
        if (form.senha.value !== form.senha2.value) throw new Error("As senhas não são iguais.");
        s = await backend.criar(usuario, email, form.senha.value);
      } else {
        if (!login) throw new Error("Digite o usuário ou e-mail.");
        s = await backend.entrar(login, form.senha.value);
      }
      ctx.ultimoUsuario = s.usuario;
      try { localStorage.setItem("savia-wallet-ultimo", s.usuario); } catch { /* nada */ }
      ctx.loginModo = null;
      location.hash = "home";
      await abrirCarteira(ctx, s);
    } catch (err) {
      btn.disabled = false;
      msg(err.message || "Não deu certo. Tente de novo.");
    }
  });
  const foco = form.usuario.value && form.senha ? form.senha : form.usuario;
  foco.focus();
}

// Tela de nova senha (chegou pelo link do e-mail)
export function renderNovaSenha(root, ctx) {
  root.innerHTML = `
    <section class="login">
      ${LOGO}
      <h1>Nova senha</h1>
      <p class="hint">${MARCA}</p>
      <form class="card" id="nova" novalidate>
        <div class="fields stack">
          ${field({ id: "ns-1", name: "nova", label: "Nova senha", type: "password", attrs: 'autocomplete="new-password"' })}
          ${field({ id: "ns-2", name: "nova2", label: "Repetir nova senha", type: "password", attrs: 'autocomplete="new-password"' })}
        </div>
        <p class="preview" id="ns-msg" aria-live="polite"></p>
        <button class="btn primary block" type="submit">Salvar e entrar</button>
      </form>
    </section>`;
  const f = root.querySelector("#nova");
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const aviso = (t) => { root.querySelector("#ns-msg").innerHTML = `<span class="status warn">${t}</span>`; };
    if (f.nova.value.length < 8) return aviso("Senha com pelo menos 8 caracteres.");
    if (f.nova.value !== f.nova2.value) return aviso("As senhas não são iguais.");
    try { await backend.trocarSenha(f.nova.value); } catch (err) { return aviso(err.message); }
    ctx.recuperar = false;
    history.replaceState(null, "", location.pathname + "#home");
    const s = await backend.sessao();
    if (s) await abrirCarteira(ctx, s); else ctx.rerender();
  });
  f.nova.focus();
}
