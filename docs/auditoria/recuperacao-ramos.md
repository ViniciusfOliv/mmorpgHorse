# Etapa 1 — Recuperação do trabalho dos ramos (D6)

> **Status: levantamento só de leitura, aguardando a revisão do Vinicius.** Nenhum merge, checkout, cherry-pick ou
> commit. Os conflitos foram simulados com `git merge-tree` (calcula em memória; não toca na pasta nem nos ramos).
> `git fetch --prune` em 2026-11-25 só atualizou as referências remotas. Nenhum ramo foi apagado.

## 0. O que mudou desde a auditoria (importante)

A auditoria leu os ramos antes de um chat da **coordenação na nuvem** voltar a trabalhar hoje à noite:

| Ramo | Na auditoria | Agora (fetch de 2026-11-25) |
|---|---|---|
| `claude/youthful-maxwell-zh7h58` (ramo da coordenação) | 8 commits, 41 linhas de `decisoes.md` | **11 commits** (último 25/11 21:53): `decisoes.md` +56, `README.md`, `ESTADO.md` e 24 capturas oficiais |
| `claude/salas-economia` | não existia | **novo** (25/11 21:47): spec de salas justas + tabela de economia, fase 1 (só medição) |
| `claude/fluidez` | — | citado pela coordenação, **ainda não existe no GitHub** |
| `claude/nifty-newton-e8u133` | 22 commits fora da `main` | igual (parado desde 19/11) |

A `main` não mudou (`36502f32`, 24/11 22:52). Os outros 21 ramos `claude/*` continuam integrados.

**Consequência:** há outro chat decidindo, neste momento, parte do que a D4 e a D6 perguntam. Antes de qualquer
integração é preciso combinar quem coordena (ver §5, pergunta P1).

## 1. `claude/youthful-maxwell-zh7h58` — o que foi aprovado em 24/11 (e decidido em 25/11)

Está **0 commits atrás da `main`**: a integração seria um avanço direto, **sem conflito com a `main`**. Só tem texto e
capturas; nenhum arquivo de `prototype/src/`, `prototype/dist/` ou de teste.

### 1.1 Aprovações de 24/11 (5 entradas novas em `docs/memoria/decisoes.md`)

| # | Entrada | Palavra do Vinicius registrada | Já está na `main`? |
|---|---|---|---|
| Y1 | Animação ambiente (etapas 4 e 5) e mapa dos ginásios (blocos A e B) aprovados | "Aprovados" | O **código** sim (avanço para 77ba27e4); a **entrada de decisão** não |
| Y2 | Correção das subidas (S24 FE 4 ms → tira pré-desenhada; 119 FPS, 1% low 69); **sem trava de 60 FPS por enquanto**; spec do mapa aprovada | "faça o melhor por enquanto" | Código sim; decisão não |
| Y3 | Meshy venceu o bake-off da cena de desafio; lote de 12 modelos com teto de 360 créditos; etapa 0 da animação aprovada, casco ~1,4× | "Prossiga" | Código sim; decisão não |
| Y4 | Arena 0; nome na cor da raridade; Meshy, Canva Pro, Gemini e PixelLab liberados **para um teste em cada, cada gasto com o "sim" dele** | "Qualidade: a cena tem de fazer sentido e ficar boa; use todos os meios" | Não |
| Y5 | Ilha B como mapa-múndi; referências do PixelLab só como comparação (nunca `style_image`); layout de batalha de RPG de criaturas só como convenção | (decisões dele, sem citação literal) | Não |

### 1.2 Decisão de 25/11 sobre o `nifty-newton` (entrada nova no topo de `decisoes.md`)

Título: *"O que trazer do branch esquecido (decisão do Vinicius: 'Faça os dois, com a tabela de economia junto')"*.

- **Não trazer:** Garra v2 e skills niveladas (refeitas em skills-ranks com a Garra variável que ele escolheu),
  **ginásios em sequência** ("a spec do mapa mantém as três trilhas abertas"), mapa da Expedição antigo, figura do
  treinador.
- **Trazer, refeito sobre a `main`:** (1) estreia mais leve + salas justas, com a tabela de economia → chat
  `claude/salas-economia`; (2) fluidez das trocas de tela (`fluidez.mjs` + desenho adiado) → chat `claude/fluidez`.
- Ideias de retenção que só existiam no `nifty-newton` (nada aprovado): objetivo do dia/semana, liga semanal de 30,
  Hall dos cavalos, torneio da semana, missões, álbum, limite diário só como bônus.

