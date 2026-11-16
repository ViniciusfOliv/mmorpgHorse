# Itens, mochila, loja e recompensa diária — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dar ao jogador cinco itens de uso único, uma mochila, uma loja que os vende por Ouro e uma recompensa diária de 7 dias.

**Architecture:** as regras ficam num módulo puro novo, `prototype/src/itens.js` (sem tela, sem relógio, sem `Math.random`), com o catálogo e os números no `data.js`; o `sim.js` só ganha os torrões em `freePoints` e expõe as candidatas a skill. O `game.js` guarda (save versão 7), lê o dia num único lugar, mostra as telas e grava cada uso junto com o contador do sorteio.

**Tech Stack:** HTML/CSS/JavaScript ES5 sem dependências; testes em Node (`sim-test.js`) e Playwright (`ui-test.mjs`); build `node prototype/build.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-16-itens-loja-diaria-design.md` (aprovada pelo Vinicius em 2026-11-16). Fatos do código de antes desta frente: seção "Onde o código está hoje", no fim deste plano.

## Global Constraints

- Português em código novo, comentários e commits; commits no imperativo terminando com
  `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01MGExzKELAJ58uyj4wakVgJ`.
- `prototype/src/*.js` em ES5; sem dependências; `prototype/dist/` só pelo `node prototype/build.mjs`, commitado junto.
- Módulos de regra: mudam só `data.js`, `sim.js` (`freePoints` e a lista de candidatas) e o novo `itens.js`. `breed.js`,
  `gear.js` e `balance.js` não mudam; todas as metas do `balance.js` continuam verdes.
- **Sem `Math.random`.** Cupom e Manual sorteiam com `RaceSim.mulberry32(RaceSim.hash2(seedBase, sal + contador))`; o
  contador novo é gravado na mesma gravação do resultado. Recarregar a página não muda um resultado.
- **O relógio é lido num só lugar** (`hojeDia()` no `game.js`). `itens.js` recebe o dia como inteiro.
- **A loja só aceita Ouro, respeita o Ouro reservado para a entrada (`podeGastar`) e nunca vende a Rédea nova.**
- **Sala aberta:** Cupom e Manual são recusados no cavalo ativo; a trava dos pontos (`travaPontos`) fica como está; o
  resultado da corrida aberta não muda com nenhum uso de item.
- **Save:** versão 7; um save de versão maior que a do código nunca é adotado nem gravado por cima; o save de teste
  (`galope-elemental:dev`) continua separado do real; o build de produção sai sem gancho de teste e sem deslocamento de dias.
- Regras da 3a e da 3b: sem `border-image`; grade de 2 px; só tokens do `:root`; Press Start 2P só em 8, 16 ou 24 px;
  contraste ≥ 4,5:1; botões ≥ 44 px; foco visível; em cores forçadas, borda em cor do sistema e o item atual em
  `Highlight`. Movimento reduzido: nada novo pisca, pulsa ou desliza.
- Nenhuma asserção de teste sai ou fica mais fraca, com duas mudanças de propósito: os limites de altura do Estábulo
  (Tarefa 5) e "sem equipamento: 4 abas (sem a Loja)", que passa a exigir 5 abas (Tarefa 3).
- Sem geração paga: os cinco ícones são desenhados em código.
- `./scripts/check.sh` termina em `VERIFICAÇÃO COMPLETA: OK` antes do commit final de cada tarefa; `prototype/screens/`
  só muda na Tarefa 6.

## Review Focus

1. **Recarregar ou ter duas abas abertas no meio de um uso** → depois de um Cupom ou Manual, recarregar mostra o mesmo
   resultado, com o item já gasto; usar numa aba e agir na outra não duplica item nem sorteia de novo. Teste na Tarefa 4.
2. **O dia vira com o jogo aberto** → o cartão da diária e os limites da loja mudam no próximo desenho da tela, sem
   recarregar; um resgate antes e outro depois da virada são dois resgates válidos. Teste na Tarefa 5.
3. **Relógio para trás e de novo para a frente** → voltar o dia não libera resgate nem limite; ao passar de novo do
   último dia guardado, tudo volta a funcionar, sem estado quebrado. Testes nas Tarefas 1 e 5.
4. **Tudo no limite** → mochila com 99, cavalo com 10 torrões, cavalo ★3, vagas de skill cheias, cavalo sem candidata:
   nenhum erro, botão apagado com o motivo, nada gasto. Testes nas Tarefas 1 e 4.
