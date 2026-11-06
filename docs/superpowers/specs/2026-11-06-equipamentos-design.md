# Equipamentos — Inventário, Set e Melhoria — Design

Status: **implementado na branch `claude/equipamentos` (2026-11-06)**; ver §16 para os ajustes.

Subprojeto 3 de 6 (núcleo v2 → cavalos v2 → **equipamentos** → expedições → montarias → economia).
Branch: `claude/equipamentos`. Referência de regras: equipamento de cavalo do Black Desert (5 peças,
melhoria +0…+10 com pedra negra, conjuntos com bônus por 3/4/5 peças).

## 1. Objetivo

Dar ao jogador um **set de 5 peças por montaria** (ferraduras, sela, estribos, testeira, armadura), um
**inventário compartilhado**, uma **loja** onde gastar Ouro, uma **melhoria** com risco (+0 a +10) e
**conjuntos** ligados aos climas que criam uma escolha pré-corrida: turbinar o dia bom (4 peças) ou se
proteger do dia ruim (5 peças).

Pergunta que o protótipo precisa responder: montar e melhorar o set é um sink de Ouro gostoso e uma
decisão estratégica, ou só uma conta a pagar?

## 2. Decisões (com a origem)

| Decisão | Origem |
|---|---|
| 5 slots: ferraduras→Vel, sela→Est, estribos→Man, testeira→Acel, armadura→Força | Vinicius (opção A); espelha o Black Desert |
| Garra e Sorte só como status secundário de peça e bônus de conjunto | proposta aceita |
| Melhoria +0…+10 com Pedra Negra, chance caindo, queda de nível ao falhar a partir de +6, só pela RNG da seed | Vinicius (opção A); chances **reduzidas** a pedido dele |
| Conjuntos por clima: Sol (Fogo), Chuva (Água), Névoa (Grama); bônus com 3, 4 e 5 peças | Vinicius (opção A) |
| Loja com Ouro vende Comum, Mágico e Raro + Pedra Negra; venda de volta a 25% | Vinicius ("vamos fazer com a loja") |
| Pódio em corrida valendo rende Pedra Negra (nunca peça; nunca em treino) | Vinicius (opção C) |
| Lendário fora da loja (expedições; até lá só `?dev=1`); Mítico sem peça (despertar) | proposta aceita |
| Módulo puro `gear.js`, peças como instâncias no save, simulação recebe o equipamento resolvido | Vinicius (abordagem 1) |
| Equipamento por montaria; inventário compartilhado; sem durabilidade; sem limite de vagas | assunção apresentada e não contestada |
| Pareamento da sala inclui o equipamento; com páreo aberto a montaria ativa só aceita trocas que não passem do rating que a sala viu | decisão desta spec (§9): bloqueia abrir a sala fraco e equipar forte, mas deixa trocar de conjunto pela previsão do clima |

## 3. Modelo de dados

### 3.1 Catálogo (`prototype/src/data.js`, gerado por tabela)

Ids: peça solta `<slot>-<raridade>`; peça de conjunto `<slot>-<conjunto>-<raridade>`.
Slots (`GEAR_SLOTS`, nesta ordem): `ferraduras`, `sela`, `estribos`, `testeira`, `armadura`.
Conjuntos (`GEAR_SETS`): `sol` (clima do Fogo), `chuva` (Água), `nevoa` (Grama).

| Slot | Principal | Secundário | Comum (solta) | Mágico (solta) | Conjunto (Raro e Lendário) |
|---|---|---|---|---|---|
| ferraduras | vel | acel | Ferradura Leve | Ferradura com Cravos | Ferraduras do Sol / da Chuva / da Névoa |
| sela | est | garra | Sela de Couro Cru | Sela Acolchoada | Sela do Sol / da Chuva / da Névoa |
| estribos | man | sorte | Estribos de Corda | Esporas de Prata | Estribos do Sol / da Chuva / da Névoa |
| testeira | acel | garra | Antolhos | Testeira de Couro | Testeira do Sol / da Chuva / da Névoa |
| armadura | forca | est | Manta de Lã | Capa Impermeável | Armadura do Sol / da Chuva / da Névoa |

