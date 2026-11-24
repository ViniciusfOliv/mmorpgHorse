# Teste de engine: web × Godot 4

_2026-11-19 · branch `claude/teste-engine` · spike descartável em `prototype/spike/` (não vira código do jogo)._

**Pergunta:** a base web atual (HTML/CSS/JS puro, canvas 2D) aguenta uma corrida no nível visual que queremos para o
lançamento, com FPS estável em Android fraco? Ou vale migrar para Godot 4? (A Unity já foi descartada na análise
anterior.)

**Resposta curta: fica web.** No celular do Vinicius, a base web desenhou o pior caso a **120 FPS** numa tela de 120
Hz, dentro da WebView do Android:

- 12 cavalos, clima, partículas, explosões, parallax, câmera com zoom e tremida, todos ligados;
- 99% dos quadros em até 8,5 ms;
- 3,2 ms de JavaScript por quadro.

Na resolução nativa (1152×1452) e com 20 cavalos o resultado é o mesmo. Isso é o dobro do que um jogo a 60 FPS
precisa. O Godot não traria visual nem FPS que justifiquem de 2 a 4 meses de reescrita.

Ficam dois cuidados antes do lançamento (seção 7):

- confirmar uma rodada longa, de 60 s travada em 60 FPS, porque a primeira rodada do celular teve engasgos que a
  bateria não repetiu;
- medir num Android fraco.

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

A **bateria** (cerca de 83 s) roda 12 fases seguidas e gera um resumo para copiar. A v3 corrige o limitador de 60 FPS (seção 4.2).

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

**Limite desta medição, confirmado pelo celular (seção 4.2):** no aparelho, o canvas 2D é rasterizado na **GPU**.
Lá, a resolução e as camadas de alfa (gargalos 1 e 2) quase não pesam: a escala nativa S6 deu o mesmo FPS que a S3.
Esses gargalos eram do desenho por software do contêiner. O que o contêiner mede bem é o JavaScript, e ele cabe.

## 4. Números no celular do Vinicius

### 4.1 Primeira rodada (2026-11-19): Rodada livre de 60 s com spike v1, pior caso com tudo ligado

O teste rodou dentro do app do Claude, numa WebView Android (`wv`). É o mesmo tipo de motor que o jogo empacotado
usaria. Dados do aparelho:

- O texto do navegador diz "Android 10; K", mas é o texto reduzido do Chrome: a versão real fica escondida.
- 10 núcleos, 8 GB, tela de 120 Hz, 384×832 CSS com DPR 2,81 (1080×2340). É o perfil de um topo de linha recente
  Confirmado pelo Vinicius: **Galaxy S24 FE** (Exynos 2400e).
- Escala "jogo" nesse aparelho: 576×726 (S3). Ou seja, a redução para 3× já estava valendo.

| Medida | Valor |
|---|---|
| FPS médio | 102,9 (a tela pede 120) |
| 1% low | 34,8 |
| Tempo de quadro, média / p99 | 9,7 / 25,1 ms |
| Quadros acima de 20 ms | 278 de 6.172 (4,5%) |
| JS, média / p95 | 4,5 / 18,7 ms |
| Por clima: sol / chuva / névoa | 101,7 / 104,6 / 102,3 FPS (1% low cerca de 35 nos três) |

**Leitura:**

1. Em média sobra tempo para 60 FPS. O quadro médio leva 9,7 ms, contra 16,7 ms de orçamento a 60 Hz. O que não dá
   é sustentar 120.
2. **O problema são os engasgos.** Cerca de 1 quadro em 22 passa de 20 ms. O p95 do JS (18,7 ms) é 4 vezes a média,
   e o clima não muda nada. Então não é preenchimento de tela: é algo que trava de vez em quando.
3. Os suspeitos são três:
   - a cópia da câmera (o `drawImage` do mundo para a tela pode esperar a GPU; no contêiner, essa etapa já é quase todo
     o tempo dos quadros lentos);
   - o coletor de lixo;
   - a própria WebView a 120 Hz.
4. O critério de 55 FPS no 1% low foi pensado para 60 Hz. Numa tela de 120 Hz, o jogo pode desenhar a 60 (um quadro
   sim, um não), como a maioria dos jogos faz.

O que o spike v2 acrescenta para responder isso:

- a fase 2 da bateria, "PIOR CASO travado em 60 FPS", que vira a base do critério em telas acima de 75 Hz;
- o tempo de JS por parte do quadro (cenário, cavalos, efeitos, câmera, HUD), com média, p95 e máximo;
- para cada quadro com mais de 12 ms de JS, qual parte pesou mais.