5. **O cavalo ou a sala mudam entre escolher e confirmar** (o cavalo saiu numa Troca, virou o ativo, a sala abriu) →
   a confirmação confere tudo de novo e recusa com o motivo, sem gastar o item. Teste na Tarefa 4.

---

### Task 1: Regras dos itens, catálogo e wiki

**Files:**
- Create: `prototype/src/itens.js`
- Modify: `prototype/src/data.js`, `prototype/src/sim.js` (`freePoints` ~369, `learnSkill` ~502), `prototype/build.mjs`
  (`SCRIPTS`, depois de `src/gear.js`), `prototype/index.html` (a tag do script, na mesma posição),
  `prototype/tools/wiki.mjs`, `prototype/tools/wiki-test.mjs`
- Test: `prototype/tools/sim-test.js` (seção nova `itens`; `var IT = require('../src/itens.js')`)

**Interfaces:**
- Produces (`data.js`):
  - `GameData.ITEMS`, com as chaves nesta ordem: `torrao`, `estrela`, `redea`, `cupom`, `manual`. Cada uma com `id`,
    `name` (`'Torrão de açúcar'`, `'Estrela de treino'`, `'Rédea nova'`, `'Cupom de troca de skill'`, `'Manual de doma'`),
    `desc` (uma linha: para que serve), `origem` (uma linha: de onde vem) e os números da spec: `torrao { price: 120,
    perDay: 2, cap: 10 }`, `estrela { price: 2000, everyDays: 7 }`, `redea { price: null }`, `cupom { price: 250,
    perDay: 1 }`, `manual { price: 200, perDay: 1, chance: 0.35 }`;
  - `GameData.BAG_MAX = 99`;
  - `GameData.DAILY = { dias: [ { ouro: 60 }, { item: 'torrao' }, { ouro: 100 }, { item: 'manual' }, { ouro: 150 },
    { item: 'cupom' }, { ouro: 200, item: 'redea' } ], estrelaACada: 4 }`.
- Produces (`sim.js`): `RaceSim.skillCandidates(mount) -> string[]` (as skills gerais e as do elemento que o cavalo não
  tem, na ordem de `GameData.SKILLS`; `learnSkill` passa a usá-la, com as mesmas chamadas de `rng` de hoje);
  `freePoints(horse)` soma `horse.torroes` (inteiro de 0 a `GameData.ITEMS.torrao.cap`; fora disso, 0) depois do `floor`.
- Produces (`itens.js`, global `Itens`, com `module.exports` como o `gear.js`):
  - `Itens.diaLocal(ano, mes, dia) -> inteiro` (`Date.UTC(ano, mes, dia) / 86400000`; não lê o relógio);
  - `Itens.podeUsar(id, mount, ctx) -> { ok: true } | { ok: false, motivo: string }`, para `torrao`, `estrela`, `cupom`
    e `manual`; `ctx = { tem: inteiro, ativaComSala: boolean }`. Motivos (frases prontas para a tela, em português):
    sem o item; cavalo com 10 torrões; cavalo com 3 estrelas; sem skill nas vagas; sem candidata; vagas cheias; cavalo
    ativo com a sala aberta (só `cupom` e `manual`);
  - `Itens.usarTorrao(mount) -> { torroes }`, `Itens.usarEstrela(mount) -> { grau }` (valores novos; não mutam);
  - `Itens.trocarSkill(mount, skillId, seedBase, contador) -> { sai, entra, skills }` — UMA chamada de `rng`
    (`mulberry32(hash2(seedBase, 0x17E5 + contador))`), escolhe entre `skillCandidates(mount)`; a skill nova fica na
    mesma posição; `null` se `skillId` não está nas vagas ou não há candidata;
  - `Itens.tentarDoma(mount, seedBase, contador) -> { aprendeu: id | null, skills }` — mesmo sal; chamadas de `rng`:
    1) `rng() < chance`, 2) a candidata; `null` se não há vaga ou candidata;
  - `Itens.diariaEstado(diaria, hoje) -> { pode, dia (1–7), premio, amanha, estrela }` e
    `Itens.resgatar(diaria, hoje, cabe) -> { diaria, ouro, itens: { id: qtd } } | { cheia: id } | null`;
    `diaria = { prox: 0–6, ciclos: inteiro, ultimo: inteiro | null }`; `cabe(id, qtd) -> boolean`; a Estrela entra em
    `itens` quando o resgate fecha um calendário e `ciclos` novo é múltiplo de `estrelaACada`;
  - `Itens.lojaDoDia(loja, hoje) -> loja` (zera `comprados` quando `hoje > loja.dia`; com `hoje < loja.dia` devolve
    igual), `Itens.podeComprar(id, loja, hoje, ouro, ouroLivre, tem) -> { ok: true, restam } | { ok: false, motivo:
    'nao-vende' | 'limite' | 'cheia' | 'sem-ouro' | 'reservado', emDias? }` e `Itens.comprar(id, loja, hoje) -> loja`;
    `loja = { dia: inteiro | null, comprados: { torrao, manual, cupom }, estrelaDia: inteiro | null }`.
