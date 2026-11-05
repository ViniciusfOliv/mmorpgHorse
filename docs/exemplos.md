# Exemplos — MMORPG Horse (protótipo v0.1)

Números reais do protótipo (`prototype/src/data.js` + `prototype/src/sim.js`). Para regenerar:

```bash
cd prototype
node tools/balance.js            # relatório de balanceamento (≈1 min, milhares de corridas)
node tools/balance.js --exemplo  # a corrida de exemplo da seção 10
```

O modelo da simulação (fórmulas e constantes) está descrito no topo de `prototype/src/sim.js`.

Legenda dos status: **VEL** Velocidade · **ACE** Aceleração · **EST** Estamina · **FOR** Força · **GAR** Garra.
Rating = Rating de Poder (`RaceSim.powerRating`), usado para as ligas.

## 1. Os 3 iniciais

Todos Raros, level 1, soma de base 300, uma habilidade exclusiva. O elemento soma +8 no status dele.

| Inicial | Elemento | Base lv1 (VEL/ACE/EST/FOR/GAR) | Efetivo lv1 (c/ elemento) | Efetivo lv25 | Potencial | Habilidade exclusiva | Rating lv1 → lv25 |
|---|---|---|---|---|---|---|---|
| **Brasa** | Fogo | 64 / 62 / 60 / 52 / 62 | 66 / 72 / 61 / 53 / 64 | 85 / 93 / 79 / 72 / 85 | 22 / 24 / 12 / 14 / 18 | **Labareda** — Largada em chamas: +15% de aceleração e +1% de velocidade por 5s. | 655 → 851 |
| **Maré** | Água | 62 / 54 / 70 / 56 / 58 | 64 / 55 / 80 / 58 / 60 | 84 / 73 / 93 / 79 / 82 | 16 / 12 / 24 / 18 / 20 | **Maré Alta** — Quando a estamina cai a 25%, a maré sobe: recupera 20% de estamina e ganha +3% de velocidade por 8s. | 656 → 843 |
| **Ipê** | Grama | 62 / 56 / 60 / 68 / 54 | 64 / 57 / 62 / 78 / 56 | 84 / 76 / 83 / 93 / 77 | 16 / 14 / 18 / 24 / 18 | **Raízes Firmes** — Na metade da corrida, finca os cascos: recupera 5% de estamina e +2% de velocidade por 8s. | 653 → 846 |

| Inicial | Perfil | Melhor condição | Pior condição |
|---|---|---|---|
| **Brasa** 🔥 | Arranque forte; fôlego médio | Curta + sol: vence **60,6%** contra Maré e Ipê (47,5% em pistas curtas em geral) | Longa + chuva: **19,6%** (22,8% em pistas longas em geral) |
| **Maré** 💧 | Estamina alta; cresce no fim | Longa + chuva: vence **53,9%** (47,2% em pistas longas em geral) | Curta + areia + sol: **16,3%** (20,9% em pistas curtas em geral) |
| **Ipê** 🌿 | Força; o mais regular (30–34% em qualquer distância) | Terra + subidas: vence **48,7%** (afinidade ×1,10) | Curta, grama, sol, sem subida: **19,8%** |

## 2. Elementos e afinidade

A afinidade multiplica **todos os status** do cavalo naquela corrida (soma das regras, limitada a ×0,92–×1,10).

| Elemento | Bônus fixo | Favorece | Penaliza |
|---|---|---|---|
| 🔥 Fogo | +8 ACE | Sol (+3%), pista curta (+2%) | Chuva (−4%) |
| 💧 Água | +8 EST | Chuva (+6%), pista longa (+4%) | Areia (−4%) |
| 🌿 Grama | +8 FOR | Terra (+5%), subidas (+5%) | Sol forte (−4%) |
| ⚪ Neutro | — | — | — |

