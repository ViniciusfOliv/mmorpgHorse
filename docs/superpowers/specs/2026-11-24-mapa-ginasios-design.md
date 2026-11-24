# Mapa dos ginásios e cena de desafio — design

_2026-11-24 · frente 2 das melhorias visuais (ramo `claude/mapa-ginasios`). Parte da amostra aprovada como direção
(https://claude.ai/artifact/XkbbtUoHuAxcYFQ45thNTF, `prototype/arte/mapa-amostra.html`) e das escolhas do Vinicius
registradas em `docs/memoria/decisoes.md`. Só desenho e interface: nenhuma regra, número ou sorteio muda._

## 1. Intenção
O Vinicius pediu (2026-11-23) um mapa do mundo com o lugar de cada ginásio e, dentro de cada ginásio, o caminho entre os
oponentes, "natural e fluido, não imagens PNG sobre um fundo". Depois, a cena de desafio entrou nesta frente, na
convenção de batalha de RPG de criaturas: o oponente de frente, ao fundo e à direita; o nosso cavalo de costas, na frente
e cortado pela borda de baixo; os dois pisando num chão em perspectiva, com o fundo atrás. A arte e a interface são
nossas, e nada é copiado.

Hoje a aba Expedição é uma lista de três cartões; a trilha é o mapa pintado (256 × 384) com um tracejado e as paradas por
cima; a cena do duelo põe os dois cavalos de perfil sobre a imagem da arena (captura `final-26b`).

## 2. Metas, não metas e antimetas
**Metas**
- M1. Um mapa-múndi vivo na aba Expedição, com os três ginásios no lugar deles, tocáveis.
- M2. Entrar num ginásio é uma viagem curta (aproximação e íris), e não uma troca seca de tela.
- M3. A trilha com chão de verdade: pista de terra que se pinta ao vencer, paradas assentadas no terreno, o cavalo ativo
  trotando até o próximo oponente.
- M4. A cena de desafio com os personagens dentro do cenário (pisando, com sombra), e não colados por cima.
- M5. Um padrão só de cavalo: o mesmo desenho em toda vista, recolorido como o jogo faz.

**Não metas**
- Mudar o que acontece nos ginásios: etapas, entradas, prêmios, cansaço, revanche, insígnia (spec
  `2026-11-17-ginasios-design.md`).
- Ginásios novos, regiões novas ou mapa rolável maior que a tela.
- Animação de corrida (a tela de corrida segue a mesma) e o ambiente das trilhas, que é da frente 1
  (`2026-11-23-animacao-ambiente-design.md` §3.4, no ramo `claude/animacao-ambiente`).
- Trocar a vista de lado dos cavalos no resto do jogo (comparação separada, mais tarde).

**Antimetas**
- A animação revelar um resultado antes de a entrada ser paga, ou mostrar algo que não foi gravado (regra §8 do
  CLAUDE.md: a tela só anima o que foi gravado).
- A névoa ou qualquer efeito do mapa bloquear um ginásio: os três continuam abertos em qualquer ordem.
- Passar do orçamento de quadro (§7) ou depender de `Math.random` (o efeito cosmético usa a RNG mulberry32 própria).

## 3. Telas

### 3.1 Mapa-múndi (aba Expedição)
- **Arte:** a ilha pintada B (PixelLab Pixen, `terreno-s9901`, 256 × 384), com os ginásios do piloto assentados com
  sombra de contato: Fornalha no vulcão (`ginasio-fogo-s9921`), Remanso no lago (`ginasio-agua-s9932`), Capoeira na mata
  (`ginasio-grama-s9953-00`). O mapa de peças (Wang) fica só como exemplo e não entra no jogo.
- **Vida (só desenho):** mar, rio e lava em ciclo de cor (12 fps, listas de pixels ativos); copas balançando em faixas
  de 24 px; fumaça e bombas do vulcão; nuvens com sombra (troca de paleta "escurecer"); pássaros; espuma nas margens.
- **Estado de cada ginásio:** estandarte do líder na cor do elemento; névoa (dithering 2 × 2 e paleta "lavada") sobre o
  que ainda não tem a insígnia, só visual; insígnia ao lado do ginásio conquistado; balão "!" quando a revanche de hoje
  está livre.
- **Por baixo da arte:** a lista de hoje (os três cartões, a revanche e o AFK) continua na tela, agora como lista de
  botões ligada ao mapa: tocar no cartão ou no ginásio do mapa faz a mesma coisa. Os cavalos selvagens continuam
  embaixo, como hoje.

### 3.2 Transição para dentro do ginásio (~1 s)
1. Aproximação em zoom inteiro 1× → 2× → 3× sobre o ginásio (0,12 s em cada degrau).
2. Íris fechando na cor do elemento até 0,5 s; tela cheia na cor por 0,08 s.
3. Troca para a trilha e íris abrindo em volta do cavalo ativo (0,4 s).

A volta é o inverso (~0,9 s). Com movimento reduzido (`prefers-reduced-motion` ou o ajuste do jogo), a troca é direta,
sem zoom nem íris.

### 3.3 Trilha do ginásio
- **Arte:** o mapa da trilha de hoje (`telas/finais/mapa-<ginásio>.png`, 256 × 384), sem troca de imagem nem de
  resolução. **O fundo animado é da frente 1** (combinado em 2026-11-24): `Ambiente.cena('mapa:<elemento>')` desenha a
  imagem e o que mexe nela (água, lava, copas, bichos) num buffer de 256 × 384; esta frente chama `atualiza(t, dt)` e
  `desenha(ctx, { x0, x1, y0, y1 })` com o trecho visível (a 360 px as laterais se cortam; a trilha cabe inteira na
  altura, sem rolagem) a cada quadro do seu laço, e `parada(ctx)` com movimento reduzido; depois desenha por cima a pista,
  as paradas, os treinadores, o cavalo e a poeira. O ciclo de cor da água e da lava que a amostra faz na trilha sai do
  código desta frente.
  Para a frente 1 não pôr junco, peixe ou flor embaixo da pista, esta frente expõe a **máscara do caminho** de cada
  trilha (256 × 384, 1 = pista, a mesma curva da pintura); se alguma parada cair sobre a água, a frente 1 expõe o
  "escurecer" do buffer dela para as sombras. A frente 1 começa os mapas depois de o plano desta frente ser aprovado.
- **Pista de terra:** curva Catmull-Rom pelas paradas, desenhada tile a tile (7 px) com borda recortada; o trecho já
  vencido é chão pisado; no Remanso, ponte de tábuas sobre a água. Ao vencer uma etapa, o trecho até a parada seguinte
  se pinta em ~1 s (com movimento reduzido, aparece pronto).
- **Paradas:** base de pedra com o treinador (corpo 1:1) e a sombra dele; estado escrito na lista (Vencida, Próxima,
  Fechada, Revanche hoje, Feita hoje), como hoje; o líder com o estandarte.
- **Cavalo ativo:** o molde do jogo (parado), o mesmo desenho que em toda parte, com 1 px de trote, ao lado da base da
  próxima parada e virado para o oponente; ao abrir a trilha depois de vencer, ele trota pelo trecho novo.
- **Lista:** os botões de etapa de hoje continuam (detalhe, treinar AFK). O mapa é a vista; a lista é o controle completo.

### 3.4 Cena de desafio (`renderDesafio`)
- **Quadro:** 256 × 160 pixels de arte (decidido; hoje 256 × 128 com corte de 32), na mesma grade inteira da interface; a 360 px
  as laterais se cortam por igual, como hoje.
- **Fundo:** a arena 0 de cada ginásio (`ginasios/<el>/arena-0.png`) vale até o horizonte `hz`; abaixo dele, um piso em
  perspectiva por código (`z = 260 / d`), com a rampa de cores tirada do chão da própria arena, o anel e os detalhes do
  elemento (rachaduras de lava na Fornalha; poças no Remanso; capim na Capoeira, a desenhar). A lava e a água do fundo
  correm em ciclo de cor.
- **Personagens:** o cavalo do oponente de frente (3/4), ao fundo e à direita, com o líder ou o soldado ao lado; o nosso
  de costas (3/4), na frente e à esquerda, cortado pela borda de baixo. Cada um tem uma marca de terra gasta no chão e uma
  sombra deitada no piso (a silhueta amostrada a cada 3 linhas e puxada para a direita, na cor "escurecer" do chão).
  Respiração de 1 px.
- **Placas:** a do oponente em cima e à esquerda; a nossa embaixo e à direita: nome na cor da raridade (tokens `--r-*`;
  no texto, o Mítico em `a884f3`), nível e barra de fôlego. As placas usam a fonte de glifos do canvas.
- **Entre duelos e resumo:** como hoje. A cena só mostra os cavalos do duelo gravado.

## 4. O cavalo de frente e de costas
- **Ferramenta:** Meshy (imagem → 3D), um modelo por molde (os 12 `<porte>-<estilo>`), gerado do molde parado em
  **cores puras por papel** (pelo vermelho, crina verde, seda azul, pele amarela, sela magenta, detalhe ciano; script
  `arte-desafio-bakeoff.mjs --lote papeis` e `--lote meshy`).
- **Render:** `arte-desafio-render.mjs --papeis` (three.js no Chromium de teste, câmera ortográfica, luz única de cima e
  da esquerda, já no tamanho final, cavalo com ~54 px). Cada pixel volta ao seu papel pelo matiz; a sombra de pelo e crina
  sai do valor; ruído limpo em 3 × 3; contorno de 1 px por fora. A saída tem o formato dos moldes (cinza = papel × 25).
- **No jogo:** os papéis entram na tabela dos moldes como dois estados novos por molde, `frente` e `costas` (72 × 72),
  e o `drawHorse` os pinta com as cores do cavalo (`coresMolde` → paleta-mestra), como já faz com `parado` e `galope`.
  Recoloração, raridade (brilho da crina) e seda do jóquei continuam valendo.
- **Limites conhecidos:** o formato da crina vem da malha (folhas e chamas saem como massa cheia, sem pontas recortadas a
  ~54 px), o que o Vinicius aceitou. As marcas (estrela, patas, ruão) ficam fora das vistas de frente e de costas na v1
  (decidido); entram depois, por âncoras.
- **Feito:** os 12 moldes, 30 créditos cada (360, o teto do lote), saída em `prototype/assets/arte/desafio/bakeoff/
  meshy-<molde>-papeis-dir0..7.png` (frente = vista 1, costas = vista 5). Os PNGs entram no jogo pelo plano.
- **Idle (combinado com a frente 1):** a vida do cavalo parado é a mesma peça da animação ambiente, `Sprites.IdleMolde`
  (ramo `claude/animacao-ambiente`, etapa 2): como as vistas 3D já são mapas de papéis, ela monta o quadro e o pipeline do
  molde pinta (4 tons, LUT da cena, contraluz). Nenhum idle novo é criado aqui. O que falta para as vistas de frente e de
  costas é só o que o `IdleMolde.pecas` lê das âncoras de lado (`nose`, `rear`, `footY`, `olho`): cada vista ganha as
  suas âncoras (cabeça e orelhas no topo, cauda embaixo e ao centro na de costas, olhos na de frente) e os gestos que
  não fazem sentido de frente ou de costas (aceno de lado, cauda na de frente) ficam desligados por vista. Os gestos do
  PixelLab (comer, cavar) são de lado e não entram nessas vistas.
  As âncoras já existem, no formato combinado com a frente 1: `prototype/assets/arte/desafio/bakeoff/meshy-ancoras.json`
  (`footY`, `bbox`, `olho`, `orelhas`, `crina`, `respira` e, nas costas, `cauda`; caixas com fim exclusivo), geradas por
  `prototype/tools/arte-desafio-ancoras.mjs`, com a folha de conferência `meshy-ancoras.png`. O olho não aparece a ~54 px
  (lista vazia, sem piscar); o padrao-folhas de frente ficou sem crina.

## 5. Estados e o que cada tela mostra
| Situação | Mapa-múndi | Trilha | Cena |
|---|---|---|---|
| Ginásio sem vitórias | névoa cheia, estandarte | pista só até a 1ª parada; cavalo na 1ª | — |
| Etapas vencidas | névoa mais rala | trecho pisado até a próxima; cavalo na próxima | — |
| Insígnia | sem névoa, insígnia | pista inteira; líder com a insígnia | — |
| Revanche livre hoje | "!" no ginásio | líder com "Revanche hoje" | a revanche usa a mesma cena |
| Desafio pago | — | — | duelo gravado; nada antes de pagar |
| Sala de corrida aberta | igual | igual (cavalo ativo fora do time, como hoje) | — |
| Movimento reduzido | quadro parado | pista pronta, sem trote | sem respiração nem ciclo |

## 6. Assets e custo
| Asset | Ferramenta | Situação | Custo |
|---|---|---|---|
| Ilha B (`terreno-s9901`) | PixelLab Pixen | feito (piloto 1) | 14 gerações (piloto) |
| Ginásios Fogo, Água, Capoeira | PixelLab Pixen | feitos (s9921, s9932, s9953) | incluído acima + 3 |
| Pista, paradas, névoa, nuvens, sombras, piso da cena | código | feitos na amostra | 0 |
| Cavalos de frente e de costas (12 moldes) | Meshy | feitos (por papéis, recoloríveis) | 360 créditos |
| Piso da cena para Remanso e Capoeira | código | a fazer (rampa e detalhes) | 0 |
| Arenas 0 de Água e Grama | já existem | — | 0 |

Gasto da frente até 2026-11-24: PixelLab 59 gerações; Meshy 420 créditos (60 de teste e 360 do lote); Gemini ~US$ 0,155;
Canva só créditos de IA do plano. Testes que não entram: inpaint do PixelLab, fundos do Canva, composição do Gemini (a
comparação está na amostra). Todo asset novo vai para `docs/memoria/assets.md` (declaração de IA da Steam).

## 7. Desempenho
- Orçamento do guia: 2 ms de JavaScript por quadro num celular médio; teto da spec da animação para o mapa: 0,35 ms no
  computador (≈ 1,4 ms no celular, régua × 4).
- Medido na amostra: mundo ~0,2 ms, trilha ~0,12–0,23 ms por quadro (isolados); a cópia ampliada para a tela é à parte.
- Tudo que não muda é cacheado: o mundo parado, as versões "escurecer" e "lavado", as sombras deitadas, os cavalos
  recoloridos, as camadas da cena. O ciclo de cor só toca nas listas de pixels ativos.
- Fora da tela visível (aba trocada, página escondida), o laço para, como os outros `vivo()` do jogo.

## 8. Acessibilidade
- O mapa e a trilha são `canvas` com `role="img"` e uma descrição que diz o estado de cada ginásio ou etapa; o controle
  é a lista de botões (já existente), com teclado, foco visível e alvos de 44 px.
- Ao entrar e sair, o leitor de tela recebe um aviso curto ("Dentro do Ginásio da Fornalha. Próxima: Sargento").
- Movimento reduzido desliga zoom, íris, trote, ciclo de cor e partículas (§5).
- Contraste: cada cavalo e treinador se separa do chão pelo valor (Regra 14 do `docs/arte/integracao.md`); o contorno de 1
  px e a sombra deitada garantem a leitura mesmo num cavalo escuro em chão escuro.

## 9. Código
- **Desenho (novo `prototype/src/mapa.js`, UMD, sem regra):** o motor da amostra (`prototype/arte/mapa.js`) passa para o
  jogo, separado em mundo, trilha, transição e cena. Ele só lê o progresso (`state.ginasios`, `ginEtapaEstado`) e nunca
  escreve no save.
- **`game.js`:** `renderExpedicao` ganha o palco do mapa acima dos cartões; `trilhaMapaHtml`/`drawMapaTrilha` passam a usar
  a trilha nova; `ginCenaHtml`/`drawGinCena` passam a usar a cena nova (256 × 160) e as placas no canvas.
- **`sprites.js`:** estados `frente` e `costas` nos moldes (carga tudo ou nada, como hoje; sem eles, a cena cai no molde
  de lado espelhado).
  As âncoras das duas vistas entram com eles, para o `IdleMolde` da frente 1 animar a cena (§4); a parte de idle é
  combinada com aquele chat, que é o dono da peça.
  A frente 1 já implementou o modo de âncoras explícitas no `IdleMolde` (ramo `claude/animacao-ambiente`, commit 7bf5977:
  gestos por estado, sem marcas em `frente`/`costas`). Ao integrar, falta só incluir `frente` e `costas` na condição de
  `vivo` do `drawHorseMolde` (hoje só `parado` e `retrato`) e desenhar a cena com `opts.anima`; quem integrar por último
  faz essa linha.
- **Build:** embute a ilha, os ginásios do mapa e os papéis de frente e costas; o `jogo.html` continua sem modo DEV.
- **Testes:** `moldes-test` (os 24 PNGs novos: tamanho, tons de papel, contorno); `ui-test` com blocos novos (mapa com os
  três ginásios tocáveis e a lista equivalente, entrar e voltar, trilha depois de vencer, cena com o duelo gravado,
  movimento reduzido) e capturas oficiais novas (`final-24`, `final-25`, `final-26b`); medição de quadro no `ui-test`.

## 10. Decisões e pendências
**Decididas (Vinicius, 2026-11-24):** ilha B; ginásios s9921, s9932, s9953; mapa pintado como principal; arena 0; nome
na cor da raridade; convenção de batalha de RPG de criaturas só no layout; um padrão só de cavalo; Meshy para frente e
costas, um modelo por molde, a partir de cores puras por papel.

**Decididas na revisão do rascunho (Vinicius, 2026-11-24):** sem marcas nas vistas 3D na v1; quadro da cena 256 × 160;
crina cheia aceita; o plano começa pelo mapa e pela trilha (sem custo), e a cena vem na fase seguinte.

**Pendente:** aprovação desta spec; depois, o plano em `docs/superpowers/plans/`.
