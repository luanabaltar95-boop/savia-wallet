// =========================================================
// CONEXÕES (Ajustes) — pessoas com quem divido contas.
// Adiciono pelo @; a pessoa aceita na carteira dela.
// =========================================================
import { backend } from "../core/backend.js";
import { rede, carregarRede } from "../core/rede.js";
import { field, esc, toast } from "../components/ui.js";

export function conexoesHtml(ctx) {
  const r = rede(ctx);
  carregarRede(ctx);
  const linha = (c) => {
    const acoes = c.status === "aceita"
      ? `<button class="link danger" type="button" data-cx-rm="${c.id}">remover</button>`
      : c.enviada
        ? `<span class="hint">aguardando</span><button class="link danger" type="button" data-cx-rm="${c.id}">cancelar</button>`
        : `<button class="btn primary" type="button" data-cx-ok="${c.id}">Aceitar</button><button class="link danger" type="button" data-cx-rm="${c.id}">recusar</button>`;
    return `<li class="cx"><span class="name">@${esc(c.usuario)}</span><span class="cx-acoes">${acoes}</span></li>`;
  };
  const pendentes = r.conexoes.filter((c) => c.status !== "aceita" && !c.enviada).length;
  return `<details class="card sec" data-sec="conexoes" ${ctx.openSec === "conexoes" ? "open" : ""}>
    <summary class="sec-head"><h2>Conexões</h2><span class="total">${pendentes ? `${pendentes} novo${pendentes > 1 ? "s" : ""}` : r.conexoes.filter((c) => c.status === "aceita").length}</span></summary>
    <div class="sec-body">
      ${!r.carregado ? `<p class="hint">Carregando…</p>` : r.erro ? `<p class="hint">${esc(r.erro)}</p>`
        : r.conexoes.length ? `<ul class="cx-lista">${r.conexoes.map(linha).join("")}</ul>` : `<p class="hint">Nenhuma conexão ainda.</p>`}
      <form class="nova-cat" id="cx-form" novalidate autocomplete="off">
        ${field({ id: "cx-user", name: "usuario", label: "Adicionar pelo @", type: "text", prefix: "@", attrs: 'autocapitalize="none" autocorrect="off" spellcheck="false"' })}
        <button class="btn primary" type="submit">+ Adicionar</button>
      </form>
      <p class="preview" id="cx-msg" aria-live="polite"></p>
    </div>
  </details>`;
}

export function bindConexoes(root, ctx) {
  const msg = (t) => { const el = root.querySelector("#cx-msg"); if (el) el.innerHTML = `<span class="status warn">${esc(t)}</span>`; };
  const depois = async (t) => { ctx.openSec = "conexoes"; await carregarRede(ctx, true); if (t) toast(t); };
  const f = root.querySelector("#cx-form");
  if (f) f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = f.usuario.value.trim().replace(/^@+/, "").toLowerCase();
    if (!u) return;
    try { await backend.conectar(u); await depois("Pedido enviado ✓"); } catch (err) { msg(err.message); }
  });
  root.querySelectorAll("[data-cx-ok]").forEach((b) => (b.onclick = async () => { try { await backend.aceitar(b.dataset.cxOk); await depois("Conectado ✓"); } catch (err) { msg("Não consegui aceitar."); } }));
  root.querySelectorAll("[data-cx-rm]").forEach((b) => (b.onclick = async () => {
    if (!b.dataset.confirma) { b.dataset.confirma = "1"; b.textContent = "confirmar"; return; }
    try { await backend.desconectar(b.dataset.cxRm); await depois(); } catch { msg("Não consegui remover."); }
  }));
}
