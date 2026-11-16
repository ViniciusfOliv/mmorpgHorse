# Itens, mochila, loja e recompensa diária

Desenho de 2026-11-16, conversado com o Vinicius. **Em revisão: ainda não aprovado.** Branch `claude/itens-loja-diaria`,
criada da `main` (que já tem a Visuais 2 até a parte 3). É a primeira de duas frentes pedidas por ele no mesmo dia; a
segunda, os ginásios, tem desenho próprio depois desta e usa estes itens como prêmio.

## 1. Intenção

Pedido do Vinicius: "Vamos colocar recompensa diária, a loja, inventário de itens e começar o ginásio."

Hoje o jogador corre, sobe de nível e distribui pontos. Não há nada para ganhar fora da corrida, nada para guardar e
quase nada em que gastar Ouro (entrada, vaga de estábulo, cruza e troca no Haras). Esta frente fecha um ciclo curto:

- **ganhar** todo dia, só de abrir o jogo (recompensa diária);
- **comprar** com Ouro o que fortalece o cavalo (loja);
- **guardar** e ver o que tem (mochila);
- **usar** no cavalo certo, na hora certa (os cinco itens).

Os cinco itens são os do GDD §8.2, aprovado em 2026-11-10. Nenhum deles existe no jogo, fora a Rédea nova, que só a
gaveta DEV dá. Uma coisa muda em relação ao GDD: o Manual de doma, que lá "aumenta a chance de aprender", vira uma
tentativa na hora (decisão 6, abaixo); a seção 15 acerta o GDD.

**Decisões do Vinicius (2026-11-16):**
1. A primeira entrega junta itens, mochila, loja e recompensa diária. Os ginásios vêm depois.
2. Entram os cinco itens do GDD: Torrão de açúcar, Estrela de treino, Rédea nova, Cupom de troca de skill e Manual de doma.
3. Só Ouro. A Gema e a loja de Gemas ficam para o bloco próprio.
4. Diária em calendário de 7 dias, com prêmios fixos, que não zera quando o jogador falta um dia.
5. Telas: a Loja volta como 5ª aba, com as partes Comprar e Mochila; a recompensa do dia fica num cartão no topo do
   Estábulo; o item também se usa direto na ficha do cavalo.
6. Manual de doma: tentativa na hora, com chance alta.
7. Estrela de treino: na loja, cara e 1 por semana; também cai no 7º dia a cada 4 calendários completos.
8. A recompensa sai só de abrir o jogo; não pede corrida.

## 2. Objetivo, fora do escopo e o que não pode acontecer

**Objetivo.** No celular a 360×780:
- ao abrir o jogo num dia novo, o jogador vê a recompensa no topo do Estábulo e a resgata com um toque;
- na aba Loja, compra os quatro itens à venda e vê quantos ainda pode comprar hoje;
- na parte Mochila, vê os cinco itens, quantos tem de cada e para que servem, e usa um item escolhendo o cavalo;
- na ficha do cavalo, usa o item que serve àquela aba sem sair dela.

**Fora do escopo:** Gemas e loja de Gemas; as versões "por Gemas" dos itens (skill escolhida, doma garantida); missões;
ginásios; circuito, aluguel e cruza com relógio; ração; a volta do equipamento (continua suspenso atrás do `GEAR_ON`);
ícones novos pelo PixelLab (os cinco ícones saem de desenho em código, sem créditos).

**O que não pode acontecer:**
- **Ouro por Gema, Gema por Ouro:** nada disso existe aqui. A loja só aceita Ouro.
- **Rédea nova à venda por Ouro.** O GDD §8.2 diz "nunca por Ouro". Ela vem da diária (e, depois, dos ginásios).
- **Sorteio fora da seed.** O Cupom e o Manual sorteiam pela seed do save. Nada de `Math.random`.
- **Sortear de novo recarregando a página.** O resultado de um Cupom ou de um Manual não muda se o jogador fechar e abrir.
- **Mexer na corrida já sorteada.** Com a sala aberta, nenhum item muda as skills do cavalo ativo, e nenhum ponto sobe
  o Poder dele acima do que a sala viu (a trava que já existe continua valendo).
