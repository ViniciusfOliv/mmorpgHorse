# Exemplos — MMORPG Horse (protótipo, núcleo v2)

Números reais do protótipo (`prototype/src/data.js` + `prototype/src/sim.js`). Para regenerar:

```bash
cd prototype
node tools/balance.js            # relatório de balanceamento (≈40 s, milhares de corridas)
node tools/balance.js --exemplo  # a corrida de exemplo da seção 10
```

O modelo da simulação (fórmulas e constantes) está descrito no topo de `prototype/src/sim.js`.
O design do núcleo v2 (e o histórico de ajustes da implementação) está em
`docs/superpowers/specs/2026-11-06-nucleo-corrida-v2-design.md`.

Legenda dos status: **VEL** Velocidade · **ACE** Aceleração · **MAN** Manobra · **FOR** Força · **EST** Estamina · **GAR** Garra · **SOR** Sorte.
Rating = Rating de Poder (`RaceSim.powerRating`), usado para as ligas. Sexo: M macho, F fêmea.

## 1. Os 3 iniciais

Todos Raros, level 1, com uma habilidade exclusiva. O elemento soma +8 no status dele. Chance de a habilidade disparar no lv1 (`RaceSim.skillChance`: 55% do Raro + 0,1 p.p. por ponto de Sorte efetiva): **Brasa 60,1%** (SOR 51) · **Maré 59,8%** (SOR 48) · **Ipê 60,5%** (SOR 55) — na tela, arredondado: 60% / 60% / 61%.

| Inicial | Elemento | Sexo | Base lv1 (VEL/ACE/MAN/FOR/EST/GAR/SOR) | Efetivo lv1 (c/ elemento) | Efetivo lv25 | Potencial | Habilidade exclusiva | Rating lv1 → lv25 |
|---|---|---|---|---|---|---|---|---|
| **Brasa** | Fogo | M | 64 / 62 / 60 / 52 / 58 / 62 / 50 | 66 / 72 / 62 / 53 / 59 / 64 / 51 | 80 / 88 / 80 / 72 / 77 / 80 / 70 | 22 / 24 / 18 / 14 / 12 / 18 / 14 | **Labareda** — Largada em chamas: +15% de aceleração e +1% de velocidade por 5s. | 728 → 920 |
| **Maré** | Água | F | 66 / 58 / 54 / 56 / 66 / 58 / 46 | 68 / 59 / 55 / 58 / 76 / 60 / 48 | 80 / 77 / 73 / 79 / 88 / 80 / 69 | 16 / 12 / 12 / 18 / 24 / 20 / 18 | **Maré Alta** — Quando a estamina cai a 20%, a maré sobe: recupera 20% de estamina e ganha +3% de velocidade por 8s. | 724 → 915 |
| **Ipê** | Grama | M | 62 / 54 / 50 / 64 / 64 / 52 / 54 | 64 / 55 / 51 / 74 / 66 / 54 / 55 | 80 / 74 / 69 / 88 / 80 / 75 / 74 | 16 / 14 / 12 / 24 / 18 / 18 / 14 | **Raízes Firmes** — Numa reta, finca os cascos: recupera 5% de estamina e +2% de velocidade por 8s. | 709 → 904 |

Vitórias entre os três (relatório, §11 testes 1 e 2; mapas aleatórios, lv1):

| Inicial | Perfil | Melhor condição | Pior condição | No clima do seu elemento (sem Dado) |
|---|---|---|---|---|
| **Brasa** 🔥 | Arranque e velocidade; fôlego curto | Curta (≤1200 m): **66,7%** | Longa (≥2200 m): **11,6%** | Sol: **52,5%** |
| **Maré** 💧 | Estamina alta; cresce no fim | Longa: **46,5%** | Curta: **15,8%** | Chuva: **63,2%** |
| **Ipê** 🌿 | Força: subidas e piso pesado | Longa: **41,9%** | Curta: **17,5%** | Névoa: **58,3%** |

## 2. Elementos e clima

O elemento dá um bônus fixo de status e tem um clima "dono". O clima multiplica os status do dono por ×1,03 (×1,10 com a skill de clima do elemento ativa) e os do penalizado por ×0,97; 10% desse desvio vai também direto na velocidade máxima. O clima pode virar no meio da corrida pelo Dado da Sorte (§7).

| Elemento | Bônus fixo | Clima dono (×1,03) | Sofre em (×0,97) | Skill de clima (×1,10) |
|---|---|---|---|---|
| 🔥 Fogo | +8 ACE | Sol | Chuva | Sol a Pino |
| 💧 Água | +8 EST | Chuva | Névoa | Pé na Chuva |
| 🌿 Grama | +8 FOR | Névoa | Sol | Névoa Amiga |
| ⚪ Neutro | — | — | — | — |

Triângulo pelo clima: no **sol**, Fogo sobe e Grama cai (Fogo > Grama); na **névoa**, Grama sobe e Água cai (Grama > Água); na **chuva**, Água sobe e Fogo cai (Água > Fogo). Efeitos gerais: sol aumenta o gasto de estamina em 4% para todos; chuva tira 1,5% da velocidade de todos; névoa e nublado não têm efeito geral. A Capa Impermeável anula o ×0,97.

Sorteio do mapa (`RaceSim.randomConditions`, tudo pela seed): distância múltipla de 100 m entre 1 000 e 2 400 m; 5 a 9 blocos de comprimento sorteado (arredondado a 10 m); o primeiro e o último bloco são reta, os do meio sorteiam reta/curva/subida com 1/3 cada; piso grama/terra/areia (1/3 cada); clima inicial sol/chuva/névoa/nublado (1/4 cada).

