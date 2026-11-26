# Etapa 3 — Tickets T1 e T2

> **Status: preparados, aguardando aprovação.** Nada foi alterado. Cada ticket tem o seu ramo, saindo da `main`, e
> não mistura quebra de linha com moldes. Diagnóstico feito só lendo e rodando o `moldes-test.mjs` (que grava só em
> pasta temporária; `git status` limpo antes e depois).

## Diagnóstico (2026-11-25)

**Causa única da quebra de linha.** O git desta máquina está com `core.autocrlf=true` e o repositório não tem
`.gitattributes`. No índice, os 712 arquivos de texto estão em **LF**; na pasta, os 712 estão em **CRLF**
(`git ls-files --eol`).

| Sintoma | Por quê | Ticket |
|---|---|---|
| O build no Windows muda 9 arquivos gerados (`dist/*.html`, `docs/wiki.md`) | O `build.mjs:91` lê `OFL-nunito.txt` e `OFL-galmuri.txt` e embute com `jsonJs`, que **escapa** o `\r` para o texto `\r\n`; o git não consegue desfazer isso ao comparar. O resto do código entra cru, e o `\r` cru o git normaliza | **T1** |
| `moldes-test`: "refaz os 12 moldes do jogo byte a byte" falha | O teste refaz os JSON em LF e compara byte a byte com os da pasta, que estão em CRLF. **Os moldes são iguais**: tirando o `\r`, o `molde-padrao-lisa.json` da pasta tem o mesmo hash do `HEAD` | **T1** (não é defeito dos moldes) |
| `moldes-test`: mensagem do `--guia-mestre` falha | `rel()` (`pixellab-portes.mjs:391`) usa `path.relative`, que no Windows devolve `prototype\assets\pixellab\novos`; o teste espera `/` | **T2** |

Consequência: o T2 fica menor do que o plano previa (só a mensagem), e o T1 resolve a outra falha dos moldes.

---

## T1 — Arquivos de texto sempre em LF (build reprodutível no Windows)

**Ramo:** `fix/quebra-de-linha-lf`, saindo da `main`.

**Objetivo.** O mesmo código gera os mesmos bytes no Windows e no Linux, e rodar o build no Windows deixa o `git status`
limpo.

**Arquivos que podem ser alterados.**
| Arquivo | Mudança |
|---|---|
| `.gitattributes` (novo) | `* text=auto eol=lf`: todo texto em LF na pasta e no índice, em qualquer máquina; o git continua detectando binário (PNG, fontes) sozinho |
| `prototype/build.mjs` | Defesa: a função `read` troca `\r\n` por `\n`, para que um `.zip` baixado sem git também gere os mesmos bytes |
| `prototype/tools/wiki.mjs` | Só se a diferença do `docs/wiki.md` vier da leitura dele (`fonte()`, l.44) [NV: confirmar no ticket]; mesma troca |

Nada em `prototype/src/`, nos moldes, nos testes ou no save.

**Como será feito.**
1. Testar primeiro numa **cópia de trabalho separada** (`git worktree` numa pasta temporária, fora desta pasta): com o
   `.gitattributes`, `git add --renormalize .` **não pode mudar nenhum arquivo** além dele (o índice já está todo em LF).
2. Rodar o build nessa cópia e conferir `git status` limpo.
3. Só então aplicar no ramo e atualizar a pasta principal: os arquivos rastreados são refeitos em LF pelo git
   (`docs/auditoria/` e `docs/roadmap.md`, que não estão no git, não são tocados; antes disso eu mostro o comando e peço o
   seu "sim", porque reescreve a pasta).

**Critérios de aceitação.**
- O commit tem só os arquivos da tabela; `git add --renormalize .` não muda mais nada.
- `git ls-files --eol`: tudo `i/lf w/lf`.
- `node prototype/build.mjs` no Windows → `git status` limpo; `prototype/dist/` **byte a byte igual** ao da `main`.
- `moldes-test`: a falha "refaz os 12 moldes" passa (fica só a do T2).