- **Resgatar duas vezes no mesmo dia** voltando o relógio do celular.
- **Perder o save:** um jogo de versão antiga não pode apagar os campos de um save mais novo (seção 10).
- **Gastar a entrada reservada:** com a sala aberta, a loja respeita o Ouro reservado para a entrada.

## 3. Abordagens

**Onde as coisas ficam na tela** (escolha do Vinicius, com esboços):

| Abordagem | Como é | Troca |
|---|---|---|
| **A. Loja na barra, mochila dentro (escolhida)** | Loja como 5ª aba, com Comprar e Mochila; diária num cartão no topo do Estábulo; item também na ficha do cavalo | O prêmio do dia aparece na primeira tela que o jogador vê; a mochila fica a um toque da loja. O Estábulo cresce um pouco |
| B. Uma aba "Itens" com tudo | Diária, Loja e Mochila numa aba só; usar item sempre começa ali | O Estábulo não muda, mas a recompensa fica escondida atrás de uma aba, e usar item pede mais toques |
| C. Mochila no Estábulo, loja só de comprar | Mochila e diária acima da lista de cavalos | Tudo à vista, mas o Estábulo fica comprido e a lista de cavalos desce |

**Como é construído** (escolha do controlador):

| Abordagem | Troca |
|---|---|
| **Módulo de regras próprio, `prototype/src/itens.js`, e catálogo no `data.js` (escolhida)** | As regras dos itens, da loja e da diária ficam puras (sem tela, sem relógio, sem `Math.random`), testadas no Node e prontas para ir ao servidor junto com `sim.js`, `breed.js` e `gear.js`. O `game.js` só mostra e grava |
| Tudo dentro do `game.js` | Mais rápido de escrever, mas as regras ficam presas à tela e teriam de ser separadas na hora do servidor |
| Estender o `gear.js` | O equipamento está suspenso e é outro conceito (peça que se equipa); misturar os dois confunde |

## 4. Os cinco itens

Todos são de uso único e valem para um cavalo. O uso pede uma confirmação (segundo toque no mesmo lugar, como o
Redistribuir de hoje) e não tem volta.

| Item | O que faz | Limites e quando não pode |
|---|---|---|
| **Torrão de açúcar** | O cavalo ganha 1 ponto a mais para distribuir, para sempre | Até **10 por cavalo**. O potro nasce com 0 |
| **Estrela de treino** | O cavalo sobe 1 estrela (de ★1 para ★2, de ★2 para ★3) | Não em cavalo com ★3 |
| **Rédea nova** | Redistribui os pontos do cavalo. É a regra que já existe (a primeira redistribuição de cada cavalo é grátis) | As travas de hoje: sem pontos distribuídos não redistribui; o ativo não redistribui com a sala aberta |
| **Cupom de troca de skill** | O jogador escolhe uma skill das vagas do cavalo; ela sai e entra outra, sorteada entre as que ele pode aprender e ainda não tem | Precisa de pelo menos uma skill nas vagas e de pelo menos uma candidata. A skill de tipo não ocupa vaga e nunca troca. **Não no cavalo ativo com a sala aberta** |
| **Manual de doma** | O cavalo tenta aprender uma skill na hora: **35% de chance**. Se aprender, é uma das candidatas, sorteada | Precisa de vaga de skill livre e de pelo menos uma candidata. Aprendendo ou não, o manual é gasto. **Não no cavalo ativo com a sala aberta** |

Detalhes das regras:

- **Torrão.** O total de pontos do cavalo passa a ser o de hoje mais os torrões: `freePoints` soma o número de torrões
  (0 a 10) depois da conta de nível, raridade e estrelas. Os bots não têm torrões. O teto de 150 por status não muda.
  O campo novo é do cavalo (por exemplo `torroes`) e se perde com ele na Troca do Haras.
