# D4 — Ginásios em sequência e mais difíceis (spec curta)

> **Status: implementada em 2026-11-26 (Fornalha de Mágicos e o AFK seguindo a fase, ver §4a). Respostas: P1 times maiores (A); P2 os níveis da tabela como partida, "ajusto
> jogando".** Decisão D4 aprovada em 2026-11-25
> (`docs/auditoria/decisoes-produto.md`): *"Sim, em sequência, mas a dificuldade deve ser aumentada, pensei em aumentar
> o número de oponentes por ginásios, e também, a distância entre um e outro, aumentando raridade (magico, raro)."*
> Referência (não merge): o ramo `claude/nifty-newton-e8u133` (`ginasio.js` `aberto`/`anterior`, 18/11).

## 1. Como é hoje

- Três ginásios abertos em qualquer ordem, **iguais em força**: 5 etapas (4 soldados + líder), níveis 4 · 8 · 12 · 16 ·
  20, times de 1 · 1 · 2 · 2 · 3 cavalos, todos **Comuns** com a genética do inicial do elemento, ★★ (o Remanso tem ★★★
  em dois). Entradas 20…100, prêmios 80…400 (+720 líquidos por ginásio).
- **Tudo depende das 5 etapas:** o mapa da trilha tem 5 paradas desenhadas (`mapa.js` `PARADAS`), a placa mostra 5
  etapas, a névoa some em 5 passos, as **fases do treino AFK** são as etapas vencidas (15 fases) e o bestiário também.

## 2. Regra nova (o que já está decidido)

- **Sequência Capoeira → Remanso → Fornalha.** Um ginásio só abre com a insígnia do anterior (líder vencido). Quem já
  venceu alguma etapa de um ginásio continua com ele aberto (nenhum save perde nada). Desafiar um ginásio fechado é
  recusado **antes de pagar** (`Ginasio.podeDesafiar` → `'ginasio-fechado'`). A regra fica no `ginasio.js` (vai para o
  servidor) e entra no `CLAUDE.md` §8.
- **No mapa-múndi:** o ginásio fechado aparece apagado, com cadeado e o motivo ("Vença o líder da Capoeira"); a névoa
  continua sendo só enfeite.
- **Raridade sobe:** Capoeira com **Comuns**, Remanso com **Mágicos**, Fornalha com **Mágicos** em nível mais alto (a proposta era Raros; mudou pela medição, §4a). O catálogo não tem Raro de
  Fogo; proposta: os oponentes de cada ginásio usam a genética do inicial do elemento com a raridade da casa (mais
  pontos e vagas de skill pela raridade), como o build dos testadores já faz com os iniciais. Sem arte nova.

## 3. Duas perguntas

**P1 — "mais oponentes" é o quê?**

| | Opção | O que muda | Custo |
|---|---|---|---|
| **A (recomendada)** | **Times maiores** nas mesmas 5 etapas, crescendo de ginásio para ginásio | Capoeira 1·1·2·2·3 (como hoje) · Remanso 1·2·2·3·3 · Fornalha 2·2·3·3·3 | Só números. Mapa, placa, AFK e bestiário ficam como estão |
| B | **Mais etapas** por ginásio (ex.: 6 ou 7) | Mais soldados antes do líder | Redesenhar a trilha do mapa (paradas, curva, placa, névoa), mais fases de AFK (mexe nas metas E1–E6 e no preço das vagas), muitos testes de interface do ginásio |

Atenção com a D1: o time do jogador vai até o tamanho do time do adversário, e o jogador vai começar com **2 vagas** no
estábulo. Com a A, um time de 3 já no Remanso pede 3 cavalos (o 3º custa 300 de Ouro, ou vem de cruza).

**P2 — a distância entre os ginásios.** Proposta de partida (ajustável depois de jogar):

