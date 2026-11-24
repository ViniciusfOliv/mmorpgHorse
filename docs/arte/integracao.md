# Guia de integração visual — Galope Elemental

> **Para quem:** todo chat de arte (geração no PixelLab, Retro Diffusion) e todo chat de código que desenha na tela (`prototype/src/sprites.js`, `fx.js`, `game.js`, ferramentas em `prototype/tools/`).
> **Complementa:** `docs/arte/guia.md` (grade inteira, Resurrect 64, Galmuri, tamanhos, orçamento §8–§9, acabamento §10). Quando este guia propõe mudar uma regra de lá, isso vem marcado como **[proposta de mudança no guia]** e precisa do OK do Vinicius (lista na §5, "Decisões pendentes").
> **Legenda:** **[doc]** = confirmado na documentação do PixelLab (`openapi.json`, `llms.txt`, `mcp/docs`) · **[recomendação]** = prática nossa, tirada de fontes de pixel art ou da auditoria, ainda não testada no jogo · **[NÃO CONFIRMADO]** = medir antes de afirmar.
> **Créditos:** nenhuma chamada paga sem confirmação do Vinicius (CLAUDE.md §7 e §9). Antes de gastar, rodar `GET /balance` (e `GET /pro-flash/cost` para Pro Flash).

---

## 1. Objetivo e referências

### 1.1 Objetivo
Pedido do Vinicius: "o melhor do PixelLab, mais artístico, movimentos, cenário bonito e de acordo com nossa proposta; cuidado para o personagem não parecer uma foto PNG por cima de um background, tudo deve combinar".

Na prática: **cavalo, treinador, objeto, efeito e cenário têm de parecer feitos pelo mesmo artista, na mesma hora do dia, no mesmo chão e se movendo no mesmo ritmo.** Um asset só entra no jogo se passar no checklist da Regra 10.

### 1.2 As referências
- `docs/arte/referencias/2026-11-24-estilo-acampamento-barco.png`: acampamento com fogueira, barraca e varal; barco na água.
- `docs/arte/referencias/2026-11-24-estilo-casas.png`: duas casas na clareira, com árvores e caminhos de terra.

**O que as torna boas, concretamente** (leitura visual da auditoria, não da documentação):

| # | O que elas fazem | Por que "cola" o objeto no chão |
|---|---|---|
| R1 | **Uma câmera só:** tudo em 3/4 de cima ("high top-down"). O telhado mostra as 2 águas, o barco e as toras são vistos de cima, as copas são redondas. | Nenhum objeto parece de outro jogo. |
| R2 | **Uma luz só:** vem de cima e da esquerda. O brilho fica na borda de cima e da esquerda, e toda sombra cai para baixo e para a direita (árvores, casa, barraca, barco). Não há contraluz: o brilho é só o degrau claro da rampa. | Mesmo sol para todos. |
| R3 | **A sombra tem a cor do chão, só mais escura:** verde-escuro na grama, azul-petróleo na água. Nunca cinza nem preto translúcido. A sombra é opaca, com 1 ou 2 tons. Vista de cima, é a silhueta inteira deslocada na diagonal. | O chão "recebe" a sombra; o objeto pesa sobre ele. |
| R4 | **Rampas de 4 a 6 tons por material**, com hue shift (a luz puxa para o quente, a sombra para o frio e o violeta). | Volume e luz coerentes. |
| R5 | **Contorno seletivo na cor do material:** vinho na barraca, verde-escuro nas copas, marrom na madeira. Não há um quase-preto único, e não há contorno onde o objeto toca o chão. | O objeto não fica "recortado". |
| R6 | **Contato com o chão:** tufos de grama e flores cobrem a base da casa e da barraca, há pedrinhas em volta, a terra fica gasta perto da fogueira, há um anel de espuma em volta do barco. | O objeto "entra" no chão em vez de pousar sobre ele. |
| R7 | **O mesmo grão em tudo:** o mesmo tamanho de pixel e a mesma densidade de detalhe no objeto e no fundo. O chão tem tufos agrupados de 3 a 5 px e nada de ruído de 1 px solto. | Nenhuma peça parece "de outra resolução". |
| R8 | **Moldura:** árvores escuras nas bordas emolduram o objeto do centro, que é o de maior contraste. | A leitura vai para o centro. |
| R9 | **Juntas entre terrenos:** o caminho de terra tem borda irregular, a grama invade a terra em tufos, há pedrinhas e flores espalhadas e terra gasta. | O chão é contínuo; nada parece "tabuleiro". |

Cada painel tem uns 250 px de tela. O tamanho nativo dos pixels de arte **não foi medido**: antes de usar as referências em qualquer chamada, detectar a grade e trazer de volta a 1:1 (guia §10.1).

### 1.3 Antes de usar as referências (passo 0, sem créditos)
1. **Origem.** Confirmar com o Vinicius de onde vieram as duas imagens e registrar em `docs/memoria/assets.md`. Se forem de terceiros ou de origem incerta, **não** usá-las como `style_image` nem `reference_image`: ficam só na prancha de comparação, e a âncora de estilo passa a ser a nossa 1ª cena aprovada.
2. **Cabe na Resurrect 64?** As referências usam verdes oliva dessaturados e terra rosada; os verdes da R64 (`1ebc73`, `91db69`) são bem mais saturados. Quantizar as duas referências para a R64 (CIELAB, sem pontilhado), pôr lado a lado na prancha e decidir quais rampas de grama e terra seguram o clima delas. Se nenhuma segurar, registrar uma **[proposta de mudança no guia §3]** com as rampas escolhidas. Sem esse passo, `target_palette` puxa a saída para longe da referência sem avisar.

---

## 2. Regras de integração

Cada regra traz três partes: **GERAÇÃO** (o que pedir ao PixelLab), **CÓDIGO** (o que fazer no canvas, sempre em grade inteira, sem alfa parcial, cores da Resurrect 64, dentro do orçamento do guia §9) e **TESTE** (o que confere automaticamente ou a olho).

Os testes automáticos propostos entram no `prototype/tools/arte-check.mjs`, que o guia §10.6 já manda criar, e no `ui-test`/`moldes-test` quando dependem da tela. **[recomendação]**

**Princípio de desempenho (vale para todas as regras):** tudo o que depende de clima, luz, sombra, contorno ou ondulação é **pré-assado fora do laço da corrida** (na montagem do atlas ou no início da corrida). No laço, só `drawImage` 1:1 × s inteiro: nada de `getImageData`/`putImageData`, nada de objeto novo por quadro, ≤ 3 desenhos por cavalo e ≤ 300 chamadas por quadro (guia §9).

**Movimento reduzido (vale para todas as regras):** no modo "reduced" do `fx.js` (`fx.js:1406–1407`), tudo o que é só ambiente (ondulação da água, tufos que balançam ou se curvam, espuma piscando, transição de clima) usa quadro fixo.

### Regra 1 — Uma luz por cena, de cima e da esquerda
- **GERAÇÃO:**
  - No texto, sempre "light from the upper left, top-left lighting, hue-shifted shading". Reusar **a mesma âncora de estilo** (`style_image`/`style_images`) em todas as chamadas da mesma tela. **[recomendação: texto]**
  - O `generate-image-v2` não tem campo de luz nem de `view`: só texto e referências. O `pixen` não tem `shading`. **[doc]**
  - Onde há `shading`/`detail`, os enums **não são iguais entre endpoints**: usar a tabela de equivalência abaixo e manter o mesmo **nível** em toda a tela. **[doc: existência dos campos; conferir os valores exatos no `openapi.json` antes de cada lote]**

  | Nível nosso | pixflux / inpaint antigo / tileset | `/map-objects` | pixen |
  |---|---|---|---|
  | Sombreado | `detailed shading` (ou `highly detailed shading`) | `detailed shading` (máximo; não há `highly detailed shading`) | sem campo `shading` |
  | Detalhe | `highly detailed` | `high detail` | `detail` (padrão `highly detailed`) |

