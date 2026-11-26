# Etapa 2 — Decisões de produto (D1–D9)

> **Status: Etapa 2 concluída em 2026-11-25 — D1 a D9 decididas pelo Vinicius, uma a uma (detalhes em cada seção).** Nada aqui foi implementado. Cada decisão aprovada vira uma entrada
> em `docs/memoria/decisoes.md` (com data e a sua palavra) e, se for regra inviolável, uma linha no `CLAUDE.md` §8 — só
> depois do seu "sim" para ela. Responder com o id e a alternativa basta (ex.: "D3: A").
>
> Legenda: [C] conferido no código · [D] documentado · [M] medido por alguém · [NV] não verificado · [I] inferência.

## Resumo

| Id | Pergunta | Recomendação | Muda regra/número? | Urgência |
|---|---|---|---|---|
| D1 | Para que servem as Gemas | ✅ **Vagas implementadas em 2026-11-26** (spec `2026-11-26-d1-vagas`: 2 de início, até 5 pelo Ouro). **Decidida pelo Vinicius:** cosméticos, VIP (+5% XP, +2% Ouro AFK, +1 vaga, cruza mais rápida) e Gemas; Ouro nunca vendido; estábulo 2 grátis + 3 por Ouro + 2 por Gemas + 1 VIP = 8 | Regra do §8 muda; estábulo muda | Antes do bloco 6 |
| D2 | Estratégia antes da corrida | ✅ **Aprovada: A** — Preparação com relógio de 12 s, troca só para Poder ≤ o da sala, botão "Largar agora" | Sim (fluxo da sala) | **Alta**: é a pergunta do protótipo |
| D3 | Clima: +3% ou +1,5 ponto | ✅ **Aprovada: A** — manter a soma fixa e corrigir o texto (T8) | Não (só texto) | Baixa |
| D4 | Ginásios em sequência | ✅ **Aprovada: B, mais difícil** — mais oponentes, mais distância entre ginásios, raridade Comum → Mágico → Raro; depois da D9 | Sim (progressão, Ouro) | Média |
| D5 | Sentido da regra das insígnias | ✅ **Aprovada: C** — hoje vale "não entra no `simulate`"; antes do online, bônus só no PVE | Hoje não; depois sim | Baixa agora, alta no online |
| D6 | Ramos | ✅ **Aprovada:** trazer `youthful-maxwell` (avanço direto, push só com "sim" na hora); `salas-economia` como base da D9; **guardar** `nifty-newton`; não apagar nada | Não | Média |
| D7 | Playwright | ✅ **Aprovada: D** — `prototype/tools/package.json`, Playwright 1.64.1 fixo | Não (infra) | **Alta**: destrava o `check.sh` |
| D8 | Sorte e Dado Viciado | ✅ **Implementada em 2026-11-26** (spec `2026-11-26-d8-sorte`). **Direção decidida:** Sorte melhora a cruza e os drops do AFK (com teto, pela seed); Dado Viciado sai do Poder; clima da Sorte fica | Sim (cruza, AFK) | Média |
| D9 | Salas justas e estreia (`salas-economia`) | ✅ **Aprovada:** T15 (extrair `sala.js`) e depois estreia D + faixa justa 93,5–104,5% | Sim (pareamento) | **Alta**: hoje o começo é ralo |

Ordem sugerida para você responder: **D7 → D2 → D9 → D1 → D4**, depois D3, D5, D8 e D6.

---

## D1 — Gemas e integridade da economia

**Problema.** Há duas definições do que a Gema compra, e uma delas abre um caminho indireto Gema → vantagem no PVP
valendo Ouro → Ouro. A regra mais importante do projeto é "Gemas nunca viram Ouro, direta ou indiretamente".

**Como funciona hoje.** No código, **Gemas não existem** [C]: nenhuma linha liga Gema a Ouro (também confirmado pela
tabela de economia do `salas-economia`). O risco está só nos documentos.

**Evidências.**
- `CLAUDE.md` §1: Gemas "cosméticos e passe"; §8: "Item comprado com Gema nunca tem resultado sorteado, e Gema nunca
  acelera o que paga Ouro. O Ouro nunca é vendido por Gemas." [D]
- `GDD.md` §2: Gemas "compram tempo, espaço, conveniência e aparência, nunca poder nem Ouro". [D]
- `GDD.md` §8.2, coluna "Por Gemas": **Rédea nova** (redistribui pontos), **Cupom com skill escolhida**, **Manual que
  garante aprender**, acelerador de cruza, vaga extra de estábulo (até 3), redefinir cruzas, mudar aparência. [D]
