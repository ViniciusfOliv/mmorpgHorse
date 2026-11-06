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

O teto vale por status antes de elemento/item. Sem ruído por corrida, a raridade quase sempre decide: Mítico lv1 vence Comum lv1 em 100% dos duelos, e Comum lv25 vence Raro lv1 em 25,9% (relatório, §11 teste 4). Os iniciais batem o teto 80 entre o lv13 e o lv40, conforme o status e o potencial.

| Raridade | Teto por status | Crescimento/level | Vagas de skill | Nasce com até | Chance base de skill | Ex.: rating lv1 → lv50 |
|---|---|---|---|---|---|---|
| Comum | 60 | ×0,80 | 1 | 1 | 35% | Pangaré: 503 → 684 |
| Mágico | 70 | ×0,90 | 2 | 1 | 45% | Garoa: 608 → 836 |
| Raro | 80 | ×1,00 | 3 | 2 | 55% | Maré: 724 → 942 |
| Lendário | 90 | ×1,10 | 4 | 2 | 65% | Jequitibá: 740 → 1079 |
| Mítico | 100 | ×1,20 | 5 | 3 | 75% | Iara: 806 → 1202 |

Chance de skill = base da raridade + 0,5 p.p. por level acima do 1 + 0,1 p.p. por ponto de Sorte, teto 95%. Ao subir de level, 8% de chance de aprender uma skill nova compatível (neutra ou do elemento), se houver vaga.

## 5. Itens (1 por corrida)

| Item | Raridade | Preço | Efeito | Para quê |
|---|---|---|---|---|
| Ferradura Leve | Comum | 120 | +8 VEL, −5 FOR | Casco leve, passada solta. Perde firmeza no pesado. |
| Ferradura com Cravos | Comum | 120 | +10 FOR, −3 VEL | Agarra na areia e nas subidas, mas pesa na reta. |
| Sela de Couro Cru | Comum | 100 | +7 EST | Confortável e sem segredo. |
| Manta de Lã | Mágico | 220 | +9 EST, −4 ACE | Poupa o fôlego, mas deixa a largada preguiçosa. |
| Antolhos | Mágico | 220 | +12 GAR, −3 ACE, +8% chance de Garra | Foco total na reta final; demora a pegar embalo. |
| Rapadura de Engenho | Mágico | 180 | −2 VEL, tanque ×1,04 | Energia pura: tanque de estamina +4%, mas fica pesado (−2 Vel). |
| Esporas de Prata | Raro | 400 | +10 ACE, −6 EST | Arranque brutal, fôlego curto. |
| Capa Impermeável | Raro | 380 | +2 EST, anula a penalidade de clima | Anula a penalidade de clima do elemento (ex.: Fogo na chuva). |
| Figa da Sorte | Lendário | 700 | +5 GAR, +15% chance de Garra | Garra +5 e +15% de chance de a Garra disparar. |
| Penas de Gavião-Real | Mítico | 1500 | +14 VEL, +6 GAR, −6 EST | Voa baixo na reta, mas cansa antes. |

O efeito dos itens na taxa de vitória ainda não foi medido no v2 (o relatório roda sem itens; só o teste de determinismo e a corrida de exemplo usam itens).

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

Rating = 2,2·VEL + 1,8·ACE + 1,6·MAN + 1,8·EST + 1,6·FOR + 1,6·GAR + 0,8·SOR (status efetivos, com item) + 20 × peso do gatilho por habilidade (largada/reta/final/dado 1; curva 0,8; estamina baixa 0,8; subida 0,6; clima 0,4) + especial do item. Dentro da liga, o pareamento usaria o MMR do jogador.

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

| Raia | Jogador | Cavalo | Elem. | Rar. | Sexo | Lv | Item | VEL/ACE/MAN/FOR/EST/GAR/SOR | Rating | Skills % |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Você | Ipê | Grama | Raro | M | 6 | Ferradura com Cravos | 65/59/55/89/70/58/59 | 766 | Raízes Firmes (63%) |
| 2 | ZéDaBaia | Brasa | Fogo | Raro | M | 6 | Esporas de Prata | 71/87/66/57/57/68/55 | 785 | Labareda (63%) |
| 3 | Rapadura_Turbo | Maré | Água | Raro | F | 6 | Manta de Lã | 72/59/59/62/90/65/52 | 782 | Maré Alta (63%) |
| 4 | Galopeira99 | Garoa | Água | Mágico | F | 10 | — | 56/53/51/56/75/58/52 | 683 | Pé na Chuva, Segundo Ar (55%) |
| 5 | Uai_Sô | Tição | Fogo | Mágico | M | 8 | Ferradura Leve | 69/72/58/47/47/59/51 | 689 | Chama Final (54%) |
| 6 | Bah_Tchê | Mandacaru | Grama | Mágico | M | 7 | Sela de Couro Cru | 51/53/48/73/65/51/50 | 652 | Casco Firme (53%) |
| 7 | Oxente_Racing | Ventania | Neutro | Raro | F | 4 | — | 67/62/61/56/60/61/54 | 735 | Sprint, Arrancada Final (62%) |
| 8 | Cuscuz_Nitro | Pororoca | Água | Raro | M | 3 | — | 58/56/53/60/76/59/53 | 711 | Nascente, Pé na Chuva (61%) |

