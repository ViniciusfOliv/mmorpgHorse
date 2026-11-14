# Acabamento da interface (Visuais 2, parte 3a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dar às peças da interface (painel, placa, botão, abas, barras, selos, saldo, ⓘ) o acabamento pixel art dos
sprites, com linhas por sombra do CSS e peças pequenas de pixel por cima, e pôr as duas fontes dentro do jogo.

**Architecture:**
- **Peças e fontes:** as peças de pixel são mapas de texto num módulo de ferramenta (`prototype/tools/interface-arte.mjs`).
  O build as valida, gera um PNG por peça (`tools/png.mjs`) e põe o resultado num bloco `:root` de propriedades
  `--arte-<nome>`, antes do `game.css`, junto com os `@font-face` das fontes embutidas.
- **Componentes:** só o `game.css` muda (mais dois ajustes de markup no `game.js`, o ⓘ e o título). As classes continuam
  as de hoje.
- **Folha:** uma folha (`dist/interface.html`) mostra todos os componentes com o mesmo CSS.

**Tech Stack:** HTML/CSS/JS ES5 puro em `prototype/src/` e ferramentas Node ESM em `prototype/tools/`, sem
dependências. Testes: `moldes-test.mjs` (arte) e `ui-test.mjs` (Playwright já instalado).

**Spec:** `docs/superpowers/specs/2026-11-14-interface-acabamento-design.md` (aprovada por delegação do Vinicius).

## Global Constraints

- Português em código novo, comentários, mensagens e commits. Commits no imperativo, terminando com:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` e
  `Claude-Session: https://claude.ai/code/session_01MGExzKELAJ58uyj4wakVgJ`.
- `prototype/src/*.js` em ES5 (sem `let`/`const`/arrow); ferramentas em `prototype/tools/` são ESM do Node.
- Nenhuma dependência nova (npm etc.). `prototype/dist/` só pelo `node prototype/build.mjs`, sempre regenerado e
  commitado junto.
- Nenhuma regra, número, texto do jogo (exceto o ⓘ, que deixa de ser caractere) ou resultado de corrida muda;
  `balance.js` igual.
- Grade: 1 pixel de arte = 2 px de CSS; contornos, frisos, biséis, sombras e tamanhos das peças em múltiplos de 2 px.
- **Nenhum componente usa `border-image`.** Linhas por `box-shadow` (ou `outline` no foco).
- Sem degradê suave. Cores só dos tokens do `:root` do `game.css`; tokens novos permitidos, exatamente estes: `--linha-luz: #4a6e5c`,
  `--ouro-medio: #c99a1c`, `--prego: #9aa3a0`, `--prego-luz: #e6ece9`.
- Press Start 2P só em 8, 16 ou 24 px. O bloco `texto` do `ui-test` exige mínimo de 11 px nos seletores dele: as 10
  regras de hoje em 11–12 px vão para 16 px (se cabe a 360 px) ou para a Jersey 10 no tamanho do texto em volta — nunca
  para 8 px.
- Contraste de texto ≥ 4,5:1 (≥ 3:1 para ≥ 24 px, ou ≥ 18,66 px em negrito).
- A 360 px: nenhuma rolagem lateral; alvos de toque ≥ 44×44 px; áreas seguras respeitadas; nenhuma animação nova.
- O build de produção (`jogo.html`) continua sem `__galope`, `Dev.`, `galope-elemental:dev` e seletores `.dev-`.
- Peças de pixel desenhadas sempre com `image-rendering: pixelated` e em tamanho de exibição múltiplo de 2 px.

## Review Focus

1. **Página que bloqueia fonte em `data:`** (CSP do artefato ou de um WebView) → o jogo cai na reserva do
   `fonts.gstatic.com`, não na fonte do sistema. Teste: o `src` de cada `@font-face` tem `data:` primeiro e o
   `gstatic` depois (Tarefa 1, `moldes-test`).