- O sal `0x17E5` não pode colidir com os que existem (`0xE4A0`, `0xB1AC` no `gear.js`; os do `breed.js`; `seedTag * 100
  + nível` no `applyXp`): confira e troque se colidir, dizendo no relatório.

- [ ] **Step 1: Testes em `sim-test.js`, seção `itens`** (cada um com os valores da spec):
  - catálogo: as 5 chaves na ordem, os preços `120/2000/null/250/200`, `perDay 2/1/1`, `cap 10`, `everyDays 7`,
    `chance 0.35`, `BAG_MAX 99`, os 7 dias de `DAILY` e `estrelaACada 4`;
  - `freePoints`: para um cavalo de nível 50, raro, ★2, `freePoints` com `torroes` 1 e 10 é o de 0 mais 1 e mais 10;
    `torroes` −1, 11, 2.5 e `'x'` valem 0; bots (`weightedAlloc`) não mudam;
  - `skillCandidates` devolve o que `learnSkill` sorteava (mesmo conjunto) e `learnSkill` devolve o mesmo que antes
    para 200 seeds (compare com uma cópia local da função antiga dentro do teste);
  - `podeUsar`: um caso `ok` e um caso de cada motivo; `cupom` e `manual` com `ativaComSala` recusam, `torrao` e
    `estrela` com `ativaComSala` aceitam;
  - `trocarSkill`: mesma seed e contador → mesmo resultado; contador diferente muda em pelo menos uma de 50 seeds; em
    500 seeds a que entra nunca é a que sai, nunca é uma que o cavalo já tem e nunca é skill de tipo; a posição se mantém;
  - `tentarDoma`: em 4.000 seeds aprende entre 31% e 39%; aprendendo, a skill vem das candidatas; sem vaga → `null`;
  - diária: 7 resgates em dias seguidos dão `60, torrao, 100, manual, 150, cupom, 200 + redea` e voltam ao dia 1; o
    28º resgate traz a Estrela e o 7º não; dois resgates no mesmo dia → o segundo `null`; **Review Focus 3:** resgata
    no dia 100, tenta no 99 → `null`, tenta no 101 → vale; faltar 5 dias não muda `prox`; `cabe` negando → `{ cheia }`
    e a diária não anda;
  - loja: 2 torrões no dia e o 3º `limite`; no dia seguinte volta; **relógio para trás** não volta; Estrela comprada no
    dia 10 → `limite` com `emDias` 7…1 até o dia 16 e `ok` no 17; `redea` → `nao-vende`; `sem-ouro` e `reservado`
    (ouro ≥ preço > ouroLivre); `cheia` com 99.
- [ ] **Step 2: Rodar e ver falhar** — `node prototype/tools/sim-test.js` → FALHA nos testes novos (módulo inexistente).
- [ ] **Step 3: Implementar** `data.js`, `sim.js`, `itens.js`; incluir o script no `build.mjs` e no `index.html`.
- [ ] **Step 4: Wiki.** Seção de itens gerada do catálogo (o que faz, limites, preço, de onde vem) e a tabela da
  diária; trocar a frase "Ainda não existe item que sobe estrela."; a cobertura do `wiki-test.mjs` passa a exigir os
  cinco nomes de item. `node prototype/tools/wiki.mjs` e `node prototype/tools/wiki-test.mjs` → OK.
- [ ] **Step 5: Rodar** — `node prototype/build.mjs`, `node prototype/tools/sim-test.js` → 0 falhas,
  `node prototype/tools/balance.js --quick` → todas as metas, `./scripts/check.sh` → `VERIFICAÇÃO COMPLETA: OK`.
- [ ] **Step 6: Commit** — `git commit -m "cria as regras dos itens, da loja e da recompensa diária"`.

### Task 2: Save versão 7, proteção contra save mais novo e o dia

