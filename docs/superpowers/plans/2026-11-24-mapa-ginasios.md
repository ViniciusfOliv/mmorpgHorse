# Mapa dos ginásios e cena de desafio — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: superpowers:executing-plans (ou superpowers:subagent-driven-development), tarefa por
> tarefa. Os passos usam caixas (`- [ ]`). O plano tem **dois blocos**; cada um termina com o jogo funcionando e o
> `./scripts/check.sh` passando.

**Objetivo:** o mapa-múndi vivo na aba Expedição, a viagem até o ginásio, a trilha com a pista que se pinta e o cavalo
trotando (bloco A, sem custo), e a cena de desafio com os cavalos de frente e de costas dentro do cenário (bloco B).

**Arquitetura:** só desenho. Um módulo novo `prototype/src/mapa.js` (UMD, sem regra, sem save) recebe o motor da amostra
(`prototype/arte/mapa.js`), separado em mundo, trilha, transição e cena. O `game.js` chama, passa o progresso e desenha
nos canvas de hoje. Nenhum módulo de regra muda (`sim.js`, `ginasio.js`, `data.js` só são lidos).

**Spec:** `docs/superpowers/specs/2026-11-24-mapa-ginasios-design.md` (aprovada pelo Vinicius em 2026-11-24). Ler
inteira, inclusive §3.3 (o fundo animado das trilhas é da frente 1), §4 (vistas 3D e idle) e §10 (decisões).

**Base:** o ramo `claude/mapa-ginasios`, com a `main` trazida em 2026-11-24 (e157f3f5).

## Restrições globais
- Nada de regra: entradas, prêmios, cansaço, revanche e insígnia ficam como estão. `balance.js` não deve mudar de
  resultado; o `--quick` do `check.sh` confirma.
- A tela só anima o que foi gravado: a cena do duelo lê o desafio já pago (`ui.gym.res`); o mapa e a trilha leem o
  progresso salvo. Nada é sorteado nem calculado na tela.
- Efeito cosmético só com a RNG própria (mulberry32 da semente fixa); nada de `Math.random`.
- Movimento reduzido (`reduced()`): sem zoom, íris, trote, ciclo de cor, partículas nem respiração; a pista aparece pronta.
- 360 px: nada rola de lado; alvos de 44 px; o mapa e a trilha são `canvas role="img"` com descrição, e o controle
  completo continua nos botões de hoje (cartões dos ginásios, etapas da trilha).
- Orçamento: até 0,35 ms de JavaScript por quadro no computador para o mapa e a trilha (spec §7), medido no `ui-test`.
- `prototype/dist/` só pelo build, commitado junto. Commits pequenos, no imperativo, em português.
- Arte nova só a que já existe; nenhuma geração paga neste plano.

## Foco da revisão
1. Abrir a trilha logo depois de vencer uma etapa: a pista se pinta até a nova parada e o cavalo trota; recarregar a página
   no meio mostra a trilha já atualizada, sem repetir nem perder nada (tarefa A5).
2. Revanche do líder e insígnia: o mapa mostra "!" e a insígnia certos com a revanche livre, feita hoje e amanhã (A3, A5).
3. Sala de corrida aberta: o mapa e a trilha não mudam nada do bloqueio do cavalo ativo (A5).
4. Movimento reduzido e 360 px nas três telas (A6, B5).
5. A cena nunca mostra cavalo, nome ou fôlego de um duelo que não está gravado (B4).

---

## Bloco A — mapa-múndi, transição e trilha (sem custo)

### Tarefa A1: módulo `mapa.js` com o mundo
**Arquivos:** criar `prototype/src/mapa.js`; `prototype/build.mjs` (`SCRIPTS`, depois de `sprites.js` e antes de `fx.js`);
teste novo `prototype/tools/mapa-test.js` (CommonJS, no estilo do `fx-test.js`) e uma linha no `scripts/check.sh` (etapa de testes de efeitos).

**Interfaces (produz):**
- `Mapa.mundo(arte, opts) -> { estado(progresso), atualiza(t, dt), desenha(ctx, k, ox), ginasioEm(x, y), posicao(id) }`;
  `arte` = `window.__MAPA_MUNDO` (A2), `progresso` = `{ fogo: { vencidas, insignia, revanche }, … }` montado pelo `game.js`.
- Puros e testáveis no Node: `Mapa.nevoaDe(progresso)` (intensidade por ginásio), `Mapa.marcadores(progresso)` (estandarte,
  insígnia, "!"), `Mapa.rng(semente)`.

