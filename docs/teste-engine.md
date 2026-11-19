# Teste de engine: web × Godot 4

_2026-11-19 · branch `claude/teste-engine` · spike descartável em `prototype/spike/` (não vira código do jogo)._

**Pergunta:** a base web atual (HTML/CSS/JS puro, canvas 2D) aguenta uma corrida no nível visual que queremos para o
lançamento, com FPS estável em Android fraco? Ou vale migrar para Godot 4? (A Unity já foi descartada na análise
anterior.)

**Resposta curta:** o JavaScript da corrida cabe com folga. O custo está em **rasterizar o canvas em alta resolução**,
e isso se resolve barato na web, desenhando em escala 3× e deixando o navegador ampliar, sem perder um pixel do visual.
Recomendação: **ficar na web**, se o celular passar no critério da seção 6. O número do celular ainda falta: está
pendente com o Vinicius.

## 1. O que foi montado

`prototype/spike/engine.html` (554 KB, gerado por `node prototype/spike/gerar-engine.mjs`) roda uma corrida sintética
de 60 s com o **código de desenho real do jogo**. `sprites.js`, `fx.js`, `marcas.js`, `data.js` e `sim.js` vão
embutidos sem alteração; o `sim.js` entra só pelo hash das marcas e as posições são funções do tempo. Por cima disso
vêm as camadas que o jogo ainda não tem:

| Camada | Do jogo (código real) | Extra do spike (ambição do lançamento) |
|---|---|---|
| Cavalos | 6, 12 ou 20 moldes PixelLab recoloridos, galope animado, marcas, jóquei, porte, efeitos de raridade (Mítico com rastro) | — |
| Cenário | `drawTrack`: céu, 3 serras, arquibancada, cerca, raias, curvas arqueadas, subidas | 3 faixas de parallax em bitmap (serra com neve, bosque, primeiro plano que passa na frente) |
| Partículas | poeira dos cascos, chuva, névoa, sol, folhas e poeira do vento em ventania | torrões de terra por cavalo e **explosão de skill** (58 partículas + anel) em 3 a 5 cavalos a cada 2 s |
| Skills | aura da skill de tipo, contorno da silhueta, vento, "+" e faíscas, rastro, balões com ícone PNG, "CANSOU" | — |
| Câmera | segue o jogador a 48% | zoom contínuo de 1,0 a 1,14 e **tremida** nas explosões (o mundo vai para um canvas e é ampliado na tela) |
| HUD | posição, estamina, relógio, clima, minimapa, "◀VOCÊ" e a faixa de ordem em DOM (innerHTML a cada 250 ms, como o jogo) | — |

O clima alterna entre sol, chuva e névoa a cada 2 s. O medidor mostra FPS agora, média, 1% low, tempo de quadro,
tempo de JS, resolução interna, partículas e chamadas de desenho por quadro. Os botões ligam e desligam cada camada e
trocam o número de cavalos e a escala:

- **1×** e **2×**: 1 ou 2 pixels de canvas por pixel de arte;
- **3×**;
- **jogo**: a regra de hoje, com o pixel do aparelho reduzido acima de 1,5 milhão de pixels;
- **nativo**.

A **bateria** (cerca de 72 s) roda 11 fases seguidas e gera um resumo para copiar.

Rodar no contêiner: `node prototype/spike/medir-engine.mjs [--sem-vsync] [--so desktop,celular,celular-4x,celular-6x]`.

## 2. Números no contêiner

Ambiente: Chromium headless do Playwright, num Xeon de 2,1 GHz com 4 núcleos e **sem GPU**. O canvas é rasterizado na
CPU (SwiftShader). Emulação: Pixel 7 (412×839 CSS, DPR 2,625). A CPU foi limitada pelo CDP
`Emulation.setCPUThrottlingRate`: 4× é próximo de um celular intermediário e 6× de um fraco.

Na escala do jogo o canvas é de 1030×1210 (S5), com cerca de 280 partículas e cerca de 2.700 chamadas de desenho por
quadro no pior caso.

**Com vsync (60 Hz), FPS médio / 1% low** (rodada antes da fase 3× entrar na bateria):

| Fase | celular 1× | celular 4× | celular 6× |
|---|---|---|---|
| Pior caso: 12 cavalos, escala jogo, tudo ligado | 59,9 / 53,0 | 26,4 / 9,6 | 14,7 / 7,1 |
| Sem clima, poeira e skills | 60 / 59,5 | 45,0 / 22,5 | 29,5 / 20,0 |
| Sem câmera (sem zoom) | 60 / 59,5 | 37,4 / 16,4 | 24,6 / 13,3 |
| Sem cenário (`drawTrack`) | 60 / 59,5 | 44,6 / 25,7 | 26,2 / 13,3 |
| Escala 2× (412×484) | 60 / 59,5 | 58,1 / 26,7 | 43,1 / 13,8 |
| Escala 1× (206×242) | 60 / 59,5 | 59,8 / 47,8 | 55,1 / 21,8 |
| 20 cavalos | 59,8 / 47,8 | 23,1 / 10,0 | 12,7 / 4,6 |

