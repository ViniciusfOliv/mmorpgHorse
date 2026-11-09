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

**Galope Elemental** é um jogo de corrida de cavalos automática em pixel art. Você não controla o cavalo durante a corrida: decide antes (montaria, equipamento e entrada) e assiste. Os cavalos têm elemento (Fogo, Água e Grama, além de Neutro), raridade, level e skills.

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
| VEL | Velocidade | Velocidade máxima. | Velocidade máxima: vMax = 17,2 + 2,2 × n(VEL) m/s (VEL 50 → 18,3 m/s; VEL 100 → 19,4 m/s). Ritmo, piso, bloco e boosts multiplicam esse teto. |
| ACE | Aceleração | Rapidez até a velocidade máxima (largada e retomadas). | Aceleração = 0,6 + 2,4 × n(ACE) m/s², na largada e nas retomadas (saída de curva e de subida). Também encurta a reação à largada: atraso sorteado de até 0,6 s × (1 − 0,5 × n(ACE)). |
| MAN | Manobra | Agilidade nas curvas e na saída delas. | Fator da curva = min(1, 0,82 + 0,15 × n(MAN)): de 82% a 97% da velocidade dentro da curva. |
| FOR | Força | Subidas, terreno pesado e disputa no pelotão. | Fator da subida = min(1, 0,85 + 0,15 × n(FOR)). Alivia o piso pesado (50% × n(FOR) da perda), o aperto do pelotão (80% × n(FOR)) e o gasto extra da subida (+30% × (1 − 0,5 × n(FOR))). |
| EST | Estamina | Quanto tempo mantém o ritmo. | Tanque = 66 + 20 × n(EST) (EST 50 → 76). O clima não mexe no tanque. |
| GAR | Garra | Chance e força da arrancada final (últimos 20%). | Ao cruzar 80% da pista: chance = min(95%, 10% + 70% × n(GAR)). Se sair, o teto de velocidade vai a ×1,02 + 0,16 × n(GAR) até a chegada. |
| SOR | Sorte | Chance de rolar um 2º dado no Dado da Sorte e bônus para ativar skills. | No Dado da Sorte, SOR% é a chance de rolar um 2º dado e ficar com o melhor. Na chance de skill soma 0,1 p.p. por ponto (SOR 50 → +5 p.p.). |

### Como o status é calculado

```text
status = base + pot × 0,1 + (level − 1) × (0,5 + 0,65 × pot / 31) × crescimento da raridade
         (preso ao teto da raridade)
       + bônus do elemento (+8 no status do elemento)
       + equipamento
arredondado e preso entre 1 e 120
```

base = status no level 1; pot = potencial (0 a 31, oculto no jogo). O teto da raridade vale antes do elemento e do equipamento, então eles podem passar do teto.

O clima também mexe nos status durante a corrida: o multiplicador m do clima (ver Elementos e clima) entra em VEL, ACE, MAN, FOR e GAR (não em EST nem em SOR).

<a id="level"></a>

## Level e XP

Level máximo: **50**. Para subir do level L para L + 1 são 50 + 25 × L de XP. Do level 1 ao 50 são 33.075 de XP no total. No level máximo o XP para de acumular.

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

A cada level, cada status ganha (0,5 + 0,65 × pot / 31) × crescimento da raridade, até o teto da raridade. O potencial também soma 0,1 × pot fixo desde o level 1.

| Raridade | Crescimento | Ganho/level (pot 0) | Ganho/level (pot 31) | Ganho do Nv 1 ao 50 (pot 31) | Teto |
| --- | ---: | ---: | ---: | ---: | ---: |
| Comum | ×0,8 | 0,4 | 0,92 | 45,1 | 60 |
| Mágico | ×0,9 | 0,45 | 1,035 | 50,7 | 70 |
| Raro | ×1 | 0,5 | 1,15 | 56,4 | 80 |
| Lendário | ×1,1 | 0,55 | 1,265 | 62 | 90 |
| Mítico | ×1,2 | 0,6 | 1,38 | 67,6 | 100 |

### Aprender skill ao subir de level

A cada level ganho há 8% de chance de aprender uma skill nova (sorteio pela seed do save). Só entra se houver vaga (vagas da raridade) e a skill sorteada é uma das que a montaria pode ter: Neutro ou do próprio elemento, nunca exclusiva de outra montaria, nunca repetida.

### Exemplo: as iniciais por level (sem equipamento)

| Montaria | Level | VEL | ACE | MAN | FOR | EST | GAR | SOR | Poder |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Brasa | 1 | 66 | 72 | 62 | 53 | 59 | 64 | 51 | 728 |
| Brasa | 10 | 75 | 81 | 70 | 61 | 66 | 72 | 59 | 822 |
| Brasa | 25 | 80 | 88 | 80 | 72 | 77 | 80 | 70 | 920 |
| Brasa | 50 | 80 | 88 | 80 | 80 | 80 | 80 | 80 | 946 |
| Maré | 1 | 68 | 59 | 55 | 58 | 76 | 60 | 48 | 724 |
| Maré | 10 | 75 | 66 | 62 | 66 | 85 | 68 | 56 | 811 |
| Maré | 25 | 80 | 77 | 73 | 79 | 88 | 80 | 69 | 915 |
| Maré | 50 | 80 | 80 | 80 | 80 | 88 | 80 | 80 | 942 |
| Ipê | 1 | 64 | 55 | 51 | 74 | 66 | 54 | 55 | 709 |
| Ipê | 10 | 71 | 63 | 58 | 83 | 74 | 62 | 63 | 798 |
| Ipê | 25 | 80 | 74 | 69 | 88 | 80 | 75 | 74 | 904 |
| Ipê | 50 | 80 | 80 | 80 | 88 | 80 | 80 | 80 | 945 |