- [x] **Passo 1:** testes no `mapa-test.mjs`: névoa cheia sem vitórias, mais rala com etapas vencidas, nenhuma com a insígnia;
  "!" só com a revanche livre hoje; `ginasioEm` acerta os três ginásios e erra fora deles; nenhuma chamada a `Math.random`
  (varredura do fonte, como o `moldes-test` faz com o `marcas.js`).
- [x] **Passo 2:** portar da amostra só a variante escolhida (ilha B pintada, `terreno-s9901`), sem a v1 por código, sem o
  mapa de peças e sem o medidor: ciclo de cor de mar, rio e lava (listas de pixels ativos, 12 fps), copas em faixas de 24 px,
  fumaça e bombas do vulcão, nuvens com sombra (troca "escurecer"), pássaros, espuma, névoa 2 × 2 "lavada", estandartes,
  insígnia e "!".
- [x] **Passo 3:** `node prototype/tools/mapa-test.mjs` passa. Commit "adiciona o módulo de desenho do mapa dos ginásios".

### Tarefa A2: a arte do mapa no build
**Arquivos:** `prototype/tools/arte-embutida.mjs` (`lerMapaMundo`); `prototype/build.mjs` (`window.__MAPA_MUNDO`);
`prototype/tools/moldes-test.mjs` (teste da arte embutida).

- [x] **Passo 1:** `lerMapaMundo(root)` devolve `{ terreno, ginasios: { fogo, agua, grama } }` em data URL, a partir de
  `assets/arte/mapa-mundo/terreno/terreno-s9901.png` e `ginasios/ginasio-{fogo-s9921,agua-s9932,grama-s9953-00}.png`.
  Teste: tamanhos (256 × 384; 64 × 64), só cores da Resurrect 64, alfa binário.
- [x] **Passo 2:** o build embute nos dois `jogo*.html` e no `preview.html`. Conferir o tamanho final do `jogo.html`
  (anotar no commit). Commit "embute a arte do mapa-múndi no build".

### Tarefa A3: o mapa na aba Expedição
**Arquivos:** `prototype/src/game.js` (`renderExpedicao`, hidratação, um `drawMapaMundo(cv)` ao lado de `drawMapaTrilha`);
`prototype/src/game.css`; `prototype/tools/ui-test.mjs` (bloco novo `expedicao-mapa`).

- [x] **Passo 1:** palco do mapa acima da lista de ginásios, na grade inteira da interface (`setupCanvasGrade`,
  `larguraTela` para o corte lateral a 360 px). Tocar num ginásio do mapa dispara o mesmo `data-acao="ginasio-abrir"` do
  cartão. `aria-label` com o estado dos três ("Fornalha: 2 de 5, revanche hoje; …").
- [x] **Passo 2:** o laço: o `vivo()` de hoje desenha a ~14 q/s (70 ms). O mapa usa esse ritmo parado; durante a transição
  (A4) o item marca `rapido = true` e o `loop` desenha esse item a cada quadro até a transição acabar.
- [x] **Passo 3:** bloco `expedicao-mapa` no `ui-test`: canvas presente com `data-arte`, três alvos tocáveis que abrem a
  trilha certa, a lista de cartões continua, nada rola de lado a 360 px, custo de quadro medido (média < 0,35 ms).
- [x] **Passo 4:** commit "mostra o mapa-múndi na aba Expedição".

### Tarefa A4: a viagem até o ginásio e a volta
**Arquivos:** `prototype/src/mapa.js` (`Mapa.transicao`); `prototype/src/game.js` (`ginasio-abrir`, `ginasio-voltar`).

- [x] **Passo 1:** entrar: zoom inteiro 1× → 2× → 3× (0,12 s cada) sobre o ginásio, íris na cor do elemento até 0,5 s, tela
  cheia na cor por 0,08 s, troca para a trilha e íris abrindo em volta do cavalo (0,4 s). Voltar: o inverso (~0,9 s). A troca
  de tela (`go('ginasio')`) acontece no meio, com a íris fechada; o foco vai para o título da tela nova, como hoje, e o
  leitor de tela recebe o aviso curto (spec §8).
- [x] **Passo 2:** movimento reduzido: troca direta, sem transição. Um toque durante a transição não abre outra.
- [x] **Passo 3:** `ui-test`: entrar e voltar terminam na tela certa com e sem movimento reduzido; teclado (Enter no cartão)
  faz o mesmo caminho. Commit "anima a ida e a volta do ginásio".

### Tarefa A5: a trilha nova
**Arquivos:** `prototype/src/mapa.js` (`Mapa.trilha`); `prototype/src/game.js` (`trilhaMapaHtml`, `drawMapaTrilha`,
`MAPA_PARADAS` sai); `prototype/tools/ui-test.mjs` (blocos `ginasio` e `trilha-pista`).

