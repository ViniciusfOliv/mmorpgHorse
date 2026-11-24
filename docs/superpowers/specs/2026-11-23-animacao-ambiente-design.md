# Animação ambiente — todas as imagens do jogo (spec)

_2026-11-23 · branch `claude/animacao-ambiente` · frente 1 de 4 das visuais (depois: mapa dos ginásios, tela inicial,
inventário). Guia: `docs/arte/guia.md` (§2 pixel inteiro, §3 paleta, §9 orçamento). Pesquisa: seção 4 de
`docs/arte/referencias-2026-11-23.md` (no branch da coordenação). Amostra aprovada:
https://claude.ai/artifact/2azaDeDRV77ZhvYCuhQNmz (`prototype/arte/animacao-amostra.html`)._

## 1. O pedido e o que já foi decidido

O Vinicius (2026-11-23): nenhuma imagem parada. Vulcão em erupção, placas que giram com o vento, folhas, pássaros, e
os cavalos com uma variedade de movimentos naturais. Qualidade sempre, tudo natural e fluido.

Decidido na amostra:

- **Versão "mais movimento" é a padrão**, com a **vegetação e a água mexendo o tempo todo**, não só nas rajadas. Por
  cima disso, uma rajada forte a cada ~15 s. A versão anterior, mais calma, sai do jogo e fica só na amostra.
- **Código primeiro**, sem custo de arte. Quatro técnicas:
  - ciclo de cor (Mark Ferrari): mar, rio, lava, brilhos, pasto;
  - deformação por pixel inteiro: folhas, capim, copas, placas, torcida;
  - partículas na paleta: brasas, fumaça, bombas, folhas, areia, respingos, bolhas;
  - objetos desenhados por código: bandeirolas, placa pendurada, biruta, pássaros, revoadas, borboletas, jorro de lava.
- **PixelLab só onde o código não fica natural**: o comer (cabeça até o chão) e o cavar (pata no ar) dos cavalos, em
  todos os moldes (piloto e lote autorizados). Cauda, respiração, piscar, orelha, aceno e sacudir a cabeça ficam no
  código.
- **Um vento só**, cosmético, com rajadas que atravessam a cena da esquerda para a direita. Tudo que reage ao vento lê
  a mesma função, então o movimento parece um vento e não vários loops soltos.
- **RNG só cosmética**: mulberry32 com semente fixa por tela, separada da seed das regras (CLAUDE.md §8). Nada de
  `Math.random`. A animação nunca lê nem altera o estado da corrida, do save ou de um sorteio.

## 2. Arquitetura no jogo

### 2.1 Módulo `prototype/src/ambiente.js` (novo, só apresentação)

- Não entra nos módulos que vão para o servidor (`sim.js`, `data.js`, `breed.js`, `gear.js`, `itens.js`,
  `ginasio.js`, `afk.js`, `forja.js`) e não importa nenhum deles.
- Conteúdo, vindo do motor da amostra (`prototype/arte/animacao.js`):
  - primitivas: `CicloCor`, `Deforma` (com a lista de pixels perto da peça), `Particulas` (vetores fixos), `Bando`,
    `Revoada`, `Agenda`;
  - os adereços: bandeirola, placa pendurada, biruta, chama, jorro;
  - o vento.
- API: `Ambiente.cena(id, { imagem, manifesto, semente })` devolve `{ atualiza(t, dt), desenha(ctx, cam) }`.
  - `id` é uma destas: `regiao:<nome>`, `arena:<elemento>`, `aba:<nome>`, `mapa:<elemento>`.
  - O jogo chama as duas funções no laço que já existe de cada tela (corrida, cena do desafio, topo das abas, mapa).
- **Opção "Animações" do Perfil** (`reduced()` do `game.js`): "Completas" anima tudo; "Reduzidas" e
  `prefers-reduced-motion` mostram a imagem parada de hoje. A corrida segue a regra atual: em "Reduzidas" o fundo fica
  parado.

### 2.2 Manifesto por imagem: `prototype/assets/arte/animacao.json`

O motor não guarda coordenadas. Para cada imagem, o manifesto diz:

- as peças (filtro de cores + caixa + o que exclui);
- as rampas do ciclo de cor;
- os pontos dos adereços (farol, cratera, braseiros, ponto da placa);
- os parâmetros (amplitude, frequência, fase).

Um gerador `prototype/tools/arte-animacao-mascaras.mjs` lê o manifesto e faz uma folha de conferência com cada máscara
pintada por cima da imagem. É a mesma ideia da `folha-arte.mjs`, e é o que se revisa quando uma imagem nova entra. O
`arte-check.mjs` (etapa 5 do `check.sh`) passa a conferir duas coisas:

- toda imagem final tem entrada no manifesto;
- toda cor das rampas é da Resurrect 64.

### 2.3 Desempenho: pré-assar o que é periódico

A amostra calcula as deformações em tempo real e fica em 0,2 a 0,5 ms por quadro no contêiner. No jogo, o que é
periódico vira quadros prontos no início da tela, como o atlas dos cavalos:

- **O que vira quadro pronto**: coqueiros, copas, capim, bandeiras e torcida. São 8 a 12 fases × 3 níveis de vento,
  presos ao pixel inteiro. O desenho por quadro passa a ser só um `drawImage`.
- **O que fica em tempo real**: o ciclo de cor, que é barato e já roda a 8–12 q/s pela `Agenda`; as partículas; e os
  objetos por código.
- **Memória**: estimativa de ≤ 2 MB por tela (as peças animadas são pequenas). O guia permite 16 MB.

Medido na amostra, sem pré-assar (contêiner, ≈ CPU de computador; a régua do teste de engine é ×4 para um celular
médio):

| Tela da amostra | Mais movimento (escolhida) | Anterior | ≈ celular médio | Chamadas de desenho | Partículas |
|---|---|---|---|---|---|
| Litoral (corrida, largada) | 0,46–0,54 ms | 0,36–0,43 ms | 1,8–2,1 ms | ≤ 250 | ≤ 120 |
| Fornalha (arena) | 0,21 ms | 0,22 ms | 0,8 ms | ≤ 270 | ≤ 140 |
| Expedição (aba) | 0,28 ms | 0,23 ms | 1,1 ms | ≤ 270 | ≤ 135 |
| Haras com cavalos | 0,24 ms | 0,15 ms | 1,0 ms | ≤ 60 | ≤ 40 |

As medidas variam ±0,1 ms entre execuções.

### 2.4 Orçamento por tela no jogo (ambiente, por quadro)

O teto vale com tudo ligado e na "mais movimento". A corrida tem o teto mais baixo porque já gasta com os cavalos, os
efeitos e o HUD.

| Tela | Teto (contêiner) | ≈ celular médio | Como cabe |
|---|---|---|---|
| Corrida (região) | 0,30 ms | 1,2 ms | quadros pré-assados + ciclo de cor; partículas do ambiente ≤ 60 (somadas às da corrida, ≤ 150) |
| Cena do desafio (arena) | 0,40 ms | 1,6 ms | idem |
| Topo das abas (cena) | 0,35 ms | 1,4 ms | idem; parada quando a aba não está visível |
| Mapa da trilha | 0,35 ms | 1,4 ms | idem; só o trecho visível na rolagem |
| Retratos (Estábulo, ficha) | 0,10 ms | 0,4 ms | 1 desenho por cavalo; só repinta quando o mapa de papéis muda |

O `ui-test` ganha um bloco de desempenho do ambiente. Ele mede o tempo de cada tela com tudo ligado e falha acima do
teto × 1,5, porque o contêiner oscila. É o mesmo padrão do bloco `fluxo-desempenho` da corrida.

## 3. O que mexe em cada imagem

Legenda: **[C]** = código; **[P]** = PixelLab. "Sempre" = o tempo todo, além das rajadas.

### 3.1 Regiões de corrida (5 × 5 camadas; paralaxe da etapa 2.4)

**Em todas:**
- [C] céu: o halo do sol gira;
- [C] nuvens em 2 velocidades, separadas por faixa de linhas da camada;
- [C] pássaros ao longe e revoada em V a cada 15–35 s;
- [C] poeira ou areia soprada na pista e redemoinho nas rajadas fortes;
- [C] torcida da arquibancada: grupos pulam 1 px; a "ola" passa a cada ~9 s;
- [C] placa pendurada e biruta na cerca de trás.

| Região | Horizonte | Meio | Arquibancada | Frente |
|---|---|---|---|---|
| **Litoral** (amostra) | mar em ciclo de cor (brilho e ondulação sempre; crista que quebra na mureta com respingo), farol, veleiros | coqueiros: folhas ondulando sempre + balanço no vento | bandeirolas no toldo | capim da praia em onda contínua |
| **Várzea** | lagoa em ciclo de cor com o reflexo tremendo; casas sobre a água paradas | copas da mata balançando 1 px; garças: cabeça que abaixa e levanta [C], de vez em quando uma voa (Bando) | bandeiras do topo tremulando (deformação) | junco e capim em onda contínua |
| **Cerrado** | chapadas paradas; neblina baixa em ciclo lento (pontilhado de 2 tons) | ipês e pequizeiros balançando; pétalas amarelas caindo dos ipês (partícula) | 10 bandeiras do telhado tremulando | capim dourado em onda contínua |
| **Sertão** | fumaça da chaminé da casa de farinha (partícula); ar quente ondulando 1 px (como a Fornalha) | caatinga tremendo nas rajadas; o juazeiro balança; poeira | bandeirinhas de São João tremulando (2 cordões) | cana em onda contínua |
| **Planalto** | serras paradas; nuvem baixa passando entre os picos | araucárias balançando 1 px nas copas; **cata-vento girando** (ver 3.6) | — (telhado de telha) | capim alto em onda contínua (o mais solto) |

