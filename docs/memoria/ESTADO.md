# Estado do projeto

_Atualizado em 2026-11-06._

**Fase:** Protótipo.

## Em andamento — virada de design (2026-11-05/06)
O jogo foi redesenhado em 6 subprojetos, nesta ordem (cada um em branch própria, integrado na `main`
pela conversa principal): **1. Núcleo da corrida v2** → 2. Cavalos v2 (sexo, 5 raridades,
cruzamento no nível máximo) → 3. Inventário e set de equipamentos (modelo Black Desert) →
4. Expedições (estágios 1-1…, batalha por turnos estilo Pokémon; dão Ouro, XP e moeda de pacotes)
→ 5. Montarias novas (tigre, dragão…) → 6. Economia.

- **Subprojeto 1 — spec escrita, aguardando revisão:**
  `docs/superpowers/specs/2026-11-06-nucleo-corrida-v2-design.md` (branch `claude/nucleo-corrida-v2`).
  Resumo: 7 atributos (Velocidade, Aceleração, **Manobra**, Força, Estamina, Garra, **Sorte**); 5
  raridades (Comum, Mágico, Raro, Lendário, Mítico); elementos Água/Fogo/Grama agindo só pelo clima
  (Sol/Chuva/Névoa/Nublado); mapa aleatório em blocos (reta/curva/subida); **Dado da Sorte** a 1/3 e
  2/3 da pista muda o clima; skills passivas automáticas aprendidas por nível; **sem tática, sem
  Disposição do dia**.
- Próximo passo: Vinicius revisa a spec → plano de implementação → código na mesma branch.
- Branch `claude/economia-gdd` foi criada e está vazia (economia virou subprojeto 6).

## Pronto
- **Design v0.1** (`docs/GDD.md`): seções 1–5 aprovadas (visão, pilares, status, elementos, protótipo).
- **Protótipo jogável** (`prototype/`): telas inicial → estábulo → largada → corrida animada →
  resultado; economia de aposta com pote 60/25/15 e taxa de 10%; sprites feitos por código.
- **Simulação** (`prototype/src/sim.js`): determinística por seed; 38 metas de balanceamento
  passando (`node prototype/tools/balance.js`).
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

## Pendente no design (GDD seções 6+)
Itens e upgrades · curvas de XP/level · breeding · expedições · economia (valores de entrada,
taxa da casa, sinks de Ouro) · stack técnica (cliente, servidor, Android) · anti-cheat · roadmap MVP.

## Para revisar no balanceamento (de `docs/exemplos.md` §12)
- "Disposição do dia" (±10% vMax) é a maior fonte de zebra: Comum vence Lendário em ~14% dos
  duelos. Ideia: mostrar antes da aposta.
- Raros batem no teto (85) entre lv20–33; depois disso o level quase não importa.
- "Cansou" é raro (~1%); dá para aumentar o erro de leitura do jóquei para ter mais drama.
- Itens mexem pouco (+0–6 p.p.); itens raros podem precisar de mais identidade.

## Próximos passos sugeridos
1. Decidir: adotar os sprites da PixelLab no protótipo ou manter os sprites por código.
2. Jogar o protótipo e responder à pergunta da fase: a aposta + estratégia é divertida?
3. Fechar as seções 6+ do GDD, começando por economia e stack técnica.