> **Atenção [evidência]:** a citação literal ("Faça os dois…") aprova **o que trazer**. A lista "não trazer" — que
> inclui a sequência dos ginásios — parece ser a proposta da coordenação que ele aceitou junto, não uma frase dele sobre
> os ginásios. Em 18/11 o pedido dele foi explícito no sentido contrário (§3.1). Isso precisa de confirmação (P2).

### 1.3 Outros arquivos

| Arquivo | Mudança | Observação |
|---|---|---|
| `README.md` | capa em `prototype/assets/arte/marca/capa.png` (a `docs/capa.png` da `main` **não existe**: hoje o README mostra imagem quebrada); "+ Steam"; check ~12 min; seção "Trabalhar no seu computador" (clonar, jogar, Node 22, Git Bash/WSL, Playwright à parte, segredos em variável de ambiente) | Corrige um defeito real e documenta o Playwright como instalação à parte (relevante para a D7) |
| `docs/memoria/ESTADO.md` | parágrafo de 25/11 registrando o branch esquecido | — |
| 24 PNGs em `prototype/screens/` | capturas oficiais refeitas com a animação e o mapa | Binário; ninguém mais mexe nelas |

### 1.4 Conflitos

- Com a `main`: **nenhum** (avanço direto).
- Com `claude/salas-economia`: **conflito em `docs/memoria/ESTADO.md`** (os dois escrevem um parágrafo no topo).
  Trivial: manter os dois parágrafos.

**Recomendação:** trazer o ramo inteiro à `main` por avanço direto **depois** de combinar com o chat da coordenação
(ele ainda pode estar escrevendo nele) e de você confirmar a P2. Nada se perde: é só texto e capturas.

## 2. `claude/salas-economia` (novo, para registro)

1 commit, 4 arquivos, 344 linhas, **nenhuma regra mudou**: spec `docs/superpowers/specs/2026-11-25-salas-economia-design.md`,
`prototype/tools/salas-medida.js` (cópia do `buildLobby`), `salas-medida-resumo.js`, parágrafo no `ESTADO.md`. Está
0 commits atrás da `main`.

Achados da spec que conversam com a auditoria:
- Pareamento real: o inicial vence **6,1%** nas 10 primeiras salas (justo 16,7%) e perde ~25 de Ouro por sala de 50;
  depois da 20ª sala, **metade das salas é treino gratuito**. A sala hoje é o **maior ralo de Ouro**, não uma fonte.
- Tabela completa de fontes e gastos de Ouro (cobre o que a auditoria marcou como ECO-3) e a frase "**nenhuma linha liga
  Gemas a Ouro**" — vale para o código; o risco do GDD §8.2 (ECO-1) continua só no papel.
- Recomendação deles: estreia D (10 salas de 4–5 corredores, rivais 93–100,5%) + faixa normal 93,5–104,5%, sem mexer
  em prêmio, entrada ou taxa. Em aberto: saves antigos não veem a estreia; **teto do catálogo** (Mítico nv 50 vence
  40–51%, +4 a +7 mil de Ouro/hora); o Poder erra por cavalo.
- A spec já sugere tirar a montagem da sala para um módulo puro `sala.js` — é o T15 do nosso plano. **Os dois planos se
  sobrepõem**; não faz sentido o T15 andar separado.

## 3. `claude/nifty-newton-e8u133` — o que existe e o que está perdido

Base comum com a `main`: `7a26b5e3` (18/11 16:07). Está **22 commits à frente e 286 atrás**. O `merge-tree` dá
**conflito de conteúdo em 20+ arquivos**, entre eles `CLAUDE.md`, `GDD.md`, `decisoes.md`, `ESTADO.md`, `assets.md`,
`wiki.md`, `build.mjs`, `data.js`, `sim.js`, `game.js`, `game.css`, `fx.js`, `balance.js`, `sim-test.js`, `ui-test.mjs`
e todo o `dist/`. **Não dá para integrar; só para refazer sobre a `main` usando o ramo como referência.**

### 3.1 Ginásios em sequência (a progressão perdida)

**Pedido dele (18/11, registrado no ramo):** *"os ginásios devem seguir uma sequência, você só consegue lutar com um,
vencendo o anterior (pode decidir o primeiro, segundo e último)"*; depois *"pode seguir com as metas e mapas"*.

**Como foi feito** (commit `7a35bb18`, spec `2026-11-18-mapa-expedicao-design.md` §1):

