# Bugs e pendências menores

Achados que **podem esperar**. Nenhum quebra regra de design. Um por linha, com o arquivo; ao resolver,
apague a linha (e registre em `decisoes.md` se virar decisão). O que depende de servidor ou de
empacotamento está em `docs/cronograma.md`; as decisões de design em aberto, em `docs/exemplos.md` §5.

## Modo DEV
- O redesenho assíncrono da gaveta (moldes chegando, outra aba) apaga texto digitado e não confirmado — `prototype/src/game.js` (`renderDev`).

## Simulação e balanço
- O hash de referência das 20 corridas não cobre `racerInfo`, `conditions`, `weatherFinal` e `duration` (o teste do objeto inteiro cobre) — `prototype/tools/sim-test.js`.
- As metas M6, M9, P1, S1 e A1 só contam no `balance.js` completo; o `check.sh` usa o rápido — `prototype/tools/balance.js`.
- O Poder ainda pontua Sorte e Dado Viciado, que não rendem vitória (espera as decisões de `docs/exemplos.md` §5) — `prototype/src/sim.js`.
- `validSkills` repete as regras de `learnSkill`, e `Gear.ratingPts` repete os pontos de conjunto de `powerRating` — `prototype/src/game.js`, `prototype/src/gear.js`, `prototype/src/sim.js`.

## Save
- Quem apaga `pending.gear` e **aumenta** o Poder no save troca peças com a sala aberta (os rivais ficam mais fortes na mesma medida); só o servidor fecha. O caminho inverso (retrato rebaixado à mão para atrair rivais fracos) está fechado desde a R16: o Poder da sala nunca fica abaixo do da ativa — `prototype/src/game.js` (`sanitize`).

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