Triângulo indireto: no **sol**, Fogo sobe e Grama cai (Fogo > Grama); em **terra/subida**, Grama sobe (Grama > Água, que também sofre na **areia**); na **chuva**, Água sobe e Fogo cai (Água > Fogo).

Sorteio de condições (`RaceSim.randomConditions`): cada distância (1000/1600/2400 m), piso (grama/terra/areia) e clima (sol/chuva/nublado) tem 1/3 de chance, e 1/3 das pistas tem 1 ou 2 subidas.

## 3. Cavalos selvagens (bots e achados de expedição)

| Cavalo | Elemento | Raridade | Lv | Status no lv atual (VEL/ACE/EST/FOR/GAR) | Habilidades | Rating | Liga | Onde aparece |
|---|---|---|---|---|---|---|---|---|
| Pangaré | Neutro | Comum | 1 | 45 / 43 / 47 / 50 / 41 | — | 452 | Bronze | Pasto da fazenda |
| Faísca | Fogo | Comum | 3 | 51 / 61 / 40 / 44 / 48 | Largada Rápida | 510 | Bronze | Cerrado seco |
| Lambari | Água | Comum | 2 | 43 / 46 / 62 / 44 / 46 | — | 481 | Bronze | Beira de rio |
| Capim | Grama | Comum | 4 | 45 / 45 / 49 / 64 / 45 | Segundo Fôlego | 512 | Bronze | Campos gerais |
| Tição | Fogo | Incomum | 8 | 61 / 72 / 47 / 52 / 59 | Chama Final | 604 | Prata | Carvoaria abandonada |
| Garoa | Água | Incomum | 10 | 56 / 53 / 75 / 56 / 58 | Correnteza, Segundo Fôlego | 636 | Prata | Serra enevoada |
| Mandacaru | Grama | Incomum | 7 | 51 / 53 / 58 / 73 / 51 | Casco de Cabra | 588 | Prata | Caatinga |
| Ventania | Neutro | Raro | 15 | 77 / 72 / 69 / 64 / 71 | Sprint Final, Raça | 750 | Ouro | Pampa gaúcho |
| Pororoca | Água | Raro | 18 | 70 / 68 / 91 / 73 / 72 | Nascente, Correnteza | 787 | Ouro | Foz do Amazonas |
| Fogaréu | Fogo | Épico | 22 | 92 / 103 / 72 / 75 / 83 | Sol a Pino, Chama Final, Largada Rápida | 915 | Diamante | Chapada em chamas |
| Jequitibá | Grama | Épico | 25 | 80 / 78 / 89 / 103 / 84 | Casco de Cabra, Trilha de Terra, Segundo Fôlego | 923 | Diamante | Mata Atlântica |
| Boitatá | Fogo | Lendário | 30 | 100 / 108 / 90 / 93 / 100 | Sol a Pino, Chama Final, Raça | 1043 | Lenda | Só aparece em noites de queimada |
| Iara | Água | Lendário | 28 | 97 / 93 / 108 / 90 / 100 | Canto da Iara, Correnteza, Nascente | 1037 | Lenda | Rios encantados |

## 4. Raridades

O teto vale por status antes de elemento/item. Comum lv25 ≈ Raro lv1 (Comum vence 44,9% desses duelos).

| Raridade | Teto por status | Crescimento/level | Habilidades | Ex.: rating lv1 → lv50 |
|---|---|---|---|---|
| Comum | 65 | ×0,80 | 1 | Pangaré: 452 → 650 |
| Incomum | 75 | ×0,90 | 2 | Garoa: 569 → 806 |
| Raro | 85 | ×1,00 | 2 | Maré: 656 → 886 |
| Épico | 95 | ×1,10 | 3 | Jequitibá: 693 → 1024 |
| Lendário | 100 | ×1,20 | 3 | Iara: 741 → 1076 |

## 5. Itens (1 por corrida)

