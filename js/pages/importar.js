// =========================================================
// IMPORTAR EXTRATO (Minhas contas) — envio o CSV/OFX que baixei do
// banco; o app sugere o que é cada linha e eu só confiro e aplico.
// =========================================================
import { lerArquivo, sugerir, aplicar, semanasDaSaida } from "../core/importar.js";
import { buildWeek } from "../core/plan.js";
import { entradasDaSemana } from "../core/entradas.js";
import { conferir } from "../core/saldo.js";
import { moedaBase } from "../core/cambio.js";
import { fromISO } from "../core/calendar.js";
import { money, shortDate } from "../core/format.js";
import { select, esc, toast } from "../components/ui.js";

const itensSemana = (ctx) => (iso) => {
  const w = buildWeek(ctx.seed, ctx.state, fromISO(iso));
  const pagos = ctx.state.pagos[iso] || {};
  return w.items.filter((i) => !pagos[i.id] && i.valor > 0);
};

export function importarHtml(ctx) {
  const { state } = ctx;
  const bancos = state.bancos || [];
  const imp = ctx.imp;
  if (!imp) return bancos.length ? `<button class="btn add-btn" id="imp-abrir">Importar extrato</button>` : "";
  const opcoesBanco = bancos.map((b) => ({ id: b.id, label: b.banco }));
  if (!imp.linhas) {
    return `<section class="card">
      <div class="card-head"><h2>Importar extrato</h2></div>
      <p class="hint">Baixo o extrato no site ou app do banco (CSV ou OFX) e envio aqui.</p>
      <div class="fields stack">
        ${select({ id: "imp-conta", label: "De qual conta", options: opcoesBanco, value: imp.conta || bancos[0].id })}
        <label class="field" for="imp-arq"><span class="lbl">Arquivo</span><input id="imp-arq" type="file" accept=".csv,.ofx,.qfx,.txt,text/csv"></label>
      </div>
      ${imp.erro ? `<p class="status warn">${esc(imp.erro)}</p>` : ""}
      <div class="inline-btns"><button class="btn" id="imp-cancel">Cancelar</button></div>
    </section>`;
  }
  const itens = itensSemana(ctx);
  const ents = (iso) => entradasDaSemana(ctx.seed, state, iso);
  const opcoes = (l) => {
    const o = [{ id: "ignorar", label: "Ignorar" }];
    if (l.valor > 0) {
      ents(l.iso).forEach((e) => o.push({ id: `entrada:${e.id}`, label: `Entrada: ${e.nome}` }));
      o.push({ id: "outra", label: "Outra entrada" });
    } else {
      // Itens das semanas possíveis, sem repetir; os de valor parecido primeiro
      const vistos = new Set();
      const cand = semanasDaSaida(l.data).flatMap((w) => itens(w).map((i) => ({ ...i, w })))
        .filter((i) => !vistos.has(i.nome) && vistos.add(i.nome))
        .sort((a, b) => Math.abs(a.valor + l.valor) - Math.abs(b.valor + l.valor));
      cand.forEach((i) => o.push({ id: `pago:${i.id}`, label: `Paguei: ${i.nome}` }));
      if (l.acao.startsWith("pago:") && !o.some((x) => x.id === l.acao)) o.push({ id: l.acao, label: "Paguei (sugerido)" });
      o.push({ id: "gasto", label: "Gasto" });
    }
    return o;
  };
  const novas = imp.linhas.filter((l) => !l.jaImportado);
  const conta = bancos.find((b) => b.id === imp.conta);
  return `<section class="card imp">
    <div class="card-head"><h2>Extrato · ${esc(conta ? conta.banco : "")}</h2><span class="total">${novas.length}</span></div>
    <p class="hint">Confiro o que o app sugeriu e aplico.</p>
    <ul class="imp-lista">${imp.linhas.map((l, k) => `<li class="${l.jaImportado ? "off" : ""}">
      <div class="ent-top"><div class="rs-nome"><span>${esc(l.desc || "—")}</span><small class="hint">${shortDate(fromISO(l.data))}</small></div>
        <b class="${l.valor > 0 ? "pos" : ""}">${l.valor > 0 ? "+" : "−"}${money(Math.abs(l.valor), true)}</b></div>
      ${l.jaImportado ? `<small class="hint">já importado</small>` : select({ id: `imp-l-${k}`, label: "", options: opcoes(l), value: l.acao })}
    </li>`).join("")}</ul>
    ${imp.saldoFinal != null ? `<label class="check"><input type="checkbox" id="imp-conferir" checked> Conferir ${esc(conta ? conta.banco : "")} com o saldo final do extrato (${money(imp.saldoFinal, true)})</label>` : ""}
    <div class="inline-btns"><button class="btn primary" id="imp-aplicar">Aplicar ${novas.length}</button><button class="btn" id="imp-cancel">Cancelar</button></div>
  </section>`;
}

export function bindImportar(root, ctx) {
  const { state, persist } = ctx;
  const ab = root.querySelector("#imp-abrir");
  if (ab) ab.onclick = () => { ctx.imp = {}; ctx.rerender(); };
  root.querySelectorAll("#imp-cancel").forEach((b) => (b.onclick = () => { ctx.imp = null; ctx.rerender(); }));
  const arq = root.querySelector("#imp-arq");
  if (arq) arq.addEventListener("change", async () => {
    const f = arq.files[0];
    if (!f) return;
    const conta = root.querySelector("#imp-conta").value;
    try {
      const texto = await f.text();
      const { transacoes, saldoFinal } = lerArquivo(f.name, texto, moedaBase(state) === "USD");
      if (!transacoes.length) throw new Error("Não achei lançamentos neste arquivo.");
      const linhas = sugerir(state, transacoes, conta, itensSemana(ctx)).sort((a, b) => b.data.localeCompare(a.data));
      ctx.imp = { conta, linhas, saldoFinal };
    } catch (err) { ctx.imp = { conta, erro: err.message || "Não consegui ler o arquivo." }; }
    ctx.rerender();
  });
  root.querySelectorAll('[id^="imp-l-"]').forEach((s) => s.addEventListener("change", () => {
    const l = ctx.imp.linhas[Number(s.id.slice(6))];
    l.acao = s.value;
    if (s.value.startsWith("pago:")) {
      const id = s.value.slice(5);
      l.iso = semanasDaSaida(l.data).find((w) => itensSemana(ctx)(w).some((i) => i.id === id)) || l.iso;
    }
  }));
  const ap = root.querySelector("#imp-aplicar");
  if (ap) ap.onclick = () => {
    const { conta, linhas, saldoFinal } = ctx.imp;
    const itemPorId = (iso, id) => buildWeek(ctx.seed, state, fromISO(iso)).items.find((i) => i.id === id);
    const entradaPorId = (iso, id) => entradasDaSemana(ctx.seed, state, iso).find((e) => e.id === id);
    const n = aplicar(state, linhas, conta, itemPorId, entradaPorId);
    const conf = root.querySelector("#imp-conferir");
    if (conf && conf.checked && saldoFinal != null) conferir(state, (state.bancos || []).find((b) => b.id === conta), saldoFinal);
    ctx.imp = null;
    persist(); ctx.rerender();
    toast(`${n} lançamento${n === 1 ? "" : "s"} ✓`);
  };
}