- **CÓDIGO:** uma tabela `LUZ_CENA` por tela e por condição (dia, tarde, noite, chuva, neblina, calor) com: tipo de vista (Regra 2), direção (dx, dy) da sombra projetada, cor da sombra, fonte emissiva local (se houver, para o contraluz da Regra 8) e a LUT de grading (Regra 8). Tudo vem de tabela, sem `Math.random`. A virada de clima continua pela RNG da seed (CLAUDE.md §8): o grading só mostra o clima, nunca entra na simulação.
- **TESTE:**
  - (a) automático, "lado iluminado": para cada material, comparar o **índice do degrau na rampa** (não a luminância absoluta) dos pixels de borda de cima e da esquerda com os de baixo e da direita **do mesmo material**. Falha se, em média, o lado de cima/esquerda não for mais claro. Assim a crina preta do baio ou do zaino no alto do sprite não reprova um sprite certo. **[recomendação]**
  - (b) visual: na prancha de contato (§5), conferir se todas as sombras apontam para o mesmo lado.

### Regra 2 — Sombra opaca, de contato e projetada, na cor do chão
Problema atual (auditoria): a sombra do cavalo são 2 linhas de `rgba(20,10,20,0.28)` (`prototype/src/sprites.js` ~1311–1321 e ~877–882). É translúcida, fica fora da paleta, está centrada (o guia §4 pede 2 px para a direita) e é quase invisível. Os treinadores não têm sombra. Esta é **a causa nº 1 do "PNG colado"**.
- **GERAÇÃO:** gerar personagens e props **sem sombra e com fundo transparente** ("no shadow, transparent background"). A sombra é sempre a do código, para obedecer à luz da cena. Exceção: um prop gerado **dentro** do cenário por inpaint (Regra 9) pode vir com sombra pintada, desde que siga a direção da cena.
- **CÓDIGO:**
  1. **Forma da sombra por tipo de vista** (tabela em `LUZ_CENA`):

     | Vista | Sombra |
     |---|---|
     | Lateral (corrida) | Elipse de 2 tons sob os cascos, deslocada +2 px para a direita (guia §4). |
     | 3/4 de cima (mapa, vila, estábulo, trilha, arena) | Silhueta **inteira** do quadro, sem achatar, deslocada (dx, dy) para baixo e para a direita, 1 tom. Como o barco da referência. |
     | Objeto alto de cenário (casa, árvore, placa) | Silhueta cisalhada na diagonal para baixo e para a direita, 1 tom. |

  2. **Cor:** o **degrau 1 abaixo na rampa do chão** da cena (cor fixa da tabela, não lida da tela). Exemplos: grama `547e64 → 374e4a`; terra `ab947a → 966c6c`; água `0b8a8f → 0b5e65`; pista laranja do Litoral `cd683d → 9e4539 / 6e2727`.
  3. **Um sprite de sombra só:** contato (faixa de 1 a 2 px sob os cascos ou pés, 2 degraus abaixo) e projetada vão **juntos num sprite**, pré-assado por quadro e por condição na montagem do atlas, a partir da silhueta do quadro (tingida com `source-in`, a função que já existe em `sprites.js` ~1338). Qualquer cisalhamento ou achatamento é feito **amostrando linhas de pixel de arte** nessa montagem; no laço, a sombra é desenhada 1:1 × s inteiro. Nada de `drawImage` com escala não inteira.
  4. **Oclusão do chão** ("escurecer 1 degrau os pixels do chão em volta do pé") depende da cor real do chão embaixo. Na corrida, fica só **aproximada pela cor fixa** do sprite de sombra. Nas telas paradas (mapa, estábulo), pode ser pré-assada na camada do chão.
  5. Chuva ou neblina: só a sombra de contato, ou a projetada em 1 degrau mais claro da rampa. **Nunca alfa, nunca xadrez sobre o personagem** (Regra 8).
  6. Orçamento: sombra + cavalo (com contraluz já embutido no atlas) = 2 a 3 desenhos por cavalo (guia §9).
  7. A mesma sombra vale para treinadores, placas, marcadores do mapa e objetos.
- **TESTE:**
  - (a) automático, **com catraca**: varrer o código de desenho atrás de qualquer fonte de alfa parcial — `rgba(`/`hsla(` com alfa ≠ 0 e 1, `globalAlpha` ≠ 0 e 1, `#rrggbbaa`, `ctx.filter`, gradientes, `imageSmoothingEnabled = true`. Hoje há 23 casos em `fx.js` (ex.: `fx.js:1537`, `rgba(255,196,110,0.05)` no sol), 24 em `sprites.js` e 5 em `game.js`: eles entram numa lista de exceções que **só pode diminuir**. A única exceção permanente é o relâmpago (guia §3).
  - (b) Na captura do `ui-test`, o pixel logo abaixo e à direita do casco ≠ cor do chão vizinho e ∈ rampa do chão.
  - (c) Visual: o cavalo não "flutua" na prancha 1× e 3×.

### Regra 3 — Contorno seletivo na cor da rampa
Problema atual: o contorno do molde é o fixo `#1a1405` (`sprites.js:929`, `MOLDE_CORES_FIXAS.contorno`), quase preto e fora da paleta antes do `coresNaMestra`. A pele `#e8b48a` e a sela `#5a3a22` também vêm fora da paleta. O personagem é a única coisa da tela com linha escura fechada.
- **GERAÇÃO:**
  - Personagens e itens interativos com `outline: 'selective outline'` onde o endpoint tem o campo (`/map-objects`, pixflux; pixen aceita `single color outline` ou `selective outline`). Cenário e terreno com `outline: 'lineless'` (pixen). **[doc: valores do campo]**
  - No `create-character-v3`, o `outline` (padrão `single color black outline`) e o `detail` são só orientação do modo do zero e são **ignorados quando há `reference_image`**. Com referência, o contorno vem da própria referência: corrigir na referência (`generate-with-style-v2`) ou por código depois. Não há parâmetro para trocar. **[doc]**
  - No `create-tileset`, `outline` não tem efeito. **[doc]**
- **CÓDIGO:** sem créditos, pré-assado no atlas recolorido (por pelagem; não custa nada por quadro).
  - Corrigir as constantes fora da paleta **na origem**, não só no `coresNaMestra`: `#1a1405 → 2e222f`; pele e sela para o tom da mestra.
  - Para cada pixel de contorno (índice 1 do molde), achar o vizinho opaco de dentro e trocar o contorno pelo **degrau mais escuro da rampa desse material** (pelo, crina, sela…). Em pelagem e crina escuras, esse degrau pode ser o próprio `2e222f`.
  - Variante "contorno escuro" para noite e chuva (silhueta inteira em `2e222f`, porque contorno de material some em fundo escuro), escolhida pela mesma tabela do grading.
  - **[proposta de mudança no guia §5]** Hoje o guia §5 exige contorno **fechado** em `2e222f` nos personagens. Esta regra propõe: (1) contorno na cor do material em vez de `2e222f` fixo, mantendo a silhueta fechada; (2) **na última linha do casco**, onde toca o chão, trocar o contorno pela cor da sombra de contato (Lospec: contorno na base faz o objeto flutuar), o que abre a silhueta só ali. Até o OK do Vinicius, vale o guia: silhueta fechada em `2e222f`, com o seletivo só por dentro dela.
  - **[proposta de mudança no guia §5]** Objetos grandes do cenário (arquibancada, placas, árvores do primeiro plano, muretas da arena, casas do mapa) ganham contorno de 1 px **na cor mais escura da própria rampa**, como nas referências (R5). O chão e o terreno continuam sem contorno.
- **TESTE:**
  - (a) automático: no atlas, nenhum pixel `#1a1405`, nenhum fora da Resurrect 64.
  - (b) Cada pixel de contorno é o degrau mais escuro da rampa do vizinho de dentro (ou `2e222f` na variante noturna).
  - (c) Só depois de aprovada a proposta: na última linha opaca dos cascos, 0 pixels `2e222f`.

