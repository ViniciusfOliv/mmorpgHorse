# Cavalos v3, bloco 1b: crescimento livre

Especificação do bloco 1b, desenho aprovado em 2026-11-12 (`docs/GDD.md` §8.5); spec aprovada em 2026-11-13 por
delegação do Vinicius ("decida sozinho o melhor para o jogo"; `docs/memoria/decisoes.md`). Depois de aprovada pelo
Vinicius vira plano de implementação, executado na branch `claude/cavalos-v3`, em cima do bloco 1 e antes
de integrar na `main`. Os números vêm de três rodadas de calibração por simulação numa cópia isolada do
jogo (dezenas de milhares de corridas por medida). A rodada 2 aplicou os quatro ajustes pedidos depois da
rodada 1: seis status valendo como foco, pontos crescendo com o nível, Sorte fora da distribuição e
corridas mais curtas. A rodada 3 testou um custo mais suave (degrau a cada 12 e a cada 15 pontos) contra o
domínio da build equilibrada. Não resolveu, e ficou o degrau 10, com as metas apertadas ajustadas ao pior
caso medido em 4 seeds (seção 15). Relatório, código de referência, saída do balanço e teste com outras seeds em
`docs/superpowers/specs/anexos/2026-11-12-crescimento-livre-*`. A rodada 1 (relatório, código e balanço)
está no commit 78e61cd. Os arquivos de exploração citados nos relatórios não foram guardados.

## 1. Objetivo e escopo

**Objetivo.** Dar ao jogador a build inteira: nada cresce sozinho com o nível, cada nível dá pontos e o
jogador decide onde eles vão. O custo crescente num mesmo status impede que "tudo num status só" vença, e
nenhum ponto deixa de render até 150.

**Entra neste bloco:**
- status = base (raridade + genética) + pontos comprados; pontos por nível (crescentes) por raridade e
  estrelas;
- custo por faixa (+1 a cada 10 pontos no mesmo status), no lugar do limite de 34% e do teto por raridade;
- escala até 150;
- física da corrida linear até 150 (hoje Manobra e Força param de render perto de 110–120);
- Sorte só de nascimento (não recebe pontos) e Dado da Sorte reescalado;
- skill de tipo que multiplica os dois status do tipo;
- build dos bots por pesos, que também é o botão "Distribuir sugerido";
- Poder e ligas sem equipamento;
- equipamento suspenso (sem efeito; telas escondidas; peças guardadas);
- redistribuição (a primeira de cada cavalo é grátis; depois, a Rédea nova);
- botões +1, +5 e +10;
- explicações curtas na tela (mouse no computador, toque no celular);
- save v6 com migração (todos os pontos devolvidos);
- metas novas no `balance.js`, testes, wiki, GDD e capturas.

**Fica de fora:** ginásios (próximo desenho), fonte de Rédea nova jogando (vem com os ginásios),
equipamento como cosmético, loja de Gemas.

## 2. Modelo de status

```text
g ∈ 0..31 por status (genética, como no bloco 1); nada cresce sozinho
base(k)     = baseLo[raridade] + 16·g/31                 baseLo = 40 / 44 / 49 / 54 / 60
pontos(L)   = piso(fatorRaridade · fatorEstrelas · [(L − 1)·2 + 4·(L − 1)(L − 2)/96])
              taxa por nível: 2 no nível 2, sobe em linha reta até 6 no nível 50 (média 4)
              fatorRaridade = 1,00 / 1,05 / 1,10 / 1,15 / 1,20     fatorEstrelas = 1 / 1,09 / 1,22
custo       = o i-ésimo ponto num status (i = 0, 1, …) custa 1 + piso(i / 10)
              comprar a = 10q + r pontos custa 5q(q+1) + r(q+1)    (10 → 10, 20 → 30, 30 → 60, 50 → 150)
Sorte       = só a base (40 a 76); não recebe pontos
válida      = soma dos custos ≤ pontos(L), base + a ≤ 150 em cada status e a(Sorte) = 0
status(k)   = arredonda(base + a), preso a 1–150
```

- A genética não entra no custo. O Comum mantém a base de hoje, então os iniciais nascem iguais
  (Brasa, Maré e Ipê com 45–52 em cada status).
- Pontos por nível, Comum / Mítico:

  | Estrelas | Nível 11 | Nível 30 | Nível 50 |
  |---|---|---|---|
  | ★ | 23 / 28 | 91 / 110 | 196 / 235 |
  | ★★ | 25 / 31 | 100 / 120 | 213 / 256 |
  | ★★★ | 28 / 34 | 112 / 134 | 239 / 286 |

- Com a taxa crescente, dez níveis rendem parecido em qualquer ponto da progressão: +25 de status
  (1→11), +24 (20→30) e +25 (40→50), na build do bot de um Comum ★★. Com a taxa fixa da rodada 1 eram
  +44, +22 e +16: o começo era rápido e o fim quase parava.
