# Cavalos v3, bloco 1b: crescimento livre — calibração por simulação

2026-11-12. Medido numa cópia de `prototype/src` e `prototype/tools` (base babd236; o commit 9c37be3 que
entrou depois só mexe em docs). O repositório não foi tocado. Código da configuração recomendada em
`calib.diff` (`diff -ru src-orig src` + `diff -ru tools-orig tools`): `sim.js`, `data.js` e o `balance.js`
adaptado. Saída final do `balance.js` completo em `out_final_full.txt` (**128 metas, todas passam**).

**Método.** Igual ao do bloco 1: comparação pareada (mesma seed, mesmo mapa e mesmos rivais, com e sem a
mudança), duelos 1×1 com largada alternada em pista sorteada e campos de 6. Margem = IC de 95%. Cavalos
sintéticos com genética 0–31 sorteada por status, skills normais sorteadas (nascidas + aprendidas
esperadas pelo nível) e pontos pela build do bot. Para explorar usei um harness próprio
(`xlib.js`, `xtasks.js`, workers persistentes; `xsuite.sh` roda M1, A1, M9, M6 e M3–M5 de uma vez),
com cerca de 20 configurações (`cfg_g1.json` … `cfg_g17.json`, `cfg_FINAL.json`; saídas `out_suite_g*.txt`).
Status fixos de teste (montarias planas, A1) usam um gancho novo da corrida, `entry.statAdd`, no lugar
do "equipamento sintético" (que deixou de existir porque a corrida ignora as peças).

---

## 1. Fórmulas finais

```text
g ∈ 0..31 por status (genética); nada cresce sozinho
base(k)    = baseLo[raridade] + 16·g/31                       baseLo = 40 / 44 / 49 / 54 / 59
pontos(L)  = piso((L − 1) · 4,0 · fatorRaridade · fatorEstrelas)
             fatorRaridade = 1,00 / 1,03 / 1,06 / 1,09 / 1,12   fatorEstrelas = 1 / 1,10 / 1,26
custo      = o i-ésimo ponto num status (i = 0, 1, …) custa 1 + piso(i/10)
             comprar a = 10q + r pontos custa 5q(q+1) + r(q+1)   (10 → 10, 20 → 30, 30 → 60, 50 → 150, 70 → 280)
válida     = soma dos custos ≤ pontos(L) e base + a ≤ 150 em cada status
status(k)  = arredonda(base + a), preso a 1–150. Equipamento fora da corrida e do Poder.
```

No nível 50 (genética média, build do bot): Comum ★★ tem 215 pontos e status de corrida entre 61 e 78;
Mítico ★★★ tem 276 pontos. Dez níveis dão +43 pontos de status (1→11), +23 (20→30) e +17 (40→50): pelo
custo, o status cresce com a raiz dos pontos.

## 2. Constantes: hoje → proposto