### Regra 4 — Rampa de cores com hue shift partilhado
Problema atual: os **moldes do PixelLab** têm 10 papéis em cinza (contorno, pelo, sombra do pelo, crina, sombra da crina, detalhe, seda, pele, sela) e a pelagem deles sai com **2 tons** (`pal.coat` e `shade(coat, 0.35)`, em `coresMolde`, `sprites.js` ~888–895 e ~1157–1160). O resultado é chapado, sem brilho no alto à esquerda. O cavalo desenhado por código já usa 4 papéis de pelagem (`c`, `s`, `h`, `d`, `sprites.js:735–745`): o problema é dos moldes. As referências usam de 4 a 6 tons.
- **GERAÇÃO:**
  - Pedir "detailed shading, light from upper left, hue-shifted shading".
  - Nos endpoints que aceitam `target_palette` (`generate-image-v2`, `generate-with-style-v2`, objetos, Pro Flash, tileset `pro`), mandar `{colors: <Resurrect 64 ou as rampas da região>, max_colors: 32}` (`max_colors` aceita de 2 a 64) e `style_options.color_palette: false`. **[doc]**
  - Nos endpoints antigos (pixflux, `/map-objects`, inpaint antigo), usar `color_image` = PNG com as cores. No `create-tileset`, `color_image` não tem efeito: só `target_palette`, e só no modo `pro`. O `inpaint-v3` e o `/vfx` não aceitam paleta: a cor vem do contexto e da quantização posterior. **[doc]**
- **CÓDIGO:**
  - Uma tabela `RAMPAS` da Resurrect 64, com cada rampa já em hue shift. Exemplos: verdes `165a4c → 239063 → 1ebc73 → 91db69 → cddf6c`; neutros quentes `2e222f → 694f62 → 966c6c → ab947a → c7dcd0`; terra começando em `4c3e24 → 676633 …` (completar e validar à mão, e conferir com o passo 0 da §1.3).
  - Ampliar os papéis do molde para **pelo-luz, pelo, pelo-sombra, pelo-sombra-profunda** (o mesmo na crina), derivados do cinza **original** em `prototype/assets/pixellab/raw`. Reprocessar com `--reprocessar`, sem rede.
  - A recoloração (`naMestra`/`coresNaMestra`, ~1123–1150, e `coresMolde`, ~1157–1160) passa de "a mais escura mais perto" / `shade(coat, 0.35)` para "um degrau abaixo **na rampa**". Assim a sombra do cavalo e a do chão caem nas mesmas famílias frias (roxos e azuis, `45293f`, `694f62`), como o guia §3 já pede.
  - Ruão e tordilho: manchas agrupadas, **não** o xadrez de 50% mecânico de hoje.
- **TESTE:**
  - (a) automático: pelo e crina do atlas têm ≥ 4 tons distintos da mesma rampa; os demais materiais (casco, sela, pele, seda) seguem o guia §3, de 3 a 5 tons.
  - (b) Toda cor de sombra de pelagem pertence a uma rampa da tabela.
  - (c) Nenhum xadrez 1×1 regular em área > 4×4 dentro do corpo.

### Regra 5 — Escala de pixel e densidade de detalhe iguais
Problemas atuais: o guia §1 já lista o pixel do cavalo como 3/4 do pixel da pista. Os fundos do Retro Diffusion são ruidosos e pontilhados (Cerrado, Várzea, floresta da amostra "Cavalos · idle", nuvens da Expedição, chão da arena), e os personagens são lisos. As cenas das telas têm **35 a 53 cores** (a Expedição passa do teto de 32), e os mapas das trilhas têm só **9 a 11**.
- **GERAÇÃO:** gerar **já na resolução de arte final**. Nada de gerar grande e reduzir (guia §10.1). No texto, "clean cluster shading, no noise". Pedir ao Retro Diffusion o mesmo estilo. No `generate-with-style-v2`, "a arte mantém a escala das imagens de estilo": as `style_images` vão no tamanho do sprite de saída. **[doc]**
- **CÓDIGO:**
  1. `drawImage` sempre com destino = origem × s inteiro.
  2. Filtro de limpeza de ruído nos fundos: apagar pixels isolados de 1 px e agrupar em massas de no mínimo 2×2 (filtro de moda 3×3 por rampa). **[recomendação]** Ou `correct-pixelart` (0,1 geração), seguido de nova quantização (Regra 10). **[doc]**
  3. Teto de **32 cores** também nas cenas. Subir os mapas das trilhas para ~20 a 24 cores, com rampa de luz.
  4. Contraste por camada: **no chão e na faixa de profundidade onde o personagem anda**, o fundo usa os 3 degraus do meio da rampa, e o personagem pode usar os extremos (Pixel-Logic, cap. 4). A moldura escura das bordas (R8), o céu e o primeiro plano escuro ficam isentos.
- **TESTE:**
  - (a) automático: verificar a razão inteira em toda `drawImage` (instrumentação no build de teste usada pelo `ui-test`).
  - (b) `arte-check`: cores ≤ 32 por cena e por região; mapas de trilha ≥ 16 cores.
  - (c) Contar pixels isolados de 1 px por 1.000 px (limite a calibrar no piloto). Isentos: céu e fundo distante, se tiverem pontilhado aprovado.
  - (d) Histograma de valor **só na faixa do chão sob os personagens**: não usa os degraus extremos.
  - (e) Visual: o sprite sobre o tile de fundo mais comum lê de longe (prancha 1×).

### Regra 6 — Perspectiva coerente por tela
Problema atual: a arena do desafio, a trilha e o mapa são vistos de cima, e os cavalos de perfil puro, ao nível dos olhos. No mapa dos ginásios, as montanhas e o vulcão estão de perfil, e a floresta e o lago de cima.
- **Decisão por tela [recomendação; o Vinicius decide]:**
  - **Telas de mapa, vila, estábulo, trilha, arena:** 3/4 top-down, como as referências.
  - **Corrida:** "vista lateral elevada" coerente (guia §4): o chão da pista com profundidade (as raias sobem na tela), a cerca e as árvores do fundo mostrando o topo, o cavalo de perfil, mostrando um pouco do dorso.
- **GERAÇÃO:** fixar a mesma vista em todo asset da mesma tela. **[doc]**
  - pixen e pixflux: `side | low top-down | high top-down`.
  - `/map-objects`: `low top-down | high top-down | side`.
  - `create-character-v3`: `low top-down | high top-down | side`.
  - `create-tileset`: `low | high top-down`.
  - `create-1-direction-object`: só `top-down | sidescroller`. Não existe `high top-down`: a inclinação vem das `style_images`.
  - `generate-image-v2` e `generate-with-style-v2`: não há campo de vista; ela vem do texto e da âncora.
- **Cavalos nas telas de cima:** lote de teste pago (§5) com sprite sul gerado em `generate-with-style-v2` (estilo do cenário) e depois `create-character-v3` com `template_id='horse'`, `view='high top-down'` e `reference_image` = esse sprite (contorno e detalhe vêm da referência; Regra 3). **[doc: parâmetros; recomendação: fluxo]** Alternativa mais barata: deixar a arena e o desafio mais laterais.
- **Mapa dos ginásios:** montanhas e arenas também a 3/4 de cima. **O vulcão fica para depois** (pedido do Vinicius): tirá-lo ou trocá-lo por um morro com fumaça.
- **TESTE:** visual na prancha: o telhado e a copa vistos de cima em tudo da tela; nenhum objeto de perfil puro num chão de cima. No registro em `assets.md`, anotar a vista de cada asset e conferir que é igual dentro da tela.

### Regra 7 — Primeiro plano e elementos de contato
- **GERAÇÃO:** tufos de primeiro plano (grama, flores, palha, torrões) gerados **como asset à parte**, transparentes, com a âncora de estilo da cena. Opção: `create-1-direction-object` com `item_descriptions` listando várias variantes num lote. **[doc]**
- **CÓDIGO — corrida (até 8 raias em profundidade):**
  - Ordem (guia §4): fundo → chão → por raia, **da de cima para a de baixo**: [sombra → cavalo → contato da raia] → cerca da frente → primeiro plano da frente (paralaxe 1,25, guia §8a) → efeitos → texto.
  - **Nas raias de dentro**, o "contato da raia" é só material da pista: sulcos, torrões e poeira na cor do chão, paralaxe 1,0 (presos ao chão, para não escorregar em relação ao casco), cobrindo 1 a 3 px do casco **de forma intermitente** (uniforme vira barra). Entra logo depois do cavalo daquela raia e antes da raia seguinte, então fica atrás dos cavalos das raias de baixo.
  - **Grama e torrões de borda** só na borda de baixo da pista, cobrindo a raia mais próxima. Tufo de grama no meio da pista de terra destoa.
