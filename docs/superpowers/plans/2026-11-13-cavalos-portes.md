# Visuais 2, parte 2b (portes) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dar a cada cavalo um porte herdado (esguio, padrão ou robusto), desenhado por 12 moldes novos gerados
no PixelLab a partir de um corpo-mestre por porte.

**Architecture:**
- **Código primeiro, com os moldes de hoje fazendo as vezes dos três portes** (T1–T4, sem créditos):
  - o gene vive no `data.js` e no `breed.js`;
  - o `sprites.js` escolhe o molde por porte e elemento;
  - o `game.js` mostra e guarda o porte;
  - as ferramentas de geração ganham critérios automáticos e folhas de conferência.
- **Geração** (T5–T6), feita pelo controlador e com a aprovação do Vinicius. Os moldes saem numa pasta de espera
  que o build não lê.
- **Integração** (T7): os moldes aprovados entram e os antigos saem no mesmo commit.
- **Documentação** (T8).

**Tech Stack:** HTML/CSS/JS ES5 puro em `prototype/src/` (UMD, sem dependências); Node para as ferramentas e os
testes; Playwright já instalado para o `ui-test`; PixelLab API v2 pelo proxy.

**Spec:** `docs/superpowers/specs/2026-11-13-cavalos-portes-design.md` (aprovada em 2026-11-13).

## Global Constraints

- **Git e código:**
  - branch `claude/visuais-2`; commits pequenos, no imperativo, em português, com o trailer da sessão;
  - ES5 em `prototype/src/`; nenhuma dependência nova;
  - `sim.js` e `gear.js` não mudam; a corrida dá o mesmo resultado; nada de `Math.random`.
- **Sorteios do cruzamento:**
  - os do `foal()` que já existem (passos 1 a 9: atributos de cruzamento e marcas) não mudam em número nem em
    ordem;
  - o porte sai de `mulberry32(hash2(seedBase >>> 0, 0x504F0000 + breedCounter))`, com 2 sorteios: primeiro a
    mutação, depois o valor;
  - o Mítico nunca nasce de cruzamento.
- **Valores do gene:** `['esguio', 'padrao', 'robusto']`, com os rótulos "Esguio", "Padrão" e "Robusto";
  mutação de 0,10; porte padrão `'padrao'`.
- **O porte é só aparência:** nada em status, Poder, preço, aluguel, chance de skill ou corrida.
- **Save sem versão nova:**
  - `porte` é campo opcional no cavalo, validado com `indexOf` estrito;
  - fora da lista, vale a escada: o porte do modelo do catálogo (`templateId`); senão `porteDoId(chave)`.
- **Gerados:** `prototype/dist/` e `docs/wiki.md` só saem do build (`node prototype/build.mjs`) e são commitados
  junto com o `src/`.
- **Moldes:**
  - 64×64; 3 portes × 4 estilos (`lisa` = mestre, `chamas` = Fogo, `ondas` = Água, `folhas` = Grama);
  - arquivos `molde-<porte>-<estilo>-<estado>.png` e `molde-<porte>-<estilo>.json`;
  - a carga é tudo ou nada.
- **Escala:** sai do maior `larguraUtil` entre os 4 moldes do padrão.
- **Créditos:** nada é gerado sem a confirmação explícita do Vinicius na hora. Teto do lote: **90 gerações**,
  somadas entre todas as rodadas. Cada arquivo gerado entra no `docs/memoria/assets.md`.
- **Antes de dizer que terminou:** rodar `./scripts/check.sh` e mostrar o resultado.

## Review Focus

1. **RF1 — Save com lixo no porte.** `porte` como número, `'Robusto'`, `null`, objeto ou `'__proto__'` nunca
   quebra. O cavalo fica com um dos 3 valores e com o mesmo valor ao recarregar. Teste na T1 e na T3.
2. **RF2 — Conjunto de moldes incompleto.** Com 11 dos 12 moldes novos na tabela, o jogo nunca mistura conjuntos:
   usa os antigos, se existirem, com um aviso; senão, o desenho por código. Teste na T2.
