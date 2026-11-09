# Bugs e pendências menores

Achados que **podem esperar** (triagem da revisão final da frente "corrida viva e modo DEV",
2026-11-09). Nenhum quebra regra de design. Um por linha, com o arquivo; ao resolver, apague a linha
(e registre em `decisoes.md` se virar decisão).

## Modo DEV
- "Carregar a ativa" põe o potencial em "Máximo" e "Aplicar" troca a base pelo `baseLo` da raridade — `prototype/src/game.js` (`devCavaloDaAtiva`, `dev-aplicar`).
- A gaveta tem um potencial só para todos os status, mas `Dev.horseTemplate` aceita por status — `prototype/src/game.js` (gaveta) e `prototype/src/dev.js`.
- A seção DEV ocupa ~414 linhas do `game.js` (separar se o protótipo continuar) — `prototype/src/game.js`.
- O redesenho assíncrono da gaveta (moldes chegando, outra aba) apaga texto digitado e não confirmado — `prototype/src/game.js` (`renderDev`).

## Simulação
- O hash de referência das 20 corridas não cobre `racerInfo`, `conditions`, `weatherFinal` e `duration` (o teste do objeto inteiro cobre) — `prototype/tools/sim-test.js`.

## PixelLab
- O script conta HTTP 502 como geração cobrada (corrigir antes da próxima geração paga) — `prototype/tools/pixellab-moldes.mjs`.
- A referência de passada de chamas não tem piso fixo (`passadaRef ≥ 30`) — `prototype/tools/moldes-test.mjs`.
- Metade dos montados de corrida saiu sem a pele do jóquei — `prototype/assets/pixellab/molde-*-galope-*.png`.
- Crina própria de cada estilo no galope (precisa de um quadro-guia por estilo, ~6–10 gerações) — `prototype/tools/pixellab-moldes.mjs`.

## Dado da Sorte na pista
- Os dados extras aparecem em cinza depois de um traço (pouco legível) — `prototype/src/fx.js` (`drawDice`).
- `layoutBadges` não tem histerese (a plaquinha pode pular entre posições) — `prototype/src/fx.js`.
- A instrumentação `_stats.placas` virou dado funcional (obstáculo dos balões) — `prototype/src/game.js` e `prototype/src/fx.js`.
- O desenho do Dado não tem teste no Node — `prototype/tools/fx-test.js`.
- `stripLayout` roda 2× por quadro e o cubo girando custa 81 `fillRect` — `prototype/src/fx.js` e `prototype/src/game.js`.
- `JANELA_MS` conta amostras, não milissegundos — `prototype/src/fx.js`.
- Halo e faíscas do vencedor passam da caixa da plaquinha — `prototype/src/fx.js` (`drawDice`).
- A faixa "DADO DA SORTE" cobre o "◀VOCÊ" em 844×390 — `prototype/src/fx.js` (`stripLayout`) e `prototype/src/game.js`.

## Skills visíveis
- No desvio, o balão pode ir para baixo e perder a ordem da pilha — `prototype/src/fx.js` (`layoutBadges`) e `prototype/src/game.js`.
- No layout compacto, selo de clima, "FOTO DE CHEGADA" e etiquetas "Nº" não são obstáculos dos balões — `prototype/src/game.js`.
- O clamp do balão na borda direita roda depois do desvio (pode sobrepor o anterior) — `prototype/src/game.js`.
- A lista `cavalos[]` é recalculada a cada balão — `prototype/src/game.js`.

## Natureza e vento
- Teto de 240 pingos: em 1280 há menos pingos que antes (cada um mais forte) — `prototype/src/fx.js` (`NATUREZA`).
- `msQuadro` não mede a rasterização (só o tempo do JavaScript do desenho) — `prototype/src/fx.js` (`endFrame`) e `prototype/src/game.js`.
- O selo do vento em texto (layout largo) não tem teste — `prototype/tools/ui-test.mjs`.
- O ícone do vento na paisagem compacta não tem captura — `prototype/tools/ui-test.mjs`.
- O CSS de movimento reduzido depende do JavaScript até o 1º render — `prototype/src/game.css` e `prototype/src/game.js`.
- A poeira das folhas e a da subida ainda são creme, parecidas com a areia — `prototype/src/fx.js` e `prototype/src/game.js`.
- A chave `galope-elemental:*:animacoes` pode ficar velha se o save nascer por outro caminho (inofensivo) — `prototype/src/game.js` (`MOTION_KEY`).

## Curvas e HUD
- O HUD mais alto (minimapa) encolhe as raias em telas de altura média (360×740: raia 22 → 20) — decisão de layout a rever com o Vinicius — `prototype/src/game.js`.
- Na areia, reta e subida têm cores quase iguais no minimapa — `prototype/src/fx.js` (`drawMiniMap`).
- O minimapa é redesenhado a cada quadro (dá para cachear o traçado) — `prototype/src/fx.js` e `prototype/src/game.js`.
- O véu translúcido do minimapa deixa o fundo vazar — `prototype/src/game.js`.
- Em 1280 aparecem até 5 placas "CURVA" ao mesmo tempo na cerca — `prototype/src/sprites.js` (`drawTrack`).
- No layout compacto as placas da cerca ficam sob o HUD — `prototype/src/sprites.js` e `prototype/src/game.js`.

## Desempenho
- O ui-test não tem teto absoluto de `msQuadro` (o Dado a 1280 custa ~9,7 ms por causa do relevo da subida); o valor da corrida de chuva com ventania sai na última linha do ui-test — `prototype/tools/ui-test.mjs`.

## Dados do jogo (achados ao gerar o wiki, 2026-11-09)
- Sol a Pino, Pé na Chuva e Névoa Amiga dizem que o bônus do clima é "dobrado", mas o código leva de ×1,03 para ×1,10 — `prototype/src/data.js` (descrições) e `prototype/src/sim.js` (`weatherMultDouble`).
- `bornSkills` está comentado como "máximo ao nascer", mas o cruzamento usa como mínimo (completa até esse número, limitado às vagas) — `prototype/src/data.js` (comentário) e `prototype/src/breed.js`.
- Prêmio com 4 corredores e entrada 100 paga 251 + 109 em vez de 252 + 108 (arredondamento de ponto flutuante em 360 × 0,7) — `prototype/src/sim.js` (`payouts`).
- O bônus de 4 peças só age se o elemento da montaria for o dono do clima do conjunto; o cabeçalho não diz isso — `prototype/src/gear.js` (cabeçalho) e `prototype/src/sim.js` (`applyWeather`).
- A peça Rara e a Lendária do mesmo slot e conjunto têm o mesmo nome (ex.: "Ferraduras do Sol") — `prototype/src/data.js` (`GEAR`).
- Sprint, Nascente e Raízes Firmes dizem "numa reta", mas o gatilho exige reta de 150 m ou mais e ignora a da largada — `prototype/src/data.js` (descrições).
- A calculadora do Haras fala em Mítico "só por despertar", recurso que não existe no protótipo — `prototype/src/game.js`.
- A tabela de pesos de gatilho do Poder não é exportada; um gatilho novo sem peso vale 1 sem aviso — `prototype/src/sim.js` (`skillWeight`).