- **Estrela.** Só muda o campo de estrelas do cavalo (`grau`). Os pontos a mais aparecem para distribuir.
- **Estrela e cruza.** A estrela ganha por item vale como qualquer outra: as estrelas dos pais continuam definindo a
  base das estrelas do potro (`breed.js`, sem mudança). Treinar um pai melhora a linhagem. O `breed.js` não muda.
- **Skills e cruza.** Uma skill que veio do Cupom ou do Manual é uma skill do cavalo como as outras, inclusive na
  herança e na conta de Corcel. O `breed.js` não muda.
- **Qualquer skill das vagas pode sair no Cupom**, venha ela de nascença, de herança, de nível ou do Manual. O save não
  guarda a origem da skill.
- **Torrão e Estrela com a sala aberta:** podem ser usados, inclusive no ativo. Eles só dão pontos para distribuir, e
  gastar esses pontos já passa pela trava do Poder da sala.
- **Candidatas** (Cupom e Manual): as mesmas do aprendizado por nível de hoje — as skills gerais e as do elemento do
  cavalo, menos as que ele já tem. No Cupom, a skill que sai não pode voltar no mesmo sorteio.
- **Sorteio.** O save ganha um contador de usos sorteados. Cada uso de Cupom ou Manual grava o contador novo junto com
  o resultado, na mesma gravação, e sorteia com o gerador da seed do save e esse contador (o padrão da melhoria de peça
  e do cruzamento). Assim, recarregar a página não muda o resultado. O executor escolhe um sal que não colida com as
  seeds de corrida, de aprendizado por nível, de cruza e de melhoria.
- **O aprendizado por nível não muda:** continua com 8% a cada nível.
- **Avisos depois do uso** (região viva, como os avisos de hoje): "Brasa ganhou 1 ponto para distribuir.", "Brasa agora
  tem ★★★.", "Brasa aprendeu Arranque!", "Não foi desta vez: Brasa não aprendeu. O manual foi usado.",
  "Sprint saiu e entrou Arranque." O texto exato é do executor; o tom é este.
- **Quando não pode**, o botão segue o padrão da 3b: fica apagado, com o motivo escrito, e o toque mostra o motivo.

## 5. Mochila

- Guarda quantos o jogador tem de cada item: 0 a 99 de Torrão, Estrela, Cupom e Manual. A Rédea nova continua no campo
  que já existe, com o teto de hoje (999); a mochila só a mostra.
- **Rédea nova pela mochila:** "Usar" abre a escolha do cavalo e leva ao Redistribuir da ficha dele. A regra de custo
  não muda: a redistribuição grátis do cavalo é usada primeiro, e a Rédea só é gasta quando a grátis já foi. O cavalo
  que não pode redistribuir aparece apagado, com o motivo de hoje.
- A parte **Mochila** da aba Loja lista os cinco, sempre na mesma ordem, cada um com ícone, nome, quantidade, uma linha
  dizendo para que serve e o botão **Usar**. Com quantidade 0, a linha continua lá, apagada, dizendo de onde o item vem
  ("Compre na loja" ou "Vem no 7º dia da recompensa").
- **Usar** abre a escolha do cavalo: a lista dos cavalos do jogador, no formato das linhas do Estábulo. O cavalo que não
  pode receber o item aparece apagado, com o motivo. No Cupom, depois do cavalo vem a escolha da skill que sai. O último
  passo é a confirmação.
- Na **ficha do cavalo**, os mesmos usos aparecem onde fazem sentido, só quando o jogador tem o item:
  - aba **Status:** Torrão de açúcar e Estrela de treino (a Rédea nova já está lá, no Redistribuir);
  - aba **Skills:** Manual de doma e, em cada skill aprendida, Trocar (Cupom).
- Os dois caminhos levam à mesma confirmação e ao mesmo resultado.

## 6. Loja

