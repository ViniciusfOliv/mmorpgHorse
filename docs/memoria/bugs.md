# Bugs e pendências menores

Achados que **podem esperar**. Nenhum quebra regra de design. Um por linha, com o arquivo; ao resolver,
apague a linha (e registre em `decisoes.md` se virar decisão). O que depende de servidor ou de
empacotamento está em `docs/cronograma.md`; as decisões de design em aberto, em `docs/exemplos.md` §5.

## Desempenho da corrida
- **Corrigido em 2026-11-24 (subidas engasgando no celular):** a hachura diagonal das subidas era pintada com ~19
  preenchimentos por padrão (`createPattern`) com a origem deslocada, e o relevo lia o buffer do quadro no meio dele
  (`deslocaFaixa`). No S24 FE (WebView, GPU), a seção custava 3,5–4,2 ms em média e até 20–28 ms por quadro numa subida
  (no contêiner, sem GPU, quase nada; as baterias de 19/11 nunca chegavam a uma subida). Agora a hachura é colada de uma
  tira pré-desenhada (`hachuraTira`) e o relevo desenha a pista numa tela à parte (`telaFora` + `compoeRelevo`): o mesmo
  desenho, pixel a pixel (0,06 ms no aparelho). O bloco `teto` do `ui-test` compara os dois jeitos e falha com
  leitura do buffer no meio do quadro ou preenchimento por padrão no laço — `prototype/src/sprites.js` (`hachura`,
  `drawTrack`).
- (resolvido junto) as tiras da hachura são montadas no 1º quadro da corrida (a contagem) e a cada troca de clima, não no
  1º quadro de uma subida, onde custavam ~28 ms no aparelho — `prototype/src/sprites.js` (`drawTrack`, `hachuraTira`).

## Modo DEV
- O redesenho assíncrono da gaveta (moldes chegando, outra aba) apaga texto digitado e não confirmado — `prototype/src/game.js` (`renderDev`).

## Simulação e balanço
- O hash de referência das 20 corridas não cobre `racerInfo`, `conditions`, `weatherFinal` e `duration` (o teste do objeto inteiro cobre) — `prototype/tools/sim-test.js`.
- As metas M6, M9, P1, S1 e A1 só contam no `balance.js` completo; o `check.sh` usa o rápido — `prototype/tools/balance.js`.
- O Poder ainda pontua Sorte e Dado Viciado, que não rendem vitória (espera as decisões de `docs/exemplos.md` §5) — `prototype/src/sim.js`.
- `validSkills` repete as regras de `learnSkill`, e `Gear.ratingPts` repete os pontos de conjunto de `powerRating` — `prototype/src/game.js`, `prototype/src/gear.js`, `prototype/src/sim.js`.

## Save
- Quem apaga `pending.gear` e **aumenta** o Poder no save troca peças com a sala aberta (os rivais ficam mais fortes na mesma medida); só o servidor fecha. O caminho inverso (retrato rebaixado à mão para atrair rivais mais fracos que o próprio cavalo) está fechado desde a R16: o Poder da sala nunca fica abaixo do da ativa. Editar o retrato (`pending.gear` ou `pending.alloc`) ainda refaz os rivais da mesma sala, sempre do Poder do cavalo para cima; isso só o servidor fecha — `prototype/src/game.js` (`sanitize`).

## Itens, loja e diária
- O "Voltar" do aparelho com um passo de item aberto pela Mochila sai do jogo em vez de fechar o passo (aberto pela ficha, volta ao Estábulo); nada é gasto. Fica para o empacotamento — `prototype/src/game.js` (histórico, `popstate`).
- O saneamento dos dados de dia (dia ou limite estragado não libera nada) existe em dois lugares, e a frase "Você não tem …" também; `Itens.podeUsar` devolve a frase pronta e `Itens.podeComprar` devolve um código (para o servidor, código é melhor) — `prototype/src/game.js` (`sanitize`, bloco da v7, e o `item-usar` do clique) e `prototype/src/itens.js` (`diariaSaneada`, `lojaSaneada`, `podeUsar`).
- Não provado: depois de um toque recusado, o foco pode ir para o primeiro "Trocar" quando o cavalo tem duas ou mais skills (`rerenderKeepScroll` só distingue o botão pelo `data-id`) — `prototype/src/game.js`.
- O motivo da Estrela num cavalo ★★★ tem "★★★" escrito fixo no texto (não sai do número de estrelas) — `prototype/src/itens.js`.
- O "Sim" do Recomeçar grava as chaves auxiliares (animações e jóquei) antes de o `wipeSave` recusar um save de versão mais nova (inócuo: o save não é tocado) — `prototype/src/game.js` (`reset-sim`).
- Sem teste (provados certos pelas sondas da revisão final): o corte do deslocamento de ±400 dias do modo DEV; o save de versão mais nova chegando de outra aba com a corrida na tela ou a confirmação aberta; a tela velha com "Comprar" e a regra recusando no toque; a loja de peças dentro da parte Comprar com `GEAR_ON = true` — `prototype/tools/ui-test.mjs`.
- Se o dia vira com o campo "Renomear" da ficha aberto, a atualização da tela perde o texto digitado e o foco (os redesenhos que já existiam, como os moldes chegando, têm o mesmo efeito) — `prototype/src/game.js` (`redesenhaDia`).

