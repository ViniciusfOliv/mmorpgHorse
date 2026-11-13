# Visuais 2, parte 2a: marcas, jóquei e raridade visível

Especificação da parte 2a da frente "Visuais 2", desenho aprovado em 2026-11-12. A parte 2 (cavalos) tem três
subpartes, cada uma com especificação, plano e execução próprios, nesta ordem:
- **2a** (esta): visual por cavalo em código, sem créditos;
- **2b**: portes novos por elemento no PixelLab, cada porte com a sua crina e cauda;
- **2c**: animações novas para todos os desenhos, no PixelLab.

Branch `claude/visuais-2`, recriada da `claude/cavalos-v3` (f7a2d4b), onde a parte 1 (ícones) já entrou.

## 1. Objetivo e escopo

**Objetivo.** Dois cavalos do mesmo elemento deixam de parecer cópias. Cada cavalo ganha marcas na pelagem,
que o potro herda dos pais. O jogador ganha um jóquei com a cara dele, e a raridade passa a aparecer no
próprio cavalo.

**Entra:**
- três genes de marcas (cara, patas, corpo) com herança pela seed;
- marcas escolhidas à mão para os iniciais e os selvagens;
- o jóquei do jogador (padrão da seda, cor do capacete e da manta), com editor no Perfil;
- efeitos de raridade em escada;
- testes, wiki e capturas.

**Fica de fora:** portes, crinas e animações novos (2b e 2c); qualquer efeito de marca, jóquei ou raridade na
corrida, no Poder ou no preço; marcas no desenho em código, que é só a reserva quando os desenhos do
PixelLab não carregam. Nada gasta créditos.

## 2. Genes de marcas e herança

**Valores** (em `GameData.MARCAS`):

| Gene | Valores (ids) |
|---|---|
| `cara` | `nenhuma`, `estrela`, `listra`, `frente` (frente branca) |
| `patas` | `0`, `1`, `2`, `3`, `4` (número de meias brancas) |
| `corpo` | `liso`, `malhado` (manchas brancas grandes), `pintado` (pintas escuras pequenas), `ruao` (pelos brancos salpicados) |

O cavalo guarda `marcas: { cara, patas, corpo }`. As marcas não entram em status, Poder, preço, chance de skill
nem na corrida.

**Potro** (`breed.js`):
- usa uma sequência de sorteios própria das marcas: `mulberry32(hash2(seedBase >>> 0, 0x4D410000 + breedCounter))`;
- os sorteios que já existem no `foal()` (os passos 1 a 8 do cabeçalho) não mudam em número nem em ordem: o
  mesmo potro nasce igual em todo o resto;
- para cada gene, na ordem `cara`, `patas`, `corpo`, há sempre 2 sorteios:
  - 1º: `< GameData.MARCAS.mutacao` (0,10) ⇒ mutação;
  - 2º: com mutação, índice uniforme na lista do gene; sem mutação, `< 0,5` ⇒ o gene da égua, senão o do
    garanhão;
- pai sem `marcas` válidas vale como as marcas calculadas do identificador dele (abaixo);
- o Mítico continua sem nascer de cruzamento.

**Iniciais e selvagens** (marcas fixas, em `data.js`, junto de cada cavalo):

| Cavalo | Cara | Patas | Corpo |
|---|---|---|---|
| Brasa | estrela | 1 | liso |
| Maré | listra | 0 | ruão |
| Ipê | frente | 2 | liso |
| Faísca | estrela | 2 | pintado |
| Lambari | nenhuma | 0 | malhado |
| Capim | listra | 4 | liso |
| Tição | frente | 1 | liso |
| Garoa | estrela | 0 | ruão |
| Mandacaru | nenhuma | 3 | pintado |
| Ventania | listra | 2 | malhado |
| Pororoca | estrela | 4 | liso |
| Fogaréu | frente | 0 | pintado |
| Jequitibá | listra | 1 | ruão |
| Boitatá | estrela | 2 | malhado |
| Iara | nenhuma | 4 | ruão |

**Rivais das salas:** são cópias dos cavalos do catálogo (`clone` do modelo) e usam as marcas fixas do modelo.
Só o jóquei deles sai da seed da sala (seção 4). A sala salva não muda.

**Cavalos que já existem no save** (potros, alugados, qualquer um sem `marcas`):
- com modelo do catálogo (`templateId`, por exemplo um alugado), vale a marca fixa do modelo;
- sem modelo, `Breed.marcasDoId(chave)` calcula as marcas do `uid`: hash FNV-1a de 32 bits da chave
  (`Breed.hashChave`), `mulberry32` e 3 sorteios uniformes;