A aba **Loja** volta à barra de baixo, como 5ª aba, sempre visível. Ela abre na parte **Comprar**.

| Item | Preço em Ouro | Limite |
|---|---|---|
| Torrão de açúcar | 120 | 2 por dia |
| Manual de doma | 200 | 1 por dia |
| Cupom de troca de skill | 250 | 1 por dia |
| Estrela de treino | 2.000 | 1 a cada 7 dias |

- A Rédea nova não está à venda. A loja mostra uma linha dizendo que ela vem no 7º dia da recompensa diária.
- Cada produto mostra ícone, nome, para que serve, preço, quantos o jogador já tem e quantos ainda pode comprar hoje
  ("1 de 2 hoje"; na Estrela, "disponível" ou "de novo em N dias").
- A compra é de um toque, como na loja de hoje, e o item vai para a mochila. O botão mostra **Comprar**, **Sem Ouro**,
  **Reservado** (o Ouro que sobra está guardado para a entrada da sala aberta) ou **Limite de hoje**.
- O limite por dia volta a zero quando o dia muda (seção 9). O da Estrela conta 7 dias desde a última compra.
- A mochila cheia (99) bloqueia a compra daquele item, com o motivo.
- O que existe da loja de equipamento continua como está, escondido atrás do `GEAR_ON`. Hoje a aba Loja inteira e as
  ações dela (`loja-tab`, `comprar`) estão atrás desse portão (`ABAS`, `ACOES_EQUIP`); a aba e as ações novas têm de
  ficar fora dele, com nomes de ação próprios. O wiki lê a lista de abas do código e precisa acompanhar.

## 7. Recompensa diária

Um calendário de 7 dias, com prêmios fixos:

| Dia | Prêmio |
|---|---|
| 1 | 60 de Ouro |
| 2 | 1 Torrão de açúcar |
| 3 | 100 de Ouro |
| 4 | 1 Manual de doma |
| 5 | 150 de Ouro |
| 6 | 1 Cupom de troca de skill |
| 7 | 200 de Ouro e 1 Rédea nova; a cada 4 calendários completos, também 1 Estrela de treino |

- O jogador resgata **uma vez por dia**, só de abrir o jogo e tocar em **Resgatar**. Não precisa correr.
- **Não zera.** Quem falta um dia continua de onde parou: o calendário só anda quando há resgate.
- Depois do dia 7, recomeça no dia 1. O jogo conta os calendários completos; o 4º, o 8º, o 12º… dão a Estrela.
- Um save novo já começa com o dia 1 para resgatar.
- O prêmio em Ouro entra direto no saldo. O prêmio em item vai para a mochila; se ela estiver cheia daquele item (99, ou
  999 Rédeas), o resgate daquele dia fica esperando e o cartão diz por quê.
- Nada é sorteado.

## 8. Onde aparece

```
ESTÁBULO  (dia para resgatar)              ESTÁBULO  (já resgatado hoje)
+------------------------------+           +------------------------------+
| Recompensa do dia      3 / 7 |           | Recompensa: amanhã 1 Manual  |
| 100 de Ouro       [Resgatar] |           +------------------------------+
| [ver os 7 dias]              |           | Brasa   Nv 12  **   Ativa    |
+------------------------------+           | Maré    Nv  8  *             |
| Brasa   Nv 12  **   Ativa    |
| Maré    Nv  8  *             |
+------------------------------+
 Estábulo* Correr Exped Haras Loja          (* ponto na aba quando há prêmio)

LOJA      [ Comprar ] [ Mochila ]          LOJA      [ Comprar ] [ Mochila ]
 Torrão de açúcar        tem 3              Torrão de açúcar       x3  [Usar]
 +1 ponto para distribuir                    +1 ponto para distribuir
 120  ·  1 de 2 hoje      [Comprar]         Estrela de treino      x0
 ...                                         Compre na loja
 Rédea nova: vem no 7º dia da               Rédea nova             x1  [Usar]
 recompensa diária                          ...

FICHA DO CAVALO > Status                   FICHA DO CAVALO > Skills
 ... os 7 status ...                        Casco Firme            [Trocar]
 [Usar Torrão: +1 ponto]  tem 3 · 2 de 10   [Usar Manual de doma: 35%]  tem 1
 [Usar Estrela de treino] tem 1
```