- **Ninguém chega a 150:** o pior caso (Mítico ★★★ nível 50, genética 31, tudo num status) dá 146. Uma
  build inclinada típica no nível 50 tem o maior status entre 84 (Comum ★★) e 112 (Mítico ★★★).
- Sem `statCap`, sem `freeCapShare`, sem `gGrowBase/gGrowRange`. O teto único é `statMax` 150.
- Constantes novas em `RaceSim.TUNING`: `ptsRate0` 2, `ptsRate1` 6, `starMult` [1, 1,09, 1,22],
  `costStep` 10, `statMax` 150 e `noBuy: ['sorte']`.

## 3. A corrida até 150

Princípio: **toda fórmula da corrida é linear até 150**; o único retorno decrescente é o custo por faixa.
Sem isso, o crescimento livre não fecha: com a física de hoje, Manobra e Força acima de ~120 rendem 0,
Estamina rende 2,5 p.p. no topo e +10 de Velocidade decide 53 p.p. a 140. Ganho de +10 num status, em
campos planos de 6 (p.p.; ±2,1):

| Status de todos | Hoje: VEL / ACE / MAN / FOR / EST / GAR | Proposto: VEL / ACE / MAN / FOR / EST / GAR |
|---|---|---|
| 50 | 18,5 / 7,2 / 9,4 / 19,6 / 13,3 / 8,0 | 25,4 / 22,7 / 26,8 / 26,2 / 24,2 / 17,6 |
| 110 | 40,8 / 18,0 / 26,0 / 20,7 / 6,6 / 20,4 | 31,4 / 35,8 / 30,9 / 32,2 / 29,8 / 39,1 |
| 140 | 53,2 / 24,4 / 0,0 / 0,0 / 2,5 / 27,2 | 35,7 / 41,2 / 34,3 / 34,7 / 29,9 / 44,4 |

Num campo real, onde cada ponto custa o que custa, os seis rendem quase o mesmo: +10 num Raro nível 20 vale
de 9,6 (Garra) a 11,0 p.p. (Manobra), maior ÷ menor = 1,15 (seção 12, A1).

**Escala de tempo ×1,067.** Para os iniciais voltarem a ~98 s na pista curta, velocidades sobem ×1,067,
acelerações ×1,067² e o gasto por segundo ×1,067: a corrida em metros é a mesma, só mais rápida. Subir só a
velocidade base desmontava os iniciais (Brasa 41,9%, porque a largada passava a pesar mais).

Mudanças (n = status/100):

| O quê | Hoje | Proposto | Por quê |
|---|---|---|---|
| Velocidade base `vBase` | 17,805 | 19,0 | escala de tempo |
| Faixa da velocidade `vRange` | 1,2 | 1,13 | a Velocidade não decide sozinha no topo (1,0 antes da escala, +6%) |
| Aceleração | 0,6 + 2,4·n | 1 / max(0,044; 1,158 − 0,66·n) | cada ponto encurta a largada igual (hoje rende ∝ 1/a²) |
| Desaceleração `decel` / gasto `drainK` | 1,2 / 1,0 | 1,37 / 1,07 | escala de tempo |
| Curva | min(1; 0,826 + 0,14·n) | min(1; 0,704 + 0,185·n) | o teto 1 só chega em n = 1,6; Manobra vale como os outros |
| Subida | min(1; 0,86 + 0,13·n) | min(1; 0,824 + 0,11·n) | idem |
| Teto de n efetivo de Força e Manobra | 1,2 | 2 | idem |
| Alívio da Força no piso / no pelotão | 0,5 / 0,8 | 0,2 / 0,6, com piso 0 | hoje fica negativo acima de 125 |
| Clima nos status | n·m | n + (m − 1)·0,5 | o clima vale o mesmo em qualquer nível |
| Teto do ritmo (meio / sprint) | 0,97 / 1,03 | + 0,035 / + 0,065 × (n(EST) − 0,5) | a Estamina rende no topo (centrado em 50: o inicial não muda) |
| Erro do jóquei | −2% … +6% | −0,5% … +2,5% | menos ruído; ajuda M3 e M6 |
| Atraso de largada | 0,6 × (1 − 0,5·min(n; 1)) | 0,56 × (1 − min(n; 1,5)/3) | não trava em 100 |
| Garra: início da arrancada | 80% da pista | 80% − 14%·(n − 0,5) | a Garra rendia metade da Velocidade |
| Garra: chance / força | 0,10 + 0,70·n / 0,02 + 0,16·n | 0,50 + 0,15·n / 0,02 + 0,26·n | menos variância; não trava em 121 |
| Gatilho `final` (Arrancada Final, Chama Final) | fim fixo | o ponto em que a arrancada do cavalo começa | com a Garra adiantada ele chegava depois e rendia 0 |
| Dado: chance do 2º dado | Sorte/100 | (Sorte − 40)/40 | a Sorte vai de 40 a 76: a diferença aparece (seção 4) |
| Arranque | ×1,20 por 100 m | ×1,18 | S1 perto do teto com a aceleração nova |
| Drift (`curveBonus`) | 0,03 | 0,025 | S1 perto do teto com a curva nova |
| Canto da Iara / Chama Final | 7 s / 8 s | 9 s / 9,5 s | a duração em segundos não entra na escala de tempo; sem o ajuste, o Canto caía abaixo do piso do S1 (2,8 p.p.) |