- **CÓDIGO — telas paradas:** terra (torrões e poeira), estábulo (palha), mapa e vila (tufos e flores na base de casas, placas e personagens), na mesma ordem fundo → chão → sombras → personagens → primeiro plano → efeitos → texto.
- **Neblina** (`RaceFx.drawFogFront`, em `fx.js`; o `nevoaFrente` de `fx.js:872` é só o contador): 2 a 3 faixas que cobrem mais as pernas que a cabeça, **sólidas, em degraus da rampa**, com borda recortada em massas de 2×2 ou mais. Nunca alfa. **[proposta de mudança no guia]**: hoje o guia pede névoa por pontilhado; a proposta é deixar o pontilhado só no céu e no fundo distante, porque xadrez sobre personagem em movimento cintila e reforça o "adesivo".
- **Ambiente:** os tufos balançam 1 px em ciclo (branch `claude/animacao-ambiente`) e se curvam quando o cavalo passa (gatilho pelo x do cavalo, determinístico). Variantes pré-assadas, sem custo por pixel. No modo reduzido, quadro fixo.
- **TESTE:** (a) automático no `ui-test`: em N quadros da corrida, ≥ 1 pixel do casco coberto por pixel de contato em parte dos quadros, nunca em todos; nenhum pixel de contato de uma raia por cima do corpo de cavalo da raia de baixo. (b) Visual: a casa, a barraca e o cavalo parecem "plantados".

### Regra 8 — Clima e hora valem para a cena inteira, personagem incluído
Problema atual (corrida, `final-06-corrida.png`): a névoa lava o cenário, mas não os cavalos, que saltam como adesivos. No estábulo e na arena os cavalos vêm em luz neutra, sob uma luz âmbar ou de lava.
- **GERAÇÃO:** gerar no horário-padrão (tarde clara, guia §4). As variações de clima e hora saem por código. Não gerar um asset para cada clima.
- **CÓDIGO:**
  - **LUT por rampa:** para cada condição (dia, tarde, noite, chuva, neblina, calor), uma tabela 64 → 64 da Resurrect 64 gerada **deslocando degraus dentro de cada rampa** (e trocando de rampa só onde o matiz da condição pede), e ajustada à mão. Não usar "cor mais próxima da mestra": de noite e na neblina ela funde degraus vizinhos e a pelagem de 4 tons volta a 2.
  - **Pré-assar no início da corrida:** a sequência de clima já sai da simulação pela seed antes da animação. Então, no carregamento, pré-assar só as condições que aparecem naquela corrida, em todas as camadas e atlas, **incluindo o atlas dos cavalos e dos treinadores** (guia §9: "uma por clima"). Somar a memória dessas versões ao teto de 16 MB por tela. Nas telas sem clima variável, pré-assar a condição da tela ao abrir. Nunca recolorir no quadro da virada, nem aplicar a LUT no canvas a cada quadro.
  - **Transição por degrau de rampa:** em vez de pontilhado, a transição dá N passos (ex.: 3 a 4), e em cada passo cada cor anda um degrau na LUT até a condição nova. Os passos intermediários também são pré-assados no carregamento. Durante a transição, cada camada continua com 1 desenho (troca de versão), sem mistura alfa e sem xadrez sobre o personagem.
  - **Tinta ambiente por cena:** arena de fogo (sombra puxando para `6e2727 / 45293f`, brilho `f79617 / fbb954`), estábulo âmbar, litoral claro. Entra na mesma LUT da cena.
  - **Contraluz (rim light) só com fonte local emissiva:** de dia, **nenhum** contraluz (o brilho é o degrau claro da rampa, como nas referências). Com lava, lampião ou pôr do sol: trocar no máximo 1 px de dentro do contorno, **só no lado que dá para a fonte** e só onde o pixel já é do degrau mais claro, pela cor da fonte (lampião `fbb954`/`f9c22b`; pôr do sol `f57d4a`; Fogo `f79617`). Pré-assado no atlas por condição, com a mesma máscara do contorno seletivo.
  - **Partículas:** um sistema só (`fx.js`), com z por partícula: as de trás antes dos cavalos, as da frente depois. As cores vêm da rampa da região e passam pela LUT. A poeira dos cascos usa a cor do **chão onde o cavalo pisa**. A chuva respinga 1 px claro no dorso (linha de cima da máscara do molde).
- **TESTE:**
  - (a) automático: para cada condição, a diferença média de valor entre o atlas do cavalo e a camada da pista não muda de sinal em relação ao dia (o cavalo escurece junto).
  - (b) Depois da LUT e de cada passo de transição: nenhuma cor fora da paleta; ≤ 32 cores por região.
  - (c) Em cada condição, o número de tons distintos por material no atlas do cavalo é igual ao do dia (no máximo 1 a menos).
  - (d) A virada de clima reproduz com a mesma seed (o `balance.js` já cobre o determinismo da corrida).
  - (e) Medir no `ui-test` que o quadro da virada não passa do orçamento do guia §9.
  - (f) Visual: prancha com a mesma cena em dia, névoa, chuva e noite.

### Regra 9 — Gerar no contexto, não por cima
É o que evita o "PNG colado" já na geração.
- **GERAÇÃO:**
  - **`/map-objects` com `background_image` + `inpainting`** **[doc]**:
    - `background_image` é o pedaço do mapa onde o objeto é gerado; o tamanho dele vira o canvas, e só a máscara é desenhada.
    - `inpainting`: `{type:'oval', fraction}`, `rectangle` ou `mask` (branco gera, preto congela). No REST, o padrão de `fraction` do oval é **0,3** (o 0,6 é do MCP): mandar `fraction` sempre explícito (0,05 a 0,95).
    - Limites: até 192×192 de área com inpainting; saída transparente até 200×200.
    - O `download_url` expira: os objetos se apagam sozinhos em 8 horas. Baixar e salvar o PNG logo.
    - Custo **[NÃO CONFIRMADO]**: medir no recibo da 1ª chamada.
  - **`/inpaint-v3`** para construções e objetos maiores, que ficam pintados no cenário **[doc]**:
    - Máscara: branco gera, preto preserva. Imagem de 32 a 512 px; `crop_to_mask=true`.
    - Custo: 10 até 256×256; 15 até 341; 25 acima. O preço é da imagem inteira, não da máscara.
    - Não tem `target_palette`, `color_image`, `view` nem estilo: a coerência vem só do contexto, e a paleta da quantização posterior.
    - **Pro Flash inpaint**, para retoques: 5 até 96 px; 6 até 208; 9 até 256.
  - Para **ampliar um mapa**, deixar 30–50% de contexto pronto dentro da janela e não pintar a janela toda (o modelo precisa de referência). Descrever o que fica **no meio** da área. **[recomendação; a frase do guia oficial não foi localizada: NÃO CONFIRMADO]**
- **CÓDIGO:** recortar 128–192 px do cenário em volta da posição do objeto. A máscara segue a forma do objeto. O resultado passa pelo pós-processo comum (Regra 10).
- **TESTE:** visual: na prancha, a junta objeto/chão não tem halo nem borda de outra cor. Automático: anel de 2 px em volta da máscara com variação de cor ≤ à do chão vizinho (limite a calibrar no piloto). **[recomendação]**

### Regra 10 — Pós-processo comum e checklist de aceite
**Pós-processo**, em `prototype/tools/`, reprodutível e com `--reprocessar` sem rede (os passos pagos ficam gravados em `raw/`):
1. Detectar a grade e voltar a 1:1, se preciso: script local, ou `POST /unzoom` (pago). **[doc]**
2. Limpeza: `correct-pixelart` (0,1 geração) ou o nosso filtro de ruído (Regra 5). O `correct-pixelart` redesenha e não tem etapa de paleta, então vem **antes** da quantização. **[doc]**
3. Quantizar para a paleta da região (CIELAB, sem pontilhado; guia §10.2), ou `reduce-colors` com `palette_image` = Resurrect 64 (0,1 geração). **[doc]**
   - O `reduce-colors` exige que **todas as imagens da chamada tenham o mesmo tamanho**, com total ≤ 262.144 px.
   - Com `palette_image` fixa, a paleta não deriva entre chamadas: uma chamada por grupo de mesmo tamanho.
   - Sem paleta fixa (`num_colors` ou detecção automática), todos os quadros da mesma animação ou direção **numa chamada só** ("frames quantized in separate calls get separate palettes").
