// =========================================================
// MEU OBJETIVO (Ajustes) — o que eu quero alcançar, quanto guardo
// por semana e em qual conta. O "Guardar" entra no plano da Hoje
// logo depois do "para usar", e a Home mostra quanto falta.
// =========================================================
import { salvarParte } from "../core/config.js";
import { objetivo, progresso, TIPOS_OBJETIVO } from "../core/objetivo.js";
import { poupanca } from "../core/destino.js";
import { fromISO } from "../core/calendar.js";
import { money, shortDate } from "../core/format.js";
// Data com o ano quando não é este ano (ex.: 14/01/28)
const dataAno = (iso) => { const d = fromISO(iso); return d.getFullYear() === new Date().getFullYear() ? shortDate(d) : `${shortDate(d)}/${String(d.getFullYear()).slice(2)}`; };
import { field, select, esc, toast } from "../components/ui.js";

export function objetivoResumo(ctx) {
  const o = objetivo(ctx.state);
  return o.nome ? esc(o.nome) : o.semanal ? `${money(o.semanal)}/sem` : "definir";
}

export function objetivoHtml(ctx) {
  const { state } = ctx;
  const o = { ...objetivo(state), ...(ctx.objDraft || {}) };
  const bancos = state.bancos || [];
  const p = progresso(ctx.seed, state);
  const dividas = o.tipo === "dividas";
  return `<form id="form-objetivo" class="ent-cad" novalidate>
      ${select({ id: "ob-tipo", label: "Meu objetivo", options: TIPOS_OBJETIVO, value: o.tipo })}
      <div class="fields stack">
        ${field({ id: "ob-nome", label: "Nome", type: "text", value: o.nome, placeholder: dividas ? "Ex.: zerar os cartões" : "Ex.: reserva de emergência, viagem" })}
        ${field({ id: "ob-alvo", label: dividas ? "Quanto eu devia quando comecei" : "Quanto quero juntar", value: o.alvo || "", prefix: "$", placeholder: "0,00" })}
        ${field({ id: "ob-ate", label: "Até quando (opcional)", type: "date", value: o.ate || "" })}
        ${field({ id: "ob-semanal", label: "Quanto guardo por semana", value: o.semanal || "", prefix: "$", placeholder: "0,00" })}
        ${select({ id: "ob-conta", label: "Guardo na conta", options: bancos.length ? bancos.map((b) => ({ id: b.id, label: b.banco })) : [{ id: "", label: "Poupança" }], value: o.conta || poupanca(state).id })}
      </div>
      ${p.alvo ? `<p class="hint">${dividas ? `Já quitei ${money(p.atual)} de ${money(p.alvo)}.` : `Tenho ${money(p.atual)} de ${money(p.alvo)}.`}
        ${p.precisaSemana ? ` Para chegar até ${dataAno(p.ate)}: ${money(p.precisaSemana)} por semana.` : ""}
        ${p.chegaEm ? ` No ritmo de ${money(p.semanal)}/semana chego em ${dataAno(p.chegaEm)}.` : ""}</p>` : ""}
      <div class="save-bar"><button class="btn primary" type="submit">Salvar</button></div>
    </form>`;
}

export function bindObjetivo(root, ctx) {
  const { state, persist } = ctx;
  const f = root.querySelector("#form-objetivo");
  if (!f) return;
  const ler = () => ({
    tipo: f.querySelector("#ob-tipo").value, nome: f.querySelector("#ob-nome").value.trim(),
    alvo: Number(String(f.querySelector("#ob-alvo").value).replace(",", ".")) || 0,
    ate: f.querySelector("#ob-ate").value, conta: f.querySelector("#ob-conta").value,
    semanal: Number(String(f.querySelector("#ob-semanal").value).replace(",", ".")) || 0,
  });
  f.querySelector("#ob-tipo").addEventListener("change", () => { ctx.objDraft = ler(); ctx.openSec = "objetivo"; ctx.rerender(); });
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const { semanal, ...o } = ler();
    state.config = { ...state.config, objetivo: o };
    salvarParte(state, "colchaoSemanal", semanal);
    ctx.objDraft = null; ctx.openSec = null;
    persist(); ctx.rerender(); toast("Salvo ✓");
  });
}