| Bloco | Status dono | Fator na velocidade-alvo |
|---|---|---|
| Reta | Velocidade | 1 |
| Curva | Manobra | 0,82 + 0,15·MAN/100 (0,82–0,97) |
| Subida | Força | 0,85 + 0,15·FOR/100 (0,85–1,00); gasto de estamina ×1,30, aliviado por Força |

## 3. Cavalos selvagens (bots e achados de expedição)

"Skill %" é a chance de cada habilidade disparar quando o gatilho acontece (raridade + level + Sorte).

| Cavalo | Elemento | Raridade | Sexo | Lv | Status no lv atual (VEL/ACE/MAN/FOR/EST/GAR/SOR) | Habilidades | Skill % | Rating | Liga | Onde aparece |
|---|---|---|---|---|---|---|---|---|---|---|
| Pangaré | Neutro | Comum | M | 1 | 45 / 43 / 40 / 50 / 47 / 41 / 41 | — | 39% | 503 | Bronze | Pasto da fazenda |
| Faísca | Fogo | Comum | F | 3 | 51 / 61 / 48 / 44 / 40 / 48 / 42 | Arranque | 40% | 572 | Bronze | Cerrado seco |
| Lambari | Água | Comum | M | 2 | 43 / 46 / 41 / 44 / 62 / 46 / 42 | — | 40% | 532 | Bronze | Beira de rio |
| Capim | Grama | Comum | F | 4 | 45 / 45 / 41 / 64 / 49 / 45 / 43 | Segundo Ar | 41% | 559 | Bronze | Campos gerais |
| Tição | Fogo | Mágico | M | 8 | 61 / 72 / 58 / 52 / 47 / 59 / 51 | Chama Final | 54% | 680 | Prata | Carvoaria abandonada |
| Garoa | Água | Mágico | F | 10 | 56 / 53 / 51 / 56 / 75 / 58 / 52 | Pé na Chuva, Segundo Ar | 55% | 683 | Prata | Serra enevoada |
| Mandacaru | Grama | Mágico | M | 7 | 51 / 53 / 48 / 73 / 58 / 51 / 50 | Casco Firme | 53% | 639 | Bronze | Caatinga |
| Ventania | Neutro | Raro | F | 15 | 77 / 72 / 71 / 64 / 69 / 71 / 63 | Sprint, Arrancada Final | 68% | 843 | Ouro | Pampa gaúcho |
| Pororoca | Água | Raro | M | 18 | 70 / 68 / 65 / 73 / 88 / 72 / 65 | Nascente, Pé na Chuva | 70% | 851 | Ouro | Foz do Amazonas |
| Fogaréu | Fogo | Lendário | F | 22 | 90 / 98 / 89 / 75 / 72 / 83 / 76 | Sol a Pino, Chama Final, Arranque | 83% | 1008 | Diamante | Chapada em chamas |
| Jequitibá | Grama | Lendário | M | 25 | 80 / 78 / 75 / 98 / 89 / 84 / 79 | Casco Firme, Fôlego de Montanha, Segundo Ar | 85% | 991 | Diamante | Mata Atlântica |
| Boitatá | Fogo | Mítico | F | 30 | 100 / 108 / 100 / 93 / 90 / 100 / 92 | Sol a Pino, Chama Final, Drift | 95% | 1163 | Lenda | Só aparece em noites de queimada |
| Iara | Água | Mítico | M | 28 | 97 / 93 / 91 / 90 / 108 / 100 / 90 | Canto da Iara, Pé na Chuva, Nascente | 95% | 1145 | Lenda | Rios encantados |

## 4. Raridades

O teto vale por status antes de elemento/equipamento. Sem ruído por corrida, a raridade quase sempre decide: Mítico lv1 vence Comum lv1 em 100% dos duelos, e Comum lv25 vence Raro lv1 em 25,9% (relatório, §11 teste 4). Os iniciais batem o teto 80 entre o lv13 e o lv40, conforme o status e o potencial.

| Raridade | Teto por status | Crescimento/level | Vagas de skill | Nasce com até | Chance base de skill | Ex.: rating lv1 → lv50 |
|---|---|---|---|---|---|---|
| Comum | 60 | ×0,80 | 1 | 1 | 35% | Pangaré: 503 → 684 |
| Mágico | 70 | ×0,90 | 2 | 1 | 45% | Garoa: 608 → 836 |
| Raro | 80 | ×1,00 | 3 | 2 | 55% | Maré: 724 → 942 |
| Lendário | 90 | ×1,10 | 4 | 2 | 65% | Jequitibá: 740 → 1079 |
| Mítico | 100 | ×1,20 | 5 | 3 | 75% | Iara: 806 → 1202 |

Chance de skill = base da raridade + 0,5 p.p. por level acima do 1 + 0,1 p.p. por ponto de Sorte, teto 95%. Ao subir de level, 8% de chance de aprender uma skill nova compatível (neutra ou do elemento), se houver vaga.

## 5. Itens → equipamento (ver §14)

O sistema antigo de um item por corrida foi substituído em 2026-11-06 pelo equipamento: 5 slots por montaria, peças com melhoria +0…+10 e conjuntos Sol/Chuva/Névoa (`gear.js`). Preços, metas e exemplos em §14; regras em `docs/GDD.md` §7.

## 6. Habilidades (⭐ = exclusiva de inicial)

Quando o gatilho acontece, a habilidade faz **uma** tentativa por corrida contra a chance de skill da montaria (Drift, Casco Firme e Fôlego de Montanha: uma tentativa por bloco). Todas as habilidades da tabela existem em `GameData.SKILLS` (18).

