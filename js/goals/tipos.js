// =========================================================
// TIPOS DE OBJETIVO — catálogo único usado pelo onboarding,
// por Ajustes e pela Home. Cada tipo diz:
//   dinheiro: tem valor-alvo em dinheiro (true) ou não (false)
//   continuo: não termina (ex.: manter as contas organizadas)
//   precisa:  quais informações o objetivo usa (ver necessidades.js)
//   modulos:  módulos do app que o objetivo liga
// =========================================================
export const TIPOS = [
  { id: "dividas", label: "Sair das dívidas", desc: "Atrasados, cartões e empréstimos", icone: "⛰️",
    dinheiro: false, precisa: ["pagamento", "contas", "dividas"], modulos: ["dividas", "financiamentos", "metas"] },
  { id: "organizar", label: "Organizar minhas finanças", desc: "Contas em dia, saldo conferido", icone: "🗂️",
    dinheiro: false, continuo: true, precisa: ["pagamento", "bancos", "contas"], modulos: ["metas"] },
  { id: "economizar", label: "Economizar dinheiro", desc: "Guardar um valor por semana", icone: "🌱",
    dinheiro: true, precisa: ["pagamento", "bancos", "valor"], modulos: ["metas"] },
  { id: "reserva", label: "Reserva de emergência", desc: "Meses de contas guardados", icone: "🛟",
    dinheiro: true, precisa: ["pagamento", "bancos", "contas", "valor"], modulos: ["metas"] },
  { id: "compra", label: "Uma compra ou projeto", desc: "Viagem, carro, entrada de imóvel", icone: "🎯",
    dinheiro: true, precisa: ["pagamento", "bancos", "valor"], modulos: ["planejar"] },
  { id: "patrimonio", label: "Construir patrimônio", desc: "O que tenho menos o que devo", icone: "🏛️",
    dinheiro: true, precisa: ["pagamento", "bancos", "dividas", "valor"], modulos: [] },
  { id: "moedas", label: "Gerenciar diferentes moedas", desc: "Contas e pagamentos em outros países", icone: "💱",
    dinheiro: false, continuo: true, precisa: ["pagamento", "bancos", "moedas"], modulos: ["moedas"] },
  { id: "familia", label: "Finanças da família", desc: "Dividir contas e acertos", icone: "🏡",
    dinheiro: false, continuo: true, precisa: ["pagamento", "contas", "familia"], modulos: ["dividir"] },
  { id: "documentos", label: "Documentos e contratos", desc: "Em breve", icone: "📄",
    dinheiro: false, continuo: true, emBreve: true, precisa: [], modulos: [] },
  { id: "personalizado", label: "Objetivo personalizado", desc: "Do meu jeito, com valor ou etapas", icone: "✨",
    dinheiro: true, precisa: ["valor"], modulos: [] },
];

export const tipo = (id) => TIPOS.find((t) => t.id === id) || TIPOS[TIPOS.length - 1];
// Objetivo em dinheiro: o tipo é de dinheiro e (no personalizado) tem valor-alvo
export const ehDinheiro = (g) => tipo(g.tipo).dinheiro && (g.tipo !== "personalizado" || Number(g.alvo) > 0);
