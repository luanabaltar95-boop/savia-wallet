// Testes do Goal Engine (node tests/goals.test.mjs). Sem dependências.
// Roda em Node: simula o mínimo do navegador (localStorage/location).
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.location = { hash: "", search: "" };
const { getSeed } = await import("../js/core/config.js");
const { setCiclo, toISO } = await import("../js/core/calendar.js");
const { avaliar, caminho, registrarHistorico, tendencia, custoMensal } = await import("../js/goals/engine.js");
const { objetivos, salvarObjetivos, derivarAntigos, guardarPorSemana, migrarSePreciso } = await import("../js/goals/modelo.js");
const { recomendacoes } = await import("../js/goals/recomendacoes.js");
const { faltando, necessidadesDe } = await import("../js/goals/necessidades.js");
const { buildWeek } = await import("../js/core/plan.js");

let ok = 0, falhou = 0;
const t = (nome, fn) => { try { fn(); ok++; console.log("✓", nome); } catch (e) { falhou++; console.log("✗", nome, "→", e.message); } };
const eq = (a, b, m = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`); };
const sim = (v, m) => { if (!v) throw new Error(m || "falso"); };
const HOJE = new Date(2026, 10, 27, 12);
const vazio = () => ({ renda: {}, pagos: {}, config: {}, bancos: [] });
setCiclo({ tipo: "semanal", diaSemana: 5 });
const ctx = (st) => ({ seed: getSeed(st), state: st });

t("usuário novo sem dívidas: nenhum objetivo derivado, nada inventado", () => {
  const st = vazio();
  eq(derivarAntigos(st), []);
  eq(avaliar(getSeed(st), st, HOJE), []);
});

t("usuário novo com objetivo de economia: pede valor, banco e pagamento; previsão pelo ritmo", () => {
  const st = vazio();
  salvarObjetivos(st, [{ tipo: "economizar", nome: "Viagem", alvo: 1000, semanal: 100 }]);
  const [a] = avaliar(getSeed(st), st, HOJE);
  eq(a.valor.atual, 0); eq(a.valor.falta, 1000);
  eq(a.valor.fonte, "pendente", "saldo não conferido");
  eq(a.previsao, toISO(new Date(2027, 1, 5, 12)), "10 semanas");
  eq(a.faltando.map((f) => f.id), ["pagamento", "bancos"]);
  eq(guardarPorSemana(st).map((g) => [g.id, g.valor]), [["colchao", 100]]);
  eq(st.config.colchaoSemanal, 100, "colchão segue a soma");
});

t("usuário com cartões e dívidas: etapas vêm dos dados, sem perguntar de novo", () => {
  const st = vazio();
  st.config = { cartoes: [{ id: "c1", nome: "Cartão A", saldo: 2000, limite: 3000, apr: 29.9, dia: 10, minimo: 60 }, { id: "c2", nome: "Cartão B", saldo: 500, limite: 1000, apr: 0, dia: 15, minimo: 25 }],
    alvos: ["c1", "c2"], pontuais: [{ id: "p1", nome: "Luz atrasada", valor: 80, semana: "2026-11-20", atrasado: true }],
    entradas: [{ id: "e", nome: "Salário", tipo: "fixo", valor: 900, dia: "5" }], mensais: [{ id: "m1", nome: "Aluguel", valor: 1200, dia: 1 }] };
  salvarObjetivos(st, [{ tipo: "dividas" }]);
  const s = getSeed(st);
  const [a] = avaliar(s, st, HOJE);
  sim(a.etapas[0].id === "atrasados", "primeira etapa = atrasados");
  sim(a.etapas.some((e) => e.id === "c1") && a.etapas.some((e) => e.id === "c2"), "um passo por cartão");
  eq(a.faltando.map((f) => f.id), ["apr"], "só o juros que falta");
  const r = recomendacoes(s, st, [a], null, HOJE).map((x) => x.id);
  sim(r[0] === "atrasado", "pagar atrasado primeiro");
  sim(r.includes("caro") && r.includes("apr"), "maior custo + juros pendente");
});

t("múltiplos objetivos na mesma conta: o saldo não é contado duas vezes", () => {
  const st = vazio();
  st.bancos = [{ id: "pp", banco: "Poupança", tipo: "savings", saldo: 1500, saldoEm: HOJE.getTime() - 1000 }];
  salvarObjetivos(st, [{ tipo: "reserva", alvo: 1000, conta: "pp", semanal: 50 }, { tipo: "compra", nome: "Notebook", alvo: 2000, conta: "pp", semanal: 50 }]);
  const [r, c] = avaliar(getSeed(st), st, HOJE);
  eq(r.valor.atual, 1000, "reserva fica com 1000");
  eq(c.valor.atual, 500, "compra fica com o resto");
  eq(guardarPorSemana(st).map((g) => g.id), ["colchao", `colchao-${c.id}`]);
  const w = buildWeek(getSeed(st), st, new Date(2026, 11, 4, 12));
  eq(w.items.filter((i) => i.grupo === "colchao").map((i) => [i.valor, i.conta]), [[50, "pp"], [50, "pp"]], "dois Guardar no plano");
  const cam = caminho([r, c]);
  sim(cam.etapas.length === r.etapas.length + c.etapas.length, "caminho = soma das etapas");
});

t("reserva sem valor: alvo estimado em 3 meses de contas", () => {
  const st = vazio();
  st.config = { mensais: [{ id: "m", nome: "Aluguel", valor: 1000, dia: 1 }], semanais: [{ id: "s", nome: "Mercado", valor: 120 }] };
  salvarObjetivos(st, [{ tipo: "reserva" }]);
  const s = getSeed(st);
  const [a] = avaliar(s, st, HOJE);
  eq(custoMensal(s), 1520);
  eq(a.valor.alvo, 4560); eq(a.valor.fonteAlvo, "estimativa");
  eq(a.etapas.map((e) => e.id), ["m1", "m3"]);
});

t("usuário que já tem dados (migração): objetivo antigo + dívidas viram 2 objetivos sem perder campos", () => {
  const st = vazio();
  st.config = { objetivo: { tipo: "reserva", nome: "Reserva", alvo: 5000, conta: "pp" }, colchaoSemanal: 50, cartoes: [{ id: "c", nome: "C", saldo: 100, apr: 20, minimo: 10, dia: 1 }] };
  const l = derivarAntigos(st);
  eq(l.map((g) => [g.tipo, g.principal, g.prioridade]), [["dividas", true, 1], ["reserva", false, 2]]);
  eq([l[1].alvo, l[1].semanal, l[1].conta], [5000, 50, "pp"]);
  sim(migrarSePreciso(st), "migrou");
  sim(st.config.objetivo.alvo === 5000 && st.config.colchaoSemanal === 50, "campos antigos guardados");
  sim(!migrarSePreciso(st), "só uma vez");
});

t("trocar o principal muda a ordem", () => {
  const st = vazio();
  salvarObjetivos(st, [{ id: "a", tipo: "organizar", principal: true }, { id: "b", tipo: "economizar", alvo: 100 }]);
  salvarObjetivos(st, objetivos(st).map((g) => ({ ...g, principal: g.id === "b" })));
  eq(objetivos(st).map((g) => g.id), ["b", "a"]);
  eq(st.config.objetivos.filter((g) => g.principal).length, 1, "um principal só");
});

t("atualizar uma obrigação muda o objetivo na hora (fonte única)", () => {
  const st = vazio();
  st.config = { cartoes: [{ id: "c", nome: "C", saldo: 1000, apr: 20, minimo: 30, dia: 1 }], alvos: ["c"] };
  salvarObjetivos(st, [{ tipo: "dividas" }]);
  const antes = avaliar(getSeed(st), st, HOJE)[0].valor.falta;
  st.config.cartoes = [{ ...st.config.cartoes[0], saldo: 400 }];
  const depois = avaliar(getSeed(st), st, HOJE)[0].valor.falta;
  eq([antes, depois], [1000, 400]);
});

t("moedas: checklist acompanha moeda principal, contas e cotação", () => {
  const st = vazio();
  st.config = { moeda: "USD", mensais: [{ id: "m", nome: "Aluguel mãe", valor: 250, valorMoeda: 1250, moeda: "BRL", dia: 11 }] };
  salvarObjetivos(st, [{ tipo: "moedas" }]);
  let [a] = avaliar(getSeed(st), st, HOJE);
  eq(a.etapas.map((e) => e.ok), [true, true, false], "falta cotação");
  st.cotacoes = { BRL: { taxa: 5, em: HOJE.getTime() } };
  [a] = avaliar(getSeed(st), st, HOJE);
  eq(a.etapas.map((e) => e.ok), [true, true, true]);
  eq(a.continuo, true);
});

t("necessidades em comum são pedidas uma vez", () => {
  eq(necessidadesDe(["dividas", "economizar", "reserva"]), ["pagamento", "contas", "dividas", "bancos", "valor"]);
});

t("histórico semanal e tendência da previsão", () => {
  const st = vazio();
  salvarObjetivos(st, [{ id: "x", tipo: "economizar", alvo: 1000, semanal: 100 }]);
  let av = avaliar(getSeed(st), st, HOJE);
  sim(registrarHistorico(st, av, "2026-11-20"), "registra");
  sim(!registrarHistorico(st, av, "2026-11-20"), "não duplica");
  salvarObjetivos(st, objetivos(st).map((g) => ({ ...g, semanal: 200 })));
  av = avaliar(getSeed(st), st, HOJE);
  const td = tendencia(av[0], "2026-11-27");
  sim(td && td.melhorou && td.semanas === 5, `adiantou 5 semanas (${JSON.stringify(td)})`);
});

t("personalizado por etapas: progresso pelas etapas marcadas", () => {
  const st = vazio();
  salvarObjetivos(st, [{ tipo: "personalizado", nome: "Mudar de casa", etapas: [{ id: "1", nome: "Pesquisar", feito: true }, { id: "2", nome: "Mudar", feito: false }] }]);
  const [a] = avaliar(getSeed(st), st, HOJE);
  eq(a.progresso, 0.5); eq(a.atual.titulo, "Mudar"); eq(a.faltando, []);
});

console.log(`\n${ok} ok, ${falhou} falharam`);
process.exit(falhou ? 1 : 0);
