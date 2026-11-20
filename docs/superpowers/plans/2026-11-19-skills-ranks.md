# Skills com 100% e ranks — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: superpowers:executing-plans (ou superpowers:subagent-driven-development), tarefa por
> tarefa. Os passos usam caixas (`- [ ]`) para marcar o andamento.

**Objetivo:** toda skill de vaga ativa sempre que o gatilho acontece, com 5 ranks por cavalo (escala do 1 ao 4 e marco no 5),
subidos com Ouro + Pergaminho de técnica.

**Arquitetura:** a regra fica nos módulos puros: `data.js` (números), `sim.js` (escala, efeito por rank, Poder, rank dos
bots), `breed.js` (rank herdado), `itens.js` (subir rank, Pergaminho do pódio) e `ginasio.js` (rank dos oponentes). O
`game.js` só chama essas funções, grava o save v9 e desenha. Nenhuma subida de rank sorteia nada.

**Tecnologia:** JS puro, sem dependências; os testes são scripts Node em `prototype/tools/`.

**Spec:** `docs/superpowers/specs/2026-11-19-skills-ranks-design.md` (ler inteira antes da tarefa 1; os números vêm de lá).

## Restrições globais
- Corrida determinística; nada de `Math.random`, `Date.now` ou `new Date` em regra. Subir rank não sorteia.
- O Pergaminho do pódio sai de `mulberry32(hash2(seed, SAL_PERGAMINHO + place))`, só em corrida **valendo**, na liquidação.
- Com páreo aberto, o cavalo ativo não sobe rank (o Poder subiria acima do que a sala viu).
- Pergaminho: nunca na loja de Ouro, nunca por Gemas, nunca em treino. A recompensa diária e o rodízio da revanche não mudam.
- O Ouro guardado para a entrada da sala aberta nunca é gasto ao subir rank.
- Escala `s(r) = 1 + 0,15 × (r − 1)`; custo 1→2: 150 + 1 · 2→3: 400 + 2 · 3→4: 900 + 4 · 4→5: 2.000 + 7 (Ouro + Pergaminhos).
- Pódio: 1º 50%, 2º 30%, 3º 15%. Ginásio: +1 Pergaminho nos soldados 2 e 4; +3 na primeira vitória sobre o líder.
- Bots da sala: rank = média arredondada dos ranks das skills de vaga do cavalo do jogador (1 sem skill). Ginásio: soldados
  1 a 3 no rank 1, soldado 4 e líder no rank 2.
- `prototype/dist/` só pelo build, commitado junto. Commits pequenos, no imperativo, em português.
- Mudou número de regra: rodar o `balance.js` **completo** (S1, S5, S6, P1 e os G só contam nele).

## Foco da revisão (casos que nenhuma tarefa cobre sozinha e que mais podem morder)
1. Save antigo com skill de vaga e sem `skillRanks` → todas no rank 1, sem aviso e sem perder nada (teste na tarefa 7).
2. `skillRanks` adulterado (rank 0, 7, "3", NaN, skill que o cavalo não tem) → saneado para 1..5 e só skills que ele tem (tarefa 7).
3. Ouro exato para o custo, mas parte dele reservada para a entrada da sala aberta → botão bloqueado com o motivo (tarefa 8).
4. Cupom trocando uma skill no rank 4 → a nova entra no rank 1 e a confirmação avisa a perda (tarefa 7).
5. Mesma seed antes e depois de subir rank fora da sala → o resultado muda só pelo rank; a mesma seed com o mesmo rank
   dá sempre o mesmo resultado (tarefa 2).

---

### Tarefa 1: números e efeito por rank (puro)

**Arquivos:** modificar `prototype/src/data.js` (SKILLS, nova SKILL_RANKS, RARITIES sem `skillChance`) e
`prototype/src/sim.js` (funções novas, exportadas); teste em `prototype/tools/sim-test.js`.

**Interfaces (produz):**
- `GameData.SKILL_RANKS = { max: 5, step: 0.15, custo: { 1: { ouro: 150, perg: 1 }, 2: { ouro: 400, perg: 2 }, 3: { ouro: 900, perg: 4 }, 4: { ouro: 2000, perg: 7 } }, diceTeto: [60, 70, 80, 90, 100] }` (`custo[r]` = de r para r+1; `diceTeto[r−1]`).
- `GameData.SKILLS[id].rank5`: o marco, com os campos da tabela abaixo.
- `RaceSim.rankScale(r) -> number` (r saneado para 1..5).
- `RaceSim.rankOf(horse, id) -> 1..5` (lê `horse.skillRanks[id]`; ausente ou inválido = 1).
- `RaceSim.skillEffect(id, rank, extraScale?) -> effect`: um objeto novo, sem mutar o `SKILLS`. Aplica a regra de cada formato
  do §5.2 da spec à parte de bônus, com o fator `s(r) × (extraScale || 1)`, e no rank 5 junta o `rank5`. Durações e
  distâncias ficam como estão. `weatherDouble` vira `weatherBonus: b × s` (b base em `effect.weatherBonus`, hoje 0,05).
  `extraDice` ganha `diceTeto`.