Na corrida, as camadas continuam a emendar com a câmera que enquadra a disputa (etapa 2.4 e refino de 2026-11-23). A
câmera é mexida pelo chat `claude/ajustes-1`: a integração na corrida espera essa frente entrar na `main` e é feita
por cima dela.

### 3.2 Arenas dos ginásios (cena do desafio, 256 × 160)

| Arena | O que mexe |
|---|---|
| **Fornalha** (amostra) | vulcão por código no pico da esquerda (cratera, fios de lava, fumaça contínua, estouro a cada 2,5–4,5 s com jorro e bombas); fosso e encostas de lava em ciclo de cor; bolhas que estouram no fosso; ar quente no céu e nas serras; braseiros e tochas (chama de 8 quadros, fagulhas); emblemas dos estandartes pulsando; brasas subindo |
| **Remanso** (água) | lago e canal em volta do anel em ciclo de cor (brilho e ondulação sempre, espuma na borda do anel); os 6 estandartes com a gota tremulando (deformação do pano); palmeiras dos lados balançando; nuvens finas; gaivotas |
| **Capoeira** (grama) | copas das árvores balançando 1 px, fora de fase; folhas caindo e em redemoinho nas rajadas; as 2 tochas com chama; capim do anel e do primeiro plano em onda contínua; vaga-lumes ou poeira de luz no caminho do fundo (partícula, pisca); pássaros |

O treinador da cena do desafio (corpo de 40 px) fica parado nesta frente. O idle dele (respiração de 1 px e piscar,
pelo mesmo método do cavalo) é opcional e entra só se o Vinicius pedir.

### 3.3 Cenas do topo das abas (256 × 160)

| Cena | O que mexe |
|---|---|
| **Estábulo** | lampiões das baias com a chama tremendo e o halo em ciclo de cor; partículas de poeira no ar; feno da porta balançando 1 px nas rajadas que entram; o cavalo ativo em idle (3.5) |
| **Haras** (amostra) | pasto com faixas de brilho que correm (vento no campo); copas balançando; borboletas; folhas soltas; revoada; cavalos em idle com comer e cavar |
| **Loja** | velas e lanternas tremendo; poções com bolhas e brilho em ciclo de cor; luz do chão pulsando devagar; poeira no ar |
| **Expedição** (amostra) | vulcão (lava em ciclo, fumaça na coluna pintada, jorro e bombas); rio com brilho e linhas de espuma descendo; placas do poste girando com o vento (encolhem até 5 px e voltam); matas e pinheiros balançando 1 px; capim em onda contínua; nuvens finas; pássaros e revoada; folhas e redemoinho |

### 3.4 Mapas das trilhas (256 × 384, vista de cima)

| Mapa | O que mexe |
|---|---|
| **Água** | rio e lagos em ciclo de cor (correnteza pelo desenho do rio); espuma nas margens; coqueiros balançando (vista de cima: a copa gira 1 px em volta do tronco); junco tremendo; peixe que pula de vez em quando (partícula com respingo) |
| **Fogo** | rachaduras de lava em ciclo de cor (o brilho corre pelas rachaduras); brasas e fumaça subindo das fendas maiores; ar quente; tufos secos tremendo |
| **Grama** | copas das árvores balançando (pulso de 1 px), capim e flores em onda contínua, borboletas, folhas e sombras de nuvem passando (pontilhado escuro que atravessa o mapa) |

Os ícones dos oponentes e o caminho no mapa não mexem. Estado e escolha ficam legíveis.

### 3.5 Cavalos

- **Retratos e cenas** (Estábulo, ficha, Haras, cena do desafio) em idle por código, a partir do mapa de papéis do
  molde e para qualquer pelagem, marca e raridade:
  - respiração (barriga 1 px a cada 3–4 s);
  - piscar (às vezes duas vezes);
  - cauda, orelha, aceno e sacudir a cabeça;
  - crina e cauda no vento.
  - Na "mais movimento" há um gesto a cada 1 a 3,5 s, e às vezes dois juntos.