No desktop (1280×800, DPR 1, S2) todas as fases ficam em 60 / 59,5.

**Sem vsync (teto: a folga que sobra), FPS médio / 1% low:**

| Fase | celular 1× | celular 4× | celular 6× |
|---|---|---|---|
| Pior caso, escala jogo (S5) | 155 / 63 | 25 / 10 | 16 / 7 |
| Escala 3× (618×726), tudo ligado | 280 / 123 | **58 / 22** | 34 / 12 |
| Escala 2× | 409 / 149 | 81 / 30 | 49 / 20 |
| Escala 1× | 492 / 169 | 95 / 27 | 59 / 21 |
| Sem câmera | 199 / 90 | 38 / 19 | 22 / 11 |

**Tempo de JavaScript por quadro** (média / p95), sem câmera, que é a medida limpa: aí a rasterização fica fora do JS.

| CPU | Tempo |
|---|---|
| 1× | 1,1 / 1,8 ms |
| 4× | 6,0 / 10,6 ms |
| 6× | 8,9 / 12,7 ms |

Com a câmera ligada, o `drawImage` do mundo para a tela obriga o navegador a rasterizar dentro do JS; por isso o
número sobe para 27,5 ms em 4×.

## 3. Gargalos

1. **Resolução interna (preenchimento de pixels).** É o que mais pesa. Do S5 (1,25 Mpx) para o S3 (0,45 Mpx), o FPS
   médio em 4× vai de 25 para 58. Em pixel art isso não custa visual: cada pixel de arte continua quadrado.
   - **Achado:** os moldes do PixelLab têm 1,5 pixel de molde por pixel de arte (largura útil de 60 px em 40 de
     arte). Por isso **3× é a menor escala que deixa os cavalos idênticos**. Em 2× e 1× eles mudam de tamanho, porque
     o `moldScale` arredonda. O jogo já tem a peça para isso (`reducaoEscala` com `escalaMoldeCompativel`); hoje ela só
     entra acima de 1,5 Mpx.
2. **Camadas de tela cheia com alfa.** São a névoa, o véu do clima, o parallax semitransparente e o zoom da câmera, que
   é um segundo `drawImage` da tela inteira. Cada uma custa uma passada de preenchimento. Desligar o clima, a poeira e
   as skills dá cerca de 70% a mais de FPS em 4×. A névoa é a pior no 1% low.
3. **Número de cavalos.** De 12 para 20 cavalos, a perda é de 10 a 20%. O canvas também cresce, porque com mais raias
   ele fica mais alto.
4. **JavaScript.** Não é gargalo: cerca de 1 ms por quadro sem limitar a CPU e 9 ms em 6×. Cabe nos 16,7 ms de 60 Hz.
5. **Engasgos isolados.** Mesmo com folga, apareceram quadros de mais de 20 ms (1 em 720 no pior caso). No relatório
   de 1% low eles valem: esse índice derruba o resultado com 2 a 3 quadros ruins numa fase curta.

**Limite desta medição:** no celular de verdade, o canvas 2D do Chrome é rasterizado na **GPU** (Skia). A maior parte
do gargalo 1 e do 2 sai da CPU, então o real deve ficar entre as colunas "1×" e "4×". Só o celular responde isso.

## 4. Números no celular do Vinicius

_Pendente._ Artefato: https://claude.ai/artifact/UvJifXrNdRyHJngmAaJHTm. O passo é tocar em **Rodar bateria**,
deixar a tela ligada por cerca de 72 s e colar o resumo aqui. Vale anotar o modelo do aparelho.

| Fase | FPS médio | 1% low | Observação |
|---|---|---|---|
| 1. Pior caso (escala jogo) | | | |
| 7. Escala 3× | | | |
| Escala 1× | | | |
| 10. 20 cavalos | | | |

## 5. O que custaria cada ambição visual na web

| Ambição | Custo na web | Efeito no FPS |
|---|---|---|
| Desenhar a corrida em 3× fixo (a CSS amplia) | ½ dia: mudar a regra do `layout()` do `game.js`; os moldes já são compatíveis | é o maior ganho medido (cerca de 2,3× em 4×) |
| Explosões, tremida e zoom de câmera como no spike | 2 a 3 dias: o código do spike já serve de base | zoom é uma passada de tela cheia; em 3× é barato |
| Parallax em várias camadas (bitmaps prontos) | 1 a 2 dias, mais arte (PixelLab: pede confirmação) | 2 `drawImage` por camada; o semitransparente custa mais |
| Pré-desenhar o cenário estático do `drawTrack` (serras e arquibancada) em bitmaps | 2 a 3 dias | tira cerca de 1.000 chamadas por quadro (fase 6) |
| Milhares de partículas, brilho (bloom), luz 2D, distorção (calor, onda de choque) | 1 a 2 semanas: um desenhador WebGL2 só para a pista da corrida, escrito à mão (sem dependência), com sprites em lote e shaders. A interface continua em HTML | onde a GPU passa a fazer o trabalho; é o que o Godot faria |
| Som com baixa latência | Web Audio: bom no Chrome Android; latência de 20 a 50 ms | — |