## Ginásios da Expedição
Achados pequenos das revisões das tarefas (2026-11-17 e 18), deixados para depois; nenhum cobra Ouro errado nem dá prêmio
duas vezes. A revisão final da frente foi feita em 2026-11-18; o defeito que ela achou está consertado (o primeiro item).
- **Consertado (2026-11-18, revisão final):** a gravação que falhava somava a revisão do save (`state.rev`) mesmo sem gravar,
  e a revisão da memória ficava à frente da do disco. Reprodução: a aba A falha 2 vezes ao gravar; a aba B paga o Recruta
  com o Ipê e perde; A toca em "Desafiar" com a Maré e grava por cima do save de B (a entrada de B voltava, o XP do Ipê
  sumia e o mesmo sorteio era usado de novo com outro time). O mesmo valia para "Largar!" e o uso de um item. Conserto:
  a gravação que falha devolve a revisão de antes, e o aviso da falha sai do preparo quando o save de outra aba é adotado.
  Testes: `ginasio-falha-outra-aba`, `gravacao-outra-aba` e `itens-falha-outra-aba` — `prototype/src/game.js` (`persist`,
  `adoptExternal`).
- Com o preparo do líder aberto (antes da insígnia), se outra aba conquista a insígnia, o preparo vira o da revanche sem voltar à trilha (nada é cobrado errado; foge do padrão "o progresso andou, volta à trilha") — `prototype/src/game.js` (`renderGinasio`).
- `ginRevPremio` cai em `{}` se `Ginasio.revanchePremio` devolver `undefined`, e a tela diria "Prêmio de hoje: 0 de Ouro" (não acontece com o save saneado; esconderia um erro) — `prototype/src/game.js`.
- Caminho que não acontece hoje: com o duelo sem corrida (`ui.gym.ver.L` nulo), um `go('corrida')` leva à aba Correr sem limpar `ui.gym.ver` — `prototype/src/game.js` (`go`, `corridaAtual`).
- `renderGinasio` tira do time, enquanto desenha, o cavalo que saiu do save (seria melhor no `adoptExternal`) — `prototype/src/game.js`.
- A gravação que falha no "Desafiar" aparece num aviso com `role="status"` e também na região viva: o leitor de tela pode ler duas vezes — `prototype/src/game.js` (`etapaDesafiarHtml`, ação `ginasio-desafiar`).
- O texto do bônus das insígnias existe em dois lugares (`ginBonusTxt` no jogo e `bonusIns` no wiki): um tipo novo de insígnia pede mudar os dois — `prototype/src/game.js`, `prototype/tools/wiki.mjs`.
- `Ginasio.cavalo` não confere o nível nem as estrelas que recebe (só o catálogo chama) — `prototype/src/ginasio.js`.
- A família de ícones "reservado" passou a se chamar "Reservados (Rédea e Gema) e insígnias dos ginásios" e mistura duas coisas — `prototype/tools/icones-catalogo.mjs`.
- Sem teste: o relógio do navegador voltando para trás na tela da revanche (só o "Voltar 1 dia" da gaveta DEV e o módulo); dia de revanche estragado chegando de outra aba junto com um save de versão 9 — `prototype/tools/ui-test.mjs`.
- No `sim-test.js`, a conferência das distâncias exatamente no limite do cansaço (feita para os limites antigos de 5 e 20 m) se desligou com os limites novos; o limite exato (8,0 m) só está nas asserções genéricas — `prototype/tools/sim-test.js`.
- No `balance.js`, a G4 mede só os dois elementos "de fora" contra o do ginásio (o rótulo não diz), a G6 é somada por ginásio (por etapa também passa: nenhuma faixa abaixo de 17%) e o detector da G9 não procura `Date.parse` nem `Date.UTC` — `prototype/tools/balance.js`.