| Peça | No `nifty-newton` | Na `main` hoje |
|---|---|---|
| Ordem | `GYM_ORDER = ['grama', 'agua', 'fogo']`: Capoeira → Remanso → Fornalha | `['fogo', 'agua', 'grama']`, só ordem de exibição |
| Trava | `Ginasio.aberto(gymId, progresso)`: aberto se é o 1º, se o anterior tem a insígnia (etapa 5) **ou se ele mesmo já tem etapa vencida** (save antigo não perde nada); `Ginasio.anterior(id)` | Os três abertos em qualquer ordem |
| Recusa | `podeDesafiar` devolve `'ginasio-fechado'` **antes de pagar**; o acerto devolve `null` | — |
| Tela | Cartão apagado com o motivo ("Vença o líder da Capoeira") | — |
| `CLAUDE.md` §8 | "Ginásios em sequência: cada um abre com a insígnia do anterior (regra do módulo)" | ausente |
| Testes | `sim-test.js` (+148), `ui-test.mjs` (+270), `wiki-test.mjs` (+13) | — |

**Números por ginásio** (`GYM_NUMEROS`, "partida, para ele ajustar jogando"):

| Ginásio | Níveis | Entradas | Ouro da 1ª vitória | Líquido |
|---|---|---|---|---|
| 1º Capoeira | 2 · 4 · 6 · 8 · 10 | 10 · 15 · 20 · 25 · 50 | 50 · 75 · 100 · 125 · 250 | +480 |
| 2º Remanso | 11 · 13 · 15 · 17 · 20 | 20 · 30 · 40 · 50 · 100 | 80 · 120 · 160 · 200 · 400 | +720 |
| 3º Fornalha | 21 · 23 · 25 · 27 · 30 | 30 · 45 · 60 · 75 · 150 | 120 · 180 · 240 · 300 · 600 | +1.080 |
| **`main` (os três iguais)** | 4 · 8 · 12 · 16 · 20 | 20 · 30 · 40 · 50 · 100 | 80 · 120 · 160 · 200 · 400 | +720 cada, **+2.160** |

Total do `nifty-newton`: **+2.280** (+120 em relação à `main`), mas distribuído ao longo dos níveis 2–30 em vez de
4–20. Itens da trilha, times (1·1·2·2·3, ★★, genética do inicial) e revanche ficavam iguais.

**Riscos e pendências conhecidos no próprio ramo:**
- Com a Fornalha nos níveis 21–30, **a Grama em desvantagem vence 41–46% nela**; as metas G3 e G4 foram **rebaseadas ao
  medido** e a recalibração da pista ficou "para decidir com o Vinicius".
- Os números foram medidos com a Garra v2 (que não foi para a `main`): **precisam ser medidos de novo**.
- A `main` mudou a Expedição depois (mapa-múndi vivo, viagem, trilha que se pinta, cena Meshy). A spec do mapa de 24/11,
  aprovada por ele, traz como antimeta: *"A névoa ou qualquer efeito do mapa bloquear um ginásio: os três continuam
  abertos em qualquer ordem."* — é a frase que a coordenação usou para "não trazer".
- Economia: muda as fontes de Ouro dos ginásios (E2/G* do `balance.js` completo) e o ritmo do começo, que o
  `salas-economia` está recalibrando agora. **Mexer nos dois ao mesmo tempo mistura as medições.**

**Arquivos que uma recriação tocaria:** `data.js` (`GYM_ORDER`, `GYM_NUMEROS`), `ginasio.js` (`aberto`, `anterior`,
motivo novo), `game.js` (mapa-múndi: estado fechado e motivo), `game.css`, `balance.js` (metas G), `sim-test.js`,
`ui-test.mjs`, `wiki.mjs`/`wiki-test.mjs`, `CLAUDE.md` §8, `GDD.md`, `decisoes.md`. Sem mudança no formato do save (a
trava é derivada do progresso que já existe).

### 3.2 "Cavalo superior vence" (regra de desenho perdida)

**Pedido dele (18/11):** *"um cavalo superior precisa ter vantagem sobre outros, e se meu cavalo tem status maiores que
todos os outros da corrida e as mesmas skills, supostamente eu ganharia. Faça uma otimização e prossiga"*.