3. **RF3 — Robusto e esguio na tela estreita.** A 360 px, nos cartões do estábulo e na raia, o cavalo de
   qualquer porte fica inteiro e sem rolagem de lado. Teste na T3, que vale de verdade a partir da T7.
4. **RF4 — Cavalo de antes da 2b.** Alugado, rival, potro de pais sem `porte` ou cavalo de save antigo herda o
   porte do modelo ou o calculado do id, estável entre sessões. Teste na T1 e na T3.
5. **RF5 — Desempenho com portes misturados.** Corrida DEV com 8 Míticos, de portes diferentes, abaixo do teto
   de 6 ms por quadro, e o cache de moldes não cresce depois da largada. Teste na T3, que vale de verdade a partir
   da T7.

---

### Task 1: Gene `porte` (dados, herança e escada)

**Files:**
- Modify: `prototype/src/data.js` (constante `PORTES`, exportada como `GameData.PORTES`; campo `porte` nos 15
  cavalos do catálogo, no objeto `extra` do `mount()`, ao lado de `marcas`)
- Modify: `prototype/src/breed.js` (funções do porte, passo 10 no cabeçalho, campo `porte` no retorno do `foal()`)
- Test: `prototype/tools/sim-test.js`

**Interfaces:**
- Produces:
  - `GameData.PORTES = { valores: ['esguio','padrao','robusto'], nomes: { esguio: 'Esguio', padrao: 'Padrão', robusto: 'Robusto' }, mutacao: 0.10, padrao: 'padrao' }`;
  - `Breed.porteValido(p) -> boolean`;
  - `Breed.porteDoId(chave) -> string`: `S.mulberry32(S.hash2(hashChave(chave), 0x504F5254))` com 1 sorteio,
    `valores[floor(r() * 3)]`. Usa um fluxo diferente do `marcasDoId` para não acompanhar as marcas;
  - `Breed.porteDe(porte, templateId, chave) -> string`: a escada da spec §3, igual à `marcasDe`;
  - `foal(opts).porte`: o fluxo `0x504F0000 + breedCounter`; `mut = r() < 0.10`; `pick = r()`; com mutação,
    `valores[floor(pick * 3)]`; sem mutação, o da égua (`opts.f`) se `pick < 0.5`, senão o do garanhão;
  - o porte de cada pai é `porteDe(p.porte, p.templateId, p.uid ?? p.id ?? p.name)`, a mesma chave das marcas.
- **Catálogo:**

  | Cavalo | id | Porte |
  |---|---|---|
  | Brasa | `brasa` | `padrao` |
  | Maré | `mare` | `padrao` |
  | Ipê | `ipe` | `padrao` |
  | Faísca | `w-faisca` | `esguio` |
  | Tição | `w-ticao` | `robusto` |
  | Fogaréu | `w-fogareu` | `robusto` |
  | Boitatá | `w-boitata` | `esguio` |
  | Lambari | `w-lambari` | `esguio` |
  | Garoa | `w-garoa` | `padrao` |
  | Pororoca | `w-pororoca` | `robusto` |
  | Iara | `w-iara` | `esguio` |
  | Capim | `w-capim` | `esguio` |
  | Mandacaru | `w-mandacaru` | `robusto` |
  | Ventania | `w-ventania` | `esguio` |
  | Jequitibá | `w-jequitiba` | `robusto` |

- [ ] **Step 1: Gravar a impressão dos sorteios atuais, antes de mexer no `breed.js`.** Escreva um snippet que gera
  200 potros com `Breed.foal` (qualquer lista fixa de pares do catálogo, a mesma antes e depois; `seedBase` de 1 a 200,
  `breedCounter` = i % 7, `nextUid` = i) e calcula `Breed.hashChave(JSON.stringify(lista))`. Rode-o em HEAD e guarde o número como constante
  `IMPRESSAO_FOAL_2A` no teste.
