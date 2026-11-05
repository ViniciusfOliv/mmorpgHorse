# Decisões

Formato: **data · decisão** — motivo. A mais nova fica no topo. Decisões de design detalhadas
continuam no `docs/GDD.md`; aqui fica o registro de *quando* e *por quê*.

## 2026-11-05
- **Fluxo de trabalho: uma conversa principal + ramificações por serviço** — a conversa principal
  integra e mantém a `main`; cada serviço novo (ex.: breeding, expedições, economia) nasce numa
  branch dedicada, com modelo e esforço escolhidos pelo tamanho da tarefa (tarefa mecânica/busca →
  modelo rápido; design/código do jogo → modelo forte). Pedido do Vinicius.
- **Prêmios nunca crescentes por colocação** (`sim.js payouts`) — o resto do arredondamento ia
  inteiro para o último pago e invertia prêmios com fees minúsculos (fee 1, n=6 → 2/1/2); agora os
  valores são reordenados de forma não crescente. Tiers atuais (50/100/250) não mudam.
- **Sem Ouro para nenhuma entrada ⇒ sala vira treino** (`game.js openLobby`) — antes criava sala
  "valendo" com entrada 0 (alcançável só com save adulterado), tangenciando a regra do re-sorteio
  grátis.
- **Design do jogo movido para `docs/GDD.md`** (antes em `docs/superpowers/specs/`) — um único
  arquivo fixo como fonte da verdade, fácil de citar no `CLAUDE.md`. Specs de funcionalidades
  futuras podem voltar a usar `docs/superpowers/specs/`.
- **`CLAUDE.md` enxuto; material didático em `docs/`** — o CLAUDE.md é carregado em toda sessão;
  a recomendação oficial é ficar abaixo de ~200 linhas para não perder aderência.
- **Memória do projeto versionada em `docs/memoria/`** — sessões na nuvem rodam em contêiner
  descartável; a memória automática do Claude não persiste entre elas.
- **`prototype/dist/` continua versionado** — permite abrir o jogo sem rodar o build.
- **Nome do projeto: "MMORPG Horse"** (o protótipo usa o título provisório "Galope Elemental").
- **Não reorganizar `prototype/` agora** — protótipo é descartável; a estrutura final depende da
  stack, ainda não escolhida.
- **Sprites dos iniciais gerados na PixelLab** (API v2, pixflux 64×64 + animate-with-text-v3) —
  comparar qualidade com os sprites por código antes de decidir o pipeline de arte.
- **Protótipo sem dependências (HTML/CSS/JS puro, Playwright pré-instalado para testes)** —
  iteração rápida, nada para instalar.
- **Pilares do GDD §2 aprovados** — corrida automática simulada por seed; hub social; breeding +
  expedições (+ ovos opcionais); duas moedas (Gemas nunca viram Ouro, para evitar classificação
  como jogo de azar); PVP 4–8 com pote 1º/2º/3º; ligas por Rating de Poder + MMR.