4. Alfa binário e recorte.
5. Contorno seletivo, contato e contraluz (Regras 3 e 8), pré-assados.
6. Silhuetas, sprites de sombra e reflexo (Regras 2 e 11), pré-assados.

**Checklist de aceite** (todo asset; vira a seção de "integração" do `docs/arte/guia.md`):
- [ ] **C1** Mesma câmera (vista) da tela.
- [ ] **C2** Luz de cima e da esquerda; brilho em cima e à esquerda, medido por degrau da rampa.
- [ ] **C3** Sombra opaca na rampa do chão, na forma da vista da tela, deslocada para baixo e para a direita; contato sob o pé.
- [ ] **C4** Pelo e crina com 4 a 5 tons; demais materiais com 3 a 5; hue shift partilhado com o chão.
- [ ] **C5** Contorno na cor do material (seletivo), dentro da regra vigente do guia §5.
- [ ] **C6** Elemento de contato (tufo, sulco, poeira, palha, espuma).
- [ ] **C7** Mesmo grão: escala inteira, mesmas massas e nenhum ruído de 1 px (salvo céu e fundo distante aprovados).
- [ ] **C8** LUT de clima e hora aplicada também ao personagem, sem perder degraus; contraluz só com fonte emissiva.
- [ ] **C9** Cores ∈ Resurrect 64, ≤ 32 por região (também depois do grading), alfa binário.
- [ ] **C10** Separa do chão **em valor** (Regra 14).
- [ ] **C11** Animação sem patinar, na grade e no ritmo comuns (Regra 12).
- [ ] **C12** Registrado em `docs/memoria/assets.md`: ferramenta, endpoint, parâmetros, seed, custo real, uso, origem das referências usadas. A seed do Pro Flash não garante a mesma imagem. **[doc]**

### Regra 11 — Água: reflexo e espuma (cenas e pistas de Água)
- **CÓDIGO:**
  - **Reflexo:** gerado uma vez, na montagem do atlas: a silhueta do quadro espelhada e achatada a 50% **amostrando linhas de pixel de arte** (nunca `scale` não inteiro no laço), tingida com **uma cor** (degrau escuro da água, ex.: `0b5e65`). No laço, desenhado 1:1 × s inteiro e recortado pela máscara da água.
  - **Ondulação:** 4 fases pré-assadas no atlas, uma por valor de `((y + t/8)|0) % 4` (deslocamento de ±1 px por linha de arte). No laço, 1 desenho de reflexo por cavalo, escolhendo a fase pelo tempo do quadro (determinístico). No modo reduzido, fase fixa.
  - **Espuma:** 1 px `8ff8e2` ou `c7dcd0` em volta da máscara de contato, piscando em 2 quadros pré-assados (fixo no modo reduzido).
  - Tudo opaco e na paleta, dentro dos ≤ 3 desenhos por cavalo (sombra ou reflexo, cavalo, espuma/contato).
- **GERAÇÃO (mapa):** lago e rio com espuma, pedras e degradê de profundidade (hoje são azul chapado). Usar inpaint no contexto (Regra 9).
- **TESTE:** visual na prancha. Automático: reflexo só dentro da máscara da água, cores ∈ rampa da água.

### Regra 12 — Movimento sem patinar
É a maior causa de "PNG colado" em animação: o casco desliza em relação ao chão.
- **CÓDIGO:**
  - **Contato:** no quadro em que o casco toca o chão, ele fica parado em relação ao chão. A velocidade do ciclo de galope e a rolagem da pista se casam por quadro (deslocamento do chão por quadro = passada do molde no quadro de apoio). A poeira e o sulco nascem nesse quadro.
  - **Grade da câmera:** câmera, cada camada de paralaxe e a posição de cada sprite são arredondadas **na mesma grade de pixel de arte**, e na mesma ordem. Sem isso, cavalo e chão tremem em fases diferentes.
  - **Ritmo comum:** uma base de quadros única para cenário e personagens (ex.: 8 ou 12 qps, com ciclos em múltiplos dela), para tudo "respirar" no mesmo compasso. Vale para a spec da animação ambiente.
- **GERAÇÃO:** nas animações do PixelLab, marcar no registro qual quadro é o de contato e a passada em pixels de arte.
- **TESTE:** no `ui-test`, o x de tela do casco no quadro de contato varia igual ao x do chão, ±1 px; nenhum sprite em posição fracionária de pixel de arte.

### Regra 13 — Transição entre terrenos
A junta chão com chão é metade da beleza das referências (R9). É a falta dela que faz a trilha parecer "tabuleiro" e o lago, "azul chapado".
- **GERAÇÃO:** pedir no texto "irregular dirt path edges, grass tufts overlapping the path, scattered pebbles and flowers". No tileset, usar `transition_reference_image` recortada da âncora. Para juntas em mapa pintado, inpaint no contexto (Regra 9).
- **CÓDIGO (mapas e trilhas desenhados por código):**
  - Borda entre materiais sempre recortada, em massas de 2 a 4 px, nunca reta.
  - Uma faixa de 1 a 2 px do degrau escuro do material de cima sobre o de baixo.
  - Densidade de detalhe por área de 16×16 px: 1 a 2 tufos e 0 a 1 flor ou pedra, com posições pela seed do mapa (sem `Math.random`).
- **TESTE:** automático: nenhuma borda reta entre materiais com mais de 4 px seguidos. Visual: prancha ao lado das referências.

### Regra 14 — Leitura por valor
O personagem tem de se separar do chão **em valor**, não só em matiz. Caso típico: o castanho `9e4539` sobre a pista `cd683d`.
- **CÓDIGO:** para cada cena e condição, calcular a diferença de valor entre a massa do corpo do cavalo e o chão sob ele. Se ficar abaixo do limite, a cena escolhe, pela tabela, outra cor de chão na faixa das raias, a variante de contorno escuro ou (com fonte emissiva) o contraluz.
- **TESTE:** automático no `arte-check`/`ui-test`: diferença mínima de valor corpo × chão em cada condição (limite a calibrar no piloto). Visual: prancha da cena em escala de cinza.

### Regra 15 — Personagem dentro da sombra do cenário
Nas referências, as copas projetam sombras grandes no chão. No mapa e na vila, um personagem que entra numa sombra e não escurece volta a parecer colado.
- **CÓDIGO:** as sombras do cenário viram uma máscara (camada pré-assada). O personagem cujo ponto de contato cai dentro da máscara usa a versão "sombra" do atlas (LUT um degrau abaixo, pré-assada), sem desenho extra.
- **TESTE:** visual na prancha: personagem atravessando a sombra de uma copa.

---

## 3. Melhor recurso do PixelLab por tipo de asset

Custos em "gerações" (unidade do PixelLab), **[doc]** salvo marcação. Validar nomes e enums no `openapi.json` antes de cada lote. Os nossos scripts usam REST v2 (`pixellab-comum.mjs` e afins); onde o nome do campo difere no MCP, vale o do REST.

