# Savia Wallet

Hub de finanças pessoais guiado por objetivos: o que pagar, o que guardar e quando chego lá.
Documentação do produto em [`docs/`](docs/).
Site estático (HTML + JavaScript com módulos nativos, sem build) — publica direto na Vercel.

## Rodar no computador
```
python3 -m http.server 8765
# abrir http://localhost:8765
```

## Testes
```
node tests/goals.test.mjs
```

## Publicar na Vercel
1. Suba esta pasta para um repositório no GitHub (ex.: `savia-wallet`).
2. Na Vercel: **Add New → Project → Import** o repositório.
3. Framework Preset: **Other**. Build Command e Output Directory: deixar vazios.
4. **Deploy**.

## Estrutura
- `index.html`, `manifest.json`, `icons/` — página e ícone do app
- `styles/` — `tokens.css` (cores, tamanhos), `global.css`, `components.css` (botões, campos, cards — estilo único)
- `js/app.js` — rotas e navegação
- `js/config/` — `marca.js` (nome do app), `seed.js` (carteira nova vazia; nada pessoal no código)
- `js/core/` — regras: `plan.js` (lista de cada pagamento), `calendar.js` (ciclo de pagamento), `debts.js`, `jornada.js`, `gastos.js`, `auth.js` (usuário e senha), `store.js` (dados no navegador), `sync.js` (sincronização)
- `js/pages/` — uma página por arquivo (home, hoje, ajustes, contas, dívidas, dividir, extra, planejar, login, dados)
- `js/goals/` — Goal Engine: objetivos, necessidades (fonte única), avaliação e recomendações
- `js/components/` — peças de tela reutilizadas (`ui.js`, `nav.js`, `weekNav.js`, `objetivos.js`)

## Dados
Supabase com login, dados por usuário protegidos por RLS (ver `docs/ARCHITECTURE.md`). `?mock` usa só o navegador, para testes.