| Nome | Hoje | Proposto |
|---|---|---|
| Crescimento por nível `gGrowBase/gGrowRange` | 0,30 + 0,08·g/31 | **sai** |
| `baseLo` C/M/R/L/Mí | 40 / 45 / 50 / 55 / 60 | **40 / 44 / 49 / 54 / 59** |
| `statCap` | 80 / 85 / 90 / 95 / 100 | **sai**; teto único `statMax` **150** |
| Pontos | piso((L−1)·starMult) | **piso((L−1)·`ptsRate`·`ptsMult`·`starMult`)** |
| `ptsRate` | — | **4,0** |
| `ptsMult` (raridade, novo) | — | **1,00 / 1,03 / 1,06 / 1,09 / 1,12** |
| `starMult` | 1 / 1,2 / 1,5 | **1 / 1,10 / 1,26** |
| `freeCapShare` (34%) | 0,34 | **sai**; `costStep` **10** |
| Equipamento na corrida e no Poder | mods, conjunto, anula penalidade, ×1,07 | **sai** (`weatherMultSet` sai) |
| `vRange` | 1,2 | **1,0** |
| Aceleração | 0,6 + 2,4·n | **1 / max(0,05; 1,2 − 0,7·n)** |
| Curva | min(1; 0,826 + 0,14·n) | **min(1; 0,728 + 0,17·n)** |
| Subida | min(1; 0,86 + 0,13·n) | **min(1; 0,824 + 0,11·n)** |
| Teto de n(Força)/n(Manobra) efetivos | 1,2 | **2** |
| `forcaSurfRelief` / `forcaCrowdRelief` | 0,5 / 0,8 (ficava negativo acima de 125) | **0,2 / 0,6**, com piso 0 |
| Clima nos status | n·m | **n + (m − 1)·0,5** (`weatherAdd`) |
| Teto do ritmo (meio / sprint) | 0,97 / 1,03 | **+0,04 / +0,075 × (n(est) − 0,5)** |
| Erro do jóquei | −2% … +6% | **−0,5% … +2,5%** |
| Atraso de largada | ×(1 − 0,5·min(n, 1)) | **×(1 − min(n, 1,5)/3)** |
| Garra: início da arrancada | 80% | **80% − 10%·(n − 0,5)** (o gatilho `final` vale no mesmo ponto) |
| Garra: chance / força | 0,10 + 0,70·n / 0,02 + 0,16·n | **0,50 + 0,15·n / 0,02 + 0,22·n** |
| Dado: chance do 2º dado | sorte/100 | **sorte/150** |
| Força da skill de tipo P | 1 + 0,4·(L−1)/49 + 0,4·ordem/4 | **por tipo** (nível / raridade): Fogo 0,70 / 0,55 · Água 0,65 / 0,50 · Grama 0,85 / 0,65 |
| Labareda / Maré Alta / Raízes | 0,23 / 1,8% + 1,2% / 0,07 + 1,2% | **0,16** / **2,0%** + 1,2% / igual |
| Drift (`curveBonus`) | 0,03 | **0,025** |
| Poder, pesos VEL/ACE/MAN/FOR/EST/GAR/SOR | 3,1 / 1,4 / 1,45 / 3,3 / 2,4 / 1,3 / 0,2 | **2,6 / 1,9 / 2,2 / 2,2 / 2,7 / 1,4 / 0** |
| Poder, skill | 18 × peso do gatilho | **9 ×** |
| Poder, tipo e conjunto | 80·P + 3/15/20 | **19·(L−1)/49 + 27·ordem/4** |
| Ligas (Prata…Lenda) | 810 / 910 / 1010 / 1110 / 1220 | **710 / 800 / 890 / 970 / 1060** |
| `botAlloc` | limite no status do tipo + rodízio | **por pesos** (seção 4) |

Sem mudança: `gBand` 16, tanque 66 + 20·n, gasto, piso, chuva, sol, vácuo, pelotão (raio e −3%),
`weatherMult` 1,03 / 1,08, Dado (1/3 e 2/3), skills (exceto Drift), chance de skill, vagas, pista.

## 3. A física acima de 100

Princípio: **toda fórmula é linear em n até 150** e o custo por faixa é o único retorno decrescente.
Medido em campos planos de 6 (todos os status em X, alvo com +10 num status, sem skills;
`out_x_hoje.txt` e `out_x_final.txt`), ganho pareado em p.p.:

| X | Hoje: VEL / ACE / MAN / FOR / EST / GAR | Proposto: VEL / ACE / MAN / FOR / EST / GAR |
|---|---|---|
| 50 | 18,5 / 7,2 / 9,4 / 19,6 / 13,3 / 8,0 | 23,0 / 17,4 / 23,3 / 26,4 / 27,8 / 13,4 |
| 80 | 24,2 / 10,5 / 14,9 / 26,2 / 9,5 / 10,5 | 26,8 / 23,5 / 26,0 / 27,2 / 29,8 / 19,9 |
| 110 | 40,8 / 18,0 / 26,0 / 20,7 / 6,6 / 20,4 | 28,1 / 29,2 / 27,4 / 30,9 / 29,0 / 28,4 |
| 140 | 53,2 / 24,4 / **0,0 / 0,0** / 2,5 / 27,2 | 32,7 / 35,0 / 30,3 / 31,8 / 31,7 / 39,4 |

O que estava errado e o que mudou:
1. **Saturação.** Curva, subida e o teto de 1,2 zeravam Manobra e Força acima de ~110–120; o alívio do
   pelotão virava aceleração acima de 125; a chance da Garra travava em 121; o Dado em Sorte 100.
   Curva e subida mantêm a inclinação (subiu um pouco na curva) com a base rebaixada para o teto 1 cair
   em n = 1,6; o resto foi reescalado para não travar antes de 150.