**Files:**
- Modify: `prototype/src/game.js` (`SAVE_VERSION` ~538, `newState` ~596, `sanitizeMount` ~701, `sanitize` ~740, a
  leitura inicial ~5233, `adoptExternal` e o evento `storage` ~5269, o estado do `hot` ~5224, a gaveta DEV ~1554–1735),
  `prototype/src/dev.js` (se o grupo novo precisar), `prototype/src/game.css`, `prototype/build.mjs` (a lista de
  padrões proibidos na produção, ~111)
- Test: `prototype/tools/ui-test.mjs` (bloco novo `itens`, acrescentado ao comentário do `UI_SO`)

**Interfaces:**
- Consumes: `Itens.diaLocal`, `GameData.ITEMS`, `GameData.BAG_MAX` (Tarefa 1).
- Produces (campos do save; nomes fixos para as tarefas seguintes):
  - `state.mochila = { torrao: 0, estrela: 0, cupom: 0, manual: 0 }` (inteiros de 0 a `BAG_MAX`);
  - `state.diaria = { prox: 0, ciclos: 0, ultimo: null }`;
  - `state.lojaItens = { dia: null, comprados: { torrao: 0, manual: 0, cupom: 0 }, estrelaDia: null }`;
  - `state.itemCounter = 0`; `mount.torroes = 0` (0 a 10);
  - `state.devDias = 0` (inteiro de −400 a 400; fora do modo DEV vale sempre 0).
- Produces (funções): `hojeDia() -> inteiro` (o único lugar que lê o relógio: data local do aparelho por
  `Itens.diaLocal`, mais `state.devDias` no modo DEV); `saveMaisNovo(s) -> boolean` (`Number(s.v) > SAVE_VERSION`).
- Produces (gaveta DEV, grupo "Itens e dia", no padrão de `devEntrada`/`devBotao`/`devGrava`): definir a quantidade de
  cada um dos quatro itens da mochila; "Avançar 1 dia"; "Voltar 1 dia"; "Zerar diária e limites".

- [ ] **Step 1: Testes no bloco `itens`:**
  - um save versão 6 gravado no `localStorage` (com cavalos, Ouro e Rédeas) abre com `v` 7, a mochila zerada, a diária
    `{ prox: 0, ciclos: 0, ultimo: null }`, os torrões 0 em cada cavalo, e o Ouro, os cavalos e as Rédeas iguais;
  - campos novos com lixo (`'x'`, −3, 1e9, `null`, `NaN`, objeto no lugar de número) voltam ao padrão, sem erro de console;
  - **save de versão 8:** o jogo mostra a tela de bloqueio (texto que diz que o save é de uma versão mais nova e o
    botão "Recarregar"), não mostra o Estábulo, e o conteúdo da chave no `localStorage` continua byte a byte igual
    depois de 2 s e depois de tocar em tudo que houver na tela; o mesmo com o save de teste (`?dev=1`);
  - com o jogo aberto num save versão 7, outra aba grava um save versão 8 na mesma chave (dispare o evento `storage`):
    o jogo passa à tela de bloqueio e não grava por cima;
  - gaveta DEV: definir 3 torrões → `state.mochila.torrao === 3`; "Avançar 1 dia" duas vezes e "Voltar 1 dia" uma →
    `hojeDia()` um dia à frente do real; o save real não tem `devDias` diferente de 0;
  - produção (`prototype/dist/jogo.html`): o texto `devDias` não aparece fora de zero (o build falha se o
    deslocamento sobrar): acrescente o padrão à lista de proibidos do `build.mjs` se for possível sem falso positivo,
    senão confira no teste que `hojeDia()` ignora o campo fora do modo DEV.
- [ ] **Step 2: Rodar e ver falhar** — `UI_SO=itens node prototype/tools/ui-test.mjs`.
- [ ] **Step 3: Implementar.** A tela de bloqueio é uma tela inteira, sem barra de abas, com o texto e o botão
  "Recarregar" (`location.reload()`); vale na leitura inicial, no save vindo de outra aba e no estado do `hot`.
- [ ] **Step 4: Rodar** — `node prototype/build.mjs`, `UI_SO=itens,gravacao,reserva,producao node
  prototype/tools/ui-test.mjs` → OK; `./scripts/check.sh` → OK.
- [ ] **Step 5: Commit** — `git commit -m "sobe o save para a versão 7 e protege o save mais novo"`.

### Task 3: Loja e mochila

**Files:**
- Modify: `prototype/src/game.js` (`ABAS` ~1295, `ACOES_EQUIP` ~4646, `renderLoja` ~3056, o clique delegado),
  `prototype/src/game.css`, `prototype/tools/interface-arte.mjs` (cinco ícones de item, como mapas de texto),
  `prototype/tools/wiki.mjs` (`descreverAba` e a leitura de `ABAS`)
