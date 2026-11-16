# Visuais 2, parte 3c: tela da corrida

Desenho de 2026-11-15, conversado com o Vinicius. **Aprovado pelo Vinicius em 2026-11-16.** Branch `claude/visuais-2`, sobre as partes 3a (acabamento) e 3b
(Estábulo e montaria no celular), que esperam a avaliação dele. É a última parte da frente "interface" (divisão na spec
da 3a, `docs/superpowers/specs/2026-11-14-interface-acabamento-design.md`).

## 1. Intenção

Em 2026-11-12 o Vinicius escolheu, para a tela da corrida, "nomes, posições, Dado, skills disparando, chegada e pódio
mais claros e mais vistosos". O alvo é o celular em pé (360 px de largura). Hoje, numa corrida de 7 cavalos a 360×780:

| Parte | Como está | Problema |
|---|---|---|
| Posições e nomes | só "2º/7" no painel do topo | a câmera segue o cavalo do jogador, os rivais saem da tela e nada mostra quem está na frente; os nomes só aparecem na narração |
| Narração | 2 ou 3 frases, cada uma cortada com "…" | a frase mais importante some pela metade |
| Dado da Sorte | faixa de números no topo da pista ("1 81 2 75 6 65…") e um dado sobre cada cavalo | é preciso decifrar quem tirou o quê; o efeito no clima vem numa segunda faixa, depois |
| Skills dos rivais | plaquinha com o nome abreviado ("RAÍZES FIRM.") | o nome da skill fica cortado |
| Chegada | "FOTO DE CHEGADA" em câmera lenta e a etiqueta "VOCÊ 2º" | falta o momento do resultado do jogador |
| Resultado | 2.335 px de altura (3 telas): pódio, saldo, botões, "Momentos da corrida" e "Ordem de chegada" empilhados | o pódio é pequeno e as duas listas empurram tudo para baixo |
| Painel do topo | caixas chapadas desenhadas no canvas | ainda sem o contorno e o bisel da 3a |

**Decisões do Vinicius (2026-11-15):**
1. **Posições:** uma faixa de ordem embaixo da pista.
2. **Dado:** uma faixa grande com o resultado na pista e os números na faixa de ordem.
3. **Chegada e resultado:** uma faixa com o lugar do jogador na pista e o resultado numa tela, com abas.
4. **Pódio (2026-11-16):** só o 1º lugar maior, no centro; o 2º e o 3º do tamanho de hoje.

## 2. Objetivo, fora do escopo e o que não pode acontecer

**Objetivo.** No celular a 360×780:
- durante a corrida, ver sempre a ordem de todos os corredores e o nome de quem está logo à frente e logo atrás;
- no Dado, ler numa frase quem tirou o maior dado e o que aconteceu com o clima;
- na chegada, ver o lugar do jogador em destaque;
- no resultado, ter numa tela o pódio, o lugar, o prêmio, o XP, os botões e a linha de abas, sem rolar (o caso base:
  sem subida de nível, sem skill aprendida e sem aviso de Ouro); a altura do documento cai de ~2.400 px para
  ≤ 1.500 px (7 corredores, aba "Chegada" aberta). Se as duas metas do resultado brigarem, vale a da primeira tela.
  *Conta do revisor da spec:* com a tabela de hoje (linhas de 77 px) o documento daria ~1.530–1.600 px; a meta fecha
  com as duas decisões do controlador da seção 8 (a frase de enfeite sai e as linhas da tabela vão a 2 linhas de texto).

**Fora do escopo:**
- a sala de largada e a aba Correr;
- sons;
- poses e animações novas dos cavalos (são a 2c, que espera créditos);
- qualquer regra, número ou texto de regra;
- a simulação (`sim.js`, `data.js`, `breed.js`, `gear.js` não mudam, e o `balance.js` fica igual).

**Não pode acontecer:**
- o que se vê adiantar o que a simulação ainda não mostrou: a faixa de ordem segue o instante que a pista mostra, e os
  números do Dado só aparecem depois de o Dado rolar na tela;
- a corrida deixar de ser determinística ou o desenho passar a decidir qualquer coisa (CLAUDE.md §8: o cliente só
  anima; Dado e clima só pela RNG da seed);
- "Pular para o resultado" deixar de funcionar em algum momento (com faixa na tela, na câmera lenta, no Dado);
- rolagem lateral a 360 px ou os controles da corrida fora da tela;
- a pista entrar no layout compacto (sem minimapa) em telas onde hoje não entra: a 360×640 ela continua com
  `lay.compact === false`;
