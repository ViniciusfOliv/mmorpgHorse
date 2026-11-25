# Salas justas, estreia mais leve e tabela de economia do Ouro (desenho curto)

Data: 2026-11-25. Pedido do Vinicius (via coordenação): "no começo eu sempre perco, quase nunca ganho com o cavalo
inicial" e, depois de ver a medição da coordenação, **"Faça os dois, com a tabela de economia junto"**: (1) estreia mais
leve + salas mais justas na aba Correr; (2) a tabela de todas as fontes e todos os gastos de Ouro, porque a sala justa
aumenta o Ouro que entra.

Esta é a **fase 1** (medição + desenho). Nada de regra mudou no jogo. Ferramenta da medição, sem dependências:
`prototype/tools/salas-medida.js` (cópia fiel do `buildLobby` de `game.js`: catálogo `WILD_HORSES` + `STARTERS` sem o
modelo do jogador, `levelBand`, `bestLevelFor`, rank dos bots, filtro de 6%; corrida pelo `RaceSim.simulate`, prêmio pelo
`RaceSim.payouts`, XP e skills aprendidas como no `applyXp`, falência → treino gratuito, recompensa diária a cada 30
salas) e `salas-medida-resumo.js`. 240 carreiras de 120 salas por esquema (80 de cada inicial), ~29 mil corridas cada.

## 1. O que foi medido (hoje, na `main`)

Carreira do inicial (Comum ★★, nível 1, sem skills de vaga, "Distribuir sugerido" antes de cada sala, entrada 50,
começa com 500 de Ouro):

| Salas | Nível médio | Vence | Pódio | Ganha prêmio | Justo (1/n) | Ouro por sala valendo | Salas no treino (sem Ouro) | Ouro no fim |
|---|---|---|---|---|---|---|---|---|
| 1–10 | 2,5 | **6,1%** | 42,7% | 31,3% | 16,7% | **−24,7** | 0% | 313 |
| 11–20 | 5,4 | 7,1% | 45,2% | 34,2% | 16,6% | −18,8 | 14% | 146 |
| 21–40 | 7,9 | 7,4% | 44,8% | 33,8% | 16,7% | −10,9 | **47%** | 88 (sala 30) |
| 41–60 | 10,3 | 8,3% | 47,1% | 35,3% | 16,7% | −8,8 | 55% | 64 |
| 91–120 | 15,5 | 10,0% | 50,2% | 39,7% | 16,7% | −7,2 | 49% | 88 |

- **A queixa se confirma com o pareamento real: o inicial vence 6% (justo 17%) e perde metade da entrada por sala.**
  Os 500 de Ouro do começo acabam na 2ª dezena de salas e, daí em diante, **metade das salas é treino gratuito**
  (metade do XP): o jogador vive com 60–90 de Ouro e não consegue comprar nem um Torrão (120) nem o rank II de uma skill
  (150). Bate com a medição sintética da coordenação (6,5%).
- **Por quê:** os rivais saem de 91,5% a 111,5% do Poder do jogador (média 101,5%) e, com 3 a 7 rivais, quase sempre há
  um 8–11% acima. Com a Garra 100% de 2026-11-19 o Poder decide muito: mudar só a média da faixa já muda tudo
  (rivais 95–105%, média 100%: vence 12%; 93,5–104,5%, média 99%: vence 15–17%, o justo).
- **Perfis fixos (sala já no normal; Ouro por sala com entrada 50 — multiplique pela entrada ÷ 50):**

| Jogador | Hoje: vence / Ouro | Justa 93,5–104,5%: vence / Ouro | Centrada 95–105% |
|---|---|---|---|
| Comum ★★ nv 25 (Brasa, sem skills de vaga) | 10,9% / −14,2 | 22,6% / +8,7 | 19,4% / +0,8 |
| Raro ★★★ nv 25 (Ventania, rank II) | 6,2% / −23,9 | 12,4% / −10,5 | 9,9% / −17,8 |
| Lendário ★★★ nv 40 (Fogaréu, rank III) | 9,8% / −14,7 | 20,1% / +2,1 | 17,5% / −3,3 |
| Mítico ★★★ nv 50 (Boitatá, rank V) | **50,9% / +47,2** | 40,6% / +28,4 | 39,5% / +27,2 |

  Duas coisas fora do pedido aparecem aqui (§6): o **teto do catálogo** (o Mítico nv 50 não acha rival à altura e vence
  40–51%) e o **Poder erra por cavalo** (a Ventania vence 12% numa sala justa; a Brasa nv 25, 23%).

## 2. Tabela de economia do Ouro

