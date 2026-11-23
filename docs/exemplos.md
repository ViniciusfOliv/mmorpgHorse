# Exemplos e achados do balanceamento

Medições do protótipo em 2026-11-13, no modelo do crescimento livre (bloco 1b dos cavalos v3: pontos
comprados com custo por faixa até 150, física linear, skill de tipo que multiplica os status, equipamento
suspenso). Spec e tabelas: `docs/superpowers/specs/2026-11-12-crescimento-livre-design.md` §13. As tabelas de
dados estão em `docs/wiki.md`, gerado do código. Para refazer as medições:

```bash
node prototype/tools/balance.js            # relatório completo com as 300 metas (~5 min)
node prototype/tools/balance.js --exemplo  # uma corrida narrada
```

## 1. Os três iniciais (Comuns ★★, nível 1, mapas aleatórios)

Meta M1: 30% a 37% no geral e 22% a 45% em cada faixa de distância. Medido: **Brasa 31,8%, Maré 33,3% e Ipê 34,9%**
(curta/média/longa: Brasa 38,9/30,8/26,7%, Maré 29,9/33,8/35,7%, Ipê 31,2/35,4/37,6%). Duração com os iniciais: **98,2 s** nas curtas e **128,6 s** nas longas
(antes do bloco 1b: 95,9 s e 127,1 s; a física ficou mais rápida por proporção e a corrida inteira, mais curta).
Nível 25: os três caem na Prata (Poder 782–791; nível 1: 626–633, Bronze).

## 2. Progressão e Poder (duelos 1v1, mesma genética, build dos bots)

| Meta | Medido (pior caso nas 4 bases de seed) | Faixa |
|---|---|---|
| M3 dez níveis a mais, mesma raridade | 1→11 78,0–78,5% · 20→30 76,1–77,8% · 40→50 75,0–77,0% (75,0) | ≥ 70% (alvo 40→50 ≥ 74%) |
| M4 uma raridade / duas raridades acima | 78,1–85,0% / 95,4–98,7% (94,97) | 72–88% / ≥ 94% |
| M5 ★★★ × ★ / ★★ × ★ no nível 50 | 68,7–70,5% / 59,6–62,3% (63,1) | 65–75% / 55–64% |
| M6 melhor build contra o campo, Raro ★★ 11/30/50 | 53,7 / 53,2 / 59,9% (60,6), sempre o bot | ≤ 62% |
| M6 Comum ★★ 50 / Mítico ★★★ 50 | 61,4% (62,3) / 64,9% (65,4), o bot | ≤ 64% / ≤ 67% |
| M6 menor `inc:*` / `tipo` | 47,2% (46,1) / 47,9% | ≥ 45% |
| M6 "tudo num status", níveis 30 e 50 | no máximo 18,9% | < 35% |
| M7 pior caso de status (Mítico ★★★ 50, tudo num status) | 146 | < 150 |
| M8 líder em 1/3 vence / chegada com < 1 m | 38,1% / 5,6% | ≤ 55% / ≥ 5% |
| M9 tipos em campo misto (justo: 16,7%) | 16,3% a 17,2% | 15,3–18,0% |
| P1 resíduo do Poder / P2 favorito vence | 1,1 p.p. / 52,1% | ≤ 5 p.p. / 35–55% |
| A1 ganho de +10 num Raro nível 20 | 9,6 a 11,0 p.p.; maior ÷ menor 1,15 | ≥ 3 p.p.; ≤ 1,3 |
| S1 ganho de uma skill | 4,0 (Chama Final) a 12,7 p.p. (Drift) | 3–13 p.p. |
| Dado: Mítico g31 contra sete Comuns g0 | 20,8% | 17–25% |

Durações por liga (média, curta / longa): todas dentro da faixa com pelo menos 4 s de folga (Bronze
92–104 s / 121–136 s até Lenda 80–94 s / 106–122 s); a sala mais rápida leva 0,86× o tempo dos iniciais.
O Mítico ★★★ nível 50 é 14% mais rápido que eles.

