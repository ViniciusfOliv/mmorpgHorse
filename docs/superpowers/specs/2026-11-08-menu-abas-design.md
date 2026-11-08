# Menu de abas — Casca de navegação do protótipo — Design

Status: **implementado na branch `claude/menu-abas` (2026-11-08); ver §10**.

Frente de interface pedida pelo Vinicius em 2026-11-08 ("atualmente é só uma rolagem para baixo,
precisamos melhorar"), executada **antes** do subprojeto 4 (expedições) e dos visuais pagos, nesta
ordem (opção A). Branch: `claude/menu-abas`.

## 1. Objetivo

Trocar a página única com rolagem longa por uma **casca de aplicativo**: cabeçalho fixo com saldo,
**barra de 5 abas** (Estábulo · Correr · Expedição · Haras · Loja), telas curtas, uma tela própria para
cada montaria (Status / Skills / Equipamento) e uma tela de Perfil. Nenhuma regra de jogo muda; a
corrida, a sala de largada e o resultado continuam em tela cheia.

Pergunta que o protótipo precisa responder: com as atividades separadas em abas, o jogador acha o que
quer (cruzar, equipar, comprar, correr) sem rolar nem procurar botões no meio da página?

## 2. Decisões (com a origem)

| Decisão | Origem |
|---|---|
| Menu antes das expedições e dos visuais | Vinicius (opção A) |
| 5 abas (Estábulo, Correr, Expedição, Haras, Loja) + Perfil no cabeçalho | Vinicius (opção A) |
| Casca dentro do `game.js` atual (abordagem 1): `render()` monta cabeçalho + conteúdo + barra | Vinicius ("Sim") |
| Abas são raiz do histórico; sub-telas e telas cheias empilham um estado | seção 1 aprovada |
| Estábulo só lista; detalhes e ações ficam na tela da Montaria com 3 sub-abas | seção 2 aprovada |
| Tela Equipamento vira a sub-aba Equipamento da Montaria, sem mudar regra | seção 2 aprovada |
| Barra embaixo até 899 px, coluna à esquerda a partir de 900 px; sem layout de 2 colunas | seção 3 aprovada |
| Estrutura, não arte: paleta e tokens atuais; ícones por caracteres até os visuais | seção 3 aprovada |
| Corrida PVP continua automática | Vinicius ("vamos manter assim por enquanto") |

## 3. Tipos de tela e navegação

| Tipo | Telas | Cabeçalho + barra | Histórico |
|---|---|---|---|
| Aba (raiz) | `estabulo`, `correr`, `expedicao`, `haras`, `loja` | sim | não empilha; `ui.tab` guarda a última |
| Sub-tela | `montaria` (`ui.montaria = { uid, aba }`), `perfil` | sim | empilha 1 estado; Voltar devolve a `ui.tab` |
| Tela cheia | `inicial`, `largada`, `corrida`, `resultado` | não (cabeçalhos próprios, como hoje) | empilha 1 estado (`inicial` é raiz) |

- `go(screen)`: se for aba, `ui.tab = screen`. `isRoot(screen)` passa a valer para as 5 abas e `inicial`.
- `syncHistory` mantém o mecanismo atual (um único estado-guarda empilhado ao sair de uma raiz, removido
  ao voltar), só com a nova lista de raízes. `popstate`: na corrida, pula para o resultado; em sub-tela
  ou tela cheia, `go(ui.tab)`; numa raiz, deixa o navegador sair, como hoje.
- A tela `equipamento` deixa de existir como tela: `go('equipamento')` passa a ser `goMontaria(uid, 'equip')`.
  Os botões "Equipar" (cartão do Estábulo, aba Correr, largada) abrem a Montaria já na sub-aba Equipamento.
- Botões "Voltar ao estábulo" de Haras e Loja saem (a barra faz o papel). O da largada vira "Voltar" e
  devolve à aba Correr. "Voltar" da Montaria e do Perfil devolve a `ui.tab`.
- Trocar de aba leva a rolagem ao topo e foca o `h1` (`data-foco`), como as telas fazem hoje.
- `rerenderKeepScroll` continua para as ações que não mudam de tela.

## 4. Casca

**Cabeçalho fixo** (`<header class="app-topo">`, 48 px): nome do jogo à esquerda; à direita o saldo
(`🪙 Ouro`, `🪨 Pedras`) e o botão **Perfil** (`data-acao="perfil"`). Presente em abas e sub-telas.

**Barra de abas** (`<nav class="app-abas" role="navigation" aria-label="Seções">`): 5 botões
`data-acao="aba" data-id="<aba>"` com ícone (caractere) e rótulo curto; a ativa recebe
`aria-current="page"`; área de toque ≥ 48 px. A aba **Correr** mostra um ponto (`.app-aba--ponto`) quando
`state.pending` existe. Presente só em abas e sub-telas.

**Espaçamento:** o conteúdo recebe `padding-bottom` igual à altura da barra mais
`env(safe-area-inset-bottom)`, para o fim de cada tela nunca ficar atrás da barra. O painel `?dev=1`
fica fixo logo acima da barra (e, sem barra, no fim da tela como hoje).

**Telas cheias:** `inicial`, `largada`, `corrida` e `resultado` não recebem cabeçalho nem barra; a
corrida continua usando `app--corrida`; `.barra-acao` da largada (botão "Largar!") continua fixa embaixo.

## 5. Conteúdo das abas e sub-telas

### 5.1 🐴 Estábulo (`estabulo`)
Título "Estábulo · N/M vagas", lista de cartões e "Expandir estábulo (300)". Cartão: retrato, nome e
`#uid`, raridade, grau, elemento, sexo, nível, cruzas restantes, resumo do equipamento
(`gearSummaryHtml`), selo "Ativa"; botões **Tornar ativa** (desabilitado com páreo aberto, como hoje) e
**Ver** (`data-acao="montaria" data-id="<uid>"`); tocar no cartão fora dos botões também abre a Montaria.
Renomear, Liberar e Equipar saem do cartão. O aviso `ui.notice` continua aparecendo aqui.

### 5.2 Tela da Montaria (`montaria`, sub-tela)
Cabeça: retrato grande, nome editável (Renomear inline como hoje), raridade/grau/elemento/sexo, nível e
XP, Poder e liga, chance de skills (com o bônus do conjunto), cruzas restantes e Corcel; ações
**Tornar ativa** · **Renomear** · **Liberar** (com a confirmação atual; não ativa e não única).
Sub-abas (`data-acao="montaria-aba" data-id="status|skills|equip"`, `aria-pressed`):
- **Status**: barras dos 7 status com equipamento e o valor puro ao lado (`statsHtml(stats, baseStats)`).
- **Skills**: cada skill com elemento, nome e descrição; depois "N vaga(s) livre(s) · 8% de chance de
  aprender uma skill nova a cada nível" (ou "sem vagas").
- **Equipamento**: o conteúdo da tela Equipamento atual (slots, lista, Melhorar, Vender, Desfazer, trava
  parcial, mensagens), com `ui.equip` passando a viver em `ui.montaria.equip`. Regras inalteradas:
  pagar antes de ver, trava parcial, Desfazer até sair da tela da Montaria.

### 5.3 🏁 Correr (`correr`)
Cartão da ativa (retrato, nome, raridade, elemento, nível, Poder e liga, resumo do equipamento, botão
**Equipar** → Montaria/Equipamento), escolha da entrada (50/100/250, desabilitada com páreo aberto),
nota da divisão do pote, e o botão grande **Procurar corrida** / **Treino gratuito** (quando o Ouro não
cobre a menor entrada) / **Voltar à sala de largada** (com páreo aberto, com o aviso da sala). Mesma
lógica de `openLobby`/`startLobby` de hoje.

### 5.4 🧭 Expedição (`expedicao`)
Placeholder: título, parágrafo curto ("Mundos com os biomas dos cavalos selvagens, batalhas por turnos
e recompensas em Ouro, XP e moeda de pacotes. Em breve.") e a vitrine dos cavalos selvagens que hoje está
no Estábulo (retrato, nome, raridade, nível, elemento, habitat). Vira a tela real no subprojeto 4.

### 5.5 💞 Haras (`haras`) e 🛒 Loja (`loja`)
Conteúdo atual sem o botão "Voltar ao estábulo". `ui.haras` continua sendo recriado ao entrar na aba;
`ui.loja` idem — exceto ao voltar de uma sub-tela (Perfil, Montaria) para a mesma aba (ver §10).

### 5.6 Perfil (`perfil`, sub-tela)
Estatísticas (corridas, vitórias, pódios, prêmios em Ouro), saldo (Ouro, Pedras), nº de montarias e de
peças, e **Recomeçar com outro inicial** com a confirmação atual (`reset`/`reset-sim`/`reset-nao`).

## 6. Celular × desktop e acessibilidade

- **Até 899 px:** barra embaixo (56 px + área segura), ícone sobre o rótulo; cabeçalho 48 px no topo;
  conteúdo rola no meio. Paisagem (844×390) igual.
- **A partir de 900 px:** a barra vira coluna fixa à esquerda (ícone e rótulo lado a lado, ~200 px);
  cabeçalho e conteúdo ocupam o resto, conteúdo centrado com largura máxima igual à atual.
- **Acessibilidade:** `nav` com `aria-label`; `aria-current="page"` na aba ativa; `h1` de cada tela
  focado ao entrar; ordem de foco cabeçalho → conteúdo → barra; sem animação de transição.
- **Estilo:** tokens e paleta de `game.css`; classes novas `app-topo`, `app-abas`, `app-aba`,
  `app-aba--ativa`, `app-aba--ponto`, `app-conteudo`, `montaria-cabeca`, `subabas`; sem `!important`.

## 7. Verificação

**Teste de interface** (`prototype/tools/ui-test.mjs`):
- Contextos atuais passam a navegar pela barra (`[data-acao="aba"][data-id="haras"]`, `...="loja"`),
  abrir a Montaria pelo cartão (`[data-acao="montaria"][data-id="m1"]`) e a sub-aba Equipamento
  (`[data-acao="montaria-aba"][data-id="equip"]`); os seletores de conteúdo (`#t-haras`, `cruzar`,
  `comprar`, `equipar`, `melhorar`…) não mudam.
- Novo contexto `menu`: (1) as 5 abas abrem e o `h1` certo tem o foco; (2) trocar de aba não empilha
  histórico (`history.state` nulo nas abas e `{ galope: 1 }` em Montaria, Perfil e largada) e `page.goBack()` numa sub-tela volta à aba de origem; (3) ponto
  na aba Correr com páreo aberto e sem ele depois da corrida; (4) Montaria: as 3 sub-abas, Renomear e
  Liberar funcionando lá; (5) Perfil com estatísticas e Recomeçar; (6) sem rolagem horizontal em 360,
  390, 844×390 e 1280, barra embaixo até 899 px e à esquerda em 1280; (7) corrida sem cabeçalho nem
  barra; (8) o painel `?dev=1` não cobre a barra nem os botões.
- Capturas oficiais: `final-01-inicial`, `02-estabulo`, `03-montaria`, `04-correr`, `05-largada`,
  `06-corrida`, `07-resultado`, `08-haras`, `09-loja`, `10-expedicao`, `11-perfil`, `desktop-correr`
  (substituem as atuais; as antigas são removidas).

**Testes unitários e balanceamento:** sem mudança (nenhuma regra de jogo). `check.sh` com 5 etapas.

**Documentação:** GDD §5 (fluxo de telas do protótipo), `README.md` (se citar o fluxo), memória, e a
spec ganha "Histórico de ajustes" ao final da implementação.

## 8. Fora de escopo

Arte nova e ícones desenhados (subprojeto de visuais) · expedição real (subprojeto 4) · layout de duas
colunas no desktop · animações de transição · mudar regras de jogo ou de save.

## 9. Riscos

- **`game.js` cresce** (~+300 linhas, renderers das abas e da Montaria). Continua um arquivo, decisão já
  registrada: o protótipo é descartável.
- **Histórico do navegador** é a parte mais fácil de quebrar (Voltar do Android). O teste 2 do contexto
  `menu` e o fluxo existente (Voltar na corrida pula para o resultado) cobrem.
- **Capturas** mudam todas; é intencional (interface muda de propósito).

## 10. Histórico de ajustes (implementação, 2026-11-08)
- Renomear e Liberar foram para a tela da Montaria na Tarefa 3; o cartão do Estábulo os manteve na Tarefa 2 só para o teste.
- "Ver" abriu o antigo Equipamento até a Tarefa 3.
- `scroll-padding` adicionado em `html.app-com-abas` para a barra não cobrir o foco.
- Os fallbacks de `largar` vão para a aba Correr.
- O Perfil recebeu o "Recomeçar" cedo (Tarefa 2), para o fluxo principal do teste chegar ao `reset`.
- O painel `?dev=1` sobe acima da barra de abas.
- No desktop, o marcador da aba ativa é uma barra à esquerda.
- Bordas de 2 px.
- Liberar pela Montaria volta à aba de origem (`go(ui.tab)`) com o foco no título.
- Voltar de uma sub-tela (Perfil, Montaria) para a mesma aba de origem preserva `ui.haras` e `ui.loja`.
