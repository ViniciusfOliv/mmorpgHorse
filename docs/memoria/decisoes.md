# Decisões

Formato: **data · decisão** — motivo. A mais nova fica no topo. Decisões de design detalhadas
continuam no `docs/GDD.md`; aqui fica o registro de *quando* e *por quê*.

## 2026-11-06
- **Testes unitários `sim-test.js` no `check.sh`** — TDD por tarefa; 26 testes na etapa 2.
- **Save v1 migrado em vez de chave nova** — não perder o Ouro do jogador.
- **Gatilho de Garra/reta final: reta ≥ 150 m** — definido na spec.
- **Regra da subida: "esforço divide pelo fator da subida"** — o especialista de Força perdia 16/80.
- **Calibração:** forcaSurfRelief 0,8→0,5, weatherVel 0,22→0,10, weatherMult 1,05→1,03, vBase
  16,8→17,2, hillRange 0,12→0,15, ligas 0/660/780/880/980/1100, Maré/Ipê ±4 — iniciais equilibrados
  (33/34/33%) e cada um com 52–63% no próprio clima.
- **Metas 3b/4a/4b rebaseadas e meta 2 avaliada em mapas aleatórios** — sem Disposição do dia o
  modelo é quase determinístico, intencional.
- **Redesign em 6 subprojetos** (núcleo → cavalos/cruzamento → equipamentos → expedições →
  montarias → economia) — pedido do Vinicius; a ordem segue as dependências (tudo se apoia nos
  atributos novos). Detalhes em `docs/superpowers/specs/2026-11-06-nucleo-corrida-v2-design.md`.
- **7 atributos: + Manobra e + Sorte** — cada trecho do mapa aleatório (reta/curva/subida) precisa de um
  atributo dono; Sorte é atributo e mecânica (Dado da Sorte). Referências: Umamusume (passivas com %
  de ativação), Black Desert (skills de pista, aprendizado por nível), Rival Stars.
- **5 raridades: Comum, Mágico, Raro, Lendário, Mítico** — escala pedida pelo Vinicius; define teto,
  vagas de skill e chance base de ativação.
- **Tática e "Disposição do dia" removidas** — corrida = status + terreno + RNG; a única sorte é o Dado
  da Sorte, visível e com atributo próprio.
- **Elementos agem só pelo clima** (Sol/Chuva/Névoa; Fogo > Grama > Água > Fogo) — uma regra em vez de
  três tabelas de afinidade; pista curta/longa/subida já favorecem cada elemento pelos atributos.
- **Mapa aleatório em blocos** (sem pistas fixas) — ideia do Vinicius; nenhum tipo de montaria fica
  sem pista. Água, Fogo e Grama mantidos (Terra não entra).
- **Skills aprendidas por nível** (nasce com algumas, 8% por nível de aprender outra até lotar as
  vagas) — modelo Black Desert; dá valor ao nível e ao cruzamento.
- **Pacotes de montaria (gacha) só com moeda ganha em expedição; loja de Gemas só cosméticos/passe** —
  Lei 15.211/2025 (ECA Digital, em vigor desde 17/03/2026): art. 2º, IV define caixa de recompensa
  como aquisição *mediante pagamento* de item aleatório; art. 20 veda em jogos de acesso provável
  por menores. Pacote pago por Gemas também violaria "Gemas nunca viram Ouro".
- **Rede do ambiente Default liberada para** `www.youtube.com`, `youtube.com`, `www2.camara.leg.br`,
  `www.planalto.gov.br` — pesquisa de referências; aprovado pelo Vinicius.

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