- [ ] **Step 2: Escrever os testes que falham** (seção `Portes` do `sim-test.js`):
  - `portes: catálogo`: cada um dos 15 com o porte da tabela;
  - `portes: sorteios antigos intactos`: a mesma lista do Step 1, com o campo `porte` apagado de cada potro, dá
    `IMPRESSAO_FOAL_2A`;
  - `portes: herança`, com 4.000 potros de égua esguia × garanhão robusto:
    - o teste refaz o fluxo `0x504F0000` para saber se houve mutação;
    - a mutação fica entre 8,5% e 11,5%;
    - sem mutação, o porte é sempre o de um dos pais, e o da égua sai entre 47% e 53%;
  - `portes: porteDoId`:
    - a mesma chave dá sempre o mesmo porte;
    - em 1.000 chaves (`'k' + i`) aparecem os 3 valores, cada um entre 28% e 39%;
  - `portes: escada (RF1, RF4)`:
    - porte válido fica como está;
    - lixo (`2`, `'Robusto'`, `null`, `{}`, `'__proto__'`) com `templateId 'w-ticao'` dá `'robusto'`;
    - lixo sem templateId dá `porteDoId(chave)`;
    - pai sem campo `porte` herda pela escada;
  - `portes: Mítico`: o teste que já existe ("Mítico nunca nasce") continua passando, sem mudança.
- [ ] **Step 3: Rodar e ver falhar.** Run: `node prototype/tools/sim-test.js`. Expected: FAIL nos testes `portes:`.
- [ ] **Step 4: Implementar** o `PORTES`, o catálogo e as funções do porte com as assinaturas acima. Some o
  passo 10 no comentário de cabeçalho do `breed.js`, no estilo do passo 9.
- [ ] **Step 5: Rodar e ver passar.** Run: `node prototype/tools/sim-test.js && node prototype/tools/balance.js --quick`.
  Expected: 0 falhas; balanço OK (nada de corrida mudou).
- [ ] **Step 6: Build e commit.** `node prototype/build.mjs`; commitar `src`, `dist` e o teste.

### Task 2: Desenho por porte (`sprites.js` e tabela de moldes)

**Files:**
- Modify: `prototype/src/sprites.js` (carga, escolha do molde, escala, chaves de cache e opção `porte`)
- Modify: `prototype/tools/arte-embutida.mjs` (`lerMoldes` aceita os nomes novos)
- Test: `prototype/tools/fx-test.js`

**Interfaces:**
- Consumes: `GameData.PORTES` (T1).
- Produces:
  - **Tabela** `window.__MOLDES.estilos`, com dois formatos de chave:
    - chave nova `'<porte>-<estilo>'`, de `molde-<porte>-<estilo>.json`, com porte ∈ PORTES e estilo ∈
      `chamas|ondas|folhas|lisa`;
    - chave antiga `'<estilo>'`, de `molde-<estilo>.json`;
    - em ambos, `json.estilo` = a chave.
  - **`Sprites.moldesConjunto`:** `'portes'` (os 12 novos), `'legado'` (os 4 antigos) ou `null` (sem moldes).
  - **Carga:**
    - com as 12 chaves novas, `'portes'`;
    - senão, com as 4 antigas, `'legado'`, mais um `console.warn` se havia alguma chave nova (conjunto
      incompleto);
    - senão, sem moldes;
    - nunca mistura conjuntos.
  - **`drawHorse(ctx, x, y, opts)`:**
    - aceita `opts.porte`; valor fora da lista vale `'padrao'`;
    - no `'portes'`, o molde é `porte + '-' + estiloDe(element)`;
    - no `'legado'`, é `estiloDe(element)` para qualquer porte.
  - **`porte` também em:** `horseBox(x, y, opts)`, `prepararCavalo(opts)` e
    `anchorsFor(element, scale, estado, porte)` (o 4º parâmetro é opcional).
  - **Escala:** no `'portes'`, `moldesLref` = maior `larguraUtil` entre `padrao-chamas`, `padrao-ondas`,
    `padrao-folhas` e `padrao-lisa`; no `'legado'`, como hoje.
  - **Caches:** as chaves do `moldCache` e do `brilhoCache` usam a chave do molde no lugar do estilo.