<a id="raridades"></a>

## Raridades

São 5 raridades, da mais comum à mais rara: Comum, Mágico, Raro, Lendário e Mítico. A raridade define o teto de status, o crescimento, as vagas de skill e a chance de ativar skills.

| Raridade | Cor | Teto de status | Crescimento | Vagas de skill | Skills do potro (mínimo) | Chance base de skill | Status base do potro | Preço da peça | Aluguel base | Montarias no jogo |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | ---: |
| Comum | #9e9e9e | 60 | ×0,8 | 1 | 1 | 35% | 36–52 | 100 | 100 | 4 |
| Mágico | #4caf50 | 70 | ×0,9 | 2 | 1 | 45% | 44–60 | 250 | 250 | 3 |
| Raro | #2196f3 | 80 | ×1 | 3 | 2 | 55% | 52–68 | 600 | 600 | 5 |
| Lendário | #ff9800 | 90 | ×1,1 | 4 | 2 | 65% | 60–76 | 1.500 | 1.500 | 2 |
| Mítico | #9c27b0 | 100 | ×1,2 | 5 | 3 | 75% | 68–84 | não existe | não se aluga | 2 |

Raridade mais alta que nasce de cruzamento: **Lendário**. Mítico nunca nasce de cruzamento e não se aluga.

### Grau (estrelas)

Cada montaria tem um grau de ★ a ★★★: a qualidade do cruzamento. Ele muda a faixa dos status base do potro, o piso do potencial e o preço do aluguel. As iniciais e os selvagens têm o grau definido nos dados.

| Grau | Status base do potro | Piso do potencial | Multiplicador do aluguel |
| ---: | --- | ---: | ---: |
| ★ | base da raridade + 0 a + 8 | 0 | ×1 |
| ★★ | base da raridade + 5 a + 11 | 8 | ×1,25 |
| ★★★ | base da raridade + 8 a + 16 | 16 | ×1,5 |

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

Cada elemento dá um bônus fixo num status e tem um clima "dono", que o favorece. Cada clima também penaliza um elemento. Neutro não ganha nem perde.

| Elemento | Bônus de status | Clima dono | Penalizado por | Descrição |
| --- | --- | --- | --- | --- |
| Fogo | +8 Aceleração | Sol | Chuva | Explosivo na largada. Brilha no sol; sofre com chuva. |
| Água | +8 Estamina | Chuva | Névoa | Fôlego de sobra. Cresce na chuva; sofre na névoa. |
| Grama | +8 Força | Névoa | Sol | Firme como raiz. Domina a névoa e as subidas; murcha no sol. |
| Neutro | — | — | — | Sem bônus nem penalidade. Rende igual em qualquer clima. |

### Climas

| Clima | Favorece | Penaliza | Efeito geral | Descrição |
| --- | --- | --- | --- | --- |
| Sol | Fogo | Grama | gasto de estamina ×1,04 para todos | Favorece Fogo; Grama murcha. |
| Chuva | Água | Fogo | velocidade −1,5% para todos | Favorece Água; Fogo apaga. |
| Névoa | Grama | Água | nenhum efeito geral | Favorece Grama; Água perde o rumo. |
| Nublado | — | — | nenhum efeito geral | Condição neutra: ninguém é favorecido. |

### Multiplicador de clima (m)

Elemento dono do clima: ×1,03; com a skill de clima ativa, ×1,10; com 4 peças do conjunto daquele clima (sem a skill), ×1,07. Elemento penalizado: ×0,97 (o equipamento de 5 peças anula). O resto, e todos no Nublado, ×1.

| Elemento | Sol | Chuva | Névoa | Nublado |
| --- | ---: | ---: | ---: | ---: |
| Fogo | ×1,03 | ×0,97 | ×1,00 | ×1,00 |
| Água | ×1,00 | ×1,03 | ×0,97 | ×1,00 |
| Grama | ×0,97 | ×1,00 | ×1,03 | ×1,00 |
| Neutro | ×1,00 | ×1,00 | ×1,00 | ×1,00 |

```text
vMax       = (17,2 + 2,2 × n(VEL) × m) × (1 + 0,1 × (m − 1))
aceleração = 0,6 + 2,4 × n(ACE) × m
Força, Manobra e Garra efetivas = n(x) × m
```

O clima inicial sai da seed da sala. O Dado da Sorte pode virar o clima no meio da corrida (ver Dado da Sorte); quando vira, os números de todos são recalculados (o que já foi gasto não volta).

### Vento (só visual)

Cada sala tem um vento sorteado pela seed: calmo 35%, brisa 40% e ventania 25%, soprando para a direita ou para a esquerda. Ele só mexe no desenho (bandeirinhas, folhas, nuvens, inclinação da chuva); não entra na simulação.

<a id="skills"></a>

## Skills

São 18 skills. Cada uma tem um gatilho; quando ele acontece, a montaria faz **uma** tentativa contra a chance de skill (uma por corrida, ou uma por bloco nas skills de curva e subida marcadas "em cada bloco"). Se acertar, o efeito vale pelo tempo ou pela distância indicados.

