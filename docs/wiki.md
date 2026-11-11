# Wiki do Galope Elemental

> Gerado de `prototype/src/` por `prototype/tools/wiki.mjs` (dados `0.2-prototipo`). Não edite à mão: rode `node prototype/build.mjs`. Versão com retratos e busca: `prototype/dist/wiki.html`.

## Seções

- [Visão geral](#visao)
- [Status](#status)
- [Level e XP](#level)
- [Raridades](#raridades)
- [Elementos e clima](#elementos)
- [Skills](#skills)
- [Dado da Sorte](#dado)
- [Pista e simulação](#pista)
- [Montarias](#montarias)
- [Cruzamento (Haras)](#cruzamento)
- [Equipamento](#equipamento)
- [Economia](#economia)
- [Modo DEV](#dev)

<a id="visao"></a>

## Visão geral

**Galope Elemental** é um jogo de corrida de cavalos automática em pixel art. Você não controla o cavalo durante a corrida: decide antes (montaria, equipamento e entrada) e assiste. Os cavalos têm elemento (Fogo, Água e Grama), raridade, level e skills.

### Ciclo de uma corrida

1. **Escolher a montaria.** No começo você escolhe uma das 3 iniciais (Brasa, Maré e Ipê) e recebe 500 de Ouro e o equipamento inicial (Sela de Couro Cru e Ferradura Leve, já equipado).
2. **Procurar sala.** Na aba Correr você escolhe a entrada (50, 100 ou 250 de Ouro). A sala tem de 4 a 8 corredores: você e bots com Poder perto do seu. Pista, clima e rivais saem da seed da sala e não mudam até você correr.
3. **Pagar a entrada.** Só depois de "Largar!" a corrida é simulada; o resultado nunca é calculado antes.
4. **Corrida automática.** O jóquei dosa o ritmo pela estamina; skills disparam nos gatilhos; o Dado da Sorte rola em 1/3 e 2/3 da pista e pode virar o clima; a Garra decide a reta final.
5. **Prêmio e XP.** A casa fica com 10% do pote e o resto vai para os primeiros colocados. Todos ganham XP pela colocação, e o pódio pode dar uma Pedra Negra.

### Abas do jogo

- **Estábulo:** suas montarias (3 vagas no começo, até 8), status, skills e equipamento; escolher a ativa.
- **Correr:** escolher a entrada (50, 100 ou 250 de Ouro) e procurar corrida; sem Ouro para a menor entrada, treino gratuito.
- **Expedição:** vitrine de 6 cavalos selvagens. Expedições e captura ainda não existem no protótipo.
- **Haras:** cruzar com um reprodutor de aluguel ou com outra montaria sua, ou fazer a Troca.
- **Loja:** comprar peças de equipamento (menos as de raridade Lendário) e Pedras Negras.

> Ainda não existem no protótipo: Gemas, passe, ovos, contas, servidor, expedições e captura. A única moeda é o Ouro; as Pedras Negras são material de melhoria.

Versão dos dados: `0.2-prototipo`. Este wiki é gerado do código (`prototype/src/`) por `prototype/tools/wiki.mjs`; não edite à mão.

<a id="status"></a>

## Status

Cada montaria tem 7 status na escala de 1 a 100. Na corrida o motor usa n(x) = status / 100. Depois de elemento e equipamento o valor é arredondado e preso entre 1 e 120.

| Sigla | Status | Descrição no jogo | Na corrida |
| ---: | --- | --- | --- |
| VEL | Velocidade | Velocidade máxima. | Velocidade máxima: vMax = 17,805 + 1,2 × n(VEL) m/s (VEL 50 → 18,41 m/s; VEL 100 → 19,01 m/s). Ritmo, piso, bloco e boosts multiplicam esse teto. |
| ACE | Aceleração | Rapidez até a velocidade máxima (largada e retomadas). | Aceleração = 0,6 + 2,4 × n(ACE) m/s², na largada e nas retomadas (saída de curva e de subida). Também encurta a reação à largada: atraso sorteado de até 0,6 s × (1 − 0,5 × n(ACE)). |
| MAN | Manobra | Agilidade nas curvas e na saída delas. | Fator da curva = min(1, 0,826 + 0,14 × n(MAN)): de 83% a 97% da velocidade dentro da curva. |
| FOR | Força | Subidas, terreno pesado e disputa no pelotão. | Fator da subida = min(1, 0,86 + 0,13 × n(FOR)). Alivia o piso pesado (50% × n(FOR) da perda), o aperto do pelotão (80% × n(FOR)) e o gasto extra da subida (+30% × (1 − 0,5 × n(FOR))). |
| EST | Estamina | Quanto tempo mantém o ritmo. | Tanque = 66 + 20 × n(EST) (EST 50 → 76). O clima não mexe no tanque. |
| GAR | Garra | Chance e força da arrancada final (últimos 20%). | Ao cruzar 80% da pista: chance = min(95%, 10% + 70% × n(GAR)). Se sair, o teto de velocidade vai a ×1,02 + 0,16 × n(GAR) até a chegada. |
| SOR | Sorte | Chance de rolar um 2º dado no Dado da Sorte e bônus para ativar skills. | No Dado da Sorte, SOR% é a chance de rolar um 2º dado e ficar com o melhor. Na chance de skill soma 0,1 p.p. por ponto (SOR 50 → +5 p.p.). |

### Como o status é calculado

```text
natural = início da faixa da raridade + 16 × pot / 31 + (level − 1) × (0,3 + 0,08 × pot / 31)
status  = min(natural + pontos livres, teto da raridade) + equipamento
arredondado e preso entre 1 e 120
```

pot = potencial (genética, 0 a 31). Pontos livres = piso((level − 1) × 1 / 1,2 / 1,5 conforme as estrelas), no máximo 34% deles (arredondado para cima) num mesmo status. O teto da raridade vale antes do equipamento, então ele pode passar do teto.

O clima também mexe nos status durante a corrida: o multiplicador m do clima (ver Elementos e clima) entra em VEL, ACE, MAN, FOR e GAR (não em EST nem em SOR).

<a id="level"></a>

## Level e XP

Level máximo: **50**. Para subir do level L para L + 1 são 50 + 25 × L de XP. Do level 1 ao 50 são 33.075 de XP no total. No level máximo o XP ainda acumula até 1.300 (o valor de um level 50 → 51) e aí trava.

### XP por colocação e treino

| Colocação | XP (corrida valendo) | XP (treino) | Ouro do treino |
| --- | ---: | ---: | --- |
| 1º | 100 | 50 | 30 |
| 2º | 70 | 35 | 22 |
| 3º | 50 | 25 | 16 |
| 4º | 35 | 18 | 12 |
| 5º | 25 | 13 | 10 |
| 6º | 20 | 10 | 10 |
| 7º | 15 | 8 | 10 |
| 8º | 10 | 5 | 10 |

**Treino gratuito:** aparece quando seu Ouro não cobre a menor entrada (50). Não cobra entrada, rende 1/2 do XP e de 10 a 30 de Ouro pela colocação, e não dá Pedra Negra.

### XP necessário por level

| Level | XP | Acumulado |
| --- | ---: | ---: |
| Nv 1 → 2 | 75 | 75 |
| Nv 2 → 3 | 100 | 175 |
| Nv 3 → 4 | 125 | 300 |
| Nv 4 → 5 | 150 | 450 |
| Nv 5 → 6 | 175 | 625 |
| Nv 6 → 7 | 200 | 825 |
| Nv 7 → 8 | 225 | 1.050 |
| Nv 8 → 9 | 250 | 1.300 |
| Nv 9 → 10 | 275 | 1.575 |
| Nv 10 → 11 | 300 | 1.875 |
| Nv 11 → 12 | 325 | 2.200 |
| Nv 12 → 13 | 350 | 2.550 |
| Nv 13 → 14 | 375 | 2.925 |
| Nv 14 → 15 | 400 | 3.325 |
| Nv 15 → 16 | 425 | 3.750 |
| Nv 16 → 17 | 450 | 4.200 |
| Nv 17 → 18 | 475 | 4.675 |
| Nv 18 → 19 | 500 | 5.175 |
| Nv 19 → 20 | 525 | 5.700 |
| Nv 20 → 21 | 550 | 6.250 |
| Nv 21 → 22 | 575 | 6.825 |
| Nv 22 → 23 | 600 | 7.425 |
| Nv 23 → 24 | 625 | 8.050 |
| Nv 24 → 25 | 650 | 8.700 |
| Nv 25 → 26 | 675 | 9.375 |
| Nv 26 → 27 | 700 | 10.075 |
| Nv 27 → 28 | 725 | 10.800 |
| Nv 28 → 29 | 750 | 11.550 |
| Nv 29 → 30 | 775 | 12.325 |
| Nv 30 → 31 | 800 | 13.125 |
| Nv 31 → 32 | 825 | 13.950 |
| Nv 32 → 33 | 850 | 14.800 |
| Nv 33 → 34 | 875 | 15.675 |
| Nv 34 → 35 | 900 | 16.575 |
| Nv 35 → 36 | 925 | 17.500 |
| Nv 36 → 37 | 950 | 18.450 |
| Nv 37 → 38 | 975 | 19.425 |
| Nv 38 → 39 | 1.000 | 20.425 |
| Nv 39 → 40 | 1.025 | 21.450 |
| Nv 40 → 41 | 1.050 | 22.500 |
| Nv 41 → 42 | 1.075 | 23.575 |
| Nv 42 → 43 | 1.100 | 24.675 |
| Nv 43 → 44 | 1.125 | 25.800 |
| Nv 44 → 45 | 1.150 | 26.950 |
| Nv 45 → 46 | 1.175 | 28.125 |
| Nv 46 → 47 | 1.200 | 29.325 |
| Nv 47 → 48 | 1.225 | 30.550 |
| Nv 48 → 49 | 1.250 | 31.800 |
| Nv 49 → 50 | 1.275 | 33.075 |

### Crescimento por level

A cada level, cada status ganha sozinho 0,3 + 0,08 × pot / 31, até o teto da raridade (igual em todas as raridades).

| Raridade | Ganho/level (pot 0) | Ganho/level (pot 31) | Ganho do Nv 1 ao 50, sem o teto (pot 31) | Teto |
| --- | ---: | ---: | ---: | ---: |
| Comum | 0,3 | 0,38 | 18,6 | 80 |
| Mágico | 0,3 | 0,38 | 18,6 | 85 |
| Raro | 0,3 | 0,38 | 18,6 | 90 |
| Lendário | 0,3 | 0,38 | 18,6 | 95 |
| Mítico | 0,3 | 0,38 | 18,6 | 100 |

O ganho real para no teto: status = min(natural + pontos, teto). Exemplo: Brasa (Comum), Velocidade com pot 24, chega sozinha a 70,1 no Nv 50; com 20 pontos chegaria a 90,1, mas fica em 80 (teto 80).

### Aprender skill ao subir de level

A cada level ganho há 8% de chance de aprender uma skill nova (sorteio pela seed do save). Só entra se houver vaga (vagas da raridade) e a skill sorteada é uma das que a montaria pode ter: geral ou do próprio elemento, nunca repetida.

### Exemplo: as iniciais por level (sem equipamento)

| Montaria | Level | VEL | ACE | MAN | FOR | EST | GAR | SOR | Poder |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Brasa | 1 | 52 | 52 | 47 | 46 | 46 | 47 | 46 | 715 |
| Brasa | 10 | 56 | 56 | 50 | 49 | 49 | 50 | 49 | 764 |
| Brasa | 25 | 61 | 61 | 55 | 54 | 54 | 55 | 54 | 840 |
| Brasa | 50 | 70 | 70 | 64 | 62 | 62 | 64 | 62 | 969 |
| Maré | 1 | 47 | 46 | 46 | 47 | 52 | 52 | 46 | 714 |
| Maré | 10 | 50 | 49 | 49 | 50 | 56 | 56 | 49 | 763 |
| Maré | 25 | 55 | 54 | 54 | 55 | 61 | 61 | 54 | 838 |
| Maré | 50 | 64 | 62 | 62 | 64 | 70 | 70 | 62 | 970 |
| Ipê | 1 | 48 | 46 | 52 | 52 | 47 | 46 | 45 | 722 |
| Ipê | 10 | 51 | 49 | 56 | 56 | 50 | 49 | 48 | 772 |
| Ipê | 25 | 56 | 54 | 61 | 61 | 55 | 54 | 53 | 847 |
| Ipê | 50 | 65 | 62 | 70 | 70 | 64 | 62 | 61 | 979 |

<a id="raridades"></a>

## Raridades

São 5 raridades, da mais comum à mais rara: Comum, Mágico, Raro, Lendário e Mítico. A raridade define a faixa onde o status nasce, o teto de status, as vagas de skill e a chance de ativar skills.

| Raridade | Cor | Teto de status | Vagas de skill | Skills do potro (mínimo) | Chance base de skill | Preço da peça | Aluguel base | Montarias no jogo |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- | ---: |
| Comum | #9e9e9e | 80 | 1 | 1 | 35% | 100 | 100 | 6 |
| Mágico | #4caf50 | 85 | 2 | 1 | 45% | 250 | 250 | 3 |
| Raro | #2196f3 | 90 | 3 | 2 | 55% | 600 | 600 | 2 |
| Lendário | #ff9800 | 95 | 4 | 2 | 65% | 1.500 | 1.500 | 2 |
| Mítico | #9c27b0 | 100 | 5 | 3 | 75% | não existe | não se aluga | 2 |

Raridade mais alta que nasce de cruzamento: **Lendário**. Mítico nunca nasce de cruzamento e não se aluga.

### Grau (estrelas)

Cada montaria tem um grau de ★ a ★★★: a qualidade do cruzamento. Ele muda os pontos livres do treino e o preço do aluguel. As iniciais e os selvagens têm o grau definido nos dados.

| Grau | Multiplicador do aluguel |
| ---: | ---: |
| ★ | ×1 |
| ★★ | ×1,25 |
| ★★★ | ×1,5 |

### Corcel

Uma montaria é **Corcel** quando já tem todas as skills "de linha" da sua raridade. Corcel garante herança de skill no cruzamento (ver Cruzamento).

| Raridade | Skills de linha |
| --- | --- |
| Comum | Arranque |
| Mágico | Arranque, Sprint |
| Raro | Arranque, Sprint, Drift |
| Lendário | Arranque, Sprint, Drift, Saída Rápida |
| Mítico | Arranque, Sprint, Drift, Saída Rápida, Arrancada Final |

<a id="elementos"></a>

## Elementos e clima

Cada elemento tem um clima "dono", que o favorece. Cada clima também penaliza um elemento.

| Elemento | Clima dono | Penalizado por | Descrição |
| --- | --- | --- | --- |
| Fogo | Sol | Chuva | Explosivo na largada. Brilha no sol; sofre com chuva. |
| Água | Chuva | Névoa | Fôlego de sobra. Cresce na chuva; sofre na névoa. |
| Grama | Névoa | Sol | Firme como raiz. Domina a névoa e as subidas; murcha no sol. |

### Climas

| Clima | Favorece | Penaliza | Efeito geral | Descrição |
| --- | --- | --- | --- | --- |
| Sol | Fogo | Grama | gasto de estamina ×1,04 para todos | Favorece Fogo; Grama murcha. |
| Chuva | Água | Fogo | velocidade −1,5% para todos | Favorece Água; Fogo apaga. |
| Névoa | Grama | Água | nenhum efeito geral | Favorece Grama; Água perde o rumo. |
| Nublado | — | — | nenhum efeito geral | Condição neutra: ninguém é favorecido. |

### Multiplicador de clima (m)

Elemento dono do clima: ×1,03; com a skill de clima ativa, ×1,08; com 4 peças do conjunto daquele clima (sem a skill), ×1,07. Elemento penalizado: ×0,97 (o equipamento de 5 peças anula). O resto, e todos no Nublado, ×1.

| Elemento | Sol | Chuva | Névoa | Nublado |
| --- | ---: | ---: | ---: | ---: |
| Fogo | ×1,03 | ×0,97 | ×1,00 | ×1,00 |
| Água | ×1,00 | ×1,03 | ×0,97 | ×1,00 |
| Grama | ×0,97 | ×1,00 | ×1,03 | ×1,00 |

```text
vMax       = (17,81 + 1,2 × n(VEL) × m) × (1 + 0,1 × (m − 1))
aceleração = 0,6 + 2,4 × n(ACE) × m
Força, Manobra e Garra efetivas = n(x) × m
```

O clima inicial sai da seed da sala. O Dado da Sorte pode virar o clima no meio da corrida (ver Dado da Sorte); quando vira, os números de todos são recalculados (o que já foi gasto não volta).

### Vento (só visual)

Cada sala tem um vento sorteado pela seed: calmo 35%, brisa 40% e ventania 25%, soprando para a direita ou para a esquerda. Ele só mexe no desenho (bandeirinhas, folhas, nuvens, inclinação da chuva); não entra na simulação.

<a id="skills"></a>

## Skills

São 15 skills. Cada uma tem um gatilho; quando ele acontece, a montaria faz **uma** tentativa contra a chance de skill (uma por corrida, ou uma por bloco nas skills de curva e subida marcadas "em cada bloco"). Se acertar, o efeito vale pelo tempo ou pela distância indicados.

**Skills de largada** disparam no sinal (t = 0), antes do atraso de reação do cavalo (até 0,6 s, menor com ACE alta). A duração conta desde o sinal, então esse atraso consome parte dela.

```text
chance de skill = min(95%, chance base da raridade + 0,5 p.p. × (level − 1) + 0,1 p.p. × SOR + bônus de equipamento)
```

**Chance de ativar: sem equipamento (SOR 50) / com 3+ peças de um conjunto (SOR 50 + 5 do conjunto = 55, e +5 p.p. de chance)**

| Raridade | Nv 1 | Nv 25 | Nv 50 |
| --- | ---: | ---: | ---: |
| Comum | 40% / 45,5% | 52% / 57,5% | 64,5% / 70% |
| Mágico | 50% / 55,5% | 62% / 67,5% | 74,5% / 80% |
| Raro | 60% / 65,5% | 72% / 77,5% | 84,5% / 90% |
| Lendário | 70% / 75,5% | 82% / 87,5% | 94,5% / 95% |
| Mítico | 80% / 85,5% | 92% / 95% | 95% / 95% |

**Quem pode ter:** as skills gerais servem para qualquer elemento; as de elemento, só para aquele elemento. O número de skills é limitado pelas vagas da raridade.

**Pontos no Poder:** cada skill soma 20 × o peso do gatilho no Poder (gatilhos que nem sempre acontecem valem menos). **Balão:** o texto que aparece na pista quando a skill ativa.

### Gerais (8)

| Skill | Gatilho | Efeito | Descrição no jogo | Quem pode ter | Começa em | Pontos no Poder | Balão |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| **Arranque** | Largada | aceleração ×1,2 (+20%), por 100 m | Largada explosiva: +20% de aceleração nos primeiros 100 m. | qualquer elemento | Faísca, Fogaréu | 20 | ARRANQUE |
| **Sprint** | Entra numa reta de 150 m ou mais (a reta da largada não conta) | velocidade ×1,06 (+6%); gasto de estamina ×1 (+0%), por 150 m | Numa reta de 150 m ou mais (fora a da largada): +6% de velocidade por 150 m. | qualquer elemento | Ventania | 20 | SPRINT |
| **Drift** | Entra numa curva | fator da curva +3% (somado, teto 1), em cada bloco, até o fim dele | Em cada curva: +3% de rendimento na curva. | qualquer elemento | Boitatá | 16 | DRIFT |
| **Saída Rápida** | Sai de uma curva | aceleração ×1,4 (+40%); velocidade ×1,06 (+6%), por 6 s | Ao sair da curva: +40% de aceleração e +6% de velocidade por 6s. | qualquer elemento | — | 16 | SAÍDA RÁPIDA |
| **Fôlego de Montanha** | Entra numa subida | gasto extra da subida ×0,2 (−80%), em cada bloco, até o fim dele | Em cada subida: gasta 80% menos estamina extra da subida. | qualquer elemento | Jequitibá | 12 | FÔLEGO MONT. |
| **Segundo Ar** | Estamina cai a 30% ou menos | recupera 15% do tanque na hora; velocidade ×1,05 (+5%), por 8 s | Quando a estamina cai a 30%, recupera 15% e ganha +5% de velocidade por 8s. | qualquer elemento | Capim, Garoa, Jequitibá | 16 | SEGUNDO AR |
| **Arrancada Final** | Cruza 80% da pista (reta final) | chance de Garra +15 p.p.; impulso da Garra +3 p.p. | Na reta final: +15% de chance de Garra e +3% de força na arrancada. | qualquer elemento | Ventania | 20 | ARR. FINAL |
| **Dado Viciado** | Antes do 1º Dado da Sorte (uma tentativa por corrida; se ativar, vale para todos os Dados) | +1 dado no Dado da Sorte (até o fim da corrida) | Uma tentativa por corrida, antes do 1º Dado da Sorte: se ativar, rola 1 dado extra em todos os Dados da corrida. | qualquer elemento | — | 4 | DADO VICIADO |

### Fogo (2)

| Skill | Gatilho | Efeito | Descrição no jogo | Quem pode ter | Começa em | Pontos no Poder | Balão |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| **Sol a Pino** | Clima Sol valendo (checado a cada instante; vale também se o Dado virar o clima) | bônus do clima do próprio elemento ×1,03 → ×1,08 (até o fim da corrida) | Com sol: o bônus do clima para o Fogo sobe de +3% para +8%. | só Fogo | Fogaréu, Boitatá | 16 | SOL A PINO |
| **Chama Final** | Cruza 80% da pista (reta final) | velocidade ×1,05 (+5%), por 8 s | Na reta final, +5% de velocidade por 8s. | só Fogo | Tição, Fogaréu, Boitatá | 20 | CHAMA FINAL |

### Água (3)

| Skill | Gatilho | Efeito | Descrição no jogo | Quem pode ter | Começa em | Pontos no Poder | Balão |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| **Pé na Chuva** | Clima Chuva valendo (checado a cada instante; vale também se o Dado virar o clima) | bônus do clima do próprio elemento ×1,03 → ×1,08 (até o fim da corrida) | Com chuva: o bônus do clima para a Água sobe de +3% para +8%. | só Água | Garoa, Pororoca, Iara | 16 | PÉ NA CHUVA |
| **Canto da Iara** | Cruza 80% da pista (reta final) | velocidade ×1,06 (+6%); gasto de estamina ×0,7 (−30%), por 7 s | Na reta final, +6% de velocidade por 7s e gasta 30% menos estamina. | só Água | Iara | 20 | CANTO IARA |
| **Nascente** | Entra numa reta de 150 m ou mais (a reta da largada não conta) | recupera 12% do tanque na hora | Numa reta de 150 m ou mais (fora a da largada), recupera 12% de estamina. | só Água | Pororoca, Iara | 20 | NASCENTE |

### Grama (2)

| Skill | Gatilho | Efeito | Descrição no jogo | Quem pode ter | Começa em | Pontos no Poder | Balão |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| **Névoa Amiga** | Clima Névoa valendo (checado a cada instante; vale também se o Dado virar o clima) | bônus do clima do próprio elemento ×1,03 → ×1,08 (até o fim da corrida) | Com névoa: o bônus do clima para a Grama sobe de +3% para +8%. | só Grama | — | 16 | NÉVOA AMIGA |
| **Casco Firme** | Entra numa subida | fator da subida +2% (somado, teto 1), em cada bloco, até o fim dele | Em cada subida: +2% de rendimento na subida. | só Grama | Mandacaru, Jequitibá | 12 | CASCO FIRME |

<a id="dado"></a>

## Dado da Sorte

Quando o líder cruza 1/3 e 2/3 da distância, **todos** rolam o Dado da Sorte (até quem já chegou). Ele usa um fluxo de números próprio da seed, então é determinístico.

1. Cada montaria rola um dado de 1 a 100.
2. Com chance igual à sua Sorte (SOR%), rola um 2º dado e fica com o melhor.
3. Dado Viciado tenta ativar uma vez por corrida, antes do 1º Dado. Se ativar, soma um dado extra nos 2 Dados (no máximo 3 dados); se falhar, não tenta de novo.
4. O maior dado vence. Empate no topo: só os empatados rolam de novo.
5. O clima vira o do elemento do vencedor. Se já for esse clima, o clima "segura".

| Elemento do vencedor | Clima depois do Dado |
| --- | --- |
| Fogo | Sol |
| Água | Chuva |
| Grama | Névoa |

**Chance de rolar o 2º dado**

| SOR | Chance do 2º dado |
| ---: | ---: |
| 0 | 0% |
| 25 | 25% |
| 50 | 50% |
| 75 | 75% |
| 100 | 100% |

<a id="pista"></a>

## Pista e simulação

A pista de cada sala sai da seed: distância de 1.400 a 2.000 m (de 50 em 50 m), de 5 a 9 blocos de tamanhos variados (fronteiras de 10 em 10 m), piso e clima inicial. O primeiro e o último bloco são sempre reta; os do meio são sorteados entre reta, curva e subida.

**Frequência em 20.000 seeds**

| Item | Valores |
| --- | --- |
| Blocos do meio | Reta 19% · Curva 41% · Subida 41% |
| Piso | Grama 33% · Terra 34% · Areia 33% |
| Clima inicial | Sol 25% · Chuva 25% · Névoa 25% · Nublado 25% |

### Blocos

| Bloco | Fator de velocidade | Gasto de estamina | Observação |
| --- | --- | --- | --- |
| Reta | 1 (sem perda) | normal | Reta de 150 m ou mais (fora a da largada) dispara skills de reta. |
| Curva | min(1, 0,83 + 0,14 × n(MAN) + bônus de skill) — 83% a 97% | normal | Ao sair, a velocidade volta pela Aceleração. |
| Subida | min(1, 0,86 + 0,13 × n(FOR) + bônus de skill) — 86% a 99% | ×(1 + 0,3 × (1 − 0,5 × n(FOR))), e o esforço não cai com a velocidade menor | Ao sair, a velocidade volta pela Aceleração. |

### Pisos

| Piso | Perda de velocidade | Gasto de estamina | Descrição |
| --- | ---: | ---: | --- |
| Grama | 0% | ×1 | Pista leve. |
| Terra | −3% | ×1,05 | Pista média: Força ajuda. |
| Areia | −6% | ×1,12 | Pista pesada: Força ajuda muito. |

A perda de velocidade do piso é aliviada pela Força: perda × (1 − 0,5 × n(FOR)).

Nomes de hipódromo sorteados para a sala (só o nome): Prado do Cerrado, Hipódromo da Lagoa, Raia do Engenho, Prado Beira-Rio, Hipódromo do Planalto, Raia da Ventania, Prado das Palmeiras e Hipódromo do Sertão Velho.

### Como a corrida é simulada

A simulação anda em passos fixos de 0,1 s, só com a seed e os status (sem ruído escondido). Mesma seed e mesma configuração dão o mesmo resultado.

#### Velocidade-alvo

```text
alvo = ritmo × vMax × piso × pelotão × chuva × fator do bloco × boosts × variação (±0,3%)
sobe com a aceleração; desce a 1,2 m/s²
```

#### Ritmo do jóquei

O jóquei calcula o ritmo constante que o tanque restante aguenta até a chegada e guarda 3% de reserva. Ele lê o tanque com um erro sorteado de −2% a +6% (às vezes é otimista demais e cansa no fim). Ritmo: até 97% da vMax até 72% da pista, depois até 103% (sprint final); nunca abaixo de 80% por vontade própria. A estimativa já conta as subidas que faltam.

#### Estamina

```text
gasto por segundo = (v / (vMax × boosts × fator da subida))^4 × (1.600 / D)^(2/5) × mods / tanque
tanque = 66 + 20 × n(EST)
mods: piso, sol ×1,04, subida, vácuo −10%, skills
```

Boosts (Garra e skills) sobem o teto sem custo extra de estamina. Pistas longas apertam mais o tanque no total.

#### Vácuo e pelotão

**Vácuo:** quem corre de 0,5 a 4 m atrás de alguém gasta 10% menos estamina. **Pelotão:** com vizinhos a até 2,5 m, a velocidade cai até 3% (teto com 3 vizinhos); a Força alivia 80% × n(FOR) disso.

#### Garra

Ao cruzar 80% da pista, cada montaria sorteia a Garra uma vez: chance = min(95%, 10% + 70% × n(GAR) × m + bônus de skill). Se sair, o teto de velocidade fica ×1,02 + 0,16 × n(GAR) × m (+ bônus de skill) até a chegada.

#### Cansaço

Estamina zerada: o ritmo cai para 75% até o fim. Se ainda faltar mais de 2% da pista, aparece o aviso "cansou".

#### Largada e eventos

Cada montaria reage à largada com um atraso sorteado de até 0,6 s (menor com ACE alta). Troca de liderança só vira evento depois de 12% da pista, confirmada por 1,5 s e com pelo menos 4 s entre avisos. Depois da chegada o cavalo freia a 8 m/s². A corrida tem teto de 900 s.

#### Traçado (desenho)

O mapa da pista é desenhado dos blocos: retas e subidas em linha reta, e cada sequência de curvas coladas vira uma curva só, que gira 90° a cada 150 m (entre 45° e 180°). É só desenho: a simulação usa os blocos.

<a id="montarias"></a>

## Montarias

Há 3 montarias iniciais e 12 selvagens. Todas são da espécie cavalo. As selvagens aparecem como bots nas corridas, como reprodutores de aluguel no Haras (menos as de raridade Mítico) e 6 delas na vitrine da Expedição. As iniciais também aparecem como bots quando não são suas. Como o level dos bots é escolhido: ver Economia, Rivais da sala.

**Potencial** (0 a 31 por status) é **oculto no jogo**; aparece aqui para referência. Os status "no level" são sem equipamento e sem pontos livres distribuídos.

### Iniciais (3)

#### Brasa — A fagulha veloz

Fogo · Comum · ★★ · ♂ macho · Nv 1 · Poder 715 (Bronze) · 2 cruza(s)

Potro alazão de crina dourada. Larga como um rojão.

Skills: nenhuma · Onde aparece: montaria inicial, bot nas corridas (quando não é a sua)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nv 1 | 52 | 52 | 47 | 46 | 46 | 47 | 46 |
| Potencial (oculto no jogo) | 24 | 24 | 14 | 12 | 12 | 14 | 12 |
| No Nv 1 | 52 | 52 | 47 | 46 | 46 | 47 | 46 |

#### Maré — O fôlego do oceano

Água · Comum · ★★ · ♀ fêmea · Nv 1 · Poder 714 (Bronze) · 1 cruza(s)

Égua tordilha de crina cor do mar. Quanto mais longa a pista, mais perigosa.

Skills: nenhuma · Onde aparece: montaria inicial, bot nas corridas (quando não é a sua)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nv 1 | 47 | 46 | 46 | 47 | 52 | 52 | 46 |
| Potencial (oculto no jogo) | 14 | 12 | 12 | 14 | 24 | 24 | 12 |
| No Nv 1 | 47 | 46 | 46 | 47 | 52 | 52 | 46 |

#### Ipê — A raiz que não verga

Grama · Comum · ★★ · ♂ macho · Nv 1 · Poder 722 (Bronze) · 2 cruza(s)

Castanho robusto de crina amarela como ipê florido. Não teme subida.

Skills: nenhuma · Onde aparece: montaria inicial, bot nas corridas (quando não é a sua)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nv 1 | 48 | 46 | 52 | 52 | 47 | 46 | 45 |
| Potencial (oculto no jogo) | 16 | 12 | 24 | 24 | 14 | 12 | 10 |
| No Nv 1 | 48 | 46 | 52 | 52 | 47 | 46 | 45 |

### Selvagens (12)

#### Faísca

Fogo · Comum · ★★ · ♀ fêmea · Nv 3 · Poder 716 (Bronze) · 1 cruza(s)

Habitat: Cerrado seco.

Skills: Arranque · Onde aparece: bot nas corridas, aluguel no Haras (125 de Ouro)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nv 1 | 47 | 48 | 48 | 45 | 44 | 46 | 45 |
| Potencial (oculto no jogo) | 14 | 16 | 15 | 10 | 8 | 12 | 10 |
| No Nv 3 | 48 | 49 | 48 | 46 | 45 | 47 | 46 |

#### Lambari

Água · Comum · ★ · ♂ macho · Nv 2 · Poder 693 (Bronze) · 2 cruza(s)

Habitat: Beira de rio.

Skills: nenhuma · Onde aparece: bot nas corridas, aluguel no Haras (100 de Ouro)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nv 1 | 45 | 46 | 45 | 46 | 49 | 47 | 45 |
| Potencial (oculto no jogo) | 9 | 11 | 10 | 12 | 17 | 13 | 10 |
| No Nv 2 | 45 | 46 | 45 | 47 | 49 | 47 | 45 |

#### Capim

Grama · Comum · ★★ · ♀ fêmea · Nv 4 · Poder 721 (Bronze) · 1 cruza(s)

Habitat: Campos gerais.

Skills: Segundo Ar · Onde aparece: bot nas corridas, aluguel no Haras (125 de Ouro)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nv 1 | 45 | 45 | 45 | 49 | 47 | 46 | 45 |
| Potencial (oculto no jogo) | 10 | 10 | 10 | 18 | 13 | 12 | 10 |
| No Nv 4 | 46 | 46 | 46 | 50 | 48 | 47 | 46 |

#### Tição

Fogo · Mágico · ★★ · ♂ macho · Nv 8 · Poder 832 (Prata) · 2 cruza(s)

Habitat: Carvoaria abandonada.

Skills: Chama Final · Onde aparece: bot nas corridas, aluguel no Haras (313 de Ouro)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nv 1 | 54 | 55 | 54 | 51 | 50 | 53 | 51 |
| Potencial (oculto no jogo) | 17 | 19 | 18 | 12 | 10 | 15 | 12 |
| No Nv 8 | 56 | 57 | 57 | 54 | 52 | 55 | 54 |

#### Garoa

Água · Mágico · ★★ · ♀ fêmea · Nv 10 · Poder 853 (Prata) · 1 cruza(s)

Habitat: Serra enevoada.

Skills: Pé na Chuva, Segundo Ar · Onde aparece: bot nas corridas, aluguel no Haras (313 de Ouro)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nv 1 | 52 | 51 | 52 | 52 | 55 | 53 | 51 |
| Potencial (oculto no jogo) | 13 | 12 | 13 | 14 | 20 | 15 | 12 |
| No Nv 10 | 55 | 54 | 55 | 55 | 58 | 56 | 54 |

#### Mandacaru

Grama · Mágico · ★★ · ♂ macho · Nv 7 · Poder 825 (Prata) · 2 cruza(s)

Habitat: Caatinga.

Skills: Casco Firme · Onde aparece: bot nas corridas, aluguel no Haras (313 de Ouro), vitrine da Expedição

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nv 1 | 51 | 52 | 52 | 56 | 53 | 52 | 51 |
| Potencial (oculto no jogo) | 12 | 13 | 13 | 21 | 16 | 13 | 12 |
| No Nv 7 | 53 | 54 | 54 | 58 | 55 | 54 | 53 |

#### Ventania

Grama · Raro · ★★★ · ♀ fêmea · Nv 15 · Poder 975 (Ouro) · 1 cruza(s)

Habitat: Pampa gaúcho.

Skills: Sprint, Arrancada Final · Onde aparece: bot nas corridas, aluguel no Haras (900 de Ouro), vitrine da Expedição

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nv 1 | 61 | 59 | 60 | 57 | 58 | 59 | 57 |
| Potencial (oculto no jogo) | 21 | 18 | 20 | 13 | 15 | 17 | 14 |
| No Nv 15 | 66 | 64 | 65 | 61 | 62 | 64 | 62 |

#### Pororoca

Água · Raro · ★★ · ♂ macho · Nv 18 · Poder 995 (Ouro) · 2 cruza(s)

Habitat: Foz do Amazonas.

Skills: Nascente, Pé na Chuva · Onde aparece: bot nas corridas, aluguel no Haras (750 de Ouro)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nv 1 | 58 | 57 | 58 | 59 | 62 | 58 | 57 |
| Potencial (oculto no jogo) | 15 | 14 | 15 | 17 | 24 | 16 | 14 |
| No Nv 18 | 64 | 63 | 64 | 65 | 69 | 64 | 63 |

#### Fogaréu

Fogo · Lendário · ★★★ · ♀ fêmea · Nv 22 · Poder 1.125 (Diamante) · 1 cruza(s)

Habitat: Chapada em chamas.

Skills: Sol a Pino, Chama Final, Arranque · Onde aparece: bot nas corridas, aluguel no Haras (2.250 de Ouro), vitrine da Expedição

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nv 1 | 67 | 68 | 68 | 63 | 63 | 65 | 63 |
| Potencial (oculto no jogo) | 24 | 26 | 25 | 16 | 15 | 20 | 16 |
| No Nv 22 | 75 | 76 | 76 | 70 | 70 | 73 | 70 |

#### Jequitibá

Grama · Lendário · ★★★ · ♂ macho · Nv 25 · Poder 1.127 (Diamante) · 2 cruza(s)

Habitat: Mata Atlântica.

Skills: Casco Firme, Fôlego de Montanha, Segundo Ar · Onde aparece: bot nas corridas, aluguel no Haras (2.250 de Ouro)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nv 1 | 64 | 63 | 64 | 69 | 66 | 65 | 63 |
| Potencial (oculto no jogo) | 17 | 16 | 17 | 27 | 21 | 19 | 16 |
| No Nv 25 | 72 | 71 | 72 | 78 | 74 | 73 | 71 |

#### Boitatá

Fogo · Mítico · ★★★ · ♀ fêmea · Nv 30 · Poder 1.273 (Lenda) · 1 cruza(s)

Habitat: Só aparece em noites de queimada. A cobra de fogo do folclore, em forma de cavalo.

Skills: Sol a Pino, Chama Final, Drift · Onde aparece: bot nas corridas, vitrine da Expedição

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nv 1 | 74 | 75 | 75 | 71 | 70 | 73 | 69 |
| Potencial (oculto no jogo) | 28 | 29 | 29 | 21 | 20 | 26 | 18 |
| No Nv 30 | 85 | 86 | 86 | 81 | 81 | 84 | 79 |

#### Iara

Água · Mítico · ★★★ · ♂ macho · Nv 28 · Poder 1.255 (Lenda) · 2 cruza(s)

Habitat: Rios encantados. A mãe-d'água que encanta quem a ouve.

Skills: Canto da Iara, Pé na Chuva, Nascente · Onde aparece: bot nas corridas, vitrine da Expedição

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nv 1 | 71 | 71 | 71 | 70 | 75 | 73 | 69 |
| Potencial (oculto no jogo) | 22 | 21 | 22 | 20 | 30 | 25 | 18 |
| No Nv 28 | 81 | 80 | 81 | 80 | 86 | 83 | 79 |

<a id="cruzamento"></a>

## Cruzamento (Haras)

No Haras uma égua (♀) e um garanhão (♂) geram um potro. O sorteio é determinístico (seed do save e contador de cruzas). O potro nasce na hora, no level 1 (ainda não existe gestação no protótipo).

### Regras e custos

- **Cruzar com aluguel:** com um selvagem de sexo oposto; custa o aluguel dele (tabela abaixo). Mítico não se aluga.
- **Cruzar duas suas:** registro de 50 de Ouro; as duas precisam ter cruzas restantes e cada uma gasta 1.
- **Troca:** duas montarias suas de sexos opostos, com qualquer número de cruzas, viram um potro por 50 de Ouro. Os dois pais deixam o estábulo.
- **Cruzas restantes ao nascer:** macho 2, fêmea 1. Cada cruza gasta 1 da sua montaria.
- **Estábulo:** cruzar exige vaga livre (o potro ocupa uma). Vagas: 3 no começo, até 8, a 300 de Ouro cada.
- Não dá para cruzar com um páreo aberto (sala paga ou não).

**Preço do aluguel (base × grau)**

| Raridade | ★ | ★★ | ★★★ |
| --- | --- | --- | --- |
| Comum | 100 | 125 | 150 |
| Mágico | 250 | 313 | 375 |
| Raro | 600 | 750 | 900 |
| Lendário | 1.500 | 1.875 | 2.250 |

**Reprodutores de aluguel**

| Montaria | Sexo | Elemento | Raridade | Grau | Level | Aluguel |
| --- | --- | --- | --- | ---: | ---: | --- |
| Faísca | ♀ fêmea | Fogo | Comum | ★★ | 3 | 125 |
| Lambari | ♂ macho | Água | Comum | ★ | 2 | 100 |
| Capim | ♀ fêmea | Grama | Comum | ★★ | 4 | 125 |
| Tição | ♂ macho | Fogo | Mágico | ★★ | 8 | 313 |
| Garoa | ♀ fêmea | Água | Mágico | ★★ | 10 | 313 |
| Mandacaru | ♂ macho | Grama | Mágico | ★★ | 7 | 313 |
| Ventania | ♀ fêmea | Grama | Raro | ★★★ | 15 | 900 |
| Pororoca | ♂ macho | Água | Raro | ★★ | 18 | 750 |
| Fogaréu | ♀ fêmea | Fogo | Lendário | ★★★ | 22 | 2.250 |
| Jequitibá | ♂ macho | Grama | Lendário | ★★★ | 25 | 2.250 |

### Fator de nível (L)

```text
L = clamp((0,6 × level da égua + 0,4 × level do garanhão) / 30, 0, 1)
```

L vai de 0 (pior) a 1 (melhor). As chances são interpoladas em linha reta entre a coluna "L = 0" e a "L = 1". Dois pais no level 1 dão L = 0,033.

### Raridade do potro

A base é a **menor** raridade entre os pais. O potro pode nascer 1 abaixo, igual, 1 acima ou 2 acima; pais da mesma raridade usam a linha "igual", pais diferentes a linha "misturada". O resultado nunca passa de Lendário (o que passaria soma no limite).

| Linha | L | 1 abaixo | Igual | 1 acima | 2 acima |
| --- | --- | ---: | ---: | ---: | ---: |
| Mesma raridade | L = 0 | 45% | 54% | 1% | 0% |
| Mesma raridade | L = 1 | 30% | 65% | 4,5% | 0,5% |
| Raridades diferentes | L = 0 | 35% | 50% | 15% | 0% |
| Raridades diferentes | L = 1 | 20% | 50% | 29% | 1% |

**Raridade do potro com L = 0 (piso)**

| Pais | Comum | Mágico | Raro | Lendário | Mítico |
| --- | ---: | ---: | ---: | ---: | ---: |
| Comum × Comum | 99% | 1% | — | — | — |
| Comum × Mágico | 85% | 15% | — | — | — |
| Comum × Raro | 85% | 15% | — | — | — |
| Comum × Lendário | 85% | 15% | — | — | — |
| Mágico × Mágico | 45% | 54% | 1% | — | — |
| Mágico × Raro | 35% | 50% | 15% | — | — |
| Mágico × Lendário | 35% | 50% | 15% | — | — |
| Raro × Raro | — | 45% | 54% | 1% | — |
| Raro × Lendário | — | 35% | 50% | 15% | — |
| Lendário × Lendário | — | — | 45% | 55% | — |

**Raridade do potro com L = 1 (nível efetivo 30 ou mais)**

| Pais | Comum | Mágico | Raro | Lendário | Mítico |
| --- | ---: | ---: | ---: | ---: | ---: |
| Comum × Comum | 95% | 4,5% | 0,5% | — | — |
| Comum × Mágico | 70% | 29% | 1% | — | — |
| Comum × Raro | 70% | 29% | 1% | — | — |
| Comum × Lendário | 70% | 29% | 1% | — | — |
| Mágico × Mágico | 30% | 65% | 4,5% | 0,5% | — |
| Mágico × Raro | 20% | 50% | 29% | 1% | — |
| Mágico × Lendário | 20% | 50% | 29% | 1% | — |
| Raro × Raro | — | 30% | 65% | 5% | — |
| Raro × Lendário | — | 20% | 50% | 30% | — |
| Lendário × Lendário | — | — | 30% | 70% | — |

### Grau do potro

Grau base = arredondar(0,6 × grau da égua + 0,4 × grau do garanhão). Se a raridade **subiu**, o potro nasce ★; se **desceu**, nasce ★★★. Se manteve, sorteia desce/mantém/sobe (fora de 1–3 soma em "mantém").

| Grau base | L | ★ | ★★ | ★★★ |
| ---: | --- | ---: | ---: | ---: |
| ★ | L = 0 | 80% | 20% | — |
| ★ | L = 1 | 60% | 40% | — |
| ★★ | L = 0 | 25% | 55% | 20% |
| ★★ | L = 1 | 10% | 50% | 40% |
| ★★★ | L = 0 | — | 25% | 75% |
| ★★★ | L = 1 | — | 10% | 90% |

### Elemento, sexo, status e potencial

- **Elemento:** se os pais têm o mesmo, o potro herda; senão, 50% de chance de cada um.
- **Sexo:** 50% fêmea, 50% macho.
- **Potencial:** para cada status, 50% de chance de herdar o de um dos pais (50% para cada); senão sai de 0 a 31.
- **Nome:** sorteado entre 32: Tufão, Canela, Baio, Pitanga, Jaguar, Serena, Relâmpago, Mimosa, Trovão, Lua, Corisco, Pérola, Faísca II, Aroeira, Bugre, Catira, Dourado, Estrela, Furacão, Guará, Jurema, Malhado, Nuvem, Onça, Pampa, Quimera, Rio, Saci, Tempestade, Umbu, Vaqueiro e Xodó.
- **Cores:** mistura das cores dos pais.

### Skills do potro

1. Candidatas: as skills dos pais que servem para o elemento do potro (exclusivas nunca passam).
2. Corcel: com 1 pai Corcel, 1 skill garantida (50% de chance de 2); com os 2 pais Corcel, 2 garantidas.
3. Cada candidata restante passa com 35% de chance.
4. Corte nas vagas da raridade do potro.
5. Se ficou abaixo das skills ao nascer da raridade, completa com skills sorteadas que servem para o elemento.

<a id="equipamento"></a>

## Equipamento

Cada montaria tem 5 slots. Cada peça soma um status principal (o valor da raridade + a melhoria) e um secundário, definidos pelo slot. Peças Comum e Mágico são soltas; Raro e Lendário pertencem a um conjunto (Sol, Chuva e Névoa).

| Slot | Status principal | Status secundário |
| --- | --- | --- |
| Ferraduras | Velocidade | Aceleração |
| Sela | Estamina | Garra |
| Estribos | Manobra | Sorte |
| Testeira | Aceleração | Garra |
| Armadura | Força | Estamina |

| Raridade | Principal | Secundário | Preço | Venda | Na loja |
| --- | ---: | ---: | --- | --- | --- |
| Comum | +2 | +0 | 100 | 25 | sim |
| Mágico | +2 | +1 | 250 | 63 | sim |
| Raro | +3 | +2 | 600 | 150 | sim |
| Lendário | +4 | +3 | 1.500 | 375 | **nunca à venda** |

Venda devolve 25% do preço. Peças Lendário nunca estão à venda. Equipamento inicial: Sela de Couro Cru e Ferradura Leve.

### Catálogo completo

| Peça | Slot | Raridade | Conjunto | Principal | Secundário | Preço | Loja |
| --- | --- | --- | --- | ---: | ---: | --- | --- |
| **Ferradura Leve** | Ferraduras | Comum | — | +2 VEL | — | 100 | sim |
| **Ferradura com Cravos** | Ferraduras | Mágico | — | +2 VEL | +1 ACE | 250 | sim |
| **Ferraduras do Sol** | Ferraduras | Raro | Sol | +3 VEL | +2 ACE | 600 | sim |
| **Ferraduras do Sol** | Ferraduras | Lendário | Sol | +4 VEL | +3 ACE | 1.500 | não |
| **Ferraduras da Chuva** | Ferraduras | Raro | Chuva | +3 VEL | +2 ACE | 600 | sim |
| **Ferraduras da Chuva** | Ferraduras | Lendário | Chuva | +4 VEL | +3 ACE | 1.500 | não |
| **Ferraduras da Névoa** | Ferraduras | Raro | Névoa | +3 VEL | +2 ACE | 600 | sim |
| **Ferraduras da Névoa** | Ferraduras | Lendário | Névoa | +4 VEL | +3 ACE | 1.500 | não |
| **Sela de Couro Cru** | Sela | Comum | — | +2 EST | — | 100 | sim |
| **Sela Acolchoada** | Sela | Mágico | — | +2 EST | +1 GAR | 250 | sim |
| **Sela do Sol** | Sela | Raro | Sol | +3 EST | +2 GAR | 600 | sim |
| **Sela do Sol** | Sela | Lendário | Sol | +4 EST | +3 GAR | 1.500 | não |
| **Sela da Chuva** | Sela | Raro | Chuva | +3 EST | +2 GAR | 600 | sim |
| **Sela da Chuva** | Sela | Lendário | Chuva | +4 EST | +3 GAR | 1.500 | não |
| **Sela da Névoa** | Sela | Raro | Névoa | +3 EST | +2 GAR | 600 | sim |
| **Sela da Névoa** | Sela | Lendário | Névoa | +4 EST | +3 GAR | 1.500 | não |
| **Estribos de Corda** | Estribos | Comum | — | +2 MAN | — | 100 | sim |
| **Esporas de Prata** | Estribos | Mágico | — | +2 MAN | +1 SOR | 250 | sim |
| **Estribos do Sol** | Estribos | Raro | Sol | +3 MAN | +2 SOR | 600 | sim |
| **Estribos do Sol** | Estribos | Lendário | Sol | +4 MAN | +3 SOR | 1.500 | não |
| **Estribos da Chuva** | Estribos | Raro | Chuva | +3 MAN | +2 SOR | 600 | sim |
| **Estribos da Chuva** | Estribos | Lendário | Chuva | +4 MAN | +3 SOR | 1.500 | não |
| **Estribos da Névoa** | Estribos | Raro | Névoa | +3 MAN | +2 SOR | 600 | sim |
| **Estribos da Névoa** | Estribos | Lendário | Névoa | +4 MAN | +3 SOR | 1.500 | não |
| **Antolhos** | Testeira | Comum | — | +2 ACE | — | 100 | sim |
| **Testeira de Couro** | Testeira | Mágico | — | +2 ACE | +1 GAR | 250 | sim |
| **Testeira do Sol** | Testeira | Raro | Sol | +3 ACE | +2 GAR | 600 | sim |
| **Testeira do Sol** | Testeira | Lendário | Sol | +4 ACE | +3 GAR | 1.500 | não |
| **Testeira da Chuva** | Testeira | Raro | Chuva | +3 ACE | +2 GAR | 600 | sim |
| **Testeira da Chuva** | Testeira | Lendário | Chuva | +4 ACE | +3 GAR | 1.500 | não |
| **Testeira da Névoa** | Testeira | Raro | Névoa | +3 ACE | +2 GAR | 600 | sim |
| **Testeira da Névoa** | Testeira | Lendário | Névoa | +4 ACE | +3 GAR | 1.500 | não |
| **Manta de Lã** | Armadura | Comum | — | +2 FOR | — | 100 | sim |
| **Capa Impermeável** | Armadura | Mágico | — | +2 FOR | +1 EST | 250 | sim |
| **Armadura do Sol** | Armadura | Raro | Sol | +3 FOR | +2 EST | 600 | sim |
| **Armadura do Sol** | Armadura | Lendário | Sol | +4 FOR | +3 EST | 1.500 | não |
| **Armadura da Chuva** | Armadura | Raro | Chuva | +3 FOR | +2 EST | 600 | sim |
| **Armadura da Chuva** | Armadura | Lendário | Chuva | +4 FOR | +3 EST | 1.500 | não |
| **Armadura da Névoa** | Armadura | Raro | Névoa | +3 FOR | +2 EST | 600 | sim |
| **Armadura da Névoa** | Armadura | Lendário | Névoa | +4 FOR | +3 EST | 1.500 | não |

### Melhoria (+1 a +10)

Cada tentativa gasta Pedras Negras e tem uma chance de sucesso (sorteio pela seed do save). A partir de +6, a falha **derruba** a peça 1 nível. Cada + soma 0,5 no status principal (uma peça +10 soma +5). Pedra Negra: 40 de Ouro na loja (pacote de 5 = 200).

| Passo | Chance | Custo (pedras) | Se falhar | Pedras esperadas no passo | Pedras esperadas desde +0 |
| --- | ---: | ---: | --- | ---: | ---: |
| +0 → +1 | 100% | 1 | fica em +0 | 1 | 1 |
| +1 → +2 | 90% | 1 | fica em +1 | 1,1 | 2,1 |
| +2 → +3 | 80% | 1 | fica em +2 | 1,3 | 3,4 |
| +3 → +4 | 70% | 1 | fica em +3 | 1,4 | 4,8 |
| +4 → +5 | 60% | 1 | fica em +4 | 1,7 | 6,5 |
| +5 → +6 | 50% | 1 | fica em +5 | 2 | 8,5 |
| +6 → +7 | 40% | 2 | cai para +5 | 8 | 16,5 |
| +7 → +8 | 35% | 2 | cai para +6 | 20,6 | 37 |
| +8 → +9 | 30% | 2 | cai para +7 | 54,7 | 91,7 |
| +9 → +10 | 25% | 2 | cai para +8 | 172 | 263,7 |

**Pedra Negra do pódio:** só em corrida valendo (entrada paga), sorteada pela seed da sala: 1º lugar 60%, 2º lugar 40%, 3º lugar 25%.

### Conjuntos

| Conjunto | Clima | Elemento favorecido | Peças |
| --- | --- | --- | --- |
| Sol | Sol | Fogo | Ferraduras do Sol (Raro), Ferraduras do Sol (Lendário), Sela do Sol (Raro), Sela do Sol (Lendário), Estribos do Sol (Raro), Estribos do Sol (Lendário), Testeira do Sol (Raro), Testeira do Sol (Lendário), Armadura do Sol (Raro), Armadura do Sol (Lendário) |
| Chuva | Chuva | Água | Ferraduras da Chuva (Raro), Ferraduras da Chuva (Lendário), Sela da Chuva (Raro), Sela da Chuva (Lendário), Estribos da Chuva (Raro), Estribos da Chuva (Lendário), Testeira da Chuva (Raro), Testeira da Chuva (Lendário), Armadura da Chuva (Raro), Armadura da Chuva (Lendário) |
| Névoa | Névoa | Grama | Ferraduras da Névoa (Raro), Ferraduras da Névoa (Lendário), Sela da Névoa (Raro), Sela da Névoa (Lendário), Estribos da Névoa (Raro), Estribos da Névoa (Lendário), Testeira da Névoa (Raro), Testeira da Névoa (Lendário), Armadura da Névoa (Raro), Armadura da Névoa (Lendário) |

**Bônus total por número de peças do mesmo conjunto (cada linha já é o total)**

| Peças | Bônus |
| ---: | --- |
| 3 | +5 Sorte; chance de ativar skills +5 p.p.; +3 de Poder |
| 4 | +5 Sorte; chance de ativar skills +5 p.p.; no clima do conjunto, o bônus do elemento dono sobe de ×1,03 para ×1,07 (não soma com a skill de clima, que dá ×1,08); +15 de Poder |
| 5 | +5 Sorte; chance de ativar skills +5 p.p.; no clima do conjunto, o bônus do elemento dono sobe de ×1,03 para ×1,07 (não soma com a skill de clima, que dá ×1,08); anula a penalidade de clima (×0,97 vira ×1); +20 de Poder |

Cada linha é o total daquele patamar, não soma com as de cima: +5 Sorte e +5 p.p. de chance valem uma vez a partir de 3 peças, e os pontos de Poder são 3 com 3, 15 com 4, 20 com 5 (não 3 + 15).

Vale o conjunto com mais peças equipadas (empate: Sol, Chuva e Névoa, nessa ordem). O reforço de ×1,07 só age se o elemento da montaria for o dono do clima do conjunto.

### Equipamento dos bots por liga

| Liga do alvo | Peças do bot |
| --- | --- |
| Bronze | nada |
| Prata | Ferradura Leve +0, Sela de Couro Cru +0 |
| Ouro | Ferradura Leve +2, Sela de Couro Cru +2, Estribos de Corda +2, Antolhos +2, Manta de Lã +2 |
| Platina | Ferradura com Cravos +3, Sela Acolchoada +3, Esporas de Prata +3, Testeira de Couro +3, Capa Impermeável +3 |
| Diamante | Ferraduras do Sol +4, Sela do Sol +4, Estribos do Sol +4, Testeira de Couro +3, Capa Impermeável +3 |
| Lenda | Ferraduras do Sol +7, Sela do Sol +7, Estribos do Sol +7, Testeira do Sol +7, Armadura do Sol +7 |

O conjunto dos bots é o do clima do elemento deles (nos exemplos acima, Fogo).

<a id="economia"></a>

## Economia

Moeda única hoje: **Ouro**. Começa com 500. Ganha-se Ouro correndo (prêmios e treino) e vendendo peças; gasta-se em entradas, peças, Pedras Negras, aluguel e registro de cruza, Troca e vagas do estábulo.

### Entradas e prêmios

Entradas: 50, 100 ou 250 de Ouro. Todos pagam a mesma entrada; a casa fica com 10% do pote (arredondado) e o resto é dividido conforme o tamanho do campo. Quem leva prêmio nunca sai no prejuízo.

| Corredores | Divisão | Exemplo com entrada 100: pote / casa / prêmios |
| ---: | --- | --- |
| 4 | 1º 70% · 2º 30% | 400 / 40 / 252 + 108 |
| 5 | 1º 70% · 2º 30% | 500 / 50 / 315 + 135 |
| 6 | 1º 50% · 2º 30% · 3º 20% | 600 / 60 / 270 + 162 + 108 |
| 7 | 1º 50% · 2º 30% · 3º 20% | 700 / 70 / 315 + 189 + 126 |
| 8 | 1º 60% · 2º 25% · 3º 15% | 800 / 80 / 432 + 180 + 108 |

Treino (quando o Ouro não cobre 50): sem entrada, 1º 30, 2º 22, 3º 16, 4º 12, 5º 10, 6º 10, 7º 10 e 8º 10 de Ouro.

### Outros preços

- **Vaga extra no estábulo:** 300 de Ouro (de 3 até 8 vagas)
- **Pedra Negra:** 40 de Ouro (pacote de 5: 200)
- **Peças:** Comum 100 · Mágico 250 · Raro 600; venda a 25%
- **Cruza:** aluguel 100 a 2.250; registro 50; Troca 50

### Poder e ligas

O **Poder** resume a montaria com o equipamento: soma ponderada dos status efetivos + skills + pontos de conjunto. Ele define a liga e os rivais da sala.

```text
Poder = 3,1·VEL + 1,4·ACE + 1,45·MAN + 3,3·FOR + 2,4·EST + 1,3·GAR + 0,2·SOR
      + 18 × peso do gatilho, por skill
      + 80 × força da skill de tipo
      + 3 (3 peças) / 15 (4 peças) / 20 (5 peças) de conjunto
```

**Peso do gatilho no Poder**

| Gatilho | Peso | Pontos por skill |
| --- | ---: | ---: |
| Largada | 1 | 18 |
| Entra numa reta de 150 m ou mais (a reta da largada não conta) | 1 | 18 |
| Entra numa curva | 0,8 | 14,4 |
| Sai de uma curva | 0,8 | 14,4 |
| Entra numa subida | 0,6 | 10,8 |
| Estamina cai a 30% ou menos | 0,8 | 14,4 |
| Cruza 80% da pista (reta final) | 1 | 18 |
| Antes do 1º Dado da Sorte (uma tentativa por corrida; se ativar, vale para todos os Dados) | 0,2 | 3,6 |
| Clima (qualquer) | 0,8 | 14,4 |

| Liga | Poder | Cor |
| --- | ---: | --- |
| Bronze | 0–809 | #b0703c |
| Prata | 810–909 | #b8c2cc |
| Ouro | 910–1.009 | #f2c230 |
| Platina | 1.010–1.109 | #5fd3c8 |
| Diamante | 1.110–1.219 | #7ab8ff |
| Lenda | 1.220 ou mais | #ff7a3d |

**Rivais da sala:** cada bot mira um Poder entre −8,5% e +11,5% do seu (leve viés para cima), com o equipamento da liga desse alvo. Para cada modelo (selvagens e iniciais), procura o level mais perto do alvo só na faixa do modelo: de 10 levels abaixo a 20 acima do level dele, entre 1 e 50. O modelo só entra se ficar a até 6% do alvo (prefere modelos ainda não usados na sala). Sem nenhum candidato, usa um dos 3 modelos mais próximos, em qualquer level. Nenhum bot usa o modelo de uma montaria que você tem.

**Poder das iniciais**

| Montaria | Nv 1 sem peças | Nv 1 com o equipamento inicial | Nv 50 sem peças |
| --- | ---: | ---: | ---: |
| Brasa | 715 | 726 | 969 |
| Maré | 714 | 725 | 970 |
| Ipê | 722 | 733 | 979 |

<a id="dev"></a>

## Modo DEV

Para testar: abra `prototype/dist/preview.html?dev=1` ou o build de teste `prototype/dist/jogo-dev.html` (liga sozinho; é o que vai para o artefato, que não repassa `?dev=1`). O save é separado (`galope-elemental:dev`): o jogo real não é lido nem gravado.

- **Moedas:** Ouro infinito (volta a 999.999 depois de cada gasto) e Pedras Negras à vontade.
- **Cavalo:** cria ou substitui um cavalo com qualquer elemento, raridade, sexo, level (1–50), potencial e até 5 skills (inclusive exclusivas); copia iniciais e aluguéis; +10 levels; +1 cruza.
- **Itens:** qualquer peça do catálogo, inclusive Lendária, com qualquer melhoria; conjunto completo de uma vez.
- **Próxima corrida:** clima inicial, piso, distância, traçado (mais curvas, mais subidas ou lista de blocos), vento, seed e "skills sempre ativam".
- **Perfil:** zerar o perfil de teste (volta à Brasa).