**Campos dos marcos (`rank5`):** arranque `{ speedMult: 1.03 }` · sprint `{ minStraightM: 100 }` · drift `{ drainMult: 0.85 }`
· saida-rapida `{ durationS: 8 }` · folego-de-montanha `{ exitRestore: 0.03 }` · segundo-ar `{ lowStaminaAt: 0.35 }` ·
arrancada-final `{ speedMult: 1.02, untilFinish: true }` · dado-viciado `{ extraDice: 2 }` · sol-a-pino, pe-na-chuva e
nevoa-amiga `{ weatherLingerS: 15 }` · chama-final `{ durationS: 12 }` · canto-da-iara `{ staminaRestore: 0.05 }` · nascente
`{ speedMult: 1.03, durationS: 4 }` · casco-firme `{ hillDrainMult: 0.7 }`. No marco, `durationS` e `lowStaminaAt`
**substituem**; os outros **somam** ao efeito escalado (multiplicadores se multiplicam; restore e bônus se somam).

- [x] **Passo 1:** testes que falham, em `sim-test.js`, seção `ranks`:
  - `rankScale: 1,00 1,15 1,30 1,45 1,60; 0, 6, '3' e NaN viram 1, 5, 1 e 1`;
  - `skillEffect('arranque', 3).accelMult ≈ 1 + (base − 1) × 1,30` (base = `SKILLS.arranque.effect.accelMult`);
  - `skillEffect('folego-de-montanha', 5).hillDrainMult >= 0.05` e igual a `max(0.05, 1 − (1 − base) × 1,6) × 0,7`;
  - `skillEffect('saida-rapida', 5).durationS === 8`, e no rank 4 igual ao da base;
  - `skillEffect('dado-viciado', 2)` → `{ extraDice: 1, diceTeto: 70 }`; no rank 5, `{ extraDice: 2, diceTeto: 100 }`;
  - `skillEffect` não muta `GameData.SKILLS` (comparar um `JSON.stringify` antes e depois);
  - `rankOf({ skillRanks: { sprint: 4 } }, 'sprint') === 4`, `rankOf({}, 'sprint') === 1`, `rankOf({ skillRanks: { sprint: 9 } }, 'sprint') === 1`;
  - todo id de `SKILLS` tem `rank5`, e `GameData.RARITIES.*.skillChance` é `undefined` (troca a asserção antiga de 0,55).
- [x] **Passo 2:** `node prototype/tools/sim-test.js` → falham os testes novos.
- [x] **Passo 3:** implementar no `data.js` e no `sim.js`. Valores base do rank 1 **provisórios**: a parte de bônus de hoje
  × 0,6 (a tarefa 4 recalibra pela medição). Atualizar as `desc` para usar números do rank (a tela formata na tarefa 8; aqui
  a `desc` fica com o texto do rank 1).
- [x] **Passo 4:** `node prototype/tools/sim-test.js` → passa.
- [x] **Passo 5:** commit "adiciona a escala de rank e os marcos das skills".

### Tarefa 2: a corrida usa 100% e o rank

**Arquivos:** modificar `prototype/src/sim.js` (`tryFire`, `trigger`, montagem do corredor, `rollDice`, detecção de reta,
de estamina baixa e de saída de subida, clima, `VERSION`, cabeçalho); testes em `prototype/tools/fx-test.js` e `sim-test.js`.

**Interfaces:**
- Consome: `skillEffect`, `rankOf` (tarefa 1).
- Produz: `config.racers[i].skillScale` opcional (número de 1 a 1,1; o bônus de 3 peças do conjunto passa 1,05; fora da
  faixa vale 1). No `racerInfo`, sai `skillChance` e entra `skillRanks: { id: r }`. O evento `skill` ganha `rank` (para o balão).
- Sai: `skillChance` (função e exportação), `TUNING.skillPerLevel`, `skillPerSorte`, `skillChanceMax`, `config.dev.skillsAlways`
  e a chamada `r.rng()` do `tryFire`. `RaceSim.VERSION` sobe.