```text
chance de skill = min(95%, chance base da raridade + 0,5 p.p. × (level − 1) + 0,1 p.p. × SOR + bônus de equipamento)
```

**Chance de ativar com SOR 50 (sem equipamento / com 3+ peças de conjunto)**

| Raridade | Nv 1 | Nv 25 | Nv 50 |
| --- | ---: | ---: | ---: |
| Comum | 40% / 45% | 52% / 57% | 64,5% / 69,5% |
| Mágico | 50% / 55% | 62% / 67% | 74,5% / 79,5% |
| Raro | 60% / 65% | 72% / 77% | 84,5% / 89,5% |
| Lendário | 70% / 75% | 82% / 87% | 94,5% / 95% |
| Mítico | 80% / 85% | 92% / 95% | 95% / 95% |

**Quem pode ter:** skills Neutro servem para qualquer elemento; as de elemento, só para aquele elemento; as exclusivas, só para a montaria inicial dona (não se aprendem nem se herdam). O número de skills é limitado pelas vagas da raridade.

**Pontos no Poder:** cada skill soma 20 × o peso do gatilho no Poder (gatilhos que nem sempre acontecem valem menos). **Balão:** o texto que aparece na pista quando a skill ativa.

### Neutras (8)

| Skill | Gatilho | Efeito | Descrição no jogo | Quem pode ter | Começa em | Pontos no Poder | Balão |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| **Arranque** | Largada | aceleração ×1,3 (+30%), por 100 m | Largada explosiva: +30% de aceleração nos primeiros 100 m. | qualquer elemento | Faísca, Fogaréu | 20 | ARRANQUE |
| **Sprint** | Entra numa reta de 150 m ou mais (a reta da largada não conta) | velocidade ×1,04 (+4%); gasto de estamina ×1,15 (+15%), por 150 m | Numa reta: +4% de velocidade por 150 m, gastando 15% mais estamina. | qualquer elemento | Ventania | 20 | SPRINT |
| **Drift** | Entra numa curva | fator da curva +5% (somado, teto 1), em cada bloco, até o fim dele | Em cada curva: +5% de rendimento na curva. | qualquer elemento | Boitatá | 16 | DRIFT |
| **Saída Rápida** | Sai de uma curva | aceleração ×1,4 (+40%), por 4 s | Ao sair da curva: +40% de aceleração por 4s. | qualquer elemento | — | 16 | SAÍDA RÁPIDA |
| **Fôlego de Montanha** | Entra numa subida | gasto extra da subida ×0,7 (−30%), em cada bloco, até o fim dele | Em cada subida: gasta 30% menos estamina. | qualquer elemento | Jequitibá | 12 | FÔLEGO MONT. |
| **Segundo Ar** | Estamina cai a 20% ou menos | recupera 15% do tanque na hora | Quando a estamina cai a 20%, recupera 15%. | qualquer elemento | Capim, Garoa, Jequitibá | 16 | SEGUNDO AR |
| **Arrancada Final** | Cruza 80% da pista (reta final) | chance de Garra +15 p.p.; impulso da Garra +3 p.p. | Na reta final: +15% de chance de Garra e +3% de força na arrancada. | qualquer elemento | Ventania | 20 | ARR. FINAL |
| **Dado Viciado** | Antes de cada Dado da Sorte | +1 dado no Dado da Sorte (até o fim da corrida) | Rola 1 dado extra nos eventos de Sorte. | qualquer elemento | — | 20 | DADO VICIADO |

### Fogo (3)

| Skill | Gatilho | Efeito | Descrição no jogo | Quem pode ter | Começa em | Pontos no Poder | Balão |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| **Sol a Pino** | Clima Sol valendo (checado a cada instante; vale também se o Dado virar o clima) | bônus do clima do próprio elemento ×1,03 → ×1,10 (até o fim da corrida) | Com sol: o bônus do clima para o Fogo é dobrado. | só Fogo | Fogaréu, Boitatá | 8 | SOL A PINO |
| **Labareda** | Largada | aceleração ×1,15 (+15%); velocidade ×1,01 (+1%), por 5 s | Largada em chamas: +15% de aceleração e +1% de velocidade por 5s. | só Brasa (exclusiva) | Brasa | 20 | LABAREDA |
| **Chama Final** | Cruza 80% da pista (reta final) | velocidade ×1,05 (+5%), por 5 s | Na reta final, +5% de velocidade por 5s. | só Fogo | Tição, Fogaréu, Boitatá | 20 | CHAMA FINAL |

### Água (4)

| Skill | Gatilho | Efeito | Descrição no jogo | Quem pode ter | Começa em | Pontos no Poder | Balão |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| **Pé na Chuva** | Clima Chuva valendo (checado a cada instante; vale também se o Dado virar o clima) | bônus do clima do próprio elemento ×1,03 → ×1,10 (até o fim da corrida) | Com chuva: o bônus do clima para a Água é dobrado. | só Água | Garoa, Pororoca, Iara | 8 | PÉ NA CHUVA |
| **Maré Alta** | Estamina cai a 20% ou menos | recupera 20% do tanque na hora; velocidade ×1,03 (+3%), por 8 s | Quando a estamina cai a 20%, a maré sobe: recupera 20% de estamina e ganha +3% de velocidade por 8s. | só Maré (exclusiva) | Maré | 16 | MARÉ ALTA |
| **Canto da Iara** | Cruza 80% da pista (reta final) | velocidade ×1,06 (+6%); gasto de estamina ×0,7 (−30%), por 5 s | Na reta final, +6% de velocidade por 5s e gasta 30% menos estamina. | só Água | Iara | 20 | CANTO IARA |
| **Nascente** | Entra numa reta de 150 m ou mais (a reta da largada não conta) | recupera 12% do tanque na hora | Numa reta, recupera 12% de estamina. | só Água | Pororoca, Iara | 20 | NASCENTE |