2. **A Estamina morria no topo.** Com tanque e velocidade altos, o teto fixo do ritmo (0,97 / 1,03) limita
   antes do tanque, e ponto de Estamina deixa de render (13,3 → 2,5). Agora a Estamina também sobe o
   teto do ritmo (centrado em 50, então o inicial médio não muda) e rende em qualquer nível.
3. **A Aceleração rendia ∝ 1/a².** A largada perde v²/2a metros, então cada ponto valia menos quanto mais
   alto. Com 1/a em linha reta, cada ponto encurta a largada igual (o piso 0,05 só entra em n = 1,64, acima de 150 com clima). Custa uma
   largada mais lenta (1,16 m/s² no inicial, hoje 1,75).
4. **A Garra rendia metade.** Uma arrancada sorteada só nos últimos 20% precisava de +45% de força para
   empatar com a Velocidade. Agora a Garra também adianta a arrancada, e a chance passou a depender
   menos do status (menos variância). Ela ainda é a mais convexa (13 → 39).
5. **O clima pesava mais no topo** (n·1,03 cresce com n). Como soma fixa vale o mesmo em qualquer nível.

Resíduo: com a Raízes Firmes (+0,07·P, até +0,175) e Manobra/Força ≥ ~143, a curva/subida bate o teto 1
dentro do terço do meio. O ponto continua rendendo nos outros dois terços.

## 4. Build dos bots e "Distribuir sugerido"

`weightedAlloc(cavalo, pesos, de)`: um ponto por vez no status de menor (pontos + 1)/peso cujo próximo
ponto ainda cabe; empate na ordem de `STAT_KEYS`; sem RNG. `botAlloc(cavalo, de)` usa os pesos de valor
(medidos no A1) **× 1,3 nos dois status do tipo**:

| Tipo | VEL | ACE | MAN | FOR | EST | GAR | SOR |
|---|---|---|---|---|---|---|---|
| Fogo | **1,17** | **0,975** | 0,9 | 1 | 1 | 0,7 | 0,01 |
| Água | 0,9 | 0,75 | 0,9 | 1 | **1,3** | **0,91** | 0,01 |
| Grama | 0,9 | 0,75 | **1,17** | **1,3** | 1 | 0,7 | 0,01 |

Sorte só recebe sobra. Com `de` (o alloc do jogador), continua a partir do que já foi comprado: é o
botão "Distribuir sugerido". É a build mais forte medida em quase todos os pontos (M6), então o jogador
não vence o bot só distribuindo melhor.

## 5. Poder e ligas

```text
Poder = 2,6·VEL + 1,9·ACE + 2,2·MAN + 2,2·FOR + 2,7·EST + 1,4·GAR + 0·SOR
        + 9 × peso do gatilho, por skill + 19·(nível − 1)/49 + 27·ordemDaRaridade/4
```

Regressão logística (sem intercepto) em 48.644 pares de 3.000 salas (`out_fit0.txt`); o reajuste em
79.686 pares de 5.000 salas com os pesos novos ficou no ruído (`out_fit1.txt`). O termo de tipo saiu de 80·P porque P agora difere por
tipo e o Poder não deve diferir: nível e raridade entram como termos próprios. Sorte deu −0,1 (ruído) e
fica 0. **Resíduo P1 máximo 1,0 p.p.** (Grama).

Ligas, pelo método de hoje (Fogo, genética 16, ★★, sem skills, build do bot; seis faixas iguais entre
Comum 1 = 624 e Lendário 50 = 1.149): **Bronze 0 · Prata 710 · Ouro 800 · Platina 890 · Diamante 970 ·
Lenda 1060**. Iniciais nível 1: 627–632 (Bronze); nível 25: 818–823 (Ouro); Mítico ★★★ 50 g31: 1.356.

## 6. Metas (balance.js completo final, `out_final_full.txt`)

