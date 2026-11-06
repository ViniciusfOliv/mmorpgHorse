# Cavalos v2 — Estábulo, Haras e Cruzamento — Design

Status: **aguardando revisão do Vinicius**. Aprovado em conversa em 2026-11-06. Depois de aprovado vira
plano (`docs/superpowers/plans/`) e, ao final, escreve a seção "Cruzamento" do `docs/GDD.md`.

Subprojeto 2 de 6 (núcleo v2 → **cavalos v2** → equipamentos → expedições → montarias → economia).
Branch: `claude/cruzamento`. Referência de regras: Black Desert (guia de nov/2026 enviado pelo Vinicius).

## 1. Objetivo

Deixar o jogador **ter várias montarias**, escolher qual corre, e **criar potros** cruzando duas delas
(ou uma sua com um reprodutor de aluguel). O cruzamento é o motor de progressão de Comum a Lendário:
sobe o **grau** com frequência e a **raridade** raramente; o Mítico fica fora do cruzamento (nasce de
um "despertar", subprojeto futuro).

Pergunta que o protótipo precisa responder: cruzar para montar o cavalo certo para o mapa/clima é
mais divertido do que simplesmente subir de nível?

## 2. Decisões (com a origem)

| Decisão | Origem |
|---|---|
| Haras com reprodutores de aluguel (NPC) + cruzar dois seus | Mercado de Cruzamento do BDO; protótipo precisa do 2º pai |
| Garanhão cruza 2×, égua 1× (éguas selvagens raras 4×) | BDO |
| Égua pesa 60%, garanhão 40% no cálculo | BDO ("o tier da égua pesa mais") |
| Cruza em qualquer nível; chances **saturam no nível 30** | Vinicius ("níveis baixos, chances menores") + BDO (Lv. 30) |
| Elemento: iguais → igual; diferentes → 50/50 | Vinicius |
| Status base sorteados na faixa da raridade × grau (não copiados dos pais) | Vinicius ("aleatórios no range do tier") + BDO |
| **Grau** ★/★★/★★★ dentro da raridade = sub-tier | Vinicius ("tier interno subindo até o limite da categoria") |
| Cruzamento até Lendário; Mítico só por despertar | Vinicius (opção A) + BDO (T9/T10 não cruzam) |
| Troca: consome os dois pais | BDO (Exchange) |
| Corcel: conjunto de skills do tier garante herança | BDO (Courser) |
| Estábulo com 3 vagas, expansão por Ouro | BDO (3 vagas + ranchos) |
| Instantâneo no protótipo; gestação com timer fica prevista | BDO (2h24, pula com Pérolas) |

Regras invioláveis continuam: determinismo (potro reproduzível pela seed), pagar antes de ver
resultado, Gemas nunca viram Ouro (reset de cruzamento/pular gestação com Gemas são conveniências —
decisão da economia, fora deste subprojeto).

## 3. Modelo de dados

### 3.1 Montaria possuída (instância)
```js
{
  uid: 'm7',                       // id da instância (sequencial por save)
  templateId: 'brasa' | null,      // de onde veio (inicial/selvagem) ou null para potro
  name, especie: 'cavalo', element, rarity, sex: 'm'|'f',
  grau: 1|2|3,                     // ★ / ★★ / ★★★
  level, xp, skills: [],
  base: {7}, potential: {7}, palette,
  breedLeft: 2|1|4,                // cruzamentos restantes (garanhão 2, égua 1, égua rara 4)
  parents: null | { f: { uid|null, name }, m: { uid|null, name } },
  born: 0                          // breedCounter em que nasceu (0 = não nasceu de cruzamento)
}
```
Dados (`data.js`): `mount()` ganha `grau` e `breedLeftMax` opcional. Iniciais nascem **★★**; selvagens:
Comum ★ (Pangaré, Lambari) ou ★★ (Faísca, Capim); Mágico ★★; Raro ★★ (Ventania ★★★); Lendário ★★★;
Mítico ★★★. `breedLeftMax` só nas éguas raras selvagens (nenhuma hoje; campo previsto).

