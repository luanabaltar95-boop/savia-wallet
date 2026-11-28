// =========================================================
// TRAJETÓRIA — componente visual reutilizável, sem regra financeira.
// Recebe só: progresso (0–1, real, vindo do Goal Engine) e a lista de
// etapas { ok, quando, frac? }. Serve para qualquer objetivo.
//   céu nublado → sol, conforme o progresso
//   marcas na trilha: alcançada (bandeira), atual (anel verde),
//   futura com previsão (ponto), sem previsão (círculo tracejado)
//   o mascote fica entre a última etapa alcançada e a atual,
//   avançando pela fração real da etapa atual (frac), quando existe.
// =========================================================

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const A = hex(a), B = hex(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
};
const clamp = (v) => Math.max(0, Math.min(1, v));

const cloud = (x, y, s, fill, op) => `<g transform="translate(${x} ${y}) scale(${s})" opacity="${op}" fill="${fill}">
  <ellipse cx="0" cy="8" rx="34" ry="12"/><ellipse cx="-14" cy="0" rx="16" ry="13"/><ellipse cx="10" cy="-4" rx="20" ry="16"/></g>`;

const tree = (x, y, s, leaf) => `<g transform="translate(${x} ${y}) scale(${s})">
  <rect x="-2.5" y="-4" width="5" height="16" rx="2" fill="#8a6a4f"/>
  <circle cx="0" cy="-12" r="13" fill="${leaf}"/><circle cx="-8" cy="-6" r="8" fill="${leaf}"/><circle cx="8" cy="-6" r="8" fill="${leaf}"/></g>`;

export function scene(p) {
  p = clamp(p);
  const sky1 = mix("#8f99a6", "#f4c98f", p), sky2 = mix("#c7ccd2", "#fcefdc", p);
  const hillBack = mix("#a3aaa1", "#a9d6a8", p), hillFront = mix("#8e978b", "#6aa97b", p);
  const leaf = mix("#7e8a7b", "#4f9a62", p);
  const cloudFill = mix("#7d858f", "#ffffff", p);
  const lit = p > 0.35 ? mix("#f2d27a", "#ffd76a", p) : "#4b4f57";
  const rain = clamp((0.25 - p) * 4);
  const sunY = 200 - 150 * p;

  const drops = rain > 0
    ? Array.from({ length: 26 }, (_, i) => {
        const x = (i * 37) % 400, y = 20 + ((i * 53) % 150);
        return `<line x1="${x}" y1="${y}" x2="${x - 4}" y2="${y + 10}"/>`;
      }).join("")
    : "";

  return `<svg class="scene" viewBox="0 0 400 240" role="img" aria-label="Cenário da minha jornada: ${Math.round(p * 100)}% do caminho">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="#ffd98a" stop-opacity=".7"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="400" height="240" fill="url(#sky)"/>
    <circle cx="318" cy="${sunY}" r="${50 * p + 10}" fill="url(#glow)" opacity="${p}"/>
    <circle cx="318" cy="${sunY}" r="20" fill="#f7c35a" opacity="${0.25 + 0.75 * p}"/>
    ${cloud(70, 48, 1.1, cloudFill, 0.95 - 0.45 * p)}
    ${cloud(190, 30, 0.9, cloudFill, 0.9 - 0.5 * p)}
    ${cloud(300, 62, 1, cloudFill, 0.85 - 0.6 * p)}
    <g stroke="#7b8b9c" stroke-width="1.5" stroke-linecap="round" opacity="${rain}">${drops}</g>
    <path d="M0 150 C 70 110 140 120 200 140 S 330 110 400 125 V240 H0Z" fill="${hillBack}"/>
    <path d="M0 185 C 80 160 160 175 240 168 S 350 150 400 160 V240 H0Z" fill="${hillFront}"/>
    ${tree(48, 168, 0.55 + 0.45 * p, leaf)}${tree(205, 160, 0.45 + 0.55 * p, leaf)}${tree(388, 150, 0.5 + 0.5 * p, leaf)}
    <g transform="translate(330 104)">
      <rect x="0" y="18" width="46" height="34" rx="3" fill="${mix("#b9b2a6", "#fff6ea", p)}"/>
      <path d="M-6 20 L23 -4 L52 20Z" fill="${mix("#7c6f66", "#c9644b", p)}"/>
      <rect x="8" y="27" width="10" height="10" rx="2" fill="${lit}"/><rect x="28" y="27" width="10" height="10" rx="2" fill="${lit}"/>
      <rect x="19" y="38" width="9" height="14" rx="2" fill="${mix("#5d5650", "#7a4c2f", p)}"/>
    </g>
    <path id="trail" d="M14 228 C 80 214 70 188 132 184 S 222 196 250 170 S 300 150 352 156" fill="none" stroke="${mix("#cfc6b6", "#f3e3c3", p)}" stroke-width="9" stroke-linecap="round"/>
    <g id="marks"></g>
    <g id="dog"><g class="dog">
      <ellipse cx="0" cy="0" rx="9" ry="5.5" fill="#9a6440"/>
      <circle cx="9" cy="-5" r="5" fill="#9a6440"/><ellipse cx="11" cy="-9" rx="2" ry="3.5" fill="#6d4329"/>
      <circle cx="11" cy="-6" r="1" fill="#2a2620"/>
      <path d="M-9 -1 q-6 -6 -3 -10" stroke="#9a6440" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <rect x="-7" y="3" width="2.5" height="6" rx="1" fill="#6d4329"/><rect x="4" y="3" width="2.5" height="6" rx="1" fill="#6d4329"/>
    </g></g>
  </svg>`;
}

