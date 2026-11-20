// =========================================================
// MEUS DADOS — exportar e importar a carteira (backup e mudança
// de lugar, ex.: do Claude para o Savia Wallet na Vercel).
// =========================================================
import { esc, toast } from "../components/ui.js";
import { vazioState } from "../core/store.js";

const pacote = (ctx) => JSON.stringify({ app: "carteira", versao: 1, usuario: ctx.reg.sessao, exportado: new Date().toISOString(), state: ctx.state });

export function dadosHtml(ctx) {
  return `<details class="card sec" data-sec="dados" ${ctx.openSec === "dados" ? "open" : ""}>
    <summary class="sec-head"><h2>Meus dados</h2></summary>
    <div class="sec-body">
      <div class="inline-btns">
        <button class="btn" id="dd-copiar" type="button">Copiar</button>
        <button class="btn" id="dd-baixar" type="button">Baixar arquivo</button>
      </div>
      <label class="field" for="dd-texto"><span class="lbl">Importar</span>
        <textarea id="dd-texto" rows="4" placeholder="Cole aqui os dados copiados"></textarea></label>
      <input id="dd-arquivo" type="file" accept="application/json,.json" hidden>
      <div class="inline-btns">
        <button class="btn" id="dd-abrir" type="button">Abrir arquivo</button>
        <button class="btn primary" id="dd-importar" type="button">Importar</button>
      </div>
      <p class="preview" id="dd-msg" aria-live="polite"></p>
    </div>
  </details>`;
}

export function bindDados(root, ctx) {
  const msg = (t, ok) => { root.querySelector("#dd-msg").innerHTML = `<span class="status ${ok ? "ok" : "warn"}">${esc(t)}</span>`; };
  root.querySelector("#dd-copiar").onclick = async () => {
    try { await navigator.clipboard.writeText(pacote(ctx)); toast("Copiado ✓"); }
    catch { root.querySelector("#dd-texto").value = pacote(ctx); msg("Selecione e copie o texto acima.", true); }
  };
  root.querySelector("#dd-baixar").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([pacote(ctx)], { type: "application/json" }));
    a.download = `carteira-${ctx.reg.sessao || "dados"}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const arquivo = root.querySelector("#dd-arquivo");
  root.querySelector("#dd-abrir").onclick = () => arquivo.click();
  arquivo.onchange = async () => { const f = arquivo.files[0]; if (f) root.querySelector("#dd-texto").value = await f.text(); };

  const btn = root.querySelector("#dd-importar");
  btn.onclick = () => {
    let p;
    try { p = JSON.parse(root.querySelector("#dd-texto").value); } catch { return msg("Dados inválidos."); }
    const st = p && p.app === "carteira" ? p.state : p && p.config ? p : null;
    if (!st) return msg("Dados inválidos.");
    if (!btn.dataset.confirma) { btn.dataset.confirma = "1"; btn.textContent = "Confirmar: substituir minha carteira"; return; }
    const { perfil, ...resto } = st; // o login não vem junto
    ctx.state = { ...vazioState(), ...resto };
    ctx.openSec = null;
    ctx.persist();
    ctx.rerender();
    toast("Importado ✓");
  };
}
