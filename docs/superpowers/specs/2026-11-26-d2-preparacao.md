# D2 — Preparação com relógio (spec curta)

> **Status: implementada em 2026-11-26 ("Pode implementar"). Perguntas respondidas em 2026-11-26 (P1 o relógio sempre corre; P2 o treino também tem relógio;
> P3 salas antigas ganham 12 s ao reabrir).** Decisão D2 aprovada em 2026-11-25 (`docs/auditoria/decisoes-produto.md`,
> alternativa A, "Aprovo assim"): relógio de 12 s, troca de cavalo só para Poder ≤ o que a sala viu, botão "Largar
> agora", fechar o jogo não segura a sala. Ferradura de tração fica para depois. GDD §8.1.

## 1. Como é hoje

- "Correr" abre a sala (`openLobby`): o contador sobe, a sala fica gravada em `state.pending` (`pr`, `fee`, `alloc`) e
  a tela mostra pista, clima, vento, rivais e dicas. A sala não é re-sorteada: voltar ou recarregar mostra a mesma.
- O jogador pode ficar na sala **o tempo que quiser** e só paga e corre no "Largar!" (`settle`).
- Com a sala aberta, **trocar a montaria ativa é proibido** (`motivoAtivar`: "Páreo aberto: corra a sala antes…").
  Por isso as dicas da pista ("muitas curvas: Manobra…") hoje não levam a nenhuma decisão.

## 2. Regra nova

1. **Relógio:** quando a sala abre, começa uma contagem de **12 s** (número em `data.js`, ajustável). O prazo é
   gravado no save como hora de relógio (`P.prazo`), na mesma gravação que abre a sala.
2. **Trocar de cavalo:** na própria tela da sala, uma faixa com os cavalos do estábulo. Um toque troca o corredor.
   - Só entram cavalos com **Poder ≤ o que a sala viu** (`P.pr`); os outros aparecem apagados, com o motivo
     ("Poder 812 acima da sala, 790").
   - A troca grava na hora (como os outros gastos, `gravaGasto`); se não gravar, nada muda.
   - Trocar **não re-sorteia nada**: rivais, pista, clima e entrada ficam iguais (ver §3).
   - O cavalo escolhido vira a montaria ativa (no treino AFK, a vaga dele pausa e a do anterior volta a contar).
3. **Largar agora:** o botão "Largar!" continua e larga na hora (é o "Largar agora").
4. **No zero, larga sozinha:** com o cavalo selecionado, pagando a entrada como hoje.
5. **Fechar o jogo não segura a sala:** ao abrir o jogo (ou voltar à aba) depois do prazo, a corrida é liquidada com o
   cavalo selecionado e o jogador vê o resultado. A seed já estava fixada; nada novo é sorteado.
6. Fora a troca de cavalo, nada mais muda com a sala aberta (pontos e itens seguem as regras de hoje).

## 3. Detalhe técnico que garante "a sala não muda"

Hoje os rivais usam o rank do cavalo ativo (`RaceSim.botRank`) e a lista de cavalos do estábulo (`donos`) a cada vez
que a sala é remontada. Se o cavalo trocasse, os rivais mudariam, o que seria um re-sorteio. A solução: ao abrir a sala,
gravar no páreo o rank dos bots e os donos (`P.rank`, `P.donos`), e o `Sala.montar` passa a usar esses valores.
Páreos abertos em saves antigos (sem esses campos) usam o cavalo ativo, como hoje; **nenhum save muda**.

## 4. Três perguntas (respondidas: as três recomendadas)

**P1 — Sair da tela da sala conta?** (ex.: ir ao Estábulo durante os 12 s)

| | Opção | Efeito |
|---|---|---|
| **A (recomendada)** | O relógio corre sempre; ao voltar depois do zero, o resultado já está pronto | Simples, igual ao online (no servidor a sala larga para todos no mesmo instante) |
| B | Sair da tela pausa o relógio | Dá para "estudar" a sala fora dela; no online não existiria |

**P2 — O treino (sem aposta) também tem relógio?**
Recomendo **sim**, mesma regra: é onde o jogador aprende a usar a troca sem perder Ouro.

**P3 — Páreos já abertos nos saves de hoje (sem prazo)?**
Recomendo: o relógio começa **na próxima vez que a sala aparecer**, com os 12 s cheios. Ninguém perde a sala aberta.

## 5. Como provar

- `sim-test`/novo teste de módulo: o `Sala.montar` com `P.rank`/`P.donos` gera a mesma sala para qualquer cavalo
  ativo; as 200 salas de `sala-referencia.json` continuam iguais.
- `ui-test` (relógio parado no DEV para o teste não depender do tempo):
  - troca para um cavalo permitido muda o corredor e não muda rivais, pista, clima nem entrada;
  - cavalo com Poder acima aparece apagado e o toque não troca;
  - "Largar!" antes do zero; zero larga sozinho com o cavalo escolhido;
  - recarregar depois do prazo mostra o resultado e cobra a entrada uma vez só;
  - leitor de tela: o relógio anuncia só nos 5 s finais (não a cada segundo).
- `balance.js` completo: a escolha da pista sobe um pouco a vitória; medir como informação (sem meta nova).
- Teste manual: no DEV, abrir a sala com dois cavalos, trocar, ver o relógio zerar.

## 6. Fora deste passo

- Ferradura de tração (família nova de peça).
- Trocar ferradura na preparação: o equipamento não vale no PVP (CLAUDE.md §8).
- Ajuste do tempo depois de jogar (o número fica em `data.js`).
