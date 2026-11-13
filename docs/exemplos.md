# Exemplos e achados do balanceamento

Medições do protótipo em 2026-11-13, no modelo do crescimento livre (bloco 1b dos cavalos v3: pontos
comprados com custo por faixa até 150, física linear, skill de tipo que multiplica os status, equipamento
suspenso). Spec e tabelas: `docs/superpowers/specs/2026-11-12-crescimento-livre-design.md` §13. As tabelas de
dados estão em `docs/wiki.md`, gerado do código. Para refazer as medições:

```bash
node prototype/tools/balance.js            # relatório completo com as 165 metas (~2,5 min)
node prototype/tools/balance.js --exemplo  # uma corrida narrada
```

## 1. Os três iniciais (Comuns ★★, nível 1, mapas aleatórios)

Meta M1: 30% a 37% no geral e 22% a 45% em cada faixa de distância. Medido: **31,8%, 33,3% e 34,9%**
(terços de 26,7% a 38,9%). Duração com os iniciais: **98,2 s** nas curtas e **128,6 s** nas longas
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

| Skill | Ganho (p.p.) | | Skill | Ganho (p.p.) | | Skill | Ganho (p.p.) |
|---|---|---|---|---|---|---|---|
| Drift | 10,7 | | Névoa Amiga | 7,1 | | Canto da Iara | 5,8 |
| Casco Firme | 9,0 | | Segundo Ar | 6,8 | | Sprint | 5,7 |
| Arrancada Final | 8,8 | | Nascente | 6,4 | | Fôlego de Montanha | 4,4 |
| Pé na Chuva | 8,3 | | Arranque | 6,1 | | Saída Rápida | 4,3 |
| Sol a Pino | 8,2 | | Chama Final | 6,0 | | Dado Viciado | 1,3 |

| +10 pontos em | Força | Velocidade | Estamina | Manobra | Garra | Aceleração | Sorte |
|---|---|---|---|---|---|---|---|
| Ganho (p.p.) | 13,7 | 13,2 | 7,6 | 6,8 | 4,8 | 4,6 | 0,5 |

A Velocidade deixou de dominar (era 18,8 p.p., 2,7× a mediana; agora 1,8×, empatada com a Força).
Ganho da skill de tipo, campo de 6 com e sem ela: Labareda 8,1 a 10,6 p.p., Maré Alta 9,7 a 12,1 e
Raízes Firmes 4,4 a 7,4. A diferença é de propósito: o que a meta vigia é o equilíbrio dos tipos (M9).

## 4. Três potros de exemplo

`seedBase` 20261106, `nextUid` 2, `breedCounter` 0, 1 e 2, pais no nível indicado. Os mesmos pais, seed
e contador sempre dão o mesmo potro; o `sim-test.js` compara os três por inteiro.

| # | Pais | Nome | Raridade | Tipo | Sexo | Status no nível 1 (VEL/ACE/MAN/FOR/EST/GAR/SOR) | Genética | Skills |
|---|---|---|---|---|---|---|---|---|
| 0 | Maré × Brasa (30) | Jurema | Comum ★★ | Fogo | F | 50/53/47/51/52/47/46 | 20/26/14/21/24/14/12 | Sol a Pino |
| 1 | Faísca × Lambari (1) | Jurema | Comum ★★ | Água | F | 44/46/53/45/44/43/45 | 8/11/25/10/8/5/10 | Arranque |
| 2 | Ventania × Jequitibá (30) | Trovão | Lendário ★ | Grama | M | 65/64/65/62/69/68/63 | 19/18/20/13/28/25/16 | Sprint, Arrancada Final |

O potro 2 nasceu Lendário de pais Raro e Lendário e por isso tem ★: a raridade subiu. A genética é
metade herdada: o status no nível 1 sai dela e da raridade, sem faixa por estrela.

## 5. Para revisar (decisões de design em aberto)

- **Sorte quase não vale na corrida** (+10 de Sorte rende 0,5 p.p.) e o **Dado Viciado** vale 1,3.
  Proposta: a Sorte pesar mais na chance de skill, com a chance base de cada raridade compensada para baixo.
- **Metas no limite:** a Grama no Lendário nível 50 vence 15,4% na M9 (piso 15,3%) e a Água no Raro
  nível 30, 15,6%; a Grama no Raro nível 30 fica em 17,9% (teto 18%).
- **Conjunto de 3 peças** valia +1 p.p. e o salto para 4 peças +14 (medição de 2026-11-10, antes do v3).
  Ou ganha um efeito real, ou fica assumido como degrau.
- **"Cansou" quase não acontece** (0,8% dos corredores). Subir o erro do jóquei deixaria o cansaço visível.
- **Garra dispara em 43,5% dos corredores.** Para ser momento raro, a chance teria de cair e as metas, ser medidas de novo.
- **Zebra por ruído na velocidade: testada em 2026-11-10 e não recomendada.** Com ±2% o favorito caía de
  49% para 41%, mas a corrida ficava decidida mais cedo. Zebra boa vem do fim da corrida (Garra, cansaço).
- **Os números saíram de simulação:** o Vinicius ainda não jogou o modelo v3.