2. **Título de tela comprido a 360 px** ("Estábulo 10/10 vagas", Haras, Perfil com nome longo) → a placa quebra a
   linha, sem rolagem lateral. Teste: `checkOverflow` em todas as abas e telas do bloco `acabamento`, com um save de
   10 vagas e nome de 24 caracteres (Tarefa 3).
3. **Desktop ≥ 900 px** (a barra de abas vira coluna à esquerda) → a moldura da barra vale na vertical, sem rolagem.
   Teste: bloco `acabamento` a 1280×800, `checkOverflow` e a aba atual com a marca de ouro (Tarefa 4).
4. **Gaveta DEV aberta a 360 px** → legível e sem rolagem lateral com os botões novos. Teste: bloco `acabamento`
   abre a gaveta com `?dev=1` e chama `checkOverflow` (Tarefa 4).
5. **Densidade fracionada (2,625)** → peças sem emendas. Captura da folha em 2,625 em `$SHOTS_DIR` (não em
   `prototype/screens/`) para o controlador olhar (Tarefa 2).

---

### Task 1: Fontes embutidas e peças de pixel no build

**Files:**
- Create: `prototype/tools/interface-arte.mjs`
- Create: `prototype/assets/fontes/press-start-2p-latin.woff2`, `prototype/assets/fontes/jersey-10-latin.woff2`,
  `prototype/assets/fontes/OFL-press-start-2p.txt`, `prototype/assets/fontes/OFL-jersey-10.txt`
- Modify: `prototype/build.mjs` (montagem do CSS), `prototype/src/game.css` (linha 1: sai o `@import`; `:root`: os 4
  tokens novos)
- Test: `prototype/tools/moldes-test.mjs` (seção nova "Interface: peças e fontes"), `prototype/tools/ui-test.mjs`
  (bloco novo `acabamento`, função `newPage`)

**Interfaces:**
- Produces (em `interface-arte.mjs`):
  - `PECAS: Array<{ nome: string, mapa: string[], legenda: Record<string, string> }>` — legenda: caractere → nome do
    token (`'--sombra'`); `'.'` é sempre transparente e não entra na legenda.
  - `lerTokens(css: string): Record<string, string>` — os tokens `--nome: #hex;` do primeiro bloco `:root { … }`,
    valor em `#rrggbb` minúsculo (aceita `#rgb`); tokens que não são hex ficam de fora.
  - `validarPeca(peca, tokens): void` — lança `Error` com o nome da peça e, quando houver, o número da linha (base 1)
    em: linha de largura diferente, caractere fora da legenda, token ausente em `tokens`, largura ou altura fora de 1–64.
  - `validarCatalogo(pecas, tokens): void` — valida cada peça e lança `Error` em nome repetido.
  - `pecaRgba(peca, tokens): { width, height, rgba: Uint8Array }`.
  - `cssArte(css: string): string` — valida o catálogo contra `lerTokens(css)` e devolve
    `:root {\n  --arte-<nome>: url(data:image/png;base64,…);\n…}` na ordem de `PECAS` (determinístico).
  - `cssFontes(root: string): Promise<string>` — dois `@font-face` (`font-display: swap`, `font-weight: 400`,
    `font-style: normal`): `'Press Start 2P'` e `'Jersey 10'`, cada `src` com
    `url(data:font/woff2;base64,…) format('woff2')` e, depois, a URL do `gstatic` da mesma família.
- Produces (no CSS do jogo): `--arte-rebite`, `--arte-prego`, `--arte-veio`, `--arte-ajuda`, `--arte-ajuda-ativa`.
- Produces (no `ui-test.mjs`): `newPage(…, { bloquear: string[] })` (padrões de URL abortados com `ctx.route` antes do
  `goto`); a constante `ALTURA_ANTES_3A = { estabulo: <px>, status: <px> }` e o save `SAVE_3A` (v6, 3 montarias).

- [ ] **Step 1: Baixar as fontes e as licenças**