| Asset | 1ª escolha | Parâmetros-chave | Custo | Quando preferir outra coisa |
|---|---|---|---|---|
| **Rascunho de cena / mapa** (muitas tentativas) | `POST /create-image-pixen` | `view:'high top-down'`, `outline:'lineless'`, `detail` a testar (padrão `highly detailed`). Lado 16–768, múltiplo de 4, área ≤ 262.144 px (ex.: 640×360). Sem `shading`, sem paleta, sem `style_image`. | 1 (+0,05 com `enhance_prompt`) | É só para escolher a âncora. Depois, pós-processo (Regra 10). |
| **Cena-âncora final por bioma / tela de mapa** | `POST /generate-image-v2` (Create Image Pro) | `style_image` = recorte da referência aprovada (§1.3) ou da 1ª cena boa; até 4 `reference_images`, cada uma com `image`, `size` e `usage_description` (≤ 500 caracteres); `style_options` são **booleanos** de "copiar do style_image": `{color_palette:false, outline:true, detail:true, shading:true}`; `target_palette {colors, max_colors:32}`; **`no_background:false`** (o padrão é true). Tamanho máx.: 512×512, 688×384 (16:9), 792×336. | 10 / 15 / 25 por chamada (256 px de largura ≈ 10; 16:9 até 344×192 = 10, até 458×256 = 15, até 688×384 = 25). >170 px = 1 candidato. 1–10 min. | Sem campo de vista: fixar pela âncora e pelo texto. |
| **Mapa maior que 512 / mapa dos ginásios** (pintado em 3/4) | Núcleo em `generate-image-v2` + expansão com `/inpaint-v3` (30–50% de contexto). Não depende de tileset. | Ver Regra 9. | 10–25 por janela | **Map Workshop** (só no MCP, `https://api.pixellab.ai/mcp`, e na web): o mapa é uma **grade de tiles**. `create_map` exige `tileset_id` ou `tile_group_id`, e os tilesets são pagos (1 no `standard`; 15 ou 25 no `pro`, que exige Tier 1+). Pintar e posicionar (`edit_map`, `place_map_object`) é grátis. O `inpaint_map` custa 5/6/9 e não funciona em mapa sidescroller nem em mapa com camadas de tiles. Export `pixellab` = map.json + PNG. Ver D1. |
| **Mapa com layout nosso** (esboço de rio e caminho) | `POST /create-image-pixflux` | `init_image` (nosso esboço) + `init_image_strength` 1–999 (padrão 300; significado numérico **[NÃO CONFIRMADO]**), `color_image` = paleta forçada; área 32×32 a 400×400. Os controles de estilo são "weakly guiding". | 1 | Barato. Se é o mesmo modelo do "Create map" da web: **[NÃO CONFIRMADO]**. |
| **Tileset de terreno** (se o mapa virar grade) | `POST /create-tileset`, modo `pro` | `view:'high top-down'`, tiles 16/32/64 (32 recomendado), `target_palette` (só no `pro`; `color_image` não tem efeito), `shading` existe, `outline` não tem efeito; `lower/upper/transition_reference_image` recortadas da âncora; encadear grama → terra → água por `lower_base_tile_id` / `upper_base_tile_id`. **Modo `pro` exige Tier 1+** (403 sem ele). | `standard` 1; `pro` 15 (≤32 px) / 25 | Secundário para nós. `create-tiles-pro` com `outline_mode:'segmentation'` (chão sem grade) e `style_images`: 10–25, também exige Tier 1. |
| **Prop dentro do cenário** (casa, barraca, fogueira, portão do ginásio, placa) | `POST /map-objects` com `background_image` + `inpainting` | `view` igual à tela; `outline:'lineless'` ou `'selective outline'` (cenário) / `'single color outline'` (interativo); `shading` e `detail` no nível da tela (tabela da Regra 1: aqui o máximo é `detailed shading` / `high detail`); `color_image` = paleta; `inpainting.fraction` explícito; área ≤ 192×192 com inpainting. Baixar em até 8 h. | **[NÃO CONFIRMADO]**: medir no recibo | Para um objeto grande pintado no fundo, `/inpaint-v3` direto na cena. |
| **Lote de props do mesmo bioma** (cerca, barril, feno, placa, tufos) | `POST /create-1-direction-object` | `style_images` = 2–4 recortes da cena aprovada **no tamanho do sprite**; `item_descriptions` (vários itens num lote); `view:'top-down'` ou `'sidescroller'` (não há `high top-down`: a inclinação vem das `style_images`); `target_palette`. | 10 ou 15 (43–64 = 10; 65–85 = 15; 86–128 = 10; 171–256 = 10). Gera vários candidatos e entra em "review". | Item único com a mesma âncora: `POST /create-object-pro-flash` com **`n_directions:1`** (o padrão é 8) e `image_size` múltiplo de 4: 5 até 96 px; 6 até 208; 9 até 256 (com 8 direções, de 6 a 17). Objeto que gira: `create-8-direction-object` (`style_object_id` para manter a família; 10/15/25). |
| **Sprite "do mesmo artista" do cenário** (cavalo e NPC do mapa, retrato) | `POST /generate-with-style-v2` | 1–4 `style_images` de estética parecida ("more style images → more consistent") **no tamanho de saída desejado** (a saída é deduzida delas; acima de 170 px aceita só 1); `target_palette {colors, max_colors}`. | 10 (64 px → 16 candidatos; 128 px → 4; 256 px → 1); 25 a 512 px | "A arte mantém a escala das imagens de estilo": nunca aumentar o sprite com borda. |
| **Personagem / cavalo em várias direções** (mapa, arena de cima) | `POST /create-character-v3` | `reference_image` = sprite **sul** vindo do `generate-with-style-v2`; `template_id:'horse'` (tem esqueleto); `view:'high top-down'`; `direction_images` para direções já desenhadas. Com `reference_image`, `outline` e `detail` são ignorados. Sem `style_image` e sem paleta: quantizar depois. | Com referência: ceil(w·h·8/65536) (64×64 = 1). Do zero: 1 + ceil(s²·8/65536). | **Corrida:** continuam os moldes atuais (perfil), reprocessados em 4 tons (Regra 4). |
| **Animação ambiente de cena** (fogueira, água, varal, copa) | `POST /animate-with-text-v3` | Recortar do cenário **opaco** a região que mexe (`first_frame`); `no_background:false`; `action` descreve o movimento, não a aparência; `frame_count` 4–16 par; `drift_threshold` baixo (0 = corrige todos os quadros). `last_frame` guia o fim: `last_frame = first_frame` para fechar o loop é **[recomendação]**. Limite: lado ≤ 256 e w·h·quadros ≤ 524.288. Marcar a base de quadros comum (Regra 12). | ~pixels totais (64×64×8 = 1; 128×128×16 = 4). 30–180 s. | **Loop longo** (água, grama, fumaça): `animate-pixminimax` (beta): campo do movimento é `description` (não `action`); `no_background:false` **explícito** (o padrão é true e recorta); preencher `view`, `direction` e `subject_description`; devolve `frame_count + 1` quadros (o índice 0 é a entrada sem mudança: descartar, para não duplicar no loop). Custo a 64 px: 4/8/16/40 quadros = 1/1/2/6; outros valores (ex.: 32) **[NÃO CONFIRMADO]**, citar o recibo. Preferir 68×68 ou 132×132 a 64/128. 1–7 min. |
| **Animação de prop** criado no PixelLab | `POST /objects/{id}/animations` com `mode:'v3'` | 4–16 quadros pares; objeto de 1 direção: não passar `directions`; `keep_first_frame`; `custom_start_frame`/`end_frame`. Os objetos de `map-objects` animam direto (dentro das 8 h). | ceil(w·h·quadros/65536) por direção (64×64×8 = 1) | `pro` (10–25 por direção) só se precisar de paleta forçada. No v3, quantizar depois (Regra 10). |
| **Animação de personagem** (idle do cavalo, treinador respirando, lampião) | `animate-with-text-v3` sobre o quadro do molde ou do corpo | Como acima, com `no_background:true` (sprite) e sombra por código. Treinadores: idle de 2–4 quadros. | ~1 por 64×64×8 | Trocar pelagem ou sela de um galope inteiro: `edit-animation-v2` (2–16 quadros; 16 até 64 px; ~10). Esqueleto (`horse`): 2–4 por direção (MCP). **Evitar** `interpolation-v2` (10–25, saída fixa de 14 ou 2 quadros). |
| **VFX** (elementos, Dado da Sorte, clima) | `POST /vfx` | Gerar **em volta do sprite do cavalo** (PNG/GIF ≤ 512, ≤ 32 quadros; "never rescale pixel art: crop or pad"); mandar **`game_pack:true`** (o padrão é false) para receber a camada atrás + a camada na frente do sprite, e o spritesheet + JSON (pivô). **Não aceita paleta:** quantizar depois. Mudanças via `effect_id` + conversa saem mais baratas. | lite: 1 (novo até 128) / 3 (com sprite até 256) / 5 (até 512); pro: 6 / 8 / 14 / 28 | Partículas simples (poeira, folhas, respingo) ficam **no código** (`fx.js`), com as cores da rampa do chão. `vfx_workbench` (MCP) é grátis para assinantes. |
| **Normal map** (luz da cena no cavalo) | `normal-map` lite | até 32 quadros por chamada | 0,1 (lite) / 0,5 (pro) | **[recomendação: avaliar]** A LUT por rampa e o contraluz pré-assado (Regra 8) cobrem o essencial sem shader. |