Sem mudança: `gBand` 16, tanque 66 + 20·n, piso, chuva, sol, vácuo, pelotão (raio e −3%),
`weatherMult` 1,03 / 1,08, Dado (1/3 e 2/3), as outras skills, chance de skill, vagas e pista. A ordem da
RNG não muda (o sorteio da Garra continua uma vez por corrida). `RaceSim.VERSION` sobe.

**A corrida muda de sensação** (para olhar na animação): largada, curvas e subidas mais lentas em
proporção, mas a corrida inteira mais curta. Os iniciais levam 98,2 s na curta e 128,6 s na longa (hoje
95,9 / 127,1); o Mítico ★★★ nível 50 é 14% mais rápido que eles (84,1 s). "Cansou" some (o jóquei erra
menos). A Garra dispara em 58% das corridas (hoje 43%), e mais cedo para quem tem mais Garra.

Resíduo aceito: no terço da Raízes Firmes (Força e Manobra × até 1,25), a curva bate o teto 1 a partir de
~128 de Manobra; o ponto continua rendendo nos outros dois terços.

## 4. Sorte e Dado da Sorte

- A Sorte **não recebe pontos**: fica com a base, de 40 (Comum, genética 0) a 76 (Mítico, genética 31).
  `validAlloc` zera o que vier nela, `allocInfo().room.sorte` = 0 e `weightedAlloc`/`botAlloc` a ignoram.
- Chance de jogar o 2º dado = (Sorte − 40)/40, presa a 0–1. Com Sorte/150 a diferença era quase invisível:
  um Mítico de genética 31 contra sete Comuns de genética 0 vencia o Dado em 14,5% das vezes (o justo é
  12,5%). Agora:

  | Dado (1 contra 7; empate = meio) | Vence |
  |---|---|
  | Sorte 76 (Mítico, g31) × sete de 40 (Comum, g0) | 20,8% |
  | Sorte 56 (Comum, g31) × sete de 40 | 16,2% |
  | Sorte 40 × sete de 40 | 12,6% |

- Na corrida, a genética de Sorte (0 → 31, +16) vale 0,7 ± 0,6 p.p. de vitória: ela só mexe no Dado (o
  clima) e na chance de skill. Peso 0 no Poder (a regressão deu 0,08).

## 5. Skill de tipo

A skill de tipo passa a **multiplicar os dois status do tipo** no seu terço da pista, no lugar do efeito
próprio de hoje:

| Tipo | Skill | Terço | Status multiplicados | × (1 + m·P), m | P por nível | P por raridade |
|---|---|---|---|---|---|---|
| Fogo | Labareda | 1º | Velocidade e Aceleração | 0,19 | −0,15 | 0,15 |
| Grama | Raízes Firmes | 2º | Força e Manobra | 0,15 | 0,25 | 0,40 |
| Água | Maré Alta | 3º | Estamina (teto do ritmo) e Garra | 0,33 | 0 | 0,15 |

P = 1 + nívelT·(L − 1)/49 + raridadeT·ordem/4 (Comum nível 1 = 1 nos três).

- **Sai:** Labareda +23% de aceleração; Raízes +7 de Força e de Manobra e −1,2% de gasto; Maré +1,8% de
  velocidade e 1,2% de estamina de volta. Ficam aceitas pela corrida as chaves antigas (sem uso).
- **Por quê:** o efeito próprio *substituía* os status do tipo. Para o Fogo, investir em Aceleração rendia
  menos porque a Labareda já acelerava (o mesmo com a Água e a Grama). Com os seis status valendo o mesmo e
  o custo crescente, a build "forte no tipo" não passava de 43%. Multiplicando, investir no tipo tem
  sinergia: a build `tipo` fica em 48–53%, e é isso que dá identidade ao bot.
- **Calibração:** no nível 1 (P = 1) cada m reproduz o M1 e o M9. O P quase não cresce porque o efeito já
  cresce com os status. O P do Fogo até cai com o nível: a Velocidade multiplicada vale cada vez mais em
  status alto. Em pontos a Labareda sempre cresce: cerca de +10 em Vel e Ace no nível 1 e cerca de +20 num
  Lendário nível 50.
- **Na tela:** como o % não conta a história, a aba Skills mostra o efeito em pontos para o cavalo
  ("Velocidade e Aceleração +12 no 1º terço"), calculado dos status atuais. A descrição da skill diz o % e
  que "varia com nível e raridade" (Fogo e Grama) ou "cresce com a raridade" (Água).
