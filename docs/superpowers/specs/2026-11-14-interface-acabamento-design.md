# Visuais 2, parte 3a: acabamento da interface

Desenho de 2026-11-14. **Aprovado por delegação:** o Vinicius pediu "Decida sozinho a divisão e pode começar".
Branch `claude/visuais-2`, avançada até a `main` (7fe5124).

A parte 3 (interface) junta as quatro frentes que o Vinicius escolheu em 2026-11-12:
- acabamento pixel art;
- tela da corrida;
- celular;
- estábulo e montaria.

O pedido original dele foi "a interface/menu é só uma rolagem para baixo, precisamos melhorar". A parte 3 fica dividida
em três partes, nesta ordem, cada uma com spec, plano e execução próprios:

| Parte | O que entra | Por que nessa ordem |
|---|---|---|
| **3a, acabamento** (esta) | as peças visuais de todas as telas (painel, botão, abas, barras, selos, placas, cabeçalho) desenhadas em pixel art; as fontes dentro do jogo | define as peças que a 3b e a 3c usam |
| **3b, estábulo e montaria no celular** | lista compacta, ficha com o cavalo em destaque, aba Status sem duas telas de rolagem, motivo visível no toque, "º" no leitor de tela | as telas que o 1b reescreveu e as mais compridas |
| **3c, tela da corrida** | painel, posições, Dado, skills, chegada e pódio | é a mais independente (canvas do `fx.js`) |

"Celular" não vira parte própria. Cada parte cumpre as regras de celular da seção 7, e a 3b é a que reduz a rolagem.

## 1. Objetivo e escopo

**Objetivo.** Hoje a interface já tem um estilo de pixel art feito só em CSS: cantos em degrau, bisel, placa dourada e duas
fontes de pixel. Visto de perto, porém, é "CSS liso": molduras de uma cor só, botões chapados, títulos soltos sobre o
piso. A 3a dá às peças o mesmo acabamento dos sprites:
- contorno escuro e bisel em três tons;
- rebites, pregos e veio de madeira desenhados pixel a pixel;
- títulos de tela em placas de madeira;
- um placar dourado para o saldo.

Também põe as fontes dentro do jogo, para o app Android funcionar sem rede.

**Entra:**
- os componentes da seção 4, em todas as telas que os usam;
- as peças de pixel (mapas) e as fontes embutidas pelo build;
- a folha da interface (seção 6);
- os testes;
- as capturas oficiais;
- a memória e o registro dos assets.

**Fica de fora:**
- **Layout:** posição, ordem e tamanho dos blocos (é a 3b).
- **Corrida:** o desenho da corrida no canvas (é a 3c). A caixa do painel da corrida herda o painel novo, como qualquer
  outra caixa.
- **Wiki:** o estilo do wiki (página de consulta; continua com o Google Fonts).
- **Arte nova:** arte gerada no PixelLab ou no Canva.
- **Regras e números:** qualquer regra, número ou texto do jogo, exceto o ⓘ da seção 4.13.
- **Corrida no geral:** nada muda nela, e o `balance.js` continua igual.

## 2. Abordagens consideradas

Teste descartável no Chromium, em densidades 1, 2, 2,625 e 3: painel, botão ouro, botão comum e placa, em 360 px.

1. **Molduras inteiras em mapas de pixel com `border-image` (9 fatias).** O detalhe é o mais rico. Na densidade 2,625
   (comum em Android) aparecem linhas finas nas emendas das fatias: a posição de cada elemento cai em fração de pixel
   físico. O defeito continua com bordas em múltiplos de 8 px e com o meio pintado por cor de fundo. **Descartada.**
2. **Kit de interface gerado no PixelLab.** Gasta créditos e pede confirmação a cada lote. O PixelLab não desenha bem
   peças de 9 fatias, e a paleta foge dos tokens. Além disso, tem o mesmo problema de emenda da abordagem 1.
   **Descartada.**
3. **Camadas: sombras do CSS para as linhas e peças pequenas de pixel por cima** (escolhida).
   - O contorno, os frisos e o bisel continuam em `box-shadow`, em múltiplos de 2 px. Ficam nítidos em qualquer
     densidade, como hoje.
   - O desenho entra em peças pequenas: rebites, pregos, cantos e ícones. São mapas de pixel que viram PNG no build e se
     posicionam por pseudo-elemento.
   - Superfícies como o veio da madeira são texturas repetidas.
   - No teste, ficou nítida e sem emendas em 2,625 e 3. A placa de madeira com veio e pregos foi o ganho mais visível.

