# Medição: Ouro do treino AFK × preço das vagas do estábulo (2026-11-26)

Pedido do Vinicius na D1: *"Como o ouro farmado AFK será maior a cada cavalo… Depois simulamos o farm e ajustamos"*.
Preços hoje (D1): 3ª vaga 2.000 · 4ª 10.000 · 5ª 50.000. Só medição; nada do jogo mudou.

## Como medi

- Corrida AFK do jogo (`Afk.correr`: pista da casa, largada Nublada, vantagem de elemento), 200 duelos por fase, seed
  fixa. Cavalo: a Brasa do catálogo (Fogo, ★★) como Comum, Mágica e Rara, **sem peças**, sem bestiário.
- Fases liberadas pelo mesmo modelo do `balance.js` (meta E2): a etapa conta se o nível do cavalo chega ao do oponente;
  a Difícil e a Lendária só se o cavalo vence ao menos 1 em 10 na anterior.
- Para cada nível, a fase liberada que mais rende **Ouro por hora** (chance × Ouro da vitória × 3.600 ÷ duração).
- Script: na scratchpad da sessão (`farm.js`); refaz em ~45 s.

## Ouro por hora, por vaga de treino (sem peças)

| Nível | Comum | Mágico | Raro |
|---|---|---|---|
| 5 | 17 (Grama etapa 2 Normal, 82%) | 20 (Grama etapa 2 Normal, 100%) | 39 (Grama etapa 2 Difícil, 94%) |
| 10 | 43 (Grama etapa 5 Normal, 79%) | 54 (Grama etapa 5 Normal, 99%) | 102 (Grama etapa 5 Difícil, 90%) |
| 15 | 52 (Grama etapa 5 Normal, 95%) | 81 (Grama etapa 5 Difícil, 72%) | 159 (Grama etapa 5 Lendária, 69%) |
| 20 | 57 (Grama etapa 5 Difícil, 51%) | 105 (Grama etapa 5 Difícil, 92%) | 203 (Grama etapa 5 Lendária, 87%) |
| 30 | 102 (Grama etapa 5 Difícil, 90%) | 189 (Grama etapa 5 Lendária, 81%) | 231 (Grama etapa 5 Lendária, 99%) |
| 40 | 183 (Grama etapa 5 Lendária, 79%) | 228 (Grama etapa 5 Lendária, 98%) | 233 (Grama etapa 5 Lendária, 100%) |
| 50 | 222 (Grama etapa 5 Lendária, 95%) | 234 (Grama etapa 5 Lendária, 100%) | 233 (Grama etapa 5 Lendária, 100%) |

- **Teto sem peças: ~234 por hora por vaga** (vencer sempre a Lendária do líder, ~74 s por corrida). Com o máximo de
  +Ouro das peças (+55%), o teto é ~365 (meta E1 do `balance.js`, que pede menos de 450 = 25% do PVP).
- **Achado:** a melhor fase de Ouro é **sempre a líder da Grama**. O Ouro do AFK depende só da etapa e da dificuldade,
  não do ginásio; como a Grama é a mais fácil (D4), Água e Fogo nunca rendem mais Ouro no treino. (Rendem outras coisas:
  materiais e peças do conjunto deles.)

## Quantos dias de treino cada vaga custa

O treino rende até 8 h por coleta (limite offline). Duas leituras: quem abre o jogo **1 vez por dia (8 h)** e quem abre
**2 vezes (16 h)**. "Cavalos treinando" pede também as vagas do treino AFK (1.000 · 3.000 · 8.000 · 20.000), não
contadas abaixo.

| Vaga | Momento típico | Cavalos treinando | Ouro por dia (8 h / 16 h) | Dias (8 h / 16 h) |
|---|---|---|---|---|
| 3ª (2.000) | Comum nível 10 (líder da Grama, time de 3) | 1 | 347 / 694 | **5,8 / 2,9** |
| 3ª (2.000) | Comum nível 15 | 2 | 831 / 1.662 | 2,4 / 1,2 |
| 4ª (10.000) | Comum nível 20 | 2 | 914 / 1.828 | **10,9 / 5,5** |
| 4ª (10.000) | Mágico nível 20 | 2 | 1.673 / 3.346 | 6,0 / 3,0 |
| 5ª (50.000) | Comum nível 30 | 3 | 2.441 / 4.882 | **20,5 / 10,2** |
| 5ª (50.000) | Comum nível 40 | 3 | 4.391 / 8.782 | 11,4 / 5,7 |
| 5ª (50.000) | Mágico nível 40 | 4 | 7.285 / 14.571 | 6,9 / 3,4 |
| 5ª (50.000) | Raro nível 50 | 4 | 7.468 / 14.937 | 6,7 / 3,3 |

Outras fontes de Ouro no começo: a 1ª vitória de cada etapa dos ginásios (Grama +480 líquido no total, Água +820,
Fogo +1.330), a recompensa diária e o PVP (que, na média, devolve menos do que entra, pela taxa da casa).

## Leitura

- **4ª e 5ª vagas:** viram metas de uma a duas semanas para quem joga pouco, e de 3 a 6 dias para quem já tem cavalos
  melhores. Parece o que você queria ("meta de meio de jogo").
- **3ª vaga é o ponto sensível:** a líder da Grama (nível 10) tem time de 3, e a 3ª vaga custa ~3 a 6 dias de treino
  nesse momento (o jogador ainda tem 1 cavalo no treino, e a 2ª vaga do AFK custa 1.000). Sem ela, ele desafia a
  líder com 2 cavalos contra 3.
- **O treino não escala por ginásio:** depois da Grama, o Ouro por hora para de crescer (~234). Se a ideia é "o Ouro do
  AFK será maior a cada cavalo", hoje ele cresce com o número de cavalos (vagas), não com o avanço nos ginásios.

## Perguntas para você

1. **3ª vaga:** manter 2.000, ou baixar (ex.: 1.000) para o jogador montar o time de 3 da líder da Grama em ~1–3 dias?
2. **4ª e 5ª:** manter 10.000 e 50.000?
3. **Ouro do AFK por ginásio:** deixar como está (o Ouro vem da etapa) ou abrir uma decisão para Água e Fogo pagarem mais
   no treino (mexe na meta E1)?

## Respostas do Vinicius (2026-11-26)

1. 3ª vaga: **manter 2.000**. 2. 4ª e 5ª: **manter 10.000 e 50.000**.
3. *"O rendimento depende do cavalo, ele será baseado em quantas vitórias aquele cavalo tem por hora… se o jogo estiver
   aberto, o rendimento deve ser por rodadas vencidas (que deve ser maior que o fechado, se ambos estiverem iguais ou o
   fechado melhor, precisamos diminuir o gold do fechado)"*. Hoje os dois rendem igual na média, então o fechado vai
   render **70% de tudo** (Ouro, XP e drops): spec `docs/superpowers/specs/2026-11-26-afk-offline-70.md`.