Raro e Lendário do mesmo conjunto têm o mesmo nome; a raridade aparece no selo. Total: 5 Comuns +
5 Mágicas + 15 Raras + 15 Lendárias = **40 peças**; 25 na loja + Pedra Negra = 26 entradas.

Cada entrada do catálogo: `{ id, name, slot, rarity, set: null|'sol'|'chuva'|'nevoa', main: n, sub: n }`
(valores em §4). Os `ITEMS` antigos e `START_INVENTORY` saem.

### 3.2 Instâncias e save v4

```
{ v: 4, rev, gold, tier, seedBase, raceCounter, pending, races, wins, podiums, goldWon,
  mounts: [ { ..., equip: { ferraduras: uid|null, sela, estribos, testeira, armadura } } ],
  activeId, nextUid, stableSlots, breedCounter,
  items: [ { uid: 'i1', id: 'sela-sol-raro', plus: 0..10 } ],
  nextItemUid: 1, pedras: 0, enhanceCounter: 0 }
```

Chave do `localStorage` continua `galope-elemental:v1`. `inventory` e `equipped` deixam de existir.

### 3.3 Economia (`ECONOMY.gear`)

```
{ price: { comum: 100, magico: 250, raro: 600, lendario: 1500 },   // lendario = referência (venda), não está à venda
  sellRate: 0.25, stonePrice: 40, stoneBundle: 5,
  main: { comum: 2, magico: 3, raro: 4, lendario: 6 },
  sub:  { comum: 0, magico: 2, raro: 3, lendario: 4 },
  plusMax: 10,
  enhanceChance: [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.35, 0.3, 0.25],   // índice = plus atual
  enhanceCost:   [1, 1, 1, 1, 1, 1, 2, 2, 2, 2],                        // pedras por tentativa
  enhanceDropFrom: 6,                                                   // falhar com plus ≥ 6 cai 1 nível
  setBonus: { pieces: [3, 4, 5], skillChance: 0.05, sorte: 5, ratingPts: [10, 15, 20] },
  podiumStone: [0.6, 0.4, 0.25],                                        // 1º, 2º, 3º em corrida valendo
  startGear: ['sela-comum', 'ferraduras-comum'] }
```

## 4. Status e orçamento

- Valor do **principal** = `main[raridade] + plus`. Secundário fixo = `sub[raridade]`. Comum não tem secundário.
- Raro +10 = +14 no principal; Lendário +10 = +16. Um conjunto Raro completo em +10 soma ≈ +14 nos 5
  status de pista (pouco mais de um degrau de raridade, que vale 8 pontos na base), sem dar vagas de
  skill nem chance base de ativação.
- Na simulação os mods entram **depois** do crescimento por nível e do bônus de elemento, **antes** do
  limite 1–120. Passam do `statCap` da raridade, como o elemento já passa.
- Metas de balanceamento em §13.

## 5. Melhoria (`Gear.enhance`, função pura)

| De → para | +0→1 | +1→2 | +2→3 | +3→4 | +4→5 | +5→6 | +6→7 | +7→8 | +8→9 | +9→10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Chance | 100% | 90% | 80% | 70% | 60% | 50% | 40% | 35% | 30% | 25% |
| Pedras | 1 | 1 | 1 | 1 | 1 | 1 | 2 | 2 | 2 | 2 |
| Se falhar | nada | nada | nada | nada | nada | nada | cai p/ +5 | cai p/ +6 | cai p/ +7 | cai p/ +8 |

Custo esperado (cadeia completa, com as quedas): +5 ≈ 6 pedras (≈ 258 Ouro), +7 ≈ 16 (≈ 658),
+8 ≈ 37 (≈ 1.481), +10 ≈ 264 (≈ 10.548). Ajustar só os três últimos degraus se quiser mais duro.

Regras:
- Só com pedras suficientes e `plus < 10`. Sem Ouro na tentativa (o sink de Ouro é a compra de pedras).
- Debita as pedras e avança `enhanceCounter` **antes** de mostrar o resultado (mesma regra da entrada
  da corrida). O contador avança sempre, com sucesso ou falha.
