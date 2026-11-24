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
- **Integração visual:** o personagem não pode parecer "PNG por cima do fundo". Manda o guia `docs/arte/integracao.md`
  (na `main` desde 93d4741), com as Regras 1–15 e o checklist C1–C12, e a etapa 0 faz os itens P1 dele **antes** de animar
  mais coisa. As decisões D1–D6 do guia estão com o Vinicius; nada da etapa 0 depende delas. O contorno de material
  e o casco sem contorno (D3) e a névoa sólida (D4) ficam atrás de uma chave até o "sim" dele.

## Coordenação com as outras frentes

- **`claude/ajustes-1`** (câmera da corrida e telas do jogo): já está na `main` (d74ebb2). As etapas 0 e 5 saem da
  `main` atualizada e mexem por cima dela.
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
| Cavar com jóquei nos 12 moldes (parado) | `prototype/assets/pixellab/idle/<porte>-<crina>-parado-cavar-s*-0..8.png`; escolhas em `idle/escolhas-joquei.json` | 14 gerações (12 + 2 refações com a seed 8113) |
| Planalto sem as pás pintadas (para o rotor por código) | `prototype/assets/arte/planalto/meio-sem-pas.png` (`arte-animacao-moinho.mjs --compor 8203`) | 3 gerações |
| Motor, primitivas, adereços, rotor, idle por código | `prototype/arte/animacao.js` (vira `prototype/src/ambiente.js` na etapa 1) | código |

Total da frente: 53 gerações do PixelLab (6 + 30 + 14 + 3), contadas pelos registros da API (1 por chamada); nada na Retro Diffusion. Saldo em 2026-11-24: 848/2000 (o saldo caiu 14 a mais no mesmo período, provavelmente por outro chat usando a mesma conta).

## Visão das etapas

| # | Etapa | Toca `src/`? | Depende de |
|---|---|---|---|
| 0 | **Integração do personagem (P1 do guia, só código):** sombra opaca na rampa do chão, LUT de luz e clima no atlas, pelagem em 4 tons, constantes na paleta, contato e casco sem patinar, leitura por valor | sim | — |
| 1 | Motor no jogo (`ambiente.js`), manifesto, máscaras, pré-assado, testes; nenhuma tela muda ainda | sim | 0 |
| 2 | Cavalos: âncora do olho, idle por código, comer e cavar, cavar com jóquei, já com a integração da etapa 0 | sim | 0, 1 |
| 3 | Cenas das 4 abas e as 3 arenas da cena do desafio | sim | 0, 1 (2 para os cavalos das cenas) |
| 4 | Ambiente dos mapas das 3 trilhas | sim | 1; camada combinada com o chat do mapa |
| 5 | Regiões na corrida, com o cata-vento e os quadros pré-assados | sim | 0, 1 (a câmera da `ajustes-1` já está na `main`) |
| 6 | Desempenho num celular real, capturas oficiais e oficiais republicados | não | 2–5 |

## Etapa 0 — Integração do personagem (P1 do guia, só código, sem créditos)