- [ ] **Step 1: Escrever os testes que falham** (`fx-test.js`; estender o `SINT` para montar uma tabela de 12
  chaves; os moldes do esguio e do robusto são o sintético com o corpo e as pernas alterados, para desenharem
  diferente, e o robusto mais largo):
  - `portes: conjunto completo`: `moldesConjunto === 'portes'`. `robusto` e `esguio` desenham diferente de
    `padrao` (retângulos diferentes). Porte inválido desenha igual ao `padrao`;
  - `portes: escala do padrão`: a escala com o robusto mais largo é igual à escala só com os moldes do padrão;
  - `portes: conjunto incompleto (RF2)`:
    - 11 chaves novas mais as 4 antigas ⇒ `'legado'` e um `console.warn`;
    - 11 chaves novas sem as antigas ⇒ `moldsReady === false`;
  - `portes: legado`: com só as 4 chaves antigas, `'legado'`, e `robusto` desenha igual a `padrao`;
  - `portes: sem moldes`: o desenho por código com `porte` é igual, byte a byte, ao desenho sem a opção;
  - `portes: cache`: com o conjunto completo, `padrao` e `robusto` do mesmo elemento ocupam entradas
    diferentes no cache.
- [ ] **Step 2: Rodar e ver falhar.** Run: `node prototype/tools/fx-test.js`. Expected: FAIL nos testes `portes:`.
- [ ] **Step 3: Implementar** a carga, a escolha do molde, a escala e as chaves com as interfaces acima.
  Atualize o comentário de cabeçalho do bloco de moldes (~linha 885) e o do `lerMoldes`.
- [ ] **Step 4: Rodar e ver passar.** Run:
  `node prototype/tools/fx-test.js && node prototype/tools/moldes-test.mjs && node prototype/build.mjs`.
  Expected: 0 falhas. O build lista os moldes `chamas, folhas, lisa, ondas`, ainda os antigos.
- [ ] **Step 5: Commit** (`src`, `tools`, `dist`).

### Task 3: Telas e save (`game.js`)

**Files:**
- Modify: `prototype/src/game.js`
- Test: `prototype/tools/ui-test.mjs`

**Interfaces:**
- Consumes:
  - `Breed.porteDe`, `Breed.porteValido` e `GameData.PORTES` (T1);
  - `drawHorse` e `prepararCavalo` com `opts.porte` (T2).
- Produces, todos dentro do `game.js`:
  - **Regra do porte:** os pontos de uso chamam `BRD.porteDe` direto; nenhuma função local repete a regra.
  - **Save:**
    - `sanitizeMount` grava `porte: BRD.porteDe(m.porte, templateId, m.uid)`;
    - a montaria criada de um modelo (~linha 392) grava o porte do modelo.
  - **Desenho:** `opcoesVisuais(horse, joquei)` devolve também `porte`, com a mesma chave das marcas. Assim o
    rival usa o porte do modelo.
  - **`porteTexto(h) -> 'Porte: Robusto'`:**
    - na ficha da Montaria, numa linha antes da linha das marcas;
    - no Haras, em cada linha de pai, como `Nome · Porte: Esguio · Marcas: …`.
  - **Calculadora do Haras,** uma linha nova:
    - pais com o mesmo porte: `Porte do potro: Robusto (10% de chance de mutação)`;
    - pais diferentes: `Porte do potro: Esguio ou Robusto (10% de chance de mutação)`.
  - **Gaveta DEV:**
    - um seletor `data-dev-campo="porte"` com os 3 valores, preenchido pela ativa;
    - o `devCavaloEscolhido` leva o porte;
    - o texto do seletor não tem símbolos, como os das marcas.