**Quando preferir o Retro Diffusion:** camadas de paralaxe largas da corrida (céu, horizonte, meio), que são vistas laterais e emendáveis, onde já temos fluxo. Gerar na largura de arte final, com a mesma paleta, e passar pela limpeza de ruído (Regra 5). Para as telas de mapa em 3/4 de cima, o PixelLab com `style_image` e `target_palette` dá mais controle de estilo e de paleta. **[recomendação]**

**Quando preferir código (sem créditos):** sombras, contorno seletivo, contraluz, LUT de clima e hora, contato e primeiro plano, reflexo e espuma, poeira e partículas, transições, juntas de terreno, leitura por valor, quantização e limpeza. São as Regras 2, 3, 7, 8, 10, 11, 12, 13, 14 e 15, mais a parte de código das 4 e 5.

---

## 4. Problemas atuais por tela (auditoria)

Prioridade: **P1** = maior ganho contra o "PNG colado" e só código; **P2** = código médio ou lote pequeno pago; **P3** = caro ou depende de decisão.

### Transversais (afetam todas as telas)
| Problema | Correção | Prioridade |
|---|---|---|
| Sombra `rgba(20,10,20,0.28)`, translúcida, centrada e invisível; treinadores sem sombra (`sprites.js` 1311–1321, 877–882) | Regra 2 | **P1** |
| Clima e luz da cena não chegam ao cavalo nem ao treinador | Regra 8 (LUT por rampa pré-assada no atlas + tinta ambiente + contraluz só com fonte emissiva) | **P1** |
| Pelagem dos moldes em 2 tons (`coresMolde`, `sprites.js` ~888–895, ~1157–1160) | Regra 4: reprocessar `raw/` em 4 faixas, sem créditos | **P1** |
| Contorno `#1a1405` fechado só nos personagens; pele e sela fora da paleta (`sprites.js:929`) | Regra 3: corrigir as constantes na origem; contorno de material conforme D3 | **P1** |
| Nenhum elemento de contato (poeira, palha, tufos, sulcos) | Regra 7 + poeira com a cor do chão (`poeiraCascos`) | **P1** |
| Casco desliza em relação ao chão; câmera e sprites em grades diferentes | Regra 12 | **P1** |
| Pelagens que somem no chão (castanho na pista laranja) | Regra 14 | **P1** |
| Alfa parcial espalhado (23 em `fx.js`, 24 em `sprites.js`, 5 em `game.js`) | Teste com catraca (Regra 2a), migração gradual | P2 |
| Fundos ruidosos (35–53 cores) contra mapas chapados (9–11 cores) | Regra 5 (limpeza, teto de 32, mapas com 20–24 cores) + Regra 13 | P2 |
| Perspectiva lateral do molde em cenas vistas de cima | Regra 6: lote de teste pago ou cenas mais laterais | P3 |

### Por tela
| Tela / asset | Problemas | Correção | Prioridade |
|---|---|---|---|
| **Corrida** (`prototype/screens/final-06-corrida.png`) | A névoa lava o fundo e não os cavalos. A sombra é um traço cinza, e o splash azul fica no lugar dela. Chão bege com pontos soltos de 1 px (rosa, branco, verde-água), sem sulcos nem profundidade. Pelagem em 2 tons. Ruão e tordilho em xadrez mecânico. Nenhuma terra levantada. 4 balões cobrindo corpos (o guia §8 permite 2). | LUT por clima pré-assada no atlas (mais forte nas raias de cima). Elipse opaca de 2 tons da rampa da areia, +2 px à direita. Sulcos e torrões por raia (Regra 7), com faixa mais escura sob cada raia. Poeira da cor da pista no quadro de contato (Regra 12). Manchas agrupadas no ruão e no tordilho. **Limite de 2 balões.** | **P1** |
| **Estábulo** (`final-02-estabulo.png`, `cena-estabulo.png`) | Alazão sobre madeira da mesma família de matiz. Sem sombra. Brilho amarelo na última linha do casco. Cena em elevação frontal com piso de 1 faixa. Os lampiões não iluminam o cavalo. Nenhuma oclusão. Fardos e faíscas em outra escala. | Piso mais alto, em perspectiva leve, com palha. Sombra da rampa da palha e palha à frente dos cascos. Contraluz `fbb954`/`f9c22b` só do lado do lampião, 1 px. Tirar o brilho dos cascos. Separar em valor (Regra 14): escurecer ou dessaturar a madeira atrás, ou baia aberta escura. | P1 (código) / P2 (cena) |
| **Desafio do ginásio** (`final-26b-cena-desafio.png`; `game.js` 3454–3470, `drawGinCena` ~3640–3690) | Arena de cima com cavalos de perfil, flutuando. Luz de lava contra cavalos neutros. A tordilha azul-acinzentada em xadrez é o pior "PNG colado" do jogo. Alazão `ea4f36` sobre chão `f79617`. O Sargento Candeeiro está pequeno, escuro, no canto e sem sombra; o lampião não ilumina. "VS" em HTML chapado. A escala está certa (1:1). | Tinta da arena nos cavalos e no treinador (sombra `6e2727`/`45293f`, brilho `f79617`/`fbb954`) + contraluz quente do lado da lava. Sombra de silhueta inteira deslocada na diagonal + contato escuro. Treinador na área clara, na frente da mureta. "VS" como objeto pintado (placa, brasão). Avaliar molde 3/4 ou piso mais lateral (D2). | P1 (luz e sombra) / P3 (perspectiva) |
| **Expedição** (`final-24-expedicao-ginasios.png`, `cena-expedicao.png`) | 53 cores, com cara de pintura reduzida. Nuvens com borda de pixel solto. A placa de madeira tem acabamento de sprite, sem sombra e sem tufos ("espetada"). **Vulcão presente.** A perspectiva atmosférica em 3 degraus funciona bem. | Quantizar para ≤ 32 cores. Nuvens em massas de 3 tons com borda limpa. Sombra e grama na base da placa. Tirar o vulcão, ou trocar por morro com fumaça (o vulcão fica para depois). | P2 |
| **Trilha do ginásio** (`final-25-trilha.png`, `mapa-fogo.png`) | Discos amarelos chapados no lugar da sombra. Mapa de 9 cores contra treinadores de 24–27. Caminho de quadrados amarelos sobre traço preto, como um tabuleiro. A lava não ilumina ninguém. Arbustos cinza parecem recortes. Falta moldura nas bordas. | Base de pedra ou platô pintado + sombra diagonal. Trilha de terra batida com borda recortada, pedrinhas e tufos (Regra 13), com só o trecho liberado "aceso". Mapa com 20–24 cores e rampa de luz, mesas projetando sombra, moldura escura nas bordas. Contraluz laranja nos treinadores do lado da lava. | P2 |
| **Amostra animação ambiente: Litoral · corrida** (branch `claude/animacao-ambiente`) | O cenário está bonito e vivo, mas os cavalos não têm sombra (a arquibancada tem). O castanho `9e4539` some na pista `cd683d`. 2 tons. Mato com outro grão. Pista sem gradiente nem marcas. | **Antes de animar mais coisa:** sombra da rampa da pista (`cd683d → 9e4539 / 6e2727`), poeira em 2 tons no galope e no idle, sombra da cerca de trás na raia de cima, separação em valor (Regra 14), base de quadros comum (Regra 12). | **P1** |
| **Amostra: Cavalos · idle e Fornalha** (mesmo branch) | Idle: baios sem sombra, contorno quase preto e 2 tons diante de uma floresta ruidosa; é o exemplo mais claro de "colado". Fornalha: a arena é ótima, mas quando os cavalos entram o problema do desafio volta. O quadro "PixelLab × código" ficou vazio na captura. | Pôr na spec da animação ambiente um item **"integração do personagem"**: sombra animada (respira com o corpo e o casco), tinta ambiente por cena, contraluz só da fonte emissiva, partículas de chão (poeira, palha, brasa) nos gestos do idle, ritmo comum com o cenário e quadro fixo no modo reduzido. Conferir por que a comparação dos 12 moldes não renderizou (rede ou tempo > 3 s). | **P1** (spec) |
| **Amostra mapa dos ginásios** (branch `claude/mapa-ginasios`) | É o mais próximo das referências. Mas: montanhas e vulcão de perfil (o vulcão fica para depois); árvores sem sombra; lago e rio chapados, sem espuma nem profundidade; marcadores como selos de interface; arenas como ovais chapados; nuvens em blob pontilhado. | Montanhas e arenas a 3/4 de cima. Sombra em copas, rochas e arenas, e personagem escurecendo dentro delas (Regra 15). Espuma e degradê na água (Regra 11) e juntas recortadas (Regra 13). Marcadores como objetos do mundo (portão ou estandarte com sombra, via `/map-objects` no contexto), só a plaquinha do nome em interface. Nuvens em 3 tons com sombra no chão. | P2 |
| **Moldes de cavalo** (`prototype/assets/pixellab/`) | Pose e silhueta boas. Mas: perfil ao nível dos olhos; quantização em 10 papéis que joga fora o sombreado; galope de 9 quadros sem quadro de contato marcado nem poeira; nenhuma variante 3/4. | Sem créditos: reprocessar `raw/` em 4–5 faixas para pelo e crina; marcar o quadro de contato e a passada (Regra 12). Com créditos (lote de teste, 1 porte): variante high top-down com sombreado detalhado e idle animado. | P1 (reprocesso) / P3 (lote) |
| **Treinadores** (`prototype/assets/arte/treinadores/finais/*-corpo.png`) | 32×48 na escala certa, contorno `2e222f`. Luz frontal neutra, sem sombra nem base, pose estática. O detalhe fino destoa do terreno chapado. Os bustos 64×64 estão bons. | Sombra por cena (Regra 2); tinta por ginásio na LUT; contraluz só onde há fonte (lava, lampião); idle de 2–4 quadros (respirar, lampião balançando) com `animate-with-text-v3`, no ritmo comum. | P1 (código) / P2 (idle) |