- o mesmo cavalo sempre fica igual, sem sorteio novo;
- a versão do save não muda. O `sanitize` aceita `marcas` só com os três valores válidos; qualquer outra coisa
  vira `marcasDoId`.

**Na tela:**
- a ficha do cavalo ganha a linha "Marcas: estrela, 2 meias, malhado". Sem marcas: "Marcas: nenhuma";
- o Haras mostra a linha de marcas da égua e do garanhão.

## 3. Desenho das marcas

Só nos desenhos do PixelLab (os moldes), em todas as telas: retrato, parado, galope e pódio.

**Zonas, calculadas uma vez por quadro do molde** a partir dos papéis e das âncoras que o molde já tem:
- **cara:** pixels de pelagem a até 0,19 × `larguraUtil` do focinho (`nose`; `larguraUtil` é a largura do retrato do
  molde, igual em todos os quadros) e com `y ≤ nose.y + 1`. Raio e corte presos ao focinho, para a zona não
  derivar no galope nem pegar o pescoço;
- **patas:** pixels de pelagem abaixo da linha da barriga (`footY − 0,30 · altura do cavalo`), separados em até 4
  pernas: componentes 4-conexas da zona de patas, partidas no vão entre cascos das 3 linhas de baixo. Lado com
  mais de 2 pernas junta a menor com a vizinha. Ordem fixa: traseira de perto, dianteira de perto, traseira de
  longe, dianteira de longe;
- **corpo:** o resto da pelagem.

As zonas valem para qualquer molde, inclusive os portes da 2b.

**Limite conhecido (aceito até a 2b; as 4 pernas resolvidas na 2b em 2026-11-13, com exceções aceitas; a contagem de
meias segue para a 2c, ver abaixo).** Nos moldes de 2026-11-08, pernas
que se encostam no desenho contam como uma, e por quadro se acham de 2 a 4 pernas. Medição da revisão final:

| Molde  | Retrato | Parado | Galope |
|--------|---------|--------|--------|
| folhas | 2       | 4      | 2 a 4  |
| chamas | 4       | 3      | 2 ou 3 |
| ondas  | 3       | 2      | 2 a 4  |

Por isso 3 e 4 meias podem aparecer como 2 ou 3 num quadro, e no galope a 3ª e a 4ª meia aparecem e somem
conforme as pernas se cruzam. 1 e 2 meias são estáveis. O código das pernas não muda na 2a; separar as 4 pernas
nos moldes novos (retrato e parado) é requisito da 2b, com um teste de contagem de meias por molde.

**Na 2b (T7 e revisão final, 2026-11-13): 4 pernas resolvidas na maioria dos moldes; contagem de meias para a 2c.**
Os 4 moldes acima saíram; os 12 moldes dos portes têm 4 pernas no retrato e no parado, fora as contagens aceitas pelo
Vinicius (esguio-lisa e esguio-ondas no parado, 2; padrao-folhas no parado e robusto-chamas no retrato, 3, na folha;
robusto-folhas no retrato, 3, depois que a canela de crina voltou à pelagem na rodada de correção 1 da T7, aceito na
revisão final). No galope, pelo menos 2 em todo quadro. O `moldes-test` confere isso e conta as meias por molde (N
meias = N manchas brancas no retrato e no parado). Ficam fora dessa conta, medidos e listados no teste
(`PENDENTES_2A.meias`): 5 dos 24 retratos e parados, por meias de pernas vizinhas que se encostam (viram uma mancha) ou
pela ponta do casco separada pelo contorno (uma mancha a mais). **Ficam para a 2c**, por decisão do Vinicius
(2026-11-13), com a zona da cara que pulsa no galope em 5 moldes (`PENDENTES_2A.caraPresa`).

**Pintura** (só sobre pixels de pelagem e pelagem-sombra; contorno, crina, jóquei e sela não mudam):

| Marca | Como |
|---|---|
| estrela | mancha de 2 a 3 px no meio da zona da cara |
| listra | faixa de 1 a 2 px descendo da testa ao focinho |
| frente | toda a zona da cara |
| N meias | as 3 linhas de baixo das N primeiras pernas achadas, na ordem fixa (quadro com menos pernas só pinta as que achou) |
| malhado | 2 a 4 manchas grandes no corpo |
| pintado | pintas de 1 px no corpo, na sombra da pelagem |
| ruão | 30% dos pixels do corpo trocados por branco, em padrão fixo |

- O branco é o creme `#f1e9d4`; sobre a pelagem-sombra, o creme sombreado.
- Os padrões de malhado, pintado e ruão ficam presos às coordenadas relativas à sela (`saddle`), para não
  "nadarem" entre os quadros do galope. O retrato não tem sela (âncora `saddle` nula); nele a referência é o
  centro da caixa do cavalo. A semente do padrão é a do cavalo (`marcasDoId` da chave dele), então dois
  malhados não ficam iguais.
