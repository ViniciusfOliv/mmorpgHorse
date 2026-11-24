# Animação ambiente — plano de implementação

_2026-11-24 · branch `claude/animacao-ambiente` · spec aprovada pelo Vinicius em 2026-11-24:
`docs/superpowers/specs/2026-11-23-animacao-ambiente-design.md`. Amostra de referência:
https://claude.ai/artifact/2azaDeDRV77ZhvYCuhQNmz (`prototype/arte/animacao-amostra.html`; o motor está em
`prototype/arte/animacao.js`)._

> **Para agentes:** cada etapa é uma entrega própria. Sai da `main` atualizada, termina com o `check.sh` completo, as
> capturas e o DEV do ramo publicado para o Vinicius ver, e só entra na `main` depois do "aprovado" dele. Os passos
> usam caixas (`- [ ]`).

**Objetivo:** nenhuma imagem parada no jogo, na versão "mais movimento" com a vegetação e a água mexendo o tempo todo.
Isso vale para as 5 regiões, as 3 arenas, as 4 cenas das abas, os 3 mapas das trilhas e os cavalos. Tudo natural, no
pixel inteiro, na Resurrect 64 e dentro do orçamento de cada tela.

## Restrições globais

- **Só apresentação.** Nenhuma regra, número, sorteio ou texto de regra muda.
  - `sim.js`, `data.js`, `breed.js`, `gear.js`, `itens.js`, `ginasio.js`, `afk.js` e `forja.js` não são tocados.
  - O `balance.js` dá o mesmo resultado antes e depois de cada etapa.
- **RNG só cosmética** (mulberry32 de semente fixa por tela), separada da seed das regras. Nada de `Math.random`.
- `prototype/dist/` só pelo build, commitado junto. Commits pequenos, no imperativo, em português.
- **Gasto pago:** os assets pagos desta frente já estão feitos (seção "Assets prontos"). Uma refação ou uma geração
  nova só acontece com um dry-run do script e o "sim" do Vinicius.
- **"Animações: Reduzidas"** e `prefers-reduced-motion` mostram as imagens paradas de hoje.
- **Integração visual:** o personagem não pode parecer "PNG por cima do fundo". Vale o guia de integração que a
  coordenação está preparando (sombras de contato, luz, contorno e cor casando com a cena). A seção "Integração do
  personagem" abaixo é o mínimo; quando o guia chegar, ele manda.

## Coordenação com as outras frentes

- **`claude/ajustes-1`** (câmera da corrida e telas do jogo): a etapa 5 (regiões na corrida) só começa depois de essa
  frente entrar na `main`, e é feita por cima dela. As outras etapas não tocam a câmera.
- **Chat do mapa** (session_01MGExzNonug97azLPSXwF1p): esse chat fica com o mapa-múndi, a pista de terra que se pinta, o
  cavalo trotando e as transições. Esta frente fica só com o ambiente **dentro** dos mapas das trilhas (água, lava,
  árvores; spec §3.4).
  - A divisa é uma camada: `Ambiente.cena('mapa:<elemento>')` desenha o fundo animado do mapa; o caminho, os oponentes,
    o cavalo e a pista que se pinta do outro chat vão por cima.
  - Antes da etapa 4, combinar com ele: a ordem das camadas, a rolagem (o trecho visível) e quem chama o
    `atualiza`/`desenha`.

## Assets prontos (pagos e por código)

| Asset | Onde | Custo |
|---|---|---|
| Comer e cavar nos 12 moldes (retrato) | `prototype/assets/pixellab/idle/<porte>-<crina>-retrato-{comer-s8102,cavar-s8111}-0..8.png` | 6 (piloto) + 30 gerações |
| Cavar com jóquei nos 12 moldes (parado) | `prototype/assets/pixellab/idle/<porte>-<crina>-parado-cavar-s*-0..8.png`; escolhas em `idle/escolhas-joquei.json` | __JOQUEI__ gerações |
| Planalto sem as pás pintadas (para o rotor por código) | `prototype/assets/arte/planalto/meio-sem-pas.png` (`arte-animacao-moinho.mjs --compor 8203`) | 3 gerações |
| Motor, primitivas, adereços, rotor, idle por código | `prototype/arte/animacao.js` (vira `prototype/src/ambiente.js` na etapa 1) | código |

Total da frente: __TOTAL__ gerações do PixelLab; nada na Retro Diffusion.

## Visão das etapas

| # | Etapa | Toca `src/`? | Depende de |
|---|---|---|---|
| 1 | Motor no jogo (`ambiente.js`), manifesto, máscaras, pré-assado, testes; nenhuma tela muda ainda | sim | — |
| 2 | Cavalos: âncora do olho, idle por código, comer e cavar, cavar com jóquei, integração no chão | sim | 1 |
| 3 | Cenas das 4 abas e as 3 arenas da cena do desafio | sim | 1 (2 para os cavalos das cenas) |
| 4 | Ambiente dos mapas das 3 trilhas | sim | 1; camada combinada com o chat do mapa |
| 5 | Regiões na corrida, com o cata-vento e os quadros pré-assados | sim | 1; `claude/ajustes-1` na `main` |
| 6 | Desempenho num celular real, capturas oficiais e oficiais republicados | não | 2–5 |