- Test: `prototype/tools/ui-test.mjs` (bloco `itens`; a asserção "sem equipamento: 4 abas (sem a Loja)", ~6203)

**Interfaces:**
- Consumes: `Itens.lojaDoDia`, `Itens.podeComprar`, `Itens.comprar`, `hojeDia()`, os campos do save (Tarefas 1 e 2).
- Produces:
  - a aba `loja` sempre na barra (5ª), fora do portão do `GEAR_ON`; o que é do equipamento continua atrás dele;
  - `ui.lojaParte` (`'comprar'` | `'mochila'`), `'comprar'` ao entrar na aba; a ação `loja-parte` num
    `<div class="subabas" role="group" aria-label="Partes da loja">` com dois `.btn.opcao.opcao--centro` (`aria-pressed`);
  - a ação `item-comprar` (`data-id` = id do item): confere de novo com `Itens.podeComprar`, debita, soma na mochila,
    grava com o padrão do `gravaGasto`;
  - `itemIconeHtml(id)` (o ícone do item, decorativo) e `itemLinhaHtml(id, opções)` (a linha de um item: ícone, nome,
    descrição, quantidade), usadas na loja, na mochila e, na Tarefa 4, na escolha;
  - na parte Mochila: os cinco itens na ordem do catálogo, com a quantidade (a Rédea nova lê `state.redeas`); com 0, a
    linha apagada e a frase `origem` do catálogo. O botão "Usar" entra na Tarefa 4.

- [ ] **Step 1: Testes no bloco `itens`**, a 360×780, com Ouro definido pela gaveta DEV:
  - a barra tem 5 abas, a última "Loja"; a aba abre em Comprar; quatro produtos na ordem Torrão, Manual, Cupom,
    Estrela, com os preços 120, 200, 250, 2.000, e a linha da Rédea nova sem botão de compra;
  - comprar 1 Torrão: o saldo cai 120, a mochila mostra 1, o produto mostra "1 de 2 hoje"; o 2º compra; o 3º tem o
    botão "Limite de hoje" e o toque não muda saldo nem mochila; "Avançar 1 dia" na gaveta DEV e o limite volta;
    "Voltar 1 dia" depois de comprar não devolve o limite;
  - Estrela: compra com 2.000, depois "de novo em 7 dias"; avançando 7 dias, compra de novo;
  - com 100 de Ouro: Torrão "Sem Ouro"; com a sala aberta e o Ouro livre abaixo do preço: "Reservado", e o toque não
    muda nada nem re-sorteia a sala (a sala guardada continua igual);
  - mochila com 99 torrões (pela gaveta DEV): comprar Torrão recusado com o motivo;
  - a parte Mochila lista os cinco, com as quantidades certas e a frase de origem nos de quantidade 0; o leitor de
    tela lê "3 Torrões de açúcar" (texto acessível), não "x3";
  - `checkOverflow` a 360×780, 360×640 e 1280; botões ≥ 44 px; cores forçadas: produtos e linhas com borda em cor do
    sistema e a parte aberta em `Highlight`; o foco fica no botão da parte depois do clique;
  - a asserção das 4 abas passa a exigir as 5, com a Loja; o bloco que liga o `GEAR_ON` (se houver) continua passando.
- [ ] **Step 2: Rodar e ver falhar** — `UI_SO=itens node prototype/tools/ui-test.mjs`.
- [ ] **Step 3: Implementar.** Os ícones são mapas de texto no `interface-arte.mjs`, um por item, no tamanho dos
  ícones que a interface já usa; `node prototype/tools/moldes-test.mjs` continua passando (se ele enumera as peças
  de arte, acrescente as cinco).
- [ ] **Step 4: Rodar** — `node prototype/build.mjs`, `node prototype/tools/wiki.mjs`, `node
  prototype/tools/wiki-test.mjs`, `UI_SO=itens,reserva,acabamento,celular,texto node prototype/tools/ui-test.mjs` → OK;
  `./scripts/check.sh` → OK.
- [ ] **Step 5: Commit** — `git commit -m "abre a loja de itens e a mochila"`.

### Task 4: Usar os itens, pela mochila e pela ficha

**Files:**
- Modify: `prototype/src/game.js` (a parte Mochila; as abas Status ~2884 e Skills ~2996 da ficha; `redistribuirHtml`
  ~2759; o clique delegado), `prototype/src/game.css`
