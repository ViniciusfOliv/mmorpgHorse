# Direção de arte — plano para levar o padrão ao jogo inteiro

_2026-11-20, chat de direção de arte (branch `claude/direcao-de-arte`). Aprovado para escrever pelo Vinicius depois de
aprovar a amostra ("aprovado, pode fazer o plano em etapas")._

> **Para agentes:** cada etapa é uma entrega própria, com spec curta, plano de tarefas e revisão final antes da `main`,
> como as frentes anteriores. Os passos usam caixas (`- [ ]`) para marcar o andamento.

**Objetivo:** o jogo inteiro no padrão aprovado na amostra
(https://claude.ai/artifact/VnjQHdXSZ1cP45e9xCVsi2, `prototype/arte/`): um tamanho de pixel, paleta fechada, fonte
Galmuri, cenário em camadas por região, corrida em velocidade máxima na tela e a interface de hoje com a pele nova.

**Regras:** `docs/arte/guia.md` (todo asset é conferido contra ele). Ferramentas: `docs/arte/ferramentas.md`. Custos de
referência: `docs/arte/custos.md`.

## Restrições globais

- **Só visual.** Nenhuma regra, número, sorteio ou texto de regra muda; `sim.js`, `breed.js`, `gear.js`, `itens.js` e
  `ginasio.js` não são tocados. O `balance.js` tem de dar o mesmo resultado antes e depois de cada etapa.
- Nada de `Math.random` nos efeitos (hashes da seed e do tempo, como hoje). A corrida continua determinística.
- `prototype/dist/` só pelo build, commitado junto. Commits pequenos, no imperativo, em português.
- **Gasto pago só com confirmação do Vinicius por etapa**: cada etapa paga começa com o dry-run do script (lista de
  chamadas e custo) e só gera depois do "sim" dele. Todo asset entra em `docs/memoria/assets.md` e tem script
  reprodutível (dry-run por padrão, `--gerar`, tetos).
- **Aprovação visual do Vinicius no fim de cada etapa** (folha de contato ou build de teste publicado), antes da `main`.
- Interface: a estrutura de hoje fica (guia §8b); muda o pixel (`--px`), a paleta e a fonte.

## Coordenação com as outras frentes

- **Skills com ranks** (`claude/skills-ranks`, em fechamento): mexe em `game.js`, `fx.js`, `data.js` e no save. As
  etapas que tocam `prototype/src/` (1, 3, 4, 5, 6 e 7 na parte de código) só começam **depois de ela entrar na
  `main`**, e cada uma sai da `main` atualizada.
- **Teste de engine** (fechado em 2026-11-19: **fica web**; Steam por Electron): o desenhador desta frente é o do
  navegador. As alavancas de desempenho que o teste deixou (escala menor, menos camadas de clima, WebGL2 da pista)
  continuam valendo; a resolução de arte já é a da Steam em paisagem (640 × 360, guia §2).
- **Enquanto a `main` não libera**, esta frente adianta o que não toca `prototype/src/`: os assets pagos das etapas 2, 5
  e 7 (em `prototype/assets/arte/` e `prototype/tools/`), as folhas de contato e a conferência automática (etapa 0).

## Visão das etapas

| # | Etapa | Toca `src/`? | Custo previsto | Depende de |
|---|---|---|---|---|
| 0 | Ferramentas de arte (conferência automática, folhas de contato, regiões) | não | zero | — |
| 1 | Fundação no jogo: grade de pixel, paleta, Galmuri, desenho em resolução de arte | sim | zero | skills na `main` |
| 2 | Corrida no padrão novo, com o Cerrado | sim | zero (assets da amostra) | 1 |
| 3 | As outras 4 regiões de corrida e os 3 pisos | sim (dados das regiões) | ~US$ 8 + ~40 gerações | 2 (assets podem vir antes) |
| 4 | Interface de todas as telas e os ícones em 16 × 16 | sim | ~140 gerações | 1 |
| 5 | Treinadores na escala certa, bustos e a cena do desafio | sim | ~300 gerações + ~US$ 1,50 | 1 (assets podem vir antes) |
| 6 | Cenas de tela (Estábulo, Haras, Loja, Expedição) e mapas da Expedição | sim | ~190 gerações + ~US$ 2 | 4 |
| 7 | Marca: logo na grade, ícone do app, capa e arte da loja | pouco | ~100 gerações | 2 (logo pode vir antes) |
| 8 | Fechamento: créditos, declaração de IA, limpeza | sim | zero | todas |

**Total previsto:** ~770 gerações do PixelLab (~930 com 20% de reserva) e ~US$ 12 a 15 na Retro Diffusion (há US$ 3,04
de saldo; falta recarregar ~US$ 10). É bem menos que a estimativa de 2.350 gerações de `custos.md`: o piloto mostrou que
as camadas saem mais baratas pela Retro Diffusion e pelo Pixen, e o quadro de estilo por região não é necessário. A cota
do PixelLab hoje (1.533 gerações) cobre tudo.

---

## Etapa 0: ferramentas de arte (sem custo; pode começar já)

- [ ] `prototype/tools/arte-check.mjs`: a conferência do guia §10 em todo PNG de `prototype/assets/arte/` usado no jogo
  (cores na paleta da região ou na mestra, alfa binário, tamanho do quadro, grade 1:1, emenda horizontal das camadas).
  Entra no `scripts/check.sh` como etapa própria.
- [ ] `prototype/tools/arte-paleta.mjs`: as paletas das 5 regiões (32 cores cada) e as tabelas de clima.
- [ ] `prototype/tools/folha-arte.mjs`: folha de contato de uma região (camadas repetidas lado a lado, objetos, a cena
  montada na escala do jogo) para a aprovação.
- [ ] Os PNGs escolhidos da amostra passam para `prototype/assets/arte/cerrado/` com nomes finais
  (`ceu-nuvens.png`, `horizonte.png`, `meio.png`, `arquibancada.png`, `frente.png`); os de teste ficam em `piloto/`.

## Etapa 1: fundação no jogo (sem custo)

Spec curta antes. Arquivos: `game.css`, `sprites.js`, `game.js` (o mínimo), `build.mjs`, `tools/arte-embutida.mjs`.
- [ ] **Grade de pixel:** `s` inteiro pela regra do guia §2 (retrato: largura de arte perto de 256; paisagem: 640 × 360);
  `--px` no CSS; o canvas da corrida desenha num buffer do tamanho da arte e copia com um `drawImage` só (troca o
  `fillRect(x × S, …)` de hoje). A regra do `CANVAS_MAX_PX` vira desnecessária no buffer pequeno.
- [ ] **Moldes 1:1:** o cavalo sai na escala da grade (1 pixel do molde = 1 pixel de arte), em todos os lugares
  (corrida, retratos, pódio, cena do desafio). Hoje é `round(k × 40 / Lref)`.
- [ ] **Paleta:** tokens do `game.css` apontam para a Resurrect 64 (guia §3, papéis fixos); as cores dos cavalos
  (pelagem, crina, detalhe, seda, marcas do `marcas.js`) são resolvidas na mestra na hora de recolorir (o dado do save
  não muda).
- [ ] **Fonte:** Galmuri 7, 9, 11 e 11 Bold embutidas (subconjunto latino, `prototype/assets/fontes/`), com atlas de
  glifos no canvas; saem Press Start 2P, Jersey 10 e a fonte 3×5 do `sprites.js` (o wiki usa a 3×5: confere-se lá também).
- [ ] **Medida:** chamadas de desenho por quadro e ms de JavaScript no `ui-test` (limites do guia §9: 300 e 2 ms; o
  limite de 4.500 de hoje sai).
- [ ] Verificação: `check.sh` OK; capturas oficiais regeneradas (todas mudam de propósito); folha da interface
  (`prototype/dist/interface.html`) atualizada; build de teste DEV publicado para o Vinicius.

## Etapa 2: corrida no padrão novo, com o Cerrado (sem custo)

O que a amostra mostrou, no jogo de verdade. Arquivos: `sprites.js` (`drawTrack`), `fx.js`, `game.js` (desenho da corrida).
- [ ] Camadas por região (céu, nuvens, horizonte, meio, arquibancada como objeto espaçado, pista, cercas, frente) com as
  paralaxes do guia §8a; chão, cercas e placas de distância por código.
- [ ] **Câmera a 12 px de arte por metro e galope a 21 quadros/s** (guia §8a; hoje `ppmArt` 2 a 2,5). Conferir com
  cuidado o que depende da escala: o "foto de chegada", a faixa do lugar, as etiquetas de quem sai da tela (viram setas
  na borda), o minimapa e o teste "cavalo sempre na tela".
- [ ] **Curvas e subidas** (já existem): o arco da curva e o relevo da subida passam a deslocar a pista e as cercas em
  pixels de arte inteiros; as camadas de fundo não sobem.
- [ ] **Clima por troca de paleta** das camadas, pré-desenhadas por clima no início da corrida (guia §3); chuva em folha
  pré-desenhada; névoa por pontilhado; relâmpago como única camada com alfa.
- [ ] **Efeitos do `fx.js` na paleta e na grade:** Dado da Sorte (faixa no céu, não nas raias), balões de skill (no máximo
  2 nas raias), auras, rastros, poeira, respingos, folhas, curvas. Os testes do `fx-test.js` que medem caixas em pixels
  de arte são revistos com a escala nova.
- [ ] HUD do céu e a interface embaixo da pista como na amostra (estrutura de hoje, pele nova).
- [ ] Paisagem e Steam: a mesma cena em 640 × 360 (mais pista de lado).
- [ ] Verificação: `check.sh`, `fx-test`, `ui-test` com as capturas regeneradas; medir o pior caso (8 cavalos, chuva,
  ventania, Dado e 2 balões) no celular do Vinicius pelo artefato, como no teste de engine.

## Etapa 3: as outras regiões de corrida (~US$ 8 + ~40 gerações)

As 8 pistas viram 5 regiões (proposta; o Vinicius confirma os nomes e o clima de cada uma):

| Região | Pistas | Cenário |
|---|---|---|
| Cerrado | Prado do Cerrado | pronto na amostra |
| Várzea | Hipódromo da Lagoa, Prado Beira-Rio | lagoa, mata ciliar, garças, palafitas |
| Planalto | Hipódromo do Planalto, Raia da Ventania | campos de altitude, araucárias, cata-ventos |
| Sertão | Hipódromo do Sertão Velho, Raia do Engenho | caatinga, mandacarus, engenho e canavial |
| Litoral | Prado das Palmeiras | coqueiros, mar ao fundo, dunas |

- [ ] Por região: paleta de 32 cores; horizonte (PixelLab Pixen, 2 a 4 sementes); meio e frente (Retro Diffusion Core,
  2 imagens cada); arquibancada com a cara da região (RD Core com a camada do meio de referência); emendas
  (`seam_tiling`). ~US$ 2 + ~10 gerações por região, com refações.
- [ ] Pisos: terra (pronto), grama e areia por código, nas paletas das regiões.
- [ ] Folha de contato por região para aprovação; os assets podem ser gerados antes da etapa 2 entrar na `main`.

## Etapa 4: interface de todas as telas e ícones (~140 gerações)

- [ ] Todas as telas (Estábulo, Montaria e abas, Correr, Expedição, Haras, Loja, Mochila, Perfil, resultado, ginásios,
  gaveta DEV) com a pele nova: `--px`, paleta, Galmuri, peças de pixel do `interface-arte.mjs` redesenhadas na grade
  (molduras, rebites, placas de madeira, bisel). A estrutura e os textos não mudam.
- [ ] **Ícones em 16 × 16** (os ~70 de hoje são 32 × 32 mostrados menores, o que o guia proíbe): refeitos no PixelLab
  Pixen 16 × 16 (1 geração, 2 sementes cada), com o ícone atual de referência no prompt; contorno `2e222f`. Os 8 × 8 da
  pista ficam em código.
- [ ] Opcional, se o Vinicius quiser textura mais rica nas placas e painéis: `create_ui_asset` do PixelLab na paleta
  (10 a 25 gerações por componente), recortado em 9 fatias por script.
- [ ] Verificação: `ui-test` (alturas, rolagem, toque mínimo de 48 px CSS), folha da interface, capturas.

## Etapa 5: treinadores, bustos e a cena do desafio (~300 gerações + ~US$ 1,50)

- [ ] **15 treinadores no corpo de 40 px** (quadro 32 × 48; hoje 58 a 64 px, 1,5 vez grandes demais): PixelLab Pro
  (`generate-image-v2`, 25 candidatos por 10 gerações), a arte atual como referência de roupa e o molde do cavalo como
  referência de estilo, paleta travada.
- [ ] **Bustos 64 × 64** para os cartões e o cabeçalho do duelo (Pro, 16 candidatos por 10 gerações).
- [ ] **Cena do desafio** com o fundo de cada ginásio (Fornalha, Remanso, Capoeira) em camadas (RD Core), cavalos e
  treinador na mesma escala.

## Etapa 6: cenas de tela e mapas da Expedição (~190 gerações + ~US$ 2)

- [ ] O Estábulo deixa de ter meia tela vazia: cena de baias por trás da lista (a lista continua igual), e o cavalo
  ativo parado e respirando no molde 1:1. Haras, Loja e Expedição com cenas próprias, discretas atrás da interface.
- [ ] Mapas das 3 trilhas da Expedição (a trilha de hoje, desenhada como mapa).

## Etapa 7: marca (~100 gerações)

- [ ] **Logo na grade de pixel** (PixelLab Pro, ~128 × 48, 4 candidatos por chamada; letras acertadas à mão em código),
  em 1× no cabeçalho e 2×/3× pela regra de escala inteira; o logo do Canva sai.
- [ ] **Ícone do app** 128 × 128 ampliado 4× (512 × 512, sem texto, quadrado cheio: regra do Play).
- [ ] **Feature graphic** 1024 × 500 (512 × 250 de arte ×2, sem alfa) e capa: compostas por código com as camadas, os
  cavalos e o logo; arte-chave no PixelLab Pro se faltar algo. Capturas para as lojas na etapa de lançamento.

## Etapa 8: fechamento

- [ ] Tela de créditos: Galmuri (OFL, texto da licença), Resurrect 64 (Kerrie Lake), ferramentas de IA usadas.
- [ ] Declaração de IA da Steam a partir de `docs/memoria/assets.md` (tudo que o jogador vê).
- [ ] Saem do repositório os assets substituídos (ficam no histórico do git): fontes antigas, ícones de 32, logo e capa
  do Canva, treinadores de 64.
- [ ] GDD (arte), wiki e memória atualizados.

## Riscos

- **Curvas, subidas e Dado com a câmera rápida:** a amostra não tinha curva nem Dado; a etapa 2 começa por uma maquete
  desses três casos antes de mexer no desenho todo.
- **Medidas de tela que mudam com a grade nova** (alturas do Estábulo e do Status, a faixa de ordem): o `ui-test` tem
  tetos de altura; mudam por decisão, não por acaso.
- **Fonte maior em algumas telas** pode empurrar alturas: a Galmuri 11 é usada onde hoje há texto de ~20 px CSS.
- **Estilo entre Retro Diffusion e PixelLab:** a paleta fechada e a folha de contato de cada região seguram a unidade;
  se uma região destoar, refaz-se a camada, não se aceita.
- **Peso do build:** ~150 KB por região (guia §9); com 5 regiões, ~750 KB a mais no `jogo.html` de hoje (~860 KB). Se o
  artefato reclamar, as regiões carregam sob demanda.