- o custo de desenho por quadro passar do teto que o `ui-test` já confere;
- teste afrouxado para caber o desenho novo.

## 3. Abordagem

O que fica **fora da pista** vai em HTML e CSS, com as peças da 3a: a faixa de ordem, a narração e a tela de resultado.
O texto fica nítido, o leitor de tela lê e o `ui-test` confere pelo DOM. O que acontece **na pista** continua no canvas,
onde já mora: a faixa do Dado, a faixa do lugar, os dados e as plaquinhas.

Descartadas:
- **Faixa de ordem desenhada no canvas:** custa chamadas de desenho a cada quadro (há um teto testado), o texto fica na
  fonte de pixel do canvas e o leitor de tela não lê.
- **Painel do topo refeito em HTML por cima da pista:** retrabalho grande para um painel que funciona. Ele só ganha o
  acabamento.

## 4. Faixa de ordem

```
┌──────────── pista ────────────┐
│ 2º/7  EST ▰▰▰▱▱   1:13 70km/h │
│          🐎 ◄VOCÊ             │
└───────────────────────────────┘
 1º[7] 2º[1]◄ 3º[6] 4º[4] 5º[5] 6º[2] 7º[3]
 À frente: Mandacaru +3 m · Atrás: Lambari −4 m
```

- **Onde:** entre a pista e a narração, na tela da corrida. Não existe na sala de largada.
- **Linha dos corredores:** um item por corredor, na ordem da corrida. Cada item tem a posição ("1º") e o selo da raia
  (`laneChip`: o número na cor da seda). O item do jogador tem destaque dourado. Cabe numa linha a 360 px com 8
  corredores.
- **Linha dos vizinhos:** o nome do cavalo logo à frente e do logo atrás do jogador, cada um com a distância em metros
  inteiros ("+3 m", "−4 m"). Na ponta, "Você lidera" no lugar do "À frente". Em último, só o "À frente". Depois que o
  jogador cruza a linha, a linha mostra o lugar final ("Você chegou em 2º").
- **Ordem:** a mesma do painel do topo: `ranking(st, simT)`, o estado do instante que a pista mostra. Quem já cruzou
  fica fixo no lugar de chegada. Na contagem da largada, a ordem é a das raias.
- **Atualização:** a linha dos corredores só é reescrita quando a ordem muda. As distâncias, no máximo 2 vezes por
  segundo. Nada é reescrito a cada quadro.
- **Leitor de tela:** a faixa é uma lista com o nome "Classificação", e cada item diz a posição, o nome do cavalo e
  "você" no do jogador. Não é região viva: os anúncios continuam os do `#anuncio` de hoje.
- **Altura fixa:** a faixa não cresce nem encolhe durante a corrida (senão a pista refaz o layout). Em tela normal,
  a altura já inclui a linha dos números do Dado (seção 6), vazia fora do Dado.
- **Tela baixa** (altura da janela < 700 px): só a linha dos corredores, numa linha de ~28 px. A linha dos vizinhos
  some, e não há linha própria para os números do Dado: durante o Dado, o número toma o lugar da posição ("1º") em
  cada item. *Decisão do controlador, pela conta do revisor:* a 360×640 a pista tem hoje 400 px e o layout compacto
  começa abaixo de 380 px; a faixa (28 + 8 de espaço) só cabe se a narração cair para 1 frase em 1 linha (33 px).
- **Telas largas** (≥ 600 px): cada item pode mostrar também o nome do cavalo, se couber numa linha (escolha do
  executor).

## 5. Narração, plaquinhas e painel do topo

- **Narração (`#feed`):** cada frase pode ocupar até 2 linhas, sem "…". Mostra as frases mais novas que cabem. A altura
  é fixa: a narração não cresce nem encolhe a pista durante a corrida. Em tela baixa, 1 frase em 1 linha (só ali a
  frase ainda pode cortar com "…"; decisão do controlador, pela conta da seção 4). Os ordinais usam a mesma
  marcação do resto do jogo (o "o" sobrescrito visual com `aria-hidden` e o "º" num `.sr`), sem causar rolagem
  lateral. Na 3b isso foi desligado só aqui porque, com a frase em uma linha cortada, o `.sr` estourava a largura.