- **Cartão da diária.** Com prêmio para resgatar, o cartão é grande: o dia do calendário, o prêmio de hoje e o botão.
  Depois do resgate, ele encolhe para uma linha com o prêmio de amanhã. "Ver os 7 dias" abre os sete prêmios, com os
  já resgatados marcados e o de hoje em destaque.
- **Ponto na aba Estábulo** quando há prêmio para resgatar, no padrão do ponto que a aba Correr já usa.
- **Altura do Estábulo.** A 3b deixou o Estábulo de 3 cavalos exatamente numa tela (780 px, que é o limite do teste) e
  o de 6 cavalos em 1.012 px (limite 1.100). O cartão custa altura, e isso é aceito: **o Estábulo de 3 cavalos deixa de
  caber numa tela**. Os limites novos, medidos nos dois estados: com a diária já resgatada, os de hoje mais 40 px (820
  e 1.140); com prêmio para resgatar, os de hoje mais 110 px (890 e 1.210). A lista de cavalos em si não muda.
- **Altura da aba Status.** Os botões de item só aparecem quando o jogador tem o item, ficam abaixo da lista de status
  (perto do Redistribuir) e não tiram da primeira tela as 7 linhas de status. Sem itens, a altura da aba é a de hoje.
- **Loja a 360 px:** cada produto cabe sem rolagem lateral, com o botão de pelo menos 44 px de altura.

## 9. O dia e o relógio

- Sem servidor, "o dia" é a data do aparelho, no fuso dele. O jogo guarda o dia como um número inteiro (dias contados
  da data local), para comparar e somar sem texto de data.
- **Pode resgatar** quando o dia de hoje é maior que o dia do último resgate, ou quando nunca resgatou.
- **Relógio para trás:** se o dia de hoje ficar menor que o do último resgate, não há resgate nem volta dos limites
  da loja até a data passar de novo do último dia guardado. Nada é perdido e não há aviso de acusação: o cartão só
  diz "volte amanhã".
- **Relógio para a frente:** o jogador pode adiantar a data e resgatar de novo. Sem servidor não há como impedir;
  fica aceito e anotado como pendência até o online. O Vinicius foi avisado (2026-11-16).
- O relógio é lido num único lugar do `game.js`. As regras em `itens.js` recebem o dia como número e não leem o relógio.
- O dia só é conferido quando a tela é desenhada; não há contagem regressiva nem temporizador.

## 10. Save

- O save sobe para a **versão 7**. Campos novos: a mochila (quatro contagens), a diária (próximo dia do calendário,
  calendários completos, dia do último resgate), os limites da loja (dia, compras do dia, dia da última Estrela), o
  contador de usos sorteados e, em cada cavalo, os torrões.
- **Migração da versão 6:** tudo novo começa zerado, com a diária no dia 1 para resgatar. As Rédeas que o jogador já
  tem continuam. Nada do save antigo muda.
- **Valores fora da faixa** voltam ao padrão, como o resto do save faz hoje.
- **Proteção contra save mais novo** (pendência antiga do `ESTADO.md`, que tem de entrar antes de a versão subir): se o
  save guardado tiver versão maior que a do código, o jogo não o adota e não grava por cima. Mostra uma tela dizendo
  que o save é de uma versão mais nova e pede para atualizar a página. Vale para o save real e para o de teste.
  - Vale em todo caminho que adota um save: a leitura ao abrir, o save gravado por outra aba (o evento que hoje adota
    o save externo) e o estado guardado pela atualização ao vivo do artefato.
  - A tela é um bloqueio: só tem o texto e o botão **Recarregar**. Não oferece recomeçar, porque recomeçar apagaria
    justamente o save mais novo.

