# Arquitetura atual

Legenda em `README.md`. Linhas valem para `main` `36502f32`.

## 1. Tecnologia

- HTML/CSS/JS puro, **sem dependências de execução** e sem `package.json` [C]. Node 24 só para build e testes.
- Testes de navegador usam **Playwright**, carregado com `require('playwright')` de fora do repositório
  (`prototype/tools/ui-test.mjs:30`) [C] — dependência implícita (INF-3).
- Plataformas: web + Google Play + Steam [G] (`CLAUDE.md` §1; o GDD §1 ainda diz só "web + Play Store", DOC-1).
- Empacotador (TWA × Capacitor; Electron na Steam) e servidor: **a definir** [G] (`cronograma.md:29,52,83`).
- Engine: a comparação web × Godot terminou com "fica web" (`docs/teste-engine.md`; ramo `claude/teste-engine` integrado) [M].

## 2. Mapa de pastas

| Pasta | Responsabilidade |
|---|---|
| `CLAUDE.md`, `README.md`, `.gitignore`, `.claude/settings.json` | regras do repositório, permissões do Claude |
| `scripts/check.sh` | verificação completa em 8 etapas |
| `prototype/src/` (~25 mil linhas) | o jogo. **Regra (UMD, puros):** `data.js` 888 · `sim.js` 1.472 · `breed.js` 439 · `marcas.js` 438 · `gear.js` 253 · `itens.js` 334 · `ginasio.js` 298 · `afk.js` 652 · `forja.js` 168. **Apresentação:** `game.js` **8.895** · `sprites.js` 3.796 · `ambiente.js` 2.542 · `fx.js` 1.944 · `mapa.js` 911 · `luz.js` 190 · `game.css` 1.709. **Só nos builds de teste:** `dev.js` 212 |
| `prototype/build.mjs` | gera `prototype/dist/` e `docs/wiki.md` |
| `prototype/dist/` | **gerado e versionado**: `jogo.html` (produção), `jogo-dev.html`, `jogo-teste.html`, `preview.html`, `wiki.html`, `moldes.js`, `interface.html`, `icones.html` |
| `prototype/tools/` (~60 scripts) | testes (`*-test.*`, `balance.js`, `ui-test*.mjs`, `arte-check.mjs`), geradores **pagos** (`pixellab-*`, `arte-*`), utilitários do build |
| `prototype/assets/` (104 MB) | moldes PixelLab, arte da direção de arte, Meshy, fontes |
| `prototype/arte/` | folhas e amostras HTML de arte (fora do jogo) |
| `prototype/screens/` (8,1 MB) | capturas oficiais da interface |
| `prototype/spike/`, `prototype/comparativo.html`, `prototype/index.html` | experimentos e páginas antigas |
| `docs/` | `GDD.md` (fonte da verdade), `wiki.md` (gerado), `cronograma.md`, `exemplos.md`, `teste-engine.md`, `arte/`, `memoria/`, `superpowers/specs` e `plans` |

## 3. Build e ponto de entrada

- `build.mjs` concatena os scripts numa ordem fixa (`SCRIPTS`, l.32), cada um inline, e antes deles um `<script>` com
  **toda a arte em base64** (`window.__MOLDES`, `__ICONES`, `__REGIOES`, `__GLIFOS`…, l.64–88); o CSS leva as fontes
  embutidas [C].
- Variantes: `jogo.html` tira `dev.js` e os blocos `/*@dev*/`/`/*@teste*/`, e **o build falha** se sobrar algum gancho
  (l.125–133); `jogo-dev.html` liga o DEV; `jogo-teste.html` (testadores) liga o modo rápido [C].
- Arte ausente não quebra: o jogo cai no desenho por código [C].
- **Entrada:** `game.js` é uma IIFE; lê os módulos de `window.*` (l.22), decide DEV/RÁPIDO (l.38–73) e chama `start()`
  (l.8780): `loadSave` → `sanitize` → migração e gravação → acerto do AFK offline → `loadMolds` → `render()` [C].
- `prototype/index.html` está **desatualizado** (faltam `marcas.js`, `luz.js`, `ambiente.js`, `mapa.js` e a arte) e
  provavelmente quebra a corrida (`game.js:7065` usa `window.Luz`) [C]/[I] → ARQ-3.

## 4. Telas, estado e renderização

- Estado: `var state` (o save, l.1218) e `var ui` (tela, não persiste, l.1219) [C].
- Navegação: `go(screen)` (l.1772); `render()` (l.2576) é um `switch` de ~17 telas que gera HTML em texto e aplica com
  `innerHTML` — cada ação redesenha a tela inteira (`rerenderKeepScroll`, l.8702) [C].
- Canvas só para corrida, retratos e cenas. O laço de `requestAnimationFrame` (l.8736–8757) só roda com corrida ou canvas
  visível (IntersectionObserver); itens "vivos" a ~14 q/s; respeita movimento reduzido [C].
- **Simulação × apresentação: separadas no que decide o resultado** [C]. `sim.js` não lê DOM, relógio nem vento; a tela
  anima `sim.frames`/`sim.events` já calculados (detalhes em `sistemas.md` §1).