- Sorteio: `roll = mulberry32(hash2(seedBase, 0xE4A0 + enhanceCounter))()`; sucesso se `roll < chance`.
  Uma chamada por tentativa. Nunca `Math.random`.
- `Gear.enhance(item, seedBase, counter)` devolve `{ success, plus, roll }` sem mutar a instância;
  `Gear.enhanceOdds(plus)` devolve `{ chance, cost, dropTo }` para a tela.
- Peça equipada na **montaria ativa com páreo aberto** não pode ser melhorada (§9); peças no inventário
  ou em outras montarias podem.

## 6. Conjuntos e efeito na corrida

Conta-se, por montaria, o maior número de peças equipadas do **mesmo** conjunto (raridades misturadas
valem). Empate entre conjuntos (ex.: 2+2+1) não ativa nada. Bônus **acumulam** (5 peças tem os três):

| Peças | Bônus |
|---|---|
| 3 | +5 p.p. na chance de todas as skills e +5 de Sorte |
| 4 | Bônus do clima do conjunto dobra (1,03 → 1,10) quando a montaria é do elemento favorecido por ele. Não acumula com a skill "dobra o clima": vale o maior (os dois dão o mesmo 1,10). |
| 5 | A montaria ignora a penalidade de clima, em qualquer clima. |

### 6.1 `Gear.resolve(mount, itemsByUid)` → equipamento resolvido

```
{ mods: { vel, acel, man, forca, est, garra, sorte },        // soma de principal+plus e secundários (+5 sorte com 3 peças)
  special: { skillChanceBonus: 0|0.05, weatherDoubleClimate: null|'sol'|'chuva'|'nevoa', ignoreWeatherPenalty: bool },
  set: { id: null|'sol'|'chuva'|'nevoa', count: 0..5 },
  pieces: [ { slot, uid, id, plus } ] }
```

Uid inexistente ou peça de slot errado é ignorada. Sem nada equipado devolve mods zerados e `set.count 0`.

### 6.2 Mudanças em `prototype/src/sim.js`

- `computeStats(horse, gear)` — `gear` é o objeto resolvido ou `null`; soma `gear.mods[k]` no lugar de
  `item.mods[k]`. `GameData.ITEMS` e `itemSpecialPoints` saem.
- `skillChance(horse, stats, bonus)` — soma `bonus` (p.p.) antes do teto 0,95.
- `powerRating(horse, gear)` — status com mods + skills + `setBonus.ratingPts` pelo `set.count`
  (3→10, 4→15, 5→20; não cumulativo).
- `buildRacer`: lê `entry.gear`; `r.gearDoubleClimate = gear.special.weatherDoubleClimate`,
  `r.ignoreWeatherPenalty = gear.special.ignoreWeatherPenalty`, `r.skillChanceBonus`.
- `applyWeather`: `doubled = r.weatherDouble || r.gearDoubleClimate === weather` (o `weatherMult` já só
  dobra quando o elemento é o favorecido). `ignoreWeatherPenalty` continua como hoje.
- `simulate`: entradas `{ horse, gear, name, isPlayer }`. A ordem das chamadas de `rng` por corredor
  **não muda** (os bônus são números, não sorteios).
- `balance.js` e `sim-test.js` passam `gear` (ou `null`) onde passavam `itemId`.

## 7. Loja e venda

- Tela própria, botão **Loja** no estábulo. Abas: Ferraduras · Sela · Estribos · Testeira · Armadura ·
  Pedras. Cada aba de slot lista 1 Comum, 1 Mágica e 3 Raras (Sol, Chuva, Névoa). Aba Pedras: ×1 (40)
  e ×5 (200).
- Cartão: nome, selo de raridade, conjunto, principal e secundário, e a diferença para a peça que a
  montaria **ativa** usa naquele slot ("+2 Vel em relação à equipada"; "slot vazio" se não há).
- Comprar: debita o Ouro, cria `{ uid: 'i'+nextItemUid, id, plus: 0 }`, incrementa `nextItemUid`. Não
  equipa. Sem Ouro: botão desabilitado com o motivo. Sem estoque, sem limite.