- `decisoes.md` tem as duas versões (l.1254 e l.1319), com datas fora de ordem. [D]

**Os caminhos indiretos que encontrei:**

| Produto do §8.2 | Caminho até Ouro | Gravidade |
|---|---|---|
| Rédea nova, Cupom escolhido, Manual garantido | Muda pontos/skills do cavalo que corre o PVP de aposta → mais vitórias → Ouro | **Direto no PVP** |
| Redefinir cruzas | Mais sorteios de potro → melhor genética → PVP | Alta |
| Acelerador de cruza | Mais cavalos por dia → mais cruzas, aluguel (paga Ouro), treino | Alta (fere "Gema nunca acelera o que paga Ouro") |
| Vaga extra de estábulo | Mais cavalos para aluguel e AFK → Ouro | Média |
| Mudar aparência | Nenhum | Nenhuma |
| Passe (se a trilha paga der Torrão, Manual, Pergaminho…) | Igual aos itens | Depende do conteúdo |

**Alternativas.**

| | Descrição | Vantagens | Desvantagens |
|---|---|---|---|
| **A** | Gema = **só aparência** (sela, seda, crina, cenário do estábulo, efeitos de vitória, molduras) **e passe cuja trilha paga é só cosmética**. Conveniência permitida apenas se **não** mexer em cavalo, tempo ou Ouro (ex.: presets de tela, renomear) | Fecha todos os caminhos; fácil de provar com teste; posição forte para a classificação etária e as lojas | Receita menor que vender conveniência; exige muita arte cosmética |
| B | Manter o §8.2 como está | Mais coisa para vender | Fere a regra do §8 em pelo menos 4 produtos; risco jurídico e de "pay-to-win" no PVP de aposta |
| C | Meio-termo: Gema compra **espaço e conveniência** que não alteram o `simulate` nem o Ouro (ex.: vaga de estábulo que **não** pode ir para aluguel/AFK, filas de cruza só cosméticas) | Mais produtos que A | Regras de exceção difíceis de manter; cada produto novo vira discussão |

**Recomendação: A**, com um **teste de invariante** no `balance.js`/`sim-test.js` quando a loja de Gemas existir:
"nenhum produto de Gema muda status, pontos, skills, rank, nível, estrelas, raridade, número de cavalos produtivos,
duração de algo que paga Ouro, nem o saldo de Ouro". Gemas grátis por missões continuam (não ferem nada).

**Impactos.** Gameplay: nenhum hoje. Economia: a Rédea e o Cupom/Manual continuam só por Ouro/jogando (como já são).
Arquitetura: um único lugar no `data.js` para o catálogo de Gemas, com o teste lendo dele. Multiplayer: é o que sustenta
o PVP de aposta entre jogadores reais.

### Decisão do Vinicius (2026-11-25) — status: **decidida em parte**

> *"Vip vai ser da forma que falei, 5% a mais de XP + 2% a mais de ouro AFK + outros benefícios."*

- **Loja:** cosméticos, VIP e pacotes de **Gemas** (dinheiro → Gemas). **O Ouro nunca é vendido.**
- **VIP:** +5% de XP, +2% de Ouro no treino AFK, +1 vaga no estábulo, cruza mais rápida e outros benefícios a definir.
- **Estábulo:** vagas por Ouro até um limite (exemplo dado: 5) e +2 por Gemas (exemplo: 7 no total).
- **Consequência registrada:** o +2% de Ouro no AFK é uma conversão **direta** de compra em Ouro, e o resto do VIP dá
  vantagem indireta. A regra do `CLAUDE.md` §8 "Gemas nunca viram Ouro, direta ou indiretamente" e a linha "Gema nunca
  acelera o que paga Ouro" **deixam de valer como estão** e precisam de texto novo (proposta abaixo). Antes de a loja
  real existir (bloco 6), vale uma avaliação jurídica sobre a classificação etária e de jogo de azar.
- **Texto proposto para o §8 (aplicar só com o seu "sim", no ticket de documentação):** "O Ouro nunca é vendido, por
  dinheiro nem por Gemas. Vantagens pagas (VIP e Gemas) só as listadas na spec da loja, cada uma com teto em
  `data.js` e coberta por teste; item comprado com Gema nunca tem resultado sorteado."