### Grama (3)

| Skill | Gatilho | Efeito | Descrição no jogo | Quem pode ter | Começa em | Pontos no Poder | Balão |
| --- | --- | --- | --- | --- | --- | ---: | --- |
| **Névoa Amiga** | Clima Névoa valendo (checado a cada instante; vale também se o Dado virar o clima) | bônus do clima do próprio elemento ×1,03 → ×1,10 (até o fim da corrida) | Com névoa: o bônus do clima para a Grama é dobrado. | só Grama | — | 8 | NÉVOA AMIGA |
| **Casco Firme** | Entra numa subida | fator da subida +6% (somado, teto 1), em cada bloco, até o fim dele | Em cada subida: +6% de rendimento na subida. | só Grama | Mandacaru, Jequitibá | 12 | CASCO FIRME |
| **Raízes Firmes** | Entra numa reta de 150 m ou mais (a reta da largada não conta) | recupera 5% do tanque na hora; velocidade ×1,02 (+2%), por 8 s | Numa reta, finca os cascos: recupera 5% de estamina e +2% de velocidade por 8s. | só Ipê (exclusiva) | Ipê | 20 | RAÍZES FIRM. |

<a id="dado"></a>

## Dado da Sorte

Quando o líder cruza 1/3 e 2/3 da distância, **todos** rolam o Dado da Sorte (até quem já chegou). Ele usa um fluxo de números próprio da seed, então é determinístico.

1. Cada montaria rola um dado de 1 a 100.
2. Com chance igual à sua Sorte (SOR%), rola um 2º dado e fica com o melhor.
3. Dado Viciado (gatilho "antes de cada Dado da Sorte") soma um dado extra: no máximo 3 dados.
4. O maior dado vence. Empate no topo: só os empatados rolam de novo.
5. O clima vira o do elemento do vencedor. Se já for esse clima, ou se o vencedor for Neutro, o clima "segura".

| Elemento do vencedor | Clima depois do Dado |
| --- | --- |
| Fogo | Sol |
| Água | Chuva |
| Grama | Névoa |
| Neutro | não muda |

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

A pista de cada sala sai da seed: distância de 1.000 a 2.400 m (de 100 em 100 m), de 5 a 9 blocos de tamanhos variados (fronteiras de 10 em 10 m), piso e clima inicial. O primeiro e o último bloco são sempre reta; os do meio são sorteados entre reta, curva e subida.

**Frequência em 20.000 seeds**

| Item | Valores |
| --- | --- |
| Blocos do meio | Reta 33% · Curva 33% · Subida 34% |
| Piso | Grama 33% · Terra 33% · Areia 34% |
| Clima inicial | Sol 25% · Chuva 25% · Névoa 25% · Nublado 25% |

### Blocos

| Bloco | Fator de velocidade | Gasto de estamina | Observação |
| --- | --- | --- | --- |
| Reta | 1 (sem perda) | normal | Reta de 150 m ou mais (fora a da largada) dispara skills de reta. |
| Curva | min(1, 0,82 + 0,15 × n(MAN) + bônus de skill) — 82% a 97% | normal | Ao sair, a velocidade volta pela Aceleração. |
| Subida | min(1, 0,85 + 0,15 × n(FOR) + bônus de skill) — 85% a 100% | ×(1 + 0,3 × (1 − 0,5 × n(FOR))), e o esforço não cai com a velocidade menor | Ao sair, a velocidade volta pela Aceleração. |

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

Há 3 montarias iniciais e 13 selvagens. Todas são da espécie cavalo. As selvagens aparecem como bots nas corridas, como reprodutores de aluguel no Haras (menos as de raridade Mítico) e 6 delas na vitrine da Expedição. Bots usam o modelo com level ajustado ao seu Poder.

**Potencial** (0 a 31 por status) é **oculto no jogo**; aparece aqui para referência. Os status "no level" são sem equipamento, com o bônus do elemento.

### Iniciais (3)

#### Brasa — A fagulha veloz

Fogo · Raro · ★★ · ♂ macho · Nv 1 · Poder 728 (Prata) · 2 cruza(s)

Potro alazão de crina dourada. Larga como um rojão.

Skills: Labareda · Onde aparece: montaria inicial, bot nas corridas (quando não é a sua)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base (Nv 1) | 64 | 62 | 60 | 52 | 58 | 62 | 50 |
| Potencial (oculto no jogo) | 22 | 24 | 18 | 14 | 12 | 18 | 14 |
| No Nv 1 | 66 | 72 | 62 | 53 | 59 | 64 | 51 |

#### Maré — O fôlego do oceano

Água · Raro · ★★ · ♀ fêmea · Nv 1 · Poder 724 (Prata) · 1 cruza(s)

