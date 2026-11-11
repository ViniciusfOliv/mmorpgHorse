# Exemplos e achados do balanceamento

Medições do protótipo em 2026-11-11, no modelo v3 (bloco 1 dos cavalos v3: genética, pontos livres,
estrelas, skill de tipo e pistas de 1.400 a 2.000 m). As tabelas de dados (status, skills, raridades,
equipamento, economia) estão em `docs/wiki.md`, gerado do código. Para refazer as medições:

```bash
node prototype/tools/balance.js            # relatório completo com as 126 metas (~2,5 min)
node prototype/tools/balance.js --exemplo  # uma corrida narrada
```

## 1. Os três iniciais (Comuns ★★, nível 1, mapas aleatórios)

| Inicial | Vitórias | Curta (1.400–1.599 m) | Média | Longa (1.800–2.000 m) | No clima do seu tipo (sem Dado) |
|---|---|---|---|---|---|
| **Brasa** 🔥 Labareda no 1º terço | 33,0% | 41,7% | 32,5% | 26,4% | Sol: 57,7% |
| **Maré** 💧 Maré Alta no último terço | 35,3% | 28,7% | 34,9% | 41,0% | Chuva: 61,0% |
| **Ipê** 🌿 Raízes Firmes no terço do meio | 31,7% | 29,6% | 32,6% | 32,6% | Névoa: 56,7% |

Meta M1: 30% a 37% no geral e 22% a 45% em cada faixa de distância. No modelo anterior a Brasa vencia
67% das curtas e 11% das longas. Duração com os iniciais: 95,9 s nas curtas e 127,1 s nas longas.

## 2. Progressão e Poder (duelos 1v1, mesma genética, build dos bots)

| Duelo | Vitórias do primeiro | Meta |
|---|---|---|
| 10 níveis a mais, mesma raridade (M3) | 77,9% a 87,5% | ≥ 70% |
| Uma raridade acima, mesmo nível (M4) | 81,7% a 86,0% | 72–88% |
| Duas raridades acima (M4) | 96,8% a 98,8% | ≥ 95% |
| ★★★ × ★ no nível 50 (M5) | 71,1% a 72,5% | 65–75% |
| ★★ × ★ no nível 50 (M5) | 58,6% a 61,0% | 55–63% |
| Melhor de 6 builds contra outra (M6) | no máximo 57,0% | ≤ 60% |

Status que dá para encher no nível 50 (M7): ★ 3,48 · ★★ 4,08 · ★★★ 4,89 dos 7 (enche os 7: 0,8% dos ★★★).
Num campo misto de 6 cavalos equivalentes (M9), cada tipo vence de 15,4% a 17,9% (justo: 16,7%).

**O Poder prevê o resultado?** Em 5.000 salas montadas como o jogo monta (rivais de 91,5% a 111,5% do seu Poder, build dos bots):
- o favorito do Poder vence **52,0%** das vezes (sorteio puro daria ~18%);
- nenhum tipo, raridade ou número de estrelas foge mais de **2,0 p.p.** do que o Poder prevê;
- quem lidera em 1/3 da pista vence **44,1%**; **6,7%** das corridas terminam com menos de 1 m de margem.

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
