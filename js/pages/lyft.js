// =========================================================
// PÁGINA LYFT — turnos, abastecimentos e se o extra compensa.
// Gasolina paga com o cashout do Lyft sai do ganho; com o cartão
// da empresa não custa nada. O que sobra entra sozinho na Hoje.
// =========================================================
import { syncNote } from "../core/sync.js";
import { liquido, porHora, turnosDaSemana, turnosDoMes, resumo, FONTES, gasDaSemana, gasDoMes, custoGas, totalGas, semanaDoTurno } from "../core/lyft.js";
import { toISO, fromISO, addDays, nextPayday, pagamentoAnterior } from "../core/calendar.js";
import { money, dayLabel, shortDate } from "../core/format.js";
import { card, field, segmented, stats, esc, chip } from "../components/ui.js";
import { weekNav, bindWeekNav } from "../components/weekNav.js";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const n = (v) => Number(v) || 0;
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaCurto = (iso) => { const d = fromISO(iso); return `${DIAS[d.getDay()]} ${shortDate(d)}`; };
const ler = (form, campos) => { const f = new FormData(form); return Object.fromEntries(campos.map((k) => [k, f.get(k) ?? ""])); };

function previa(t) {
  const liq = liquido(t);
  const h = n(t.horas);
  return `<span class="big-sm">${money(liq, true)}</span> no turno${h ? ` · <b>${money(porHora(liq, h), true)}</b> por hora` : ""}`;
}

const daOrigem = (o) => (x) => (x.origem || "lyft") === o;

// Semanas com algum registro, da mais antiga para a atual (até 8)
function semanasComDados(state, origem) {
  const isos = new Set([...(state.lyft || []).filter(daOrigem(origem)).map((t) => semanaDoTurno(t.data)), ...(state.gasolina || []).filter(daOrigem(origem)).map((g) => semanaDoTurno(g.data))]);
  return [...isos].sort().slice(-8);
}

// Gráfico: uma barra por semana = ganho do app, dividido em sobra / gasolina / pedágio
function grafico(state, origem) {
  const sem = semanasComDados(state, origem).map((iso) => {
    const ts = turnosDaSemana(state, iso, origem);
    const r = resumo(ts);
    const gas = custoGas(gasDaSemana(state, iso, origem)) + ts.reduce((a, t) => a + (["lyft", "eu"].includes(t.gasQuem) ? n(t.gasolina) : 0), 0);
    const ped = ts.reduce((a, t) => a + n(t.pedagioPago) - n(t.pedagioReemb), 0);
    const ganho = r.ganho;
    const sobra = ganho - gas - Math.max(0, ped);
    return { iso, ganho, gas, ped: Math.max(0, ped), sobra, horas: r.horas, porHora: r.horas ? sobra / r.horas : 0 };
  });
  if (!sem.length) return `<p class="hint">Sem turnos ainda.</p>`;
  const max = Math.max(...sem.map((s) => s.ganho), 1);
  const tot = sem.reduce((a, s) => ({ ganho: a.ganho + s.ganho, gas: a.gas + s.gas, sobra: a.sobra + s.sobra, horas: a.horas + s.horas }), { ganho: 0, gas: 0, sobra: 0, horas: 0 });
  const pctGas = tot.ganho ? Math.round((tot.gas / tot.ganho) * 100) : 0;
  const mediaH = tot.horas ? tot.sobra / tot.horas : 0;
  const veredito = mediaH >= 20 ? "Está compensando." : mediaH >= 12 ? "Compensa pouco — escolha os melhores horários." : "Não está compensando o tempo.";
  return `
    <p class="chart-lead"><b>${money(mediaH, true)}/hora</b> de sobra em média · gasolina = ${pctGas}% do ganho. ${veredito}</p>
    <ul class="bars">${sem.map((s) => `
      <li>
        <span class="bar-label">sex ${shortDate(fromISO(s.iso))}</span>
        <span class="bar-track" style="--w:${(s.ganho / max) * 100}%">
          <span class="seg ok" style="width:${s.ganho ? (s.sobra / s.ganho) * 100 : 0}%"></span>
          <span class="seg gas" style="width:${s.ganho ? (s.gas / s.ganho) * 100 : 0}%"></span>
          <span class="seg ped" style="width:${s.ganho ? (s.ped / s.ganho) * 100 : 0}%"></span>
        </span>
        <span class="bar-val">${money(s.sobra)}<small>${s.horas ? `${money(s.porHora)}/h` : ""}</small></span>
      </li>`).join("")}
    </ul>
    <div class="legend"><span><i class="ok"></i>sobra</span><span><i class="gas"></i>gasolina</span><span><i class="ped"></i>pedágio</span></div>`;
}

