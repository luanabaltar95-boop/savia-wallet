// =========================================================
// IMPORTAR EXTRATO — lê CSV ou OFX de qualquer banco e sugere o que
// cada linha é: uma entrada cadastrada, uma conta da semana paga,
// um gasto, outra entrada ou nada (ignorar). Eu confiro e aplico.
//   state.importados: { [hash]: true }  para não importar duas vezes
// =========================================================
import { toISO, fromISO, proximoPagamento, pagamentoAte } from "./calendar.js";
import { entradasDaSemana, usaEntradas } from "./entradas.js";
import { parte } from "./config.js";

const r2 = (v) => Math.round(v * 100) / 100;

// ---------- Números e datas ----------
export function numero(txt) {
  let s = String(txt ?? "").trim();
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s) || /\bD$/i.test(s);
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;
  const ultPonto = s.lastIndexOf("."), ultVirg = s.lastIndexOf(",");
  if (ultPonto >= 0 && ultVirg >= 0) s = ultVirg > ultPonto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (ultVirg >= 0) s = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  const v = Number(s);
  return Number.isFinite(v) ? (neg ? -v : v) : null;
}

export function data(txt, preferMesDia = true) {
  const s = String(txt ?? "").trim();
  let m;
  if ((m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) {
    let [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (y < 100) y += 2000;
    let dia, mes;
    if (a > 12) [dia, mes] = [a, b];
    else if (b > 12) [mes, dia] = [a, b];
    else if (m[0].includes("-")) [dia, mes] = [a, b]; // 20-11-2026 (Wise)
    else [mes, dia] = preferMesDia ? [a, b] : [b, a];
    return `${y}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }
  return null;
}

// ---------- CSV ----------
function linhasCSV(texto, sep) {
  const out = [];
  let linha = [], campo = "", aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      if (linha.some((x) => x.trim())) out.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim())) out.push(linha);
  return out;
}

const COLS = {
  data: [/^(posting |transaction |trans\.? )?date$/i, /^data( do lançamento| lançamento)?$/i, /fecha/i, /date/i, /data/i],
  desc: [/^description$/i, /^descri[çc][ãa]o$/i, /^(memo|payee|name|merchant)$/i, /hist[óo]rico/i, /concepto/i, /descr/i, /detail/i, /lan[çc]amento/i],
  valor: [/^amount$/i, /^valor$/i, /^(importe|monto|value)$/i, /amount/i, /valor/i],
  debito: [/^debit$/i, /d[ée]bito/i, /withdraw/i, /sa[íi]da/i],
  credito: [/^credit$/i, /cr[ée]dito/i, /deposit/i, /entrada/i],
};
function achar(cab, regs, usados) {
  for (const re of regs) { const i = cab.findIndex((h, k) => !usados.includes(k) && re.test(h.trim())); if (i >= 0) return i; }
  return -1;
}

export function lerCSV(texto, preferMesDia = true) {
  const amostra = texto.split(/\r?\n/).slice(0, 5).join("\n");
  const sep = [",", ";", "\t"].sort((a, b) => amostra.split(b).length - amostra.split(a).length)[0];
  const linhas = linhasCSV(texto, sep);
  // Cabeçalho: a primeira linha que tem uma coluna de data e uma de valor
  let ini = linhas.findIndex((l) => achar(l, COLS.data, []) >= 0 && (achar(l, COLS.valor, []) >= 0 || achar(l, COLS.debito, []) >= 0));
  if (ini < 0) throw new Error("Não achei as colunas de data e valor neste arquivo.");
  const cab = linhas[ini];
  const u = [];
  const iData = achar(cab, COLS.data, u); u.push(iData);
  const iDeb = achar(cab, COLS.debito, u); if (iDeb >= 0) u.push(iDeb);
  const iCred = achar(cab, COLS.credito, u); if (iCred >= 0) u.push(iCred);
  const iValor = achar(cab, COLS.valor, u); if (iValor >= 0) u.push(iValor);
  const iDesc = achar(cab, COLS.desc, u);
  const out = [];
  linhas.slice(ini + 1).forEach((l) => {
    const d = data(l[iData], preferMesDia);
    if (!d) return;
    let v = null;
    if (iDeb >= 0 || iCred >= 0) {
      const deb = iDeb >= 0 ? numero(l[iDeb]) : null, cred = iCred >= 0 ? numero(l[iCred]) : null;
      if (deb) v = -Math.abs(deb); else if (cred) v = Math.abs(cred);
    }
    if (v == null && iValor >= 0) v = numero(l[iValor]);
    if (v == null || v === 0) return;
    out.push({ data: d, desc: (l[iDesc] || "").trim().replace(/\s+/g, " "), valor: r2(v) });
  });
  return { transacoes: out, saldoFinal: null };
}

// ---------- OFX / QFX ----------
export function lerOFX(texto) {
  const tag = (bloco, t) => { const m = bloco.match(new RegExp(`<${t}>([^<\\r\\n]*)`, "i")); return m ? m[1].trim() : ""; };
  const out = [];
  (texto.match(/<STMTTRN>[\s\S]*?(<\/STMTTRN>|(?=<STMTTRN>)|(?=<\/BANKTRANLIST>))/gi) || []).forEach((b) => {
    const d = data(tag(b, "DTPOSTED").slice(0, 8));
    const v = numero(tag(b, "TRNAMT"));
    if (!d || !v) return;
    out.push({ data: d, desc: (tag(b, "NAME") || tag(b, "MEMO")).replace(/\s+/g, " "), valor: r2(v), fitid: tag(b, "FITID") });
  });
  const bal = texto.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([^<\r\n]*)/i);
  return { transacoes: out, saldoFinal: bal ? numero(bal[1]) : null };
}

export function lerArquivo(nome, texto, preferMesDia = true) {
  if (/\.(ofx|qfx)$/i.test(nome) || /<OFX>/i.test(texto)) return lerOFX(texto);
  return lerCSV(texto, preferMesDia);
}

// ---------- Sugestões ----------
export const hashDe = (conta, t) => t.fitid ? `${conta}|${t.fitid}` : `${conta}|${t.data}|${t.valor}|${t.desc.toLowerCase().slice(0, 40)}`;
const palavras = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
const parecido = (a, b) => { const pa = palavras(a), pb = new Set(palavras(b)); return pa.some((w) => pb.has(w) || [...pb].some((x) => x.startsWith(w) || w.startsWith(x))); };

// Semanas em que uma linha pode cair: entrada → o pagamento em que cai (dia ou depois);
// saída → a lista do pagamento anterior (que cobre esses dias) e, se pagou adiantado, a seguinte
export const semanaDaEntrada = (dataISO) => toISO(proximoPagamento(fromISO(dataISO)));
export const semanasDaSaida = (dataISO) => [...new Set([toISO(pagamentoAte(fromISO(dataISO))), toISO(proximoPagamento(fromISO(dataISO)))])];
const SALARIO = /payroll|salary|sal[aá]rio|direct dep|dir dep|pagamento de sal|folha/i;
// Quanto da entrada cai nesta conta
export const parteNaConta = (e, conta) => (e.partes.find((p) => p.conta === conta) || { valor: e.valor }).valor;

// itensDaSemana(iso) → itens da lista daquela semana ainda não pagos
export function sugerir(state, transacoes, conta, itensDaSemana) {
  const seed = { fontes: parte(state, "fontes") };
  const usados = new Set();
  return transacoes.map((t) => {
    const iso = t.valor > 0 ? semanaDaEntrada(t.data) : semanasDaSaida(t.data)[0];
    const hash = hashDe(conta, t);
    const base = { ...t, iso, hash, jaImportado: !!(state.importados || {})[hash] };
    if (base.jaImportado) return { ...base, acao: "ignorar" };
    if (t.valor > 0) {
      const ents = usaEntradas(state, iso) ? entradasDaSemana(seed, state, iso) : [];
      const livre = ents.filter((x) => !usados.has(`e:${iso}:${x.id}`));
      const e = livre.find((x) => parecido(x.nome, t.desc) || (x.tipo === "fixo" && SALARIO.test(t.desc)))
        || livre.find((x) => Math.abs(parteNaConta(x, conta) - t.valor) <= Math.max(5, parteNaConta(x, conta) * 0.15))
        || livre.find((x) => x.data === t.data);
      if (e) { usados.add(`e:${iso}:${e.id}`); return { ...base, acao: `entrada:${e.id}` }; }
      return { ...base, acao: "outra" };
    }
    const v = -t.valor;
    for (const w of semanasDaSaida(t.data)) {
      const itens = itensDaSemana(w).filter((i) => !usados.has(`p:${w}:${i.id}`));
      const it = itens.find((i) => parecido(i.nome, t.desc)) || itens.find((i) => Math.abs(i.valor - v) <= Math.max(0.5, i.valor * 0.01));
      if (it) { usados.add(`p:${w}:${it.id}`); return { ...base, iso: w, acao: `pago:${it.id}` }; }
    }
    if (/transfer|wise|zelle|venmo|pix|ted\b|doc\b/i.test(t.desc)) return { ...base, acao: "ignorar" };
    return { ...base, acao: "gasto" };
  });
}

// ---------- Aplicar ----------
const tsDe = (iso) => fromISO(iso).getTime() + 12 * 3600 * 1000;
// entradaPorId(iso, id) → entrada da semana (com partes), para somar as outras contas
export function aplicar(state, linhas, conta, itemPorId, entradaPorId = () => null) {
  let n = 0;
  linhas.forEach((l) => {
    if (l.acao === "ignorar" || l.jaImportado) return;
    const ts = tsDe(l.data);
    const [tipo, id] = l.acao.split(":");
    if (tipo === "entrada") {
      const r = state.renda[l.iso] || {};
      const e = entradaPorId(l.iso, id);
      // O extrato mostra só o que caiu nesta conta; o total soma as outras partes
      const total = e ? Math.round((l.valor + e.valor - parteNaConta(e, conta)) * 100) / 100 : l.valor;
      const reg = { confirmado: true, ts };
      if (!e || Math.abs(total - e.valor) > 0.009) reg.valor = total;
      state.renda[l.iso] = { ...r, entradas: { ...(r.entradas || {}), [id]: { ...((r.entradas || {})[id] || {}), ...reg } } };
    } else if (tipo === "outra") {
      const r = state.renda[l.iso] || {};
      state.renda[l.iso] = { ...r, extras: String(Math.round(((Number(r.extras) || 0) + l.valor) * 100) / 100) };
    } else if (tipo === "pago") {
      const it = itemPorId(l.iso, id) || { nome: l.desc, valor: -l.valor };
      state.pagos[l.iso] = { ...(state.pagos[l.iso] || {}), [id]: { valor: -l.valor, juros: 0, data: l.data, quitado: -l.valor >= it.valor - 0.01, banco: conta, ts, nome: it.nome } };
    } else if (tipo === "gasto") {
      state.gastos = [...(state.gastos || []), { id: "g" + ts.toString(36) + n, data: l.data, valor: -l.valor, desc: l.desc || "Gasto", cat: "outros", conta, ts }];
    }
    state.importados = { ...(state.importados || {}), [l.hash]: true };
    n++;
  });
  return n;
}