- **Cache:** o molde recolorido passa a ser guardado por paleta + marcas + jóquei + raridade. Na corrida, cada
  cavalo é montado uma vez na largada.

## 4. Jóquei do jogador

- `state.joquei = { padrao, capacete }`. Padrões em `GameData.JOQUEI.padroes`: `liso`, `listras`, `faixa`,
  `xadrez`, `estrelas`, `losangos`. Capacete: uma das 8 cores de `GameData.JOQUEI.capacetes`. O padrão
  inicial é `liso` com o capacete dourado `#f2c230`.
- **Seda:** continua na cor de hoje (a sua é a dourada; a dos rivais, a cor da raia), para a corrida seguir
  legível. O padrão é pintado por cima, num tom mais claro ou mais escuro da mesma cor, em cerca de 35% dos
  pixels da roupa.
- **Capacete:** os pixels da roupa do jóquei acima da linha da cabeça (o grupo de cima do papel `jóquei-roupa`)
  levam a cor escolhida.
- **Manta:** os pixels de sela levam um tom escuro da cor do capacete.
- **Rivais:** padrão e capacete de `hash2(seedDaSala, 0x4A4F0000 + raia)`.
- **Editor no Perfil:** seção "Seu jóquei", com 6 botões de padrão, 8 de cor de capacete e o seu cavalo ativo
  montado de exemplo. A mudança grava na hora (grava como as outras opções do Perfil; se a gravação falha,
  nada muda). Vale para todos os seus cavalos.
- O `sanitize` aceita só valores das listas; qualquer outra coisa volta ao padrão inicial.

## 5. Raridade visível

Efeitos na cor da raridade (`RARITIES[*].color`). O contorno brilhante continua sendo só da skill ativa.

| Raridade | Efeito |
|---|---|
| Comum | nada |
| Mágico | uma faixa de brilho corre pela crina a cada 1,2 s (mistura de 25% da cor da raridade clareada, a mesma do rastro; escurecida só nas crinas em que a clareada some, ver abaixo) |
| Raro | o brilho na crina (30%) e 3 faíscas piscando em volta |
| Lendário | o brilho mais forte (45%) e 5 faíscas |
| Mítico | o mesmo do Lendário e um rastro de luz atrás do cavalo no galope da corrida |

- **Cor do brilho** (corrigida na 2b, decisão do Vinicius em 2026-11-13): o brilho é um reflexo claro. Fica a cor da
  raridade clareada (mistura de 35% com o creme, a da 2a; a cor pura sumia na crina verde da Grama) sempre que ela muda
  a luminância relativa da crina do cavalo (`palette.mane`), no alfa de pico, em pelo menos 0,05. Só onde não muda,
  vale a clareada ou a escurecida (35% com o roxo escuro das sombras), a de maior diferença; se nenhuma das duas chega a
  0,05, as duas vão mais longe (45%, 55%, 65%) e fica a primeira que chega. Com a clareada fixa, o brilho sumia em 14
  combinações do catálogo (a pior, o Mágico na crina laranja do Tição: 0,005). Com a regra, as 60 combinações do
  catálogo (15 crinas × Mágico, Raro, Lendário e Mítico) ficam ≥ 0,05: 46 continuam na clareada, 13 passam à escurecida
  e 1 (o Mítico no Mandacaru) à clareada de 45%; a menor é o Lendário na crina da Faísca, 0,052, na clareada. Só cores
  (`sprites.js`, `corBrilho`), sem sorteio; o rastro do Mítico continua na clareada.
- **Onde:** retrato (estábulo, ficha, Haras, selvagens), parado (sala), corrida e pódio.
- **Faíscas:** posições fixas em volta da caixa do cavalo, calculadas da chave dele. Cada uma é uma cruz de
  1 px que pisca com fase própria, desenhada pelo tempo de animação (sem `Math.random`).
- **Rastro do Mítico:** 3 faixas que somem atrás da âncora traseira, no comprimento do passo do galope. Só
  aparece na corrida.
- **Movimento reduzido** (`prefers-reduced-motion` ou a opção do jogo): brilho da crina parado, faíscas fixas
  e sem rastro.
- **Custo:** o brilho da crina recolore só os pixels de crina, e as faíscas e o rastro são poucos retângulos
  por quadro.

## 6. Arquivos