- M9 (os três tipos em campo misto): 16,3–17,2%. Ganho da skill (informativo): 6,8–12,9 p.p.

## 6. Build dos bots e "Distribuir sugerido"

`weightedAlloc(cavalo, pesos, de)`: um ponto por vez no status de menor (pontos + 1)/peso entre os que
ainda aceitam (peso > 0, fora de `noBuy`, abaixo de 150 e com o próximo ponto cabendo no que sobra); empate
na ordem de `STAT_KEYS`; sem RNG. `botAlloc(cavalo, de)` usa peso 1 nos seis status de corrida e × 1,2 nos
dois do tipo:

| Tipo | VEL | ACE | MAN | FOR | EST | GAR | SOR |
|---|---|---|---|---|---|---|---|
| Fogo | 1,2 | 1,2 | 1 | 1 | 1 | 1 | — |
| Água | 1 | 1 | 1 | 1 | 1,2 | 1,2 | — |
| Grama | 1 | 1 | 1,2 | 1,2 | 1 | 1 | — |

- Sem `de`, parte do zero (bots). Com `de` (os pontos já comprados mais o rascunho), continua dali: é o
  botão **"Distribuir sugerido"**, que põe no rascunho todos os pontos que sobram.
- É a build mais forte medida (M6), então distribuir melhor não basta para vencer o bot da sua liga.
- × 1,2 e não × 1,3: entre 1,1 e 1,3 o bot mede ~60% no M6 do Raro ★★ 50 (1,3 dava 60,2% e reprovava). A
  vantagem dele vem da sinergia com a skill de tipo, não do tamanho da inclinação.

## 7. Poder e ligas

```text
Poder = 2,5·VEL + 2,0·ACE + 2,2·MAN + 2,4·FOR + 2,4·EST + 1,5·GAR + 0·SOR
        + 14 × peso do gatilho, por skill + 20·(nível − 1)/49 + 28·ordemDaRaridade/4
```

- Pesos por regressão logística em 64.318 pares de 4.000 salas. Sem equipamento e sem conjunto. O termo da
  skill de tipo (80·P) sai: como P agora difere por tipo, nível e raridade entram como termos próprios,
  iguais para os três tipos.
- `powerRating(cavalo)` perde o parâmetro do equipamento; `computeStats(cavalo)` também.
- Ligas: **Bronze 0 · Prata 710 · Ouro 800 · Platina 890 · Diamante 980 · Lenda 1070** (método do bloco
  1: seis faixas iguais entre Comum 1 = 624 e Lendário 50 = 1.154). Iniciais nível 1: 626–633 (Bronze);
  nível 25: 782–791 (Prata; na rodada 1 eram Ouro, porque o meio da progressão agora tem menos pontos).
- Resíduo do Poder (P1): no máximo 1,1 p.p. Favorito do Poder vence 52,1% das salas pareadas (P2).

## 8. Equipamento suspenso

- A corrida, o Poder e os status ignoram as peças (`computeStats`, `powerRating` e `simulate` sem gear).
  Bots não ganham mais peças nas salas.
- A sub-aba **Equipamento** da montaria some, e a aba **Loja** some da barra (ela só vende peças e Pedras
  Negras). O código fica, desligado por uma constante (`GEAR_ON = false` no `game.js`), para voltar depois.
- **Guardado no save, sem mudança:** peças, nível de melhoria, o que está equipado e as Pedras Negras. Nada
  é vendido nem convertido.
- **Pedra Negra do pódio:** não cai enquanto o equipamento estiver suspenso (a chamada ao `podiumStone`,
  que tem RNG própria, não é feita; o resto da RNG não muda). O saldo de Pedras sai do cabeçalho e do Perfil.
- Resumo de equipamento na largada e no estábulo: some.
- Volta a ser validado depois (talvez como cosmético).

## 9. Redistribuição e Rédea nova

- Botão **"Redistribuir pontos"** na aba Status, quando o cavalo tem algum ponto comprado. Devolve todos
  os pontos (o alloc volta a zero); o jogador distribui de novo.
- A **primeira de cada cavalo é grátis** (`respecFree: true` no cavalo, nasce verdadeiro, vira falso ao
  usar). As seguintes gastam **1 Rédea nova** (`state.redeas`, inteiro ≥ 0).
- Pede um segundo toque, como o Confirmar dos pontos, com o texto do que vai gastar ("Grátis: a primeira
  deste cavalo" ou "Usa 1 Rédea nova; você tem N"). Grava como um gasto (`gravaGasto`: se a gravação falha,
  nada muda).
- **Com páreo aberto, a montaria ativa não redistribui** (botão desabilitado com a explicação). As outras
  podem.
