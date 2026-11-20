// =========================================================
// PÁGINAS AINDA NÃO CONSTRUÍDAS — uma por vez, conforme o plano.
// =========================================================
const TEXTOS = {
  planejar: ["Planejar", "Pedidos de orçamento para datas e ocasiões, com o impacto no plano antes de aprovar."],
  lyft: ["Lyft", "Registro de cada turno: ganho, pedágios, gasolina e quem pagou, para saber o valor real por hora."],
  dividas: ["Dívidas", "Cartões em ordem de ataque, cenários e a data prevista de quitação."],
  compartilhado: ["Compartilhado", "Custos dos cachorros e o que cada uma pagou."],
};

export function renderEmBreve(root, page) {
  const [titulo, texto] = TEXTOS[page] || ["Em breve", ""];
  root.innerHTML = `<section class="card soon"><h1>${titulo}</h1><p>${texto}</p><p class="hint">Próximas etapas da construção.</p></section>`;
}