### 2.1 Fontes (todas no `game.js`; os módulos só calculam)

| Fonte | Números | Quando |
|---|---|---|
| Ouro inicial | 500 | uma vez |
| **Sala valendo (aba Correr = o "PVP")** | pote = entrada × n; **taxa da casa 10%**; 4–5 corredores 70/30, 6–7 50/30/20, 8 60/25/15 (ex.: entrada 50 e 8 corredores: 216 / 90 / 54); insígnia do Fogo +3% do prêmio (Ouro novo, não sai do pote) | por sala |
| Treino gratuito | 30 / 22 / 16 / 12 / 10… pela colocação, metade do XP; o botão só aparece com Ouro abaixo de 50 | por sala, falido |
| Ginásios (1ª vitória de cada etapa) | 80 · 120 · 160 · 200 · 400 por ginásio (entradas 20 · 30 · 40 · 50 · 100): **+720 líquidos por ginásio, 2.160 nos três**, uma vez; etapa vencida não se repete | uma vez |
| Revanche do líder | entrada 50; rodízio 100 Ouro / Torrão / 100 / Manual / 100 / Cupom (anda só na vitória) | 1 por dia em cada ginásio |
| Treino AFK (baú) | por vitória 0,3 · 0,45 · 0,6 · 0,75 · 1,2 (etapa) × 1/2/4 (Normal/Difícil/Lendária) × (1 + linhas de Ouro das peças, até +55%); derrota 0. Medido (meta E1, por vaga, com +55%): **132 / 294 / 361 / 369 por hora** nos níveis 10 / 20 / 35 / 50 (sem peças ÷ 1,55: 85 / 190 / 233 / 238). Offline até 8 h (12 h com Aveia e bestiário); até 5 vagas | por hora |
| Recompensa diária | 60 · Torrão · 100 · Manual · 150 · Cupom · 200 + Rédea = **510 por semana** | 1 por dia |
| Venda de peça | 25% do preço (Comum 25, Mágica 63, Rara 150); peça do AFK ou da forja não vale Ouro | por peça |

Não há Ouro por missão, conquista, bestiário, venda de cavalo ou de material. **Nenhuma linha liga Gemas a Ouro.**

### 2.2 Gastos

| Gasto | Números | Limite |
|---|---|---|
| Entrada da sala | 50 / 100 / 250 (escolha do jogador; não escala com liga nem nível) | por sala |
| Entradas de ginásio e revanche | ver acima | — |
| Loja de itens | Torrão 120 (2/dia), Manual 200 (1/dia), Cupom 250 (1/dia), Estrela 2.000 (1 a cada 7 dias): até ~690/dia + 2.000/semana | por dia |
| Subir rank de skill | 150 · 400 · 900 · 2.000 (+ 1 · 2 · 4 · 7 Pergaminhos, + 1 Selo no V): **3.450 por skill**, por cavalo (Mítico: 5 vagas = 17.250) | — |
| Vagas do treino AFK | 1.000 · 3.000 · 8.000 · 20.000 (**32.000** para as 5) | uma vez |
| Loja de peças / Pedras Negras | Comum 100, Mágica 250, Rara 600 (Lendária não se vende); Pedra 40 | sem limite |
| Forja / reforja | forja Comum 100 · Mágica 300 · Rara 800 · Lendária 3.000 (+ materiais); reforja 100 × 1,5^n (100, 150, 230, 340…) | — |
| Cruzamento | aluguel 100 · 250 · 600 · 1.500 (Comum a Lendário) × 1 / 1,25 / 1,5 (estrelas); entre as suas 50; troca 50 | por cruza |
| Vagas do estábulo | 300 cada (3 → 8: 1.500) | uma vez |

(Melhoria de peça gasta só Pedras. Equipamento só vale no PVE.)

### 2.3 Fluxo de um jogador típico: antes e depois

Premissas: **30 salas por hora** na aba Correr (corrida em x1 ~40 s na tela + sala e resultado; com "x2" ~90/h e com
"Pular" o limite são os cliques), 1 hora de salas por dia, 1 vaga de AFK com 8 h offline por dia, ginásios feitos no
nível em que pedem. "Depois" = a recomendação (§4: estreia D + normal justa).

