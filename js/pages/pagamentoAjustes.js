// =========================================================
// MEU PAGAMENTO (Ajustes) — um lugar só para o que é fixo:
// quando recebo (frequência e regra do dia), quanto é o salário,
// em qual conta cai e o piso. Poupança fica em Meu objetivo.
// Extras e entradas avulsas eu lanço na Hoje (+ Outra entrada).
// =========================================================
import { parte, salvarParte } from "../core/config.js";
import { lista as listaEntradas } from "../core/entradas.js";
import { contasCorrentes } from "../core/contasCorrentes.js";
import { getCiclo, setCiclo, nextPayday, pagamentoSeguinte, toISO, fromISO, DIAS_SEMANA } from "../core/calendar.js";
import { money, shortDate } from "../core/format.js";
import { field, select, esc, toast } from "../components/ui.js";

const FREQ = [
  { id: "semanal", label: "Toda semana" },
  { id: "quinzenal", label: "A cada 2 semanas" },
  { id: "duasVezes", label: "Duas vezes por mês" },
  { id: "mensal", label: "Uma vez por mês" },
  { id: "manual", label: "Datas que eu escolho" },
];
const REGRAS = [
  { id: "dia", label: "Num dia do mês" },
  { id: "util", label: "No Nº dia útil" },
  { id: "ultimoUtil", label: "No último dia útil" },
];
const DIAS = DIAS_SEMANA.map((l, i) => ({ id: String(i), label: l }));
const ord = (n) => `${n}º`;

// Texto curto do ciclo (resumo do bloco e da Hoje)
export function resumoPagamento(c) {
  const regraTxt = (r) => r.regra === "util" ? `${ord(r.n || 5)} dia útil` : r.regra === "ultimoUtil" ? "último dia útil" : Number(r.dia) === 0 ? "último dia" : `dia ${r.dia}`;
  if (c.tipo === "quinzenal") return `a cada 2 semanas`;
  if (c.tipo === "duasVezes") return (c.pagamentos || [{ regra: "dia", dia: 15 }, { regra: "dia", dia: 0 }]).map(regraTxt).join(" e ");
  if (c.tipo === "mensal") return regraTxt({ regra: c.regra || "dia", dia: c.diaMes || 1, n: c.nUtil });
  if (c.tipo === "manual") return `${(c.datas || []).length} datas`;
  return `toda ${DIAS_SEMANA[Number(c.diaSemana ?? 5)].toLowerCase()}`;
}

const salarioDe = (state) => listaEntradas(state).find((e) => e.tipo === "fixo");

// Campos de uma regra do mês (mensal tem 1; duas vezes tem 2)
function regraCampos(r, k) {
  const regra = r.regra || "dia";
  return `<div class="regra">
    ${select({ id: `pg-regra-${k}`, label: k === 0 ? "Em qual dia" : "E também", options: REGRAS, value: regra, attrs: `data-pg="regra" data-k="${k}"` })}
    ${regra === "dia" ? `${field({ id: `pg-dia-${k}`, label: "Dia (0 = último dia)", value: r.dia ?? (k ? 0 : 15), attrs: `data-pg="dia" data-k="${k}"` })}
      <label class="check-field"><input class="check" type="checkbox" data-pg="antes" data-k="${k}" ${r.antes ? "checked" : ""}><span>Se cair no fim de semana, recebo na sexta antes</span></label>` : ""}
    ${regra === "util" ? field({ id: `pg-n-${k}`, label: "Qual dia útil (ex.: 5 = quinto)", value: r.n ?? 5, attrs: `data-pg="n" data-k="${k}"` }) : ""}
  </div>`;
}

