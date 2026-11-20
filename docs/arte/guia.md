# Guia de arte — Galope Elemental

_Versão 1, 2026-11-20 (chat de direção de arte, branch `claude/direcao-de-arte`). Aprovação visual: Vinicius._

Todo asset novo (gerado por IA, desenhado por código ou montado na interface) é conferido contra este guia antes de
entrar no jogo. O que não cumprir uma regra volta para refazer, por mais barato que tenha sido. A pesquisa que embasa as
escolhas de ferramenta está em `docs/arte/ferramentas.md`; os custos em `docs/arte/custos.md`.

## 1. O problema que este guia resolve

As capturas de 2026-11-18 (`prototype/screens/final-06-corrida.png`, `final-02-estabulo.png`,
`final-26b-cena-desafio.png`) mostram quatro defeitos de coordenação:

1. **Escalas de pixel misturadas.** Na corrida, o cenário é desenhado com 1 pixel de arte = S pixels do aparelho
   (S = 4 num celular de densidade 2), mas o cavalo do molde sai em `round(k × 40 / 59)`, ou seja 3 pixels do aparelho:
   o pixel do cavalo é 3/4 do pixel da pista. Na tela de desafio o treinador (64 px, 56 de altura) fica uma vez e meia
   maior do que um humano ao lado de um cavalo deveria ser.
2. **Cenário genérico.** Céu de um tom, terra que parece ruído, arquibancada que se repete idêntica.
3. **Interface sem identidade.** Três fontes (Press Start 2P, Jersey 10 e a fonte 3×5 do canvas), painéis de CSS,
   Estábulo com meia tela vazia, rótulos cobrindo a pista.
4. **Marca borrada.** O logo é uma imagem do Canva reduzida (320×63, 64 cores, sem grade de pixel).

## 2. Pixel de arte e escala inteira

**Regra única: na tela, todo pixel de arte tem o mesmo tamanho, e esse tamanho é um número inteiro de pixels do
aparelho.** Nada é ampliado ou reduzido por fator não inteiro, nada é desenhado em "meia escala", e nenhum asset é
mostrado maior que o tamanho em que foi desenhado (se precisa ser maior, gera-se maior).

- **Escala `s`** (pixels do aparelho por pixel de arte): `s = max(1, round(L / 256))`, onde `L` é a largura da coluna
  do jogo em pixels do aparelho. A largura de arte é `floor(L / s)`; a sobra (até `s − 1` pixels do aparelho) vira
  margem, centrada.
  | Aparelho (largura CSS × densidade) | L | s | Largura de arte | 1 px de arte em CSS |
  |---|---|---|---|---|
  | 360 × 2 | 720 | 3 | 240 | 1,5 |
  | 393 × 2,75 | 1080 | 4 | 270 | 1,45 |
  | 412 × 2,625 | 1081 | 4 | 270 | 1,52 |
  | 360 × 3 | 1080 | 4 | 270 | 1,33 |
  | 480 × 1 (computador) | 480 | 2 | 240 | 2 |
- **Largura de referência: 256 px de arte** (faixa aceita: 224 a 288). Tudo é desenhado para ler bem nessa largura; um
  aparelho mais largo mostra um pouco mais de pista, não um cavalo maior.
- **A mesma `s` vale para a tela inteira**: canvas da corrida, cenas (desafio, estábulo), ícones, painéis, texto. Na
  interface HTML, o CSS recebe `--px: calc(s / devicePixelRatio * 1px)` e toda medida de arte é múltiplo de `--px`
  (bordas, cantos, ícones, alturas de botão). O `ui-test` confere em 2, 2,625 e 3 (a densidade 2,625 já mostrou
  emendas em `border-image`; por isso as molduras continuam em peças, não em `border-image`).
- **Desenho em resolução de arte.** Cada quadro da corrida é desenhado num canvas fora da tela do tamanho da arte
  (ex.: 270 × 320) e copiado para o canvas visível com um único `drawImage` ampliado `s` vezes, sem suavização. Nunca
  `fillRect(x × S, …)` em resolução do aparelho.
- **Câmera e paralaxe em pixel inteiro.** A posição de cada camada é arredondada para o pixel de arte antes de desenhar
  (cada camada tem o seu arredondamento; o tremor de 1 px entre camadas é aceito e esperado em pixel art).