| Item | Raridade | Preço | Efeito | Para quê |
|---|---|---|---|---|
| Ferradura Leve | Comum | 120 | +5 VEL, −4 FOR | Casco leve, passada solta. Perde firmeza no pesado. |
| Ferradura com Cravos | Comum | 120 | +10 FOR, −3 VEL | Agarra na areia e nas subidas, mas pesa na reta. |
| Sela de Couro Cru | Comum | 100 | +5 EST | Confortável e sem segredo. |
| Manta de Lã | Incomum | 220 | +9 EST, −4 ACE | Poupa o fôlego, mas deixa a largada preguiçosa. |
| Antolhos | Incomum | 220 | +10 GAR, −3 ACE | Foco total na reta final; demora a pegar embalo. |
| Rapadura de Engenho | Incomum | 180 | −2 VEL, tanque ×1,04 | Energia pura: tanque de estamina +4%, mas fica pesado (−2 Vel). |
| Esporas de Prata | Raro | 400 | +10 ACE, −6 EST | Arranque brutal, fôlego curto. |
| Capa Impermeável | Raro | 380 | +2 EST, anula penalidade de clima | Anula a penalidade de clima do elemento (ex.: Fogo na chuva). |
| Figa da Sorte | Épico | 700 | +5 GAR, +15% chance de Garra | Garra +5 e +15% de chance de a Garra disparar. |
| Penas de Gavião-Real | Lendário | 1500 | +10 VEL, +4 GAR, −6 EST | Voa baixo na reta (+10 Vel, +4 Gar), mas cansa antes (−6 Est). |

Brasa contra Maré e Ipê sem itens, em condições aleatórias, vence ~36% sem item e ~42% com Penas de Gavião-Real. Os itens de troca (Cravos, Capa) só valem na condição certa.

## 6. Habilidades (⭐ = exclusiva de inicial)

Cada habilidade dispara no máximo uma vez por corrida.

| Habilidade | Elemento | Gatilho | Efeito | Quem tem |
|---|---|---|---|---|
| Labareda ⭐ | Fogo | Largada | Largada em chamas: +15% de aceleração e +1% de velocidade por 5s. | Brasa |
| Chama Final | Fogo | Reta final (80%) | Na reta final, +5% de velocidade por 5s. | Tição, Fogaréu, Boitatá |
| Sol a Pino | Fogo | Clima: sol | Com sol: +10% de aceleração e +2% de velocidade nos primeiros 30s. | Fogaréu, Boitatá |
| Maré Alta ⭐ | Água | Estamina ≤ 25% | Quando a estamina cai a 25%, a maré sobe: recupera 20% de estamina e ganha +3% de velocidade por 8s. | Maré |
| Correnteza | Água | Clima: chuva | Com chuva: gasta 15% menos estamina por 40s. | Garoa, Pororoca, Iara |
| Nascente | Água | Meio da corrida (50%) | Na metade da corrida, recupera 12% de estamina. | Pororoca, Iara |
| Canto da Iara | Água | Reta final (80%) | Na reta final, +6% de velocidade por 5s e gasta 30% menos estamina. | Iara |
| Raízes Firmes ⭐ | Grama | Meio da corrida (50%) | Na metade da corrida, finca os cascos: recupera 5% de estamina e +2% de velocidade por 8s. | Ipê |
| Casco de Cabra | Grama | 1ª subida | Na primeira subida: +8% de velocidade e 30% menos gasto de estamina por 8s. | Mandacaru, Jequitibá |
| Trilha de Terra | Grama | Pista de terra | Em pista de terra: +2% de velocidade nos primeiros 30s. | Jequitibá |
| Largada Rápida | Neutro | Largada | +30% de aceleração por 4s na largada. | Faísca, Fogaréu |
| Segundo Fôlego | Neutro | Estamina ≤ 25% | Quando a estamina cai a 25%, recupera 18%. | Capim, Garoa, Jequitibá |
| Sprint Final | Neutro | Reta final (80%) | Na reta final, +4% de velocidade por 5s. | Ventania |
| Raça | Neutro | Na metade de trás após 60% | Se estiver na metade de trás depois de 60% da pista: +4% de velocidade por 6s. | Ventania, Boitatá |