export function pagamentoHtml(ctx) {
  const { state } = ctx;
  const salvo = parte(state, "ciclo");
  const sal = salarioDe(state) || {};
  const contas = contasCorrentes(state);
  const d = ctx.pgDraft || {
    ...salvo,
    regras: salvo.tipo === "duasVezes" ? (salvo.pagamentos || [{ regra: "dia", dia: 15 }, { regra: "dia", dia: 0 }]) : [{ regra: salvo.regra || "dia", dia: salvo.diaMes || 1, n: salvo.nUtil || 5, antes: salvo.antes }],
    salario: sal.valor ?? "", conta: sal.conta || contas[0].id,
    divConta: ((sal.divisao || [])[0] || {}).conta || "", divValor: ((sal.divisao || [])[0] || {}).valor ?? "",
    piso: parte(state, "metas").piso ?? "",
  };
  const t = d.tipo || "semanal";
  const campos = t === "semanal" ? select({ id: "pg-diasem", label: "Dia da semana", options: DIAS, value: String(d.diaSemana ?? 5) })
    : t === "quinzenal" ? field({ id: "pg-ancora", label: "Data de um pagamento", type: "date", value: d.ancora || toISO(nextPayday()) })
    : t === "mensal" ? regraCampos(d.regras[0], 0)
    : t === "duasVezes" ? regraCampos(d.regras[0], 0) + regraCampos(d.regras[1] || { regra: "dia", dia: 0 }, 1)
    : `<div class="add-data">${field({ id: "pg-nova", label: "Nova data", type: "date", value: "" })}<button class="btn" type="button" id="pg-add-data">Adicionar</button></div>
       <ul class="cat-list datas">${[...(d.datas || [])].sort().map((x) => `<li><span>${shortDate(fromISO(x))}</span><button class="link" type="button" data-pg-rmdata="${x}">remover</button></li>`).join("") || `<li class="hint">Nenhuma data ainda.</li>`}</ul>`;
  // Prévia dos próximos pagamentos com o rascunho
  const atual = getCiclo();
  setCiclo(cicloDe(d));
  let p = nextPayday();
  const prox = Array.from({ length: 4 }, () => { const x = p; p = pagamentoSeguinte(p); return shortDate(x); });
  setCiclo(atual);
  const outras = listaEntradas(state).filter((e) => e.tipo !== "fixo");

  return `<form id="form-pagamento" class="ent-cad" novalidate>
      ${select({ id: "pg-tipo", label: "Recebo", options: FREQ, value: t })}
      <div class="fields stack">${campos}</div>
      <p class="hint">Próximos: ${prox.join(" · ")}</p>

      <h4 class="sub-h">Salário fixo</h4>
      <div class="fields stack">
        ${field({ id: "pg-salario", label: "Quanto cai", value: d.salario, prefix: "$", placeholder: "0,00" })}
        ${select({ id: "pg-conta", label: "Em qual conta", options: contas.map((b) => ({ id: b.id, label: b.banco })), value: d.conta })}
        ${contas.length > 1 ? `${select({ id: "pg-divconta", label: "Parte em outra conta (opcional)", options: [{ id: "", label: "Não" }, ...contas.map((b) => ({ id: b.id, label: b.banco }))], value: d.divConta })}
          ${d.divConta ? field({ id: "pg-divvalor", label: "Quanto vai para ela", value: d.divValor, prefix: "$", placeholder: "0,00" }) : ""}` : ""}
      </div>

      <div class="fields stack">
        ${field({ id: "pg-piso", label: "Piso (o mínimo que preciso receber)", value: d.piso, prefix: "$" })}
      </div>
      <p class="hint">Extras e entradas que acontecem uma vez: Hoje → + Outra entrada.</p>
      ${outras.length ? `<p class="hint">Entradas variáveis antigas: ${outras.map((e) => `${esc(e.nome)} <button class="link danger" type="button" data-pg-rment="${esc(e.id)}">remover</button>`).join(" · ")}</p>` : ""}

      <div class="save-bar"><button class="btn primary" type="submit">Salvar</button>${ctx.pgDraft ? `<button class="btn" type="button" id="pg-cancel">Cancelar</button><span class="save-msg warn">alterações não salvas</span>` : ""}</div>
    </form>`;
}

// Rascunho → ciclo salvo
function cicloDe(d) {
  const t = d.tipo || "semanal";
  if (t === "semanal") return { tipo: "semanal", diaSemana: Number(d.diaSemana ?? 5) };
  if (t === "quinzenal") { const a = d.ancora || toISO(nextPayday()); return { tipo: "quinzenal", diaSemana: fromISO(a).getDay(), ancora: a }; }
  if (t === "mensal") { const r = d.regras[0]; return { tipo: "mensal", regra: r.regra || "dia", diaMes: Number(r.dia ?? 1), nUtil: Number(r.n || 5), antes: !!r.antes }; }
  if (t === "duasVezes") return { tipo: "duasVezes", pagamentos: d.regras.slice(0, 2).map((r) => ({ regra: r.regra || "dia", dia: Number(r.dia ?? 0), n: Number(r.n || 5), antes: !!r.antes })) };
  return { tipo: "manual", datas: d.datas || [] };
}