## 3. Regras do acabamento

- **Grade:** 1 pixel de arte = 2 px de CSS (`--px`). Contornos, frisos, biséis, sombras e tamanhos das peças são
  múltiplos de 2 px.
- **Linhas sempre por `box-shadow`** (ou `outline` no foco). Nenhum componente usa `border-image`.
- **Peças de pixel:**
  - **Formato:** mapas de texto (um caractere por pixel, `.` transparente), lidos e validados pelo build.
  - **Cores:** cada caractere aponta para um token de cor do `:root` do `game.css`. O build lê o valor do token no
    próprio `game.css`, para a peça não divergir da paleta.
  - **Saída:** viram PNG (via `prototype/tools/png.mjs`) e entram como propriedades CSS `--arte-<nome>:
    url(data:image/png;base64,…)` num bloco `:root` gerado.
  - **Desenho na tela:** com `image-rendering: pixelated`, em tamanho de exibição múltiplo de 2 px.
- **Paleta:** só os tokens de hoje e no máximo 4 novos, todos no `:root`. Os novos possíveis:
  - `--linha-luz`: friso claro do painel;
  - `--ouro-medio`: bisel lateral do botão ouro;
  - `--prego` e `--prego-luz`: cabeça do prego.

  Sem degradê suave em lugar nenhum (já é regra do arquivo).
- **Fonte display:** a Press Start 2P só em 8, 16 ou 24 px. Hoje há 10 regras em 11 ou 12 px: `.status .valor`,
  `.nivel`, `.build-topo .pontos-livres`, `.build-nome`, `.build-mais`, `.inicial .contador`, `.badge-ativa`, `.poder b`,
  `.tag-voce` e `.levelup b`. Cada uma vai para 16 px, se couber a 360 px sem quebrar, ou para a Jersey 10 no tamanho do
  texto em volta. A escolha fica com o executor, mas o teste confere que nenhuma sobra fora de 8, 16 ou 24.
- **Contraste:** texto sobre a cor de fundo de cada variante de botão, chip e selo com pelo menos 4,5:1. Para texto de
  24 px ou mais, ou de 18,66 px ou mais em negrito, 3:1.
- **Modo de cores forçadas** (`@media (forced-colors: active)`, alto contraste do sistema): as sombras somem nesse modo.
  Botões, painéis e abas ganham `border: 2px solid` em cor do sistema, e as peças de pixel ficam escondidas.

## 4. Componentes

As classes são as de hoje; o markup só muda onde a linha diz. "Rebite" é uma peça de 3×3 pixels de arte (6×6 px), em
ouro com sombra.

