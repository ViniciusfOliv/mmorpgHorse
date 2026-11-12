> Anexo da spec `docs/superpowers/specs/2026-11-12-crescimento-livre-design.md`: teste com 4 bases de seed da rodada 3 (`robustez3.md` na área de trabalho). Corrige o anexo `…-robustez.md` da rodada 2 no M4 (94,97%, não 95,0) e no M5.

# Rodada 3: robustez em 4 bases de seed (degraus 10, 12 e 15)

2026-11-12. Mesmo método do `robustez2.md`:
- script `xr3.js` (as tarefas do `balance.js`, a mesma ordem de builds, o mesmo N de cada meta);
- 4 bases: a original, +1.000.003, +2.000.006 e +3.000.009;
- a ordem da RNG da corrida não muda.

Configurações:
- degrau 10 = `cfg_FINAL2.json`, a rodada 2 e a configuração final desta rodada;
- degrau 12 e degrau 15 = a mesma configuração com `costStep` trocado (`cfg_r3_s12.json`, `cfg_r3_s15.json`).

Saídas brutas: `rob3_s10.json`, `rob3_s12.json`, `rob3_s15.json` e `out_r3_s*_4seeds.txt`. Tempo de máquina:
~10 min por degrau.

Em cada célula: os 4 valores (base original primeiro), o pior e a média, e quantas bases reprovam no
critério da rodada 3.

### M6, maior média de build realista (critério da rodada 3: ≤ 60% em todas as bases)

| Medida | degrau 10 (4 bases) | degrau 12 (4 bases) | degrau 15 (4 bases) |
|---|---|---|---|
| Raro ★★ 11 (build mais forte) | 53,7 / 53,4 / 54,1 / 54,6 → máx 54,6, média 54,0, reprovam 0 | 53,7 / 53,4 / 54,1 / 54,6 → máx 54,6, média 54,0, reprovam 0 | 53,7 / 53,4 / 54,1 / 54,6 → máx 54,6, média 54,0, reprovam 0 |
| Raro ★★ 30 (build mais forte) | 53,2 / 53,6 / 54,1 / 53,5 → máx 54,1, média 53,6, reprovam 0 | 52,8 / 52,6 / 52,5 / 51,8 → máx 52,8, média 52,4, reprovam 0 | 56,3 / 57,0 / 58,4 / 56,9 → máx 58,4, média 57,1, reprovam 0 |
| Raro ★★ 50 (build mais forte) | 59,9 / 60,4 / 60,6 / 59,5 → máx 60,6, média 60,1, reprovam 2 | 63,1 / 63,5 / 63,5 / 63,8 → máx 63,8, média 63,5, reprovam 4 | 64,0 / 64,4 / 63,8 / 63,6 → máx 64,4, média 64,0, reprovam 4 |
| Comum ★★ 50 (build mais forte) | 61,4 / 61,6 / 61,3 / 62,3 → máx 62,3, média 61,6, reprovam 4 | 63,9 / 63,2 / 62,8 / 63,2 → máx 63,9, média 63,3, reprovam 4 | 59,9 / 60,9 / 59,8 / 60,0 → máx 60,9, média 60,2, reprovam 2 |
| Mítico ★★★ 50 (build mais forte) | 64,9 / 65,4 / 64,4 / 64,4 → máx 65,4, média 64,8, reprovam 4 | 65,1 / 66,1 / 64,8 / 64,6 → máx 66,1, média 65,1, reprovam 4 | 70,4 / 70,8 / 70,2 / 69,9 → máx 70,8, média 70,3, reprovam 4 |

### M6, equilibrada contra as seis inclinadas