**A build equilibrada é a mais forte.** O bot (e o "Distribuir sugerido") é a equilibrada com leve
inclinação no tipo. Médias nas 4 bases de seed no nível 50:

| Classe | Bot contra todas | Equilibrada contra as inclinadas |
|---|---|---|
| Raro ★★ | 60,1% | 57,8% |
| Comum ★★ | 61,6% | 61,7% |
| Mítico ★★★ | 64,8% | 64,2% |

As inclinadas ficam em 44–54%: escolha de estilo que custa poucos pontos percentuais, não armadilha.

**O Poder prevê o resultado?** Em salas montadas como o jogo monta, o favorito do Poder vence **52,1%**
das vezes (sorteio puro daria ~18%) e nenhum tipo, raridade ou número de estrelas foge mais de **1,1 p.p.**
do que o Poder prevê.

## 3. Quanto vale cada skill e cada status

Comparação pareada: a mesma corrida (seed e rivais) com e sem a mudança, 6 Raros nível 20, mapa
aleatório, Dado ligado. O número é o ganho na taxa de vitória (a base é ~17%).

**Skills com rank e Garra sem falhar (2026-11-19, simulação 4.1.0):** a skill de vaga ativa sempre que o gatilho
acontece, e o efeito cresce com o rank (fator 1,00 a 1,60, mais o marco no rank V). A Garra também sai sempre; o status
dá o ponto de início e a força média, e a seed dá a força de cada corrida (de 0 a 2× a média). Metas: S1, rank I de 3 a
13 p.p.; S5, rank V de 1,4× a 2,4× o rank I e até 20 p.p.; S6, rank V até 2× a mediana. 8.000 pares por skill
(`node prototype/tools/balance.js --skills`).

| Skill | Antes (com sorteio) | Rank I | Rank V | V ÷ I |
|---|---|---|---|---|
| Arranque | 12,4 | 8,7 | 15,7 | 1,80× |
| Drift | 12,7 | 8,1 | 18,0 | 2,23× |
| Casco Firme | 9,3 | 7,4 | 16,4 | 2,22× |
| Sol a Pino | 6,3 | 7,4 | 16,2 | 2,19× |
| Pé na Chuva | 8,1 | 7,2 | 14,8 | 2,04× |
| Névoa Amiga | 6,3 | 7,1 | 15,8 | 2,23× |
| Arrancada Final | 8,8 | 6,9 | 14,1 | 2,04× |
| Fôlego de Montanha | 5,7 | 6,7 | 14,2 | 2,14× |
| Chama Final | 4,0 | 5,1 | 10,1 | 1,99× |
| Nascente | 7,8 | 5,1 | 8,6 | 1,67× |
| Saída Rápida | 5,1 | 4,8 | 9,4 | 1,96× |
| Sprint | 4,9 | 4,6 | 7,5 | 1,65× |
| Segundo Ar | 5,3 | 4,2 | 8,2 | 1,93× |
| Canto da Iara | 5,4 | 4,2 | 6,5 | 1,57× |
| Dado Viciado (isento) | 1,3 | 0,2 | 1,5 | — |

Com a Garra sem falhar e força fixa, o favorito do Poder vencia 69,2% e um degrau de raridade 97–99%: a corrida ficava
previsível. Com a força variável, o favorito vence **51,1%** (meta 35–55%), quem lidera em 1/3 vence 37,8% e 6,0% das
corridas acabam com menos de 1 m. +10 num status vale de 9,8 (Garra) a 11,8 p.p. (Manobra). As 344 metas do
`balance.js` completo passam, com as faixas rebaseadas listadas no `decisoes.md` de 2026-11-19.

| +10 pontos em | Manobra | Velocidade | Aceleração | Estamina | Força | Garra | Sorte |
|---|---|---|---|---|---|---|---|
| Ganho (p.p.) | 11,0 | 10,8 | 10,7 | 10,3 | 10,1 | 9,6 | só nasce (0,7 entre os extremos) |

Com a física linear até 150 e o custo por faixa, os seis status de corrida rendem quase o mesmo (maior ÷
menor 1,15; meta ≤ 1,3): a escolha da build é de estilo, não de "o status que vale". A Sorte não recebe pontos.