Égua tordilha de crina cor do mar. Quanto mais longa a pista, mais perigosa.

Skills: Maré Alta · Onde aparece: montaria inicial, bot nas corridas (quando não é a sua)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base (Nv 1) | 66 | 58 | 54 | 56 | 66 | 58 | 46 |
| Potencial (oculto no jogo) | 16 | 12 | 12 | 18 | 24 | 20 | 18 |
| No Nv 1 | 68 | 59 | 55 | 58 | 76 | 60 | 48 |

#### Ipê — A raiz que não verga

Grama · Raro · ★★ · ♂ macho · Nv 1 · Poder 709 (Prata) · 2 cruza(s)

Castanho robusto de crina amarela como ipê florido. Não teme subida.

Skills: Raízes Firmes · Onde aparece: montaria inicial, bot nas corridas (quando não é a sua)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base (Nv 1) | 62 | 54 | 50 | 64 | 64 | 52 | 54 |
| Potencial (oculto no jogo) | 16 | 14 | 12 | 24 | 18 | 18 | 14 |
| No Nv 1 | 64 | 55 | 51 | 74 | 66 | 54 | 55 |

### Selvagens (13)

#### Pangaré

Neutro · Comum · ★ · ♂ macho · Nv 1 · Poder 503 (Bronze) · 2 cruza(s)

Habitat: Pasto da fazenda.

Skills: nenhuma · Onde aparece: bot nas corridas, aluguel no Haras (100 de Ouro), vitrine da Expedição

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base (Nv 1) | 44 | 42 | 39 | 48 | 46 | 40 | 40 |
| Potencial (oculto no jogo) | 10 | 12 | 11 | 15 | 14 | 9 | 10 |
| No Nv 1 | 45 | 43 | 40 | 50 | 47 | 41 | 41 |

#### Faísca

Fogo · Comum · ★★ · ♀ fêmea · Nv 3 · Poder 572 (Bronze) · 1 cruza(s)

Habitat: Cerrado seco.

Skills: Arranque · Onde aparece: bot nas corridas, aluguel no Haras (125 de Ouro)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base (Nv 1) | 48 | 50 | 45 | 42 | 38 | 46 | 40 |
| Potencial (oculto no jogo) | 14 | 16 | 15 | 10 | 8 | 12 | 10 |
| No Nv 3 | 51 | 61 | 48 | 44 | 40 | 48 | 42 |

#### Lambari

Água · Comum · ★ · ♂ macho · Nv 2 · Poder 532 (Bronze) · 2 cruza(s)

Habitat: Beira de rio.

Skills: nenhuma · Onde aparece: bot nas corridas, aluguel no Haras (100 de Ouro)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base (Nv 1) | 42 | 44 | 39 | 42 | 52 | 44 | 40 |
| Potencial (oculto no jogo) | 9 | 11 | 10 | 12 | 17 | 13 | 10 |
| No Nv 2 | 43 | 46 | 41 | 44 | 62 | 46 | 42 |

#### Capim

Grama · Comum · ★★ · ♀ fêmea · Nv 4 · Poder 559 (Bronze) · 1 cruza(s)

Habitat: Campos gerais.

Skills: Segundo Ar · Onde aparece: bot nas corridas, aluguel no Haras (125 de Ouro)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base (Nv 1) | 42 | 42 | 38 | 52 | 46 | 42 | 40 |
| Potencial (oculto no jogo) | 10 | 10 | 10 | 18 | 13 | 12 | 10 |
| No Nv 4 | 45 | 45 | 41 | 64 | 49 | 45 | 43 |

#### Tição

Fogo · Mágico · ★★ · ♂ macho · Nv 8 · Poder 680 (Prata) · 2 cruza(s)

Habitat: Carvoaria abandonada.

Skills: Chama Final · Onde aparece: bot nas corridas, aluguel no Haras (313 de Ouro)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base (Nv 1) | 54 | 56 | 51 | 46 | 42 | 52 | 45 |
| Potencial (oculto no jogo) | 17 | 19 | 18 | 12 | 10 | 15 | 12 |
| No Nv 8 | 61 | 72 | 58 | 52 | 47 | 59 | 51 |

#### Garoa

Água · Mágico · ★★ · ♀ fêmea · Nv 10 · Poder 683 (Prata) · 1 cruza(s)

Habitat: Serra enevoada.

Skills: Pé na Chuva, Segundo Ar · Onde aparece: bot nas corridas, aluguel no Haras (313 de Ouro)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base (Nv 1) | 48 | 46 | 43 | 48 | 58 | 50 | 45 |
| Potencial (oculto no jogo) | 13 | 12 | 13 | 14 | 20 | 15 | 12 |
| No Nv 10 | 56 | 53 | 51 | 56 | 75 | 58 | 52 |

#### Mandacaru

Grama · Mágico · ★★ · ♂ macho · Nv 7 · Poder 639 (Bronze) · 2 cruza(s)

Habitat: Caatinga.

Skills: Casco Firme · Onde aparece: bot nas corridas, aluguel no Haras (313 de Ouro), vitrine da Expedição

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base (Nv 1) | 46 | 48 | 43 | 58 | 52 | 46 | 45 |
| Potencial (oculto no jogo) | 12 | 13 | 13 | 21 | 16 | 13 | 12 |
| No Nv 7 | 51 | 53 | 48 | 73 | 58 | 51 | 50 |

#### Ventania

