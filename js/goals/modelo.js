// =========================================================
// MODELO DOS OBJETIVOS — ler, migrar e salvar.
//   state.config.objetivos: [{
//     id, dono, tipo, nome, descricao, prioridade (1 = primeiro), principal,
//     inicio, ate, valorInicial, alvo, conta, semanal,
//     status: "ativo" | "pausado" | "arquivado",
//     etapas: [{ id, nome, feito }]  (personalizado sem valor)
//     historico: { [semana ISO]: { p, prev } }
//   }]
// Migração: carteiras antigas (config.objetivo + colchaoSemanal + dívidas)
// viram objetivos na primeira leitura. Os campos antigos ficam guardados
// (caminho de volta) e o colchaoSemanal segue a soma do "guardar por semana".
// Sem import de plan/jornada aqui: plan.js lê guardarPorSemana daqui.
// =========================================================
import { parte, salvarParte } from "../core/config.js";
import { tipo, ehDinheiro } from "./tipos.js";
import { saldoAtual, base as baseSaldo } from "../core/saldo.js";
import { poupanca } from "../core/destino.js";

const n = (v) => Number(v) || 0;
export const novoIdObjetivo = () => "ob" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// Objetivos a partir dos dados antigos (sem gravar)
export function derivarAntigos(state) {
  const c = state.config || {};
  const lista = [];
  const temDividas = parte(state, "cartoes").length || parte(state, "outras").length
    || parte(state, "pontuais").some((p) => p.atrasado) || parte(state, "parcelas").length;
  const o = c.objetivo && typeof c.objetivo === "object" ? c.objetivo : {};
  const semanal = n(parte(state, "colchaoSemanal"));
  if (temDividas || o.tipo === "dividas") lista.push({ id: "ob-dividas", tipo: "dividas", nome: "", principal: true, migrado: true });
  if ((o.tipo !== "dividas" && (n(o.alvo) > 0 || o.nome)) || semanal > 0) {
    lista.push({ id: "ob-juntar", tipo: o.tipo === "compra" ? "compra" : "reserva", nome: o.tipo === "dividas" ? "" : o.nome || "",
      alvo: o.tipo === "dividas" ? 0 : n(o.alvo), ate: o.ate || "", conta: o.conta || "", semanal, migrado: true });
  }
  return lista.map((g, i) => normalizar({ ...g, prioridade: i + 1, principal: i === 0 }));
}

export function normalizar(g) {
  return { id: g.id || novoIdObjetivo(), dono: g.dono || "", tipo: tipo(g.tipo).id, nome: g.nome || "", descricao: g.descricao || "",
    prioridade: n(g.prioridade) || 99, principal: !!g.principal, inicio: g.inicio || "", ate: g.ate || "",
    valorInicial: g.valorInicial == null ? null : n(g.valorInicial), alvo: n(g.alvo), conta: g.conta || "", semanal: n(g.semanal),
    status: g.status || "ativo", etapas: Array.isArray(g.etapas) ? g.etapas : [], historico: g.historico || {}, ...(g.migrado ? { migrado: true } : {}) };
}

// Todos (inclui pausados e arquivados), por prioridade
export function todosObjetivos(state) {
  const c = state.config || {};
  const lista = Array.isArray(c.objetivos) ? c.objetivos.map(normalizar) : derivarAntigos(state);
  return lista.sort((a, b) => a.prioridade - b.prioridade);
}
// Ativos, com o principal primeiro
export function objetivos(state) {
  const ativos = todosObjetivos(state).filter((g) => g.status === "ativo");
  const p = ativos.find((g) => g.principal);
  return p ? [p, ...ativos.filter((g) => g !== p)] : ativos;
}
export const principal = (state) => objetivos(state)[0] || null;

// Grava a lista: renumera prioridades, garante um principal e mantém
// o colchaoSemanal (usado pelo plano antigo) igual à soma do guardar por semana.
export function salvarObjetivos(state, lista) {
  const ord = lista.map(normalizar).sort((a, b) => a.prioridade - b.prioridade).map((g, i) => ({ ...g, prioridade: i + 1 }));
  const ativos = ord.filter((g) => g.status === "ativo");
  if (ativos.length && !ativos.some((g) => g.principal)) ativos[0].principal = true;
  let achou = false;
  ord.forEach((g) => { if (g.principal) { if (achou || g.status !== "ativo") g.principal = false; else achou = true; } });
  state.config = { ...(state.config || {}), objetivos: ord };
  salvarParte(state, "colchaoSemanal", guardarPorSemana(state).reduce((a, x) => a + x.valor, 0));
}

// Grava os objetivos derivados da carteira antiga (uma vez, sem apagar nada)
export function migrarSePreciso(state) {
  const c = state.config || {};
  if (Array.isArray(c.objetivos)) return false;
  const lista = derivarAntigos(state);
  if (!lista.length) return false;
  state.config = { ...c, objetivos: lista };
  return true;
}

// Itens "Guardar" do plano: um por objetivo em dinheiro ativo com valor por semana,
// em ordem de prioridade. Objetivo já alcançado não guarda mais; perto do fim,
// guarda só o que falta. O saldo de uma conta vale para um objetivo só
// (o de maior prioridade primeiro), como no Goal Engine.
// O primeiro mantém o id antigo "colchao" (pagamentos já marcados continuam valendo).
export function guardarPorSemana(state) {
  const usado = {};
  return objetivos(state).filter((g) => ehDinheiro(g) && g.semanal > 0 && g.tipo !== "patrimonio").map((g) => {
    let valor = g.semanal;
    if (g.alvo > 0) {
      const conta = (state.bancos || []).find((b) => b.id === g.conta) || poupanca(state);
      const tem = baseSaldo(state, conta) ? Math.max(0, n(saldoAtual(state, conta))) : 0;
      const livre = Math.max(0, tem - (usado[conta.id] || 0));
      const meu = Math.min(livre, g.alvo);
      usado[conta.id] = (usado[conta.id] || 0) + meu;
      valor = Math.min(valor, Math.max(0, Math.round((g.alvo - meu) * 100) / 100));
    }
    return { objetivo: g.id, conta: g.conta, nome: g.nome ? `Guardar · ${g.nome}` : `Guardar · ${tipo(g.tipo).label}`, valor };
  }).filter((x) => x.valor > 0.004).map((x, i) => ({ ...x, id: i === 0 ? "colchao" : `colchao-${x.objetivo}` }));
}