### 4.2 Bateria completa (spike v2, 2026-11-19)

Mesmo aparelho e mesmo ambiente (app do Claude, WebView, cerca de 119 Hz). "Livre" acompanha a tela de 120 Hz, então o
orçamento é de 8,3 ms por quadro, a metade do de 60 FPS.

| Fase | Canvas | FPS médio | 1% low | ms p99 | Quadros > 20 ms | JS méd/p95 (ms) |
|---|---|---|---|---|---|---|
| 1. Pior caso, escala jogo, livre | 576×726 (S3) | **119,6** | **82,4** | **8,5** | 1 / 1.434 | 3,2 / 4,1 |
| 2. Pior caso travado em 60 FPS | 576×726 (S3) | 59,5 | 35,4 | 25,0 | 8 / 595 | 4,5 / 6,2 |
| 3. Escala nativo | 1152×1452 (S6) | 119,5 | 82,6 | 8,5 | 1 / 717 | 2,1 / 3,0 |
| 4. Sem clima, poeira e skills | 576×726 | 119,2 | 70,9 | 8,5 | 1 / 715 | 1,8 / 2,3 |
| 5. Sem câmera | 576×726 | 120,0 | 109,1 | 8,5 | 0 / 721 | 2,3 / 2,9 |
| 6. Sem parallax extra | 576×726 | 119,7 | 92,9 | 8,5 | 0 / 718 | 2,8 / 3,6 |
| 7. Sem cenário | 576×726 | 120,0 | 110,7 | 8,5 | 0 / 720 | 2,4 / 3,1 |
| 8. Escala 3× | 576×726 | 118,7 | 58,3 | 12,3 | 2 / 712 | 2,7 / 3,5 |
| 9. Escala 2× | 384×484 | 119,2 | 61,8 | 8,5 | 3 / 717 | 2,7 / 3,6 |
| 10. Escala 1× | 192×242 | 118,7 | 56,5 | 8,6 | 2 / 713 | 2,8 / 3,5 |
| 11. 20 cavalos | 576×1038 | 119,7 | 94,6 | 8,4 | 1 / 718 | 3,0 / 3,8 |
| 12. 6 cavalos | 1152×1014 (S6) | 118,7 | 53,0 | 9,2 | 4 / 714 | 1,8 / 2,5 |

JS por parte na fase 1 (média / p95 / máximo, em ms):

| Parte | Tempo |
|---|---|
| Cenário | 0,9 / 1,5 / 7,0 |
| Cavalos | 0,8 / 1,1 / 2,1 |
| Efeitos | 0,4 / 0,6 / 1,3 |
| Câmera | 0,7 / 1,0 / 3,5 |
| HUD | 0,3 / 0,5 / 1,4 |

Na fase 1, só 1 quadro passou de 12 ms de JS. Na fase 2, nenhum.

**Leitura:**

1. **O pior caso roda a 120 FPS.** O p99 é de 8,5 ms em quase todas as fases, e mesmo a escala nativa e os 20 cavalos
   não mudam nada. Para 60 FPS, a folga é de cerca de 2 vezes.
2. **O 1% low abaixo de 82 em algumas fases vem de 1 a 4 quadros soltos, menos de 0,6%.** Eles não acompanham a carga:
   6 cavalos deu 53,0 e 20 cavalos deu 94,6. São soluços do sistema ou do coletor de lixo. Numa fase de cerca de 715
   quadros, o 1% low é a média dos 7 piores, e esses soluços pesam nela.
3. **A fase 2 reprovou por um defeito do limitador do spike, não do jogo.** Os sinais:
   - o p99 foi de exatamente 25,0 ms, que são 3 batidas de 8,3 ms;
   - o JS chegou no máximo a 4,8 ms;
   - nenhum quadro teve JS acima de 12 ms.

   O limitador da v2 comparava o tempo desde o último quadro com 13 ms. Uma batida que chegava um tico cedo era pulada,
   e o quadro só saía na terceira. A v3 troca isso por um acumulador no ritmo da tela; no contêiner sem vsync, ela dá
   60,6 FPS com p99 de 17,7 ms. **Este é o jeito certo de limitar o jogo a 60 FPS numa tela de 120 Hz.**
4. **A primeira rodada (seção 4.1) ficou pior** (103 FPS, 4,5% dos quadros acima de 20 ms) com o mesmo conteúdo. A
   diferença foi a duração: 60 s seguidos, contra fases de 6 a 12 s. Pode ter sido aquecimento do aparelho, modo de
   economia de energia ou um toque e rolagem da página durante o teste. É o único sinal vermelho que sobrou, e se
   confirma com uma rodada longa (seção 7).