- **Fonte da Rédea nova neste bloco: nenhuma no jogo normal.** Só a gaveta DEV dá Rédeas. A fonte jogando
  vem com os ginásios. Nunca por Ouro; por Gemas só no bloco 6 (compra direta, sem sorteio).
- Potro nasce com `respecFree: true` e nenhum ponto.

## 10. Save v6 e migração

- `SAVE_VERSION` 5 → 6. Ao abrir um save v5 (ou mais antigo, depois das migrações que já existem), e
  gravado logo ao abrir:
  - todos os cavalos ficam com alloc zerado ("todos os pontos devolvidos") e `respecFree: true`;
  - `state.redeas = 0`;
  - peças, equipamento e Pedras ficam como estão;
  - **sala aberta continua** (não pode ser re-sorteada); o retrato dos pontos (`pending.alloc`) também é
    zerado, e o Poder da sala segue a regra R16 de hoje (o maior entre o dos retratos e o da ativa).
- Na primeira abertura depois da migração, o Estábulo avisa uma vez: "As regras de crescimento mudaram:
  os pontos dos seus cavalos voltaram para distribuir." O aviso não volta (`state.avisoV6` gravado).
- `sanitize` aceita `respecFree` só booleano (padrão verdadeiro) e `redeas` inteiro 0–999 (padrão 0).
- Modo DEV: save separado, como hoje; o save real nunca é lido nem gravado.

## 11. Telas

**Aba Status da montaria** (mantém o rascunho, o Desfazer e o Confirmar em dois toques do bloco 1):
- cada linha: ícone, nome, nota de genética, barra até 150, valor, **"próximo ponto custa C"** e os botões
  **+1, +5 e +10**. Cada botão soma exatamente N pontos ao rascunho; fica desabilitado quando N não cabe
  (pontos, 150 ou a trava do páreo), com o motivo no `title`. O custo de N aparece no `title` e no
  `aria-label` ("+5 em Velocidade: custa 15 pontos"). Sem rascunho e sem nenhum ponto que caiba (nível 1, ou o
  que sobra não paga o próximo ponto de nenhum status), os botões +N e o "Distribuir sugerido" não aparecem; ficam
  desabilitados com o motivo só quando algum ponto cabe (decidido em 2026-11-13 por delegação do Vinicius);
- a linha da **Sorte** não tem botões nem custo: mostra "de nascimento";
- topo: "Pontos: **sobram X de Y**" e, com rascunho, "Poder A → B";
- **"Distribuir sugerido"**: preenche o rascunho com `botAlloc(cavalo, pontos + rascunho)`; o jogador
  ainda confirma;
- o aviso do Confirmar muda para: "Para mudar depois, use Redistribuir (a primeira deste cavalo é grátis)."
  ou, se já usou, "(gasta uma Rédea nova)";
- "Redistribuir pontos" (seção 9) embaixo, separado dos botões de compra;
- a nota de rodapé perde o teto da raridade e o equipamento: "A barra vai até 150. O custo do ponto sobe a
  cada 10 pontos no mesmo status."

**Aba Skills da montaria:** a skill de tipo mostra o efeito em pontos para este cavalo (seção 5).

**Explicações curtas.** Um botão "ⓘ" pequeno ao lado do rótulo: no computador o texto aparece com o mouse
(`title`); no toque, abrir/fechar mostra o texto embaixo (`aria-expanded`, texto com `role="note"`). Os
textos ficam em `GameData.HELP` (para o wiki usar os mesmos). Entram: os 7 status, nota de genética,
estrelas, raridade, skill de tipo, Poder, liga, clima, piso, Dado da Sorte, custo dos pontos e Rédea nova.
Uma frase de até ~140 caracteres, sem número que não venha do código. Os 7 status:

| Status | Texto |
|---|---|
| Velocidade | Velocidade máxima nas retas. É o status que mais pesa numa reta longa. |
| Aceleração | Quão rápido chega à velocidade máxima na largada e depois de perder ritmo. |
| Manobra | Rendimento nas curvas: quem tem mais perde menos velocidade nelas. |
| Força | Rendimento nas subidas, nos pisos pesados e para passar pelo pelotão. |
| Estamina | Fôlego para manter o ritmo até o fim; também deixa correr mais forte no meio e no sprint. |
| Garra | Chance e força da arrancada final; com mais Garra ela começa mais cedo. |
| Sorte | Vem do nascimento e não recebe pontos. Chance de jogar o Dado da Sorte duas vezes. |

**Outras telas:**
- Estábulo: o selo "+N" mostra os pontos que ainda dá para comprar (como hoje, pelo `room` novo).
- Largada e sala: sem o resumo do equipamento; o Poder já sai sem peças.
- Gaveta DEV: campo "Rédeas novas" (como o das Pedras) e uma caixa "redistribuição grátis" por cavalo; os
  modelos de cavalo do DEV usam `validAlloc` novo.