```bash
mkdir -p prototype/assets/fontes
curl -sS -o prototype/assets/fontes/press-start-2p-latin.woff2 https://fonts.gstatic.com/s/pressstart2p/v16/e3t4euO8T-267oIAQAu6jDQyK3nVivM.woff2
curl -sS -o prototype/assets/fontes/jersey-10-latin.woff2 https://fonts.gstatic.com/s/jersey10/v4/GftH7vZKsggXMf9n_J5n_5jh.woff2
curl -sS -o prototype/assets/fontes/OFL-press-start-2p.txt https://raw.githubusercontent.com/google/fonts/main/ofl/pressstart2p/OFL.txt
curl -sS -o prototype/assets/fontes/OFL-jersey-10.txt https://raw.githubusercontent.com/google/fonts/main/ofl/jersey10/OFL.txt
```
Esperado: woff2 de ~12,5 KB e ~13,3 KB começando por `wOF2`; os dois OFL com "SIL OPEN FONT LICENSE".
As URLs do `gstatic` acima são as mesmas da reserva no `src` do `@font-face`.

- [ ] **Step 2: Escrever os testes da seção "Interface: peças e fontes" no `moldes-test.mjs`** (com o `test()` do arquivo)
  - cada peça de `PECAS` passa em `validarCatalogo(PECAS, lerTokens(<game.css lido do disco>))`;
  - ida e volta: `decodePng(encodePng(pecaRgba(p, t)))` tem, em cada pixel, a cor do token da legenda (alfa 255) ou
    alfa 0 no `'.'`;
  - `validarPeca` lança, com a mensagem pedida, para: `mapa: ['ab', 'a']` ("linha 2"), caractere fora da legenda,
    token `'--nao-existe'`, largura 65; `validarCatalogo` lança em nome repetido;
  - `cssArte(css)` contém `--arte-<nome>: url(data:image/png;base64,` para cada peça, e duas chamadas dão o mesmo texto;
  - `cssFontes(ROOT)` tem exatamente dois `@font-face`, as famílias `'Press Start 2P'` e `'Jersey 10'`, e em cada `src`
    o `data:font/woff2;base64,` vem antes de `https://fonts.gstatic.com/` (Review Focus 1);
  - o `game.css` não tem `@import` nem `fonts.googleapis`.

- [ ] **Step 3: Rodar e ver falhar** — `node prototype/tools/moldes-test.mjs` → falha por módulo ausente.

- [ ] **Step 4: Implementar `interface-arte.mjs`** com as assinaturas acima e este catálogo inicial (mapas do teste
  descartável da spec §2; o desenho pode ser refinado, mas tamanhos e nomes ficam):
  - `rebite` 3×3: `['.k.', 'kYg', '.g.']`, legenda `k: '--sombra', Y: '--ouro-claro', g: '--ouro-escuro'`;
  - `prego` 3×3: `['.k.', 'kSs', '.s.']`, legenda `k: '--sombra', S: '--prego-luz', s: '--prego'`;
  - `veio` 32×8: madeira `w: '--madeira'` com riscos `v: '--madeira-2'` espalhados nas linhas 1, 3, 4 e 6 e a linha 7
    inteira em `v` (a junta da tábua);
  - `ajuda` 7×7: `['.kkkkk.', 'kTTkTTk', 'kTTTTTk', 'kTTkTTk', 'kTTkTTk', 'kTTkTTk', '.kkkkk.']`, legenda
    `k: '--sombra', T: '--texto-2'`; `ajuda-ativa`: o mesmo mapa com `T: '--ouro'`.
  E acrescentar ao `:root` do `game.css` os 4 tokens novos das Global Constraints.

- [ ] **Step 5: Ligar no build** — em `build.mjs`, `const base = (await cssFontes(ROOT)) + '\n' + cssArte(cssFonte)`
  entra antes de `css` e de `cssProd` (mesmo texto nos dois); tirar o `@import` da linha 1 do `game.css`. O
  `jogo.html`, o `jogo-dev.html` e o `preview.html` levam o bloco; o log do build mostra o tamanho de `base`.