// Depois de inserido no DOM: coloca bandeiras/flores nas fases e o cachorro na fase atual
export function montarCena(root, fases) {
  const svg = root.querySelector("svg.scene");
  const trail = svg && svg.querySelector("#trail");
  if (!trail || !trail.getTotalLength) return;
  const L = trail.getTotalLength();
  const n = fases.length;
  const at = (t) => trail.getPointAtLength(L * t);
  const pos = (i) => (i + 1) / (n + 1);

  const iAtual = fases.findIndex((f) => !f.ok);
  svg.querySelector("#marks").innerHTML = fases.map((f, i) => {
    const pt = at(pos(i));
    if (f.ok) {
      return `<g transform="translate(${pt.x} ${pt.y})">
        <line x1="0" y1="0" x2="0" y2="-16" stroke="#5b4a3a" stroke-width="1.5"/>
        <path d="M0 -16 L11 -12 L0 -8Z" fill="#3c8a66"/>
        <circle cx="-6" cy="2" r="2.5" fill="#f2a7b8"/><circle cx="6" cy="3" r="2.5" fill="#f7d26a"/></g>`;
    }
    if (i === iAtual) return `<g transform="translate(${pt.x} ${pt.y})"><circle r="5.5" fill="#ffffff" stroke="#388565" stroke-width="2.5"/></g>`;
    if (!f.quando) return `<g transform="translate(${pt.x} ${pt.y})"><circle r="3.5" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="2 2" opacity=".9"/></g>`;
    return `<g transform="translate(${pt.x} ${pt.y})"><circle r="3" fill="#ffffff" opacity=".85"/></g>`;
  }).join("");

  // Mascote: entre a última etapa alcançada e a atual, pela fração real da atual
  const feitas = fases.filter((f) => f.ok).length;
  let t;
  if (!n || feitas >= n) t = n ? 0.985 : 0.02;
  else {
    const de = feitas === 0 ? 0.02 : pos(feitas - 1);
    const ate = pos(feitas);
    const frac = Math.max(0, Math.min(1, Number((fases[iAtual] || {}).frac) || 0));
    t = de + (ate - de) * frac * 0.9;
  }
  const d = at(Math.max(0.02, t));
  svg.querySelector("#dog").setAttribute("transform", `translate(${d.x} ${d.y - 9})`);
}
