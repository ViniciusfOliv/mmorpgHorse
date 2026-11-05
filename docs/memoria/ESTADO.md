# Estado do projeto

_Atualizado em 2026-11-05._

**Fase:** Protótipo.

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
  e esta memória.

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
