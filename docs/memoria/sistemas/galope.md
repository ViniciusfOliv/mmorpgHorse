# Galope: teste de intensidade (2026-11-16)

**Estado:** encerrado. O Vinicius viu o teste e decidiu em 2026-11-16 manter o galope como está ("vamos para próximos
passos mais importantes"). Nada disto está no jogo. Se o assunto voltar, é pedido novo (passa pelo desenho, com testes);
o caminho que sobra para um galope mais intenso é a 2c, com quadros novos.

- **Pedido dele:** "Os cavalos poderiam ter uma animação de corrida mais intensa, às vezes parecem trotes, e não um
  esforço para vencer" e "O galope das pernas, elas devem ser mais intensas e espaçadas. Faça um teste."
- **Página do teste (artefato privado):** https://claude.ai/artifact/JUTm5mf3SwbvgDENeVAEeA — o galope de hoje ao lado
  de uma versão ajustável (ritmo das pernas, abertura das pernas, balanço do corpo, tempo dos quadros), nos três
  portes, com câmera lenta e x2. Usa cópias sem alteração do desenho do jogo; sem créditos.
- **A página e os scripts que a montam não estão no repositório** (ficaram na pasta temporária da sessão). A receita
  abaixo basta para refazer o efeito dentro do jogo.
- **Resumo do que o teste mostrou:** o ganho com os quadros de hoje é moderado (as pernas chegam mais longe; tronco,
  pescoço e coxas continuam iguais). O "trote" mais forte é na câmera lenta. Para ir além, só com quadros novos (a 2c,
  com créditos do PixelLab).

As notas do teste seguem como foram escritas; os caminhos de arquivo citados nelas são da pasta temporária.

---


Página: `galope-teste.html` (372 KB, autocontida). Nada mudou no repositório.
Montagem: `../galope-teste-ferramentas/monta.mjs` embute **cópias sem alteração** de `prototype/src/data.js`,
`sim.js` (o `marcas.js` usa o `RaceSim.hash2`), `marcas.js`, `sprites.js` e `prototype/dist/moldes.js`, e o
`pagina.html` (o código do teste). Capturas: `captura.mjs` (Playwright, 390×844, dpr 2).

## Como o "Hoje" é desenhado (igual ao jogo)
- `Sprites.drawHorse(ctx, x, y, { palette, element, frame, scale, silks, marcas, semente, joquei, porte, idle:false })`,
  com `frame` = a fase contínua do jogo (`quadroGalope`: índice = floor((frame mod 6) × 9 / 6)).
- Desenhado com `scale: 1` (molde em S = 1) num canvas em resolução de arte e ampliado por vizinho mais próximo
  (≈ 4 px CSS por px de arte). Pixel a pixel é o mesmo desenho do jogo em S inteiro. A sombra também é a do jogo.
- Cadência: a fórmula do `game.js`: fase += dt × 14 × (v / 17) (`GALOPE_QPS`, cadência "meio") × (x2 ? 1,3 : 1) × max(0,35, slowK).
- O chão rola como na corrida: v × ts × px/m × (x2 ? 2 : 1) × slowK, com ts ≈ 3,3 (1000 m) e ~3 px de arte por
  metro (aproximação: o jogo usa ppmArt = 2 no celular em unidades do sprite por código).
- Fora do teste: faíscas/brilho de raridade, rastro do Mítico, aura de skill, poeira (não mexem com as pernas).

## Como o "Teste" abre as pernas (para refazer no jogo)
Tudo por quadro, uma vez (cache), sobre o quadro 1× já pintado (cavalo + jóquei + marcas juntos, saído do próprio
`drawHorse` com `shadow:false`). Só move pixels inteiros: sem escala, sem borrão, sem meio-alfa.
1. **Linha da barriga**: desce da sela enquanto o corpo ocupa ≥ 60 % das colunas entre a anca (rear.x + 6) e o
   peito (saddle.x + 10). Se parar acima de `footY − 0,30·bbox.h − 2` (a linha do `marcas.js`; acontece no
   esguio por causa do jóquei), usa essa linha. Abaixo dela = região das pernas.
2. **Pernas**: componentes 8-conexas dos pixels opacos abaixo da barriga. Lado pela linha onde a componente prende
   (2 linhas de cima): à esquerda de `saddle.x − 3` = traseira, senão dianteira. Componente presa dos dois lados
   (pernas encostadas) é partida nessa coluna. Pedaço com < 8 px (casco ou perna de longe cortada pela de perto)
   vai com a perna grande mais próxima — sem isso sobravam ilhas escuras soltas.
3. **Quanto cada perna já estica** = (x médio das 2 linhas de baixo − x médio das 2 de cima) no sentido do lado
   (dianteira: para a frente; traseira: para trás). Perna dobrada no sentido contrário = 0 (não mexe).
4. **Cisalhamento por linha**: cada linha da perna anda `lado × round(A × estica × (y − barriga) / (pé − barriga))`
   px; A = Abertura (100 % = a perna estica o dobro do que já estica). Na barriga o deslocamento é 0, então a
   perna nunca descola do corpo; o casco anda inteiro (fica nítido). Desenho: corpo e traseiras, depois dianteiras.
   Assim a pose recolhida continua recolhida e as esticadas esticam mais — mais amplitude, não um cavalo largo.
   (A 1ª versão usava um "quanto o quadro está aberto" pela distância entre cascos; no esguio esse número oscila
   e só 2 quadros mexiam, por isso troquei para o ângulo de cada perna.)
5. **Balanço do corpo** (0–2): repete `round(b × e)` vezes a coluna `rear.x + 0,35·(saddle.x − rear.x)` (atrás do
   jóquei), alongando o corpo nas poses abertas (e = abertura relativa do quadro pelos cascos, 0–1), e sobe o
   quadro `round(b × s)` px nos quadros de cascos mais altos (s pelo footY da âncora). A sombra fica no chão.
6. **Tempo dos quadros** (0–100 %): peso de cada quadro = 1 + 2·a·x − 0,5·a·(1 − x), com x = |2e − 1| (1 nas
   poses mais abertas/fechadas). O ciclo dura o mesmo; muda só quanto cada pose fica na tela.

## Onde quebra / tetos
- **Abertura**: até 100 % fica íntegro nos 3 portes. Em 150 % as patas viram palitos finos e compridos (dianteira do
  padrão no quadro 3, perna sob a barriga do robusto no quadro 5): teto do controle em **120 %**.
- **Balanço**: 2 = corpo pulsando 2 colunas e pulo de 2 px, sem rasgar (visto no quadro parado, padrão-água). Não testei acima de 2; teto 2 porque o pedido era 1–2 px.
- **Ritmo**: não quebra pixel nenhum (só muda o relógio); não avaliei em movimento real acima de 1,25× — com 9 quadros, ritmos altos devem parecer tremidos, vale o Vinicius olhar.
- Nos 9 quadros a pose recolhida dura só 2 quadros (no padrão-chamas, 4 e 5); o resto já é "aberto".

## Cadência medida (fórmula de hoje; 1 passada = os 9 quadros = 6 unidades de fase)
| Velocidade | x1 | x2 (×1,3) | câmera lenta 0,3 (vira 0,35) | Dado 0,4 |
|---|---|---|---|---|
| 50 km/h | 0,565 s · 1,77/s | 0,435 s · 2,30/s | 1,61 s · 0,62/s | 1,41 s · 0,71/s |
| 55 km/h | 0,514 s · 1,95/s | 0,395 s · 2,53/s | 1,47 s · 0,68/s | 1,28 s · 0,78/s |
| 60 km/h | 0,471 s · 2,12/s | 0,362 s · 2,76/s | 1,35 s · 0,74/s | 1,18 s · 0,85/s |

Galope real ≈ 2,2–2,5 passadas/s. Multiplicador em x1: 50 km/h 1,24–1,41×; 55 km/h 1,13–1,28×; 60 km/h
1,04–1,18×. **~1,25×** põe 55 km/h em 2,43/s. Observações: em x2 o jogo já passa disso; o "trote" mais forte é na
câmera lenta (0,6–0,85 passada/s com o chão também lento) — lá o ritmo pesa mais que em qualquer outro lugar.
Outra coisa: o chão anda ~3,3× mais rápido que o tempo real (replay comprimido), mas as pernas seguem o tempo
real, então a cada passada o chão corre bastante — o cavalo "desliza" um pouco; mais ritmo ajuda também nisso.

## Recomendação ("Tudo junto")
Ritmo 1,25× · Abertura 100 % · Balanço 1 · Tempo 40 %.
- Melhorou: as dianteiras chegam mais longe e as traseiras empurram mais para trás nas poses abertas; o ciclo fica
  mais rápido e segura um pouco a extensão — lê mais como esforço. Nada rasga: jóquei, marcas e crina/cauda do
  elemento vêm no mesmo quadro e andam juntos.
- Continua igual: as coxas/antebraços, a cabeça e o pescoço (o transform só inclina a parte de baixo da perna);
  a pose recolhida é a mesma; na pelagem escura (Fogo, robusto) a diferença é pequena porque as pernas se
  confundem com a sombra.
- Para ir além (cabeça e pescoço trabalhando, garupa contraindo, perna dobrando no joelho, fase de suspensão
  clara) precisa de quadros novos: o ideal seria um ciclo de 10–12 quadros desenhado com mais amplitude. Este
  transform serve como passo barato agora (é só um cache por cavalo na largada, igual ao `prepararCavalo`).