- Barra de abas: 4 abas (Estábulo, Correr, Expedição, Haras).
- **Emenda (2026-11-14):** a caixa DEV "redistribuição grátis" ficou só na gaveta DEV e vale para a montaria ativa, não "por cavalo"; para outro cavalo, ative-o antes.

## 12. Arquivos

| Arquivo | O que muda |
|---|---|
| `prototype/src/data.js` | raridades (`ptsMult`, `baseLo`, sai `statCap`), ligas, skills de tipo (`statMul`) e descrições, Arranque, Drift, Canto da Iara, Chama Final, `HELP` |
| `prototype/src/sim.js` | modelo da seção 2, física da 3, Sorte e Dado da 4, skill de tipo da 5, bot da 6, Poder da 7, sem gear, gancho de teste `entry.statAdd` (como `noTypeSkill`), cabeçalho de fórmulas, `VERSION` |
| `prototype/src/game.js` | save v6, abas Status e Skills, redistribuição, explicações, equipamento e loja desligados, sem Pedra do pódio, DEV |
| `prototype/tools/balance.js` | metas da seção 13 (o adaptado da calibração é a referência) |
| `prototype/tools/sim-test.js`, `fx-test.js`, `ui-test.mjs` | testes da seção 13 |
| `prototype/tools/wiki.mjs` | wiki do modelo novo (pontos por nível, custo, base, Sorte, física, skill de tipo, explicações) |
| `docs/GDD.md`, `docs/exemplos.md`, `docs/memoria/*`, `prototype/screens/` | regra nova, medições, memória, capturas |

`prototype/dist/` e `docs/wiki.md` saem do build. `gear.js` e `breed.js` não mudam (o potro ganha
`respecFree` no `game.js`, onde já zera os pontos). O código de referência (`anexos/…-calib.diff`) é um
diff completo de `data.js`, `sim.js` e `balance.js` contra o bloco 1.

## 13. Metas e testes

**`balance.js` (165 metas; todas passaram na calibração).** As faixas das metas apertadas são o pior caso
medido em 4 bases de seed mais ~1 p.p. de folga de ruído.
- **Saem:** E1, E2a, E2b, E3, E4 e E3b (equipamento); o M6 antigo (seis políticas); o M7 antigo (status
  cheios); a faixa única de duração.
- **Entram:**
  - M6 novo: rodízio de 12 builds realistas e 6 "tudo num status", Raro ★★ nos níveis 11/30/50, mais o
    Comum ★★ 50 e o Mítico ★★★ 50.
    - Maior média das builds realistas: até 62% no Raro ★★, 64% no Comum ★★ 50 e 67% no Mítico ★★★ 50.
    - Pelo menos 4 builds entre 45% e 60%.
    - Cada `inc:*` e a `tipo` com pelo menos 45%.
    - "Tudo num status" (`all:*`) abaixo de 35% nos níveis 30 e 50.
  - A1: além do ganho ≥ 3 p.p. por status, maior ÷ menor ≤ 1,3 (alvo 1,25).
  - M7 novo: pior caso no nível 50 abaixo de 150.
  - Durações por liga (seção 3): média de cada liga na faixa dela, curta e longa, mais as salas de nível
    50 e "a mais rápida ≥ 80% dos iniciais".

    | Liga | Curta | Longa |
    |---|---|---|
    | Bronze (e iniciais) | 92–104 s | 121–136 s |
    | Prata | 90–102 s | 119–133 s |
    | Ouro | 88–100 s | 117–131 s |
    | Platina | 86–98 s | 114–128 s |
    | Diamante | 84–96 s | 112–126 s |
    | Lenda | 80–94 s | 106–122 s |
- **Rebaseadas:**
  - seção 2 (inicial no seu clima): 45–65 → 45–68%;
  - seções 3 e 3c: 65–85 / 75–93 → 65–100%;
  - seção 7 (Dado): Mítico g31 contra sete Comum g0, 17–25%;
  - M4 dois degraus: ≥ 95% → ≥ 94% (pior caso 94,97%, Raro × Comum no 50);
  - M5 ★★ × ★: 55–63% → 55–64% (pior caso 63,1%, Mítico).