| Meta | Faixa | Medido | Margem |
|---|---|---|---|
| M1 iniciais | 30–37%; terços 22–45% | 32,6 / 34,9 / 32,6%; terços 24,5–42,5% | ±0,8; mais apertado: Brasa curta 42,5 e longa 24,5 |
| M3 +10 níveis | ≥ 70% | 1→11: 88,8–93,7 · 20→30: 75,8–79,4 · **40→50: 72,1–72,4** | 40→50 com seeds independentes: 71,4–72,8 (±1,4) |
| M4 um degrau | 72–88% | 79,5–86,3% | máximo Raro×Mágico nível 1, 86,3 |
| M4 dois degraus | ≥ 95% | 97,0–98,7% | mínimo Mítico×Raro nível 50, 97,0 |
| M5 ★★★×★ / ★★×★ | 65–75 / 55–63% | 70,8–71,3 / 59,8–61,1% | seeds independentes: 71,5–72,4 / 61,6–62,1 |
| M6 builds (Raro ★★, 11/30/50) | ≤ 60% de média; ≥ 4 em 45–60 | máximo 55,3 / 56,9 / 58,4% (bot); 10 builds em 45–60 nos três | ±1,0 |
| M7 pior caso | < 150 | **144** (Mítico ★★★, g31, tudo num status) | — |
| M8 corrida viva | líder 1/3 ≤ 55%; ≥ 5% com < 1 m | 39,9% · **5,9%** | ±0,7 no segundo |
| M9 tipos (justo 16,7%) | 15,3–18,0% | 15,7–17,3% | ±0,4 |
| P1 resíduo do Poder | ≤ 5 p.p. | máximo 1,0 | — |
| P2 favorito vence | 35–55% | 53,2% | ±1,4 |
| A1 (+10 num status, Raro 20) | ≥ 3 p.p. e ≤ 3,2× a mediana | EST 12,6 · FOR 11,8 · MAN 11,2 · VEL 10,9 · ACE 8,7 · GAR 8,6 · SOR 0,1; maior = 1,14× a mediana (v3: 1,9×) | ±1,5 |
| S1 (14 skills) | 3–13 p.p. | 4,2 (Chama Final) a 12,3 (Drift) | Drift e Arranque (11,9) perto do teto |
| 2 inicial no seu clima, sem Dado | **45–68%** (era 45–65) | 60,4 / 65,7 / 63,3% | — |
| 3 / 3b / 3c especialistas | **65–100** / 70–100 / **65–100** | 100,0 / 74,5 / 75,5% | — |
| 5 durações | curta 88–104 s, longa 116–138 s | seção 9 | pouca folga |
| 7 Dado (Sorte 150 × 0) | 18–28% | 20,6% | — |
| 8 viradas / 9 determinismo / 10 chance de skill | iguais | 1,29 · ok · ≤ 2,4 p.p. | — |

## 7. Builds (M6)

Rodízio de duelos entre builds com a mesma genética e o mesmo elemento; 800 duelos por par; média =
vitórias contra as builds realistas. `all:k` só informa. Raro ★★ no `balance.js`; as duas últimas colunas
em `out_m6_final_extra.txt`.

| Build | Raro 11 | Raro 30 | Raro 50 | Comum ★★ 50 | Mítico ★★★ 50 |
|---|---|---|---|---|---|
| `bot` | **55,3** | **56,9** | **58,4** | **60,7** | 59,8 |
| `eq` (equilibrada) | 53,7 | 52,9 | 56,4 | 57,1 | **61,0** |
| `inc:vel` | 48,4 | 48,2 | 49,9 | 49,7 | 51,4 |
| `inc:acel` | 43,3 | 43,9 | 45,2 | 43,3 | 45,6 |
| `inc:man` | 52,1 | 49,6 | 46,9 | 48,6 | 46,2 |
| `inc:forca` | 48,3 | 49,7 | 50,5 | 49,6 | 49,9 |
| `inc:est` | 51,4 | 51,6 | 56,1 | 55,0 | 53,3 |
| `inc:garra` | 45,0 | 40,6 | 42,1 | 37,6 | 41,9 |
| `dup:vel+est` | 52,3 | 53,8 | 52,7 | 52,3 | 51,5 |
| `dup:vel+forca` | 49,3 | 51,8 | 49,6 | 48,4 | 48,8 |
| `dup:forca+est` | 51,8 | 54,1 | 50,4 | 54,2 | 50,1 |
| `tipo` (o dobro nos dois do tipo) | 49,3 | 46,9 | 41,8 | 43,6 | 40,5 |
| `all:vel` | 29,1 | 14,3 | 7,1 | 5,0 | 6,9 |
| `all:acel` | 24,5 | 7,8 | 3,8 | 1,6 | 4,1 |
| `all:man` | 29,4 | 11,0 | 5,6 | 5,2 | 5,2 |
| `all:forca` | 31,3 | 15,0 | 8,8 | 8,4 | 7,5 |
| `all:est` | 31,5 | 17,4 | 10,1 | 8,3 | 9,3 |
| `all:garra` | 23,8 | 6,5 | 2,2 | 1,0 | 2,6 |