- **Complemento do Vinicius (2026-11-25):** *"Estábulo terá o total de 8 vagas, 5 por ouro e 2 por gemas e 1 por VIP. O
  VIP pode ser comprado por ouro (muito ouro) ou gema. Vip reduz o tempo de cruza, e no futuro, vamos aumentar os
  benefícios."*
  - Estábulo: **8 vagas no total = 5 pelo caminho do Ouro + 2 por Gemas + 1 do VIP.**
  - VIP: comprável com **muito Ouro** ou com **Gemas**; reduz o tempo de cruza; benefícios crescem no futuro.
  - Consequência registrada: com o VIP vendido nas duas moedas, existe uma taxa de câmbio implícita Gema ↔ Ouro (o
    preço do VIP nas duas). O Ouro continua sem ser vendido.
- **Vagas iniciais (Vinicius, 2026-11-25):** *"o jogador começa com duas vagas e precisa comprar as próximas."* Leitura:
  2 grátis + 3 compradas com Ouro = 5 pelo Ouro; + 2 por Gemas + 1 do VIP = 8. **Muda o jogo de hoje**
  (`data.js:495`: `stableSlotsStart: 3`, `stableSlotsMax: 8` por Ouro). Na implementação: saves que já têm mais vagas
  ficam com elas (não se mexe no save de ninguém) e o `balance.js` completo mede o efeito no começo.
- **Em aberto (resolvido o item 1 acima):** (1) as 3 vagas iniciais grátis contam dentro das "5 por Ouro"? Se sim, só 2 se compram com Ouro e o
  jogo de hoje (até 5 compradas) muda, inclusive para saves que já têm 8; (2) preço do VIP em Ouro e em Gemas e a
  duração; (3) o tempo de cruza ainda não existe no jogo (a cruza é instantânea hoje; o relógio de 12–24 h é do bloco 5).

### Rodada 1 com o Vinicius (2026-11-25) — análise mostrada a ele

Proposta dele: loja com **cosméticos, VIP e Gemas** (a "moeda do jogo" vendida é a **Gema**; o Ouro continua só jogando).

| Item proposto | Caminho até Ouro | Choque com o `CLAUDE.md` §8 |
|---|---|---|
| Vagas do estábulo: 5 por Ouro + **2 por Gemas** (= 7) | mais éguas → mais cruzas em paralelo → genética melhor → PVP | indireto |
| VIP: **+1 vaga** no estábulo | igual | indireto |
| VIP: **tempo menor de cruza** | mais potros por dia → PVP | indireto ("Gema nunca acelera o que paga Ouro" não se aplica: a cruza não paga Ouro) |
| VIP: **XP extra** | nível → Poder → PVP; o pareamento por Poder amortece, o teto do catálogo não | indireto |
| VIP: **+2% de Ouro no AFK** | pago → Ouro | **direto**: fere "Gemas nunca viram Ouro" e "Gema nunca acelera o que paga Ouro" |

Caminhos possíveis:
- **Ajustar o VIP e manter a regra.** Trocar o +2% de Ouro no AFK por +2% de **XP** no AFK (ou um cosmético). O XP extra do
  VIP vale só no PVE (AFK e ginásio). Vagas e cruza mais rápida entram como **exceção registrada, com teto**. A regra
  passa a dizer: "a Gema nunca compra nem produz Ouro; vantagem indireta só com teto, listada no §8 e coberta por
  teste". (Recomendado)
- **Mudar a regra e manter o VIP como está.** É uma escolha sua e possível, mas aceita Ouro pago num jogo em que o Ouro
  é apostado: é exatamente o risco de classificação que o GDD §2 quer evitar. Precisa de avaliação jurídica antes da loja
  real.
- **Longo prazo, para qualquer um dos dois:** a aposta acontecer em modo nivelado (a "Copa Nivelada" do GDD §2, com
  status normalizados) isolaria a aposta de qualquer vantagem paga.

Pendente de confirmação: o número final de vagas (5 + 2 por Gemas + 1 do VIP = **8**? hoje o máximo no jogo já é 8: 3
iniciais + 5 por 300 de Ouro).

**Dependências e consequências.** Antes do bloco 6. Se aprovada: corrigir GDD §2/§8.2 e consolidar uma versão só no
`CLAUDE.md` §8 e no `decisoes.md` (ticket T8, só texto). Afeta o desenho do passe e o modelo de receita (cosméticos
precisam de arte → orçamento de geração).

---

## D2 — Preparação estratégica antes da corrida

