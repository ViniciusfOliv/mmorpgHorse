> Anexo da spec `docs/superpowers/specs/2026-11-12-crescimento-livre-design.md`: teste da rodada 2 com outras seeds (`robustez2.md` na área de trabalho). O script e os JSONs citados não foram guardados.

# Rodada 2: robustez com outras seeds

2026-11-12. Configuração `cfg_FINAL2.json` sem nenhuma alteração (é igual aos padrões do código da cópia).
Nada no repositório foi tocado.

**Como medi.** Script `xrobust.js`, com as tarefas do harness: as mesmas do `balance.js`, a mesma ordem
de builds e o mesmo N de cada meta (M6: 800 duelos por par; M3 e M4: 3.000 duelos). Só a seed base de cada
medição muda: original, +1.000.003, +2.000.006 e +3.000.009. A ordem da RNG da corrida não muda.

Com a seed original o script reproduz exatamente os números de `out_final2_full.txt` (`rob_0.json`).
As bases novas estão em `rob_new.json`. Tempo de máquina: ~5,5 min.

"Reprovam" conta as 4 bases (a original e as 3 novas).

## 1. M6, maior média no Raro ★★ 50 (teto 60%)

| Build | Original | +1.000.003 | +2.000.006 | +3.000.009 | Mínimo | Média | Reprovam |
|---|---|---|---|---|---|---|---|
| `bot` (a maior em todas) | 59,9 | 60,4 | 60,6 | 59,5 | 59,5 | **60,1** | **2 de 4** |
| `eq` | 57,9 | 58,4 | 58,1 | 59,4 | 57,9 | 58,5 | 0 |

O bot está de fato em cima do teto (média 60,1). A seed original só passou porque caiu do lado bom.

## 2. M6, piso 47% das builds `inc:*` e `tipo`

| Meta | Original | +1.000.003 | +2.000.006 | +3.000.009 | Mínimo | Média | Reprovam |
|---|---|---|---|---|---|---|---|
| `inc:acel`, nível 11 | 47,2 | 47,2 | 47,4 | 47,2 | 47,2 | 47,3 | 0 |
| `inc:acel`, nível 30 | 47,4 | 47,3 | **46,1** | 47,8 | 46,1 | 47,2 | **1 de 4** |
| `tipo`, nível 50 | 47,9 | 47,3 | 49,1 | 49,4 | 47,3 | 48,4 | 0 |
| `inc:garra`, nível 30 (não listada, também perto) | 47,9 | 47,4 | 47,3 | 47,2 | 47,2 | 47,4 | 0 |

Todas as outras `inc:*` ficam em 47,7% ou mais nos três níveis.

## 3. M4, dois degraus no nível 50 (piso 95%)

| Duelo | Original | +1.000.003 | +2.000.006 | +3.000.009 | Mínimo | Média | Reprovam |
|---|---|---|---|---|---|---|---|
| Mítico × Raro | 95,5 | 95,8 | 95,6 | 95,5 | 95,5 | 95,6 | 0 |
| Raro × Comum (não listado, também perto) | 95,4 | 95,4 | 95,8 | **95,0** | 95,0 | 95,4 | 0, mas uma base no piso exato |

## 4. M3, 40→50 (alvo 74%, piso 70%)

| Raridade | Original | +1.000.003 | +2.000.006 | +3.000.009 | Mínimo | Média | Reprovam (alvo 74) |
|---|---|---|---|---|---|---|---|
| Comum | 75,0 | 76,0 | 75,6 | 76,5 | 75,0 | 75,8 | 0 |
| Raro | 77,0 | 75,3 | 76,2 | 76,0 | 75,3 | 76,1 | 0 |
| Lendário | 76,2 | 77,4 | 76,3 | 77,1 | 76,2 | 76,8 | 0 |

## 5. Informativo: M6 nas pontas, e o bot sem as duplas