- [ ] **Step 6: Bloco `acabamento` do `ui-test.mjs`** (rodando com `quer('acabamento')`; acrescentar `acabamento` à
  lista do comentário de `UI_SO`):
  - `newPage` ganha a opção `bloquear: string[]` (cada padrão vira `ctx.route(padrao, r => r.abort())` antes do `goto`);
  - **fontes sem rede:** com `bloquear: ['**/fonts.googleapis.com/**', '**/fonts.gstatic.com/**']`, depois de
    `document.fonts.ready`, `document.fonts.check('16px "Press Start 2P"')` e `document.fonts.check('20px "Jersey 10"')`
    dão `true` e as faces com `status === 'loaded'` incluem as duas famílias;
  - **sem `border-image`:** em cada tela que o bloco visita, nenhum elemento visível tem `border-image-source` diferente
    de `none` (função `semBorderImage(pg, tag)`);
  - **altura:** o save `SAVE_3A` (v6, 3 montarias, no padrão do `deModelo` em `ui-test.mjs:3251`, injetado por `init`
    como os outros blocos) aberto a 360×780; `document.documentElement.scrollHeight` do Estábulo e da aba Status da
    ativa ≤ `1.04 * ALTURA_ANTES_3A.<tela>`. **Meça `ALTURA_ANTES_3A` antes de qualquer mudança visual** (a Tarefa 1
    não muda métricas: as fontes são as mesmas) e grave os dois números no teste com o comentário
    `// medido em 2026-11-14, antes da 3a`.

- [ ] **Step 7: Rodar** — `node prototype/build.mjs` (o `jogo.html` cresce no máximo 50 KB; anotar antes e depois no
  relatório), `node prototype/tools/moldes-test.mjs` (tudo passa) e
  `UI_SO=acabamento,texto,producao node prototype/tools/ui-test.mjs` (OK).

- [ ] **Step 8: Commit** — `git add prototype/tools/interface-arte.mjs prototype/assets/fontes prototype/build.mjs
  prototype/src/game.css prototype/tools/moldes-test.mjs prototype/tools/ui-test.mjs prototype/dist docs/wiki.md` e
  `git commit -m "embute as fontes e as peças de pixel da interface no build"`.

### Task 2: Folha da interface

**Files:**
- Create: `prototype/tools/folha-interface.mjs`
- Modify: `prototype/build.mjs` (grava `dist/interface.html`), `prototype/tools/ui-test.mjs` (bloco `acabamento`)

**Interfaces:**
- Consumes: `PECAS`, `pecaRgba`, `cssFontes`, `cssArte` (Tarefa 1); o CSS de produção que o build já monta (`cssProd`).
- Produces: `htmlFolhaInterface({ estilo: string, pecas: Array<{ nome, dataUrl, width, height }> }): string` — documento
  HTML completo (`<!doctype html>`, `lang="pt-BR"`, `<title>Interface do Galope Elemental</title>`), escrito em
  `dist/interface.html`.

- [ ] **Step 1: Teste no bloco `acabamento`** — abre `interface.html` (servida pelo servidor do `ui-test`) a 360×780 e
  a 1280×800: sem erro de console, `checkOverflow` passa, existe uma seção por componente da spec §4 (4.1 a 4.15,
  cada uma com `data-componente="<número>"`) e cada peça de `PECAS` aparece ampliada ×4 com o nome. Grava `interface-2625.png` em `$SHOTS_DIR` numa página com
  `deviceScaleFactor: 2.625` (Review Focus 5; não vai para `prototype/screens/`).