| Habilidade | Elemento | Gatilho | Efeito | Quem tem |
|---|---|---|---|---|
| Arranque | Neutro | Largada | +30% de aceleração nos primeiros 100 m. | Faísca, Fogaréu |
| Sprint | Neutro | Entrou numa reta ≥ 150 m (não a da largada) | +4% de velocidade por 150 m, gastando 15% mais estamina. | Ventania |
| Drift | Neutro | Cada curva | +5% de rendimento na curva (teto 1). | Boitatá |
| Saída Rápida | Neutro | Saiu de uma curva | +40% de aceleração por 4s. | — |
| Fôlego de Montanha | Neutro | Cada subida | Gasta 30% menos estamina na subida. | Jequitibá |
| Segundo Ar | Neutro | Estamina ≤ 20% | Recupera 15% de estamina. | Capim, Garoa, Jequitibá |
| Arrancada Final | Neutro | Cruzou 80% | +15% de chance de Garra e +3% de força na arrancada. | Ventania |
| Dado Viciado | Neutro | Dado da Sorte | Rola 1 dado extra em cada Dado da Sorte. | — |
| Sol a Pino | Fogo | Clima: sol | Dobra o bônus do clima para o Fogo (×1,10 em vez de ×1,03). | Fogaréu, Boitatá |
| Labareda ⭐ | Fogo | Largada | +15% de aceleração e +1% de velocidade por 5s. | Brasa |
| Chama Final | Fogo | Cruzou 80% | +5% de velocidade por 5s. | Tição, Fogaréu, Boitatá |
| Pé na Chuva | Água | Clima: chuva | Dobra o bônus do clima para a Água (×1,10). | Garoa, Pororoca, Iara |
| Maré Alta ⭐ | Água | Estamina ≤ 20% | Recupera 20% de estamina e +3% de velocidade por 8s. | Maré |
| Canto da Iara | Água | Cruzou 80% | +6% de velocidade por 5s e gasta 30% menos estamina. | Iara |
| Nascente | Água | Entrou numa reta ≥ 150 m (não a da largada) | Recupera 12% de estamina. | Pororoca, Iara |
| Névoa Amiga | Grama | Clima: névoa | Dobra o bônus do clima para a Grama (×1,10). | — |
| Casco Firme | Grama | Cada subida | +6% de rendimento na subida (teto 1). | Mandacaru, Jequitibá |
| Raízes Firmes ⭐ | Grama | Entrou numa reta ≥ 150 m (não a da largada) | Recupera 5% de estamina e +2% de velocidade por 8s. | Ipê |

As skills de clima são checadas a cada instante com o clima vigente: se o Dado da Sorte vira o clima para o do elemento, elas ainda podem disparar.

## 7. Dado da Sorte e clima

Quando o líder cruza **1/3** e **2/3** da pista, todas as montarias rolam um dado de 1 a 100. A **Sorte** é a chance, em %, de rolar um segundo dado e ficar com o melhor; Dado Viciado soma um dado extra. Maior dado vence (empate: só os empatados rolam de novo). O clima vira o do elemento do vencedor (Fogo → sol, Água → chuva, Grama → névoa); se já for esse, ou o vencedor for Neutro, "o clima segura". Tudo sai da seed (fluxo de RNG próprio do Dado).

| Número (relatório, §11 testes 2, 7 e 8) | Valor |
|---|---|
| Sorte 100 contra sete de Sorte 0 vence o dado | **20,6%** (sem viés seria 12,5%) |
| Média do melhor dado: Sorte 100 / Sorte 0 | 67,3 / 50,7 |
| Viradas de clima por corrida, PVP 8 sintético | **1,33** (0 viradas: 10,6% · 1: 45,9% · 2: 43,5%) |
| Viradas de clima por corrida, 3 iniciais | 1,42 |
| Efeito do clima nos status | dono ×1,03 (×1,10 com skill de clima) · penalizado ×0,97 |
| Inicial com o clima do elemento fixo (sem Dado) contra os outros dois | Brasa/Sol 52,5% · Maré/Chuva 63,2% · Ipê/Névoa 58,3% |

## 8. Ligas (por Rating de Poder)

| Liga | Rating | Exemplos |
|---|---|---|
| Bronze | 0–659 | Pangaré lv1 (503), Faísca lv3 (572), Lambari lv2 (532), Capim lv4 (559), Mandacaru lv7 (639) |
| Prata | 660–779 | Brasa lv1 (728), Maré lv1 (724), Ipê lv1 (709), Tição lv8 (680), Garoa lv10 (683), Brasa lv1 + Penas de Gavião-Real (758) |
| Ouro | 780–879 | Ventania lv15 (843), Pororoca lv18 (851), Brasa lv10 (822) |
| Platina | 880–979 | Brasa lv25 (920), Maré lv25 (915), Ipê lv25 (904) |
| Diamante | 980–1099 | Fogaréu lv22 (1008), Jequitibá lv25 (991) |
| Lenda | 1100+ | Boitatá lv30 (1163), Iara lv28 (1145) |

Rating = 2,2·VEL + 1,8·ACE + 1,6·MAN + 1,8·EST + 1,6·FOR + 1,6·GAR + 0,8·SOR (status efetivos, com equipamento) + 20 × peso do gatilho por habilidade (largada/reta/final/dado 1; curva 0,8; estamina baixa 0,8; subida 0,6; clima 0,4) + pontos do conjunto de equipamento (`gear.js`). Dentro da liga, o pareamento usaria o MMR do jogador.

## 9. Economia

Começa com **500 Ouro**. Entradas: **50 / 100 / 250**. Taxa da casa: **10%** (é o sumidouro de Ouro). A divisão do que sobra depende do tamanho do campo, para que todo lugar premiado receba pelo menos a entrada de volta: **4–5 corredores 70% / 30%**, **6–7 corredores 50% / 30% / 20%**, **8 corredores 60% / 25% / 15%**. Tudo inteiro: o último pago leva o resto do arredondamento, e os prêmios **nunca são crescentes** (quem chega depois nunca recebe mais).

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

