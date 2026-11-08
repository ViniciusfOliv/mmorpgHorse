# Decisões

Formato: **data · decisão** — motivo. A mais nova fica no topo. Decisões de design detalhadas
continuam no `docs/GDD.md`; aqui fica o registro de *quando* e *por quê*.

## 2026-11-08
- **Galope do molde: os 9 quadros duram um ciclo dos 6 do sprite por código** (índice = ⌊(fase mod 6) × 9 / 6⌋,
  com a fase contínua do contador da corrida) — com o mesmo contador a passada do molde ficava 1,5× mais lenta.
- **Contorno procedural só no montado e no galope** (retrato e parado mantêm a regra de silhueta) — o montado e
  o galope vinham quase sem borda preta e o `validar` rejeitava por silhueta aberta; aplicado em todos os
  quadros, mudava as âncoras commitadas e deixava a checagem de silhueta do retrato e do parado sem efeito.
- **Retratos e pódio com a mesma escala única; corte de até 10 % no topo** — limitar pela altura deixava o
  retrato de Água (crista alta) uma escala abaixo dos outros; agora os cascos vão para a base da baia e a crista
  pode perder ~4 % no topo.
- **Cavalos com moldes do PixelLab recoloridos no jogo, no lugar dos desenhados por código** — qualidade de arte maior sem gerar um sprite por cavalo.
- **Cores naturais + classificação local, sem paleta forçada** — com `color_image` o PixelLab pintava cada par num tom só e a validação rejeitava; o experimento de 4 gerações deu vitória à classificação por matiz/saturação com Otsu.
- **Escala inteira única para todos os estilos** (`max(1, round(k × 40 / Lref))`) — pixels nítidos e cavalos do mesmo tamanho entre estilos.
- **Âncoras por estado (chão = maior `footY`, horizontal = mediana do focinho)** — o rabo balança e quadro a quadro o cavalo tremia.
- **Ícones em 32 px, abas a 1:1 e ícones menores com suavização, com halo claro** — o contorno escuro sumia no fundo escuro.
- **Script `pixellab-moldes.mjs` com dry-run por padrão e `--teto`** — gasto de cota só com confirmação; `pixellab-generate.mjs` removido.
- **Logotipo e capa feitos no Canva** (fundo do logo removido por chave de cor) — marca sem custo avulso; a capa vai no README e na futura página da loja.
- **Menu de abas antes das expedições e dos visuais** (opção A do Vinicius) — a rolagem única do Estábulo não comportava as novas telas; a casca de navegação vem primeiro.
- **5 abas (Estábulo, Correr, Expedição, Haras, Loja) + Perfil no cabeçalho** — Perfil guarda estatísticas e "Recomeçar", que não merecem uma aba.
- **A casca fica dentro do `game.js`** — o protótipo é descartável; não vale separar arquivos antes de escolher a stack.
- **Equipamento vira sub-aba da Montaria** (Status/Skills/Equipamento) e o Estábulo só lista — uma tela por assunto, sem rolagem longa.
- **A corrida PVP continua automática**; as batalhas de expedição terão modo automático e manual (decisão do Vinicius para o subprojeto 4).
- **Bônus de 4 peças do conjunto passa de ×1,10 para ×1,07** (`weatherMultSet`) — a skill de clima
  (×1,10) volta a valer mais que o conjunto e não acumula; com o Dado ligado a Brasa com 4 Raras do Sol
  caiu de 82,5% para 73,0% à frente da misturada (E3b, pino 60–80%); E3 recentrada em 65–85% (77,3%).
  Decisão da conversa principal a pedido do Vinicius ("altere os arquivos você mesmo").
- **Branches remotas já mescladas não podem ser apagadas desta sessão** — o proxy bloqueia `git push
  --delete` e a API; fica para o Vinicius no GitHub.

## 2026-11-06
- **Lendário fora da loja até as expedições** — o conjunto Lendário só existe via `?dev=1` por enquanto;
  Mítico não tem peça (despertar).
- **Meta E2 dividida em E2a/E2b e E3 rebaseada** — no nível 30 a distância Comum→Raro é ~20 pontos por
  status (limite 60 contra 80) mais duas skills, então o conjunto +10 fecha um degrau, não dois: E2a
  (× Mágico, 60–85%, medido 75,3%) e E2b (× Raro, 10–40%, medido 13,2%); os "40–60% contra Raro" da
  spec exigiriam equipamento dominante nos níveis baixos. E3 passou a 75–90% (medido 86,0%): o "dobra o
  clima" de 4 peças é idêntico à skill de dobrar o clima e, em clima fixo entre cavalos iguais, vale
  ~86%; no jogo o Dado vira o clima ~1,2× por corrida.
- **Trava parcial com páreo aberto** — a montaria ativa só aceita trocar peça se o rating não passar
  do que a sala viu: dá para trocar de conjunto pela previsão do clima, não para abrir a sala fraco e
  equipar forte.
- **Loja com Ouro + Pedra Negra só no pódio** (opção C do Vinicius) — a loja é o sink de Ouro; o pódio
  em corrida valendo rende pedra (60/40/25%), nunca peça, nunca em treino.
- **Conjuntos por clima com bônus de 3/4/5 peças** (Sol/Chuva/Névoa) — cria a escolha pré-corrida:
  turbinar o dia bom (4 peças) ou se proteger do dia ruim (5 peças).
- **Melhoria +0…+10 com chances reduzidas e queda a partir de +6** — chances 100/90/80/70/60/50/40/35/
  30/25%; a pedido do Vinicius ("diminua as chances"); sorteio só pela RNG da seed.
- **5 slots com status dono** (ferraduras→Vel, sela→Est, estribos→Man, testeira→Acel, armadura→Força)
  — espelha o equipamento de cavalo do Black Desert.
- **Revisão final do cruzamento aplicada numa única onda** (commit `4700533`) — calculadora do
  Corcel promete só min(garantidas, candidatas, vagas); save v3 com `mounts` inválido vira `[]` em
  vez de cair na migração v1/v2 (não perde Ouro); pool de bots exclui todos os modelos possuídos.
- **Snapshot dourado dos 3 potros de `docs/exemplos.md` §13 no `sim-test`** — compara o potro
  inteiro (até a paleta); qualquer chamada de RNG a mais/a menos em `breed.js` derruba o teste e
  protege a regra "potro só pela RNG da seed".
- **`game.js` não será dividido agora** — o protótipo é descartável; o que sobrevive para a stack
  final é `breed.js` (puro) e `sim.js`.
- **Save v3 com várias montarias** (`mounts[]`, `activeId`, `stableSlots`, `breedCounter`) — o potro
  precisa de uma vaga no estábulo; o save v1/v2 é migrado sem perder Ouro.
- **Haras com reprodutores NPC + Troca** — o protótipo precisa de um 2º pai desde o início e a Troca
  (dois seus viram um potro) e as vagas limitadas seguram a inflação de cavalos.
- **Status do potro sorteados na faixa do grau, não herdados dos pais** — pedido do Vinicius; só o
  grau e o potencial vêm dos pais.
- **Chances saturam no nível 30 e a égua pesa 60%** — inspirado no Black Desert.
- **Mítico fora do cruzamento (só por despertar, depois das expedições)** — inspirado no Black Desert.
- **Grau (★/★★/★★★) como sub-tier dentro da raridade** — dá variação de qualidade entre cavalos da
  mesma raridade e uma recompensa por cruzar bem, sem criar uma 6ª raridade.
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