**Testes de regressão.** `sim-test.js`, `afk-test.js`, `fx-test.js`, `mapa-test.js`, `wiki.mjs --check`,
`balance.js --quick` (132 metas) e o `check.sh` até onde rodar sem o Playwright (que vem no T3).

**Resultado esperado.** O aviso da etapa 4 do `check.sh` ("o dist mudou") deixa de ser ruído no Windows. O jogo não
muda: o `jogo.html` sai com os mesmos bytes.

**Plano de reversão.** Reverter o commit (`git revert`), que tira o `.gitattributes` e a linha do `read`. A pasta volta a
CRLF sozinha no próximo checkout; nenhum dado, save ou arte é afetado.

**Riscos.** Baixo. Editores antigos do Windows podem mostrar arquivos LF numa linha só (o VS Code e o Bloco de Notas
atual leem LF). Quem tiver um clone antigo com mudanças locais vê os arquivos como "modificados" até atualizar a pasta.

**Teste manual.** Nenhuma mudança visível. Publico o `jogo.html` (bytes iguais) só para confirmar que o artefato abre.

---

## T2 — Mensagens de caminho iguais em qualquer sistema (moldes-test no Windows)

**Ramo:** `fix/moldes-test-caminho`, saindo da `main` (depois do T1 entrar, para o aceite ser 237/237).

**Objetivo.** O `moldes-test.mjs` passar **237/237** no Windows sem mudar nenhum molde, PNG, JSON ou chamada de API.

**Arquivos que podem ser alterados.**
| Arquivo | Mudança |
|---|---|
| `prototype/tools/pixellab-portes.mjs` | Só a função `rel()` (l.391): devolver o caminho relativo com `/` (`path.relative(...).split(path.sep).join('/')`). Os 5 usos (l.365, 366, 402, 735, 1172) são **só mensagens e log**; nenhum grava caminho em arquivo |

O teste (`moldes-test.mjs`) **não** muda: ele já espera `/`, que é o certo.

**Critérios de aceitação.**
- `node prototype/tools/moldes-test.mjs` → 237 testes, 0 falhas, no Windows (com o T1 aplicado).
- Nenhum arquivo em `prototype/assets/pixellab/` muda (`git status`).
- Nenhuma chamada de rede: o teste já bloqueia a API (`semRede`) e o dry-run não gasta créditos.

**Testes de regressão.** `moldes-test.mjs` inteiro; `pixellab-moldes.mjs --lote portes` em dry-run (sem `--gerar`)
mostra as mesmas mensagens com `/`; `check.sh` etapas 1–5.

**Resultado esperado.** A etapa 5 do `check.sh` passa no Windows; com o T1, o `check.sh` vai até a etapa 6, onde para por
falta do Playwright (T3, já aprovado na D7).

**Plano de reversão.** Reverter o commit de uma linha. Nenhum dado é afetado.

**Riscos.** Mínimo: muda só o texto das mensagens no Windows.

**Teste manual.** Nenhuma mudança no jogo.

---

## Depois de T1 e T2

| Próximo | O quê | Aprovação |
|---|---|---|
| T3 | `prototype/tools/package.json` com Playwright 1.64.1 e lock; `check.sh` completo, 8 etapas, nesta máquina | Já aprovado (D7) |
| D6a | Avançar a `main` até o `youthful-maxwell` | Precisa do "sim" no momento do push |
| T15 → D9 | `sala.js` sem mudar comportamento, depois as salas justas | Aprovado (D9); primeiro jogo novo para testar |

Cada ticket termina com o `check.sh`, o dist regenerado, a memória atualizada e o jogo publicado no artefato.

---

## Resultado da execução (2026-11-25)

Feito em cópias separadas (`git worktree` na pasta temporária da sessão); a pasta principal não foi tocada. Commits
**só locais**, sem push e sem merge.

