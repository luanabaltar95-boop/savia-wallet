// =========================================================
// PERFIS DE DEMONSTRAÇÃO — dados 100% fictícios para testar o app
// sem banco de dados (previews e computador local). Nenhum dado real.
// Senha de todos: demo1234
//   @ana    sai das dívidas (cartões, atraso) e guarda um pouco
//   @bruno  sem dívidas, economizando para uma viagem + organizar
//   @carla  contas em outra moeda e casa dividida
//   @dani   renda variável (freela), recebe a cada 15 dias, organizar
//   @eva    já concluiu um objetivo (notebook) e segue com a reserva
//   @novo   carteira vazia (primeiro acesso)
// =========================================================
export const SENHA_DEMO = "demo1234";

const hoje = () => new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dias = (n) => { const d = hoje(); d.setDate(d.getDate() + n); return d; };
// Próxima sexta (ou hoje, se for sexta): o atraso entra no plano aberto
const proximaSexta = () => { const d = hoje(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7)); return d; };
const conferido = (valor) => ({ saldo: valor, saldoEm: Date.now() - 86400000 });
const base = (config, extra = {}) => ({ renda: {}, pagos: {}, lyft: [], pedidos: [], juntas: [], movs: [], recebimentos: [], gasolina: [], config: { onboarding: true, ciclo: { tipo: "semanal", diaSemana: 5 }, moeda: "USD", ...config }, ...extra, updatedAt: Date.now() });