Gerada por `node tools/balance.js --exemplo`: entrada de 100 Ouro, 8 corredores (o jogador e 7 bots), mapa sorteado pela seed.

Mapa `randomConditions(20261119)`: 1900 m, piso Grama, clima inicial Sol, clima final Chuva, seed 20261119.

Blocos:

- reta 0–430 m
- subida 430–850 m
- subida 850–1190 m
- subida 1190–1500 m
- reta 1500–1900 m

| Raia | Jogador | Cavalo | Elem. | Rar. | Sexo | Lv | Equip. | VEL/ACE/MAN/FOR/EST/GAR/SOR | Rating | Skills % |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Você | Ipê | Grama | Raro | M | 6 | 5 peças | 72/63/59/83/74/58/59 | 792 | Raízes Firmes (63%) |
| 2 | ZéDaBaia | Brasa | Fogo | Raro | M | 6 | 2 peças | 73/77/66/57/65/68/55 | 786 | Labareda (63%) |
| 3 | Rapadura_Turbo | Maré | Água | Raro | F | 6 | — | 72/63/59/62/81/65/52 | 773 | Maré Alta (63%) |
| 4 | Galopeira99 | Garoa | Água | Mágico | F | 10 | — | 56/53/51/56/75/58/52 | 683 | Pé na Chuva, Segundo Ar (55%) |
| 5 | Uai_Sô | Tição | Fogo | Mágico | M | 8 | — | 61/72/58/52/47/59/51 | 680 | Chama Final (54%) |
| 6 | Bah_Tchê | Mandacaru | Grama | Mágico | M | 7 | — | 51/53/48/73/58/51/50 | 639 | Casco Firme (53%) |
| 7 | Oxente_Racing | Ventania | Neutro | Raro | F | 4 | — | 67/62/61/56/60/61/54 | 735 | Sprint, Arrancada Final (62%) |
| 8 | Cuscuz_Nitro | Pororoca | Água | Raro | M | 3 | — | 58/56/53/60/76/59/53 | 711 | Nascente, Pé na Chuva (61%) |

| Pos | Jogador | Cavalo | Tempo | Prêmio |
|---|---|---|---|---|
| 1º | Você | Ipê | 112,35 s | 432 Ouro |
| 2º | Rapadura_Turbo | Maré | 113,71 s | 180 Ouro |
| 3º | Cuscuz_Nitro | Pororoca | 118,20 s | 108 Ouro |
| 4º | Oxente_Racing | Ventania | 119,98 s | — |
| 5º | Bah_Tchê | Mandacaru | 122,29 s | — |
| 6º | ZéDaBaia | Brasa | 122,80 s | — |
| 7º | Galopeira99 | Garoa | 123,57 s | — |
| 8º | Uai_Sô | Tição | 124,67 s | — |

Pote 800 · taxa 80 · duração 124,67 s · 1248 frames

```
[26,9s] (ultrapassagem) Maré passou Brasa e assumiu a liderança!
[31,0s] (ultrapassagem) Ipê passou Maré e assumiu a liderança!
[42,0s] (dado) 🎲 Pororoca tirou 98 — começa a chover!
[42,0s] (clima) O clima virou: Chuva!
[42,0s] (skill) Pororoca ativou Pé na Chuva!
[79,7s] (dado) 🎲 Pororoca tirou 99 — o clima segura!
[93,5s] (skill) Ipê ativou Raízes Firmes!
[94,6s] (garra) Ipê mostrou GARRA na reta final!
[95,6s] (skill) Maré ativou Maré Alta!
[96,3s] (garra) Maré mostrou GARRA na reta final!
[97,2s] (skill) Pororoca ativou Nascente!
[99,7s] (skill) Ventania ativou Sprint!
[100,9s] (garra) Ventania mostrou GARRA na reta final!
[102,4s] (garra) Mandacaru mostrou GARRA na reta final!
[112,3s] (chegada) Ipê cruzou a linha em 1º lugar! (112,35s)
[113,7s] (chegada) Maré cruzou a linha em 2º lugar! (113,71s)
[118,2s] (chegada) Pororoca cruzou a linha em 3º lugar! (118,20s)
[120,0s] (chegada) Ventania cruzou a linha em 4º lugar! (119,98s)
[122,3s] (chegada) Mandacaru cruzou a linha em 5º lugar! (122,29s)
[122,8s] (chegada) Brasa cruzou a linha em 6º lugar! (122,80s)
[123,6s] (chegada) Garoa cruzou a linha em 7º lugar! (123,57s)
[124,7s] (chegada) Tição cruzou a linha em 8º lugar! (124,67s)
```

O que aconteceu: o mapa tinha 1 070 m de subida seguida (430–1500 m), bom para o Ipê do jogador (FOR 83, com 5 peças de equipamento que somam +4 em VEL, ACE, MAN, FOR e EST). A corrida largou no sol; a Maré passou a Brasa aos 27 s e o Ipê assumiu a ponta aos 31 s. No primeiro Dado da Sorte (1/3 da pista) o Pororoca tirou 98 e virou o clima para **chuva**: Água passou a ×1,03 e Fogo a ×0,97, e o Pororoca ativou Pé na Chuva (×1,10). No segundo Dado o Pororoca tirou 99 e a chuva segurou. Na reta final o Ipê ativou Raízes Firmes e mostrou Garra; a Maré respondeu com Maré Alta e Garra, mas não alcançou: o Ipê venceu por **1,36 s**. Os dois Fogos (Brasa, com 2 peças, e Tição), penalizados pela chuva desde os 42 s, chegaram em 6º e 8º; a Labareda do Brasa não disparou na largada (chance de 63%).

## 11. Relatório de balanceamento