Nada disso exige reescrever as telas, a regra nem os testes.

## 6. Web × Godot 4

| Critério | Web (hoje) | Godot 4 |
|---|---|---|
| Qualidade visual e efeitos | Canvas 2D: pixel art, partículas na casa das centenas, alfa. Com WebGL2 (seção 5), shaders e partículas na GPU no mesmo nível do Godot. | Melhor de fábrica: partículas na GPU, `Light2D`, shaders, `Parallax2D`, editor de animação. |
| FPS estável em Android fraco | Canvas 2D usa a GPU pelo Chrome/WebView. Risco: a WebView do aparelho (versão e driver) e os engasgos do coletor de lixo. Mitigação: 3× e pools (já no spike). | Nativo, com o renderizador Compatibility (GLES3) feito para aparelho fraco. Mais previsível, mas na mesma GPU: o preenchimento custa o mesmo. |
| Carregamento | Página de 1,1 MB; a WebView abre em 1 a 2 s. | Motor + `.pck`: partida a frio de 1 a 3 s em aparelho fraco. |
| Tamanho do APK | Embrulho (Capacitor ou TWA) de ~3 a 8 MB, mais 1,1 MB do jogo. | A partir de ~25 a 35 MB (o template do motor). |
| Como o Vinicius testa | Artefato do claude.ai, no celular, a cada build, como hoje. | O build web do Godot passa de 16 MB (wasm de ~30 a 40 MB) e pede cabeçalhos COOP/COEP: **sem artefato**. Teste por APK instalado à mão ou por trilha interna do Play, a cada build. |
| Verificação automática | `check.sh` em 8 etapas: simulação, efeitos, wiki, balanço, 72 blocos de interface no Playwright, tudo no contêiner. | Testes de lógica rodam em `godot --headless` (com GUT ou gdUnit4). Teste de interface com captura de tela pede xvfb e OpenGL por software. Tudo teria de ser reescrito, e o binário (~100 MB) baixado no contêiner. |
| Corrida determinística e idêntica ao servidor | **O mesmo `sim.js` roda no cliente e no servidor: risco zero.** | Opções: (a) portar o `sim.js` para GDScript ou C#; o risco está em `Math.imul`, `>>> 0`, `sin` e `pow` darem resultado diferente, então seria preciso conferir bit a bit contra arquivos-gabarito gerados no Node; (b) embutir um motor JS por plugin de terceiros; (c) só animar o resultado do servidor. A (c) não serve ao teste fechado, que roda sem rede (decisão de 2026-11-10). |
| Custo e risco de reescrever | 0. | `game.js` (6,9 mil linhas), `sprites.js` (2,6 mil), `fx.js` (1,8 mil), o CSS e todas as telas (Estábulo, Haras, Loja, Mochila, Ginásios) refeitos em nós `Control`. Estimativa: **2 a 4 meses** só para voltar ao ponto de hoje, com as frentes paradas e a verificação refeita. |

## 7. Recomendação

**Ficar na web e desenhar a pista da corrida em 3×**, se o celular passar no critério abaixo.

- **Critério:** se a fase 1 (pior caso, 12 cavalos, tudo ligado) **ou a fase 7 (a mesma, em 3×)** fizer **≥ 55 FPS no
  1% low** no celular do Vinicius, fica web. Se passar só em 3×, adotar 3× no jogo (½ dia).
- **Se não passar nem em 3×, mas passar em 1×:** o gargalo é preenchimento de pixels. O próximo passo é o desenhador
  WebGL2 da pista (1 a 2 semanas), não o Godot. A GPU do aparelho é a mesma para os dois.
- **Só reabrir o Godot se** a fase 9 (1×, onde quase não há pixel para preencher) ficar **abaixo de 45 FPS no 1%
  low**. Isso mostraria que o gargalo é a WebView em si, e aí nenhuma otimização web resolve.

O que sustenta a recomendação:

1. A medição mostra um gargalo que a web resolve barato (resolução) e um JavaScript que já cabe.
2. O ganho visual do Godot (shaders, partículas na GPU) também é alcançável com WebGL2 na pista, sem tocar no resto.
3. O Godot custaria meses de reescrita e o artefato como meio de teste do Vinicius.
4. O Godot traria o risco de a corrida do cliente divergir da do servidor, que é a regra que mais protege o jogo.

## 8. Arquivos

- `prototype/spike/gerar-engine.mjs`: gera o `engine.html`.
- `prototype/spike/engine.js`, `engine.css` e `engine.corpo.html`: a página.
- `prototype/spike/engine.html`: gerado; é o que vai para o artefato.
- `prototype/spike/medir-engine.mjs`: a bateria no Playwright, com celular, CPU 4× e 6×, com ou sem vsync.

O spike fica fora do `check.sh` e do build do jogo. `node prototype/build.mjs` foi rodado e `prototype/dist/` não
mudou.
