// =========================================================
// MEU OBJETIVO (Ajustes) — o que eu quero alcançar, quanto guardo
// por semana e em qual conta. O "Guardar" entra no plano da Hoje
// logo depois do "para usar", e a Home mostra quanto falta.
// =========================================================
import { salvarParte } from "../core/config.js";
import { objetivo, progresso } from "../core/objetivo.js";
import { jornada } from "../core/jornada.js";
import { poupanca } from "../core/destino.js";
import { fromISO, toISO } from "../core/calendar.js";
import { money, shortDate } from "../core/format.js";
// Data com o ano quando não é este ano (ex.: 14/01/28)
const dataAno = (iso) => { const d = fromISO(iso); return d.getFullYear() === new Date().getFullYear() ? shortDate(d) : `${shortDate(d)}/${String(d.getFullYear()).slice(2)}`; };
import { field, select, esc, toast } from "../components/ui.js";

// O caminho: etapas calculadas dos meus dados + a última, juntar
function caminho(ctx) {
  try { return jornada(ctx.seed, ctx.state); } catch { return null; }
}

export function objetivoResumo(ctx) {
  const j = caminho(ctx);
  if (j && j.fases.length) return `etapa ${Math.min(j.feitas + 1, j.fases.length)} de ${j.fases.length}`;
  const o = objetivo(ctx.state);
  return o.nome ? esc(o.nome) : "definir";
}

export function objetivoHtml(ctx) {
  const { state } = ctx;
  const o = { ...objetivo(state), ...(ctx.objDraft || {}) };
  const bancos = state.bancos || [];
  const p = progresso(ctx.seed, state);
  const j = caminho(ctx);
  const etapas = j ? j.fases.filter((f) => !f.juntar) : [];
  const item = (f, i) => {
    const st = f.ok ? "ok" : f === j.atual ? "atual" : "";
    const quando = f.ok ? "feito" : f.quando ? `previsão ${dataAno(typeof f.quando === "string" ? f.quando : toISO(f.quando))}` : "";
    return `<li class="cam-etapa ${st}"><span class="cam-n">${f.ok ? "✓" : i + 1}</span>
      <div class="cam-txt"><b>${esc(f.titulo)}</b><small>${esc(f.desc)}${quando ? ` · ${quando}` : ""}</small></div></li>`;
  };
  // Mostro até a etapa atual + as 2 seguintes; o resto fica recolhido
  const corte = Math.max(3, (j && j.atual ? etapas.indexOf(j.atual) : 0) + 3);
  const lista = etapas.slice(0, corte).map(item).join("") + (etapas.length > corte
    ? `<li><details class="cam-mais"><summary class="link">ver mais ${etapas.length - corte} etapas</summary><ol class="cam-lista">${etapas.slice(corte).map((f, k) => item(f, k + corte)).join("")}</ol></details></li>` : "");
  const nJuntar = etapas.length + 1;
  const juntarOk = p.alvo > 0 && p.falta <= 0;
  return `<div class="caminho">
      <p class="hint">Meu caminho: pagar os atrasados, quitar as dívidas e juntar dinheiro. As etapas saem das minhas contas e dívidas.</p>
      ${etapas.length ? `<ol class="cam-lista">${lista}</ol>` : ""}
      <form id="form-objetivo" class="cam-juntar" novalidate>
        <div class="cam-etapa ${juntarOk ? "ok" : ""}"><span class="cam-n">${juntarOk ? "✓" : nJuntar}</span>
          <div class="cam-txt"><b>Juntar dinheiro</b><small>${p.alvo ? `Tenho ${money(p.atual)} de ${money(p.alvo)}` : "Defina quanto e até quando"}</small></div></div>
        <div class="fields stack">
          ${field({ id: "ob-nome", label: "Para quê", type: "text", value: o.tipo === "dividas" ? "" : o.nome, placeholder: "Ex.: reserva de emergência, viagem" })}
          ${field({ id: "ob-alvo", label: "Quanto quero juntar", value: o.tipo === "dividas" ? "" : (o.alvo || ""), prefix: "$", placeholder: "0,00" })}
          ${field({ id: "ob-ate", label: "Até quando (opcional)", type: "date", value: o.ate || "" })}
          ${field({ id: "ob-semanal", label: "Quanto guardo por semana", value: o.semanal || "", prefix: "$", placeholder: "0,00", note: "Já guardo um pouco desde agora, mesmo pagando as dívidas" })}
          ${select({ id: "ob-conta", label: "Guardo na conta", options: bancos.length ? bancos.map((b) => ({ id: b.id, label: b.banco })) : [{ id: "", label: "Poupança" }], value: o.conta || poupanca(state).id })}
        </div>
        ${p.alvo && o.tipo !== "dividas" ? `<p class="hint">${p.precisaSemana ? `Para chegar até ${dataAno(p.ate)}: ${money(p.precisaSemana)} por semana.` : ""}
          ${p.chegaEm ? ` No ritmo de ${money(p.semanal)}/semana chego em ${dataAno(p.chegaEm)}.` : ""}</p>` : ""}
        <div class="save-bar"><button class="btn primary" type="submit">Salvar</button></div>
      </form>
    </div>`;
}

export function bindObjetivo(root, ctx) {
  const { state, persist } = ctx;
  const f = root.querySelector("#form-objetivo");
  if (!f) return;
  const ler = () => ({
    tipo: "reserva", nome: f.querySelector("#ob-nome").value.trim(),
    alvo: Number(String(f.querySelector("#ob-alvo").value).replace(",", ".")) || 0,
    ate: f.querySelector("#ob-ate").value, conta: f.querySelector("#ob-conta").value,
    semanal: Number(String(f.querySelector("#ob-semanal").value).replace(",", ".")) || 0,
  });
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const { semanal, ...o } = ler();
    state.config = { ...state.config, objetivo: o };
    salvarParte(state, "colchaoSemanal", semanal);
    ctx.objDraft = null; ctx.openSec = null;
    persist(); ctx.rerender(); toast("Salvo ✓");
  });
}