Neutro · Raro · ★★★ · ♀ fêmea · Nv 15 · Poder 843 (Ouro) · 1 cruza(s)

Habitat: Pampa gaúcho.

Skills: Sprint, Arrancada Final · Onde aparece: bot nas corridas, aluguel no Haras (900 de Ouro), vitrine da Expedição

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base (Nv 1) | 62 | 58 | 56 | 52 | 56 | 57 | 50 |
| Potencial (oculto no jogo) | 21 | 18 | 20 | 13 | 15 | 17 | 14 |
| No Nv 15 | 77 | 72 | 71 | 64 | 69 | 71 | 63 |

#### Pororoca

Água · Raro · ★★ · ♂ macho · Nv 18 · Poder 851 (Ouro) · 2 cruza(s)

Habitat: Foz do Amazonas.

Skills: Nascente, Pé na Chuva · Onde aparece: bot nas corridas, aluguel no Haras (750 de Ouro)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base (Nv 1) | 55 | 53 | 50 | 57 | 64 | 56 | 50 |
| Potencial (oculto no jogo) | 15 | 14 | 15 | 17 | 24 | 16 | 14 |
| No Nv 18 | 70 | 68 | 65 | 73 | 88 | 72 | 65 |

#### Fogaréu

Fogo · Lendário · ★★★ · ♀ fêmea · Nv 22 · Poder 1.008 (Diamante) · 1 cruza(s)

Habitat: Chapada em chamas.

Skills: Sol a Pino, Chama Final, Arranque · Onde aparece: bot nas corridas, aluguel no Haras (2.250 de Ouro), vitrine da Expedição

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base (Nv 1) | 66 | 68 | 63 | 54 | 52 | 60 | 55 |
| Potencial (oculto no jogo) | 24 | 26 | 25 | 16 | 15 | 20 | 16 |
| No Nv 22 | 90 | 98 | 89 | 75 | 72 | 83 | 76 |

#### Jequitibá

Grama · Lendário · ★★★ · ♂ macho · Nv 25 · Poder 991 (Diamante) · 2 cruza(s)

Habitat: Mata Atlântica.

Skills: Casco Firme, Fôlego de Montanha, Segundo Ar · Onde aparece: bot nas corridas, aluguel no Haras (2.250 de Ouro)

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base (Nv 1) | 56 | 54 | 51 | 70 | 62 | 58 | 55 |
| Potencial (oculto no jogo) | 17 | 16 | 17 | 27 | 21 | 19 | 16 |
| No Nv 25 | 80 | 78 | 75 | 98 | 89 | 84 | 79 |

#### Boitatá

Fogo · Mítico · ★★★ · ♀ fêmea · Nv 30 · Poder 1.163 (Lenda) · 1 cruza(s)

Habitat: Só aparece em noites de queimada. A cobra de fogo do folclore, em forma de cavalo.

Skills: Sol a Pino, Chama Final, Drift · Onde aparece: bot nas corridas, vitrine da Expedição

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base (Nv 1) | 70 | 72 | 67 | 58 | 56 | 64 | 60 |
| Potencial (oculto no jogo) | 28 | 29 | 29 | 21 | 20 | 26 | 18 |
| No Nv 30 | 100 | 108 | 100 | 93 | 90 | 100 | 92 |

#### Iara

Água · Mítico · ★★★ · ♂ macho · Nv 28 · Poder 1.145 (Lenda) · 2 cruza(s)

Habitat: Rios encantados. A mãe-d'água que encanta quem a ouve.

Skills: Canto da Iara, Pé na Chuva, Nascente · Onde aparece: bot nas corridas, vitrine da Expedição

|  | VEL | ACE | MAN | FOR | EST | GAR | SOR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base (Nv 1) | 64 | 60 | 58 | 58 | 72 | 66 | 60 |
| Potencial (oculto no jogo) | 22 | 21 | 22 | 20 | 30 | 25 | 18 |
| No Nv 28 | 97 | 93 | 91 | 90 | 108 | 100 | 90 |

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
| Pangaré | ♂ macho | Neutro | Comum | ★ | 1 | 100 |
| Faísca | ♀ fêmea | Fogo | Comum | ★★ | 3 | 125 |
| Lambari | ♂ macho | Água | Comum | ★ | 2 | 100 |
| Capim | ♀ fêmea | Grama | Comum | ★★ | 4 | 125 |
| Tição | ♂ macho | Fogo | Mágico | ★★ | 8 | 313 |
| Garoa | ♀ fêmea | Água | Mágico | ★★ | 10 | 313 |
| Mandacaru | ♂ macho | Grama | Mágico | ★★ | 7 | 313 |
| Ventania | ♀ fêmea | Neutro | Raro | ★★★ | 15 | 900 |
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
- **Status base:** sorteados na faixa da raridade e do grau do potro (tabela abaixo); não herdam dos pais.
- **Potencial:** para cada status, 50% de chance de herdar o de um dos pais (50% para cada); senão sai de 0 a 31. Depois aplica o piso do grau.
- **Nome:** sorteado entre 32: Tufão, Canela, Baio, Pitanga, Jaguar, Serena, Relâmpago, Mimosa, Trovão, Lua, Corisco, Pérola, Faísca II, Aroeira, Bugre, Catira, Dourado, Estrela, Furacão, Guará, Jurema, Malhado, Nuvem, Onça, Pampa, Quimera, Rio, Saci, Tempestade, Umbu, Vaqueiro e Xodó.
- **Cores:** mistura das cores dos pais.