- [ ] **Step 2: Rodar e ver falhar** — `UI_SO=acabamento node prototype/tools/ui-test.mjs` → `interface.html` ausente.
- [ ] **Step 3: Implementar `htmlFolhaInterface`** — markup de exemplo com as classes reais do jogo (as de `game.js`):
  cada componente em todos os estados da spec §6 (normal, foco com a classe utilitária `.foco-demo` que copia o
  `:focus-visible`, apertado com `.apertado-demo` que copia o `:active`, desabilitado, escolhido), variantes ouro,
  perigo, as 5 raridades e as 6 ligas; duas colunas (360 px e larga) no desktop, uma no celular. Ruling do controlador:
  a folha **não** simula o modo de cores forçadas (a spec §6 pedia um botão; simular exigiria repetir as regras do
  `@media (forced-colors: active)` sob outro seletor). Esse modo é coberto pelo `ui-test` com `forcedColors: 'active'`
  (Tarefa 4). O build grava o arquivo.
- [ ] **Step 4: Rodar** — `node prototype/build.mjs` e `UI_SO=acabamento node prototype/tools/ui-test.mjs` → OK.
- [ ] **Step 5: Commit** — `git commit -m "gera a folha da interface com todos os componentes"` (com `prototype/dist`).

### Task 3: Painel, placa, títulos, saldo, avisos e retrato

**Files:**
- Modify: `prototype/src/game.css` (`.caixa`, destaque, `.placa`, `.titulo--tela`, `.saldo`, `.aviso`, `.retrato`)
- Test: `prototype/tools/ui-test.mjs` (bloco `acabamento`)

**Interfaces:**
- Consumes: `--arte-rebite`, `--arte-prego`, `--arte-veio`, tokens novos (Tarefa 1).
- Produces: o painel em destaque aplicado a `.opcao[aria-pressed="true"]` e ao cartão da montaria ativa
  (`.montaria--ativa`, a classe que hoje dá a moldura dourada) — **sem classe nova** (ruling do controlador: a spec
  §4.2 citava `.caixa--destaque`, mas a classe de hoje já marca o lugar).

- [ ] **Step 1: Testes no bloco `acabamento`** (com `SAVE_3A`, 360×780):
  - `.caixa`, `.saldo`, `.placa` e `h1.titulo--tela` visíveis: o `::before` tem `background-image` com
    `data:image/png` e `image-rendering: pixelated`; o `h1.titulo--tela` tem `background-image` com `data:image/png`
    (o veio);
  - **Review Focus 2:** um segundo save, `SAVE_3A_LONGO` (10 vagas cheias, a ativa com nome de 24 caracteres, como
    "Relâmpago da Madrugada X"), e `checkOverflow` no Estábulo, na Montaria (Status e Skills), em Correr, Haras,
    Expedição e Perfil;
  - a altura (Tarefa 1) continua passando.
- [ ] **Step 2: Rodar e ver falhar** — `UI_SO=acabamento node prototype/tools/ui-test.mjs`.
- [ ] **Step 3: Implementar no `game.css`** (spec §4.1–4.3, 4.11, 4.12, 4.14):
  - `.caixa`: contorno `--sombra` 2 px por fora do friso `--linha`; bisel interno 2 px (`--linha-luz` em cima,
    `--painel-3` à esquerda, `--noite-2` embaixo e à direita); sombra projetada 8 px; `::before` com
    `inset: 4px` e quatro `--arte-rebite` de 6×6 px nos cantos;
  - destaque: friso `--ouro-escuro`, bisel claro `--ouro`;
  - `.placa` e `.titulo--tela` (o próprio `h1` vira placa, sem mudar markup): fundo `--madeira` com `--arte-veio`
    repetido em 64×16 px, bisel `--madeira-luz` em cima e `--madeira-2` embaixo (4 px), contorno `--sombra`, `::before`
    com `--arte-prego` 6×6 px em cada ponta, no meio da altura; o texto quebra linha em vez de sair da placa;
  - `.saldo`: placar com friso `--ouro-escuro`, bisel e quatro rebites;
  - `.aviso`/`.aviso--perda`: mantêm a faixa lateral de 4 px, ganham contorno `--sombra` e bisel 2 px;
  - `.retrato`: moldura de madeira de 4 px (`--madeira`, `--madeira-luz` em cima) por fora do contorno de hoje.
