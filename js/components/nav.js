// =========================================================
// NAVEGAÇÃO — barra inferior: Home | + | Hoje.
// O "+" abre o menu com as outras páginas.
// =========================================================
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const PRINCIPAIS = [
  { id: "home", label: "Home", icon: svg('<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>') },
  { id: "hoje", label: "Hoje", icon: svg('<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>') },
];

export const MENU = [
  { id: "contas", label: "Minhas contas", desc: "Bancos, gastos e números", icon: svg('<path d="M3 10l9-6 9 6"/><path d="M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18"/>') },
  { id: "planejar", label: "Planejar", desc: "Pedidos para datas e ocasiões", icon: svg('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>') },
  { id: "extra", label: "Extra Money", desc: "Calculadoras do dinheiro extra", icon: svg('<path d="M5 16l1.5-5a2 2 0 0 1 2-1.5h7a2 2 0 0 1 2 1.5L19 16"/><rect x="4" y="16" width="16" height="3" rx="1.5"/>') },
  { id: "dividas", label: "Dívidas", desc: "Cartões e outras dívidas", icon: svg('<path d="M4 18V9M10 18V5M16 18v-6M22 18H2"/>') },
  { id: "dividir", label: "Dividir", desc: "Contas divididas e a receber", icon: svg('<circle cx="9" cy="9" r="3"/><circle cx="16" cy="10" r="2.5"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5M14 15c3 0 6 1.5 6 4"/>') },
  { id: "ajustes", label: "Ajustes", desc: "Meus números", icon: svg('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>') },
];

export const PAGINAS = [...PRINCIPAIS, ...MENU].map((p) => p.id);

const PLUS = svg('<path d="M12 5v14M5 12h14"/>');

export function renderNav(nav, page, aberto) {
  if (page.startsWith("extra-")) page = "extra";
  const noMenu = MENU.some((m) => m.id === page);
  const tab = (t) => `<li><a href="#${t.id}" ${t.id === page ? 'aria-current="page"' : ""}>${t.icon}<span>${t.label}</span></a></li>`;
  nav.innerHTML = `
    ${aberto ? `<div class="menu-backdrop" data-close></div>
      <div class="menu-sheet" id="menu-sheet" role="menu">
        ${MENU.map((m) => `<a role="menuitem" href="#${m.id}" class="menu-item ${m.id === page ? "on" : ""}">
          <span class="menu-icon">${m.icon}</span><span><b>${m.label}</b><small>${m.desc}</small></span></a>`).join("")}
      </div>` : ""}
    <ul>
      ${tab(PRINCIPAIS[0])}
      <li><button class="plus ${aberto ? "open" : ""} ${noMenu ? "on" : ""}" id="plus" aria-expanded="${!!aberto}" aria-controls="menu-sheet" aria-label="Mais páginas">${PLUS}</button></li>
      ${tab(PRINCIPAIS[1])}
    </ul>`;
}