## PixelLab
- O script conta HTTP 502 como geração cobrada (corrigir antes da próxima geração paga) — `prototype/tools/pixellab-moldes.mjs`.
- A referência de passada de chamas não tem piso fixo (`passadaRef ≥ 30`) — `prototype/tools/moldes-test.mjs`.
- Metade dos montados de corrida saiu sem a pele do jóquei — `prototype/assets/pixellab/molde-*-galope-*.png`.
- Crina própria de cada estilo no galope (precisa de um quadro-guia por estilo, 6 a 10 gerações) — `prototype/tools/pixellab-moldes.mjs`.

## Dado da Sorte na pista
- Os dados extras aparecem em cinza depois de um traço (pouco legível) — `prototype/src/fx.js` (`drawDice`).
- `layoutBadges` não tem histerese (a plaquinha pode pular entre posições) — `prototype/src/fx.js`.
- A instrumentação `_stats.placas` virou dado funcional (obstáculo dos balões) — `prototype/src/game.js` e `prototype/src/fx.js`.
- O desenho do Dado não tem teste no Node — `prototype/tools/fx-test.js`.
- `JANELA_MS` conta amostras, não milissegundos — `prototype/src/fx.js`.
- Halo e faíscas do vencedor passam da caixa da plaquinha — `prototype/src/fx.js` (`drawDice`).
- A faixa "DADO DA SORTE" cobre o "◀VOCÊ" em 844×390 — `prototype/src/fx.js` (`stripLayout`) e `prototype/src/game.js`.

## Skills visíveis
- No desvio, o balão pode ir para baixo e perder a ordem da pilha — `prototype/src/fx.js` (`layoutBadges`) e `prototype/src/game.js`.
- No layout compacto, selo de clima, "FOTO DE CHEGADA" e etiquetas "Nº" não são obstáculos dos balões — `prototype/src/game.js`.
- O clamp do balão na borda direita roda depois do desvio (pode sobrepor o anterior) — `prototype/src/game.js`.

## Natureza, curvas e HUD
- O selo do vento em texto (layout largo) não tem teste e o ícone do vento na paisagem compacta não tem captura — `prototype/tools/ui-test.mjs`.
- O CSS de movimento reduzido depende do JavaScript até o 1º render — `prototype/src/game.css` e `prototype/src/game.js`.
- A poeira das folhas e a da subida ainda são creme, parecidas com a areia — `prototype/src/fx.js` e `prototype/src/game.js`.
- O HUD mais alto (minimapa) encolhe as raias em telas de altura média (360×740: raia 22 → 20): decisão de layout a rever com o Vinicius — `prototype/src/game.js`.
- Na areia, reta e subida têm cores quase iguais no minimapa, e o véu translúcido deixa o fundo vazar — `prototype/src/fx.js` (`drawMiniMap`) e `prototype/src/game.js`.
- Em 1280 aparecem até 5 placas "CURVA" ao mesmo tempo na cerca, e no layout compacto elas ficam sob o HUD — `prototype/src/sprites.js` (`drawTrack`).
- Quando a subida começa dentro da tela, a hachura anda ao dobro da velocidade da câmera — `prototype/src/sprites.js`.

## Desempenho
- A primeira cópia do relevo das subidas obriga o navegador a rasterizar o quadro no meio do desenho: é o maior custo que sobra com subida na tela — `prototype/src/sprites.js` (`deslocaFaixa`).
- Em densidade 2 o canvas segue grande quando a escala dos moldes não deixa reduzir (2240×1248 em 1280×800) — `prototype/src/game.js`.
- O teste de interface leva ~6 min; há contextos que reabrem a mesma página (candidatos: `curvas-paisagem`, `skills390-reduzido` e o trio em 1280×800) — `prototype/tools/ui-test.mjs`.

## Arquivos e configuração
- `prototype/comparativo.html` e `prototype/dist/moldes.js` só servem para revisar moldes: apagar quando a arte dos moldes fechar.
- As capturas `final-*` de `prototype/screens/` são versionadas e quase nenhum documento as cita: decidir se continuam no Git.
- `.claude/settings.json` não libera `fx-test.js`, `moldes-test.mjs`, `wiki-test.mjs` e `wiki.mjs`, listados no `CLAUDE.md` §4 (liberar permissão é decisão do Vinicius).
