# Tela da corrida (Visuais 2, parte 3c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** na corrida, uma faixa de ordem embaixo da pista, o Dado da Sorte numa faixa grande com o resultado, a faixa
do lugar na chegada e o resultado numa tela com abas e o 1º lugar maior no pódio; mais três pendências da 3b.

**Architecture:** o que fica fora da pista vai em HTML e CSS (`game.js`, `game.css`) com as peças da 3a: faixa de
ordem, narração e resultado. O que acontece na pista continua no canvas (`fx.js` e o desenho da corrida no `game.js`):
faixa do Dado, faixa do lugar, plaquinhas e painel do topo. A simulação não muda; o desenho só lê o estado do instante.

**Tech Stack:** HTML/CSS/JS ES5 puro, sem dependências; `ui-test.mjs` (Playwright já instalado) e `fx-test.js`.

**Spec:** `docs/superpowers/specs/2026-11-15-tela-da-corrida-design.md` (aprovada pelo Vinicius).

## Global Constraints

- Português em código novo, comentários e commits; commits no imperativo terminando com
  `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01MGExzKELAJ58uyj4wakVgJ`.
- `prototype/src/*.js` em ES5; sem dependências; `prototype/dist/` só pelo `node prototype/build.mjs`, commitado junto.
- `sim.js`, `data.js`, `breed.js` e `gear.js` não mudam; o `balance.js` fica igual; nenhum texto de regra muda.
- CLAUDE.md §8: a corrida é determinística e o cliente só anima. O desenho não decide nada, e nada do que se vê
  adianta o que a simulação ainda não mostrou: a faixa de ordem segue `ranking(st, simT)` do instante da pista, e os
  números do Dado só aparecem com o Dado ativo (`dadoAtivo(simT)`).
- "Pular para o resultado" funciona em qualquer momento (faixa na tela, câmera lenta, Dado).
- A 360 px: sem rolagem lateral; os controles da corrida dentro da janela (`checkRaceFits`); a 360×640 a pista continua
  com `lay.compact === false`.
- Desempenho: nada no DOM é reescrito a cada quadro; o teto de chamadas de canvas por quadro (bloco `teto`) e o tempo
  por quadro passam **sem mudar o limite**.
- Movimento reduzido: nenhuma faixa nova pisca, pulsa ou desliza. Sem confete nem partículas novas.
- Nenhuma asserção de teste sai ou fica mais fraca; quando um teste lia algo que mudou de lugar, ele passa a ler no
  lugar novo com o mesmo rigor.
- Regras da 3a e da 3b: sem `border-image`; grade de 2 px; só tokens do `:root`; no HTML, Press Start 2P só em 8, 16
  ou 24 px; contraste ≥ 4,5:1; em cores forçadas, borda em cor do sistema e o item atual em `Highlight`.

## Review Focus

1. **Dois cavalos trocando de posição sem parar** (colados) → a faixa de ordem não fica piscando: a lista é reescrita
   no máximo 4 vezes por segundo. Teste na Tarefa 1.
2. **Girar ou redimensionar a tela no meio da corrida** (360×780 ↔ 780×360) → a faixa e a narração se reajustam (uma
   linha em tela baixa), a pista refaz o layout e os controles continuam dentro da janela. Teste na Tarefa 1.
3. **Sala cheia (8 corredores) e nomes de 16 caracteres** a 360 px → os 8 itens numa linha e a linha dos vizinhos sem
   rolagem lateral e sem mudar a altura da faixa. Teste na Tarefa 1.
4. **Dado com dois dados (Sorte) ou desempate** → a faixa e a faixa de ordem mostram o número que valeu (`best`).
   Teste na Tarefa 2.
5. **Pular no meio da faixa do lugar; resultado com aviso de nível, skill aprendida e Ouro acabado ao mesmo tempo** →
   o pulo leva ao resultado sem faixa presa, e no resultado nada se sobrepõe e as abas funcionam com a tela rolando.
   Testes nas Tarefas 3 e 4.