- **Plaquinhas de skill dos rivais** (`nomeCurto` no `fx.js`):
  - o nome inteiro, quando cabe numa linha;
  - senão, em duas linhas;
  - a abreviação com ponto fica só como último recurso, quando as raias são estreitas demais para duas linhas.

  A faixa grande da skill do jogador não muda.
- **Painel do topo:** as caixas (posição, estamina, vento, clima, relógio, minimapa, selo de CURVA/SUBIDA) ganham o
  contorno escuro e o bisel de 1 pixel de arte da 3a. O conteúdo e a posição não mudam.

## 6. Dado da Sorte

```
│ ╔═══════════════════════════╗ │
│ ║ 🎲 MAIOR DADO: BRASA 86   ║ │
│ ║ ☀ O SOL ABRE!             ║ │
│ ║ VOCÊ TIROU 73             ║ │   (só quando o maior dado é de um rival)
│ ╚═══════════════════════════╝ │
│        [86]★ 🐎               │
 1º[7] 2º[1]◄ 3º[6] 4º[4] …
  38   86★    65    30
```

- **Faixa grande, na pista:** enquanto o Dado está ativo (`dadoAtivo(simT)`), no lugar da faixa de números de hoje
  (`FX.drawDiceStrip`). Linhas:
  1. o ícone do dado e "MAIOR DADO: <nome do cavalo> <número>" — o nome e o número são o maior texto da faixa;
  2. o ícone do clima e o efeito, com a mesma frase que a narração usa para aquele Dado ("o sol abre!", "começa a
     chover!", "o clima segura!"…);
  3. "VOCÊ TIROU <número>", só quando o vencedor não é o jogador.
- **Número de cada corredor:** o que vale para ele no Dado (com dois dados pela Sorte, o maior), como a faixa de hoje.
- **Dados sobre os cavalos:** continuam. O do vencedor fica maior e destacado. Com movimento reduzido, o destaque é
  parado.
- **Faixa "CLIMA: X" que vinha depois do Dado:** sai, porque a linha 2 já diz o efeito. O clarão leve da virada e o
  anúncio do `#anuncio` ("O clima virou: X.") continuam.
- **Na faixa de ordem:** enquanto o Dado está ativo, cada item mostra o número que o corredor tirou, e o do vencedor
  tem uma marca. Em tela normal o número fica embaixo do selo, na linha reservada; em tela baixa, no lugar da posição
  (seção 4). Antes e depois, nada.
- **Câmera lenta, duração e "Pular" no meio:** como hoje.

## 7. Chegada

- **Faixa do lugar:** quando o cavalo do jogador cruza a linha, uma faixa grande na pista mostra:

  | Lugar | Texto | Cor |
  |---|---|---|
  | 1º | VITÓRIA! | ouro |
  | 2º | 2º LUGAR | prata |
  | 3º | 3º LUGAR | bronze |
  | 4º em diante | Nº LUGAR | neutra (como o painel) |

- **Duração e lugar:** cerca de 2,5 s de tempo real, abaixo da etiqueta "FOTO DE CHEGADA", sem cobri-la.
- **Sem confete nem partículas novas.** Com movimento reduzido, a faixa aparece e some sem animação.
- **Etiqueta "VOCÊ 2º"** sobre o cavalo: continua.
- **Pulando para o resultado,** a faixa não aparece.
- **Leitor de tela:** o anúncio de hoje ("Você cruzou a linha em 2º lugar.") continua, sem repetição.

## 8. Resultado

```
Prado Beira-Rio                🪙 544
┌───────────────────────────────┐
│          🐎                   │
│    🐎   ▇1▇    🐎             │
│   ▇2▇   ▇▇▇   ▇3▇             │
│  Brasa Mandacaru Lambari       │
└───────────────────────────────┘
Você chegou em 2º de 7
Entrada −50 · Prêmio +94 · Resultado +44
XP ▰▰▰▰▰▰▱  +70        Saldo 🪙 544
[ Correr de novo ]      [ Voltar ]
[ Chegada ] [ Momentos ]
┌ Ordem de chegada ─────────────┐
```

- **Pódio: só o 1º lugar maior** (decisão do Vinicius, 2026-11-16). Os três maiores não cabem lado a lado: a coluna
  tem 328 px a 360 px de tela e cada cavalo teria 120 px.
  - O 1º lugar é desenhado um passo de escala acima (3, cerca de 120×104 px), no centro. O 2º e o 3º ficam na escala
    de hoje (2, cerca de 90×78 px). Os pixels do vencedor ficam maiores que os dos outros dois; isso é aceito. Em
    densidade fracionária a razão entre as duas escalas pode não ser exatamente 1,5 (arredondamento do `setupCanvas`).
  - O canvas continua com a largura de hoje (336 px, 4 px além da coluna de cada lado) e cresce em altura o que o
    cavalo maior pedir (cerca de 26 px). Os espaçamentos entre os três são refeitos para os cavalos não se tocarem.
  - Os degraus, os números, os nomes embaixo e o destaque do jogador continuam.
- **Bloco do resultado:** a manchete de hoje ("Vitória! 1º de 7" / "Você chegou em 2º de 7") continua sendo o `h1`
  com o foco. Entrada, prêmio e resultado em uma linha (quebra se precisar), o saldo e o XP. No treino, os textos de
  treino de hoje.
- **Frase embaixo da manchete** (decisão do controlador): fica só quando explica algo — "Pódio sem prêmio: com N
  corredores só 1º e 2º são pagos.". As de enfeite ("Na frente de todo mundo…", "No pódio do…", "Fora do pódio desta
  vez…") saem: o nome da pista está no topo e o lugar na manchete, e os 50 px delas são a folga da primeira tela.
- **Avisos:** de nível, de skill aprendida, de Ouro acabado (com o botão "Treino gratuito") e, com o equipamento
  ligado, a linha da Pedra Negra: quando houver, entram como hoje, acima dos botões. Nesses casos a primeira tela pode
  rolar; a meta "sem rolar" vale para o caso base.
- **Botões:** "Correr de novo" (ouro) e "Voltar" lado a lado, numa linha a 360 px (hoje a grade os empilha). As
  condições de hoje (sem Ouro para a entrada etc.) não mudam.
- **Abas:** "Chegada" | "Momentos", com o componente de sub-abas da ficha (`aria-pressed`). Abre em "Chegada".
  - **Chegada:** a tabela "Ordem de chegada" de hoje e a nota do Dado da Sorte. Cada linha da tabela passa de 3 para
    2 linhas de texto na célula do cavalo (o nome numa, e dono, nível e chance de skill na outra), com ≤ 70 px de
    altura; nenhum dado sai (decisão do controlador, para a meta de altura fechar).
  - **Momentos:** a lista "Momentos da corrida" de hoje. Sem momentos, a aba mostra "Nenhum momento marcante nesta
    corrida." em vez de sumir.
- **Nada de conteúdo sai,** além das três frases de enfeite acima: tudo o que o resultado mostra hoje continua em uma
  das abas ou na primeira tela.

## 9. Pendências da 3b que entram

1. **Motivo que repete uma frase já na tela** (Confirmar travado, Redistribuir, Expandir com reserva): quando o
   contêiner do botão já mostra a mesma frase, a linha `.motivo` não é criada. A frase que já está lá ganha um
   destaque parado por 2 s, e o motivo vai para a região viva `#motivo-vivo`. O toque continua sem executar a ação.
2. **Lista que pula quando a `.motivo` some:** se a linha removida está acima do ponto tocado, a rolagem é compensada
   para o que está sob o dedo não sair do lugar.
3. **Plaquinha "Ativa"** da linha do Estábulo: contorno em cor do sistema no modo de cores forçadas.

## 10. Celular, desktop, desempenho e acessibilidade

- **Altura:** a faixa de ordem e a narração somadas não tiram a pista do layout normal: a 360×640, `lay.compact`
  continua falso; a 360×780, os controles ficam dentro da janela (`checkRaceFits`).
- **Desktop:** a mesma tela, com a pista larga de hoje. A faixa de ordem fica na largura da pista.
- **Desempenho:** a faixa de ordem não é reescrita a cada quadro. O teto de chamadas de canvas por quadro e a medida
  de tempo por quadro do `ui-test` passam sem mudar o limite. Se o bisel do painel estourar o teto, a moldura do
  painel é pré-desenhada num canvas fora da tela.
- **Movimento reduzido:** nenhuma faixa nova pisca, pulsa ou desliza.
- **Cores forçadas:** a faixa de ordem e as abas do resultado seguem as regras da 3a (borda em cor do sistema; o item
  do jogador e a aba atual em `Highlight`).
- **Regras da 3a e da 3b:** sem `border-image`; grade de 2 px; só tokens do `:root`; Press Start 2P só em 8, 16 ou
  24 px no HTML; contraste ≥ 4,5:1.

## 11. Testes

**`ui-test.mjs`** (bloco novo `corrida`, filtrável por `UI_SO`; os blocos de hoje que olham a corrida e o resultado são
adaptados sem perder asserção):
1. **Faixa de ordem:**
   - existe na corrida e não na largada;
   - tem um item por corredor;
   - em três instantes da corrida, a ordem dos itens é a de `ranking` do estado daquele instante (lido de
     `window.__galope.race._state`);
   - o item do jogador é o destacado;
   - os nomes e as distâncias dos vizinhos batem com o estado (± 1 m);
   - depois que o jogador cruza, a linha dos vizinhos mostra o lugar final;
   - o nome acessível de cada item tem a posição e o nome do cavalo.
2. **Tela baixa:** a 360×640, `lay.compact === false`, os controles dentro da janela, a linha dos vizinhos ausente e,
   no Dado, o número no lugar da posição; a 360×780, as duas linhas presentes e o número embaixo do selo. Em nenhum dos
   dois tamanhos a altura da faixa ou da pista muda entre a largada, o Dado e a chegada.
3. **Dado:** na janela do Dado:
   - a faixa nova é desenhada e a faixa de números não;
   - a faixa de ordem mostra, em cada item, o número daquele corredor (igual ao `rolls` do Dado), com a marca no
     vencedor;
   - fora da janela, nenhum número;
   - "Pular" no meio continua levando ao resultado;
   - as conferências de hoje (dados sobre os cavalos, câmera lenta) continuam.
4. **Chegada:**
   - a faixa do lugar aparece quando o jogador cruza, com o texto do lugar dele;
   - não aparece ao pular;
   - com movimento reduzido, aparece sem animação.
5. **Resultado:**
   - a 360×780, no caso base (sem subida de nível, skill aprendida nem aviso de Ouro), o fundo da linha de abas fica
     dentro da janela sem rolar;
   - a altura do documento com 7 corredores e a aba "Chegada" é ≤ 1.500 px;
   - no pódio, o cavalo do 1º lugar é desenhado numa escala maior que a do 2º e do 3º, os três inteiros dentro do
     canvas e sem se sobrepor;
   - abre em "Chegada";
   - "Momentos" mostra a lista;
   - sem momentos, mostra a frase;
   - as conferências de hoje sobre prêmio, saldo, XP, ordem de chegada e momentos continuam, agora na aba certa.
6. **Narração:** uma frase longa aparece inteira em até 2 linhas, sem reticências; os ordinais têm o `.sr`; sem
   rolagem lateral a 360 e a 390 px nas telas de corrida que o teste já visita.
7. **Plaquinha:** no layout normal, uma skill de rival com nome de duas palavras aparece com o nome inteiro.
8. **Desempenho:** o teto de chamadas por quadro e o tempo por quadro passam com os limites de hoje.
9. **Pendências da 3b:** o motivo não duplica a frase (a frase aparece uma vez e a região viva a recebe); o que está
   sob o dedo não muda de posição quando a `.motivo` some; a plaquinha "Ativa" tem borda em cores forçadas.

**`fx-test.js`:** os testes da faixa de números do Dado (`FX.drawDiceStrip`) viram testes da faixa nova, com o mesmo
rigor: o que é desenhado para um Dado com vencedor rival, com vencedor jogador, com e sem virada de clima.

As capturas oficiais de `prototype/screens/` são regeneradas (a interface muda de propósito).

## 12. Documentos e memória

- `docs/GDD.md` (tela da corrida e resultado): a faixa de ordem, a faixa do Dado, a faixa do lugar e as abas.
- `docs/memoria/decisoes.md`: as três decisões do Vinicius e as do executor.
- `docs/memoria/ESTADO.md`: a 3c pronta, a frente "interface" completa, e o que fica para ele confirmar.
- A folha da interface (`dist/interface.html`) ganha a faixa de ordem e as abas do resultado.

## 13. Deixado para o executor

- O desenho exato da faixa de ordem, das faixas na pista e do pódio, dentro das regras acima e das peças da 3a.
- O tamanho do texto de cada faixa na pista, desde que caiba a 360 px sem cortar.
- A altura fixa da narração em tela normal e em tela baixa.
- Se os itens da faixa de ordem mostram o nome do cavalo em telas largas.
- Onde guardar a aba aberta do resultado (volta para "Chegada" a cada resultado novo).