> **Feita no ramo em 2026-11-24** (commits 67d738f, 4f7f649, ff6b109, 0714739, bfe0b5f, 015192a). Desvios: os 4 tons
> saem na recoloração (`Sprites.sombreiaPelagem`) sem papéis novos no PNG; a passada e os pousos são medidos dos moldes
> na carga (`Sprites.passadaDe`), não gravados no JSON; o casco sem patinar ficou como opção da gaveta DEV ("galope
> casado"), porque a reprodução comprimida (~2×) exige ~36 q/s — **decisão do Vinicius**; a leitura por valor escolhe o
> degrau do piso por clima sem clarear na escada sol → nublado → chuva. Prancha: `prototype/tools/prancha-etapa0.mjs`.

A ordem segue o guia §4, "Ordem sugerida", itens 1 a 6. Tudo o que depende de luz, clima, sombra ou contorno é pré-assado
na montagem do atlas (no início da tela ou da corrida). No laço da corrida não há `getImageData`/`putImageData`, nem
objeto novo, e são ≤ 3 desenhos por cavalo (guia §9; guia de integração, "Princípio de desempenho"). Cada item tem o
seu teste e o seu commit. O `balance.js` não muda.

**Arquivos:**
- novo: `prototype/src/luz.js`, só apresentação, com as tabelas `RAMPAS` e `LUZ_CENA` e a montagem das LUTs;
- mexe: `prototype/src/sprites.js` (atlas, sombra, recoloração, contorno), `prototype/src/fx.js` (poeira e contato),
  `prototype/src/game.js` (cenas: Estábulo e desafio), `prototype/tools/moldes-lib.mjs`, `pixellab-moldes.mjs`,
  `arte-animacao-piloto.mjs` (papéis novos), `moldes-test.mjs`, `arte-check.mjs`, `fx-test.js` e `ui-test*.mjs`.

1. **Sombra opaca na rampa do chão** (Regra 2; a causa nº 1 do "PNG colado").
   - [ ] `LUZ_CENA` por tela e condição, com a vista, a direção (dx, dy) e a cor da sombra no degrau 1 abaixo da rampa
     do chão. Exemplos: pista do Litoral `cd683d → 9e4539 / 6e2727`; grama `547e64 → 374e4a`; palha do Estábulo;
     chão da arena.
   - [ ] Um sprite de sombra por quadro e por condição, pré-assado da silhueta do quadro:
     - vista lateral (corrida, idle): elipse de 2 tons, +2 px para a direita, com a faixa de contato de 1–2 px dois
       degraus abaixo;
     - vista de cima (arena, desafio, trilha): a silhueta inteira deslocada na diagonal, em 1 tom.
     - No idle, a sombra acompanha o quadro: respira com o corpo e encolhe 1 px quando a pata sobe no cavar.
   - [ ] A mesma sombra nos treinadores e nos objetos da cena do desafio.
   - [ ] Sai a sombra `rgba(20,10,20,0.28)` de hoje (`sprites.js` ~1311–1321 e ~877–882).
   - [ ] Teste com catraca no `arte-check`: as fontes de alfa parcial em `fx.js`, `sprites.js` e `game.js` (hoje 23,
     24 e 5) entram numa lista de exceções que só pode diminuir. O relâmpago é a única exceção permanente.
   - [ ] Teste no `ui-test`: o pixel abaixo e à direita do casco pertence à rampa do chão.
2. **LUT de luz e clima por rampa, pré-assada no atlas** (Regra 8).
   - [ ] `RAMPAS` da Resurrect 64 com hue shift. Começa pelas do guia (verdes, neutros quentes, terra), é completada à
     mão e conferida numa prancha.
   - [ ] Uma LUT 64 → 64 por condição: dia, tarde, noite, chuva, neblina, calor. Ela desloca degraus **dentro** da
     rampa, em vez de buscar a "cor mais próxima", para não fundir os tons. Ajuste à mão.
   - [ ] Tinta ambiente por cena, que entra na LUT da cena:
     - Fornalha: sombra `6e2727/45293f`, brilho `f79617/fbb954`;
     - Estábulo: âmbar;
     - Remanso: frio.
   - [ ] Contraluz de 1 px só com fonte emissiva (lava, lampião, pôr do sol), do lado da fonte e só onde o pixel já é o
     degrau mais claro.
   - [ ] Pré-assar as condições que a corrida vai usar (a sequência de clima já sai da seed) no atlas dos cavalos e
     dos treinadores e nas camadas.
   - [ ] Transição de clima em 3–4 passos de degrau, também pré-assados. Somar a memória ao teto de 16 MB por tela.
   - [ ] Testes, Regra 8 (a)–(e):
     - o cavalo escurece junto com o fundo;
     - nenhuma cor fora da paleta depois da LUT;
     - o mesmo número de tons por material em toda condição;
     - o quadro da virada fica dentro do orçamento.
3. **Pelagem dos moldes em 4 tons** (Regra 4).
   - [ ] Papéis novos: pelo-luz, pelo, pelo-sombra e pelo-sombra-profunda, e o mesmo na crina. O formato do molde
     passa de "cinza = papel × 25" para "cinza = papel × 17" (até 15 papéis), com a migração no `moldes-lib`, no
     decodificador do `sprites.js` e no `moldes-test`.
   - [ ] Os crus têm quase só 2 tons de pelagem (medido: um vermelho claro e um escuro, com variações pequenas), e os
     quadros do idle vêm planos. Por isso as 4 faixas saem de um **sombreado por código**: luz de cima e da esquerda
     sobre a silhueta, a borda de cima e da esquerda vira luz e o fundo de baixo e da direita da sombra vira sombra
     profunda, em massas e sem pixel solto.
     - Os tons do cru entram como pista onde existirem.
     - O mesmo cálculo vale para o retrato, o parado, o galope e os quadros do PixelLab (comer, cavar, cavar com
       jóquei), para baterem.
   - [ ] Recoloração por "um degrau abaixo na rampa" (`RAMPAS`), no lugar do `naMestra` "mais escura mais perto" e do
     `shade(coat, 0.35)`. Assim a sombra do cavalo e a do chão caem nas mesmas famílias frias.
   - [ ] Ruão e tordilho em manchas agrupadas, no lugar do xadrez de 50%.
   - [ ] Testes: ≥ 4 tons de pelo e de crina da mesma rampa no atlas, e nenhum xadrez 1×1 regular maior que 4×4.
4. **Constantes na paleta** (Regra 3, parte sem decisão).
   - [ ] Na origem: `#1a1405 → 2e222f`; pele `#e8b48a` e sela `#5a3a22` para os tons da mestra (`sprites.js:929`).
   - [ ] O contorno na cor do material e o casco sem contorno no chão ficam prontos atrás de uma chave, ligada só depois
     do D3.
   - [ ] Teste: nenhum pixel `#1a1405` e nenhum fora da Resurrect 64 no atlas.
5. **Contato com o chão e casco sem patinar** (Regras 7 e 12).
   - [ ] Corrida, por raia, da de cima para a de baixo, na ordem sombra → cavalo → contato da raia:
     - sulcos e torrões na cor do chão, com paralaxe 1,0;
     - cobrindo 1–3 px do casco de forma intermitente;
     - grama e torrões só na borda de baixo da pista;
     - a sombra da cerca de trás sobre a raia de cima.
   - [ ] Poeira em 2 tons da cor do chão onde o cavalo pisa, nascendo no quadro de contato. O quadro de contato e a
     passada em pixels de arte ficam marcados no JSON de cada molde.
   - [ ] O ciclo do galope e a rolagem da pista casados por quadro; câmera, camadas e sprites arredondados na mesma
     grade e na mesma ordem.
   - [ ] **Base de quadros comum: 12 q/s**, com ciclos em múltiplos dela. A amostra usa 8, 10 e 12 e passa a usar 6 e 12.
   - [ ] Idle e cenas:
     - poeira ou palha no cavar;
     - tufos da própria cena redesenhados na frente da linha dos cascos (grama, palha);
     - no Estábulo, palha à frente dos cascos e o brilho amarelo da última linha do casco removido.
   - [ ] Testes no `ui-test`:
     - o casco fica coberto em parte dos quadros, nunca em todos;
     - nenhum contato de uma raia por cima do corpo do cavalo da raia de baixo;
     - no quadro de contato, o x do casco anda igual ao do chão, com folga de ±1 px.
6. **Leitura por valor** (Regra 14).
   - [ ] Para cada cena e condição, a diferença de valor entre o corpo do cavalo e o chão sob ele.
   - [ ] Abaixo do limite, a tabela da cena escolhe o remédio: outra cor de chão na faixa das raias, a variante de
     contorno escuro ou o contraluz, este só com fonte emissiva.
   - [ ] Caso conhecido: o castanho `9e4539` na pista `cd683d` do Litoral.
   - [ ] Teste no `arte-check`/`ui-test`, com o limite calibrado numa prancha em escala de cinza.

- [ ] Prancha de aceite (guia §5): corrida, Estábulo e desafio, antes e depois.
  - A 1× e a 3×, ao lado das duas referências do Vinicius.
  - Em dia, neblina, chuva e noite.
  - Uma versão em escala de cinza.
  - O checklist C1–C12 marcado.
- [ ] `check.sh` completo, DEV do ramo publicado e aprovação do Vinicius antes da `main`.
- [ ] A amostra da animação ambiente passa a usar as mesmas funções. Ajuste de carregamento: hoje são ~250 PNGs, e
  a captura da coordenação pegou o painel "PixelLab × código" ainda vazio. O painel entra pelo mesmo atlas e desenha
  um quadro parado enquanto carrega.

## Etapa 1 — Motor no jogo

> **Feita no ramo em 2026-11-24** (a754772 … 80cf1ca). O motor e as cenas foram para `ambiente.js` sem mudar um pixel
> (hash das 5 cenas igual). Desvios: o pré-assado é por estado quantizado de cada peça (não por quadros de tempo com 3
> ventos), para a rajada seguir atravessando a tela; ganho medido: torcida 96% de acerto, copas 52%, coqueiros 40%; o
> custo total do Litoral quase não muda (está espalhado em camadas pequenas: a medida que decide é a do celular, na
> etapa 6). O motor entra no build do jogo na etapa 2/3, quando for usado. Corrigido: a deformação não punha o passo no
> canvas (peças paradas na amostra).

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

> **Feita no ramo em 2026-11-24** (00d5896, fcf90d7). Desvios: o olho foi gravado nos JSONs por
> `prototype/tools/moldes-olho.mjs` (o `--reprocessar` dos portes precisa dos mestres crus, que não estão no repositório;
> o gerador passa a gravar o olho nos moldes novos); o idle repinta por mudança de estado num canvas por cavalo (não
> no cache dos moldes). Os cards pequenos ficam parados (o retrato de 64 × 56).

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
- [ ] Os gestos novos usam a integração da etapa 0 (sombra que acompanha o quadro, LUT da cena, 4 tons, contato no
  cavar) e passam pelo checklist C1–C12 do guia.
- [ ] Folha de conferência com os 12 moldes × 4 pelagens nas cenas, e DEV do ramo publicado para a aprovação.

## Etapa 3 — Cenas das abas e arenas

> **3a feita no ramo em 2026-11-24** (4c7091b): Expedição, Haras (com os cavalos do jogador) e Fornalha no jogo, bloco
> `ambiente` no ui-test. O custo é medido como equivalente por quadro a 60 q/s (o laço "vivo" do jogo roda a ~14 q/s).
> **3b feita** (Estábulo e Loja). Remanso e Capoeira saíram: a cena de desafio vai ser a nova da frente 2 (arena 0 em
> perspectiva); o `IdleMolde` serve às vistas de frente e de costas dela (combinado com o chat do mapa).

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

**Arquivos:** mexe `prototype/src/sprites.js` (o fundo da região, `fundoRegiao` e a arquibancada) e o manifesto. A
câmera da `claude/ajustes-1` já está na `main`.

- [x] As 5 regiões, em todas as camadas (spec §3.1):
  - céu, nuvens, pássaros e revoadas;
  - água em ciclo de cor (mar do Litoral, lagoa da Várzea);
  - vegetação em quadros pré-assados;
  - torcida com a "ola";
  - bandeiras e bandeirinhas;
  - placa e biruta na cerca;
  - chaminé, ar quente, neblina e pétalas dos ipês.
  - _Feito (2026-11-24): `RegiaoViva` no `ambiente.js`, uma por região e clima, montada aos poucos na contagem da
    largada. A lagoa da Várzea é reflexo que treme (linhas que ondulam) com brilhos correndo, não ciclo de cor: o
    reflexo pintado não tem rampa de água. Ficaram fora as garças (cabeça que abaixa e uma que voa)._
- [x] Planalto: `meio-sem-pas.png` no lugar do meio e o rotor por código (24 ângulos, velocidade pelo vento) preso à
  paralaxe da camada.
- [x] As camadas continuam emendando com a câmera que enquadra a disputa, no zoom de 4 a 12 px/m (o rolar acumulado,
  sem salto).
- [x] Teto de 0,30 ms do ambiente na corrida. As partículas do ambiente (≤ 60) somam com as da corrida, e o total fica
  em ≤ 150.
  - _Medido no jogo (1280, chuva e ventania): Litoral 0,27, Sertão 0,22, Várzea 0,19, Planalto 0,18 ms por quadro; bloco
    `ambiente` do `ui-test` falha acima de 1,5 × 0,30. Partículas ≤ 60 (teste no `fx-test`)._
- [x] O bloco `fluxo-desempenho` continua passando (completas − reduzidas ≤ 6 ms).
- [x] O `balance.js` dá o mesmo resultado, porque a corrida não muda.
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
- **Conflito com o chat do mapa:** a etapa 4 vem depois do combinado da camada. A câmera da `ajustes-1` já está na
  `main`; as etapas que tocam a corrida (0 e 5) saem dela atualizada.
- **Papéis novos do molde (4 tons):** a troca de formato do molde toca o `sprites.js`, o build e os testes de uma vez.
  Ela vai num commit próprio, com a migração e o `moldes-test` antes e depois, e as capturas da corrida conferidas.
- **Decisões D1–D6 do guia em aberto:** nada da etapa 0 depende delas. O que depende (contorno de material, casco sem
  contorno, névoa sólida, perspectiva das cenas de cima) fica atrás de uma chave ou para uma etapa própria.