export function perfisDemo() {
  return {
    ana: base({
      entradas: [{ id: "en-1", nome: "Salário", tipo: "fixo", valor: 850, dia: "5", conta: "corrente", divisao: [] }],
      metas: { piso: 850, meta: 850, turbo: 850 },
      semanais: [{ id: "s1", nome: "Mercado", valor: 110, grupo: "vida" }, { id: "s2", nome: "Transporte", valor: 35, grupo: "vida" }],
      mensais: [
        { id: "m1", nome: "Aluguel", valor: 1100, dia: 1, freq: "mensal", categoria: "moradia", grupo: "contas" },
        { id: "m2", nome: "Internet", valor: 55, dia: 12, freq: "mensal", categoria: "moradia", grupo: "contas" },
        { id: "m3", nome: "Celular", valor: 40, dia: 20, freq: "mensal", categoria: "outras", grupo: "contas" },
      ],
      cartoes: [
        { id: "c1", nome: "Cartão Azul", saldo: 2400, limite: 3000, apr: 27.9, dia: 8, minimo: 70 },
        { id: "c2", nome: "Cartão Verde", saldo: 900, limite: 1500, apr: 21.5, dia: 18, minimo: 35 },
      ],
      alvos: ["c1", "c2"],
      cartoesInicio: 3600,
      pontuais: [{ id: "p1", nome: "Conta de luz (atrasada)", valor: 95, semana: iso(proximaSexta()), atrasado: true }],
      objetivos: [
        { id: "ob-a1", tipo: "dividas", prioridade: 1, principal: true, status: "ativo", inicio: iso(dias(-30)) },
        { id: "ob-a2", tipo: "reserva", nome: "Reserva", alvo: 1500, semanal: 20, conta: "poupanca-ana", prioridade: 2, status: "ativo", inicio: iso(dias(-30)) },
      ],
    }, { bancos: [{ id: "corrente", banco: "Banco Exemplo", tipo: "checking", ...conferido(420) }, { id: "poupanca-ana", banco: "Poupança Exemplo", tipo: "savings", ...conferido(150) }] }),

    bruno: base({
      entradas: [{ id: "en-1", nome: "Salário", tipo: "fixo", valor: 1200, dia: "5", conta: "corrente", divisao: [] }],
      metas: { piso: 1200, meta: 1200, turbo: 1200 },
      semanais: [{ id: "s1", nome: "Mercado", valor: 140, grupo: "vida" }],
      mensais: [
        { id: "m1", nome: "Aluguel", valor: 1500, dia: 5, freq: "mensal", categoria: "moradia", grupo: "contas" },
        { id: "m2", nome: "Academia", valor: 45, dia: 10, freq: "mensal", categoria: "saude", grupo: "contas" },
        { id: "m3", nome: "Streaming", valor: 18, dia: 22, freq: "mensal", categoria: "assinaturas", grupo: "contas" },
      ],
      objetivos: [
        { id: "ob-b1", tipo: "compra", nome: "Viagem", alvo: 3000, semanal: 150, ate: iso(dias(180)), conta: "poupanca-bruno", prioridade: 1, principal: true, status: "ativo" },
        { id: "ob-b2", tipo: "organizar", prioridade: 2, status: "ativo" },
      ],
    }, { bancos: [{ id: "corrente", banco: "Banco Exemplo", tipo: "checking", ...conferido(900) }, { id: "poupanca-bruno", banco: "Poupança Exemplo", tipo: "savings", ...conferido(600) }] }),

    carla: base({
      entradas: [{ id: "en-1", nome: "Salário", tipo: "fixo", valor: 1000, dia: "5", conta: "corrente", divisao: [] }],
      metas: { piso: 1000, meta: 1000, turbo: 1000 },
      semanais: [{ id: "s1", nome: "Mercado da casa", valor: 160, grupo: "vida", compartilhado: true }],
      mensais: [
        { id: "m1", nome: "Aluguel (dividido)", valor: 700, dia: 3, freq: "mensal", categoria: "moradia", grupo: "contas", compartilhado: true },
        { id: "m2", nome: "Ajuda à família (exterior)", valor: 200, valorMoeda: 1000, moeda: "BRL", dia: 15, freq: "mensal", categoria: "outras", grupo: "contas" },
      ],
      objetivos: [
        { id: "ob-c1", tipo: "moedas", prioridade: 1, principal: true, status: "ativo" },
        { id: "ob-c2", tipo: "familia", prioridade: 2, status: "ativo" },
        { id: "ob-c3", tipo: "reserva", semanal: 40, conta: "poupanca-carla", prioridade: 3, status: "ativo" },
      ],
    }, { bancos: [{ id: "corrente", banco: "Banco Exemplo", tipo: "checking", ...conferido(650) }, { id: "poupanca-carla", banco: "Poupança Exemplo", tipo: "savings", ...conferido(300) }], cotacoes: { BRL: { taxa: 5, em: Date.now() } } }),

    dani: base({
      ciclo: { tipo: "quinzenal", diaSemana: 5, ancora: iso(dias(0)) },
      entradas: [{ id: "en-1", nome: "Freelas", tipo: "variavel", valor: 700, dia: "5", conta: "corrente" }],
      metas: { piso: 600, meta: 600, turbo: 600 },
      semanais: [{ id: "s1", nome: "Mercado", valor: 90, grupo: "vida" }],
      mensais: [
        { id: "m1", nome: "Aluguel", valor: 900, dia: 10, freq: "mensal", categoria: "moradia", grupo: "contas" },
        { id: "m2", nome: "Plano de saúde", valor: 120, dia: 15, freq: "mensal", categoria: "saude", grupo: "contas" },
      ],
      objetivos: [
        { id: "ob-d1", tipo: "organizar", prioridade: 1, principal: true, status: "ativo" },
        { id: "ob-d2", tipo: "economizar", nome: "Colchão para meses fracos", alvo: 1200, semanal: 30, conta: "poupanca-dani", prioridade: 2, status: "ativo" },
      ],
    }, { bancos: [{ id: "corrente", banco: "Banco Exemplo", tipo: "checking", ...conferido(380) }, { id: "poupanca-dani", banco: "Poupança Exemplo", tipo: "savings" }] }),

    eva: base({
      entradas: [{ id: "en-1", nome: "Salário", tipo: "fixo", valor: 1400, dia: "5", conta: "corrente", divisao: [] }],
      metas: { piso: 1400, meta: 1400, turbo: 1400 },
      semanais: [{ id: "s1", nome: "Mercado", valor: 130, grupo: "vida" }],
      mensais: [{ id: "m1", nome: "Aluguel", valor: 1300, dia: 1, freq: "mensal", categoria: "moradia", grupo: "contas" }],
      objetivos: [
        { id: "ob-e1", tipo: "compra", nome: "Notebook", alvo: 1800, semanal: 100, conta: "poupanca-eva", prioridade: 1, principal: true, status: "ativo" },
        { id: "ob-e2", tipo: "reserva", nome: "Reserva", alvo: 4000, semanal: 80, conta: "reserva-eva", prioridade: 2, status: "ativo" },
      ],
    }, { bancos: [{ id: "corrente", banco: "Banco Exemplo", tipo: "checking", ...conferido(1100) }, { id: "poupanca-eva", banco: "Poupança Exemplo", tipo: "savings", ...conferido(1800) }, { id: "reserva-eva", banco: "Reserva Exemplo", tipo: "savings", ...conferido(900) }] }),

    novo: { renda: {}, pagos: {}, config: {}, updatedAt: Date.now() },
  };
}