Ganho da skill de tipo (M2, informativo), campo de 6 com e sem ela:

| Configuração | Fogo (Labareda) | Água (Maré Alta) | Grama (Raízes Firmes) |
|---|---|---|---|
| Comum nível 1 | 6,8 p.p. | 9,0 | 9,4 |
| Raro nível 30 | 10,1 | 12,2 | 11,2 |
| Lendário nível 50 | 11,3 | 12,9 | 12,0 |

A diferença é de propósito: o que a meta vigia é o equilíbrio dos tipos (M9, 16,3% a 17,2%).

## 4. Três potros de exemplo

`seedBase` 20261106, `nextUid` 2, `breedCounter` 0, 1 e 2, pais no nível indicado. Os mesmos pais, seed
e contador sempre dão o mesmo potro; o `sim-test.js` compara os três por inteiro.

| # | Pais | Nome | Raridade | Tipo | Sexo | Status no nível 1 (VEL/ACE/MAN/FOR/EST/GAR/SOR) | Genética | Skills |
|---|---|---|---|---|---|---|---|---|
| 0 | Maré × Brasa (30) | Jurema | Comum ★★ | Fogo | F | 50/53/47/51/52/47/46 | 20/26/14/21/24/14/12 | Sol a Pino |
| 1 | Faísca × Lambari (1) | Jurema | Comum ★★ | Água | F | 44/46/53/45/44/43/45 | 8/11/25/10/8/5/10 | Arranque |
| 2 | Ventania × Jequitibá (30) | Trovão | Lendário ★ | Grama | M | 64/63/64/61/68/67/62 | 19/18/20/13/28/25/16 | Sprint, Arrancada Final |

O potro 2 nasceu Lendário de pais Raro e Lendário e por isso tem ★: a raridade subiu. A genética é
metade herdada: o status no nível 1 sai dela e da raridade (base = início da faixa + 16·genética/31), sem
faixa por estrela. No bloco 1b o início da faixa do Lendário passou de 55 para 54, e por isso o Trovão perdeu 1
ponto em cada status (era 65/64/65/62/69/68/63); os Comuns não mudaram. O potro nasce sem pontos comprados.

## 5. Ginásios da Expedição (metas G1 a G9, 2026-11-17)

