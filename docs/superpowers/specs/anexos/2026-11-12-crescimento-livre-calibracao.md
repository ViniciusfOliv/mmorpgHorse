> Anexo da spec `docs/superpowers/specs/2026-11-12-crescimento-livre-design.md`: relatório da rodada 2 da calibração (`proposta2.md` na área de trabalho), que define o modelo final. O diff e o balanço guardados são os da rodada 3 (mesmo código; só o `balance.js` mudou): ver `2026-11-12-crescimento-livre-calibracao-r3.md`. Os outros nomes citados (`proposta.md`, `src-r1/`, `cfg_*.json`, `out_*.txt`) são da área de trabalho e não foram guardados; a rodada 1 está no commit 78e61cd.

# Cavalos v3, bloco 1b: crescimento livre — calibração, rodada 2

2026-11-12. Mesma cópia e mesmo harness da rodada 1 (`proposta.md`), partindo de `cfg_FINAL.json`. O
repositório não foi tocado (HEAD 78e61cd, só docs). A rodada 1 continua intacta: `proposta.md`,
`calib.diff`, `out_final_full.txt`, e o código dela em `src-r1/` e `tools-r1/`.

Nesta rodada: código em `calib2.diff` (completo: `diff -ru src-orig src` + `diff -ru tools-orig tools`).
Configuração em `cfg_FINAL2.json`, que é igual aos padrões do código (conferido com `xcheck_defaults.js`).
Relatório completo em `out_final2_full.txt`: **161 metas, todas passam** (eram 128).

## 0. O que mudou da rodada 1

| Ajuste | O que fiz | Efeito principal |
|---|---|---|
| **1. Seis status como foco** | Aceleração mais inclinada (largada um pouco mais lenta), curva mais inclinada, Garra com arrancada mais cedo e mais forte, menos reforço da Estamina no ritmo, um pouco mais de Velocidade. **A skill de tipo passou a multiplicar os dois status do tipo no seu terço** (seção 3). Bot: os seis valem 1, × 1,2 no tipo. Poder reajustado. | A1 no Raro 20: 9,6–11,0 p.p., maior/menor = **1,15** (era 1,46). Toda `inc:*` ≥ 47,2% e `tipo` ≥ 47,9% no Raro 11/30/50 |
| **2. Pontos crescendo com o nível** | Taxa de 2 (nível 2) a 6 (nível 50), média 4: o total no 50 não muda | 10 níveis dão +25 / +24 / +25 pontos de status (1→11 / 20→30 / 40→50; antes +44 / +22 / +16). **M3 40→50 = 75,0–77,0%** |
| **3. Sorte fora da distribuição** | Sorte não recebe pontos (`noBuy`); 2º dado = (Sorte − 40)/40 | Mítico g31 × sete Comum g0: 20,8% no Dado (com a fórmula antiga, 14,5%). Na corrida, +16 de Sorte = 0,7 p.p. |
| **4. Durações** | Reescala do tempo ×1,067 (velocidades ×k, acelerações ×k², gasto por segundo ×k: mesma corrida em metros) e faixas por liga | Iniciais curta 98,2 s / longa 128,6 s (era 103,5 / 135,8). Mais rápida: Mítico ★★★ 50, 84,1 s (14% abaixo) |

Subir só `vBase` desmontava os iniciais (Brasa 41,9%): a largada fica relativamente mais longa. A
reescala completa mantém tudo em metros.

## 1. Fórmulas finais