- [ ] **Step 1: Escrever os testes que falham** (bloco `portes` do `ui-test.mjs`, no padrão do bloco `marcas`):
  - **ficha:** mostra "Porte: Padrão" para Brasa e "Porte: Robusto" para uma montaria de Tição;
  - **Haras:**
    - as linhas dos pais trazem o porte;
    - a Calculadora mostra "ou" quando os portes são diferentes, e um porte só quando são iguais;
  - **save com lixo (RF1):** um save com `porte` de lixo em 3 montarias carrega, mostra um porte válido e grava o
    mesmo porte ao recarregar;
  - **save antigo (RF4):** um save sem o campo `porte`, com um alugado de `w-pororoca`, mostra "Porte: Robusto";
  - **rival:** com espia no `drawHorse`, o porte do rival na corrida é o do modelo dele;
  - **DEV:** trocar o seletor de porte muda o porte gravado no save DEV, e nunca toca no
    `galope-elemental:v1`;
  - **tela estreita (RF3):** a 360 px, a ativa nos 3 portes (pelo DEV) fica inteira no cartão do estábulo e na
    raia, sem rolagem de lado;
  - **desempenho (RF5):**
    - a corrida DEV com 8 Míticos de portes alternados (4 robustos, 2 esguios, 2 padrões) fica abaixo do teto `TETO_MS` (6 ms) que já existe;
    - o cache de moldes não cresce depois da largada.
- [ ] **Step 2: Rodar e ver falhar.** Run: `node prototype/build.mjs && node prototype/tools/ui-test.mjs portes`
  (filtro `quer('portes')`, como o bloco `marcas`). Expected: FAIL.
- [ ] **Step 3: Implementar** com as interfaces acima.
- [ ] **Step 4: Rodar e ver passar.** Run: `node prototype/build.mjs && node prototype/tools/ui-test.mjs portes`.
  Expected: OK.
- [ ] **Step 5: Verificação completa e commit.** Run: `./scripts/check.sh`. Expected: `VERIFICAÇÃO COMPLETA: OK`. As
  capturas oficiais não mudam nesta tarefa, porque os moldes ainda são os antigos.

### Task 4: Ferramentas de geração (sem créditos)

**Files:**
- Create: `prototype/tools/portes-criterios.mjs` (critérios automáticos da spec §5; puro, sem rede)
- Create: `prototype/tools/folha-portes.mjs` (folhas de conferência em HTML)
- Modify: `prototype/tools/pixellab-moldes.mjs` (lote `portes`)
- Test: `prototype/tools/moldes-test.mjs` (seção `Portes: critérios`)

**Interfaces:**
- Consumes: `Marcas.zonas` (UMD, carregado por `createRequire` no `.mjs`); `normalizar`, `ancoras` e
  `posProcessar` do `moldes-lib.mjs`.
- **`portes-criterios.mjs`:**
  - `medidas(idx, w, h, ancora) -> { altura, comprimento, espessura, footY, nose }`: as medidas do corpo da spec §4.
    Só os papéis 1 a 3. A espessura é na coluna da sela, ou na coluna do meio do bbox quando não há sela;
  - `pernas(idx, w, h, ancora) -> n`: o número de pernas distintas no `perna[]` do `Marcas.zonas`;
  - `criterioPernas(molde) -> [{ criterio, ok, valor, limite }]`: retrato = 4, parado = 4; galope ≥ 3 em todo
    quadro e = 4 em pelo menos 5 dos 9;
  - `criterioMesmoCorpo(versao, mestre)`: no retrato e no parado, `|Δ| ≤ 2` em `footY`, `nose.x`, `nose.y`,
    `altura` e `comprimento`;
  - `criterioPortes({ esguio, padrao, robusto })`, nos retratos dos mestres:
    - `altura/comprimento` do esguio ≥ 1,10 × a do padrão;
    - `altura/comprimento` do robusto ≤ 0,92 × a do padrão;
    - `espessura/comprimento` do robusto ≥ 1,15 × a do padrão;
  - `criterioGalope(molde)`: nos 9 quadros, o lombo na coluna da sela varia ≤ 3 px; `nose.x` a ±6 px do da
    pose de corrida; comprimento varia ≤ 4 px;
  - `molde` = `{ w, h, retrato: idx, parado: idx, galope: [idx × 9], ancoras: { retrato, parado, 'galope-0'…'galope-8' }, larguraUtil }`.