## 11. Economia: os números de partida

O Ouro hoje quase não entra. A casa fica com 10% de cada pote, então um jogador mediano perde em média 10% da entrada
por corrida (5 de Ouro na entrada de 50). Quem ganha Ouro correndo é quem monta um cavalo melhor que o dos bots da
sua liga. Por isso a diária passa a ser a entrada de Ouro garantida.

| Conta | Valor |
|---|---|
| Ouro da diária por calendário de 7 dias | 510 |
| Itens da diária por calendário, pelo preço da loja | 570 (1 Torrão, 1 Manual, 1 Cupom) |
| Teto de gasto na loja por semana | 6.830 (14 Torrões, 7 Manuais, 7 Cupons, 1 Estrela) |
| Dias até a primeira Estrela comprada só com o Ouro da diária | cerca de 28 |
| Estrela grátis | no 28º dia de resgate |
| Valor de um Torrão | 1 ponto; 10 torrões são de 3% a 5% dos pontos de um cavalo no nível 50 (196 a 287 pontos) |
| Valor de uma Estrela | 9% (★1→★2) ou 12% (★2→★3) a mais de pontos |

Estes números são de partida e ficam todos num só lugar do `data.js`, para o Vinicius ajustar depois de jogar. Nenhuma
meta do `balance.js` muda: os bots não usam itens, e o Poder continua medindo o cavalo como ele está.

## 12. Gaveta DEV

Um grupo novo, no padrão dos que existem:
- definir a quantidade de cada item da mochila;
- **avançar 1 dia** e **voltar 1 dia** (um deslocamento de dias guardado só no save de teste e lido só no modo DEV);
- zerar a diária e os limites da loja.

No jogo de produção o deslocamento não existe e o dia é sempre o do aparelho.

## 13. Celular, desktop e acessibilidade

- Valem as regras da 3a e da 3b: linhas em múltiplos de 2 px, só tokens do `:root`, sem `border-image`, Press Start 2P
  só em 8, 16 ou 24 px, contraste de pelo menos 4,5:1, botões com 44 px, foco visível.
- **Cores forçadas:** borda em cor do sistema nos produtos, nas linhas da mochila e no cartão; o dia de hoje do
  calendário e a parte aberta da Loja em `Highlight`.
- **Leitor de tela:** as duas partes da Loja no padrão das abas da ficha (`aria-pressed`); o cartão da diária com o dia e
  o prêmio num texto só; quantidade lida como "3 Torrões de açúcar", não "x3"; o resultado do uso na região viva.
- **Movimento reduzido:** nada novo pisca, pulsa ou desliza. Sem confete no resgate.
- **Ícones:** cinco ícones de item desenhados em código, no formato das peças de `interface-arte.mjs`. Sem PixelLab.
- **Explicações (ⓘ):** cada item ganha uma explicação curta, com o mesmo texto no wiki.
- **Desktop (1280):** a Loja usa a largura como as outras telas de lista; nada de rolagem lateral.

## 14. Testes

- **Regras (`itens.js`), no Node:** cada item pode e não pode nos casos da seção 4; o sorteio do Cupom e do Manual é o
  mesmo para a mesma seed e contador e muda com o contador; o Cupom nunca devolve a skill que saiu nem a skill de tipo;
  o Manual aprende em cerca de 35% de muitas seeds; a diária anda 7 dias, recomeça, dá a Estrela no 4º calendário e não
  dá duas vezes no mesmo dia; relógio para trás não libera; os limites da loja voltam com o dia e o da Estrela com 7 dias.