```text
base(k)    = baseLo[raridade] + 16·g/31                       baseLo = 40 / 44 / 49 / 54 / 60
pontos(L)  = piso(fatorRaridade · fatorEstrelas · [(L − 1)·2 + 4·(L − 1)(L − 2)/96])
             (taxa por nível: 2 no nível 2, sobe em linha reta até 6 no nível 50; no 50 = 196 × fatores)
             fatorRaridade = 1,00 / 1,05 / 1,10 / 1,15 / 1,20   fatorEstrelas = 1 / 1,09 / 1,22
custo      = o i-ésimo ponto num status custa 1 + piso(i/10)   (igual)
Sorte      = só a base (40–76); não recebe pontos
status(k)  = arredonda(base + a), 1–150
skill de tipo (no seu terço): os dois status do tipo valem × (1 + m·P)
             Labareda (Fogo, 1º terço): Vel e Ace, m = 0,19
             Raízes Firmes (Grama, 2º terço): For e Man, m = 0,15
             Maré Alta (Água, 3º terço): Est (teto do ritmo) e Gar, m = 0,33
             P = 1 + nívelT·(L − 1)/49 + raridadeT·ordem/4:  Fogo −0,15/0,15 · Água 0/0,15 · Grama 0,25/0,40
Dado       = chance do 2º dado (Sorte − 40)/40
```

Comum ★★ de genética média com a build do bot: 25 pontos no nível 11, 100 no 30, 152 no 40, 213 no 50
(rodada 1: 44 / 127 / 171 / 215).

## 2. Constantes: rodada 1 → rodada 2

| Nome | Rodada 1 | Rodada 2 |
|---|---|---|
| Pontos | piso((L−1)·4,0·fatores) | **piso(fatores·[(L−1)·2 + 4·(L−1)(L−2)/96])** (`ptsRate0` 2, `ptsRate1` 6) |
| `ptsMult` | 1,00/1,03/1,06/1,09/1,12 | **1,00/1,05/1,10/1,15/1,20** |
| `starMult` | 1/1,10/1,26 | **1/1,09/1,22** |
| `baseLo` | 40/44/49/54/59 | **40/44/49/54/60** |
| Sorte | recebia pontos | **`noBuy: ['sorte']`** |
| Dado | sorte/150 | **(sorte − 40)/40** (`sorteDiceLo` 40, `sorteDiceFull` 80) |
| `vBase` / `vRange` | 17,805 / 1,0 | **19,0 / 1,13** (×1,067 de escala e +6% em `vRange`) |
| Aceleração `aInv0` / `aInv1` / piso | 1,2 / 0,7 / 0,05 | **1,158 / 0,66 / 0,044** (antes da escala: 1,32 − 0,75·n) |
| `decel` / `drainK` / `startDelayMax` | 1,2 / 1,0 / 0,6 | **1,37 / 1,07 / 0,56** (escala de tempo) |
| Curva | 0,728 + 0,17·n | **0,704 + 0,185·n** (teto 1 ainda em n = 1,6) |
| Teto do ritmo pela Estamina | +0,04 / +0,075 | **+0,035 / +0,065** |
| Garra: início / força | −0,10·(n−0,5) / 0,02 + 0,22·n | **−0,14·(n−0,5) / 0,02 + 0,26·n** |
| Skill de tipo | Labareda ace ×(1+0,16P); Raízes +0,07P For/Man e −1,2%P gasto; Maré +2%P vel e +1,2%P tanque | **multiplica os dois status do tipo: 0,19 / 0,15 / 0,33** (`statMul`) |
| P por tipo (nível/raridade) | Fogo 0,70/0,55 · Água 0,65/0,50 · Grama 0,85/0,65 | **Fogo −0,15/0,15 · Água 0/0,15 · Grama 0,25/0,40** |
| Bot (`botW`) | valor (0,9/0,75/0,9/1/1/0,7) × 1,3 no tipo | **1 em todos × 1,2 no tipo** |
| Poder VEL/ACE/MAN/FOR/EST/GAR/SOR | 2,6/1,9/2,2/2,2/2,7/1,4/0 | **2,5/2,0/2,2/2,4/2,4/1,5/0** |
| Poder: skill / nível / raridade | 9 / 19 / 27 | **14 / 20 / 28** |
| Ligas Prata…Lenda | 710/800/890/970/1060 | **710/800/890/980/1070** |
| Arranque | ace ×1,2 por 100 m | **×1,18** (S1 13,2 → 12,4) |
| Canto da Iara / Chama Final | 7 s / 8 s | **9 s / 9,5 s** (S1 2,8 / 3,5 → 5,4 / 4,0) |