- **Comer e cavar** [P] nos 12 moldes (retrato): quadros em papéis (cinza) em `prototype/assets/pixellab/idle/`,
  sorteados pela RNG cosmética entre os gestos, cerca de 1 vez a cada 15–30 s por cavalo. O retrato pequeno (64 × 56)
  não usa o comer: a cabeça sairia do quadro.
- **Antes da largada** (estado parado, com jóquei): o idle por código. O cavar com jóquei pede um lote próprio (12
  moldes no estado parado); fica como opção (3.6).
- **Na corrida**: o galope de 9 quadros de hoje não muda. A crina e a cauda já se movem nele.
- **Âncora do olho** no JSON de cada molde (`ancoras.<estado>.olho`, a lista de pixels). Ela é gerada pelo
  `pixellab-moldes.mjs --reprocessar` com a busca da amostra e corrigida à mão onde falhar. A busca automática não
  separa o olho das linhas da cara do robusto-folhas. O `moldes-test` passa a conferir que todo molde tem o olho.

### 3.6 Onde o código não basta (opcional, pago, só com confirmação)

| Item | Ferramenta | Gerações | Por quê |
|---|---|---|---|
| Cata-vento do Planalto girando | PixelLab `inpaint` (apagar as pás pintadas) + pás por código | 2–4 | as pás estão pintadas sobre as araucárias; sem o fundo atrás delas, girar deixa um borrão |
| Cavar com jóquei (antes da largada) | `animate-with-text-v3`, estado parado | 12–16 | a pateada com o jóquei montado, na largada |
| Vulcão por VFX (reserva) | `/v2/vfx` | 4 | só se o vulcão por código for reprovado (ele foi aprovado na amostra) |

## 4. Custo em créditos

| Lote | Ferramenta | Gerações | Estado |
|---|---|---|---|
| Piloto do idle (padrão-lisa: comer ×2, cavar ×2, cauda, respiração) | PixelLab `animate-with-text-v3` | 6 | feito (915 → 909) |
| Comer e cavar nos 12 moldes (retrato), com refação dos defeituosos | PixelLab `animate-with-text-v3` | __LOTE__ | __LOTE_ESTADO__ |
| Opcionais (3.6) | PixelLab | 18–24 | só com confirmação |
| Todo o resto (5 regiões, 3 arenas, 4 cenas, 3 mapas, idle por código) | código | 0 | — |

Sem Retro Diffusion e sem Canva. Saldo de referência: PixelLab __SALDO__/2000.

## 5. Testes e regras

- **Determinismo**:
  - `ambiente.js` não importa `sim.js` e não chama `Math.random`. Um teste no `fx-test` confere as duas coisas pelo
    texto do arquivo, como já se faz para o Dado.
  - A mesma semente cosmética desenha os mesmos quadros (teste de instantâneo de 3 quadros por tela, em hash).
- **Paleta e pixel**:
  - os quadros pré-assados e os do PixelLab passam pelo `arte-check` (cores da Resurrect 64, alfa binário);
  - os quadros do PixelLab passam também pelo `moldes-test` (papéis válidos, sem pixels soltos fora do corpo: a
    mesma conferência do lote).
- **Interface** (`ui-test`):
  - bloco de desempenho do ambiente (2.4);
  - com "Animações: Reduzidas", cada tela fica igual à captura parada de hoje;
  - nada de rolagem horizontal nem de erro de console.
- **Capturas oficiais** (`prototype/screens/`) tiradas com o tempo congelado num quadro fixo (`?quadro=` do motor),
  para não oscilarem entre execuções.

## 6. Ordem de implementação (o plano detalha depois da aprovação)

1. Motor `ambiente.js`, manifesto, ferramenta de máscaras, testes de determinismo e paleta. Nenhuma tela muda ainda.
2. Cavalos:
   - âncora do olho nos 12 moldes;
   - idle por código nos retratos e nas cenas;
   - comer e cavar do PixelLab nos lugares onde cabem.
3. Cenas das 4 abas e as 3 arenas da cena do desafio.
4. Mapas das 3 trilhas.
5. Regiões na corrida, depois que a câmera do `claude/ajustes-1` entrar na `main`, com os quadros pré-assados e o
   teto de 0,30 ms.
6. Desempenho num celular real (a rodada longa e o Android fraco do `docs/teste-engine.md` §7) com o ambiente ligado.

Cada etapa termina com o `check.sh` completo, as capturas e o DEV do ramo publicado para o Vinicius ver.