- [ ] **Step 4: Rodar** — `node prototype/build.mjs` e `UI_SO=acabamento,texto,ajuda,crescimento node prototype/tools/ui-test.mjs` → OK.
- [ ] **Step 5: Commit** — `git commit -m "dá acabamento pixel art a painéis, placas, saldo, avisos e retratos"`.
- [ ] **Step 6 (controlador):** publicar `prototype/dist/interface.html` como artefato novo ("Interface do Galope
  Elemental") para o Vinicius ver cedo (spec §6); a execução segue sem esperar, e para se ele pedir outro rumo.

### Task 4: Botões, opções, abas, barras, selos, ⓘ e fonte display

**Files:**
- Modify: `prototype/src/game.css` (`.btn` e variantes, `.opcao`, `.abas`, `.app-abas`/`.app-aba--ativa`, `.barra*`,
  `.chip`, `.raridade*`, `.selo-nivel`, `.pontos-livres--selo`, `.badge-ativa`, `.set-badge`, `.ajuda`, as 10 regras da
  display em 11–12 px, `@media (forced-colors: active)`), `prototype/src/game.js` (`ajudaBtn`: sem o caractere)
- Test: `prototype/tools/ui-test.mjs` (bloco `acabamento`; o bloco `ajuda` continua igual)

**Interfaces:**
- Consumes: `--arte-ajuda`, `--arte-ajuda-ativa`, `--ouro-medio`, `--linha-luz` (Tarefa 1).
- Produces: `ajudaBtn(chave, nome)` com a mesma assinatura e o mesmo `aria-label`/`title`/`aria-expanded`; o texto do
  botão fica vazio e a peça vem do `::before`.

- [ ] **Step 1: Testes no bloco `acabamento`:**
  - **display:** em cada tela visitada (inicial, Estábulo, Montaria Status e Skills, Correr, sala de largada, uma corrida
    até o resultado com "Pular para o resultado", Haras, Expedição, Perfil), nenhum elemento visível com `font-family`
    começando por `"Press Start 2P"` tem `font-size` fora de `8px`, `16px`, `24px`;
  - **ⓘ:** nenhum `.ajuda` tem "ⓘ" no `textContent`; o `::before` tem `--arte-ajuda` (com `aria-expanded="true"`,
    `--arte-ajuda-ativa`);
  - **contraste:** para `.btn`, `.btn--ouro`, `.btn--perigo`, `.raridade` (5 variantes) e `.chip` visíveis, razão entre
    `color` e `background-color` calculados ≥ 4,5 (≥ 3 para texto ≥ 24 px ou ≥ 18,66 px com `font-weight` ≥ 700);
    elementos com fundo transparente ficam de fora;
  - **cores forçadas:** página com `forcedColors: 'active'`: `.btn` e `.caixa` com `border-top-width` ≥ 2 px e os
    pseudo-elementos das peças com `display: none` ou `background-image: none`;
  - **Review Focus 3:** a 1280×800, `checkOverflow` e a aba atual da barra lateral com `box-shadow` contendo a cor do
    `--ouro`;
  - **Review Focus 4:** com `?dev=1` a 360×780, abrir a gaveta DEV e `checkOverflow`.
- [ ] **Step 2: Rodar e ver falhar** — `UI_SO=acabamento node prototype/tools/ui-test.mjs`.
- [ ] **Step 3: Implementar no `game.css`** (spec §4.4–4.10, 4.13, §3):
  - `.btn`: contorno `--sombra` 2 px; bisel em 3 tons (claro 2 px em cima e à esquerda, médio 2 px à direita, escuro
    4 px embaixo); sombra 4 px; apertado desce 2 px e a sombra encolhe; desabilitado = opacidade de hoje com bisel escuro
    também no topo; `.btn--ouro` em `--ouro-claro`/`--ouro`/`--ouro-medio`/`--ouro-escuro`; `.btn--perigo` herda o
    botão com o texto em `--perda`; `.btn--texto` sem moldura;
  - `.opcao` herda o botão; escolhida = destaque (Tarefa 3);
  - `.abas` e `.app-abas`: aba normal = botão; aba atual sem a sombra de baixo e com marca de ouro de 2 px no topo
    (na barra lateral do desktop, à esquerda); a barra de baixo ganha friso e contorno do painel, sem rebites;
  - barras: sulco (contorno `--sombra`, borda interna escura 2 px, fundo `--noite-2`), segmentos de hoje com 2 px de
    brilho no topo do preenchimento;
  - selos e chips: canto recortado de 2 px por `clip-path: polygon(…)` em degraus, bisel 2 px, contorno `--sombra`;
    cores das raridades as de hoje;
  - `.ajuda`: alvo de 44×44 px de hoje; `::before` 14×14 px com `--arte-ajuda` (ativo/hover: `--arte-ajuda-ativa`);
  - as 10 regras da display em 11–12 px (spec §3): 16 px se cabe a 360 px, senão Jersey 10 no tamanho do texto em volta;
  - `@media (forced-colors: active)`: `border: 2px solid ButtonText` em `.btn`, `.opcao`, `.caixa`, `.app-aba`, `.aba`;
    pseudo-elementos das peças escondidos.
  E no `game.js`, `ajudaBtn` sem o "ⓘ" no conteúdo do botão.
- [ ] **Step 4: Rodar** — `node prototype/build.mjs` e `UI_SO=acabamento,texto,ajuda,crescimento,build node prototype/tools/ui-test.mjs` → OK.
- [ ] **Step 5: Commit** — `git commit -m "dá acabamento pixel art a botões, abas, barras, selos e ao ⓘ"`.

### Task 5: Documentos, capturas, memória e verificação

**Files:**
- Modify: `docs/GDD.md` (seção da arte), `docs/memoria/assets.md`, `docs/memoria/decisoes.md`,
  `docs/memoria/ESTADO.md`, `prototype/screens/*.png` (regeneradas)

- [ ] **Step 1: Documentos** (spec §10):
  - `GDD.md`: a receita das camadas e as fontes embutidas, em 3–5 linhas;
  - `assets.md`: as duas fontes (origem `fonts.gstatic.com`, licença OFL, tamanho, `prototype/assets/fontes/`) e as
    peças de pixel (feitas à mão em `tools/interface-arte.mjs`, sem IA, sem custo; não entram na declaração de IA da
    Steam);
  - `decisoes.md`: as decisões da execução sob "Visuais 2, parte 3a" (marcar "(controlador, sob delegação)");
  - `ESTADO.md`: 3a pronta (o que mudou, o link da folha, contagens do `check.sh`) e os próximos passos (3b, 3c).
- [ ] **Step 2: Capturas** — `node prototype/tools/ui-test.mjs` (sem `UI_SO`) regenera `prototype/screens/final-*.png`
  (a interface muda de propósito); conferir que nenhuma captura sumiu ou ganhou nome novo sem motivo.
- [ ] **Step 3: Verificação** — `./scripts/check.sh` termina em `VERIFICAÇÃO COMPLETA: OK`; anotar no `ESTADO.md` as
  contagens de cada etapa (moldes ganha os testes da Tarefa 1).
- [ ] **Step 4: Commit** — `git commit -m "atualiza documentos, memória e capturas do acabamento da interface"`.
- [ ] **Step 5 (controlador):** republicar a folha (`interface.html`, mesmo artefato da Tarefa 3) e o `jogo-dev.html` no artefato de teste da frente visual (https://claude.ai/artifact/Jx3fxnrdzCEGiQGjqV7rch);
  os artefatos oficiais só depois do merge na `main` (decisão do Vinicius sobre integração).