Sem mudança: custo por faixa, teto 150, `gBand`, subida, tanque, clima somado a n (0,5), chance da Garra,
erro do jóquei, pista, skills restantes.

## 3. Ajuste 1: os seis status, e por que a skill de tipo mudou

**Alavancas.** Aceleração: a inclinação de 1/a subiu 7% (e a largada ficou um pouco mais lenta, para o
piso continuar fora do alcance). Garra: a arrancada começa mais cedo (0,14) e é mais forte (0,26), tudo
linear até 150. Manobra: curva mais inclinada. Estamina: menos reforço no ritmo. Velocidade: +6%.

**A1 (+10 num status, campo de 6 Raros nível 20; `out_final2_full.txt`):**

| | VEL | ACE | MAN | FOR | EST | GAR | maior ÷ menor |
|---|---|---|---|---|---|---|---|
| Rodada 1 | 10,9 | 8,7 | 11,2 | 11,8 | 12,6 | 8,6 | 1,46 |
| **Rodada 2** | **10,8** | **10,7** | **11,0** | **10,1** | **10,3** | **9,6** | **1,15** |

Fora do Raro 20 a forma se mantém (`out_a1_r2i.txt`): Raro 20 com N = 6.000, 10,8–12,6 (1,17); Lendário 40,
10,5–12,4 (1,18). Sorte: 0,7 p.p.

**Por que `tipo` não passava de 43%.** Medi as builds por elemento (`out_r2_*`). Cada skill de tipo
*substituía* os status do próprio tipo:
- para o Fogo, `inc:acel` dava 45%, porque a Labareda já acelera;
- para a Água, Estamina e Garra rendiam menos, porque a Maré recuperava tanque e acelerava;
- para a Grama, a mesma coisa com Força e Manobra.

Investir no tipo tinha rendimento decrescente. Com o custo convexo e os status de valor igual, dobrar
dois status perde por ineficiência (as `dup:*` ficam em 43–45%). **A skill passou a multiplicar os dois
status do tipo no seu terço.** Agora investir no tipo tem sinergia, e é isso que dá identidade ao bot
(× 1,2) e leva `tipo` de 42% para 48–53%.
- **Calibração:** no nível 1 (P = 1) cada m reproduz o M1 e o M9 de antes.
- **Crescimento de P:** quase zero, porque o efeito já cresce com os status. O Fogo tem nível −0,15: a
  Velocidade multiplicada vale cada vez mais em status alto. Em pontos absolutos a Labareda ainda cresce
  (nível 1: +10 em Vel e Ace; Lendário 50: cerca de +20).
- **Alternativa descartada:** reforçar P com os status do tipo, sem mudar o efeito. `tipo` foi só a 45,8%
  e desequilibrou o M9.

## 4. Ajuste 2: pontos crescendo com o nível

| r0 / r1 | Pontos Comum ★★ (11 / 30 / 40 / 50) | M3 1→11 | 20→30 | 40→50 |
|---|---|---|---|---|
| 4 / 4 (rodada 1) | 44 / 127 / 171 / 215 | 88,8–93,7 | 75,8–79,4 | 72,1–72,4 |
| **2 / 6** | **25 / 100 / 152 / 213** | **78,0–78,5** | **76,1–77,8** | **75,0–77,0** |

Fiquei com 2/6, o extremo pedido: com 3/5 o Comum ★★ ganha +52 pontos do 40 ao 50 (2/6: +61; rodada 1:
+44), metade do ganho extra; pela sensibilidade medida, ~+1,5 p.p. no M3, abaixo do alvo de 74
(estimativa, não rodei 3/5 isolado). O 1→11 segue com folga de 8 p.p. M6 no nível
11: máximo 53,7%, com 12 builds entre 45 e 60%.

## 5. Ajuste 3: Sorte

Sorte vai de 40 (Comum g0) a 76 (Mítico g31) e não recebe pontos (`validAlloc` zera, `allocInfo.room` = 0,
`weightedAlloc`/`botAlloc` ignoram). Com sorte/150 a diferença no Dado era quase invisível (Mítico g31 ×
sete Comum g0: 14,5%). Com **(Sorte − 40)/40**:

| Dado (1 contra 7, empate = meio) | Vence |
|---|---|
| Sorte 76 (Mítico, g31) × sete de 40 (Comum, g0) | **20,8%** (meta nova 17–25%) |
| Sorte 56 (Comum, g31) × sete de 40 | 16,2% |
| Sorte 40 × sete de 40 | 12,6% |

Na corrida, +16 de Sorte (genética 0 → 31) vale **0,7 ± 0,6 p.p.** de vitória (Raro 20, campo de 6): ela
só mexe no Dado (o clima) e na chance de skill. A Sorte continua com peso 0 no Poder (a regressão deu
0,08).

## 6. Ajuste 4: durações e faixas por liga

Salas de 8 sorteadas como no PVP (1.500), liga = a do Poder médio da sala:

| Liga | Faixa curta / longa | Curta (média) | Longa (média) |
|---|---|---|---|
| Bronze (e iniciais nível 1) | 92–104 / 121–136 s | 98,7 (iniciais 98,2) | 129,0 (iniciais 128,6) |
| Prata | 90–102 / 119–133 s | 96,5 | 127,2 |
| Ouro | 88–100 / 117–131 s | 94,3 | 123,6 |
| Platina | 86–98 / 114–128 s | 92,6 (Comum ★★ 50: 92,3) | 120,7 (121,4) |
| Diamante | 84–96 / 112–126 s | 89,0 | 119,8 |
| Lenda | 80–94 / 106–122 s | 87,8 (Lendário ★★ 50: 86,7; Mítico ★★★ 50: **84,1**) | 113,9 (113,9; 110,3) |

Corrida mais rápida ÷ iniciais = 0,86 (meta ≥ 0,80). A v3 tinha 95,9 / 127,1 s nos iniciais.

## 7. Bot, Poder e ligas

- **Bot:** os seis valem o mesmo no A1, então o peso de valor é 1 em todos, × **1,2** nos dois do tipo.
  Pedido era × 1,3. Com 1,3, 1,2 e 1,1 o bot mede 60,2 / 59,9 / 60,0% no M6 do Raro 50; a vantagem sobre
  a equilibrada vem da sinergia com a skill de tipo, não da força da inclinação. Usei 1,2 porque com 1,3
  o completo reprovava (60,2%).
- **Poder:** regressão logística em 64.318 pares de 4.000 salas (`out_fit2.txt`). Pesos 2,5 / 2,0 / 2,2 /
  2,4 / 2,4 / 1,5 / 0; skill 14 × peso do gatilho; 20·(L−1)/49 + 28·ordem/4. **P1 máximo 1,1 p.p.**
  (alvo ≤ 2).
- **Ligas:** Comum 1 = 624, Lendário 50 = 1.154 → **710 / 800 / 890 / 980 / 1070**. Os iniciais no nível 25
  caem da Ouro para a Prata (782–791), porque o meio da progressão tem menos pontos.

## 8. Metas (`out_final2_full.txt`, completo)

