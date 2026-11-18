# Exemplos e achados do balanceamento

Medições do protótipo em 2026-11-13, no modelo do crescimento livre (bloco 1b dos cavalos v3: pontos
comprados com custo por faixa até 150, física linear, skill de tipo que multiplica os status, equipamento
suspenso). Spec e tabelas: `docs/superpowers/specs/2026-11-12-crescimento-livre-design.md` §13. As tabelas de
dados estão em `docs/wiki.md`, gerado do código. Para refazer as medições:

```bash
node prototype/tools/balance.js            # relatório completo com as 300 metas (~5 min)
node prototype/tools/balance.js --exemplo  # uma corrida narrada
```

## 0. Atualização de 2026-11-18: cavalo superior vence (simulação 3.2.0)

Pedido do Vinicius: "um cavalo superior precisa ter vantagem sobre outros, e se meu cavalo tem status maiores que todos
os outros da corrida e as mesmas skills, supostamente eu ganharia". Desenho e causa:
`docs/superpowers/specs/2026-11-18-balanco-superioridade-design.md`. **As seções 1 a 5 abaixo são as medições de
2026-11-13 e 2026-11-17 (simulação 3.1.0); o que mudou está nesta tabela** (relatório completo: 298 metas, todas dentro
da faixa).

| O que | Antes (3.1.0) | Agora (3.2.0) |
|---|---|---|
| Mesmo cavalo e mesmas skills, +2% / +5% / +10% / +15% em todos os status, duelo | 57% / 68% / 81% / 88% (sem skills: 72–78% de +1% a +10%) | **57% / 79% / 98% / 100%** |
| O mesmo, numa sala de 6 em que ele é o melhor (justo 17%) | +5% ~50%, +10% ~64% | **+5% 62%, +10% 97%, +15% 100%** |
| Garra | sai inteira (~60%) ou não sai; vale mais que +10% em todos os status | sempre sai; o sorteio dá de 30% a 100% do bônus (o piso sobe com a Garra) |
| M3 dez níveis a mais | 75–78% | 90–96% |
| M4 uma / duas raridades acima | 78–85% / 95–99% | 96–99% / 100% |
| M5 ★★★ × ★ / ★★ × ★ no nível 50 | 69–71% / 60–62% | 76–78% / 61–63% |
| M6 melhor build no nível 50 (Raro / Comum ★★ / Mítico ★★★) | 60% / 61% / 65% | 61,5% / 63,8% / 66,8% |
| M8 líder em 1/3 vence / chegada com < 1 m | 38% / 5,6% | 30% / 9,6% |
| M9 tipos em campo misto (justo 16,7%) | 16,3–17,2% | 15,6–17,9% (skills de tipo recalibradas: Labareda 22%, Raízes Firmes 18%, Maré Alta 31%) |
| P2 favorito do Poder vence na sala | 52% | 48% (a faixa dos rivais ficou mais estreita) |
| A1 +10 num status (maior ÷ menor) | 9,6–11,0 p.p. (1,15) | ~15 p.p. cada (1,2) |
| S1 ganho de uma skill | 4,0 (Chama Final) a 12,7 p.p. (Drift); Dado Viciado ~1, isento | **5,1 a 7,4 p.p., as 15** (meta 4–12) |
| Clima do dono / com a skill de clima / penalizado | ×1,03 / ×1,08 / ×0,97 | ×1,02 / ×1,06 / ×0,98 |
| Inicial no seu clima fixo | 45–68% | 69–73% |
| Iniciais no nível 1 (M1) | 31,8 / 33,3 / 34,9% | 31,4 / 34,4 / 34,2% |
| Ginásio, mesmo elemento (G1) | 46–51% | 48–51% |
| Ginásio, com vantagem / em desvantagem (G3) | 70–78% / 17–32% (vantagem de 4%) | 65–85% / 14–38% (vantagem de 2%) |
| Faixas do cansaço (apertada / normal / folgada) | menos de 1 m / de 1 a 8 m / 8 m ou mais | menos de 3 m / de 3 a 8 m / 8 m ou mais (23–31% / 34–39% / 30–44%) |