## 5. O que custaria cada ambição visual na web

| Ambição | Custo na web | Efeito no FPS |
|---|---|---|
| Travar em 60 FPS em tela de 120 Hz (acumulador no ritmo da tela, como o spike v3) | ½ dia no laço da corrida do `game.js` | metade do trabalho por segundo e menos bateria; o quadro tem 16,7 ms em vez de 8,3 |
| Desenhar a corrida em 3× fixo (a CSS amplia) | ½ dia: mudar a regra do `layout()` do `game.js`; os moldes já são compatíveis | no celular com GPU não fez diferença; fica de reserva para aparelho fraco (no contêiner, cerca de 2,3× em 4×) |
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

**Fica web.** Não migrar para Godot.

**Critério que sustenta a decisão:** no celular do Vinicius, o pior caso do lançamento (12 cavalos, tudo ligado) fez
**≥ 55 FPS no 1% low**. Fez 82,4, e numa tela de 120 Hz, que é mais exigente que 60, com 99% dos quadros em até 8,5 ms
e o JavaScript em 3,2 ms.

Os motivos:

1. **O visual do lançamento cabe com sobra.** As camadas que pensamos para o lançamento custaram cerca de 4 ms de um
   orçamento de 16,7: explosões, parallax, zoom e tremida, clima e 20 cavalos.
2. **O Godot não teria vantagem nesse aparelho.** A GPU é a mesma, e a web já entrega o teto da tela.
3. **O que o Godot faz melhor também é alcançável na web.** Shaders, luz 2D e milhares de partículas cabem num
   desenhador WebGL2 só para a pista (1 a 2 semanas), sem mexer nas telas.
4. **O Godot custaria caro.** São 2 a 4 meses de reescrita. O Vinicius perderia o artefato como meio de teste. E
   haveria o risco de a corrida do cliente divergir do `sim.js` do servidor.

**Antes do lançamento (entra no checklist do `docs/cronograma.md` quando o empacotamento voltar):**

1. **Rodada longa no celular:** Rodada livre de 60 s com Limite em 60 FPS, no spike v3. Passa se tiver menos de 1% dos
   quadros acima de 20 ms. É o que falta para descartar os engasgos da primeira rodada.
2. **Android fraco:** a mesma bateria num aparelho de entrada, pelo relatório de pré-lançamento do Play ou por um
   aparelho emprestado. Se o pior caso travado em 60 ficar abaixo de 55 no 1% low, há três alavancas, nesta ordem, todas
   sem reescrita:
   - escala 3× ou 2×;
   - menos camadas de clima em tela cheia;
   - desenhador WebGL2.
3. **No jogo:** travar a corrida em 60 FPS com o acumulador do spike v3, e guardar a regra de escala de reserva.

**Quando reabrir o Godot:** só se um aparelho-alvo ficar abaixo de 45 FPS no 1% low **até em escala 1×**, onde quase
não há pixel para preencher. Isso mostraria que o limite é a WebView em si.

### 7.1 Rodada da etapa 6 da animação ambiente (spike v4, 2026-11-24)

O spike v4 desenha o cenário das regiões do jogo, com a região viva do `ambiente.js` (camada "Ambiente vivo"). Também
desenha o que a etapa 0 pôs na corrida: sombra opaca, contato da raia, sombra da cerca, poeira de pouso e a luz do
clima nos cavalos. O parallax extra da v3 ficou desligado, porque as camadas da região já fazem esse papel. O botão
**"Etapa 6: rodada de 60 s"** roda o pior caso de hoje: 12 cavalos, Litoral vivo, chuva e ventania, travado em 60 FPS.
O resumo traz o veredito:

- **Critério:** no máximo 1% dos quadros acima de 20 ms e 1% low de pelo menos 55.
- **Artefato:** https://claude.ai/artifact/4CGJheLECVrZRwuynZi3jH
- **Contêiner, desktop 1280, CPU 1×** (40 a 60 s cada, quatro rodadas alternadas):
  - com o ambiente vivo: 0 e 1 quadro acima de 20 ms, 1% low de 59,5 e 57,2;
  - com as camadas paradas: 7 e 0 quadros, 1% low de 37,8 e 59,5.
  - Os poucos picos são ruído da máquina e aparecem com e sem o ambiente.
  - O ambiente soma cerca de 0,4 ms de JS no cenário.
