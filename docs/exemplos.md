# Exemplos e achados do balanceamento

Medições do protótipo em 2026-11-10, depois do pacote de balanceamento do pente fino. As tabelas de
dados (status, skills, raridades, equipamento, economia) estão em `docs/wiki.md`, gerado do código.
Para refazer as medições:

```bash
node prototype/tools/balance.js            # relatório completo com todas as metas (~1,5 min)
node prototype/tools/balance.js --exemplo  # uma corrida narrada
```

## 1. Os três iniciais (level 1, mapas aleatórios)

| Inicial | Vitórias | Pista curta | Média | Longa | No clima do seu elemento (sem Dado) |
|---|---|---|---|---|---|
| **Brasa** 🔥 arranque e velocidade | 32,3% | 67,3% | 27,2% | 11,4% | Sol: 47,9% |
| **Maré** 💧 estamina, cresce no fim | 38,1% | 16,7% | 40,8% | 52,1% | Chuva: 63,7% |
| **Ipê** 🌿 força, subida e piso pesado | 29,6% | 15,9% | 32,0% | 36,6% | Névoa: 52,8% |

## 2. Quanto vale cada skill e cada status

Comparação pareada: a mesma corrida (seed e rivais) com e sem a mudança, 6 Raros level 20, mapa
aleatório, Dado ligado. O número é o ganho na taxa de vitória (a base é ~17%).

| Skill | Ativa em | Ganho (p.p.) | | Skill | Ativa em | Ganho (p.p.) |
|---|---|---|---|---|---|---|
| Drift | 74% | 11,9 | | Casco Firme | 73% | 9,0 |
| Arrancada Final | 71% | 10,8 | | Sprint | 69% | 8,4 |
| Pé na Chuva | 50% | 10,3 | | Saída Rápida | 62% | 7,8 |
| Nascente | 69% | 10,1 | | Segundo Ar | 65% | 7,7 |
| Arranque | 71% | 9,7 | | Labareda | 71% | 7,4 |
| Raízes Firmes | 69% | 9,7 | | Canto da Iara | 72% | 7,3 |
| Névoa Amiga | 50% | 9,4 | | Chama Final | 71% | 7,2 |
| Sol a Pino | 48% | 9,2 | | Maré Alta | 63% | 7,2 |
| Fôlego de Montanha | 73% | 4,8 | | Dado Viciado | 72% | 0,7 |

Antes do pacote a faixa ia de 0,05 (Saída Rápida) a 16,2 (Drift). A meta S1 do `balance.js` agora
exige de 3 a 13 p.p. para toda skill, menos o Dado Viciado (ver §5).

| +10 pontos em | Velocidade | Força | Aceleração | Manobra | Garra | Estamina | Sorte |
|---|---|---|---|---|---|---|---|
| Ganho (p.p.) | 18,8 | 10,6 | 7,7 | 6,3 | 5,9 | 5,8 | 0,0 |

Por pista: Aceleração decide as curtas e Estamina as longas; Força vale 16 p.p. com muita subida e 3
sem subida; Manobra vale 0 sem curva. A Velocidade lidera em todas.

## 3. O Poder prevê o resultado?

Em 5.000 salas montadas como o jogo monta (rivais de 91,5% a 111,5% do seu Poder):
- o favorito do Poder vence **49,1%** das vezes (sorteio puro daria ~18%);
- nenhuma montaria foge mais de **3,8 p.p.** do que o Poder prevê (antes do pacote, até 10,5);
- quem lidera em 1/3 da pista vence **51%**; **7,7%** das corridas terminam com menos de 1 m de margem.

## 4. Três potros de exemplo

`seedBase` 20261106, `nextUid` 2, `breedCounter` 0, 1 e 2. Os mesmos pais, seed e contador sempre
dão o mesmo potro; o `sim-test.js` compara os três por inteiro.

| # | Pais | Nome | Raridade | Elemento | Sexo | VEL/ACE/MAN/FOR/EST/GAR/SOR | Potencial | Skills |
|---|---|---|---|---|---|---|---|---|
| 0 | Maré × Brasa | Quimera | Mágico ★★★ | Água | M | 53/59/57/60/59/52/57 | 21/16/18/18/20/16/16 | Pé na Chuva |
| 1 | Faísca × Pangaré | Quimera | Comum ★★ | Neutro | F | 47/42/43/44/46/46/44 | 10/12/15/10/20/27/10 | Arranque |
| 2 | Ventania × Jequitibá | Estrela | Lendário ★ | Grama | M | 65/62/61/60/62/64/61 | 28/25/17/27/21/19/16 | Sprint, Arrancada Final |

O potro 2 nasceu Lendário (30% de chance) e por isso ★: a raridade subiu. O potro 0 saiu Mágico ★★★
porque a raridade caiu. Os status são sorteados na janela do grau, não herdados.

## 5. Para revisar (decisões de design em aberto)

- **Sorte não vale nada na corrida** (+0,0 p.p.) e o **Dado Viciado** vale 0,7. Proposta: a Sorte pesar
  mais na chance de skill, com a chance base de cada raridade compensada para baixo.
- **Neutro é fraco a status iguais:** 6,3% de vitória num campo de 8 (o justo seria 12,5%), porque não
  tem bônus nem clima. O pareamento por Poder compensa, mas ninguém escolheria um Neutro. Proposta: um
  bônus pequeno de Velocidade ou um papel próprio (ver o roteiro em `docs/cronograma.md`).
- **Conjunto de 3 peças** vale +1 p.p.; o salto para 4 peças vale +14. Ou ganha um efeito real, ou
  fica assumido como degrau.
- **Velocidade ainda vale 2,7× a mediana** dos outros status (era 4×). Baixar mais mexe na duração da corrida.
- **"Cansou" quase não acontece** (0,5% dos corredores). Subir o erro do jóquei de 0,06 para 0,10 leva
  a 6,2% e mantém todas as metas.
- **Garra dispara em 51% dos corredores.** Para ser momento raro (37%), é preciso rebalizar a meta 3.
- **Zebra por ruído na velocidade: testada e não recomendada.** Com ±2% o favorito cai de 49% para
  41%, mas a corrida fica decidida mais cedo (o líder em 1/3 vence 58%). Zebra boa vem do fim da
  corrida (Garra, cansaço), não de ruído no começo.
- **Metas apertadas:** 3 (74,3% para teto 75), 3c (72,8% para 75), Maré no level 1 (38,1% para 39) e
  Maré na Chuva (63,7% para 65). São duelos quase determinísticos e pulam ±3 p.p. com mudanças sem relação.
