> Anexo da spec `docs/superpowers/specs/2026-11-12-crescimento-livre-design.md`: relatório da rodada 3 da calibração (`proposta3.md` na área de trabalho). O código final é o da rodada 2; mudou só o `balance.js`. Guardados: `calib3.diff` → `2026-11-12-crescimento-livre-calib.diff`, `out_final3_full.txt` → `2026-11-12-crescimento-livre-balanco.txt`, `robustez3.md` → `2026-11-12-crescimento-livre-robustez-r3.md`. Os outros nomes citados são da área de trabalho e não foram guardados.

# Cavalos v3, bloco 1b: crescimento livre — calibração, rodada 3 (degrau do custo)

2026-11-12. Partindo de `cfg_FINAL2.json` e do código da rodada 2, congelado em `src-r2/` e `tools-r2/`.
As entregas da rodada 2 continuam intactas (conferido por MD5 em `r2_entrega.md5`). O repositório não foi
tocado.

**Resultado: a regra de parada foi acionada.** Nem o degrau 12, nem o 15, nem a variante testada fecham os
itens 1–3 do aceite. Os dois degraus pioram o domínio da equilibrada em vez de melhorar. Fica a rodada 2
(degrau 10) com as metas rebaseadas ao medido nas 4 bases de seed.

Entregas:
- `calib3.diff`: completo contra `src-orig/` e `tools-orig/`. O `src` é o da rodada 2; muda só o `balance.js`.
- `out_final3_full.txt`: **165 metas, todas passam**.
- `robustez3.md`: as 4 bases nos três degraus.

Tempo de máquina: ~45 min.

## 0. O que mudou da rodada 2

- **Código e constantes:** nada. `src/` é idêntico a `src-r2/`, e `cfg_FINAL2.json` continua sendo o padrão.
- **`balance.js`:** as metas apertadas foram rebaseadas pelo pior caso das 4 bases mais uma folga de ruído,
  e as pontas viraram meta (seção 4). Total: 165 metas (eram 161).
- **Correção da robustez da rodada 2:** o M4 de dois degraus no 50 (Raro × Comum) dá **94,97%** numa das
  bases, abaixo do piso de 95 (o `robustez2.md` dizia "95,0, passa"). O M5 ★★ × ★ do Mítico dá 63,13% numa
  base, acima do teto de 63. Os dois entram nas faixas rebaseadas.

## 1. Por que o degrau não resolve

Fiz a conta antes de medir. Enquanto um status passa de N pontos, o custo "1 + piso(i/N)" é
aproximadamente C(a) ≈ a + a²/(2N): quadrático. Com orçamento fixo e custo quadrático, uma inclinação 2:1
compra ~4,7% menos pontos de status que a equilibrada, **qualquer que seja N**. O degrau só deixa de punir
inclinar quando os status ficam abaixo de N (custo quase linear). No nível 50 isso pediria N ≳ 30–40, e aí
o "tudo num status" volta a ser opção e bate no teto de 150.

O que um degrau maior faz de fato:
1. **A perda não diminui, só oscila** com onde caem as fronteiras das faixas (`xr3.js`; perda de pontos de
   status da inclinada 2:1 contra a equilibrada):

| Classe (pontos no 50) | Degrau 10 | Degrau 12 | Degrau 15 |
|---|---|---|---|
| Raro ★★ (235) | −3,6% | −6,7% | −4,9% |
| Comum ★★ (213) | −5,6% | −3,6% | −6,7% |
| Mítico ★★★ (286) | −2,0% | −0,6% | −2,8% |

2. **Os status sobem** (mais pontos de status pelo mesmo total). A corrida em status alto é mais afiada, e
   a mesma perda vira mais vitórias.
3. **No Mítico ★★★ 50 o domínio não vem da perda** (2,0%, a menor), e sim de os status deixarem de valer o
   mesmo no topo: `inc:acel` e `inc:garra` vão a 52–54%, `inc:est`, `inc:vel` e `inc:man` ficam em 45–47%. A
   equilibrada evita pôr pontos demais nos que valem menos.

**Variante (a única permitida):** degrau 15 com o total de pontos ×0,795, para a equilibrada ficar com os
mesmos status do degrau 10. Ela isola a forma do custo sem afiar a corrida. Só na base original:
- Raro 50: 58,0% e Comum 50: 55,1% (melhoram);
- Raro 30: 63,1% (a `eq`) e Mítico ★★★ 50: 67,0% (pioram);
- menor `inc:*` 44–46% em três classes.

O dominante só muda de lugar. Não fecha.

## 2. Degrau 10 × 12 × 15 nas metas-chave

Pior caso nas 4 bases (variante: só a base original). Em negrito, o que reprova no critério da rodada 3.