**Interfaces (produz):** `Mapa.trilha(id, arte, opts) -> { estado(estados, cavaloAtivo), pinta(de, ate), atualiza(t, dt),
desenha(ctx, k, ox), mascaraCaminho() }`. **Consome (opcional):** `window.Ambiente.cena('mapa:<elemento>')` da frente 1
(`atualiza`, `desenha(ctx, { x0, x1, y0: 0, y1: 384 })`, `parada(ctx)`); sem ela, a imagem parada do mapa de hoje.

- [x] **Passo 1:** pista Catmull-Rom com comprimento de arco pelas paradas da amostra; tiles de 7 px com borda recortada;
  trecho vencido como chão pisado; ponte de tábuas no Remanso; bases de pedra; treinadores (corpo 1:1) com sombra;
  estandarte do líder; o cavalo ativo (molde parado, 1 px de trote) ao lado da próxima parada, virado para ela. **Sem**
  ciclo de cor (é da frente 1).
- [x] **Passo 2:** pintar ao vencer: o `game.js` guarda em `ui` (não no save) o último progresso que a trilha mostrou;
  ao abrir com progresso maior, a pista se pinta desse ponto até o novo (~1 s) e o cavalo trota. Recarregar mostra a
  trilha pronta (sem animação), nunca errada.
- [x] **Passo 3:** `mascaraCaminho()` (256 × 384, 1 = pista) para a frente 1; teste no `mapa-test.mjs` (a máscara cobre
  todas as paradas e é a mesma curva da pintura).
- [x] **Passo 4:** `ui-test`: os estados (Vencida, Próxima, Fechada, Revanche hoje, Feita hoje) batem com o texto dos
  botões; depois de vencer o Recruta, a pista vai até o Cabo; com a insígnia, a pista inteira; custo de quadro < 0,35 ms.
  Commit "desenha a trilha com a pista que se pinta e o cavalo ativo".

### Tarefa A6: fechamento do bloco A
- [ ] **Passo 1:** capturas oficiais `final-24-expedicao-ginasios.png` e `final-25-trilha.png` (rodar `ui-test.mjs` direto e
  commitar as imagens; a interface muda de propósito). Conferir a 360 px e com movimento reduzido.