---

### Task 1: Faixa de ordem e narração

**Files:**
- Modify: `prototype/src/game.js` (`renderCorrida` ~3421; `createRaceView`: `hud` ~3475, `layout()` ~3586,
  `pushFeed` ~3687, o laço do quadro ~4121)
- Modify: `prototype/src/game.css` (`.feed` ~870, bloco novo `.ordem`)
- Test: `prototype/tools/ui-test.mjs` (bloco novo `corrida`)

**Interfaces:**
- Produces (HTML, entre o `.palco` e o `.corrida-baixo`):
  `<section class="ordem" id="ordem" aria-label="Classificação"><ol class="ordem-lista" id="ordem-lista">…</ol><p class="ordem-vizinhos" id="ordem-vizinhos"></p></section>`;
  cada item: `<li class="ordem-item[ ordem-item--voce]" data-raia="<índice>"><span class="ordem-pos">1º</span>` +
  `laneChip(...)` + `<span class="ordem-dado"></span><span class="sr">Mandacaru[ (você)]</span></li>` (o `.ordem-dado`
  fica vazio: é da Tarefa 2).
- Produces (JS, dentro de `createRaceView`): `atualizaOrdem(order, st)` — reescreve `#ordem-lista` só quando a
  sequência de `order` muda e no máximo a cada 250 ms de tempo real; reescreve `#ordem-vizinhos` no máximo a cada
  500 ms; `self.ordemEscritas` (contador de reescritas da lista), `self.ordemAtual` (cópia do `order` mostrado) e
  `self.quadro = { order, pos }` (o `order` de `ranking(st, simT)` e o `st.pos` do quadro corrente, por referência),
  lidos pelos testes em `window.__galope.race._state`.
- Produces (CSS/estado): a classe `tela--baixa` na `.tela--corrida` quando `window.innerHeight < 700`, posta em
  `layout()` (que já roda no resize). Com ela: `.ordem-vizinhos` escondida e a narração com 1 frase em 1 linha.
- Texto dos vizinhos: `À frente: <nome> +N m · Atrás: <nome> −N m` (metros inteiros, da diferença de `st.pos`);
  líder: `Você lidera · Atrás: <nome> −N m`; último: só `À frente: …`; na contagem: `Largada em instantes`; depois de
  cruzar: `Você chegou em Nº`.