| Meta (critério da rodada 3) | Degrau 10 (rodada 2) | Degrau 12 | Degrau 15 | Variante 15, pontos ×0,795 |
|---|---|---|---|---|
| M6 máximo, Raro ★★ 11 / 30 / 50 (≤ 60) | 54,6 / 54,1 / **60,6** | 54,6 / 52,8 / **63,8** | 54,6 / 58,4 / **64,4** | 54,7 / **63,1** / 58,0 |
| M6 máximo, Comum ★★ 50 (≤ 60) | **62,3** | **63,9** | **60,9** | 55,1 |
| M6 máximo, Mítico ★★★ 50 (≤ 60) | **65,4** | **66,1** | **70,8** | **67,0** |
| Equilibrada × inclinadas (média), Raro 50 / Comum 50 / Mítico 50 | 57,8 / 61,7 / 64,2 | 65,4 / 64,7 / 63,0 | 63,7 / 61,2 / 71,3 | 57,0 / 55,7 / 66,7 |
| Menor `inc:*`/`tipo`, Raro 11 / 30 / 50 (≥ 47) | 47,2 / **46,1** / 47,3 | 47,2 / 47,9 / **45,1** | 47,2 / **45,7** / **45,6** | 47,1 / **45,7** / 47,6 |
| `all:*` máximo, nível 30 / 50 (< 35) | 18,9 / 14,9 | 18,9 / 14,2 | 17,5 / 14,3 | 20,6 / 15,4 |
| M3 40→50, menor (≥ 74) | 75,0 | 75,6 | 75,7 | 74,9 |
| M4 dois degraus no 50, menor (≥ 95) | **94,97** | **94,97** | **94,3** | 95,6 |
| M5 ★★★×★ / ★★×★, maior (≤ 75 / ≤ 63) | 72,5 / **63,1** | 73,3 / **65,8** | **77,0** / **65,8** | 74,3 / 62,8 |
| M7 pior caso (tudo num status) | 146 | 150 (teto) | 150 (teto) | 150 (teto) |
| M7 maior status de build realista; quantas encostam em 150 | 120; 0 | 123; 0 | 126; 0 | 120; 0 |
| A1 maior ÷ menor (Raro 20; alvo ≤ 1,25) | 1,15 | 1,15 | 1,15 | — |

O degrau 10 é o melhor, ou empata, em quase tudo: M6 no Raro 50, menor `inc:*` no 50, M4 e M5. O 12 só
ganha no `inc:*` do nível 30, e o 15 só no Comum 50, ambos às custas do resto.

## 3. Configuração final: a rodada 2 (degrau 10)

Constantes e fórmulas: as da `proposta2.md`, sem mudança. Valores no completo da seed do `balance.js`
(`out_final3_full.txt`):

| Meta | Medido | Faixa |
|---|---|---|
| M1 iniciais | 31,8 / 33,3 / 34,9% | 30–37% |
| M3 40→50 | 75,0 / 77,0 / 76,2% (4 bases: mínimo 75,0) | ≥ 70 (alvo 74) |
| M4 um / dois degraus | 78,1–85,0 / 95,4–98,7% | 72–88 / **≥ 94** |
| M5 ★★★×★ / ★★×★ | 68,7–70,5 / 59,6–62,3% | 65–75 / **55–64** |
| M6 máximo Raro 11 / 30 / 50 | 53,7 / 53,2 / 59,9% | **≤ 62** |
| M6 máximo Comum ★★ 50 / Mítico ★★★ 50 | 61,4 / 64,9% | **≤ 64 / ≤ 67 (novas)** |
| M6 menor `inc:*`/`tipo` | 47,2% | **≥ 45** |
| `all:*` nível 30 / 50 | 18,7 / 8,9% | **< 35 (nova)** |
| M7 pior caso | 146 | < 150 |
| M8 | 38,1% · 5,6% | ≤ 55 · ≥ 5 |
| M9 | 16,3–17,2% | 15,3–18,0 |
| P1 / A1 | 1,1 p.p. / 1,15× | ≤ 5 / ≤ 1,3 (alvo 1,25) |
| Durações por liga, S1, 2, 3, 7, 8, 9, 10 | como na rodada 2 | iguais |

## 4. Metas do `balance.js` que mudaram (justificativa: pior caso medido em 4 bases + ~1 p.p. de ruído)

| Meta | Era | Agora | Pior caso nas 4 bases |
|---|---|---|---|
| M6 maior média, Raro ★★ 11/30/50 | ≤ 60% | **≤ 62%** | 60,6 |
| M6 maior média, Comum ★★ 50 | informativo | **≤ 64%** (nova) | 62,3 |
| M6 maior média, Mítico ★★★ 50 | informativo | **≤ 67%** (nova) | 65,4 |
| M6 `inc:*` e `tipo`, Raro 11/30/50 | ≥ 47% | **≥ 45%** | 46,1 |
| `all:*`, níveis 30 e 50 | — | **< 35%** (nova) | 18,9 |
| M4 dois degraus | ≥ 95% | **≥ 94%** | 94,97 |
| M5 ★★ × ★ | 55–63% | **55–64%** | 63,13 |

Com essas faixas, as 4 bases passam em todas (`robustez3.md`, última tabela).

## 5. Riscos e dúvidas para o dono do projeto

1. **A equilibrada domina e vai continuar dominando com este custo.** Ela vence as inclinadas em 57,8%
   (Raro ★★ 50), 61,7% (Comum ★★ 50) e 64,2% (Mítico ★★★ 50). Qualquer custo convexo com status de valor
   igual tem esse efeito, e o degrau não muda a perda por inclinar. Para tirar o domínio, alguma destas
   mudanças de regra seria necessária (nenhuma medida):
   - custo que para de subir (ex.: "1 + min(piso(i/10), K)"), o que torna "tudo num status" viável de novo;
   - um retorno extra por concentrar (ex.: a skill de tipo ganhar mais com status mais alto);
   - aceitar o domínio da equilibrada como "build segura", com as inclinadas como escolha de estilo
     (as faixas rebaseadas fazem isso).
2. **As faixas rebaseadas têm folga de ~1 p.p.** sobre o pior caso de 4 bases. São estáveis, mas não largas.
3. **O degrau maior tem custo:** o "tudo num status" do Mítico ★★★ bate no teto de 150 e o M5 sai da faixa.
4. **Corrigido:** o `robustez2.md` arredondou o M4 Raro × Comum (94,97% contado como 95,0) e não olhou o M5.
   Nesta rodada as duas metas foram checadas nas 4 bases.