- **O molde do cavalo define a escala:** 1 pixel do molde (64 × 64, já pago e aprovado) = 1 pixel de arte. Com 59 px de
  largura útil, o cavalo ocupa cerca de 23% da largura da tela em retrato (hoje, cerca de 22%).

## 3. Paleta fechada

**Paleta-mestra: Resurrect 64** (Kerrie Lake, 64 cores, lista pública em lospec.com/palette-list/resurrect-64). Teste
de 2026-11-20: os treinadores e os ícones do PixelLab quantizados para ela mantêm a leitura (o vermelho fica um pouco
mais quente). Uma lista de cores não é obra protegida; o crédito à autora vai na tela de créditos, por cortesia.

```
2e222f 3e3546 625565 966c6c ab947a 694f62 7f708a 9babb2 c7dcd0 ffffff
6e2727 b33831 ea4f36 f57d4a ae2334 e83b3b fb6b1d f79617 f9c22b 7a3045
9e4539 cd683d e6904e fbb954 4c3e24 676633 a2a947 d5e04b fbff86 165a4c
239063 1ebc73 91db69 cddf6c 313638 374e4a 547e64 92a984 b2ba90 0b5e65
0b8a8f 0eaf9b 30e1b9 8ff8e2 323353 484a77 4d65b4 4d9be6 8fd3ff 45293f
6b3e75 905ea9 a884f3 eaaded 753c54 a24b6f cf657f ed8099 831c5d c32454
f04f78 f68181 fca790 fdcbb0
```

- **Toda cor na tela sai dela**, inclusive pelagens (a recoloração dos moldes escolhe da paleta), sedas, efeitos,
  texto e interface. Fora da paleta só o que é do sistema (o teclado, o seletor de arquivo).
- **Cada região usa no máximo 32 cores** da mestra (lista no arquivo da região). Isso dá unidade a cada lugar sem
  perder a do jogo.
- **Papéis fixos** (os tokens do `game.css` passam a apontar para eles):
  | Papel | Cor | | Papel | Cor |
  |---|---|---|---|---|
  | contorno e tinta | `2e222f` | | texto claro | `c7dcd0` (destaque `ffffff`) |
  | fundo da interface | `313638` → `374e4a` → `547e64` | | ouro | `f79617` / `f9c22b` / `fbb954` |
  | madeira | `4c3e24` / `9e4539` / `cd683d` | | ganho / perda | `91db69` / `e83b3b` |
  | Fogo | `ea4f36` / `fb6b1d` / `f79617` | | Água | `4d65b4` / `4d9be6` / `8fd3ff` |
  | Grama | `239063` / `1ebc73` / `91db69` | | foco (acessibilidade) | `8ff8e2` |
  | Comum / Mágico / Raro | `9babb2` / `1ebc73` / `4d9be6` | | Lendário / Mítico | `f79617` / `905ea9` |
- **Rampas de sombra**: cada material tem 3 a 5 tons em ordem de valor; a sombra desce um degrau da rampa e puxa para
  o violeta (`45293f`, `694f62`), nunca para o preto.
- **Sem alfa parcial nos sprites**: pixel é opaco ou transparente (alfa 0 ou 255). Translucidez de efeito (névoa,
  véu de chuva) é feita por **troca de paleta** das camadas, pré-desenhadas por clima no início da corrida, ou por
  pontilhado em xadrez de 50%. O clarão do relâmpago é a única camada de tela inteira com alfa, por no máximo 0,3 s.

## 4. Perspectiva e luz

- **Vista lateral**, cavalos correndo da esquerda para a direita. O chão da pista é visto de leve de cima (as raias se
  empilham: a de cima é a mais distante), **sem diminuir o tamanho** com a distância. Desenha-se de trás para a frente:
  céu → horizonte → meio → arquibancada → cerca de trás → pista e cavalos (da raia de cima para a de baixo) → cerca da
  frente → primeiro plano → efeitos → texto.
- **Luz do sol de cima e da esquerda** (de trás do cavalo, a uns 45°). Brilho nas bordas de cima e da esquerda,
  sombra embaixo e à direita. Sombra no chão: elipse achatada de 2 tons sob os cascos, deslocada 2 px para a direita.
  Vale para os assets gerados (o prompt pede "light from the upper left") e para os de código.
- **Perspectiva atmosférica em 3 degraus**: horizonte (contraste baixo, cores puxadas para o céu), meio (contraste
  médio), plano da pista (contraste cheio). O primeiro plano pode ser mais escuro que a pista, para emoldurar.