## 7. Táticas

Taxa de vitória em corrida-espelho (4× o mesmo cavalo; base 25%):

| Tática | Como corre | Curta | Média | Longa | Geral |
|---|---|---|---|---|---|
| **Ponteiro** | Dispara a 100% nos primeiros 30% sem economizar (+3% grátis em curta, +1,5% em média), depois segura | **29,8%** | 27,2% | 21,4% | 26,1% |
| **Perseguidor** | Ritmo constante e sustentável, aproveita o vácuo (−10% de gasto), sprint a partir de 72% | 25,2% | 24,0% | 23,4% | 24,2% |
| **Arrancador** | Guarda 4% de ritmo e explode a partir de 70% (até 106%, +5% grátis em longa) com +15% de chance de Garra | 19,9% | 23,8% | **30,1%** | 24,6% |

## 8. Ligas (por Rating de Poder)

| Liga | Rating | Exemplos |
|---|---|---|
| Bronze | 0–549 | Pangaré lv1 (452), Faísca lv3 (510), Lambari lv2 (481), Capim lv4 (512) |
| Prata | 550–699 | Brasa lv1 (655), Maré lv1 (656), Ipê lv1 (653), Tição lv8 (604), Garoa lv10 (636), Mandacaru lv7 (588), Brasa lv1 + Penas de Gavião-Real (674) |
| Ouro | 700–799 | Ventania lv15 (750), Pororoca lv18 (787), Brasa lv10 (737) |
| Platina | 800–899 | Maré lv25 (843) |
| Diamante | 900–999 | Fogaréu lv22 (915), Jequitibá lv25 (923) |
| Lenda | 1000+ | Boitatá lv30 (1043), Iara lv28 (1037) |

Rating = 2,4·VEL + 2·ACE + 2·EST + 1,8·FOR + 1,8·GAR + 20 por habilidade (status efetivos, com item). Dentro da liga, o pareamento usaria o MMR do jogador.

## 9. Economia

Começa com **500 Ouro**. Entradas: **50 / 100 / 250**. Taxa da casa: **10%** (é o sumidouro de Ouro). Prêmios: **60% / 25% / 15%** do que sobra. Tudo inteiro: o 3º leva o resto do arredondamento.

**Exemplo: 8 jogadores × 100 Ouro**

| | Ouro | Saldo do jogador (prêmio − entrada) |
|---|---|---|
| Pote | 800 | — |
| Taxa da casa (10%) | 80 | — |
| 1º lugar (60% de 720) | 432 | +332 |
| 2º lugar (25% de 720) | 180 | +80 |
| 3º lugar (resto) | 108 | +8 |
| 4º ao 8º | 0 | −100 cada |

XP por colocação (1º→8º): 100, 70, 50, 35, 25, 20, 15, 10. Para subir de nível: `50 + 25 × level`.
lv1→2: 75 XP (acumulado até lv2: 75); lv5→6: 175 XP (acumulado até lv6: 625); lv10→11: 300 XP (acumulado até lv11: 1875); lv25→26: 675 XP (acumulado até lv26: 9375); lv49→50: 1275 XP (acumulado até lv50: 33075).

## 10. Corrida de exemplo

**Pista:** Raia do Sertão (`TRACK_EXAMPLES`): 2400 m, terra, sol, uma subida de 900 m a 1120 m · seed 20261119 · entrada de 100 Ouro, 8 corredores (o jogador e 7 bots).