- Test: `prototype/tools/ui-test.mjs` (bloco `itens`)

**Interfaces:**
- Consumes: `Itens.podeUsar`, `usarTorrao`, `usarEstrela`, `trocarSkill`, `tentarDoma`; `itemLinhaHtml`; os campos do
  save; `podeRedistribuir` (o que existe).
- Produces:
  - `ui.item = { id, mountUid, skillId, passo, origem } | null`, com `passo` `'cavalo'` | `'skill'` | `'confirma'` e
    `origem` `'mochila'` | `'ficha'`; zerado em toda troca de tela;
  - ações: `item-usar` (`data-id`; da mochila abre a escolha do cavalo; da ficha vem com `data-mount` e vai direto à
    confirmação, ou à escolha da skill no Cupom), `item-cavalo`, `item-skill`, `item-confirmar`, `item-cancelar`;
  - a escolha do cavalo é uma subtela com as linhas do Estábulo (`mountRowHtml`), cada uma apagada com o motivo quando
    `Itens.podeUsar` recusa (padrão `indisponivel(motivo)`);
  - **Rédea nova pela mochila:** escolhe o cavalo e vai à aba Status dele, com o foco no Redistribuir; o custo é o de
    hoje (a grátis primeiro);
  - `usaItem(id, mountUid, skillId) -> 'ok' | motivo`: confere de novo (`Itens.podeUsar` com o estado atual), aplica
    numa cópia do estado, soma 1 em `state.itemCounter` nos dois sorteados, tira 1 da mochila e grava tudo de uma vez
    (`gravaGasto`); o aviso do resultado vai para a região viva e fica na tela;
  - na ficha: aba Status com "Usar Torrão de açúcar" e "Usar Estrela de treino" abaixo da lista de status, perto do
    Redistribuir, só quando `state.mochila` tem o item; aba Skills com "Usar Manual de doma" e, em cada skill das
    vagas, "Trocar", só quando há Cupom.

- [ ] **Step 1: Testes no bloco `itens`**, com a mochila cheia pela gaveta DEV e a seed do save fixa:
  - **Torrão** pela mochila e pela ficha: os pontos para distribuir sobem 1, a mochila cai 1, o cavalo mostra
    "N de 10"; no 11º o botão fica apagado com o motivo e nada é gasto;
  - **Estrela:** ★2 vira ★3 e os pontos para distribuir sobem pelo fator das estrelas; em ★3, recusado;
  - **Manual:** com a seed fixa, o resultado é o que `Itens.tentarDoma` dá para o contador (calcule no teste com os
    mesmos módulos); **Review Focus 1:** recarregue a página logo depois e veja a mesma skill (ou a mesma falha), a
    mochila com 1 a menos e `itemCounter` com 1 a mais; repita o uso e veja o contador seguinte;
  - **Cupom:** escolhe a skill, confirma, a nova fica na mesma vaga e é a que `Itens.trocarSkill` dá; a skill de tipo
    não tem botão "Trocar"; recarregar mostra o mesmo;
  - **Rédea** pela mochila: vai à aba Status do cavalo escolhido; num cavalo com a redistribuição grátis, redistribuir
    não gasta Rédea; sem a grátis, gasta 1;
  - **sala aberta:** Cupom e Manual apagados no ativo, com o motivo, na mochila e na ficha, e aceitos em outro cavalo;
    Torrão e Estrela aceitos no ativo; os pontos novos só entram até o Poder da sala (o teste de hoje dessa trava
    continua); o resultado da corrida aberta, simulado antes e depois dos usos, é o mesmo;
  - **Review Focus 4:** cada limite (99 na mochila não impede usar; 10 torrões; ★3; vagas cheias; sem candidata; sem
    skill nas vagas) mostra o motivo, sem erro de console e sem gastar;
  - **Review Focus 5:** abra a confirmação de um Manual num cavalo que não é o ativo; por outra aba (grave o save e
    dispare `storage`) faça dele o ativo com a sala aberta; "Confirmar" recusa com o motivo e a mochila não muda; o
    mesmo com o cavalo removido do save;
  - **duas abas:** o mesmo save em duas páginas; usa o Manual na primeira; na segunda, que ainda mostra o item, o
    toque em "Usar" não gasta de novo nem sorteia de novo (o mecanismo de revisão do save que já existe decide);
  - a aba Status sem itens tem a altura de hoje (o teto do teste da 3b não muda); com Torrão e Estrela na mochila,
    cresce no máximo 120 px e as 7 linhas de status continuam na primeira tela; `checkOverflow` a 360 e a 1280;
  - cancelar em qualquer passo não gasta nada e volta à tela de onde veio.