Gerado por `node tools/balance.js`. Mapas aleatórios em blocos (`randomConditions`), sem itens, salvo indicação. Dado da Sorte ligado (1/3 e 2/3 da pista), exceto na seção 2.

### 1. Iniciais no mesmo level, mapas aleatórios (meta: 28%–39% cada)

| Inicial | Vitórias lv1 (6000 corridas) | Curta | Média | Longa | Vitórias lv25 (3000) |
|---|---|---|---|---|---|
| Brasa | **32,8%** | 66,7% | 28,2% | 11,6% | 33,5% |
| Maré | **34,1%** | 15,8% | 36,3% | 46,5% | 30,5% |
| Ipê | **33,1%** | 17,5% | 35,5% | 41,9% | 36,0% |

### 2. Inicial com o clima do seu elemento fixo, sem Dado (meta: 45%–65%)

Mapas aleatórios (`randomConditions`) com o clima trocado pelo do elemento do inicial, fixo durante toda a corrida (`diceAt = []` nesta seção).

| Inicial | Clima | Multiplicadores (Brasa · Maré · Ipê) | Vitórias (3000) |
|---|---|---|---|
| Brasa | Sol | ×1,03 · ×1,00 · ×0,97 | **52,5%** |
| Maré | Chuva | ×0,97 · ×1,03 · ×1,00 | **63,2%** |
| Ipê | Névoa | ×1,00 · ×0,97 · ×1,03 | **58,3%** |

### 3. Especialistas por trecho (mítico lv1 neutro, base 60 e um status 90; meta: o especialista do trecho vence 55%–75%; 3b: 70%–100%)

3b rebaseada para 70%–100%: sem Disposição do dia (intencional no v2) não há ruído por corrida, e em reta pura VEL 90 contra 60 decide quase sempre.

| # | Duelo | Mapa | Vitórias do 1º (2000, largada alternada) |
|---|---|---|---|
| 3 | De curva (MAN 90) × de reta (VEL 90) | 1600 m, 75% curva | **71,8%** |
| 3b | De reta (VEL 90) × de curva (MAN 90) em reta pura | 1600 m, 100% reta | **100,0%** |
| 3c | De subida (FOR 90) × de reta (VEL 90) | 1600 m, 75% subida | **68,3%** |

### 4. Raridade × level, duelos 1v1 em mapas aleatórios (1500 / 800 corridas por duelo)

Faixas rebaseadas (4a 90%–100%, 4b 25%–60%): sem Disposição do dia (intencional no v2) a raridade quase sempre decide, e o Comum lv25 para no teto 60.

| Duelo | Vitórias do 1º |
|---|---|
| **Mítico lv1 × Comum lv1 (média, meta 90%–100%)** | **100,0%** |
| Boitatá lv1 × Pangaré lv1 | 100,0% |
| Boitatá lv1 × Faísca lv1 | 100,0% |
| Boitatá lv1 × Lambari lv1 | 100,0% |
| Boitatá lv1 × Capim lv1 | 100,0% |
| Iara lv1 × Pangaré lv1 | 100,0% |
| Iara lv1 × Faísca lv1 | 99,9% |
| Iara lv1 × Lambari lv1 | 100,0% |
| Iara lv1 × Capim lv1 | 100,0% |
| **Comum lv25 × Raro lv1 (média, meta 25%–60%)** | **25,9%** |
| Pangaré lv25 × Brasa lv1 | 12,9% |
| Pangaré lv25 × Maré lv1 | 7,0% |
| Pangaré lv25 × Ipê lv1 | 10,4% |
| Pangaré lv25 × Ventania lv1 | 29,4% |
| Pangaré lv25 × Pororoca lv1 | 26,6% |
| Faísca lv25 × Brasa lv1 | 26,0% |
| Faísca lv25 × Maré lv1 | 24,3% |
| Faísca lv25 × Ipê lv1 | 33,0% |
| Faísca lv25 × Ventania lv1 | 50,4% |
| Faísca lv25 × Pororoca lv1 | 40,1% |
| Lambari lv25 × Brasa lv1 | 22,4% |
| Lambari lv25 × Maré lv1 | 15,6% |
| Lambari lv25 × Ipê lv1 | 11,0% |
| Lambari lv25 × Ventania lv1 | 33,3% |
| Lambari lv25 × Pororoca lv1 | 24,1% |
| Capim lv25 × Brasa lv1 | 21,9% |
| Capim lv25 × Maré lv1 | 20,1% |
| Capim lv25 × Ipê lv1 | 19,3% |
| Capim lv25 × Ventania lv1 | 47,1% |
| Capim lv25 × Pororoca lv1 | 42,6% |

### 5. Duração (tempo de simulação até o último cruzar a linha)

| Distância | Iniciais lv1: média (p5–p95) | Vencedor: média | PVP de 8 (mesma liga): média (p5–p95) | Meta |
|---|---|---|---|---|
| curta (≤1200 m) | 68,3 s (61,1–75,9) | 66,8 s | 69,1 s (58,3–79,0) | 55–70 s |
| média (1300–2100 m) | 106,3 s (79,6–134,8) | 103,8 s | 107,5 s (80,8–139,9) | — |
| longa (≥2200 m) | 149,2 s (136,7–162,2) | 144,9 s | 150,6 s (131,1–168,5) | 140–170 s |

### 6. Pagamentos (pote = entrada × corredores; taxa 10%; 4–5 corredores 70/30, 6–7 50/30/20, 8 60/25/15)