- **Lote `portes`:**
  - `--lote portes --fase mestres|piloto|versoes [--only <porte>[-<estilo>]] [--teto 90] [--gerar]`, com dry-run
    por padrão;
  - **mestres:** `lisa` dos 3 portes;
  - **piloto:** `chamas` dos 3 portes, com `init_image` = o mestre no mesmo estado;
  - **versoes:** `ondas` e `folhas` dos 3 portes, e `chamas` onde o piloto foi refeito;
  - os pedidos seguem a receita da spec §5: `create-image-pixflux` para retrato, parado e pose de corrida;
    `animate-with-text-v3` para o galope a partir da pose; o texto do porte vem da tabela de aparência da spec §4;
  - **seeds:** cada item tenta até 3 seeds (base, base + 100, base + 200) e para na primeira que passa nos
    critérios automáticos;
  - **piloto reprovado no "mesmo corpo"** nas 3 seeds: as versões daquele porte saem sem `init_image`, e o script
    diz isso;
  - **saída:**
    - na pasta de espera `prototype/assets/pixellab/novos/`, que o build não lê;
    - os crus em `prototype/assets/pixellab/raw/`;
    - o relatório dos critérios em `novos/criterios.json`;
  - **teto:**
    - somado entre rodadas, em `novos/gasto.json` (`{ geracoes, chamadas, rodadas: [...] }`);
    - a chamada que passaria do teto não sai;
  - `--reprocessar` refaz os PNG sem rede, a partir dos crus.
- **`folha-portes.mjs`:**
  - `node prototype/tools/folha-portes.mjs --fase mestres|final` escreve `novos/folha-<fase>.html`, autocontida;
  - **mestres:** os 3 lado a lado, retrato, parado e galope animado, em 1× e 4×, com o resultado de cada critério;
  - **final:** as 9 versões com galope animado, recoloridas com a paleta de 3 cavalos do catálogo de cada
    elemento, com marcas, jóquei e raridade (Comum, Mágico e Mítico). Para isso, embute
    `data.js`/`sim.js`/`breed.js`/`marcas.js`/`sprites.js` e uma tabela `__MOLDES` lida de `novos/`;
  - item reprovado aparece marcado com o critério que falhou.

- [ ] **Step 1: Escrever os testes que falham** (`moldes-test.mjs`, seção `Portes: critérios`, com moldes
  sintéticos montados no teste):
  - `medidas` num retângulo conhecido dá a altura, o comprimento e a espessura esperados, sem contar a crina
    (papéis 4 e 5) nem o jóquei;
  - `criterioPernas`: o sintético de 4 pernas separadas passa; o mesmo com duas pernas coladas reprova o retrato;
  - `criterioMesmoCorpo`: deslocado 2 px passa e 3 px reprova; uma crina maior não muda o resultado;
  - `criterioPortes`: um esguio sintético com `altura/comprimento` 1,12 × padrão passa, e um com 1,05 ×
    reprova; o mesmo vale para os limites do robusto;
  - `criterioGalope`: um galope com o lombo pulando 4 px reprova;
  - **moldes de hoje:** os 4 moldes atuais rodam pelos critérios sem lançar erro, e o relatório sai impresso (só
    informação, não falha);
  - **dry-run:** `--lote portes --fase mestres` sem `--gerar` lista 3 itens e 12 chamadas previstas, sem rede
    (rodar o script com `fetch` substituído por um que lança erro).
- [ ] **Step 2: Rodar e ver falhar.** Run: `node prototype/tools/moldes-test.mjs`. Expected: FAIL na seção nova.
- [ ] **Step 3: Implementar** os três arquivos com as interfaces acima.
- [ ] **Step 4: Rodar e ver passar.** Run: `node prototype/tools/moldes-test.mjs` e
  `node prototype/tools/pixellab-moldes.mjs --lote portes --fase mestres`, que é o dry-run. Expected: 0 falhas; o
  dry-run imprime os pedidos e "nenhuma chamada à API".