**Problema.** O `CLAUDE.md` §2 diz que o protótipo existe para descobrir se "corrida automática + **estratégia
pré-corrida** + aposta é divertida". Hoje o jogador **não tem decisão a tomar** quando sabe a pista e o clima.

**Como funciona hoje.** A sala abre já com o cavalo ativo dentro; pista e clima aparecem; as dicas dizem o que seria bom
("muitas curvas: Manobra…"), mas trocar a ativa está travado com o páreo aberto [C]. Equipamento não vale no PVP
(regra). Sobra escolher a entrada (50/100/250) e distribuir pontos antes de abrir a sala, **sem** saber a pista.

**Evidências.** `strategyTips`/`climaHints` (`game.js:6170–6200`) [C]; `motivoAtivar` (`game.js:2840–2846`) [C];
GDD §2 ("escolher a montaria e o equipamento para o mapa e o clima") × GDD §3 ("sem tática pré-corrida"); GDD §8.1
(Preparação com relógio, aprovada em 10/11, bloco 2, não implementada) [D].

**Alternativas.**

| | Descrição | Vantagens | Desvantagens |
|---|---|---|---|
| **A** | **Preparação do §8.1:** a sala abre, mostra pista e clima, e há ~12 s para trocar de cavalo (só entre os que têm Poder ≤ o que a sala viu). Larga sozinha no zero | Já aprovada; cria a decisão "qual cavalo para esta pista"; respeita "sala não re-sorteia" e "Poder acima do visto não entra"; encaixa no online (todos se preparam juntos) | Spec + código no `game.js` + testes de interface; relógio pressiona quem joga devagar; estábulo precisa ter variedade para a escolha valer |
| B | Mostrar pista e clima **antes** de abrir a sala e liberar a troca até pagar | Menor mudança | O jogador "pesca" a sala: escolhe o cavalo sabendo tudo e com tempo infinito; no online, revelar antes de pagar é próximo de "ver o resultado antes" |
| C | Manter como está e só reescrever as dicas | Zero risco | A hipótese do protótipo continua sem teste |
| D | Estratégia por "plano de corrida" (poupar/atacar, em que trecho) | Decisão rica, independe do estábulo | Mexe no `simulate` (determinismo, balanceamento, servidor); escopo grande |

**✅ Aprovada pelo Vinicius (2026-11-25): "Aprovo assim"** — alternativa A: relógio de **12 s**, troca do cavalo só
para Poder ≤ o que a sala viu, botão **"Largar agora"**, fechar o jogo não segura a sala; ferradura de tração fica para
depois. Entra depois da D9, com spec curta; o T11 corrige o texto das dicas antes disso.

**Recomendação: A**, começando por uma **spec curta** (duração do relógio, quem pode entrar, o que a tela mostra,
ferradura de tração fica para depois). Enquanto isso, **T11**: mudar o texto das dicas para não sugerir uma ação
impossível. D fica como ideia futura.

**Impactos.** Gameplay: cria a decisão central. Economia: pequeno (escolher melhor sobe um pouco a taxa de vitória;
medir no `balance.js`). Arquitetura: a troca durante a preparação precisa continuar gravada numa operação atômica
(como `gravaGasto`), e o teste de interface já cobre "Poder acima do visto não entra". Multiplayer: no servidor, a
troca vira uma mensagem dentro da janela; a escolha dos outros fica escondida até a largada.

**Dependências.** D9 (o pareamento da sala é a base); valoriza ter vários cavalos (cruzamento, D4). Quanto antes, melhor
para o teste fechado.

---

## D3 — Clima: "+3%" ou "+1,5 ponto"

**Problema.** O GDD e a sala dizem "+3% do status"; o código soma um valor fixo.

**Como funciona hoje.** `derive` soma `(m − 1)·weatherAdd` ao status normalizado: +1,5 ponto fixo para o dono do clima
[C, `sim.js:905–912`]. O próprio comentário diz por quê: "o mesmo efeito do inicial em qualquer nível" (`sim.js:239`).
No status 50 é exatamente +3%; no 100, ≈ +1,5%.

**Alternativas.** **A** — manter a soma e corrigir o texto (GDD §4, sala, wiki): sem mudança de resultado. B — trocar
para multiplicativo: o clima passa a valer mais para cavalos fortes (aumenta a diferença no fim de jogo), exige `balance.js`
completo e muda `tuningHash`. C — fórmula mista: complexa, sem ganho claro.

**✅ Aprovada pelo Vinicius (2026-11-25): "Sim, só o texto"** — soma fixa mantida; GDD §4, sala, wiki e o comentário
do `TUNING` corrigidos no T8.