- [ ] **Step 1: Testes no bloco `corrida`** (`quer('corrida')`; acrescentar ao comentário de `UI_SO`), numa corrida
  aberta com `?dev=1` e `devArmar({ seed })`:
  - `#ordem` existe na corrida e não na sala de largada; `#ordem-lista > li` tem `n` itens;
  - em 3 instantes (logo depois da largada, no meio e perto do fim), a sequência de `data-raia` dos itens é igual a
    `_state.ordemAtual`, e este é igual a `_state.quadro.order` (depois de 300 ms sem troca de ordem); o item do
    jogador tem
    `.ordem-item--voce`; cada item tem a posição no `.ordem-pos` e o nome do cavalo no `.sr`;
  - a linha dos vizinhos: os nomes são os dos corredores imediatamente à frente e atrás do jogador em `ordemAtual`, e
    os metros batem com a diferença de `_state.quadro.pos` (± 1 m, tolerando os 500 ms de atraso da linha); depois de o
    jogador cruzar, `Você chegou em Nº` com o lugar do `sim.finishOrder`;
  - com `forcedColors: 'active'`, o item do jogador tem `Highlight` (borda ou fundo) e os outros, borda em cor do
    sistema;
  - **Review Focus 1:** em 2 s de corrida em x2, `_state.ordemEscritas` cresce no máximo 8;
  - a 360×780: as duas linhas visíveis; a 360×640: `lay.compact === false`, `.ordem-vizinhos` escondida, `checkRaceFits`
    passa; nos dois tamanhos, a altura de `#ordem`, de `#feed` e do canvas é a mesma na largada, no meio e na chegada;
  - **Review Focus 2:** `setViewportSize` de 360×780 para 780×360 e de volta no meio da corrida: `checkRaceFits` passa
    nos três estados e a classe `tela--baixa` acompanha;
  - **Review Focus 3:** numa sala de 8 corredores (procurar uma seed com `n === 8`) e com o cavalo do jogador
    renomeado para 16 caracteres pelo save: `checkOverflow` a 360 px, os 8 itens com o mesmo `top` e a altura de
    `#ordem` igual à da sala de 4;
  - narração: uma frase longa (a de Garra de um rival com dono, ex. "Lambari (PaçocaPower) mostrou GARRA na reta
    final!") aparece inteira (`scrollWidth <= clientWidth` e `scrollHeight <= clientHeight` no item) em até 2 linhas a
    360×780; os ordinais da narração têm `.ord[aria-hidden]` seguido de `.sr`; `checkOverflow` a 360 e a 390 px.
- [ ] **Step 2: Rodar e ver falhar** — `UI_SO=corrida node prototype/tools/ui-test.mjs`.
- [ ] **Step 3: Implementar** o HTML, `atualizaOrdem` (chamada no laço depois de `ranking`), `tela--baixa` em
  `layout()`, o CSS da faixa (altura fixa; em tela normal a altura já reserva a linha do `.ordem-dado`) e da narração
  (altura fixa, 2 linhas por frase com `-webkit-line-clamp`; em `tela--baixa`, 1 frase em 1 linha com reticências);
  `pushFeed` passa a usar `ordFix` com o `.sr`. Os itens não mostram o nome do cavalo em telas largas (decisão do
  plano: a linha dos vizinhos já traz os nomes).
- [ ] **Step 4: Rodar** — `node prototype/build.mjs` e `UI_SO=corrida,redimensiona,teto,texto,areasegura node prototype/tools/ui-test.mjs` → OK.
- [ ] **Step 5: Commit** — `git commit -m "mostra a ordem dos corredores embaixo da pista"` (com `prototype/dist`).

### Task 2: Dado da Sorte em faixa grande

**Files:**
- Modify: `prototype/src/fx.js` (`timeline` ~429; `stripLayout` ~551 e `drawDiceStrip` ~870 saem; `drawDice` ~804)
- Modify: `prototype/src/game.js` (o desenho do quadro ~3920–3935 e `drawDadosNaPista` ~4043; `atualizaOrdem`)
- Modify: `prototype/src/game.css` (`.ordem-dado`, `.ordem-item--maior`)
- Test: `prototype/tools/fx-test.js` (~1296), `prototype/tools/ui-test.mjs` (bloco `corrida`; os trechos que leem
  `RaceFx._stats.faixaDado`, ~126, ~6428–6482, ~6670)

**Interfaces:**
- Consumes: `#ordem-lista`, `.ordem-dado`, `tela--baixa`, `atualizaOrdem` (Tarefa 1).
- Produces (`fx.js`):
  - o item do Dado na `timeline` ganha `frase` (o trecho de `ev.text` depois de `' — '`, ex. `'o sol abre!'`);
  - `FX.bannerLayout(item, racers, lay, me) -> { x, y, w, h, linhas: string[] }` e
    `FX.drawDiceBanner(ctx, item, racers, lay, S, simT, reduced, me) -> caixa | null`; linhas, em maiúsculas:
    `MAIOR DADO: <nome do cavalo> <best>`, a `frase`, e `VOCÊ TIROU <best do jogador>` só quando `item.winner !== me`;
  - `FX._stats.faixaDado` continua (`true` quando a faixa é desenhada) e entra `FX._stats.faixaDadoLinhas` (as linhas
    desenhadas); `drawDiceStrip` e `stripLayout` deixam de existir (quem usava `stripLayout` como obstáculo das
    plaquinhas, `game.js` ~3990, passa a usar `bannerLayout`).
- Produces (`game.js`): `atualizaOrdem(order, st, dItem)` — com `dItem` (o `dadoAtivo(simT)`), cada `.ordem-dado` mostra o `best` do corredor e o item do vencedor tem
  `.ordem-item--maior`; em `tela--baixa`, o número entra no `.ordem-pos` no lugar da posição; fora do Dado, vazio. A
  faixa "CLIMA: X" (`self.climaMsg`, ~3928) sai; o clarão (`self.flash`) e o texto do `#anuncio` ficam.

- [ ] **Step 1: Testes.**
  - `fx-test.js` (no lugar dos dois testes de `drawDiceStrip`, com o `ctxFalso` de hoje): `bannerLayout` devolve as
    linhas certas para vencedor rival com virada (`['MAIOR DADO: … 12', 'O SOL ABRE!', 'VOCÊ TIROU 7']`), vencedor
    jogador (2 linhas) e sem virada (`'O CLIMA SEGURA!'`); a caixa cabe em `lay.artW` de 180 e fica abaixo de
    `lay.hudH`; `drawDiceBanner` desenha o ícone do dado quando há imagem (como o teste de hoje: `imgs.length`, e os
    retângulos iguais com e sem ícone) e devolve `null` depois de `t1`; **Review Focus 4:** com
    `rolls: [{ dice: [3, 12], best: 12 }, { best: 12, rerolls: 1 }]`, as linhas usam o `best`.
  - `ui-test.mjs`, bloco `corrida`: na janela do Dado, `_stats.faixaDado === true` e `_stats.faixaDadoLinhas[0]`
    contém o nome do cavalo vencedor e o `best` dele; cada `.ordem-dado` tem o `best` do corredor (do
    `_state.fx` daquele Dado) e só o vencedor tem `.ordem-item--maior`; fora da janela, todos vazios; a 360×640, o
    número está no `.ordem-pos`; a altura de `#ordem` não muda entre antes, durante e depois do Dado.
  - Os trechos que conferem o Dado hoje (dados sobre os cavalos, câmera lenta, "Pular" no meio) continuam com as mesmas
    asserções.
- [ ] **Step 2: Rodar e ver falhar** — `node prototype/tools/fx-test.js` e `UI_SO=corrida node prototype/tools/ui-test.mjs`.
- [ ] **Step 3: Implementar.** A faixa: caixa com contorno `--sombra`, friso `--ouro` e bisel de 1 pixel de arte,
  centrada, logo abaixo do painel do topo; o nome e o número são o maior texto (escala 2 se couber em `lay.artW`,
  senão 1). O dado do vencedor sobre o cavalo: maior e com destaque parado quando `reduced`.
- [ ] **Step 4: Rodar** — `node prototype/build.mjs`, `node prototype/tools/fx-test.js` e
  `UI_SO=corrida,teto,skills,aura node prototype/tools/ui-test.mjs` → OK.
- [ ] **Step 5: Commit** — `git commit -m "mostra o resultado do Dado da Sorte numa faixa grande"`.

### Task 3: Faixa do lugar, plaquinhas e painel do topo

**Files:**
- Modify: `prototype/src/game.js` (o laço ~4112 onde `self.crossed` vira `true`; o desenho ~3923; `drawSkillsNaPista`
  ~3964; `box()` ~3712 e `drawHud` ~3723)
- Modify: `prototype/src/fx.js` (`nomeCurto` ~348, `drawBalloon` ~1011)
- Test: `prototype/tools/fx-test.js`, `prototype/tools/ui-test.mjs` (bloco `corrida`; `teto`)

**Interfaces:**
- Consumes: `FX.bannerLayout` como obstáculo (Tarefa 2).
- Produces:
  - `self.lugar = { texto, cor, ate }` quando o jogador cruza a linha **assistindo** (não ao pular): `texto` é
    `'VITÓRIA!'`, `'2º LUGAR'`, `'3º LUGAR'` ou `'Nº LUGAR'`; `cor` é ouro, prata, bronze ou a do painel; `ate` é o
    `tReal` + 2,5 s. A faixa é desenhada abaixo da etiqueta "FOTO DE CHEGADA" sem cobri-la;
    `FX._stats.faixaLugar` = o texto desenhado no quadro (`''` se não há).
  - `FX.nomeEmLinhas(nome, larguraMax, linhasMax) -> string[]`: o nome inteiro numa linha se couber; senão em duas,
    quebrando entre palavras; com `linhasMax === 1` (raia estreita demais para duas linhas), o `nomeCurto` de hoje.
    `FX._stats.caixasBaloes[i]` ganha `texto` (as linhas juntas com espaço).
  - painel do topo: as caixas do `drawHud` e do minimapa com contorno `C.sombra` e bisel de 1 pixel de arte (claro em
    cima, escuro embaixo).

- [ ] **Step 1: Testes.**
  - `fx-test.js`: `nomeEmLinhas('Raízes Firmes', larguraQueNaoCabe, 2)` → `['Raízes', 'Firmes']`; nome que cabe → 1
    linha; `linhasMax` 1 → o resultado de `nomeCurto`.
  - `ui-test.mjs`, bloco `corrida`: quando `_state.crossed` vira `true`, `_stats.faixaLugar` é o texto do lugar do
    jogador (do `sim.finishOrder`) e some depois de ~2,5 s; com `reducedMotion: 'reduce'`, o texto é o mesmo; uma
    corrida vencida (seed com o jogador em 1º, ou forçada pelo DEV) mostra `'VITÓRIA!'`;
    **Review Focus 5a:** clicar em "Pular" com a faixa na tela leva ao resultado, e pular antes de cruzar nunca mostra
    a faixa (`faixaLugar` vazio em todos os quadros amostrados); no layout normal, uma plaquinha de rival de skill com
    nome de duas palavras tem `texto` com o nome inteiro; o bloco `teto` passa com o limite de hoje.
- [ ] **Step 2: Rodar e ver falhar** — `node prototype/tools/fx-test.js` e `UI_SO=corrida node prototype/tools/ui-test.mjs`.
- [ ] **Step 3: Implementar.** Se o bisel do painel estourar o teto de chamadas, a moldura do painel é desenhada uma
  vez num canvas fora da tela e copiada com um `drawImage` por quadro (refeita quando o layout muda).
- [ ] **Step 4: Rodar** — `node prototype/build.mjs`, `node prototype/tools/fx-test.js` e
  `UI_SO=corrida,teto,skills,aura,redimensiona,escala node prototype/tools/ui-test.mjs` → OK.
- [ ] **Step 5: Commit** — `git commit -m "mostra o lugar do jogador na chegada e o nome inteiro das skills"`.

### Task 4: Resultado numa tela, com abas

**Files:**
- Modify: `prototype/src/game.js` (`setupPodium` ~4160, `PODIUM_W/H` ~4159, `renderResultado` ~4215, o clique
  delegado)
- Modify: `prototype/src/game.css` (`.podio-*` ~901, `.balanco`, `.tabela`, `.acoes` do resultado)
- Test: `prototype/tools/ui-test.mjs` (bloco novo `resultado`; os trechos que leem a tela de resultado)

**Interfaces:**
- Produces:
  - `ui.resultAba` (`'chegada'` | `'momentos'`), `'chegada'` a cada resultado novo; a ação `resultado-aba`
    (`data-acao="resultado-aba" data-id="…"`) num `<div class="subabas" role="group" aria-label="Detalhes da corrida">`
    com dois `.btn.opcao.opcao--centro` (`aria-pressed`), como as sub-abas da ficha;
  - aba Chegada: a `<section aria-labelledby="t-chegada">` de hoje (tabela e a nota do Dado); aba Momentos: a
    `<section aria-labelledby="t-dados">` de hoje, ou `<p class="nota">Nenhum momento marcante nesta corrida.</p>`;
  - pódio: o 1º lugar desenhado na escala `k + passo` (3 quando os outros estão em 2), no centro; o canvas com 168 de
    arte de largura (336 px) e mais alto o que o cavalo maior pedir.

- [ ] **Step 1: Testes no bloco `resultado`** (`quer('resultado')`), a 360×780, numa corrida de 7 corredores com seed
  fixa (DEV) em que o jogador não sobe de nível:
  - o fundo de `.subabas` (`getBoundingClientRect().bottom`) ≤ `window.innerHeight` com `scrollY` 0; a altura do
    documento ≤ 1.500 com a aba Chegada;
  - abre em Chegada (`aria-pressed`), com a tabela de 7 linhas e a nota do Dado; cada linha da tabela ≤ 70 px de altura
    e com os mesmos dados de hoje (posição, raia, cavalo, dono, nível, chance de skill, tempo, diferença, prêmio);
  - clicar em Momentos mostra a lista com os mesmos itens de hoje e esconde a tabela; voltar a Chegada; um resultado
    novo abre de novo em Chegada; numa corrida sem momentos, a frase;
  - manchete, entrada, prêmio, resultado, saldo e XP com os valores do `ui.result` (as asserções de hoje); a frase
    embaixo da manchete só existe no caso "Pódio sem prêmio" (sala de 4–5 corredores com o jogador em 3º) e não nos
    outros;
  - "Correr de novo" e "Voltar" com o mesmo `top` (lado a lado) e ≥ 44 px de altura;
  - pódio: os três cavalos inteiros dentro do canvas, sem sobreposição das caixas, e a caixa do 1º maior que as do 2º
    e do 3º (lidas de um registro novo `window.__galope.podio = [{ lugar, x, y, w, h, escala }]`, só no build de
    teste, dentro de `/*@teste:inicio*/…/*@teste:fim*/`);
  - **Review Focus 5b:** num save em que a corrida dá nível e skill nova e deixa o Ouro abaixo da menor entrada: os
    avisos aparecem acima dos botões, nenhuma caixa se sobrepõe (`getBoundingClientRect` dos blocos em ordem), a tela
    rola e as abas trocam;
  - `checkOverflow` a 360 e a 1280; cores forçadas: a aba atual com `Highlight`.
- [ ] **Step 2: Rodar e ver falhar** — `UI_SO=resultado node prototype/tools/ui-test.mjs`.
- [ ] **Step 3: Implementar.** Medidas do revisor da spec (a 360×780): coluna de 328 px; cavalo de ~90×78 px na
  escala 2 e ~120×104 na 3; o canvas cresce ~26 px; as frases de enfeite embaixo da manchete saem (fica só a do pódio
  sem prêmio); entrada, prêmio e resultado numa linha que pode quebrar; os dois botões numa linha (a grade `.acoes`
  de hoje exige 200 px por coluna); a célula do cavalo na tabela com 2 linhas de texto (o nome numa; dono, nível e
  chance de skill na outra).
- [ ] **Step 4: Adaptar** os trechos do `ui-test` que leem o resultado (prêmio, ordem de chegada, momentos, treino,
  Pedra Negra com `GEAR_ON`) para a aba certa, sem tirar asserção.
- [ ] **Step 5: Rodar** — `node prototype/build.mjs` e `UI_SO=resultado,corrida,treino,reserva,crescimento,icones,producao node prototype/tools/ui-test.mjs` → OK.
- [ ] **Step 6: Commit** — `git commit -m "põe o resultado numa tela, com abas e o vencedor maior no pódio"`.

### Task 5: Pendências da 3b

**Files:**
- Modify: `prototype/src/game.js` (`tiraMotivo` ~290, `mostraMotivo` ~296)
- Modify: `prototype/src/game.css` (`.motivo-alvo`; `.badge-ativa` da `.montaria-linha` no bloco de cores forçadas)
- Test: `prototype/tools/ui-test.mjs` (bloco `celular`)

**Interfaces:**
- Produces: `mostraMotivo(btn)` — se o contêiner do botão (o mesmo do `MOTIVO_ONDE`) já tem um elemento visível cujo
  texto é igual ao motivo, não cria a `.motivo`: põe a classe `motivo-alvo` nesse elemento por 2 s (destaque parado:
  contorno `--ouro`, sem animação) e escreve o motivo no `#motivo-vivo`. `tiraMotivo(alvo)` — se a `.motivo` removida
  está acima do `alvo` do clique na página, compensa com `window.scrollBy(0, -altura)`.

- [ ] **Step 1: Testes no bloco `celular`:**
  - Confirmar travado (RF3 do 1b), Redistribuir da ativa com páreo aberto e Expandir com reserva: depois do toque, a
    frase do motivo aparece **uma** vez na tela (contagem de elementos visíveis com aquele texto), o elemento tem
    `.motivo-alvo`, o `#motivo-vivo` tem a frase e o estado do jogo não mudou; a `.barra-acao` não cresce com o toque;
    a classe sai depois de ~2 s;
  - com a `.motivo` de um +N aberta numa linha de cima, tocar num +N de uma linha de baixo: o `getBoundingClientRect().top`
    do botão tocado é o mesmo (± 1 px) antes e depois do toque, e o ponto entra uma vez no rascunho;
  - com `forcedColors: 'active'`, a `.badge-ativa` da `.montaria-linha` tem `border-top-width` ≥ 2 px.
- [ ] **Step 2: Rodar e ver falhar** — `UI_SO=celular node prototype/tools/ui-test.mjs`.
- [ ] **Step 3: Implementar.** A asserção de hoje que conta "uma `.motivo` na tela" passa a contar a frase visível
  uma vez (com `.motivo` ou com `.motivo-alvo`), nos mesmos casos.
- [ ] **Step 4: Rodar** — `node prototype/build.mjs` e `UI_SO=celular,crescimento,build,reserva,acabamento node prototype/tools/ui-test.mjs` → OK.
- [ ] **Step 5: Commit** — `git commit -m "não repete o motivo que já está na tela e segura a lista sob o dedo"`.

### Task 6: Documentos, folha, capturas, memória e verificação

**Files:**
- Modify: `docs/GDD.md`, `docs/memoria/decisoes.md`, `docs/memoria/ESTADO.md`, `prototype/tools/folha-interface.mjs`,
  `prototype/screens/*.png` (regeneradas)

- [ ] **Step 1: Documentos** (spec §12): GDD com a faixa de ordem, a faixa do Dado, a faixa do lugar e as abas do
  resultado (3–5 linhas); `decisoes.md` com as decisões da execução (marcar "(controlador)"); `ESTADO.md` com a 3c
  pronta, a frente "interface" (3a, 3b, 3c) completa na `claude/visuais-2`, as medidas antes e depois, as contagens do
  `check.sh`, a lista "A confirmar com o Vinicius (gosto, 3c)" e os próximos passos (ele joga e decide a integração;
  2c espera créditos).
- [ ] **Step 2: Folha da interface** — seções novas com a faixa de ordem (normal e com os números do Dado) e as abas
  do resultado, com o mesmo markup do jogo; o teste da folha no bloco `acabamento` continua passando.
- [ ] **Step 3: Capturas** — `node prototype/tools/ui-test.mjs` sem `UI_SO`; os mesmos nomes de `prototype/screens/`.
- [ ] **Step 4: Verificação** — `./scripts/check.sh` até `VERIFICAÇÃO COMPLETA: OK`.
- [ ] **Step 5: Commit** — `git commit -m "atualiza documentos, folha, capturas e memória da tela da corrida"`.
- [ ] **Step 6 (controlador):** republicar a folha (https://claude.ai/artifact/YF8h6twHtSK6SRpvnC2UoR) e o
  `jogo-dev.html` no artefato de teste (https://claude.ai/artifact/Jx3fxnrdzCEGiQGjqV7rch).