| Raia | Jogador | Cavalo | Elem. | Rar. | Lv | Item | Tática | VEL/ACE/EST/FOR/GAR | Rating | Afinidade |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Você | Ipê | Grama | Raro | 6 | Ferradura com Cravos | Perseguidor | 65/61/66/93/60 | 705 | ×1,06 (Terra favorece Grama (+5%); Subidas favorecem Grama (+5%); Sol forte murcha a Grama (−4%)) |
| 2 | ZéDaBaia | Brasa | Fogo | Raro | 6 | Esporas de Prata | Ponteiro | 71/87/59/57/68 | 707 | ×1,03 (Sol favorece Fogo (+3%)) |
| 3 | Rapadura_Turbo | Maré | Água | Raro | 6 | Manta de Lã | Arrancador | 68/55/94/62/65 | 710 | ×1,04 (Pista longa favorece Água (+4%)) |
| 4 | Galopeira99 | Garoa | Água | Incomum | 10 | — | Perseguidor | 56/53/75/56/58 | 636 | ×1,04 (Pista longa favorece Água (+4%)) |
| 5 | Uai_Sô | Tição | Fogo | Incomum | 8 | Ferradura Leve | Ponteiro | 66/72/47/48/59 | 609 | ×1,03 (Sol favorece Fogo (+3%)) |
| 6 | Bah_Tchê | Mandacaru | Grama | Incomum | 7 | Sela de Couro Cru | Arrancador | 51/53/63/73/51 | 598 | ×1,06 (Terra favorece Grama (+5%); Subidas favorecem Grama (+5%); Sol forte murcha a Grama (−4%)) |
| 7 | Oxente_Racing | Ventania | Neutro | Raro | 4 | — | Perseguidor | 67/62/60/56/61 | 655 | ×1,00 |
| 8 | Cuscuz_Nitro | Pororoca | Água | Raro | 3 | — | Arrancador | 58/56/76/60/59 | 657 | ×1,04 (Pista longa favorece Água (+4%)) |

**Resultado**

| Pos. | Jogador | Cavalo | Tempo | Disposição do dia | Prêmio |
|---|---|---|---|---|---|
| 1º | Você | Ipê | 149,61s | Normal (+0,1%) | 432 Ouro |
| 2º | Rapadura_Turbo | Maré | 149,71s | Normal (+0,5%) | 180 Ouro |
| 3º | Cuscuz_Nitro | Pororoca | 151,90s | Sonolento (-2,7%) | 108 Ouro |
| 4º | Galopeira99 | Garoa | 155,16s | Normal (-0,1%) | — |
| 5º | ZéDaBaia | Brasa | 158,85s | Normal (-1,2%) | — |
| 6º | Bah_Tchê | Mandacaru | 160,12s | Sonolento (-3,6%) | — |
| 7º | Uai_Sô | Tição | 160,29s | Normal (+0,7%) | — |
| 8º | Oxente_Racing | Ventania | 160,74s | Sonolento (-3,7%) | — |

Pote 800 · taxa 80 · duração 160,74s · 1609 frames.

**Narração (lista `events` completa)**

```
[0,0s] (skill) Brasa ativou Labareda!
[67,6s] (skill) Mandacaru ativou Casco de Cabra!
[81,3s] (skill) Ipê ativou Raízes Firmes!
[87,3s] (skill) Pororoca ativou Nascente!
[103,6s] (skill) Ventania ativou Raça!
[107,2s] (ultrapassagem) Ipê passou Brasa e assumiu a liderança!
[124,9s] (garra) Ipê mostrou GARRA na reta final!
[128,1s] (skill) Tição ativou Chama Final!
[129,5s] (garra) Pororoca mostrou GARRA na reta final!
[130,1s] (skill) Garoa ativou Segundo Fôlego!
[132,1s] (skill) Maré ativou Maré Alta!
[134,6s] (skill) Ventania ativou Sprint Final!
[134,6s] (garra) Ventania mostrou GARRA na reta final!
[135,6s] (garra) Mandacaru mostrou GARRA na reta final!
[143,1s] (ultrapassagem) Maré passou Ipê e assumiu a liderança!
[147,2s] (ultrapassagem) Ipê passou Maré e assumiu a liderança!
[149,6s] (chegada) Ipê cruzou a linha em 1º lugar! (149,61s)
[149,7s] (chegada) Maré cruzou a linha em 2º lugar! (149,71s)
[151,9s] (chegada) Pororoca cruzou a linha em 3º lugar! (151,90s)
[155,2s] (chegada) Garoa cruzou a linha em 4º lugar! (155,16s)
[158,8s] (chegada) Brasa cruzou a linha em 5º lugar! (158,85s)
[160,1s] (chegada) Mandacaru cruzou a linha em 6º lugar! (160,12s)
[160,3s] (chegada) Tição cruzou a linha em 7º lugar! (160,29s)
[160,7s] (chegada) Ventania cruzou a linha em 8º lugar! (160,74s)
```