| Pos | Jogador | Cavalo | Tempo | Prêmio |
|---|---|---|---|---|
| 1º | Rapadura_Turbo | Maré | 113,24 s | 432 Ouro |
| 2º | Você | Ipê | 113,77 s | 180 Ouro |
| 3º | Cuscuz_Nitro | Pororoca | 118,20 s | 108 Ouro |
| 4º | Oxente_Racing | Ventania | 119,36 s | — |
| 5º | ZéDaBaia | Brasa | 120,24 s | — |
| 6º | Bah_Tchê | Mandacaru | 120,26 s | — |
| 7º | Galopeira99 | Garoa | 121,94 s | — |
| 8º | Uai_Sô | Tição | 123,93 s | — |

Pote 800 · taxa 80 · duração 123,93 s · 1241 frames

```
[31,6s] (ultrapassagem) Maré passou Brasa e assumiu a liderança!
[42,2s] (dado) 🎲 Pororoca tirou 98 — começa a chover!
[42,2s] (clima) O clima virou: Chuva!
[42,2s] (skill) Pororoca ativou Pé na Chuva!
[53,2s] (ultrapassagem) Ipê passou Maré e assumiu a liderança!
[58,9s] (skill) Mandacaru ativou Casco Firme!
[80,2s] (dado) 🎲 Pororoca tirou 99 — o clima segura!
[95,0s] (garra) Ipê mostrou GARRA na reta final!
[95,3s] (skill) Maré ativou Maré Alta!
[95,8s] (garra) Maré mostrou GARRA na reta final!
[97,2s] (skill) Pororoca ativou Nascente!
[100,6s] (garra) Mandacaru mostrou GARRA na reta final!
[101,0s] (skill) Ventania ativou Arrancada Final!
[101,0s] (garra) Ventania mostrou GARRA na reta final!
[101,2s] (garra) Brasa mostrou GARRA na reta final!
[102,1s] (skill) Tição ativou Chama Final!
[102,4s] (ultrapassagem) Maré passou Ipê e assumiu a liderança!
[103,1s] (skill) Garoa ativou Segundo Ar!
[113,2s] (chegada) Maré cruzou a linha em 1º lugar! (113,24s)
[113,8s] (chegada) Ipê cruzou a linha em 2º lugar! (113,77s)
[118,2s] (chegada) Pororoca cruzou a linha em 3º lugar! (118,20s)
[119,4s] (chegada) Ventania cruzou a linha em 4º lugar! (119,36s)
[120,2s] (chegada) Brasa cruzou a linha em 5º lugar! (120,24s)
[120,3s] (chegada) Mandacaru cruzou a linha em 6º lugar! (120,26s)
[121,9s] (chegada) Garoa cruzou a linha em 7º lugar! (121,94s)
[123,9s] (chegada) Tição cruzou a linha em 8º lugar! (123,93s)
```

O que aconteceu: o mapa tinha 1 070 m de subida seguida (430–1500 m), bom para o Ipê do jogador (FOR 89 com a Ferradura com Cravos). A corrida largou no sol, mas no primeiro Dado da Sorte (1/3 da pista) o Pororoca tirou 98 e virou o clima para **chuva**: Água passou a ×1,03 e Fogo a ×0,97, e o Pororoca ativou Pé na Chuva (×1,10). O Ipê assumiu a ponta na subida aos 53 s; no segundo Dado o Pororoca tirou 99 e a chuva segurou. Na reta final a Maré ativou Maré Alta, mostrou Garra e passou o Ipê aos 102 s, vencendo por **0,53 s**. Os dois Fogos (Brasa e Tição), penalizados pela chuva desde os 42 s, chegaram em 5º e 8º; a Labareda do Brasa não disparou na largada (chance de 63%).

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

### Ligas (Rating de Poder sem item)

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