| Medida | degrau 10 (4 bases) | degrau 12 (4 bases) | degrau 15 (4 bases) |
|---|---|---|---|
| Raro ★★ 11 | 50,2 / 51,1 / 49,7 / 49,2 → máx 51,1, média 50,0 | 50,2 / 51,1 / 49,7 / 49,2 → máx 51,1, média 50,0 | 50,2 / 51,1 / 49,7 / 49,2 → máx 51,1, média 50,0 |
| Raro ★★ 30 | 53,2 / 54,5 / 52,2 / 53,6 → máx 54,5, média 53,4 | 50,3 / 51,4 / 51,0 / 52,4 → máx 52,4, média 51,3 | 54,4 / 54,3 / 55,0 / 54,3 → máx 55,0, média 54,5 |
| Raro ★★ 50 | 57,1 / 57,3 / 58,1 / 58,5 → máx 58,5, média 57,8 | 64,7 / 65,5 / 65,2 / 66,1 → máx 66,1, média 65,4 | 63,2 / 63,1 / 64,5 / 63,9 → máx 64,5, média 63,7 |
| Comum ★★ 50 | 60,7 / 61,6 / 62,3 / 62,3 → máx 62,3, média 61,7 | 65,8 / 64,2 / 64,4 / 64,4 → máx 65,8, média 64,7 | 61,7 / 61,1 / 61,1 / 61,0 → máx 61,7, média 61,2 |
| Mítico ★★★ 50 | 65,0 / 63,9 / 63,6 / 64,2 → máx 65,0, média 64,2 | 64,1 / 61,9 / 62,9 / 63,3 → máx 64,1, média 63,0 | 71,8 / 72,1 / 71,4 / 70,0 → máx 72,1, média 71,3 |

### M6, menor `inc:*` ou `tipo` (critério: ≥ 47%)

| Medida | degrau 10 (4 bases) | degrau 12 (4 bases) | degrau 15 (4 bases) |
|---|---|---|---|
| Raro ★★ 11 | 47,2 / 47,2 / 47,4 / 47,2 → mín 47,2, média 47,3, reprovam 0 | 47,2 / 47,2 / 47,4 / 47,2 → mín 47,2, média 47,3, reprovam 0 | 47,2 / 47,2 / 47,4 / 47,2 → mín 47,2, média 47,3, reprovam 0 |
| Raro ★★ 30 | 47,4 / 47,3 / 46,1 / 47,2 → mín 46,1, média 47,0, reprovam 1 | 48,1 / 48,7 / 47,9 / 48,4 → mín 47,9, média 48,3, reprovam 0 | 47,6 / 45,7 / 45,8 / 46,3 → mín 45,7, média 46,4, reprovam 3 |
| Raro ★★ 50 | 47,9 / 47,3 / 48,9 / 48,8 → mín 47,3, média 48,2, reprovam 0 | 45,1 / 45,4 / 45,7 / 45,8 → mín 45,1, média 45,5, reprovam 4 | 46,4 / 45,6 / 45,6 / 45,7 → mín 45,6, média 45,8, reprovam 4 |
| Comum ★★ 50 | 44,3 / 44,4 / 44,2 / 45,3 → mín 44,2, média 44,5, reprovam 4 | 43,7 / 44,8 / 43,7 / 43,5 → mín 43,5, média 43,9, reprovam 4 | 44,4 / 44,3 / 44,4 / 45,7 → mín 44,3, média 44,7, reprovam 4 |
| Mítico ★★★ 50 | 44,9 / 45,3 / 46,0 / 44,9 → mín 44,9, média 45,3, reprovam 4 | 45,4 / 45,2 / 45,7 / 44,5 → mín 44,5, média 45,2, reprovam 4 | 42,5 / 42,4 / 42,8 / 41,4 → mín 41,4, média 42,3, reprovam 4 |

### `all:*`, maior "tudo num status" (critério: < 35% nos níveis 30 e 50)

| Medida | degrau 10 (4 bases) | degrau 12 (4 bases) | degrau 15 (4 bases) |
|---|---|---|---|
| Raro ★★ 11 | 40,9 / 40,4 / 40,5 / 40,1 → máx 40,9, média 40,5 | 42,1 / 42,3 / 41,8 / 42,0 → máx 42,3, média 42,0 | 44,6 / 45,9 / 44,8 / 44,5 → máx 45,9, média 45,0 |
| Raro ★★ 30 | 18,7 / 18,1 / 18,9 / 18,9 → máx 18,9, média 18,6, reprovam 0 | 18,3 / 17,9 / 18,9 / 18,1 → máx 18,9, média 18,3, reprovam 0 | 17,1 / 16,5 / 17,5 / 17,1 → máx 17,5, média 17,0, reprovam 0 |
| Raro ★★ 50 | 8,9 / 9,0 / 8,7 / 9,7 → máx 9,7, média 9,1, reprovam 0 | 7,4 / 7,8 / 7,6 / 8,2 → máx 8,2, média 7,7, reprovam 0 | 8,2 / 8,3 / 7,8 / 9,2 → máx 9,2, média 8,4, reprovam 0 |
| Comum ★★ 50 | 7,5 / 7,9 / 8,0 / 7,3 → máx 8,0, média 7,7, reprovam 0 | 6,4 / 6,3 / 7,8 / 7,3 → máx 7,8, média 7,0, reprovam 0 | 6,2 / 5,7 / 6,9 / 6,2 → máx 6,9, média 6,2, reprovam 0 |
| Mítico ★★★ 50 | 14,6 / 14,7 / 14,9 / 14,0 → máx 14,9, média 14,5, reprovam 0 | 13,7 / 12,6 / 14,2 / 13,3 → máx 14,2, média 13,5, reprovam 0 | 14,3 / 13,9 / 14,3 / 13,6 → máx 14,3, média 14,0, reprovam 0 |