## Etapa 1 — Motor no jogo

**Arquivos:**
- novos: `prototype/src/ambiente.js`, `prototype/assets/arte/animacao.json`, `prototype/tools/arte-animacao-mascaras.mjs`;
- mexe: `prototype/build.mjs` e `prototype/tools/arte-embutida.mjs` (embutir o manifesto e as imagens novas),
  `prototype/tools/arte-check.mjs` e `prototype/tools/fx-test.js`.

- [ ] Levar para `ambiente.js` (sem mudar o comportamento) as peças da amostra:
  - as primitivas `CicloCor`, `Deforma` (com a lista de pixels perto da peça e o `aplica` em imagem achatada),
    `Particulas`, `Bando`, `Revoada` e `Agenda`;
  - os adereços (bandeirola, placa, biruta, chama, jorro, rotor);
  - o vento e a RNG cosmética.
- [ ] API `Ambiente.cena(id, { imagens, manifesto, semente })` → `{ atualiza(t, dt), desenha(ctx, cam), parada(ctx) }`.
  - `parada` desenha a imagem de hoje (usada em "Reduzidas").
- [ ] Manifesto: para cada imagem, as peças (cores, caixa, exclusões), as rampas, os pontos dos adereços e os
  parâmetros. As coordenadas que estão no código da amostra passam para cá.
- [ ] `arte-animacao-mascaras.mjs`: uma folha com cada máscara pintada sobre a imagem, para conferir.
- [ ] **Pré-assado** (spec §2.3): coqueiros, copas, capim, bandeiras e torcida viram quadros prontos ao abrir a tela.
  - São 8 a 12 fases × 3 níveis de vento, presos ao pixel inteiro.
  - O ciclo de cor e as partículas ficam em tempo real.
  - Medir a memória: ≤ 2 MB por tela.
- [ ] `arte-check`: toda imagem final tem entrada no manifesto e toda cor das rampas é da Resurrect 64.
- [ ] `fx-test`:
  - `ambiente.js` não importa `sim.js` nem chama `Math.random` (conferido pelo texto, como o Dado);
  - a mesma semente desenha os mesmos 3 quadros (instantâneo em hash).
- [ ] `check.sh` completo OK. Ainda não há DEV para mostrar, porque nada mudou na tela.

## Etapa 2 — Cavalos

**Arquivos:**
- mexe: `prototype/src/sprites.js` (idle e os quadros do PixelLab), `prototype/src/game.js` (onde os retratos e as cenas
  chamam o desenho), `prototype/tools/pixellab-moldes.mjs` e `moldes-lib.mjs` (âncora do olho),
  `prototype/tools/moldes-test.mjs` e o build (embutir os quadros de `idle/`).

- [ ] Âncora `olho` no JSON dos 12 moldes, em `retrato` e `parado`.
  - Gerada pela busca da amostra no `--reprocessar`; o robusto-folhas fica com a do `OLHO_MANUAL`, e o que mais falhar
    é corrigido à mão na folha.
  - O `moldes-test` passa a conferir que todo molde tem o olho.
- [ ] Idle por código no `sprites.js`, igual à amostra:
  - respiração, piscar, cauda, orelha, aceno, sacudir a cabeça, crina e cauda no vento;
  - RNG cosmética por cavalo (semente do `templateId`);
  - na "mais movimento", um gesto a cada 1–3,5 s.
- [ ] Comer e cavar do PixelLab como gestos raros (≈ 1 a cada 15–30 s), recoloridos como os moldes (marcas, jóquei e
  raridade inclusos). Não entram no retrato pequeno (64 × 56): a cabeça do comer sai do quadro.
- [ ] Cavar com jóquei na espera antes da largada (o estado parado), com a mesma regra.
- [ ] **Integração do personagem** (o mínimo; o guia da coordenação manda):
  - **sombra de contato**: elipse achatada de 2 tons sob os cascos, nos tons escuros da cena (troca de paleta do chão,
    não preto com alfa), deslocada 2 px para a direita pela luz de cima e da esquerda; ela acompanha o cavar e encolhe
    1 px quando a pata sobe;
  - **o chão por cima dos cascos**: na grama e no capim, uma faixa de 2–3 px de folhas da própria cena redesenhada na
    frente da linha dos pés (é o que tira o "recortado"); na terra, poeira de 1 px quando o cavalo pateia;
  - **luz da cena**: a pelagem passa pela mesma troca de paleta do clima ou da cena (quente na Fornalha e no Estábulo
    com os lampiões, fria no Remanso), em degrau leve, e ganha brilho de 1 px nas bordas de cima e da esquerda na cor
    da luz;
  - **contorno**: o 2e222f do guia §5, clareando para o tom escuro da própria rampa na borda iluminada (contorno
    seletivo), como os objetos do plano da pista.