**Salas da aba Correr, medidas com o pareamento do jogo** (`buildLobby` + `RaceSim`, 500 salas por caso, os três iniciais):

| Fase | Antes | Agora |
|---|---|---|
| Salas 1 a 10 (estreia: 4 ou 5 corredores, rivais de 94,5% a 101,5% do Poder) | vencia 8–10%; perdia ~18 de Ouro por corrida (entrada 50) | vence **44–47%**; ganha ~30 de Ouro por corrida |
| Salas 11 a 20 (rampa) | idem | vence ~34% |
| Da sala 21 em diante (rivais de 93,5% a 104,5%) | vencia 8–13% (justo 17,6%) | vence **14–20%, média 17,0%**; Ouro por corrida perto de zero (−5 a +6) |

**Combos de skill** (mesmo cavalo dos dois lados, Raro nível 20, só o combo muda): antes o melhor trio (Arranque +
Drift + a skill de clima) vencia 64–66% contra trios sorteados e 66–72% contra o pior; contra outro elemento, hoje
nenhuma skill fica a mais de 2,2 pontos da média e o melhor trio fica ~10 pontos acima dela. Em duelo de mesmo elemento
(caso do ginásio) a skill de clima do tipo ainda vale mais (o clima vira o do tipo dos dois): o melhor trio vence 65%.

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
aleatório, Dado ligado. O número é o ganho na taxa de vitória (a base é ~17%). Meta S1: 3 a 13 p.p.

| Skill | Ganho (p.p.) | | Skill | Ganho (p.p.) | | Skill | Ganho (p.p.) |
|---|---|---|---|---|---|---|---|
| Drift | 12,7 | | Casco Firme | 9,3 | | Fôlego de Montanha | 5,7 |
| Arranque | 12,4 | | Arrancada Final | 8,8 | | Canto da Iara | 5,4 |
| Pé na Chuva | 8,1 | | Nascente | 7,8 | | Segundo Ar | 5,3 |
| Sol a Pino | 6,3 | | Névoa Amiga | 6,3 | | Saída Rápida | 5,1 |
| Sprint | 4,9 | | Chama Final | 4,0 | | | |

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

## 6. Para revisar (decisões de design em aberto)

Do bloco 1b (spec §15; detalhes no `docs/memoria/ESTADO.md`), **ainda em aberto** até o Vinicius jogar:
- **A build equilibrada é a mais forte** (o bot a 60–65% no nível 50; as inclinadas em 44–54%). Mudar a regra
  (custo que para de subir, retorno extra por concentrar) não foi medido.
- **A corrida mudou de sensação** (mais curta, "Cansou" some, a Garra dispara em 58% das corridas): olhar a animação.
- **Iniciais no nível 25 caem para a Prata** (eram Ouro).
- **A Sorte vale pouco** (0,7 p.p.; o Dado Viciado, 1,3 p.p. no modelo anterior): é só de nascimento, por desenho.
  Proposta antiga ainda aberta: a Sorte pesar mais na chance de skill, com a base de cada raridade compensada para baixo.
- **Rédea nova é rara:** vem só no 7º dia da recompensa diária e na 1ª vitória sobre cada um dos 3 líderes de
  ginásio; não está à venda. **Menos uso para o Ouro** com a loja suspensa.
- **Conjunto de 3 peças:** medido em 2026-11-10 (+1 p.p., e +14 no salto para 4 peças); com o equipamento
  suspenso, a decisão (efeito real ou degrau assumido) espera o equipamento voltar.
- **Garra e "Cansou":** a Garra agora dispara em 58% (não é momento raro); o erro do jóquei caiu e "Cansou" quase some.
- **Zebra por ruído na velocidade: testada em 2026-11-10 e não recomendada.** Com ±2% o favorito caía de
  49% para 41%, mas a corrida ficava decidida mais cedo. Zebra boa vem do fim da corrida (Garra, cansaço).
- **Os números saíram de simulação:** o Vinicius ainda não jogou o modelo do crescimento livre.