| Arquivo | O que muda |
|---|---|
| `prototype/src/data.js` | `MARCAS` (listas e `mutacao`), `JOQUEI` (padrões e capacetes), `marcas` dos iniciais e dos selvagens |
| `prototype/src/breed.js` | marcas do potro (sequência própria), `marcasDoId(chave)`; cabeçalho de documentação |
| `prototype/src/marcas.js` (novo, puro, sem DOM) | zonas por quadro, pintura das marcas e do jóquei como camadas de índices, posições das faíscas; testável no Node |
| `prototype/src/sprites.js` | âncoras por quadro, recoloração com as camadas do `marcas.js`, efeitos de raridade, cache |
| `prototype/src/fx.js` | rastro do Mítico na corrida (se ficar melhor ao lado dos outros efeitos da corrida) |
| `prototype/src/game.js` | `sanitize` de `marcas` e `joquei`, ficha, Haras, editor do Perfil, rivais pela seed, ligação com o desenho |
| `prototype/src/dev.js` | gaveta DEV: marcas e raridade do cavalo montado |
| `prototype/tools/sim-test.js`, `moldes-test.mjs`, `fx-test.js`, `ui-test.mjs` | testes da seção 7 |
| `prototype/tools/wiki.mjs` | seção "Marcas e jóquei" no wiki |
| `prototype/comparativo.html` (página de conferência dos moldes) | combinações de marcas e raridades lado a lado |
| `docs/GDD.md`, `docs/memoria/*`, `prototype/screens/` | regra nova, memória e capturas |

Não mudam: `sim.js` (a corrida) e `gear.js`. `prototype/dist/` e `docs/wiki.md` só saem do build.

## 7. Testes

**Herança e dados (`sim-test.js`):**
- mesma seed e mesmos pais ⇒ mesmas marcas;
- o potro com marcas é igual, campo a campo, ao potro de antes da 2a, fora o campo `marcas` (os sorteios antigos
  não mudaram);
- em 10.000 potros de pais com marcas diferentes:
  - mutação entre 8,5% e 11,5% por gene;
  - sem mutação, a égua entre 47% e 53%;
- `marcasDoId`: determinístico, sempre com valores válidos e cobrindo todos os valores em 1.000 chaves;
- iniciais e selvagens com as marcas da tabela da seção 2.

**Zonas e pintura (`moldes-test.mjs`, com um molde sintético e com os 4 moldes reais):**
- cara perto do focinho e patas abaixo da linha da barriga; pernas encontradas, em 2 a 4 por quadro nos moldes
  atuais (limite conhecido da seção 3). **Requisito dos moldes novos da 2b:** 4 pernas no retrato e no parado; no
  galope, pelo menos 2 em todo quadro (ajustado na 2b em 2026-11-13: de lado as pernas se cruzam no galope); com um
  teste de contagem de meias por molde;
- cada marca só muda pixels de pelagem da zona dela;
- `frente` cobre a zona da cara;
- `ruao` troca de 25% a 35% do corpo;
- o padrão é igual nos 9 quadros do galope em coordenadas relativas à sela.

**Jóquei e raridade (`fx-test.js` ou `moldes-test.mjs`, contexto falso):**
- o padrão só muda pixels da roupa, e a cor de base (a da raia) continua a mais frequente na roupa;
- o capacete fica na cor escolhida;
- Comum não desenha efeito;
- faíscas: 0 / 0 / 3 / 5 / 5 por raridade;
- o rastro só aparece no Mítico e só na corrida;
- com movimento reduzido, quadros diferentes dão o mesmo desenho.

**Interface (`ui-test.mjs`):**
- o editor do jóquei grava padrão e capacete, a prévia muda e o valor volta ao reabrir;
- a ficha mostra a linha de marcas, e o Haras mostra as marcas dos pais;
- um potro nasce com marcas válidas;
- um save sem `marcas` e sem `joquei` abre com os valores calculados e padrão;
- nenhuma imagem quebrada nem rolagem horizontal no celular.

**Regras:**
- a corrida dá o mesmo resultado (os testes de determinismo que já existem);
- `./scripts/check.sh` passa;
- capturas novas em `prototype/screens/`.

## 8. Riscos

1. **Zona da cara ou das pernas fora do lugar num molde** (por exemplo, a estrela no pescoço). A página de
   conferência mostra todas as marcas nos 4 moldes antes de ligar no jogo, e o plano reserva um ajuste dos
   limites (0,19 e a linha da barriga) por molde, se precisar.
2. **Manchas "nadando" no galope.** O padrão preso à sela reduz isso; quem confere é a página de conferência
   (galope animado).
3. **Corrida mais pesada** com 8 cavalos recoloridos e efeitos. A montagem é feita uma vez na largada, e o teste
   de interface já mede o tempo de desenho por quadro.
4. **Merge com o bloco 1b**, que muda o save para v6 e mexe no Perfil e na ficha. Os campos novos são opcionais,
   sem versão nova, para o merge ser simples.