- [ ] Folha de conferência com os 12 moldes × 4 pelagens nas cenas, e DEV do ramo publicado para a aprovação.

## Etapa 3 — Cenas das abas e arenas

**Arquivos:** mexe `prototype/src/game.js` (topo das abas e cena do desafio) e o manifesto (entradas novas).

- [ ] Ligar o ambiente no topo das 4 abas, com a tela parada quando a aba não está visível.
  - Estábulo: lampiões, poeira no ar, feno nas rajadas e o cavalo ativo em idle.
  - Haras: pasto em faixas de brilho, copas, borboletas e cavalos (comer e cavar).
  - Loja: velas, poções com bolhas e brilho, luz do chão e poeira.
  - Expedição: a cena da amostra.
- [ ] Ligar o ambiente na cena do desafio.
  - Fornalha: a cena da amostra, com o vulcão por código.
  - Remanso: lago e canal em ciclo de cor, espuma no anel, estandartes tremulando, palmeiras, gaivotas.
  - Capoeira: copas, folhas e redemoinho, tochas, capim, vaga-lumes, pássaros.
- [ ] Bloco de desempenho do ambiente no `ui-test`.
  - Teto por tela da spec §2.4: 0,35 ms nas abas e 0,40 ms nas arenas, no contêiner.
  - O bloco falha acima de 1,5 × o teto.
- [ ] `ui-test`: em "Reduzidas", cada tela fica igual à captura parada; sem rolagem horizontal; sem erro de console.
- [ ] Capturas com o tempo congelado (`?quadro=`), DEV publicado e aprovação.

## Etapa 4 — Mapas das trilhas

**Arquivos:** mexe `prototype/src/game.js` (o desenho do mapa, na camada combinada com o chat do mapa) e o manifesto.

- [ ] Combinar com o chat do mapa a camada, a rolagem e quem chama (ver "Coordenação").
- [ ] Mapa da água: rio e lagos em ciclo de cor pela direção da correnteza, espuma nas margens, coqueiros vistos de
  cima, junco e um peixe que pula de vez em quando.
- [ ] Mapa do fogo: rachaduras de lava em ciclo de cor, brasas e fumaça das fendas, ar quente e tufos secos.
- [ ] Mapa da grama: copas pulsando 1 px, capim e flores em onda, borboletas, folhas e sombras de nuvem.
- [ ] Só o trecho visível na rolagem anima; o caminho e os oponentes não mexem.
- [ ] Teto de 0,35 ms; capturas, DEV e aprovação.

## Etapa 5 — Regiões na corrida

**Arquivos:** mexe `prototype/src/sprites.js` (o fundo da região, `fundoRegiao` e a arquibancada) e o manifesto.
Começa depois de a `claude/ajustes-1` entrar na `main`.

- [ ] As 5 regiões, em todas as camadas (spec §3.1):
  - céu, nuvens, pássaros e revoadas;
  - água em ciclo de cor (mar do Litoral, lagoa da Várzea);
  - vegetação em quadros pré-assados;
  - torcida com a "ola";
  - bandeiras e bandeirinhas;
  - placa e biruta na cerca;
  - chaminé, ar quente, neblina e pétalas dos ipês.
- [ ] Planalto: `meio-sem-pas.png` no lugar do meio e o rotor por código (24 ângulos, velocidade pelo vento) preso à
  paralaxe da camada.
- [ ] As camadas continuam emendando com a câmera que enquadra a disputa, no zoom de 4 a 12 px/m (o rolar acumulado,
  sem salto).
- [ ] Teto de 0,30 ms do ambiente na corrida. As partículas do ambiente (≤ 60) somam com as da corrida, e o total fica
  em ≤ 150.
- [ ] O bloco `fluxo-desempenho` continua passando (completas − reduzidas ≤ 6 ms).
- [ ] O `balance.js` dá o mesmo resultado, porque a corrida não muda.
- [ ] Capturas, DEV e aprovação.

## Etapa 6 — Desempenho real e fechamento

- [ ] Rodada longa travada em 60 FPS e bateria num Android fraco, com o ambiente ligado (`docs/teste-engine.md` §7).
  - Se faltar folga: menos fases pré-assadas, menos partículas, ou o ambiente da corrida mais simples em "Reduzidas".
- [ ] Capturas oficiais (`prototype/screens/`) regeneradas com o tempo congelado.
- [ ] Os três artefatos oficiais republicados.
- [ ] `docs/memoria/` atualizado.
- [ ] Wiki: nada muda, porque não há regra nova.

## Riscos

- **O Litoral no limite** (≈ 2 ms no celular médio em tempo real): o pré-assado da etapa 1 é a resposta. Se não bastar,
  a ondulação contínua das folhas fica só no perto da câmera.
- **Fiapos de capim no comer do PixelLab**: apagados por código (peças soltas do corpo, até 60 px). Se aparecer algum
  quadro com um buraco no corpo, entra na lista de refação, que precisa de confirmação.
- **Conflito com a câmera da `ajustes-1`** e com o chat do mapa: a etapa 5 vem depois da câmera; a 4 vem depois do
  combinado da camada.
