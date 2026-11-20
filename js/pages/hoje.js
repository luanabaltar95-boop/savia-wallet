import { syncNote } from "../core/sync.js";
// =========================================================
// PÁGINA HOJE — quarta: digita quanto vai entrar.
// Sexta: a carteira diz o que pagar/guardar, em ordem,
// e o que fica para a próxima semana.
// =========================================================
import { buildWeek, allocate, rendaDa, rendaEfetiva, projetar, lyftDa, GROUPS, restante, pagamento } from "../core/plan.js";
import { ajudaDa } from "../core/juntas.js";
import { carteiraVazia } from "./home.js";
import { poupanca, vaiParaPoupanca } from "../core/destino.js";
import { recebidoDa } from "../core/receber.js";
import { addMov, removeMov } from "../core/config.js";
import { toISO, addDays, nextPayday, getCiclo } from "../core/calendar.js";
import { money, dayLabel, shortDate } from "../core/format.js";
import { card, field, levels, mission, payRow, esc } from "../components/ui.js";
import { weekNav, bindWeekNav } from "../components/weekNav.js";


export function renderHoje(root, ctx) {
  const { seed, state, persist } = ctx;
  if (carteiraVazia(seed)) {
    root.innerHTML = `<header class="page-head"><p class="eyebrow">Pagamentos</p><h1>Ainda vazia</h1></header>
      ${card({ title: "Primeiro, montar a carteira", body: `<p>Nada cadastrado ainda.</p><a class="btn primary" href="#ajustes">Ir para Ajustes</a>` })}`;
    return;
  }
  if (!ctx.payday) ctx.payday = nextPayday();
  const payday = ctx.payday;
  const week = buildWeek(seed, state, payday);
  const iso = week.iso;
  const r = state.renda[iso] || {};
  const renda = rendaDa(state, iso);
  const lyft = lyftDa(state, iso);
  const ajuda = ajudaDa(state, iso);
  const receb = recebidoDa(seed, state, iso);
  const pagos = state.pagos[iso] || {};
  const efetiva = rendaEfetiva(seed, state, iso);
  const { cover, ataque } = allocate(week, efetiva.valor);
  const proj = projetar(seed, state, nextPayday());
  const alvo = seed.alvos.map((id) => seed.cartoes.find((c) => c.id === id)).find((c) => c && c.saldo > 0);
  const extraFeito = (state.movs || []).filter((m) => m.semana === iso && m.extra).reduce((a, m) => a + Number(m.valor), 0);

  const atrasados = week.items.filter((i) => i.atrasado && !pagos[i.id]);
  const fazer = week.ordem.filter((i) => (cover[i.id] || 0) > 0.005 || pagos[i.id]);
  const falta = (i) => restante(state, iso, i, cover[i.id]);
  const fica = week.ordem.filter((i) => ["contas", "minimos", "pedidos"].includes(i.grupo) && falta(i) > 0.005);
  const totalFica = fica.reduce((a, i) => a + falta(i), 0);

  // Confirmação de pagamento
  const itemPagar = ctx.pagarItem && week.items.find((i) => i.id === ctx.pagarItem);
  const sugerido = itemPagar ? Math.round(((cover[itemPagar.id] || 0) > 0 ? cover[itemPagar.id] : itemPagar.valor) * 100) / 100 : 0;
  const sheetHtml = itemPagar ? `<div class="sheet-backdrop">
      <form class="sheet" id="pay-sheet" role="dialog" aria-modal="true" aria-labelledby="pg-title" novalidate>
        <div class="sheet-grip"></div>
        <h2 id="pg-title">Confirmar pagamento</h2>
        <p class="hint">${esc(itemPagar.nome)} · previsto ${money(itemPagar.valor, true)}</p>
        <div class="fields">
          ${field({ id: "pg-valor", label: "Valor pago", value: sugerido, prefix: "$" })}
          ${field({ id: "pg-juros", label: "Juros / multa", value: "", prefix: "$", placeholder: "0,00" })}
          ${field({ id: "pg-data", label: "Data do pagamento", type: "date", value: toISO(new Date()) })}
        </div>
        <div class="sheet-total"><span>Total que saiu</span><b id="pg-total">${money(sugerido, true)}</b></div>
        
        <div class="inline-btns"><button class="btn primary" type="submit">Confirmar</button><button class="btn" type="button" id="pg-cancel">Cancelar</button></div>
      </form>
    </div>` : "";

  // Reserva de longo prazo vai para a poupança; o resto fica na corrente
  const pp = poupanca(state);
  const longo = fazer.filter((i) => vaiParaPoupanca(i, payday));
  const valorAgora = (i) => { const info = pagamento(state, iso, i.id); return info && info.valor != null ? info.valor : cover[i.id] || 0; };
  const totalPoup = longo.reduce((a, i) => a + valorAgora(i), 0);
  const totalCorrente = fazer.filter((i) => !vaiParaPoupanca(i, payday)).reduce((a, i) => a + valorAgora(i), 0);
  const ondeFica = totalPoup > 0.005 ? card({
    title: "Onde fica o dinheiro",
    body: `<ul class="cat-list">
      <li><span>Conta corrente (contas e o que vence em até 2 semanas)</span><b>${money(totalCorrente, true)}</b></li>
      <li><span>Transferir para o ${esc(pp.banco)} (reservas de longo prazo)</span><b>${money(totalPoup, true)}</b></li>
    </ul>`,
  }) : "";

  const listaSexta = card({
    title: getCiclo().tipo === "semanal" && Number(getCiclo().diaSemana ?? 5) === 5 ? "Na sexta, nesta ordem" : "No dia do pagamento, nesta ordem",
    total: money(efetiva.valor - ataque),
    hint: efetiva.previsao ? "" : "De cima para baixo — marco cada uma quando concluir.",
    body: `<ul class="missions">${fazer.map((i) => {
      const info = pagamento(state, iso, i.id);
      return payRow(i, { valorAgora: info && info.valor != null ? info.valor : cover[i.id], pago: !!info, info, destino: vaiParaPoupanca(i, payday) ? pp.banco : "" });
    }).join("")}</ul>`,
  });

  const ficaHtml = fica.length
    ? card({
        title: "Fica para a próxima semana",
        total: money(totalFica),
        body: `<ul class="missions">${fica.map((i) => payRow(i, { valorAgora: falta(i), pago: false, destino: vaiParaPoupanca(i, payday) ? pp.banco : "" })).join("")}</ul>`,
      })
    : "";

  const attackBody = ataque > 0 && alvo
    ? `<div class="big">${money(ataque)}</div><p>Sobra para a dívida. Próximo alvo: <b>${esc(alvo.nome)}</b> (saldo ${money(alvo.saldo)}).</p>
       ${extraFeito ? `<p>Já registrado nesta semana: <b>${money(extraFeito, true)}</b>.</p>` : ""}
       <form class="inline" id="extra">
         <label class="field" for="extra-valor"><span class="lbl">Quanto paguei a mais</span>
           <input id="extra-valor" type="number" inputmode="decimal" min="0" step="any" value="${Math.max(0, Math.round((ataque - extraFeito) * 100) / 100) || ""}"></label>
         <button class="btn light" type="submit">Registrar pagamento</button>
       </form>`
    : `<p>Ataque à dívida: ${proj.ataqueDesde ? `<b>${dayLabel(proj.ataqueDesde)}</b>` : "quando sobrar"}</p>`;

  const previsao = card({
    title: "Previsão",
    hint: `Meta: ${money(seed.metas.meta)}`,
    body: `<ul class="missions">
      <li class="mission"><span></span><div class="name">Tudo em dia (sem atrasos)</div><div class="value">${proj.emDia ? dayLabel(proj.emDia) : "—"}</div></li>
      <li class="mission"><span></span><div class="name">Começa o ataque à dívida</div><div class="value">${proj.ataqueDesde ? dayLabel(proj.ataqueDesde) : "—"}</div></li>
    </ul>
    ${proj.alertas.length ? `<div class="banner"><b>Não fecha no prazo:</b> ${proj.alertas.map((a) => `${esc(a.nome)} (${shortDate(a.vence)})`).join(" · ")}</div>` : ""}`,
  });

  const detalhe = GROUPS.map((g) => {
    const its = week.items.filter((i) => i.grupo === g.id);
    if (!its.length) return "";
    const total = its.reduce((a, b) => a + b.valor, 0);
    const list = its.map((i) => mission(i, { coberto: cover[i.id] || 0, pago: !!pagos[i.id], mostrarCobertura: true })).join("");
    return card({ title: g.label, total: money(total), hint: g.hint, body: `<ul class="missions">${list}</ul>` });
  }).join("");

  root.innerHTML = `
    ${weekNav(payday, "Pagamentos", null, atrasados.length
      ? `<button class="alert-btn" id="late-btn" aria-expanded="${!!ctx.showLate}" aria-controls="late-panel" aria-label="${atrasados.length} contas em atraso">!<span class="badge">${atrasados.length}</span></button>`
      : "")}

    ${atrasados.length && ctx.showLate ? `<div class="banner late" id="late-panel">
      <div class="late-head"><b>Em atraso</b><b>${money(atrasados.reduce((a, b) => a + b.valor, 0), true)}</b></div>
      <ul>${atrasados.map((a) => `<li><span>${esc(a.nome.replace(/ — em atraso$/, ""))}</span><span>${money(a.valor, true)}</span></li>`).join("")}</ul>
      
    </div>` : ""}

    ${card({
      title: "Quanto vai entrar",
      body: `<div class="big">${money(renda)}</div>
        <div class="fields">
          ${field({ id: "salario", label: "Salário + extras", value: r.salario, prefix: "$", placeholder: "0,00" })}
          ${lyft.turnos
            ? field({ id: "lyft", label: "Extra money", value: lyft.valor.toFixed(2), readonly: true, prefix: "$", note: `${lyft.turnos} registro(s) · <a href="#extra">ver</a>` })
            : field({ id: "lyft", label: "Extra money", value: r.lyft, prefix: "$", placeholder: "0,00", note: '<a href="#extra">registrar</a>' })}
          ${field({ id: "extras", label: "Outras entradas", value: r.extras, prefix: "$", placeholder: "0,00" })}
        </div>
        ${receb.valor ? `<p class="hint">+ ${money(receb.valor, true)} de ${esc(receb.de.join(", "))}</p>` : ""}
        ${ajuda ? `<p class="hint">+ ${money(ajuda, true)} de ajuda (Dividir)</p>` : ""}
        ${levels({ renda, piso: week.piso, meta: week.meta, turbo: week.turbo })}`,
    })}

    ${listaSexta}
    ${ondeFica}
    ${ficaHtml}
    ${card({ title: "Para a dívida", cls: "attack", body: attackBody })}
    ${previsao}

    <details class="more">
      <summary>Ver tudo da semana por categoria</summary>
      <div class="more-body">${detalhe}</div>
    </details>

    ${syncNote(ctx)}
    ${sheetHtml}
  `;

  bindWeekNav(root, ctx);
  const lb = root.querySelector("#late-btn");
  if (lb) lb.onclick = () => { ctx.showLate = !ctx.showLate; ctx.rerender(); };

  ["salario", "lyft", "extras"].forEach((id) => {
    const el = root.querySelector(`#${id}`);
    if (el.readOnly) return;
    el.addEventListener("input", (e) => {
      state.renda[iso] = { ...(state.renda[iso] || {}), [id]: e.target.value };
      persist();
      ctx.rerender({ focus: id });
    });
  });

  // Marcar: abre a confirmação (valor + juros). Desmarcar: desfaz na hora.
  root.querySelectorAll("[data-pago]:not([disabled])").forEach((el) => {
    el.addEventListener("change", () => {
      const id = el.dataset.pago;
      if (el.checked) {
        el.checked = false;
        ctx.pagarItem = id;
        ctx.rerender();
        return;
      }
      const resto = { ...(state.pagos[iso] || {}) };
      delete resto[id];
      state.pagos[iso] = resto;
      removeMov(state, `pg:${iso}:${id}`);
      persist();
      ctx.rerender();
    });
  });

  const sheet = root.querySelector("#pay-sheet");
  if (sheet) {
    const item = week.items.find((i) => i.id === ctx.pagarItem);
    const fechar = () => { ctx.pagarItem = null; ctx.rerender(); };
    const total = () => {
      const v = Number(sheet.querySelector("#pg-valor").value) || 0;
      const j = Number(sheet.querySelector("#pg-juros").value) || 0;
      sheet.querySelector("#pg-total").textContent = money(v + j, true);
    };
    sheet.addEventListener("input", total);
    sheet.querySelector("#pg-cancel").onclick = fechar;
    root.querySelector(".sheet-backdrop").addEventListener("click", (e) => { if (e.target.classList.contains("sheet-backdrop")) fechar(); });
    sheet.addEventListener("submit", (e) => {
      e.preventDefault();
      const valor = Number(sheet.querySelector("#pg-valor").value);
      const juros = Number(sheet.querySelector("#pg-juros").value) || 0;
      const data = sheet.querySelector("#pg-data").value || toISO(new Date());
      if (!(valor >= 0)) return;
      state.pagos[iso] = { ...(state.pagos[iso] || {}), [item.id]: { valor, juros, data } };
      // Cartão: o valor pago (sem os juros) baixa o saldo
      if (item.cartao) addMov(state, { id: `pg:${iso}:${item.id}`, cartao: item.cartao, tipo: "pagamento", valor, semana: iso, desc: item.nome, data });
      ctx.pagarItem = null;
      persist();
      ctx.rerender();
    });
    sheet.querySelector("#pg-valor").focus();
  }

  const extra = root.querySelector("#extra");
  if (extra) extra.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = Number(root.querySelector("#extra-valor").value);
    if (!(v > 0)) return;
    addMov(state, { id: `ex:${Date.now().toString(36)}`, cartao: alvo.id, tipo: "pagamento", valor: v, semana: iso, extra: true, desc: "Pagamento extra", data: toISO(new Date()) });
    persist();
    ctx.rerender();
  });
}