- **Simulação:** `freePoints` com 0, 1 e 10 torrões; teto de 150 continua; bots com 0.
- **Interface (bloco novo do `ui-test`):**
  - resgatar a diária, o cartão encolher, o ponto da aba sumir; não resgatar de novo no mesmo dia; avançar o dia pela
    gaveta DEV e resgatar o seguinte; voltar o dia e não resgatar; os 7 dias e o recomeço;
  - comprar cada item, o saldo e a mochila mudarem, o limite do dia travar e voltar no dia seguinte; "Sem Ouro";
    "Reservado" com a sala aberta; a Rédea nova não tem botão de compra;
  - usar cada item pela mochila e pela ficha, com a confirmação; recarregar a página depois de um Cupom e de um Manual
    e ver o mesmo resultado;
  - **com a sala aberta:** Cupom e Manual recusados no ativo (com o motivo) e aceitos em outro cavalo; Torrão e
    Estrela aceitos no ativo, e os pontos novos não entram se subirem o Poder acima do da sala; o resultado da corrida
    aberta não muda;
  - save da versão 6 abre com tudo zerado e a diária no dia 1; save de versão maior não é adotado nem gravado;
  - 360×780, 360×640 e 1280: sem rolagem lateral; as alturas da seção 8; cores forçadas; foco.
- **Asserções que já existem** não saem nem ficam mais fracas, com duas mudanças de propósito, que são desenho e não
  afrouxamento: os limites de altura do Estábulo passam aos da seção 8, e a asserção "sem equipamento: 4 abas (sem a
  Loja)" passa a exigir as 5 abas, com a Loja.
- **`balance.js` completo:** roda e fica verde, porque `freePoints` é regra.
- **Produção:** sem gancho de teste e sem o deslocamento de dias.

## 15. Documentos e memória

- `docs/GDD.md` §8.2: os cinco itens como estão no jogo (versões por Ouro e jogando), com os números; a diária entra
  como seção nova; a Rédea nova deixa de ser "só pela gaveta DEV".
- Wiki: seção de itens (o que faz, limites, preço, de onde vem), a diária e a aba Loja; a cobertura do `wiki-test`
  passa a exigir os itens.
- `docs/memoria/ESTADO.md` e `decisoes.md`: a frente, as decisões desta seção 1 e as da execução, a pendência do
  relógio para a frente e a lista do que o Vinicius tem de olhar ao jogar.
- Capturas oficiais: Estábulo (com o cartão), Loja (Comprar e Mochila) e a ficha com os botões de item.

## 16. Deixado para o executor

- O nome dos campos novos do save, a marcação das telas e o texto exato dos avisos e dos motivos.
- O sal do sorteio dos itens.
- O desenho dos cinco ícones.
- Como o teste de interface controla o dia (pela gaveta DEV ou pelo relógio do navegador de teste).
- Onde exatamente os botões de item entram nas abas Status e Skills, dentro das alturas da seção 8.
- A ordem das tarefas.

## 17. Decisões desta spec

**Do Vinicius:** as oito da seção 1.

**Do controlador** (ele pode trocar qualquer uma):
- Torrão: teto de 10 por cavalo.
- Manual de doma: 35% de chance.
- Preços e limites da seção 6 e os prêmios da seção 7.
- A Rédea nova fora da loja, no 7º dia da diária (pelo "nunca por Ouro" do GDD).
- Cupom e Manual recusados no cavalo ativo com a sala aberta; Torrão e Estrela aceitos.
- Todo uso de item pede confirmação.
- Mochila com teto de 99 por item (a Rédea nova mantém o teto de 999 que já tem).
- A estrela ganha por item vale para a cruza, como qualquer estrela; skills vindas de item valem na herança.
- O Cupom troca qualquer skill das vagas, não só as aprendidas por nível.
- "Usar" a Rédea nova pela mochila leva ao Redistribuir de hoje, sem mudar o custo.
- O Estábulo de 3 cavalos deixa de caber numa tela por causa do cartão da diária (40 px a mais depois do resgate).
- A tela de "save mais novo" é um bloqueio com o botão Recarregar, sem recomeçar.
- Relógio do aparelho, com a trava para trás e sem trava para a frente.
- A proteção contra save mais novo entra nesta frente.
- Regras num módulo próprio (`itens.js`).
- Ícones desenhados em código, sem créditos.