- `rollDice(rng, sorte, extraDice, diceTeto)`: aceita até 2 extras; cada extra é `1 + floor(rng() × diceTeto)` (teto 100 sem skill).

- [x] **Passo 1:** testes que falham em `fx-test.js`:
  - `skill sem sorteio: um Comum nível 1 com Arranque ativa em 200 seeds de 200` (pelo evento `skill`);
  - `rank 5 do Segundo Ar dispara com 35% de estamina` (montar um corredor com o tanque caindo; o evento sai antes de 30%);
  - `rank 5 do Sprint dispara numa reta de 100 a 149 m; o rank 4 não`;
  - `marco do clima: com Sol a Pino rank 5, o reforço vale até 15 s depois de o Dado virar o clima, e some depois`;
  - `Dado Viciado rank 5 rola 3 ou 4 dados (com o 2º da Sorte); rank 2 nunca passa de 70 no extra`;
  - `mesma seed e mesmos ranks dão o mesmo resultado; subir um rank muda o resultado` (Foco da revisão 5);
  - `nenhuma chamada a Math.random durante simulate` (o mesmo gancho que o `balance.js` usa no G9).
- [x] **Passo 2:** `node prototype/tools/fx-test.js` → falham.
- [x] **Passo 3:** implementar. O corredor guarda o efeito pronto por skill, `effects[id] = skillEffect(id, rankOf(horse, id),
  entry.skillScale)`, na montagem. O `tryFire` lê dali. `minStraightM`, `lowStaminaAt` e `exitRestore` são lidos por
  corredor nos detectores de gatilho. `untilFinish` cria um efeito sem `untilT` nem `untilPos`. `weatherLingerS` guarda o
  fim do reforço quando o clima muda.
- [x] **Passo 4:** regenerar os testes de seed fixa que mudaram, **conferindo** cada diferença (a única causa aceita é o fim
  do sorteio e a escala). `sim-test.js` e `fx-test.js` passam.
- [x] **Passo 5:** commit "faz as skills ativarem sempre, com o efeito do rank".

### Tarefa 3: Poder, bots e ginásio com rank

**Arquivos:** `prototype/src/sim.js` (`powerRating`, nova `botRank`), `prototype/src/data.js` (etapas do ginásio com
`rank`), `prototype/src/ginasio.js` (oponentes), `prototype/src/game.js` (montagem dos bots da sala, linhas ~4373 e ~4489);
testes em `sim-test.js`.

**Interfaces:**
- `powerRating`: cada skill soma `T.ratingSkillPts × skillWeight(id) × rankScale(rankOf(horse, id))`.
- `RaceSim.botRank(horse) -> 1..5`: `Math.round` da média de `rankOf` das skills de vaga válidas; 1 sem skill.
- `RaceSim.withRanks(horse, rank) -> horse`: cópia com `skillRanks` de todas as skills no rank dado.
- `GameData` etapas do ginásio: `rank: 1, 1, 1, 2, 2` (soldado-1 … líder); a revanche usa o do líder.

- [x] **Passo 1:** testes: `Poder sobe ao subir rank (Raro com Sprint rank 1 → 5: +14 × 1 × 0,6, arredondado)`;
  `botRank({ skills: ['sprint','drift'], skillRanks: { sprint: 4, drift: 1 } }) === 3` (2,5 arredonda para 3);
  `botRank` de cavalo sem skill === 1; `os oponentes do ginásio saem com skillRanks no rank da etapa`.
- [x] **Passo 2:** rodar → falham. **Passo 3:** implementar; os bots da sala recebem `withRanks(bot, botRank(cavaloDoJogador))`
  **antes** do cálculo do Poder do bot. **Passo 4:** `sim-test.js` passa.
- [x] **Passo 5:** commit "põe o rank no Poder, nos bots e nos ginásios".

### Tarefa 4: metas e recalibração

**Arquivos:** `prototype/tools/balance.js`; `prototype/src/data.js` (valores base do rank 1); `docs/exemplos.md`.

- [ ] **Passo 1:** no `balance.js`, o S1 passa a medir **o rank 1 com ativação de 100%**, com a mesma faixa de 3 a 13 p.p.
  Entram metas novas, só no modo completo:
  - **S5:** o ganho do rank 5 fica entre 1,4× e 2,2× o do rank 1 da mesma skill, e ≤ 20 p.p.;
  - **S6:** no rank 5, nenhuma skill passa de 2× a mediana das 15.

  O jogador sintético do P1, P2 e M8 sorteia o rank médio de 1 a 5 pela seed da sala, e os bots usam o `botRank` dele. Os G
  usam o rank das etapas. Sai a meta ou o log que dependia da chance de skill, se houver (procurar `skillChance`).
