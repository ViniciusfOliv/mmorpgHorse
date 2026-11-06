# Estado do projeto

_Atualizado em 2026-11-06._

**Fase:** Protótipo.

## Em andamento — virada de design (2026-11-05/06)
O jogo foi redesenhado em 6 subprojetos, nesta ordem (cada um em branch própria, integrado na `main`
pela conversa principal): **1. Núcleo da corrida v2** → 2. Cavalos v2 (sexo, 5 raridades,
cruzamento no nível máximo) → 3. Inventário e set de equipamentos (modelo Black Desert) →
4. Expedições (estágios 1-1…, batalha por turnos estilo Pokémon; dão Ouro, XP e moeda de pacotes)
→ 5. Montarias novas (tigre, dragão…) → 6. Economia.

- **Subprojeto 1 — Núcleo da corrida v2: concluído e integrado na `main` em 2026-11-06**
  (revisão final por agente feita; correções aplicadas; branch `claude/nucleo-corrida-v2` pode ser
  apagada no GitHub). Spec: `docs/superpowers/specs/2026-11-06-nucleo-corrida-v2-design.md`.
  - Entregue: 7 atributos (+ Manobra, Sorte), 5 raridades, mapa aleatório em blocos
    (reta/curva/subida), clima + triângulo de elementos, Dado da Sorte (1/3 e 2/3 da pista), skills
    com chance e aprendizado por nível; sem tática e sem Disposição do dia.
  - Verificação: `check.sh` em 5 etapas (build, 26 testes unitários, balanço 28/28, UI Playwright).
  - Calibração: constantes e iniciais ajustados (decisoes.md); metas 3b/4a/4b rebaseadas porque, sem
    Disposição do dia, o modelo é quase determinístico. Iniciais 33/34/33% e 52–63% no próprio clima.
  - Pergunta aberta: sem ruído por corrida, campos desiguais são previsíveis — decidir se queremos
    zebra (ruído ±3–5%).
  - Margens frágeis: 4b em 25,9% (piso 25); meta 3 a 3 p.p. do teto.
- **Subprojeto 2 — Cavalos v2 (Estábulo, Haras e Cruzamento): concluído e integrado na `main`
  em 2026-11-06** (fast-forward; branch `claude/cruzamento` pode ser apagada no GitHub). Spec:
  `docs/superpowers/specs/2026-11-06-cruzamento-design.md` (§14 = ajustes da implementação).
  - Entregue: estábulo com várias montarias (3 vagas, até 8), grau ★–★★★, `breed.js` determinístico,
    Haras (aluguel, cruzar dois seus, Troca, calculadora de chances), save v3, skills com Corcel.
  - Revisão final por agente (modelo forte) + onda de correções (commit `4700533`) + re-revisão:
    calculadora do Corcel honesta (min(garantidas, candidatas, vagas)), teste de ponta a ponta do
    cruzamento com montaria própria, `sanitize` mais duro (v3 com `mounts` inválido ⇒ `[]`, uid
    `/^m\d{1,9}$/`), cartão do recém-nascido sem ações, pool de bots exclui todos os modelos
    possuídos, arredondamento por maior resto na calculadora, snapshot dourado dos 3 potros de
    `docs/exemplos.md` §13 (compara o potro inteiro, inclusive paleta).
  - Verificação: `check.sh` em 5 etapas — 41 testes unitários, balanço 28/28, UI com o contexto
    `cruzamento` determinístico (captura `final-06-haras.png`).
  - Painel `?dev=1` para dar Ouro e cruzar à vontade ao testar.
  - Limites conhecidos: status do potro não herdam dos pais (só grau e potencial); sem timer de
    gestação (`gestacao` fica null); `game.js` segue um arquivo só (descartável; o que sobrevive é
    `breed.js`).
- A economia virou o subprojeto 6 (a branch vazia `claude/economia-gdd` foi removida).

## Pronto
- **Design v0.1** (`docs/GDD.md`): seções 1–5 aprovadas (visão, pilares, status, elementos, protótipo).
- **Protótipo jogável** (`prototype/`): telas inicial → estábulo → largada → corrida animada →
  resultado; economia de aposta com pote 60/25/15 e taxa de 10%; sprites feitos por código.
- **Simulação** (`prototype/src/sim.js`): determinística por seed; 28 metas de balanceamento
  v2 passando (`node prototype/tools/balance.js`).
- **Teste de interface** com Playwright (`prototype/tools/ui-test.mjs`).
- **Sprites PixelLab** dos 3 iniciais (base + galope de 9 quadros), comparados com os sprites por
  código em `prototype/comparativo.html`. **Ainda não estão em uso no jogo.**
- **Regras de trabalho**: `CLAUDE.md`, `scripts/check.sh`, `.claude/settings.json`, `.gitignore`
  e esta memória. **Integradas na `main`** em 2026-11-05; branches antigas já mergeadas podem ser
  apagadas no GitHub (`claude/analise-regras-arquivo-3j3zv1`, `claude/kind-thompson-gsqj7r`).
- **Pente fino (2026-11-05)**: revisão completa do protótipo + varredura de segredos no histórico
  git (nada vazado; chave PixelLab só por variável de ambiente). Sem XSS (tudo passa por `esc()`
  + `sanitize()` com whitelist); regras invioláveis verificadas (determinismo, pagar antes do
  resultado, sem re-sorteio grátis). Corrigidos: crash/da liquidação descartada em conflito
  multi-aba no "Largar!", sala valendo com entrada 0 via save adulterado (agora vira treino),
  inversão de prêmios com fees minúsculos em `payouts`, texto do estábulo ("quem leva prêmio"
  em vez de "pódio"), e matchmaking ~10 ms mais rápido por sala (um clone por template em
  `bestLevelFor`). `README.md` criado na raiz.

## Próximos passos
1. Vinicius joga o cruzamento (`prototype/dist/preview.html?dev=1` para Ouro e níveis à vontade).
2. Subprojeto 3 (inventário e set de equipamentos, modelo Black Desert) — nova branch dedicada.
3. Decidir a zebra (ruído ±3–5% por corrida) e o despertar Lendário→Mítico (depois das expedições).

## Pendente no design (GDD seções 7+)
Itens e upgrades · curvas de XP/level · expedições · economia (valores de entrada,
taxa da casa, sinks de Ouro) · stack técnica (cliente, servidor, Android) · anti-cheat · roadmap MVP.

## Para revisar no balanceamento (de `docs/exemplos.md` §12)
- **4b colado no piso:** Comum lv25 vence Raro lv1 em 25,9% (piso 25%); qualquer ajuste que ajude
  os Raros pode quebrar essa meta.
- **Meta 3 perto do teto:** especialista de curva vence o de reta em 71,8% (teto 75%); subida 68,3%.
- **"Cansou" quase não acontece:** 0,5% dos corredores; aumentar o erro de leitura do jóquei dá drama.
- **Garra dispara em 52%** dos corredores: comum demais para ser momento especial?
- **Skills:** 1,66 ativações por corrida de 3 corredores; a simulação não expõe as tentativas.
- **Zebra:** sem ruído por corrida, campos desiguais são previsíveis (Mítico lv1 × Comum lv1 = 100%).
  Proposta se quisermos: ruído de ±3–5%, não a volta da Disposição de ±10%.