- [ ] **Step 5: Commit.**

### Task 5: Mestres (tarefa do controlador, com o Vinicius; gasta créditos)

Não despachar implementador. O controlador roda os comandos e o Vinicius aprova.

- [ ] **Step 1: Pedir a confirmação.** Mostrar ao Vinicius o dry-run da fase `mestres` (itens, chamadas
  previstas, teto de 90 no lote todo) e esperar o "pode gerar". Sem confirmação explícita, parar aqui.
- [ ] **Step 2: Gerar.** Run: `NODE_USE_ENV_PROXY=1 node prototype/tools/pixellab-moldes.mjs --lote portes --fase mestres --teto 90 --gerar`.
  Expected: 3 mestres em `novos/`, com o `criterios.json` e o `gasto.json` atualizados.
- [ ] **Step 3: Commit imediato** de `novos/` e `raw/`. O contêiner pode reiniciar, e cada geração custa créditos.
- [ ] **Step 4: Folha.** Run: `node prototype/tools/folha-portes.mjs --fase mestres`. Publicar a folha como
  artefato do claude.ai e mandar o link. O Vinicius aprova, pede refação de um item (dentro do teto) ou aceita um
  item reprovado.
- [ ] **Step 5: Registrar** a aprovação e o gasto no `docs/memoria/assets.md` (lote `portes`, fase mestres) e
  commitar.

### Task 6: Versões de elemento (tarefa do controlador, com o Vinicius; gasta créditos)

- [ ] **Step 1: Pedir a confirmação** com o dry-run das fases `piloto` e `versoes` e o saldo que sobra do teto de 90.
- [ ] **Step 2: Piloto.** Run: `NODE_USE_ENV_PROXY=1 node prototype/tools/pixellab-moldes.mjs --lote portes --fase piloto --teto 90 --gerar`.
  Commitar `novos/` e `raw/`.
- [ ] **Step 3: Versões.** Run: o mesmo comando com `--fase versoes`. Commitar.
- [ ] **Step 4: Folha final.** Run: `node prototype/tools/folha-portes.mjs --fase final`. Publicar como artefato. O
  Vinicius aprova os 9 ou pede refação dentro do teto. Mais teto, só com a confirmação dele.
- [ ] **Step 5: Registrar** no `assets.md` (uma linha por molde: endpoint, prompt, seeds e custo) e commitar.

### Task 7: Integração dos moldes novos

**Files:**
- Move: `prototype/assets/pixellab/novos/molde-*` → `prototype/assets/pixellab/`
- Delete: os moldes antigos, `prototype/assets/pixellab/molde-{chamas,ondas,folhas,lisa}{.json,-*.png}`
  (ficam no histórico do git)
- Modify: `prototype/src/sprites.js` e `prototype/tools/arte-embutida.mjs` (sai o caminho `'legado'`)
- Test:
  - `prototype/tools/moldes-test.mjs`: os testes de moldes reais passam a rodar sobre os 12;
  - `prototype/tools/fx-test.js`: os testes `portes: legado` e o caso "incompleto com antigos" do RF2 viram
    "incompleto ⇒ sem moldes".

**Interfaces:**
- Consumes: os 12 moldes aprovados na T6.
- Produces:
  - `Sprites.moldesConjunto` ∈ `'portes' | null`;
  - `lerMoldes` só aceita `molde-<porte>-<estilo>.json`.