- **Horário-padrão**: tarde clara. Os climas mudam a paleta das camadas (sol: quente; nublado: dessaturado; chuva: frio
  e escuro; névoa: claro e lavado), não o desenho.

## 5. Contorno

- **Personagens, cavalos, jóqueis, objetos com que se interage e ícones**: contorno de 1 px fechado na cor `2e222f`.
  Nunca preto puro, nunca 2 px. Na borda iluminada o contorno pode clarear para o tom escuro da própria rampa
  (contorno seletivo), desde que a silhueta continue fechada.
- **Cenário: sem contorno.** Separação por valor e cor. Objetos do plano da pista (placas, poste da chegada, cerca)
  podem ter contorno de 1 px no tom mais escuro da sua rampa.
- **Interface**: contorno externo de 1 px `2e222f` e bisel de 1 px (claro em cima e à esquerda, escuro embaixo e à direita).

## 6. Fonte

**Uma família só: Galmuri** (Minseo Lee, licença OFL 1.1 sem nome reservado; github.com/quiple/galmuri). Três
tamanhos da mesma grade e da mesma autora, desenhados pixel a pixel, com Bold de verdade e o português inteiro
(á à â ã é ê í ó ô õ ú ü ç, maiúsculas acentuadas, º e ª do "1º lugar"). Comparação com Jersey, Micro 5, m5x7, Pixel
Operator e Press Start 2P em `docs/arte/fontes-comparacao.png` (renderizadas no tamanho nativo, alfa binário, ampliadas 3×).

| Uso | Fonte | Tamanho (px de arte) | Maiúscula | Entrelinha |
|---|---|---|---|---|
| Títulos, saldo, números grandes, botões principais | Galmuri11 Bold | 12 | 11 | 16 |
| Texto da interface, botões, narração | Galmuri9 | 10 | 9 | 14 |
| Texto pequeno na pista (balões, "VOCÊ", HUD do céu) e legendas | Galmuri7 | 8 | 7 | 10 |

- **Sai**: Press Start 2P, Jersey 10 e a fonte 3×5 do canvas.
- Só nos tamanhos da tabela, sem ampliar. Para um título maior (tela inicial, placa de vitória) usa-se a Galmuri14
  (maiúscula de 14) ou letras desenhadas como arte (o logo), nunca a fonte ampliada.
- **Subconjunto latino** (os arquivos originais têm 2,6 a 4,6 MB por causa do coreano; com `pyftsubset` ficam em poucos
  KB). No canvas, um atlas por tamanho gerado no build (PNG + JSON de larguras).
- Texto claro sobre escuro tem sombra de 1 px `2e222f` embaixo e à direita, nunca contorno de 4 lados (engrossa e embola
  os acentos). Entrelinha com folga de 2 px acima da maiúscula, para o acento.
- Crédito e licença OFL na tela de créditos (exigência da licença).

## 7. Tamanhos por categoria (em pixels de arte, mostrados 1:1)

| Categoria | Quadro | Medidas | Observação |
|---|---|---|---|
| Cavalo com jóquei (corrida, galope de 9 quadros) | 64 × 64 | ~59 × 41 úteis (esguio 52 × 41, robusto 62 × 47) | moldes atuais; recoloridos na paleta |
| Cavalo parado e retrato | 64 × 64 | ~60 × 52 úteis | mesmos moldes; o retrato aparece 1:1 (96 px CSS a 1,5) |
| Personagem de corpo inteiro na cena (treinador, jóquei a pé) | 32 × 48 | 38 a 42 de altura | o cavalo parado tem ~52 px até as orelhas (≈ 2,3 m): 1 m ≈ 23 px, e uma pessoa de 1,75 m ≈ 40 px. Os treinadores de hoje têm 58 a 64 px: 1,5 vez grandes demais |
| Busto para diálogo e cartões | 64 × 64 | | gerado à parte, no mesmo estilo; não é o corpo ampliado |
| Ícone de interface | 16 × 16 | | os de 32 × 32 de hoje são refeitos em 16 (não reduzidos) |
| Ícone na pista (balão de skill, clima) | 8 × 8 | | |
| Objeto de cenário (placa, poste, torre, barraca) | até 64 × 96 | | no plano da pista, mesma escala dos cavalos |
| Camada de paralaxe | 384 de largura (emenda invisível nas pontas), altura livre | | mais larga que a tela (≤ 288): basta uma cópia e meia por quadro |
| Painel 9-fatias | cantos 8 × 8, bordas de 1 a 4 px | | peças recortadas por script, cantos nunca esticados |
| Botão | altura mínima = 48 px CSS em pixels de arte, arredondada para cima | | 32 px de arte a 1,5 CSS; 36 a 1,33 |
| Raia | 20 a 24 de altura | | o cavalo (41 a 47) ocupa duas raias; raias de baixo cobrem as de cima |

