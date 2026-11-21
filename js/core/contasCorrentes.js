// =========================================================
// CONTAS DO BANCO — todas as contas cadastradas (Ajustes → Meus bancos
// ou Minhas contas). Corrente primeiro; a principal é a primeira corrente.
// =========================================================
import { bancosDe, CONTA } from "./gastos.js";

export const contasCorrentes = (state) => {
  const l = bancosDe(state);
  if (!l.length) return [{ id: CONTA, banco: "Minha conta", tipo: "checking" }];
  return [...l.filter((b) => b.tipo !== "savings"), ...l.filter((b) => b.tipo === "savings")];
};
export const contaPrincipal = (state) => contasCorrentes(state)[0].id;
