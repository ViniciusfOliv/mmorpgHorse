# Marcas, jóquei e raridade visível (Visuais 2, parte 2a) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada cavalo ganha marcas herdáveis na pelagem, o jogador ganha um jóquei com padrão e capacete próprios e a raridade aparece no cavalo, tudo em código, sem créditos e sem mudar a corrida.

**Architecture:**
- **Dados e herança:** ficam nos módulos de regra (`data.js` e `breed.js`, que irão para o servidor).
- **Matemática de pixels:** num módulo novo e puro, `marcas.js` (UMA ES5, sem DOM), testável no Node. Ele recebe os índices de papel de um quadro de molde e as âncoras dele e devolve camadas de índices.
- **Desenho:** o `sprites.js` aplica essas camadas na recoloração (com cache) e desenha os efeitos de raridade.
- **Telas:** o `game.js` liga tudo nas telas, no save e no Perfil.

**Tech Stack:** JS ES5 em `prototype/src/` (sem dependências); testes em Node (`sim-test.js`, `fx-test.js`, `moldes-test.mjs`) e Playwright (`ui-test.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-12-cavalos-marcas-design.md`

## Global Constraints

- Branch `claude/visuais-2`. Commits pequenos, no imperativo, em português, com o trailer da sessão.
- Sem dependências novas; ES5 em `prototype/src/`.
- Não mudam `sim.js` nem `gear.js`; a corrida dá o mesmo resultado; nada de `Math.random`.
- Os sorteios que já existem no `foal()` (passos 1 a 8 do cabeçalho do `breed.js`) não mudam em número nem em ordem; as marcas usam `mulberry32(hash2(seedBase >>> 0, 0x4D410000 + breedCounter))`.
- O Mítico nunca nasce de cruzamento (regra que já existe, intocada).
- Marcas, jóquei e raridade são só aparência: nada em status, Poder, preço, chance de skill ou corrida.
- Save sem versão nova: `marcas` (no cavalo) e `joquei` (no estado) são opcionais, com padrão.
- `prototype/dist/` e `docs/wiki.md` só saem do build (`node prototype/build.mjs`); commitar junto com o `src/`.
- Branco das marcas `#f1e9d4`; mutação 0,10; jóquei inicial `liso` com capacete `#f2c230`.
- Sem créditos: nada de PixelLab, Canva ou ElevenLabs nesta parte.
- Antes de dizer que terminou: `./scripts/check.sh` e mostrar o resultado.

## Review Focus

1. **Save com lixo** em `marcas` (por exemplo `patas: 7`, `cara: "x"`) ou em `joquei` (por exemplo `capacete: "red"`): abre normalmente com as marcas calculadas e o jóquei inicial. Teste na Task 5.
2. **Quadro de molde em que as zonas acham menos de 4 pernas, ou nenhuma cara:** pinta só o que achou, sem exceção. Teste na Task 2.
3. **Moldes que não carregaram** (desenho em código): o cavalo aparece sem marcas e com as faíscas, sem exceção. Teste na Task 3.
4. **Cavalo alugado salvo antes da 2a** (com `templateId`, sem `marcas`): fica com as marcas fixas do modelo, não com as do identificador. Teste na Task 5.
5. **Corrida com 8 Míticos** (todos os efeitos ao mesmo tempo): o tempo de desenho por quadro, que o ui-test já mede, continua abaixo do teto de hoje. Teste na Task 4.

---

### Task 1: Dados das marcas e herança

**Files:**
- Modify: `prototype/src/data.js` (listas `MARCAS` e `JOQUEI`; `marcas` em cada inicial e selvagem)
- Modify: `prototype/src/breed.js` (marcas no `foal()`, `hashChave`, `marcasDoId`, `marcasValidas`; cabeçalho)
- Test: `prototype/tools/sim-test.js`

**Interfaces:**
- Produces:
  - `GameData.MARCAS = { cara: ['nenhuma','estrela','listra','frente'], patas: [0,1,2,3,4], corpo: ['liso','malhado','pintado','ruao'], mutacao: 0.10, branco: '#f1e9d4' }`
  - `GameData.JOQUEI = { padroes: ['liso','listras','faixa','xadrez','estrelas','losangos'], capacetes: ['#f2c230','#ff6b5e','#62b8ff','#86d86a','#c77dff','#ff9f43','#f1e9d4','#2a2a2a'], padrao: 'liso', capacete: '#f2c230' }`
  - `marcas: { cara, patas, corpo }` em cada item de `GameData.STARTERS` e `GameData.WILD_HORSES`, com os valores da tabela da spec §2. Nos ids: `frente`, `ruao`; patas são números.
  - `Breed.hashChave(chave: string) -> uint32` (FNV-1a de 32 bits)
  - `Breed.marcasDoId(chave: string) -> { cara, patas, corpo }`: `mulberry32(hashChave(chave))` e 3 sorteios uniformes, na ordem cara, patas, corpo.
  - `Breed.marcasValidas(m) -> boolean`: os três campos com valores das listas.
  - `Breed.foal(opts)` passa a devolver também `marcas`, calculadas como diz a spec §2: 2 sorteios por gene. Pai sem `marcas` válidas: as do modelo dele (`templateId` no catálogo) ou `marcasDoId(uid)`.

- [ ] **Step 1: Escrever os testes em `sim-test.js`** (seção "Marcas")

```js
test('foal: mesma seed e pais ⇒ mesmas marcas; valores válidos', ...);
test('foal: campos antigos iguais ao potro de antes (sorteios antigos intactos)', () => {
  // o teste de ouro da linha ~669 compara o potro campo a campo: ajuste-o para ignorar só `marcas`,
  // sem afrouxar nenhum outro campo
});
test('foal: 10.000 potros de pais com marcas diferentes ⇒ mutação por gene em [8,5%; 11,5%] e, sem mutação, égua em [47%; 53%]', ...);
test('foal: pai sem marcas usa as do modelo ou marcasDoId(uid)', ...);
test('marcasDoId: determinístico, válido e cobre todos os valores em 1.000 chaves', ...);
test('hashChave("") e hashChave("m1") conhecidos (FNV-1a 32 bits: 0x811c9dc5 para "")', ...);
test('iniciais e selvagens com as marcas da tabela da spec §2', () => {
  // Brasa estrela/1/liso … Iara nenhuma/4/ruao (15 linhas, conferir uma a uma)
});
```

Para medir a mutação sem ler o estado interno, use pais com valores diferentes em todos os genes e conte os potros com um valor que nenhum dos dois pais tem:
- em cara e corpo, 2 dos 4 valores ficam fora, então mutação ≈ fração × 2;
- nas patas, 3 dos 5 valores ficam fora, então mutação ≈ fração × 5/3.

Faça a conta no teste.

- [ ] **Step 2: Rodar e ver falhar.** Run: `node prototype/tools/sim-test.js`. Expected: as falhas novas ("marcas undefined", "hashChave is not a function").
- [ ] **Step 3: Implementar** em `data.js` e `breed.js`, e documentar no cabeçalho do `breed.js` o passo novo: "9. marcas (sequência própria; não muda os passos 1–8)".
- [ ] **Step 4: Rodar e ver passar.** Run: `node prototype/tools/sim-test.js && node prototype/build.mjs && node prototype/tools/wiki-test.mjs`. Expected: sim sem falhas; o build e o wiki ok.
- [ ] **Step 5: Commit.** `git add prototype/src/data.js prototype/src/breed.js prototype/tools/sim-test.js prototype/dist docs/wiki.md` e commit "adiciona marcas herdáveis nos cavalos (dados e cruzamento)".

---

### Task 2: Módulo `marcas.js` (zonas e camadas)

**Files:**
- Create: `prototype/src/marcas.js` (UMD ES5: `root.Marcas` no navegador, `module.exports` no Node)
- Modify: `prototype/build.mjs` (`SCRIPTS`: `'src/marcas.js'` entre `breed.js` e `gear.js`)
- Test: `prototype/tools/moldes-test.mjs`

**Interfaces:**
- Consumes: `GameData.MARCAS`, `GameData.JOQUEI` (Task 1).
- Produces (papéis dos moldes: 2 pelagem, 3 pelagem-sombra, 4 crina, 5 crina-sombra, 7 roupa do jóquei, 9 sela):
  - `Marcas.zonas(idx, w, h, ancora) -> { zona: Uint8Array, perna: Int8Array }`:
    - `zona` por pixel: 0 fora da pelagem, 1 cara, 2 patas, 3 corpo;
    - `perna`: −1, ou 0..3 na ordem traseira de perto, dianteira de perto, traseira de longe, dianteira de longe;
    - `ancora = { nose: [x,y], footY, saddle: [x,y] | null, bbox: {x,y,w,h} }`;
    - cara = pelagem a até 30% de `bbox.w` do `nose`, acima de `bbox.y + bbox.h/2`;
    - patas = pelagem abaixo de `footY − 0,30·bbox.h`, agrupada em pernas por colunas contíguas (até 4 grupos, da esquerda para a direita).

      Mapeamento para a ordem fixa: os 2 grupos mais à esquerda são as traseiras e os 2 mais à direita, as dianteiras (o focinho fica à direita). Dentro de cada par, a de perto é a que desce mais (maior y).
  - `Marcas.camadaMarcas(idx, w, h, ancora, marcas, semente) -> Uint8Array`, uma camada por pixel:
    - 0 nada;
    - 1 branco (sobre o papel 2);
    - 2 branco-sombra (sobre o papel 3);
    - 3 escuro (pintado).

    Regras: as da tabela da spec §3. A referência dos padrões de corpo é `saddle`, ou, sem sela, o centro de `bbox`. A `semente` (uint32) fixa as manchas.
  - `Marcas.camadaJoquei(idx, w, h, ancora, padrao) -> Uint8Array`, uma camada por pixel:
    - 0 nada;
    - 1 tom 2 da seda (padrão, só no papel 7 abaixo da linha do capacete);
    - 2 capacete (o grupo de cima do papel 7);
    - 3 manta (papel 9).

    O padrão `liso` não marca nenhum pixel com 1.
  - `Marcas.faiscas(semente, n) -> [{ dx, dy, fase }]`: `dx`, `dy` em [0, 1] da caixa com margem e `fase` em [0, 1). Determinístico.
  - `Marcas.N_FAISCAS = { comum: 0, magico: 0, raro: 3, lendario: 5, mitico: 5 }`
  - `Marcas.BRILHO = { comum: 0, magico: 0.25, raro: 0.30, lendario: 0.45, mitico: 0.45 }`

- [ ] **Step 1: Escrever os testes em `moldes-test.mjs`** (seção "Marcas"; o módulo entra por `createRequire(import.meta.url)('../src/marcas.js')`)

```js
test('zonas num molde sintético: cara perto do focinho, patas abaixo da barriga, 4 pernas na ordem fixa', ...);
test('zonas nos 4 moldes reais (parado e os 9 quadros do galope): cara e ≥ 2 pernas achadas', ...);
test('cada marca só muda pixels de pelagem da zona dela; contorno, crina, jóquei e sela intactos', ...);
test('frente cobre a zona da cara; ruao troca de 25% a 35% do corpo', ...);
test('malhado: o mesmo padrão nos 9 quadros do galope, em coordenadas relativas à sela', ...);
test('Review Focus 2: quadro sem pernas e sem cara ⇒ meias e estrela não pintam nada, sem exceção', ...);
test('camadaJoquei: padrão só no papel 7; liso ⇒ zero pixels 1; capacete = grupo de cima do papel 7; manta = papel 9', ...);
test('faiscas: determinístico; n itens; dx, dy em [0,1]', ...);
```

Os moldes reais são lidos como o teste de moldes já lê os PNGs: `decodePng` e índice = `round(cinza/25)`. As âncoras saem de `prototype/assets/pixellab/molde-<estilo>.json` (`ancoras.parado`, `ancoras['galope-N']`).

- [ ] **Step 2: Rodar e ver falhar.** Run: `node prototype/tools/moldes-test.mjs`. Expected: falha ao carregar `../src/marcas.js`.
- [ ] **Step 3: Implementar `marcas.js`**, só com aritmética sobre arrays (nada de canvas). Documente no cabeçalho do arquivo as regras de cada camada.
- [ ] **Step 4: Rodar e ver passar.** Run: `node prototype/tools/moldes-test.mjs && node prototype/build.mjs`. Expected: todos `ok`; o build inclui o `marcas.js` no `jogo.html` (conferir com `grep -c "Marcas" prototype/dist/jogo.html` ≥ 1).
- [ ] **Step 5: Commit** "adiciona o módulo de marcas (zonas e camadas dos moldes)".

---

### Task 3: Desenho no `sprites.js` e página de conferência

**Files:**
- Modify: `prototype/src/sprites.js`
- Modify: `prototype/comparativo.html` (seção "Marcas, jóquei e raridade")
- Test: `prototype/tools/fx-test.js`

**Interfaces:**
- Consumes: `Marcas.*` (Task 2), `Breed.hashChave` (Task 1).
- Produces:
  - `loadMolds` guarda as âncoras por quadro: `M.ancoras = { retrato: a, parado: a, galope: [a0..a8] }` (do JSON).
  - `drawHorse(ctx, x, y, opts)` aceita, além do que já aceita:
    - `marcas` (`{cara,patas,corpo}`);
    - `semente` (uint32);
    - `joquei` (`{padrao, capacete}`);
    - `raridade` (id);
    - `rastro` (bool, só na corrida);
    - `reduzido` (bool).

    Sem esses campos, o desenho é o de hoje, byte a byte.
  - `moldeRecolorido`:
    - a chave do cache passa a incluir marcas, semente, padrão e capacete;
    - as cores das camadas são `#f1e9d4` (branco), o mesmo branco sombreado, a sombra da pelagem escurecida (escuro), um tom 2 da seda (mais claro, se a seda for escura; senão mais escuro), o capacete e o capacete escurecido (manta).
  - `Sprites.drawRaridade(ctx, caixa, o)`, chamada pelo `drawHorse` depois do cavalo:
    - `caixa` = a de `horseBox`;
    - o brilho na crina usa uma máscara da crina (papéis 4 e 5) em cache por quadro e só existe com molde. É uma faixa que anda a cada 1,2 s, com alfa `Marcas.BRILHO[raridade]`;
    - faíscas: `Marcas.faiscas(semente, Marcas.N_FAISCAS[raridade])`, cruzes de 1 px de arte na cor da raridade que piscam pela `fase` e pelo `o.t`;
    - rastro: 3 faixas atrás da âncora traseira, só com `o.rastro` e raridade `mitico` no galope;
    - com `o.reduzido`: tudo parado e sem rastro.

- [ ] **Step 1: Escrever os testes em `fx-test.js`** (seção "Raridade e marcas no desenho"; contexto falso que conta `fillRect` e `drawImage`)

```js
test('drawHorse sem marcas/joquei/raridade: as mesmas chamadas de hoje', ...);
test('faíscas por raridade: 0 / 0 / 3 / 5 / 5 cruzes', ...);
test('rastro só com raridade mitico e rastro: true', ...);
test('reduzido: dois tempos diferentes ⇒ chamadas iguais', ...);
test('Review Focus 3: sem moldes (Node), drawHorse com marcas, joquei e raridade não lança e desenha as faíscas', ...);
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `node prototype/tools/fx-test.js`. Expected: falhas nos testes novos.
- [ ] **Step 3: Implementar no `sprites.js`.** Atualize o cabeçalho do arquivo (API e cache).
- [ ] **Step 4: Página de conferência.** Em `prototype/comparativo.html`, uma seção nova com:
  - os 4 estilos, em parado e galope animado;
  - cada valor de cara, de patas (0–4) e de corpo, sobre 3 paletas;
  - os 6 padrões do jóquei, com 2 capacetes;
  - as 5 raridades, com os efeitos animados.

  A página usa `dist/moldes.js`, como hoje, e também o `marcas.js` e o `sprites.js` do `src/`.
- [ ] **Step 5: Rodar.** Run: `node prototype/tools/fx-test.js && node prototype/tools/sim-test.js && node prototype/build.mjs`. Expected: sem falhas.
- [ ] **Step 6: Commit** "desenha marcas, jóquei e raridade nos moldes, com página de conferência".

**Portão do controlador** (antes da Task 4): abrir a página de conferência no Playwright e olhar as capturas. Procurar estrela no pescoço, meias fora das patas e manchas nadando no galope. Ajustes (os limites de 30% e da linha da barriga) voltam como achado para esta task.

---

### Task 4: Ligar nas telas e na corrida

**Files:**
- Modify: `prototype/src/game.js` (sanitize, desenho em todas as telas, jóquei dos rivais)
- Modify: `prototype/src/dev.js` e a gaveta DEV no `game.js` (marcas do cavalo montado)
- Test: `prototype/tools/ui-test.mjs`

**Interfaces:**
- Consumes: `drawHorse` com as opções da Task 3; `Breed.marcasDoId`, `Breed.marcasValidas`, `Breed.hashChave`; `GameData.JOQUEI`.
- Produces:
  - `sanitizeMount`: o campo `marcas`:
    - mantém as marcas válidas;
    - senão, as do modelo (`templateId`);
    - senão, `marcasDoId(uid)`.
  - `sanitize`: `state.joquei` válido, senão `{ padrao: GD.JOQUEI.padrao, capacete: GD.JOQUEI.capacete }`.
  - Função `opcoesVisuais(horse, joquei)`, perto do `portraitHtml`, que devolve `{ marcas, semente: BRD.hashChave(horse.uid || horse.id), joquei, raridade: horse.rarity, reduzido: reduced() }`.

    Ela é usada no retrato, na sala ou largada, na corrida (com `rastro: true`) e no pódio.
  - Jóquei: o do jogador é `state.joquei`. O dos rivais vem de `mulberry32(hash2(L.seed, 0x4A4F0000 + raia))`: 1 sorteio para o padrão e 1 para o capacete. É calculado ao desenhar; a sala salva não muda.
  - Gaveta DEV: 3 seletores (cara, patas, corpo) para o cavalo montado, com texto sem símbolos.

- [ ] **Step 1: Escrever os testes em `ui-test.mjs`** (bloco "Marcas e jóquei: dados")

```js
// save sem marcas e sem joquei abre; os cavalos ficam com marcas válidas e o joquei inicial
// Review Focus 1: save com marcas { cara: 'x', patas: 7 } e joquei { capacete: 'red' } abre; valores saneados
// Review Focus 4: cavalo com templateId 'w-garoa' e sem marcas ⇒ marcas de Garoa (estrela/0/ruao)
// cruzar no DEV: o potro nasce com marcas válidas, que ficam no save depois de recarregar
// Review Focus 5: corrida DEV com 8 Míticos ⇒ tempo de desenho por quadro abaixo do teto que o teste já usa
// nenhuma imagem quebrada nem rolagem horizontal (360 px)
```

- [ ] **Step 2: Rodar e ver falhar.** Run: `node prototype/build.mjs && SHOTS_DIR=$(mktemp -d) node prototype/tools/ui-test.mjs`. Expected: falhas nos testes novos.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.** Run: `node prototype/build.mjs && SHOTS_DIR=$(mktemp -d) node prototype/tools/ui-test.mjs && node prototype/tools/sim-test.js && node prototype/tools/fx-test.js`. Expected: sem falhas.
- [ ] **Step 5: Commit** "liga marcas, jóquei e raridade nas telas e na corrida".

---

### Task 5: Perfil (editor do jóquei), ficha e Haras

**Files:**
- Modify: `prototype/src/game.js` (`renderPerfil`, `renderMontaria`, `renderHaras`), `prototype/src/game.css`
- Test: `prototype/tools/ui-test.mjs`

**Interfaces:**
- Consumes: `state.joquei`, `opcoesVisuais` (Task 4).
- Produces:
  - **Perfil:** seção "Seu jóquei", com:
    - 6 botões de padrão (`data-acao="joquei-padrao"`, `data-v="<id>"`, `aria-pressed`, nome em português: Liso, Listras, Faixa, Xadrez, Estrelas, Losangos);
    - 8 botões de capacete (`data-acao="joquei-capacete"`, `data-v="<hex>"`, `aria-label` com o nome da cor: Dourado, Vermelho, Azul, Verde, Roxo, Laranja, Creme, Preto);
    - uma prévia do cavalo ativo, parado e montado.

    Cada clique grava como as outras opções do Perfil; se a gravação falha, nada muda.
  - **Ficha da Montaria:** a linha "Marcas: <cara>, <N meias | sem meias | 1 meia>, <corpo>", com nomes: sem marca na cara, estrela, listra, frente branca; liso, malhado, pintado, ruão. Fica junto do sexo e do Corcel.
  - **Haras:** a mesma linha para a égua e o garanhão escolhidos.

- [ ] **Step 1: Escrever os testes em `ui-test.mjs`** (bloco "Marcas e jóquei: telas")

```js
// Perfil: clicar em Xadrez e em Azul ⇒ aria-pressed muda, a prévia redesenha, recarregar a página mantém
// Montaria: a linha "Marcas:" existe e bate com o save do cavalo ativo
// Haras: as duas linhas de marcas aparecem ao escolher os pais
// celular 360 px: o Perfil sem rolagem horizontal; botões de capacete com alvo de toque ≥ 32 px
```

- [ ] **Step 2: Rodar e ver falhar.** Mesmo comando da Task 4. Expected: falhas nos testes novos.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar e ver passar.** Mesmo comando. Expected: sem falhas.
- [ ] **Step 5: Commit** "adiciona o editor do jóquei no Perfil e as marcas na ficha e no Haras".

---

### Task 6: Wiki, GDD, capturas, verificação e artefato

**Files:**
- Modify: `prototype/tools/wiki.mjs` e `wiki-test.mjs` (seção "Marcas e jóquei", com a lista dos genes, a herança e a tabela dos iniciais e selvagens)
- Modify: `docs/GDD.md` (a regra das marcas e do jóquei, na seção dos cavalos), `docs/memoria/ESTADO.md`, `docs/memoria/decisoes.md` (se houver decisão nova), `prototype/screens/*`

- [ ] **Step 1: Wiki.** Escrever o teste no `wiki-test.mjs`: a seção existe e lista os 4 + 5 + 4 valores e as 15 linhas da tabela. Rodar, ver falhar, implementar e rodar. Run: `node prototype/tools/wiki.mjs && node prototype/tools/wiki-test.mjs`. Expected: OK.
- [ ] **Step 2: GDD e memória.** Atualizar a regra no GDD e o `ESTADO.md`: 2a pronta; próxima, a 2b (portes).
- [ ] **Step 3: Capturas oficiais.** Run: `node prototype/tools/ui-test.mjs` (sem `SHOTS_DIR`). Conferir as do Perfil, da Montaria e da corrida.
- [ ] **Step 4: Verificação completa.** Run: `./scripts/check.sh`. Expected: "VERIFICAÇÃO COMPLETA: OK".
- [ ] **Step 5: Commit e push**

```bash
git add prototype/tools/wiki.mjs prototype/tools/wiki-test.mjs docs prototype/screens prototype/dist
git commit -m "documenta marcas e jóquei no wiki e no GDD e atualiza as capturas"
git push -u origin claude/visuais-2
```

- [ ] **Step 6: Artefato de teste** (controlador). Republicar o artefato "Galope Ícones DEV" com o `jogo-dev.html` novo, com o mesmo arquivo de antes no scratchpad, recopiado e com o título trocado.
