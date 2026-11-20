// =========================================================
// FORMATAÇÃO — dinheiro e datas em português, moeda em USD.
// =========================================================
export function money(n, cents = false) {
  const v = Math.round((n || 0) * 100) / 100;
  const s = Math.abs(v).toLocaleString("pt-BR", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  return (v < 0 ? "−$" : "$") + s;
}

export function dayLabel(d) {
  const wd = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  const dm = d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
  return `${wd}, ${dm}`;
}

export function monthYear(d) {
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "").replace(" de ", "/");
}

export function fullDate(d) {
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" }).replace(/\./g, "");
}

export function shortDate(d) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