- [ ] **Passo 2:** `node prototype/tools/balance.js` (completo, ~5 min) e anotar os ganhos por skill.
- [ ] **Passo 3:** ajustar o valor base de cada skill (e o `weatherBonus` e o `diceTeto`) até S1, S5, S6, P1, P2, M8 e G1–G9
  passarem. Os marcos só mudam se uma S5 ou S6 não fechar só com a base; aí o ajuste vai para `decisoes.md` como mudança
  da spec.
- [ ] **Passo 4:** `balance.js` completo: "Todas as N metas passaram". Registrar a tabela antes/depois em `docs/exemplos.md`.
- [ ] **Passo 5:** commit "recalibra as skills para o rank 1 sempre ativo".

### Tarefa 5: rank herdado no potro

**Arquivos:** `prototype/src/breed.js` (passo 6 das skills e o objeto do potro); testes em `sim-test.js` (seção do cruzamento).

**Interfaces:** o potro sai com `skillRanks`: para cada skill herdada, `max(1, maior rank entre os pais que a têm − 1)`; a
skill sorteada para completar o mínimo fica no rank 1. **Nenhuma chamada nova de `rng()`**.

- [x] **Passo 1:** testes: `potro herda Sprint rank 3 de pai com rank 4`; `pais com Sprint 2 e 5 → potro rank 4`; `skill
  sorteada nasce rank 1`; `a sequência do potro (genética, skills, nome, paleta, marcas) é a mesma de antes para a mesma
  seed` (comparar com o resultado gravado antes da mudança, sem `skillRanks`).
- [x] **Passo 2:** rodar → falha. **Passo 3:** implementar. **Passo 4:** passa. **Passo 5:** commit "faz o potro herdar o rank das skills".

### Tarefa 6: Pergaminho de técnica e as fontes

**Arquivos:** `prototype/src/data.js` (`ITEMS.pergaminho`, prêmios das etapas), `prototype/src/itens.js`
(`pergaminhoPodio`), `prototype/src/game.js` (liquidação do prêmio valendo, prêmios do ginásio, mochila, ícone feito por
código); testes em `sim-test.js` (seção `itens`).

**Interfaces:**
- `GameData.ITEMS.pergaminho = { id: 'pergaminho', name: 'Pergaminho de técnica', plural: 'Pergaminhos de técnica', cap: 99,
  podio: [0.5, 0.3, 0.15], desc: … }`, **sem** `price` nem `perDay` (a loja não o lista). Não é "usável" pela mochila.
- `Itens.pergaminhoPodio(seed, place) -> 0 | 1`: uma chamada por lugar, com sal próprio (escolher um ainda não usado; os de
  `gear.js` e `itens.js` estão no topo de cada arquivo).
- Ginásio: soldado-2 e soldado-4 ganham `pergaminhos: 1` no prêmio; líder `pergaminhos: 3`, só na primeira vitória (como a
  Rédea); a revanche fica igual.

- [x] **Passo 1:** testes: `pergaminhoPodio é determinístico e dá ~50/30/15% em 20.000 seeds (±1,5 p.p.)`; `4º lugar nunca
  ganha`; `a loja não lista o pergaminho`; `podeUsar('pergaminho') diz que se usa na aba Skills`; `prêmio do líder dá 3 só na
  primeira vitória`.
- [x] **Passo 2:** falha. **Passo 3:** implementar; no `game.js`, o resultado da corrida valendo mostra "+1 Pergaminho" nos
  prêmios quando cai. O treino nunca chama `pergaminhoPodio`. **Passo 4:** passa.
- [x] **Passo 5:** commit "adiciona o Pergaminho de técnica e as fontes".

### Tarefa 7: save v9, Cupom e Manual

**Arquivos:** `prototype/src/game.js` (`SAVE_VERSION` 8 → 9, `sanitize` de cada cavalo, migração),
`prototype/src/itens.js` (`trocarSkill`, `tentarDoma`); testes em `sim-test.js` e no teste de interface.

**Interfaces:** `trocarSkill` devolve também `skillRanks` (a que sai é apagada, a que entra fica no rank 1) e
`rankPerdido`. `tentarDoma` devolve `skillRanks` com a nova no rank 1. O aprender por nível grava o rank 1.

- [x] **Passo 1:** testes: `save v8 com skills vira v9 com todas no rank 1` (Foco 1); `skillRanks saneado: 0, 7, '3', NaN e
  skill ausente` (Foco 2: 1, 1, 1, 1 e apagada; inteiro 1..5 fica); `trocarSkill num rank 4 devolve rankPerdido 4 e a nova
  rank 1` (Foco 4); `save v10 continua bloqueado` (regra existente).