| Entrada | Corredores | Pote | Taxa | 1º | 2º | 3º |
|---|---|---|---|---|---|---|
| 50 | 4 | 200 | 20 | 125 | 55 | — |
| 50 | 5 | 250 | 25 | 157 | 68 | — |
| 50 | 6 | 300 | 30 | 135 | 81 | 54 |
| 50 | 7 | 350 | 35 | 157 | 94 | 64 |
| 50 | 8 | 400 | 40 | 216 | 90 | 54 |
| 100 | 4 | 400 | 40 | 251 | 109 | — |
| 100 | 5 | 500 | 50 | 315 | 135 | — |
| 100 | 6 | 600 | 60 | 270 | 162 | 108 |
| 100 | 7 | 700 | 70 | 315 | 189 | 126 |
| 100 | 8 | 800 | 80 | 432 | 180 | 108 |
| 250 | 4 | 1000 | 100 | 630 | 270 | — |
| 250 | 5 | 1250 | 125 | 787 | 338 | — |
| 250 | 6 | 1500 | 150 | 675 | 405 | 270 |
| 250 | 7 | 1750 | 175 | 787 | 472 | 316 |
| 250 | 8 | 2000 | 200 | 1080 | 450 | 270 |

### 7. Dado da Sorte (`rollDice`, 4000 rodadas; meta: 18%–28%; sem viés seria 12,5%)

| Métrica | Valor |
|---|---|
| Sorte 100 tira mais que os sete de Sorte 0 | **20,6%** |
| Média do dado com Sorte 100 | 67,3 |
| Média do dado com Sorte 0 | 50,7 |

### 8. Viradas de clima por corrida (PVP 8 sintético, mítico lv1 base 60, elementos sorteados entre Fogo/Água/Grama; meta: média 0,8–1,6)

| Métrica (1000 corridas) | Valor |
|---|---|
| Média de viradas por corrida | **1,33** |
| Corridas com 0 viradas | 10,6% |
| Corridas com 1 virada | 45,9% |
| Corridas com 2 viradas | 43,5% |

### 10. Chance de skill: observada × calculada (lv1, Sorte 50, `Arranque`, 2000 corridas em reta de 1600 m; meta: diferença ≤ 3 p.p.)

| Raridade | Calculada (`skillChance`) | Observada | Diferença |
|---|---|---|---|
| Comum | 40,0% | 38,1% | 1,9 p.p. |
| Mágico | 50,0% | 50,5% | 0,5 p.p. |
| Raro | 60,0% | 58,3% | 1,7 p.p. |
| Lendário | 70,0% | 68,0% | 2,0 p.p. |
| Mítico | 80,0% | 79,3% | 0,7 p.p. |

### Ligas (Rating de Poder sem equipamento)

Limites: Bronze ≥ 0 · Prata ≥ 660 · Ouro ≥ 780 · Platina ≥ 880 · Diamante ≥ 980 · Lenda ≥ 1100.

| Montaria | Raridade | Lv | Rating | Liga |
|---|---|---|---|---|
| Brasa | Raro | 1 | 728 | Prata |
| Maré | Raro | 1 | 724 | Prata |
| Ipê | Raro | 1 | 709 | Prata |
| Brasa | Raro | 25 | 920 | Platina |
| Maré | Raro | 25 | 915 | Platina |
| Ipê | Raro | 25 | 904 | Platina |
| Pangaré | Comum | 1 | 503 | Bronze |
| Faísca | Comum | 3 | 572 | Bronze |
| Lambari | Comum | 2 | 532 | Bronze |
| Capim | Comum | 4 | 559 | Bronze |
| Tição | Mágico | 8 | 680 | Prata |
| Garoa | Mágico | 10 | 683 | Prata |
| Mandacaru | Mágico | 7 | 639 | Bronze |
| Ventania | Raro | 15 | 843 | Ouro |
| Pororoca | Raro | 18 | 851 | Ouro |
| Fogaréu | Lendário | 22 | 1008 | Diamante |
| Jequitibá | Lendário | 25 | 991 | Diamante |
| Boitatá | Mítico | 30 | 1163 | Lenda |
| Iara | Mítico | 28 | 1145 | Lenda |

### Outros números (corridas do teste 1: iniciais lv1, mapas aleatórios)

| Métrica | Valor |
|---|---|
| Garra disparou | 52,0% dos corredores |
| "Cansou" (estamina zerou antes dos últimos 2%) | 0,5% dos corredores |
| Trocas de liderança narradas por corrida | 1,17 |
| Viradas de clima por corrida | 1,42 |
| Skills ativadas por corrida | 1,66 (a simulação não expõe as tentativas; só as ativações) |

### Resultado das metas