### Ordem sugerida de execução
1. Sombra opaca na rampa do chão, em todos os personagens e cenas (com o teste de alfa em catraca).
2. LUT por rampa pré-assada + tinta ambiente + contraluz de fonte emissiva, no atlas.
3. Pelagem dos moldes em 4 tons.
4. Contorno: constantes na paleta já; contorno de material depois do D3.
5. Elementos de contato por raia e movimento sem patinar.
6. Leitura por valor.
7. Limpeza de ruído, teto de cores e juntas de terreno.
8. Perspectiva nas cenas de cima.

Os itens 1, 2, 4, 5 e 6 são só código. O 3 sai sem créditos (reprocesso). O 7 é código, com retoque pago opcional. O 8 pede um lote pago, aprovado pelo Vinicius.

---

## 5. Fluxo de produção de um asset novo

Vale para cenário, objeto, personagem, animação e VFX. **Cada passo pago pede confirmação explícita do Vinicius, com o custo estimado.**

0. **Uma vez por projeto, sem créditos:** origem das referências e teste da paleta (§1.3).
1. **Ficha do asset** (antes de qualquer chamada): tela de destino, vista, tamanho final em pixels de arte, rampa e paleta da região (≤ 32 cores), condição de luz e fontes emissivas, âncora de estilo a usar (e origem dela), endpoint escolhido (§3), base de quadros (animação), custo estimado e teto (`--teto N`).
2. **Dry-run** do script em `prototype/tools/` (padrão dos nossos scripts): mostra o payload, o tamanho e o custo estimado. Validar os parâmetros e enums no `openapi.json` (nomes do REST, não do MCP). Rodar `GET /balance`.
3. **Piloto pequeno (pago, com confirmação):** 1 chamada, ou o menor lote que dá candidatos (ex.: 64 px no `generate-with-style-v2` = 16 candidatos por 10 gerações). Para endpoints com custo **[NÃO CONFIRMADO]** (`/map-objects`, `animate-pixminimax` fora das faixas documentadas), o piloto também serve para **medir o custo real pelo recibo** e anotá-lo. Baixar tudo na hora (os `map-objects` somem em 8 h).
4. **Pós-processo** (Regra 10), sem rede, reprodutível com `--reprocessar`.
5. **Comparação lado a lado:** uma prancha de contato com:
   - o asset **na cena real**, na escala do jogo, a 1× e a 3×;
   - ao lado das **duas referências do Vinicius**;
   - na versão anterior (antes/depois), se houver;
   - em pelo menos 2 condições de clima e hora (Regra 8);
   - a mesma cena em escala de cinza (Regra 14);
   - no estilo do `fontes-comparacao.png`;
   - para animação, um GIF ou a página de amostra rodando, além dos quadros, com o cenário animando junto.
6. **Conferência automática:** `arte-check` (paleta, alfa binário, grade 1:1, contagem de cores antes e depois da LUT, tons por material, ausência de `#1a1405`, catraca do alfa parcial, lado iluminado por degrau, valor corpo × chão) + checklist C1–C12 marcado na prancha.
7. **Aprovação do Vinicius:** mostrar a prancha (artefato do claude.ai ou imagem) com o custo gasto e o custo do lote. Sem aprovação, nada de lote. Se reprovar, ajustar o texto, a âncora ou os parâmetros e voltar ao passo 3, sempre com nova confirmação de créditos.
8. **Lote (pago, com confirmação):** mesmos parâmetros e **mesma âncora** do piloto aprovado, com `--teto N`. Quantizar com `palette_image` fixa por grupo de mesmo tamanho (ou, sem paleta fixa, cada animação ou direção numa chamada só). Conferir uma amostra do lote na prancha antes de integrar.
9. **Integração no jogo:** `node prototype/build.mjs`; testes relevantes; `./scripts/check.sh` antes de dar por terminado (CLAUDE.md §3). Capturas oficiais em `prototype/screens/` só se a interface mudou de propósito.
10. **Registro:** `docs/memoria/assets.md` (ferramenta, endpoint, prompt, parâmetros, seed, custo real, uso, origem das referências; alimenta a declaração de IA da Steam), `docs/memoria/decisoes.md` se mudou alguma regra, e `ESTADO.md`.

### Decisões pendentes para o Vinicius
- **D1** Mapa dos ginásios: seguir com REST (`generate-image-v2` + `inpaint-v3`, pintado em 3/4, sem tileset, 10–25 gerações por janela) ou ligar o **MCP do PixelLab** para o Map Workshop? No Map Workshop o mapa vira grade de tiles: os tilesets são pagos (1 no `standard`; 15 ou 25 no `pro`, que exige Tier 1+), pintar e posicionar é grátis, e o `inpaint_map` custa 5/6/9 (não funciona com camadas de tiles nem sidescroller). Recomendação: REST, que casa melhor com as referências pintadas.
- **D2** Perspectiva das cenas vistas de cima (arena, desafio, trilha): lote de cavalos em 3/4 (`generate-with-style-v2` → `create-character-v3` `horse`) ou cenas mais laterais?
- **D3** Mudanças no guia §5: (a) contorno dos personagens na cor do degrau mais escuro do material, com `2e222f` só onde o material é escuro e na variante noturna; (b) sem contorno na última linha do casco, onde toca o chão; (c) objetos grandes do cenário com contorno de 1 px na cor da própria rampa, como nas referências.
- **D4** Mudança no guia sobre a névoa: faixas sólidas em degraus da rampa sobre os personagens, com pontilhado só no céu e no fundo distante.
- **D5** Origem das duas referências: são nossas, geradas, ou de terceiros? Define se podem entrar como `style_image` (§1.3).
- **D6** Primeiro piloto pago sugerido, depois do passo 0: 1 cena-âncora de bioma (`generate-image-v2`, ~10 gerações a 256 px) + 1 prop no contexto (`/map-objects` com `fraction` explícito, para medir o custo) + 1 animação ambiente de recorte opaco (`animate-with-text-v3`, ~1 geração a 64×64×8).

---

*Fontes: `https://api.pixellab.ai/v2/llms.txt`, `openapi.json`, `https://api.pixellab.ai/mcp/docs`, `https://www.pixellab.ai/docs` (consistent-style, create-map, map-tiles); Slynyrd Pixelblog 1, 6, 21 e 44; Lospec (outlines 1 e 2, Resurrect 64); Pixel-Logic (M. Azzi, cap. 4); Graveyard Keeper (Game Developer); `docs/arte/guia.md`, `docs/teste-engine.md`; auditoria das capturas em `prototype/screens/` e nas amostras dos branches `claude/animacao-ambiente` e `claude/mapa-ginasios`.*
