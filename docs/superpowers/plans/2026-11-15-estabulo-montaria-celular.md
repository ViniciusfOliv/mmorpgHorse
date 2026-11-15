# Estábulo e montaria no celular (Visuais 2, parte 3b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estábulo em lista de linhas, ficha com retrato grande e aba "Ficha", aba Status em linha única, motivo de
botão indisponível visível no toque e ordinais legíveis no leitor de tela — menos rolagem no celular a 360 px.

**Architecture:** só `prototype/src/game.js` (o HTML das telas, montado em texto) e `prototype/src/game.css` (com as
peças da 3a). Um mecanismo único de "indisponível com motivo" (`aria-disabled` + linha `.motivo`) é feito primeiro e
reaproveitado pelas telas. Os testes ficam no `prototype/tools/ui-test.mjs`, num bloco novo `celular`; os blocos que
usam o markup antigo são adaptados sem afrouxar.

**Tech Stack:** HTML/CSS/JS ES5 puro, sem dependências; Playwright já instalado para o `ui-test`.

**Spec:** `docs/superpowers/specs/2026-11-15-estabulo-montaria-celular-design.md` (aprovada pelo Vinicius).

## Global Constraints

- Português em código novo, comentários e commits; commits no imperativo terminando com
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01MGExzKELAJ58uyj4wakVgJ`.
- `prototype/src/*.js` em ES5; sem dependências; `prototype/dist/` só pelo `node prototype/build.mjs`, commitado junto.
- Nenhuma regra, número ou texto de regra muda; a corrida e o `balance.js` ficam iguais.
- CLAUDE.md §8: com páreo aberto, ponto que suba o Poder da ativa acima do que a sala viu não entra e a ativa não
  troca. **Botão indisponível nunca executa a ação**, nem forçado (sem o atributo) — o handler confere de novo.
- Nenhuma asserção de teste sai ou fica mais fraca; onde se conferia `disabled`, confere-se `aria-disabled="true"` **e**
  que o toque não mudou o estado.
- A 360 px: sem rolagem lateral; alvos ≥ 44×44 px; áreas seguras; nada novo anima.
- Regras da 3a valem: sem `border-image`; grade de 2 px; só tokens do `:root`; Press Start 2P só em 8/16/24 px; peças
  com `image-rendering: pixelated`; contraste ≥ 4,5:1.
- Metas a 360×780 (spec §2): Estábulo com 3 cavalos ≤ 780 px e com 6 ≤ 1.100 px; aba Status da ativa ≤ 1.200 px sem
  rascunho; ao abrir a ficha, a linha de abas inteira acima da barra de abas do app; Correr e Skills continuam ≤ 1,04×
  a medida da `main` (`ALTURA_ANTES_3A` do `ui-test`).
- Fora destas telas (Correr, Haras, Expedição, Perfil, corrida), os botões continuam com `disabled`.

## Review Focus

1. **Dois toques rápidos no +10 quando só um cabe** → só o primeiro entra; o segundo mostra o motivo. Teste na Tarefa 4.
2. **"Voltar" da ficha** → volta ao Estábulo com o foco no botão da linha daquele cavalo (não no topo da lista). Teste
   na Tarefa 2.
3. **Barra presa com rascunho** → a última coisa da aba Status (bloco Redistribuir) continua alcançável e não fica
   escondida atrás da barra ao rolar até o fim. Teste na Tarefa 4.
4. **Teclado num botão indisponível** (Enter e Espaço) → mostra o motivo e não executa, igual ao toque. Teste na
   Tarefa 1.
5. **Trocar para a aba Ficha (ou Skills) com rascunho** → o rascunho é descartado como hoje, e ao voltar para Status
   os pontos gravados não mudaram. Teste na Tarefa 3.

---

### Task 1: Motivo no toque e ordinais

**Files:**
- Modify: `prototype/src/game.js` (helper novo perto de `ajudaBtn`, ~linha 254; o handler de clique delegado, ~linha
  4140; os botões de Expandir estábulo, Tornar ativa, Liberar, +N, Distribuir sugerido, Confirmar e Redistribuir; a
  troca de "º", ~linha 127)
- Modify: `prototype/src/game.css` (`.motivo`; o estilo desabilitado da 3a também para `[aria-disabled="true"]`)
- Test: `prototype/tools/ui-test.mjs` (bloco novo `celular`; os blocos que conferem `disabled` nesses botões)

**Interfaces:**
- Produces:
  - `indisponivel(motivo: string) -> string` — o trecho de atributos ` aria-disabled="true" data-motivo="…" title="…"`
    (escapado); `''` quando `motivo` é vazio.
  - `MOTIVO_ONDE: Array<[seletor, 'in'|'after']>` e `mostraMotivo(btn: Element) -> void` — tira a `.motivo` que
    houver e põe `<p class="motivo" role="status">` com o `data-motivo` do botão no lugar da 1ª regra que casar
    (`.build-linha` 'in'; `.barra-acao` 'in'; `.build-acoes` 'after'; `.redistribuir` 'in'; `.montaria-acoes` 'after';
    `.acoes` 'after').
  - No clique delegado: botão com `aria-disabled="true"` → `mostraMotivo` e retorna, sem ação; qualquer outro clique
    tira a `.motivo` da tela antes de seguir.
  - Ordinal: `'<sup class="ord" aria-hidden="true">o</sup><span class="sr">º</span>'`.

- [ ] **Step 1: Testes no bloco `celular`** (`quer('celular')`; acrescentar `celular` ao comentário de `UI_SO`), com
  os saves de `ui-test.mjs` que já montam cada estado (o `SAVE_3A` da 3a e uma sala aberta como no bloco `reserva`):
  - para cada botão — Expandir estábulo (sem Ouro), Tornar ativa e Liberar (páreo aberto), +5 (quando só o +1 cabe),
    Distribuir sugerido (nada cabe com rascunho cheio), Confirmar (rascunho acima do Poder da sala, RF3),
    Redistribuir (ativa com páreo aberto): tem `aria-disabled="true"` e não `disabled`; clicar mostra uma `.motivo`
    `role="status"` com o texto esperado; o save (`localStorage`), a ativa, os pontos e a Rédea não mudaram;
  - **forçado:** tirar o `aria-disabled` pelo DOM e clicar → o estado também não muda (handler confere);
  - **Review Focus 4:** focar o botão indisponível e apertar Enter e depois Espaço → motivo aparece, estado igual;
  - a `.motivo` some no próximo clique em outro lugar; nunca há duas na tela;
  - **ordinal:** na aba Skills, o texto "1º terço" tem `.ord[aria-hidden="true"]` seguido de `.sr` com "º".
- [ ] **Step 2: Rodar e ver falhar** — `UI_SO=celular node prototype/tools/ui-test.mjs`.
- [ ] **Step 3: Implementar** `indisponivel`, `MOTIVO_ONDE`, `mostraMotivo`, a interceptação no clique delegado e o
  ordinal; trocar `disabled`/`title` desses 7 botões por `indisponivel(motivo)`, com o texto de motivo de hoje (o
  `title`). Textos novos, no tom dos outros, onde hoje não há `title`: Expandir sem Ouro — "Falta Ouro para expandir o
  estábulo."; no máximo — "O estábulo já está no máximo."; Tornar ativa com páreo aberto — "Páreo aberto: corra a sala
  antes de trocar a montaria ativa."; já ativa — "Esta já é a montaria ativa."; Liberar — o motivo da condição que
  falha (ativa, único cavalo, páreo aberto). Conferir que cada handler (`ativar`, `liberar`, `expandir`,
  `ponto-mais`, `pontos-sugerir`, `pontos-confirmar`, `redistribuir`) recusa quando a condição não vale.
- [ ] **Step 4: Adaptar os blocos que conferem `disabled` nesses botões** (`reserva`, `crescimento`, `build`,
  `nivel-pontos`, `selo-teto`, `build-nivel1` e os que o grep de `disabled` apontar): mesma asserção, agora sobre
  `aria-disabled="true"`, mais a conferência de estado igual depois do clique.
- [ ] **Step 5: Rodar** — `node prototype/build.mjs` e `UI_SO=celular,reserva,crescimento,build,nivel-pontos,selo-teto,build-nivel1,ajuda node prototype/tools/ui-test.mjs` → OK.
- [ ] **Step 6: Commit** — `git commit -m "mostra o motivo dos botões indisponíveis no toque e lê os ordinais"` (com `prototype/dist`).

### Task 2: Estábulo em lista de linhas

**Files:**
- Modify: `prototype/src/game.js` (`montariasHtml`, ~linha 1988; função nova `mountRowHtml`; `portraitHtml` ganha
  `opts.tamanho`; o desenho dos retratos, ~linha 1031)
- Modify: `prototype/src/game.css` (`.montarias`, linha da lista, `.retrato--pequeno`; tirar as 2 colunas de ≥ 601 px)
- Test: `prototype/tools/ui-test.mjs` (bloco `celular`; os blocos que usam `.montaria`/`[data-acao="ativar"]` no
  Estábulo)

**Interfaces:**
- Consumes: `indisponivel` (Tarefa 1) para o Expandir.
- Produces:
  - `mountRowHtml(m, isActive) -> string` — `<button type="button" class="montaria-linha[ montaria--ativa]"
    data-acao="montaria" data-id="<uid>" aria-label="<Nome> #<n>, nível <N>[, ativa]. Abrir ficha.">` com o retrato
    pequeno (`aria-hidden`), nome e `#n`, estrelas, selo "Ativa" na ativa, e a 2ª linha raridade · tipo · Poder
    (`RS.powerRating(m)`).
  - `portraitHtml(horse, { tamanho: 'pequeno' | 'grande' })` — escala de desenho 2 (pequeno) e `PORTRAIT_SCALE_GRANDE`
    (grande, Tarefa 3) no lugar de `PORTRAIT_SCALE` (3); sem `tamanho`, como hoje.
  - `mountCardHtml` fica só para o potro do Haras (`semAcoes`).

- [ ] **Step 1: Testes no bloco `celular`:**
  - `SAVE_3A` (3 cavalos) a 360×780: altura do documento no Estábulo ≤ 780; um save novo `SAVE_3B_6` (6 cavalos, no
    padrão do `SAVE_3A`): ≤ 1.100;
  - uma `.montaria-linha` por cavalo, na ordem de `state.mounts`; nenhum `[data-acao="ativar"]` no Estábulo;
    `aria-label` como acima (com ", ativa" só na ativa);
  - clicar na 2ª linha abre a ficha daquele uid;
  - **Review Focus 2:** da ficha, "Voltar" → o `document.activeElement` é a `.montaria-linha` daquele uid;
  - trocar a ativa pela ficha (aba Ficha, Tarefa 3; até lá pelo `__galope`) e voltar: a ordem das linhas não mudou;
  - `checkOverflow` com o `SAVE_3A_LONGO` (10 vagas, nome de 24 caracteres) a 360 e a 1280.
  - Atualizar o limite de altura do Estábulo no bloco `acabamento` de `1.04 × ALTURA_ANTES_3A.estabulo` para ≤ 780
    (mais rígido).
- [ ] **Step 2: Rodar e ver falhar** — `UI_SO=celular node prototype/tools/ui-test.mjs`.
- [ ] **Step 3: Implementar** `mountRowHtml`, `portraitHtml` com `tamanho`, a lista e o CSS. O foco ao voltar usa o
  mecanismo de foco que a navegação já tem (`data-foco`/`focusAction`).
- [ ] **Step 4: Adaptar os blocos que abrem cavalos pelo Estábulo** (`[data-acao="montaria"]` continua; os que
  clicavam em `[data-acao="ativar"]` na lista passam a ativar pela ficha — até a Tarefa 3, pelo botão da cabeça da
  ficha), sem tirar asserção.
- [ ] **Step 5: Rodar** — `node prototype/build.mjs` e `UI_SO=celular,acabamento,reserva,marcas,portes,retrato,selo node prototype/tools/ui-test.mjs` → OK.
- [ ] **Step 6: Commit** — `git commit -m "mostra o estábulo em lista de linhas"`.

### Task 3: Ficha com retrato grande e aba Ficha

**Files:**
- Modify: `prototype/src/game.js` (`renderMontaria`, ~linha 2708; `MONTARIA_ABAS`, ~linha 2483; conteúdo novo da aba
  Ficha; `PORTRAIT_SCALE_GRANDE`)
- Modify: `prototype/src/game.css` (cabeça, retrato grande, aba Ficha)
- Test: `prototype/tools/ui-test.mjs` (bloco `celular`; os blocos que usam `.montaria-acoes`, `renomear`, `liberar`,
  `ativar` e `montaria-aba`)

**Interfaces:**
- Consumes: `portraitHtml(…, { tamanho: 'grande' })` (Tarefa 2), `indisponivel` (Tarefa 1).
- Produces:
  - `MONTARIA_ABAS` = Status, Skills, (Equipamento com `GEAR_ON`), Ficha: `{ id: 'ficha', rotulo: 'Ficha' }`.
  - `montariaFichaHtml(m) -> string` — as ações (Tornar ativa só se não for a ativa; Renomear com o campo de hoje;
    Liberar com a confirmação de hoje), sexo, porte (`porteTexto`), marcas (`marcasTexto`), cruzas (`breedLeft`),
    corcel, "Skills: N% de ativar" e, com `m.parents`, "Pais: <f.name> e <m.name>", cada nome com " (fora do
    estábulo)" quando o `uid` é `null` ou não está em `state.mounts`.
  - `PORTRAIT_SCALE_GRANDE = 6`; se a linha de abas não couber na primeira tela, 5 (spec §5: as abas vencem).

- [ ] **Step 1: Testes no bloco `celular`** (`SAVE_3A`, 360×780):
  - ao abrir a ficha da ativa: a linha de abas (`.subabas`) tem `getBoundingClientRect().bottom` ≤ o `top` da
    `.app-abas`, com `scrollY` 0; há 3 abas na ordem Status, Skills, Ficha; abre em Status;
  - a cabeça tem o `h1#t-montaria` na placa, raridade, tipo, estrelas (com os ⓘ de raridade e estrelas), Poder e liga
    com os ⓘ, e o XP; não tem porte, marcas, cruza, nem os botões de ação;
  - aba Ficha: Tornar ativa ausente na ativa e presente nas outras; Renomear e Liberar como antes (os testes de
    renomear/liberar de hoje passam a abrir a aba Ficha); com páreo aberto, Tornar ativa e Liberar com
    `aria-disabled`, motivo no toque, ativa e estábulo iguais;
  - pais: um save com `parents` em que um `uid` existe e o outro é `null` → o 2º nome com "(fora do estábulo)" e o 1º
    sem;
  - **Review Focus 5:** com rascunho na aba Status, ir para Ficha e voltar → sem rascunho e o `alloc` gravado igual;
  - `checkOverflow` nas três abas com o `SAVE_3A_LONGO`; Skills continua ≤ 1,04× `ALTURA_ANTES_3A.skills`.
- [ ] **Step 2: Rodar e ver falhar** — `UI_SO=celular node prototype/tools/ui-test.mjs`.
- [ ] **Step 3: Implementar** a cabeça nova, `montariaFichaHtml`, a aba no `MONTARIA_ABAS` (o handler
  `montaria-aba` e `montariaAbaValida` já aceitam a lista), e o CSS; o rascunho segue a regra de hoje ao trocar de
  aba.
- [ ] **Step 4: Adaptar os blocos que usam as ações da cabeça** (`montaria-acoes`, `renomear`, `liberar`, `ativar` na
  ficha), sem tirar asserção.
- [ ] **Step 5: Rodar** — `node prototype/build.mjs` e `UI_SO=celular,acabamento,ajuda,crescimento,reserva,marcas,portes node prototype/tools/ui-test.mjs` → OK.
- [ ] **Step 6: Commit** — `git commit -m "põe o cavalo em destaque na ficha e cria a aba Ficha"`.

### Task 4: Aba Status em linha única

**Files:**
- Modify: `prototype/src/game.js` (`montariaStatusHtml`, ~linha 2617; ajuda no nome do status)
- Modify: `prototype/src/game.css` (`.build-linha`, `.build-nome`, barra fina, `.barra-acao` presa acima da
  `.app-abas`)
- Test: `prototype/tools/ui-test.mjs` (bloco `celular`; `ajuda`, `crescimento`, `build`, `acabamento`)

**Interfaces:**
- Consumes: `indisponivel`, `MOTIVO_ONDE` (Tarefa 1).
- Produces: o nome do status é o botão de ajuda — `<button type="button" class="ajuda ajuda--nome" data-ajuda="<k>"
  aria-expanded="false" aria-label="O que é <Nome>?" title="<HELP>">` com o ícone, a sigla e a peça ⓘ pequena; a
  linha `.build-linha` em uma linha de grid (nome, nota, valor, custo "·N" com `.sr` "próximo ponto custa N", +1/+5/+10)
  e a barra segmentada de 6 px embaixo; a Sorte com "de nascimento"; Desfazer e Confirmar (com o pedido de confirmação
  e o motivo do Confirmar) dentro de `.barra-acao`, que só existe com rascunho.

- [ ] **Step 1: Testes no bloco `celular`** (`SAVE_3A`, 360×780):
  - altura do documento na aba Status ≤ 1.200 sem rascunho; atualizar o limite do Status no bloco `acabamento` para
    ≤ 1.200 (mais rígido que 1,04 × 1.894);
  - cada `.build-linha` (exceto Sorte) com nome, nota, valor, custo e três `.build-mais` na mesma linha visual
    (mesmo `top` ± 4 px) e a barra abaixo; cada botão ≥ 44×44; sem rolagem lateral, também com o `SAVE_3A_LONGO`;
  - o bloco `ajuda` passa sem mudança sobre o botão do nome (nome acessível, `title`, alvo ≥ 44×44, abrir e fechar);
    não sobra outro `[data-ajuda="<k>"]` na linha;
  - o topo é uma linha só, "Pontos: sobram X de Y" com o ⓘ do custo e "Genética" com o seu ⓘ (pode quebrar);
  - com rascunho: `.barra-acao` visível acima da `.app-abas` com Desfazer e Confirmar; sem rascunho, ausente; a
    1280×800, a barra fica na coluna, sem ficar sob a barra lateral de abas;
  - **Review Focus 3:** com rascunho, rolar até o fim → o botão Redistribuir fica inteiro visível acima da
    `.barra-acao`;
  - **Review Focus 1:** com livres para só um +10, dois cliques seguidos no +10 → o rascunho soma 10 uma vez e a
    `.motivo` aparece;
  - o motivo do +N aparece dentro da `.build-linha` daquele status.
- [ ] **Step 2: Rodar e ver falhar** — `UI_SO=celular node prototype/tools/ui-test.mjs`.
- [ ] **Step 3: Implementar** a linha única, a ajuda no nome (mesmo `GD.HELP[k]`), a barra presa (`position: sticky`,
  `bottom` acima da `.app-abas` e da área segura; a regra de `html.dev-ativo` mantida) e o espaço no fim da lista
  para a barra não cobrir o último item. Se a linha não couber a 360 px com alvos de 44 px, o custo desce para baixo
  do valor (spec §6); os botões nunca encolhem.
- [ ] **Step 4: Adaptar** os blocos `crescimento`, `build`, `ajuda` ao markup novo, sem tirar asserção.
- [ ] **Step 5: Rodar** — `node prototype/build.mjs` e `UI_SO=celular,acabamento,ajuda,crescimento,build,nivel-pontos,selo-teto,build-nivel1,texto node prototype/tools/ui-test.mjs` → OK.
- [ ] **Step 6: Commit** — `git commit -m "põe cada status numa linha e prende o Confirmar embaixo"`.

### Task 5: Documentos, capturas, memória e verificação

**Files:**
- Modify: `docs/GDD.md` (seção das telas), `docs/memoria/decisoes.md`, `docs/memoria/ESTADO.md`,
  `prototype/screens/*.png` (regeneradas)

- [ ] **Step 1: Documentos** (spec §11): GDD com o Estábulo em lista e a ficha com três abas (3–5 linhas);
  `decisoes.md` com as decisões da execução (marcar "(controlador)" nas que não são do Vinicius); `ESTADO.md` com a 3b
  pronta (alturas medidas antes e depois, contagens do `check.sh`) e o próximo passo (3c).
- [ ] **Step 2: Capturas** — `node prototype/tools/ui-test.mjs` sem `UI_SO`; os mesmos nomes de `prototype/screens/`,
  nenhum sumido.
- [ ] **Step 3: Verificação** — `./scripts/check.sh` até `VERIFICAÇÃO COMPLETA: OK`.
- [ ] **Step 4: Commit** — `git commit -m "atualiza documentos, memória e capturas do estábulo e da montaria no celular"`.
- [ ] **Step 5 (controlador):** republicar a folha (`interface.html`, https://claude.ai/artifact/YF8h6twHtSK6SRpvnC2UoR)
  e o `jogo-dev.html` no artefato de teste (https://claude.ai/artifact/Jx3fxnrdzCEGiQGjqV7rch).