| Ticket | Ramo · commit | Arquivos | Resultado |
|---|---|---|---|
| T1 | `fix/quebra-de-linha-lf` · `e03035e8` | `.gitattributes` (novo), `prototype/build.mjs` (+1 linha e comentário) | `git add --renormalize .`: **0 arquivos** além do `.gitattributes`; pasta toda em LF; build → `git status` limpo e `dist/` idêntico à `main`; com a licença OFL forçada em CRLF, o `dist/` continua idêntico (a defesa do `read` funciona). `wiki.mjs` **não** precisou mudar |
| T2 | `fix/moldes-test-caminho` · `572ed30b` | `prototype/tools/pixellab-portes.mjs` (só `rel()`) | `moldes-test`: **237 testes, 0 falhas** numa cópia em LF (antes: 1 falha) |

Regressão do T1: `sim-test` 213/0 · `afk-test` 69/0 · `fx-test` 168/0 · `mapa-test` 15/15 · `wiki.mjs --check` em dia ·
`balance.js --quick` 132 metas (38 s) · `moldes-test` 237/1 (a falha restante é a do T2).
Não rodado: o dry-run do `pixellab-moldes.mjs` (o `moldes-test` já cobre as mensagens da CLI sem rede) e o `check.sh`
completo, que depende do Playwright (T3).

**O jogo não mudou** (o `dist/` dos dois ramos é byte a byte o da `main`), então o artefato publicado continua valendo
para teste.

Observado durante a execução: a `main` (local e no GitHub) já tinha avançado até o `youthful-maxwell` (`c63826cb`) por
um `pull` às 19:38 de 25/11, feito fora desta sessão — a D6a está feita. O chat da nuvem continua ativo: o ramo
`claude/fluidez` (5 commits, 13 arquivos, até 20:02 de 25/11) apareceu depois.

## T3 — Playwright das ferramentas (aprovado na D7), 2026-11-25

Ramo `feat/playwright-ferramentas` (saindo da `main`), commits locais `3f34fca5` e `00138d54`, sem push.

| Arquivo | Mudança |
|---|---|
| `prototype/tools/package.json` + `package-lock.json` (novos) | privado, `playwright` 1.64.1 exato; 2 pacotes; usa o Chromium que já estava no cache (`chromium-1248`) |
| `scripts/check.sh` | antes da etapa 6, se o Playwright não for achado, diz o comando e sai |
| `README.md`, `docs/guia-ferramentas.md`, `CLAUDE.md` §4 | o comando de instalação (`npm ci --prefix prototype/tools`) |

Resultado: `wiki-test` OK (1064 conferências, 4 s); `ui-test-paralelo` **82 de 83 blocos** na primeira rodada — o
`celular` caiu com `net::ERR_NO_BUFFER_SPACE` (Windows sem buffer de rede com 4 navegadores ao mesmo tempo) e passou
sozinho (`UI_SO=celular`). Sem o `node_modules`, o aviso do `check.sh` dispara; com ele, segue. Um defeito meu achado
no teste e corrigido no 2º commit: o `$ROOT` do Git Bash (`/c/...`) não vale para o Node do Windows.

Observações: o `CLAUDE.md` ficou com 120 linhas e ele mesmo pede "< 120" (você aceitou até 300: ajustar esse texto
no ticket de revisão do `CLAUDE.md`). O `ERR_NO_BUFFER_SPACE` pode voltar no Windows; se voltar, `UI_JOBS=3` [I].
**Ainda não rodado:** o `check.sh` completo de ponta a ponta, que só fecha com T1 + T2 + T3 juntos.

## T1 + T2 + T3 juntos na `main` local (2026-11-25)

Avanço direto para o T1 e duas junções (T2, T3) numa cópia de trabalho em LF; sem conflito. **`check.sh` completo: OK,
as 8 etapas, 17 min** — simulação 213/0, AFK 69/0, efeitos 168/0, mapa 15/15, dist em dia, moldes **237/0**, wiki OK,
132 metas, interface **83 blocos OK** (desenho por quadro 2,64 ms completas / 2,01 ms reduzidas). `git status` limpo
depois do build. **Enviado ao GitHub com o "sim" do Vinicius: `c63826cb..5a15a684`.**