**Faixa dos status base do potro**

| Raridade | ★ | ★★ | ★★★ |
| --- | ---: | ---: | ---: |
| Comum | 36–44 | 41–47 | 44–52 |
| Mágico | 44–52 | 49–55 | 52–60 |
| Raro | 52–60 | 57–63 | 60–68 |
| Lendário | 60–68 | 65–71 | 68–76 |

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
| Mágico | +3 | +2 | 250 | 63 | sim |
| Raro | +4 | +3 | 600 | 150 | sim |
| Lendário | +6 | +4 | 1.500 | 375 | **nunca à venda** |

Venda devolve 25% do preço. Peças Lendário nunca estão à venda. Equipamento inicial: Sela de Couro Cru e Ferradura Leve.

### Catálogo completo

| Peça | Slot | Raridade | Conjunto | Principal | Secundário | Preço | Loja |
| --- | --- | --- | --- | ---: | ---: | --- | --- |
| **Ferradura Leve** | Ferraduras | Comum | — | +2 VEL | — | 100 | sim |
| **Ferradura com Cravos** | Ferraduras | Mágico | — | +3 VEL | +2 ACE | 250 | sim |
| **Ferraduras do Sol** | Ferraduras | Raro | Sol | +4 VEL | +3 ACE | 600 | sim |
| **Ferraduras do Sol** | Ferraduras | Lendário | Sol | +6 VEL | +4 ACE | 1.500 | não |
| **Ferraduras da Chuva** | Ferraduras | Raro | Chuva | +4 VEL | +3 ACE | 600 | sim |
| **Ferraduras da Chuva** | Ferraduras | Lendário | Chuva | +6 VEL | +4 ACE | 1.500 | não |
| **Ferraduras da Névoa** | Ferraduras | Raro | Névoa | +4 VEL | +3 ACE | 600 | sim |
| **Ferraduras da Névoa** | Ferraduras | Lendário | Névoa | +6 VEL | +4 ACE | 1.500 | não |
| **Sela de Couro Cru** | Sela | Comum | — | +2 EST | — | 100 | sim |
| **Sela Acolchoada** | Sela | Mágico | — | +3 EST | +2 GAR | 250 | sim |
| **Sela do Sol** | Sela | Raro | Sol | +4 EST | +3 GAR | 600 | sim |
| **Sela do Sol** | Sela | Lendário | Sol | +6 EST | +4 GAR | 1.500 | não |
| **Sela da Chuva** | Sela | Raro | Chuva | +4 EST | +3 GAR | 600 | sim |
| **Sela da Chuva** | Sela | Lendário | Chuva | +6 EST | +4 GAR | 1.500 | não |
| **Sela da Névoa** | Sela | Raro | Névoa | +4 EST | +3 GAR | 600 | sim |
| **Sela da Névoa** | Sela | Lendário | Névoa | +6 EST | +4 GAR | 1.500 | não |
| **Estribos de Corda** | Estribos | Comum | — | +2 MAN | — | 100 | sim |
| **Esporas de Prata** | Estribos | Mágico | — | +3 MAN | +2 SOR | 250 | sim |
| **Estribos do Sol** | Estribos | Raro | Sol | +4 MAN | +3 SOR | 600 | sim |
| **Estribos do Sol** | Estribos | Lendário | Sol | +6 MAN | +4 SOR | 1.500 | não |
| **Estribos da Chuva** | Estribos | Raro | Chuva | +4 MAN | +3 SOR | 600 | sim |
| **Estribos da Chuva** | Estribos | Lendário | Chuva | +6 MAN | +4 SOR | 1.500 | não |
| **Estribos da Névoa** | Estribos | Raro | Névoa | +4 MAN | +3 SOR | 600 | sim |
| **Estribos da Névoa** | Estribos | Lendário | Névoa | +6 MAN | +4 SOR | 1.500 | não |
| **Antolhos** | Testeira | Comum | — | +2 ACE | — | 100 | sim |
| **Testeira de Couro** | Testeira | Mágico | — | +3 ACE | +2 GAR | 250 | sim |
| **Testeira do Sol** | Testeira | Raro | Sol | +4 ACE | +3 GAR | 600 | sim |
| **Testeira do Sol** | Testeira | Lendário | Sol | +6 ACE | +4 GAR | 1.500 | não |
| **Testeira da Chuva** | Testeira | Raro | Chuva | +4 ACE | +3 GAR | 600 | sim |
| **Testeira da Chuva** | Testeira | Lendário | Chuva | +6 ACE | +4 GAR | 1.500 | não |
| **Testeira da Névoa** | Testeira | Raro | Névoa | +4 ACE | +3 GAR | 600 | sim |
| **Testeira da Névoa** | Testeira | Lendário | Névoa | +6 ACE | +4 GAR | 1.500 | não |
| **Manta de Lã** | Armadura | Comum | — | +2 FOR | — | 100 | sim |
| **Capa Impermeável** | Armadura | Mágico | — | +3 FOR | +2 EST | 250 | sim |
| **Armadura do Sol** | Armadura | Raro | Sol | +4 FOR | +3 EST | 600 | sim |
| **Armadura do Sol** | Armadura | Lendário | Sol | +6 FOR | +4 EST | 1.500 | não |
| **Armadura da Chuva** | Armadura | Raro | Chuva | +4 FOR | +3 EST | 600 | sim |
| **Armadura da Chuva** | Armadura | Lendário | Chuva | +6 FOR | +4 EST | 1.500 | não |
| **Armadura da Névoa** | Armadura | Raro | Névoa | +4 FOR | +3 EST | 600 | sim |
| **Armadura da Névoa** | Armadura | Lendário | Névoa | +6 FOR | +4 EST | 1.500 | não |