O que aconteceu: o Ipê do jogador tinha a melhor afinidade da pista (terra e subida pagam o sol: ×1,06) e FOR 93 com a Ferradura com Cravos. Correu de perseguidor atrás do Brasa ponteiro, assumiu a ponta aos 107 s e mostrou Garra. A Maré veio de arrancador (+5% grátis em pista longa) com Maré Alta, passou aos 143 s, e o Ipê retomou a ponta para vencer por **0,10 s**. O Brasa, com Esporas (−6 EST) numa pista de 2400 m, chegou em 5º.

## 11. Relatório de balanceamento

Gerado por `node tools/balance.js`. Táticas sorteadas por corredor, sem itens, salvo indicação.

### 1. Iniciais no mesmo level, condições aleatórias (meta: 28%–39% cada)

| Inicial | Vitórias lv1 (6000 corridas) | Curta | Média | Longa | Vitórias lv25 (3000) |
|---|---|---|---|---|---|
| Brasa | **35,0%** | 47,5% | 34,3% | 22,8% | 33,4% |
| Maré | **33,1%** | 20,9% | 31,8% | 47,2% | 33,4% |
| Ipê | **31,9%** | 31,6% | 33,9% | 30,1% | 33,2% |

### 2. Inicial em condição favorável vs os outros dois (meta: 45%–65%)

| Inicial | Condição | Afinidades | Vitórias (3000) |
|---|---|---|---|
| Brasa | Curta (1000 m), Grama, Sol | Brasa ×1,05 · Maré ×1,00 · Ipê ×0,96 | **60,6%** |
| Maré | Longa (2400 m), Grama, Chuva | Brasa ×0,96 · Maré ×1,10 · Ipê ×1,00 | **53,9%** |
| Ipê | Média (1600 m), Terra, Nublado, 2 subidas | Brasa ×1,00 · Maré ×1,00 · Ipê ×1,10 | **48,7%** |

### 3. Táticas em corrida-espelho: 4× o mesmo cavalo, condições aleatórias (meta: 18%–35% por tática)

Taxa = vitórias da tática / participações da tática (base = 25%). 3000 corridas por cavalo.

| Tática | Geral | Curta | Média | Longa | Brasa | Maré | Ipê | Ventania (lv1) |
|---|---|---|---|---|---|---|---|---|
| Ponteiro | **26,1%** | 29,8% | 27,2% | 21,4% | 25,9% | 27,0% | 26,2% | 25,4% |
| Perseguidor | **24,2%** | 25,2% | 24,0% | 23,4% | 24,7% | 24,8% | 23,6% | 23,8% |
| Arrancador | **24,6%** | 19,9% | 23,8% | 30,1% | 24,4% | 23,1% | 25,3% | 25,8% |

### 4. Raridade × level, duelos 1v1 com condições aleatórias