- Vender (na tela de Equipamento, peça **não equipada**): devolve `round(price[raridade] × 0.25)`
  (Comum 25, Mágico 63, Raro 150, Lendário 375), ignora o `plus`. "Desfazer" até sair da tela (como o
  "Liberar" do estábulo): a peça volta com o mesmo uid e o Ouro é redebitado.

## 8. Prêmio de pódio (`Gear.podiumStone`)

Só em corrida valendo (`fee > 0`). Dentro de `settle`, junto com o Ouro do prêmio:
`roll = mulberry32(hash2(seed, 0xB1AC))()`; ganha 1 Pedra Negra se `roll < podiumStone[place-1]`
(1º 60%, 2º 40%, 3º 25%; 4º em diante nada). `state.pedras += 1` na mesma gravação do Ouro (a
liquidação pendente já evita duplicar em duas abas). O resultado devolve `stone: 0|1` e a tela mostra
"🪨 +1 Pedra Negra". Treino nunca rola.

## 9. Matchmaking e bots

- `openLobby`: `P.pr = powerRating(playerHorse(), Gear.resolve(activeMount(), itemsByUid))` — o
  equipamento entra no pareamento porque agora é persistente, não escolha de sala.
- **Trava parcial:** enquanto `state.pending` existe, a montaria ativa aceita Equipar/Tirar **só se o
  rating resultante for ≤ `P.pr`** (o rating que a sala viu); a tela mostra "Páreo aberto: o rating não
  pode passar de N" e desabilita as peças que passariam. Assim dá para trocar Sol ↔ Chuva de mesma força
  depois de ver a previsão do clima, mas não dá para abrir a sala fraco e equipar forte. Melhorar peça
  equipada na ativa fica bloqueado com páreo aberto. As outras montarias e a venda de peça não equipada
  continuam livres. `refreshPlayerEntry` resolve o equipamento de novo no "Largar!" (então o que corre é
  o que está equipado na hora, sempre dentro do limite).
- **Bots:** `Gear.botGear(leagueIdx, element, rng)` devolve um equipamento resolvido, com a liga vinda
  de `RS.leagueFor(target)` e o conjunto igual ao clima do elemento do bot (Neutro: sorteia um dos 3
  com o `rng` da sala):

| Liga | Equipamento do bot |
|---|---|
| Bronze | nada |
| Prata | 2 Comuns +0 (ferraduras, sela) |
| Ouro | 5 Comuns +2 |
| Platina | 5 Mágicas +3 (soltas) |
| Diamante | 3 Raras +4 do conjunto + 2 Mágicas +3 |
| Lenda | 5 Raras +7 do conjunto |

- `bestLevelFor(template, gear, …)` recebe o equipamento do bot (o `rng() < 0.55 ? item : null` sai).
  O `rng` da sala é o mesmo fluxo `hash2(seed, 0xA11CE)`; a ordem das chamadas muda, então um páreo
  pendente de um save v3 é remontado com outro campo depois da atualização (uma vez só; o `counter` não
  avança e nada é cobrado).

## 10. Telas (`game.js`, ES5, `esc()`/`sanitize()`)

- **Estábulo:** botão **Loja** no topo; cartão com linha de equipamento (5 ícones de slot; preenchido
  mostra "+N"; selo "Sol ×3" quando há conjunto com 3+) e ação **Equipar**.
