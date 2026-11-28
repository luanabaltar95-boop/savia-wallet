// =========================================================
// MÓDULOS — o que cada pessoa liga no próprio app.
// A base (Hoje, Minhas contas, Entradas, Ajustes) é de todo mundo.
//   state.config.modulos  { [id]: true | false }   (sem nada = tudo ligado, como sempre foi)
//   state.config.atalhos  [id, id]                 até 2 na barra de baixo
//   state.config.ordemMenu [id…]                   ordem no menu "+"
// Desligar só esconde: os dados ficam guardados.
// =========================================================
export const MODULOS = [
  { id: "dividir", label: "Dividir", desc: "Contas divididas e quem me deve", pagina: "dividir", pergunta: "Divide contas com alguém?" },
  { id: "dividas", label: "Dívidas e cartões", desc: "Cartões, dívidas e o que quitar primeiro", pagina: "dividas", blocos: ["cartoes", "dividas"], pergunta: "Tem cartões ou dívidas que quer quitar?" },
  { id: "extra", label: "Extra Money", desc: "Calculadoras de renda que muda", pagina: "extra", pergunta: "Tem renda extra que muda (app de corrida, gorjeta, freela)?" },
  { id: "financiamentos", label: "Financiamentos", desc: "Carro e compras parceladas", blocos: ["financiamentos"], pergunta: "Tem financiamento ou compras parceladas?" },
  { id: "moedas", label: "Moedas", desc: "Contas em outra moeda e câmbio", pergunta: "Paga contas em outra moeda?" },
  { id: "planejar", label: "Planejar", desc: "Guardar para datas e ocasiões", pagina: "planejar", pergunta: "Quer guardar para datas e ocasiões?" },
  { id: "metas", label: "Piso da semana", desc: "Quanto falta para o mínimo", pergunta: null },
  { id: "documentos", label: "Documentos", desc: "Contratos e comprovantes", emBreve: true },
];

const cfg = (state) => (state && state.config) || {};
export function ativo(state, id) {
  const m = cfg(state).modulos;
  const mod = MODULOS.find((x) => x.id === id);
  if (mod && mod.emBreve) return false;
  return m ? m[id] !== false && !!m[id] : true;
}
export const ativos = (state) => MODULOS.filter((m) => ativo(state, m.id));

// Página pertence a um módulo desligado?
export function paginaLiberada(state, pagina) {
  const mod = MODULOS.find((m) => m.pagina === pagina);
  return !mod || ativo(state, mod.id);
}
// Bloco de Ajustes liberado?
export function blocoLiberado(state, bloco) {
  const mod = MODULOS.find((m) => (m.blocos || []).includes(bloco));
  return !mod || ativo(state, mod.id);
}

export function ligar(state, id, on) {
  const atual = cfg(state).modulos || Object.fromEntries(MODULOS.map((m) => [m.id, !m.emBreve]));
  let atalhos = atalhosDe(state);
  if (!on) atalhos = atalhos.filter((a) => a !== id);
  state.config = { ...cfg(state), modulos: { ...atual, [id]: on }, atalhos };
}

// Atalhos da barra (só de módulos ligados e com página)
export const atalhosDe = (state) => (cfg(state).atalhos || []).filter((id) => {
  const m = MODULOS.find((x) => x.id === id);
  return m && m.pagina && ativo(state, id);
}).slice(0, 2);
export function alternarAtalho(state, id) {
  let a = atalhosDe(state);
  a = a.includes(id) ? a.filter((x) => x !== id) : [...a, id].slice(-2);
  state.config = { ...cfg(state), atalhos: a };
}

// Ordem no menu "+" (só os módulos com página)
export function ordemMenu(state) {
  const ordem = cfg(state).ordemMenu || [];
  const comPagina = MODULOS.filter((m) => m.pagina);
  return [...comPagina].sort((a, b) => {
    const ia = ordem.indexOf(a.id), ib = ordem.indexOf(b.id);
    return (ia < 0 ? 99 + comPagina.indexOf(a) : ia) - (ib < 0 ? 99 + comPagina.indexOf(b) : ib);
  });
}
export function moverMenu(state, id, dir) {
  const ids = ordemMenu(state).map((m) => m.id);
  const i = ids.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  state.config = { ...cfg(state), ordemMenu: ids };
}