- **CPU 4×:** reprova, porque o canvas é rasterizado na CPU (a cópia da câmera do spike leva 29 ms). Como na seção 2,
  esse número só compara camadas. **O que decide é o celular.**
- **Como medir no contêiner:** `node prototype/spike/medir-engine.mjs --etapa6 [--so desktop]`.
- **No aparelho (S24 FE, WebView do app do Claude, 120 Hz), 2026-11-24:**

  | Rodada | Quadros acima de 20 ms | 1% low | JS méd/p95 | Cenário méd/p95/máx | Veredito |
  |---|---|---|---|---|---|
  | 1ª e 2ª (antes da correção) | 11,3% e 10,6% | 29,1 e 28,1 | 7,6/23,0 e 7,7/23,6 | 4,2/19,8/32,7 e 4,3/20,3/30,1 | reprovou |
  | 3ª (com a correção das subidas) | 0,2% (7 de 3.591) | 52,5 | 4,7/6,6 | 1,3/2,6/4,1 | reprovou pelo 1% low |

  - **A causa das duas primeiras:** a hachura das subidas (`docs/memoria/bugs.md`, "Desempenho da corrida"). As
    baterias de fases curtas nunca chegavam a uma subida.
  - **Na 3ª:** passa folgado no limite de quadros lentos, mas o 1% low (média dos 36 piores) fica 2,5 abaixo de 55.
    Os 7 quadros lentos não batem com pico de JS (nenhuma parte passou de 4,1 ms) e parecem os soluços que aparecem até
    sem cenário (fase D6 do diagnóstico: 7 de 712). É o ritmo da tela de 120 Hz travada em 60, como na seção 4.2.
  - **Em aberto:** repetir a rodada ou ajustar o critério (decisão do Vinicius e da coordenação).

## 8. Além de web e Godot: outras opções, com jogos de referência

_Pergunta do Vinicius (2026-11-19, depois de decidir que o jogo também vai para a Steam)._ Todas as alternativas
abaixo, Godot incluído, exigem reescrever o cliente e portar o `sim.js`. Só a web roda o mesmo arquivo de regra no
cliente e no servidor.