| # | Meta | Valor | Faixa | OK |
|---|---|---|---|---|
| 1 | Brasa lv1 | 32,8% | 28–39% | ✅ |
| 1 | Brasa lv25 | 33,5% | 28–39% | ✅ |
| 1 | Maré lv1 | 34,1% | 28–39% | ✅ |
| 1 | Maré lv25 | 30,5% | 28–39% | ✅ |
| 1 | Ipê lv1 | 33,1% | 28–39% | ✅ |
| 1 | Ipê lv25 | 36,0% | 28–39% | ✅ |
| 2 | Brasa no seu clima | 52,5% | 45–65% | ✅ |
| 2 | Maré no seu clima | 63,2% | 45–65% | ✅ |
| 2 | Ipê no seu clima | 58,3% | 45–65% | ✅ |
| 3 | De curva (MAN 90) × de reta (VEL 90) | 71,8% | 55–75% | ✅ |
| 3b | De reta (VEL 90) × de curva (MAN 90) em reta pura | 100,0% | 70–100% | ✅ |
| 3c | De subida (FOR 90) × de reta (VEL 90) | 68,3% | 55–75% | ✅ |
| 4a | Mítico lv1 vence Comum lv1 | 100,0% | 90–100% | ✅ |
| 4b | Comum lv25 vence Raro lv1 | 25,9% | 25–60% | ✅ |
| 5 | Duração curta (≤1200 m), iniciais | 68,3 s | 55–70 s | ✅ |
| 5 | Duração curta (≤1200 m), PVP 8 | 69,1 s | 55–70 s | ✅ |
| 5 | Duração longa (≥2200 m), iniciais | 149,2 s | 140–170 s | ✅ |
| 5 | Duração longa (≥2200 m), PVP 8 | 150,6 s | 140–170 s | ✅ |
| 6 | Pagamentos: soma(prêmios)+taxa == pote, inteiros, prêmios não crescentes, pódio ≥ entrada (4..8 corredores × 50/100/250; não crescentes também com entrada 1/3/7) | sim | — | ✅ |
| 7 | Sorte 100 contra sete de Sorte 0 vence o dado | 20,6% | 18–28% | ✅ |
| 8 | Viradas de clima por corrida (PVP 8) | 1,33 | 0,8–1,6 | ✅ |
| 9 | Determinismo: mesma seed+config => mesmo mapa, mesmos dados, mesmo resultado (25 configs com itens e mapas aleatórios, reexecução em ordem inversa) | sim | — | ✅ |
| 9 | Seeds diferentes => corridas diferentes | sim | — | ✅ |
| 10 | Skill Comum: observada 38,1% × calculada 40,0% (diferença) | 1,9 p.p. | 0–3 p.p. | ✅ |
| 10 | Skill Mágico: observada 50,5% × calculada 50,0% (diferença) | 0,5 p.p. | 0–3 p.p. | ✅ |
| 10 | Skill Raro: observada 58,3% × calculada 60,0% (diferença) | 1,7 p.p. | 0–3 p.p. | ✅ |
| 10 | Skill Lendário: observada 68,0% × calculada 70,0% (diferença) | 2,0 p.p. | 0–3 p.p. | ✅ |
| 10 | Skill Mítico: observada 79,3% × calculada 80,0% (diferença) | 0,7 p.p. | 0–3 p.p. | ✅ |

**Todas as 28 metas passaram.**

## 12. Para revisar

- **4b colado no piso:** Comum lv25 vence Raro lv1 em **25,9%**, para um piso de 25%. Pangaré lv25 contra os iniciais fica em 7–13%. O Comum para no teto 60 e, sem ruído por corrida, perde quase sempre. Qualquer ajuste que ajude os Raros pode derrubar essa meta.
- **Meta 3 perto do teto:** o especialista de curva vence o de reta em **71,8%**, a 3 p.p. do teto de 75%. O de subida fica em 68,3%.
- **"Cansou" quase não acontece:** **0,5%** dos corredores, porque o jóquei raciona bem (e prevê a subida). Para ter mais drama, dá para aumentar o erro de leitura do jóquei.
- **Garra dispara em 52%** dos corredores; é comum demais para ser um momento especial? Talvez reduzir a chance base ou mostrar só quando muda posição.
- **Skills: 1,66 ativações por corrida** de 3 corredores (cada um tem uma skill a 60%). A simulação não expõe as tentativas, só as ativações.
- **Pergunta de design — zebra:** sem ruído por corrida, campos desiguais são previsíveis (Mítico lv1 × Comum lv1 = 100%; especialista de reta em reta pura = 100%). O Dado da Sorte mexe no clima, não no resultado direto. Decidir se queremos zebra; se sim, a proposta é um ruído pequeno por corrida (±3–5%), e não a volta da Disposição do dia de ±10%.

## 13. Cruzamento

Números reais de `prototype/src/breed.js` (modelo no cabeçalho do arquivo; spec em `docs/superpowers/specs/2026-11-06-cruzamento-design.md`). Para regenerar, rode `Breed.rentalPrice(h)`, `Breed.odds(égua, garanhão)` e `Breed.foal({ f, m, seedBase: 20261106, breedCounter, nextUid: 2 })` num `node -e` com `data.js` e `breed.js`.

### Preço de aluguel (reprodutores selvagens; Míticos não se alugam)

Base da raridade × multiplicador do grau (×1 / ×1,25 / ×1,5), arredondado.

| Reprodutor | Raridade | Grau | Sexo | Preço (Ouro) |
|---|---|---|---|---|
| Pangaré | Comum | ★ | M | 100 |
| Faísca | Comum | ★★ | F | 125 |
| Lambari | Comum | ★ | M | 100 |
| Capim | Comum | ★★ | F | 125 |
| Tição | Mágico | ★★ | M | 313 |
| Garoa | Mágico | ★★ | F | 313 |
| Mandacaru | Mágico | ★★ | M | 313 |
| Ventania | Raro | ★★★ | F | 900 |
| Pororoca | Raro | ★★ | M | 750 |
| Fogaréu | Lendário | ★★★ | F | 2250 |
| Jequitibá | Lendário | ★★★ | M | 2250 |
| Boitatá, Iara | Mítico | ★★★ | F, M | não se alugam |

Dois cavalos seus: 50 Ouro (registro). Troca: 50 Ouro.

### Chances por par (`Breed.odds`)

| Par (égua × garanhão) | L | Raridade do potro | Grau do potro (★ / ★★ / ★★★) |
|---|---|---|---|
| Maré lv30 ★★ × Brasa lv30 ★★ (Raro × Raro) | 1,000 | Mágico 30% · Raro 65% · Lendário 5% | 10% / 50% / 40% |
| Faísca lv1 ★★ × Pangaré lv1 ★ (Comum × Comum) | 0,033 | Comum 98,9% · Mágico 1,1% | 24,5% / 54,8% / 20,7% |
| Ventania lv30 ★★★ × Jequitibá lv30 ★★★ (Raro × Lendário) | 1,000 | Mágico 20% · Raro 50% · Lendário 30% | 0% / 10% / 90% |