## 8. Efeitos e texto na pista

**A faixa das raias** (do pé da cerca de trás ao topo da cerca da frente) é do jogo, não do texto. Nela entram só:
1. o **marcador do jogador** (seta pequena com "VOCÊ" sobre o seu cavalo; um só);
2. **no máximo 2 balões de skill ao mesmo tempo**, de uma linha, ícone 8 × 8 + nome curto, presos ao cavalo, por ~1,5 s;
3. **efeitos presos ao cavalo** (poeira, rastro do elemento, linhas de velocidade, brilho do contorno), sempre atrás do
   cavalo ou em volta dele, nunca sobre o jóquei.

Todo o resto sai da pista:
- **No céu** (faixa reservada de ~24 px no topo): tempo, posição, clima, minimapa e as faixas grandes (Dado da Sorte,
  lugar na chegada). O céu não tem jogo; a faixa do Dado nunca desce para as raias.
- **Abaixo da pista** (HTML): ordem dos corredores, distâncias, narração.
- **No cenário**: placas de distância e "CURVA" são objetos pintados na cerca de trás, não etiquetas flutuantes.
- **Fora da tela**: quem sai pela borda vira uma seta de 8 px na borda, na altura da raia, com a cor da seda; sem
  número de metros.

Efeitos: desenhados em pixels de arte, com cores da paleta e quadros inteiros (sem rotação nem escala suave), presos à
grade. Partículas são retângulos de 1 a 2 px. Nada de `Math.random` (hashes da seed e do tempo, como hoje).

## 9. Orçamento de desempenho (por quadro, celular médio, 60 qps)

| Item | Limite |
|---|---|
| Canvas de trabalho | resolução de arte (~270 × 320); 1 cópia ampliada para a tela |
| Camadas de fundo | pré-desenhadas no início da corrida (uma por clima); ≤ 8 camadas, ≤ 2 `drawImage` cada |
| Cavalos | atlas por corrida (8 cavalos × 10 quadros de 64 × 64, recoloridos uma vez); ≤ 3 desenhos por cavalo (sombra, cavalo, brilho pré-assado) |
| Texto | atlas da fonte; ≤ 120 glifos por quadro; texto parado é assado na camada |
| Partículas | ≤ 150 por quadro (pingos de chuva contam) |
| Chamadas de desenho | ≤ 300 por quadro em resolução de arte (hoje: até 3.905 em resolução do aparelho) |
| JavaScript | ≤ 2 ms por quadro; nenhum objeto novo por quadro no laço da corrida |
| Memória de imagem | ≤ 16 MB por tela |
| Peso por região | ≤ 150 KB de PNG (camadas + objetos), embutidos pelo build |
| Atlas | ≤ 1024 × 1024 cada; PNG + JSON de recortes (serve à web e ao Godot) |

## 10. Acabamento por código (todo asset gerado passa por aqui)

1. **Gerar no tamanho final.** Pixel falso (imagem grande reduzida) é reprovado. Se a ferramenta desenhou pixels
   maiores, usa-se o "unzoom" dela ou detecção da grade, nunca uma redução qualquer.
2. **Quantizar** para a paleta da região (cor mais próxima em CIELAB, sem pontilhado automático).
3. **Alfa binário** (≥ 128 opaco, o resto transparente) e recorte da caixa útil.
4. **Contorno** conforme a seção 5.
5. **Emenda** das camadas de paralaxe (a ponta direita encaixa na esquerda).
6. **Conferência automática** (`prototype/tools/arte-check.mjs`, a criar): cores ∈ paleta, alfa binário, tamanho do
   quadro, grade 1:1 (sem blocos 2 × 2 repetidos), emenda das camadas.
7. **Folha de contato** com o asset ao lado dos vizinhos de cena, na escala do jogo, para a aprovação do Vinicius.
8. **Registro** em `docs/memoria/assets.md` (ferramenta, prompt, parâmetros, seed, custo, uso) e script reprodutível
   (dry-run por padrão, `--gerar`, `--teto N`).