| Meta | Faixa | Medido | Margem |
|---|---|---|---|
| M1 iniciais | 30–37%; terços 22–45% | 31,8 / 33,3 / 34,9%; terços 26,7–38,9% | folgada |
| M3 +10 níveis | ≥ 70% (alvo 40→50 ≥ 74) | 1→11: 78,0–78,5 · 20→30: 76,1–77,8 · **40→50: 75,0–77,0** | 40→50: +1,0 sobre o alvo 74 |
| M4 um / dois degraus | 72–88 / ≥ 95% | 78,1–85,0 / **95,4–98,7** | dois degraus no 50: **+0,4** |
| M5 ★★★×★ / ★★×★ | 65–75 / 55–63% | 68,7–70,5 / 59,6–62,3% | ★★ Mítico +0,7 |
| M6 máximo (Raro 11/30/50) | ≤ 60% | 53,7 / 53,2 / **59,9%** (bot) | **+0,1** |
| M6 `inc:*` (6) e `tipo` | **≥ 47% (nova)** | mínimo `inc:acel` 47,2% (nível 11), `tipo` 47,9% (nível 50) | **+0,2** |
| M6 builds em 45–60% | ≥ 4 | 12 / 12 / 10 | — |
| M6 Comum ★★ 50 / Mítico ★★★ 50 (informativo) | ≤ 60% desejado | **61,4% / 64,9%** (bot) | não passa |
| M7 pior caso | < 150 | 146 | — |
| M8 corrida viva | líder 1/3 ≤ 55%; ≥ 5% com < 1 m | 38,1% · 5,6% | +0,6 |
| M9 tipos | 15,3–18,0% | 16,3–17,2% | folgada |
| P1 / P2 | ≤ 5 (alvo 2) / 35–55% | 1,1 / 52,1% | — |
| A1 | ≥ 3 p.p.; maior ÷ menor **≤ 1,3 (nova; alvo 1,25)** | 9,6–11,0; 1,15× | — |
| S1 | 3–13 p.p. | 4,0 (Chama Final) a 12,7 (Drift) | Drift e Arranque (12,4) perto do teto |
| 2 / 3 / 3b / 3c | 45–68 / 65–100 / 70–100 / 65–100 | 61,6–66,8 / 100 / 77,5 / 76,5 | — |
| 5 durações por liga (21, nova) | seção 6 | todas dentro | ≥ 4 s (a menor: Mítico ★★★ 50, 84,1 s para o piso 80) |
| 7 Dado (reescrita) | 17–25% | 20,8% | — |
| 8 / 9 / 10 | iguais | 1,31 · ok · ≤ 2,4 p.p. | — |

## 9. M6 (Raro ★★; 800 duelos por par)

| Build | Nível 11 | Nível 30 | Nível 50 |
|---|---|---|---|
| `bot` | 50,8 | 53,0 | **59,9** |
| `eq` | 50,3 | 52,0 | 57,9 |
| `inc:vel` / `acel` / `man` | 50,9 / **47,2** / 53,7 | 49,2 / 47,4 / 49,9 | 49,3 / 50,2 / 50,5 |
| `inc:forca` / `est` / `garra` | 48,5 / 50,3 / 50,9 | 48,5 / 48,9 / 47,9 | 50,6 / 50,7 / 49,9 |
| `dup:vel+est` / `vel+forca` / `forca+est` | 50,2 / 48,1 / 48,5 | 49,9 / 48,8 / 51,1 | 43,3 / 45,2 / 44,5 |
| `tipo` | 50,7 | 53,2 | **47,9** |
| `all:*` (informação) | 30,9–40,9 | 15,6–18,7 | 7,1–8,9 |

Informativo (pontas): Comum ★★ 50, bot 61,4 e equilibrada 59,3; Mítico ★★★ 50, bot 64,9 e equilibrada
63,6, com as duplas em 41–43%.

## 10. M7 e iniciais

| Nível 50, Fogo ("tudo" g31 / inclinada g15) | ★ | ★★ | ★★★ |
|---|---|---|---|
| Comum | 113 / 82 | 116 / 84 | 120 / 87 |
| Raro | 125 / 93 | 128 / 95 | 132 / 99 |
| Mítico | 139 / 106 | 142 / 109 | **146** / 112 |

Iniciais: genética e status no nível 1 iguais aos da rodada 1 (Comum `baseLo` 40). Poder 626–633 (Bronze).

## 11. O que mudou no `balance.js`

- **Novas:**
  - M6 `inc:*` e `tipo` ≥ 47% nos níveis 11, 30 e 50 (21 checagens);
  - A1 maior ÷ menor ≤ 1,3 (alvo 1,25; o IC de cada ganho é ±1,4 p.p., então o teto tem folga de ruído);
  - durações por liga: 12 checagens de PVP + 2 dos iniciais (Bronze) + 6 das salas de nível 50 na liga
    delas + "mais rápida ≥ 80% dos iniciais".
- **Reescrita:** a 7 (Mítico g31 × sete Comum g0, 17–25%).
- **Informativo:** M6 no Comum ★★ 50 e no Mítico ★★★ 50.
- **Saiu:** a faixa única de duração (10 checagens).
- **Total:** 161 metas. Tempo do completo: 197 s.