### Progressão

| Medida | degrau 10 (4 bases) | degrau 12 (4 bases) | degrau 15 (4 bases) |
|---|---|---|---|
| M3 40→50, menor das três raridades (alvo ≥ 74) | 75,0 / 75,3 / 75,6 / 76,0 → mín 75,0, média 75,5, reprovam 0 | 75,6 / 76,6 / 76,7 / 75,8 → mín 75,6, média 76,2, reprovam 0 | 75,7 / 76,5 / 75,8 / 77,1 → mín 75,7, média 76,3, reprovam 0 |
| M4 dois degraus no 50, menor (Mítico×Raro, Raro×Comum; ≥ 95) | 95,4 / 95,4 / 95,6 / 95,0 → mín 95,0, média 95,3, reprovam 1 | 95,0 / 95,6 / 95,0 / 95,0 → mín 95,0, média 95,1, reprovam 1 | 94,7 / 95,3 / 94,3 / 94,9 → mín 94,3, média 94,8, reprovam 3 |
| M4 um degrau, maior (≤ 88) | 85,0 / 83,7 / 84,3 / 85,1 → máx 85,1, média 84,5, reprovam 0 | 85,0 / 83,7 / 84,3 / 85,1 → máx 85,1, média 84,5, reprovam 0 | 85,0 / 83,7 / 84,3 / 85,1 → máx 85,1, média 84,5, reprovam 0 |
| M5 ★★★×★, maior (≤ 75) | 70,5 / 72,4 / 72,5 / 71,3 → máx 72,5, média 71,7, reprovam 0 | 72,4 / 73,3 / 72,2 / 72,4 → máx 73,3, média 72,6, reprovam 0 | 74,0 / 77,0 / 74,7 / 74,4 → máx 77,0, média 75,0, reprovam 1 |
| M5 ★★×★, maior (≤ 63) | 62,3 / 62,8 / 63,1 / 62,7 → máx 63,1, média 62,7, reprovam 1 | 64,9 / 64,5 / 64,7 / 65,8 → máx 65,8, média 65,0, reprovam 4 | 65,8 / 65,4 / 65,5 / 65,5 → máx 65,8, média 65,5, reprovam 4 |

## Correção do `robustez2.md`

Na base +3.000.009, o M4 de dois degraus no nível 50 (Raro × Comum) é **94,97%**, abaixo do piso de 95. O
`robustez2.md` (que fica intacto) dizia "95,0, no piso exato, 0 reprovam" por causa do arredondamento: na
verdade reprova em 1 de 4 bases. Idem o M5 ★★ × ★ do Mítico: 63,13% numa base, acima do teto de 63.

## A configuração final (degrau 10) contra as faixas rebaseadas do `balance.js` da rodada 3

| Meta | Faixa nova (era) | Pior das 4 bases | Reprovam | Folga no pior caso |
|---|---|---|---|---|
| M6 maior média, Raro ★★ 11/30/50 | ≤ 62% (60) | 60,6 (Raro 50) | 0 | 1,4 |
| M6 maior média, Comum ★★ 50 | ≤ 64% (informativo) | 62,3 | 0 | 1,7 |
| M6 maior média, Mítico ★★★ 50 | ≤ 67% (informativo) | 65,4 | 0 | 1,6 |
| M6 menor `inc:*` ou `tipo`, Raro 11/30/50 | ≥ 45% (47) | 46,1 (`inc:acel`, nível 30) | 0 | 1,1 |
| `all:*`, níveis 30 e 50 | < 35% (nova) | 18,9 (Raro 30) | 0 | 16 |
| M4 dois degraus | ≥ 94% (95) | 94,97 (Raro × Comum, 50) | 0 | 0,97 |
| M5 ★★ × ★ | ≤ 64% (63) | 63,13 (Mítico) | 0 | 0,9 |
| M3 40→50 | alvo ≥ 74 (meta ≥ 70) | 75,0 (Comum) | 0 | 1,0 sobre o alvo |