| Fase | Fonte / gasto | **Antes** | **Depois** |
|---|---|---|---|
| **Começo** (dia 1: salas 1–30, Comum nv 1 → 8–10, entrada 50) | salas | **−470/h**, 52% das salas já sem entrada na 30ª | **+200/h**, 1% sem entrada |
| | Ouro na mão ao fim da 1ª hora (com diária) | 88 | 758 |
| | diária / ginásios Soldado 1–2 (nv 4 e 8) | +60 / +150 | igual |
| | AFK (1 vaga, Normal, nv ≤ 10) | até ~85/h, ~400–600 por noite | igual |
| **Meio** (nv 20–25, entrada 100) | salas, Comum nv 25 | −850/h | **+520/h** |
| | salas, Raro nv 25 (Poder superestima) | −1.430/h | −630/h |
| | carreira real, salas 91–120 (nv ~20), entrada 50 | −216/h com 49% treino | +210/h com 4% treino |
| | AFK 1–2 vagas (nv 20) / diária / revanche | ~190–300/h por vaga / 73/dia / ~150/dia | igual |
| | gastos que aparecem | Torrão 240/dia, rank II–III (400–900), vaga AFK 2 (1.000) | igual |
| **Fim** (nv 40–50, entrada 250) | salas, Lendário nv 40 | −2.200/h | **+300/h** |
| | salas, Mítico nv 50 rank V (teto do catálogo) | **+7.080/h** | +4.260/h |
| | AFK 5 vagas (nv 50, +55%) | ~1.850/h ao vivo | igual |
| | gastos | rank IV–V (2.900 por skill), vagas AFK 3–5 (31.000), forja Lendária 3.000, Estrela 2.000/semana | igual |

Leitura:

- **Hoje a sala é o maior ralo do jogo**, não uma fonte: no começo tira ~470 de Ouro por hora e prende o jogador no
  treino; no meio e no fim só o Mítico no teto ganha. O Ouro de verdade vem do AFK, dos ginásios e da diária.
- **Com a sala justa ela fica perto do zero a zero** (a taxa de 10% continua: o jogador médio de um cavalo médio perde
  10% da entrada por sala) e passa a render um pouco para quem evolui o cavalo mais depressa do que o Poder mede
  (+3 a +7 por sala de 50 depois da 60ª). O Ouro que entra a mais é o que deixa de sair: ~+700/h no começo, +800 a
  +1.400/h no meio (entrada 100) e ~+2.500/h no fim (entrada 250).
- **Os gastos absorvem com folga:** só os ranks de um Raro (3 vagas) somam 10.350, as vagas do AFK 32.000 e a Estrela
  2.000 por semana. Um jogador do meio com +520/h nas salas e ~250/h no AFK leva ~5 h de jogo para as vagas 2 e 3
  do AFK e ~2 h para os ranks I → III das 3 skills (1.650). Não há sinal de inflação; **não recomendo mexer em prêmio, entrada
  nem taxa agora**.
- **Farmar a estreia não dá:** ela vale só nas 20 primeiras salas do save (o contador nunca volta) e rende ~+250 no
  total. Farmar o normal com "Pular" também não: o valor esperado é ≤ 0 para o cavalo médio.

## 3. Opções

A faixa passa a depender do **número da sala** (`P.counter`, o contador que já existe no save): nada novo gravado, a
sala aberta continua a mesma ao recarregar, e o sorteio continua todo pela RNG da seed (`CLAUDE.md` §8). Na estreia, o
rival do catálogo acima do teto (não existe rival mais fraco que o inicial nível 1) corre com menos pontos livres e,
se precisar, genética menor, como o branch antigo fazia (e como o modo dos testadores já faz).

### 3.1 Estreia (salas 1–10; da 11ª à 20ª volta ao normal em linha reta)

| Opção | Sala | Rivais (do Poder do jogador) | Salas 1–10: vence / pódio / Ouro por sala | 11–20 | Ouro na sala 30 |
|---|---|---|---|---|---|
| A (generosa) | 4–5 corredores | 92–100%, teto 100% | 46,9% / 87,8% / +31 | 25,0% / 69,6% | 887 |
| **D (recomendada)** | 4–5 corredores | 93–100,5%, teto 100,5% | **39,3% / 83,4% / +21** | 23,0% / 68,1% | 758 |
| B (a do branch antigo) | 4–5 corredores | 94,5–101,5%, teto 101,5% | 30,1% / 77,3% / +8 | 18,3% / 62,6% | 491 |
| E (curta) | 4–5 nas 5 primeiras, volta em 15 | 92–100% | 40,1% / 83,5% / +23 | 20,3% / 64,3% | 753 |
| (hoje) | 4–8 | 91,5–111,5% | 6,1% / 42,7% / −25 | 7,1% / 45,2% | 88 |

### 3.2 Faixa normal (da 21ª sala em diante)