O grau só vale se a raridade não mudou; se subiu, o potro nasce ★, se desceu, ★★★.

### Três potros de exemplo

`seedBase` 20261106, `nextUid` 2, `breedCounter` 0, 1 e 2. Os mesmos pais, seed e contador sempre dão o mesmo potro.

| # | Pais | Nome | Raridade | Elemento | Sexo | VEL | ACE | MAN | FOR | EST | GAR | SOR | Potencial (mesma ordem) | Skills |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Maré × Brasa | Quimera | Mágico ★★★ | Água | M | 53 | 59 | 57 | 60 | 59 | 52 | 57 | 21 / 16 / 18 / 18 / 20 / 16 / 16 | Pé na Chuva |
| 1 | Faísca × Pangaré | Quimera | Comum ★★ | Neutro | F | 47 | 42 | 43 | 44 | 46 | 46 | 44 | 10 / 12 / 15 / 10 / 20 / 27 / 10 | Arranque |
| 2 | Ventania × Jequitibá | Estrela | Lendário ★ | Grama | M | 65 | 62 | 61 | 60 | 62 | 64 | 61 | 28 / 25 / 17 / 27 / 21 / 19 / 16 | Sprint, Arrancada Final |

O potro 2 nasceu Lendário (30%) e por isso ★ (a raridade subiu em relação ao Raro). Os status são sorteados na janela do grau, não herdados: o potro 2 (Lendário ★: 60–68) tem status 60–65. O potro 0 saiu Mágico ★★★ (janela 52–60) porque a raridade caiu (30% de chance de descer, par Raro × Raro lv30). Todos nascem lv1 com 2 (M) ou 1 (F) cruzamentos.

## 14. Equipamentos

Regras em `docs/GDD.md` §7. Aqui os números do protótipo.

### Preços

| Item | Preço | Venda de volta (25%) |
|---|---|---|
| Peça Comum | 100 | 25 |
| Peça Mágica | 250 | 63 |
| Peça Rara | 600 | 150 |
| Peça Lendária (não está à venda) | 1.500 (referência) | 375 |
| Pedra Negra ×1 | 40 | — |
| Pedra Negra ×5 | 200 | — |

### Custo esperado da melhoria (cadeia completa, com as quedas)

| Meta | Pedras (média) | Ouro (pedra a 40) |
|---|---|---|
| +5 | 6 | 258 |
| +7 | 16 | 658 |
| +8 | 37 | 1.481 |
| +10 | 264 | 10.548 |

### Equipamento dos bots por liga

| Liga | Equipamento do bot |
|---|---|
| Bronze | nada |
| Prata | 2 Comuns +0 (ferraduras, sela) |
| Ouro | 5 Comuns +2 |
| Platina | 5 Mágicas +3 (soltas) |
| Diamante | 3 Raras +4 do conjunto + 2 Mágicas +3 |
| Lenda | 5 Raras +7 do conjunto |

### Metas de equipamento (`balance.js`)

Duelos de dois corredores iguais, mapas aleatórios, 400 corridas por meta; só muda o equipamento.

| Meta | Confronto | Faixa | Completo | `--quick` |
|---|---|---|---|---|
| E1 | Inicial lv1 com 5 Comuns +0 × sem nada (nublado) | 60–75% | 69,2% | 72,7% |
| E2a | Comum lv30 com conjunto Raro +10 × Mágico lv30 sem nada (nublado) | 60–85% | 75,3% | 76,0% |
| E2b | Comum lv30 com conjunto Raro +10 × Raro lv30 sem nada (nublado) | 10–40% | 13,2% | 13,9% |
| E3 | 4 Raras do Sol × 4 Raras misturadas, Brasa lv10, com Sol | 75–90% | 86,0% | 84,0% |
| E3b | 4 Raras do Sol × 4 Raras misturadas, Brasa lv10, Sol inicial com Dado ligado | 55–80% (provisória) | 82,8% ❌ | 85,0% ❌ |
| E4 | Brasa lv10 com 5 Raras da Chuva × misturadas, na chuva | 60–75% | 73,5% | 70,0% |

No nível 30 a distância Comum→Raro já é de cerca de 20 pontos por status (limite 60 contra 80) mais duas skills; por isso o conjunto +10 fecha **um degrau** (Mágico, E2a) e não dois (Raro, E2b). O E3 é alto porque o "dobra o clima" de 4 peças é idêntico à skill de dobrar o clima: num duelo de clima fixo entre cavalos iguais vale cerca de 86%; no jogo o Dado vira o clima ~1,2 vez por corrida. O E3b mede a vantagem do bônus de 4 peças dentro do jogo, com o Dado ligado podendo virar o clima (faixa provisória; como os dois corredores são Fogo, o Dado sempre cai no Sol e o E3b fica perto do E3).

### Exemplo de `Gear.resolve`: Brasa lv1 com 5 Lendárias do Sol +0

Ferraduras, sela, estribos, testeira e armadura do Sol (Lendário, +0): principal +6 e secundário +4 em cada peça, mais +5 de Sorte pelas 3 peças.

| Resultado | Valor |
|---|---|
| Mods | VEL +6 · ACE +10 · MAN +6 · FOR +6 · EST +10 · GAR +8 · SOR +9 |
| Conjunto | Sol, 5 peças |
| Especial | +5 p.p. de chance de skill · dobra o clima do Sol · ignora a penalidade de clima |
| Status da Brasa lv1 (sem → com) | VEL 66 → 72 · ACE 72 → 82 · MAN 62 → 68 · FOR 53 → 59 · EST 59 → 69 · GAR 64 → 72 · SOR 51 → 60 |
| Rating de Poder | 728 → 837 (+109, dos quais +20 pelo conjunto de 5 peças) |