- [ ] **Step 2: Rodar e ver falhar** — `UI_SO=itens node prototype/tools/ui-test.mjs`.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `node prototype/build.mjs`, `UI_SO=itens,celular,crescimento,build,reserva,gravacao node
  prototype/tools/ui-test.mjs` → OK; `./scripts/check.sh` → OK.
- [ ] **Step 5: Commit** — `git commit -m "usa os itens no cavalo, pela mochila e pela ficha"`.

### Task 5: Recompensa diária

**Files:**
- Modify: `prototype/src/game.js` (`renderEstabulo` ~2194, a barra de abas ~1966, o clique delegado),
  `prototype/src/game.css`
- Test: `prototype/tools/ui-test.mjs` (bloco `itens`; os limites de altura do Estábulo, ~4758 e ~5403)

**Interfaces:**
- Consumes: `Itens.diariaEstado`, `Itens.resgatar`, `hojeDia()`, `itemIconeHtml`, os campos do save.
- Produces: `diariaCartaoHtml()` (o cartão no topo do Estábulo: grande com prêmio para resgatar, uma linha depois);
  as ações `diaria-resgatar` e `diaria-ver` (abre e fecha os 7 dias, no próprio cartão, `aria-expanded`); o ponto na
  aba Estábulo quando `Itens.diariaEstado(...).pode`.