### Melhoria (+1 a +10)

Cada tentativa gasta Pedras Negras e tem uma chance de sucesso (sorteio pela seed do save). A partir de +6, a falha **derruba** a peça 1 nível. Cada + soma 1 no status principal. Pedra Negra: 40 de Ouro na loja (pacote de 5 = 200).

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

**Bônus por número de peças do mesmo conjunto (acumulam)**

| Peças | Bônus |
| ---: | --- |
| 3 | +5 Sorte; chance de ativar skills +5 p.p.; +10 de Poder |
| 4 | +5 Sorte; chance de ativar skills +5 p.p.; no clima do conjunto, o bônus do elemento dono sobe de ×1,03 para ×1,07 (não soma com a skill de clima, que dá ×1,10); +15 de Poder |
| 5 | +5 Sorte; chance de ativar skills +5 p.p.; no clima do conjunto, o bônus do elemento dono sobe de ×1,03 para ×1,07 (não soma com a skill de clima, que dá ×1,10); anula a penalidade de clima (×0,97 vira ×1); +20 de Poder |

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

O conjunto dos bots é o do clima do elemento deles (nos exemplos acima, Fogo); bot Neutro sorteia o conjunto.

<a id="economia"></a>

## Economia

Moeda única hoje: **Ouro**. Começa com 500. Ganha-se Ouro correndo (prêmios e treino) e vendendo peças; gasta-se em entradas, peças, Pedras Negras, aluguel e registro de cruza, Troca e vagas do estábulo.

### Entradas e prêmios

Entradas: 50, 100 ou 250 de Ouro. Todos pagam a mesma entrada; a casa fica com 10% do pote (arredondado) e o resto é dividido conforme o tamanho do campo. Quem leva prêmio nunca sai no prejuízo.

| Corredores | Divisão | Exemplo com entrada 100: pote / casa / prêmios |
| ---: | --- | --- |
| 4 | 1º 70% · 2º 30% | 400 / 40 / 251 + 109 |
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
Poder = 2,2·VEL + 1,8·ACE + 1,6·MAN + 1,6·FOR + 1,8·EST + 1,6·GAR + 0,8·SOR
      + 20 × peso do gatilho, por skill
      + 10 (3 peças) / 15 (4 peças) / 20 (5 peças) de conjunto
```

**Peso do gatilho no Poder**

| Gatilho | Peso | Pontos por skill |
| --- | ---: | ---: |
| Largada | 1 | 20 |
| Entra numa reta de 150 m ou mais (a reta da largada não conta) | 1 | 20 |
| Entra numa curva | 0,8 | 16 |
| Sai de uma curva | 0,8 | 16 |
| Entra numa subida | 0,6 | 12 |
| Estamina cai a 20% ou menos | 0,8 | 16 |
| Cruza 80% da pista (reta final) | 1 | 20 |
| Antes de cada Dado da Sorte | 1 | 20 |
| Clima (qualquer) | 0,4 | 8 |

| Liga | Poder | Cor |
| --- | ---: | --- |
| Bronze | 0–659 | #b0703c |
| Prata | 660–779 | #b8c2cc |
| Ouro | 780–879 | #f2c230 |
| Platina | 880–979 | #5fd3c8 |
| Diamante | 980–1.099 | #7ab8ff |
| Lenda | 1.100 ou mais | #ff7a3d |

**Rivais da sala:** cada bot mira um Poder entre −8,5% e +11,5% do seu (leve viés para cima) e entra se ficar a até 6% do alvo; nenhum bot usa o modelo de uma montaria que você tem.

**Poder das iniciais**

| Montaria | Nv 1 sem peças | Nv 1 com o equipamento inicial | Nv 50 sem peças |
| --- | ---: | ---: | ---: |
| Brasa | 728 | 736 | 946 |
| Maré | 724 | 732 | 942 |
| Ipê | 709 | 717 | 945 |

<a id="dev"></a>

## Modo DEV

Para testar: abra `prototype/dist/preview.html?dev=1` ou o build de teste `prototype/dist/jogo-dev.html` (liga sozinho; é o que vai para o artefato, que não repassa `?dev=1`). O save é separado (`galope-elemental:dev`): o jogo real não é lido nem gravado.

- **Moedas:** Ouro infinito (volta a 999.999 depois de cada gasto) e Pedras Negras à vontade.
- **Cavalo:** cria ou substitui um cavalo com qualquer elemento, raridade, sexo, level (1–50), potencial e até 5 skills (inclusive exclusivas); copia iniciais e aluguéis; +10 levels; +1 cruza.
- **Itens:** qualquer peça do catálogo, inclusive Lendária, com qualquer melhoria; conjunto completo de uma vez.
- **Próxima corrida:** clima inicial, piso, distância, traçado (mais curvas, mais subidas ou lista de blocos), vento, seed e "skills sempre ativam".
- **Perfil:** zerar o perfil de teste (volta à Brasa).