| Caminho | Jogos de referência | Pontos fortes | Pontos contra (para nós) |
|---|---|---|---|
| **Web (hoje)** + Capacitor ou TWA no Android + **Electron** na Steam | **Vampire Survivors**: feito em Phaser (JS); a versão de PC continua em JavaScript. **CrossCode**: JS (motor derivado do impact.js), na Steam dentro do NW.js. | Medido: 120 FPS no pior caso no S24 FE. O mesmo `sim.js` no cliente e no servidor. Artefato para testar. Verificação automática que já existe. | A Steam leva um Chromium junto (instalação de ~150 a 250 MB). O overlay da Steam é instável no Electron fora do Windows. **Console não tem navegador.** |
| **Defold** (Lua, motor da King, gratuito) | Jogos móveis de grande público, como Family Island | O mais leve de todos: APK de poucos MB, motor web de ~1 MB comprimido (caberia no artefato). Feito para celular; exporta para Steam e consoles. | Reescrever tudo em Lua, portar o `sim.js` para Lua com conferência bit a bit, e uma interface sem HTML/CSS. Comunidade menor. |
| **LÖVE** (Lua) | **Balatro**: PC, consoles, e Android e iOS desde set. 2024 | Leve, simples, bom para 2D. | Celular e web dependem de ferramentas da comunidade; interface toda à mão; mesma reescrita. |
| **GameMaker** | Undertale, Hyper Light Drifter, Pizza Tower | Feito para pixel art 2D. Exporta para celular, Steam e consoles. | Licença paga para exportar; linguagem própria (GML); difícil de verificar no contêiner. |
| **MonoGame/FNA** (C#) ou **Heaps** (Haxe) | Stardew Valley e Celeste (XNA/FNA); Dead Cells e Northgard (Heaps) | Desempenho nativo, consoles, controle total. | É um *framework*, não um editor: muito código de base; o celular dá mais trabalho; a mesma reescrita. |
| **Godot 4** | Brotato (Steam + celular), Halls of Torment, Dome Keeper | Ver seção 6. | Ver seção 6. |
| **Unity** | **Umamusume** (corrida de cavalos, Cygames); Vampire Survivors **nos consoles** | Padrão da indústria para celular e console. | Descartada antes: pesada para 2D em pixel, licença, depende do editor. |

**O que os jogos de referência ensinam:**

1. **Vampire Survivors é o caso mais parecido com o nosso.** Um jogo em JavaScript (Phaser) que estourou na Steam.
   Quando precisou de consoles, ganhou uma versão em Unity (agosto de 2023). Segundo a Xbox, o time mantém as duas, o
   Unity nos consoles e o JavaScript no PC, e manter as duas iguais "é um desafio contínuo". Ou seja:
   - **dá para lançar e crescer na web, inclusive na Steam**;
   - a porta para console é uma reescrita que se faz **depois** do sucesso, e custa caro manter duas versões.
2. **Balatro mostra que motor leve chega a todo lugar.** Mas ele nasceu nesse motor. Trocar agora seria reescrever, não
   otimizar.
3. **"Mais otimizado" não muda o que o jogador vê aqui.** No S24 FE a web já entrega 120 FPS, o teto da tela. Um motor
   nativo ganharia em tamanho de instalação, em aparelho fraco e em console, não em visual.

**Recomendação, com a Steam no escopo:** manter a web. Na Steam, ir de **Electron + steamworks.js**, o caminho mais
usado por jogos em JS (o NW.js e a biblioteca Greenworks estão em manutenção mínima). O que mudaria a recomendação:

- **Consoles entrarem no escopo:** aí vale planejar, depois do lançamento, uma versão nativa só do cliente (como fez
  Vampire Survivors). Antes disso, o `sim.js` precisa de arquivos-gabarito para provar que a regra portada dá o mesmo
  resultado. Candidatos: Defold, pela leveza e pelo celular, ou Godot.
- **Android fraco reprovar até em escala 1×** (seção 7).

**O que a Steam pede da base web** (entra no `docs/cronograma.md`):

- tela em paisagem (16:9, 1920×1080), porque hoje o jogo é uma coluna de celular;
- mouse, teclado e controle (Steam Deck);
- overlay testado no Windows e no Deck;
- compras de Gemas pela carteira da Steam, mantendo as mesmas regras (Gemas nunca viram Ouro);
- build Electron assinado e com atualização automática.

Fontes:

- [PC Gamer: Vampire Survivors troca de motor](https://www.pcgamer.com/vampire-survivors-was-such-a-big-hit-its-getting-a-whole-new-engine)
- [GamingOnLinux: troca para Unity em 17/08/2023](https://www.gamingonlinux.com/2023/07/vampire-survivors-switching-to-new-game-engine-on-august-17)
- [Xbox Wire: Vampire Survivors refeito para o Xbox](https://news.xbox.com/en-us/?p=192177)
- [Windows Central: idem](https://www.windowscentral.com/gaming/vampire-survivors-was-rebuilt-just-to-run-well-on-xbox-consoles)
- [SteamDB: jogos em NW.js](https://steamdb.info/tech/SDK/NWJS)
- [Notas de CrossCode no NW.js](https://dataswamp.org/~solene/2019-12-09-crosscode-instructions-playing.html)
- [Defold: tamanho de build](https://github.com/defold/build-size)
- [Defold: otimizar tamanho](https://defold.com/manuals/optimization-size)
- [Fórum Defold: tamanho do build HTML5](https://forum.defold.com/t/typical-size-for-html5-build/78216)
- [Engadget: Balatro no celular](https://www.engadget.com/gaming/balatro-is-an-almost-perfect-mobile-port-163050971.html)
- [Shacknews: data do Balatro mobile](https://shacknews.com/article/141326/balatro-mobile-release-date-ios-android)
- [steamworks.js (npm)](https://www.npmjs.com/package/steamworks.js)
- [Issue do overlay no Electron](https://www.Github.com/ceifa/steamworks.js/issues/102)
- [Drawize: lançar jogo HTML5 na Steam](https://www.drawize.com/blog/tech-how-to-release-html5-game-on-steam)
- [Construct: overlay da Steam no WebView2](https://www.construct.net/en/forum/construct-3/how-do-i-8/steam-fallback-steam-overlay-186380)

## 9. Arquivos

- `prototype/spike/gerar-engine.mjs`: gera o `engine.html`.
- `prototype/spike/engine.js`, `engine.css` e `engine.corpo.html`: a página.
- `prototype/spike/engine.html`: gerado; é o que vai para o artefato.
- `prototype/spike/medir-engine.mjs`: a bateria no Playwright, com celular, CPU 4× e 6×, com ou sem vsync.

O spike fica fora do `check.sh` e do build do jogo. `node prototype/build.mjs` foi rodado e `prototype/dist/` não
mudou.
