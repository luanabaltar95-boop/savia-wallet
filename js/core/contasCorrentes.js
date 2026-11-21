// =========================================================
// CONTAS CORRENTES — contas do banco que recebem e pagam (sem poupança).
// =========================================================
import { bancosDe, CONTA } from "./gastos.js";

export const contasCorrentes = (state) => {
  const l = bancosDe(state).filter((b) => b.tipo !== "savings");
  return l.length ? l : [{ id: CONTA, banco: "Minha conta", tipo: "checking" }];
};
export const contaPrincipal = (state) => contasCorrentes(state)[0].id;