| Duelo | Vitórias do 1º |
|---|---|
| **Lendário lv1 × Comum lv1 (média, meta 75%–92%)** | **85,6%** |
| Boitatá lv1 × Pangaré lv1 | 88,2% |
| Boitatá lv1 × Faísca lv1 | 82,6% |
| Boitatá lv1 × Lambari lv1 | 85,2% |
| Boitatá lv1 × Capim lv1 | 84,0% |
| Iara lv1 × Pangaré lv1 | 89,7% |
| Iara lv1 × Faísca lv1 | 79,3% |
| Iara lv1 × Lambari lv1 | 88,3% |
| Iara lv1 × Capim lv1 | 87,2% |
| **Comum lv25 × Raro lv1 (média, meta 35%–65%)** | **44,9%** |
| Pangaré lv25 × Brasa lv1 | 35,1% |
| Pangaré lv25 × Maré lv1 | 37,3% |
| Pangaré lv25 × Ipê lv1 | 39,9% |
| Pangaré lv25 × Ventania lv1 | 49,3% |
| Pangaré lv25 × Pororoca lv1 | 43,3% |
| Faísca lv25 × Brasa lv1 | 51,1% |
| Faísca lv25 × Maré lv1 | 50,6% |
| Faísca lv25 × Ipê lv1 | 50,5% |
| Faísca lv25 × Ventania lv1 | 54,6% |
| Faísca lv25 × Pororoca lv1 | 52,4% |
| Lambari lv25 × Brasa lv1 | 38,8% |
| Lambari lv25 × Maré lv1 | 42,1% |
| Lambari lv25 × Ipê lv1 | 38,4% |
| Lambari lv25 × Ventania lv1 | 46,8% |
| Lambari lv25 × Pororoca lv1 | 43,0% |
| Capim lv25 × Brasa lv1 | 42,6% |
| Capim lv25 × Maré lv1 | 43,1% |
| Capim lv25 × Ipê lv1 | 42,5% |
| Capim lv25 × Ventania lv1 | 50,1% |
| Capim lv25 × Pororoca lv1 | 46,0% |

### 5. Duração (tempo de simulação até o último cruzar a linha)

| Distância | Iniciais lv1: média (p5–p95) | Vencedor: média | Campo PVP de 8 (mesma liga): média (p5–p95) | Meta |
|---|---|---|---|---|
| 1000 m | 62,7s (59,7–65,9) | 58,8s | 63,9s (58,5–68,4) | 55–70s |
| 1600 m | 99,8s (93,2–106,6) | 92,2s | 102,9s (93,0–112,2) | — |
| 2400 m | 159,5s (147,4–172,4) | 144,6s | 163,4s (145,3–178,5) | 140–170s |

### 6. Pagamentos (pote = entrada × corredores; taxa 10%; 60/25/15)

| Entrada | Corredores | Pote | Taxa | 1º | 2º | 3º |
|---|---|---|---|---|---|---|
| 50 | 4 | 200 | 20 | 108 | 45 | 27 |
| 50 | 6 | 300 | 30 | 162 | 67 | 41 |
| 50 | 8 | 400 | 40 | 216 | 90 | 54 |
| 100 | 4 | 400 | 40 | 216 | 90 | 54 |
| 100 | 6 | 600 | 60 | 324 | 135 | 81 |
| 100 | 8 | 800 | 80 | 432 | 180 | 108 |
| 250 | 4 | 1000 | 100 | 540 | 225 | 135 |
| 250 | 6 | 1500 | 150 | 810 | 337 | 203 |
| 250 | 8 | 2000 | 200 | 1080 | 450 | 270 |

### Outros números (corridas do teste 1)

| Métrica | Valor |
|---|---|
| Garra disparou | 57,9% dos corredores |
| "Cansou" (estamina zerou antes dos últimos 2%) | 0,7% dos corredores |
| Trocas de liderança narradas por corrida | 0,75 |
| Habilidades ativadas por corrida | 2,74 |

### Resultado das metas