### 3.2 Save v3
```js
{ v: 3, rev, gold, inventory, equipped, tier, seedBase, raceCounter, pending,
  races, wins, podiums, goldWon,
  mounts: [ ...instâncias ], activeId: 'm1', nextUid: 2,
  stableSlots: 3, breedCounter: 0 }
```
Migração v2 → v3: `mounts = [instância do inicial]` com `level/xp/skills` do save, `grau 2`,
`breedLeft` pelo sexo, `activeId = 'm1'`; `starterId` deixa de existir (o inicial é `mounts[0]`).
`sanitize` valida cada instância (campos, faixas, skills ≤ vagas, `activeId` existente — senão a
primeira) e `stableSlots` em 3–8. Saves v1 passam por v2 e depois v3.

`playerHorse()` vira `activeMount()` (clone da instância ativa). Tudo que hoje usa o inicial — sala,
corrida, resultado, XP, aprendizado de skill, pareamento por rating — passa a usar a ativa.

## 4. Grau e faixas de status

Faixa de status base por raridade (largura 16) e janela por grau:

| Raridade | Faixa | ★ | ★★ | ★★★ | Piso de potencial (★/★★/★★★) |
|---|---|---|---|---|---|
| Comum | 36–52 | 36–44 | 41–47 | 44–52 | 0 / 8 / 16 |
| Mágico | 44–60 | 44–52 | 49–55 | 52–60 | 0 / 8 / 16 |
| Raro | 52–68 | 52–60 | 57–63 | 60–68 | 0 / 8 / 16 |
| Lendário | 60–76 | 60–68 | 65–71 | 68–76 | 0 / 8 / 16 |
| Mítico | 68–84 | 68–76 | 73–79 | 76–84 | 0 / 8 / 16 |

Cada um dos 7 status base é sorteado **independentemente** na janela (inteiro uniforme). Tetos,
vagas e chance de skill continuam por raridade (núcleo v2). Na tela, o grau aparece como estrelas ao
lado da raridade.

## 5. Estábulo com várias montarias

- **Vagas:** começa com 3; expansão +1 vaga por **300 Ouro**, até 8.
- **Lista:** um cartão por montaria — nome, raridade + estrelas, elemento, sexo (♂/♀), nível,
  cruzamentos restantes, badge "Ativa". Cartão grande da ativa (como hoje) com os 7 status e skills.
- **Ações:** *Tornar ativa* · *Renomear* (`prompt`, 2–16 caracteres, sem HTML — tudo via `esc()`) ·
  *Liberar* (confirmação; some do estábulo, **sem devolver Ouro**; a ativa não pode ser liberada; a
  última montaria não pode ser liberada).
- Botão **Haras** abre a tela de cruzamento.
- Tela inicial (escolha do inicial) continua igual; só cria `mounts[0]`.

## 6. Haras

1. **Sua montaria:** seletor entre as suas com `breedLeft ≥ 1`.
2. **Parceiro:** sexo oposto. Ou outra sua (`breedLeft ≥ 1`) ou um **reprodutor de aluguel**: os
   selvagens de `WILD_HORSES` com sexo oposto, exceto Míticos. Preço = base da raridade × multiplicador
   do grau: Comum 100 · Mágico 250 · Raro 600 · Lendário 1500; ★ ×1 · ★★ ×1,25 · ★★★ ×1,5
   (arredondado). Cruzar dois seus custa **50 Ouro** (registro).
3. **Calculadora:** antes de confirmar, a tela mostra as chances de raridade e de grau do potro
   (§7), o elemento possível, e o custo. Mesma função usada para gerar — a prévia nunca mente.
4. **Cruzar:** exige vaga livre e Ouro; debita, gera o potro (§7), decrementa `breedLeft` dos pais
   seus, `breedCounter++`, persiste, mostra "Nasceu X!" com o cartão do potro e botão *Tornar ativa*.