**Recomendação: A.** A escolha aditiva foi deliberada e mantém o clima relevante para o inicial; o erro é só de texto.
Sugestão de texto na sala: "Sol favorece Fogo (+1,5 em cada status)".

**Impactos.** Nenhum em gameplay/economia/servidor. Ticket T8 (texto). Se um dia o clima for "skill de clima ×(1,03 +
rank)" o texto do `TUNING` (`sim.js:239`) também precisa ser corrigido (DOC-2).

---

## D4 — Recuperar a progressão dos ginásios

**Problema.** Em 18/11 você pediu: *"os ginásios devem seguir uma sequência, você só consegue lutar com um, vencendo o
anterior"*. Isso foi feito no `nifty-newton` e nunca chegou à `main`; depois, a spec do mapa (24/11) e a coordenação
(25/11) registraram os três abertos. Detalhes em `recuperacao-ramos.md` §3.1.

**Como funciona hoje.** Os três ginásios abertos em qualquer ordem, com os mesmos números (níveis 4–20, +720 de Ouro
líquido cada) [C].

**Alternativas.**

| | Descrição | Vantagens | Desvantagens |
|---|---|---|---|
| A | Manter os três abertos | Zero trabalho; liberdade de rota | Os três têm a mesma dificuldade: não há progressão; o 2º e o 3º viram repetição |
| **B** | **Sequência como no `nifty-newton`**, refeita sobre a `main`: Capoeira (nv 2–10) → Remanso (11–20) → Fornalha (21–30); trava `Ginasio.aberto`; quem já tem etapa vencida não perde nada; recusa antes de pagar | Cumpre o seu pedido; dá um arco de progressão de 1 a 30; a regra fica no módulo (vai para o servidor) | Muda progressão e economia (+2.280 líquidos em vez de +2.160, espalhados); números medidos com a Garra v2 → **medir de novo**; Grama vence 41–46% na Fornalha (pista a recalibrar); o mapa-múndi precisa de estado "fechado" |
| C | Sequência sugerida, sem trava (ordem recomendada e níveis diferentes, tudo aberto) | Progressão de dificuldade sem bloqueio | O jogador pode pular para o mais difícil e travar; não é o que você pediu |
| D | Trava leve: abre pela insígnia anterior **ou** por nível do cavalo ativo | Não prende quem já está forte | Mais regra para explicar |

**✅ Aprovada pelo Vinicius (2026-11-25):** *"Sim, em sequência, mas a dificuldade deve ser aumentada, pensei em aumentar
o número de oponentes por ginásios, e também, a distância entre um e outro, aumentando raridade (magico, raro).
Aprovado"*
- Sequência Capoeira → Remanso → Fornalha, com a trava pela insígnia do anterior (alternativa B).
- **Mais difícil que o `nifty-newton`:** mais oponentes por ginásio, mais distância de nível entre um ginásio e o
  próximo e raridade subindo — leitura: Capoeira com Comuns, Remanso com **Mágicos**, Fornalha com **Raros** (hoje todos
  os oponentes têm a genética do inicial Comum, `data.js` `gym(...)`).
- Números finais saem da spec curta, medidos no `balance.js` completo (metas G), depois da D9.
- **A conferir na spec:** "mais oponentes" = mais etapas por ginásio ou times maiores? O time do jogador vai até o
  tamanho do time do adversário (hoje até 3), e com **2 vagas iniciais** (D1) o jogador novo só leva 2 cavalos.

**Recomendação: B**, mas **depois da D9** (os dois mexem no Ouro do começo; medir um de cada vez) e com spec curta que
inclua: números remedidos com a Garra atual, metas G do `balance.js` completo, o estado "fechado" no mapa-múndi
(cadeado/névoa sem animação de bloqueio, para não contrariar a spec do mapa além do necessário) e a linha no
`CLAUDE.md` §8. É o ticket T18.

**Impactos.** Gameplay: progressão clara. Economia: muda a curva de Ouro do nível 1 a 30. Arquitetura: regra pura no
`ginasio.js`, sem mudar o formato do save. Multiplayer: no online os ginásios viram tronos de jogadores (GDD §8.6) — a
sequência continua valendo como porta de entrada.

**Dependências.** D9 primeiro; T1–T3 (verificação) antes do código.

---

## D5 — O sentido da regra das insígnias

**Problema.** "Bônus de insígnia é da conta e nunca entra na simulação da corrida" (`CLAUDE.md` §8) é cumprido no sentido
estrito, mas duas insígnias dão vantagem indireta no PVP de aposta.