| # | Meta | Valor | Faixa | OK |
|---|---|---|---|---|
| 1 | Brasa lv1 | 35,0% | 28–39% | ✅ |
| 1 | Brasa lv25 | 33,4% | 28–39% | ✅ |
| 1 | Maré lv1 | 33,1% | 28–39% | ✅ |
| 1 | Maré lv25 | 33,4% | 28–39% | ✅ |
| 1 | Ipê lv1 | 31,9% | 28–39% | ✅ |
| 1 | Ipê lv25 | 33,2% | 28–39% | ✅ |
| 2 | Brasa favorável | 60,6% | 45–65% | ✅ |
| 2 | Maré favorável | 53,9% | 45–65% | ✅ |
| 2 | Ipê favorável | 48,7% | 45–65% | ✅ |
| 3 | Ponteiro (geral) | 26,1% | 18–35% | ✅ |
| 3 | Ponteiro c/ Brasa | 25,9% | 18–35% | ✅ |
| 3 | Ponteiro c/ Maré | 27,0% | 18–35% | ✅ |
| 3 | Ponteiro c/ Ipê | 26,2% | 18–35% | ✅ |
| 3 | Ponteiro c/ Ventania (lv1) | 25,4% | 18–35% | ✅ |
| 3 | Perseguidor (geral) | 24,2% | 18–35% | ✅ |
| 3 | Perseguidor c/ Brasa | 24,7% | 18–35% | ✅ |
| 3 | Perseguidor c/ Maré | 24,8% | 18–35% | ✅ |
| 3 | Perseguidor c/ Ipê | 23,6% | 18–35% | ✅ |
| 3 | Perseguidor c/ Ventania (lv1) | 23,8% | 18–35% | ✅ |
| 3 | Arrancador (geral) | 24,6% | 18–35% | ✅ |
| 3 | Arrancador c/ Brasa | 24,4% | 18–35% | ✅ |
| 3 | Arrancador c/ Maré | 23,1% | 18–35% | ✅ |
| 3 | Arrancador c/ Ipê | 25,3% | 18–35% | ✅ |
| 3 | Arrancador c/ Ventania (lv1) | 25,8% | 18–35% | ✅ |
| 4a | Lendário lv1 vence Comum lv1 | 85,6% | 75–92% | ✅ |
| 4b | Comum lv25 vence Raro lv1 | 44,9% | 35–65% | ✅ |
| 5 | Duração 1000m (iniciais) | 62,7s | 55–70s | ✅ |
| 5 | Duração 1000m (PVP 8) | 63,9s | 55–70s | ✅ |
| 5 | Duração 2400m (iniciais) | 159,5s | 140–170s | ✅ |
| 5 | Duração 2400m (PVP 8) | 163,4s | 140–170s | ✅ |
| 6 | Pagamentos: soma(prêmios)+taxa == pote, inteiros (4..8 corredores × 50/100/250) | sim | — | ✅ |
| 7 | Determinismo: mesma seed+config => saída idêntica (25 configs, com itens e pistas de exemplo) | sim | — | ✅ |
| 7 | Seeds diferentes => corridas diferentes | sim | — | ✅ |

**Todas as 33 metas passaram.**

## 12. Para revisar

- A **Disposição do dia** (±10% no `vMax`, triangular) é a maior fonte de zebra. Ela permite que um Comum vença um Lendário em ~14% dos duelos e mantém a vantagem da condição favorável em ~50–60%. Ela já vem em `result.racerInfo[i].disposicao`. Sugestão: mostrar antes da aposta para virar informação, e não só sorte.
- Os Raros batem no teto (85) entre o lv20 e o lv33, conforme o potencial. Depois disso, subir de nível quase não muda nada. Talvez seja preciso um teto maior ou um crescimento menor no começo.
- "Cansou" é raro (~1% dos corredores), porque o jóquei raciona bem. Para ter mais drama, dá para aumentar o erro de leitura do jóquei do ponteiro.
- Os itens mexem pouco (+0–6 p.p. de vitória). Isso combina com "estratégia > grind", mas talvez os itens raros precisem de mais identidade.