| Opção | Rivais | Inicial, salas 41–60 / 91–120 | Comum nv 25 · Lendário nv 40 | Ouro por sala de 50 (carreira, 91–120) |
|---|---|---|---|---|
| **Justa (recomendada)** | 93,5–104,5% (média 99%) | 18,8% / 22,4% | 22,6% · 20,1% | +6 |
| Centrada | 95–105% (média 100%) | 15,8%* | 19,4% · 17,5% | −7* |
| A favor | 92–102% (média 97%) | 29,8%* | — | +17* |
| (hoje) | 91,5–111,5% (média 101,5%) | 8,3% / 10,0% | 10,9% · 9,8% | −7 com 49% de treino |

\* medido até a 60ª sala (salas 41–60). A "justa" é a faixa que o branch antigo tinha chegado (lá com a Garra antiga) e é a que
fica no justo do inicial; a "a favor" dá Ouro demais e tira o risco da aposta.

### 3.3 Prêmio, entrada e taxa

Recomendação: **não mudar** (§2.3). Alternativas, se o Vinicius quiser mais Ouro no começo ou mais ralo no fim:
(a) a taxa da casa só a partir da 21ª sala (estreia sem taxa: +5 por sala nas 20 primeiras, ~+100 no total);
(b) uma entrada de 25 até a 20ª sala (o risco cai pela metade, o Ouro também). Nenhuma das duas é necessária com a D.

## 4. Recomendação

**Estreia D + faixa normal justa, sem mudar prêmio, entrada nem taxa.** Exemplos concretos: nas 10 primeiras salas o
inicial vence ~39% e sobe no pódio ~83% (hoje 6% e 43%); da 11ª à 20ª, 23% e 68%; depois ~17–22% (o justo é 17%).
Ao fim da 1ª hora ele tem ~760 de Ouro (hoje 88) e quase nunca cai no treino (1–7% das salas, hoje ~50%). Salas por
hora: começo −470 → +200; meio −850 → +520 (Comum nv 25, entrada 100); fim −2.200 → +300 (Lendário nv 40, entrada 250).

## 5. O que muda (fase 2, depois da aprovação)

- `prototype/src/data.js`: números novos em `ECONOMY` (`sala`: faixa normal, tamanho e faixa da estreia, sala de
  início e de fim da rampa, teto do rival de estreia).
- `prototype/src/game.js`: `buildLobby` lê a faixa pelo `P.counter` (função pura `faixaDaSala(contador)`), aplica o teto do
  rival de estreia. Só isso no `game.js` (a frente `claude/fluidez` mexe em `hydrate`/render: sem conflito esperado).
  Considerar tirar a montagem da sala para um módulo puro (`sala.js`) que o `balance.js` usa sem cópia — é o que o
  servidor vai precisar; peço aprovação à parte, porque mexe em mais arquivos.
- `prototype/tools/balance.js`: modo `--economia` (a carreira desta medição, com o pareamento do jogo); metas novas
  (estreia: vence 32–46% e pódio ≥ 75% nas salas 1–10; normal: inicial 14–22%; Ouro do começo: nenhuma carreira média
  sem entrada antes da 30ª sala); `tLobby` com a faixa nova; rebasear P2 se sair da faixa (no pareamento real, num perfil
  Pororoca nv 20, o favorito do Poder vai de 53% para 59%; a P2 pede 35–55%) e dizer o motivo.
- Testes: `sim-test.js` (faixa por contador, determinismo da sala, recarregar não muda a sala); `ui-test.mjs` com o
  teste de estreia no modelo do bloco `crescimento-jogo` do branch antigo.
- Wiki (gerado), `docs/GDD.md`, `docs/exemplos.md` e memória; `./scripts/check.sh` e `balance.js` completo.

## 6. Pontos em aberto (para o Vinicius)

1. **Saves que já passaram da 20ª sala não veem a estreia** (inclusive o do Vinicius): a estreia é do save novo. Para
   sentir, "Recomeçar" ou o modo DEV. Quer outra coisa (ex.: estreia também para quem tem pouco Ouro)? Isso grava ou
   lê mais estado e foge do "nada novo gravado".
2. **Teto do catálogo (fora do pedido):** o Mítico nv 50 rank V vence 40–51% e ganha ~+4.000 a +7.000 de Ouro por hora
   com entrada 250, porque nenhum cavalo do catálogo chega ao Poder dele. É a maior fonte de Ouro do fim de jogo. Corrigir
   pede rivais acima do catálogo (genética ou nível acima do achado) — fica para outra frente, se ele quiser.
3. **O Poder erra por cavalo:** numa sala justa a Ventania vence 12% e a Brasa nv 25, 23%. A faixa só acerta a média;
   ajustar o peso do Poder é trabalho de balanceamento à parte.