**Como funciona hoje [C].** Capoeira: +3 p.p. na chance de aprender skill por nível (`chanceSkillNivel`, `game.js:1190`)
→ skill entra no Poder e na corrida. Fornalha: +3% de Ouro sobre prêmios (`ouroComBonus`, `game.js:1194`) → cria Ouro
que não sai do pote; o próprio GDD (§8.6) já marca isso para rever antes do online. Remanso: +3% XP.

**Alternativas.** A — a regra é "não entra no `simulate`" (já cumprida); só documentar. B — a regra é "não dá vantagem no
PVP": tirar os três bônus do PVP agora. **C — A hoje, B antes do online:** no protótipo offline fica como está; na spec
do bloco 7, os bônus passam a valer só no PVE (AFK, ginásio), como o equipamento.

**✅ Aprovada pelo Vinicius (2026-11-25): "Sim, assim"** — offline fica como está; o `CLAUDE.md` §8 ganha o sentido
"não entra no cálculo da corrida" (T8); na spec do bloco 7, os bônus passam a valer só no PVE.

**Recomendação: C.** Offline, o efeito é pequeno e não há Ouro de outros jogadores em jogo; reescrever agora é trabalho sem
ganho de teste. Gravar a interpretação no `CLAUDE.md` §8 para ninguém ler errado.

**Impactos.** Economia online: impede criação de Ouro sobre o pote alheio. Multiplayer: necessário. Arquitetura: o bônus
já é aplicado fora do `simulate` (fácil de restringir por modo).

---

## D6 — Integração e limpeza dos ramos

Detalhe completo em `recuperacao-ramos.md`.

| | Ação | Recomendação |
|---|---|---|
| D6a | Trazer `claude/youthful-maxwell-zh7h58` à `main` (avanço direto; só `decisoes.md`, `README.md`, `ESTADO.md` e 24 capturas; 0 conflito) | **Sim**, depois de o chat da nuvem ser avisado; push na `main` só com seu "sim" no momento |
| D6b | `claude/salas-economia` | Fica onde está até a D9 |
| D6c | `claude/nifty-newton-e8u133` | **Guardar** (tem arte paga do PixelLab que só existe nele; é a referência da D4) |
| D6d | Apagar os 21 ramos já integrados | **Não agora.** Não atrapalham; apagar no GitHub não tem volta pelo site. Se quiser, depois, um a um |

**Impactos.** Só memória e documentação. Dependência: P1 já resolvida (esta sessão coordena).

---

## D7 — Estratégia de testes e Playwright

**Problema.** Sem Playwright, as etapas 6 (wiki) e 8 (interface, 83 blocos, incluindo as travas do PVP e do save) do
`check.sh` não rodam aqui. Nenhuma entrega local cumpre "rode o `check.sh` antes de terminar".

**Como funciona hoje [C].** `ui-test.mjs:30` e `wiki-test.mjs:439` fazem `require('playwright')` via `createRequire`; não há
`package.json`; `node_modules/` já está no `.gitignore`. O README do `youthful-maxwell` e o `guia-ferramentas.md` dizem
"Playwright instalado à parte (na nuvem já vem)". Nesta máquina: Node 24.20 (o README pede 22), **os navegadores do
Playwright já estão no cache** (`%LOCALAPPDATA%\ms-playwright\chromium-1248`), mas o pacote não está instalado. A versão
usada na nuvem é [NV].

**Alternativas.**

| | Descrição | Vantagens | Desvantagens |
|---|---|---|---|
| A | `package.json` na raiz com `playwright` em `devDependencies` | Padrão; `npm ci` reproduz | Contraria o espírito "sem dependências" na raiz; alguém pode achar que o jogo depende disso |
| B | Instalação global documentada (`npm i -g playwright@X` + `NODE_PATH`) | Nenhum arquivo novo no repo | Versão varia por máquina; `NODE_PATH` é frágil no Windows; resultados diferentes entre máquinas |
| C | Só no CI (GitHub Actions instala) | Repo intacto | Localmente continua sem rodar a interface; ciclo de feedback lento |
| **D** | **`package.json` só de ferramentas** (ex.: `prototype/tools/package.json`, `"private": true`, `playwright` com **versão exata** e `package-lock.json`), usado aqui e no CI; o jogo continua sem nenhuma dependência | Versão fixa em todo lugar; separação clara jogo × ferramenta; o `createRequire` dos testes já acha `node_modules` subindo pastas | Um arquivo e um lock novos; precisa do seu "sim" (dependência nova, `CLAUDE.md` §9); ~150–200 MB de navegador (já no cache aqui) |

