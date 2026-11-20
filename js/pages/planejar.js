// =========================================================
// PÁGINA PLANEJAR — pedir orçamento para datas e ocasiões.
// Você diz o que quer, quanto e quando; a carteira mostra as
// opções e o impacto na quitação antes de você aprovar.
// =========================================================
import { syncNote } from "../core/sync.js";
import { opcoes, impacto, novoPedido, parcelasTexto } from "../core/pedidos.js";
import { toISO, fromISO, addDays } from "../core/calendar.js";
import { money, fullDate, shortDate, dayLabel } from "../core/format.js";
import { card, field, chip, esc } from "../components/ui.js";

function textoImpacto(im) {
  if (im.dias == null) return "Muda pouco a previsão dos cartões.";
  if (im.dias <= 0) return `Não atrasa a quitação dos cartões (${fullDate(im.fimDepois)}).`;
  return `Atrasa a quitação dos cartões em <b>${im.dias} dias</b> (${fullDate(im.fimAntes)} → ${fullDate(im.fimDepois)}).`;
}

export function renderPlanejar(root, ctx) {
  const { seed, state, persist } = ctx;
  const draft = ctx.planDraft || {};
  const pedidos = state.pedidos || [];
  const fmt = { date: shortDate, money: (v) => money(v, true) };

  const opcoesHtml = draft.ops
    ? card({
        title: `${esc(draft.nome)} — ${money(Number(draft.valor))} até ${dayLabel(fromISO(draft.data))}`,
        hint: "",
        body: `<ul class="missions">${draft.ops.map((o, k) => `
          <li class="option">
            <div class="name">${esc(o.label)}</div>
            <div class="hint">${parcelasTexto(o, fmt)}</div>
            <p>${textoImpacto(o.im)}</p>
            ${o.im.naoFecha ? `<div class="banner">Com a meta de ${money(seed.metas.meta)}, essa opção não fecha até a data.</div>` : ""}
            <button class="btn primary" data-aprovar="${k}">Aprovar esta opção</button>
          </li>`).join("")}</ul>
          <button class="link" id="cancelar">Cancelar pedido</button>`,
      })
    : "";

  const lista = pedidos.length
    ? `<ul class="missions">${pedidos.map((p) => `
        <li class="mission">
          <span></span>
          <div>
            <div class="name">${esc(p.nome)}</div>
            <div class="meta">${chip(`até ${shortDate(fromISO(p.data))}`, "plan")}</div>
            <div class="hint">${parcelasTexto(p, fmt)}</div>
          </div>
          <div class="value">${money(p.valor, true)}<div><button class="link" data-remover="${esc(p.id)}">remover</button></div></div>
        </li>`).join("")}</ul>`
    : `<p class="hint">Nenhum pedido ainda.</p>`;

  const protegidos = seed.pedidos.map((p) => {
    const total = Object.values(p.parcelas).reduce((a, b) => a + b, 0);
    return `<li class="mission"><span></span><div><div class="name">${esc(p.nome)}</div><div class="meta">${chip("protegido", "plan")}${chip(`vence ${shortDate(fromISO(p.vence))}`)}</div></div><div class="value">${money(total, true)}</div></li>`;
  }).join("");

  root.innerHTML = `
    <header class="page-head">
      <p class="eyebrow">Planejar</p>
      <h1>Pedidos de orçamento</h1>
    </header>

    <form class="card" id="pedido" novalidate>
      <div class="card-head"><h2>Novo pedido</h2></div>
      <div class="fields">
        ${field({ id: "nome", label: "Para quê?", type: "text", value: draft.nome })}
        ${field({ id: "valor", label: "Quanto?", value: draft.valor, prefix: "$", placeholder: "0,00" })}
        ${field({ id: "data", label: "Até quando?", type: "date", value: draft.data || toISO(addDays(new Date(), 21)) })}
      </div>
      <p class="preview" id="msg"></p>
      <button class="btn primary" type="submit">Ver opções e impacto</button>
    </form>

    ${opcoesHtml}

    ${card({ title: "Pedidos aprovados", total: pedidos.length ? money(pedidos.reduce((a, p) => a + p.valor, 0)) : null, body: lista })}

    ${card({ title: "Já no plano", hint: "", body: `<ul class="missions">${protegidos}</ul>` })}

    ${syncNote(ctx)}
  `;

  const form = root.querySelector("#pedido");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    if (!f.nome.trim() || !(Number(f.valor) > 0) || !f.data) {
      root.querySelector("#msg").innerHTML = `<span class="status warn">Preencha para quê, quanto e até quando.</span>`;
      return;
    }
    root.querySelector("#msg").textContent = "Calculando…";
    setTimeout(() => {
      const ops = opcoes(Number(f.valor), f.data).map((o) => {
        const p = novoPedido(f, o);
        return { ...o, im: impacto(seed, state, p) };
      });
      ctx.planDraft = { ...f, ops };
      ctx.rerender();
    }, 10);
  });

  root.querySelectorAll("[data-aprovar]").forEach((b) => {
    b.onclick = () => {
      const o = draft.ops[Number(b.dataset.aprovar)];
      state.pedidos = [...pedidos, novoPedido(draft, o)];
      ctx.planDraft = null;
      persist();
      ctx.rerender();
    };
  });
  const cancelar = root.querySelector("#cancelar");
  if (cancelar) cancelar.onclick = () => { ctx.planDraft = null; ctx.rerender(); };

  root.querySelectorAll("[data-remover]").forEach((b) => {
    b.onclick = () => {
      state.pedidos = pedidos.filter((p) => p.id !== b.dataset.remover);
      persist();
      ctx.rerender();
    };
  });
}
