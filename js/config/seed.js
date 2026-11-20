// =========================================================
// CARTEIRA NOVA — valores padrão (vazios).
// Nada pessoal fica no código: cada pessoa monta a própria carteira
// em Ajustes, e os dados ficam só na conta dela.
//
// Formato dos itens (para quem for mexer no código):
//   semanais:  { id, nome, valor, grupo: "vida", compartilhado? }
//   mensais:   { id, nome, valor, dia, freq: mensal|bimestral|trimestral|semestral|anual,
//                categoria, grupo: "contas"|"investimento", desde?, ate?, divida? }
//   parcelas:  { id, nome, valor, dia, desde?, ate, total?, divida? }  (financiamentos e parcelamentos)
//   pontuais:  { id, nome, valor, semana (dia de pagamento), atrasado?, divida? }
//   cartoes:   { id, nome, saldo, limite, apr, dia, minimo }
//   outras:    { id, nome, saldo, parcela, ate?, nota }  (dívidas que não são cartão)
//   divida:    id de uma dívida em "outras" — pagar o item baixa o saldo dela
// =========================================================
export const SEED = {
  semanais: [],
  reservasMensais: { id: "reserva-mes", nome: "Guardar contas do mês", itens: [], grupo: "contas" },
  mensais: [],
  parcelas: [],
  cartoes: [],
  pontuais: [],
  reservasPrazo: [],
  pedidos: [],
  colchaoSemanal: 0,
  metas: { piso: 0, meta: 0, turbo: 0 },
  ciclo: { tipo: "semanal", diaSemana: 5 },
  outras: [],
  compartilhadas: [],
  fontes: [],
  receber: [],
  alvos: [],
  categorias: [
    { id: "moradia", label: "Moradia" },
    { id: "carro", label: "Carro e transporte" },
    { id: "saude", label: "Saúde" },
    { id: "assinaturas", label: "Assinaturas" },
    { id: "investimentos", label: "Investimentos" },
    { id: "outras", label: "Outras" },
  ],
  inicio: null,
  cartoesInicio: null,
};