"Contra `inc:*` e `eq`" é a média do bot só contra as seis inclinadas e a equilibrada, sem as `dup:*` e
sem a `tipo`. "`eq` contra `inc:*`" é a mesma conta para a equilibrada.

| Medida | Original | +1.000.003 | +2.000.006 | +3.000.009 | Mínimo | Média |
|---|---|---|---|---|---|---|
| **Comum ★★ 50**, `bot` (média contra todas) | 61,4 | 61,6 | 61,3 | 62,3 | 61,3 | 61,6 |
| `eq` (contra todas) | 59,3 | 60,5 | 60,0 | 60,1 | 59,3 | 60,0 |
| `bot` contra `inc:*` e `eq` | 60,9 | 60,6 | 61,8 | 62,6 | 60,6 | 61,5 |
| `eq` contra `inc:*` | 60,7 | 61,6 | 62,3 | 62,3 | 60,7 | 61,7 |
| `bot` × `eq` (duelo direto) | 55,1 | 53,9 | 53,1 | 56,6 | 53,1 | 54,7 |
| **Mítico ★★★ 50**, `bot` (contra todas) | 64,9 | 65,4 | 64,4 | 64,4 | 64,4 | 64,8 |
| `eq` (contra todas) | 63,6 | 62,7 | 62,5 | 64,0 | 62,5 | 63,2 |
| `bot` contra `inc:*` e `eq` | 62,9 | 63,9 | 62,7 | 63,3 | 62,7 | 63,2 |
| `eq` contra `inc:*` | 65,0 | 63,9 | 63,6 | 64,2 | 63,6 | 64,2 |
| `bot` × `eq` (duelo direto) | 52,3 | 54,5 | 50,9 | 53,5 | 50,9 | 52,8 |
| **Raro ★★ 50** (referência), `bot` contra `inc:*` e `eq` | 58,8 | 59,1 | 58,4 | 57,2 | 57,2 | 58,4 |
| `eq` contra `inc:*` | 57,1 | 57,3 | 58,1 | 58,5 | 57,1 | 57,8 |
| `bot` × `eq` (duelo direto) | 52,3 | 51,0 | 51,3 | 48,5 | 48,5 | 50,8 |

**Leitura.** Tirar as duplas quase não muda nada nas pontas (Comum 61,6 → 61,5; Mítico 64,8 → 63,2).
Quem domina é a distribuição equilibrada, não "as duplas são ruins":
- a `eq` sozinha vence as inclinadas em 61,7% (Comum ★★ 50) e 64,2% (Mítico ★★★ 50);
- o bot é a `eq` com uma leve inclinação no tipo e ganha dela por pouco (50,8–54,7% no duelo direto).

No Raro 50, sem as duplas, o bot cai para 58,4%: lá as duplas (43–45%) são a diferença entre passar e não
passar do teto.

## Resumo

| Meta | Mínimo nas 4 bases | Média | Reprovam | Veredito |
|---|---|---|---|---|
| M6 máximo, Raro 50 (≤ 60) | 59,5 | 60,1 | 2 de 4 | **no limite de fato**: passa ou reprova por sorte |
| M6 `inc:acel`, nível 11 (≥ 47) | 47,2 | 47,3 | 0 | passa, sem folga |
| M6 `inc:acel`, nível 30 (≥ 47) | 46,1 | 47,2 | 1 de 4 | **no limite de fato** |
| M6 `tipo`, nível 50 (≥ 47) | 47,3 | 48,4 | 0 | passa |
| M4 Mítico × Raro, 50 (≥ 95) | 95,5 | 95,6 | 0 | passa |
| M4 Raro × Comum, 50 (≥ 95) | 95,0 | 95,4 | 0 | passa, no piso exato numa base |
| M3 40→50 (alvo 74) | 75,0 | 76,2 | 0 | passa de fato (folga ≥ 1) |
| M6 pontas (informativo, ≤ 60 desejado) | bot 61,3 / 64,4 | 61,6 / 64,8 | 4 de 4 | não passa; domina a equilibrada |