export function bindPagamento(root, ctx) {
  const { state, persist } = ctx;
  const f = root.querySelector("#form-pagamento");
  if (!f) return;
  const ler = () => {
    const base = ctx.pgDraft || {};
    const v = (id) => { const el = f.querySelector(id); return el ? (el.type === "checkbox" ? el.checked : el.value) : undefined; };
    const d = {
      ...base,
      tipo: v("#pg-tipo"),
      diaSemana: v("#pg-diasem") ?? base.diaSemana ?? getCiclo().diaSemana ?? 5,
      ancora: v("#pg-ancora") ?? base.ancora,
      datas: base.datas || parte(state, "ciclo").datas || [],
      salario: v("#pg-salario"), conta: v("#pg-conta"),
      divConta: v("#pg-divconta") ?? "", divValor: v("#pg-divvalor") ?? base.divValor ?? "",
      piso: v("#pg-piso"),
    };
    const regras = (base.regras || [{ regra: "dia", dia: 15 }, { regra: "dia", dia: 0 }]).map((r) => ({ ...r }));
    f.querySelectorAll("[data-pg]").forEach((el) => {
      const k = Number(el.dataset.k);
      regras[k] = regras[k] || { regra: "dia", dia: 0 };
      regras[k][el.dataset.pg] = el.type === "checkbox" ? el.checked : el.value;
    });
    d.regras = regras;
    return d;
  };
  // Mudanças que trocam os campos redesenham com o rascunho
  const redesenhar = () => { ctx.pgDraft = ler(); ctx.openSec = "ciclo"; ctx.rerender(); };
  f.querySelector("#pg-tipo").addEventListener("change", redesenhar);
  f.querySelectorAll('[data-pg="regra"], #pg-divconta').forEach((el) => el.addEventListener("change", redesenhar));
  f.addEventListener("input", () => { if (!ctx.pgDraft) { ctx.pgDraft = ler(); const bar = f.querySelector(".save-bar"); if (!bar.querySelector(".save-msg")) bar.insertAdjacentHTML("beforeend", `<span class="save-msg warn">alterações não salvas</span>`); } });
  const nova = f.querySelector("#pg-nova");
  const addData = f.querySelector("#pg-add-data");
  if (nova && addData) addData.onclick = () => { const d = ler(); if (nova.value && !d.datas.includes(nova.value)) d.datas = [...d.datas, nova.value].sort(); ctx.pgDraft = d; ctx.openSec = "ciclo"; ctx.rerender(); };
  f.querySelectorAll("[data-pg-rmdata]").forEach((b) => (b.onclick = () => { const d = ler(); d.datas = d.datas.filter((x) => x !== b.dataset.pgRmdata); ctx.pgDraft = d; ctx.openSec = "ciclo"; ctx.rerender(); }));
  f.querySelectorAll("[data-pg-rment]").forEach((b) => (b.onclick = () => {
    state.config = { ...state.config, entradas: listaEntradas(state).filter((e) => e.id !== b.dataset.pgRment) };
    ctx.openSec = "ciclo"; persist(); ctx.rerender();
  }));
  const cancel = f.querySelector("#pg-cancel");
  if (cancel) cancel.onclick = () => { ctx.pgDraft = null; ctx.openSec = "ciclo"; ctx.rerender(); };

  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = ler();
    if (d.tipo === "manual" && !(d.datas || []).length) return toast("Adicione pelo menos uma data");
    salvarParte(state, "ciclo", cicloDe(d));
    // Salário fixo = a entrada fixa (uma só)
    const valor = Number(String(d.salario).replace(",", ".")) || 0;
    const atual = salarioDe(state);
    const outras = listaEntradas(state).filter((x) => x !== atual);
    const divValor = Number(String(d.divValor).replace(",", ".")) || 0;
    const sal = valor > 0 ? {
      ...(atual || { id: "en-salario", nome: "Salário" }), tipo: "fixo", valor, conta: d.conta,
      dia: d.tipo === "semanal" || d.tipo === "quinzenal" ? String(cicloDe(d).diaSemana) : "",
      divisao: d.divConta && divValor > 0 && d.divConta !== d.conta ? [{ conta: d.divConta, valor: divValor }] : [],
    } : null;
    state.config = { ...state.config, entradas: sal ? [sal, ...outras] : outras };
    // Só o piso (meta e turbo ficam iguais ao piso)
    const piso = Number(String(d.piso).replace(",", ".")) || 0;
    salvarParte(state, "metas", { ...parte(state, "metas"), piso, meta: piso, turbo: piso });
    ctx.pgDraft = null; ctx.openSec = null;
    persist(); ctx.rerender(); toast("Salvo ✓");
  });
}