5. **Troca:** dois seus de sexos opostos, **qualquer** `breedLeft`, 50 Ouro; mesmo cálculo; os dois
   somem e o potro ocupa a vaga de um deles (nunca falta vaga). Confirmação explícita ("Os dois pais
   deixam de existir").

Instantâneo. Campo `gestacao` previsto na instância (null hoje) para o timer futuro.

## 7. Geração do potro (`prototype/src/breed.js`, função pura)

`Breed.foal({ f, m, seedBase, breedCounter, nextUid }) -> instância` com
`rng = mulberry32(hash2(seedBase, 0xB0B0 + breedCounter))` (fluxo único; ordem de chamadas fixa
abaixo). `Breed.odds({ f, m }) -> { rarity: {id: p…}, grau: {1: p, 2: p, 3: p} }` usa as mesmas tabelas
sem RNG (para a calculadora).

**Passo 0 — nível efetivo:** `L = clamp((0,6·nível(f) + 0,4·nível(m)) / 30, 0, 1)`.

**Passo 1 — raridade** (1 chamada de `rng`). `base = min(ordem(f), ordem(m))`, `diff = |ordem(f) − ordem(m)|`.
Colunas interpoladas linearmente em `L` entre as linhas L=0 e L=1:

| Pais | 1 abaixo | igual | 1 acima | 2 acima |
|---|---|---|---|---|
| `diff = 0`, L=0 → L=1 | 45% → 30% | 54% → 65% | 1% → 4,5% | 0% → 0,5% |
| `diff ≥ 1`, L=0 → L=1 | 35% → 20% | 50% → 50% | 15% → 29% | 0% → 1% |

Ajustes depois do sorteio: abaixo de Comum → Comum; acima de **Lendário → Lendário** (Mítico nunca
nasce de cruzamento). A calculadora mostra as probabilidades já com esses ajustes somados.

**Passo 2 — grau** (0 ou 1 chamada). Se a raridade subiu → ★ (sem sorteio). Se desceu → ★★★ (sem
sorteio). Se igual: `gb = round(0,6·grau(f) + 0,4·grau(m))`; sorteio desce / mantém / sobe =
25% → 10% / 55% → 50% / 20% → 40% (L=0 → L=1); fora de 1–3 vira "mantém".

**Passo 3 — elemento** (0 ou 1 chamada): iguais → igual; diferentes → 50/50 (`neutro` conta como elemento).

**Passo 4 — sexo** (1 chamada): 50/50. `breedLeft` = 2 (♂) ou 1 (♀).

**Passo 5 — status base** (7 chamadas, ordem `STAT_KEYS`): inteiro uniforme na janela da §4.

**Passo 6 — potencial** (7 × até 2 chamadas, ordem `STAT_KEYS`): `rng() < 0,5` → herda de um pai
sorteado (`rng() < 0,5` → f, senão m); senão `floor(rng()·32)`. Depois `max(piso do grau, valor)`.

**Passo 7 — skills:**
- Candidatas = skills de f e depois de m (sem repetição) que **não** são exclusivas e cujo
  `element` é `neutro` ou o do potro.
- **Corcel** (§8): `g = 2` se os dois são corcéis; `1` se só um (e `rng() < 0,5` → `2`); senão `0`.
  Sorteia `min(g, candidatas)` garantidas (sem reposição, 1 chamada cada).
- Cada candidata restante, na ordem: `rng() < 0,35` → herdada (1 chamada cada).
- Corta em `skillSlots(raridade do potro)`.
- Completa até `bornSkills(raridade)` com skills sorteadas do catálogo (não exclusivas, compatíveis
  com o elemento, não repetidas; 1 chamada cada).

**Passo 8 — nome e aparência** (2 chamadas): `name = FOAL_NAMES[floor(rng()·N)]` (lista de 30 nomes
em `data.js`); `palette` = mistura das paletas dos pais com `t = 0,3 + 0,4·rng()` (`Sprites.mix`
canal a canal), ou `randomPalette(seed, element)` se um pai não tiver paleta.

**Resultado:** `{ uid: 'm'+nextUid, templateId: null, especie: 'cavalo', level: 1, xp: 0, parents:
{ f: {uid, name}, m: {uid, name} }, born: breedCounter, grau, breedLeft, gestacao: null, … }`.

## 8. Corcel

Montaria que tem **todas** as skills do conjunto da sua raridade:

| Raridade | Conjunto |
|---|---|
| Comum | Arranque |
| Mágico | Arranque, Sprint |
| Raro | Arranque, Sprint, Drift |
| Lendário | Arranque, Sprint, Drift, Saída Rápida |
| Mítico | Arranque, Sprint, Drift, Saída Rápida, Arrancada Final |

`Breed.isCorcel(mount)`. Na tela, ícone dourado ao lado do nome; no haras, a calculadora diz "Corcel:
herança garantida".

## 9. Telas

- **Estábulo:** lista de cartões + cartão da ativa + botões *Haras* e *Expandir estábulo (300)*.
- **Haras:** dois seletores (sua montaria / parceiro: abas "Minhas" e "Aluguel"), calculadora, custo,
  botões *Cruzar* e *Troca* (a Troca só com dois seus). Resultado: cartão do potro.
- **Sala / corrida / resultado:** usam a ativa; o cartão do resultado mostra o nome da montaria ativa.
- **Painel dev** (§10) só com `?dev=1`.

## 10. Atalho de protótipo

`preview.html?dev=1` mostra um painel fixo no rodapé com: *+10 níveis (ativa)* (aplica XP até
subir 10 níveis, com aprendizado de skill normal), *+1000 Ouro*, *+1 cruzamento (ativa)*. Nada disso
existe sem o parâmetro; o protótipo é descartável.

## 11. Verificação

`prototype/tools/sim-test.js`, seção `cruzamento` (carrega `breed.js`):
1. Determinismo: mesmos pais + `seedBase` + `breedCounter` ⇒ potro idêntico (JSON).
2. Distribuição: 20 mil potros de dois Raros ★★ no nível 30 ⇒ Mágico 30±2 p.p., Raro 65±2, Lendário 5±1
   (4,5 + 0,5 dobrado em Lendário), **Mítico 0**; dois Raros no nível 1 ⇒ Lendário ≤ 2%.
3. Par misto Raro × Lendário nível 30 ⇒ Lendário 30±2 p.p.
4. Grau: raridade subiu ⇒ ★; desceu ⇒ ★★★; igual ⇒ distribuição 10/50/40 ±2 p.p. (nível 30, pais ★★).
5. Status dentro da janela do grau; potencial ≥ piso; `skills.length ≤ skillSlots` e `≥ bornSkills`;
   nenhuma exclusiva herdada; elemento compatível.
6. Corcel: dois corcéis ⇒ ≥ 2 skills herdadas em 100% dos casos (quando há ≥ 2 candidatas).
7. `odds()` bate com a frequência observada (±2 p.p.).
8. Elemento: pais iguais ⇒ igual em 100%; diferentes ⇒ 50±2%.

`prototype/tools/ui-test.mjs`: estábulo com 3 vagas; abrir Haras; alugar reprodutor (Ouro debitado
no valor da tabela); potro aparece (2 montarias); tornar ativa; correr com o potro; recarregar mantém;
save v2 migra (Ouro intacto, inicial = `mounts[0]`); Troca consome os dois; renomear com `<b>` não
injeta HTML. `check.sh` continua a porta.

## 12. Fora de escopo (vai para o GDD como "depois")

Despertar (Lendário → Mítico), mercado de cruzamento entre jogadores, gestação com timer e "pular com
Gemas", reset de cruzamentos com Gemas, Entrega Imperial (vender ao estábulo), Cavalo Imperial, Level
Up manual, equipamento do potro (subprojeto 3), potros de outras espécies (subprojeto 5).

## 13. Riscos

- **Inflação de cavalos:** cada aluguel cria uma montaria; sumidouros: vagas limitadas, Troca,
  liberar sem Ouro. A economia (subprojeto 6) define venda ao estábulo.
- **Potro sempre pior que os pais** (status sorteados na faixa, não herdados): o grau mitiga; se os
  testes mostrarem que cruzar nunca compensa subir de nível, subir o piso de potencial por grau.
- **Save v3 corrompido:** `sanitize` reconstrói a partir do que for válido e nunca perde Ouro; se
  `mounts` ficar vazio, recria o inicial pelo `templateId` (ou Brasa).