- **Equipamento** (`go('equipamento')`, por montaria; `ui.equip = { uid, slot, undo }`): 5 slots com a
  peça atual e seus valores; tocar num slot abre a lista das peças do inventário daquele slot
  (ordenada por raridade e `plus`), com **Equipar** / **Tirar**. Em cada peça: **Melhorar** (mostra
  chance, custo e consequência da falha; "Tentar" debita e então mostra "Sucesso: +N" ou "Falhou:
  continua +N / caiu para +N") e **Vender** (25%, com Desfazer). Prévia dos status efetivos e do rating
  antes/depois da troca, e a linha do conjunto ativo ("Chuva ×4: bônus do clima dobrado").
- **Loja** (`go('loja')`): §7.
- **Largada:** some a escolha de item; mostra o resumo do equipamento da montaria ativa (5 ícones,
  conjunto) e um atalho "Equipar" que abre a tela de Equipamento já com a trava parcial de §9 (o
  jogador vê a previsão do clima e troca de conjunto sem passar do rating da sala).
- **Resultado:** linha da pedra (§8).
- **Painel `?dev=1`:** "+5 Pedras" e "+ conjunto Lendário (ativa)" (5 Lendárias +0 do conjunto do
  clima do elemento da ativa; Neutro → Sol; cria as instâncias e equipa).
- Histórico do navegador como nas outras telas (`syncHistory`).

## 11. Migração e `sanitize`

**v3 → v4** (v1/v2 passam pelo v3 antes, como hoje):

| Item antigo | Vira |
|---|---|
| ferradura-leve | ferraduras-comum |
| ferradura-cravos | ferraduras-magico |
| sela-couro | sela-comum |
| manta-la | armadura-comum |
| antolhos | testeira-comum |
| esporas-prata | estribos-magico |
| capa-impermeavel | armadura-magico |
| figa-sorte | estribos-magico |
| penas-gaviao | testeira-magico |
| rapadura-engenho | +3 Pedras Negras (sem peça) |

O item que estava em `equipped` entra no slot da peça correspondente na montaria ativa. Ninguém perde
Ouro. **Save novo:** 500 Ouro, Sela de Couro Cru e Ferradura Leve (+0) já equipadas no inicial, 0 pedras.

**`sanitize` v4:** peça só com `id` do catálogo, `plus` inteiro 0–10, `uid` `/^i\d{1,9}$/`, uid
repetido descartado (fica a primeira); `nextItemUid` ≥ maior uid + 1; `pedras` inteiro 0…1e6;
`enhanceCounter` inteiro ≥ 0; `equip` só aponta para uid existente **e do slot certo**; uma peça
nunca fica em duas montarias (a primeira na ordem de `mounts` vence). Tudo o que falhar é descartado
em silêncio.

## 12. Atalho de protótipo

Sem Lendário na loja, o `?dev=1` é o único caminho para testar o conjunto Lendário e os bônus de 4 e
5 peças sem farmar. O painel já dá Ouro; ganha pedras e o conjunto (§10).

## 13. Verificação

**Metas novas no `balance.js`** (E1–E4; as 28 atuais rodam com `gear = null` e não mudam):

| Meta | Confronto (mesmo cavalo e nível; só muda o equipamento) | Clima | Faixa |
|---|---|---|---|
| E1 | Inicial nível 1 com 5 Comuns +0 × sem nada | Nublado | 60–75% |
| E2 | Comum nível 30 com conjunto Raro +10 (5 peças) × Raro nível 30 sem nada | Nublado | 40–60% |
| E3 | Fogo com 4 Raras +0 do Sol × o mesmo com as 4 Raras +0 de conjuntos misturados (2 Sol, 1 Chuva, 1 Névoa) | Sol | 55–70% |
| E4 | Fogo com 5 Raras +0 da Chuva × o mesmo com 5 Raras +0 misturadas (2 Chuva, 2 Sol, 1 Névoa) | Chuva | 60–75% |

Mapas aleatórios como nas metas 2/3b/4a; duelos de 2 corredores; 400 corridas por meta.

Botões de ajuste se quebrar: `main`/`sub` por raridade e `ratingPts`; nunca a tabela de melhoria.

**Testes unitários** (`sim-test.js`): catálogo íntegro (40 peças, ids únicos, 25 à venda); `resolve`
soma principal+plus e secundários, conta conjunto com raridades misturadas, ignora slot errado e uid
inexistente, empate não ativa; `enhanceOdds`/`enhance` seguem a tabela, debitam o custo certo, caem só
a partir de +6, contador sempre avança, snapshot dourado de uma sequência de 12 tentativas com
`seedBase 20261106`; `podiumStone` por colocação, 0 em treino e fora do pódio, determinístico pela
seed; `botGear` determinístico por liga; migração v3→v4 (tabela de §11, Rapadura → 3 pedras, equipado →
ativa, Ouro intacto) e `sanitize` v4 (uid repetido, slot errado, peça em duas montarias, `plus` fora da
faixa); `computeStats`/`powerRating` com equipamento (limite 120, pontos de conjunto); `skillChance`
com bônus respeita o teto.

**Teste de interface** (`ui-test.mjs`, contexto `equipamento` com `?dev=1`): comprar Ferradura Leve
(Ouro −100), equipar na ativa, largada mostra o resumo, melhorar com pedras do painel (resultado
calculado em Node com o mesmo `seedBase`), vender e desfazer, correr valendo e conferir a pedra quando
a seed der, recarregar e persistir; fixture de save v3 migrando (itens → peças, equipado → ativa);
trava com páreo aberto; sem rolagem horizontal; painel ausente sem a flag. `check.sh` continua com 5
etapas.

**Documentação:** GDD §7 "Equipamentos"; `exemplos.md` §14 (preços, tabela de custo esperado da
melhoria, equipamento dos bots); `CLAUDE.md` §8 ganha "Melhoria e prêmio de pódio só pela RNG da seed
(`gear.js`)"; memória.

## 14. Fora de escopo (vai para o GDD como "depois")

Durabilidade e reparo · limite de vagas no inventário · Lendário na loja · peça Mítica · mercado entre
jogadores · cosméticos por Gemas · desmanche · expedições e pacotes como fonte (subprojeto 4) ·
transferência de peças entre contas.

## 15. Riscos

- **Inflação de rating:** com equipamento no rating, jogadores sobem de liga mais cedo; os bots ganham
  equipamento por liga para compensar. Se as ligas ficarem fáceis demais, subir os `min` de `LEAGUES`.
- **`game.js` cresce (~+600 linhas).** Mantém-se um arquivo (decisão registrada); `gear.js` puro é o
  que sobrevive para a stack final.
- **Melhoria frustrante:** +10 custa ≈ 264 pedras na média. É intencional (objetivo de longo prazo);
  se a sensação for ruim, mexer só em +8→+9 e +9→+10.
- **Migração:** saves v3 com `equipped` apontando para item que não existe mais caem no caminho
  "descarta em silêncio"; o Ouro nunca é tocado.

## 16. Histórico de ajustes (implementação, 2026-11-06)

O que mudou na implementação em relação ao texto aprovado (antigo → novo):

- **Meta E2 (§13):** "Comum lv30 com conjunto Raro +10 × Raro lv30 sem nada, 40–60%" → dividida em **E2a** (× Mágico lv30 sem nada, 60–85%, medido 75,3%) e **E2b** (× Raro lv30 sem nada, 10–40%, medido 13,2%). No nível 30 a distância Comum→Raro é de ~20 pontos por status (`statCap` 60 contra 80) mais duas skills; "fecha um degrau, não dois" passou a ser medido assim. Os 40–60% contra Raro eram inalcançáveis sem tornar o equipamento dominante nos níveis baixos.
- **Meta E3 (§13):** 55–70% → **75–90%** (medido 86,0%). O "dobra o clima" de 4 peças é idêntico à skill de dobrar o clima; num duelo de clima fixo entre cavalos iguais vale ~86%. No jogo o Dado vira o clima ~1,2× por corrida.
- **Bots no pareamento (§9):** a liga do bot é calculada por id (`leagueIndex`) e há mais uma chamada de `rng()` por bot, para a escolha do conjunto do Neutro (`pick`).
- **Prévia da trava (§9, §10):** o rating mostrado em cada peça é só `Poder A → B`, sem os status antes/depois completos.
- **Cartões da Loja e do Equipamento (§7, §10):** os status usam as siglas curtas já existentes (`EST`, `GAR`…).
- **Testes de interface (§13):** cobrem a sequência de melhoria calculada com o `seedBase` ao vivo, a trava com Lendária bloqueada e Comum liberada, a recusa na Loja com o botão reabilitado (guarda do handler) e bots com equipamento na sala.
- **Metas finais medidas (completo):** E1 69,2% · E2a 75,3% · E2b 13,2% · E3 86,0% · E4 73,5%; rodada `--quick`: 72,7 · 76,0 · 13,9 · 84,0 · 70,0.