| Ginásio | Oponentes | Níveis das 5 etapas | Entradas | Ouro da 1ª vitória | Líquido |
|---|---|---|---|---|---|
| 1º Capoeira | Comuns ★★ | 2 · 4 · 6 · 8 · 10 | 10 · 15 · 20 · 25 · 50 | 50 · 75 · 100 · 125 · 250 | +480 |
| 2º Remanso | Mágicos ★★ | 14 · 17 · 20 · 23 · 26 | 25 · 35 · 45 · 55 · 110 | 100 · 140 · 180 · 220 · 450 | +820 |
| 3º Fornalha | Mágicos ★★ (eram Raros na proposta; ver §4a) | 30 · 33 · 36 · 39 · 42 | 40 · 55 · 70 · 85 · 170 | 160 · 220 · 280 · 340 · 700 | +1.330 |

Hoje: os três com níveis 4–20 e +720 cada (+2.160 no total); proposta: 2–42 e +2.630 no total, espalhados pela
progressão. Itens da trilha (Torrão, Manual, Rédea, Cupom, Pergaminhos) e a revanche ficam como estão.

## 4. Como provar

- **Metas G do `balance.js` refeitas para a sequência:** G1–G7 passam a medir cada ginásio no próprio nível, com um
  jogador **da mesma raridade** da casa (o "justo"), e entra a meta nova **GS** (salto de dificuldade): um Comum ★★ no
  nível da etapa vence menos no Remanso que na Capoeira, e menos ainda na Fornalha, com faixas que saem da medição e
  vêm para você aprovar antes de valer.
- Testes: `sim-test` (abertura em sequência, save antigo continua aberto, recusa antes de pagar), `ui-test` (cartão
  fechado com o motivo, desafio recusado sem cobrar), `wiki` (gerado), `check.sh` e `balance.js` completos.
- Teste manual: no DEV, um save novo vê só a Capoeira aberta; vencendo a líder, o Remanso abre.

## 4a. Medição da implementação (2026-11-26) — pede decisão

Time do inicial do elemento da casa (★★, build dos bots) contra o **líder**, 300 desafios por célula; o nível do time é o
do líder mais o indicado (limitado ao 50):

| Ginásio | Time do jogador | +0 | +4 | +8 | +12 | +16 |
|---|---|---|---|---|---|---|
| Capoeira (Comuns, nv 10) | Comum | 49% | 89% | 98% | 100% | 100% |
| Remanso (Mágicos, nv 26) | Comum | 7% | 19% | 34% | 57% | 78% |
| Remanso | Mágico | 49% | 72% | 85% | 94% | 99% |
| Fornalha (Raros, nv 42) | Comum | 0% | 0% | 1% | 1% | 1% |
| Fornalha | Mágico | 2% | 5% | 18% | 18% | 18% |
| Fornalha | Raro | 49% | 73% | 89% | 89% | 89% |
| *Fornalha se fosse de Mágicos* | Comum | 2% | 10% | 26% | — | — |
| *Fornalha se fosse de Mágicos* | Mágico | 48% | 71% | 89% | — | — |

Leitura: **a raridade pesa muito mais que o nível.** Com Raros, a Fornalha só cai para um time de **Raros** (Comum nunca,
Mágico no máximo 18%). O Remanso pede um Mágico, ou um Comum uns 12 níveis acima.

Efeito no treino AFK (as fases são as etapas dos ginásios e herdam a raridade): a Lendária da Fornalha fica impossível
para o cavalo típico (meta E4: 0,1% com 5 Raras +7, a faixa é 40–60%), e a da Capoeira fácil demais (86,6%).

Metas que também saíram da faixa (ajuste técnico, a confirmar junto): G2 no Recruta da Capoeira (o nível 2 − 4 vira 1),
G3 com vantagem 87–88% (teto 87%), G5 (pedia os três ginásios iguais, e agora eles são diferentes de propósito), G6 no
Remanso (14,3%, piso 15%).

## 5. Fora deste passo

- As 2 vagas iniciais do estábulo (D1): ticket próprio.
- Recalibrar a pista de cada ginásio (o `nifty-newton` achou a Grama vencendo 41–46% na Fornalha mesmo em desvantagem):
  só se a medição mostrar o problema de novo.