**✅ Aprovada pelo Vinicius (2026-11-25): "Aprovo a D7"** — alternativa D, `prototype/tools/package.json` privado com
Playwright 1.64.1 fixo e lock; instalação só no ticket T3.

**Fato novo (2026-11-25):** o Chromium do cache (`chromium-1248`) é o do Playwright **1.64.1**, instalado por outro
projeto desta máquina. Fixar 1.64.1 dispensa baixar navegador aqui; o CI baixa o dele.

**Recomendação: D**, com a versão escolhida para bater com o Chromium que a nuvem usa (conferir antes) e o `check.sh`
dizendo como instalar quando faltar. Isso vira o **T3**; o **T4** (CI em Linux) usa o mesmo arquivo. A estratégia de
testes fica em camadas:

| Camada | O que cobre | Onde roda |
|---|---|---|
| Unidade (`sim-test`, `afk-test`, `fx-test`, `mapa-test`, `moldes-test`) | regras puras, determinismo | sempre, ~20 s |
| Balanço rápido (`balance.js --quick`) | 132 metas | sempre, ~45 s |
| Balanço completo | M6, M9, P1, S1, A1, G1–G7 | ao mudar número de regra; CI noturno/PR |
| Interface (Playwright) | travas do PVP, save, telas | `check.sh` e CI |
| Equivalência (T14–T16) | extração sem mudar comportamento | ao extrair módulos |
| Hashes de referência (T12) | Node × navegador | CI |

**Impactos.** Nenhum no jogo. Arquitetura: passa a existir um lugar declarado para ferramentas de desenvolvimento.
Multiplayer: o CI é pré-requisito para mexer no servidor com segurança.

**Dependência.** T1 e T2 podem ser feitos antes (não precisam de Playwright para provar o próprio aceite, exceto o
`check.sh` completo).

---

## D8 — Papel da Sorte e do Dado Viciado

**Problema.** A Sorte quase não muda o resultado, mas o Dado Viciado ocupa vaga de skill e soma Poder — então o Poder
superestima quem o tem, e o jogador gasta vaga numa skill fraca.

**Como funciona hoje.** `ratingW.sorte = 0` (a Sorte não entra no Poder, `sim.js:255`) [C]; bots e "Distribuir
sugerido" não põem pontos em Sorte [C]; o peso do gatilho `dice` é 0,2 no Poder da skill (`sim.js:511`) [C]. Medido
(`exemplos.md`): Sorte ≈ 0,7 p.p. de vitória; Dado Viciado 0,2–1,5 p.p. [M]. No `nifty-newton` tentaram dar +3% de
velocidade por 10 s ao Dado Viciado (não foi para a `main`).

**Alternativas.** A — Sorte vira "sabor" assumido: o jogo explica que ela só mexe nas viradas de clima; o Dado Viciado
sai do Poder ou ganha peso ~0. B — dar papel à Sorte (ex.: aumenta a chance/força da Garra ou de eventos), medido para
valer como os outros status. C — remover o status Sorte (mexe no save, na arte, no wiki: alto custo). D — só refazer o
Dado Viciado (como no `nifty-newton`).

**✅ Direção decidida pelo Vinicius (2026-11-25):** *"Sorte pode aumentar a chance de melhores cavalos na cruza, drop de
itens AFK"* — a Sorte vira o status da **criação e do PVE** (variante de B, fora da corrida):
- **Cruza:** a Sorte dos pais melhora as chances do potro (raridade, estrelas e/ou genética), sempre pela RNG da seed
  (`breed.js`, sem mudar a ordem das chamadas) e com teto; **Mítico continua nunca nascendo de cruza**.
- **AFK:** a Sorte do cavalo na vaga aumenta a chance de drop de itens, pela mesma RNG (`afk.js`, `SAL_DROP`), com teto.
- Continua fora do Poder (`ratingW.sorte = 0`); os rivais e o "Distribuir sugerido" continuam sem pôr pontos nela. Cria
  uma escolha real: cavalo de corrida × cavalo de criação/AFK.
- Números, fórmula (Sorte da égua, do garanhão ou a média?) e tetos saem de uma spec curta, medida no `balance.js`
  (metas E1 do AFK e as chances de cruza do wiki). Muda o GDD §3/§6/§8.3a e o wiki.