- **Mas a aplicação dos resultados está na interface** [C] (ARQ-1): `settle()` l.6301 (pagamento, prêmio do treino,
  XP, Pergaminho, Selo), `applyXp()` l.1198, `openLobby()`/`buildLobby()` l.6000/6037 (pareamento e bots),
  `desafia()` l.3329, `afkAcerto()`/`afkColeta()` l.4037/4266, resgate da diária l.7786, `sanitize()` e migrações
  l.864–1210. A constante de economia `TRAINING_GOLD` está em `game.js:84`, fora do `data.js`.

## 5. Persistência

**Pontos fortes** [C]:
- `localStorage['galope-elemental:v1']` (l.52); DEV em `:dev`, testadores em `:teste-rapido`; o build de produção
  proíbe a chave DEV. Auxiliares: `:corrompido`, `:animacoes`, `:joquei`, `:escolha`.
- JSON do `state` inteiro, `SAVE_VERSION = 10` (l.664), migrações v1→v10 documentadas (l.610–663) e testadas com
  fixtures v0–v9 no `ui-test.mjs`.
- Save de versão mais nova: tela de bloqueio, nunca gravado por cima (l.1281–1295).
- Save corrompido: cópia em `:corrompido` (só a última) e aviso na tela inicial (l.517–528).
- **Atomicidade por ação:** débito e resultado numa gravação só (`gravaGasto`, l.567); se falhar, volta ao clone e não
  mostra resultado; cota cheia testada (`ui-test.mjs:423`).
- Várias abas: revisão `state.rev` + evento `storage` (`adoptExternal`, l.1304, 8856).
- Recarregar no meio: a corrida é liquidada e gravada **antes** de aparecer (l.8340–8351); ginásio, diária e coleta
  do AFK também numa gravação. **Nenhum caminho de recompensa em dobro foi encontrado.**
- IDs estáveis: cavalos `m<n>`, peças `i<n>`; o `sanitize` descarta uid repetido (l.935, 1068).

**Riscos** → `problemas.md` PER-1 a PER-6: migração sem cópia e descarte silencioso; sem armazenamento o jogo roda só
em memória sem avisar (l.541–558); sem exportar/importar; o `hot` vence o disco sem comparar `rev` (l.8789);
relógio adiantado e seed no cliente (aceitos até o online, GDD §8.2a e `cronograma.md:91–98`).

## 6. Configurações e áudio

- Única configuração: `state.settings.motion` (sistema / completas / reduzidas, l.112–130), no Perfil [C].
- **Áudio: não encontrado** (sem `AudioContext`, `<audio>` ou arquivos de som) [C]. Previsto para o MVP
  (`cronograma.md:28`) [G]. Sem volume, mudo ou idioma (o HTML é `pt-BR`, `build.mjs:139`).

## 7. Testes

| Ferramenta | Cobre |
|---|---|
| `sim-test.js` (213) | simulação, determinismo, cruzamento, peças, ginásio, itens, ausência de `Math.random` |
| `afk-test.js` | AFK, forja, relógio para trás |
| `fx-test.js`, `mapa-test.js` | linha do tempo de efeitos, câmera, Dado; mapa dos ginásios |
| `moldes-test.mjs` (237) | PNGs, moldes, âncoras, idle, paleta, dry-run dos scripts pagos sem rede |
| `wiki-test.mjs` | determinismo e cobertura do wiki, navegador |
| `balance.js` | metas M/P/S/A/G/E (132 no `--quick`, 380 no completo) |
| `ui-test.mjs` (83 blocos, Playwright) | fluxo completo, saves adulterados/antigos, cota cheia, várias abas, produção sem DEV, custo por quadro |

Lacunas → INF-3 a INF-6: sem CI; Playwright implícito; `sanitize`, `settle` e `buildLobby` só testáveis pelo navegador;
metas M6, M9, P1, S1, A1 e G1–G7 só no balanço completo (~5 min), fora do `check.sh`; determinismo entre motores JS
diferentes não testado.

## 8. Desempenho

- Medido e registrado [M]: desenho por quadro **2,17 ms** (`ESTADO.md:5`), base 1,93–2,22 ms; no aparelho, 1 de 7.138
  quadros acima de 20 ms depois da correção da hachura das subidas (antes, 20–28 ms por quadro).
- Limites no código [C]: caches LRU por bytes (12 MB quadros, 8 MB moldes… `sprites.js:823,939–944`), ≤ 60 partículas
  por região e ≤ 150 no total (`ambiente.js:1601`), canvas ≤ 1,5 Mpx (`CANVAS_MAX_PX`).
- **Não medido** [NV]: tempo até a primeira tela num aparelho médio com o `jogo.html` de **2,59 MB** (era 842 KB,
  `ESTADO.md:362`), uso de memória total, FPS com 8 corredores num aparelho fraco. → DES-1.
- Repositório: pack de **204 MiB**; `jogo.html` versionado em 283 commits [C] → DES-1.