- **Informativo (não reprova):** M2 (ganho da skill de tipo).
- **Medido** (seed do `balance.js`; entre parênteses, o pior caso nas 4 bases):

  | Meta | Medido | Faixa |
  |---|---|---|
  | M1 iniciais | 31,8 / 33,3 / 34,9%; terços 26,7–38,9% | 30–37%; 22–45% |
  | M3 +10 níveis | 1→11 78,0–78,5% · 20→30 76,1–77,8% · 40→50 75,0–77,0% (75,0) | ≥ 70% (alvo 40→50 ≥ 74%) |
  | M4 um / dois degraus | 78,1–85,0% / 95,4–98,7% (94,97) | 72–88% / ≥ 94% |
  | M5 ★★★×★ / ★★×★ | 68,7–70,5% / 59,6–62,3% (63,1) | 65–75% / 55–64% |
  | M6 máximo, Raro ★★ 11/30/50 | 53,7 / 53,2 / 59,9% (60,6), sempre o bot | ≤ 62% |
  | M6 máximo, Comum ★★ 50 / Mítico ★★★ 50 | 61,4% (62,3) / 64,9% (65,4), o bot | ≤ 64% / ≤ 67% |
  | M6 menor `inc:*` / `tipo` | 47,2% (46,1; `inc:acel`, nível 30) / 47,9% | ≥ 45% |
  | M6 "tudo num status", níveis 30 e 50 | no máximo 18,9% | < 35% |
  | M7 pior caso | 146 | < 150 |
  | M8 líder em 1/3 vence / chegada com < 1 m | 38,1% / 5,6% | ≤ 55% / ≥ 5% |
  | M9 tipos | 16,3–17,2% | 15,3–18,0% |
  | P1 / P2 | 1,1 p.p. / 52,1% | ≤ 5 p.p. / 35–55% |
  | A1 | 9,6–11,0 p.p.; maior ÷ menor 1,15 | ≥ 3 p.p.; ≤ 1,3 |
  | S1 | 4,0 (Chama Final) a 12,7 p.p. (Drift) | 3–13 p.p. |
  | Durações | todas na faixa, com ≥ 4 s de folga; a mais rápida 0,86× os iniciais | seção 3 |
  | 7 Dado | 20,8% | 17–25% |

**Testes unitários (`sim-test.js`):**
- `freePoints`: nível 1 dá 0 e nível 2 dá 2 para as 5 raridades e 3 estrelas; Comum ★ 50 = 196, Comum ★★
  11 / 30 / 50 = 25 / 100 / 213, Mítico ★★★ 50 = 286;
- `costOf(0/1/10/11/20/30/50)` = 0/1/10/12/30/60/150 e `pointCost(0/9/10/19/20)` = 1/1/2/2/3;
- `validAlloc` corta pelo 150 e depois pelo custo, na ordem de `STAT_KEYS`; zera a Sorte; lixo (negativo,
  fração, texto, chave faltando) vira 0;
- `allocInfo`: `perStat`, `next` e `room` coerentes com `costOf` (comprar `room[k]` cabe; `room[k] + 1` não);
  `room.sorte` = 0;
- `weightedAlloc` e `botAlloc`: determinísticos, nunca passam dos pontos nem de 150, nunca põem ponto na
  Sorte; `botAlloc(h, de)` mantém o que está em `de` e só soma;
- `computeStats` não tem parâmetro de gear e fica em 1–150; `powerRating` igual com e sem peças no cavalo;
- Dado: chance do 2º dado 0 com Sorte 40, 0,5 com 60 e 1 com 80 ou mais;
- skill de tipo: os dois status do tipo valem × (1 + m·P) só no terço dela; fora dele, os valores normais;
- física: com todos os status em X ∈ {50, 80, 110, 140}, +10 em VEL, ACE, MAN, FOR, EST e GAR melhora o
  tempo médio (nenhum ganho zero até 150);
- determinismo: mesma seed e configuração dão o mesmo resultado; `VERSION` mudou.

**Testes de interface (`ui-test.mjs`):**
- +1, +5 e +10 somam ao rascunho e mostram o custo; desabilitam quando não cabe;
- a Sorte não tem botões de compra;
- "Distribuir sugerido" preenche o rascunho e não grava sem Confirmar;
- Confirmar em dois toques grava; Desfazer limpa;
- Redistribuir: a primeira é grátis; a segunda sem Rédea fica desabilitada; com Rédea (DEV) gasta 1;
- **com páreo aberto:** +N que subiria o Poder da ativa acima do da sala fica desabilitado, e Redistribuir
  da ativa fica desabilitado (regra §8 do `CLAUDE.md`);
- migração v5 → v6: pontos devolvidos, `respecFree` verdadeiro, peças e Pedras guardadas, sala aberta
  mantida, aviso uma vez;
- sem sub-aba Equipamento, sem aba Loja, sem Pedra do pódio no resultado;
- a aba Skills mostra o efeito da skill de tipo em pontos;
- "ⓘ" dos 7 status: `title` no computador, abrir/fechar no toque;
- o `jogo.html` sai sem modo DEV e sem gancho de teste (o build já confere).

## 14. O que a calibração mudou em relação à conversa