**"Tudo num status" vence 1–10% no nível 50 e 24–32% no 11.** A Estamina precisou do ajuste da seção 3:
inclinada em Estamina é a terceira melhor no nível 50 (56,1%; na sonda do dono era a mais fraca, 47%).
As builds fracas são as inclinadas nos dois status de menor valor (Garra, Aceleração) e a `tipo`, que
dobra um deles para Fogo e Água.

## 8. M7: maior status no nível 50 (Fogo)

"Tudo": genética 31, todos os pontos em Velocidade. "Inclinada": genética 15, `inc:vel`. Entre parênteses, os pontos.

| Raridade | ★ | ★★ | ★★★ |
|---|---|---|---|
| Comum | 113 / 82 (196) | 116 / 84 (215) | 121 / 88 (246) |
| Mágico | 118 / 87 (201) | 121 / 90 (222) | 126 / 92 (254) |
| Raro | 124 / 93 (207) | 127 / 95 (228) | 132 / 99 (261) |
| Lendário | 130 / 98 (213) | 133 / 100 (235) | 138 / 104 (269) |
| Mítico | 136 / 104 (219) | 139 / 107 (241) | **144** / 109 (276) |

## 9. Durações (média do último a chegar)

| Corrida | Curta (1.400–1.599) | Média | Longa (1.800–2.000) |
|---|---|---|---|
| Iniciais nível 1 (hoje 95,9 / 110,2 / 127,1) | **103,5** | 118,3 | 135,8 |
| PVP de 8 sorteado | 97,6 | 111,8 | 128,5 |
| Comum ★★ nível 50 | 97,1 | 111,1 | 127,8 |
| Lendário ★★ nível 50 | 91,6 | 104,7 | 120,5 |
| Mítico ★★★ nível 50 | **89,3** | 101,9 | 117,4 |

Tudo dentro das faixas, com pouca folga nas duas pontas: os iniciais ficaram cerca de 7% mais lentos
(curvas e subidas mais lentas, largada mais lenta) e o Mítico ★★★ 50 é 14% mais rápido que eles. Não
proponho correção. Se o dono preferir os iniciais em ~96 s, a saída é subir `vBase`; aí o topo cai para
~83 s e as faixas de duração precisam passar a valer por liga.

## 10. Iniciais (não mudam)

A base no nível 1 do Comum é a de hoje (40 + 16·g/31). Genética e status iguais ao bloco 1:

| Inicial | | VEL | ACE | MAN | FOR | EST | GAR | SOR |
|---|---|---|---|---|---|---|---|---|
| Brasa (Fogo) | g | 24 | 24 | 14 | 12 | 12 | 14 | 12 |
| | status | 52 | 52 | 47 | 46 | 46 | 47 | 46 |
| Maré (Água) | g | 14 | 12 | 12 | 14 | 24 | 24 | 12 |
| | status | 47 | 46 | 46 | 47 | 52 | 52 | 46 |
| Ipê (Grama) | g | 16 | 12 | 24 | 24 | 14 | 12 | 10 |
| | status | 48 | 46 | 52 | 52 | 47 | 46 | 45 |

## 11. O que muda no `balance.js` (no diff)

- **Saem:** E1, E2a, E2b, E3, E4 e E3b (equipamento; `gearOf`, `tGearDuel`, `tE3b`); o M6 antigo (seis
  políticas, maior par) e o M7 antigo (status cheios).
