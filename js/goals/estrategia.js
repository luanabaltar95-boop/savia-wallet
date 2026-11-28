// =========================================================
// ESTRATÉGIA DE DISTRIBUIÇÃO — em que ordem o dinheiro de cada
// pagamento cobre cada tipo de compromisso. Conceitos separados:
//   essenciais   vida do dia a dia (mercado, transporte, pets)
//   atrasados    contas que já venceram
//   obrigacoes   contas com data neste período (aluguel, internet…)
//   minimos      pagamento mínimo de cartões
//   compromissos futuras protegidas (já assumidas, com data)
//   reservas     guardar para contas que vêm (mês, prazos)
//   objetivos    Guardar de cada objetivo, por prioridade
//   pedidos      gastos planejados opcionais (ocasiões, desejos)
//   livre        o que sobra → destino definido pela estratégia
// Hoje existe UMA estratégia ("equilibrada"). Outras (quitação
// acelerada, reserva primeiro, personalizada) estão no ROADMAP;
// basta descrever outra ordem e outro destino do livre aqui.
// =========================================================
export const CATEGORIAS = {
  essenciais: "Despesas essenciais",
  atrasados: "Contas atrasadas",
  obrigacoes: "Contas do período",
  minimos: "Pagamentos mínimos",
  compromissos: "Futuras com data",
  reservas: "Reservas para contas que vêm",
  objetivos: "Para os objetivos",
  pedidos: "Pedidos e ocasiões",
};

// Classifica um item do plano (independe da estratégia)
export function categoria(i) {
  if (i.grupo === "vida") return "essenciais";
  if (i.grupo === "colchao") return "objetivos";
  if (i.atrasado) return "atrasados";
  if (i.grupo === "minimos") return "minimos";
  if (i.acao === "pagar") return "obrigacoes";
  if (i.grupo === "pedidos") return i.protegido ? "compromissos" : "pedidos";
  return "reservas";
}

export const ESTRATEGIAS = {
  equilibrada: {
    id: "equilibrada", label: "Equilibrada",
    // camadas: na mesma camada, vence primeiro quem vence antes
    ordem: [["essenciais"], ["atrasados"], ["obrigacoes", "minimos"], ["compromissos"], ["reservas"], ["objetivos"], ["pedidos"]],
    livre: "divida-mais-cara", // o que sobra ataca a dívida de juros mais altos
  },
};
export const estrategiaAtual = () => ESTRATEGIAS.equilibrada;

// Camada do item na estratégia (número menor = recebe antes)
export function camada(i, e = estrategiaAtual()) {
  const c = categoria(i);
  const k = e.ordem.findIndex((g) => g.includes(c));
  return k < 0 ? e.ordem.length : k;
}
export const camadaDe = (cat, e = estrategiaAtual()) => e.ordem.findIndex((g) => g.includes(cat));