| Na conversa | Na spec | Por quê |
|---|---|---|
| Estrelas 1 / 1,2 / 1,5 | 1 / 1,09 / 1,22 | agora as estrelas multiplicam todo o crescimento (no bloco 1, só os pontos livres, ~30% dele); 1,22 põe o M5 dentro da faixa com a raridade nova |
| Pontos por nível: "a raridade define" | taxa 2 → 6 × 1,00…1,20 | o M4 (um degrau 72–88%) fecha com base e pontos juntos |
| Base 40 / 45 / 50 / 55 / 60 | 40 / 44 / 49 / 54 / 60 | ajuste junto com o fator de raridade nos pontos, para o M4 ficar na faixa |
| "Custo por faixa resolve" | custo por faixa **e** física linear até 150 | sem a física nova, Manobra e Força acima de 120 rendem 0 e a Estamina morre |
| Skill de tipo igual para os três | multiplica os dois status do tipo, força por tipo | com efeito próprio, investir no tipo rendia menos (seção 5) |
| Ajuste 1: bot × 1,3 no tipo | × 1,2 | com 1,3 o M6 do Raro 50 reprovava (60,2%) |
| Ajuste 1: M6 ≤ 60% também no Comum ★★ 50 e no Mítico ★★★ 50 | meta de até 64% e 67%; Raro até 62% | não fecha com os seis status valendo o mesmo e o custo convexo (seção 15, item 1) |
| Ajuste 1: toda `inc:*` e a `tipo` ≥ 47% | ≥ 45% | pior caso 46,1% nas 4 bases de seed |
| Rodada 3: custo subindo a cada 12 ou 15 pontos | a cada 10, como antes | inclinar perde ~5% dos pontos de status com qualquer degrau; degrau maior só sobe os status e afia a corrida (M6 Raro 50: 63,8% e 64,4%) |
| Ajuste 1: maior ÷ menor ≤ 1,25 | meta ≤ 1,3, alvo 1,25 (medido 1,15) | o intervalo de cada ganho é ±1,4 p.p.; o teto precisa de folga de ruído |
| Ajuste 2: testar 3→5 e 2→6 | 2→6 | o 2→6 só tem 1 p.p. de folga no 40→50; o 3→5 ficaria abaixo de 74% (estimado, não medido) |
| Ajuste 3: rever o Dado | (Sorte − 40)/40 | com Sorte de 40 a 76, a fórmula começa onde a Sorte começa |
| Ajuste 4: subir `vBase` | escala de tempo inteira (×1,067) | só `vBase` desmontava os iniciais |

## 15. Riscos e pendências

1. **A build equilibrada é a mais forte, e fica assim.** Com os seis status valendo o mesmo e o custo
   crescente, espalhar os pontos é o melhor. O bot (e o "Distribuir sugerido") é a equilibrada com leve
   inclinação no tipo e ganha dela por pouco (51–55% no duelo direto). Médias nas 4 bases de seed:

   | Classe no nível 50 | Bot contra todas | Equilibrada contra as inclinadas |
   |---|---|---|
   | Raro ★★ | 60,1% | 57,8% |
   | Comum ★★ | 61,6% | 61,7% |
   | Mítico ★★★ | 64,8% | 64,2% |

   As inclinadas ficam em 44–54%: são uma escolha de estilo que custa poucos pontos percentuais, não uma
   armadilha.
   - **Rodada 3 (custo subindo a cada 12 ou 15 pontos) não resolveu.** Enquanto um status passa do degrau,
     o custo é quase quadrático, e uma inclinação 2:1 compra ~5% menos status que a equilibrada com
     qualquer degrau. Um degrau maior só sobe os status, e a corrida, mais afiada, transforma a mesma perda
     em mais vitórias. No Mítico ★★★ 50, o domínio vem também de os status deixarem de valer o mesmo no
     topo.
   - **Para tirar o domínio, só mudando a regra** (nada disso foi medido):
     - um custo que para de subir (o "tudo num status" volta a ser opção);
     - um retorno extra por concentrar (por exemplo, a skill de tipo render mais com status alto).

     Fica para depois, se o teste no artefato mostrar que a equilibrada incomoda.
2. **Folga de ~1 p.p.** nas metas rebaseadas (seção 13) sobre o pior caso de 4 bases de seed. O
   `balance.js` é determinístico (passa igual depois de implementado); uma mudança que mexa na RNG pode
   pedir a faixa de novo.
3. **A skill de tipo mudou de natureza** (seção 5): a Maré Alta perdeu a recuperação de tanque, a Raízes o
   desconto de gasto, e a Labareda passou a dar Velocidade também. Textos, wiki e a aba Skills mudam junto.
4. **A corrida muda de sensação** (seção 3). Olhar a animação no artefato antes de integrar na `main`.
5. **Iniciais no nível 25 caem para a Prata** (eram Ouro): o meio da progressão ficou mais lento.
6. **Sorte vale pouco na corrida** (0,7 p.p.), por desenho: ela é só de nascimento e mexe no Dado.
7. **Sem fonte de Rédea nova no jogo normal** até os ginásios: quem gastar a redistribuição grátis só
   muda a build de novo pelo DEV.
8. **Ouro com menos uso:** a loja de peças some; o Ouro fica para as entradas, a cruza e a troca do Haras.
9. O bloco 2 previa a ferradura de tração e trocar de ferradura na preparação: fica em aberto com o
   equipamento suspenso.