- No ramo: regra no `CLAUDE.md` §8 (*"quanto maior a vantagem de status, mais certo o resultado (meta SUP)… Não
  reintroduzir sorte 'tudo ou nada' maior que a diferença de status"*) e a **meta SUP** no `balance.js` (mesmo Raro nv 20
  dos dois lados, alvo com +2/+5/+10/+15% em todos os status; duelo e sala de 6). Medido lá: +2% 57%, +5% 79%, +10% 98%.
- Na `main`: em 19/11 você escolheu outro mecanismo ("Força variável" da Garra, 0 a 2× pela seed; `decisoes.md:489`).
  A Garra v2, o clima de 2% e as skills niveladas do ramo **não** se aplicam mais.
- **O que se perdeu de fato:** o texto da regra e a meta SUP. Não sabemos se a `main` cumpre a intenção [NV]: ninguém
  mediu a SUP sobre a Garra variável.
- A spec do `salas-economia` mostra um efeito parecido: "com a Garra 100% de 19/11 o Poder decide muito".

### 3.3 O resto do ramo

| Item | Situação | Recomendação |
|---|---|---|
| Estreia mais leve e faixa 93,5–104,5% (`ca22f396`) | Refeito agora em `claude/salas-economia`, medido no pareamento real | Seguir pelo `salas-economia` |
| `fluidez.mjs` + trocas de tela mais rápidas (`e0096725`, `94293b08`, +115 linhas no `game.js`) | Coordenação abriu o chat `claude/fluidez` (ramo ainda não publicado) | Seguir por esse chat; o código de 19/11 mexia na Expedição antiga |
| Mapa da Expedição em PixelLab (126 gerações, 1665 → 1539 créditos) e figura do jogador | Superado pelo mapa-múndi e pela cena Meshy | **Não apagar o ramo**: os PNG e JSON gerados (pagos) só existem nele; registrar em `assets.md` como "não usado" se quiser |
| Nota "arte final sempre pelo PixelLab; até 150 gerações por rodada sem perguntar" (19/11, leitura do controlador) | **Conflita com o `CLAUDE.md` §7/§9** (sempre pedir confirmação) e com a decisão Y4 de 24/11 (cada gasto com o "sim") | Não trazer; vale a regra atual |
| Ideias de retenção e "como é o dia do jogador?" | Sem decisão | Levar para a lista de perguntas de desenho (fora da Fase 1) |

## 4. Resumo para decidir

| Id | Item | Para onde | Risco | Recomendação |
|---|---|---|---|---|
| R-Y | `youthful-maxwell` inteiro (decisões 24–25/11, README, capturas) | `main`, avanço direto | Nenhum conflito; só combinar com a coordenação | **Trazer** |
| R-S | `salas-economia` | segue no chat dele | Conflito trivial no `ESTADO.md` | Você aprova ou não a spec (é uma decisão de balanceamento nova, que entra como **D9**) |
| R-G | Ginásios em sequência | refazer sobre a `main` (T18) | Muda progressão e economia; contradiz a spec do mapa de 24/11; números precisam ser medidos de novo | **Depende da P2**; se voltar, depois do `salas-economia` |
| R-SUP | Regra "cavalo superior vence" + meta SUP | refazer **só a meta** como medição, sem mudar regra | Baixo (só ferramenta de medição) | Medir a `main` primeiro; decidir a regra com o número na mão |
| R-F | Fluidez | chat `claude/fluidez` | — | Seguir por lá |
| R-A | Arte PixelLab do mapa antigo | fica no ramo | — | **Manter o ramo**; não apagar |
| R-X | Os 21 ramos integrados | — | Apagar é irreversível no GitHub (os commits já estão na `main`) | Apagar só com seu "sim" ramo a ramo; não é urgente |

## 5. Perguntas para você

- **P1 — Quem coordena?** ✅ **Respondida (2026-11-25): esta sessão (local) coordena.** O chat da coordenação na
  nuvem deve parar de decidir e de abrir frentes; o que ele já registrou (`youthful-maxwell`, `salas-economia`) entra
  aqui como material para revisão, não como decisão fechada. Falta avisar aquele chat (só você pode, ou com seu "sim").
- **P2 — Ginásios:** em 18/11 você pediu a sequência ("só consegue lutar com um, vencendo o anterior"). Em 24/11 a spec
  do mapa diz "os três continuam abertos em qualquer ordem", e em 25/11 a coordenação registrou "não trazer". Qual vale
  hoje?
- **P3 —** Posso propor a integração do `youthful-maxwell` à `main` (avanço direto, só texto e capturas) como o primeiro
  passo depois da P1? Isso seria um push na `main`, então só com o seu "sim" explícito.