Spec: `docs/superpowers/specs/2026-11-17-ginasios-design.md` §12 (metas ajustadas pela medição: G2 "4 abaixo
≤ 35%"; G3 "com vantagem 60–85%, em desvantagem ≤ 35% e 30 pontos entre as duas"). Time de referência: o
inicial do elemento, repetido até o tamanho do time do adversário, com a build dos bots; os cavalos dos ginásios
também têm a genética do inicial (Brasa, Maré, Ipê), mudando nível e estrelas. Desafios pelo `Ginasio.resolver`,
3.000 por célula, no `balance.js` completo.

| Meta | Medido (pior caso nos três ginásios e cinco etapas) | Faixa |
|---|---|---|
| G1 mesmo elemento, nível da etapa | 46,1–50,9% | 40–55% |
| G2 4 níveis acima / abaixo | 73,0–81,5% / 15,8–32,9% (na etapa de nível 4, "abaixo" é o nível 1) | ≥ 70% / ≤ 35% |
| G3 com vantagem / em desvantagem / distância | 70,3–78,2% / 17,2–32,3% / 38,1–59,6 pontos | 60–85% / ≤ 35% / ≥ 30 |
| G4 sem a vantagem, nível igual, 1 contra 1 | 44,1–53,9% | 42–58% |
| G5 diferença entre os ginásios (G1 / com vantagem / em desvantagem) | 4,7 / 4,2 / 7,5 pontos | ≤ 8 |
| G6 faixas do cansaço no 1º duelo (apertada / normal / folgada) | 18,6–28,9% / 19,7–31,5% / 47,9–51,7% | ≥ 15% cada |
| G7 inicial 4 níveis acima, sozinho, contra o líder | 2,2–2,4%; sem o cansaço 39,5–41,3 pontos a mais | ≤ 35%; ≥ +15 |
| G8 duração de um duelo (5%–95%) | 75,8–84,9 s (média 78,5–81,8 s) | 55–90 s |

O que a calibração mudou: a vantagem de 3% para **4%** (o status é inteiro: nos status de 50 a 62 de hoje, 3% e
4% somam os mesmos 2 pontos; com 3%, nas seeds do `balance.js`, o time em desvantagem chegava a 37,9% no soldado 2
do Remanso e a distância da G3 a 29,9 pontos no soldado 1 da Fornalha; os 4% valem cerca de 3 a 4 níveis num
duelo); os limites das faixas do cansaço de 5/20 m para **1/8 m** (entre iniciais iguais, nas pistas novas, a
chegada ou é colada ou é longe: com 5/20 m a faixa do meio ficava em 6–7% do 1º duelo); uma pista de 1.200 m
por ginásio, com subidas (na pista de partida, 1.200 m de grama com uma curva de 300 m e uma subida de 250 m, o
Fogo vencia 71–77% dos duelos contra Água e Grama sem a vantagem); os cavalos dos soldados e do líder passam a ser o inicial do
elemento (com os selvagens Comuns, o Lambari vale ~7 níveis a menos que a Maré, e as metas mediam a diferença
entre os cavalos, não entre os ginásios); no do Remanso, um cavalo ★★★ no soldado 4 e no líder (para a G5). Os
níveis (4/8/12/16/20), os descontos do cansaço, o teto e o XP não mudaram. Um desafio do líder tem ~4,7 duelos e
leva ~6 min de corrida.

## 5b. Corrida AFK (metas E1 a E6, 2026-11-23)

Spec: `docs/superpowers/specs/2026-11-23-afk-drops-design.md` §7. Medido pelo `balance.js` completo (a seção sozinha:
`node prototype/tools/balance.js --afk`, ~45 s). Cavalo típico das metas E1 e E2: Raro ★★, genética 16 em tudo, build dos
bots, skills esperadas pelo nível no rank `1 + floor((nível − 1) / 12)`; 300 duelos em cada uma das 45 fases, por
nível (10, 20, 35, 50) × elemento do cavalo × ginásio (36 casos).

| Meta | Medido | Faixa |
|---|---|---|
| E1 Ouro do AFK por hora na fase que mais paga, com o máximo de +Ouro das peças (+55%), níveis 10 / 20 / 35 / 50 | 151,5 / 328,2 / 362,6 / 366,0 | < 450 (25% dos 1.800 do PVP) |
| E1 teto absoluto (vitória certa no líder da Lendária, corrida mais curta medida: 73,0 s) | 367,1 | < 450 |
| E2 casos em que a fase de maior ganho é a mais difícil liberada | 13 de 36 (36,1%) | até 50% ("não é sempre") |
| E2 casos em que fica 1 ou 2 degraus abaixo (informação; ver abaixo) | 16 de 36 (44,4%); 3 ou mais abaixo: 7 | a meta pede ≥ 50% |
| E3 chance medida (2.400 duelos) a menos de 3 p.p. da referência (5.000 duelos), 45 configurações | 44 de 45 (97,8%); a pior, 3,24 p.p. | ≥ 95% |
| E3 ganho esperado por hora, offline ÷ ao vivo, somadas as configurações | 1,00 | 0,97–1,03 |
| E3 o que o offline sorteia ÷ o valor esperado pela tabela (198.552 corridas) | 1,00 | 0,97–1,03 |
| E5 determinismo (corridas, offline de 8 h, medição em fatias) e nada de `Math.random` nem relógio | sim | — |

**Bloco B (2026-11-23, `balance.js` completo: 380 metas, todas passam).** Com as peças no treino (os oponentes da
Difícil com 5 Mágicas +3 e os da Lendária com 5 Raras +5 do conjunto), os números da tabela acima mudaram um pouco:

| Meta | Medido | Faixa |
|---|---|---|
| E1 Ouro do AFK por hora, níveis 10 / 20 / 35 / 50; teto absoluto | 132,1 / 294,1 / 360,6 / 369,2; 370,4 | < 450 |
| E2 casos em que a fase de maior ganho é a mais difícil liberada | 10 de 36 (27,8%) | até 50% |
| E2 casos em que fica 1 ou 2 degraus abaixo (informação) | 10 de 36 (27,8%); 3 ou mais abaixo: 16 | a meta pede ≥ 50% |
| E3 chance medida a menos de 3 p.p. da referência | 45 de 45; a pior, 2,50 p.p. | ≥ 95% |
| E3 offline ÷ ao vivo; sorteado ÷ esperado | 1,00; 1,01 | 0,97–1,03 |
| E4 nível 45 com 5 Raras +7 do conjunto contra o líder na Lendária (Fornalha / Remanso / Capoeira) | 55,3% / 51,7% / 56,9% | 40–60% |
| E4 o mesmo cavalo sem peças | 22,1% / 26,6% / 23,5% | 15–35% |
| E6 reforja, 10.000 por raridade: cada tipo (Mágico 20%, Raro 25%, Lendário 33,3%) | o mais longe, 0,7 p.p. | ± 1 p.p. |
| E6 valor fora da faixa; com Selo, tipo trocado ou valor abaixo da metade | 0; 0 | 0 |

- **E4, o que a calibração mudou:** o principal das peças passou a 0,75 · 1 · 1,25 · 1,75 (Comum a Lendário) e a
  melhoria a +0,2 por nível (eram 2 · 2 · 3 · 4 e +0,5, do tempo em que a peça valia no PVP). Com os valores antigos o
  cavalo com 5 Raras +7 ganhava quase sempre. O status é inteiro: a soma das peças de um slot é arredondada, então os
  degraus são de 1 ponto (5 Raras +7 = +2,65 → +3 por status; as 5 Raras +5 do líder = +2,25 → +2).
- **E2, segunda parte:** continua sem fechar e piorou (de 44% para 28%): com as peças, a Difícil e a Lendária ficaram mais
  duras para o cavalo típico da medição, que corre **sem peças**, e a fase que mais rende cai 3 ou mais degraus abaixo
  em 16 casos. Fica como informação; a primeira parte ("não é sempre a mais difícil") é a que confere.

**O que a calibração mudou** (números de partida):
- **Ouro por vitória: 0,3 · 0,45 · 0,6 · 0,75 · 1,2** (Soldado 1 ao líder, × dificuldade; a spec partia de 2 · 3 · 4 · 5 · 8).
  Com a tabela de partida, o cavalo típico de nível 50 tirava cerca de **2.440 de Ouro por hora** no líder da Lendária
  com o máximo de +Ouro (o teto é 450): 32 de Ouro por vitória × 1,55 × 49 corridas por hora. A tabela nova é a de
  partida × 0,15. A fração vira Ouro inteiro pela seed (0,3 é 1 de Ouro em 30% das vitórias), então o valor esperado
  é exato.
- **Amostra da chance medida: 2.400 duelos** (a spec partia de 400). Com 400, só 25 de 30 configurações ficavam a menos
  de 3 p.p. da referência (o erro de uma proporção medida com 400 corridas é ±2,5 p.p. perto de 50%); com 1.600, 43 de
  45 (95,6%, no limite); com 2.400, 44 de 45. São ~1,5 s de conta num computador, feitos em fatias de 10 duelos.
- **A medição em fatias soma as durações em décimos de segundo inteiros**: a E5 achou que 25 + 35 duelos davam uma
  soma diferente de 60 de uma vez (arredondamento a cada fatia).

**Como a E2 e a E3 foram medidas** (a spec não fixava):
- E2, "liberadas": a Normal de toda etapa de nível até o do cavalo; a Difícil e a Lendária quando a anterior está
  liberada e o cavalo vence nela pelo menos 1 em 10 (as 50 vitórias saem em até ~11 h). "Degrau": a posição entre as
  liberadas do ginásio, pela ordem do nível do oponente.
- E3: as configurações são um inicial de outro elemento a −3, 0, +2, +5 ou −1 níveis do oponente (uma por fase), para
  a chance cair no meio da faixa, onde a medida erra mais. O "ganho esperado" é o valor de referência por hora que a
  tabela de drops dá para a chance e a duração medidas, dividido pelo que dá para as de referência; numa configuração
  sozinha com chance baixa ele chega a 12% de diferença (1 p.p. de erro numa chance de 8%), e a meta vale para a soma.

**Para o Vinicius decidir (bloco A):**
1. **XP do AFK é muito maior que o do PVP.** Uma corrida valendo dá de 10 a 100 de XP (média 40,6) e cabem ~20 por
   hora: ~810 de XP por hora. No AFK, com ~47 corridas por hora, o Soldado 1 na Normal dá ~1.900 de XP por hora (40 por
   vitória) e o líder na Lendária ~12.500 (256 por vitória); na derrota ainda vêm 30%. Do nível 1 ao 50 são 33.075 de
   XP: ~17 h no Soldado 1 da Normal, ~3 h no líder da Lendária, por cavalo, em até 5 vagas, também offline. Os números
   são os de partida da spec (40 × (1 + 0,15 × etapa) × dificuldade) e nenhuma meta E os limita. Sugestão: uma meta
   nova (por exemplo, XP do AFK por hora ≤ 1,5× o do PVP) e baixar a base de 40 para algo perto de 12.
2. **Os oponentes são fracos para um cavalo Raro.** Os cavalos dos ginásios são os iniciais (Comuns, sem skill de
   vaga): um Raro ★★ de nível 10 vence o Soldado 1 da Lendária (nível 29) 43% a 93% das vezes, e um de nível 20 vence o
   líder da Lendária (nível 45) 37% a 90%. As peças dos oponentes (bloco B, calibradas pela E4) é que vão endurecer a
   Difícil e a Lendária; por isso a segunda parte da E2 fica como informação até a B2.
3. **O prêmio quase não cresce com a etapa** (só o XP, +15% por etapa, e o Ouro): material, incomum, Pedra e comida
   são os mesmos do Soldado 1 ao líder. A etapa de maior ganho tende a ser a mais baixa que o cavalo vence bem na
   dificuldade mais alta; as etapas de cima rendem quase só o troféu do oponente e a marca do bestiário.

## 6. Para revisar (decisões de design em aberto)

Do bloco 1b (spec §15; detalhes no `docs/memoria/ESTADO.md`), **ainda em aberto** até o Vinicius jogar:
- **A build equilibrada é a mais forte** (o bot a 60–65% no nível 50; as inclinadas em 44–54%). Mudar a regra
  (custo que para de subir, retorno extra por concentrar) não foi medido.
- **A corrida mudou de sensação** (mais curta, "Cansou" some, a Garra disparava em 58% das corridas; desde 2026-11-19 sai em todas, com força variável): olhar a animação.
- **Iniciais no nível 25 caem para a Prata** (eram Ouro).
- **A Sorte vale pouco** (0,7 p.p.; o Dado Viciado, 1,3 p.p. no modelo anterior): é só de nascimento, por desenho.
  Proposta antiga ainda aberta: a Sorte pesar mais na chance de skill, com a base de cada raridade compensada para baixo.
- **Rédea nova é rara:** vem só no 7º dia da recompensa diária e na 1ª vitória sobre cada um dos 3 líderes de
  ginásio; não está à venda. **Menos uso para o Ouro** com a loja suspensa.
- **Conjunto de 3 peças:** medido em 2026-11-10 (+1 p.p., e +14 no salto para 4 peças); com o equipamento
  suspenso, a decisão (efeito real ou degrau assumido) espera o equipamento voltar.
- **Garra e "Cansou":** a Garra disparava em 58% (desde 2026-11-19 sai sempre, com força variável); o erro do jóquei caiu e "Cansou" quase some.
- **Zebra por ruído na velocidade: testada em 2026-11-10 e não recomendada.** Com ±2% o favorito caía de
  49% para 41%, mas a corrida ficava decidida mais cedo. Zebra boa vem do fim da corrida (Garra, cansaço).
- **Os números saíram de simulação:** o Vinicius ainda não jogou o modelo do crescimento livre.