- **Entram:** M6 novo (rodízio de 12 builds realistas + 6 "tudo num status"; meta "nenhuma média acima
  de 60%" e "≥ 4 em 45–60%"); M7 novo (tabela de máximos, pior caso < 150); durações das salas de nível 50
  (6 checagens). Total: 128 metas (hoje 126).
- **Rebaseadas:** 2 (45–65 → 45–68%), 3 (65–85 → 65–100%), 3c (75–93 → 65–100%), 7 (Sorte 100 → Sorte 150).
  Corrida menos ruidosa e curva mais inclinada: o especialista e o clima fixo decidem mais.
- **Políticas** por `weightedAlloc`; montarias planas e A1 pelo gancho `statAdd` no lugar dos mods de equipamento.

## 12. Riscos e dúvidas para o dono do projeto

1. **M3 40→50 fica 2 p.p. acima do piso (72%).** É o limite real: no topo, 10 níveis dão só +17 pontos de
   status. Subir a taxa rende pouco (3,9 → 4,5 deu +1 p.p.) e estoura o M7; tirar ruído estoura M4, M5 e M6.
2. **M6 fora do Raro ★★ fica no limite:** bot 60,7% no Comum ★★ 50 e equilibrada 61,0% no Mítico ★★★ 50
   (IC ±1). Com muitos pontos, o custo crescente premia espalhar. Se for preciso folga, a alavanca é dar
   um pouco mais de valor a Aceleração e Garra (as builds fracas sobem e as médias caem); não medido.
3. **A corrida mudou de sensação:** largada mais lenta, curvas e subidas mais lentas, iniciais ~7% mais
   demorados; "cansou" foi a 0% (o jóquei erra menos; hoje ~1%); a Garra dispara em 57% (hoje 43%) e mais
   cedo para quem tem mais Garra. Vale olhar a animação antes de fechar.
4. **Força da skill de tipo diferente por tipo** (a da Grama cresce mais): é o que fecha o M9. No Comum 1
   a Labareda rende 11,6 p.p. e as outras ~8 (M2, informativo).
5. **Equipamento sem efeito:** as peças continuam no jogo e na loja. A tela fica escondida (GDD §8.5);
   a especificação precisa dizer o que acontece com peças compradas, Pedra Negra e o bônus de conjunto.
6. **Sorte segue sem valor** (A1 0,1; peso 0 no Poder; o bot não compra Sorte).
7. **Gancho `statAdd`** é de teste e fica no `sim.js` de produção, como `noTypeSkill`. O servidor monta as entradas, então o cliente não o usa; a checagem do build (`__galope`, `Dev.`) não o pega.
8. **Quem implementa:** `game.js`, `dev.js`, `sim-test.js`, `ui-test.mjs` e `wiki.mjs` usam `statCap`,
   `statLimit`, `freeCapShare`, `powerRating(h, gear)` e `allocInfo().perStat/room` (agora `perStat` = alloc,
   `next` = custo do próximo ponto, `room` = quantos ainda cabem); `RaceSim.VERSION` deve subir. A ordem
   da RNG não mudou (o sorteio da Garra continua uma vez por corrida, agora em `garraFrom`).

## 13. Histórico: o que foi testado e descartado

| Alternativa | Resultado |
|---|---|
| Física de hoje com o modelo novo | Força/Manobra 0 acima de ~120; Estamina 13 → 2,5; +10 de Vel decidia 53 p.p. em 140 |
| Gasto pelo esforço (o ritmo, não a velocidade, gasta) | Brasa 26,9%, corridas +8%, cansou 13% |
| Tetos de ritmo altos para todos (1,04 / 1,10) | Estamina boa, mas Brasa 27,7% (M1) e Aceleração ~0 |
| Curva tratada como subida no gasto (com tetos de ritmo altos) | Brasa 21,0% |
| Aceleração 1/a linear com largada rápida (1/a = 0,83 − 0,45·n) | Aceleração 3 p.p. no nível 1; Fogo 15,0% no M9 |
| Bot inclinado ×1,5 nos dois do tipo | 49–50% no M6 (fraco) e M9 desequilibrado |
| Bot por valor puro (sem tipo) | 62,5% no M6 com a física intermediária |
| Garra quase certa (0,80 + 0,10·n) | ainda 4–6 p.p.; M4 até 93%, M5 até 79% |
| Garra com início adiantado forte (0,15) e força 0,34 | Garra a mais forte (12,6), inclinada em Garra 62% |
| Menos ruído (largada, jitter) e mais crescimento da skill de tipo (×2) | M3 40→50 não mexe |
| `baseLo` em degraus de 4 (40/44/48/52/56) | M4 dois degraus 94,9% no nível 1 |
| Taxa 3,2 e estrelas 1 / 1,07 / 1,15 (física intermediária) | M3 40→50 67–72%; M5 ★★★×★ 61–65% |