- [x] **Passo 2:** falha. **Passo 3:** implementar; a confirmação do Cupom mostra "Rank IV de Sprint será perdido" quando o
  rank passa de 1. **Passo 4:** passa. **Passo 5:** commit "grava o rank das skills no save v9".

### Tarefa 8: subir rank na tela, corrida e DEV

**Arquivos:** `prototype/src/itens.js` (`podeSubirRank`, `subirRank`), `prototype/src/game.js` (aba Skills da Montaria em
`skillsVagasHtml`, confirmação, balão da corrida em `drawSkillsNaPista`, gaveta DEV), `prototype/src/fx.js` (destaque do rank
5), `prototype/src/game.css`; teste em `prototype/tools/ui-test.mjs` (bloco novo `ranks`).

**Interfaces:**
- `Itens.podeSubirRank(mount, skillId, ctx) -> { ok, motivo?, custo? }`, com `ctx = { ouroLivre, pergaminhos, salaAbertaAtivo }`.
  Motivos (texto da tela): "Rank máximo", "Falta Ouro (precisa de N)", "Faltam Pergaminhos (precisa de N)", "Com o páreo
  aberto, o cavalo ativo não sobe rank".
- `Itens.subirRank(mount, skillId) -> { skillRanks, ouro, perg }`: o rank novo e o custo a descontar; não sorteia.
- Na aba Skills, cada skill de vaga mostra 5 marcas de rank, o "agora → próximo" (no 4 → 5, o texto do marco), o custo e o
  botão **Subir rank**, com confirmação. A "ⓘ" explica rank e Pergaminho.
- Balão na pista: `NOME` + rank em romano a partir do II; no rank 5, balão dourado e o destaque no `fx.js`.
- Gaveta DEV, aba Cavalo: um seletor de 1 a 5 por skill (no lugar do "skills sempre ativam", que sai junto de `ui.devNext.skillsAlways`).

- [x] **Passo 1:** bloco `ranks` no `ui-test.mjs`: subir 1 → 2 desconta 150 de Ouro e 1 Pergaminho e o Poder sobe; sem
  Pergaminho, o toque mostra o motivo; Ouro exato com a entrada da sala reservada mostra o motivo (Foco 3); com a sala aberta, o
  cavalo ativo fica bloqueado; uma corrida com Arranque III mostra o balão "ARRANQUE III"; rank 5 mostra o balão dourado; o
  seletor DEV muda o rank só no save DEV.
- [x] **Passo 2:** `UI_SO=ranks node prototype/tools/ui-test.mjs` → falha.
- [x] **Passo 3:** implementar, seguindo o visual das specs do estábulo no celular (2026-11-15) e da corrida viva; a tela
  cabe no celular de 360 px.
- [x] **Passo 4:** `UI_SO=ranks node prototype/tools/ui-test.mjs` passa; `node prototype/tools/ui-test-paralelo.mjs` passa inteiro.
- [x] **Passo 5:** commit "adiciona a subida de rank na aba Skills e o rank no balão".

### Tarefa 9: documentos, build e verificação final

**Arquivos:** `docs/GDD.md` (§3, chance de skill → rank; §8.2, Pergaminho), `prototype/tools/wiki.mjs` (seção Skills: sai a
tabela de chance; entram a escala, os marcos, o custo e o Pergaminho), comentário do topo de `sim.js`, `docs/memoria/*`,
`prototype/dist/` e `prototype/screens/`.

- [x] **Passo 1:** atualizar GDD e wiki; `node prototype/tools/wiki.mjs` e `node prototype/tools/wiki-test.mjs` passam.
- [x] **Passo 2:** `node prototype/build.mjs`; `./scripts/check.sh` → "VERIFICAÇÃO COMPLETA: OK"; `node prototype/tools/balance.js`
  completo → todas as metas passam. Colar as duas saídas no relatório.
- [x] **Passo 3:** a interface mudou de propósito: rodar `node prototype/tools/ui-test.mjs` para regenerar as capturas e
  commitar as que mudaram.
- [x] **Passo 4:** memória: `ESTADO.md` (frente pronta, contagens), `decisoes.md` (números finais da recalibração), `bugs.md`
  se houver. Commit "documenta as skills com ranks" e push.
- [x] **Passo 5:** publicar `prototype/dist/jogo-dev.html` como um **artefato novo** de teste (não sobrescrever os oficiais
  antes de o Vinicius aprovar) e avisar a coordenação com o link.