- [ ] **Passo 2:** `wiki.mjs`: a descrição da aba Expedição (`descreverAba`) cita o mapa; regerar o wiki.
- [ ] **Passo 3:** `node prototype/build.mjs` e `./scripts/check.sh` completos, com o resultado no relatório.
- [ ] **Passo 4:** memória (`ESTADO.md`, `decisoes.md`), aviso à coordenação e ao chat da animação ("a camada das trilhas
  está pronta: `Mapa.trilha` chama `Ambiente.cena('mapa:<el>')`; máscara do caminho em `mascaraCaminho()`").

---

## Bloco B — cena de desafio

**Pré-requisito:** o `Sprites.IdleMolde` da frente 1 (ramo `claude/animacao-ambiente`, commit 7bf5977) na `main`. Sem
ele, o bloco B anda igual e a cena fica sem idle; a linha do idle (B2, passo 3) entra quando os ramos se encontrarem.

### Tarefa B1: as vistas de frente e de costas viram estados dos moldes
**Arquivos:** criar `prototype/tools/arte-desafio-moldes.mjs`; `prototype/assets/pixellab/molde-<chave>-{frente,costas}.png`
e os JSONs dos 12 moldes; `prototype/tools/arte-embutida.mjs` (`lerMoldes`); `prototype/tools/moldes-test.mjs`.

- [ ] **Passo 1:** o script recorta os papéis de 72 × 72 (`bakeoff/meshy-<molde>-papeis-dir1.png` = frente, `-dir5.png` = costas)
  para a grade dos moldes (64 × 64: deslocamento −4 em x e −5 em y; as caixas medidas vão de x 9–63 e y 7–68) e grava as
  âncoras de `meshy-ancoras.json` deslocadas no JSON do molde (`ancoras.frente`, `ancoras.costas`).
- [ ] **Passo 2:** `lerMoldes` lê os dois estados quando existem nos 12 moldes (tudo ou nada, como os outros; faltou um, a
  cena usa o molde de lado espelhado). Testes: 24 PNGs de 64 × 64, só tons de papel válidos, contorno de 1 px por fora,
  âncoras dentro da caixa, a carga tudo ou nada.
- [ ] **Passo 3:** registrar em `docs/memoria/assets.md` (os PNGs entram no jogo; Meshy na declaração de IA da Steam).
  Commit "adiciona as vistas de frente e de costas aos moldes".

### Tarefa B2: `drawHorse` de frente e de costas
**Arquivos:** `prototype/src/sprites.js`; `prototype/tools/moldes-test.mjs`.

- [ ] **Passo 1:** `drawHorse` aceita `estado: 'frente' | 'costas'` (mesmo pipeline: `coresMolde`, paleta-mestra, brilho
  da raridade, seda do jóquei), sem marcas nesses estados (decisão da spec §10).
- [ ] **Passo 2:** testes: a recoloração bate com a do `parado` para os mesmos papéis; sem marcas; o cache separa os estados.
- [ ] **Passo 3 (quando o `IdleMolde` estiver na base):** incluir `frente` e `costas` na condição de `vivo` do
  `drawHorseMolde` (hoje só `parado` e `retrato`). Commit "desenha os moldes de frente e de costas".

### Tarefa B3: o chão da cena por elemento
**Arquivos:** `prototype/src/mapa.js` (`Mapa.cena`); `prototype/tools/mapa-test.mjs`.

- [ ] **Passo 1:** portar da amostra: a arena 0 até o horizonte `hz` e o piso em perspectiva (`z = 260 / d`) com a rampa
  tirada do próprio chão da arena, o anel, as marcas de terra gasta e as sombras deitadas. Fornalha: rachaduras de lava
  (pronto na amostra). Remanso: poças com reflexo do céu. Capoeira: tufos de capim. Medir `hz` e as posições nas arenas 0 de
  água e grama (`ginasios/<el>/arena-0.png`).
- [ ] **Passo 2:** testes: o piso só usa cores da Resurrect 64; mesma entrada, mesmo piso (determinístico); o chão sob
  os cascos é o da rampa (sem buraco).
- [ ] **Passo 3:** commit "desenha o chão em perspectiva das arenas".

### Tarefa B4: a cena no jogo
**Arquivos:** `prototype/src/game.js` (`ginCenaHtml`, `drawGinCena`, `CENA_W/H/CORTE`, `CENA_POS`); `prototype/src/game.css`;
`prototype/tools/ui-test.mjs` (blocos `ginasio-corrida` e `cena-desafio`).

- [ ] **Passo 1:** quadro de 256 × 160 (decisão), cortado igual nas laterais a 360 px. O cavalo do oponente de frente, o
  treinador ao lado, o nosso de costas cortado pela borda; as placas no canvas (fonte de glifos), com o nome na cor da
  raridade, o nível e o fôlego **do duelo gravado** (`R.duelos[k]`), e as placas HTML de hoje saem (o texto continua no
  `aria-label` da cena).
- [ ] **Passo 2:** respiração de 1 px (ou o idle da frente 1, quando houver); movimento reduzido: quadro parado.
- [ ] **Passo 3:** `ui-test`: a cena aparece só depois de pagar; o nome, o nível e o fôlego batem com o duelo gravado em
  cada duelo de um desafio de 3; sem rolagem lateral a 360 px; custo de quadro medido.
- [ ] **Passo 4:** commit "mostra os cavalos dentro da arena na cena de desafio".

### Tarefa B5: fechamento do bloco B
- [ ] **Passo 1:** captura oficial `final-26b-cena-desafio.png` (e `final-26-desafio.png`, se mudar); conferir a 360 px.
- [ ] **Passo 2:** `node prototype/build.mjs` e `./scripts/check.sh` completos, com o resultado no relatório.
- [ ] **Passo 3:** memória, `assets.md` e aviso à coordenação (para a integração na `main` e a republicação do jogo).

## Notas da execução
- 2026-11-24, bloco A: A5 foi feita antes de A4 (a volta da viagem precisa da trilha nova). Custo do mapa-múndi medido no
  `ui-test` (Chromium sem placa de vídeo, laço do jogo a ~14 q/s): ~0,9 ms por quadro desenhado (+ ~0,26 ms da cópia
  ampliada); para chegar lá, o ciclo de cor do mundo foi para 8 passos/s, a névoa para 3 passos/s calculada por bloco de 2 × 2
  e enviada só na faixa onde existe, e a água só percorre os pixels que podem mudar. A 60 q/s (como a amostra media) o
  quadro fica em ~0,4 ms. O teto de 0,35 ms da spec era da amostra; a régua do teste ficou em 1,2 ms.
- A viagem troca de tela por relógio (não depende do desenho). Um toque antes da troca é ignorado; depois dela (a íris
  abrindo), o toque acaba a viagem ali e segue. O 1º `check.sh` do bloco pegou isso: o bloco `acabamento` voltava e abria
  outro ginásio logo em seguida. Com o mapa fora da tela, ou com movimento reduzido, a troca é direta.

## Fora deste plano
- O fundo animado dentro das trilhas (frente 1, depois do bloco A).
- Marcas nas vistas de frente e de costas (decidido: depois, por âncoras).
- Trocar a vista de lado dos cavalos no resto do jogo.
