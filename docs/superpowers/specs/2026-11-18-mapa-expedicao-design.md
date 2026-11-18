# Mapa da Expedição: mapa-múndi, mapa do ginásio, ginásios em sequência e a figura do jogador (desenho curto)

Data: 2026-11-18. Pedido do Vinicius: "Ainda quero aprimorar a interface, algo mais visual e intuitivo, temos muitos
botões, por exemplo, os ginásios devem seguir uma sequência, você só consegue lutar com um, vencendo o anterior (pode
decidir o primeiro, segundo e último). O mapa, deve ser construído usando o exemplo em anexo de referência (...) existe
um indicador no mapa dizendo que tal lugar é a insígnia de fogo, ao clicar, ele abre um outro mapa com trilhas e caminhos
entre os oponentes, até chegarmos no dono do ginásio, e ao clicar em um dos oponentes, mostra a imagem do oponente +
cavalo vs a gente (precisamos também adicionar a imagem do nosso jogador ao lado do cavalo, estilo pokemon onde os
treinadores ficam atrás e o pokemon na frente". Depois: "Pode seguir com as metas e mapas".

É o segundo de dois projetos (o primeiro, o balanço, está em `2026-11-18-balanco-superioridade-design.md`). A referência
dele é o mapa de um jogo que existe: o nosso mapa segue o mesmo espírito (uma ilha vista de cima, caminhos pontilhados e
marcadores), com arte nossa, desenhada por código. Nada da arte da referência é copiado.

## Combinado

- Só a aba **Expedição** vira mapa; as outras abas ficam como estão.
- Ordem: **Capoeira (Grama) → Remanso (Água) → Fornalha (Fogo)**. Cada ginásio é mais forte que o anterior, e o primeiro
  é mais fácil que os de hoje (o Recruta no nível 2).
- Arte paga (PixelLab) só com confirmação: o mapa e a figura do jogador saem desenhados por código; a figura do jogador
  ganha arte do PixelLab se ele confirmar o gasto.

## 1. Ginásios em sequência

- `GYM_ORDER` passa a ser `['grama', 'agua', 'fogo']` (a ordem do mapa, do Perfil, da gaveta DEV e do wiki).
- Um ginásio está **aberto** se é o primeiro, se o líder do anterior já foi vencido (a insígnia) ou se ele já tem alguma
  etapa vencida (save de antes desta regra: ninguém perde o que já fez). Fechado: não abre, e o mapa diz o motivo
  ("Vença o líder da Capoeira").
- A regra mora no módulo (`Ginasio.aberto(gymId, progresso)` e o motivo novo `'ginasio-fechado'` no `podeDesafiar`): a
  tela só mostra, e um desafio de ginásio fechado é recusado antes de pagar.
- Dentro de cada ginásio nada muda: as cinco etapas em ordem, a revanche do líder uma vez por dia, o cansaço, os prêmios
  da 1ª vitória, tudo pela seed e numa gravação só.

### Força, entradas e prêmios (partida, para ele ajustar jogando)

| Ginásio | Níveis (4 soldados e o líder) | Entradas | Ouro da 1ª vitória |
|---|---|---|---|
| 1º Capoeira | 2 · 4 · 6 · 8 · 10 | 10 · 15 · 20 · 25 · 50 | 50 · 75 · 100 · 125 · 250 |
| 2º Remanso | 11 · 13 · 15 · 17 · 20 | 20 · 30 · 40 · 50 · 100 | 80 · 120 · 160 · 200 · 400 |
| 3º Fornalha | 21 · 23 · 25 · 27 · 30 | 30 · 45 · 60 · 75 · 150 | 120 · 180 · 240 · 300 · 600 |

Os itens da trilha (Torrão no soldado 2, Manual no soldado 4, Rédea e Cupom no líder), os times (1, 1, 2, 2 e 3
cavalos, todos ★★ com a genética do inicial do elemento) e a revanche (50 de entrada, o rodízio de prêmios) ficam
iguais nos três. O jogador novo (inicial no nível 1) já pode tentar o Recruta da Capoeira: é um duelo quase parelho,
e a vantagem de elemento (Fogo vence Grama) ajuda quem começou com a Brasa.

As metas G do `balance.js` são relativas ao nível de cada etapa e continuam valendo; as faixas que não fecharem nos
níveis baixos (onde 4 níveis são poucos pontos) são rebaseadas ao medido, com o motivo.

## 2. Mapa-múndi (a aba Expedição)

- Uma ilha em pixel art, desenhada por código num canvas (168 × 216 px de arte, em escala inteira): mata e campo ao sul
  (Capoeira), um lago a leste (Remanso), sertão e um vulcão ao norte (Fornalha), o estábulo do jogador na ponta sul e um
  caminho pontilhado ligando tudo na ordem da sequência. O trecho já percorrido fica claro; o que falta, apagado.
- Cada ginásio é um **botão de verdade** sobre o mapa (44 px ou mais, com nome): vencido (a insígnia e "Revanche hoje"
  quando houver), aberto ("2 de 5", com o marcador amarelo "você está aqui" no primeiro ginásio sem insígnia) ou fechado
  (cadeado, apagado, com o motivo).
- Embaixo do mapa continua a vitrine "Cavalos selvagens".
- A 360 px nada rola de lado; em paisagem e no computador o mapa fica centrado, na maior escala inteira que couber.

## 3. Mapa do ginásio

- Tocar num ginásio aberto abre o mapa dele (o lugar da trilha de hoje): um cenário do elemento (margem de rio no
  Remanso, clareira na Capoeira, encosta de lava na Fornalha) com um caminho em S e cinco tablados, do Recruta, embaixo,
  ao líder, no alto.
- Em cada tablado, a figura do oponente (a arte que já existe; o líder maior). Vencido: figura normal com o selo de
  vencido. Próximo: o marcador amarelo. Fechado: em silhueta, com "???" (o líder aparece como "Líder").
- Cada oponente é um botão com o nome, o nível e a entrada; só o próximo (ou a revanche do líder) abre o desafio.
- Continuam na tela: o elemento, "N de 5 vencidos", o ponto fraco escrito e, com a insígnia, o nome e o bônus dela.

## 4. A cena do desafio com o jogador

- Tocar no próximo oponente abre o preparo de hoje com a **cena no alto**: o oponente e o 1º cavalo dele em cima, à
  direita; **a figura do jogador e o 1º cavalo do time embaixo, à esquerda**, o jogador atrás do cavalo e de costas,
  como nos jogos de monstrinhos. Embaixo da cena: o adversário, a pista da casa, a entrada, o prêmio, o time e o
  "Desafiar", como hoje. A cena acompanha o time: muda quando o 1º cavalo muda.
- A tela de desafio de antes de cada duelo (a "Cena 2" que já existe) ganha a mesma figura do jogador.
- A figura do jogador é desenhada por código, de costas, com as cores do uniforme do jóquei do jogador (as mesmas da
  corrida). Se o Vinicius confirmar o gasto, entram candidatas do PixelLab no mesmo estilo dos oponentes.
- A cena não mostra nada do resultado: no preparo nada foi pago nem sorteado.

## 5. O que não muda

- Regras de Ouro e Gemas; desafio só é sorteado depois de pago, pela seed, numa gravação só; revanche uma por dia em
  cada ginásio; o bônus de insígnia é da conta e não entra na simulação.
- As outras abas, a tela de corrida e o resumo do desafio.

## 6. Testes e documentos

- `sim-test.js`/testes do módulo: `aberto` e o motivo `'ginasio-fechado'`; os níveis por ginásio.
- `ui-test.mjs`: o mapa (botões com 44 px, estados, ginásio fechado não abre, sem rolagem lateral a 360, canvas
  desenhado), o mapa do ginásio (o mesmo contrato da trilha: `data-etapa` e `data-estado`) e a figura do jogador na cena.
- `balance.js` completo (metas G), wiki (gerado), `docs/GDD.md` §8.6, memória e capturas oficiais (a interface muda de
  propósito).