- **Fechado (Vinicius, 2026-11-25: "Sim, os dois"):** o **Dado Viciado sai do Poder** (continua skill de corrida;
  medir depois da D9) e a **Sorte continua mexendo nas viradas de clima** como hoje.

**Recomendação original: medir primeiro** (uma rodada do `balance.js` com o Dado Viciado de peso 0 no Poder, para ver quanto o
pareamento muda) e decidir entre **A** e **B** com o número na mão. C não recomendo.

**Impactos.** Gameplay: tira uma armadilha. Economia: pequeno. Arquitetura/servidor: só `TUNING`/`data.js`. Depende da D9
(o pareamento usa o Poder).

---

## D9 — Salas justas e estreia (proposta do `salas-economia`)

**Problema.** Medido pelo pareamento real [M]: o inicial vence **6%** nas 10 primeiras salas (justo 17%), perde ~25 de
Ouro por sala de 50 e, depois da 20ª, **passa metade das salas no treino gratuito**. Bate com a sua queixa ("no começo
eu sempre perco").

**Como funciona hoje [C].** `buildLobby` (`game.js:6037`) escolhe rivais entre 91,5% e 111,5% do Poder do jogador
(média 101,5%), com 3–7 rivais.

**Alternativas (da spec `2026-11-25-salas-economia-design.md`).** Estreia: A generosa (vence 47%), **D (39%, pódio 83%)**,
B a antiga (30%), E curta. Faixa normal: **justa 93,5–104,5%**, centrada 95–105%, a favor 92–102%. Prêmio, entrada e
taxa: não mexer.

**✅ Aprovada pelo Vinicius (2026-11-25): "Aprovo a D9"** — primeiro o T15 (`sala.js` sem mudar comportamento, com
teste de equivalência), depois a estreia D (10 salas, 4–5 corredores, rivais 93–100,5%, rampa até a 20ª) e a faixa
normal 93,5–104,5%, sem mexer em prêmio, entrada nem taxa; `balance.js` completo e jogo publicado a cada passo. Medir
junto com as 2 vagas iniciais da D1. Teto do catálogo e erro do Poder por cavalo ficam para decisões futuras.

**Recomendação: aprovar a direção (estreia D + faixa justa)**, com duas condições:
1. **Primeiro T15** — extrair a montagem da sala para um módulo puro (`sala.js`) com teste de equivalência (mesmo save →
   mesma sala). Assim o `balance.js` mede o código de verdade (hoje `salas-medida.js` é uma **cópia** do `buildLobby`) e o
   servidor herda a regra.
2. **Depois** os números novos, num ramo próprio, com o `balance.js` completo e as metas novas da spec.

Os dois pontos em aberto da spec viram decisões futuras: **teto do catálogo** (Mítico nv 50 vence 40–51% e é a maior
fonte de Ouro do fim de jogo) e **o Poder erra por cavalo**.

**Impactos.** Gameplay: o começo deixa de ser punitivo. Economia: a sala sai de "ralo" para perto do zero a zero (a
taxa de 10% fica); +~700 de Ouro/hora no começo; a spec não vê inflação. Arquitetura: `sala.js` resolve parte do ARQ-1.
Multiplayer: no online a sala é entre jogadores reais (ligas por Poder + MMR) e os bots só completam — a estreia vira
"liga de iniciantes".

**Dependências.** Antes da D2 (a preparação usa a sala) e da D4 (os dois mexem no Ouro do começo). Precisa de T1–T3 para
o `check.sh` completo.

---

## Outras decisões que a auditoria encontrou (sem urgência)

| Id | Pergunta | Base | Sugestão |
|---|---|---|---|
| D10 | Build equilibrada do bot domina no nível 50 (60–65%): é desenho ou problema? | COR-4 | Revisitar depois da D9 |
| D11 | `dist/` no git (204 MiB de histórico, `jogo.html` 2,6 MB) | DES-1 | Medir no aparelho (T17) antes de decidir |
| D12 | O build dos testadores (`jogo-teste.html`) deve manter o DEV com `?dev=1`? | PER-7 | Decidir antes do teste fechado |
| D13 | Campo de origem do cavalo (`born: 0` para iniciais, catálogo e 1º potro) | CAV-2 | Só junto com outra mudança de save |
| D14 | Mercado em Ouro × "Ouro não se transfere entre contas" | R3 | Na spec do bloco 7 |
| D15 | Relógio e seed no cliente | PER-5, PER-6 | No servidor (bloco 7); hoje aceito offline |