## 12. Riscos e dúvidas para o dono do projeto

1. **Várias metas passam com margem de ruído:**
   - M6 máximo no Raro 50: 59,9% (bot);
   - `inc:acel` 47,2–47,4% nos níveis 11 e 30 (piso 47);
   - M4 de dois degraus no 50: 95,4–95,5%.

   Nada disso é estrutural, mas uma rodada com outras seeds pode reprovar uma delas.
2. **O Ajuste 1 briga com o "nenhuma acima de 60%".** Com os seis status de valor igual e o custo
   convexo, a melhor build é a equilibrada com leve inclinação no tipo, e as inclinadas pagam ~9% dos
   pontos. No Raro ★★ fica no limite; nas pontas não fecha (Comum ★★ 50 61,4%, Mítico ★★★ 50 64,9%; com
   286 pontos e status altos a corrida é mais afiada). Pela prioridade 1 > 2 > 4 > 3, mantive o achatamento.
   Saídas possíveis, nenhuma medida: aceitar ~62% nas pontas; ou definir as inclinadas como 1,5:1 em vez de
   2:1. Não mudei a definição das builds.
3. **A skill de tipo mudou de natureza** (multiplica status em vez de dar efeito próprio). A Labareda
   agora também dá Velocidade; a Maré Alta perdeu a recuperação de tanque e o +2% de velocidade; a Raízes
   perdeu o −1,2% de gasto. O P da Labareda *cai* com o nível (−0,15), embora o efeito em pontos cresça.
   Textos, wiki e a tela da aba Skills precisam mostrar o efeito em pontos, não em %.
4. **Cansou continua em 0%** e a Garra dispara em 58% (era 43% na v3).
5. **Os iniciais no nível 25 caem para a Prata** (o meio da progressão ficou mais lento).
6. **Escala de tempo:** seis constantes mudaram juntas (`vBase`, `vRange`, `aInv*`, `decel`, `drainK`,
   `startDelayMax`). As durações das skills em segundos (Chama Final, Canto da Iara) não foram escaladas
   e por isso precisaram de ajuste.
7. **Quem implementa:** além do que a rodada 1 listou:
   - `allocInfo().room.sorte` = 0 e a tela de status precisa travar a Sorte;
   - o efeito novo da skill de tipo (`statMul`, valores em `r.Z` no terço);
   - `GameData.TYPE_SKILLS[*].effect` passa a ter `statMul`.

   As chaves antigas de efeito continuam aceitas, sem uso. A ordem da RNG não mudou.

## 13. Histórico da rodada 2 (configurações em `cfg_r2*.json`, saídas `out_suite_r2*.txt` e `out_r2_*`)

| Tentativa | Resultado |
|---|---|
| Subir só `vBase` | Brasa 41,9% (a largada pesa mais) |
| Aceleração mais inclinada + Garra 0,26 (r2a) | Ace ok; Garra 7–9; Fogo 19% no M9; `tipo` 42,6% |
| Labareda menor e arrancada adiantando 0,14 (r2b) | A1 ok no Raro; `tipo` 43,2% |
| Sinergia por P (P += K·(n dos status do tipo − 0,5)) | K = 4: `tipo` 45,8%, M9 Fogo 13,7 / Água 19,8 |
| Skill multiplicando os status, com o P de antes | Fogo 30% no Lendário 50: o efeito já cresce com os status |
| Labareda só na Aceleração | Brasa 44,7% e o Fogo ainda crescia com o nível |
| Bot × 1,3 / × 1,1 | 60,2 / 60,0% no M6 do Raro 50 |
| Pontos 3/5 | não medido isolado; o 2/6 já tem só +1 p.p. de folga no 40→50 |

Observação de método: no meio da rodada o `mkcfg.py` mesclou efeitos antigos e novos da skill de tipo
(o dicionário é mesclado, não trocado). Os testes com a mistura foram descartados e refeitos com a troca
limpa; a tabela acima só tem os válidos.