| # | Componente | Classes de hoje | Acabamento |
|---|---|---|---|
| 4.1 | Painel | `.caixa` | contorno `--sombra` de 2 px por fora do friso `--linha`; bisel interno de 2 px (claro em cima e à esquerda, escuro embaixo e à direita); sombra projetada de 8 px; um rebite em cada canto, a 4 px da borda |
| 4.2 | Painel em destaque | `.caixa` da montaria ativa e das opções escolhidas (`[aria-pressed="true"]`) | igual ao painel, com o friso em `--ouro-escuro` e o bisel claro em `--ouro`. A montaria ativa usa a classe nova `.caixa--destaque` |
| 4.3 | Placa de madeira | `.placa` e títulos de tela (`.titulo--tela`) | madeira com veio (textura de 32×8 pixels de arte, repetida), bisel claro em cima, escuro embaixo, contorno `--sombra` e um prego em cada ponta, no meio da altura. O título de cada tela passa a ficar numa placa; o `h1` continua sendo o `h1` (o markup ganha um envoltório `.placa-titulo` ou o próprio `h1` recebe a classe) |
| 4.4 | Botão | `.btn` | contorno `--sombra` de 2 px; bisel em 3 tons (claro em cima e à esquerda, médio à direita, escuro de 4 px embaixo); sombra de 4 px. Apertado: desce 2 px e a sombra encolhe. Desabilitado: como hoje (opacidade), com o bisel escuro também no topo |
| 4.5 | Botão ouro | `.btn--ouro` | o mesmo desenho em `--ouro-claro`, `--ouro`, `--ouro-medio` e `--ouro-escuro` |
| 4.6 | Botões pequeno, de texto e de perigo | `.btn--pequeno`, `.btn--texto`, `.btn--perigo` | o pequeno herda o botão; o de texto continua sem moldura; o de perigo herda o botão com o texto em `--perda` |
| 4.7 | Opção selecionável | `.opcao` | herda o botão; escolhida = painel em destaque (4.2) |
| 4.8 | Abas | `.abas` (sub-abas da Montaria e da Loja) e a barra de abas de baixo (`.app-abas`) | aba normal = botão; a aba atual "encaixa" no conteúdo (sem a sombra de baixo, com uma marca de ouro de 2 px no topo). A barra de baixo ganha o friso e o contorno do painel, sem rebites |
| 4.9 | Barras | `.barra`, `.barra--seg`, `.barra--xp` | sulco: contorno `--sombra`, borda interna escura de 2 px e fundo `--noite-2`; os segmentos de hoje continuam e ganham 2 px de brilho no topo do preenchimento |
| 4.10 | Selos e chips | `.chip`, `.raridade`, `.selo-nivel`, `.pontos-livres--selo`, `.badge-ativa`, `.set-badge` | canto recortado de 1 pixel de arte (o pixel do canto fica transparente, por `clip-path` em degraus de 2 px), bisel de 2 px e contorno `--sombra`. A cor de cada raridade continua a de hoje |
| 4.11 | Saldo do topo | `.saldo` | placar: contorno `--sombra`, friso `--ouro-escuro`, bisel e um rebite em cada canto |
| 4.12 | Moldura do retrato | `.retrato` | moldura de madeira de 2 pixels de arte (`--madeira`, com `--madeira-luz` em cima) por fora do contorno de hoje. A cena da baia dentro do retrato não muda |
| 4.13 | Botão ⓘ | `ajudaBtn` no `game.js` | o caractere "ⓘ" (que nenhuma das duas fontes tem, e por isso cai na fonte do sistema) vira uma peça de pixel: círculo de 7×7 pixels de arte com o "i", 14×14 px dentro do alvo de 44×44 px de hoje. Nome acessível, `title` e comportamento ficam iguais; o caractere sai do texto do botão |
| 4.14 | Avisos | `.aviso` e `.aviso--perda` (sala aberta, páreo, migração) | a faixa lateral de 4 px de hoje (ouro ou perda) continua; ganham contorno `--sombra` e bisel de 2 px; o texto não muda |
| 4.15 | Foco | `:focus-visible` | o anel de 3 px em `--foco` continua o mesmo, por acessibilidade |

Componentes de hoje que não estão na tabela, como `.slot` e `.produto` (com o equipamento suspenso) e a gaveta DEV, só
precisam continuar funcionando e legíveis. Quando herdam `.caixa` ou `.btn`, herdam o acabamento.

## 5. Fontes dentro do jogo

- **Arquivos:** o subconjunto latino da Press Start 2P (12,5 KB) e da Jersey 10 (13,3 KB), em woff2, em
  `prototype/assets/fontes/`. Vêm do Google Fonts (`fonts.gstatic.com`), com a licença `OFL.txt` de cada família ao
  lado. O subconjunto latino cobre U+0000–00FF, com todos os acentos do português. Ele não tem "→", e esse caractere
  continua caindo na fonte do sistema, como hoje.
- **Embutidas pelo build:** viram `@font-face` com `src: url(data:font/woff2;base64,…) format('woff2'),
  url(https://fonts.gstatic.com/…) format('woff2')`. A segunda origem fica de reserva para o caso de alguma página
  bloquear `data:` em fontes. O `@import` do Google Fonts sai do `game.css`. Isso vale para o `jogo.html`, o
  `jogo-dev.html` e o `preview.html`.
- **Licença:** a OFL permite embutir. O registro vai para `docs/memoria/assets.md`, como fonte de terceiros, sem IA.

## 6. Folha da interface

O build gera `prototype/dist/interface.html`, no mesmo padrão do `icones.html`:
- todos os componentes da seção 4 em todos os estados (normal, foco, apertado, desabilitado, escolhido);
- as variantes (ouro, perigo, raridades, ligas);
- as peças de pixel ampliadas ×4, com o nome de cada uma.

Ela usa o mesmo CSS do jogo, sem duplicar regras. Tem duas colunas, 360 px e largura de desktop, e alterna o modo de
cores forçadas por um botão.

O controlador a publica como artefato para o Vinicius ver cedo. Se ele quiser outro rumo, a execução para e volta ao
desenho.

## 7. Celular (regras para a 3a, a 3b e a 3c)