export function renderLyft(root, ctx, fonte = { id: "lyft", nome: "Lyft" }) {
  const { state, persist } = ctx;
  const origem = fonte.id;
  const FONTES_GAS = FONTES.map((f) => (f.id === "lyft" ? { ...f, label: `Cashout do ${fonte.nome}` } : f));
  if (!ctx.payday) ctx.payday = nextPayday();
  const iso = toISO(ctx.payday);
  const semana = turnosDaSemana(state, iso, origem);
  const gasSem = gasDaSemana(state, iso, origem);
  const rs = resumo(semana);
  const gasCusto = custoGas(gasSem);
  const sobraSem = rs.liquido - gasCusto;
  const hoje = new Date();
  const rm = resumo(turnosDoMes(state, hoje.getFullYear(), hoje.getMonth(), origem));
  const gasMes = gasDoMes(state, hoje.getFullYear(), hoje.getMonth(), origem);
  const dataPadrao = toISO(hoje < ctx.payday ? hoje : addDays(ctx.payday, -1));
  const draft = ctx.lyftDraft || { data: dataPadrao };
  const gdraft = ctx.gasDraft || { data: dataPadrao, fonte: "lyft" };

  const registros = [
    ...semana.map((t) => ({ data: t.data, html: `<li class="reg">
      <span class="reg-dia">${diaCurto(t.data)}</span>
      <span class="reg-info">turno${n(t.horas) ? ` · ${t.horas}h` : ""}${n(t.milhas) ? ` · ${n(t.milhas).toLocaleString("pt-BR")} mi` : ""}</span>
      <span class="reg-val ok">+${money(liquido(t), true)}</span>
      <button class="link" data-del="${esc(t.id)}" aria-label="Apagar turno">apagar</button></li>` })),
    ...gasSem.map((g) => ({ data: g.data, html: `<li class="reg">
      <span class="reg-dia">${diaCurto(g.data)}</span>
      <span class="reg-info">gasolina · ${g.fonte === "empresa" ? "empresa" : "cashout"}</span>
      <span class="reg-val ${g.fonte === "empresa" ? "" : "gas"}">${g.fonte === "empresa" ? money(n(g.valor), true) : `−${money(n(g.valor), true)}`}</span>
      <button class="link" data-delgas="${esc(g.id)}" aria-label="Apagar abastecimento">apagar</button></li>` })),
  ].sort((a, b) => b.data.localeCompare(a.data)).map((r) => r.html).join("");

  root.innerHTML = `
    <a class="back" href="#extra">‹ Extra Money</a>
    ${weekNav(ctx.payday, esc(fonte.nome), `turnos ${shortDate(pagamentoAnterior(ctx.payday))} – ${shortDate(addDays(ctx.payday, -1))}`)}

    ${ctx.lyftUndo ? `<div class="banner calm">Registro apagado. <button class="link" id="undo">Desfazer</button></div>` : ""}

    ${card({
      title: "Esta semana",
      body: `<div class="big">${money(sobraSem)}</div>
        ${stats([
          { label: "Ganho no app", valor: money(rs.ganho) },
          { label: "Gasolina", valor: money(gasCusto), sub: totalGas(gasSem) > gasCusto ? `+${money(totalGas(gasSem) - gasCusto)} empresa` : "" },
          { label: "Por hora", valor: rs.horas ? money(sobraSem / rs.horas, true) : "—" },
        ])}`,
    })}

    ${card({ title: "O extra está compensando?", body: grafico(state, origem) })}

    <form class="card" id="turno" novalidate>
      <div class="card-head"><h2>Novo turno</h2></div>
      <div class="form-group">
        <div class="fields">
          ${field({ id: "data", label: "Data", type: "date", value: draft.data })}
          ${field({ id: "horas", label: "Horas", value: draft.horas, suffix: "h" })}
          ${field({ id: "ganho", label: "Ganho no app", value: draft.ganho, prefix: "$", placeholder: "0,00" })}
          ${field({ id: "milhas", label: "Milhas", value: draft.milhas, suffix: "mi" })}
          ${field({ id: "pedagioPago", label: "Pedágio pago", value: draft.pedagioPago, prefix: "$", placeholder: "0,00" })}
          ${field({ id: "pedagioReemb", label: "Pedágio devolvido", value: draft.pedagioReemb, prefix: "$", placeholder: "0,00" })}
        </div>
      </div>
      <div class="preview-box" id="previa">${previa(draft)}</div>
      <button class="btn primary" type="submit">Salvar turno</button>
    </form>

    <form class="card" id="abastecer" novalidate>
      <div class="card-head"><h2>Abasteci</h2></div>
      <div class="fields">
        ${field({ id: "g-data", name: "data", label: "Data", type: "date", value: gdraft.data })}
        ${field({ id: "g-valor", name: "valor", label: "Valor", value: gdraft.valor, prefix: "$", placeholder: "0,00" })}
      </div>
      ${segmented({ name: "fonte", label: "Pago com", options: FONTES_GAS, value: gdraft.fonte })}
      <p class="preview" id="g-msg"></p>
      <button class="btn primary" type="submit">Salvar abastecimento</button>
    </form>

    ${card({ title: "Registros da semana", body: registros ? `<ul class="regs">${registros}</ul>` : `<p class="hint">Nada registrado nesta semana.</p>` })}

    ${card({
      title: `Resumo de ${MESES[hoje.getMonth()]}`,
      body: stats([
        { label: "Sobrou", valor: money(rm.liquido - custoGas(gasMes)) },
        { label: "Gasolina", valor: money(custoGas(gasMes)) },
        { label: "Milhas", valor: rm.milhas.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) },
      ]),
    })}

    ${syncNote(ctx)}
  `;

  bindWeekNav(root, ctx);

  const campos = ["data", "horas", "ganho", "milhas", "pedagioPago", "pedagioReemb"];
  const form = root.querySelector("#turno");
  form.addEventListener("input", () => { ctx.lyftDraft = ler(form, campos); root.querySelector("#previa").innerHTML = previa(ctx.lyftDraft); });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = ler(form, campos);
    if (!t.data || !(n(t.ganho) > 0)) {
      root.querySelector("#previa").innerHTML = `<span class="status warn">Preencha a data e o ganho do app.</span>`;
      return;
    }
    state.lyft = [...(state.lyft || []), { id: Date.now().toString(36), origem, ...t }];
    ctx.lyftDraft = { data: t.data };
    ctx.lyftUndo = null;
    persist();
    ctx.rerender();
  });

  const gform = root.querySelector("#abastecer");
  gform.addEventListener("input", () => { ctx.gasDraft = ler(gform, ["data", "valor", "fonte"]); });
  gform.addEventListener("submit", (e) => {
    e.preventDefault();
    const g = ler(gform, ["data", "valor", "fonte"]);
    if (!g.data || !(n(g.valor) > 0)) {
      root.querySelector("#g-msg").innerHTML = `<span class="status warn">Preencha a data e o valor.</span>`;
      return;
    }
    state.gasolina = [...(state.gasolina || []), { id: "g" + Date.now().toString(36), origem, ...g }];
    ctx.gasDraft = { data: g.data, fonte: g.fonte };
    persist();
    ctx.rerender();
  });

  root.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = () => {
      ctx.lyftUndo = { tipo: "lyft", item: state.lyft.find((x) => x.id === b.dataset.del) };
      state.lyft = state.lyft.filter((x) => x.id !== b.dataset.del);
      persist(); ctx.rerender();
    };
  });
  root.querySelectorAll("[data-delgas]").forEach((b) => {
    b.onclick = () => {
      ctx.lyftUndo = { tipo: "gasolina", item: state.gasolina.find((x) => x.id === b.dataset.delgas) };
      state.gasolina = state.gasolina.filter((x) => x.id !== b.dataset.delgas);
      persist(); ctx.rerender();
    };
  });
  const undo = root.querySelector("#undo");
  if (undo) undo.onclick = () => {
    const u = ctx.lyftUndo;
    state[u.tipo] = [...(state[u.tipo] || []), u.item];
    ctx.lyftUndo = null; persist(); ctx.rerender();
  };
}