- [ ] **Step 1: Testes no bloco `itens`**, a 360×780, num save novo:
  - o Estábulo abre com o cartão grande "Recompensa do dia", "1 / 7", "60 de Ouro" e o botão "Resgatar"; a aba
    Estábulo tem o ponto; tocar em Resgatar soma 60 ao saldo, o cartão vira uma linha com o prêmio de amanhã ("1 Torrão
    de açúcar"), o ponto some e a região viva diz o que entrou;
  - tocar de novo no mesmo dia não existe (sem botão) e um clique forçado na ação não muda o saldo;
  - "Avançar 1 dia" na gaveta DEV, **sem recarregar** (**Review Focus 2**): o cartão volta a ser grande, com o dia 2;
    resgatar põe 1 Torrão na mochila; os limites da loja também voltaram;
  - **Review Focus 3:** "Voltar 1 dia" depois de resgatar: sem botão, o cartão diz "volte amanhã", nada se perde;
    avançando de novo até passar do último dia, o resgate vale e o calendário segue do dia certo;
  - os 7 dias em sequência dão os prêmios da spec e o 8º resgate é o dia 1 de novo; faltar 3 dias no meio não muda o
    dia do calendário; 28 resgates: a Estrela de treino entra na mochila no 28º e não no 7º, 14º e 21º;
  - mochila com 99 torrões no dia 2: o botão fica apagado com o motivo, o calendário não anda; gastando 1, resgata;
  - "ver os 7 dias": sete células com os já resgatados marcados e o de hoje em destaque (`aria-current`); em cores
    forçadas o de hoje em `Highlight` e o cartão com borda em cor do sistema;
  - **alturas (mudança de propósito):** Estábulo de 3 cavalos ≤ 820 px com a diária resgatada e ≤ 890 px com prêmio;
    de 6 cavalos ≤ 1.140 e ≤ 1.210; as duas asserções antigas (780 e 1.100) passam a medir no estado "resgatada"
    contra 820 e 1.140; a lista de cavalos tem a mesma altura de antes nos dois estados;
  - `checkOverflow` a 360×780, 360×640 e 1280; com movimento reduzido, nada no cartão se move.
- [ ] **Step 2: Rodar e ver falhar** — `UI_SO=itens node prototype/tools/ui-test.mjs`.
- [ ] **Step 3: Implementar.** O dia só é conferido ao desenhar a tela; sem temporizador.
- [ ] **Step 4: Rodar** — `node prototype/build.mjs`, `UI_SO=itens,celular,acabamento,texto,areasegura node
  prototype/tools/ui-test.mjs` → OK; `./scripts/check.sh` → OK.
- [ ] **Step 5: Commit** — `git commit -m "põe a recompensa diária no topo do Estábulo"`.

### Task 6: Documentos, folha, capturas, balanço completo e memória

**Files:**
- Modify: `docs/GDD.md` (§8.2 e seção nova da diária), `docs/memoria/ESTADO.md`, `docs/memoria/decisoes.md`,
  `prototype/tools/folha-interface.mjs`, `prototype/tools/ui-test.mjs` (as capturas novas e o teste da folha),
  `prototype/screens/*.png`

- [ ] **Step 1: Documentos.** GDD §8.2: os cinco itens como estão no jogo (versões por Ouro e jogando), com os números
  e o Manual como tentativa na hora; a Rédea nova deixa de ser "só pela gaveta DEV"; seção curta da recompensa diária.
  `decisoes.md`: as decisões da execução (marcadas "(controlador)"). `ESTADO.md`: a frente pronta na
  `claude/itens-loja-diaria`, sem merge; a lista "A confirmar com o Vinicius (gosto, itens)"; a pendência do relógio
  para a frente; as contagens do `check.sh` da sua execução; os próximos passos (ginásios). Nada sobre artefatos.
- [ ] **Step 2: Folha da interface** — seções com o produto da loja (nos quatro estados do botão), a linha da mochila
  (com e sem o item) e o cartão da diária (grande e de uma linha), com a marcação do jogo; o teste da folha no bloco
  `acabamento` cobre as seções novas.
- [ ] **Step 3: Balanço completo** — `node prototype/tools/balance.js` (~2,5 min) → todas as metas; anote no
  `ESTADO.md` que rodou.
- [ ] **Step 4: Capturas** — três capturas novas no fluxo completo do `ui-test`: `final-20-loja.png`,
  `final-21-mochila.png` e `final-22-diaria.png` (o Estábulo com o cartão grande); `node prototype/tools/ui-test.mjs`
  sem `UI_SO` regrava `prototype/screens/`; diga quais mudaram e por quê.
- [ ] **Step 5: Verificação** — `./scripts/check.sh` → `VERIFICAÇÃO COMPLETA: OK`.
- [ ] **Step 6: Commit** — `git commit -m "atualiza documentos, folha, capturas e memória dos itens e da diária"`.
- [ ] **Step 7 (controlador):** republicar o build de teste e a folha da interface.

---

## Onde o código está hoje (HEAD a5c33cc; os números de linha mudam a cada tarefa: procure pelo nome)

- **Estrelas:** `mount.grau` 1–3; `RaceSim.starsOf` (`sim.js` ~356); `T.starMult [1, 1.09, 1.22]`.
- **Pontos:** `RaceSim.freePoints(horse)` (`sim.js` ~369); gastos em `mount.alloc`; `sanitizeMount` (`game.js` ~701)
  copia campo a campo: campo novo do cavalo tem de entrar lá.
- **Rédea:** `state.redeas` 0–999 (`REDEAS_MAX`), `mount.respecFree`; `podeRedistribuir` (~2745); case
  `'redistribuir'` (~4776); `redistribuirHtml` (~2759).
- **Skills:** vagas por raridade (`skillSlots`); skill de tipo fora das vagas (`GameData.TYPE_SKILLS`);
  `applyXp` (~974) e `RaceSim.learnSkill` (`sim.js` ~502), `learnChance 0.08`.
- **Ouro:** `podeGastar(valor)`, `ouroReservado()`, `ouroLivre()` (~2108); `gravaGasto(s0, antes)` (~476).
- **Loja de hoje:** `renderLoja` (~3056), `LOJA_TABS`, cases `'loja-tab'`, `'comprar'`, `'comprar-pedra'` (~4665);
  escondida por `GEAR_ON = false` (~64), pelo filtro de `ABAS` (~1295, numa linha só: o wiki lê por regex) e por
  `ACOES_EQUIP` (~4646).
- **Save:** `SAVE_VERSION 6`; `newState` (~596); `sanitize` (~740) descarta campo desconhecido; `state.items` é das
  peças de equipamento. Sem guarda para versão maior.
- **Padrões de tela:** `indisponivel(motivo)`, `mostraMotivo`/`tiraMotivo`, `#motivo-vivo`; `mountRowHtml`;
  `MONTARIA_ABAS`; `.subabas` com `.btn.opcao.opcao--centro`; o ponto da aba Correr.
- **Gaveta DEV:** `devEntrada`/`devBotao`/`devGrava` (~1588–1735).
- **Wiki:** `descreverAba` lança em aba nova; a cobertura do `wiki-test.mjs` é uma lista fixa; `GD.HELP` é vigiado.
- **Testes:** `sim-test.js` já carrega `data.js`, `sim.js`, `breed.js` e `gear.js`; o `ui-test.mjs` filtra blocos por
  `UI_SO`; rodar o `ui-test.mjs` sem `UI_SO` regrava `prototype/screens/`.