- A 360 px, nenhuma rolagem lateral. O `checkOverflow` do `ui-test` já confere isso, em todas as telas que ele visita.
- Alvos de toque com pelo menos 44×44 px. Os rebites, pregos e o ⓘ desenhado nunca encolhem o alvo.
- As molduras novas não podem aumentar a altura de nenhuma tela em mais de 4%, medida a 360 px no `ui-test`, com o
  Estábulo de 3 cavalos e a aba Status. A 3a não é a parte que corta rolagem, mas também não pode piorá-la.
- Áreas seguras (`env(safe-area-inset-*)`) continuam respeitadas.
- O botão apertado se move 2 px, e isso continua com movimento reduzido (é retorno de toque, não animação). Nenhuma
  animação nova.

## 8. Testes

O build valida as peças e falha com a mensagem do mapa e da linha. Ele confere que:
- cada mapa é retangular;
- todo caractere está na legenda;
- todo token existe no `:root`;
- largura e altura ficam entre 1 e 64 pixels de arte;
- nenhum nome se repete.

**`ui-test.mjs`** (novo bloco `acabamento`, filtrável por `UI_SO=acabamento`):
1. **Fontes sem rede:** abre o jogo com as rotas `fonts.googleapis.com` e `fonts.gstatic.com` bloqueadas.
   `document.fonts.check('16px "Press Start 2P"')` e `document.fonts.check('20px "Jersey 10"')` dão verdadeiro, e a
   lista de `document.fonts` mostra as duas faces carregadas.
2. **Tamanhos da display:** em cada tela visitada, nenhum elemento visível com `font-family` começando por "Press Start
   2P" tem `font-size` fora de 8, 16 ou 24 px.
3. **Sem `border-image`:** nenhum elemento visível tem `border-image-source` diferente de `none`.
4. **Peças no lugar:**
   - `.caixa`, `.saldo` e `.placa` têm um pseudo-elemento cujo `background-image` contém `data:image/png`;
   - o ⓘ não tem mais o caractere "ⓘ" no texto e mostra a peça;
   - as peças aparecem com `image-rendering: pixelated`.
5. **Contraste:** para `.btn`, `.btn--ouro`, `.btn--perigo` e para cada `.raridade-*` e `.chip` visíveis, a razão
   entre a cor do texto e a cor de fundo calculadas fica em 4,5:1 ou mais. Texto grande segue a regra da seção 3.
6. **Altura:** a altura total do Estábulo (3 cavalos) e da aba Status a 360 px é no máximo 4% maior que a medida
   antes da 3a. A medida de antes fica fixada no teste, com a data.
7. **Cores forçadas:** com `forcedColors: 'active'` na página, `.btn` e `.caixa` têm `border-top-width` de pelo menos
   2 px e as peças de pixel ficam escondidas.
8. **Densidade:** uma captura da folha da interface em densidade 2,625, só para o controlador olhar. Ela não entra em
   `prototype/screens/`.

Os blocos que já existem continuam passando sem afrouxar: overflow, alvos de 44 px, ⓘ, trava do páreo, desempenho
do desenho por quadro. As capturas oficiais de `prototype/screens/` são regeneradas: a interface muda de propósito.

## 9. Desempenho e peso

- O jogo cresce no máximo ~45 KB: as fontes em base64 (~35 KB) e as peças (menos de 8 KB).
- Nenhum JS novo roda por quadro. O desenho da corrida não muda, e a medida de tempo por quadro do `ui-test` continua
  dentro do limite de hoje.
- Os pseudo-elementos com imagem são um por componente; no Estábulo com 6 cavalos, são menos de 40.

## 10. Documentos e memória

- **`docs/GDD.md`**, seção da arte: a receita das camadas e as fontes embutidas.
- **`docs/memoria/assets.md`:**
  - fontes: origem, licença OFL e tamanho;
  - peças de pixel: feitas à mão em mapas, sem IA e sem custo.
- **`docs/memoria/decisoes.md`:** a divisão da parte 3, a abordagem escolhida e o motivo, mais as decisões da execução.
- **`docs/memoria/ESTADO.md`:** a 3a pronta e os próximos passos (3b, 3c).

## 11. Riscos

- **O gosto é do Vinicius.** A folha da interface vai para ele logo que fica pronta (seção 6), e ele pode mudar o rumo
  antes de as telas mudarem.
- **Peças em posição fracionada.** Numa densidade como 2,625, um rebite pode ficar com um pixel físico a mais de um
  lado. É aceito: não cria emendas, e o teste descartável da seção 2 mostrou que fica imperceptível.
- **A placa nos títulos aumenta um pouco a altura** das telas. O limite de 4% (seção 7) prende isso, e a 3b reduz a
  rolagem de verdade.