- [ ] **Step 1: Escrever os testes que falham** (`moldes-test.mjs`, seção `Portes: moldes reais`; leem os 12
  moldes de `assets/pixellab/`, que só estarão lá depois do Step 3):
  - **pernas e corpo:** os critérios da T4 passam nos 12 (pernas, mesmo corpo de cada versão contra o seu
    mestre, portes distintos, galope estável). Item que o Vinicius aceitou reprovado na folha entra numa lista
    `ACEITOS_NA_FOLHA` com o critério e a data;
  - **meias (pendência da 2a):** em cada molde, no retrato e no parado, `patas` = N (1 a 4) dá N manchas
    brancas, contadas como pedaços conexos brancos da camada `camadaMarcas`;
  - **pele acima do capacete (pendência da 2a):** em cada molde com jóquei, a linha do capacete da
    `camadaJoquei` fica acima de todo pixel de pele (papel 8);
  - **brilho das raridades (pendência da 2a):** em cada molde e em cada raridade com brilho, a luminância
    relativa do brilho no alfa de pico sobre a crina fica ≥ 0,05, a mesma medida do teste do Mágico na Grama.
    Use as cores de crina dos cavalos do catálogo daquele elemento.
- [ ] **Step 2: Rodar e ver falhar.** Run: `node prototype/tools/moldes-test.mjs`. Expected: FAIL na seção nova (os
  12 moldes ainda não estão em `assets/pixellab/`).
- [ ] **Step 3: Trocar os moldes.**
  - `git mv` dos novos para `assets/pixellab/` e `git rm` dos antigos, no mesmo commit;
  - tirar o caminho `'legado'` do `sprites.js` e do `lerMoldes`;
  - ajustar o `fx-test` como listado em Files;
  - os testes da 2a que mediam o limite das meias (2 a 4 pernas) passam a exigir 4 pernas no retrato e no
    parado, como diz a spec da 2a §7;
  - atualizar o "Limite conhecido" da spec da 2a: resolvido na 2b.
- [ ] **Step 4: Rodar e ver passar.** Run: `node prototype/build.mjs && node prototype/tools/moldes-test.mjs && node prototype/tools/fx-test.js && node prototype/tools/ui-test.mjs portes`.
  Expected: o build lista 12 moldes (`esguio-chamas`, …); 0 falhas; os testes RF3 e RF5 passam com os moldes novos.
- [ ] **Step 5: Capturas e verificação.**
  - Run: `node prototype/tools/ui-test.mjs` (capturas oficiais, sem `SHOTS_DIR`) e `./scripts/check.sh`.
    Expected: `VERIFICAÇÃO COMPLETA: OK`;
  - olhar as capturas do estábulo, da ficha e da corrida.
- [ ] **Step 6: Commit** (moldes, `src`, `tools`, `dist`, `screens`); no `assets.md`, o lote de 2026-11-08 marcado
  como substituído.

### Task 8: Wiki, GDD, memória e artefato

**Files:**
- Modify: `prototype/tools/wiki.mjs` e `wiki-test.mjs`. Seção "Portes", gerada do código:
  - os 3 valores com os rótulos;
  - a herança: um dos pais, 50% de cada, com 10% de mutação;
  - a tabela dos 15 cavalos (nome, elemento, porte), lida de `GameData`.
- Modify: `docs/GDD.md` §6 (uma linha "Portes (só aparência, 2026-11-13)", como a das marcas)
- Modify: `docs/memoria/ESTADO.md` (2b pronta; próxima, a 2c), `docs/memoria/decisoes.md` (decisões novas da
  execução)

- [ ] **Step 1: Escrever o teste do wiki que falha:**
  - a seção "Portes" existe;
  - ela lista Esguio, Padrão e Robusto;
  - ela tem 15 linhas na tabela, cada uma com o porte do `GameData`;
  - ela não mostra os valores internos (`padrao`).
- [ ] **Step 2: Rodar, ver falhar, implementar e rodar.** Run:
  `node prototype/tools/wiki.mjs && node prototype/tools/wiki-test.mjs`. Expected: OK.
- [ ] **Step 3: GDD e memória.**
- [ ] **Step 4: Verificação completa.** Run: `./scripts/check.sh`. Expected: `VERIFICAÇÃO COMPLETA: OK`.
- [ ] **Step 5: Commit e push** (`git push -u origin claude/visuais-2`).
- [ ] **Step 6: Artefato de teste** (controlador). Republicar o "Galope Ícones DEV" com o `jogo-dev.html` novo, a
  partir da cópia no scratchpad, com o título trocado.
